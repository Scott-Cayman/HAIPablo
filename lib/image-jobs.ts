import { prisma } from '@/lib/prisma';
import {
  extractStoredJobPayload,
  getUserFacingErrorMessage,
  runImageGeneration,
} from '@/lib/image-generation';

export type ImageJobStatus = 'queued' | 'processing' | 'success' | 'failed' | 'cancelled';

export interface ImageJobResponse {
  success: boolean;
  jobId: string;
  historyId: string;
  status: ImageJobStatus | string;
  progressText: string;
  imageUrl?: string | null;
  revisedPrompt?: string | null;
  providerId?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string | null;
}

function getRawErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error || '未知错误');
}

function getProgressText(status: string): string {
  switch (status) {
    case 'queued':
      return '任务已提交，等待开始';
    case 'processing':
      return '正在调用图片供应商';
    case 'success':
      return '图片已生成完成';
    case 'failed':
      return '图片生成失败';
    case 'cancelled':
      return '任务已取消';
    default:
      return '任务状态未知';
  }
}

export function toImageJobResponse(history: {
  id: string;
  status: string;
  outputImageUrl: string | null;
  prompt: string;
  providerId: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}): ImageJobResponse {
  return {
    success: history.status === 'success',
    jobId: history.id,
    historyId: history.id,
    status: history.status,
    progressText: getProgressText(history.status),
    imageUrl: history.outputImageUrl,
    revisedPrompt: history.status === 'success' ? history.prompt : null,
    providerId: history.providerId,
    errorMessage: history.errorMessage,
    startedAt: history.startedAt?.toISOString() || null,
    finishedAt: history.finishedAt?.toISOString() || null,
    createdAt: history.createdAt.toISOString(),
  };
}

async function failJobAndRefund(jobId: string, userId: string, message: string) {
  await prisma.$transaction([
    prisma.generationHistory.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage: message,
        creditsUsed: 0,
        finishedAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        credits: { increment: 1 },
      },
    }),
  ]);
}

export function scheduleImageGenerationJob(jobId: string) {
  setTimeout(() => {
    void processImageGenerationJob(jobId);
  }, 0);
}

export async function processImageGenerationJob(jobId: string) {
  const startedAt = Date.now();
  const history = await prisma.generationHistory.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      userId: true,
      status: true,
      configJson: true,
    },
  });

  if (!history || history.status === 'success' || history.status === 'failed' || history.status === 'cancelled') {
    return;
  }

  const claimed = await prisma.generationHistory.updateMany({
    where: {
      id: jobId,
      status: 'queued',
    },
    data: {
      status: 'processing',
      errorMessage: null,
      startedAt: new Date(),
      finishedAt: null,
    },
  });

  if (claimed.count === 0) {
    return;
  }

  const payload = extractStoredJobPayload(history.configJson);
  if (!payload) {
    console.warn(`[job:${jobId}] 任务配置缺失，终止执行`);
    await failJobAndRefund(jobId, history.userId, '任务配置缺失，无法继续执行');
    return;
  }

  console.info(`[job:${jobId}] 开始执行`, {
    templateId: payload.templateId || null,
    templateName: payload.templateName || null,
    providerId: payload.providerId || 'auto',
    mode: payload.mode || 'generation',
    imageCount: payload.images?.length || 0,
    referenceCount: payload.referenceImages?.length || 0,
  });

  try {
    const result = await runImageGeneration(payload);

    await prisma.generationHistory.update({
      where: { id: jobId },
      data: {
        prompt: result.revisedPrompt,
        outputImageUrl: result.imageUrl,
        thumbnailUrl: result.imageUrl,
        status: 'success',
        providerId: result.providerId,
        errorMessage: null,
        creditsUsed: 1,
        finishedAt: new Date(),
      },
    });

    console.info(`[job:${jobId}] 生成成功`, {
      durationMs: Date.now() - startedAt,
      providerId: result.providerId,
      providerLabel: result.providerLabel,
      imageUrl: result.imageUrl,
      fallbackUsed: result.fallbackUsed,
      attemptedProviderIds: result.attemptedProviderIds,
    });
  } catch (error) {
    const userFacingMessage = getUserFacingErrorMessage(error);
    console.error(`[job:${jobId}] 生成失败`, {
      durationMs: Date.now() - startedAt,
      userFacingMessage,
      rawMessage: getRawErrorMessage(error),
      providerId: payload.providerId || 'auto',
      mode: payload.mode || 'generation',
    });
    await failJobAndRefund(jobId, history.userId, userFacingMessage);
  }
}

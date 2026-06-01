import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import {
  buildFinalPrompt,
  createStoredJobConfig,
  type ImageGenerationRequestPayload,
} from '@/lib/image-generation';
import { scheduleImageGenerationJob } from '@/lib/image-jobs';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  let requestBody: Partial<ImageGenerationRequestPayload> | null = null;
  let currentUserId: string | null = null;

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    currentUserId = currentUser.userId;
    const body = (await request.json()) as Partial<ImageGenerationRequestPayload>;
    requestBody = body;

    if (!body.promptTemplate) {
      return NextResponse.json({ error: '缺少提示词模板' }, { status: 400 });
    }

    const payload: ImageGenerationRequestPayload = {
      userId: currentUser.userId,
      promptTemplate: body.promptTemplate,
      mode: body.mode,
      templateId: body.templateId,
      templateName: body.templateName,
      providerId: body.providerId,
      size: body.size,
      quality: body.quality,
      variables: body.variables,
      images: Array.isArray(body.images) ? body.images : [],
      referenceImages: Array.isArray(body.referenceImages) ? body.referenceImages : [],
      config: body.config && typeof body.config === 'object'
        ? (body.config as Record<string, unknown>)
        : null,
    };

    const finalPrompt = buildFinalPrompt(payload.promptTemplate, payload.variables);

    const history = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: currentUser.userId },
        select: { credits: true },
      });

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      if (user.credits < 1) {
        throw new Error('INSUFFICIENT_CREDITS');
      }

      await tx.user.update({
        where: { id: currentUser.userId },
        data: {
          credits: { decrement: 1 },
        },
      });

      return tx.generationHistory.create({
        data: {
          userId: currentUser.userId,
          templateId: payload.templateId || null,
          templateName: payload.templateName || '未命名模板',
          prompt: finalPrompt,
          variables: payload.variables ? JSON.stringify(payload.variables) : null,
          configJson: createStoredJobConfig(payload.config, payload),
          status: 'queued',
          taskType: 'async_generate',
          providerId: payload.providerId || null,
          creditsUsed: 1,
        },
      });
    });

    const images = Array.isArray(payload.images) ? payload.images : [];
    const referenceImages = Array.isArray(payload.referenceImages) ? payload.referenceImages : [];

    console.info(`[job:${history.id}] 任务已提交`, {
      userId: currentUser.userId,
      templateId: payload.templateId || null,
      templateName: payload.templateName || null,
      providerId: payload.providerId || 'auto',
      mode: payload.mode || 'generation',
      imageCount: images.length,
      referenceCount: referenceImages.length,
      promptLength: finalPrompt.length,
    });

    scheduleImageGenerationJob(history.id);

    return NextResponse.json({
      success: true,
      jobId: history.id,
      historyId: history.id,
      status: 'queued',
      progressText: '任务已提交，等待开始',
    });
  } catch (error: any) {
    if (error?.message === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json({ error: '潮能力（算力）不足，请联系管理员充值' }, { status: 403 });
    }

    if (error?.message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    console.error('[job:create] 创建图片任务失败', {
      userId: currentUserId,
      templateId: requestBody?.templateId || null,
      templateName: requestBody?.templateName || null,
      providerId: requestBody?.providerId || 'auto',
      mode: requestBody?.mode || 'generation',
      imageCount: Array.isArray(requestBody?.images) ? requestBody?.images.length : 0,
      referenceCount: Array.isArray(requestBody?.referenceImages) ? requestBody?.referenceImages.length : 0,
      error,
    });
    return NextResponse.json(
      {
        success: false,
        error: '创建图片任务失败',
        message: '任务提交时遇到问题，请稍后重试',
      },
      { status: 500 }
    );
  }
}

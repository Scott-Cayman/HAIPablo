import { NextRequest, NextResponse } from 'next/server';

import {
  buildFinalPrompt,
  createStoredJobConfig,
  getErrorResponseStatus,
  getUserFacingErrorMessage,
  type ImageGenerationRequestPayload,
  runImageGeneration,
} from '@/lib/image-generation';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  let payload: ImageGenerationRequestPayload | null = null;
  let userId: string | undefined;
  let providerId: string | undefined;
  let historyId: string | undefined;

  try {
    const body = (await request.json()) as ImageGenerationRequestPayload;
    payload = body;
    userId = body.userId;
    providerId = body.providerId;

    if (!userId) {
      return NextResponse.json({ error: '未登录或缺少用户ID，无法生成' }, { status: 401 });
    }

    if (!body.promptTemplate) {
      return NextResponse.json({ error: '缺少提示词模板' }, { status: 400 });
    }

    const finalPrompt = buildFinalPrompt(body.promptTemplate, body.variables);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { credits: true },
        });

        if (!user) throw new Error('USER_NOT_FOUND');
        if (user.credits < 1) throw new Error('INSUFFICIENT_CREDITS');

        await tx.user.update({
          where: { id: userId },
          data: { credits: { decrement: 1 } },
        });

        const history = await tx.generationHistory.create({
          data: {
            userId: userId as string,
            templateId: body.templateId || null,
            templateName: body.templateName || '未命名模板',
            prompt: finalPrompt,
            variables: body.variables ? JSON.stringify(body.variables) : null,
            configJson: createStoredJobConfig(body.config, body),
            status: 'processing',
            taskType: 'sync_generate',
            providerId: body.providerId || null,
            startedAt: new Date(),
          },
        });
        return history;
      });
      historyId = result.id;
    } catch (txError: any) {
      if (txError.message === 'INSUFFICIENT_CREDITS') {
        return NextResponse.json({ error: '潮能力（算力）不足，请联系管理员充值' }, { status: 403 });
      }
      if (txError.message === 'USER_NOT_FOUND') {
        return NextResponse.json({ error: '用户不存在' }, { status: 404 });
      }
      throw txError;
    }

    try {
      const result = await runImageGeneration(body);

      if (historyId) {
        await prisma.generationHistory.update({
          where: { id: historyId },
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
      }

      return NextResponse.json({
        success: true,
        imageUrl: result.imageUrl,
        revisedPrompt: result.revisedPrompt,
        model: result.model,
        providerId: result.providerId,
        providerLabel: result.providerLabel,
        fallbackUsed: result.fallbackUsed,
        attemptedProviderIds: result.attemptedProviderIds,
        size: result.size,
        quality: result.quality,
      });
    } catch (generationError) {
      throw generationError;
    }
  } catch (error: any) {
    console.error('图片生成失败:', error);

    if (historyId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

        await prisma.$transaction([
          prisma.generationHistory.update({
            where: { id: historyId },
            data: {
              status: 'failed',
              errorMessage: getUserFacingErrorMessage(error),
              providerId: providerId || null,
              creditsUsed: 0,
              finishedAt: new Date(),
            },
          }),
          prisma.user.update({
            where: { id: userId },
            data: { credits: { increment: 1 } },
          }),
        ]);

        return NextResponse.json(
          {
            success: false,
            error: '图片生成失败',
            message: getUserFacingErrorMessage(error),
            details: isAdmin ? {
              errorName: error.name,
              rawMessage: error.message,
              stack: error.stack,
              historyId,
              providerId,
            } : undefined,
          },
          { status: getErrorResponseStatus(error) }
        );
      } catch (historyError: any) {
        console.error('保存失败状态及退还算力失败:', historyError);
        return NextResponse.json(
          { 
            success: false,
            error: '图片生成失败且退还算力失败',
            message: '生成过程中遇到严重错误，请联系管理员'
          },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: '图片生成失败',
        message: getUserFacingErrorMessage(error)
      },
      { status: getErrorResponseStatus(error) }
    );
  }
}

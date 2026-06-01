import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { scheduleImageGenerationJob, toImageJobResponse } from '@/lib/image-jobs';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const history = await prisma.generationHistory.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        userId: true,
        status: true,
        outputImageUrl: true,
        prompt: true,
        providerId: true,
        errorMessage: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
      },
    });

    if (!history) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    const canAccess =
      history.userId === currentUser.userId ||
      currentUser.role === 'admin' ||
      currentUser.role === 'sub_admin' ||
      currentUser.role === 'superadmin';

    if (!canAccess) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    if (history.status === 'queued') {
      scheduleImageGenerationJob(history.id);
    }

    return NextResponse.json(toImageJobResponse(history));
  } catch (error) {
    console.error('获取图片任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取图片任务失败',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const requesterId = searchParams.get('requesterId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const isAdmin =
      currentUser.role === 'admin' ||
      currentUser.role === 'sub_admin' ||
      currentUser.role === 'superadmin' ||
      currentUser.username === 'admin';

    if (userId) {
      if (userId !== currentUser.userId && !isAdmin) {
        return NextResponse.json(
          { error: '权限不足' },
          { status: 403 }
        );
      }

      const histories = await prisma.generationHistory.findMany({
        where: { userId },
        include: {
          user: {
            select: {
              name: true,
              username: true,
              email: true,
              avatar: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });
      return NextResponse.json(histories);
    }

    if (requesterId) {
      if (requesterId !== currentUser.userId || !isAdmin) {
        return NextResponse.json(
          { error: '权限不足' },
          { status: 403 }
        );
      }

      const histories = await prisma.generationHistory.findMany({
        include: {
          user: {
            select: {
              name: true,
              username: true,
              email: true,
              avatar: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });

      const total = await prisma.generationHistory.count();

      return NextResponse.json({
        items: histories,
        total
      });
    }

    return NextResponse.json(
      { error: '缺少用户ID或请求者ID' },
      { status: 400 }
    );
  } catch (error) {
    console.error('获取历史记录失败:', error);
    return NextResponse.json(
      { error: '获取历史记录失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      templateId,
      templateName,
      prompt,
      variables,
      configJson,
      outputImageUrl,
      thumbnailUrl,
      status,
      errorMessage,
      taskType,
      providerId,
      startedAt,
      finishedAt,
      creditsUsed
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: '缺少必填字段' },
        { status: 400 }
      );
    }

    const history = await prisma.generationHistory.create({
      data: {
        userId: currentUser.userId,
        templateId: templateId || null,
        templateName: templateName || '未命名',
        prompt,
        variables: variables ? JSON.stringify(variables) : null,
        configJson: configJson ? JSON.stringify(configJson) : null,
        outputImageUrl: outputImageUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        status: typeof status === 'string' && status.length > 0
          ? status
          : (outputImageUrl ? 'success' : 'failed'),
        errorMessage: errorMessage || null,
        taskType: taskType || null,
        providerId: providerId || null,
        startedAt: startedAt ? new Date(startedAt) : null,
        finishedAt: finishedAt ? new Date(finishedAt) : null,
        creditsUsed: typeof creditsUsed === 'number'
          ? creditsUsed
          : (outputImageUrl ? 1 : 0)
      }
    });

    return NextResponse.json(history, { status: 201 });
  } catch (error: any) {
    console.error('保存历史记录失败:', error);
    return NextResponse.json(
      { 
        error: '保存历史记录失败',
        message: '处理请求时遇到问题' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const historyIds = Array.isArray(body?.historyIds)
      ? body.historyIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      : [];

    if (historyIds.length === 0) {
      return NextResponse.json(
        { error: '缺少要删除的失败任务 ID' },
        { status: 400 }
      );
    }

    const result = await prisma.generationHistory.deleteMany({
      where: {
        id: {
          in: historyIds
        },
        userId: currentUser.userId,
        status: 'failed'
      }
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count
    });
  } catch (error) {
    console.error('删除失败任务失败:', error);
    return NextResponse.json(
      { error: '删除失败任务失败' },
      { status: 500 }
    );
  }
}

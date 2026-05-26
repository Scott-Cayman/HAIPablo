import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const requesterId = searchParams.get('requesterId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 如果指定了 userId，直接查询该用户的历史
    if (userId) {
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

    // 如果没有 userId，检查 requesterId 是否是管理员，如果是则返回所有历史
    if (requesterId) {
      const requester = await prisma.user.findUnique({
        where: { id: requesterId }
      });

      if (requester && (requester.role === 'admin' || requester.username === 'admin')) {
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
        { error: '权限不足' },
        { status: 403 }
      );
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
    const body = await request.json();
    const { userId, templateId, templateName, prompt, variables, configJson, outputImageUrl, thumbnailUrl } = body;

    if (!userId || !prompt) {
      return NextResponse.json(
        { error: '缺少必填字段' },
        { status: 400 }
      );
    }

    const history = await prisma.generationHistory.create({
      data: {
        userId,
        templateId: templateId || null,
        templateName: templateName || '未命名',
        prompt,
        variables: variables ? JSON.stringify(variables) : null,
        configJson: configJson ? JSON.stringify(configJson) : null,
        outputImageUrl: outputImageUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        status: outputImageUrl ? 'success' : 'failed'
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

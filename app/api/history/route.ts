import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: '缺少用户ID' },
        { status: 400 }
      );
    }

    const histories = await prisma.generationHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json(histories);
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
    const { userId, templateId, templateName, prompt, variables, outputImageUrl, thumbnailUrl } = body;

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
        outputImageUrl: outputImageUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        status: outputImageUrl ? 'success' : 'failed'
      }
    });

    return NextResponse.json(history, { status: 201 });
  } catch (error) {
    console.error('保存历史记录失败:', error);
    return NextResponse.json(
      { error: '保存历史记录失败' },
      { status: 500 }
    );
  }
}

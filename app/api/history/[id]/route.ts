import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const history = await prisma.generationHistory.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            name: true,
            username: true,
            email: true,
            avatar: true
          }
        }
      }
    });

    if (!history) {
      return NextResponse.json(
        { error: '记录不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json(history);
  } catch (error) {
    console.error('获取单条历史记录失败:', error);
    return NextResponse.json(
      { error: '获取历史记录失败' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { requesterId, credits } = body;

    if (!requesterId) {
      return NextResponse.json(
        { error: '缺少请求者ID' },
        { status: 400 }
      );
    }

    if (typeof credits !== 'number' || credits < 0) {
      return NextResponse.json(
        { error: '潮能力必须是大于等于0的数字' },
        { status: 400 }
      );
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId }
    });

    if (!requester || requester.role !== 'admin') {
      return NextResponse.json(
        { error: '权限不足，仅管理员可修改算力' },
        { status: 403 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { credits },
      select: {
        id: true,
        username: true,
        credits: true
      }
    });

    return NextResponse.json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    console.error('更新用户算力失败:', error);
    return NextResponse.json(
      { error: '更新用户算力失败' },
      { status: 500 }
    );
  }
}

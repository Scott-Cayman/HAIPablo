import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { requesterId, role } = body;

    if (!requesterId) {
      return NextResponse.json(
        { error: '缺少请求者ID' },
        { status: 400 }
      );
    }

    if (!role || !['user', 'admin', 'sub_admin'].includes(role)) {
      return NextResponse.json(
        { error: '无效的角色类型' },
        { status: 400 }
      );
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId }
    });

    if (!requester || requester.role !== 'admin') {
      return NextResponse.json(
        { error: '权限不足，仅管理员可修改身份' },
        { status: 403 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        username: true,
        role: true
      }
    });

    return NextResponse.json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    console.error('更新用户角色失败:', error);
    return NextResponse.json(
      { error: '更新用户角色失败' },
      { status: 500 }
    );
  }
}

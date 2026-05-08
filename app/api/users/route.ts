import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function hashPassword(password: string): string {
  return Buffer.from(password).toString('base64');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get('requesterId');

    if (!requesterId) {
      return NextResponse.json(
        { error: '缺少请求者ID' },
        { status: 400 }
      );
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId }
    });

    if (!requester || requester.role !== 'admin') {
      return NextResponse.json(
        { error: '权限不足，仅管理员可访问' },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        credits: true,
        departmentId: true,
        createdAt: true,
        _count: {
          select: {
            histories: true,
            jobs: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json(
      { error: '获取用户列表失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requesterId, username, password, email, name, role, departmentId } = body;

    if (!requesterId) {
      return NextResponse.json(
        { error: '缺少请求者ID' },
        { status: 400 }
      );
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId }
    });

    if (!requester || requester.role !== 'admin') {
      return NextResponse.json(
        { error: '权限不足，仅管理员可创建用户' },
        { status: 403 }
      );
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    const hashedPassword = hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email: email || null,
        name: name || username,
        role: role || 'user',
        departmentId: departmentId || null
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        createdAt: true
      }
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    console.error('创建用户失败:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '用户名已存在' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: '创建用户失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get('requesterId');
    const userId = searchParams.get('userId');

    if (!requesterId || !userId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId }
    });

    if (!requester || requester.role !== 'admin') {
      return NextResponse.json(
        { error: '权限不足，仅管理员可删除用户' },
        { status: 403 }
      );
    }

    if (requesterId === userId) {
      return NextResponse.json(
        { error: '不能删除自己的账号' },
        { status: 400 }
      );
    }

    await prisma.generationHistory.deleteMany({
      where: { userId }
    });

    await prisma.generationJob.deleteMany({
      where: { userId }
    });

    await prisma.user.delete({
      where: { id: userId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除用户失败:', error);
    return NextResponse.json(
      { error: '删除用户失败' },
      { status: 500 }
    );
  }
}

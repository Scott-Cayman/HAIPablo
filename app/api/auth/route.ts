import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function hashPassword(password: string): string {
  return Buffer.from(password).toString('base64');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, email, name } = body;

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
        name: name || username
      }
    });

    return NextResponse.json({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name
    }, { status: 201 });
  } catch (error: any) {
    console.error('注册失败:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '用户名已存在' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: '注册失败' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const password = searchParams.get('password');

    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    const hashedPassword = hashPassword(password);

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user || user.password !== hashedPassword) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 更新最后登录时间
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    return NextResponse.json({
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      name: updatedUser.name,
      avatar: updatedUser.avatar,
      role: updatedUser.role
    });
  } catch (error) {
    console.error('登录失败:', error);
    return NextResponse.json(
      { error: '登录失败' },
      { status: 500 }
    );
  }
}

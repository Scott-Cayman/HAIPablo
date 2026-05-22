import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

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

    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码长度至少6位' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email: email || null,
        name: name || username,
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
      },
      { status: 201 }
    );
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

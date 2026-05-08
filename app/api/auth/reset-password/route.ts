import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function hashPassword(password: string): string {
  return Buffer.from(password).toString('base64');
}

export async function POST(request: NextRequest) {
  try {
    const { email, code, newPassword } = await request.json();

    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: '请填写完整信息' }, { status: 400 });
    }

    // Verify code
    const validCode = await prisma.verificationCode.findFirst({
      where: {
        email,
        code,
        type: 'reset_password',
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!validCode) {
      return NextResponse.json({ error: '验证码无效或已过期' }, { status: 400 });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // Update password
    await prisma.user.update({
      where: { email },
      data: {
        password: hashPassword(newPassword)
      }
    });

    // Delete used code
    await prisma.verificationCode.deleteMany({
      where: {
        email,
        type: 'reset_password'
      }
    });

    return NextResponse.json({ message: '密码重置成功' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: '密码重置失败' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: '请输入邮箱' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: '该邮箱未注册' }, { status: 404 });
    }

    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Valid for 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verificationCode.create({
      data: {
        email,
        code,
        expiresAt,
        type: 'reset_password'
      }
    });

    // In a real application, you would send the email here using Nodemailer or a service like Resend.
    console.log(`[模拟发送邮件] 您的验证码是: ${code}，请在10分钟内使用。`);

    return NextResponse.json({ message: '验证码已发送到您的邮箱（测试环境请查看控制台）' });
  } catch (error) {
    console.error('Send code error:', error);
    return NextResponse.json({ error: '发送验证码失败' }, { status: 500 });
  }
}

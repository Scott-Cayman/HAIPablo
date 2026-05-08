import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { credits } = body;

    if (typeof credits !== 'number' || credits <= 0) {
      return NextResponse.json({ error: '算力必须是大于0的数字' }, { status: 400 });
    }

    const department = await prisma.department.findUnique({
      where: { id }
    });

    if (!department) {
      return NextResponse.json({ error: '部门不存在' }, { status: 404 });
    }

    // 批量给该部门下的所有用户增加算力
    const result = await prisma.user.updateMany({
      where: { departmentId: id },
      data: {
        credits: { increment: credits }
      }
    });

    return NextResponse.json({
      success: true,
      message: `成功为 ${result.count} 名部门成员分配了 ${credits} 潮能力`,
      count: result.count
    });
  } catch (error: any) {
    console.error('分配算力失败:', error);
    return NextResponse.json({ error: '分配算力失败' }, { status: 500 });
  }
}

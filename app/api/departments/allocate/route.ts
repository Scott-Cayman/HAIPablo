import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requesterId, departmentIds, amount } = body;

    if (!requesterId) {
      return NextResponse.json({ error: '缺少请求者ID' }, { status: 400 });
    }

    if (!Array.isArray(departmentIds) || departmentIds.length === 0) {
      return NextResponse.json({ error: '请选择至少一个部门' }, { status: 400 });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: '分配数量必须是大于0的数字' }, { status: 400 });
    }

    // 鉴权
    const requester = await prisma.user.findUnique({
      where: { id: requesterId }
    });

    if (!requester || requester.role !== 'admin') {
      return NextResponse.json({ error: '权限不足，仅管理员可分配算力' }, { status: 403 });
    }

    // 批量更新属于这些部门的所有用户的算力
    const updatedUsers = await prisma.user.updateMany({
      where: {
        departmentId: {
          in: departmentIds
        }
      },
      data: {
        credits: {
          increment: amount
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `成功为选中的部门分配了算力，共影响 ${updatedUsers.count} 名成员。`,
      affectedCount: updatedUsers.count
    });

  } catch (error) {
    console.error('批量分配部门算力失败:', error);
    return NextResponse.json(
      { error: '批量分配部门算力失败' },
      { status: 500 }
    );
  }
}

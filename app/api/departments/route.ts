import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { users: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(departments);
  } catch (error) {
    console.error('获取部门失败:', error);
    return NextResponse.json(
      { error: '获取部门失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name, parentId } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: '部门名称不能为空' },
        { status: 400 }
      );
    }

    const department = await prisma.department.create({
      data: {
        name,
        parentId
      }
    });

    return NextResponse.json(department);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '该部门名称已存在' },
        { status: 400 }
      );
    }
    console.error('创建部门失败:', error);
    return NextResponse.json(
      { error: '创建部门失败' },
      { status: 500 }
    );
  }
}

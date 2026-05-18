import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const enabled = searchParams.get('enabled');

    const where: any = {};
    if (enabled !== null) {
      where.enabled = enabled === 'true';
    }

    const featureGroups = await prisma.featureGroup.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' }
      ],
      include: {
        templates: {
          where: { enabled: true },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    const formattedGroups = featureGroups.map(group => ({
      ...group,
      templates: group.templates.map(template => ({
        ...template,
        inputSlots: template.inputSlotsJson ? JSON.parse(template.inputSlotsJson) : [],
        variables: template.variablesJson ? JSON.parse(template.variablesJson) : [],
        referenceImages: template.referenceImagesJson ? JSON.parse(template.referenceImagesJson) : [],
        coverImage: template.coverImageJson && template.coverImageJson !== '[]' && template.coverImageJson !== 'null'
          ? JSON.parse(template.coverImageJson)
          : null,
        coverMetadata: template.coverMetadataJson
          ? JSON.parse(template.coverMetadataJson)
          : { title: '', description: '' }
      }))
    }));

    return NextResponse.json(formattedGroups);
  } catch (error) {
    console.error('获取功能组列表失败:', error);
    return NextResponse.json(
      { error: '获取功能组列表失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, key, description, icon, sortOrder, enabled, requesterId } = body;

    if (!requesterId) {
      return NextResponse.json({ error: '缺少请求者ID' }, { status: 401 });
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId }
    });

    if (!requester || (requester.role !== 'admin' && requester.role !== 'sub_admin')) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    if (!name || !key) {
      return NextResponse.json(
        { error: '名称和标识不能为空' },
        { status: 400 }
      );
    }

    const existingGroup = await prisma.featureGroup.findUnique({
      where: { key }
    });

    if (existingGroup) {
      return NextResponse.json(
        { error: '该标识已存在' },
        { status: 400 }
      );
    }

    const featureGroup = await prisma.featureGroup.create({
      data: {
        name,
        key,
        description,
        icon,
        sortOrder: sortOrder || 0,
        enabled: enabled !== false
      }
    });

    return NextResponse.json(featureGroup, { status: 201 });
  } catch (error) {
    console.error('创建功能组失败:', error);
    return NextResponse.json(
      { error: '创建功能组失败' },
      { status: 500 }
    );
  }
}

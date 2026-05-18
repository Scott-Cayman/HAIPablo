import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const featureGroup = await prisma.featureGroup.findUnique({
      where: { id },
      include: {
        templates: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    if (!featureGroup) {
      return NextResponse.json(
        { error: '功能组不存在' },
        { status: 404 }
      );
    }

    const formattedGroup = {
      ...featureGroup,
      templates: featureGroup.templates.map(template => ({
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
    };

    return NextResponse.json(formattedGroup);
  } catch (error) {
    console.error('获取功能组详情失败:', error);
    return NextResponse.json(
      { error: '获取功能组详情失败' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
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

    const existingGroup = await prisma.featureGroup.findFirst({
      where: {
        key,
        NOT: { id }
      }
    });

    if (existingGroup) {
      return NextResponse.json(
        { error: '该标识已被其他分类使用' },
        { status: 400 }
      );
    }

    const updatedGroup = await prisma.featureGroup.update({
      where: { id },
      data: {
        name,
        key,
        description,
        icon,
        sortOrder: sortOrder !== undefined ? sortOrder : 0,
        enabled: enabled !== undefined ? enabled : true
      }
    });

    return NextResponse.json(updatedGroup);
  } catch (error) {
    console.error('更新功能组失败:', error);
    return NextResponse.json(
      { error: '更新功能组失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get('requesterId');

    if (!requesterId) {
      return NextResponse.json({ error: '缺少请求者ID' }, { status: 401 });
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId }
    });

    if (!requester || (requester.role !== 'admin' && requester.role !== 'sub_admin')) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const featureGroup = await prisma.featureGroup.findUnique({
      where: { id },
      include: {
        templates: true
      }
    });

    if (!featureGroup) {
      return NextResponse.json(
        { error: '功能组不存在' },
        { status: 404 }
      );
    }

    if (featureGroup.templates.length > 0) {
      return NextResponse.json(
        { error: '该分类下存在模板，请先删除或移动所有模板' },
        { status: 400 }
      );
    }

    await prisma.featureGroup.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除功能组失败:', error);
    return NextResponse.json(
      { error: '删除功能组失败' },
      { status: 500 }
    );
  }
}

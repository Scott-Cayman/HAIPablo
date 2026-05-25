import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const template = await prisma.actionTemplate.findUnique({
      where: { id },
      include: {
        featureGroup: true
      }
    });

    if (!template) {
      return NextResponse.json(
        { error: '模板不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...template,
      inputSlots: JSON.parse(template.inputSlotsJson),
      variables: JSON.parse(template.variablesJson),
      referenceImages: JSON.parse(template.referenceImagesJson),
      coverImage: template.coverImageJson && template.coverImageJson !== '[]' && template.coverImageJson !== 'null' 
        ? JSON.parse(template.coverImageJson) 
        : null,
      coverMetadata: template.coverMetadataJson 
        ? JSON.parse(template.coverMetadataJson) 
        : { title: '', description: '' },
      enableSpecifiedColors: template.enableSpecifiedColors || false,
      specifiedColors: template.specifiedColorsJson 
        ? JSON.parse(template.specifiedColorsJson) 
        : [],
      showMainVisual: template.showMainVisual,
      enableReferenceBatchMode: template.enableReferenceBatchMode || false,
      enableCustomReferenceUpload: template.enableCustomReferenceUpload || false,
      allowMultipleCustomReferences: template.allowMultipleCustomReferences || false
    });
  } catch (error) {
    console.error('获取模板详情失败:', error);
    return NextResponse.json(
      { error: '获取模板详情失败' },
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
    const { requesterId } = body;

    if (!requesterId) {
      return NextResponse.json({ error: '缺少请求者ID' }, { status: 401 });
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId }
    });

    if (!requester || (requester.role !== 'admin' && requester.role !== 'sub_admin')) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const template = await prisma.actionTemplate.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        promptTemplate: body.promptTemplate,
        negativePrompt: body.negativePrompt,
        defaultSize: body.defaultSize,
        defaultQuality: body.defaultQuality,
        responseFormat: body.responseFormat,
        inputSlotsJson: JSON.stringify(body.inputSlots || []),
        variablesJson: JSON.stringify(body.variables || []),
        referenceImagesJson: JSON.stringify(body.referenceImages || []),
        coverImageJson: JSON.stringify(body.coverImage || null),
        coverMetadataJson: JSON.stringify(body.coverMetadata || {}),
        allowUserPrompt: body.allowUserPrompt !== false,
        userPromptPriorityDefault: body.userPromptPriorityDefault || false,
        enableSpecifiedColors: body.enableSpecifiedColors || false,
        specifiedColorsJson: JSON.stringify(body.specifiedColors || []),
        showMainVisual: body.showMainVisual !== false,
        enableReferenceBatchMode: body.enableReferenceBatchMode || false,
        enableCustomReferenceUpload: body.enableCustomReferenceUpload || false,
        allowMultipleCustomReferences: body.allowMultipleCustomReferences || false,
        enabled: body.enabled,
        sortOrder: body.sortOrder
      },
      include: {
        featureGroup: true
      }
    });

    return NextResponse.json({
      ...template,
      inputSlots: JSON.parse(template.inputSlotsJson),
      variables: JSON.parse(template.variablesJson),
      referenceImages: template.referenceImagesJson ? JSON.parse(template.referenceImagesJson) : [],
      coverImage: template.coverImageJson && template.coverImageJson !== '[]' && template.coverImageJson !== 'null'
        ? JSON.parse(template.coverImageJson)
        : null,
      coverMetadata: template.coverMetadataJson
        ? JSON.parse(template.coverMetadataJson)
        : { title: '', description: '' },
      allowUserPrompt: template.allowUserPrompt,
      userPromptPriorityDefault: template.userPromptPriorityDefault,
      enableSpecifiedColors: template.enableSpecifiedColors || false,
      specifiedColors: template.specifiedColorsJson
        ? JSON.parse(template.specifiedColorsJson)
        : [],
      showMainVisual: template.showMainVisual,
      enableReferenceBatchMode: template.enableReferenceBatchMode || false,
      enableCustomReferenceUpload: template.enableCustomReferenceUpload || false,
      allowMultipleCustomReferences: template.allowMultipleCustomReferences || false
    });
  } catch (error) {
    console.error('更新模板失败:', error);
    return NextResponse.json(
      { error: '更新模板失败' },
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

    await prisma.actionTemplate.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除模板失败:', error);
    return NextResponse.json(
      { error: '删除模板失败' },
      { status: 500 }
    );
  }
}

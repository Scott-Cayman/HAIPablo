import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const featureGroupId = searchParams.get('featureGroupId');
    const enabled = searchParams.get('enabled');

    const where: any = {};
    if (featureGroupId) {
      where.featureGroupId = featureGroupId;
    }
    if (enabled !== null) {
      where.enabled = enabled === 'true';
    }

    const templates = await prisma.actionTemplate.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' }
      ],
      include: {
        featureGroup: true
      }
    });

    const formattedTemplates = templates.map((template: any) => ({
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
      enableReferenceBatchMode: template.enableReferenceBatchMode || false
    }));

    return NextResponse.json(formattedTemplates);
  } catch (error) {
    console.error('获取模板列表失败:', error);
    return NextResponse.json(
      { error: '获取模板列表失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      featureGroupId,
      name,
      key,
      description,
      mode,
      promptTemplate,
      negativePrompt,
      defaultSize,
      defaultQuality,
      responseFormat,
      inputSlots,
      variables,
      referenceImages,
      coverImage,
      coverMetadata,
      allowUserPrompt,
      userPromptPriorityDefault,
      enableSpecifiedColors,
      specifiedColors,
      showMainVisual,
      enableReferenceBatchMode,
      enabled,
      sortOrder,
      requesterId
    } = body;

    if (!requesterId) {
      return NextResponse.json({ error: '缺少请求者ID' }, { status: 401 });
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId }
    });

    if (!requester || (requester.role !== 'admin' && requester.role !== 'sub_admin')) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    if (!featureGroupId || !name || !key || !mode || !promptTemplate) {
      return NextResponse.json(
        { error: '缺少必填字段' },
        { status: 400 }
      );
    }

    const template = await prisma.actionTemplate.create({
      data: {
        featureGroupId,
        name,
        key,
        description,
        mode,
        promptTemplate,
        negativePrompt,
        defaultSize: defaultSize || 'auto',
        defaultQuality: defaultQuality || 'medium',
        responseFormat: responseFormat || 'b64_json',
        inputSlotsJson: JSON.stringify(inputSlots || []),
        variablesJson: JSON.stringify(variables || []),
        referenceImagesJson: JSON.stringify(referenceImages || []),
        coverImageJson: JSON.stringify(coverImage || null),
        coverMetadataJson: JSON.stringify(coverMetadata || {}),
        allowUserPrompt: allowUserPrompt !== false,
        userPromptPriorityDefault: userPromptPriorityDefault || false,
        enableSpecifiedColors: enableSpecifiedColors || false,
        specifiedColorsJson: JSON.stringify(specifiedColors || []),
        showMainVisual: showMainVisual !== false,
        enableReferenceBatchMode: enableReferenceBatchMode || false,
        enabled: enabled !== false,
        sortOrder: sortOrder || 0
      },
      include: {
        featureGroup: true
      }
    });

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
      allowUserPrompt: template.allowUserPrompt,
      userPromptPriorityDefault: template.userPromptPriorityDefault,
      enableSpecifiedColors: template.enableSpecifiedColors || false,
      specifiedColors: template.specifiedColorsJson
        ? JSON.parse(template.specifiedColorsJson)
        : [],
      showMainVisual: template.showMainVisual,
      enableReferenceBatchMode: template.enableReferenceBatchMode || false
    }, { status: 201 });
  } catch (error) {
    console.error('创建模板失败:', error);
    return NextResponse.json(
      { error: '创建模板失败' },
      { status: 500 }
    );
  }
}

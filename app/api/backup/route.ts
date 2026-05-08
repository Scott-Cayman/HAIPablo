import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const backupData: any = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      tables: {} as any
    };

    backupData.tables.users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        password: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    backupData.tables.featureGroups = await prisma.featureGroup.findMany({
      include: {
        templates: {
          select: {
            id: true,
            featureGroupId: true,
            name: true,
            key: true,
            description: true,
            mode: true,
            promptTemplate: true,
            negativePrompt: true,
            defaultSize: true,
            defaultQuality: true,
            responseFormat: true,
            inputSlotsJson: true,
            variablesJson: true,
            referenceImagesJson: true,
            coverImageJson: true,
            coverMetadataJson: true,
            allowUserPrompt: true,
            userPromptPriorityDefault: true,
            enableSpecifiedColors: true,
            specifiedColorsJson: true,
            enabled: true,
            sortOrder: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });

    backupData.tables.projects = await prisma.project.findMany();

    backupData.tables.assets = await prisma.asset.findMany();

    backupData.tables.systemSettings = await prisma.systemSetting.findMany();

    backupData.tables.generationHistory = await prisma.generationHistory.findMany({
      select: {
        id: true,
        userId: true,
        templateId: true,
        templateName: true,
        prompt: true,
        variables: true,
        outputImageUrl: true,
        thumbnailUrl: true,
        status: true,
        createdAt: true
      }
    });

    backupData.metadata = {
      totalUsers: backupData.tables.users.length,
      totalFeatureGroups: backupData.tables.featureGroups.length,
      totalTemplates: backupData.tables.featureGroups.reduce((sum: number, fg: any) => sum + fg.templates.length, 0),
      totalProjects: backupData.tables.projects.length,
      totalAssets: backupData.tables.assets.length,
      totalGenerationHistory: backupData.tables.generationHistory.length,
      totalSystemSettings: backupData.tables.systemSettings.length
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const filename = `haipablo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const filesize = Buffer.byteLength(jsonString, 'utf8');

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': filesize.toString()
      }
    });
  } catch (error) {
    console.error('备份失败:', error);
    return NextResponse.json(
      { error: '备份失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

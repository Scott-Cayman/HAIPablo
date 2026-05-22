import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: '没有上传文件' },
        { status: 400 }
      );
    }

    const text = await file.text();
    let backupData;

    try {
      backupData = JSON.parse(text);
    } catch (parseError) {
      return NextResponse.json(
        { error: '文件格式无效，请上传JSON格式的备份文件' },
        { status: 400 }
      );
    }

    if (!backupData.version || !backupData.tables) {
      return NextResponse.json(
        { error: '无效的备份文件格式' },
        { status: 400 }
      );
    }

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
      await prisma.$transaction(async (tx: any) => {
        await tx.generationJobItem.deleteMany({});
        await tx.generationJob.deleteMany({});
        await tx.generationHistory.deleteMany({});
        await tx.asset.deleteMany({});
        await tx.project.deleteMany({});
        await tx.actionTemplate.deleteMany({});
        await tx.featureGroup.deleteMany({});
        await tx.user.deleteMany({});
        await tx.systemSetting.deleteMany({});

        const userIdMap = new Map<string, string>();
        if (backupData.tables.users) {
          for (const user of backupData.tables.users) {
            const created = await tx.user.create({
              data: {
                id: user.id,
                username: user.username,
                password: user.password,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                role: user.role,
                createdAt: new Date(user.createdAt),
                updatedAt: new Date(user.updatedAt)
              }
            });
            userIdMap.set(user.id, created.id);
          }
        }

        const featureGroupIdMap = new Map<string, string>();
        if (backupData.tables.featureGroups) {
          for (const fg of backupData.tables.featureGroups) {
            const created = await tx.featureGroup.create({
              data: {
                id: fg.id,
                name: fg.name,
                key: fg.key,
                description: fg.description,
                icon: fg.icon,
                sortOrder: fg.sortOrder || 0,
                enabled: fg.enabled !== false,
                createdAt: new Date(fg.createdAt || Date.now()),
                updatedAt: new Date(fg.updatedAt || Date.now())
              }
            });
            featureGroupIdMap.set(fg.id, created.id);
          }
        }

        if (backupData.tables.featureGroups) {
          for (const fg of backupData.tables.featureGroups) {
            const newFeatureGroupId = featureGroupIdMap.get(fg.id);
            if (fg.templates && newFeatureGroupId) {
              for (const template of fg.templates) {
                await tx.actionTemplate.create({
                  data: {
                    id: template.id,
                    featureGroupId: newFeatureGroupId,
                    name: template.name,
                    key: template.key,
                    description: template.description,
                    mode: template.mode,
                    promptTemplate: template.promptTemplate,
                    negativePrompt: template.negativePrompt,
                    defaultSize: template.defaultSize || 'auto',
                    defaultQuality: template.defaultQuality || 'medium',
                    responseFormat: template.responseFormat || 'b64_json',
                    inputSlotsJson: template.inputSlotsJson || '[]',
                    variablesJson: template.variablesJson || '[]',
                    referenceImagesJson: template.referenceImagesJson || '[]',
                    coverImageJson: template.coverImageJson || '[]',
                    coverMetadataJson: template.coverMetadataJson || '{}',
                    allowUserPrompt: template.allowUserPrompt !== false,
                    userPromptPriorityDefault: template.userPromptPriorityDefault || false,
                    enableSpecifiedColors: template.enableSpecifiedColors || false,
                    specifiedColorsJson: template.specifiedColorsJson || '[]',
                    enableReferenceBatchMode: template.enableReferenceBatchMode || false,
                    enabled: template.enabled !== false,
                    sortOrder: template.sortOrder || 0,
                    createdAt: new Date(template.createdAt || Date.now()),
                    updatedAt: new Date(template.updatedAt || Date.now())
                  }
                });
              }
            }
          }
        }

        const projectIdMap = new Map<string, string>();
        if (backupData.tables.projects) {
          for (const project of backupData.tables.projects) {
            const created = await tx.project.create({
              data: {
                id: project.id,
                name: project.name,
                description: project.description,
                clientName: project.clientName,
                eventName: project.eventName,
                city: project.city,
                brandName: project.brandName,
                status: project.status || 'active',
                createdAt: new Date(project.createdAt || Date.now()),
                updatedAt: new Date(project.updatedAt || Date.now())
              }
            });
            projectIdMap.set(project.id, created.id);
          }
        }

        if (backupData.tables.assets) {
          for (const asset of backupData.tables.assets) {
            const newProjectId = asset.projectId ? projectIdMap.get(asset.projectId) : null;
            await tx.asset.create({
              data: {
                id: asset.id,
                projectId: newProjectId,
                name: asset.name,
                type: asset.type,
                fileUrl: asset.fileUrl,
                thumbnailUrl: asset.thumbnailUrl,
                mimeType: asset.mimeType,
                width: asset.width,
                height: asset.height,
                sizeBytes: asset.sizeBytes,
                createdAt: new Date(asset.createdAt || Date.now())
              }
            });
          }
        }

        if (backupData.tables.systemSettings) {
          for (const setting of backupData.tables.systemSettings) {
            await tx.systemSetting.create({
              data: {
                id: setting.id,
                key: setting.key,
                value: setting.value,
                createdAt: new Date(setting.createdAt || Date.now()),
                updatedAt: new Date(setting.updatedAt || Date.now())
              }
            });
          }
        }

        if (backupData.tables.generationHistory) {
          for (const history of backupData.tables.generationHistory) {
            const newUserId = userIdMap.get(history.userId);
            await tx.generationHistory.create({
              data: {
                id: history.id,
                userId: newUserId || history.userId,
                templateId: history.templateId,
                templateName: history.templateName,
                prompt: history.prompt,
                variables: history.variables,
                outputImageUrl: history.outputImageUrl,
                thumbnailUrl: history.thumbnailUrl,
                status: history.status || 'success',
                createdAt: new Date(history.createdAt || Date.now())
              }
            });
          }
        }
      });

      const metadata = backupData.metadata || {};
      
      return NextResponse.json({
        success: true,
        message: '数据恢复成功',
        restored: {
          users: metadata.totalUsers || 0,
          featureGroups: metadata.totalFeatureGroups || 0,
          templates: metadata.totalTemplates || 0,
          projects: metadata.totalProjects || 0,
          assets: metadata.totalAssets || 0,
          generationHistory: metadata.totalGenerationHistory || 0,
          systemSettings: metadata.totalSystemSettings || 0
        },
        backupVersion: backupData.version,
        backupCreatedAt: backupData.createdAt
      }, { status: 200 });

    } catch (dbError) {
      console.error('数据库恢复失败:', dbError);
      return NextResponse.json(
        { 
          error: '数据库恢复失败', 
          details: dbError instanceof Error ? dbError.message : '未知错误' 
        },
        { status: 500 }
      );
    } finally {
      await prisma.$disconnect();
    }

  } catch (error) {
    console.error('恢复失败:', error);
    return NextResponse.json(
      { error: '恢复失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { ImageApiClient } from '@/lib/image-api-client';
import { prisma } from '@/lib/prisma';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

async function persistGeneratedImage(
  result: any,
  outputPath: string
): Promise<{ revisedPrompt: string | null }> {
  const firstItem = result?.data?.[0];
  if (!firstItem) {
    throw new Error('API未返回图片数据');
  }

  if (firstItem.b64_json) {
    let b64String = firstItem.b64_json as string;
    if (b64String.includes(',')) {
      b64String = b64String.split(',')[1];
    }

    const imageBuffer = Buffer.from(b64String, 'base64');
    await fs.writeFile(outputPath, new Uint8Array(imageBuffer));
    return { revisedPrompt: firstItem.revised_prompt || null };
  }

  if (firstItem.url) {
    const upstreamResponse = await fetch(firstItem.url);
    if (!upstreamResponse.ok) {
      throw new Error(`下载上游图片失败: ${upstreamResponse.status}`);
    }

    const imageArrayBuffer = await upstreamResponse.arrayBuffer();
    await fs.writeFile(outputPath, new Uint8Array(imageArrayBuffer));
    return { revisedPrompt: firstItem.revised_prompt || null };
  }

  console.error('上游图片接口返回了未兼容的数据结构:', JSON.stringify(result).slice(0, 2000));
  throw new Error('API返回数据格式错误');
}

export async function POST(request: NextRequest) {
  let finalPrompt = '';
  let userId: string | undefined;
  let templateId: string | undefined;
  let templateName: string | undefined;
  let variables: any;
  let historyId: string | undefined;
  
  try {
    const body = await request.json();
    
    const {
      mode,
      promptTemplate,
      variables: bodyVariables,
      size,
      quality,
      images,
      referenceImages,
      userId: bodyUserId,
      templateId: bodyTemplateId,
      templateName: bodyTemplateName,
      config // 新增：UI 状态配置
    } = body;
    
    userId = bodyUserId;
    templateId = bodyTemplateId;
    templateName = bodyTemplateName;
    variables = bodyVariables;

    if (!userId) {
      return NextResponse.json({ error: '未登录或缺少用户ID，无法生成' }, { status: 401 });
    }

    if (!promptTemplate) {
      return NextResponse.json({ error: '缺少提示词模板' }, { status: 400 });
    }

    const hasReferenceImages = referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0;
    const hasUserImages = images && Array.isArray(images) && images.length > 0;
    const totalImages = (hasReferenceImages ? referenceImages.length : 0) + (hasUserImages ? images.length : 0);

    // 优化后的校验逻辑：
    // 1. 如果模式是 'edit' (图生图)，则必须提供至少一张图片（无论是预设的还是用户上传的）
    // 2. 只有当 totalImages >= 2 时，底层 API 才会进入 edit 模式
    if (mode === 'edit') {
      if (totalImages === 0) {
        return NextResponse.json(
          { error: '编辑模式需要至少一张参考图片' },
          { status: 400 }
        );
      }
    }

    finalPrompt = promptTemplate;
    
    if (bodyVariables && typeof bodyVariables === 'object') {
      for (const [key, value] of Object.entries(bodyVariables)) {
        if (typeof value === 'string') {
          const regex = new RegExp('{{' + key + '}}', 'g');
          finalPrompt = finalPrompt.replace(regex, value);
        }
      }
    }

    // 1. 使用事务预扣除算力并创建初始历史记录
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 检查算力
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { credits: true }
        });
        
        if (!user) throw new Error('USER_NOT_FOUND');
        if (user.credits < 1) throw new Error('INSUFFICIENT_CREDITS');
        
        // 扣除算力
        await tx.user.update({
          where: { id: userId },
          data: { credits: { decrement: 1 } }
        });
        
        // 创建初始历史记录 (预设为处理中，成功后再更新)
        const history = await tx.generationHistory.create({
          data: {
            userId: userId as string,
            templateId: templateId || null,
            templateName: templateName || '未命名模板',
            prompt: finalPrompt,
            variables: variables ? JSON.stringify(variables) : null,
            configJson: config ? JSON.stringify(config) : null,
            status: 'processing'
          }
        });
        return history;
      });
      historyId = result.id;
    } catch (txError: any) {
      if (txError.message === 'INSUFFICIENT_CREDITS') {
        return NextResponse.json({ error: '潮能力（算力）不足，请联系管理员充值' }, { status: 403 });
      }
      if (txError.message === 'USER_NOT_FOUND') {
        return NextResponse.json({ error: '用户不存在' }, { status: 404 });
      }
      throw txError;
    }

    const imageApiClient = new ImageApiClient();

    console.log('=== 图片生成请求 ===');
    console.log('userId:', userId);
    console.log('historyId:', historyId);
    console.log('mode:', mode);

    const outputDir = path.join(process.cwd(), 'public', 'storage', 'outputs');
    await fs.mkdir(outputDir, { recursive: true });

    // 使用更唯一的命名方式避免并发冲突
    const uniqueId = crypto.randomUUID().slice(0, 8);
    const timestamp = Date.now().toString();
    const filename = `generated_${timestamp}_${uniqueId}.png`;
    const outputPath = path.join(outputDir, filename);

    let result;
    const tempPaths: string[] = [];

    console.log('hasReferenceImages:', hasReferenceImages);
    console.log('hasUserImages:', hasUserImages);
    console.log('totalImages:', totalImages);
    console.log('will use edit mode:', mode === 'edit');

    if (mode === 'edit' || totalImages >= 2) {
      console.log('=== 使用编辑模式 ===');
      const allImages: string[] = [];
      
      if (hasReferenceImages) {
        console.log('添加预设参考图:', referenceImages.length, '张');
        allImages.push(...referenceImages);
      }
      
      console.log('添加用户图片:', images.length, '张');
      allImages.push(...images);
      
      for (let i = 0; i < allImages.length; i++) {
        const imgData = allImages[i];
        
        if (imgData.startsWith('data:')) {
          console.log(`处理base64图片 ${i}`);
          const base64Data = imgData.split(',')[1];
          const imageBuffer = Buffer.from(base64Data, 'base64');
          const tempPath = path.join(outputDir, 'temp_' + timestamp + '_' + uniqueId + '_' + i + '.png');
          await fs.writeFile(tempPath, new Uint8Array(imageBuffer));
          tempPaths.push(tempPath);
        } else if (imgData.startsWith('/storage/')) {
          console.log(`处理存储图片 ${i}: ${imgData}`);
          const filePath = path.join(process.cwd(), 'public', imgData);
          try {
            const imageBuffer = await fs.readFile(filePath);
            const tempPath = path.join(outputDir, 'temp_' + timestamp + '_' + uniqueId + '_' + i + '.png');
            await fs.writeFile(tempPath, new Uint8Array(imageBuffer));
            tempPaths.push(tempPath);
            console.log(`图片 ${i} 已复制到临时文件`);
          } catch (err: any) {
            console.error(`读取图片失败 ${imgData}:`, err.message);
          }
        }
      }

      if (tempPaths.length === 0) {
        throw new Error('没有可用的图片进行编辑');
      }

      console.log('准备调用编辑API，图片数:', tempPaths.length);
      result = await imageApiClient.edit({
        prompt: finalPrompt,
        size: size || 'auto',
        quality: quality || 'medium',
        response_format: 'b64_json',
        imagePaths: tempPaths
      });
      
      for (const tempPath of tempPaths) {
        try {
          await fs.unlink(tempPath);
        } catch (e) {
          console.warn('删除临时文件失败:', e);
        }
      }
    } else {
      console.log('=== 使用生成模式 ===');
      const requestParams: any = {
        prompt: finalPrompt,
        size: size || 'auto',
        quality: quality || 'medium',
        response_format: 'b64_json'
      };

      result = await imageApiClient.generate(requestParams);
    }

    if (result?.data?.[0]) {
      const { revisedPrompt } = await persistGeneratedImage(result, outputPath);
      const imageUrl = '/storage/outputs/' + filename;
      
      if (historyId) {
        try {
          await prisma.generationHistory.update({
            where: { id: historyId },
            data: {
              prompt: revisedPrompt || finalPrompt,
              outputImageUrl: imageUrl,
              thumbnailUrl: imageUrl,
              status: 'success'
            }
          });
        } catch (historyError) {
          console.error('更新历史记录失败:', historyError);
        }
      }
      
      return NextResponse.json({
        success: true,
        imageUrl: imageUrl,
        revisedPrompt: revisedPrompt || finalPrompt,
        model: 'gpt-image-2',
        size: size || 'auto',
        quality: quality || 'medium'
      });
    } else {
      throw new Error('API返回数据格式错误');
    }
  } catch (error: any) {
    console.error('图片生成失败:', error);
    
    if (historyId) {
      try {
        // 获取用户角色以判断是否显示详细错误
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true }
        });
        const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

        // 更新历史记录为失败并退还算力
        await prisma.$transaction([
          prisma.generationHistory.update({
            where: { id: historyId },
            data: { status: 'failed' }
          }),
          prisma.user.update({
            where: { id: userId },
            data: { credits: { increment: 1 } }
          })
        ]);

        return NextResponse.json(
          { 
            success: false,
            error: '图片生成失败',
            message: isAdmin ? (error.message || '未知错误') : '生成过程中遇到问题，请稍后重试',
            // 不要在非管理员响应中包含 prompt 等敏感信息
            details: isAdmin ? {
              errorName: error.name,
              stack: error.stack,
              historyId
            } : undefined
          },
          { status: 500 }
        );
      } catch (historyError: any) {
        console.error('保存失败状态及退还算力失败:', historyError);
        return NextResponse.json(
          { 
            success: false,
            error: '图片生成失败且退还算力失败',
            message: '生成过程中遇到严重错误，请联系管理员'
          },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: '图片生成失败',
        message: '生成过程中遇到问题，请稍后重试'
      },
      { status: 500 }
    );
  }
}

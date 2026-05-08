import { NextRequest, NextResponse } from 'next/server';
import { ImageApiClient } from '@/lib/image-api-client';
import { prisma } from '@/lib/prisma';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function POST(request: NextRequest) {
  let finalPrompt = '';
  let userId: string | undefined;
  let templateId: string | undefined;
  let templateName: string | undefined;
  let variables: any;
  
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
      templateName: bodyTemplateName
    } = body;
    
    userId = bodyUserId;
    templateId = bodyTemplateId;
    templateName = bodyTemplateName;
    variables = bodyVariables;

    if (!userId) {
      return NextResponse.json({ error: '未登录或缺少用户ID，无法生成' }, { status: 401 });
    }

    // 检查并预扣除算力 (事务或使用条件更新)
    const userCheck = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!userCheck) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }
    
    if (userCheck.credits < 1) {
      return NextResponse.json({ error: '潮能力（算力）不足，请联系管理员充值' }, { status: 403 });
    }

    // 预扣除 1 个算力
    const updatedUser = await prisma.user.updateMany({
      where: { id: userId, credits: { gte: 1 } },
      data: { credits: { decrement: 1 } }
    });

    if (updatedUser.count === 0) {
      return NextResponse.json({ error: '潮能力（算力）扣除失败或余额不足' }, { status: 403 });
    }

    if (!promptTemplate) {
      // 退还算力
      await prisma.user.update({
        where: { id: userId },
        data: { credits: { increment: 1 } }
      });
      return NextResponse.json(
        { error: '缺少提示词模板' },
        { status: 400 }
      );
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

    const imageApiClient = new ImageApiClient();

    console.log('=== 图片生成请求 ===');
    console.log('mode:', mode);
    console.log('promptTemplate:', promptTemplate);
    console.log('size:', size);
    console.log('quality:', quality);
    console.log('referenceImages:', referenceImages);
    console.log('images:', images);

    const outputDir = path.join(process.cwd(), 'public', 'storage', 'outputs');
    await fs.mkdir(outputDir, { recursive: true });

    const timestamp = Date.now().toString();
    const filename = 'generated_' + timestamp + '.png';
    const outputPath = path.join(outputDir, filename);

    let result;
    const tempPaths: string[] = [];

    const hasReferenceImages = referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0;
    const hasUserImages = images && Array.isArray(images) && images.length > 0;
    const totalImages = (hasReferenceImages ? referenceImages.length : 0) + (hasUserImages ? images.length : 0);

    console.log('hasReferenceImages:', hasReferenceImages);
    console.log('hasUserImages:', hasUserImages);
    console.log('totalImages:', totalImages);
    console.log('will use edit mode:', mode === 'edit');

    if (mode === 'edit' || totalImages >= 2) {
      if (!hasUserImages) {
        console.log('⚠️  警告: 编辑模式需要用户图片但未提供');
        // 退还算力
        await prisma.user.update({
          where: { id: userId },
          data: { credits: { increment: 1 } }
        });
        return NextResponse.json(
          { error: '编辑模式需要至少一张用户上传的图片作为主视觉' },
          { status: 400 }
        );
      }
      
      console.log('=== 使用编辑模式 ===');
      const allImages: string[] = [];
      
      if (hasReferenceImages) {
        console.log('添加预设参考图:', referenceImages.length, '张');
        allImages.push(...referenceImages);
      } else {
        console.log('没有预设参考图');
      }
      
      console.log('添加用户图片:', images.length, '张');
      allImages.push(...images);
      
      console.log('总图片数:', allImages.length);
      
      if (allImages.length < 2) {
        console.log('错误: 编辑模式需要至少2张图片，当前只有', allImages.length, '张');
        // 退还算力
        await prisma.user.update({
          where: { id: userId },
          data: { credits: { increment: 1 } }
        });
        return NextResponse.json(
          { error: `编辑模式需要至少2张图片（模板图+主视觉图），当前只有${allImages.length}张。请确保已选择预设模板图和上传主视觉图片。` },
          { status: 400 }
        );
      }
      
      for (let i = 0; i < allImages.length; i++) {
        const imgData = allImages[i];
        
        if (imgData.startsWith('data:')) {
          console.log(`处理base64图片 ${i}`);
          const base64Data = imgData.split(',')[1];
          const imageBuffer = Buffer.from(base64Data, 'base64');
          const tempPath = path.join(outputDir, 'temp_' + timestamp + '_' + i + '.png');
          await fs.writeFile(tempPath, new Uint8Array(imageBuffer));
          tempPaths.push(tempPath);
        } else if (imgData.startsWith('/storage/')) {
          console.log(`处理存储图片 ${i}: ${imgData}`);
          const filePath = path.join(process.cwd(), 'public', imgData);
          try {
            const imageBuffer = await fs.readFile(filePath);
            const tempPath = path.join(outputDir, 'temp_' + timestamp + '_' + i + '.png');
            await fs.writeFile(tempPath, new Uint8Array(imageBuffer));
            tempPaths.push(tempPath);
            console.log(`图片 ${i} 已复制到临时文件`);
          } catch (err: any) {
            console.error(`读取图片失败 ${imgData}:`, err.message);
          }
        }
      }

      if (tempPaths.length === 0) {
        // 退还算力
        await prisma.user.update({
          where: { id: userId },
          data: { credits: { increment: 1 } }
        });
        return NextResponse.json(
          { error: '没有可用的图片' },
          { status: 400 }
        );
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
      console.log('mode:', mode);
      console.log('hasReferenceImages:', hasReferenceImages);
      console.log('hasUserImages:', hasUserImages);
      const requestParams: any = {
        prompt: finalPrompt,
        size: size || 'auto',
        quality: quality || 'medium',
        response_format: 'b64_json'
      };

      result = await imageApiClient.generate(requestParams);
    }

    if (result.data && result.data[0] && result.data[0].b64_json) {
      let b64String = result.data[0].b64_json;
      
      if (b64String.includes(',')) {
        b64String = b64String.split(',')[1];
      }
      
      const imageBuffer = Buffer.from(b64String, 'base64');
      await fs.writeFile(outputPath, new Uint8Array(imageBuffer));
      
      const imageUrl = '/storage/outputs/' + filename;
      
      if (userId) {
        try {
          await prisma.generationHistory.create({
            data: {
              userId,
              templateId: templateId || null,
              templateName: templateName || '未命名模板',
              prompt: result.data[0].revised_prompt || finalPrompt,
              variables: variables ? JSON.stringify(variables) : null,
              outputImageUrl: imageUrl,
              thumbnailUrl: imageUrl,
              status: 'success'
            }
          });
        } catch (historyError) {
          console.error('保存历史记录失败:', historyError);
        }
      }
      
      return NextResponse.json({
        success: true,
        imageUrl: imageUrl,
        revisedPrompt: result.data[0].revised_prompt || finalPrompt,
        model: 'gpt-image-2',
        size: size || 'auto',
        quality: quality || 'medium'
      });
    } else {
      throw new Error('API返回数据格式错误');
    }
  } catch (error: any) {
    console.error('图片生成失败:', error);
    
    if (userId) {
      try {
        await prisma.generationHistory.create({
          data: {
            userId,
            templateId: templateId || null,
            templateName: templateName || '未命名模板',
            prompt: finalPrompt,
            variables: variables ? JSON.stringify(variables) : null,
            outputImageUrl: null,
            thumbnailUrl: null,
            status: 'failed'
          }
        });

        // 退还算力
        await prisma.user.update({
          where: { id: userId },
          data: { credits: { increment: 1 } }
        });
      } catch (historyError) {
        console.error('保存失败历史记录及退还算力失败:', historyError);
      }
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: '图片生成失败',
        message: error.message || '未知错误'
      },
      { status: 500 }
    );
  }
}

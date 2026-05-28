import { NextRequest, NextResponse } from 'next/server';
import { ImageApiClient } from '@/lib/image-api-client';
import { getImageProviderFailoverChain } from '@/lib/image-provider-registry';
import { prisma } from '@/lib/prisma';
import {
  getContentTypeFromFilename,
  readLocalStorageFileByUrl,
  uploadBuffer,
} from '@/lib/storage';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';

const INVALID_IMAGE_INPUT_PREFIX = 'INVALID_IMAGE_INPUT:';
const SUPPORTED_EDIT_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function getSupportedImageFormatsHint(): string {
  return '当前仅支持 PNG、JPG/JPEG、WEBP 格式，请不要上传 ICO、SVG 等图标类格式';
}

function createInvalidImageInputError(message: string): Error {
  return new Error(`${INVALID_IMAGE_INPUT_PREFIX}${message}`);
}

function getMimeTypeExtension(mimeType: string): string | null {
  switch (mimeType.toLowerCase()) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    default:
      return null;
  }
}

function ensureSupportedEditImageFormat(extension: string | null | undefined, sourceLabel: string): string {
  const normalizedExtension = extension?.toLowerCase();
  if (!normalizedExtension || !SUPPORTED_EDIT_IMAGE_EXTENSIONS.has(normalizedExtension)) {
    throw createInvalidImageInputError(`${sourceLabel}格式不受支持。${getSupportedImageFormatsHint()}`);
  }

  return normalizedExtension;
}

function getUserFacingErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const matchedStatus = rawMessage.match(/\b(5\d{2})\b/)?.[1];
  const normalizedMessage = rawMessage.toLowerCase();

  if (rawMessage.startsWith(INVALID_IMAGE_INPUT_PREFIX)) {
    return rawMessage.slice(INVALID_IMAGE_INPUT_PREFIX.length);
  }

  if (matchedStatus === '524' || matchedStatus === '542') {
    return '524：上游服务器繁忙，请稍后重试';
  }

  if (
    normalizedMessage.includes('image upload failed') ||
    normalizedMessage.includes('invalid image') ||
    normalizedMessage.includes('图片编辑失败: 400')
  ) {
    return `上传的参考图未通过图片校验，请检查以下内容：
1. 图片格式是否为 PNG、JPG/JPEG 或 WEBP
2. 不要上传 ICO、SVG 等图标或矢量格式
3. 图片文件是否能正常打开，是否存在损坏或编码异常
4. 图片尺寸不要过小、过大，长宽比不要过于极端`;
  }
  return '生成过程中遇到问题，请稍后重试';
}


function getErrorResponseStatus(error: unknown): number {
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const normalizedMessage = rawMessage.toLowerCase();

  if (
    rawMessage.startsWith(INVALID_IMAGE_INPUT_PREFIX) ||
    rawMessage.includes('没有可用的图片进行编辑') ||
    normalizedMessage.includes('image upload failed') ||
    normalizedMessage.includes('invalid image')
  ) {
    return 400;
  }

  return 500;
}

function shouldFailoverToNextProvider(error: unknown): boolean {
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const normalizedMessage = rawMessage.toLowerCase();
  const matchedStatus = rawMessage.match(/\b(\d{3})\b/)?.[1];

  if (rawMessage.startsWith(INVALID_IMAGE_INPUT_PREFIX)) {
    return false;
  }

  if (
    rawMessage.includes('没有可用的图片进行编辑') ||
    normalizedMessage.includes('invalid image') ||
    normalizedMessage.includes('image upload failed') ||
    normalizedMessage.includes('格式不受支持')
  ) {
    return false;
  }

  if (
    normalizedMessage.includes('当前未开启编辑接口') ||
    normalizedMessage.includes('超时') ||
    normalizedMessage.includes('fetch failed')
  ) {
    return true;
  }

  return ['408', '429', '500', '502', '503', '504', '522', '524'].includes(matchedStatus || '');
}

async function persistGeneratedImage(
  result: any,
  storageKey: string
): Promise<{ revisedPrompt: string | null; imageUrl: string }> {
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
    const storedFile = await uploadBuffer({
      key: storageKey,
      buffer: imageBuffer,
      contentType: getContentTypeFromFilename(storageKey),
    });
    return {
      revisedPrompt: firstItem.revised_prompt || null,
      imageUrl: storedFile.url,
    };
  }

  if (firstItem.url) {
    const upstreamResponse = await fetch(firstItem.url);
    if (!upstreamResponse.ok) {
      throw new Error(`下载上游图片失败: ${upstreamResponse.status}`);
    }

    const imageArrayBuffer = await upstreamResponse.arrayBuffer();
    const storedFile = await uploadBuffer({
      key: storageKey,
      buffer: Buffer.from(imageArrayBuffer),
      contentType: upstreamResponse.headers.get('content-type') || getContentTypeFromFilename(storageKey),
    });
    return {
      revisedPrompt: firstItem.revised_prompt || null,
      imageUrl: storedFile.url,
    };
  }

  console.error('上游图片接口返回了未兼容的数据结构:', JSON.stringify(result).slice(0, 2000));
  throw new Error('API返回数据格式错误');
}

export async function POST(request: NextRequest) {
  let finalPrompt = '';
  let userId: string | undefined;
  let templateId: string | undefined;
  let templateName: string | undefined;
  let providerId: string | undefined;
  let variables: any;
  let historyId: string | undefined;
  let attemptedProviderIds: string[] = [];
  
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
      providerId: requestedProviderId,
      config // 新增：UI 状态配置
    } = body;
    
    userId = bodyUserId;
    templateId = bodyTemplateId;
    templateName = bodyTemplateName;
    providerId = requestedProviderId;
    variables = bodyVariables;

    if (!userId) {
      return NextResponse.json({ error: '未登录或缺少用户ID，无法生成' }, { status: 401 });
    }

    if (!promptTemplate) {
      return NextResponse.json({ error: '缺少提示词模板' }, { status: 400 });
    }

    let providerChain;
    try {
      providerChain = await getImageProviderFailoverChain(providerId);
      providerId = providerChain[0].id;
    } catch (providerError: any) {
      const message = providerError?.message || '供应商配置不可用';
      const status = providerId ? 400 : 500;
      return NextResponse.json({ error: '图片供应商不可用', message }, { status });
    }

    const hasReferenceImages = referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0;
    const hasUserImages = images && Array.isArray(images) && images.length > 0;
    const referenceImageCount = hasReferenceImages ? referenceImages.length : 0;
    const userImageCount = hasUserImages ? images.length : 0;
    const variableImageCount = config?.variableImages
      ? Object.values(config.variableImages).filter(Boolean).length
      : 0;
    const mainImageCount = config?.selectedUserImage ? 1 : 0;
    const totalImages = referenceImageCount + userImageCount;
    const shouldUseEditMode = (mode === 'edit' && totalImages > 0) || totalImages >= 2;

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

    console.log('=== 图片生成请求 ===');
    console.log('userId:', userId);
    console.log('historyId:', historyId);
    console.log('mode:', mode);
    console.log('providerChain:', providerChain.map((provider) => provider.id).join(' -> '));

    // 使用更唯一的命名方式避免并发冲突
    const uniqueId = crypto.randomUUID().slice(0, 8);
    const timestamp = Date.now().toString();
    const filename = `generated_${timestamp}_${uniqueId}.png`;
    const outputStorageKey = `outputs/${filename}`;
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'haipablo-image-'));

    let result;
    let finalProvider = providerChain[0];
    const tempPaths: string[] = [];

    try {
      console.log('hasReferenceImages:', hasReferenceImages);
      console.log('hasUserImages:', hasUserImages);
      console.log('referenceImageCount:', referenceImageCount);
      console.log('userImageCount:', userImageCount);
      console.log('variableImageCount:', variableImageCount);
      console.log('mainImageCount:', mainImageCount);
      console.log('totalImages:', totalImages);
      console.log('will use edit mode:', shouldUseEditMode);

      if (shouldUseEditMode) {
        console.log('=== 使用编辑模式 ===');
        const allImages: string[] = [];
        
        if (hasReferenceImages) {
          console.log('添加预设参考图:', referenceImageCount, '张');
          allImages.push(...referenceImages);
        }
        
        console.log('添加用户图片:', userImageCount, '张');
        allImages.push(...images);
        
        for (let i = 0; i < allImages.length; i++) {
          const imgData = allImages[i];
          
          if (imgData.startsWith('data:')) {
            console.log(`处理base64图片 ${i}`);
            const mimeTypeMatch = imgData.match(/^data:([^;]+);base64,/i);
            const extension = ensureSupportedEditImageFormat(
              getMimeTypeExtension(mimeTypeMatch?.[1] || ''),
              `第 ${i + 1} 张图片`
            );
            const base64Data = imgData.split(',')[1];
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const tempPath = path.join(tempDir, 'temp_' + timestamp + '_' + uniqueId + '_' + i + extension);
            await fs.writeFile(tempPath, new Uint8Array(imageBuffer));
            tempPaths.push(tempPath);
          } else if (imgData.startsWith('/storage/') || imgData.includes('/storage/')) {
            console.log(`处理本地存储图片 ${i}: ${imgData}`);
            const extension = ensureSupportedEditImageFormat(
              path.extname(imgData),
              `第 ${i + 1} 张图片`
            );
            try {
              const imageBuffer = await readLocalStorageFileByUrl(imgData);
              const tempPath = path.join(tempDir, 'temp_' + timestamp + '_' + uniqueId + '_' + i + extension);
              await fs.writeFile(tempPath, new Uint8Array(imageBuffer));
              tempPaths.push(tempPath);
              console.log(`图片 ${i} 已复制到临时文件`);
            } catch (err: any) {
              console.error(`读取图片失败 ${imgData}:`, err.message);
            }
          } else if (/^https?:\/\//i.test(imgData)) {
            console.log(`处理远程图片 ${i}: ${imgData}`);
            let extension = path.extname(imgData);
            if (!extension) {
              try {
                extension = path.extname(new URL(imgData).pathname);
              } catch {
                extension = '';
              }
            }
            extension = ensureSupportedEditImageFormat(extension, `第 ${i + 1} 张图片`);
            try {
              const response = await fetch(imgData);
              if (!response.ok) {
                throw new Error(`下载远程图片失败: ${response.status}`);
              }
              const imageBuffer = Buffer.from(await response.arrayBuffer());
              const tempPath = path.join(tempDir, 'temp_' + timestamp + '_' + uniqueId + '_' + i + extension);
              await fs.writeFile(tempPath, new Uint8Array(imageBuffer));
              tempPaths.push(tempPath);
              console.log(`远程图片 ${i} 已复制到临时文件`);
            } catch (err: any) {
              console.error(`下载远程图片失败 ${imgData}:`, err.message);
            }
          }
        }

        if (tempPaths.length === 0) {
          throw new Error('没有可用的图片进行编辑');
        }

        console.log('准备调用编辑API，图片数:', tempPaths.length);
        try {
          let lastProviderError: unknown;
          for (let index = 0; index < providerChain.length; index++) {
            const currentProvider = providerChain[index];
            attemptedProviderIds.push(currentProvider.id);
            const editStart = Date.now();

            try {
              const imageApiClient = new ImageApiClient(currentProvider);
              result = await imageApiClient.edit({
                prompt: finalPrompt,
                size: size || 'auto',
                quality: quality || 'medium',
                response_format: 'b64_json',
                imagePaths: tempPaths
              });
              finalProvider = currentProvider;
              console.log('编辑API调用完成，供应商:', currentProvider.id, '耗时ms:', Date.now() - editStart);
              break;
            } catch (providerError: any) {
              lastProviderError = providerError;
              console.error(`供应商 ${currentProvider.id} 编辑失败:`, providerError);
              const shouldFailover = shouldFailoverToNextProvider(providerError) && index < providerChain.length - 1;
              if (!shouldFailover) {
                throw providerError;
              }
              console.warn(`供应商 ${currentProvider.id} 编辑失败，自动切换到备用通道`);
            }
          }

          if (!result) {
            throw lastProviderError instanceof Error ? lastProviderError : new Error('图片编辑失败');
          }
        } finally {
          for (const tempPath of tempPaths) {
            try {
              await fs.unlink(tempPath);
            } catch (e) {
              console.warn('删除临时文件失败:', e);
            }
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

        let lastProviderError: unknown;
        for (let index = 0; index < providerChain.length; index++) {
          const currentProvider = providerChain[index];
          attemptedProviderIds.push(currentProvider.id);
          const generateStart = Date.now();

          try {
            const imageApiClient = new ImageApiClient(currentProvider);
            result = await imageApiClient.generate(requestParams);
            finalProvider = currentProvider;
            console.log('生成API调用完成，供应商:', currentProvider.id, '耗时ms:', Date.now() - generateStart);
            break;
          } catch (providerError: any) {
            lastProviderError = providerError;
            console.error(`供应商 ${currentProvider.id} 生成失败:`, providerError);
            const shouldFailover = shouldFailoverToNextProvider(providerError) && index < providerChain.length - 1;
            if (!shouldFailover) {
              throw providerError;
            }
            console.warn(`供应商 ${currentProvider.id} 生成失败，自动切换到备用通道`);
          }
        }

        if (!result) {
          throw lastProviderError instanceof Error ? lastProviderError : new Error('图片生成失败');
        }
      }

      if (result?.data?.[0]) {
        const { revisedPrompt, imageUrl } = await persistGeneratedImage(result, outputStorageKey);
        
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
          imageUrl,
          revisedPrompt: revisedPrompt || finalPrompt,
          model: finalProvider.model,
          providerId: finalProvider.id,
          providerLabel: finalProvider.label,
          fallbackUsed: attemptedProviderIds.length > 1 && attemptedProviderIds[0] !== finalProvider.id,
          attemptedProviderIds,
          size: size || 'auto',
          quality: quality || 'medium'
        });
      }

      throw new Error('API返回数据格式错误');
    } finally {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('清理临时目录失败:', cleanupError);
      }
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
            message: getUserFacingErrorMessage(error),
            // 不要在非管理员响应中包含 prompt 等敏感信息
            details: isAdmin ? {
              errorName: error.name,
              rawMessage: error.message,
              stack: error.stack,
              historyId,
              providerId,
              attemptedProviderIds
            } : undefined
          },
          { status: getErrorResponseStatus(error) }
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
        message: getUserFacingErrorMessage(error)
      },
      { status: getErrorResponseStatus(error) }
    );
  }
}

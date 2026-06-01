import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ImageApiClient } from '@/lib/image-api-client';
import type { ImageQuality } from '@/lib/image-api-client';
import { getImageProviderFailoverChain } from '@/lib/image-provider-registry';
import {
  getContentTypeFromFilename,
  readLocalStorageFileByUrl,
  uploadBuffer,
} from '@/lib/storage';

const INVALID_IMAGE_INPUT_PREFIX = 'INVALID_IMAGE_INPUT:';
const SUPPORTED_EDIT_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const STORED_JOB_REQUEST_KEY = 'asyncJobRequest';

export interface ImageGenerationRequestPayload {
  mode?: string;
  promptTemplate: string;
  variables?: Record<string, unknown>;
  size?: string;
  quality?: string;
  images?: string[];
  referenceImages?: string[];
  userId: string;
  templateId?: string;
  templateName?: string;
  providerId?: string;
  config?: Record<string, unknown> | null;
}

export interface ImageGenerationResult {
  imageUrl: string;
  revisedPrompt: string;
  model: string;
  providerId: string;
  providerLabel: string;
  fallbackUsed: boolean;
  attemptedProviderIds: string[];
  size: string;
  quality: string;
}

function normalizeQuality(quality?: string): ImageQuality {
  if (quality === 'low' || quality === 'medium' || quality === 'high' || quality === 'auto') {
    return quality;
  }

  return 'medium';
}

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

export function buildFinalPrompt(
  promptTemplate: string,
  variables?: Record<string, unknown>
): string {
  let finalPrompt = promptTemplate;

  if (variables && typeof variables === 'object') {
    for (const [key, value] of Object.entries(variables)) {
      if (typeof value === 'string') {
        const regex = new RegExp(`{{${key}}}`, 'g');
        finalPrompt = finalPrompt.replace(regex, value);
      }
    }
  }

  return finalPrompt;
}

export function getUserFacingErrorMessage(error: unknown): string {
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

  if (normalizedMessage.includes('缺少 api key')) {
    return '图片供应商缺少 API Key 配置，请联系管理员检查供应商设置';
  }

  if (normalizedMessage.includes('图片供应商不可用')) {
    return rawMessage;
  }

  if (normalizedMessage.includes('超时')) {
    return '图片供应商响应超时，请稍后重试';
  }

  if (normalizedMessage.includes('fetch failed')) {
    return '连接图片供应商失败，请检查网络或稍后重试';
  }

  if (normalizedMessage.includes('下载远程图片失败')) {
    return '读取参考图失败，远程图片地址暂时不可访问';
  }

  if (normalizedMessage.includes('下载上游图片失败')) {
    return '下载生成结果失败，上游图片地址暂时不可访问';
  }

  if (normalizedMessage.includes('api未返回图片数据')) {
    return '图片供应商未返回图片数据';
  }

  if (normalizedMessage.includes('api返回数据格式错误')) {
    return '图片供应商返回了无法识别的数据格式';
  }

  return '生成过程中遇到问题，请稍后重试';
}

export function getErrorResponseStatus(error: unknown): number {
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

export function createStoredJobConfig(
  config: Record<string, unknown> | null | undefined,
  payload: ImageGenerationRequestPayload
): string | null {
  const storedConfig = {
    ...(config && typeof config === 'object' ? config : {}),
    [STORED_JOB_REQUEST_KEY]: {
      mode: payload.mode,
      promptTemplate: payload.promptTemplate,
      variables: payload.variables || {},
      size: payload.size,
      quality: payload.quality,
      images: payload.images || [],
      referenceImages: payload.referenceImages || [],
      userId: payload.userId,
      templateId: payload.templateId,
      templateName: payload.templateName,
      providerId: payload.providerId,
    },
  };

  return JSON.stringify(storedConfig);
}

export function extractStoredJobPayload(configJson: string | null | undefined): ImageGenerationRequestPayload | null {
  if (!configJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(configJson) as Record<string, unknown>;
    const rawPayload = parsed[STORED_JOB_REQUEST_KEY];
    if (!rawPayload || typeof rawPayload !== 'object') {
      return null;
    }

    const payload = rawPayload as Record<string, unknown>;
    if (typeof payload.userId !== 'string' || typeof payload.promptTemplate !== 'string') {
      return null;
    }

    return {
      userId: payload.userId,
      promptTemplate: payload.promptTemplate,
      mode: typeof payload.mode === 'string' ? payload.mode : undefined,
      templateId: typeof payload.templateId === 'string' ? payload.templateId : undefined,
      templateName: typeof payload.templateName === 'string' ? payload.templateName : undefined,
      providerId: typeof payload.providerId === 'string' ? payload.providerId : undefined,
      size: typeof payload.size === 'string' ? payload.size : undefined,
      quality: typeof payload.quality === 'string' ? payload.quality : undefined,
      variables: payload.variables && typeof payload.variables === 'object'
        ? (payload.variables as Record<string, unknown>)
        : undefined,
      images: Array.isArray(payload.images)
        ? payload.images.filter((item): item is string => typeof item === 'string')
        : [],
      referenceImages: Array.isArray(payload.referenceImages)
        ? payload.referenceImages.filter((item): item is string => typeof item === 'string')
        : [],
      config: parsed,
    };
  } catch {
    return null;
  }
}

export async function runImageGeneration(
  payload: ImageGenerationRequestPayload
): Promise<ImageGenerationResult> {
  const {
    mode,
    promptTemplate,
    variables,
    size,
    quality,
    images,
    referenceImages,
    providerId,
  } = payload;

  let requestedProviderId = providerId;
  let providerChain;

  try {
    providerChain = await getImageProviderFailoverChain(requestedProviderId);
    requestedProviderId = providerChain[0].id;
  } catch (providerError: any) {
    const message = providerError?.message || '供应商配置不可用';
    throw new Error(`图片供应商不可用: ${message}`);
  }

  const hasReferenceImages = Array.isArray(referenceImages) && referenceImages.length > 0;
  const hasUserImages = Array.isArray(images) && images.length > 0;
  const totalImages = (referenceImages?.length || 0) + (images?.length || 0);
  const shouldUseEditMode = (mode === 'edit' && totalImages > 0) || totalImages >= 2;
  const finalPrompt = buildFinalPrompt(promptTemplate, variables);

  const uniqueId = crypto.randomUUID().slice(0, 8);
  const timestamp = Date.now().toString();
  const filename = `generated_${timestamp}_${uniqueId}.png`;
  const outputStorageKey = `outputs/${filename}`;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'haipablo-image-'));
  const attemptedProviderIds: string[] = [];

  let result: any;
  let finalProvider = providerChain[0];

  try {
    if (shouldUseEditMode) {
      const allImages: string[] = [];
      if (hasReferenceImages) {
        allImages.push(...(referenceImages || []));
      }
      if (hasUserImages) {
        allImages.push(...(images || []));
      }

      const tempPaths: string[] = [];

      try {
        for (let index = 0; index < allImages.length; index += 1) {
          const imageData = allImages[index];

          if (imageData.startsWith('data:')) {
            const mimeTypeMatch = imageData.match(/^data:([^;]+);base64,/i);
            const extension = ensureSupportedEditImageFormat(
              getMimeTypeExtension(mimeTypeMatch?.[1] || ''),
              `第 ${index + 1} 张图片`
            );
            const base64Data = imageData.split(',')[1];
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const tempPath = path.join(tempDir, `temp_${timestamp}_${uniqueId}_${index}${extension}`);
            await fs.writeFile(tempPath, new Uint8Array(imageBuffer));
            tempPaths.push(tempPath);
            continue;
          }

          if (imageData.startsWith('/storage/') || imageData.includes('/storage/')) {
            const extension = ensureSupportedEditImageFormat(
              path.extname(imageData),
              `第 ${index + 1} 张图片`
            );
            const imageBuffer = await readLocalStorageFileByUrl(imageData);
            const tempPath = path.join(tempDir, `temp_${timestamp}_${uniqueId}_${index}${extension}`);
            await fs.writeFile(tempPath, new Uint8Array(imageBuffer));
            tempPaths.push(tempPath);
            continue;
          }

          if (/^https?:\/\//i.test(imageData)) {
            let extension = path.extname(imageData);
            if (!extension) {
              try {
                extension = path.extname(new URL(imageData).pathname);
              } catch {
                extension = '';
              }
            }
            extension = ensureSupportedEditImageFormat(extension, `第 ${index + 1} 张图片`);
            const response = await fetch(imageData);
            if (!response.ok) {
              throw new Error(`下载远程图片失败: ${response.status}`);
            }

            const imageBuffer = Buffer.from(await response.arrayBuffer());
            const tempPath = path.join(tempDir, `temp_${timestamp}_${uniqueId}_${index}${extension}`);
            await fs.writeFile(tempPath, new Uint8Array(imageBuffer));
            tempPaths.push(tempPath);
          }
        }

        if (tempPaths.length === 0) {
          throw new Error('没有可用的图片进行编辑');
        }

        let lastProviderError: unknown;
        for (let index = 0; index < providerChain.length; index += 1) {
          const currentProvider = providerChain[index];
          attemptedProviderIds.push(currentProvider.id);

          try {
            const imageApiClient = new ImageApiClient(currentProvider);
            result = await imageApiClient.edit({
              prompt: finalPrompt,
              size: size || 'auto',
              quality: normalizeQuality(quality),
              response_format: 'b64_json',
              imagePaths: tempPaths,
            });
            finalProvider = currentProvider;
            break;
          } catch (providerError) {
            lastProviderError = providerError;
            const shouldFailover = shouldFailoverToNextProvider(providerError) && index < providerChain.length - 1;
            if (!shouldFailover) {
              throw providerError;
            }
          }
        }

        if (!result) {
          throw lastProviderError instanceof Error ? lastProviderError : new Error('图片编辑失败');
        }
      } finally {
        await Promise.allSettled(
          tempPaths.map(async (tempPath) => {
            await fs.unlink(tempPath);
          })
        );
      }
    } else {
      const requestParams = {
        prompt: finalPrompt,
        size: size || 'auto',
        quality: normalizeQuality(quality),
        response_format: 'b64_json' as const,
      };

      let lastProviderError: unknown;
      for (let index = 0; index < providerChain.length; index += 1) {
        const currentProvider = providerChain[index];
        attemptedProviderIds.push(currentProvider.id);

        try {
          const imageApiClient = new ImageApiClient(currentProvider);
          result = await imageApiClient.generate(requestParams);
          finalProvider = currentProvider;
          break;
        } catch (providerError) {
          lastProviderError = providerError;
          const shouldFailover = shouldFailoverToNextProvider(providerError) && index < providerChain.length - 1;
          if (!shouldFailover) {
            throw providerError;
          }
        }
      }

      if (!result) {
        throw lastProviderError instanceof Error ? lastProviderError : new Error('图片生成失败');
      }
    }

    const persisted = await persistGeneratedImage(result, outputStorageKey);

    return {
      imageUrl: persisted.imageUrl,
      revisedPrompt: persisted.revisedPrompt || finalPrompt,
      model: finalProvider.model,
      providerId: finalProvider.id,
      providerLabel: finalProvider.label,
      fallbackUsed: attemptedProviderIds.length > 1 && attemptedProviderIds[0] !== finalProvider.id,
      attemptedProviderIds,
      size: size || 'auto',
      quality: quality || 'medium',
    };
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('清理临时目录失败:', cleanupError);
    }
  }
}

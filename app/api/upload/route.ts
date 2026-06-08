import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import sharp, { type Sharp } from 'sharp';
import { isOssEnabled, uploadBuffer } from '@/lib/storage';

export const runtime = 'nodejs';

const REFERENCE_UPLOAD_MAX_EDGE = 3840;
const REFERENCE_UPLOAD_MAX_TOTAL_PIXELS = 8_294_400;
const REFERENCE_UPLOAD_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const ACCEPTED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function getExtensionFromMimeType(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'image/bmp':
      return '.bmp';
    case 'image/avif':
      return '.avif';
    default:
      return '';
  }
}

function getMimeTypeFromSharpFormat(format?: string): string | undefined {
  switch ((format || '').toLowerCase()) {
    case 'png':
      return 'image/png';
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    case 'avif':
      return 'image/avif';
    default:
      return undefined;
  }
}

function getConstrainedDimensions(width: number, height: number) {
  const longestEdge = Math.max(width, height);
  const totalPixels = width * height;
  let scale = 1;

  if (longestEdge > REFERENCE_UPLOAD_MAX_EDGE) {
    scale = Math.min(scale, REFERENCE_UPLOAD_MAX_EDGE / longestEdge);
  }

  if (totalPixels > REFERENCE_UPLOAD_MAX_TOTAL_PIXELS) {
    scale = Math.min(scale, Math.sqrt(REFERENCE_UPLOAD_MAX_TOTAL_PIXELS / totalPixels));
  }

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

type SharpOutputConfig = {
  contentType: string;
  extension: string;
  apply: (pipeline: Sharp) => Sharp;
};

function getSharpOutputConfig(fileType: string, hasAlpha: boolean): SharpOutputConfig {
  switch (fileType.toLowerCase()) {
    case 'image/png':
      if (hasAlpha) {
        return {
          contentType: 'image/png',
          extension: '.png',
          apply: (pipeline) => pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }),
        };
      }

      return {
        contentType: 'image/jpeg',
        extension: '.jpg',
        apply: (pipeline) => pipeline.jpeg({ quality: 90, mozjpeg: true }),
      };
    case 'image/webp':
      return {
        contentType: 'image/webp',
        extension: '.webp',
        apply: (pipeline) => pipeline.webp({ quality: 90 }),
      };
    default:
      return {
        contentType: hasAlpha ? 'image/webp' : 'image/jpeg',
        extension: hasAlpha ? '.webp' : '.jpg',
        apply: (pipeline) =>
          hasAlpha ? pipeline.webp({ quality: 90 }) : pipeline.jpeg({ quality: 90, mozjpeg: true }),
      };
  }
}

async function validateAndProcessImageUpload(file: File, buffer: Buffer) {
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer, { failOn: 'none' }).metadata();
  } catch {
    throw new Error('不支持的图片格式或图片已损坏');
  }

  if (!metadata.width || !metadata.height) {
    throw new Error('无法识别图片尺寸');
  }

  const detectedContentType = file.type || getMimeTypeFromSharpFormat(metadata.format) || 'application/octet-stream';
  const detectedExtension = path.extname(file.name) || getExtensionFromMimeType(detectedContentType);

  const targetDimensions = getConstrainedDimensions(metadata.width, metadata.height);
  const needsResize =
    targetDimensions.width !== metadata.width || targetDimensions.height !== metadata.height;

  if (!needsResize) {
    return {
      buffer,
      contentType: detectedContentType,
      extension: detectedExtension,
      width: metadata.width,
      height: metadata.height,
      transformed: false,
    };
  }

  const outputConfig = getSharpOutputConfig(detectedContentType, metadata.hasAlpha === true);
  const processedBuffer = await outputConfig
    .apply(
      sharp(buffer, { failOn: 'none' })
        .rotate()
        .resize(targetDimensions.width, targetDimensions.height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
    )
    .toBuffer();

  return {
    buffer: processedBuffer,
    contentType: outputConfig.contentType,
    extension: outputConfig.extension,
    width: targetDimensions.width,
    height: targetDimensions.height,
    transformed: true,
  };
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let stage = 'init';

  try {
    stage = 'parse-form-data';
    console.info(`[upload:${requestId}] 收到上传请求`, {
      method: request.method,
      contentType: request.headers.get('content-type'),
      contentLength: request.headers.get('content-length'),
      storageDriver: isOssEnabled() ? 'oss' : 'local',
    });

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.warn(`[upload:${requestId}] 缺少 file 字段`);
      const response = NextResponse.json(
        { error: '没有上传文件' },
        { status: 400 }
      );
      response.headers.set('X-Request-Id', requestId);
      return response;
    }

    console.info(`[upload:${requestId}] 文件信息`, {
      name: file.name,
      type: file.type || 'unknown',
      size: file.size,
    });

    const mimeType = (file.type || '').toLowerCase();
    const extension = path.extname(file.name).toLowerCase();
    const isAcceptedImageType =
      ACCEPTED_IMAGE_MIME_TYPES.has(mimeType) || ACCEPTED_IMAGE_EXTENSIONS.has(extension);

    if (!isAcceptedImageType) {
      const response = NextResponse.json(
        { error: '仅支持上传 JPG、JPEG、PNG、WEBP、GIF 格式图片，不支持 PSD、SVG、HEIC 或文件夹内容' },
        { status: 400 }
      );
      response.headers.set('X-Request-Id', requestId);
      return response;
    }

    stage = 'read-file-buffer';
    const bytes = await file.arrayBuffer();
    const rawBuffer = Buffer.from(bytes);

    stage = 'validate-image';
    const processed = await validateAndProcessImageUpload(file, rawBuffer);

    if (processed.buffer.length > REFERENCE_UPLOAD_MAX_FILE_SIZE_BYTES) {
      const response = NextResponse.json(
        {
          error: `图片超过上传限制：文件大小不能超过 ${(REFERENCE_UPLOAD_MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)} MB`,
        },
        { status: 400 }
      );
      response.headers.set('X-Request-Id', requestId);
      return response;
    }

    const ext = processed.extension || path.extname(file.name) || getExtensionFromMimeType(file.type);
    const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;

    stage = 'persist-file';
    console.info(`[upload:${requestId}] 开始写入存储`, {
      filename,
      ext,
      transformed: processed.transformed,
      width: processed.width,
      height: processed.height,
      key: `uploads/${filename}`,
    });

    const storedFile = await uploadBuffer({
      key: `uploads/${filename}`,
      buffer: processed.buffer,
      contentType: processed.contentType || undefined,
    });

    console.info(`[upload:${requestId}] 上传完成`, {
      durationMs: Date.now() - startedAt,
      url: storedFile.url,
      key: storedFile.key,
      transformed: processed.transformed,
      width: processed.width,
      height: processed.height,
    });

    const response = NextResponse.json({
      success: true,
      requestId,
      url: storedFile.url,
      filename,
      size: processed.buffer.length,
      type: processed.contentType,
      width: processed.width,
      height: processed.height,
      transformed: processed.transformed,
    });
    response.headers.set('X-Request-Id', requestId);
    return response;
  } catch (error) {
    console.error(`[upload:${requestId}] 上传文件失败`, {
      stage,
      durationMs: Date.now() - startedAt,
      error,
    });
    const response = NextResponse.json(
      { error: '上传失败', requestId, stage },
      { status: 500 }
    );
    response.headers.set('X-Request-Id', requestId);
    return response;
  }
}

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { isOssEnabled, uploadBuffer } from '@/lib/storage';

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
    default:
      return '';
  }
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

    stage = 'read-file-buffer';
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = path.extname(file.name) || getExtensionFromMimeType(file.type);
    const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;

    stage = 'persist-file';
    console.info(`[upload:${requestId}] 开始写入存储`, {
      filename,
      ext,
      key: `uploads/${filename}`,
    });

    const storedFile = await uploadBuffer({
      key: `uploads/${filename}`,
      buffer,
      contentType: file.type || undefined,
    });

    console.info(`[upload:${requestId}] 上传完成`, {
      durationMs: Date.now() - startedAt,
      url: storedFile.url,
      key: storedFile.key,
    });

    const response = NextResponse.json({
      success: true,
      requestId,
      url: storedFile.url,
      filename,
      size: file.size,
      type: file.type
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

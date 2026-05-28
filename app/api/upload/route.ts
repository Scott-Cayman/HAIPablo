import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { uploadBuffer } from '@/lib/storage';

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
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: '没有上传文件' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = path.extname(file.name) || getExtensionFromMimeType(file.type);
    const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
    const storedFile = await uploadBuffer({
      key: `uploads/${filename}`,
      buffer,
      contentType: file.type || undefined,
    });

    return NextResponse.json({
      success: true,
      url: storedFile.url,
      filename,
      size: file.size,
      type: file.type
    });
  } catch (error) {
    console.error('上传文件失败:', error);
    return NextResponse.json(
      { error: '上传失败' },
      { status: 500 }
    );
  }
}

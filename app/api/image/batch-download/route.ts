import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readLocalStorageFileByUrl } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const { images } = await request.json();

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: '没有图片可下载' },
        { status: 400 }
      );
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'batch-download-'));
    const zipFilePath = path.join(tmpDir, 'images.zip');

    const archiver = (await import('archiver')).default;
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    const output = fs.createWriteStream(zipFilePath);
    archive.pipe(output);

    for (const image of images) {
      try {
        const imageUrl = image.url;
        const imageName = image.name || 'image';
        
        let imageData;
        
        if (imageUrl.startsWith('http')) {
          const response = await fetch(imageUrl);
          if (!response.ok) {
            console.error(`Failed to fetch image: ${imageUrl}`);
            continue;
          }
          imageData = await response.arrayBuffer();
        } else if (imageUrl.startsWith('/storage/') || imageUrl.includes('/storage/')) {
          try {
            imageData = await readLocalStorageFileByUrl(imageUrl);
          } catch (error) {
            console.error(`读取本地存储文件失败: ${imageUrl}`, error);
            continue;
          }
        } else if (imageUrl.startsWith('/')) {
          console.error(`Unsupported relative URL: ${imageUrl}`);
          continue;
        } else {
          const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
          imageData = Buffer.from(base64Data, 'base64');
        }

        const extension = path.extname(imageName) || '.png';
        const sanitizedName = imageName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
        const entryName = `${sanitizedName}${extension}`;

        archive.append(Buffer.from(imageData), { name: entryName });
      } catch (error) {
        console.error(`Error processing image ${image.name}:`, error);
      }
    }

    await archive.finalize();

    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });

    const zipData = fs.readFileSync(zipFilePath);

    fs.rmSync(tmpDir, { recursive: true, force: true });

    return new NextResponse(zipData, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="batch_images_${Date.now()}.zip"`,
        'Content-Length': zipData.length.toString()
      }
    });
  } catch (error) {
    console.error('批量下载失败:', error);
    return NextResponse.json(
      { error: '批量下载失败' },
      { status: 500 }
    );
  }
}

import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { listImageProviders } from '@/lib/image-provider-registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const requestId = randomUUID();
  const startedAt = Date.now();

  try {
    console.info(`[image-providers:${requestId}] 开始获取供应商列表`);
    const providers = await listImageProviders();
    const defaultProviderId = providers.find((provider) => provider.isDefault)?.id || providers[0]?.id || null;

    console.info(`[image-providers:${requestId}] 获取成功`, {
      durationMs: Date.now() - startedAt,
      count: providers.length,
      defaultProviderId,
    });

    const response = NextResponse.json({
      providers,
      defaultProviderId,
      requestId,
    });
    response.headers.set('X-Request-Id', requestId);
    return response;
  } catch (error) {
    console.error(`[image-providers:${requestId}] 获取图片供应商列表失败`, {
      durationMs: Date.now() - startedAt,
      error,
    });
    const response = NextResponse.json(
      {
        providers: [],
        defaultProviderId: null,
        requestId,
        error: '获取图片供应商列表失败',
      },
      { status: 500 }
    );
    response.headers.set('X-Request-Id', requestId);
    return response;
  }
}

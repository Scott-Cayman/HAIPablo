import { NextResponse } from 'next/server';
import { listImageProviders } from '@/lib/image-provider-registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const providers = await listImageProviders();

    return NextResponse.json({
      providers,
      defaultProviderId: providers.find((provider) => provider.isDefault)?.id || providers[0]?.id || null,
    });
  } catch (error) {
    console.error('获取图片供应商列表失败:', error);
    return NextResponse.json(
      {
        providers: [],
        defaultProviderId: null,
        error: '获取图片供应商列表失败',
      },
      { status: 500 }
    );
  }
}

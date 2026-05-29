import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  clampImageProviderTimeoutMs,
  DEFAULT_IMAGE_PROVIDER_TIMEOUT_MS,
  listManagedImageProviders,
  saveManagedImageProviders,
} from '@/lib/image-provider-registry';
import { ImageProviderSettingsPayload, ManagedImageProviderConfig } from '@/lib/image-provider-types';

function ensureAdminRole(role: string) {
  if (role !== 'admin' && role !== 'superadmin') {
    throw new Error('FORBIDDEN');
  }
}

function sanitizeProvider(provider: ManagedImageProviderConfig): ManagedImageProviderConfig {
  return {
    ...provider,
    id: provider.id.trim(),
    label: provider.label.trim(),
    model: provider.model.trim() || 'gpt-image-2',
    baseUrl: provider.baseUrl.trim(),
    apiKey: provider.apiKey.trim(),
    timeoutMs: clampImageProviderTimeoutMs(provider.timeoutMs, DEFAULT_IMAGE_PROVIDER_TIMEOUT_MS),
    maxRetries: Number(provider.maxRetries) || 0,
  };
}

function validatePayload(payload: ImageProviderSettingsPayload): ImageProviderSettingsPayload {
  const providers = (payload.providers || [])
    .map(sanitizeProvider)
    .filter((provider) => provider.id && provider.label);

  if (providers.length === 0) {
    throw new Error('至少保留一个供应商配置');
  }

  for (const provider of providers) {
    if (provider.enabled && !provider.baseUrl) {
      throw new Error(`供应商 ${provider.label} 缺少 Base URL`);
    }

    if (provider.enabled && !provider.apiKey) {
      throw new Error(`供应商 ${provider.label} 缺少 API Key`);
    }
  }

  const defaultProviderId =
    payload.defaultProviderId && providers.some((provider) => provider.id === payload.defaultProviderId)
      ? payload.defaultProviderId
      : providers.find((provider) => provider.isDefault)?.id || providers[0].id;

  return {
    defaultProviderId,
    providers: providers.map((provider) => ({
      ...provider,
      isDefault: provider.id === defaultProviderId,
    })),
  };
}

export async function GET() {
  try {
    const currentUser = await requireAuth();
    ensureAdminRole(currentUser.role);

    return NextResponse.json(await listManagedImageProviders());
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (error?.message === 'FORBIDDEN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    console.error('获取供应商管理配置失败:', error);
    return NextResponse.json({ error: '获取供应商管理配置失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await requireAuth();
    ensureAdminRole(currentUser.role);

    const payload = validatePayload(await request.json());
    return NextResponse.json(await saveManagedImageProviders(payload));
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (error?.message === 'FORBIDDEN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    if (typeof error?.message === 'string') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('保存供应商管理配置失败:', error);
    return NextResponse.json({ error: '保存供应商管理配置失败' }, { status: 500 });
  }
}

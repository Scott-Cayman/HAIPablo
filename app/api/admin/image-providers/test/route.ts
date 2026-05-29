import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { clampImageProviderTimeoutMs, DEFAULT_IMAGE_PROVIDER_TIMEOUT_MS } from '@/lib/image-provider-registry';
import { ManagedImageProviderConfig } from '@/lib/image-provider-types';

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
    baseUrl: provider.baseUrl.trim().replace(/\/+$/, ''),
    apiKey: provider.apiKey.trim(),
    timeoutMs: clampImageProviderTimeoutMs(provider.timeoutMs, DEFAULT_IMAGE_PROVIDER_TIMEOUT_MS),
    maxRetries: Number(provider.maxRetries) || 0,
  };
}

async function probeModelsEndpoint(provider: ManagedImageProviderConfig) {
  const response = await fetch(`${provider.baseUrl}/v1/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
    },
  });

  return response;
}

async function probeImagesEndpoint(provider: ManagedImageProviderConfig) {
  const response = await fetch(`${provider.baseUrl}/v1/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    // 故意发送不完整参数，仅用于探测接口是否可达，避免真正出图。
    body: JSON.stringify({
      model: provider.model,
    }),
  });

  return response;
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth();
    ensureAdminRole(currentUser.role);

    const body = await request.json();
    const provider = sanitizeProvider(body.provider as ManagedImageProviderConfig);

    if (!provider.baseUrl) {
      return NextResponse.json({ success: false, message: '请先填写 Base URL' }, { status: 400 });
    }

    if (!provider.apiKey) {
      return NextResponse.json({ success: false, message: '请先填写 API Key' }, { status: 400 });
    }

    try {
      const modelsResponse = await probeModelsEndpoint(provider);
      if (modelsResponse.ok) {
        return NextResponse.json({
          success: true,
          message: '连通成功，模型列表接口可访问',
          details: {
            endpoint: '/v1/models',
            status: modelsResponse.status,
          },
        });
      }

      if (modelsResponse.status === 401 || modelsResponse.status === 403) {
        return NextResponse.json(
          {
            success: false,
            message: '连通失败，API Key 无效或没有权限访问',
            details: {
              endpoint: '/v1/models',
              status: modelsResponse.status,
            },
          },
          { status: 400 }
        );
      }
    } catch {
      // 忽略 models 探测异常，继续走图片接口探测。
    }

    const imagesResponse = await probeImagesEndpoint(provider);
    const responseText = await imagesResponse.text();

    if (imagesResponse.ok) {
      return NextResponse.json({
        success: true,
        message: '连通成功，图片生成接口可访问',
        details: {
          endpoint: '/v1/images/generations',
          status: imagesResponse.status,
        },
      });
    }

    if (imagesResponse.status === 400) {
      return NextResponse.json({
        success: true,
        message: '连通成功，图片接口已响应参数校验错误',
        details: {
          endpoint: '/v1/images/generations',
          status: imagesResponse.status,
          responseSnippet: responseText.slice(0, 300),
        },
      });
    }

    if (imagesResponse.status === 401 || imagesResponse.status === 403) {
      return NextResponse.json(
        {
          success: false,
          message: '连通失败，API Key 无效或权限不足',
          details: {
            endpoint: '/v1/images/generations',
            status: imagesResponse.status,
            responseSnippet: responseText.slice(0, 300),
          },
        },
        { status: 400 }
      );
    }

    if (imagesResponse.status === 404) {
      return NextResponse.json(
        {
          success: false,
          message: '连通失败，目标地址未找到标准图片接口路径',
          details: {
            endpoint: '/v1/images/generations',
            status: imagesResponse.status,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: `接口已响应，但返回异常状态 ${imagesResponse.status}`,
        details: {
          endpoint: '/v1/images/generations',
          status: imagesResponse.status,
          responseSnippet: responseText.slice(0, 300),
        },
      },
      { status: 400 }
    );
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 });
    }

    if (error?.message === 'FORBIDDEN') {
      return NextResponse.json({ success: false, message: '权限不足' }, { status: 403 });
    }

    console.error('测试供应商连通性失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || '测试供应商连通性失败',
      },
      { status: 500 }
    );
  }
}

import { prisma } from '@/lib/prisma';
import {
  ImageProviderKind,
  ImageProviderSettingsPayload,
  ImageProviderSummary,
  ManagedImageProviderConfig,
} from '@/lib/image-provider-types';

export interface ImageProviderConfig extends ManagedImageProviderConfig {}

const IMAGE_PROVIDER_SETTINGS_KEY = 'image_provider_settings';
export const DEFAULT_IMAGE_PROVIDER_TIMEOUT_MS = 150000;

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function normalizeProviderId(id: string): string {
  return id.trim();
}

function normalizeProviderEnvKey(id: string): string {
  return id.trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
}

function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function clampImageProviderTimeoutMs(timeoutMs: number | string | undefined, fallback = DEFAULT_IMAGE_PROVIDER_TIMEOUT_MS): number {
  const maxSafeTimeoutMs = Math.max(1000, parseNumber(process.env.IMAGE_API_MAX_SAFE_TIMEOUT_MS, DEFAULT_IMAGE_PROVIDER_TIMEOUT_MS));
  const normalizedTimeoutMs = typeof timeoutMs === 'number'
    ? timeoutMs
    : parseNumber(timeoutMs, fallback);

  return Math.min(Math.max(normalizedTimeoutMs, 1000), maxSafeTimeoutMs);
}

function parseProviderKind(value: string | undefined): ImageProviderKind {
  return value === 'legacy_jyf' ? 'legacy_jyf' : 'openai_compatible';
}

function getGlobalTimeoutMs(): number {
  return clampImageProviderTimeoutMs(process.env.IMAGE_API_TIMEOUT_MS, DEFAULT_IMAGE_PROVIDER_TIMEOUT_MS);
}

function getGlobalMaxRetries(): number {
  return parseNumber(process.env.IMAGE_API_MAX_RETRIES, 0);
}

function buildProviderFromEnv(id: string, isDefault: boolean): ImageProviderConfig | null {
  const normalizedId = normalizeProviderId(id);
  if (!normalizedId) {
    return null;
  }

  const envKey = normalizeProviderEnvKey(normalizedId);
  const enabled = parseBoolean(process.env[`IMAGE_PROVIDER_${envKey}_ENABLED`], true);

  const kind = parseProviderKind(process.env[`IMAGE_PROVIDER_${envKey}_KIND`]);
  const fallbackToLegacyEnv = normalizedId === 'default';
  const baseUrl =
    process.env[`IMAGE_PROVIDER_${envKey}_BASE_URL`] ||
    (fallbackToLegacyEnv ? process.env.GPT_IMAGE_API_BASE_URL : '') ||
    '';
  const apiKey =
    process.env[`IMAGE_PROVIDER_${envKey}_API_KEY`] ||
    (fallbackToLegacyEnv ? process.env.GPT_IMAGE_API_KEY : '') ||
    '';

  const model =
    process.env[`IMAGE_PROVIDER_${envKey}_MODEL`] ||
    (kind === 'legacy_jyf' ? 'gpt-image-2' : 'gpt-image-2');
  const supportsEdit = parseBoolean(process.env[`IMAGE_PROVIDER_${envKey}_SUPPORTS_EDIT`], true);

  return {
    id: normalizedId,
    label: process.env[`IMAGE_PROVIDER_${envKey}_LABEL`] || normalizedId,
    kind,
    model,
    isDefault,
    supportsEdit,
    enabled,
    baseUrl: baseUrl.trim().replace(/\/+$/, ''),
    apiKey: apiKey.trim(),
    timeoutMs: clampImageProviderTimeoutMs(process.env[`IMAGE_PROVIDER_${envKey}_TIMEOUT_MS`], getGlobalTimeoutMs()),
    maxRetries: parseNumber(process.env[`IMAGE_PROVIDER_${envKey}_MAX_RETRIES`], getGlobalMaxRetries()),
  };
}

function buildLegacyFallbackProvider(): ImageProviderConfig | null {
  const baseUrl = process.env.GPT_IMAGE_API_BASE_URL?.trim();
  const apiKey = process.env.GPT_IMAGE_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    return null;
  }

  return {
    id: 'legacy',
    label: '当前默认通道',
    kind: 'legacy_jyf',
    model: process.env.GPT_IMAGE_MODEL?.trim() || 'gpt-image-2',
    isDefault: true,
    supportsEdit: true,
    enabled: true,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    timeoutMs: getGlobalTimeoutMs(),
    maxRetries: getGlobalMaxRetries(),
  };
}

function getEnvImageProviderConfigs(): ImageProviderConfig[] {
  const configuredIds = (process.env.IMAGE_PROVIDER_IDS || '')
    .split(',')
    .map((item) => normalizeProviderId(item))
    .filter(Boolean);

  if (configuredIds.length === 0) {
    const fallback = buildLegacyFallbackProvider();
    return fallback ? [fallback] : [];
  }

  const defaultProviderId = normalizeProviderId(process.env.IMAGE_DEFAULT_PROVIDER || configuredIds[0]);
  const providers = configuredIds
    .map((id) => buildProviderFromEnv(id, id === defaultProviderId))
    .filter((provider): provider is ImageProviderConfig => !!provider);

  if (providers.length === 0) {
    const fallback = buildLegacyFallbackProvider();
    return fallback ? [fallback] : [];
  }

  if (!providers.some((provider) => provider.isDefault)) {
    providers[0] = {
      ...providers[0],
      isDefault: true,
    };
  }

  return providers;
}

function normalizeManagedProvider(provider: ManagedImageProviderConfig, isDefault: boolean): ImageProviderConfig {
  return {
    ...provider,
    id: normalizeProviderId(provider.id),
    label: provider.label?.trim() || normalizeProviderId(provider.id),
    kind: provider.kind === 'legacy_jyf' ? 'legacy_jyf' : 'openai_compatible',
    model: provider.model?.trim() || 'gpt-image-2',
    isDefault,
    supportsEdit: Boolean(provider.supportsEdit),
    enabled: Boolean(provider.enabled),
    baseUrl: provider.baseUrl?.trim().replace(/\/+$/, '') || '',
    apiKey: provider.apiKey?.trim() || '',
    timeoutMs: clampImageProviderTimeoutMs(String(provider.timeoutMs ?? ''), getGlobalTimeoutMs()),
    maxRetries: parseNumber(String(provider.maxRetries ?? ''), getGlobalMaxRetries()),
  };
}

async function getStoredProviderSettings(): Promise<ImageProviderSettingsPayload | null> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: IMAGE_PROVIDER_SETTINGS_KEY },
  });

  if (!setting?.value) {
    return null;
  }

  try {
    const parsed = JSON.parse(setting.value) as ImageProviderSettingsPayload;
    return {
      defaultProviderId: parsed.defaultProviderId || null,
      providers: Array.isArray(parsed.providers) ? parsed.providers : [],
    };
  } catch (error) {
    console.error('解析图片供应商配置失败:', error);
    return null;
  }
}

function mergeProviderConfigs(
  envProviders: ImageProviderConfig[],
  storedSettings: ImageProviderSettingsPayload | null
): ImageProviderConfig[] {
  const envMap = new Map(envProviders.map((provider) => [provider.id, provider]));
  const merged = new Map<string, ImageProviderConfig>();

  for (const provider of envProviders) {
    merged.set(provider.id, { ...provider, isDefault: false });
  }

  const storedProviders = storedSettings?.providers || [];
  for (const storedProvider of storedProviders) {
    const normalizedId = normalizeProviderId(storedProvider.id || '');
    if (!normalizedId) {
      continue;
    }

    const base = envMap.get(normalizedId);
    const mergedProvider = normalizeManagedProvider(
      {
        ...(base || {
          id: normalizedId,
          label: normalizedId,
          kind: 'openai_compatible',
          model: 'gpt-image-2',
          supportsEdit: true,
          enabled: true,
          baseUrl: '',
          apiKey: '',
          timeoutMs: getGlobalTimeoutMs(),
          maxRetries: getGlobalMaxRetries(),
          isDefault: false,
        }),
        ...storedProvider,
        id: normalizedId,
      },
      false
    );

    merged.set(normalizedId, mergedProvider);
  }

  const mergedProviders = Array.from(merged.values());
  const defaultProviderId = normalizeProviderId(
    storedSettings?.defaultProviderId || envProviders.find((provider) => provider.isDefault)?.id || mergedProviders[0]?.id || ''
  );

  if (defaultProviderId) {
    const target = mergedProviders.find((provider) => provider.id === defaultProviderId);
    if (target) {
      target.isDefault = true;
    }
  }

  if (!mergedProviders.some((provider) => provider.isDefault) && mergedProviders[0]) {
    mergedProviders[0].isDefault = true;
  }

  return mergedProviders;
}

function isProviderConfigured(provider: ImageProviderConfig): boolean {
  return Boolean(provider.baseUrl?.trim() && provider.apiKey?.trim());
}

export async function getImageProviderConfigs(): Promise<ImageProviderConfig[]> {
  const envProviders = getEnvImageProviderConfigs();
  const storedSettings = await getStoredProviderSettings();
  return mergeProviderConfigs(envProviders, storedSettings);
}

export async function listImageProviders(): Promise<ImageProviderSummary[]> {
  const providers = await getImageProviderConfigs();
  return providers
    .filter((provider) => provider.enabled && isProviderConfigured(provider))
    .map(({ apiKey: _apiKey, baseUrl: _baseUrl, timeoutMs: _timeoutMs, maxRetries: _maxRetries, enabled: _enabled, ...provider }) => provider);
}

export async function listManagedImageProviders(): Promise<ImageProviderSettingsPayload> {
  const providers = await getImageProviderConfigs();
  return {
    defaultProviderId: providers.find((provider) => provider.isDefault)?.id || null,
    providers,
  };
}

export async function saveManagedImageProviders(payload: ImageProviderSettingsPayload): Promise<ImageProviderSettingsPayload> {
  const cleanedProviders = payload.providers
    .map((provider) => normalizeManagedProvider(provider, false))
    .filter((provider) => provider.id && provider.label);

  const defaultProviderId = normalizeProviderId(
    payload.defaultProviderId || cleanedProviders.find((provider) => provider.isDefault)?.id || cleanedProviders[0]?.id || ''
  );

  const normalizedProviders = cleanedProviders.map((provider) => ({
    ...provider,
    isDefault: provider.id === defaultProviderId,
  }));

  await prisma.systemSetting.upsert({
    where: { key: IMAGE_PROVIDER_SETTINGS_KEY },
    update: {
      value: JSON.stringify({
        defaultProviderId: defaultProviderId || null,
        providers: normalizedProviders,
      }),
    },
    create: {
      key: IMAGE_PROVIDER_SETTINGS_KEY,
      value: JSON.stringify({
        defaultProviderId: defaultProviderId || null,
        providers: normalizedProviders,
      }),
    },
  });

  return {
    defaultProviderId: defaultProviderId || null,
    providers: normalizedProviders,
  };
}

export async function resolveImageProvider(providerId?: string | null): Promise<ImageProviderConfig> {
  const providers = (await getImageProviderConfigs()).filter((provider) => provider.enabled && isProviderConfigured(provider));
  if (providers.length === 0) {
    throw new Error('未配置可用的图片供应商，请检查环境变量');
  }

  if (providerId) {
    const matched = providers.find((provider) => provider.id === providerId);
    if (!matched) {
      throw new Error(`未找到供应商：${providerId}`);
    }
    return matched;
  }

  return providers.find((provider) => provider.isDefault) || providers[0];
}

export async function getImageProviderFailoverChain(providerId?: string | null): Promise<ImageProviderConfig[]> {
  const providers = (await getImageProviderConfigs()).filter((provider) => provider.enabled && isProviderConfigured(provider));
  if (providers.length === 0) {
    throw new Error('未配置可用的图片供应商，请检查环境变量');
  }

  if (!providerId) {
    const primary = providers.find((provider) => provider.isDefault) || providers[0];
    return [primary, ...providers.filter((provider) => provider.id !== primary.id)];
  }

  const selected = providers.find((provider) => provider.id === providerId);
  if (!selected) {
    throw new Error(`未找到供应商：${providerId}`);
  }

  return [selected, ...providers.filter((provider) => provider.id !== selected.id)];
}

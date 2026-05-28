import fs from 'node:fs/promises';
import path from 'node:path';
import OSS from 'ali-oss';

type UploadBufferInput = {
  key: string;
  buffer: Buffer | Uint8Array;
  contentType?: string;
};

type StoredFile = {
  key: string;
  url: string;
};

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

function stripQuotes(value: string): string {
  return value.trim().replace(/^["'`]/, '').replace(/["'`]$/, '');
}

function normalizePathSegment(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function ensureStorageKey(key: string): string {
  const normalized = normalizePathSegment(key);
  if (!normalized) {
    throw new Error('存储 key 不能为空');
  }

  return normalized;
}

function getAppOrigin(): string | null {
  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) return null;

  return stripQuotes(appUrl).replace(/\/+$/, '');
}

function getConfiguredBasePath(): string {
  return normalizePathSegment(process.env.OSS_BASE_PATH || '');
}

function applyBasePath(key: string): string {
  const basePath = getConfiguredBasePath();
  if (!basePath) {
    return ensureStorageKey(key);
  }

  return ensureStorageKey(`${basePath}/${key}`);
}

export function isOssEnabled(): boolean {
  return parseBoolean(process.env.OSS_ENABLED) || process.env.STORAGE_DRIVER === 'oss';
}

export function getLocalStorageRoot(): string {
  const configuredRoot = process.env.LOCAL_STORAGE_ROOT || './storage';
  return path.resolve(process.cwd(), stripQuotes(configuredRoot));
}

function getLegacyPublicStorageRoot(): string {
  return path.join(process.cwd(), 'public', 'storage');
}

export function getStorageUrl(key: string): string {
  const normalizedKey = ensureStorageKey(key);

  if (isOssEnabled()) {
    return getOssPublicUrl(normalizedKey);
  }

  return `/storage/${normalizedKey}`;
}

function getOssEndpointHost(): string {
  const endpoint = process.env.OSS_ENDPOINT?.trim();
  if (!endpoint) {
    throw new Error('缺少 OSS_ENDPOINT 环境变量');
  }

  return stripQuotes(endpoint).replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function getOssRegion(): string {
  const endpointHost = getOssEndpointHost();
  const region = endpointHost.split('.')[0];
  if (!region) {
    throw new Error('无法从 OSS_ENDPOINT 推断 region');
  }

  return region;
}

function getOssPublicBaseUrl(): string {
  const publicDomain = process.env.OSS_PUBLIC_DOMAIN?.trim();
  if (publicDomain) {
    const normalizedDomain = stripQuotes(publicDomain).replace(/\/+$/, '');
    if (/^https?:\/\//i.test(normalizedDomain)) {
      return normalizedDomain;
    }
    return `https://${normalizedDomain}`;
  }

  const bucket = process.env.OSS_BUCKET?.trim();
  if (!bucket) {
    throw new Error('缺少 OSS_BUCKET 环境变量');
  }

  return `https://${stripQuotes(bucket)}.${getOssEndpointHost()}`;
}

function getOssPublicUrl(key: string): string {
  return `${getOssPublicBaseUrl()}/${applyBasePath(key)}`;
}

let ossClient: OSS | null = null;

function getOssClient(): OSS {
  if (ossClient) {
    return ossClient;
  }

  const accessKeyId = process.env.OSS_ACCESS_KEY_ID?.trim();
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET?.trim();
  const bucket = process.env.OSS_BUCKET?.trim();

  if (!accessKeyId || !accessKeySecret || !bucket) {
    throw new Error('OSS 已启用，但 AccessKey 或 Bucket 配置不完整');
  }

  ossClient = new OSS({
    region: getOssRegion(),
    accessKeyId: stripQuotes(accessKeyId),
    accessKeySecret: stripQuotes(accessKeySecret),
    bucket: stripQuotes(bucket),
  });

  return ossClient;
}

export async function uploadBuffer(input: UploadBufferInput): Promise<StoredFile> {
  const normalizedKey = ensureStorageKey(input.key);

  if (isOssEnabled()) {
    const objectKey = applyBasePath(normalizedKey);
    await getOssClient().put(objectKey, Buffer.from(input.buffer), {
      headers: input.contentType
        ? {
            'Content-Type': input.contentType,
          }
        : undefined,
    });

    return {
      key: normalizedKey,
      url: getOssPublicUrl(normalizedKey),
    };
  }

  const filePath = path.join(getLocalStorageRoot(), normalizedKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, Buffer.from(input.buffer));

  return {
    key: normalizedKey,
    url: getStorageUrl(normalizedKey),
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveLocalStoragePathByKey(key: string): Promise<string | null> {
  const normalizedKey = ensureStorageKey(key);
  const primaryPath = path.join(getLocalStorageRoot(), normalizedKey);
  if (await pathExists(primaryPath)) {
    return primaryPath;
  }

  const legacyPath = path.join(getLegacyPublicStorageRoot(), normalizedKey);
  if (await pathExists(legacyPath)) {
    return legacyPath;
  }

  return null;
}

export async function readLocalStorageFileByKey(key: string): Promise<Buffer> {
  const resolvedPath = await resolveLocalStoragePathByKey(key);
  if (!resolvedPath) {
    throw new Error(`未找到存储文件: ${key}`);
  }

  return fs.readFile(resolvedPath);
}

export function tryExtractStorageKeyFromUrl(url: string): string | null {
  if (!url) return null;

  if (url.startsWith('/storage/')) {
    return ensureStorageKey(url.slice('/storage/'.length));
  }

  const appOrigin = getAppOrigin();
  if (appOrigin && url.startsWith(`${appOrigin}/storage/`)) {
    return ensureStorageKey(url.slice(`${appOrigin}/storage/`.length));
  }

  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith('/storage/')) {
      return ensureStorageKey(parsed.pathname.slice('/storage/'.length));
    }
  } catch {
    return null;
  }

  return null;
}

export async function readLocalStorageFileByUrl(url: string): Promise<Buffer> {
  const key = tryExtractStorageKeyFromUrl(url);
  if (!key) {
    throw new Error(`不是本地存储 URL: ${url}`);
  }

  return readLocalStorageFileByKey(key);
}

export function getContentTypeFromFilename(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.zip':
      return 'application/zip';
    default:
      return 'application/octet-stream';
  }
}

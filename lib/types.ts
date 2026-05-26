export interface InputSlot {
  key: string;
  label: string;
  required: boolean;
  assetTypes: string[];
  maxCount: number;
  description?: string;
  example?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  key: string;
  description: string;
  mode: 'generation' | 'edit';
  
  promptTemplate: string;
  negativePrompt?: string;
  
  defaultSize: string;
  defaultQuality: 'low' | 'medium' | 'high' | 'auto';
  
  inputSlots: InputSlot[];
  
  referenceImageUrl?: string;
  referenceImageDescription?: string;
  
  enabled: boolean;
  sortOrder: number;
  
  createdAt: string;
  updatedAt: string;
}

export interface Variable {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number';
  required?: boolean;
  defaultValue?: string;
  options?: string[];
  placeholder?: string;
}

export interface FeatureGroup {
  id: string;
  name: string;
  key: string;
  description: string;
  icon: string;
  sortOrder: number;
  enabled: boolean;
  templates: PromptTemplate[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  clientName?: string;
  eventName?: string;
  city?: string;
  brandName?: string;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  projectId?: string;
  name: string;
  type: 'main_kv' | 'logo' | 'product' | 'mockup' | 'reference' | 'background' | 'person' | 'other';
  fileUrl: string;
  thumbnailUrl?: string;
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes: number;
  createdAt: string;
}

export interface GenerationJob {
  id: string;
  projectId?: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'partial_failed' | 'failed';
  totalCount: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationResult {
  success: boolean;
  imageUrl?: string;
  revisedPrompt?: string;
  error?: string;
  message?: string;
}

export const ASSET_TYPE_LABELS: Record<string, string> = {
  main_kv: '主视觉KV',
  logo: '品牌Logo',
  product: '产品图',
  mockup: '样机图',
  reference: '参考风格图',
  background: '背景图',
  person: '人物图',
  other: '其他'
};

export const SIZE_OPTIONS = [
  { value: 'auto', label: '自动' },
  { value: '2048x2048', label: '1:1 经典方形 (2048×2048)' },
  { value: '2304x3072', label: '3:4 竖构图 (2304×3072)' },
  { value: '3072x2304', label: '4:3 横构图 (3072×2304)' },
  { value: '3840x2160', label: '16:9 宽屏标准 (3840×2160)' },
  { value: '2160x3840', label: '9:16 竖屏海报 (2160×3840)' },
  { value: '3584x1536', label: '21:9 电影宽幕 (3584×1536)' },
  { value: '3840x1280', label: '3:1 横幅全景 (3840×1280)' },
];

export const QUALITY_OPTIONS = [
  { value: 'low', label: '速度优先', description: '快速预览，低成本' },
  { value: 'medium', label: '均衡模式', description: '默认选项，适合大多数场景' },
  { value: 'high', label: '质量优先', description: '最终出图，高细节' },
  { value: 'auto', label: '自动', description: '模型自动判断' },
];

export function renderPrompt(
  template: string,
  variables: Record<string, string>,
  inputAssets?: Array<{key: string; label: string; fileUrl: string}>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'string') {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
  }
  
  if (inputAssets && inputAssets.length > 0) {
    result += '\n\n参考图片信息：\n';
    inputAssets.forEach((asset, index) => {
      result += `参考图${index + 1}（${asset.label}）：${asset.fileUrl}\n`;
    });
  }
  
  return result;
}

export function validateSize(size: string): { valid: boolean; message?: string } {
  if (size === 'auto') return { valid: true };

  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) {
    return { valid: false, message: '尺寸格式必须为 widthxheight，例如 1536x1024' };
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (width <= 0 || height <= 0) {
    return { valid: false, message: '宽高必须大于 0' };
  }

  if (width > 3840 || height > 3840) {
    return { valid: false, message: '最大边长不能超过 3840px' };
  }

  if (width % 16 !== 0 || height % 16 !== 0) {
    return { valid: false, message: '宽和高都必须是 16 的倍数' };
  }

  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);

  if (longEdge / shortEdge > 3) {
    return { valid: false, message: '长边与短边比例不能超过 3:1' };
  }

  const pixels = width * height;

  if (pixels < 655_360) {
    return { valid: false, message: '总像素数不能低于 655,360' };
  }

  if (pixels > 8_294_400) {
    return { valid: false, message: '总像素数不能超过 8,294,400' };
  }

  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return '刚刚';
}

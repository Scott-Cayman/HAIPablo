export interface Variable {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number';
  required?: boolean;
  defaultValue?: string;
  options?: string[];
  placeholder?: string;
}

export interface InputSlot {
  key: string;
  label: string;
  required: boolean;
  assetTypes: string[];
  maxCount: number;
  description?: string;
}

export function renderPrompt(
  template: string, 
  variables: Record<string, string>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'string') {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
  }
  
  return result;
}

export function extractVariables(promptTemplate: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const matches = promptTemplate.match(regex) || [];
  return matches.map(match => match.replace(/\{\{|\}\}/g, ''));
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

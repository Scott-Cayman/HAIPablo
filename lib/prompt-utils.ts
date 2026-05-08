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
  { value: '1024x1024', label: '1:1 (1024×1024)' },
  { value: '1536x1024', label: '3:2 横版 (1536×1024)' },
  { value: '1024x1536', label: '2:3 竖版 (1024×1536)' },
  { value: '2048x2048', label: '1:1 高清 (2048×2048)' },
  { value: '2048x1152', label: '16:9 宽屏 (2048×1152)' },
  { value: '1920x1080', label: '16:9 全高清 (1920×1080)' },
];

export const QUALITY_OPTIONS = [
  { value: 'low', label: '速度优先', description: '快速预览，低成本' },
  { value: 'medium', label: '均衡模式', description: '默认选项，适合大多数场景' },
  { value: 'high', label: '质量优先', description: '最终出图，高细节' },
  { value: 'auto', label: '自动', description: '模型自动判断' },
];

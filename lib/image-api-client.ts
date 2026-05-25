import fs from 'node:fs';
import path from 'node:path';

export type ImageQuality = 'low' | 'medium' | 'high' | 'auto';

export interface GenerateImageInput {
  prompt: string;
  size?: string;
  quality?: ImageQuality;
  response_format?: 'b64_json' | 'url';
  image?: string[];
}

export interface EditImageInput {
  prompt: string;
  size?: string;
  quality?: ImageQuality;
  response_format?: 'b64_json' | 'url';
  imagePaths: string[];
}

export interface ImageGenerationResponse {
  created: number;
  data: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
}

export class ImageApiClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor() {
    this.baseUrl = process.env.GPT_IMAGE_API_BASE_URL || 'https://api.jyf.ai';
    this.apiKey = process.env.GPT_IMAGE_API_KEY || '';
    this.timeoutMs = Number(process.env.IMAGE_API_TIMEOUT_MS || 180000);
    this.maxRetries = Number(process.env.IMAGE_API_MAX_RETRIES || 1);

    if (!this.apiKey) {
      throw new Error('缺少 GPT_IMAGE_API_KEY 环境变量');
    }
  }

  private isRetryableStatus(status: number): boolean {
    return [408, 429, 500, 502, 503, 504, 522, 524].includes(status);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async createEditForm(input: EditImageInput): Promise<FormData> {
    const form = new FormData();
    form.append('model', 'gpt-image-2');
    form.append('prompt', input.prompt);
    form.append('size', input.size || 'auto');
    form.append('quality', input.quality || 'medium');
    form.append('response_format', input.response_format || 'b64_json');

    for (const imagePath of input.imagePaths) {
      const buffer = await fs.promises.readFile(imagePath);
      const file = new Blob([buffer]);
      form.append('image', file, path.basename(imagePath));
    }

    return form;
  }

  async generate(input: GenerateImageInput): Promise<ImageGenerationResponse> {
    const requestBody: any = {
      model: 'gpt-image-2',
      prompt: input.prompt,
      size: input.size || 'auto',
      quality: input.quality || 'medium',
      response_format: input.response_format || 'b64_json',
    };

    if (input.image && input.image.length > 0) {
      requestBody.image = input.image;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(`${this.baseUrl}/v1/images/generations`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        if (!res.ok) {
          const text = await res.text();
          const error = new Error(`图片生成失败: ${res.status} ${text}`);

          if (attempt < this.maxRetries && this.isRetryableStatus(res.status)) {
            lastError = error;
            await this.delay(1000 * (attempt + 1));
            continue;
          }

          throw error;
        }

        return res.json();
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          lastError = new Error(`图片生成超时，${this.timeoutMs / 1000} 秒内未收到响应`);
        } else {
          lastError = error instanceof Error ? error : new Error(String(error));
        }

        if (attempt < this.maxRetries) {
          await this.delay(1000 * (attempt + 1));
          continue;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError || new Error('图片生成失败');
  }

  async edit(input: EditImageInput): Promise<ImageGenerationResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const form = await this.createEditForm(input);
        const res = await fetch(`${this.baseUrl}/v1/images/edits`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`
          },
          body: form,
          signal: controller.signal
        });

        if (!res.ok) {
          const text = await res.text();
          const error = new Error(`图片编辑失败: ${res.status} ${text}`);

          if (attempt < this.maxRetries && this.isRetryableStatus(res.status)) {
            lastError = error;
            await this.delay(1000 * (attempt + 1));
            continue;
          }

          throw error;
        }

        return res.json();
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          lastError = new Error(`图片编辑超时，${this.timeoutMs / 1000} 秒内未收到响应`);
        } else {
          lastError = error instanceof Error ? error : new Error(String(error));
        }

        if (attempt < this.maxRetries) {
          await this.delay(1000 * (attempt + 1));
          continue;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError || new Error('图片编辑失败');
  }
}

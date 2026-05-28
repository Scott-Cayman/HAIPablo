import fs from 'node:fs';
import path from 'node:path';
import { ImageProviderConfig } from '@/lib/image-provider-registry';

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
  constructor(private provider: ImageProviderConfig) {
    if (!this.provider.apiKey) {
      throw new Error(`图片供应商 ${this.provider.id} 缺少 API Key`);
    }
  }

  private isRetryableStatus(status: number): boolean {
    return [408, 429, 500, 502, 503, 504, 522, 524].includes(status);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isEditToolChoiceCompatibilityError(message: string): boolean {
    return message.includes("Tool choice 'image_generation' not found in 'tools' parameter");
  }

  private getMimeTypeForPath(filePath: string): string | undefined {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      default:
        return undefined;
    }
  }

  private async createEditForm(input: EditImageInput): Promise<FormData> {
    const form = new FormData();
    form.append('model', this.provider.model);
    form.append('prompt', input.prompt);
    form.append('size', input.size || 'auto');
    form.append('quality', input.quality || 'medium');
    form.append('response_format', input.response_format || 'b64_json');

    for (const imagePath of input.imagePaths) {
      const buffer = await fs.promises.readFile(imagePath);
      const mimeType = this.getMimeTypeForPath(imagePath);
      const file = mimeType
        ? new Blob([buffer], { type: mimeType })
        : new Blob([buffer]);
      form.append('image', file, path.basename(imagePath));
    }

    return form;
  }

  private createGenerateRequestBody(input: GenerateImageInput): Record<string, any> {
    const requestBody: Record<string, any> = {
      model: this.provider.model,
      prompt: input.prompt,
      size: input.size || 'auto',
      quality: input.quality || 'medium',
      response_format: input.response_format || 'b64_json',
    };

    if (input.image && input.image.length > 0) {
      requestBody.image = input.image;
    }

    return requestBody;
  }

  private async performJsonRequest(
    pathName: string,
    buildInit: () => Promise<RequestInit>,
    actionLabel: string,
    onCompatibilityError?: (status: number, message: string) => Promise<ImageGenerationResponse | null>
  ): Promise<ImageGenerationResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.provider.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.provider.timeoutMs);

      try {
        const requestInit = await buildInit();
        const res = await fetch(`${this.provider.baseUrl}${pathName}`, {
          ...requestInit,
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text();
          if (onCompatibilityError) {
            const compatibilityResponse = await onCompatibilityError(res.status, text);
            if (compatibilityResponse) {
              return compatibilityResponse;
            }
          }

          const error = new Error(`${actionLabel}: ${res.status} ${text}`);

          if (attempt < this.provider.maxRetries && this.isRetryableStatus(res.status)) {
            lastError = error;
            await this.delay(1000 * (attempt + 1));
            continue;
          }

          throw error;
        }

        return res.json();
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          lastError = new Error(
            `${actionLabel}超时，${this.provider.timeoutMs / 1000} 秒内未收到响应`
          );
        } else {
          lastError = error instanceof Error ? error : new Error(String(error));
        }

        if (attempt < this.provider.maxRetries) {
          await this.delay(1000 * (attempt + 1));
          continue;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError || new Error(actionLabel);
  }

  async generate(input: GenerateImageInput): Promise<ImageGenerationResponse> {
    const requestBody = this.createGenerateRequestBody(input);

    return this.performJsonRequest(
      '/v1/images/generations',
      async () => ({
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }),
      '图片生成失败'
    );
  }

  async edit(input: EditImageInput): Promise<ImageGenerationResponse> {
    if (!this.provider.supportsEdit) {
      throw new Error(`供应商 ${this.provider.label} 当前未开启编辑接口`);
    }

    return this.performJsonRequest(
      '/v1/images/edits',
      async () => {
        const form = await this.createEditForm(input);
        return {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.provider.apiKey}`,
          },
          body: form,
        };
      },
      '图片编辑失败',
      async (status, message) => {
        if (
          this.provider.kind === 'legacy_jyf' &&
          status === 400 &&
          this.isEditToolChoiceCompatibilityError(message)
        ) {
          console.warn('图片编辑接口与当前上游实现不兼容，降级为生成接口重试');
          return this.generate({
            prompt: input.prompt,
            size: input.size,
            quality: input.quality,
            response_format: input.response_format,
          });
        }

        return null;
      }
    );
  }
}

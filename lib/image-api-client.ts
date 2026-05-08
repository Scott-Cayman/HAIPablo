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

  constructor() {
    this.baseUrl = process.env.GPT_IMAGE_API_BASE_URL || 'https://api.jyf.ai';
    this.apiKey = process.env.GPT_IMAGE_API_KEY || '';

    if (!this.apiKey) {
      throw new Error('缺少 GPT_IMAGE_API_KEY 环境变量');
    }
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

    const res = await fetch(`${this.baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`图片生成失败: ${res.status} ${text}`);
    }

    return res.json();
  }

  async edit(input: EditImageInput): Promise<ImageGenerationResponse> {
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

    const res = await fetch(`${this.baseUrl}/v1/images/edits`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`
      },
      body: form
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`图片编辑失败: ${res.status} ${text}`);
    }

    return res.json();
  }
}

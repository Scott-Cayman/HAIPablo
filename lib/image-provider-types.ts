export type ImageProviderKind = 'legacy_jyf' | 'openai_compatible';

export interface ImageProviderSummary {
  id: string;
  label: string;
  kind: ImageProviderKind;
  model: string;
  isDefault: boolean;
  supportsEdit: boolean;
}

export interface ManagedImageProviderConfig extends ImageProviderSummary {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxRetries: number;
}

export interface ImageProviderSettingsPayload {
  defaultProviderId: string | null;
  providers: ManagedImageProviderConfig[];
}

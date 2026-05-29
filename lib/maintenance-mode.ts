import { prisma } from '@/lib/prisma';
import {
  DEFAULT_MAINTENANCE_MODE_SETTINGS,
  MaintenanceModeSettings,
} from '@/lib/maintenance-mode-types';

export const MAINTENANCE_MODE_SETTINGS_KEY = 'maintenance_mode_settings';

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeMaintenanceModeSettings(
  value: Partial<MaintenanceModeSettings> | null | undefined
): MaintenanceModeSettings {
  return {
    enabled: Boolean(value?.enabled),
    title: normalizeText(value?.title, DEFAULT_MAINTENANCE_MODE_SETTINGS.title),
    message: normalizeText(value?.message, DEFAULT_MAINTENANCE_MODE_SETTINGS.message),
    allowAdminBypass:
      typeof value?.allowAdminBypass === 'boolean'
        ? value.allowAdminBypass
        : DEFAULT_MAINTENANCE_MODE_SETTINGS.allowAdminBypass,
    updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : null,
    updatedByName: typeof value?.updatedByName === 'string' ? value.updatedByName : null,
  };
}

export async function getMaintenanceModeSettings(): Promise<MaintenanceModeSettings> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: MAINTENANCE_MODE_SETTINGS_KEY },
  });

  if (!setting?.value) {
    return DEFAULT_MAINTENANCE_MODE_SETTINGS;
  }

  try {
    const parsed = JSON.parse(setting.value) as Partial<MaintenanceModeSettings>;
    return normalizeMaintenanceModeSettings(parsed);
  } catch (error) {
    console.error('解析维护模式配置失败:', error);
    return DEFAULT_MAINTENANCE_MODE_SETTINGS;
  }
}

export async function saveMaintenanceModeSettings(
  payload: Partial<MaintenanceModeSettings>,
  options?: { updatedByName?: string | null }
): Promise<MaintenanceModeSettings> {
  const settings = normalizeMaintenanceModeSettings({
    ...payload,
    updatedAt: new Date().toISOString(),
    updatedByName: options?.updatedByName || payload.updatedByName || null,
  });

  await prisma.systemSetting.upsert({
    where: { key: MAINTENANCE_MODE_SETTINGS_KEY },
    update: {
      value: JSON.stringify(settings),
    },
    create: {
      key: MAINTENANCE_MODE_SETTINGS_KEY,
      value: JSON.stringify(settings),
    },
  });

  return settings;
}

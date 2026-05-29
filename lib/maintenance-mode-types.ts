export interface MaintenanceModeSettings {
  enabled: boolean;
  title: string;
  message: string;
  allowAdminBypass: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
}

export const DEFAULT_MAINTENANCE_MODE_SETTINGS: MaintenanceModeSettings = {
  enabled: false,
  title: '系统维护中',
  message: '我们正在进行系统升级与稳定性维护，请稍后再试。',
  allowAdminBypass: true,
  updatedAt: null,
  updatedByName: null,
};

export const ADMIN_COLOR_THEME_STORAGE_KEY = 'adminColorTheme';

export const ADMIN_COLOR_THEMES = [
  {
    value: 'forest-amber',
    label: '森夜琥珀',
    description: '暖金高光配合深林夜色，适合现在这套页面。',
    swatches: ['#f4ede0', '#f59e0b', '#2dd4bf', '#121712']
  },
  {
    value: 'midnight-blue',
    label: '深海蓝灰',
    description: '偏冷静的深蓝灰色调，层次更锐利。',
    swatches: ['#dbeafe', '#60a5fa', '#818cf8', '#0b1120']
  },
  {
    value: 'plum-rose',
    label: '梅子玫瑰',
    description: '偏酒红与雾粉的夜色，氛围更柔和。',
    swatches: ['#f5e9ea', '#fb7185', '#c084fc', '#1b1419']
  }
] as const;

export type AdminColorTheme = (typeof ADMIN_COLOR_THEMES)[number]['value'];

export const DEFAULT_ADMIN_COLOR_THEME: AdminColorTheme = 'forest-amber';

export function isAdminColorTheme(value: string | null | undefined): value is AdminColorTheme {
  return ADMIN_COLOR_THEMES.some((theme) => theme.value === value);
}

export function getStoredAdminColorTheme(): AdminColorTheme {
  if (typeof window === 'undefined') {
    return DEFAULT_ADMIN_COLOR_THEME;
  }

  const stored = window.localStorage.getItem(ADMIN_COLOR_THEME_STORAGE_KEY);
  return isAdminColorTheme(stored) ? stored : DEFAULT_ADMIN_COLOR_THEME;
}

export function applyAdminColorTheme(theme: AdminColorTheme) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.setAttribute('data-admin-theme', theme);
}

export function persistAdminColorTheme(theme: AdminColorTheme) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ADMIN_COLOR_THEME_STORAGE_KEY, theme);
}

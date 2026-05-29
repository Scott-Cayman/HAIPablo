import type { Metadata } from "next";
import { headers } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import { getMaintenanceModeSettings } from '@/lib/maintenance-mode';
import { MaintenanceScreen } from '@/components/MaintenanceScreen';
import "./globals.css";

export const metadata: Metadata = {
  title: "HAI Pablo 工作台 | AI创意工作台",
  description: "HIMICE·AI 智海王潮 HAI",
};

const MAINTENANCE_ALLOWLIST_PREFIXES = ['/auth', '/admin'];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [headerStore, currentUser, maintenanceSettings] = await Promise.all([
    Promise.resolve(headers()),
    getCurrentUser(),
    getMaintenanceModeSettings(),
  ]);
  const pathname = headerStore.get('x-pathname') || '/';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isAllowlistedPath = MAINTENANCE_ALLOWLIST_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const shouldShowMaintenance =
    maintenanceSettings.enabled &&
    !isAllowlistedPath &&
    !(maintenanceSettings.allowAdminBypass && isAdmin);

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        {shouldShowMaintenance ? <MaintenanceScreen settings={maintenanceSettings} /> : children}
      </body>
    </html>
  );
}

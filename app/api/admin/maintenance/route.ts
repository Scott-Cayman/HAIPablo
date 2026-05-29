import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getMaintenanceModeSettings,
  saveMaintenanceModeSettings,
} from '@/lib/maintenance-mode';
import { MaintenanceModeSettings } from '@/lib/maintenance-mode-types';

function ensureAdminRole(role: string) {
  if (role !== 'admin' && role !== 'superadmin') {
    throw new Error('FORBIDDEN');
  }
}

function sanitizePayload(payload: Partial<MaintenanceModeSettings>): Partial<MaintenanceModeSettings> {
  return {
    enabled: Boolean(payload.enabled),
    title: typeof payload.title === 'string' ? payload.title.trim().slice(0, 80) : undefined,
    message: typeof payload.message === 'string' ? payload.message.trim().slice(0, 500) : undefined,
    allowAdminBypass:
      typeof payload.allowAdminBypass === 'boolean' ? payload.allowAdminBypass : undefined,
  };
}

export async function GET() {
  try {
    const currentUser = await requireAuth();
    ensureAdminRole(currentUser.role);

    return NextResponse.json(await getMaintenanceModeSettings());
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    if (error?.message === 'FORBIDDEN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    console.error('获取维护模式配置失败:', error);
    return NextResponse.json({ error: '获取维护模式配置失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await requireAuth();
    ensureAdminRole(currentUser.role);

    const payload = sanitizePayload((await request.json()) as Partial<MaintenanceModeSettings>);
    const settings = await saveMaintenanceModeSettings(payload, {
      updatedByName: currentUser.username,
    });

    return NextResponse.json(settings);
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    if (error?.message === 'FORBIDDEN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    console.error('保存维护模式配置失败:', error);
    return NextResponse.json({ error: '保存维护模式配置失败' }, { status: 500 });
  }
}

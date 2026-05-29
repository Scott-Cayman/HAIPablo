import { MaintenanceModeSettings } from '@/lib/maintenance-mode-types';

function formatUpdateTime(updatedAt: string | null): string | null {
  if (!updatedAt) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(updatedAt));
  } catch {
    return null;
  }
}

export function MaintenanceScreen({ settings }: { settings: MaintenanceModeSettings }) {
  const updatedAtText = formatUpdateTime(settings.updatedAt);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050816] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.26),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(244,114,182,0.12),transparent_24%),linear-gradient(180deg,rgba(5,8,22,0.92),rgba(5,8,22,1))]" />
      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 shadow-[0_24px_80px_rgba(15,23,42,0.45)] backdrop-blur-2xl sm:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-1 text-xs font-semibold tracking-[0.24em] text-fuchsia-100">
              SYSTEM MAINTENANCE
            </div>

            <div className="mt-8 flex items-center gap-4">
              <img src="/img/white.png" alt="HAIPablo" className="h-12 object-contain sm:h-14" />
              <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
            </div>

            <h1 className="mt-8 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {settings.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
              {settings.message}
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">当前状态</div>
                <div className="mt-1 text-sm font-semibold text-emerald-300">维护进行中</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">建议操作</div>
                <div className="mt-1 text-sm font-semibold text-slate-100">请稍后刷新重试</div>
              </div>
              {updatedAtText && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">最近更新</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">{updatedAtText}</div>
                </div>
              )}
            </div>
          </section>

          <aside className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(99,102,241,0.18),rgba(15,23,42,0.3))] p-8 shadow-[0_20px_70px_rgba(15,23,42,0.4)] backdrop-blur-2xl sm:p-10">
            <div className="text-sm uppercase tracking-[0.24em] text-sky-200/80">维护说明</div>
            <div className="mt-6 space-y-5 text-sm leading-7 text-slate-200">
              <p>当前正在进行系统维护与服务稳定性调整，访问入口已临时关闭，以避免产生不完整任务或异常状态。</p>
              <p>维护结束后，你可以直接回到当前地址重新访问，无需重新收藏或更换入口。</p>
            </div>

            <div className="mt-10 rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">维护负责人</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {settings.updatedByName || '系统管理员'}
              </div>
              <div className="mt-3 text-sm leading-7 text-slate-300">
                如需紧急处理，请联系内部管理员获取恢复时间或维护进度。
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

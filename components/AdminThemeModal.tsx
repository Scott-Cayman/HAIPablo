'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Palette, Settings2, Users, X } from 'lucide-react';
import {
  ADMIN_COLOR_THEMES,
  type AdminColorTheme
} from '@/lib/admin-color-theme';

interface AdminThemeModalProps {
  darkMode: boolean;
  isOpen: boolean;
  currentTheme: AdminColorTheme;
  onClose: () => void;
  onThemeChange: (theme: AdminColorTheme) => void;
  onOpenAdminUsers: () => void;
}

export function AdminThemeModal({
  darkMode,
  isOpen,
  currentTheme,
  onClose,
  onThemeChange,
  onOpenAdminUsers
}: AdminThemeModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="haipablo-modal-panel w-full max-w-2xl overflow-hidden rounded-[28px] shadow-2xl transition-colors duration-500"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`flex items-start justify-between gap-4 border-b p-6 transition-colors duration-500 ${
              darkMode ? 'border-white/10' : 'border-white/55'
            }`}>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold tracking-[0.22em] text-stone-300">
                  <Settings2 className="h-3.5 w-3.5" />
                  后台管理
                </div>
                <h3 className={`mt-4 text-2xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  快速切换色系
                </h3>
                <p className={`mt-2 text-sm leading-6 ${darkMode ? 'text-stone-300' : 'text-gray-600'}`}>
                  仅管理员可见。选择后会立即应用到当前工作区，并自动记住你的偏好。
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`rounded-xl p-2 transition-colors ${
                  darkMode ? 'text-stone-400 hover:bg-white/[0.08] hover:text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
                aria-label="关闭后台管理"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdminUsers();
                }}
                className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all ${
                  darkMode
                    ? 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                    darkMode ? 'bg-white/[0.08] text-stone-100' : 'bg-gray-100 text-gray-700'
                  }`}>
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      用户与部门管理
                    </p>
                    <p className={`mt-1 text-xs ${darkMode ? 'text-stone-400' : 'text-gray-500'}`}>
                      进入后台页面，继续管理人员、部门和数据。
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-semibold ${darkMode ? 'text-stone-400' : 'text-gray-500'}`}>
                  打开
                </span>
              </button>

              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Palette className={`h-4 w-4 ${darkMode ? 'text-amber-300' : 'text-amber-600'}`} />
                  <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    暗色主题预设
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {ADMIN_COLOR_THEMES.map((theme) => {
                    const active = theme.value === currentTheme;
                    return (
                      <button
                        key={theme.value}
                        type="button"
                        onClick={() => onThemeChange(theme.value)}
                        className={`relative overflow-hidden rounded-3xl border p-4 text-left transition-all ${
                          active
                            ? 'border-emerald-400 shadow-lg shadow-emerald-500/15'
                            : darkMode
                              ? 'border-white/10 hover:border-white/20 hover:bg-white/[0.03]'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex gap-2">
                            {theme.swatches.map((color) => (
                              <span
                                key={color}
                                className="h-6 w-6 rounded-full border border-black/10 shadow-sm"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          {active && (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                              <Check className="h-4 w-4" />
                            </span>
                          )}
                        </div>
                        <p className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {theme.label}
                        </p>
                        <p className={`mt-2 text-sm leading-6 ${darkMode ? 'text-stone-400' : 'text-gray-500'}`}>
                          {theme.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

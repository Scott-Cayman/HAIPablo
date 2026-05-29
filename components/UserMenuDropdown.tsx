'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  History,
  LogOut,
  Palette,
  Settings2,
  Shield,
  Sparkles,
  Users
} from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';

interface UserMenuUser {
  username?: string;
  email?: string | null;
  role?: string | null;
  name?: string | null;
  credits?: number | null;
}

interface UserMenuDropdownProps {
  user: UserMenuUser;
  darkMode?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onHistory: () => void;
  onLogout: () => void;
  onAdminUsers?: () => void;
  onAdminPanel?: () => void;
  onThemeSettings?: () => void;
  activeItem?: 'history' | 'admin-users' | 'admin-panel' | null;
  canManage?: boolean;
  isAdmin?: boolean;
  isSubAdmin?: boolean;
  manageLabel?: string;
  avatarSize?: 'sm' | 'md' | 'lg' | 'xl';
  showTriggerName?: boolean;
  showTriggerEmail?: boolean;
  showChevron?: boolean;
  triggerNamePosition?: 'before' | 'after';
  triggerClassName?: string;
  triggerTextClassName?: string;
  triggerSubtextClassName?: string;
  triggerAvatarClassName?: string;
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function UserMenuDropdown({
  user,
  darkMode = false,
  isOpen,
  onToggle,
  onClose,
  onHistory,
  onLogout,
  onAdminUsers,
  onAdminPanel,
  onThemeSettings,
  activeItem = null,
  canManage = false,
  isAdmin = false,
  isSubAdmin = false,
  manageLabel,
  avatarSize = 'lg',
  showTriggerName = true,
  showTriggerEmail = false,
  showChevron = false,
  triggerNamePosition = 'after',
  triggerClassName,
  triggerTextClassName,
  triggerSubtextClassName,
  triggerAvatarClassName
}: UserMenuDropdownProps) {
  const displayName = user.name || user.username || '未命名用户';
  const emailText = user.email || user.username || '';
  const canShowAdminUsers = canManage && typeof onAdminUsers === 'function';
  const canShowAdminPanel = canManage && typeof onAdminPanel === 'function';
  const canShowThemeSettings = canManage && typeof onThemeSettings === 'function';

  const baseItemClassName = joinClasses(
    'w-full rounded-lg px-4 py-2.5 text-left transition-colors flex items-center gap-3',
    darkMode
      ? 'text-stone-300 hover:bg-white/[0.06] hover:text-white'
      : 'text-gray-700 hover:bg-white/80 hover:text-gray-900'
  );

  const renderTriggerText = () => {
    if (!showTriggerName) {
      return null;
    }

    return (
      <div className={joinClasses('text-left', triggerNamePosition === 'before' ? 'order-first' : '')}>
        <p
          className={joinClasses(
            'text-sm font-medium transition-colors duration-500',
            darkMode ? 'text-white' : 'text-gray-900',
            triggerTextClassName
          )}
        >
          {displayName}
        </p>
        {showTriggerEmail && emailText && (
          <p
            className={joinClasses(
              'text-xs transition-colors duration-500',
              darkMode ? 'text-gray-500' : 'text-gray-500',
              triggerSubtextClassName
            )}
          >
            {emailText}
          </p>
        )}
      </div>
    );
  };

  const buildItemClassName = (tone: 'default' | 'admin' | 'danger', active = false) => {
    if (tone === 'danger') {
      return joinClasses(
        'w-full rounded-lg px-4 py-2.5 text-left transition-colors flex items-center gap-3',
        darkMode ? 'text-red-400 hover:bg-red-950/30' : 'text-red-600 hover:bg-red-50/80'
      );
    }

    if (tone === 'admin') {
      return joinClasses(
        'w-full rounded-lg px-4 py-2.5 text-left transition-colors flex items-center gap-3',
        active
          ? darkMode
            ? 'bg-amber-950/30 text-amber-200'
            : 'bg-amber-50/90 text-amber-700'
          : darkMode
            ? 'text-amber-300 hover:bg-amber-950/30'
            : 'text-amber-700 hover:bg-amber-50/80'
      );
    }

    if (active) {
      return joinClasses(
        'w-full rounded-lg px-4 py-2.5 text-left transition-colors flex items-center gap-3',
        darkMode ? 'bg-white/[0.08] text-white' : 'bg-violet-50/90 text-violet-700'
      );
    }

    return baseItemClassName;
  };

  const handleAction = (action: (() => void) | undefined) => {
    if (!action) return;
    onClose();
    action();
  };

  const roleBadge = isAdmin ? '管理员' : isSubAdmin ? '子管理员' : null;

  return (
    <div className="relative user-menu-container">
      <button
        type="button"
        onClick={onToggle}
        className={joinClasses('flex items-center gap-3 transition-opacity hover:opacity-80', triggerClassName)}
      >
        {triggerNamePosition === 'before' && renderTriggerText()}
        <UserAvatar user={user} size={avatarSize} darkMode={darkMode} className={triggerAvatarClassName} />
        {triggerNamePosition === 'after' && renderTriggerText()}
        {showChevron && (
          <ChevronDown
            className={joinClasses(
              'h-4 w-4 transition-transform duration-300',
              isOpen ? 'rotate-180' : '',
              darkMode ? 'text-gray-500' : 'text-gray-400'
            )}
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={joinClasses(
              'absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border shadow-lg transition-colors duration-500',
              darkMode
                ? 'haipablo-modal-panel border-white/10 bg-[#1b211c]/95'
                : 'bg-white border-white/60'
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className={joinClasses(
                'border-b p-4 transition-colors duration-500',
                darkMode ? 'border-white/10 bg-white/[0.04]' : 'border-white/60 bg-white/45'
              )}
            >
              <div className="flex items-center gap-3">
                <UserAvatar user={user} size="lg" darkMode={darkMode} className={triggerAvatarClassName} />
                <div>
                  <p className={joinClasses('font-semibold transition-colors duration-500', darkMode ? 'text-white' : 'text-gray-900')}>
                    {displayName}
                  </p>
                  {emailText && (
                    <p className="text-xs transition-colors duration-500 text-gray-500">
                      {emailText}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={joinClasses(
                    'inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                    darkMode
                      ? 'border border-[#f4ede0]/25 bg-[#f4ede0] text-[#2b241d]'
                      : 'border border-gray-900 bg-gray-950 text-white'
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  潮能力: {user.credits ?? 0}
                </span>

                {roleBadge && (
                  <span
                    className={joinClasses(
                      'inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                      isAdmin
                        ? darkMode
                          ? 'bg-amber-950/45 text-amber-300'
                          : 'bg-amber-100 text-amber-700'
                        : darkMode
                          ? 'bg-teal-950/45 text-teal-300'
                          : 'bg-blue-100 text-blue-700'
                    )}
                  >
                    <Shield className="h-3 w-3" />
                    {roleBadge}
                  </span>
                )}
              </div>
            </div>

            <div className="p-2">
              <button
                type="button"
                onClick={() => handleAction(onHistory)}
                className={buildItemClassName('default', activeItem === 'history')}
              >
                <History className="h-4 w-4" />
                我的历史
              </button>

              {canShowAdminPanel && (
                <button
                  type="button"
                  onClick={() => handleAction(onAdminPanel)}
                  className={buildItemClassName('default', activeItem === 'admin-panel')}
                >
                  <Settings2 className="h-4 w-4" />
                  后台管理
                </button>
              )}

              {canShowThemeSettings && (
                <button
                  type="button"
                  onClick={() => handleAction(onThemeSettings)}
                  className={baseItemClassName}
                >
                  <Palette className="h-4 w-4" />
                  页面配色
                </button>
              )}

              {canShowAdminUsers && (
                <button
                  type="button"
                  onClick={() => handleAction(onAdminUsers)}
                  className={buildItemClassName('admin', activeItem === 'admin-users')}
                >
                  <Users className="h-4 w-4" />
                  {manageLabel || (isAdmin ? '用户与部门管理' : '人员列表')}
                </button>
              )}

              <div className={joinClasses('my-2 border-t transition-colors duration-500', darkMode ? 'border-white/10' : 'border-white/55')} />

              <button
                type="button"
                onClick={() => handleAction(onLogout)}
                className={buildItemClassName('danger')}
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

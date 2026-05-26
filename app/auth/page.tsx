'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, Lock, LogIn, Mail, MessageSquare, User } from 'lucide-react';

async function safeReadJson(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

type AuthView = 'options' | 'password' | 'reset';

export default function LoginPage() {
  const [view, setView] = useState<AuthView>('options');
  const [loading, setLoading] = useState(false);
  const [dingTalkLoading, setDingTalkLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    code: '',
    newPassword: ''
  });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const router = useRouter();

  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setSuccessMsg('');
  };

  const handleSendCode = async () => {
    if (!formData.email) {
      setError('请输入邮箱');
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });
      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data.error || '发送失败');
      setSuccessMsg(data.message || '验证码已发送');
      setCountdown(60);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password
        })
      });

      const data = await safeReadJson(response);

      if (!response.ok) {
        throw new Error(data.error || '登录失败');
      }

      router.push('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          code: formData.code,
          newPassword: formData.newPassword
        })
      });

      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data.error || '重置失败');

      setSuccessMsg('密码重置成功，请使用新密码登录');
      setView('password');
      setFormData(prev => ({ ...prev, password: '', code: '', newPassword: '' }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDingTalkLogin = async () => {
    setDingTalkLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/dingtalk/login-url');
      const data = await safeReadJson(res);

      if (!res.ok) {
        throw new Error(data.error || '获取钉钉登录地址失败');
      }

      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setDingTalkLoading(false);
    }
  };

  const glassInputClassName =
    'w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 pl-11 text-white placeholder:text-gray-500 outline-none transition-all duration-300 focus:border-violet-300/20 focus:bg-white/[0.06] focus:ring-2 focus:ring-violet-400/20';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-950 p-6 text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.18),transparent_34%),linear-gradient(180deg,rgba(3,7,18,0.08),rgba(3,7,18,0.9))]" />
        <div className="absolute -top-[10%] -right-[10%] h-[40%] w-[40%] rounded-full bg-violet-600 blur-[120px] opacity-20" />
        <div className="absolute top-[30%] -left-[10%] h-[30%] w-[30%] rounded-full bg-blue-600 blur-[100px] opacity-10" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-md rounded-[2rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.05))] p-8 shadow-[0_30px_100px_rgba(15,23,42,0.42),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl"
      >
        <button
          onClick={() => router.push('/')}
          className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.04] text-gray-200 transition-all duration-300 hover:bg-white/[0.08] hover:text-white"
          aria-label="返回首页"
        >
          <LogIn className="h-4 w-4 rotate-180" />
        </button>

        <div className="mb-8 text-center">
          <img
            src="/img/white.png"
            alt="HAIPablo Logo"
            className="mx-auto mb-5 h-14 object-contain"
          />
          <h1 className="mb-2 text-3xl font-bold text-white">
            {view === 'reset' ? '重置密码' : '欢迎登录'}
          </h1>
        </div>

        {view === 'options' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setView('password');
                setError('');
                setSuccessMsg('');
              }}
              className="flex w-full items-center gap-4 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.05] px-5 py-4 text-left transition-all duration-300 hover:bg-white/[0.08] hover:border-white/[0.12]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/[0.08]">
                <User className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">账号密码登录</div>
                <div className="text-xs text-gray-400">输入用户名与密码继续</div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </button>

            <button
              type="button"
              onClick={handleDingTalkLogin}
              disabled={dingTalkLoading}
              className="flex w-full items-center gap-4 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.05] px-5 py-4 text-left transition-all duration-300 hover:bg-white/[0.08] hover:border-white/[0.12] disabled:opacity-60"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/[0.08]">
                {dingTalkLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <MessageSquare className="h-5 w-5 text-white" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">钉钉登录</div>
                <div className="text-xs text-gray-400">拉起钉钉授权快速进入</div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        )}

        {view === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-white">用户名</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-300" />
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className={glassInputClassName}
                  placeholder="输入用户名"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white">密码</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-300" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={glassInputClassName}
                  placeholder="输入密码"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setView('options');
                  setError('');
                  setSuccessMsg('');
                }}
                className="text-sm font-medium text-gray-300 transition-colors hover:text-white"
              >
                返回登录方式
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('reset');
                  setError('');
                  setSuccessMsg('');
                }}
                className="text-sm font-medium text-gray-300 transition-colors hover:text-white"
              >
                忘记密码？
              </button>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-red-400/15 bg-red-500/10 p-3 text-sm text-red-200"
              >
                {error}
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-3 text-sm text-emerald-200"
              >
                {successMsg}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-gray-900 transition-all duration-300 hover:bg-gray-100 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  登录中...
                </>
              ) : (
                <>
                  账号密码登录
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>
        )}

        {view === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-white">邮箱</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-300" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={glassInputClassName}
                  placeholder="输入注册邮箱"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white">验证码</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  className={glassInputClassName.replace('pl-11 ', '')}
                  placeholder="输入验证码"
                  required
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={countdown > 0}
                  className="shrink-0 rounded-2xl border border-white/[0.08] bg-white/[0.05] px-4 text-sm font-medium text-white transition-all duration-300 hover:bg-white/[0.08] disabled:opacity-60"
                >
                  {countdown > 0 ? `${countdown}s` : '获取验证码'}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white">新密码</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-300" />
                <input
                  type="password"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  className={glassInputClassName}
                  placeholder="输入新密码"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-red-400/15 bg-red-500/10 p-3 text-sm text-red-200"
              >
                {error}
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-3 text-sm text-emerald-200"
              >
                {successMsg}
              </motion.div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setView('password');
                  setError('');
                  setSuccessMsg('');
                }}
                className="flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.05] py-3 text-sm font-semibold text-white transition-all duration-300 hover:bg-white/[0.08]"
              >
                返回
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-gray-900 transition-all duration-300 hover:bg-gray-100 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    重置密码
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

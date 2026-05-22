'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, User, Lock, Mail, ArrowRight, Loader2, Moon, Sun, MessageSquare } from 'lucide-react';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dingTalkLoading, setDingTalkLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    name: '',
    code: '',
    newPassword: ''
  });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const router = useRouter();

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    localStorage.setItem('darkMode', (!darkMode).toString());
    document.documentElement.classList.toggle('dark');
  };

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发送失败');
      setSuccessMsg(data.message);
      setCountdown(60);
    } catch (err: any) {
      setError(err.message);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '重置失败');
      setSuccessMsg('密码重置成功，请使用新密码登录');
      setTimeout(() => {
        setIsResetPassword(false);
        setIsLogin(true);
        setSuccessMsg('');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (isResetPassword) {
      return handleResetPassword(e);
    }

    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      let response;

      if (isLogin) {
        response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: formData.username,
            password: formData.password
          })
        });
      } else {
        response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '操作失败');
      }

      router.push('/');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDingTalkLogin = async () => {
    setDingTalkLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/auth/dingtalk/login-url');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || '获取钉钉登录地址失败');
      }
      
      // Redirect to DingTalk login
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setDingTalkLoading(false);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 ${darkMode ? 'bg-gray-950' : 'bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100'} flex items-center justify-center p-6`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex justify-end mb-4">
          <button
            onClick={toggleDarkMode}
            className={`p-2.5 rounded-xl transition-all duration-300 ${
              darkMode 
                ? 'bg-gray-800 hover:bg-gray-700 text-amber-400 hover:text-amber-300' 
                : 'bg-white hover:bg-gray-100 text-gray-700 hover:text-gray-900'
            }`}
          >
            {darkMode ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
        </div>

        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg ${
            darkMode 
              ? 'bg-gradient-to-br from-gray-700 to-gray-800' 
              : 'bg-gradient-to-br from-gray-800 to-gray-900'
          }`}>
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className={`text-3xl font-bold mb-2 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {isResetPassword ? '重置密码' : '欢迎回来'}
          </h1>
          <p className={`transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {isResetPassword ? '通过邮箱验证码设置新密码' : (isLogin ? '登录您的账号开始创作' : '创建账号开始使用')}
          </p>
        </div>

        <div className={`rounded-2xl shadow-xl p-8 border transition-colors duration-500 ${
          darkMode 
            ? 'bg-gray-900 border-gray-800' 
            : 'bg-white border-gray-200'
        }`}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {isResetPassword ? (
              <>
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>邮箱</label>
                  <div className="relative">
                    <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                    <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="您的注册邮箱" required
                      className={`w-full px-4 py-3 pl-10 rounded-lg border transition-colors duration-300 focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none ${
                        darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                      }`} />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>验证码</label>
                  <div className="relative flex gap-2">
                    <input type="text" name="code" value={formData.code} onChange={handleChange} placeholder="输入验证码" required
                      className={`flex-1 px-4 py-3 rounded-lg border transition-colors duration-300 focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none ${
                        darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                      }`} />
                    <button type="button" onClick={handleSendCode} disabled={countdown > 0}
                      className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        darkMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      } disabled:opacity-50`}>
                      {countdown > 0 ? `${countdown}s` : '获取验证码'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>新密码</label>
                  <div className="relative">
                    <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                    <input type="password" name="newPassword" value={formData.newPassword} onChange={handleChange} placeholder="输入新密码" required minLength={6}
                      className={`w-full px-4 py-3 pl-10 rounded-lg border transition-colors duration-300 focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none ${
                        darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                      }`} />
                  </div>
                </div>
              </>
            ) : !isLogin ? (
              <>
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    邮箱
                  </label>
                  <div className="relative">
                    <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                      darkMode ? 'text-gray-500' : 'text-gray-400'
                    }`} />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 pl-10 rounded-lg border transition-colors duration-300 focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none ${
                        darkMode 
                          ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                      }`}
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    姓名
                  </label>
                  <div className="relative">
                    <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                      darkMode ? 'text-gray-500' : 'text-gray-400'
                    }`} />
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 pl-10 rounded-lg border transition-colors duration-300 focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none ${
                        darkMode 
                          ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                      }`}
                      placeholder="您的姓名"
                    />
                  </div>
                </div>
              </>
            ) : null}

            {!isResetPassword && (
              <>
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    用户名
                  </label>
                  <div className="relative">
                    <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                      darkMode ? 'text-gray-500' : 'text-gray-400'
                    }`} />
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 pl-10 rounded-lg border transition-colors duration-300 focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none ${
                        darkMode 
                          ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                      }`}
                      placeholder="输入用户名"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    密码
                  </label>
                  <div className="relative">
                    <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                      darkMode ? 'text-gray-500' : 'text-gray-400'
                    }`} />
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 pl-10 rounded-lg border transition-colors duration-300 focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none ${
                        darkMode 
                          ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                      }`}
                      placeholder="输入密码"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              </>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-lg text-sm ${
                  darkMode 
                    ? 'bg-red-900/30 text-red-400 border border-red-800' 
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}
              >
                {error}
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-lg text-sm ${
                  darkMode 
                    ? 'bg-green-900/30 text-green-400 border border-green-800' 
                    : 'bg-green-50 text-green-600 border border-green-200'
                }`}
              >
                {successMsg}
              </motion.div>
            )}

            {!isResetPassword && isLogin && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setIsResetPassword(true); setError(''); setSuccessMsg(''); }}
                  className={`text-sm font-medium transition-colors ${
                    darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                  }`}
                >
                  忘记密码？
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || dingTalkLoading}
              className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 ${
                darkMode 
                  ? 'bg-white text-gray-900 hover:bg-gray-200' 
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  {isResetPassword ? '重置密码' : (isLogin ? '账号密码登录' : '注册')}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {!isResetPassword && isLogin && (
            <div className="mt-6">
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className={`w-full border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className={`px-2 ${darkMode ? 'bg-gray-900 text-gray-500' : 'bg-white text-gray-500'}`}>
                    或者
                  </span>
                </div>
              </div>
              
              <button
                type="button"
                onClick={handleDingTalkLogin}
                disabled={dingTalkLoading || loading}
                className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 ${
                  darkMode 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {dingTalkLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    拉起钉钉中...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-5 h-5" />
                    钉钉登录
                  </>
                )}
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                if (isResetPassword) {
                  setIsResetPassword(false);
                  setIsLogin(true);
                } else {
                  setIsLogin(!isLogin);
                }
                setError('');
                setSuccessMsg('');
              }}
              className={`font-medium transition-colors duration-300 ${
                darkMode 
                  ? 'text-gray-300 hover:text-white' 
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              {isResetPassword ? '返回登录' : (isLogin ? '还没有账号？立即注册' : '已有账号？立即登录')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

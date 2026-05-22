'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  // 使用 useRef 避免 useEffect 在开发环境下因 StrictMode 被调用两次导致 authCode 失效
  const hasProcessed = React.useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    
    const authCode = searchParams.get('authCode');
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    // 钉钉可能通过 code 或 authCode 传回授权码，优先使用 authCode
    const finalCode = authCode || code;

    if (!finalCode) {
      setError('未获取到授权码');
      setTimeout(() => router.push('/auth'), 3000);
      return;
    }

    hasProcessed.current = true;

    // 可以验证 state 防止 CSRF

    const handleCallback = async () => {
      try {
        const response = await fetch('/api/auth/dingtalk/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authCode: finalCode, state }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '登录失败');
        }

        window.location.href = '/';
      } catch (err: any) {
        setError(err.message || '登录异常，请重试');
        setTimeout(() => router.push('/auth'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-800 text-center"
    >
      {error ? (
        <div>
          <div className="text-red-500 mb-4 text-xl font-bold">登录失败</div>
          <div className="text-gray-600 dark:text-gray-400 mb-4">{error}</div>
          <div className="text-sm text-gray-500">即将返回登录页...</div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            正在处理钉钉登录...
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            请稍候，我们正在验证您的身份
          </p>
        </div>
      )}
    </motion.div>
  );
}

export default function DingTalkCallbackPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <Suspense fallback={
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-800 text-center">
          <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">加载中...</h2>
          </div>
        </div>
      }>
        <CallbackContent />
      </Suspense>
    </div>
  );
}

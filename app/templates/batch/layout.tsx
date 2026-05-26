'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

export default function BatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="haipablo-static-shell min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-violet-600 mx-auto mb-4" />
            <p className="text-gray-600">加载中...</p>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

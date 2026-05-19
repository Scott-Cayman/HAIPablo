'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, LogIn, ArrowRight, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode?: boolean;
}

export const AuthModal = ({ isOpen, onClose, darkMode }: AuthModalProps) => {
  const router = useRouter();

  const handleGoToLogin = () => {
    onClose();
    router.push('/auth');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`relative w-full max-w-md overflow-hidden rounded-[2.5rem] shadow-2xl ${
              darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'
            }`}
          >
            {/* Background decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -ml-16 -mb-16" />

            <div className="p-8">
              <div className="flex justify-end mb-2">
                <button 
                  onClick={onClose}
                  className={`p-2 rounded-full transition-colors ${
                    darkMode ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-gray-100 text-gray-400'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-center mb-8">
                <div className={`w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg ${
                  darkMode ? 'bg-gray-800' : 'bg-violet-50'
                }`}>
                  <ShieldCheck className="w-10 h-10 text-violet-600" />
                </div>
                <h2 className={`text-2xl font-bold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  请先登录
                </h2>
                <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  为了保护您的创作成果并提供更好的 AI 服务，<br />请登录后再进行操作。
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleGoToLogin}
                  className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-violet-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <LogIn className="w-5 h-5" />
                  立即前往登录
                  <ArrowRight className="w-4 h-4" />
                </button>
                
                <button
                  onClick={onClose}
                  className={`w-full py-4 rounded-2xl font-bold transition-all ${
                    darkMode 
                      ? 'text-gray-400 hover:bg-gray-800' 
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  暂不登录
                </button>
              </div>

              <div className="mt-8 flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                <span className={`text-[10px] font-medium tracking-widest uppercase ${
                  darkMode ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  HAIPablo Creative Suite
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

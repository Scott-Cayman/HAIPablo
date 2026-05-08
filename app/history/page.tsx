'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Clock, 
  Image as ImageIcon,
  Sparkles,
  User,
  LogOut,
  Loader2,
  Shield,
  Users,
  History as HistoryIcon,
  Eye,
  Download,
  X
} from 'lucide-react';

interface History {
  id: string;
  templateId: string | null;
  templateName: string;
  prompt: string;
  variables: string | null;
  outputImageUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
}

export default function HistoryPage() {
  const [histories, setHistories] = useState<History[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('全部');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('全部');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const router = useRouter();

  const filterOptions = useMemo(() => {
    const mainCategories = new Set<string>();
    const subCategoriesByMain: Record<string, Set<string>> = {};

    histories.forEach(h => {
      const template = templates.find(t => t.id === h.templateId || t.name === h.templateName);
      const mainCat = template?.featureGroup?.name || '其他';
      const subCat = h.templateName || '未知';

      mainCategories.add(mainCat);
      if (!subCategoriesByMain[mainCat]) {
        subCategoriesByMain[mainCat] = new Set();
      }
      subCategoriesByMain[mainCat].add(subCat);
    });

    return {
      main: ['全部', ...Array.from(mainCategories)],
      sub: subCategoriesByMain
    };
  }, [histories, templates]);

  const groupedHistories = useMemo(() => {
    const filtered = histories.filter(h => {
      const template = templates.find(t => t.id === h.templateId || t.name === h.templateName);
      const mainCat = template?.featureGroup?.name || '其他';
      const subCat = h.templateName || '未知';

      if (selectedMainCategory !== '全部' && mainCat !== selectedMainCategory) return false;
      if (selectedSubCategory !== '全部' && subCat !== selectedSubCategory) return false;
      return true;
    });

    const groups: Record<string, { displayDate: string, items: History[] }> = {};
    
    filtered.forEach(h => {
      const date = new Date(h.createdAt);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      
      if (!groups[dateKey]) {
        groups[dateKey] = {
          displayDate: `${date.getMonth() + 1}月${date.getDate()}日`,
          items: []
        };
      }
      groups[dateKey].items.push(h);
    });

    // Sort keys descending
    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    
    return sortedKeys.map(key => ({
      key,
      displayDate: groups[key].displayDate,
      items: groups[key].items
    }));
  }, [histories, templates, selectedMainCategory, selectedSubCategory]);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUser(user);
      fetchHistory(user.id);
    } else {
      router.push('/auth');
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchHistory = async (userId: string) => {
    try {
      const [historyRes, templatesRes] = await Promise.all([
        fetch(`/api/history?userId=${userId}`),
        fetch('/api/templates')
      ]);

      if (historyRes.ok && templatesRes.ok) {
        const historyData = await historyRes.json();
        const templatesData = await templatesRes.json();
        setHistories(historyData);
        setTemplates(templatesData);
      }
    } catch (error) {
      console.error('获取历史记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/auth');
  };

  const handleDownload = async (url: string, templateName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${templateName}_${new Date().getTime()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (error) {
      console.error('下载失败:', error);
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen transition-colors duration-500 {darkMode ? 'bg-gray-950' : 'bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100'} flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50">
      <header className="glass sticky top-0 z-50 border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className="p-2 hover:bg-violet-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">创作历史</h1>
              <p className="text-sm text-gray-600">查看您的所有创作记录</p>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-4">
              <div className="relative user-menu-container">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    user.role === 'admin' 
                      ? 'bg-gradient-to-br from-amber-500 to-orange-500' 
                      : 'bg-gradient-to-br from-violet-600 to-purple-600'
                  }`}>
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-gray-900">{user.name || user.username}</p>
                    <p className="text-xs text-gray-500">@{user.username}</p>
                  </div>
                </button>

                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <div className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            user.role === 'admin' 
                              ? 'bg-gradient-to-br from-amber-500 to-orange-500' 
                              : 'bg-gradient-to-br from-violet-600 to-purple-600'
                          }`}>
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{user.name || user.username}</p>
                            <p className="text-xs text-gray-500">@{user.username}</p>
                          </div>
                        </div>
                        {user.role === 'admin' && (
                          <div className="mt-3">
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1 w-fit">
                              <Shield className="w-3 h-3" />
                              管理员
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-2">
                        <button
                          onClick={() => router.push('/history')}
                          className="w-full px-4 py-2.5 text-left text-violet-600 bg-violet-50 rounded-lg flex items-center gap-3"
                        >
                          <HistoryIcon className="w-4 h-4" />
                          我的历史
                        </button>

                        {user.role === 'admin' && (
                          <button
                            onClick={() => router.push('/admin/users')}
                            className="w-full px-4 py-2.5 text-left text-amber-700 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-3 mt-1"
                          >
                            <Users className="w-4 h-4" />
                            用户管理
                          </button>
                        )}

                        <div className="my-2 border-t border-gray-100" />

                        <button
                          onClick={handleLogout}
                          className="w-full px-4 py-2.5 text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-3"
                        >
                          <LogOut className="w-4 h-4" />
                          退出登录
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {filterOptions.main.length > 1 && (
          <div className="mb-8 space-y-3">
            {/* Main Categories */}
            <div className="flex flex-wrap gap-2">
              {filterOptions.main.map(option => (
                <button
                  key={option}
                  onClick={() => {
                    setSelectedMainCategory(option);
                    setSelectedSubCategory('全部');
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedMainCategory === option
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            {/* Sub Categories */}
            {selectedMainCategory !== '全部' && filterOptions.sub[selectedMainCategory] && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedSubCategory('全部')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedSubCategory === '全部'
                      ? 'bg-violet-100 text-violet-700 shadow-sm border border-violet-200'
                      : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  全部
                </button>
                {Array.from(filterOptions.sub[selectedMainCategory]).map(option => (
                  <button
                    key={option}
                    onClick={() => setSelectedSubCategory(option)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedSubCategory === option
                        ? 'bg-violet-100 text-violet-700 shadow-sm border border-violet-200'
                        : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {groupedHistories.length > 0 ? (
          <div className="space-y-10">
            {groupedHistories.map((group) => (
              <div key={group.key}>
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-violet-600 rounded-full"></div>
                  {group.displayDate}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {group.items.map((history, index) => (
                    <motion.div
                      key={history.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-sm"
                    >
                      {history.outputImageUrl ? (
                        <>
                          <img
                            src={history.outputImageUrl}
                            alt={history.templateName}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-row items-center justify-center gap-4 backdrop-blur-sm">
                            <button
                              onClick={() => setPreviewImage(history.outputImageUrl)}
                              className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors"
                              title="预览"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDownload(history.outputImageUrl!, history.templateName)}
                              className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors"
                              title="下载"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                          </div>
                          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none">
                            <span className="px-2 py-0.5 bg-black/40 text-white text-[10px] rounded backdrop-blur-md">
                              {history.templateName}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                          <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                          <span className="text-xs">生成失败</span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10 text-violet-600" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">暂无创作记录</h3>
            <p className="text-gray-600 mb-6">开始创作您的第一张图片吧</p>
            <button
              onClick={() => router.push('/templates')}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              选择模板开始创作
            </button>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <button 
              className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
              onClick={() => setPreviewImage(null)}
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={previewImage} 
              alt="Preview" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

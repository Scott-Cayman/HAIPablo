'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { UserAvatar } from '@/components/UserAvatar';
import { 
  ArrowLeft, 
  Clock, 
  Image as ImageIcon,
  RotateCcw,
  User,
  LogOut,
  Loader2,
  Shield,
  Users,
  History as HistoryIcon,
  Eye,
  Download,
  X,
  Sparkles
} from 'lucide-react';

interface History {
  id: string;
  templateId: string | null;
  templateName: string;
  prompt: string;
  variables: string | null;
  outputImageUrl: string | null;
  thumbnailUrl: string | null;
  status: string;
  creditsUsed: number;
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
  
  // 预览图片缩放和拖拽状态
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

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
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
          fetchHistory(userData.id);
        } else {
          router.push('/auth');
        }
      } catch {
        router.push('/auth');
      }
    };

    fetchUser();
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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('登出失败:', err);
    }
    router.push('/auth');
  };

  const handleReuse = (item: any) => {
    if (!item.templateId) return;
    router.push(`/generate?templateId=${item.templateId}&historyId=${item.id}`);
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

  const handlePreviewClose = () => {
    setPreviewImage(null);
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (previewImage) {
      const delta = e.deltaY;
      const scaleStep = 0.1;
      const newScale = delta < 0 ? zoomScale + scaleStep : zoomScale - scaleStep;
      setZoomScale(Math.max(0.1, Math.min(10, newScale)));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale > 1) {
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setZoomPosition(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
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
                  <UserAvatar user={user} size="lg" className="bg-white" />
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-gray-900">{user.name || user.username}</p>
                    <p className="text-xs text-gray-500">{user.email || user.username}</p>
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
                          <UserAvatar user={user} size="lg" className="bg-white" />
                          <div>
                            <p className="font-semibold text-gray-900">{user.name || user.username}</p>
                            <p className="text-xs text-gray-500">{user.email || user.username}</p>
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
                        {user.role === 'sub_admin' && (
                          <div className="mt-3">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex items-center gap-1 w-fit">
                              <Shield className="w-3 h-3" />
                              子管理员
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

                        {(user.role === 'admin' || user.role === 'sub_admin') && (
                          <button
                            onClick={() => router.push('/admin/users')}
                            className="w-full px-4 py-2.5 text-left text-amber-700 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-3 mt-1"
                          >
                            <Users className="w-4 h-4" />
                            {user.role === 'admin' ? '用户管理' : '人员列表'}
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
                      {history.status === 'processing' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-violet-600 bg-violet-50/50">
                          <Loader2 className="w-8 h-8 animate-spin mb-2" />
                          <span className="text-xs font-medium">正在生成中...</span>
                          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none">
                            <span className="px-2 py-0.5 bg-black/40 text-white text-[10px] rounded backdrop-blur-md">
                              {history.templateName}
                            </span>
                            <span className="px-2 py-0.5 bg-violet-600/60 text-white text-[9px] rounded backdrop-blur-md">
                              消耗 1 潮能力
                            </span>
                          </div>
                        </div>
                      ) : history.outputImageUrl ? (
                        <>
                          <img
                            src={history.outputImageUrl}
                            alt={history.templateName}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-row items-center justify-center gap-4 backdrop-blur-sm">
                            <button
                              onClick={() => handleReuse(history)}
                              className="w-10 h-10 bg-white/20 hover:bg-violet-500 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-110"
                              title="套用本次参数"
                              aria-label="套用本次参数"
                            >
                              <RotateCcw className="w-5 h-5" />
                            </button>
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
                            <span className={`px-2 py-0.5 text-[9px] rounded backdrop-blur-md ${
                              history.status === 'success' 
                                ? 'bg-violet-600/60 text-white' 
                                : 'bg-red-600/60 text-white'
                            }`}>
                              消耗 {history.creditsUsed ?? (history.status === 'success' ? 1 : 0)} 潮能力
                            </span>
                            <span className="px-2 py-0.5 bg-black/30 text-white text-[8px] rounded backdrop-blur-md">
                              {new Date(history.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                          <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                          <span className="text-xs">生成失败</span>
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-row items-center justify-center gap-4 backdrop-blur-sm">
                            <button
                              onClick={() => handleReuse(history)}
                              className="w-10 h-10 bg-white/20 hover:bg-violet-500 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-110"
                              title="套用本次参数"
                              aria-label="套用本次参数"
                            >
                              <RotateCcw className="w-5 h-5" />
                            </button>
                            <button
                              disabled
                              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white/60 cursor-not-allowed opacity-50"
                              title="预览"
                              aria-label="预览"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              disabled
                              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white/60 cursor-not-allowed opacity-50"
                              title="下载"
                              aria-label="下载"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                          </div>
                          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none">
                            <span className="px-2 py-0.5 bg-black/40 text-white text-[10px] rounded backdrop-blur-md">
                              {history.templateName}
                            </span>
                            <span className="px-2 py-0.5 bg-red-600/60 text-white text-[9px] rounded backdrop-blur-md">
                              消耗 0 潮能力
                            </span>
                          </div>
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
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-8 overflow-hidden backdrop-blur-sm"
            onClick={handlePreviewClose}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div 
              className="relative transition-transform duration-200 ease-out"
              style={{ 
                transform: `translate(${zoomPosition.x}px, ${zoomPosition.y}px) scale(${zoomScale})`,
                cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.img
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
                src={previewImage}
                alt="预览"
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl select-none"
                draggable={false}
              />
            </div>

            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white text-xs pointer-events-none">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                滚轮缩放: {Math.round(zoomScale * 100)}%
              </div>
              <div className="w-px h-3 bg-white/20" />
              <div>左键按住可拖拽</div>
            </div>

            <button
              onClick={handlePreviewClose}
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-red-500/50 hover:text-white rounded-full text-white transition-all border border-white/10 backdrop-blur-md"
            >
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

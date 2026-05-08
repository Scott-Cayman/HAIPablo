'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, 
  Image, 
  Layers, 
  Palette, 
  User, 
  Settings,
  ArrowRight,
  Plus,
  Clock,
  TrendingUp,
  FolderKanban,
  Palette as PaletteIcon,
  Image as ImageIcon,
  User as UserIcon,
  LogOut,
  History,
  Shield,
  Users,
  Moon,
  Sun
} from 'lucide-react';

const features = [
  {
    icon: Layers,
    title: '物料延展生成',
    description: '基于主视觉 KV 自动延展签到板、讲台贴、展架等多种物料',
    gradient: 'from-gray-700 to-gray-900',
    delay: 0.1,
    path: '/templates?group=material_extension'
  },
  {
    icon: PaletteIcon,
    title: '海报智能生成',
    description: '根据活动信息生成传播海报、朋友圈海报等',
    gradient: 'from-slate-700 to-slate-900',
    delay: 0.2,
    path: '/templates?group=poster_generation'
  },
  {
    icon: ImageIcon,
    title: '主视觉生成',
    description: '基于品牌调性生成商业级主视觉',
    gradient: 'from-zinc-700 to-zinc-900',
    delay: 0.3,
    path: '/templates?group=product_visual'
  },
  {
    icon: UserIcon,
    title: '人像形象照生成',
    description: '生成商务形象照，不同风格头像和肖像',
    gradient: 'from-stone-700 to-stone-900',
    delay: 0.4,
    path: '/templates?group=portrait_generation'
  }
];

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [stats, setStats] = useState({
    todayCount: 0,
    successRate: 0,
    templateCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    localStorage.setItem('darkMode', (!darkMode).toString());
    document.documentElement.classList.toggle('dark');
  };

  useEffect(() => {
    setMounted(true);
    
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      // Fetch latest user data for credits
      fetch(`/api/users?requesterId=${parsedUser.id}`)
        .then(res => res.json())
        .then(users => {
          if (Array.isArray(users)) {
            const me = users.find((u: any) => u.id === parsedUser.id);
            if (me) {
              const updatedUser = { ...parsedUser, credits: me.credits };
              setUser(updatedUser);
              localStorage.setItem('user', JSON.stringify(updatedUser));
            }
          }
        })
        .catch(console.error);
    }
    
    fetchStats();
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

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/feature-groups?enabled=true');
      const data = await response.json();
      
      let templateCount = 0;
      data.forEach((group: any) => {
        templateCount += group.templates?.length || 0;
      });

      setStats({
        todayCount: 24,
        successRate: 96,
        templateCount: templateCount
      });
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewTemplates = () => {
    router.push('/templates');
  };

  const handleFeatureClick = (path: string) => {
    router.push(path);
  };

  const handleLogin = () => {
    router.push('/auth');
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  const handleHistory = () => {
    router.push('/history');
  };

  if (!mounted) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-500 ${darkMode ? 'bg-gray-950' : 'bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100'}`}>
        <div className="text-center">
          <div className={`w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-4 ${darkMode ? 'border-gray-700 border-t-white' : 'border-gray-200 border-t-gray-800'}`} />
          <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 ${darkMode ? 'bg-gray-950' : 'bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100'}`}>
      {/* Navigation */}
      <nav className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-500 ${darkMode ? 'bg-gray-950/80 border-gray-800' : 'bg-white/70 border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center">
          <img 
            src={darkMode ? "/img/white.png" : "/img/black.png"} 
            alt="HAIPablo Logo" 
            className="h-12 object-contain cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => router.push('/')}
          />

          <div className="flex-1 flex items-center justify-end gap-4">
            <button
              onClick={toggleDarkMode}
              className={`p-2.5 rounded-xl transition-all duration-300 group ${
                darkMode 
                  ? 'bg-gray-800 hover:bg-gray-700 text-white hover:text-gray-200' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900'
              }`}
            >
              {darkMode ? (
                <Sun className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              ) : (
                <Moon className="w-5 h-5 group-hover:-rotate-12 transition-transform" />
              )}
            </button>
            {user ? (
              <>
                <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                  darkMode 
                    ? 'bg-violet-900/20 border-violet-800/50 text-violet-300' 
                    : 'bg-violet-50 border-violet-200 text-violet-700'
                }`}>
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-medium">潮能力: {user.credits ?? 0}</span>
                </div>
                
                <button 
                  onClick={handleHistory}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    darkMode 
                      ? 'text-gray-400 hover:text-white hover:bg-gray-800' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <History className="w-5 h-5" />
                  <span className="hidden sm:inline">历史记录</span>
                </button>
                
                {(user.role === 'admin' || user.username === 'admin') && (
                  <button 
                    onClick={() => router.push('/admin/users')}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                      darkMode 
                        ? 'text-white hover:text-gray-200 hover:bg-gray-800' 
                        : 'text-amber-700 hover:text-amber-800 hover:bg-amber-50'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    <span className="hidden sm:inline">用户管理</span>
                  </button>
                )}
                
                <div className={`flex items-center gap-3 pl-4 border-l transition-colors duration-500 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                  <div className="relative user-menu-container">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      (user.role === 'admin' || user.username === 'admin')
                        ? 'bg-gradient-to-br from-amber-500 to-orange-600' 
                        : darkMode 
                          ? 'bg-gradient-to-br from-gray-600 to-gray-700' 
                          : 'bg-gradient-to-br from-gray-700 to-gray-800'
                    }`}>
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="hidden md:block text-left">
                      <p className={`text-sm font-medium transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{user.name || user.username}</p>
                      <p className={`text-xs transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>@{user.username}</p>
                    </div>
                  </button>

                  <AnimatePresence>
                    {showUserMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`absolute right-0 top-full mt-2 w-56 rounded-xl shadow-lg border overflow-hidden z-50 transition-colors duration-500 ${
                          darkMode 
                            ? 'bg-gray-900 border-gray-800' 
                            : 'bg-white border-gray-100'
                        }`}
                        onClick={() => setShowUserMenu(false)}
                      >
                        <div className={`p-4 border-b transition-colors duration-500 ${
                          darkMode 
                            ? 'bg-gray-800/50 border-gray-700' 
                            : 'bg-gray-50 border-gray-100'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              (user.role === 'admin' || user.username === 'admin')
                                ? 'bg-gradient-to-br from-amber-500 to-orange-600' 
                                : darkMode 
                                  ? 'bg-gradient-to-br from-gray-600 to-gray-700' 
                                  : 'bg-gradient-to-br from-gray-700 to-gray-800'
                            }`}>
                                <User className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <p className={`font-semibold transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{user.name || user.username}</p>
                                <p className={`text-xs transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>@{user.username}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 w-fit ${
                                darkMode 
                                  ? 'bg-violet-900/50 text-violet-200 border border-violet-800' 
                                  : 'bg-violet-50 text-violet-700 border border-violet-100'
                              }`}>
                                <Sparkles className="w-3 h-3" />
                                潮能力: {user.credits ?? 0}
                              </span>
                              {(user.role === 'admin' || user.username === 'admin') && (
                                <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 w-fit ${
                                  darkMode 
                                    ? 'bg-gray-800 text-white' 
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  <Shield className="w-3 h-3" />
                                  管理员
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="p-2">
                            <button
                              onClick={() => router.push('/history')}
                              className={`w-full px-4 py-2.5 text-left rounded-lg transition-colors flex items-center gap-3 ${
                                darkMode 
                                  ? 'text-gray-300 hover:bg-gray-800 hover:text-white' 
                                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                              }`}
                            >
                              <History className="w-4 h-4" />
                              我的历史
                            </button>

                            {(user.role === 'admin' || user.username === 'admin') && (
                              <button
                                onClick={() => router.push('/admin/users')}
                                className={`w-full px-4 py-2.5 text-left rounded-lg transition-colors flex items-center gap-3 ${
                                  darkMode 
                                    ? 'text-white hover:bg-gray-800' 
                                    : 'text-amber-700 hover:bg-amber-50'
                                }`}
                              >
                                <Users className="w-4 h-4" />
                                用户与部门管理
                              </button>
                            )}

                            <div className={`my-2 border-t transition-colors duration-500 ${darkMode ? 'border-gray-800' : 'border-gray-100'}`} />

                            <button
                              onClick={handleLogout}
                              className={`w-full px-4 py-2.5 text-left rounded-lg transition-colors flex items-center gap-3 ${
                                darkMode 
                                  ? 'text-red-400 hover:bg-red-950/30' 
                                  : 'text-red-600 hover:bg-red-50'
                              }`}
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
              </>
            ) : (
              <button
                onClick={handleLogin}
                className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                  darkMode 
                    ? 'bg-white text-gray-900 hover:bg-gray-200' 
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                <User className="w-5 h-5 mr-2 inline-block" />
                登录
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 px-6 overflow-hidden">
        <div className={`absolute inset-0 transition-colors duration-500 ${darkMode ? 'bg-gradient-to-br from-gray-900/50 via-gray-800/30 to-transparent' : 'bg-gradient-to-br from-gray-100/50 via-gray-50/30 to-transparent'}`} />
        <div className={`absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl transition-colors duration-500 ${darkMode ? 'bg-gray-700/20' : 'bg-gray-200/30'}`} />
        <div className={`absolute bottom-10 right-20 w-96 h-96 rounded-full blur-3xl transition-colors duration-500 ${darkMode ? 'bg-gray-800/20' : 'bg-gray-300/20'}`} />
        
        <div className="relative max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h1 className="text-6xl font-bold mb-6 tracking-tight">
              <span className={darkMode ? 'text-white' : 'text-gray-900'}>HAI Pablo 工作台</span>
            </h1>
            <p className={`text-xl max-w-2xl mx-auto leading-relaxed transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              智海王潮AI创意效率工作台
            </p>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
            {[
              { label: '今日生成', value: stats.todayCount, icon: Sparkles, suffix: '' },
              { label: '成功率', value: stats.successRate, icon: TrendingUp, suffix: '%' },
              { label: '模板数量', value: stats.templateCount, icon: Layers, suffix: '' }
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                className={`rounded-2xl p-6 shadow-sm border transition-all duration-500 hover:shadow-md ${
                  darkMode 
                    ? 'bg-gray-900 border-gray-800' 
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{stat.label}</span>
                  <stat.icon className={`w-5 h-5 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-800'}`} />
                </div>
                <div className={`text-3xl font-bold transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {loading ? '-' : stat.value}{stat.suffix}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex items-center justify-center gap-4 flex-wrap"
          >
            <button 
              onClick={handleViewTemplates}
              className={`px-8 py-3.5 rounded-xl font-medium flex items-center gap-2 transition-all duration-300 shadow-lg ${
                darkMode 
                  ? 'bg-white text-gray-900 hover:bg-gray-200 shadow-gray-900/20' 
                  : 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-200'
              }`}
            >
              <Sparkles className="w-5 h-5" />
              开始创作
            </button>
            {user && (
              <button 
                onClick={handleHistory}
                className={`px-8 py-3.5 rounded-xl font-medium flex items-center gap-2 transition-all duration-300 border ${
                  darkMode 
                    ? 'bg-gray-900 text-white border-gray-700 hover:bg-gray-800' 
                    : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <History className="w-5 h-5" />
                我的创作
              </button>
            )}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className={`text-4xl font-bold mb-4 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>核心生成能力</h2>
            <p className={`text-lg transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>选择适合你的应用场景，快速开始创作</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: feature.delay }}
                onClick={() => handleFeatureClick(feature.path)}
                className={`group relative rounded-2xl p-8 shadow-sm border transition-all duration-300 cursor-pointer overflow-hidden hover:shadow-xl hover:border-transparent ${
                  darkMode 
                    ? 'bg-gray-900 border-gray-800' 
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                
                <div className="relative">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  
                  <h3 className={`text-2xl font-semibold mb-3 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {feature.title}
                  </h3>
                  
                  <p className={`leading-relaxed mb-6 transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {feature.description}
                  </p>
                  
                  <div className={`flex items-center gap-2 font-medium group-hover:gap-3 transition-all ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    <span>开始使用</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-12 px-6 border-t transition-colors duration-500 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="max-w-7xl mx-auto text-center">
          <p className={darkMode ? 'text-gray-500' : 'text-gray-500'}>
            HAIPablo - HAI Pablo 工作台 · 创意触手可及
          </p>
        </div>
      </footer>
    </div>
  );
}

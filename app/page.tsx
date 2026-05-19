'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { UserAvatar } from '@/components/UserAvatar';
import { AuthModal } from '@/components/AuthModal';
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
  Sun,
  LayoutGrid,
  Smartphone,
  UserCircle,
  Timer,
  Gift,
  MoreHorizontal,
  ChevronRight,
  Search,
  CheckCircle2,
  Download,
  Upload,
  Rocket,
  PieChart,
  Database,
  ArrowRightCircle
} from 'lucide-react';

const features = [
  {
    icon: Layers,
    title: '物料延展生成',
    description: '基于主视觉智能延展，一键生成多尺寸物料',
    gradient: 'from-blue-500 to-indigo-600',
    delay: 0.1,
    path: '/templates?group=material_extension'
  },
  {
    icon: PaletteIcon,
    title: '海报智能生成',
    description: 'AI智能生成各类营销海报，高效出图更出彩',
    gradient: 'from-sky-400 to-blue-500',
    delay: 0.2,
    path: '/templates?group=poster_generation'
  },
  {
    icon: UserCircle,
    title: '形象照生成',
    description: 'AI生成专业形象照，多风格多场景可选',
    gradient: 'from-emerald-400 to-teal-500',
    delay: 0.3,
    path: '/templates?group=portrait_generation'
  },
  {
    icon: Timer,
    title: '倒计时海报',
    description: '高颜值倒计时海报模板，多样风格一键生成',
    gradient: 'from-orange-400 to-red-500',
    delay: 0.4,
    path: '/templates?group=countdown'
  },
  {
    icon: Gift,
    title: '喜报生成',
    description: '智能生成喜报海报，数据可视化更惊艳',
    gradient: 'from-rose-400 to-pink-500',
    delay: 0.5,
    path: '/templates?group=success_report'
  },
  {
    icon: LayoutGrid,
    title: '更多模板',
    description: '海量优质模板持续更新，满足更多创作需求',
    gradient: 'from-gray-400 to-gray-500',
    delay: 0.6,
    path: '/templates'
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
  const [showAuthModal, setShowAuthModal] = useState(false);
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
    // Set default stats matching the design image if fetch fails
    setStats({
      todayCount: 24,
      successRate: 96,
      templateCount: 12
    });
  } finally {
    setLoading(false);
  }
};

  const handleViewTemplates = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    router.push('/templates');
  };

  const handleFeatureClick = (path: string) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
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
    if (!user) {
      setShowAuthModal(true);
      return;
    }
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
    <div className={`min-h-screen transition-colors duration-500 overflow-x-hidden ${darkMode ? 'bg-gray-950 text-white' : 'bg-[#F8FAFC] text-gray-900'}`}>
      {/* Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute -top-[10%] -right-[10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 ${darkMode ? 'bg-violet-600' : 'bg-violet-400'}`} />
        <div className={`absolute top-[20%] -left-[10%] w-[30%] h-[30%] rounded-full blur-[100px] opacity-10 ${darkMode ? 'bg-blue-600' : 'bg-blue-400'}`} />
      </div>

      {/* Navigation */}
      <nav className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-500 ${darkMode ? 'bg-gray-950/80 border-gray-800' : 'bg-white/70 border-gray-200'}`}>
        <div className="max-w-[1440px] mx-auto px-8 py-4 flex items-center justify-between">
          {/* Logo on Left */}
          <div className="flex items-center">
            <img 
              src={darkMode ? "/img/white.png" : "/img/black.png"} 
              alt="HAIPablo Logo" 
              className="h-10 object-contain cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => router.push('/')}
            />
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-all duration-300 group ${
                darkMode 
                  ? 'text-gray-400 hover:text-white hover:bg-gray-800' 
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
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
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
                  darkMode 
                    ? 'bg-violet-900/20 border-violet-800/50 text-violet-300' 
                    : 'bg-violet-50 border-violet-200 text-violet-700'
                }`}>
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-medium whitespace-nowrap">潮能力: {user.credits ?? 0}</span>
                </div>
                
                <button 
                  onClick={handleHistory}
                  className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    darkMode 
                      ? 'text-gray-400 hover:text-white hover:bg-gray-800' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <History className="w-5 h-5" />
                  <span className="text-sm font-medium">历史记录</span>
                </button>
                
                {(user.role === 'admin' || user.role === 'sub_admin') && (
                  <button 
                    onClick={() => router.push('/admin/users')}
                    className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                      darkMode 
                        ? 'text-gray-400 hover:text-white hover:bg-gray-800' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    <span className="text-sm font-medium">{user.role === 'admin' ? '用户管理' : '人员列表'}</span>
                  </button>
                )}
                
                <div className="relative user-menu-container">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity pl-2 border-l border-gray-200 dark:border-gray-800"
                  >
                    <div className="hidden md:block text-right">
                      <p className={`text-sm font-medium transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{user.name || user.username}</p>
                      <p className={`text-xs transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{user.email || user.username}</p>
                    </div>
                    <UserAvatar user={user} size="md" darkMode={darkMode} />
                    <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${showUserMenu ? 'rotate-90' : ''} ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
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
                            <UserAvatar user={user} size="lg" darkMode={darkMode} />
                              <div>
                                <p className={`font-semibold transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{user.name || user.username}</p>
                                <p className={`text-xs transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{user.email || user.username}</p>
                              </div>
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

                            {(user.role === 'admin' || user.role === 'sub_admin') && (
                              <button
                                onClick={() => router.push('/admin/users')}
                                className={`w-full px-4 py-2.5 text-left rounded-lg transition-colors flex items-center gap-3 ${
                                  darkMode 
                                    ? 'text-white hover:bg-gray-800' 
                                    : 'text-amber-700 hover:bg-amber-50'
                                }`}
                              >
                                <Users className="w-4 h-4" />
                                {user.role === 'admin' ? '用户与部门管理' : '人员列表'}
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
              </>
            ) : (
              <button
                onClick={handleLogin}
                className={`px-6 py-2 rounded-xl font-medium transition-all duration-300 ${
                  darkMode 
                    ? 'bg-white text-gray-900 hover:bg-gray-200' 
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                登录
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-10 px-6 overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-violet-500/30 to-transparent rounded-full blur-[120px] -mr-48 -mt-48" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tr from-blue-500/20 to-transparent rounded-full blur-[100px] -mr-24 -mb-24" />
        </div>
        
        {/* Subtle Mesh Grid */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '40px 40px' }} />


        <div className="relative max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col items-center mb-10"
          >
            <img 
              src={darkMode ? "/img/white.png" : "/img/black.png"} 
              alt="HAIPablo Logo" 
              className="h-20 md:h-24 object-contain mb-4"
            />
            <p className={`text-lg font-medium tracking-[0.2em] transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              智海王潮AI创意效率工作台
            </p>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
            {[
              { label: '今日生成', value: stats.todayCount, icon: Rocket, suffix: ' 次', trend: '+12 ↑', color: 'text-violet-500', bg: 'bg-violet-500/10' },
              { label: '成功率', value: stats.successRate, icon: PieChart, suffix: '%', trend: '+3.2% ↑', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { label: '模板数量', value: stats.templateCount, icon: Database, suffix: ' 套', trend: '+2 ↑', color: 'text-blue-500', bg: 'bg-blue-500/10' }
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                className={`rounded-3xl p-8 shadow-sm border transition-all duration-500 hover:shadow-md flex items-center gap-6 ${
                  darkMode 
                    ? 'bg-gray-900/50 border-gray-800 backdrop-blur-sm' 
                    : 'bg-white border-gray-100'
                }`}
              >
                <div className={`w-16 h-16 rounded-2xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <stat.icon className={`w-8 h-8 ${stat.color}`} />
                </div>
                <div className="flex-1">
                  <div className={`text-sm mb-1 font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{stat.label}</div>
                  <div className="flex items-end gap-3">
                    <div className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {loading ? '-' : stat.value}<span className="text-lg font-medium opacity-60">{stat.suffix}</span>
                    </div>
                    <div className={`text-xs font-bold mb-1.5 px-2 py-0.5 rounded-full ${
                      stat.trend.includes('↑') 
                        ? (darkMode ? 'bg-violet-900/30 text-violet-400' : 'bg-violet-50 text-violet-600')
                        : (darkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                    }`}>
                      较昨日 {stat.trend}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex items-center justify-center gap-6"
          >
            <button 
              onClick={handleViewTemplates}
              className={`px-10 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all duration-300 shadow-xl hover:scale-105 active:scale-95 ${
                darkMode 
                  ? 'bg-white text-gray-900 hover:bg-gray-100' 
                  : 'bg-gray-950 text-white hover:bg-gray-900 shadow-gray-200'
              }`}
            >
              <Sparkles className="w-5 h-5" />
              开始创作
            </button>
            <button 
              onClick={handleHistory}
              className={`px-10 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all duration-300 border-2 hover:scale-105 active:scale-95 ${
                darkMode 
                  ? 'bg-transparent text-white border-gray-700 hover:bg-gray-800' 
                  : 'bg-white text-gray-900 border-gray-100 hover:border-gray-200 hover:bg-gray-50'
              }`}
            >
              <FolderKanban className="w-5 h-5" />
              我的创作
            </button>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className={`pt-8 pb-16 px-6 transition-colors duration-500 ${darkMode ? 'bg-gray-900/40' : 'bg-gray-50/50'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className={`text-2xl font-bold mb-2 flex items-center gap-2 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                核心生成能力
                <Sparkles className="w-5 h-5 text-violet-500" />
              </h2>
              <p className={`text-sm transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>选择适合你的应用场景，快速开始创作</p>
            </div>
            <button 
              onClick={handleViewTemplates}
              className={`text-sm font-medium flex items-center gap-1 transition-colors ${darkMode ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-700'}`}
            >
              查看全部能力 <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: feature.delay }}
                onClick={() => handleFeatureClick(feature.path)}
                className={`group relative rounded-[2rem] p-6 shadow-sm border transition-all duration-300 cursor-pointer overflow-hidden hover:shadow-xl hover:-translate-y-1 ${
                  darkMode 
                    ? 'bg-gray-900 border-gray-800 hover:border-violet-500/30' 
                    : 'bg-white border-gray-100 hover:border-violet-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-lg font-bold mb-1 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {feature.title}
                    </h3>
                    <p className={`text-xs leading-relaxed line-clamp-2 transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      {feature.description}
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 flex items-end justify-between">
                  <div className="flex gap-2">
                    {[1, 2].map((i) => (
                      <div key={i} className={`w-16 h-20 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-50'} overflow-hidden relative group-hover:scale-105 transition-transform duration-500`}>
                        <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-10`} />
                        <div className="absolute inset-x-2 top-2 h-1 rounded-full bg-current opacity-20" />
                        <div className="absolute inset-x-2 top-4 h-1 w-2/3 rounded-full bg-current opacity-10" />
                      </div>
                    ))}
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    darkMode ? 'bg-gray-800 group-hover:bg-violet-600' : 'bg-gray-50 group-hover:bg-gray-900'
                  }`}>
                    <ArrowRight className={`w-5 h-5 transition-colors ${darkMode ? 'text-gray-400 group-hover:text-white' : 'text-gray-400 group-hover:text-white'}`} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom Sections */}
      <section className={`py-12 px-6 transition-colors duration-500 ${darkMode ? 'bg-transparent' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Column 1: 常用模板 (6 cols) */}
          <div className={`lg:col-span-6 rounded-3xl p-6 border transition-all duration-500 ${darkMode ? 'bg-gray-900/40 border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold flex items-center gap-2">
                <span className="w-1 h-4 bg-indigo-500 rounded-full" />
                常用模板
              </h3>
              <button 
                onClick={handleViewTemplates}
                className="text-xs text-gray-400 hover:text-indigo-500 transition-colors flex items-center gap-0.5"
              >
                更多模板 <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {[
                { name: '新品发布海报', gradient: 'from-blue-400 to-indigo-500' },
                { name: '开业活动海报', gradient: 'from-orange-400 to-red-500' },
                { name: '招聘海报', gradient: 'from-violet-400 to-purple-500' },
                { name: '节日倒计时', gradient: 'from-pink-400 to-rose-500' }
              ].map((item, i) => (
                <div key={i} className="group cursor-pointer">
                  <div className={`aspect-[3/4.5] rounded-xl bg-gradient-to-br ${item.gradient} mb-2 overflow-hidden relative shadow-sm group-hover:shadow-md transition-all duration-300`}>
                    <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
                    <div className="absolute inset-x-2 bottom-2 h-0.5 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white/40 w-1/3" />
                    </div>
                  </div>
                  <p className="text-[10px] font-medium text-center text-gray-500 truncate">{item.name}</p>
                </div>
              ))}
              <div 
                onClick={handleViewTemplates}
                className={`aspect-[3/4.5] rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 ${
                darkMode ? 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/30' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}>
                <Plus className="w-5 h-5 text-gray-400" />
                <span className="text-[10px] text-gray-400 font-bold">探索更多</span>
              </div>
            </div>
          </div>

          {/* Column 2: 最近使用 (3 cols) */}
          <div className={`lg:col-span-3 rounded-3xl p-6 border transition-all duration-500 ${darkMode ? 'bg-gray-900/40 border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full" />
                最近使用
              </h3>
              <button 
                onClick={handleHistory}
                className="text-xs text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-0.5"
              >
                全部记录 <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-4">
              {[
                { name: '夏季新品发布海报', time: '今天 10:24', size: '1920 x 1080px', gradient: 'from-sky-400 to-blue-500' },
                { name: '618活动主视觉', time: '昨天 16:35', size: '1920 x 1080px', gradient: 'from-rose-400 to-pink-500' },
                { name: '企业招聘海报_设计稿', time: '昨天 11:02', size: '1080 x 1920px', gradient: 'from-indigo-400 to-violet-500' }
              ].map((item, i) => (
                <div key={i} className={`flex items-center gap-3 p-2 rounded-xl transition-colors cursor-pointer ${
                  darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                }`}>
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.gradient} shrink-0 shadow-sm`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate mb-0.5">{item.name}</p>
                    <p className="text-[10px] text-gray-400 font-medium">{item.size}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-medium mb-1">{item.time}</p>
                    <MoreHorizontal className="w-4 h-4 text-gray-300 ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: 创作流程 (3 cols) */}
          <div className={`lg:col-span-3 rounded-3xl p-6 border transition-all duration-500 ${darkMode ? 'bg-gray-900/40 border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
            <h3 className="text-base font-bold flex items-center gap-2 mb-8">
              <span className="w-1 h-4 bg-violet-500 rounded-full" />
              创作流程
            </h3>
            <div className="flex flex-col h-[calc(100%-2rem)]">
              <div className="flex items-center justify-between px-2 mb-6 relative">
                {/* Connecting Lines */}
                <div className="absolute top-6 left-12 right-12 h-px border-t border-dashed border-gray-200 dark:border-gray-700 z-0" />
                
                {[
                  { icon: Upload, color: 'text-blue-500', bg: 'bg-blue-50' },
                  { icon: Sparkles, color: 'text-violet-500', bg: 'bg-violet-50' },
                  { icon: Download, color: 'text-indigo-500', bg: 'bg-indigo-50' }
                ].map((item, i) => (
                  <div key={i} className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 z-10 ${
                    darkMode ? 'bg-gray-800' : item.bg
                  }`}>
                    <item.icon className={`w-6 h-6 ${darkMode ? 'text-gray-400' : item.color}`} />
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-3 gap-2 px-0">
                {[
                  { step: '1', title: '选择模板或上传素材', desc: '选择适合的模板或上传你的素材' },
                  { step: '2', title: 'AI智能生成', desc: 'AI自动生成多版本内容供你选择' },
                  { step: '3', title: '编辑与导出', desc: '在线编辑优化一键导出成品' }
                ].map((item, i) => (
                  <div key={i} className="text-center">
                    <h4 className="text-[11px] font-bold mb-1 leading-tight h-8 flex flex-col items-center justify-center">
                      <span className="text-violet-500 block mb-0.5">{item.step} {item.title.split('或')[0]}</span>
                      {item.title.includes('或') && <span className="block">或{item.title.split('或')[1]}</span>}
                      {!item.title.includes('或') && <span className="block opacity-0">-</span>}
                    </h4>
                    <p className="text-[9px] text-gray-400 leading-relaxed px-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
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

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        darkMode={darkMode} 
      />
    </div>
  );
}

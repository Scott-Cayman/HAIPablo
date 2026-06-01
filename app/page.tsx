'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import LightPillar from './LightPillar';
import { UserMenuDropdown } from '@/components/UserMenuDropdown';
import { AuthModal } from '@/components/AuthModal';
import {
  Sparkles,
  Layers,
  ArrowRight,
  Plus,
  FolderKanban,
  Image as ImageIcon,
  Palette as PaletteIcon,
  History,
  Users,
  UserCircle,
  MoreHorizontal,
  ChevronRight,
  Download,
  Upload,
  Rocket,
  PieChart,
  Database
} from 'lucide-react';
import {
  getTemplateGradient,
  getTemplateImageUrl,
  pickCommonTemplates,
  pickFeatureHeroTemplate,
  type HomeFeatureGroup
} from '@/lib/home-page';

const FEATURE_VISUALS: Record<
  string,
  {
    icon: typeof Sparkles;
    gradient: string;
    description: string;
  }
> = {
  extended_generation: {
    icon: Layers,
    gradient: 'from-blue-500 to-indigo-600',
    description: '基于主视觉智能延展，一键生成多尺寸物料'
  },
  intelligent_poster_generation: {
    icon: PaletteIcon,
    gradient: 'from-sky-400 to-blue-500',
    description: 'AI 智能生成各类营销海报，高效出图更出彩'
  },
  intelligent_portrait_processing: {
    icon: UserCircle,
    gradient: 'from-emerald-400 to-teal-500',
    description: 'AI 生成专业形象照，多风格多场景可选'
  },
  '3d_rendering_optimization': {
    icon: Sparkles,
    gradient: 'from-orange-400 to-red-500',
    description: '白膜、草图、线稿一键优化为高质量 3D 效果图'
  },
  smart_diagram: {
    icon: ImageIcon,
    gradient: 'from-cyan-400 to-sky-500',
    description: '快速生成结构清晰、表达准确的图示与视觉说明'
  },
  style_clone: {
    icon: Sparkles,
    gradient: 'from-rose-400 to-pink-500',
    description: '围绕创意小工具与风格能力，提升创作效率'
  }
};

const FALLBACK_FEATURE_VISUALS = [
  { icon: Layers, gradient: 'from-blue-500 to-indigo-600' },
  { icon: PaletteIcon, gradient: 'from-sky-400 to-blue-500' },
  { icon: UserCircle, gradient: 'from-emerald-400 to-teal-500' },
  { icon: Sparkles, gradient: 'from-orange-400 to-red-500' },
  { icon: ImageIcon, gradient: 'from-cyan-400 to-sky-500' },
  { icon: Sparkles, gradient: 'from-rose-400 to-pink-500' }
];

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [featureGroups, setFeatureGroups] = useState<HomeFeatureGroup[]>([]);
  const [stats, setStats] = useState({
    todayCount: 0,
    successRate: 0,
    templateCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const darkMode = true;
  const router = useRouter();
  const commonTemplates = useMemo(() => pickCommonTemplates(featureGroups, 4), [featureGroups]);
  const features = useMemo(
    () =>
      featureGroups.filter((group) => group.templates.length > 0).map((group, index) => {
        const visual = FEATURE_VISUALS[group.key] ?? FALLBACK_FEATURE_VISUALS[index % FALLBACK_FEATURE_VISUALS.length];

        return {
          icon: visual.icon,
          title: group.name,
          description: group.description || ('description' in visual ? visual.description : '探索该分类下的真实模板与封面'),
          gradient: visual.gradient,
          delay: 0.1 + index * 0.1,
          groupKey: group.key,
          path: `/templates?group=${group.key}`
        };
      }),
    [featureGroups]
  );
  const featurePreviewMap = useMemo(
    () =>
      features.reduce<Record<string, ReturnType<typeof pickFeatureHeroTemplate>>>((acc, feature) => {
        acc[feature.groupKey] = pickFeatureHeroTemplate(featureGroups, feature.groupKey);
        return acc;
      }, {}),
    [featureGroups, features]
  );

  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.add('dark');

    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        }
      } catch (err) {
        console.error('获取用户失败:', err);
      }
    };

    fetchUser();
    fetchStats();

    return () => {
      document.documentElement.classList.remove('dark');
    };
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

      if (!response.ok) {
        throw new Error(data?.error || '获取统计数据失败');
      }

      if (!Array.isArray(data)) {
        throw new Error('统计数据格式异常');
      }

      setFeatureGroups(data);

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

  const handleTemplateOpen = (templateId: string) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    router.push(`/generate?templateId=${templateId}`);
  };

  const handleLogin = () => {
    router.push('/auth');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('登出失败:', err);
    }
    setUser(null);
  };

  const handleHistory = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    router.push('/history');
  };

  const pillarBackground = {
    topColor: '#7A6BFF',
    bottomColor: '#34D3FF',
    topColorShift: '#FF6BD6',
    bottomColorShift: '#8B5CF6',
    colorCycleSpeed: 0.42,
    intensity: 1,
    rotationSpeed: 0.3,
    glowAmount: 0.0022,
    pillarWidth: 3.2,
    pillarHeight: 0.38,
    noiseIntensity: 0.34,
    pillarRotation: 25,
    interactive: false,
    mixBlendMode: 'screen' as const,
    quality: 'high' as const
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center transition-colors duration-500 bg-gray-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-4 border-gray-700 border-t-white" />
          <p className="text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-500 overflow-x-hidden bg-gray-950 text-white">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.2),transparent_34%),linear-gradient(180deg,rgba(3,7,18,0.08),rgba(3,7,18,0.84))]" />
        <div className="absolute inset-0">
          <LightPillar className="light-pillar-home light-pillar-home--dark" {...pillarBackground} />
        </div>
        <div className="absolute -top-[10%] -right-[10%] h-[40%] w-[40%] rounded-full bg-violet-600 blur-[120px] opacity-20" />
        <div className="absolute top-[20%] -left-[10%] h-[30%] w-[30%] rounded-full bg-blue-600 blur-[100px] opacity-10" />
        <div className="absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_50%_14%,rgba(255,255,255,0.08),transparent_18%),radial-gradient(circle_at_50%_32%,rgba(167,139,250,0.08),transparent_44%)]" />
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 px-4 pt-4 transition-colors duration-500 sm:px-6 lg:px-8">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(90deg,rgba(255,255,255,0.05),rgba(255,255,255,0.1),rgba(255,255,255,0.05))] px-8 py-4 shadow-[0_10px_40px_rgba(10,10,30,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
          {/* Logo on Left */}
          <div className="flex items-center">
            <img 
              src="/img/white.png" 
              alt="HAIPablo Logo" 
              className="h-10 object-contain cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => router.push('/')}
            />
          </div>

          <div className="flex items-center gap-6">
            {user ? (
              <>
                <button
                  onClick={handleHistory}
                  className="px-3 py-2 rounded-xl border border-white/[0.05] bg-white/[0.04] transition-all duration-300 flex items-center gap-2 text-gray-200 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.08]"
                >
                  <History className="w-5 h-5" />
                  <span className="text-sm font-medium">历史记录</span>
                </button>
                
                {(user.role === 'admin' || user.role === 'sub_admin') && (
                  <button
                    onClick={() => router.push('/admin/users')}
                    className="px-3 py-2 rounded-xl border border-white/[0.05] bg-white/[0.04] transition-all duration-300 flex items-center gap-2 text-gray-200 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.08]"
                  >
                    <Users className="w-5 h-5" />
                    <span className="text-sm font-medium">{user.role === 'admin' ? '用户管理' : '人员列表'}</span>
                  </button>
                )}
                
                <UserMenuDropdown
                  user={user}
                  darkMode={darkMode}
                  isOpen={showUserMenu}
                  onToggle={() => setShowUserMenu((prev) => !prev)}
                  onClose={() => setShowUserMenu(false)}
                  onHistory={handleHistory}
                  onAdminUsers={() => router.push('/admin/users')}
                  onLogout={handleLogout}
                  canManage={user.role === 'admin' || user.role === 'sub_admin'}
                  isAdmin={user.role === 'admin'}
                  isSubAdmin={user.role === 'sub_admin'}
                  manageLabel={user.role === 'admin' ? '用户与部门管理' : '人员列表'}
                  avatarSize="md"
                  showTriggerName={true}
                  showChevron={true}
                  triggerNamePosition="before"
                  triggerClassName="flex items-center gap-3 pl-3 transition-opacity hover:opacity-80 border-l border-white/[0.08]"
                  triggerTextClassName="hidden md:flex items-center text-right min-h-10"
                />
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
            <p className="text-lg font-medium tracking-[0.2em] transition-colors duration-500 text-white/95">
              智海王潮AI创意效率工作台
            </p>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-10"
          >
            <button
              onClick={handleViewTemplates}
              className="px-10 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all duration-300 shadow-[0_16px_48px_rgba(255,255,255,0.08)] hover:scale-105 active:scale-95 bg-white text-gray-900 hover:bg-gray-100"
            >
              <Sparkles className="w-5 h-5" />
              开始创作
            </button>
            <button
              onClick={handleHistory}
              className="px-10 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all duration-300 border border-white/[0.08] bg-white/[0.08] text-white backdrop-blur-xl shadow-[0_16px_48px_rgba(167,139,250,0.08),inset_0_1px_0_rgba(255,255,255,0.06)] hover:scale-105 active:scale-95 hover:bg-white/[0.11]"
            >
              <FolderKanban className="w-5 h-5" />
              我的创作
            </button>
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
                transition={{ duration: 0.6, delay: 0.45 + index * 0.1 }}
                className="rounded-[1.75rem] p-8 border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.05))] backdrop-blur-2xl shadow-[0_24px_80px_rgba(15,23,42,0.32),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-500 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.06))] hover:border-white/[0.1] hover:shadow-[0_28px_90px_rgba(15,23,42,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] flex items-center gap-6"
              >
                <div className={`w-16 h-16 rounded-2xl ${stat.bg} ring-1 ring-white/[0.08] flex items-center justify-center shrink-0`}>
                  <stat.icon className={`w-8 h-8 ${stat.color}`} />
                </div>
                <div className="flex-1">
                  <div className="text-sm mb-1 font-medium text-gray-300">{stat.label}</div>
                  <div className="flex items-end gap-3">
                    <div className="text-4xl font-bold text-white">
                      {loading ? '-' : stat.value}<span className="text-lg font-medium opacity-60">{stat.suffix}</span>
                    </div>
                    <div className={`text-xs font-bold mb-1.5 px-2 py-0.5 rounded-full ${
                      stat.trend.includes('↑')
                        ? 'bg-white/[0.07] text-violet-200 ring-1 ring-white/[0.08]'
                        : 'bg-white/[0.07] text-emerald-200 ring-1 ring-white/[0.08]'
                    }`}>
                      较昨日 {stat.trend}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
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
                className="group relative rounded-[2rem] p-6 border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.035))] backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 cursor-pointer overflow-hidden hover:-translate-y-1 hover:border-violet-300/20 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.045))] hover:shadow-[0_28px_72px_rgba(15,23,42,0.34),inset_0_1px_0_rgba(255,255,255,0.06)]"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-1 transition-colors duration-500 text-white">
                      {feature.title}
                    </h3>
                    <p className="text-xs leading-relaxed line-clamp-2 transition-colors duration-500 text-gray-300">
                      {feature.description}
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 flex items-end justify-between gap-4">
                  {(() => {
                    const preview = featurePreviewMap[feature.groupKey];
                    const previewUrl = getTemplateImageUrl(preview);

                    return (
                      <div className="flex-1 min-w-0">
                        <div className="relative h-24 rounded-[1.35rem] bg-white/[0.04] ring-1 ring-white/[0.06] overflow-hidden group-hover:scale-[1.02] transition-transform duration-500">
                          {previewUrl ? (
                            <>
                              <img
                                src={previewUrl}
                                alt={preview?.name || feature.title}
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,18,0.78),rgba(3,7,18,0.24),rgba(3,7,18,0.18))]" />
                              <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(255,255,255,0.14),transparent_38%)]" />
                              <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="mb-1 inline-flex rounded-full border border-white/15 bg-black/15 px-2 py-0.5 text-[9px] font-semibold tracking-[0.18em] text-white/75">
                                    真实模板
                                  </div>
                                  <p className="truncate text-xs font-semibold text-white">
                                    {preview?.name || preview?.coverMetadata?.title || '该分类暂无模板封面'}
                                  </p>
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-20`} />
                              <div className="absolute inset-x-4 top-4 h-1.5 rounded-full bg-white/20" />
                              <div className="absolute inset-x-4 top-8 h-1.5 w-2/3 rounded-full bg-white/10" />
                              <div className="absolute inset-x-4 bottom-4 h-12 rounded-2xl border border-white/10 bg-black/10" />
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 bg-white/[0.05] ring-1 ring-white/[0.06] group-hover:bg-violet-500/80">
                    <ArrowRight className="w-5 h-5 transition-colors text-gray-200 group-hover:text-white" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom Sections */}
      <section className="py-12 px-6 transition-colors duration-500 bg-transparent">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-stretch">
          {/* Column 1: 常用模板 (6 cols) */}
          <div className="lg:col-span-6 rounded-3xl p-6 border border-white/10 bg-gray-900/55 backdrop-blur-sm shadow-[0_24px_80px_rgba(15,23,42,0.32)] transition-all duration-500">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold flex items-center gap-2 text-white">
                <span className="w-1 h-4 bg-indigo-500 rounded-full" />
                常用模板
              </h3>
              <button
                onClick={handleViewTemplates}
                className="text-xs text-gray-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5"
              >
                更多模板 <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {commonTemplates.map((item, i) => {
                const templateImage = getTemplateImageUrl(item);
                const templateGradient = getTemplateGradient(item, i);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTemplateOpen(item.id)}
                    className="group cursor-pointer text-left"
                  >
                    <div className={`aspect-[3/4.5] rounded-xl ${templateImage ? 'bg-white/[0.02]' : `bg-gradient-to-br ${templateGradient}`} mb-2 overflow-hidden relative shadow-sm ring-1 ring-white/10 group-hover:shadow-[0_18px_36px_rgba(15,23,42,0.25)] group-hover:-translate-y-1 transition-all duration-300`}>
                      {templateImage ? (
                        <>
                          <img
                            src={templateImage}
                            alt={item.name}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
                        </>
                      ) : (
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                      )}
                      <div className="absolute inset-x-2 bottom-2 h-0.5 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white/40 w-1/3" />
                      </div>
                    </div>
                    <p className="text-[10px] font-medium text-center text-gray-300 truncate">
                      {item.coverMetadata?.title || item.name}
                    </p>
                  </button>
                );
              })}
              <div
                onClick={handleViewTemplates}
                className="aspect-[3/4.5] rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-2 cursor-pointer bg-white/[0.02] hover:border-violet-400/40 hover:bg-violet-500/10 transition-all duration-300">
                <Plus className="w-5 h-5 text-gray-400" />
                <span className="text-[10px] text-gray-400 font-bold">探索更多</span>
              </div>
            </div>
          </div>

          {/* Column 2: 预设封面 (3 cols) */}
          <div className="lg:col-span-3 rounded-3xl p-6 border border-white/10 bg-gray-900/55 backdrop-blur-sm shadow-[0_24px_80px_rgba(15,23,42,0.32)] transition-all duration-500">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold flex items-center gap-2 text-white">
                <span className="w-1 h-4 bg-blue-500 rounded-full" />
                预设封面
              </h3>
              <button
                onClick={handleViewTemplates}
                className="text-xs text-gray-400 hover:text-blue-300 transition-colors flex items-center gap-0.5"
              >
                查看全部 <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-4">
              {commonTemplates.slice(0, 3).length > 0 ? (
                commonTemplates.slice(0, 3).map((item, i) => {
                  const previewImage = getTemplateImageUrl(item);
                  const previewGradient = getTemplateGradient(item, i);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleTemplateOpen(item.id)}
                      className="w-full flex items-center gap-3 p-2 rounded-xl transition-colors cursor-pointer hover:bg-white/5 text-left"
                    >
                      <div className={`w-10 h-10 rounded-lg ${previewImage ? 'bg-white/[0.03]' : `bg-gradient-to-br ${previewGradient}`} shrink-0 shadow-sm overflow-hidden relative`}>
                        {previewImage ? (
                          <img
                            src={previewImage}
                            alt={item.name}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold truncate mb-0.5 text-gray-100">
                          {item.coverMetadata?.title || item.name}
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium">
                          {item.featureGroup?.name || '精选模板'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-medium mb-1">预设封面</p>
                        <MoreHorizontal className="w-4 h-4 text-gray-500 ml-auto" />
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-6">
                  <p className="text-sm font-bold text-gray-100">封面数据加载中</p>
                  <p className="mt-1 text-xs text-gray-400">模板封面接入后，这里会展示预设好的推荐内容。</p>
                </div>
              )}
            </div>
          </div>

          {/* Column 3: 创作流程 (3 cols) */}
          <div className="lg:col-span-3 rounded-3xl p-6 border border-white/10 bg-gray-900/55 backdrop-blur-sm shadow-[0_24px_80px_rgba(15,23,42,0.32)] transition-all duration-500">
            <h3 className="text-base font-bold flex items-center gap-2 mb-8 text-white">
              <span className="w-1 h-4 bg-violet-500 rounded-full" />
              创作流程
            </h3>
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between px-2 mb-6 relative">
                {/* Connecting Lines */}
                <div className="absolute top-6 left-12 right-12 h-px border-t border-dashed border-white/10 z-0" />
                
                {[
                  { icon: Upload, color: 'text-sky-300', bg: 'bg-sky-500/10 ring-sky-400/20' },
                  { icon: Sparkles, color: 'text-violet-300', bg: 'bg-violet-500/10 ring-violet-400/20' },
                  { icon: Download, color: 'text-indigo-300', bg: 'bg-indigo-500/10 ring-indigo-400/20' }
                ].map((item, i) => (
                  <div key={i} className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 z-10 ring-1 ${item.bg}`}>
                    <item.icon className={`w-6 h-6 ${item.color}`} />
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
                    <h4 className="text-[11px] font-bold mb-1 leading-tight h-8 flex flex-col items-center justify-center text-gray-100">
                      <span className="text-violet-300 block mb-0.5">{item.step} {item.title.split('或')[0]}</span>
                      {item.title.includes('或') && <span className="block text-gray-200">或{item.title.split('或')[1]}</span>}
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

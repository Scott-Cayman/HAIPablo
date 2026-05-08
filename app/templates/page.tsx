'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Layers, 
  Palette, 
  Image as ImageIcon, 
  User,
  Sparkles,
  Plus,
  ArrowRight,
  Edit,
  Trash2,
  Loader2,
  CheckSquare,
  Square,
  LayersIcon,
  X,
  FolderPlus,
  Shield,
  Users,
  History,
  LogOut,
  Moon,
  Sun
} from 'lucide-react';

interface ReferenceImage {
  id: string;
  url: string;
  name: string;
}

interface Template {
  id: string;
  name: string;
  key: string;
  description: string;
  mode: string;
  defaultSize: string;
  defaultQuality: string;
  inputSlots: any[];
  variables: any[];
  referenceImages: ReferenceImage[];
  coverImage?: {
    id: string;
    url: string;
    name: string;
  } | null;
  coverMetadata?: {
    title?: string;
    description?: string;
  };
}

interface FeatureGroup {
  id: string;
  name: string;
  key: string;
  description: string;
  icon: string;
  templates: Template[];
}

const iconMap: Record<string, any> = {
  Layers,
  Palette,
  Image: ImageIcon,
  User,
  Sparkles,
  LayersIcon
};

export default function TemplatesPage() {
  const [featureGroups, setFeatureGroups] = useState<FeatureGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<FeatureGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<FeatureGroup | null>(null);
  const [newGroupData, setNewGroupData] = useState({
    name: '',
    key: '',
    description: '',
    icon: 'Layers'
  });
  const [saving, setSaving] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const router = useRouter();

  const availableIcons = [
    { key: 'Layers', component: Layers, name: '图层' },
    { key: 'Palette', component: Palette, name: '调色板' },
    { key: 'Image', component: ImageIcon, name: '图片' },
    { key: 'User', component: User, name: '用户' },
    { key: 'Sparkles', component: Sparkles, name: '闪亮' }
  ];

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

  const handleToggleBatchMode = () => {
    setBatchMode(!batchMode);
    if (batchMode) {
      setSelectedTemplates([]);
    }
  };

  const handleToggleTemplate = (templateId: string) => {
    setSelectedTemplates(prev => 
      prev.includes(templateId) 
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const handleSelectAll = () => {
    if (!selectedGroup) return;
    
    if (selectedTemplates.length === selectedGroup.templates.length) {
      setSelectedTemplates([]);
    } else {
      setSelectedTemplates(selectedGroup.templates.map(t => t.id));
    }
  };

  const handleStartBatchGenerate = () => {
    if (selectedTemplates.length === 0) {
      alert('请至少选择一个模板');
      return;
    }
    
    const templatesParam = encodeURIComponent(JSON.stringify(selectedTemplates));
    router.push(`/templates/batch?templateIds=${templatesParam}`);
  };

  const fetchFeatureGroups = async () => {
    try {
      const response = await fetch('/api/feature-groups?enabled=true');
      const data = await response.json();
      setFeatureGroups(data);
      if (data.length > 0) {
        setSelectedGroup(data[0]);
      }
    } catch (error) {
      console.error('获取功能组失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
    fetchFeatureGroups();
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

  const handleSelectTemplate = (template: Template) => {
    if (!user) {
      router.push('/auth');
      return;
    }
    router.push(`/generate?templateId=${template.id}`);
  };

  const handleEditTemplate = (e: React.MouseEvent, template: Template) => {
    e.stopPropagation();
    
    if (!user || user.username !== 'admin') {
      alert('只有管理员可以编辑模板');
      return;
    }
    
    router.push(`/templates/config?id=${template.id}`);
  };

  const handleDeleteTemplate = async (e: React.MouseEvent, template: Template) => {
    e.stopPropagation();
    
    if (!user || user.username !== 'admin') {
      alert('只有管理员可以删除模板');
      return;
    }
    
    if (!confirm(`确定要删除模板"${template.name}"吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('模板删除成功');
        fetchFeatureGroups();
      } else {
        throw new Error('删除失败');
      }
    } catch (error) {
      console.error('删除模板失败:', error);
      alert('删除失败，请重试');
    }
  };

  const handleNewTemplate = () => {
    if (!user || user.username !== 'admin') {
      alert('只有管理员可以创建模板');
      return;
    }
    router.push(`/templates/config?groupId=${selectedGroup?.id}`);
  };

  const handleAddGroup = () => {
    if (!user || user.username !== 'admin') {
      alert('只有管理员可以添加功能分类');
      return;
    }
    setNewGroupData({
      name: '',
      key: '',
      description: '',
      icon: 'Layers'
    });
    setShowAddGroupModal(true);
  };

  const handleSaveNewGroup = async () => {
    if (!newGroupData.name || !newGroupData.key) {
      alert('请填写名称和标识');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/feature-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGroupData)
      });

      if (response.ok) {
        setShowAddGroupModal(false);
        fetchFeatureGroups();
        alert('功能分类创建成功');
      } else {
        const error = await response.json();
        throw new Error(error.error || '创建失败');
      }
    } catch (error) {
      console.error('创建功能分类失败:', error);
      alert(error instanceof Error ? error.message : '创建失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleEditGroup = (group: FeatureGroup) => {
    if (!user || user.username !== 'admin') {
      alert('只有管理员可以编辑功能分类');
      return;
    }
    setEditingGroup(group);
    setNewGroupData({
      name: group.name,
      key: group.key,
      description: group.description || '',
      icon: group.icon || 'Layers'
    });
    setShowEditGroupModal(true);
  };

  const handleSaveEditGroup = async () => {
    if (!editingGroup || !newGroupData.name || !newGroupData.key) {
      alert('请填写名称和标识');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/feature-groups/${editingGroup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGroupData)
      });

      if (response.ok) {
        setShowEditGroupModal(false);
        fetchFeatureGroups();
        if (selectedGroup?.id === editingGroup.id) {
          const updatedGroup = featureGroups.find(g => g.id === editingGroup.id);
          if (updatedGroup) {
            setSelectedGroup({ ...updatedGroup, ...newGroupData });
          }
        }
        alert('功能分类更新成功');
      } else {
        const error = await response.json();
        throw new Error(error.error || '更新失败');
      }
    } catch (error) {
      console.error('更新功能分类失败:', error);
      alert(error instanceof Error ? error.message : '更新失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (group: FeatureGroup) => {
    if (!user || user.username !== 'admin') {
      alert('只有管理员可以删除功能分类');
      return;
    }

    if (group.templates.length > 0) {
      alert(`该分类下有 ${group.templates.length} 个模板，请先删除或移动所有模板后再删除分类`);
      return;
    }

    if (!confirm(`确定要删除功能分类"${group.name}"吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const response = await fetch(`/api/feature-groups/${group.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        if (selectedGroup?.id === group.id) {
          const remaining = featureGroups.filter(g => g.id !== group.id);
          setSelectedGroup(remaining.length > 0 ? remaining[0] : null);
        }
        fetchFeatureGroups();
        alert('功能分类删除成功');
      } else {
        throw new Error('删除失败');
      }
    } catch (error) {
      console.error('删除功能分类失败:', error);
      alert('删除失败，请重试');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/auth');
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-500 ${darkMode ? 'bg-gray-950' : 'bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100'}`}>
        <Loader2 className={`w-12 h-12 animate-spin ${darkMode ? 'text-white' : 'text-gray-800'}`} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 ${darkMode ? 'bg-gray-950' : 'bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100'}`}>
      <header className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-500 ${darkMode ? 'bg-gray-950/80 border-gray-800' : 'bg-white/70 border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-700'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className={`text-2xl font-bold transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>模板中心</h1>
              <p className={`text-sm transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>选择生成模板，开始创作</p>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-end gap-4">
            {user && (
              <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                darkMode 
                  ? 'bg-violet-900/20 border-violet-800/50 text-violet-300' 
                  : 'bg-violet-50 border-violet-200 text-violet-700'
              }`}>
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">潮能力: {user.credits ?? 0}</span>
              </div>
            )}
            <button
              onClick={toggleDarkMode}
              className={`p-2.5 rounded-xl transition-all duration-300 group ${
                darkMode 
                  ? 'bg-gray-800 hover:bg-gray-700 text-amber-400 hover:text-amber-300' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900'
              }`}
            >
              {darkMode ? (
                <Sun className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              ) : (
                <Moon className="w-5 h-5 group-hover:-rotate-12 transition-transform" />
              )}
            </button>
            {user && (
              <div className="relative user-menu-container">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
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
                                ? 'bg-amber-900/50 text-amber-400' 
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
                                className={`w-full px-4 py-2.5 text-left rounded-lg transition-colors flex items-center gap-3 mt-1 ${
                                  darkMode 
                                    ? 'text-amber-400 hover:bg-amber-950/30' 
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
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="col-span-12 lg:col-span-3"
          >
            <div className={`rounded-2xl shadow-sm border transition-colors duration-500 overflow-hidden ${
              darkMode 
                ? 'bg-gray-900 border-gray-800' 
                : 'bg-white border-gray-200'
            }`}>
              <div className={`p-6 border-b transition-colors duration-500 ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
                <h2 className={`text-lg font-semibold mb-2 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>功能分类</h2>
                <p className={`text-sm transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>选择生成大类</p>
              </div>
              
              <div className="p-2">
                {featureGroups.map((group, index) => {
                  const IconComponent = iconMap[group.icon] || Layers;
                  const isSelected = selectedGroup?.id === group.id;
                  
                  return (
                    <div key={group.id} className="relative group">
                      <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => setSelectedGroup(group)}
                        className={`w-full p-4 rounded-xl flex items-center gap-3 transition-all ${
                          isSelected 
                            ? darkMode
                              ? 'bg-gradient-to-r from-gray-700 to-gray-800 text-white shadow-lg'
                              : 'bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-lg'
                            : darkMode
                              ? 'hover:bg-gray-800 text-gray-300'
                              : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isSelected 
                            ? darkMode ? 'bg-white/20' : 'bg-white/20'
                            : darkMode ? 'bg-gray-700' : 'bg-gray-100'
                        }`}>
                          <IconComponent className={`w-5 h-5 ${
                            isSelected 
                              ? 'text-white' 
                              : darkMode 
                                ? 'text-gray-300' 
                                : 'text-gray-700'
                          }`} />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-medium">{group.name}</div>
                          <div className={`text-xs ${
                            isSelected 
                              ? darkMode ? 'text-white/80' : 'text-white/80'
                              : darkMode ? 'text-gray-500' : 'text-gray-500'
                          }`}>
                            {group.templates.length} 个模板
                          </div>
                        </div>
                      </motion.button>
                      
                      {user?.username === 'admin' && (
                        <div className={`absolute top-2 right-2 flex gap-1 transition-opacity ${
                          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditGroup(group);
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isSelected 
                                ? darkMode 
                                  ? 'bg-white/20 hover:bg-white/30 text-white' 
                                  : 'bg-white/20 hover:bg-white/30 text-white'
                                : darkMode 
                                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                            }`}
                            title="编辑分类"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGroup(group);
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isSelected 
                                ? darkMode 
                                  ? 'bg-white/20 hover:bg-red-500/50 text-white hover:text-white' 
                                  : 'bg-white/20 hover:bg-red-500/50 text-white hover:text-white'
                                : darkMode 
                                  ? 'bg-gray-700 hover:bg-red-900/30 text-gray-300 hover:text-red-400' 
                                  : 'bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600'
                            }`}
                            title="删除分类"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {user?.username === 'admin' && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: featureGroups.length * 0.1 }}
                    onClick={handleAddGroup}
                    className={`w-full p-4 rounded-xl flex items-center gap-3 transition-all mb-2 border-2 border-dashed ${
                      darkMode 
                        ? 'hover:bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600' 
                        : 'hover:bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <FolderPlus className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">添加分类</div>
                      <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        创建新的功能分类
                      </div>
                    </div>
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="col-span-12 lg:col-span-9"
          >
            <div className={`rounded-2xl shadow-sm border transition-colors duration-500 overflow-hidden ${
              darkMode 
                ? 'bg-gray-900 border-gray-800' 
                : 'bg-white border-gray-200'
            }`}>
              <div className={`p-6 border-b transition-colors duration-500 ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className={`text-xl font-semibold mb-1 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedGroup?.name}
                    </h2>
                    <p className={`text-sm transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {selectedGroup?.description}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleToggleBatchMode}
                      className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                        batchMode 
                          ? 'bg-green-600 text-white hover:bg-green-700' 
                          : darkMode
                            ? 'bg-orange-600 text-white hover:bg-orange-700'
                            : 'bg-orange-500 text-white hover:bg-orange-600'
                      }`}
                    >
                      <LayersIcon className="w-4 h-4" />
                      {batchMode ? '取消批量' : '批量生成'}
                    </button>
                    {user?.username === 'admin' && (
                      <button 
                        onClick={handleNewTemplate}
                        className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                          darkMode 
                            ? 'bg-white text-gray-900 hover:bg-gray-200' 
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        新建模板
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6">
                {selectedGroup?.templates && selectedGroup.templates.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <p className={`text-sm transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {batchMode ? (
                          <>已选择 <span className={`font-medium ${darkMode ? 'text-green-400' : 'text-green-600'}`}>{selectedTemplates.length}</span> 个模板</>
                        ) : (
                          <>{selectedGroup?.templates?.length || 0} 个模板</>
                        )}
                      </p>
                      {batchMode && (
                        <button
                          onClick={handleSelectAll}
                          className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2 text-sm ${
                            darkMode 
                              ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {selectedTemplates.length === selectedGroup?.templates?.length ? (
                            <>
                              <Square className="w-4 h-4" />
                              取消全选
                            </>
                          ) : (
                            <>
                              <CheckSquare className="w-4 h-4" />
                              全选
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {selectedGroup.templates.map((template, index) => (
                        <motion.div
                          key={template.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 + index * 0.05 }}
                          onClick={() => batchMode ? handleToggleTemplate(template.id) : handleSelectTemplate(template)}
                          className={`group relative rounded-2xl p-4 border transition-all duration-300 cursor-pointer overflow-hidden ${
                            batchMode 
                              ? selectedTemplates.includes(template.id)
                                ? darkMode
                                  ? 'border-green-500 bg-green-950/30'
                                  : 'border-green-400 bg-green-50/50'
                                : darkMode
                                  ? 'border-gray-700 hover:border-gray-600 hover:shadow-lg bg-gray-800/50'
                                  : 'border-gray-200 hover:border-gray-400 hover:shadow-lg bg-gradient-to-br from-gray-50 to-white'
                              : darkMode
                                ? 'border-gray-700 hover:border-gray-600 hover:shadow-lg bg-gray-800/50'
                                : 'border-gray-200 hover:border-gray-400 hover:shadow-lg bg-gradient-to-br from-gray-50 to-white'
                          }`}
                        >
                          <div className={`absolute inset-0 transition-opacity ${darkMode ? 'bg-gray-700/5 opacity-0 group-hover:opacity-100' : 'bg-gray-200/20 opacity-0 group-hover:opacity-100'}`} />
                          
                          <div className="relative">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {batchMode && (
                                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                                    selectedTemplates.includes(template.id)
                                      ? 'bg-green-500 border-green-500'
                                      : darkMode
                                        ? 'border-gray-600 bg-gray-800'
                                        : 'border-gray-300 bg-white'
                                  }`}>
                                    {selectedTemplates.includes(template.id) && (
                                      <CheckSquare className="w-4 h-4 text-white" />
                                    )}
                                  </div>
                                )}
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform ${
                                  darkMode ? 'bg-gray-700' : 'bg-gray-100'
                                }`}>
                                  <Sparkles className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                                </div>
                              </div>
                              {user?.username === 'admin' && !batchMode && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={(e) => handleEditTemplate(e, template)}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      darkMode 
                                        ? 'hover:bg-gray-700 text-gray-400 hover:text-white' 
                                        : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                                    }`}
                                    title="编辑模板"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteTemplate(e, template)}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      darkMode 
                                        ? 'hover:bg-red-950/30 text-gray-400 hover:text-red-400' 
                                        : 'hover:bg-red-50 text-gray-500 hover:text-red-600'
                                    }`}
                                    title="删除模板"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            <h3 className={`text-base font-semibold mb-2 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              {template.name}
                            </h3>
                            
                            <p className={`text-sm mb-3 line-clamp-2 transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {template.description}
                            </p>
                            
                            {template.coverImage ? (
                              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100 mb-3">
                                <img
                                  src={template.coverImage.url}
                                  alt={template.coverImage.name}
                                  className="w-full h-full object-contain"
                                  style={{ objectPosition: 'center top' }}
                                />
                                {template.coverMetadata?.title && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                                    <p className="text-white text-sm font-medium truncate">
                                      {template.coverMetadata.title}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ) : template.referenceImages && template.referenceImages.length > 0 ? (
                              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100 mb-3">
                                <img
                                  src={template.referenceImages[0].url}
                                  alt={template.referenceImages[0].name}
                                  className="w-full h-full object-contain"
                                  style={{ objectPosition: 'center top' }}
                                />
                              </div>
                            ) : (
                              <div className={`w-full aspect-video rounded-lg flex items-center justify-center mb-3 ${
                                darkMode ? 'bg-gray-800' : 'bg-gray-100'
                              }`}>
                                <ImageIcon className={`w-8 h-8 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                              </div>
                            )}
                            
                            {batchMode ? (
                              <div className={`text-sm font-medium ${
                                selectedTemplates.includes(template.id)
                                  ? darkMode ? 'text-green-400' : 'text-green-600'
                                  : darkMode ? 'text-gray-500' : 'text-gray-500'
                              }`}>
                                {selectedTemplates.includes(template.id) ? '✓ 已选择' : '点击选择'}
                              </div>
                            ) : (
                              <div className={`flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all ${
                                darkMode ? 'text-white' : 'text-gray-900'
                              }`}>
                                <span>开始使用</span>
                                <ArrowRight className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {batchMode && selectedTemplates.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-6 p-4 rounded-2xl border transition-colors duration-500 ${
                          darkMode 
                            ? 'bg-green-950/30 border-green-800' 
                            : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            已选择 <span className={`font-bold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>{selectedTemplates.length}</span> 个模板
                          </p>
                          <button
                            onClick={handleStartBatchGenerate}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-medium"
                          >
                            <LayersIcon className="w-5 h-5" />
                            开始批量生成
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
                      darkMode ? 'bg-gray-800' : 'bg-gray-100'
                    }`}>
                      <Layers className={`w-10 h-10 ${darkMode ? 'text-gray-500' : 'text-gray-600'}`} />
                    </div>
                    <h3 className={`text-xl font-semibold mb-3 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>该分类下暂无模板</h3>
                    <p className={`mb-6 transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>创建一个新模板开始使用</p>
                    {user?.username === 'admin' && (
                      <button
                        onClick={handleNewTemplate}
                        className={`px-6 py-3 rounded-lg transition-colors inline-flex items-center gap-2 ${
                          darkMode 
                            ? 'bg-white text-gray-900 hover:bg-gray-200' 
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        }`}
                      >
                        <Plus className="w-5 h-5" />
                        创建模板
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {showAddGroupModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddGroupModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-colors duration-500 ${
                darkMode ? 'bg-gray-900' : 'bg-white'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`p-6 border-b flex items-center justify-between transition-colors duration-500 ${
                darkMode ? 'border-gray-800' : 'border-gray-100'
              }`}>
                <div>
                  <h3 className={`text-xl font-semibold transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>添加功能分类</h3>
                  <p className={`text-sm mt-1 transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>创建一个新的功能分类</p>
                </div>
                <button
                  onClick={() => setShowAddGroupModal(false)}
                  className={`p-2 rounded-lg transition-colors ${
                    darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    分类名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newGroupData.name}
                    onChange={(e) => setNewGroupData({ ...newGroupData, name: e.target.value })}
                    placeholder="例如：海报智能生成"
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-all ${
                      darkMode 
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                        : 'border-gray-200 text-gray-900'
                    }`}
                  />
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    分类标识 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newGroupData.key}
                    onChange={(e) => setNewGroupData({ ...newGroupData, key: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })}
                    placeholder="例如：poster_generation"
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-all ${
                      darkMode 
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                        : 'border-gray-200 text-gray-900'
                    }`}
                  />
                  <p className={`text-xs mt-1 transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>用于代码中识别，建议使用英文和下划线</p>
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    分类描述
                  </label>
                  <textarea
                    value={newGroupData.description}
                    onChange={(e) => setNewGroupData({ ...newGroupData, description: e.target.value })}
                    placeholder="描述这个分类的用途..."
                    rows={3}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-all resize-none ${
                      darkMode 
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                        : 'border-gray-200 text-gray-900'
                    }`}
                  />
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    选择图标
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {availableIcons.map((icon) => {
                      const IconComp = icon.component;
                      const isSelected = newGroupData.icon === icon.key;
                      return (
                        <button
                          key={icon.key}
                          type="button"
                          onClick={() => setNewGroupData({ ...newGroupData, icon: icon.key })}
                          className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                            isSelected 
                              ? darkMode
                                ? 'border-gray-500 bg-gray-800'
                                : 'border-gray-500 bg-gray-100'
                              : darkMode
                                ? 'border-gray-700 hover:border-gray-600'
                                : 'border-gray-200 hover:border-gray-300'
                          }`}
                          title={icon.name}
                        >
                          <IconComp className={`w-5 h-5 ${
                            isSelected 
                              ? darkMode ? 'text-white' : 'text-gray-700'
                              : darkMode ? 'text-gray-400' : 'text-gray-600'
                          }`} />
                          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{icon.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              <div className={`p-6 border-t flex gap-3 justify-end transition-colors duration-500 ${
                darkMode ? 'border-gray-800' : 'border-gray-100'
              }`}>
                <button
                  onClick={() => setShowAddGroupModal(false)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    darkMode 
                      ? 'text-gray-300 hover:bg-gray-800' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  取消
                </button>
                <button
                  onClick={handleSaveNewGroup}
                  disabled={saving || !newGroupData.name || !newGroupData.key}
                  className={`px-6 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                    darkMode 
                      ? 'bg-white text-gray-900 hover:bg-gray-200' 
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      创建分类
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditGroupModal && editingGroup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEditGroupModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-colors duration-500 ${
                darkMode ? 'bg-gray-900' : 'bg-white'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`p-6 border-b flex items-center justify-between transition-colors duration-500 ${
                darkMode ? 'border-gray-800' : 'border-gray-100'
              }`}>
                <div>
                  <h3 className={`text-xl font-semibold transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>编辑功能分类</h3>
                  <p className={`text-sm mt-1 transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>修改分类信息</p>
                </div>
                <button
                  onClick={() => setShowEditGroupModal(false)}
                  className={`p-2 rounded-lg transition-colors ${
                    darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    分类名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newGroupData.name}
                    onChange={(e) => setNewGroupData({ ...newGroupData, name: e.target.value })}
                    placeholder="例如：海报智能生成"
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-all ${
                      darkMode 
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                        : 'border-gray-200 text-gray-900'
                    }`}
                  />
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    分类标识 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newGroupData.key}
                    onChange={(e) => setNewGroupData({ ...newGroupData, key: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })}
                    placeholder="例如：poster_generation"
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-all ${
                      darkMode 
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                        : 'border-gray-200 text-gray-900'
                    }`}
                  />
                  <p className={`text-xs mt-1 transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>用于代码中识别，建议使用英文和下划线</p>
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    分类描述
                  </label>
                  <textarea
                    value={newGroupData.description}
                    onChange={(e) => setNewGroupData({ ...newGroupData, description: e.target.value })}
                    placeholder="描述这个分类的用途..."
                    rows={3}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none transition-all resize-none ${
                      darkMode 
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                        : 'border-gray-200 text-gray-900'
                    }`}
                  />
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    选择图标
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {availableIcons.map((icon) => {
                      const IconComp = icon.component;
                      const isSelected = newGroupData.icon === icon.key;
                      return (
                        <button
                          key={icon.key}
                          type="button"
                          onClick={() => setNewGroupData({ ...newGroupData, icon: icon.key })}
                          className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                            isSelected 
                              ? darkMode
                                ? 'border-gray-500 bg-gray-800'
                                : 'border-gray-500 bg-gray-100'
                              : darkMode
                                ? 'border-gray-700 hover:border-gray-600'
                                : 'border-gray-200 hover:border-gray-300'
                          }`}
                          title={icon.name}
                        >
                          <IconComp className={`w-5 h-5 ${
                            isSelected 
                              ? darkMode ? 'text-white' : 'text-gray-700'
                              : darkMode ? 'text-gray-400' : 'text-gray-600'
                          }`} />
                          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{icon.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              <div className={`p-6 border-t flex gap-3 justify-end transition-colors duration-500 ${
                darkMode ? 'border-gray-800' : 'border-gray-100'
              }`}>
                <button
                  onClick={() => setShowEditGroupModal(false)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    darkMode 
                      ? 'text-gray-300 hover:bg-gray-800' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEditGroup}
                  disabled={saving || !newGroupData.name || !newGroupData.key}
                  className={`px-6 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                    darkMode 
                      ? 'bg-white text-gray-900 hover:bg-gray-200' 
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4" />
                      保存修改
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { UserAvatar } from '@/components/UserAvatar';
import { 
  ArrowLeft, 
  Plus, 
  Save,
  Upload,
  X,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  User,
  Shield,
  Users,
  History,
  LogOut,
  Moon,
  Settings,
  Type,
  Palette,
  Layout,
  ChevronDown,
  Trash2,
  GripVertical
} from 'lucide-react';
import { SIZE_OPTIONS, QUALITY_OPTIONS } from '@/lib/types';
import {
  SPECIAL_TEMPLATE_3D_RENDER,
  THREE_D_AI_RENDER_PRESET,
  type SpecialTemplateOption
} from '@/lib/special-template-presets';

interface ReferenceImage {
  id: string;
  url: string;
  name: string;
}

interface CoverImage {
  id: string;
  url: string;
  name: string;
}

interface CoverMetadata {
  title?: string;
  description?: string;
  badge?: string;
  specialTemplateType?: string;
  specialTemplateLabel?: string;
}

interface TemplateVariable {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'color' | 'select' | 'image';
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  options?: SpecialTemplateOption[];
  multiSelect?: boolean;
  maxSelections?: number;
  section?: string;
  sectionDescription?: string;
}

const DEFAULT_PROMPT = '请将参考图1的画面应用到参考图2的模板样式中：\n\n要求：\n1. 保持参考图2的整体结构和布局\n2. 参考图1中的主要视觉元素应该清晰可见\n3. 颜色风格应该与参考图1保持一致\n4. 参考图2中的文字位置和大小保持不变\n5. 整体比例协调，美观大方';

export default function TemplateConfigPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('id');
  const groupId = searchParams.get('groupId');
  const isEditing = !!templateId;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [coverImage, setCoverImage] = useState<CoverImage | null>(null);
  const [coverMetadata, setCoverMetadata] = useState<CoverMetadata>({
    title: '',
    description: ''
  });

  const [featureGroupId, setFeatureGroupId] = useState<string | null>(groupId);
  const [user, setUser] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

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

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    promptTemplate: DEFAULT_PROMPT,
    negativePrompt: '',
    defaultSize: '1024x1024',
    defaultQuality: 'medium',
    enabled: true,
    allowUserPrompt: true,
    userPromptPriorityDefault: false,
    enableSpecifiedColors: false,
    specifiedColors: [] as Array<{name: string; color: string; order: number; label?: string}>,
    variables: [] as TemplateVariable[],
    showMainVisual: true,
    enableReferenceBatchMode: false,
    enableCustomReferenceUpload: false,
    allowMultipleCustomReferences: false
  });

  const addVariable = () => {
    const newVar: TemplateVariable = {
      id: `var_${Date.now()}`,
      key: `var_${formData.variables.length + 1}`,
      label: `新字段 ${formData.variables.length + 1}`,
      type: 'text',
      placeholder: '请输入...',
      required: true
    };
    setFormData(prev => ({
      ...prev,
      variables: [...prev.variables, newVar]
    }));
  };

  const applyThreeDAIRenderPreset = () => {
    setFormData(prev => ({
      ...prev,
      name: THREE_D_AI_RENDER_PRESET.name,
      description: THREE_D_AI_RENDER_PRESET.description,
      promptTemplate: THREE_D_AI_RENDER_PRESET.promptTemplate,
      negativePrompt: THREE_D_AI_RENDER_PRESET.negativePrompt,
      defaultSize: THREE_D_AI_RENDER_PRESET.defaultSize,
      defaultQuality: THREE_D_AI_RENDER_PRESET.defaultQuality,
      enabled: true,
      allowUserPrompt: THREE_D_AI_RENDER_PRESET.allowUserPrompt,
      userPromptPriorityDefault: THREE_D_AI_RENDER_PRESET.userPromptPriorityDefault,
      enableSpecifiedColors: false,
      specifiedColors: [],
      variables: THREE_D_AI_RENDER_PRESET.variables,
      showMainVisual: THREE_D_AI_RENDER_PRESET.showMainVisual,
      enableReferenceBatchMode: false,
      enableCustomReferenceUpload: false,
      allowMultipleCustomReferences: false
    }));
    setReferenceImages([]);
    setCoverImage(null);
    setCoverMetadata(THREE_D_AI_RENDER_PRESET.coverMetadata);
  };

  const removeVariable = (id: string) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.filter(v => v.id !== id)
    }));
  };

  const updateVariable = (id: string, updates: Partial<TemplateVariable>) => {
    setFormData(prev => ({
      ...prev,
      variables: prev.variables.map(v => v.id === id ? { ...v, ...updates } : v)
    }));
  };

  const handleReorder = (newOrder: TemplateVariable[]) => {
    setFormData(prev => ({
      ...prev,
      variables: newOrder
    }));
  };

  const [detectedColors, setDetectedColors] = useState<Array<{name: string; color: string; label?: string}>>([]);

  const detectSpecifiedColors = (text: string, existingColors?: Array<{name: string; color: string; label?: string}>) => {
    const regex = /指定色(\d+)/g;
    const matches = [...text.matchAll(regex)];
    const detected: Array<{name: string; color: string; label?: string}> = [];
    const seen = new Set<string>();

    matches.forEach(match => {
      const name = match[0];
      if (!seen.has(name)) {
        seen.add(name);
        
        // Preserve existing color and label if available
        const sourceColors = existingColors || formData.specifiedColors;
        const existingColor = detectedColors.find(c => c.name === name) 
          || sourceColors.find(c => c.name === name);
          
        detected.push({ 
          name, 
          color: existingColor ? existingColor.color : '#888888',
          label: existingColor ? existingColor.label : ''
        });
      }
    });

    setDetectedColors(detected);
    return detected;
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'promptTemplate') {
      detectSpecifiedColors(value);
    }
  };

  const handleColorChange = (colorName: string, newColor: string) => {
    setFormData(prev => ({
      ...prev,
      specifiedColors: prev.specifiedColors.map(c =>
        c.name === colorName ? { ...c, color: newColor } : c
      )
    }));
  };

  const addSpecifiedColor = () => {
    const maxDetected = detectedColors.reduce((max, c) => {
      const num = parseInt(c.name.replace('指定色', ''));
      return num > max ? num : max;
    }, 0);
    const maxFormData = formData.specifiedColors.reduce((max, c) => {
      const num = parseInt(c.name.replace('指定色', ''));
      return num > max ? num : max;
    }, 0);
    
    const nextNum = Math.max(maxDetected, maxFormData) + 1;
    
    const newColor = {
      name: `指定色${nextNum}`,
      color: '#888888',
      order: nextNum
    };
    setFormData(prev => ({
      ...prev,
      specifiedColors: [...prev.specifiedColors, newColor]
    }));
  };

  const removeSpecifiedColor = (colorName: string) => {
    setFormData(prev => ({
      ...prev,
      specifiedColors: prev.specifiedColors.filter(c => c.name !== colorName)
    }));
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          setUser(await res.json());
        }
      } catch (err) {
        console.error('获取用户失败:', err);
      }
    };

    fetchUser();

    if (isEditing && templateId) {
      fetchTemplate();
    }
  }, [templateId, isEditing]);

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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('登出失败:', err);
    }
    router.push('/auth');
  };

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/templates/${templateId}`);
      if (response.ok) {
        const data = await response.json();
        setFormData({
          name: data.name || '',
          description: data.description || '',
          promptTemplate: data.promptTemplate || DEFAULT_PROMPT,
          negativePrompt: data.negativePrompt || '',
          defaultSize: data.defaultSize || '1024x1024',
          defaultQuality: data.defaultQuality || 'medium',
          enabled: data.enabled !== false,
          allowUserPrompt: data.allowUserPrompt !== false,
          userPromptPriorityDefault: data.userPromptPriorityDefault || false,
          enableSpecifiedColors: data.enableSpecifiedColors || false,
          specifiedColors: data.specifiedColors || [],
          variables: data.variables || [],
          showMainVisual: data.showMainVisual !== false,
          enableReferenceBatchMode: data.enableReferenceBatchMode || false,
          enableCustomReferenceUpload: data.enableCustomReferenceUpload || false,
          allowMultipleCustomReferences: data.allowMultipleCustomReferences || false
        });

        if (data.featureGroupId) {
          setFeatureGroupId(data.featureGroupId);
        }

        if (data.referenceImages && Array.isArray(data.referenceImages)) {
          setReferenceImages(data.referenceImages);
        }

        if (data.coverImage) {
          setCoverImage(data.coverImage);
        }

        if (data.coverMetadata) {
          setCoverMetadata({
            ...data.coverMetadata,
            title: data.coverMetadata.title || '',
            description: data.coverMetadata.description || ''
          });
        }

        if (data.enableSpecifiedColors) {
          detectSpecifiedColors(data.promptTemplate || DEFAULT_PROMPT, data.specifiedColors);
        }
      } else if (response.status === 404) {
        alert('模板不存在，可能已被删除');
        router.push('/templates');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('获取模板失败，状态码:', response.status, errorData);
        alert(`获取模板信息失败: ${errorData.error || '未知错误'}`);
        router.push('/templates');
      }
    } catch (error) {
      console.error('获取模板失败:', error);
      alert('网络错误，无法获取模板信息');
      router.push('/templates');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));

      if (name === 'enableSpecifiedColors' && checked) {
        detectSpecifiedColors(formData.promptTemplate);
      }

      if (name === 'enableCustomReferenceUpload' && !checked) {
        setFormData(prev => ({
          ...prev,
          allowMultipleCustomReferences: false
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fd = new FormData();
        fd.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: fd
        });

        if (!response.ok) {
          throw new Error('上传失败');
        }

        const data = await response.json();
        return {
          id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          url: data.url,
          name: file.name
        };
      });

      const newImages = await Promise.all(uploadPromises);
      setReferenceImages(prev => [...prev, ...newImages]);
    } catch (error) {
      console.error('上传失败:', error);
      alert('图片上传失败，请重试');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploadingCover(true);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: fd
      });

      if (!response.ok) {
        throw new Error('上传失败');
      }

      const data = await response.json();
      setCoverImage({
        id: `cover_${Date.now()}`,
        url: data.url,
        name: file.name
      });
    } catch (error) {
      console.error('上传失败:', error);
      alert('封面图片上传失败，请重试');
    } finally {
      setUploadingCover(false);
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveCover = () => {
    setCoverImage(null);
    setCoverMetadata(prev => ({ ...prev, title: '', description: '' }));
  };

  const handleCoverMetadataChange = (field: keyof CoverMetadata, value: string) => {
    setCoverMetadata(prev => ({ ...prev, [field]: value }));
  };

  const handleRemoveImage = (imageId: string) => {
    setReferenceImages(prev => prev.filter(img => img.id !== imageId));
  };

  const generateKey = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('请输入模板名称');
      return;
    }

    if (!formData.promptTemplate.trim()) {
      alert('请输入提示词模板');
      return;
    }

    if (!isEditing && !groupId) {
      alert('缺少功能组ID，请从模板列表页面进入创建');
      return;
    }

    setSaving(true);

    try {
      const url = isEditing ? `/api/templates/${templateId}` : '/api/templates';
      const method = isEditing ? 'PUT' : 'POST';

      const saveData = {
        name: formData.name,
        description: formData.description,
        promptTemplate: formData.promptTemplate,
        negativePrompt: formData.negativePrompt,
        defaultSize: formData.defaultSize,
        defaultQuality: formData.defaultQuality,
        enabled: formData.enabled,
        allowUserPrompt: formData.allowUserPrompt,
        userPromptPriorityDefault: formData.userPromptPriorityDefault,
        enableSpecifiedColors: formData.enableSpecifiedColors,
        specifiedColors: formData.enableSpecifiedColors ? [...detectedColors.map(dc => ({
          ...dc,
          order: parseInt(dc.name.replace('指定色', '')) || 0
        })), ...formData.specifiedColors.filter(
          sc => !detectedColors.find(dc => dc.name === sc.name)
        )].sort((a, b) => a.order - b.order) : [],
        variables: formData.variables,
        showMainVisual: formData.showMainVisual,
        enableReferenceBatchMode: formData.enableReferenceBatchMode,
        enableCustomReferenceUpload: formData.enableCustomReferenceUpload,
        allowMultipleCustomReferences: formData.enableCustomReferenceUpload && formData.allowMultipleCustomReferences,
        key: generateKey(formData.name),
        mode: 'edit',
        featureGroupId: featureGroupId,
        referenceImages: referenceImages,
        coverImage: coverImage,
        coverMetadata: coverMetadata,
        requesterId: user?.id
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saveData)
      });

      if (response.ok) {
        router.push('/templates');
      } else {
        const error = await response.json();
        throw new Error(error.error || '保存失败');
      }
    } catch (error: any) {
      console.error('保存失败:', error);
      alert(error.message || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-500 ${darkMode ? 'bg-gray-950' : 'bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100'}`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 ${darkMode ? 'bg-gray-950' : 'bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100'}`}>
      <header className="glass sticky top-0 z-50 border-b border-white/20">
        <div className="mx-auto flex w-[min(96vw,1880px)] items-center justify-between px-6 py-4 2xl:px-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/templates')}
              className="p-2 hover:bg-violet-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditing ? '编辑模板' : '创建模板'}
              </h1>
              <p className="text-sm text-gray-600">预设提示词和参考图</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={applyThreeDAIRenderPreset}
              className="px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-sm font-medium"
            >
              载入 3D AI 渲染特殊模板
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  保存模板
                </>
              )}
            </button>

            {user && (
              <div className="relative user-menu-container">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <UserAvatar user={user} size="lg" />
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
                          <UserAvatar user={user} size="lg" />
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
                      </div>

                      <div className="p-2">
                        <button
                          onClick={() => router.push('/history')}
                          className="w-full px-4 py-2.5 text-left text-gray-700 hover:bg-violet-50 hover:text-violet-600 rounded-lg transition-colors flex items-center gap-3"
                        >
                          <History className="w-4 h-4" />
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
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto w-[min(96vw,1880px)] px-6 py-8 2xl:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    模板名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="例如：签到板生成"
                  />
                </div>

                {coverMetadata.specialTemplateType === SPECIAL_TEMPLATE_3D_RENDER && (
                  <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-emerald-700 uppercase">
                          特殊模板
                        </p>
                        <h3 className="mt-1 text-base font-semibold text-gray-900">
                          {coverMetadata.specialTemplateLabel || '3D AI 渲染'}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600">
                          该模板会在生成页启用专用的结构化表单，适合白膜、草图、线稿的 3D 渲染场景。
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                        {coverMetadata.badge || '特殊模板'}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    封面图片
                  </label>
                  
                  <input
                    ref={coverFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    className="hidden"
                    id="cover-upload"
                    disabled={uploadingCover}
                  />
                  
                  {coverImage ? (
                    <div className="space-y-3">
                      <div className="relative group">
                        <img
                          src={coverImage.url}
                          alt="封面图片"
                          className="w-full h-32 object-cover rounded-lg border border-gray-200"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <label 
                            htmlFor="cover-upload" 
                            className="px-3 py-1.5 bg-white text-gray-900 rounded cursor-pointer hover:bg-gray-100 transition-colors text-xs font-medium"
                          >
                            更换
                          </label>
                          <button 
                            onClick={handleRemoveCover}
                            className="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-xs font-medium"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            封面标题
                          </label>
                          <input
                            type="text"
                            value={coverMetadata.title}
                            onChange={(e) => handleCoverMetadataChange('title', e.target.value)}
                            className="input-field text-sm"
                            placeholder="例如：签到板设计"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            封面描述
                          </label>
                          <input
                            type="text"
                            value={coverMetadata.description}
                            onChange={(e) => handleCoverMetadataChange('description', e.target.value)}
                            className="input-field text-sm"
                            placeholder="简短描述"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label 
                      htmlFor="cover-upload" 
                      className="block w-full h-32 border-2 border-dashed border-gray-300 rounded-lg hover:border-violet-400 transition-colors cursor-pointer flex items-center justify-center"
                    >
                      {uploadingCover ? (
                        <div className="text-center">
                          <Loader2 className="w-6 h-6 text-violet-600 mx-auto mb-1 animate-spin" />
                          <p className="text-xs text-gray-600">上传中...</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <ImageIcon className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                          <p className="text-xs text-gray-600">点击上传封面</p>
                          <p className="text-xs text-gray-500">PNG, JPG, WEBP</p>
                        </div>
                      )}
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    模板描述
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    className="input-field resize-none"
                    placeholder="简要描述这个模板的用途"
                  />
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                  <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                    用户补充提示词
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <label className="flex items-center gap-2 cursor-pointer mt-1">
                        <input
                          type="checkbox"
                          name="allowUserPrompt"
                          checked={formData.allowUserPrompt}
                          onChange={handleChange}
                          className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                        />
                      </label>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          允许用户补充提示词
                        </label>
                        <p className="text-xs text-gray-600">
                          开启后，用户可以在生成时添加自己的提示词，将添加到预设提示词后面
                        </p>
                      </div>
                    </div>

                    {formData.allowUserPrompt && (
                      <div className="flex items-start gap-3 ml-7">
                        <label className="flex items-center gap-2 cursor-pointer mt-1">
                          <input
                            type="checkbox"
                            name="userPromptPriorityDefault"
                            checked={formData.userPromptPriorityDefault}
                            onChange={handleChange}
                            className="w-4 h-4 text-red-500 rounded border-red-300 focus:ring-red-500"
                          />
                        </label>
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-red-700 mb-1">
                            用户提示词优先
                          </label>
                          <p className="text-xs text-red-600">
                            开启后，用户输入的提示词将放在预设提示词前面（默认关闭）
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-amber-200">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name="enableSpecifiedColors"
                          checked={formData.enableSpecifiedColors}
                          onChange={handleChange}
                          className="w-4 h-4 text-violet-600 rounded border-violet-300 focus:ring-violet-500"
                        />
                        <span className="text-sm font-medium text-violet-700">
                          启用指定色功能
                        </span>
                      </label>
                      <p className="text-xs text-gray-600 mt-1 ml-7">
                        开启后，用户可以在提示词中使用"指定色1"、"指定色2"等标记，并在生成时选择对应颜色
                      </p>
                    </div>

                    {formData.enableSpecifiedColors && (
                      <div className="mt-4 ml-7 space-y-3">
                        <div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-violet-800">
                              已识别的指定色（{detectedColors.length}个）
                            </span>
                            <button
                              type="button"
                              onClick={addSpecifiedColor}
                              className="px-3 py-1 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 transition-colors"
                            >
                              + 手动添加
                            </button>
                          </div>

                          {detectedColors.length === 0 && formData.specifiedColors.length === 0 && (
                            <p className="text-xs text-gray-600 text-center py-4">
                              在提示词中使用"指定色1"、"指定色2"等标记即可自动识别
                            </p>
                          )}

                          <div className="space-y-2">
                            {[...detectedColors, ...formData.specifiedColors.filter(
                              sc => !detectedColors.find(dc => dc.name === sc.name)
                            )].map((color, index) => {
                              const isDetected = detectedColors.some(dc => dc.name === color.name);
                              return (
                                <div key={color.name} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-violet-200">
                                  <div className="relative flex-shrink-0">
                                    <div
                                      className="w-8 h-8 rounded-full border-2 border-gray-300 cursor-pointer shadow-inner"
                                      style={{ backgroundColor: color.color }}
                                      title="点击选择颜色"
                                    >
                                      <input
                                        type="color"
                                        value={color.color}
                                        onChange={(e) => {
                                          if (isDetected) {
                                            setDetectedColors(prev =>
                                              prev.map(c => c.name === color.name ? { ...c, color: e.target.value } : c)
                                            );
                                          } else {
                                            handleColorChange(color.name, e.target.value);
                                          }
                                        }}
                                        className="opacity-0 absolute cursor-pointer w-8 h-8"
                                      />
                                    </div>
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-600 text-white text-xs rounded-full flex items-center justify-center text-[10px] font-bold">
                                      {color.name.replace('指定色', '')}
                                    </span>
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <input
                                      type="text"
                                      value={color.label || ''}
                                      onChange={(e) => {
                                        if (isDetected) {
                                          setDetectedColors(prev =>
                                            prev.map(c => c.name === color.name ? { ...c, label: e.target.value } : c)
                                          );
                                        } else {
                                          setFormData(prev => ({
                                            ...prev,
                                            specifiedColors: prev.specifiedColors.map(c =>
                                              c.name === color.name ? { ...c, label: e.target.value } : c
                                            )
                                          }));
                                        }
                                      }}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
                                      placeholder="例如：签到处文字颜色"
                                    />
                                  </div>

                                  <input
                                    type="text"
                                    value={color.color}
                                    onChange={(e) => {
                                      const newColor = e.target.value;
                                      if (/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
                                        if (isDetected) {
                                          setDetectedColors(prev =>
                                            prev.map(c => c.name === color.name ? { ...c, color: newColor } : c)
                                          );
                                        } else {
                                          handleColorChange(color.name, newColor);
                                        }
                                      }
                                    }}
                                    className="px-2 py-1 text-xs border border-gray-300 rounded w-24 font-mono focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
                                    placeholder="#888888"
                                  />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isDetected) {
                                        setDetectedColors(prev => prev.filter(c => c.name !== color.name));
                                      } else {
                                        removeSpecifiedColor(color.name);
                                      }
                                    }}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                    title="删除"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          {detectedColors.length > 0 && (
                            <p className="text-xs text-violet-600 mt-3">
                              💡 已从提示词中自动识别到 {detectedColors.length} 个指定色，您可以在上方修改颜色
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="showMainVisual"
                      checked={formData.showMainVisual}
                      onChange={handleChange}
                      className="w-4 h-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500"
                    />
                    <span className="text-sm text-gray-700">启用通用参考图上传</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="enableReferenceBatchMode"
                      checked={formData.enableReferenceBatchMode}
                      onChange={handleChange}
                      className="w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">启用模板批量参考图</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="enabled"
                      checked={formData.enabled}
                      onChange={handleChange}
                      className="w-4 h-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500"
                    />
                    <span className="text-sm text-gray-700">启用此模板</span>
                  </label>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                  <div className="flex items-start gap-3">
                    <label className="flex items-center gap-2 cursor-pointer mt-0.5">
                      <input
                        type="checkbox"
                        name="enableCustomReferenceUpload"
                        checked={formData.enableCustomReferenceUpload}
                        onChange={handleChange}
                        className="w-4 h-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500"
                      />
                    </label>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-800 mb-1">
                        启用自定义模板参考图上传
                      </label>
                      <p className="text-xs text-gray-600">
                        开启后，生成页会在“模板参考图”区域末尾增加一个等大小上传卡片；用户上传后可预览、编辑、删除，并用这些图片替代模板预设参考图。
                      </p>
                    </div>
                  </div>

                  {formData.enableCustomReferenceUpload && (
                    <div className="mt-4 ml-7 border-t border-gray-200 pt-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name="allowMultipleCustomReferences"
                          checked={formData.allowMultipleCustomReferences}
                          onChange={handleChange}
                          className="w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500"
                        />
                        <span className="text-sm font-medium text-gray-800">允许多张自定义模板参考图</span>
                      </label>
                      <p className="mt-1 ml-6 text-xs text-gray-600">
                        默认关闭。关闭时用户一次只能替换为 1 张自定义参考图；开启后可上传并选择多张一起替代预设参考图。
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">生成参数</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    默认尺寸
                  </label>
                  <select
                    name="defaultSize"
                    value={formData.defaultSize}
                    onChange={handleChange}
                    className="input-field"
                  >
                    {SIZE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    默认质量
                  </label>
                  <select
                    name="defaultQuality"
                    value={formData.defaultQuality}
                    onChange={handleChange}
                    className="input-field"
                  >
                    {QUALITY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">提示词模板</h2>
              <p className="text-sm text-gray-600 mb-4">
                设置预设的提示词，在提示词中可以使用"参考图1"、"参考图2"等术语来引用上传的参考图
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    提示词模板 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="promptTemplate"
                    value={formData.promptTemplate}
                    onChange={handlePromptChange}
                    rows={12}
                    className="input-field resize-none font-mono text-sm"
                    placeholder="请输入提示词模板..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    负面提示词（可选）
                  </label>
                  <textarea
                    name="negativePrompt"
                    value={formData.negativePrompt}
                    onChange={handleChange}
                    rows={3}
                    className="input-field resize-none text-sm"
                    placeholder="描述你不希望出现的元素..."
                  />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">自定义输入字段</h2>
                  <p className="text-sm text-gray-600">添加让用户填写的表单项，使用 {"{{变量名}}"} 在提示词中引用</p>
                </div>
                <button
                  type="button"
                  onClick={addVariable}
                  className="p-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  添加字段
                </button>
              </div>

              <div className="space-y-4">
                {formData.variables.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
                    <Layout className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">暂无自定义字段，点击右上角添加</p>
                  </div>
                ) : (
                  <Reorder.Group axis="y" values={formData.variables} onReorder={handleReorder} className="space-y-4">
                    {formData.variables.map((variable, index) => (
                      <Reorder.Item 
                        key={variable.id} 
                        value={variable}
                        className="p-4 bg-gray-50 rounded-xl border border-gray-200 relative group/var"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-8 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors">
                            <GripVertical className="w-5 h-5" />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-start gap-4 mb-4">
                              <div className="flex-1 grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">字段名称 (Label)</label>
                                  <input
                                    type="text"
                                    value={variable.label}
                                    onChange={(e) => updateVariable(variable.id, { label: e.target.value })}
                                    className="input-field text-sm bg-white"
                                    placeholder="例如：喜报金额"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">变量名 (Key)</label>
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-400 font-mono">{"{{"}</span>
                                    <input
                                      type="text"
                                      value={variable.key}
                                      onChange={(e) => updateVariable(variable.id, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                                      className="input-field text-sm bg-white font-mono flex-1"
                                      placeholder="amount"
                                    />
                                    <span className="text-gray-400 font-mono">{"}}"}</span>
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeVariable(variable.id)}
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors mt-6"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">输入类型</label>
                                <select
                                  value={variable.type}
                                  onChange={(e) => updateVariable(variable.id, { type: e.target.value as any })}
                                  className="input-field text-sm bg-white"
                                >
                                  <option value="text">文本输入 (Text)</option>
                                  <option value="textarea">多行文本 (Textarea)</option>
                                  <option value="number">数字输入 (Number)</option>
                                  <option value="color">颜色选择 (Color)</option>
                                  <option value="image">图片上传 (Image)</option>
                                  <option value="select">下拉选择 (Select)</option>
                                </select>
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-600 mb-1">占位提示 (Placeholder)</label>
                                <input
                                  type="text"
                                  value={variable.placeholder}
                                  onChange={(e) => updateVariable(variable.id, { placeholder: e.target.value })}
                                  className="input-field text-sm bg-white"
                                  placeholder="请输入内容..."
                                />
                              </div>
                            </div>

                            {variable.type === 'select' && (
                              <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={variable.multiSelect || false}
                                      onChange={(e) => updateVariable(variable.id, { multiSelect: e.target.checked })}
                                      className="w-3.5 h-3.5 text-violet-600 rounded border-gray-300"
                                    />
                                    <span className="text-xs text-gray-600">允许多选</span>
                                  </label>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">最多选择</label>
                                    <input
                                      type="number"
                                      min={1}
                                      value={variable.maxSelections || ''}
                                      onChange={(e) => updateVariable(variable.id, {
                                        maxSelections: e.target.value ? Number(e.target.value) : undefined
                                      })}
                                      className="input-field text-sm"
                                      placeholder="例如：3"
                                    />
                                  </div>
                                </div>
                                <label className="block text-xs font-medium text-gray-600 mb-2">选项列表 (格式: 标签:值，每行一个)</label>
                                <textarea
                                  value={variable.options?.map(o => `${o.label}:${o.value}`).join('\n') || ''}
                                  onChange={(e) => {
                                    const lines = e.target.value.split('\n');
                                    const options = lines.map(line => {
                                      const [label, value] = line.split(':');
                                      return { label: label || '', value: value || label || '' };
                                    }).filter(o => o.label);
                                    updateVariable(variable.id, { options });
                                  }}
                                  rows={3}
                                  className="input-field text-sm resize-none"
                                  placeholder="金:gold&#10;银:silver&#10;铜:bronze"
                                />
                              </div>
                            )}

                            <div className="mt-3 flex items-center gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={variable.required}
                                  onChange={(e) => updateVariable(variable.id, { required: e.target.checked })}
                                  className="w-3.5 h-3.5 text-violet-600 rounded border-gray-300"
                                />
                                <span className="text-xs text-gray-600">必填</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                )}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">参考图管理</h2>
              <p className="text-sm text-gray-600 mb-4">
                上传模板预设参考图，这些图片将在提示词中以"参考图1"、"参考图2"的顺序被引用。若开启上方“自定义模板参考图上传”，用户可在生成页上传自己的模板参考图来替代这里的预设图。
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                id="reference-upload"
                disabled={uploading}
              />

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-violet-400 transition-colors mb-4">
                <label htmlFor="reference-upload" className="cursor-pointer">
                  {uploading ? (
                    <>
                      <Loader2 className="w-12 h-12 text-violet-600 mx-auto mb-4 animate-spin" />
                      <p className="text-violet-600 mb-2">上传中...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-2">点击上传参考图（可多选）</p>
                    </>
                  )}
                  <p className="text-sm text-gray-500">
                    支持 PNG, JPG, JPEG, WEBP 格式
                  </p>
                </label>
              </div>

              {referenceImages.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">
                    已上传 {referenceImages.length} 张参考图
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {referenceImages.map((image, index) => (
                      <div key={image.id} className="relative group">
                        <img
                          src={image.url}
                          alt={`参考图 ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-gray-200"
                        />
                        <div className="absolute top-2 left-2 px-2 py-1 bg-violet-600 text-white text-xs font-medium rounded">
                          参考图{index + 1}
                        </div>
                        <button
                          onClick={() => handleRemoveImage(image.id)}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <p className="text-xs text-gray-500 mt-1 truncate">{image.name}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 bg-violet-50 rounded-lg">
                    <p className="text-sm text-violet-700">
                      在提示词中使用"参考图1"、"参考图2"等术语来引用这些图片
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">使用说明</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <p>在此页面上传参考图（可上传多张）</p>
                </div>
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <p>在提示词中使用"参考图1"、"参考图2"等术语引用图片</p>
                </div>
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <p>用户使用模板时，先显示预设参考图，再让用户上传自己的图片</p>
                </div>
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                  <p>生成时，预设参考图在前，用户图片在后，统一以"参考图N"称呼</p>
                </div>
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-bold">5</span>
                  <p>开启“模板批量参考图”后，用户可上传多张主参考图，并在生成页切换到单模板批量模式轮换生成</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

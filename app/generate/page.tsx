'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Upload,
  Sparkles,
  Loader2,
  CheckCircle,
  XCircle,
  X,
  Download,
  Eye,
  Image as ImageIcon,
  RotateCcw,
  Info,
  Moon,
  Sun,
  User,
  Shield,
  History,
  LogOut
} from 'lucide-react';

const SIZE_OPTIONS = [
  { value: 'auto', label: '自动' },
  { value: '1024x1024', label: '1:1 (1024×1024)' },
  { value: '1536x1024', label: '3:2 横版 (1536×1024)' },
  { value: '1024x1536', label: '2:3 竖版 (1024×1536)' },
  { value: '2048x2048', label: '1:1 高清 (2048×2048)' },
  { value: '2048x1152', label: '16:9 宽屏 (2048×1152)' },
  { value: '1920x1080', label: '16:9 全高清 (1920×1080)' },
];

const QUALITY_OPTIONS = [
  { value: 'low', label: '速度优先', description: '快速预览，低成本' },
  { value: 'medium', label: '均衡模式', description: '默认选项，适合大多数场景' },
  { value: 'high', label: '质量优先', description: '最终出图，高细节' },
  { value: 'auto', label: '自动', description: '模型自动判断' },
];

interface ReferenceImage {
  id: string;
  url: string;
  name: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
  negativePrompt?: string;
  defaultSize: string;
  defaultQuality: string;
  mode: 'generation' | 'edit';
  referenceImages: ReferenceImage[];
  variables: Array<{
    key: string;
    label: string;
    type: string;
    required?: boolean;
    placeholder?: string;
  }>;
  allowUserPrompt?: boolean;
  userPromptPriorityDefault?: boolean;
  enableSpecifiedColors?: boolean;
  specifiedColors?: Array<{name: string; color: string; order: number}>;
}

interface SpecifiedColor {
  name: string;
  color: string;
  order: number;
  label?: string;
}

export default function GeneratePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('templateId');

  const [template, setTemplate] = useState<Template | null>(null);
  const [user, setUser] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedPresetImage, setSelectedPresetImage] = useState<ReferenceImage | null>(null);
  const [selectedUserImage, setSelectedUserImage] = useState<ReferenceImage | null>(null);
  const [userImages, setUserImages] = useState<ReferenceImage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [generationStatus, setGenerationStatus] = useState('');

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [size, setSize] = useState('auto');
  const [quality, setQuality] = useState('medium');
  const [enableUserPrompt, setEnableUserPrompt] = useState(false);
  const [userPromptPriority, setUserPromptPriority] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [specifiedColors, setSpecifiedColors] = useState<SpecifiedColor[]>([]);
  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(null);
  const [editingColorValue, setEditingColorValue] = useState('');

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    
    if (templateId) {
      fetchTemplate();
    } else {
      setLoading(false);
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [templateId]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    localStorage.setItem('darkMode', (!darkMode).toString());
    document.documentElement.classList.toggle('dark');
  };

  const fetchTemplate = async () => {
    console.log('开始获取模板, templateId:', templateId);
    try {
      const response = await fetch(`/api/templates/${templateId}`);
      const data = await response.json();
      
      console.log('API响应:', { status: response.status, hasData: !!data, dataKeys: Object.keys(data) });
      
      if (response.ok) {
        setTemplate(data);
        setSize(data.defaultSize || 'auto');
        setQuality(data.defaultQuality || 'medium');
        setEnableUserPrompt(data.allowUserPrompt !== false);
        setUserPromptPriority(data.userPromptPriorityDefault || false);

        if (data.enableSpecifiedColors && data.specifiedColors) {
          setSpecifiedColors(data.specifiedColors);
        }

        const initialForm: Record<string, string> = {};
        data.variables?.forEach((v: any) => {
          initialForm[v.key] = '';
        });
        setFormData(initialForm);
        
        console.log('模板已设置:', { name: data.name, hasPrompt: !!data.promptTemplate, promptLength: data.promptTemplate?.length, refImagesCount: data.referenceImages?.length });
      } else {
        setError('获取模板失败: ' + (data.error || '未知错误'));
        console.error('获取模板失败:', data);
      }
    } catch (error) {
      console.error('获取模板失败:', error);
      setError('网络错误，请刷新重试');
    } finally {
      setLoading(false);
      console.log('加载完成, loading设为false');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    setError('');

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('上传失败');
        }

        const data = await response.json();
        return {
          id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          url: data.url,
          name: file.name
        };
      });

      const newImages = await Promise.all(uploadPromises);
      setUserImages(prev => {
        const updatedImages = [...prev, ...newImages];
        // 如果还没有选择用户图片，自动选择第一张上传的图片
        if (!selectedUserImage && updatedImages.length > 0) {
          setSelectedUserImage(newImages[0]);
        }
        return updatedImages;
      });
    } catch (error) {
      console.error('上传失败:', error);
      setError('图片上传失败');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (imageId: string) => {
    setUserImages(prev => prev.filter(img => img.id !== imageId));
  };

  const handleFormChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const getRenderedPrompt = () => {
    if (!template?.promptTemplate) return '';
    
    let prompt = template.promptTemplate;
    for (const [key, value] of Object.entries(formData)) {
      if (value) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        prompt = prompt.replace(regex, value);
      }
    }
    
    if (enableUserPrompt && userPrompt.trim()) {
      if (userPromptPriority) {
        prompt = userPrompt.trim() + '\n\n' + prompt;
      } else {
        prompt = prompt + '\n\n' + userPrompt.trim();
      }
    }

    specifiedColors.forEach(color => {
      const regex = new RegExp(color.name, 'g');
      prompt = prompt.replace(regex, color.color);
    });
    
    return prompt;
  };

  const insertColorMarker = (colorIndex: number) => {
    const marker = `指定色${colorIndex}`;
    setUserPrompt(prev => prev + marker);
  };

  const detectMaxColorNumber = (text: string): number => {
    const regex = /指定色(\d+)/g;
    const matches = [...text.matchAll(regex)];
    let max = 0;
    matches.forEach(match => {
      const num = parseInt(match[1]);
      if (num > max) max = num;
    });
    return max;
  };

  const handleAddNewColorMarker = () => {
    const maxNum = detectMaxColorNumber(userPrompt);
    const nextNum = maxNum + 1;
    const marker = `指定色${nextNum}`;

    setUserPrompt(prev => prev + marker);
    
    const existingColor = specifiedColors.find(c => c.name === marker);
    if (!existingColor) {
      setSpecifiedColors(prev => [...prev, {
        name: marker,
        color: '#888888',
        order: nextNum
      }]);
    }
  };

  const handleColorValueChange = (index: number, newColor: string) => {
    setSpecifiedColors(prev => prev.map((c, i) => 
      i === index ? { ...c, color: newColor } : c
    ));
  };

  const handleUserPromptChange = (value: string) => {
    setUserPrompt(value);

    const regex = /指定色(\d+)/g;
    const matches = [...value.matchAll(regex)];
    const detected = new Set<string>();
    
    matches.forEach(match => {
      detected.add(match[0]);
    });

    setSpecifiedColors(prev => {
      const updated = [...prev];

      detected.forEach(colorName => {
        const existing = updated.find(c => c.name === colorName);
        if (!existing) {
          const num = parseInt(colorName.replace('指定色', ''));
          updated.push({
            name: colorName,
            color: '#888888',
            order: num,
            label: ''
          });
        }
      });

      const filtered = updated.filter(color => detected.has(color.name));

      return filtered.sort((a, b) => a.order - b.order);
    });
  };

  const getAllImages = (): ReferenceImage[] => {
    const allImages: ReferenceImage[] = [];
    
    if (selectedPresetImage) {
      allImages.push(selectedPresetImage);
    }
    
    if (selectedUserImage) {
      allImages.push(selectedUserImage);
    }
    
    return allImages;
  };

  const handleGenerate = async () => {
    const allImages = getAllImages();
    
    if (allImages.length === 0) {
      setError('请至少选择一张参考图');
      return;
    }

    const renderedPrompt = getRenderedPrompt();
    
    if (!renderedPrompt || !renderedPrompt.trim()) {
      setError('模板缺少提示词，请联系管理员检查模板配置');
      return;
    }

    setError('');
    setResult(null);
    setGenerating(true);
    setGenerationStatus('正在准备请求...');

    try {
      setGenerationStatus('正在上传图片...');
      
      const requestData = {
        userId: user?.id,
        templateId: template?.id,
        templateName: template?.name,
        mode: template?.mode || 'generation',
        promptTemplate: renderedPrompt,
        negativePrompt: template?.negativePrompt,
        variables: formData,
        size,
        quality,
        referenceImages: selectedPresetImage ? [selectedPresetImage.url] : [],
        images: selectedUserImage ? [selectedUserImage.url] : [],
        userPrompt: enableUserPrompt ? userPrompt : null,
        userPromptPriority: userPromptPriority
      };
      
      console.log('=== 前端发送的生成请求 ===');
      console.log('请求数据:', JSON.stringify(requestData, null, 2));
      console.log('预设参考图:', selectedPresetImage);
      console.log('用户图片:', selectedUserImage);
      console.log('最终提示词:', renderedPrompt);
      
      const response = await fetch('/api/image/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();

      setGenerationStatus('');

      if (response.ok && data.success) {
        setResult(data);
      } else {
        setError(data.message || data.error || '生成失败，请重试');
      }
    } catch (error: any) {
      console.error('生成失败:', error);
      setGenerationStatus('');
      setError('网络错误：' + (error.message || '请检查网络连接'));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (result?.imageUrl) {
      const link = document.createElement('a');
      link.href = result.imageUrl;
      link.download = `generated_${Date.now()}.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError('');
    setUserImages([]);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/auth');
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-500 ${darkMode ? 'bg-gray-950' : 'bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100'}`}>
        <div className="text-center">
          <Loader2 className={`w-12 h-12 animate-spin mx-auto mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`} />
          <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>加载模板中...</p>
        </div>
      </div>
    );
  }

  const allImages = getAllImages();

  return (
    <div className={`min-h-screen transition-colors duration-500 ${darkMode ? 'bg-gray-950' : 'bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100'}`}>
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
            onClick={() => setPreviewImage(null)}
          >
            <motion.img
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              src={previewImage}
              alt="预览"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-500 ${darkMode ? 'bg-gray-950/80 border-gray-800' : 'bg-white/70 border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button 
            onClick={() => router.push('/templates')}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-700'}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className={`text-2xl font-bold transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {template?.name || '图片生成'}
            </h1>
            <p className={`text-sm transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {template?.mode === 'edit' ? '编辑模式' : '生成模式'}
            </p>
          </div>
          
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

          {user ? (
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
                    className={`absolute right-0 top-full mt-2 w-56 rounded-xl shadow-lg border overflow-hidden transition-colors duration-500 ${
                      darkMode 
                        ? 'bg-gray-900 border-gray-800' 
                        : 'bg-white border-gray-200'
                    }`}
                    onClick={(e) => e.stopPropagation()}
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
                      {(user.role === 'admin' || user.username === 'admin') && (
                        <div className="mt-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 w-fit ${
                            darkMode 
                              ? 'bg-amber-900/50 text-amber-400' 
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            <Shield className="w-3 h-3" />
                            管理员
                          </span>
                        </div>
                      )}
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
                              ? 'text-amber-400 hover:bg-amber-950/30' 
                              : 'text-amber-700 hover:bg-amber-50'
                          }`}
                        >
                          <Shield className="w-4 h-4" />
                          用户管理
                        </button>
                      )}

                      <div className={`my-2 border-t transition-colors duration-500 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`} />

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
          ) : (
            <button
              onClick={() => router.push('/auth')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                darkMode 
                  ? 'bg-white text-gray-900 hover:bg-gray-200' 
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              登录
            </button>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`p-4 rounded-xl flex items-start gap-3 transition-colors duration-500 ${
                    darkMode 
                      ? 'bg-red-900/30 border border-red-800 text-red-400' 
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">生成失败</p>
                    <p className="text-sm">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {generating && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`p-4 rounded-xl flex items-start gap-3 transition-colors duration-500 ${
                    darkMode 
                      ? 'bg-blue-900/30 border border-blue-800 text-blue-400' 
                      : 'bg-blue-50 border border-blue-200 text-blue-700'
                  }`}
                >
                  <Loader2 className="w-5 h-5 flex-shrink-0 mt-0.5 animate-spin" />
                  <div>
                    <p className="font-medium mb-1">正在生成中</p>
                    <p className="text-sm">{generationStatus || '请稍候...'}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {template?.referenceImages && template.referenceImages.length > 0 && (
              <div className={`rounded-2xl shadow-sm border p-6 transition-colors duration-500 ${
                darkMode 
                  ? 'bg-gray-900 border-gray-800' 
                  : 'bg-white border-gray-200'
              }`}>
                <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  <ImageIcon className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                  选择参考图
                </h2>
                <p className={`text-sm mb-4 transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  请选择一张参考图作为模板
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {template.referenceImages.map((image, index) => (
                    <div 
                      key={image.id} 
                      className={`relative cursor-pointer group rounded-lg overflow-hidden transition-all ${
                        selectedPresetImage?.id === image.id
                          ? 'ring-2 ring-violet-500 ring-offset-2'
                          : 'hover:ring-2 hover:ring-gray-300'
                      }`}
                      onClick={() => setSelectedPresetImage(selectedPresetImage?.id === image.id ? null : image)}
                    >
                      <img
                        src={image.url}
                        alt={`预设参考图 ${index + 1}`}
                        className="w-full h-32 object-contain"
                        style={{ objectPosition: 'center top' }}
                      />
                      <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium ${
                        selectedPresetImage?.id === image.id
                          ? 'bg-violet-600 text-white'
                          : 'bg-gray-800 text-white'
                      }`}>
                        {selectedPresetImage?.id === image.id ? '✓ 已选择' : `参考图${index + 1}`}
                      </div>
                      <p className={`text-xs mt-1 truncate ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{image.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={`rounded-2xl shadow-sm border p-6 transition-colors duration-500 ${
              darkMode 
                ? 'bg-gray-900 border-gray-800' 
                : 'bg-white border-gray-200'
              }`}>
              <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                <Upload className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                上传主视觉
              </h2>
              <p className={`text-sm mb-4 transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                上传您的主视觉图片（如果模板需要）
              </p>

              {userImages.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {userImages.map((image, index) => (
                      <div 
                        key={image.id} 
                        className={`relative cursor-pointer group rounded-lg overflow-hidden transition-all ${
                          selectedUserImage?.id === image.id
                            ? 'ring-2 ring-green-500 ring-offset-2'
                            : 'hover:ring-2 hover:ring-gray-300'
                        }`}
                        onClick={() => setSelectedUserImage(selectedUserImage?.id === image.id ? null : image)}
                      >
                        <img
                          src={image.url}
                          alt={`用户上传 ${index + 1}`}
                          className="w-full h-32 object-contain"
                          style={{ objectPosition: 'center top' }}
                        />
                        <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium ${
                          selectedUserImage?.id === image.id
                            ? 'bg-green-600 text-white'
                            : 'bg-green-600 text-white'
                        }`}>
                          {selectedUserImage?.id === image.id ? '✓ 已选择' : `参考图${index + 1}`}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveImage(image.id);
                          }}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <label className={`flex-1 py-2 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                      darkMode 
                        ? 'border-gray-700 hover:border-gray-600 text-gray-400' 
                        : 'border-gray-300 hover:border-gray-400 text-gray-600'
                    }`}>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploadingImage}
                      />
                      <span className="text-sm">
                        {uploadingImage ? '上传中...' : '+ 添加更多图片'}
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  darkMode 
                    ? 'border-gray-700 hover:border-gray-600' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                    id="user-image-upload"
                    disabled={uploadingImage}
                  />
                  <label htmlFor="user-image-upload" className="cursor-pointer">
                    {uploadingImage ? (
                      <>
                        <Loader2 className={`w-12 h-12 mx-auto mb-4 animate-spin ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                        <p className={`mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>上传中...</p>
                      </>
                    ) : (
                      <>
                        <Upload className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                        <p className={`mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>点击上传主视觉图片（可多选）</p>
                      </>
                    )}
                    <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      支持 PNG, JPG, JPEG, WEBP 格式
                    </p>
                  </label>
                </div>
              )}
            </div>

            {template?.variables && template.variables.length > 0 && (
              <div className={`rounded-2xl shadow-sm border p-6 transition-colors duration-500 ${
                darkMode 
                  ? 'bg-gray-900 border-gray-800' 
                  : 'bg-white border-gray-200'
              }`}>
                <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  <Info className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                  填写信息
                </h2>
                
                <div className="space-y-4">
                  {template.variables.map((variable) => (
                    <div key={variable.key}>
                      <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {variable.label}
                        {variable.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {variable.type === 'textarea' ? (
                        <textarea
                          value={formData[variable.key] || ''}
                          onChange={(e) => handleFormChange(variable.key, e.target.value)}
                          rows={3}
                          className={`w-full px-4 py-3 rounded-lg border transition-colors duration-300 focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none resize-none ${
                            darkMode 
                              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                          }`}
                          placeholder={variable.placeholder || `请输入${variable.label}`}
                        />
                      ) : (
                        <input
                          type="text"
                          value={formData[variable.key] || ''}
                          onChange={(e) => handleFormChange(variable.key, e.target.value)}
                          className={`w-full px-4 py-3 rounded-lg border transition-colors duration-300 focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none ${
                            darkMode 
                              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                          }`}
                          placeholder={variable.placeholder || `请输入${variable.label}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={`rounded-2xl shadow-sm border p-6 transition-colors duration-500 ${
              darkMode 
                ? 'bg-gray-900 border-gray-800' 
                : 'bg-white border-gray-200'
            }`}>
              <h2 className={`text-lg font-semibold mb-4 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>生成参数</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    输出尺寸
                  </label>
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className={`w-full px-4 py-3 rounded-lg border transition-colors duration-300 focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none ${
                      darkMode 
                        ? 'bg-gray-800 border-gray-700 text-white' 
                        : 'bg-white border-gray-200 text-gray-900'
                    }`}
                  >
                    {SIZE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 transition-colors duration-500 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    质量
                  </label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className={`w-full px-4 py-3 rounded-lg border transition-colors duration-300 focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none ${
                      darkMode 
                        ? 'bg-gray-800 border-gray-700 text-white' 
                        : 'bg-white border-gray-200 text-gray-900'
                    }`}
                  >
                    {QUALITY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={`mt-4 pt-4 border-t transition-colors duration-500 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                {template?.allowUserPrompt !== false && (
                  <>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableUserPrompt}
                          onChange={(e) => setEnableUserPrompt(e.target.checked)}
                          className={`w-4 h-4 rounded border ${
                            darkMode 
                              ? 'bg-gray-800 border-gray-600 text-gray-400 focus:ring-gray-500' 
                              : 'text-gray-600 border-gray-300 focus:ring-gray-500'
                          }`}
                        />
                        <span className={`text-sm font-medium transition-colors duration-500 ${
                          darkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>补充提示词</span>
                      </label>
                    </div>
                    
                    {enableUserPrompt && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                        <div className="relative flex-1">
                          {userPrompt && (
                            <div 
                              className={`absolute inset-0 px-4 py-3 rounded-lg border pointer-events-none whitespace-pre-wrap break-words text-sm font-mono overflow-y-auto ${
                                darkMode 
                                  ? 'bg-gray-800 border-gray-700' 
                                  : 'bg-white border-gray-200'
                              }`}
                              style={{ color: 'transparent' }}
                            >
                              {userPrompt.split(/(指定色\d+)/).map((part, index) => {
                                if (/^指定色\d+$/.test(part)) {
                                  return (
                                    <span key={index} className="bg-violet-200 text-violet-900 rounded px-1 font-semibold">
                                      {part}
                                    </span>
                                  );
                                }
                                return <span key={index}>{part}</span>;
                              })}
                            </div>
                          )}
                          <textarea
                            value={userPrompt}
                            onChange={(e) => handleUserPromptChange(e.target.value)}
                            rows={4}
                            className={`w-full px-4 py-3 rounded-lg border transition-colors duration-300 focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none resize-none text-sm font-mono ${
                              darkMode 
                                ? 'bg-transparent border-gray-700 text-white placeholder-gray-500' 
                                : 'bg-transparent border-gray-200 text-gray-900 placeholder-gray-400'
                            } ${userPrompt ? 'relative z-10 bg-transparent' : ''}`}
                            placeholder="请输入补充提示词..."
                            style={userPrompt ? { 
                              color: 'transparent', 
                              caretColor: darkMode ? '#fff' : '#000',
                              backgroundColor: 'transparent'
                            } : {}}
                          />
                        </div>
                          {(template?.enableSpecifiedColors) && (
                            <button
                              type="button"
                              onClick={handleAddNewColorMarker}
                              className={`ml-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                                darkMode
                                  ? 'bg-violet-900/50 text-violet-300 hover:bg-violet-900/70 border border-violet-700'
                                  : 'bg-violet-100 text-violet-700 hover:bg-violet-200 border border-violet-300'
                              }`}
                              title="点击添加指定色标记"
                            >
                              指定颜色+
                            </button>
                          )}
                        </div>

                        {specifiedColors.length > 0 && (
                          <div className={`p-4 rounded-lg border ${
                            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-violet-50 border-violet-200'
                          }`}>
                            <div className="flex items-center justify-between mb-3">
                              <span className={`text-sm font-medium ${
                                darkMode ? 'text-gray-300' : 'text-violet-800'
                              }`}>
                                指定色配置
                              </span>
                              <span className={`text-xs ${
                                darkMode ? 'text-gray-500' : 'text-violet-600'
                              }`}>
                                共 {specifiedColors.length} 个
                              </span>
                            </div>

                            <div className="space-y-2">
                              {specifiedColors.map((color, index) => (
                                <div 
                                  key={`${color.name}-${index}`}
                                  className={`flex items-center gap-3 p-3 rounded-lg ${
                                    darkMode ? 'bg-gray-900/50' : 'bg-white'
                                  }`}
                                >
                                  <div className="relative flex-shrink-0">
                                    <div
                                      className="w-8 h-8 rounded-full border-2 border-gray-300 cursor-pointer shadow-inner transition-transform hover:scale-110"
                                      style={{ backgroundColor: color.color }}
                                      title="点击选择颜色"
                                      onClick={() => setSelectedColorIndex(selectedColorIndex === index ? null : index)}
                                    >
                                      <input
                                        type="color"
                                        value={color.color}
                                        onChange={(e) => handleColorValueChange(index, e.target.value)}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                      />
                                    </div>
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-600 text-white text-xs rounded-full flex items-center justify-center text-[10px] font-bold">
                                      {color.name.replace('指定色', '')}
                                    </span>
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <span className={`text-sm font-medium ${
                                      darkMode ? 'text-gray-400' : 'text-gray-700'
                                    }`}>
                                      {color.label || color.name}
                                    </span>
                                  </div>

                                  <input
                                    type="text"
                                    value={selectedColorIndex === index ? editingColorValue : color.color}
                                    onChange={(e) => {
                                      setEditingColorValue(e.target.value);
                                      handleColorValueChange(index, e.target.value);
                                    }}
                                    onFocus={() => {
                                      setSelectedColorIndex(index);
                                      setEditingColorValue(color.color);
                                    }}
                                    onBlur={() => {
                                      setSelectedColorIndex(null);
                                    }}
                                    className={`px-2 py-1 text-xs border rounded w-24 font-mono ${
                                      darkMode 
                                        ? 'bg-gray-900 border-gray-700 text-gray-300' 
                                        : 'bg-white border-gray-300 text-gray-800'
                                    }`}
                                    placeholder="#888888"
                                  />
                                </div>
                              ))}
                            </div>

                            <p className={`text-xs mt-3 ${
                              darkMode ? 'text-gray-500' : 'text-violet-600'
                            }`}>
                              💡 点击颜色圆形或输入十六进制颜色值来修改颜色
                            </p>
                          </div>
                        )}
                        
                        <div className={`flex items-center gap-3 p-3 rounded-lg ${
                          darkMode ? 'bg-amber-900/30' : 'bg-amber-50'
                        }`}>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={userPromptPriority}
                              onChange={(e) => setUserPromptPriority(e.target.checked)}
                              className="w-4 h-4 rounded border-amber-300 focus:ring-amber-500 text-amber-600"
                            />
                            <span className={`text-sm font-medium ${
                              darkMode ? 'text-amber-400' : 'text-amber-800'
                            }`}>
                              重要：开启后补充提示词将放在预设提示词前面
                            </span>
                          </label>
                        </div>
                      </motion.div>
                    )}
                  </>
                )}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || allImages.length === 0}
              className={`w-full py-4 text-lg font-medium rounded-lg flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                darkMode 
                  ? 'bg-white text-gray-900 hover:bg-gray-200 shadow-gray-900/20' 
                  : 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-200'
              }`}
            >
              {generating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  开始生成
                </>
              )}
            </button>

            {allImages.length === 0 && (
              <p className={`text-sm text-center -mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                请先选择参考图
              </p>
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`rounded-2xl p-6 border transition-colors duration-500 ${
                    darkMode 
                      ? 'bg-green-900/30 border-green-800' 
                      : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className={`w-6 h-6 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                    <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>生成成功！</h2>
                  </div>

                  <div className="relative group cursor-pointer" onClick={() => setPreviewImage(result.imageUrl)}>
                    <img
                      src={result.imageUrl}
                      alt="生成结果"
                      className="w-full rounded-xl shadow-md mb-4 object-contain max-h-96"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all rounded-xl">
                      <Eye className="w-12 h-12 text-white" />
                    </div>
                  </div>

                  <div className="flex gap-3 mb-4">
                    <button
                      onClick={handleDownload}
                      className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${
                        darkMode 
                          ? 'bg-white text-gray-900 hover:bg-gray-200' 
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                    >
                      <Download className="w-5 h-5" />
                      下载图片
                    </button>
                    <button
                      onClick={handleReset}
                      className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 border ${
                        darkMode 
                          ? 'bg-gray-800 text-white border-gray-700 hover:bg-gray-700' 
                          : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <RotateCcw className="w-5 h-5" />
                      重新生成
                    </button>
                  </div>

                  {(user.role === 'admin' || user.username === 'admin') && result.revisedPrompt && (
                    <div className={`p-4 rounded-lg border ${
                      darkMode 
                        ? 'bg-gray-800 border-gray-700' 
                        : 'bg-white border-green-200'
                    }`}>
                      <p className={`text-xs font-medium mb-2 flex items-center gap-2 ${
                        darkMode ? 'text-gray-400' : 'text-gray-700'
                      }`}>
                        <Shield className="w-4 h-4" />
                        管理员可见 - 实际使用的提示词：
                      </p>
                      <pre className={`text-xs whitespace-pre-wrap max-h-48 overflow-y-auto ${
                        darkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        {result.revisedPrompt}
                      </pre>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {allImages.length > 0 && !result && (
              <div className={`rounded-2xl p-6 border transition-colors duration-500 ${
                darkMode 
                  ? 'bg-gray-900 border-gray-800' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  <Sparkles className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                  已选参考图
                </h3>
                <div className={`rounded-lg p-4 space-y-3 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  {selectedPresetImage && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className={`px-2 py-1 font-medium rounded ${
                        darkMode ? 'bg-violet-600 text-white' : 'bg-violet-600 text-white'
                      }`}>
                        参考图1
                      </span>
                      <span className={`truncate flex-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{selectedPresetImage.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        darkMode ? 'bg-violet-900/50 text-violet-400' : 'bg-violet-100 text-violet-700'
                      }`}>预设</span>
                    </div>
                  )}
                  {selectedUserImage && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className={`px-2 py-1 font-medium rounded ${
                        darkMode ? 'bg-green-600 text-white' : 'bg-green-600 text-white'
                      }`}>
                        参考图{selectedPresetImage ? '2' : '1'}
                      </span>
                      <span className={`truncate flex-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{selectedUserImage.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        darkMode ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-700'
                      }`}>用户上传</span>
                    </div>
                  )}
                </div>
                <div className={`mt-4 p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                    💡 在提示词中使用"参考图1"、"参考图2"等术语来引用对应的图片
                  </p>
                </div>
              </div>
            )}

            {template && !result && (
              <div className={`rounded-2xl p-6 border transition-colors duration-500 ${
                darkMode 
                  ? 'bg-gray-900 border-gray-800' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  <Info className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                  模板信息
                </h3>
                <div className={`rounded-lg p-4 space-y-3 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                  <div>
                    <span className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>模板名称：</span>
                    <span className={`text-sm font-medium ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{template.name}</span>
                  </div>
                  {template.description && (
                    <div>
                      <span className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>模板描述：</span>
                      <span className={`text-sm ml-2 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>{template.description}</span>
                    </div>
                  )}
                  <div>
                    <span className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>生成模式：</span>
                    <span className={`text-sm font-medium ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {template.mode === 'edit' ? '图片编辑' : '图片生成'}
                    </span>
                  </div>
                  <div>
                    <span className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>默认尺寸：</span>
                    <span className={`text-sm font-medium ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{template.defaultSize}</span>
                  </div>
                  <div>
                    <span className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>默认质量：</span>
                    <span className={`text-sm font-medium ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{template.defaultQuality}</span>
                  </div>
                  <div>
                    <span className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>预设参考图：</span>
                    <span className={`text-sm font-medium ml-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{template.referenceImages?.length || 0} 张</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

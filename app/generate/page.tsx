'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { UserAvatar } from '@/components/UserAvatar';
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
  showMainVisual?: boolean;
  variables: Array<{
    id: string;
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'color' | 'select' | 'image';
    placeholder?: string;
    required?: boolean;
    defaultValue?: string;
    options?: Array<{ label: string; value: string }>;
  }>;
  allowUserPrompt?: boolean;
  userPromptPriorityDefault?: boolean;
  enableSpecifiedColors?: boolean;
  specifiedColors?: Array<{name: string; color: string; order: number; label?: string}>;
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
  const templateId = searchParams.get('templateId') || searchParams.get('id');

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
  const [variableImages, setVariableImages] = useState<Record<string, ReferenceImage | null>>({});
  const [size, setSize] = useState('auto');
  const [quality, setQuality] = useState('medium');
  const [enableUserPrompt, setEnableUserPrompt] = useState(false);
  const [userPromptPriority, setUserPromptPriority] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [specifiedColors, setSpecifiedColors] = useState<SpecifiedColor[]>([]);
  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(null);
  const [editingColorValue, setEditingColorValue] = useState('');

  // 预览图片缩放和拖拽状态
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const historyId = searchParams.get('historyId');

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
  }, [templateId, historyId]);

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
        const initialImages: Record<string, ReferenceImage | null> = {};
        data.variables?.forEach((v: any) => {
          if (v.type === 'image') {
            initialImages[v.key] = null;
          } else {
            initialForm[v.key] = '';
          }
        });

        // 如果有 historyId，直接在这里合并数据，避免多次渲染冲突
        if (historyId) {
          try {
            const historyResponse = await fetch(`/api/history/${historyId}`);
            if (historyResponse.ok) {
              const historyData = await historyResponse.json();
              if (historyData.configJson) {
                const config = JSON.parse(historyData.configJson);
                if (config.formData) Object.assign(initialForm, config.formData);
                if (config.variableImages) Object.assign(initialImages, config.variableImages);
                
                if (config.selectedUserImage) {
                  setSelectedUserImage(config.selectedUserImage);
                  setUserImages(prev => {
                    if (!prev.find(img => img.id === config.selectedUserImage.id)) {
                      return [config.selectedUserImage, ...prev];
                    }
                    return prev;
                  });
                }
                if (config.userPrompt) setUserPrompt(config.userPrompt);
                if (config.enableUserPrompt !== undefined) setEnableUserPrompt(config.enableUserPrompt);
                if (config.userPromptPriority !== undefined) setUserPromptPriority(config.userPromptPriority);
                if (config.size) setSize(config.size);
                if (config.quality) setQuality(config.quality);
              }
            }
          } catch (err) {
            console.error('加载历史状态失败:', err);
          }
        }

        setFormData(initialForm);
        setVariableImages(initialImages);
        
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

  const handleVariableImageUpload = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!response.ok) throw new Error('上传失败');
      const data = await response.json();
      const newImage = {
        id: `var_${key}_${Date.now()}`,
        url: data.url,
        name: file.name
      };
      setVariableImages(prev => ({ ...prev, [key]: newImage }));
    } catch (error) {
      console.error('上传变量图片失败:', error);
      setError('图片上传失败');
    } finally {
      setUploadingImage(false);
    }
  };

  const getRenderedPrompt = () => {
    if (!template?.promptTemplate) return '';
    
    let prompt = template.promptTemplate;

    // 1. 处理所有自定义变量替换（文本、数字、下拉、颜色等）
    // 支持 {{key}} 和直接使用 key (作为备选，防止用户忘记大括号)
    template.variables?.forEach(v => {
      if (v.type !== 'image') {
        const value = formData[v.key] || '';
        // 替换 {{key}}
        const bracedRegex = new RegExp(`{{${v.key}}}`, 'g');
        prompt = prompt.replace(bracedRegex, value);
        // 替换直接的 key (例如 var_1)
        const rawRegex = new RegExp(`\\b${v.key}\\b`, 'g');
        prompt = prompt.replace(rawRegex, value);
      }
    });

    // 2. 处理图片变量替换为 "参考图N"
    // 计算顺序：预设参考图 -> 变量中的图片 -> 通用上传的参考图
    const presetCount = template.referenceImages?.length || 0;
    const imageVariables = template.variables?.filter(v => v.type === 'image') || [];
    
    imageVariables.forEach((v, index) => {
      const refIndex = presetCount + index + 1;
      const regex = new RegExp(`{{${v.key}}}`, 'g');
      // 如果用户上传了图片变量，则在提示词中标识为参考图N
      prompt = prompt.replace(regex, `参考图${refIndex}`);
    });

    // 3. 如果启用了通用参考图上传，计算其索引
    // 通用参考图的索引在预设图和变量图之后
    if (template.showMainVisual !== false) {
      const mainVisualIndex = presetCount + imageVariables.length + 1;
      // 虽然用户没直接引用通用参考图变量，但如果他们在提示词里写了 "参考图X"，AI就能对应上
    }

    // 4. 处理用户补充提示词
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
    const combinedPrompt = (template?.promptTemplate || '') + '\n\n' + text;
    const regex = /指定色(\d+)/g;
    const matches = [...combinedPrompt.matchAll(regex)];
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

    const combinedPrompt = (template?.promptTemplate || '') + '\n\n' + value;
    const regex = /指定色(\d+)/g;
    const matches = [...combinedPrompt.matchAll(regex)];
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
          const templateColor = template?.specifiedColors?.find(c => c.name === colorName);
          updated.push({
            name: colorName,
            color: templateColor ? templateColor.color : '#888888',
            order: num,
            label: templateColor ? templateColor.label : ''
          });
        }
      });

      const filtered = updated.filter(color => detected.has(color.name));

      return filtered.sort((a, b) => a.order - b.order);
    });
  };

  const getAllImages = (): ReferenceImage[] => {
    const allImages: ReferenceImage[] = [];
    
    // 1. 预设图片
    if (template?.referenceImages) {
      allImages.push(...template.referenceImages);
    }
    
    // 2. 变量图片 (保持和 getRenderedPrompt 中一样的顺序)
    const imageVariables = template?.variables?.filter(v => v.type === 'image') || [];
    imageVariables.forEach(v => {
      const img = variableImages[v.key];
      if (img) {
        allImages.push(img);
      }
    });

    // 3. 通用参考图 (仅在启用时添加)
    if (template?.showMainVisual !== false && selectedUserImage) {
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
      
      const imageVariables = template?.variables?.filter(v => v.type === 'image') || [];
      const variableImageUrls = imageVariables
        .map(v => variableImages[v.key]?.url)
        .filter(url => !!url) as string[];

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
        referenceImages: template?.referenceImages?.map(img => img.url) || [],
        images: [...variableImageUrls, ...(selectedUserImage ? [selectedUserImage.url] : [])],
        userPrompt: enableUserPrompt ? userPrompt : null,
        userPromptPriority: userPromptPriority,
        config: {
          formData,
          variableImages,
          selectedUserImage,
          userPrompt,
          enableUserPrompt,
          userPromptPriority,
          size,
          quality
        }
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

      <header className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-500 ${darkMode ? 'bg-gray-950/80 border-gray-800' : 'bg-white/70 border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center relative">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/templates')}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-700'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="hidden md:block">
              <h1 className={`text-xl font-bold transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {template?.name || '图片生成'}
              </h1>
              <p className={`text-xs transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {template?.mode === 'edit' ? '编辑模式' : '生成模式'}
              </p>
            </div>
          </div>

          {/* Centered Logo - Enlarged by 20% (h-12 * 1.2 = h-14.4 -> h-14) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <img 
              src={darkMode ? "/img/white.png" : "/img/black.png"} 
              alt="HAIPablo Logo" 
              className="h-14 object-contain cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => router.push('/')}
            />
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
            {user?.role === 'admin' && (
              <span className={`hidden sm:flex px-2 py-1 text-xs font-medium rounded-full items-center gap-1 w-fit ${
                darkMode 
                  ? 'bg-amber-900/50 text-amber-400 border border-amber-800' 
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                <Shield className="w-3 h-3" />
                管理员
              </span>
            )}
            {user?.role === 'sub_admin' && (
              <span className={`hidden sm:flex px-2 py-1 text-xs font-medium rounded-full items-center gap-1 w-fit ${
                darkMode 
                  ? 'bg-blue-900/50 text-blue-400 border border-blue-800' 
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                <Shield className="w-3 h-3" />
                子管理员
              </span>
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

            {user ? (
              <div className="relative user-menu-container">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <UserAvatar user={user} size="lg" darkMode={darkMode} />
                  <div className="hidden lg:block text-left">
                    <p className={`text-sm font-medium transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{user.name || user.username}</p>
                    <p className={`text-xs transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{user.email || user.username}</p>
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
                          <UserAvatar user={user} size="lg" darkMode={darkMode} />
                          <div>
                            <p className={`font-semibold transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{user.name || user.username}</p>
                            <p className={`text-xs transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{user.email || user.username}</p>
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
                          {user.role === 'admin' && (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 w-fit ${
                              darkMode 
                                ? 'bg-amber-900/50 text-amber-400' 
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              <Shield className="w-3 h-3" />
                              管理员
                            </span>
                          )}
                          {user.role === 'sub_admin' && (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 w-fit ${
                              darkMode 
                                ? 'bg-blue-900/50 text-blue-400' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              <Shield className="w-3 h-3" />
                              子管理员
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

                        {(user.role === 'admin' || user.role === 'sub_admin') && (
                          <button
                            onClick={() => router.push('/admin/users')}
                            className={`w-full px-4 py-2.5 text-left rounded-lg transition-colors flex items-center gap-3 ${
                              darkMode 
                                ? 'text-amber-400 hover:bg-amber-950/30' 
                                : 'text-amber-700 hover:bg-amber-50'
                            }`}
                          >
                            <Shield className="w-4 h-4" />
                            {user.role === 'admin' ? '用户管理' : '人员列表'}
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

            <div className={`rounded-2xl shadow-sm border p-8 transition-colors duration-500 ${
              darkMode 
                ? 'bg-gray-900 border-gray-800' 
                : 'bg-white border-gray-200'
            }`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
                {/* 第一行：上传参考图 与 生成参数 */}
                <div className={`${template?.showMainVisual !== false ? 'space-y-6' : 'hidden'}`}>
                  <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    <Upload className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                    上传参考图
                  </h2>
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
                                className="w-full h-24 object-contain"
                                style={{ objectPosition: 'center' }}
                              />
                            <div className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              selectedUserImage?.id === image.id ? 'bg-green-600 text-white' : 'bg-green-600 text-white'
                            }`}>
                              {selectedUserImage?.id === image.id ? '✓' : `图${index + 1}`}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveImage(image.id); }}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <XCircle className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <label className={`block py-2 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                        darkMode ? 'border-gray-700 hover:border-gray-600 text-gray-400' : 'border-gray-300 hover:border-gray-400 text-gray-600'
                      }`}>
                        <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                        <span className="text-xs">{uploadingImage ? '上传中...' : '+ 添加图片'}</span>
                      </label>
                    </div>
                  ) : (
                    <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                      darkMode ? 'border-gray-700 hover:border-gray-600' : 'border-gray-300 hover:border-gray-400'
                    }`}>
                      <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" id="user-image-upload" disabled={uploadingImage} />
                      <label htmlFor="user-image-upload" className="cursor-pointer">
                        <Upload className={`w-8 h-8 mx-auto mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>点击上传参考图片</p>
                      </label>
                    </div>
                  )}
                </div>

                <div className={`space-y-6 ${template?.showMainVisual === false ? 'md:col-span-2' : ''}`}>
                  <h2 className={`text-lg font-semibold mb-4 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>生成参数</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>输出尺寸</label>
                      <select value={size} onChange={(e) => setSize(e.target.value)} className={`w-full px-3 py-2 rounded-lg border outline-none text-sm ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                        {SIZE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>质量</label>
                      <select value={quality} onChange={(e) => setQuality(e.target.value)} className={`w-full px-3 py-2 rounded-lg border outline-none text-sm ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                        {QUALITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 第二行：补充提示词 与 颜色配置 */}
                <div className="pt-6 border-t border-dashed border-gray-200 dark:border-gray-700">
                  {template?.allowUserPrompt !== false && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setEnableUserPrompt(!enableUserPrompt)}>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            enableUserPrompt ? 'border-violet-500 bg-violet-500' : darkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-white'
                          }`}>
                            {enableUserPrompt && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className="text-sm font-medium">补充提示词</span>
                        </div>
                        {enableUserPrompt && (
                          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setUserPromptPriority(!userPromptPriority)}>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              userPromptPriority ? 'border-amber-500 bg-amber-500' : darkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-white'
                            }`}>
                              {userPromptPriority && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <span className="text-sm font-medium">高权重自定义</span>
                          </div>
                        )}
                      </div>
                      {enableUserPrompt && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4">
                          <div className="flex flex-col gap-3">
                            <div className="relative w-full">
                              {userPrompt && (
                                <div className={`absolute inset-0 px-4 py-3 rounded-lg border pointer-events-none whitespace-pre-wrap break-words text-sm font-mono overflow-y-auto ${
                                  darkMode 
                                    ? 'bg-gray-800 border-gray-700 text-white' 
                                    : 'bg-white border-gray-200 text-gray-900'
                                }`}>
                                  {userPrompt.split(/(指定色\d+)/).map((part, index) => /^指定色\d+$/.test(part) ? <span key={index} className="bg-violet-200 text-violet-900 rounded px-1 font-semibold">{part}</span> : <span key={index}>{part}</span>)}
                                </div>
                              )}
                              <textarea value={userPrompt} onChange={(e) => handleUserPromptChange(e.target.value)} rows={3} className={`w-full px-4 py-3 rounded-lg border transition-colors duration-300 outline-none resize-none text-sm font-mono ${darkMode ? 'bg-transparent border-gray-700 text-white placeholder-gray-500' : 'bg-transparent border-gray-200 text-gray-900 placeholder-gray-400'} ${userPrompt ? 'relative z-10 bg-transparent' : ''}`} placeholder="请输入补充提示词..." style={userPrompt ? { color: 'transparent', caretColor: darkMode ? '#fff' : '#000' } : {}} />
                            </div>
                            {template?.enableSpecifiedColors && (
                              <button type="button" onClick={handleAddNewColorMarker} className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${darkMode ? 'bg-violet-900/50 text-violet-300 hover:bg-violet-900/70 border border-violet-700' : 'bg-violet-100 text-violet-700 hover:bg-violet-200 border border-violet-300'}`}>
                                指定颜色+
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-dashed border-gray-200 dark:border-gray-700">
                  {enableUserPrompt && specifiedColors.length > 0 && (
                    <div className={`p-4 rounded-xl border ${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-violet-50/50 border-violet-100'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">指定色配置</span>
                        <span className="text-xs opacity-60">共 {specifiedColors.length} 个</span>
                      </div>
                      <div className="space-y-2">
                        {specifiedColors.map((color, index) => (
                          <div key={`${color.name}-${index}`} className={`flex items-center gap-3 p-2 rounded-lg ${darkMode ? 'bg-gray-900/50' : 'bg-white shadow-sm'}`}>
                            <div className="relative flex-shrink-0">
                              <div className="w-8 h-8 rounded-full border-2 border-gray-200 cursor-pointer shadow-inner" style={{ backgroundColor: color.color }} onClick={() => setSelectedColorIndex(selectedColorIndex === index ? null : index)}>
                                <input type="color" value={color.color} onChange={(e) => handleColorValueChange(index, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                              </div>
                              <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{color.name.replace('指定色', '')}</span>
                            </div>
                            <div className="flex-1 min-w-0 text-sm truncate">{color.label || color.name}</div>
                            <input type="text" value={selectedColorIndex === index ? editingColorValue : color.color} onChange={(e) => { setEditingColorValue(e.target.value); handleColorValueChange(index, e.target.value); }} onFocus={() => { setSelectedColorIndex(index); setEditingColorValue(color.color); }} onBlur={() => setSelectedColorIndex(null)} className={`px-2 py-1 text-xs border rounded w-20 font-mono ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`} placeholder="#888888" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 第三行：选择参考图 与 模板信息 (等高) */}
                <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-12 items-stretch pt-6 border-t border-dashed border-gray-200 dark:border-gray-700">
                  {/* 选择参考图 */}
                  <div className="flex flex-col">
                    {template?.referenceImages && template.referenceImages.length > 0 && (
                      <div className={`flex-1 p-4 rounded-xl border transition-colors ${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
                        <h2 className={`text-base font-semibold mb-3 flex items-center gap-2 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          <ImageIcon className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                          选择参考图
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                          {template.referenceImages.map((image, index) => (
                            <div key={image.id} className={`relative cursor-pointer group rounded-lg overflow-hidden transition-all ${selectedPresetImage?.id === image.id ? 'ring-2 ring-violet-500 ring-offset-2' : 'hover:ring-2 hover:ring-gray-300'}`} onClick={() => setSelectedPresetImage(selectedPresetImage?.id === image.id ? null : image)}>
                              <img src={image.url} alt={`参考图 ${index + 1}`} className="w-full h-24 object-contain" style={{ objectPosition: 'center' }} />
                              <div className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${selectedPresetImage?.id === image.id ? 'bg-violet-600 text-white' : 'bg-gray-800 text-white'}`}>
                                {selectedPresetImage?.id === image.id ? '✓' : `图${index + 1}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 模板信息 */}
                  <div className="flex flex-col">
                    {template && (
                      <div className={`flex-1 p-4 rounded-xl border transition-colors flex flex-col ${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
                        <h3 className={`text-base font-semibold mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          <Info className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                          模板信息
                        </h3>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          {[
                            { label: '模板名称', value: template.name },
                            { label: '生成模式', value: template.mode === 'edit' ? '编辑' : '生成' },
                            { label: '尺寸', value: template.defaultSize },
                            { label: '质量', value: template.defaultQuality }
                          ].map((item, idx) => (
                            <div key={idx} className={`p-2 rounded-lg flex flex-col justify-center ${darkMode ? 'bg-gray-900/50' : 'bg-white shadow-sm border border-gray-100'}`}>
                              <span className="text-[9px] uppercase tracking-wider font-semibold opacity-50">{item.label}</span>
                              <span className="text-xs font-medium truncate">{item.value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-auto">
                          <button onClick={handleGenerate} disabled={generating || allImages.length === 0} className={`w-full py-3 text-base font-medium rounded-xl flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${darkMode ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
                            {generating ? <><Loader2 className="w-5 h-5 animate-spin" />生成中...</> : <><Sparkles className="w-5 h-5" />开始生成</>}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>{template?.variables && template.variables.length > 0 && (
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
                      ) : variable.type === 'color' ? (
                        <div className="flex items-center gap-3">
                          <div 
                            className={`w-12 h-12 rounded-lg border-2 cursor-pointer shadow-inner relative overflow-hidden ${
                              darkMode ? 'border-gray-700' : 'border-gray-200'
                            }`}
                            style={{ backgroundColor: formData[variable.key] || '#ffffff' }}
                          >
                            <input
                              type="color"
                              value={formData[variable.key] || '#ffffff'}
                              onChange={(e) => handleFormChange(variable.key, e.target.value)}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150"
                            />
                          </div>
                          <input
                            type="text"
                            value={formData[variable.key] || ''}
                            onChange={(e) => handleFormChange(variable.key, e.target.value)}
                            className={`flex-1 px-4 py-3 rounded-lg border transition-colors duration-300 focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none font-mono ${
                              darkMode 
                                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                            }`}
                            placeholder="#FFFFFF"
                          />
                        </div>
                      ) : variable.type === 'select' ? (
                        <select
                          value={formData[variable.key] || ''}
                          onChange={(e) => handleFormChange(variable.key, e.target.value)}
                          className={`w-full px-4 py-3 rounded-lg border transition-colors duration-300 focus:ring-2 focus:ring-gray-500 focus:border-transparent outline-none ${
                            darkMode 
                              ? 'bg-gray-800 border-gray-700 text-white' 
                              : 'bg-white border-gray-200 text-gray-900'
                          }`}
                        >
                          <option value="">请选择{variable.label}</option>
                          {variable.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : variable.type === 'image' ? (
                        <div className="space-y-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleVariableImageUpload(variable.key, e)}
                            className="hidden"
                            id={`upload-${variable.key}`}
                          />
                          {variableImages[variable.key] ? (
                            <div className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-video bg-gray-50">
                              <img
                                src={variableImages[variable.key]?.url}
                                alt={variable.label}
                                className="w-full h-full object-contain"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <label
                                  htmlFor={`upload-${variable.key}`}
                                  className="p-2 bg-white text-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                                >
                                  更换
                                </label>
                                <button
                                  onClick={() => setVariableImages(prev => ({ ...prev, [variable.key]: null }))}
                                  className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                >
                                  删除
                                </button>
                              </div>
                              <div className="absolute top-2 left-2 px-2 py-1 bg-violet-600 text-white text-[10px] font-bold rounded">
                                参考图{(template.referenceImages?.length || 0) + (template.variables?.filter(v => v.type === 'image').findIndex(v => v.key === variable.key) || 0) + 1}
                              </div>
                            </div>
                          ) : (
                            <label
                              htmlFor={`upload-${variable.key}`}
                              className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                                darkMode 
                                  ? 'border-gray-700 hover:border-violet-500/50 bg-gray-800/50' 
                                  : 'border-gray-200 hover:border-violet-400 bg-gray-50'
                              }`}
                            >
                              <Upload className="w-6 h-6 text-gray-400 mb-2" />
                              <span className="text-xs text-gray-500">点击上传{variable.label}</span>
                              <div className="mt-1 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[10px] text-gray-500">
                                将自动映射为: 参考图{(template.referenceImages?.length || 0) + (template.variables?.filter(v => v.type === 'image').findIndex(v => v.key === variable.key) || 0) + 1}
                              </div>
                            </label>
                          )}
                        </div>
                      ) : (
                        <input
                          type={variable.type === 'number' ? 'number' : 'text'}
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

                  {(user.role === 'admin' || user.role === 'sub_admin') && result.revisedPrompt && (
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
              <div className="hidden">
                {/* Removed from here and moved up to equal-height grid */}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

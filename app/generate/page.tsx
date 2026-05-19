'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { UserAvatar } from '@/components/UserAvatar';
import { AnnotationEditorModal } from '@/components/AnnotationEditorModal';
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
  LogOut,
  Palette,
  Camera,
  Settings2,
  Pencil
} from 'lucide-react';
import {
  AnnotationItem,
  AnnotationPromptToken,
  AnnotatedImageState,
  buildReferenceAnnotationPromptBlock
} from '@/lib/annotation';
import {
  SPECIAL_TEMPLATE_3D_RENDER,
  THREE_D_AI_RENDER_PRESET,
  buildThreeDAIRenderPrompt,
  type SpecialTemplateOption
} from '@/lib/special-template-presets';

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
  originalUrl?: string;
  annotations?: AnnotationItem[];
  annotationTokens?: AnnotationPromptToken[];
}

interface AnnotationEditorTarget {
  scope: 'main' | 'variable';
  variableKey?: string;
  referenceLabel: string;
  image: ReferenceImage;
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
  coverMetadata?: {
    title?: string;
    description?: string;
    badge?: string;
    specialTemplateType?: string;
    specialTemplateLabel?: string;
  };
  variables: Array<{
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

function parseStoredValues(value?: string): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
    }
  } catch {
    return value
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeReferenceImage(image: ReferenceImage | null | undefined): ReferenceImage | null {
  if (!image) return null;

  const annotated = image as ReferenceImage & AnnotatedImageState;
  return {
    ...image,
    originalUrl: annotated.originalUrl || image.url,
    annotations: annotated.annotations || [],
    annotationTokens: annotated.annotationTokens || []
  };
}

function normalizeReferenceImageMap(images?: Record<string, ReferenceImage | null>): Record<string, ReferenceImage | null> {
  if (!images) return {};

  return Object.fromEntries(
    Object.entries(images).map(([key, image]) => [key, normalizeReferenceImage(image)])
  );
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
  const [annotationEditorTarget, setAnnotationEditorTarget] = useState<AnnotationEditorTarget | null>(null);

  // 预览图片缩放和拖拽状态
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const historyId = searchParams.get('historyId');
  const isSpecialThreeDRender = template?.coverMetadata?.specialTemplateType === SPECIAL_TEMPLATE_3D_RENDER;
  const canManage = user?.role === 'admin' || user?.role === 'sub_admin';
  const isAdmin = user?.role === 'admin';
  const isSubAdmin = user?.role === 'sub_admin';

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      router.push('/auth');
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
    try {
      const response = await fetch(`/api/templates/${templateId}`);
      const data = await response.json();

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
            initialForm[v.key] = v.defaultValue || '';
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
                if (config.variableImages) {
                  Object.assign(initialImages, normalizeReferenceImageMap(config.variableImages));
                }
                
                if (config.selectedUserImage) {
                  const normalizedSelectedImage = normalizeReferenceImage(config.selectedUserImage);
                  setSelectedUserImage(normalizedSelectedImage);
                  setUserImages(prev => {
                    if (!normalizedSelectedImage) return prev;
                    if (!prev.find(img => img.id === normalizedSelectedImage.id)) {
                      return [normalizedSelectedImage, ...prev];
                    }
                    return prev.map((img) => img.id === normalizedSelectedImage.id ? normalizedSelectedImage : img);
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
      } else {
        setError('获取模板失败: ' + (data.error || '未知错误'));
        console.error('获取模板失败:', data);
      }
    } catch (error) {
      console.error('获取模板失败:', error);
      setError('网络错误，请刷新重试');
    } finally {
      setLoading(false);
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
          name: file.name,
          originalUrl: data.url,
          annotations: [],
          annotationTokens: []
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
    setUserImages(prev => {
      const next = prev.filter(img => img.id !== imageId);
      setSelectedUserImage(current => current?.id === imageId ? (next[0] || null) : current);
      return next;
    });
  };

  const uploadReferenceImageFile = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: fd
    });

    if (!response.ok) {
      throw new Error('标注图上传失败');
    }

    return response.json();
  };

  const handleOpenAnnotationEditor = (
    image: ReferenceImage,
    options: { scope: 'main' | 'variable'; referenceLabel: string; variableKey?: string }
  ) => {
    const normalizedImage = normalizeReferenceImage(image);
    if (!normalizedImage) return;

    setAnnotationEditorTarget({
      scope: options.scope,
      variableKey: options.variableKey,
      referenceLabel: options.referenceLabel,
      image: normalizedImage
    });
    console.info('[annotate] open', {
      scope: options.scope,
      variableKey: options.variableKey,
      referenceLabel: options.referenceLabel,
      imageId: normalizedImage.id
    });
  };

  const handleSaveAnnotatedImage = async ({
    annotations,
    annotationTokens,
    file,
    restoredOriginal
  }: {
    annotations: AnnotationItem[];
    annotationTokens: AnnotationPromptToken[];
    file?: File;
    restoredOriginal?: boolean;
  }) => {
    if (!annotationEditorTarget) return;

    setUploadingImage(true);
    try {
      let nextUrl = annotationEditorTarget.image.url;
      const originalUrl = annotationEditorTarget.image.originalUrl || annotationEditorTarget.image.url;

      if (restoredOriginal) {
        nextUrl = originalUrl;
      } else if (file) {
        const uploadData = await uploadReferenceImageFile(file);
        nextUrl = uploadData.url;
      }

      const updatedImage: ReferenceImage = {
        ...annotationEditorTarget.image,
        url: nextUrl,
        originalUrl,
        annotations: restoredOriginal ? [] : annotations,
        annotationTokens: restoredOriginal ? [] : annotationTokens
      };

      if (annotationEditorTarget.scope === 'main') {
        setUserImages(prev => prev.map(image => image.id === updatedImage.id ? updatedImage : image));
        setSelectedUserImage(current => current?.id === updatedImage.id ? updatedImage : current);
      } else if (annotationEditorTarget.variableKey) {
        setVariableImages(prev => ({ ...prev, [annotationEditorTarget.variableKey!]: updatedImage }));
      }

      setAnnotationEditorTarget((current) => (current ? { ...current, image: updatedImage } : current));
      console.info('[annotate] save', {
        scope: annotationEditorTarget.scope,
        variableKey: annotationEditorTarget.variableKey,
        referenceLabel: annotationEditorTarget.referenceLabel,
        restoredOriginal: !!restoredOriginal,
        annotationCount: restoredOriginal ? 0 : annotations.length
      });
    } catch (saveError) {
      console.error('保存标注失败:', saveError);
      setError('保存标注失败，请重试');
      throw saveError;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFormChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleMultiSelectToggle = (key: string, value: string, maxSelections?: number) => {
    setFormData((prev) => {
      const currentValues = parseStoredValues(prev[key]);
      const exists = currentValues.includes(value);
      let nextValues = exists
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      if (!exists && maxSelections && nextValues.length > maxSelections) {
        nextValues = nextValues.slice(nextValues.length - maxSelections);
      }

      return {
        ...prev,
        [key]: JSON.stringify(nextValues)
      };
    });
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
        name: file.name,
        originalUrl: data.url,
        annotations: [],
        annotationTokens: []
      };
      setVariableImages(prev => ({ ...prev, [key]: newImage }));
    } catch (error) {
      console.error('上传变量图片失败:', error);
      setError('图片上传失败');
    } finally {
      setUploadingImage(false);
    }
  };

  const getImageVariables = () => template?.variables?.filter((variable) => variable.type === 'image') || [];

  const getVariableReferenceLabel = (key: string) => {
    const imageVariables = getImageVariables();
    const variableIndex = imageVariables.findIndex((variable) => variable.key === key);
    const presetCount = template?.referenceImages?.length || 0;
    return `参考图${presetCount + variableIndex + 1}`;
  };

  const getMainReferenceLabel = () => {
    const presetCount = template?.referenceImages?.length || 0;
    const imageVariables = getImageVariables();
    return `参考图${presetCount + imageVariables.length + 1}`;
  };

  const getAnnotationPromptEntries = () => {
    const entries: Array<{ referenceLabel: string; tokens: AnnotationPromptToken[] }> = [];
    const imageVariables = getImageVariables();
    const presetCount = template?.referenceImages?.length || 0;

    imageVariables.forEach((variable, index) => {
      const image = variableImages[variable.key];
      if (image?.annotationTokens?.length) {
        entries.push({
          referenceLabel: `参考图${presetCount + index + 1}`,
          tokens: image.annotationTokens
        });
      }
    });

    if (template?.showMainVisual !== false && selectedUserImage?.annotationTokens?.length) {
      entries.push({
        referenceLabel: `参考图${presetCount + imageVariables.length + 1}`,
        tokens: selectedUserImage.annotationTokens
      });
    }

    return entries;
  };

  const getRenderedPrompt = () => {
    if (!template?.promptTemplate) return '';

    const annotationPromptBlock = buildReferenceAnnotationPromptBlock(getAnnotationPromptEntries());

    if (isSpecialThreeDRender) {
      const specialPrompt = buildThreeDAIRenderPrompt(formData);
      const extraBlocks = [annotationPromptBlock, enableUserPrompt && userPrompt.trim() ? userPrompt.trim() : ''].filter(Boolean);

      if (extraBlocks.length) {
        const extraPrompt = extraBlocks.join('\n\n');
        return userPromptPriority
          ? `${extraPrompt}\n\n${specialPrompt}`
          : `${specialPrompt}\n\n${extraPrompt}`;
      }
      return specialPrompt;
    }
    
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
    const extraBlocks = [annotationPromptBlock];

    if (enableUserPrompt && userPrompt.trim()) {
      extraBlocks.push(userPrompt.trim());
    }

    const mergedExtraPrompt = extraBlocks.filter(Boolean).join('\n\n');

    if (mergedExtraPrompt) {
      if (enableUserPrompt && userPrompt.trim() && userPromptPriority) {
        prompt = mergedExtraPrompt + '\n\n' + prompt;
      } else {
        prompt = prompt + '\n\n' + mergedExtraPrompt;
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

  const handleInsertAnnotationLabel = (label: string) => {
    if (!enableUserPrompt) {
      setEnableUserPrompt(true);
    }

    const nextValue = userPrompt.includes(label)
      ? userPrompt
      : `${userPrompt}${userPrompt && !/[\s\n]$/.test(userPrompt) ? ' ' : ''}${label}`;

    handleUserPromptChange(nextValue);
  };

  const getAllImages = (): ReferenceImage[] => {
    const allImages: ReferenceImage[] = [];
    
    // 1. 预设图片
    if (template?.referenceImages) {
      allImages.push(...template.referenceImages);
    }
    
    // 2. 变量图片 (保持和 getRenderedPrompt 中一样的顺序)
    const imageVariables = getImageVariables();
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

    if (isSpecialThreeDRender) {
      const requiredVariables = template?.variables?.filter((variable) => variable.required) || [];
      const missingVariable = requiredVariables.find((variable) => {
        if (variable.type === 'image') {
          return !variableImages[variable.key];
        }

        if (variable.multiSelect) {
          return parseStoredValues(formData[variable.key]).length === 0;
        }

        return !(formData[variable.key] || '').trim();
      });

      if (missingVariable) {
        setError(`请先完成「${missingVariable.label}」配置`);
        return;
      }
    }
    
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
      
      console.info('[generate] request', {
        totalReferences: allImages.length,
        variableReferenceCount: variableImageUrls.length,
        annotatedReferenceCount: getAnnotationPromptEntries().length,
        promptLength: renderedPrompt.length
      });
      
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

  const handleBackToTemplates = () => {
    window.location.assign('/templates');
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
  const annotationPromptEntries = getAnnotationPromptEntries();
  const annotationTokenCount = annotationPromptEntries.reduce((total, entry) => total + entry.tokens.length, 0);
  const hasMainVisualUpload = template?.showMainVisual !== false;
  const hasPresetReferenceImages = (template?.referenceImages?.length || 0) > 0;
  const hasPromptExtension = template?.allowUserPrompt !== false;
  const hasSpecifiedColorEditor = template?.enableSpecifiedColors && specifiedColors.length > 0;
  const showTopMetaGrid = !!template;
  const templateInfoItems = template ? [
    { label: '模板名称', value: template.name || '-' },
    { label: '生成模式', value: template.mode === 'edit' ? '编辑' : '生成' },
    { label: '默认尺寸', value: SIZE_OPTIONS.find((option) => option.value === template.defaultSize)?.label || template.defaultSize || '-' },
    { label: '默认质量', value: QUALITY_OPTIONS.find((option) => option.value === template.defaultQuality)?.label || template.defaultQuality || '-' }
  ] : [];
  const specialTemplateSections = isSpecialThreeDRender
    ? template?.variables?.reduce<Array<{
        title: string;
        description?: string;
        variables: Template['variables'];
      }>>((sections, variable) => {
        const title = variable.section || '其他配置';
        const existing = sections.find((section) => section.title === title);

        if (existing) {
          existing.variables.push(variable);
          if (!existing.description && variable.sectionDescription) {
            existing.description = variable.sectionDescription;
          }
          return sections;
        }

        sections.push({
          title,
          description: variable.sectionDescription,
          variables: [variable]
        });

        return sections;
      }, [])
    : [];

  return (
    <div className={`min-h-screen transition-colors duration-500 ${darkMode ? 'bg-gray-950' : 'bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100'}`}>
      <AnnotationEditorModal
        isOpen={!!annotationEditorTarget}
        darkMode={darkMode}
        image={annotationEditorTarget?.image || null}
        referenceLabel={annotationEditorTarget?.referenceLabel}
        onClose={() => {
          setAnnotationEditorTarget(null);
        }}
        onSave={handleSaveAnnotatedImage}
      />

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
        <div className="mx-auto flex w-[min(96vw,1880px)] items-center relative px-6 py-4 2xl:px-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleBackToTemplates}
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
                          {isAdmin && (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 w-fit ${
                              darkMode 
                                ? 'bg-amber-900/50 text-amber-400' 
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              <Shield className="w-3 h-3" />
                              管理员
                            </span>
                          )}
                          {isSubAdmin && (
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

                        {canManage && (
                          <button
                            onClick={() => router.push('/admin/users')}
                            className={`w-full px-4 py-2.5 text-left rounded-lg transition-colors flex items-center gap-3 ${
                              darkMode 
                                ? 'text-amber-400 hover:bg-amber-950/30' 
                                : 'text-amber-700 hover:bg-amber-50'
                            }`}
                          >
                            <Shield className="w-4 h-4" />
                            {isAdmin ? '用户管理' : '人员列表'}
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

      <div className="mx-auto w-[min(96vw,1880px)] px-6 py-8 2xl:px-8">
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

            {isSpecialThreeDRender && template && (
              <div className={`rounded-[30px] shadow-sm border p-6 md:p-8 transition-colors duration-500 overflow-hidden ${
                darkMode
                  ? 'bg-gray-900 border-gray-800'
                  : 'bg-white border-gray-200'
              }`}>
                <div className="relative">
                  <div className={`absolute inset-0 rounded-[26px] opacity-70 ${
                    darkMode
                      ? 'bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_40%)]'
                      : 'bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_38%)]'
                  }`} />
                  <div className="relative space-y-8">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div className="max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-emerald-700">
                            {template.coverMetadata?.badge || '特殊模板'}
                          </span>
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                            darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                          }`}>
                            GPT-Image-2 · 3D Render Workflow
                          </span>
                        </div>
                        <h2 className={`mt-4 text-2xl md:text-3xl font-semibold tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {template.coverMetadata?.specialTemplateLabel || template.name}
                        </h2>
                        <p className={`mt-3 text-sm md:text-base leading-7 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          {template.description || THREE_D_AI_RENDER_PRESET.description}
                        </p>
                      </div>
                      <div className={`rounded-2xl border px-4 py-3 min-w-[240px] ${
                        darkMode ? 'border-gray-800 bg-gray-950/60' : 'border-gray-200 bg-white/80'
                      }`}>
                        <p className={`text-xs uppercase tracking-[0.2em] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>当前状态</p>
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>已选参考图</span>
                            <span className={darkMode ? 'text-white' : 'text-gray-900'}>{allImages.length} 张</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>输出尺寸</span>
                            <span className={darkMode ? 'text-white' : 'text-gray-900'}>{SIZE_OPTIONS.find((option) => option.value === size)?.label || size}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>生成质量</span>
                            <span className={darkMode ? 'text-white' : 'text-gray-900'}>{QUALITY_OPTIONS.find((option) => option.value === quality)?.label || quality}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={`flex flex-col gap-4 rounded-[24px] border p-5 md:flex-row md:items-center md:justify-between ${darkMode ? 'border-gray-800 bg-gray-950/70' : 'border-gray-200 bg-white/80'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${darkMode ? 'bg-gray-800 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>
                          <Camera className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>开始生成</p>
                          <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>上传参考图并调整参数后，可以随时从这里直接开始渲染。</p>
                        </div>
                      </div>
                      <button
                        onClick={handleGenerate}
                        disabled={generating || allImages.length === 0}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                      >
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {generating ? '生成中...' : '开始渲染'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                      <div className={`xl:col-span-2 rounded-[24px] border p-5 ${
                        darkMode ? 'border-gray-800 bg-gray-950/70' : 'border-gray-200 bg-white/80'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                            darkMode ? 'bg-gray-800 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            <Upload className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>上传白膜 / 草图 / 线稿</h3>
                            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>上传结构参考图，系统将尽量保留原始造型与透视。</p>
                          </div>
                        </div>

                        <div className="mt-5">
                          {userImages.length > 0 ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                {userImages.map((image, index) => (
                                  <div
                                    key={image.id}
                                    className={`group relative overflow-hidden rounded-2xl border cursor-pointer transition-all ${
                                      selectedUserImage?.id === image.id
                                        ? 'border-emerald-400 ring-2 ring-emerald-400/30'
                                        : darkMode
                                          ? 'border-gray-800 hover:border-gray-700'
                                          : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                    onClick={() => setSelectedUserImage(selectedUserImage?.id === image.id ? null : image)}
                                  >
                                    <img src={image.url} alt={`上传参考图 ${index + 1}`} className="h-28 w-full object-contain bg-black/[0.03]" />
                                    <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-medium text-white">
                                      {selectedUserImage?.id === image.id ? '已选中' : `参考图 ${index + 1}`}
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPreviewImage(image.url);
                                        }}
                                        className="rounded-full bg-white/90 p-2 text-gray-900 shadow-lg transition-transform hover:scale-105"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenAnnotationEditor(image, {
                                            scope: 'main',
                                            referenceLabel: getMainReferenceLabel()
                                          });
                                        }}
                                        className="rounded-full bg-violet-500 p-2 text-white shadow-lg transition-transform hover:scale-105"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                    </div>
                                    {image.annotationTokens && image.annotationTokens.length > 0 && (
                                      <div className="absolute bottom-2 left-2 rounded-full bg-violet-600/90 px-2 py-1 text-[10px] font-semibold text-white shadow-lg">
                                        已标注 {image.annotationTokens.length}
                                      </div>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveImage(image.id);
                                      }}
                                      className="absolute right-2 top-2 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                    >
                                      <XCircle className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <label className={`flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed px-4 py-3 text-sm transition-colors ${
                                darkMode ? 'border-gray-700 text-gray-300 hover:border-gray-600' : 'border-gray-300 text-gray-600 hover:border-gray-400'
                              }`}>
                                <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                                {uploadingImage ? '上传中...' : '继续添加参考图'}
                              </label>
                            </div>
                          ) : (
                            <div className={`rounded-[24px] border-2 border-dashed px-6 py-10 text-center transition-colors ${
                              darkMode ? 'border-gray-700 hover:border-gray-600' : 'border-gray-300 hover:border-gray-400'
                            }`}>
                              <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" id="special-user-image-upload" disabled={uploadingImage} />
                              <label htmlFor="special-user-image-upload" className="cursor-pointer">
                                <Upload className={`mx-auto h-9 w-9 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                                <p className={`mt-3 text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>点击上传白膜、草图或线稿</p>
                                <p className={`mt-1 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>支持多张参考图，建议优先上传主视角结构图。</p>
                              </label>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={`xl:col-span-3 rounded-[24px] border p-5 ${
                        darkMode ? 'border-gray-800 bg-gray-950/60' : 'border-gray-200 bg-white/80'
                      }`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className={`rounded-2xl border p-4 ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                            <div className="flex items-center gap-2">
                              <Palette className={`w-4 h-4 ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`} />
                              <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>输出参数</p>
                            </div>
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className={`mb-1.5 block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>输出尺寸</label>
                                <select
                                  value={size}
                                  onChange={(e) => setSize(e.target.value)}
                                  className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${darkMode ? 'border-gray-700 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-900'}`}
                                >
                                  {SIZE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className={`mb-1.5 block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>生成质量</label>
                                <select
                                  value={quality}
                                  onChange={(e) => setQuality(e.target.value)}
                                  className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${darkMode ? 'border-gray-700 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-900'}`}
                                >
                                  {QUALITY_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>

                          <div className={`rounded-2xl border p-4 ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                            <div className="flex items-center gap-2">
                              <Settings2 className={`w-4 h-4 ${darkMode ? 'text-cyan-300' : 'text-cyan-700'}`} />
                              <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>系统规则</p>
                            </div>
                            <p className={`mt-3 text-sm leading-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              严格保留原图结构、比例、镜头角度和透视，只增强材质、灯光、真实感与空间氛围。
                            </p>
                          </div>
                        </div>

                        {template.allowUserPrompt !== false && (
                          <div className={`mt-4 rounded-2xl border p-4 ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>附加文本要求</p>
                                <p className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>用于补充项目特有的品牌调性、展示语境或禁忌项。</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setEnableUserPrompt(!enableUserPrompt)}
                                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                                    enableUserPrompt
                                      ? 'bg-violet-600 text-white'
                                      : darkMode
                                        ? 'bg-gray-800 text-gray-300'
                                        : 'bg-white text-gray-600 border border-gray-200'
                                  }`}
                                >
                                  补充提示词
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setUserPromptPriority(!userPromptPriority)}
                                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                                    !userPromptPriority
                                      ? 'bg-amber-500 text-white'
                                      : darkMode
                                        ? 'bg-gray-800 text-gray-300'
                                        : 'bg-white text-gray-600 border border-gray-200'
                                  }`}
                                >
                                  模板优先
                                </button>
                              </div>
                            </div>
                            {enableUserPrompt && (
                              <>
                                {annotationPromptEntries.length > 0 && (
                                  <div className={`mt-4 rounded-2xl border p-3 ${darkMode ? 'border-violet-900 bg-violet-950/30' : 'border-violet-200 bg-violet-50/70'}`}>
                                    <div className="flex items-center justify-between gap-3">
                                      <div>
                                        <p className={`text-sm font-semibold ${darkMode ? 'text-violet-200' : 'text-violet-900'}`}>自动标注提示</p>
                                        <p className={`mt-1 text-xs ${darkMode ? 'text-violet-300/80' : 'text-violet-700/80'}`}>已按参考图分组同步到最终 Prompt</p>
                                      </div>
                                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${darkMode ? 'bg-violet-500/20 text-violet-200' : 'bg-violet-200 text-violet-800'}`}>
                                        {annotationTokenCount} 个模块
                                      </span>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                      {annotationPromptEntries.map((entry) => (
                                        <div key={entry.referenceLabel}>
                                          <p className={`mb-1 text-[11px] font-semibold ${darkMode ? 'text-violet-200/85' : 'text-violet-800/85'}`}>{entry.referenceLabel}</p>
                                          <div className="flex flex-wrap gap-2">
                                            {entry.tokens.map((token) => (
                                              <button
                                                type="button"
                                                key={token.id}
                                                onClick={() => handleInsertAnnotationLabel(token.label)}
                                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                  darkMode ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30' : 'bg-violet-100 text-violet-800 ring-1 ring-violet-200'
                                                }`}
                                              >
                                                {token.label}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <textarea
                                  value={userPrompt}
                                  onChange={(e) => handleUserPromptChange(e.target.value)}
                                  rows={4}
                                  className={`mt-4 w-full rounded-2xl border px-4 py-3 text-sm outline-none resize-none ${darkMode ? 'border-gray-700 bg-gray-950 text-white placeholder-gray-500' : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400'}`}
                                  placeholder="例如：强化品牌高级感，入口视觉更聚焦，灯光不要过冷。"
                                />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-5">
                      {specialTemplateSections.map((section) => (
                        <div
                          key={section.title}
                          className={`rounded-[24px] border p-5 ${darkMode ? 'border-gray-800 bg-gray-950/70' : 'border-gray-200 bg-white/80'}`}
                        >
                          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                            <div>
                              <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{section.title}</h3>
                              {section.description && (
                                <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{section.description}</p>
                              )}
                            </div>
                          </div>

                          <div className="mt-5 space-y-6">
                            {section.variables.map((variable) => {
                              const selectedValues = variable.multiSelect ? parseStoredValues(formData[variable.key]) : [];

                              return (
                                <div key={variable.key}>
                                  <div className="mb-3 flex items-center justify-between gap-4">
                                    <label className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                      {variable.label}
                                      {variable.required && <span className="ml-1 text-red-500">*</span>}
                                    </label>
                                    {variable.multiSelect && (
                                      <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                        已选 {selectedValues.length}{variable.maxSelections ? ` / ${variable.maxSelections}` : ''}
                                      </span>
                                    )}
                                  </div>

                                  {variable.type === 'select' && variable.multiSelect && (
                                    <div className="flex flex-wrap gap-3">
                                      {variable.options?.map((option) => {
                                        const active = selectedValues.includes(option.value);
                                        return (
                                          <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => handleMultiSelectToggle(variable.key, option.value, variable.maxSelections)}
                                            className={`rounded-2xl border px-4 py-3 text-left text-sm transition-all ${
                                              active
                                                ? 'border-emerald-400 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                                : darkMode
                                                  ? 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600'
                                                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                            }`}
                                          >
                                            <div className="font-medium">{option.label}</div>
                                            {option.description && <div className={`mt-1 text-xs ${active ? 'text-white/80' : darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{option.description}</div>}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {variable.type === 'select' && !variable.multiSelect && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {variable.options?.map((option) => {
                                        const active = formData[variable.key] === option.value;
                                        return (
                                          <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => handleFormChange(variable.key, option.value)}
                                            className={`rounded-2xl border p-4 text-left transition-all ${
                                              active
                                                ? 'border-cyan-400 bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                                                : darkMode
                                                  ? 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600'
                                                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                            }`}
                                          >
                                            <div className="font-medium">{option.label}</div>
                                            {option.description && <div className={`mt-1 text-xs ${active ? 'text-white/80' : darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{option.description}</div>}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {variable.type === 'textarea' && (
                                    <textarea
                                      value={formData[variable.key] || ''}
                                      onChange={(e) => handleFormChange(variable.key, e.target.value)}
                                      rows={4}
                                      className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none resize-none ${darkMode ? 'border-gray-700 bg-gray-900 text-white placeholder-gray-500' : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400'}`}
                                      placeholder={variable.placeholder || `请输入${variable.label}`}
                                    />
                                  )}

                                  {variable.type === 'text' && (
                                    <input
                                      type="text"
                                      value={formData[variable.key] || ''}
                                      onChange={(e) => handleFormChange(variable.key, e.target.value)}
                                      className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${darkMode ? 'border-gray-700 bg-gray-900 text-white placeholder-gray-500' : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400'}`}
                                      placeholder={variable.placeholder || `请输入${variable.label}`}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className={`flex flex-col gap-4 rounded-[24px] border p-5 md:flex-row md:items-center md:justify-between ${darkMode ? 'border-gray-800 bg-gray-950/70' : 'border-gray-200 bg-white/80'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${darkMode ? 'bg-gray-800 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>
                          <Camera className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>渲染说明</p>
                          <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>系统会自动拼接中英文结构化 Prompt，并把本次配置完整保存到历史记录。</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                        {allImages.length > 0 ? '参数已就绪，可直接开始' : '请先上传至少一张参考图'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className={`${isSpecialThreeDRender ? 'hidden' : ''} rounded-2xl shadow-sm border p-8 transition-colors duration-500 ${
              darkMode 
                ? 'bg-gray-900 border-gray-800' 
                : 'bg-white border-gray-200'
            }`}>
              <div className="space-y-6">
                <div className={`rounded-2xl border p-5 ${darkMode ? 'border-gray-800 bg-gray-950/60' : 'border-gray-200 bg-gray-50/80'}`}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${darkMode ? 'bg-gray-800 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>
                        <Camera className="w-5 h-5" />
                      </div>
                      <div>
                        <p className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>开始生成</p>
                        <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          页面会根据模板能力自动补齐模块，当前只展示这个模板实际可用的配置项。
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleGenerate}
                      disabled={generating || allImages.length === 0}
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                        darkMode ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                    >
                      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {generating ? '生成中...' : '开始生成'}
                    </button>
                  </div>
                </div>

                {showTopMetaGrid && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className={`rounded-2xl border p-5 ${darkMode ? 'border-gray-800 bg-gray-950/60' : 'border-gray-200 bg-gray-50/80'}`}>
                      <h2 className={`text-base font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        <Info className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                        模板信息
                      </h2>
                      <div className="grid grid-cols-2 gap-3">
                        {templateInfoItems.map((item) => (
                          <div
                            key={item.label}
                            className={`rounded-xl border p-3 ${darkMode ? 'border-gray-800 bg-gray-900/70' : 'border-gray-200 bg-white'}`}
                          >
                            <p className={`text-[11px] font-semibold tracking-wide ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{item.label}</p>
                            <p className={`mt-1 text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{item.value}</p>
                          </div>
                        ))}
                      </div>
                      {template?.description && (
                        <div className={`mt-4 rounded-xl border p-4 text-sm leading-6 ${darkMode ? 'border-gray-800 bg-gray-900/70 text-gray-300' : 'border-gray-200 bg-white text-gray-600'}`}>
                          {template.description}
                        </div>
                      )}
                    </div>

                    <div className={`rounded-2xl border p-5 ${darkMode ? 'border-gray-800 bg-gray-950/60' : 'border-gray-200 bg-gray-50/80'}`}>
                      <h2 className={`text-base font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        <Palette className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                        生成参数
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>输出尺寸</label>
                          <select
                            value={size}
                            onChange={(e) => setSize(e.target.value)}
                            className={`w-full px-3 py-2 rounded-xl border outline-none text-sm ${darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                          >
                            {SIZE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>质量</label>
                          <select
                            value={quality}
                            onChange={(e) => setQuality(e.target.value)}
                            className={`w-full px-3 py-2 rounded-xl border outline-none text-sm ${darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                          >
                            {QUALITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className={`mt-4 rounded-xl border p-4 text-sm leading-6 ${darkMode ? 'border-gray-800 bg-gray-900/70 text-gray-300' : 'border-gray-200 bg-white text-gray-600'}`}>
                        系统会自动沿用模板默认参数，并根据模板是否开放补充提示词、颜色编辑、参考图上传等能力来动态展示对应模块。
                      </div>
                    </div>
                  </div>
                )}

                {hasMainVisualUpload && (
                  <div className={`rounded-2xl border p-5 ${darkMode ? 'border-gray-800 bg-gray-950/60' : 'border-gray-200 bg-gray-50/80'}`}>
                    <h2 className={`text-base font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      <Upload className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                      上传参考图
                    </h2>
                    {userImages.length > 0 ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                          {userImages.map((image, index) => (
                            <div
                              key={image.id}
                              className={`relative cursor-pointer group rounded-xl overflow-hidden transition-all ${
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
                              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewImage(image.url);
                                  }}
                                  className="rounded-full bg-white/90 p-2 text-gray-900 shadow-lg transition-transform hover:scale-105"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenAnnotationEditor(image, {
                                      scope: 'main',
                                      referenceLabel: getMainReferenceLabel()
                                    });
                                  }}
                                  className="rounded-full bg-violet-500 p-2 text-white shadow-lg transition-transform hover:scale-105"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="absolute top-1 left-1 rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                {selectedUserImage?.id === image.id ? '已选中' : `图${index + 1}`}
                              </div>
                              {image.annotationTokens && image.annotationTokens.length > 0 && (
                                <div className="absolute bottom-1 left-1 rounded-full bg-violet-600/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg">
                                  已标注
                                </div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveImage(image.id);
                                }}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <XCircle className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <label className={`block py-2 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
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
                )}

                {hasPromptExtension && (
                  <div className={`rounded-2xl border p-5 ${darkMode ? 'border-gray-800 bg-gray-950/60' : 'border-gray-200 bg-gray-50/80'}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div
                        className={`flex-1 flex items-center gap-3 rounded-2xl border p-3 cursor-pointer transition-colors ${
                          darkMode
                            ? 'border-violet-900/60 bg-violet-950/20 hover:bg-violet-950/30'
                            : 'border-violet-100 bg-violet-50/70 hover:bg-violet-50'
                        }`}
                        onClick={() => setEnableUserPrompt(!enableUserPrompt)}
                      >
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                          enableUserPrompt ? 'border-violet-500 bg-violet-500' : darkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-white'
                        }`}>
                          {enableUserPrompt && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${darkMode ? 'text-violet-100' : 'text-violet-900'}`}>补充提示词</p>
                          <p className={`text-xs mt-1 ${darkMode ? 'text-violet-300/70' : 'text-violet-700/70'}`}>开启后可补充品牌调性、限制词和局部要求</p>
                        </div>
                      </div>

                      <div
                        onClick={() => setUserPromptPriority(!userPromptPriority)}
                        className={`flex items-center gap-3 cursor-pointer rounded-2xl border px-4 py-3 transition-colors ${
                          darkMode
                            ? 'border-amber-900/60 bg-amber-950/20 hover:bg-amber-950/30'
                            : 'border-amber-100 bg-amber-50/70 hover:bg-amber-50'
                        }`}
                      >
                        <span className={`text-xs font-bold ${darkMode ? 'text-amber-200' : 'text-amber-800'}`}>模板优先</span>
                        <div className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${!userPromptPriority ? 'bg-amber-500' : 'bg-gray-200'}`}>
                          <motion.div
                            animate={{ x: !userPromptPriority ? 18 : 2 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {enableUserPrompt && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 space-y-4">
                        {annotationPromptEntries.length > 0 && (
                          <div className={`rounded-2xl border p-3 ${darkMode ? 'border-violet-900 bg-violet-950/30' : 'border-violet-200 bg-violet-50/70'}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className={`text-sm font-semibold ${darkMode ? 'text-violet-200' : 'text-violet-900'}`}>自动标注提示</p>
                                <p className={`mt-1 text-xs ${darkMode ? 'text-violet-300/80' : 'text-violet-700/80'}`}>保存标注后会自动同步到最终 Prompt</p>
                              </div>
                              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${darkMode ? 'bg-violet-500/20 text-violet-200' : 'bg-violet-200 text-violet-800'}`}>
                                {annotationTokenCount} 个模块
                              </span>
                            </div>
                            <div className="mt-3 space-y-2">
                              {annotationPromptEntries.map((entry) => (
                                <div key={entry.referenceLabel}>
                                  <p className={`mb-1 text-[11px] font-semibold ${darkMode ? 'text-violet-200/85' : 'text-violet-800/85'}`}>{entry.referenceLabel}</p>
                                  <div className="flex flex-wrap gap-2">
                                    {entry.tokens.map((token) => (
                                      <button
                                        type="button"
                                        key={token.id}
                                        onClick={() => handleInsertAnnotationLabel(token.label)}
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                          darkMode ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30' : 'bg-violet-100 text-violet-800 ring-1 ring-violet-200'
                                        }`}
                                      >
                                        {token.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="relative w-full">
                          {userPrompt && (
                            <div className={`absolute inset-0 px-4 py-3 rounded-xl border pointer-events-none whitespace-pre-wrap break-words text-sm font-mono overflow-y-auto ${
                              darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'
                            }`}>
                              {userPrompt.split(/(指定色\d+)/).map((part, index) => (
                                /^指定色\d+$/.test(part)
                                  ? <span key={index} className="bg-violet-200 text-violet-900 rounded px-1 font-semibold">{part}</span>
                                  : <span key={index}>{part}</span>
                              ))}
                            </div>
                          )}
                          <textarea
                            value={userPrompt}
                            onChange={(e) => handleUserPromptChange(e.target.value)}
                            rows={4}
                            className={`w-full px-4 py-3 rounded-xl border transition-colors duration-300 outline-none resize-none text-sm font-mono ${
                              darkMode ? 'bg-transparent border-gray-700 text-white placeholder-gray-500' : 'bg-transparent border-gray-200 text-gray-900 placeholder-gray-400'
                            } ${userPrompt ? 'relative z-10 bg-transparent' : ''}`}
                            placeholder="请输入补充提示词..."
                            style={userPrompt ? { color: 'transparent', caretColor: darkMode ? '#fff' : '#000' } : {}}
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {hasSpecifiedColorEditor && (
                  <div className={`rounded-2xl border p-5 ${darkMode ? 'border-gray-800 bg-gray-950/60' : 'border-gray-200 bg-gray-50/80'}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                      <div>
                        <h2 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>指定色配置</h2>
                        <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          检测到模板存在可编辑颜色，占位模块会自动显示，不再留空。
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>共 {specifiedColors.length} 个</span>
                        {hasPromptExtension && enableUserPrompt && (
                          <button
                            type="button"
                            onClick={handleAddNewColorMarker}
                            className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                              darkMode ? 'bg-violet-900/50 text-violet-300 hover:bg-violet-900/70 border border-violet-700' : 'bg-violet-100 text-violet-700 hover:bg-violet-200 border border-violet-300'
                            }`}
                          >
                            指定颜色+
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {specifiedColors.map((color, index) => (
                        <div key={`${color.name}-${index}`} className={`flex items-center gap-3 p-3 rounded-xl border ${darkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-200'}`}>
                          <div className="relative flex-shrink-0">
                            <div
                              className="w-8 h-8 rounded-full border-2 border-gray-200 cursor-pointer shadow-inner"
                              style={{ backgroundColor: color.color }}
                              onClick={() => setSelectedColorIndex(selectedColorIndex === index ? null : index)}
                            >
                              <input type="color" value={color.color} onChange={(e) => handleColorValueChange(index, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                            </div>
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                              {color.name.replace('指定色', '')}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 text-sm truncate">{color.label || color.name}</div>
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
                            onBlur={() => setSelectedColorIndex(null)}
                            className={`px-2 py-1 text-xs border rounded w-24 font-mono ${darkMode ? 'bg-gray-950 border-gray-700' : 'bg-white border-gray-200'}`}
                            placeholder="#888888"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {hasPresetReferenceImages && (
                  <div className={`rounded-2xl border p-5 ${darkMode ? 'border-gray-800 bg-gray-950/60' : 'border-gray-200 bg-gray-50/80'}`}>
                    <h2 className={`text-base font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      <ImageIcon className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                      模板参考图
                    </h2>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                      {template?.referenceImages.map((image, index) => (
                        <div
                          key={image.id}
                          className={`relative cursor-pointer group rounded-xl overflow-hidden transition-all ${
                            selectedPresetImage?.id === image.id ? 'ring-2 ring-violet-500 ring-offset-2' : 'hover:ring-2 hover:ring-gray-300'
                          }`}
                          onClick={() => setSelectedPresetImage(selectedPresetImage?.id === image.id ? null : image)}
                        >
                          <img src={image.url} alt={`参考图 ${index + 1}`} className="w-full h-24 object-contain" style={{ objectPosition: 'center' }} />
                          <div className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${selectedPresetImage?.id === image.id ? 'bg-violet-600 text-white' : 'bg-gray-800 text-white'}`}>
                            {selectedPresetImage?.id === image.id ? '已查看' : `图${index + 1}`}
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewImage(image.url);
                              }}
                              className="rounded-full bg-white/90 p-2 text-gray-900 shadow-lg transition-transform hover:scale-105"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>{!isSpecialThreeDRender && template?.variables && template.variables.length > 0 && (
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
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewImage(variableImages[variable.key]?.url || null);
                                  }}
                                  className="p-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentImage = variableImages[variable.key];
                                    if (!currentImage) return;
                                    handleOpenAnnotationEditor(currentImage, {
                                      scope: 'variable',
                                      variableKey: variable.key,
                                      referenceLabel: getVariableReferenceLabel(variable.key)
                                    });
                                  }}
                                  className="p-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
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
                                {getVariableReferenceLabel(variable.key)}
                              </div>
                              {!!variableImages[variable.key]?.annotationTokens?.length && (
                                <div className="absolute bottom-2 left-2 rounded-full bg-violet-600/90 px-2 py-1 text-[10px] font-semibold text-white shadow-lg">
                                  已标注 {variableImages[variable.key]?.annotationTokens?.length}
                                </div>
                              )}
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
                                将自动映射为: {getVariableReferenceLabel(variable.key)}
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

                  {canManage && result.revisedPrompt && (
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

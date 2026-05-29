'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { UserMenuDropdown } from '@/components/UserMenuDropdown';
import { AnnotationEditorModal } from '@/components/AnnotationEditorModal';
import { AdminThemeModal } from '@/components/AdminThemeModal';
import type { ImageProviderSummary } from '@/lib/image-provider-types';
import { 
  ArrowLeft, 
  Upload,
  Sparkles,
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  X,
  Download,
  Archive,
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
  Pencil,
  ChevronDown,
  type LucideIcon
} from 'lucide-react';
import {
  AnnotationItem,
  AnnotationPromptToken,
  AnnotatedImageState,
  buildReferenceAnnotationPromptBlock
} from '@/lib/annotation';
import {
  SPECIAL_TEMPLATE_3D_RENDER,
  buildThreeDAIRenderPrompt,
  type SpecialTemplateOption
} from '@/lib/special-template-presets';
import { getSpecialTemplateWorkspace } from '@/components/generate/special/registry';
import {
  applyAdminColorTheme,
  getStoredAdminColorTheme,
  persistAdminColorTheme,
  type AdminColorTheme
} from '@/lib/admin-color-theme';

const SIZE_OPTIONS = [
  { value: 'auto', label: '自动' },
  { value: '2048x2048', label: '1:1 经典方形 (2048×2048)' },
  { value: '2304x3072', label: '3:4 竖构图 (2304×3072)' },
  { value: '3072x2304', label: '4:3 横构图 (3072×2304)' },
  { value: '3840x2160', label: '16:9 宽屏标准 (3840×2160)' },
  { value: '2160x3840', label: '9:16 竖屏海报 (2160×3840)' },
  { value: '3584x1536', label: '21:9 电影宽幕 (3584×1536)' },
  { value: '3840x1280', label: '3:1 横幅全景 (3840×1280)' },
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
  scope: 'main' | 'variable' | 'templateCustom';
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
  enableReferenceBatchMode?: boolean;
  enableCustomReferenceUpload?: boolean;
  allowMultipleCustomReferences?: boolean;
}

interface SpecifiedColor {
  name: string;
  color: string;
  order: number;
  label?: string;
}

interface ImageProviderResponse {
  providers: ImageProviderSummary[];
  defaultProviderId: string | null;
}

const SMART_COLOR_PROMPT = '自动适配合理的颜色';

const LEGACY_SIZE_MAP: Record<string, string> = {
  '1024x1024': '2048x2048',
  '1536x1024': '3072x2304',
  '1024x1536': '2304x3072',
  '2048x1152': '3840x2160',
  '1920x1080': '3840x2160'
};

const REFERENCE_UPLOAD_MAX_EDGE = 3840;
const REFERENCE_UPLOAD_MAX_TOTAL_PIXELS = 8_294_400;
const REFERENCE_UPLOAD_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const REFERENCE_UPLOAD_QUALITY_STEPS = [0.92, 0.88, 0.84, 0.8, 0.76, 0.72];
const REFERENCE_UPLOAD_SCALE_STEPS = [1, 0.94, 0.88, 0.82];

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function getReferenceUploadLimitText() {
  return `最大边长 ${REFERENCE_UPLOAD_MAX_EDGE}px，总像素不超过 ${REFERENCE_UPLOAD_MAX_TOTAL_PIXELS.toLocaleString()}，文件大小不超过 ${formatFileSize(REFERENCE_UPLOAD_MAX_FILE_SIZE_BYTES)}`;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('图片压缩失败'));
        return;
      }

      resolve(blob);
    }, type, quality);
  });
}

async function getImageFileDimensions(file: File): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('加载图片失败'));
      element.src = objectUrl;
    });

    return { width: image.width, height: image.height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getReferenceUploadViolations({
  width,
  height,
  sizeBytes
}: {
  width: number;
  height: number;
  sizeBytes: number;
}) {
  const violations: string[] = [];
  const longestEdge = Math.max(width, height);
  const totalPixels = width * height;

  if (longestEdge > REFERENCE_UPLOAD_MAX_EDGE) {
    violations.push(`最大边长 ${longestEdge}px，超过 ${REFERENCE_UPLOAD_MAX_EDGE}px`);
  }

  if (totalPixels > REFERENCE_UPLOAD_MAX_TOTAL_PIXELS) {
    violations.push(`总像素 ${totalPixels.toLocaleString()}，超过 ${REFERENCE_UPLOAD_MAX_TOTAL_PIXELS.toLocaleString()}`);
  }

  if (sizeBytes > REFERENCE_UPLOAD_MAX_FILE_SIZE_BYTES) {
    violations.push(`文件大小 ${formatFileSize(sizeBytes)}，超过 ${formatFileSize(REFERENCE_UPLOAD_MAX_FILE_SIZE_BYTES)}`);
  }

  return violations;
}

function getConstrainedDimensions(width: number, height: number) {
  const longestEdge = Math.max(width, height);
  const totalPixels = width * height;
  let scale = 1;

  if (longestEdge > REFERENCE_UPLOAD_MAX_EDGE) {
    scale = Math.min(scale, REFERENCE_UPLOAD_MAX_EDGE / longestEdge);
  }

  if (totalPixels > REFERENCE_UPLOAD_MAX_TOTAL_PIXELS) {
    scale = Math.min(scale, Math.sqrt(REFERENCE_UPLOAD_MAX_TOTAL_PIXELS / totalPixels));
  }

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function getCompressedFileExtension(type: string) {
  if (type === 'image/webp') return 'webp';
  if (type === 'image/png') return 'png';
  return 'jpg';
}

async function compressReferenceUploadImage(file: File): Promise<File> {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('加载图片失败'));
      element.src = imageUrl;
    });

    const preferredType = file.type === 'image/png' || file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const constrained = getConstrainedDimensions(image.width, image.height);
    let bestBlob: Blob | null = null;

    for (const scaleStep of REFERENCE_UPLOAD_SCALE_STEPS) {
      const targetWidth = Math.max(1, Math.round(constrained.width * scaleStep));
      const targetHeight = Math.max(1, Math.round(constrained.height * scaleStep));
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('浏览器不支持图片压缩');
      }

      context.drawImage(image, 0, 0, targetWidth, targetHeight);

      for (const quality of REFERENCE_UPLOAD_QUALITY_STEPS) {
        const blob = await canvasToBlob(canvas, preferredType, quality);
        bestBlob = blob;

        if (blob.size <= REFERENCE_UPLOAD_MAX_FILE_SIZE_BYTES) {
          const extension = getCompressedFileExtension(preferredType);
          const fileName = file.name.replace(/\.[^.]+$/, '') || 'reference';
          return new File([blob], `${fileName}.${extension}`, {
            type: preferredType,
            lastModified: Date.now()
          });
        }
      }
    }

    if (!bestBlob) {
      throw new Error('图片压缩失败');
    }

    const extension = getCompressedFileExtension(preferredType);
    const fileName = file.name.replace(/\.[^.]+$/, '') || 'reference';
    return new File([bestBlob], `${fileName}.${extension}`, {
      type: preferredType,
      lastModified: Date.now()
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function normalizeSizeValue(rawSize?: string) {
  if (!rawSize) {
    return '2048x2048';
  }

  if (SIZE_OPTIONS.some((option) => option.value === rawSize)) {
    return rawSize;
  }

  return LEGACY_SIZE_MAP[rawSize] || '2048x2048';
}

interface GenerationHistoryItem {
  id: string;
  templateId: string | null;
  templateName: string;
  outputImageUrl: string | null;
  thumbnailUrl: string | null;
  status: string;
  creditsUsed?: number;
  createdAt: string;
}

interface ReferenceBatchResultItem {
  id: string;
  sourceImage: ReferenceImage;
  result: any | null;
  error: string;
  status: 'idle' | 'waiting' | 'generating' | 'success' | 'error';
  generationStatus: string;
}

type UploadTarget = 'main' | 'custom' | 'variable';

interface PendingCompressionUpload {
  id: string;
  file: File;
  source: UploadTarget;
  variableKey?: string;
  width: number;
  height: number;
  sizeBytes: number;
  reasons: string[];
}

interface GenerationRequestOptions {
  forceBatchMode?: boolean;
  batchContext?: {
    requestId: string;
    sequence: number;
    total: number;
    delayMs: number;
    currentImage: ReferenceImage | null;
    allUserImages: ReferenceImage[];
  };
}

interface ActionIconButtonProps {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  darkMode: boolean;
  className?: string;
}

function ActionIconButton({
  label,
  icon: Icon,
  onClick,
  disabled = false,
  darkMode,
  className = ''
}: ActionIconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
        darkMode
          ? 'border-[#334034] bg-[#222923] text-stone-200 hover:bg-[#2a332b] hover:text-white'
          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      } ${className}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
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

function normalizeReferenceImageList(images?: Array<ReferenceImage | null | undefined>): ReferenceImage[] {
  if (!images) return [];

  return images
    .map((image) => normalizeReferenceImage(image))
    .filter((image): image is ReferenceImage => !!image);
}

export default function GeneratePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('templateId') || searchParams.get('id');

  const [template, setTemplate] = useState<Template | null>(null);
  const [user, setUser] = useState<any>(null);
  const [imageProviders, setImageProviders] = useState<ImageProviderSummary[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAdminThemeModal, setShowAdminThemeModal] = useState(false);
  const [adminColorTheme, setAdminColorTheme] = useState<AdminColorTheme>('forest-amber');
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [compressingPendingUploads, setCompressingPendingUploads] = useState(false);
  const [selectedPresetImage, setSelectedPresetImage] = useState<ReferenceImage | null>(null);
  const [customReferenceImages, setCustomReferenceImages] = useState<ReferenceImage[]>([]);
  const [selectedCustomReferenceIds, setSelectedCustomReferenceIds] = useState<string[]>([]);
  const [selectedUserImage, setSelectedUserImage] = useState<ReferenceImage | null>(null);
  const [userImages, setUserImages] = useState<ReferenceImage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [generationStatus, setGenerationStatus] = useState('');
  const [referenceBatchMode, setReferenceBatchMode] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchResults, setBatchResults] = useState<ReferenceBatchResultItem[]>([]);

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [variableImages, setVariableImages] = useState<Record<string, ReferenceImage | null>>({});
  const [size, setSize] = useState('auto');
  const [quality, setQuality] = useState('medium');
  const [enableUserPrompt, setEnableUserPrompt] = useState(false);
  const [userPromptPriority, setUserPromptPriority] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [specifiedColors, setSpecifiedColors] = useState<SpecifiedColor[]>([]);
  const [useSmartColoring, setUseSmartColoring] = useState(false);
  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(null);
  const [editingColorValue, setEditingColorValue] = useState('');
  const [annotationEditorTarget, setAnnotationEditorTarget] = useState<AnnotationEditorTarget | null>(null);
  const [templateHistories, setTemplateHistories] = useState<GenerationHistoryItem[]>([]);
  const [loadingTemplateHistories, setLoadingTemplateHistories] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [deletingFailedHistories, setDeletingFailedHistories] = useState(false);
  const [deleteFailedModalOpen, setDeleteFailedModalOpen] = useState(false);
  const [pendingCompressionUploads, setPendingCompressionUploads] = useState<PendingCompressionUpload[]>([]);

  // 预览图片缩放和拖拽状态
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const historyId = searchParams.get('historyId');
  const isSpecialThreeDRender = template?.coverMetadata?.specialTemplateType === SPECIAL_TEMPLATE_3D_RENDER;
  const specialTemplateWorkspace = getSpecialTemplateWorkspace(template?.id);
  const canManage = user?.role === 'admin' || user?.role === 'sub_admin';
  const isAdmin = user?.role === 'admin';
  const isSubAdmin = user?.role === 'sub_admin';

  const fetchImageProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/image/providers', { cache: 'no-store' });
      if (!res.ok) return;

      const data: ImageProviderResponse = await res.json();
      setImageProviders(Array.isArray(data.providers) ? data.providers : []);
      setSelectedProviderId((prev) => {
        if (prev && data.providers?.some((provider) => provider.id === prev)) {
          return prev;
        }
        return data.defaultProviderId || data.providers?.[0]?.id || '';
      });
    } catch (providerError) {
      console.error('获取图片供应商失败:', providerError);
    }
  }, []);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    const savedAdminTheme = getStoredAdminColorTheme();
    setAdminColorTheme(savedAdminTheme);
    applyAdminColorTheme(savedAdminTheme);
    if (savedDarkMode === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          setUser(await res.json());
        } else {
          router.push('/auth');
        }
      } catch {
        router.push('/auth');
      }
    };

    fetchUser();
    fetchImageProviders();
    
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
  }, [templateId, historyId, fetchImageProviders]);

  useEffect(() => {
    const handleWindowFocus = () => {
      fetchImageProviders();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchImageProviders();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchImageProviders]);

  useEffect(() => {
    if (!user?.id || !templateId || !template || isSpecialThreeDRender) {
      return;
    }

    fetchTemplateHistories(user.id, templateId, template.name);
  }, [user?.id, templateId, template, isSpecialThreeDRender]);

  useEffect(() => {
    if (!template?.enableReferenceBatchMode || userImages.length < 2) {
      setReferenceBatchMode(false);
    }
  }, [template?.enableReferenceBatchMode, userImages.length]);

  useEffect(() => {
    setSelectedCustomReferenceIds((prev) => {
      const validIds = prev.filter((id) => customReferenceImages.some((image) => image.id === id));
      if (template?.allowMultipleCustomReferences === true || validIds.length <= 1) {
        return validIds;
      }
      return validIds.slice(-1);
    });
  }, [customReferenceImages, template?.allowMultipleCustomReferences]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    localStorage.setItem('darkMode', (!darkMode).toString());
    document.documentElement.classList.toggle('dark');
  };

  const handleAdminColorThemeChange = (theme: AdminColorTheme) => {
    setAdminColorTheme(theme);
    persistAdminColorTheme(theme);
    applyAdminColorTheme(theme);
  };

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/templates/${templateId}`);
      const data = await response.json();

      if (response.ok) {
        setTemplate(data);
        setSize(normalizeSizeValue(data.defaultSize));
        setQuality(data.defaultQuality || 'medium');
        setEnableUserPrompt(false);
        setUserPromptPriority(false);

        if (data.enableSpecifiedColors && data.specifiedColors) {
          setSpecifiedColors(data.specifiedColors);
        }
        setUseSmartColoring(false);

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
                if (config.userImages) {
                  const restoredUserImages = normalizeReferenceImageList(config.userImages);
                  setUserImages(restoredUserImages);
                }
                if (config.customReferenceImages) {
                  setCustomReferenceImages(normalizeReferenceImageList(config.customReferenceImages));
                }
                if (Array.isArray(config.selectedCustomReferenceIds)) {
                  setSelectedCustomReferenceIds(
                    config.selectedCustomReferenceIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
                  );
                }
                if (config.selectedPresetImage) {
                  setSelectedPresetImage(normalizeReferenceImage(config.selectedPresetImage));
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
                if (config.useSmartColoring !== undefined) setUseSmartColoring(config.useSmartColoring);
                if (config.size) setSize(normalizeSizeValue(config.size));
                if (config.quality) setQuality(config.quality);
                if (config.referenceBatchMode !== undefined) setReferenceBatchMode(config.referenceBatchMode);
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

  const fetchTemplateHistories = async (userId: string, currentTemplateId: string, currentTemplateName?: string) => {
    setLoadingTemplateHistories(true);

    try {
      const response = await fetch(`/api/history?userId=${userId}&limit=24`);
      if (!response.ok) {
        throw new Error('获取历史记录失败');
      }

      const histories = (await response.json()) as GenerationHistoryItem[];
      const filtered = histories
        .filter((item) => item.templateId === currentTemplateId || (!!currentTemplateName && item.templateName === currentTemplateName))
        .slice(0, 8);

      setTemplateHistories(filtered);
    } catch (historyError) {
      console.error('获取当前模板历史失败:', historyError);
      setTemplateHistories([]);
    } finally {
      setLoadingTemplateHistories(false);
    }
  };

  const refreshCurrentTemplateHistories = useCallback(() => {
    if (!user?.id || !templateId || !template || isSpecialThreeDRender) {
      return Promise.resolve();
    }

    return fetchTemplateHistories(user.id, templateId, template.name);
  }, [user?.id, templateId, template, isSpecialThreeDRender]);

  const uploadPreparedFiles = useCallback(async (
    filesToUpload: File[],
    source: UploadTarget,
    variableKey?: string
  ) => {
    if (filesToUpload.length === 0) {
      return;
    }

    const uploadPromises = filesToUpload.map(async (file) => {
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
      const prefix = source === 'variable' ? `var_${variableKey || 'image'}` : source;

      return {
        id: `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url: data.url,
        name: file.name,
        originalUrl: data.url,
        annotations: [],
        annotationTokens: []
      } satisfies ReferenceImage;
    });

    const uploadedImages = await Promise.all(uploadPromises);

    if (source === 'main') {
      const allowMultipleUploads = template?.enableReferenceBatchMode === true;
      setUserImages((prev) => {
        const updatedImages = allowMultipleUploads ? [...prev, ...uploadedImages] : uploadedImages.slice(0, 1);
        if (!selectedUserImage || !allowMultipleUploads) {
          setSelectedUserImage(updatedImages[0] || null);
        }
        return updatedImages;
      });
      setBatchResults([]);
      return;
    }

    if (source === 'custom') {
      const allowMultipleCustomReferences = template?.allowMultipleCustomReferences === true;
      setCustomReferenceImages((prev) => {
        const updatedImages = allowMultipleCustomReferences ? [...prev, ...uploadedImages] : uploadedImages.slice(0, 1);
        setSelectedCustomReferenceIds(updatedImages.map((image) => image.id));
        return updatedImages;
      });
      setSelectedPresetImage(null);
      return;
    }

    if (variableKey) {
      setVariableImages((prev) => ({ ...prev, [variableKey]: uploadedImages[0] || null }));
    }
  }, [selectedUserImage, template?.allowMultipleCustomReferences, template?.enableReferenceBatchMode]);

  const processSelectedUploads = useCallback(async (
    selectedFiles: File[],
    source: UploadTarget,
    variableKey?: string
  ) => {
    if (selectedFiles.length === 0) {
      return;
    }

    const inspectedFiles = await Promise.all(
      selectedFiles.map(async (file) => {
        const dimensions = await getImageFileDimensions(file);
        const reasons = getReferenceUploadViolations({
          width: dimensions.width,
          height: dimensions.height,
          sizeBytes: file.size
        });

        return {
          id: `${source}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          file,
          source,
          variableKey,
          width: dimensions.width,
          height: dimensions.height,
          sizeBytes: file.size,
          reasons
        } satisfies PendingCompressionUpload;
      })
    );

    const uploadNow = inspectedFiles.filter((item) => item.reasons.length === 0).map((item) => item.file);
    const needCompression = inspectedFiles.filter((item) => item.reasons.length > 0);

    if (uploadNow.length > 0) {
      await uploadPreparedFiles(uploadNow, source, variableKey);
    }

    if (needCompression.length > 0) {
      setPendingCompressionUploads((prev) => [...prev, ...needCompression]);
    }
  }, [uploadPreparedFiles]);

  const handleCompressPendingUploads = async () => {
    if (pendingCompressionUploads.length === 0) {
      return;
    }

    setCompressingPendingUploads(true);
    setUploadingImage(true);
    setError('');

    try {
      const groupedUploads = new Map<string, { source: UploadTarget; variableKey?: string; files: File[] }>();

      for (const pendingUpload of pendingCompressionUploads) {
        const compressedFile = await compressReferenceUploadImage(pendingUpload.file);
        const compressedDimensions = await getImageFileDimensions(compressedFile);
        const remainingViolations = getReferenceUploadViolations({
          width: compressedDimensions.width,
          height: compressedDimensions.height,
          sizeBytes: compressedFile.size
        });

        if (remainingViolations.length > 0) {
          throw new Error(`${pendingUpload.file.name} 压缩后仍超限：${remainingViolations.join('；')}`);
        }

        const key = `${pendingUpload.source}:${pendingUpload.variableKey || ''}`;
        const group = groupedUploads.get(key);

        if (group) {
          group.files.push(compressedFile);
        } else {
          groupedUploads.set(key, {
            source: pendingUpload.source,
            variableKey: pendingUpload.variableKey,
            files: [compressedFile]
          });
        }
      }

      for (const group of groupedUploads.values()) {
        await uploadPreparedFiles(group.files, group.source, group.variableKey);
      }

      setPendingCompressionUploads([]);
    } catch (compressionError) {
      console.error('压缩上传失败:', compressionError);
      setError(`压缩上传失败，请手动缩放后重试。限制：${getReferenceUploadLimitText()}`);
    } finally {
      setCompressingPendingUploads(false);
      setUploadingImage(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    setError('');

    try {
      await processSelectedUploads(Array.from(files), 'main');
    } catch (error) {
      console.error('上传失败:', error);
      setError('图片上传失败');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleCustomReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    setError('');

    try {
      await processSelectedUploads(Array.from(files), 'custom');
    } catch (error) {
      console.error('上传自定义模板参考图失败:', error);
      setError('自定义模板参考图上传失败');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (imageId: string) => {
    setUserImages(prev => {
      const next = prev.filter(img => img.id !== imageId);
      setSelectedUserImage(current => current?.id === imageId ? (next[0] || null) : current);
      return next;
    });
    setBatchResults(prev => prev.filter(item => item.sourceImage.id !== imageId));
  };

  const handleRemoveCustomReferenceImage = (imageId: string) => {
    setCustomReferenceImages((prev) => prev.filter((image) => image.id !== imageId));
    setSelectedCustomReferenceIds((prev) => prev.filter((id) => id !== imageId));
  };

  const handleToggleCustomReferenceSelection = (imageId: string) => {
    const allowMultipleCustomReferences = template?.allowMultipleCustomReferences === true;
    setSelectedCustomReferenceIds((prev) => {
      if (allowMultipleCustomReferences) {
        return prev.includes(imageId)
          ? prev.filter((id) => id !== imageId)
          : [...prev, imageId];
      }

      return prev[0] === imageId ? [] : [imageId];
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
    options: { scope: 'main' | 'variable' | 'templateCustom'; referenceLabel: string; variableKey?: string }
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
      } else if (annotationEditorTarget.scope === 'templateCustom') {
        setCustomReferenceImages(prev => prev.map(image => image.id === updatedImage.id ? updatedImage : image));
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
      await processSelectedUploads([file], 'variable', key);
    } catch (error) {
      console.error('上传变量图片失败:', error);
      setError('图片上传失败');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const getImageVariables = () => template?.variables?.filter((variable) => variable.type === 'image') || [];

  const getActiveTemplateReferenceImages = useCallback(() => {
    const presetReferenceImages = template?.referenceImages || [];

    const selectedCustomImages = customReferenceImages.filter((image) => selectedCustomReferenceIds.includes(image.id));
    if (selectedCustomImages.length > 0) {
      return selectedCustomImages;
    }

    if (selectedPresetImage) {
      const matchedPreset = presetReferenceImages.find((image) => image.id === selectedPresetImage.id);
      if (matchedPreset) {
        return [matchedPreset];
      }
    }

    return presetReferenceImages;
  }, [template, customReferenceImages, selectedCustomReferenceIds, selectedPresetImage]);

  const getVariableReferenceLabel = (key: string) => {
    const imageVariables = getImageVariables();
    const variableIndex = imageVariables.findIndex((variable) => variable.key === key);
    const presetCount = getActiveTemplateReferenceImages().length;
    return `参考图${presetCount + variableIndex + 1}`;
  };

  const getMainReferenceLabel = () => {
    const presetCount = getActiveTemplateReferenceImages().length;
    const imageVariables = getImageVariables();
    return `参考图${presetCount + imageVariables.length + 1}`;
  };

  const getAnnotationPromptEntries = (mainImage: ReferenceImage | null = selectedUserImage) => {
    const entries: Array<{ referenceLabel: string; tokens: AnnotationPromptToken[] }> = [];
    const imageVariables = getImageVariables();
    const activeTemplateReferenceImages = getActiveTemplateReferenceImages();
    const presetCount = activeTemplateReferenceImages.length;

    activeTemplateReferenceImages.forEach((image, index) => {
      if (image.annotationTokens?.length) {
        entries.push({
          referenceLabel: `参考图${index + 1}`,
          tokens: image.annotationTokens
        });
      }
    });

    imageVariables.forEach((variable, index) => {
      const image = variableImages[variable.key];
      if (image?.annotationTokens?.length) {
        entries.push({
          referenceLabel: `参考图${presetCount + index + 1}`,
          tokens: image.annotationTokens
        });
      }
    });

    if (template?.showMainVisual !== false && mainImage?.annotationTokens?.length) {
      entries.push({
        referenceLabel: `参考图${presetCount + imageVariables.length + 1}`,
        tokens: mainImage.annotationTokens
      });
    }

    return entries;
  };

  const getRenderedPrompt = (mainImage: ReferenceImage | null = selectedUserImage) => {
    if (!template?.promptTemplate) return '';

    const annotationPromptBlock = buildReferenceAnnotationPromptBlock(getAnnotationPromptEntries(mainImage));

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
    // 计算顺序：当前生效的模板参考图 -> 变量中的图片 -> 通用上传的参考图
    const presetCount = getActiveTemplateReferenceImages().length;
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
      prompt = prompt.replace(regex, useSmartColoring ? SMART_COLOR_PROMPT : color.color);
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
    if (selectedColorIndex === index) {
      setEditingColorValue(newColor);
    }
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

  const getAllImages = (mainImage: ReferenceImage | null = selectedUserImage): ReferenceImage[] => {
    const allImages: ReferenceImage[] = [];
    
    // 1. 当前生效的模板参考图
    allImages.push(...getActiveTemplateReferenceImages());
    
    // 2. 变量图片 (保持和 getRenderedPrompt 中一样的顺序)
    const imageVariables = getImageVariables();
    imageVariables.forEach(v => {
      const img = variableImages[v.key];
      if (img) {
        allImages.push(img);
      }
    });

    // 3. 通用参考图 (仅在启用时添加)
    if (template?.showMainVisual !== false && mainImage) {
      allImages.push(mainImage);
    }
    
    return allImages;
  };

  const getMissingRequiredVariable = () => {
    if (!isSpecialThreeDRender) {
      return null;
    }

    const requiredVariables = template?.variables?.filter((variable) => variable.required) || [];

    return requiredVariables.find((variable) => {
      if (variable.type === 'image') {
        return !variableImages[variable.key];
      }

      if (variable.multiSelect) {
        return parseStoredValues(formData[variable.key]).length === 0;
      }

      return !(formData[variable.key] || '').trim();
    }) || null;
  };

  const ensureGenerationReady = (mainImage: ReferenceImage | null = selectedUserImage) => {
    const allImages = getAllImages(mainImage);
    const shouldRequireMainVisual = template?.showMainVisual !== false;
    const missingRequiredVariable = getMissingRequiredVariable();

    if (allImages.length === 0 && shouldRequireMainVisual) {
      setError('请至少选择一张参考图');
      return null;
    }

    if (missingRequiredVariable) {
      setError(`请先完成「${missingRequiredVariable.label}」配置`);
      return null;
    }

    const renderedPrompt = getRenderedPrompt(mainImage);
    if (!renderedPrompt || !renderedPrompt.trim()) {
      setError('模板缺少提示词，请联系管理员检查模板配置');
      return null;
    }

    const imageVariables = template?.variables?.filter(v => v.type === 'image') || [];
    const variableImageUrls = imageVariables
      .map(v => variableImages[v.key]?.url)
      .filter(url => !!url) as string[];
    const requestMode = allImages.length > 0 ? (template?.mode || 'generation') : 'generation';

    return {
      allImages,
      renderedPrompt,
      variableImageUrls,
      requestData: {
        userId: user?.id,
        templateId: template?.id,
        templateName: template?.name,
        mode: requestMode,
        promptTemplate: renderedPrompt,
        negativePrompt: template?.negativePrompt,
        variables: formData,
        size,
        quality,
        referenceImages: getActiveTemplateReferenceImages().map((img) => img.url),
        images: [...variableImageUrls, ...(mainImage ? [mainImage.url] : [])],
        userPrompt: enableUserPrompt ? userPrompt : null,
        userPromptPriority: userPromptPriority,
        config: {
          formData,
          variableImages,
          userImages,
          customReferenceImages,
          selectedCustomReferenceIds,
          selectedPresetImage,
          selectedUserImage: mainImage,
          userPrompt,
          enableUserPrompt,
          userPromptPriority,
          useSmartColoring,
          size,
          quality,
          referenceBatchMode
        }
      }
    };
  };

  const requestGeneration = async (
    mainImage: ReferenceImage | null = selectedUserImage,
    options?: GenerationRequestOptions
  ) => {
    const generationData = ensureGenerationReady(mainImage);
    if (!generationData) {
      return null;
    }

    const currentReferenceBatchMode = options?.forceBatchMode ?? referenceBatchMode;
    const requestData = {
      ...generationData.requestData,
        providerId: selectedProviderId || undefined,
      referenceBatchMode: currentReferenceBatchMode,
      batchContext: options?.batchContext,
      config: {
        ...generationData.requestData.config,
        referenceBatchMode: currentReferenceBatchMode,
        batchContext: options?.batchContext,
        batchReferenceImages: currentReferenceBatchMode
          ? (options?.batchContext?.allUserImages || userImages)
          : userImages
      }
    };

    console.info('[generate] request', {
      totalReferences: generationData.allImages.length,
      variableReferenceCount: generationData.variableImageUrls.length,
      annotatedReferenceCount: getAnnotationPromptEntries(mainImage).length,
      promptLength: generationData.renderedPrompt.length,
      batchMode: currentReferenceBatchMode,
      batchSequence: options?.batchContext?.sequence,
      batchTotal: options?.batchContext?.total
    });

    const response = await fetch('/api/image/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    return {
      ...generationData,
      response,
      data: await response.json()
    };
  };

  const handleGenerateBatch = async () => {
    if (userImages.length < 2) {
      setError('批量模式至少需要上传 2 张参考图');
      return;
    }

    if (user && typeof user.credits === 'number' && user.credits < userImages.length) {
      setError(`当前批量任务需要 ${userImages.length} 点潮能力，余额不足`);
      return;
    }

    setError('');
    setResult(null);
    setBatchGenerating(true);
    setGenerationStatus('');
    setBatchProgress({ current: 0, total: userImages.length });

    const batchImages = [...userImages];
    const batchRequestId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const requestDelays: number[] = [];
    let cumulativeDelay = 0;
    batchImages.forEach((_, index) => {
      if (index === 0) {
        requestDelays.push(0);
        return;
      }

      cumulativeDelay += Math.floor(Math.random() * 5000) + 5000;
      requestDelays.push(cumulativeDelay);
    });

    const initialResults = batchImages.map((image, index) => ({
      id: image.id,
      sourceImage: image,
      result: null,
      error: '',
      status: index === 0 ? ('idle' as const) : ('waiting' as const),
      generationStatus: index === 0 ? '等待立即发送' : `${Math.ceil(requestDelays[index] / 1000)}s 后发送请求`
    }));
    setBatchResults(initialResults);

    try {
      let completedCount = 0;

      const scheduledTasks = batchImages.map((sourceImage, index) =>
        new Promise<void>((resolve) => {
          const dispatchDelay = requestDelays[index];

          window.setTimeout(async () => {
            try {
              setBatchResults((prev) =>
                prev.map((item) =>
                  item.id === sourceImage.id
                    ? { ...item, status: 'generating', generationStatus: '正在生成中...' }
                    : item
                )
              );

              const generationResponse = await requestGeneration(sourceImage, {
                forceBatchMode: true,
                batchContext: {
                  requestId: batchRequestId,
                  sequence: index + 1,
                  total: batchImages.length,
                  delayMs: dispatchDelay,
                  currentImage: sourceImage,
                  allUserImages: batchImages
                }
              });

              if (!generationResponse) {
                setBatchResults((prev) =>
                  prev.map((item) =>
                    item.id === sourceImage.id
                      ? { ...item, status: 'error', generationStatus: '', error: '批量请求准备失败' }
                      : item
                  )
                );
                return;
              }

              if (generationResponse.response.ok && generationResponse.data.success) {
                setBatchResults((prev) =>
                  prev.map((item) =>
                    item.id === sourceImage.id
                      ? {
                          ...item,
                          status: 'success',
                          generationStatus: '',
                          result: generationResponse.data,
                          error: ''
                        }
                      : item
                  )
                );
              } else {
                setBatchResults((prev) =>
                  prev.map((item) =>
                    item.id === sourceImage.id
                      ? {
                          ...item,
                          status: 'error',
                          generationStatus: '',
                          error: generationResponse.data.message || generationResponse.data.error || '生成失败'
                        }
                      : item
                  )
                );
              }
            } catch (taskError: any) {
              console.error('批量任务执行失败:', taskError);
              setBatchResults((prev) =>
                prev.map((item) =>
                  item.id === sourceImage.id
                    ? {
                        ...item,
                        status: 'error',
                        generationStatus: '',
                        error: taskError?.message || '批量任务执行失败'
                      }
                    : item
                )
              );
            } finally {
              completedCount += 1;
              setBatchProgress({ current: completedCount, total: batchImages.length });
              await refreshCurrentTemplateHistories();
              resolve();
            }
          }, dispatchDelay);
        })
      );

      await Promise.allSettled(scheduledTasks);
    } catch (batchError: any) {
      console.error('批量生成失败:', batchError);
      setError('批量生成中断：' + (batchError.message || '请稍后重试'));
    } finally {
      setBatchGenerating(false);
    }
  };

  const handleGenerate = async () => {
    if (referenceBatchMode) {
      await handleGenerateBatch();
      return;
    }

    setError('');
    setBatchResults([]);
    setResult(null);
    setGenerating(true);
    setGenerationStatus('正在准备请求...');

    try {
      setGenerationStatus('正在上传图片...');
      const generationResponse = await requestGeneration(selectedUserImage);
      setGenerationStatus('');

      if (!generationResponse) {
        return;
      }

      if (generationResponse.response.ok && generationResponse.data.success) {
        setResult(generationResponse.data);
      } else {
        setError(generationResponse.data.message || generationResponse.data.error || '生成失败，请重试');
      }

      await refreshCurrentTemplateHistories();
    } catch (error: any) {
      console.error('生成失败:', error);
      setGenerationStatus('');
      setError('网络错误：' + (error.message || '请检查网络连接'));
      await refreshCurrentTemplateHistories();
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (result?.imageUrl) {
      handleDownloadByUrl(result.imageUrl, template?.name || 'generated');
    }
  };

  const handleBatchDownload = async () => {
    const downloadableItems = batchResults.filter((item) => item.result?.imageUrl);
    if (downloadableItems.length === 0) {
      setError('当前没有可下载的批量结果');
      return;
    }

    if (downloadableItems.length === 1) {
      const item = downloadableItems[0];
      handleDownloadByUrl(item.result.imageUrl, `${template?.name || 'generated'}_${item.sourceImage.name}`);
      return;
    }

    try {
      const response = await fetch('/api/image/batch-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: downloadableItems.map((item, index) => ({
            url: item.result.imageUrl,
            name: `${template?.name || 'generated'}_${String(index + 1).padStart(2, '0')}_${item.sourceImage.name}`
          }))
        })
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || data.error || '批量下载失败');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${template?.name || '批量生成'}_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      console.error('批量下载失败:', downloadError);
      setError('批量下载失败，请重试');
    }
  };

  const handleDownloadByUrl = (url: string, filenamePrefix: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filenamePrefix}_${Date.now()}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setResult(null);
    setBatchResults([]);
    setError('');
    setUserImages([]);
    setSelectedUserImage(null);
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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('登出失败:', err);
    }
    router.push('/auth');
  };

  const handleBackToTemplates = () => {
    window.location.assign('/templates');
  };

  const handleReuseHistory = (item: GenerationHistoryItem) => {
    const nextTemplateId = item.templateId || templateId;
    if (!nextTemplateId) return;
    router.push(`/generate?templateId=${nextTemplateId}&historyId=${item.id}`);
  };

  const handleOpenDeleteFailedHistoriesModal = () => {
    const failedHistoryIds = templateHistories
      .filter((item) => item.status === 'failed')
      .map((item) => item.id);

    if (failedHistoryIds.length === 0) {
      setError('当前没有失败任务可删除');
      return;
    }

    setDeleteFailedModalOpen(true);
  };

  const handleConfirmDeleteFailedHistories = async () => {
    const failedHistoryIds = templateHistories
      .filter((item) => item.status === 'failed')
      .map((item) => item.id);

    if (failedHistoryIds.length === 0) {
      setDeleteFailedModalOpen(false);
      setError('当前没有失败任务可删除');
      return;
    }

    setDeletingFailedHistories(true);
    setError('');

    try {
      const response = await fetch('/api/history', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          historyIds: failedHistoryIds
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || '删除失败任务失败');
      }

      setDeleteFailedModalOpen(false);
      await refreshCurrentTemplateHistories();
    } catch (deleteError: any) {
      console.error('删除失败任务失败:', deleteError);
      setError(deleteError?.message || '删除失败任务失败，请稍后重试');
    } finally {
      setDeletingFailedHistories(false);
    }
  };

  const handleToggleReferenceBatchMode = () => {
    if (!supportsReferenceBatch || isAnyGenerating) {
      return;
    }

    if (!referenceBatchMode && userImages.length < 2) {
      setError('请先上传至少 2 张参考图，再切换到批量模式');
      return;
    }

    setError('');
    setReferenceBatchMode((prev) => !prev);
  };

  const isReferenceCardSelected = (image: ReferenceImage) => {
    if (referenceBatchMode) {
      return true;
    }

    return selectedUserImage?.id === image.id;
  };

  const activeTemplateReferenceImages = getActiveTemplateReferenceImages();
  const allImages = getAllImages();
  const annotationPromptEntries = getAnnotationPromptEntries();
  const annotationTokenCount = annotationPromptEntries.reduce((total, entry) => total + entry.tokens.length, 0);
  const hasMainVisualUpload = template?.showMainVisual !== false;
  const hasPresetReferenceImages = (template?.referenceImages?.length || 0) > 0;
  const hasCustomReferenceUpload = template?.enableCustomReferenceUpload === true;
  const hasActiveCustomReferences = activeTemplateReferenceImages.some((image) =>
    customReferenceImages.some((customImage) => customImage.id === image.id)
  );
  const hasTemplateReferenceWorkspace = hasPresetReferenceImages || hasCustomReferenceUpload;
  const hasPromptExtension = template?.allowUserPrompt !== false;
  const hasSpecifiedColorEditor = template?.enableSpecifiedColors && specifiedColors.length > 0;
  const showTopMetaGrid = !!template;
  const supportsReferenceBatch = !isSpecialThreeDRender && hasMainVisualUpload && template?.enableReferenceBatchMode === true;
  const canEnterReferenceBatchMode = supportsReferenceBatch && userImages.length > 1;
  const missingRequiredVariable = getMissingRequiredVariable();
  const canGenerateCurrentMode = referenceBatchMode
    ? userImages.length > 1 && !missingRequiredVariable
    : (hasMainVisualUpload ? allImages.length > 0 : true) && !missingRequiredVariable;
  const isAnyGenerating = generating || batchGenerating;
  const successfulBatchResults = batchResults.filter((item) => item.result?.imageUrl);
  const failedTemplateHistories = templateHistories.filter((item) => item.status === 'failed');
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

  if (loading) {
    return (
      <div className={`haipablo-static-shell min-h-screen flex items-center justify-center transition-colors duration-500 ${darkMode ? 'bg-[#121612]' : ''}`}>
        <div className="text-center">
          <Loader2 className={`w-12 h-12 animate-spin mx-auto mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`} />
          <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>加载模板中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`haipablo-static-shell transition-colors duration-500 ${isSpecialThreeDRender ? 'min-h-screen overflow-x-hidden' : 'h-screen overflow-hidden'} ${darkMode ? 'bg-[#121612]' : ''}`}>
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
      <AdminThemeModal
        darkMode={darkMode}
        isOpen={showAdminThemeModal}
        currentTheme={adminColorTheme}
        onClose={() => setShowAdminThemeModal(false)}
        onThemeChange={handleAdminColorThemeChange}
        onOpenAdminUsers={() => router.push('/admin/users?tab=image_providers')}
      />

      <AnimatePresence>
        {deleteFailedModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 p-4 backdrop-blur-md"
            onClick={() => {
              if (!deletingFailedHistories) {
                setDeleteFailedModalOpen(false);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={`w-full max-w-md overflow-hidden rounded-[28px] border shadow-2xl ${
                darkMode
                  ? 'border-[#3a463b] bg-[#161b17] text-white'
                  : 'border-white/70 bg-white text-gray-900'
              }`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={`relative overflow-hidden px-6 pb-5 pt-6 ${
                darkMode
                  ? 'bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.22),transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]'
                  : 'bg-[radial-gradient(circle_at_top,rgba(248,113,113,0.24),transparent_52%),linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.98))]'
              }`}>
                <button
                  type="button"
                  onClick={() => {
                    if (!deletingFailedHistories) {
                      setDeleteFailedModalOpen(false);
                    }
                  }}
                  disabled={deletingFailedHistories}
                  className={`absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                    darkMode
                      ? 'text-gray-400 hover:bg-white/10 hover:text-white'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  aria-label="关闭删除确认弹窗"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl border ${
                  darkMode
                    ? 'border-red-500/25 bg-red-500/12 text-red-300'
                    : 'border-red-200 bg-red-50 text-red-500'
                }`}>
                  <Trash2 className="h-6 w-6" />
                </div>

                <h3 className="mt-5 text-xl font-semibold tracking-tight">删除失败任务</h3>
                <p className={`mt-2 text-sm leading-6 ${
                  darkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  将删除当前模板最近记录中的
                  <span className={`mx-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                    darkMode ? 'bg-red-500/15 text-red-200' : 'bg-red-50 text-red-600'
                  }`}>
                    {failedTemplateHistories.length} 条失败任务
                  </span>
                  ，删除后不可恢复。
                </p>

                <div className={`mt-4 rounded-2xl border px-4 py-3 text-xs leading-5 ${
                  darkMode
                    ? 'border-[#334034] bg-[#111611] text-gray-400'
                    : 'border-gray-200 bg-gray-50 text-gray-500'
                }`}>
                  仅删除状态为 `failed` 的记录，成功出图不会受影响。
                </div>
              </div>

              <div className={`flex items-center justify-end gap-3 px-6 py-5 ${
                darkMode ? 'border-t border-white/10 bg-[#121612]' : 'border-t border-gray-100 bg-gray-50/70'
              }`}>
                <button
                  type="button"
                  onClick={() => setDeleteFailedModalOpen(false)}
                  disabled={deletingFailedHistories}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    darkMode
                      ? 'bg-[#242b25] text-stone-300 hover:bg-[#2c352d] hover:text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200'
                  }`}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteFailedHistories}
                  disabled={deletingFailedHistories}
                  className={`inline-flex min-w-[132px] items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition-all ${
                    deletingFailedHistories
                      ? 'cursor-not-allowed bg-red-400/80'
                      : 'bg-gradient-to-r from-red-500 to-rose-500 shadow-lg shadow-red-500/25 hover:scale-[1.01] hover:from-red-600 hover:to-rose-600 active:scale-[0.99]'
                  }`}
                >
                  {deletingFailedHistories ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      删除中...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      确认删除
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      <header className={`haipablo-topbar sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-500 ${darkMode ? 'bg-[#171c18]/72 border-[#f5ecd9]/10' : 'bg-white/60 border-white/50'}`}>
        <div className="mx-auto flex w-[min(94vw,1320px)] items-center relative px-4 py-3 xl:px-3 2xl:px-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleBackToTemplates}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'text-stone-400 hover:bg-white/[0.07] hover:text-stone-100' : 'hover:bg-gray-100 text-gray-700'}`}
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
                  ? 'bg-[#f4ede0] border-[#f4ede0]/25 text-[#2b241d]' 
                  : 'bg-gray-950 border-gray-900 text-white'
              }`}>
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">潮能力: {user.credits ?? 0}</span>
              </div>
            )}
            {user?.role === 'admin' && (
              <span className={`hidden sm:flex px-2 py-1 text-xs font-medium rounded-full items-center gap-1 w-fit ${
                darkMode 
                  ? 'bg-amber-950/45 text-amber-300 border border-amber-800/70' 
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                <Shield className="w-3 h-3" />
                管理员
              </span>
            )}
            {user?.role === 'sub_admin' && (
              <span className={`hidden sm:flex px-2 py-1 text-xs font-medium rounded-full items-center gap-1 w-fit ${
                darkMode 
                  ? 'bg-teal-950/45 text-teal-300 border border-teal-800/70' 
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
                  ? 'bg-[#26211b] hover:bg-[#312922] text-amber-300 hover:text-amber-200' 
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
              <UserMenuDropdown
                user={user}
                darkMode={darkMode}
                isOpen={showUserMenu}
                onToggle={() => setShowUserMenu((prev) => !prev)}
                onClose={() => setShowUserMenu(false)}
                onHistory={() => router.push('/history')}
                onAdminPanel={() => router.push('/admin/users?tab=image_providers')}
                onThemeSettings={() => setShowAdminThemeModal(true)}
                onAdminUsers={() => router.push('/admin/users')}
                onLogout={handleLogout}
                canManage={canManage}
                isAdmin={isAdmin}
                isSubAdmin={isSubAdmin}
                manageLabel={isAdmin ? '用户与部门管理' : '人员列表'}
                avatarSize="lg"
                showTriggerName={true}
                triggerClassName="flex items-center gap-3 hover:opacity-80 transition-opacity"
                triggerTextClassName="hidden lg:flex min-h-11 items-center"
              />
            ) : (
              <button
                onClick={() => router.push('/auth')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  darkMode 
                    ? 'bg-[#f4ede0] text-[#2b241d] hover:bg-[#fbf6ed]' 
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                登录
              </button>
            )}
          </div>
        </div>
      </header>

      <div className={`mx-auto ${specialTemplateWorkspace ? specialTemplateWorkspace.layout.containerClassName : 'h-[calc(100vh-4.75rem)] w-[min(94vw,1320px)] overflow-hidden px-3 py-3 xl:px-3 2xl:px-4'}`}>
        <div className={specialTemplateWorkspace ? specialTemplateWorkspace.layout.gridClassName : 'grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[436px_minmax(0,1fr)] xl:grid-cols-[456px_minmax(0,1fr)]'}>
          <div className={specialTemplateWorkspace ? specialTemplateWorkspace.layout.mainColumnClassName : 'space-y-4 lg:self-start'}>
            {specialTemplateWorkspace && template && (
              <specialTemplateWorkspace.MainColumn
                darkMode={darkMode}
                template={template}
                allImages={allImages}
                size={size}
                quality={quality}
                setSize={setSize}
                setQuality={setQuality}
                sizeOptions={SIZE_OPTIONS}
                qualityOptions={QUALITY_OPTIONS}
                userImages={userImages}
                selectedUserImage={selectedUserImage}
                isReferenceCardSelected={isReferenceCardSelected}
                setSelectedUserImage={setSelectedUserImage}
                setPreviewImage={setPreviewImage}
                handleOpenAnnotationEditor={handleOpenAnnotationEditor}
                getMainReferenceLabel={getMainReferenceLabel}
                handleRemoveImage={handleRemoveImage}
                uploadingImage={uploadingImage}
                handleImageUpload={handleImageUpload}
                userPromptPriority={userPromptPriority}
                setUserPromptPriority={setUserPromptPriority}
                enableUserPrompt={enableUserPrompt}
                setEnableUserPrompt={setEnableUserPrompt}
                annotationPromptEntries={annotationPromptEntries}
                annotationTokenCount={annotationTokenCount}
                handleInsertAnnotationLabel={handleInsertAnnotationLabel}
                userPrompt={userPrompt}
                handleUserPromptChange={handleUserPromptChange}
                specialTemplateSections={specialTemplateSections}
                parseStoredValues={parseStoredValues}
                formData={formData}
                handleMultiSelectToggle={handleMultiSelectToggle}
                handleFormChange={handleFormChange}
                canGenerateCurrentMode={canGenerateCurrentMode}
                missingRequiredVariable={missingRequiredVariable}
                generating={generating}
                handleGenerate={handleGenerate}
              />
            )}

            {!specialTemplateWorkspace && (
              <div className="lg:sticky lg:top-16">
                <div className={`overflow-hidden rounded-[22px] border shadow-sm transition-colors duration-500 lg:flex lg:h-[calc(100vh-5.5rem)] lg:flex-col ${
                  darkMode ? 'border-[#2f3a31] bg-[#1a201b]' : 'border-gray-200 bg-white'
                }`}>
                  <div className={`border-b px-4 py-3.5 ${darkMode ? 'border-[#2f3a31] bg-[#1a201b]' : 'border-gray-200 bg-gray-50/70'}`}>
                    <p className={`text-[11px] font-semibold tracking-[0.24em] uppercase ${darkMode ? 'text-violet-300/70' : 'text-violet-600'}`}>Template Workspace</p>
                    <div className="mt-2 flex items-start justify-between gap-4">
                      <div>
                        <h2 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>工作台</h2>
                        {supportsReferenceBatch && (
                          <p className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            模板已开启批量参考图，可在单图和批量模式间切换。
                          </p>
                        )}
                      </div>
                      {supportsReferenceBatch && (
                        <button
                          type="button"
                          onClick={handleToggleReferenceBatchMode}
                          disabled={!canEnterReferenceBatchMode || isAnyGenerating}
                          className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            referenceBatchMode
                              ? 'bg-orange-500 text-white hover:bg-orange-600'
                              : darkMode
                                ? 'border border-[#334034] bg-[#222923] text-stone-200 hover:bg-[#2a332b]'
                                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {referenceBatchMode ? '单图' : '批量'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="haipablo-scrollbar min-h-0 overflow-y-auto px-4 py-4 lg:flex-1">
                    <div className="space-y-4">
                      {hasTemplateReferenceWorkspace && (
                        <div className={`rounded-2xl border p-3.5 ${darkMode ? 'border-[#2f3a31] bg-[#141915]/72' : 'border-gray-200 bg-gray-50/80'}`}>
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <h2 className={`flex items-center gap-2 text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                <ImageIcon className={`h-4 w-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                                模板参考图
                              </h2>
                              {hasCustomReferenceUpload && (
                                <p className={`mt-1 text-[11px] leading-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                  选中的自定义参考图会替代模板预设图；未选择时默认继续使用预设图。
                                </p>
                              )}
                            </div>
                            {hasCustomReferenceUpload && (
                              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                hasActiveCustomReferences
                                  ? 'bg-emerald-500 text-white'
                                  : darkMode
                                    ? 'bg-[#222923] text-stone-300'
                                    : 'bg-white text-gray-600 ring-1 ring-gray-200'
                              }`}>
                                {hasActiveCustomReferences ? `已替换 ${activeTemplateReferenceImages.length} 张` : '使用预设'}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2.5">
                            {template?.referenceImages.map((image, index) => (
                              <div
                                key={image.id}
                                className={`group relative cursor-pointer overflow-hidden rounded-xl transition-all ${
                                  selectedPresetImage?.id === image.id
                                    ? 'ring-2 ring-violet-500 ring-offset-2'
                                    : 'hover:ring-2 hover:ring-gray-300'
                                } ${hasActiveCustomReferences ? 'opacity-50' : ''}
                                `}
                                onClick={() => {
                                  setSelectedPresetImage(selectedPresetImage?.id === image.id ? null : image);
                                  setSelectedCustomReferenceIds([]);
                                }}
                              >
                                <img src={image.url} alt={`参考图 ${index + 1}`} className="h-[68px] w-full object-contain" style={{ objectPosition: 'center' }} />
                                <div className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${selectedPresetImage?.id === image.id ? 'bg-violet-600 text-white' : 'bg-gray-800 text-white'}`}>
                                  {hasActiveCustomReferences ? `预设${index + 1}` : selectedPresetImage?.id === image.id ? '已选中' : `图${index + 1}`}
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
                            {customReferenceImages.map((image, index) => {
                              const isSelected = selectedCustomReferenceIds.includes(image.id);
                              return (
                                <div
                                  key={image.id}
                                  className={`group relative cursor-pointer overflow-hidden rounded-xl transition-all ${
                                    isSelected ? 'ring-2 ring-emerald-500 ring-offset-2' : 'hover:ring-2 hover:ring-stone-400/35'
                                  }`}
                                  onClick={() => handleToggleCustomReferenceSelection(image.id)}
                                >
                                  <img src={image.url} alt={`自定义参考图 ${index + 1}`} className="h-[68px] w-full object-contain" style={{ objectPosition: 'center' }} />
                                  <div className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                    isSelected ? 'bg-emerald-600 text-white' : 'bg-orange-500 text-white'
                                  }`}>
                                    {isSelected ? '已替换' : `自定义${index + 1}`}
                                  </div>
                                  {isSelected && (
                                    <div className="absolute right-1 bottom-1 rounded-full bg-emerald-500 p-1 text-white shadow-lg">
                                      <CheckCircle className="h-3 w-3" />
                                    </div>
                                  )}
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
                                          scope: 'templateCustom',
                                          referenceLabel: `参考图${index + 1}`
                                        });
                                      }}
                                      className="rounded-full bg-violet-500 p-2 text-white shadow-lg transition-transform hover:scale-105"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveCustomReferenceImage(image.id);
                                      }}
                                      className="rounded-full bg-red-500 p-2 text-white shadow-lg transition-transform hover:scale-105"
                                      aria-label="删除自定义模板参考图"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                  {image.annotationTokens && image.annotationTokens.length > 0 && (
                                    <div className="absolute bottom-1 left-1 rounded-full bg-violet-600/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg">
                                      已标注
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {hasCustomReferenceUpload && (
                              <label className={`group relative flex h-[68px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed transition-all ${
                                darkMode
                                  ? 'border-[#334034] bg-[#1b211c] text-stone-300 hover:border-[#425143]'
                                  : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                              }`}>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple={template?.allowMultipleCustomReferences === true}
                                  onChange={handleCustomReferenceUpload}
                                  className="hidden"
                                  disabled={uploadingImage}
                                />
                                <Upload className="h-4 w-4" />
                                <span className="mt-1 text-[11px] font-medium">
                                  {uploadingImage ? '上传中...' : customReferenceImages.length > 0 ? '继续上传' : '上传自定义图'}
                                </span>
                              </label>
                            )}
                          </div>
                          {hasCustomReferenceUpload && (
                            <div className={`mt-3 rounded-xl border px-3 py-2 text-[11px] leading-5 ${
                              darkMode ? 'border-[#2f3a31] bg-[#1a201b] text-stone-400' : 'border-gray-200 bg-white text-gray-600'
                            }`}>
                              {template?.allowMultipleCustomReferences === true
                                ? '支持多张自定义模板参考图。点击卡片可选择或取消，当前选中的图片会按顺序替代模板预设参考图。'
                                : '当前模板只允许选择 1 张自定义模板参考图。再次上传会覆盖之前的自定义图，取消选中后会回退为模板预设参考图。'}
                            </div>
                          )}
                        </div>
                      )}

                      {hasMainVisualUpload && (
                        <div className={`rounded-2xl border p-3.5 ${darkMode ? 'border-[#2f3a31] bg-[#141915]/72' : 'border-gray-200 bg-gray-50/80'}`}>
                          <h2 className={`mb-3 flex items-center gap-2 text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            <Upload className={`h-4 w-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                            上传参考图
                          </h2>
                          {supportsReferenceBatch && (
                            <div className={`mb-3 rounded-xl border px-3 py-2 text-xs ${darkMode ? 'border-orange-900/60 bg-orange-950/20 text-orange-200' : 'border-orange-200 bg-orange-50 text-orange-700'}`}>
                              可上传多张参考图。切到批量模式后，会按当前参数轮换这些参考图依次生成。
                            </div>
                          )}
                          {userImages.length > 0 ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                {userImages.map((image, index) => {
                                  const isSelected = isReferenceCardSelected(image);
                                  return (
                                  <div
                                    key={image.id}
                                    className={`group relative cursor-pointer overflow-hidden rounded-xl transition-all ${
                                      isSelected
                                        ? 'ring-2 ring-green-500 ring-offset-2'
                                        : 'hover:ring-2 hover:ring-gray-300'
                                    }`}
                                    onClick={() => {
                                      if (referenceBatchMode) return;
                                      setSelectedUserImage(selectedUserImage?.id === image.id ? null : image);
                                    }}
                                  >
                                    <img
                                      src={image.url}
                                      alt={`用户上传 ${index + 1}`}
                                      className="h-[68px] w-full object-contain"
                                      style={{ objectPosition: 'center' }}
                                    />
                                    {isSelected && (
                                      <div className="absolute right-1 bottom-1 rounded-full bg-green-500 p-1 text-white shadow-lg">
                                        <CheckCircle className="h-3 w-3" />
                                      </div>
                                    )}
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
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveImage(image.id);
                                        }}
                                        className="rounded-full bg-red-500 p-2 text-white shadow-lg transition-transform hover:scale-105"
                                        aria-label="删除参考图"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                    <div className="absolute left-1 top-1 rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                      {referenceBatchMode ? '已加入批量' : isSelected ? '已选中' : `图${index + 1}`}
                                    </div>
                                    {image.annotationTokens && image.annotationTokens.length > 0 && (
                                      <div className="absolute bottom-1 left-1 rounded-full bg-violet-600/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg">
                                        已标注
                                      </div>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>
                              <label className={`block cursor-pointer rounded-xl border-2 border-dashed py-2 text-center transition-colors ${
                                darkMode ? 'border-[#334034] text-stone-400 hover:border-[#425143]' : 'border-gray-300 text-gray-600 hover:border-gray-400'
                              }`}>
                                <input type="file" accept="image/*" multiple={supportsReferenceBatch} onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                                <span className="text-xs">{uploadingImage ? '上传中...' : supportsReferenceBatch ? '+ 添加图片' : '重新上传'}</span>
                              </label>
                            </div>
                          ) : (
                            <div className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                              darkMode ? 'border-[#334034] hover:border-[#425143]' : 'border-gray-300 hover:border-gray-400'
                            }`}>
                              <input type="file" accept="image/*" multiple={supportsReferenceBatch} onChange={handleImageUpload} className="hidden" id="user-image-upload" disabled={uploadingImage} />
                              <label htmlFor="user-image-upload" className="cursor-pointer">
                                <Upload className={`mx-auto mb-2 h-8 w-8 ${darkMode ? 'text-stone-500' : 'text-gray-400'}`} />
                                <p className={`text-xs ${darkMode ? 'text-stone-400' : 'text-gray-600'}`}>{supportsReferenceBatch ? '点击上传参考图片' : '点击上传 1 张参考图片'}</p>
                              </label>
                            </div>
                          )}
                        </div>
                      )}

                      {pendingCompressionUploads.length > 0 && (
                        <div className={`rounded-2xl border p-3.5 ${darkMode ? 'border-amber-900/70 bg-amber-950/20' : 'border-amber-200 bg-amber-50/80'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h2 className={`flex items-center gap-2 text-sm font-semibold ${darkMode ? 'text-amber-100' : 'text-amber-900'}`}>
                                <Info className="h-4 w-4" />
                                图片超过上传限制
                              </h2>
                              <p className={`mt-1 text-xs leading-5 ${darkMode ? 'text-amber-200/90' : 'text-amber-800'}`}>
                                检测到 {pendingCompressionUploads.length} 张图片超限。你可以先手动缩放，或点击右侧按钮一键压缩后上传。限制：{getReferenceUploadLimitText()}。
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleCompressPendingUploads}
                              disabled={compressingPendingUploads || uploadingImage}
                              className={`inline-flex flex-shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                darkMode ? 'bg-amber-300 text-amber-950 hover:bg-amber-200' : 'bg-amber-600 text-white hover:bg-amber-500'
                              }`}
                            >
                              {compressingPendingUploads ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                              {compressingPendingUploads ? '压缩中...' : '一键压缩并上传'}
                            </button>
                          </div>
                          <div className="mt-3 space-y-2">
                            {pendingCompressionUploads.map((item) => (
                              <div
                                key={item.id}
                                className={`rounded-xl border px-3 py-2 text-xs ${darkMode ? 'border-amber-900/60 bg-black/10 text-amber-100' : 'border-amber-200 bg-white/80 text-amber-900'}`}
                              >
                                <p className="truncate font-medium">{item.file.name}</p>
                                <p className="mt-1 leading-5">
                                  当前尺寸 {item.width}x{item.height}，{formatFileSize(item.sizeBytes)}，原因：{item.reasons.join('；')}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {showTopMetaGrid && (
                        <div className={`rounded-2xl border p-3.5 ${darkMode ? 'border-[#2f3a31] bg-[#141915]/72' : 'border-gray-200 bg-gray-50/80'}`}>
                          <h2 className={`mb-3 flex items-center gap-2 text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            <Palette className={`h-4 w-4 ${darkMode ? 'text-stone-400' : 'text-gray-600'}`} />
                            生成参数
                          </h2>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {imageProviders.length > 0 && (
                              <div className="sm:col-span-2">
                                <label className={`mb-1.5 block text-xs font-medium ${darkMode ? 'text-stone-400' : 'text-gray-600'}`}>生成供应商</label>
                                <div className={`relative overflow-hidden rounded-2xl border shadow-[0_10px_28px_-18px_rgba(15,23,42,0.38)] transition-all ${darkMode ? 'border-[#334034]/80 bg-[#1b211c]/90' : 'border-white/80 bg-white/95'}`}>
                                  <div className={`pointer-events-none absolute inset-x-0 top-0 h-px ${darkMode ? 'bg-gradient-to-r from-transparent via-white/20 to-transparent' : 'bg-gradient-to-r from-transparent via-slate-200 to-transparent'}`} />
                                  <select
                                    value={selectedProviderId}
                                    onChange={(e) => setSelectedProviderId(e.target.value)}
                                    onFocus={() => fetchImageProviders()}
                                    className={`w-full appearance-none bg-transparent px-4 py-3 pr-11 text-sm font-medium outline-none ${darkMode ? 'text-white' : 'text-gray-900'}`}
                                  >
                                    {imageProviders.map((provider) => (
                                      <option key={provider.id} value={provider.id}>
                                        {provider.label}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${darkMode ? 'text-stone-500' : 'text-gray-400'}`} />
                                </div>
                                <p className={`mt-1.5 text-[11px] leading-5 ${darkMode ? 'text-stone-500' : 'text-gray-500'}`}>支持在前端切换供应商，具体地址、密钥与接口兼容由后端配置统一处理。</p>
                              </div>
                            )}

                            <div>
                              <label className={`mb-1.5 block text-xs font-medium ${darkMode ? 'text-stone-400' : 'text-gray-600'}`}>输出尺寸</label>
                              <div className={`relative overflow-hidden rounded-2xl border shadow-[0_10px_28px_-18px_rgba(15,23,42,0.38)] transition-all ${darkMode ? 'border-[#334034]/80 bg-[#1b211c]/90' : 'border-white/80 bg-white/95'}`}>
                                <div className={`pointer-events-none absolute inset-x-0 top-0 h-px ${darkMode ? 'bg-gradient-to-r from-transparent via-white/20 to-transparent' : 'bg-gradient-to-r from-transparent via-slate-200 to-transparent'}`} />
                                <select
                                  value={size}
                                  onChange={(e) => setSize(e.target.value)}
                                  className={`w-full appearance-none bg-transparent px-4 py-3 pr-11 text-sm font-medium outline-none ${darkMode ? 'text-white' : 'text-gray-900'}`}
                                >
                                  {SIZE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                                <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${darkMode ? 'text-stone-500' : 'text-gray-400'}`} />
                              </div>
                              <p className={`mt-1.5 text-[11px] leading-5 ${darkMode ? 'text-stone-500' : 'text-gray-500'}`}>预设为 2K+ 构图，覆盖方图、海报、电影宽幕与横幅场景。</p>
                            </div>
                            <div>
                              <label className={`mb-1.5 block text-xs font-medium ${darkMode ? 'text-stone-400' : 'text-gray-600'}`}>质量</label>
                              <div className={`relative overflow-hidden rounded-2xl border shadow-[0_10px_28px_-18px_rgba(15,23,42,0.38)] transition-all ${darkMode ? 'border-[#334034]/80 bg-[#1b211c]/90' : 'border-white/80 bg-white/95'}`}>
                                <div className={`pointer-events-none absolute inset-x-0 top-0 h-px ${darkMode ? 'bg-gradient-to-r from-transparent via-white/20 to-transparent' : 'bg-gradient-to-r from-transparent via-slate-200 to-transparent'}`} />
                                <select
                                  value={quality}
                                  onChange={(e) => setQuality(e.target.value)}
                                  className={`w-full appearance-none bg-transparent px-4 py-3 pr-11 text-sm font-medium outline-none ${darkMode ? 'text-white' : 'text-gray-900'}`}
                                >
                                  {QUALITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                                <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${darkMode ? 'text-stone-500' : 'text-gray-400'}`} />
                              </div>
                              <p className={`mt-1.5 text-[11px] leading-5 ${darkMode ? 'text-stone-500' : 'text-gray-500'}`}>建议预览用“均衡模式”，最终交付再切到“质量优先”。</p>
                            </div>
                          </div>
                          <div className={`mt-3 rounded-xl border p-3 text-xs leading-5 ${darkMode ? 'border-[#2f3a31] bg-[#1a201b]/90 text-stone-300' : 'border-gray-200 bg-white text-gray-600'}`}>
                            系统会自动沿用模板默认参数，并根据模板是否开放补充提示词、颜色编辑、参考图上传等能力来动态展示对应模块。
                          </div>
                        </div>
                      )}

                      {hasPromptExtension && (
                        <div className={`rounded-2xl border p-3.5 ${darkMode ? 'border-[#2f3a31] bg-[#141915]/72' : 'border-gray-200 bg-gray-50/80'}`}>
                          <div className="flex flex-col gap-4">
                            <div
                              onClick={() => setUserPromptPriority(!userPromptPriority)}
                              className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 transition-colors ${
                                darkMode
                                  ? 'border-amber-900/60 bg-amber-950/20 hover:bg-amber-950/30'
                                  : 'border-amber-100 bg-amber-50/70 hover:bg-amber-50'
                              }`}
                            >
                              <span className={`text-xs font-bold ${darkMode ? 'text-amber-200' : 'text-amber-800'}`}>模板优先</span>
                              <div className={`relative h-6 w-10 rounded-full transition-colors duration-200 ${!userPromptPriority ? 'bg-amber-500' : 'bg-gray-200'}`}>
                                <motion.div
                                  animate={{ x: !userPromptPriority ? 18 : 2 }}
                                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                  className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
                                />
                              </div>
                            </div>

                            <div
                              className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors ${
                                darkMode
                                  ? 'border-violet-900/60 bg-violet-950/20 hover:bg-violet-950/30'
                                  : 'border-violet-100 bg-violet-50/70 hover:bg-violet-50'
                              }`}
                              onClick={() => setEnableUserPrompt(!enableUserPrompt)}
                            >
                              <div className={`flex h-5 w-5 items-center justify-center rounded-lg border-2 transition-all ${
                                enableUserPrompt ? 'border-violet-500 bg-violet-500' : darkMode ? 'border-[#425143] bg-[#222923]' : 'border-gray-300 bg-white'
                              }`}>
                                {enableUserPrompt && <div className="h-2 w-2 rounded-full bg-white" />}
                              </div>
                              <div>
                                <p className={`text-sm font-semibold ${darkMode ? 'text-violet-100' : 'text-violet-900'}`}>补充提示词</p>
                                <p className={`mt-1 text-xs ${darkMode ? 'text-violet-300/70' : 'text-violet-700/70'}`}>开启后可补充品牌调性、限制词和局部要求</p>
                              </div>
                            </div>
                          </div>

                          {enableUserPrompt && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 space-y-3">
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
                                  <div className={`absolute inset-0 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border px-4 py-3 text-sm font-mono pointer-events-none ${
                                    darkMode ? 'border-[#334034] bg-[#1b211c] text-white' : 'border-gray-200 bg-white text-gray-900'
                                  }`}>
                                    {userPrompt.split(/(指定色\d+)/).map((part, index) => (
                                      /^指定色\d+$/.test(part)
                                        ? <span key={index} className="rounded bg-violet-200 px-1 font-semibold text-violet-900">{part}</span>
                                        : <span key={index}>{part}</span>
                                    ))}
                                  </div>
                                )}
                                <textarea
                                  value={userPrompt}
                                  onChange={(e) => handleUserPromptChange(e.target.value)}
                                  rows={4}
                                  className={`w-full resize-none rounded-xl border px-4 py-3 text-sm font-mono outline-none transition-colors duration-300 ${
                                    darkMode ? 'border-[#334034] bg-transparent text-white placeholder:text-stone-500' : 'border-gray-200 bg-transparent text-gray-900 placeholder-gray-400'
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
                        <div className={`rounded-2xl border p-3.5 ${darkMode ? 'border-[#2f3a31] bg-[#141915]/72' : 'border-gray-200 bg-gray-50/80'}`}>
                          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h2 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>指定色配置</h2>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                              <button
                                type="button"
                                onClick={() => setUseSmartColoring((prev) => !prev)}
                                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                                  useSmartColoring
                                    ? darkMode
                                      ? 'border-fuchsia-500/60 bg-fuchsia-500/15 text-fuchsia-200'
                                      : 'border-fuchsia-300 bg-fuchsia-100 text-fuchsia-700'
                                    : darkMode
                                      ? 'border-[#334034] bg-[#1b211c] text-stone-300'
                                      : 'border-gray-200 bg-white text-gray-600'
                                }`}
                              >
                                <span
                                  className={`relative h-5 w-9 rounded-full transition-colors ${
                                    useSmartColoring
                                      ? 'bg-[linear-gradient(135deg,#7c3aed,#ec4899,#f59e0b)]'
                                      : darkMode
                                        ? 'bg-[#425143]'
                                        : 'bg-gray-300'
                                  }`}
                                >
                                  <span
                                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                      useSmartColoring ? 'translate-x-4' : 'translate-x-0.5'
                                    }`}
                                  />
                                </span>
                                智能
                              </button>
                              {hasPromptExtension && enableUserPrompt && (
                                <button
                                  type="button"
                                  onClick={handleAddNewColorMarker}
                                className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                                    darkMode ? 'border-violet-700 bg-violet-900/50 text-violet-300 hover:bg-violet-900/70' : 'border-violet-300 bg-violet-100 text-violet-700 hover:bg-violet-200'
                                  }`}
                                >
                                  指定颜色+
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            {specifiedColors.map((color, index) => (
                              <div key={`${color.name}-${index}`} className={`flex items-center gap-3 rounded-xl border p-3 ${darkMode ? 'border-[#2f3a31] bg-[#1b211c]/70' : 'border-gray-200 bg-white'}`}>
                                <div className="relative flex-shrink-0">
                                  {useSmartColoring ? (
                                    <div className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-fuchsia-200 shadow-inner">
                                      <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_180deg,#7c3aed,#06b6d4,#22c55e,#f59e0b,#ec4899,#7c3aed)] animate-[spin_3s_linear_infinite]" />
                                      <div className={`absolute inset-[5px] rounded-full ${darkMode ? 'bg-[#141915]/90' : 'bg-white/85'}`} />
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <Sparkles className="h-3.5 w-3.5 text-fuchsia-500" />
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      className="h-8 w-8 cursor-pointer rounded-full border-2 border-gray-200 shadow-inner"
                                      style={{ backgroundColor: color.color }}
                                      onClick={() => {
                                        const nextSelectedIndex = selectedColorIndex === index ? null : index;
                                        setSelectedColorIndex(nextSelectedIndex);
                                        if (nextSelectedIndex === index) {
                                          setEditingColorValue(color.color);
                                        }
                                      }}
                                    >
                                      <input type="color" value={color.color} onChange={(e) => handleColorValueChange(index, e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                                    </div>
                                  )}
                                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                                    {color.name.replace('指定色', '')}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1 truncate text-sm">{color.label || color.name}</div>
                                {useSmartColoring ? (
                                  <div
                                    className={`flex h-[30px] w-24 items-center justify-center rounded border px-2 py-1 text-xs font-semibold ${
                                      darkMode
                                        ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200'
                                        : 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700'
                                    }`}
                                  >
                                    智能配色
                                  </div>
                                ) : (
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
                                    className={`w-24 rounded border px-2 py-1 text-xs font-mono ${darkMode ? 'border-[#334034] bg-[#141915]' : 'border-gray-200 bg-white'}`}
                                    placeholder="#888888"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {!!template?.variables?.length && (
                        <div className={`rounded-2xl border p-3.5 ${darkMode ? 'border-[#2f3a31] bg-[#141915]/72' : 'border-gray-200 bg-gray-50/80'}`}>
                          <h2 className={`mb-3 flex items-center gap-2 text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            <Info className={`h-4 w-4 ${darkMode ? 'text-stone-400' : 'text-gray-600'}`} />
                            填写信息
                          </h2>

                          <div className="space-y-4">
                            {template.variables.map((variable) => (
                              <div key={variable.key}>
                                <label className={`mb-2 block text-sm font-medium ${darkMode ? 'text-stone-300' : 'text-gray-700'}`}>
                                  {variable.label}
                                  {variable.required && <span className="ml-1 text-red-500">*</span>}
                                </label>

                                {variable.type === 'textarea' ? (
                                  <textarea
                                    value={formData[variable.key] || ''}
                                    onChange={(e) => handleFormChange(variable.key, e.target.value)}
                                    rows={3}
                                    className={`w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none transition-colors duration-300 ${
                                      darkMode
                                        ? 'border-[#334034] bg-[#222923] text-white placeholder:text-stone-500'
                                        : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400'
                                    }`}
                                    placeholder={variable.placeholder || `请输入${variable.label}`}
                                  />
                                ) : variable.type === 'color' ? (
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`relative h-12 w-12 overflow-hidden rounded-lg border-2 shadow-inner ${
                                        darkMode ? 'border-[#334034]' : 'border-gray-200'
                                      }`}
                                      style={{ backgroundColor: formData[variable.key] || '#ffffff' }}
                                    >
                                      <input
                                        type="color"
                                        value={formData[variable.key] || '#ffffff'}
                                        onChange={(e) => handleFormChange(variable.key, e.target.value)}
                                        className="absolute inset-0 h-full w-full scale-150 cursor-pointer opacity-0"
                                      />
                                    </div>
                                    <input
                                      type="text"
                                      value={formData[variable.key] || ''}
                                      onChange={(e) => handleFormChange(variable.key, e.target.value)}
                                      className={`flex-1 rounded-xl border px-4 py-3 font-mono text-sm outline-none transition-colors duration-300 ${
                                        darkMode
                                          ? 'border-[#334034] bg-[#222923] text-white placeholder:text-stone-500'
                                          : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400'
                                      }`}
                                      placeholder="#FFFFFF"
                                    />
                                  </div>
                                ) : variable.type === 'select' ? (
                                  <select
                                    value={formData[variable.key] || ''}
                                    onChange={(e) => handleFormChange(variable.key, e.target.value)}
                                    className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors duration-300 ${
                                      darkMode ? 'border-[#334034] bg-[#222923] text-white' : 'border-gray-200 bg-white text-gray-900'
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
                                      <div className="group relative aspect-video overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                                        <img
                                          src={variableImages[variable.key]?.url}
                                          alt={variable.label}
                                          className="h-full w-full object-contain"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setPreviewImage(variableImages[variable.key]?.url || null);
                                            }}
                                            className="rounded-lg bg-white p-2 text-gray-900 transition-colors hover:bg-gray-100"
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
                                            className="rounded-lg bg-violet-500 p-2 text-white transition-colors hover:bg-violet-600"
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </button>
                                          <label
                                            htmlFor={`upload-${variable.key}`}
                                            className="cursor-pointer rounded-lg bg-white px-3 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-100"
                                          >
                                            更换
                                          </label>
                                          <button
                                            onClick={() => setVariableImages(prev => ({ ...prev, [variable.key]: null }))}
                                            className="rounded-lg bg-red-500 px-3 py-2 text-sm text-white transition-colors hover:bg-red-600"
                                          >
                                            删除
                                          </button>
                                        </div>
                                        <div className="absolute left-2 top-2 rounded bg-violet-600 px-2 py-1 text-[10px] font-bold text-white">
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
                                        className={`flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                                          darkMode
                                            ? 'border-[#334034] bg-[#222923]/60 hover:border-violet-500/50'
                                            : 'border-gray-200 bg-gray-50 hover:border-violet-400'
                                        }`}
                                      >
                                        <Upload className="mb-2 h-6 w-6 text-gray-400" />
                                        <span className="text-xs text-gray-500">点击上传{variable.label}</span>
                                        <div className="mt-1 rounded bg-gray-200 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-gray-700">
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
                                    className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors duration-300 ${
                                      darkMode
                                        ? 'border-[#334034] bg-[#222923] text-white placeholder:text-stone-500'
                                        : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400'
                                    }`}
                                    placeholder={variable.placeholder || `请输入${variable.label}`}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`border-t px-4 py-3.5 lg:mt-auto ${darkMode ? 'border-[#2f3a31] bg-[#141915]/90' : 'border-gray-200 bg-gray-50/90'}`}>
                    <div className="space-y-3">
                      <button
                        onClick={handleGenerate}
                        disabled={isAnyGenerating || !canGenerateCurrentMode}
                        className={`group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl px-5 py-3.5 text-sm font-bold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 shadow-xl ${
                          !canGenerateCurrentMode ? 'grayscale opacity-50' : ''
                        }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 via-pink-500 to-orange-400 opacity-90 transition-opacity group-hover:opacity-100" />
                        <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.3)_45%,rgba(255,255,255,0.3)_55%,transparent_75%)] bg-[length:200%_100%] animate-[shimmer_2s_infinite] opacity-0 transition-opacity group-hover:opacity-100" />
                        <div className="relative flex items-center gap-3">
                          {isAnyGenerating ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                          ) : (
                            <Sparkles className="h-6 w-6 transition-transform group-hover:rotate-12" />
                          )}
                          <span className="tracking-[0.18em]">
                            {referenceBatchMode ? (batchGenerating ? '批量生成中...' : '批量生成') : (generating ? '创作中...' : '创作')}
                          </span>
                        </div>
                      </button>
                      {referenceBatchMode && !canGenerateCurrentMode && (
                        <p className={`text-center text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          批量模式至少需要 2 张参考图
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={specialTemplateWorkspace ? specialTemplateWorkspace.layout.sidebarClassName : 'space-y-4 lg:flex lg:h-[calc(100vh-5.5rem)] lg:flex-col'}>
            {specialTemplateWorkspace && template && (
              <specialTemplateWorkspace.SidebarColumn
                darkMode={darkMode}
                userImages={userImages}
                selectedUserImage={selectedUserImage}
                setPreviewImage={setPreviewImage}
                generating={generating}
                canGenerateCurrentMode={canGenerateCurrentMode}
                missingRequiredVariable={missingRequiredVariable}
                handleGenerate={handleGenerate}
                handleDownload={handleDownload}
                resultImageUrl={result?.imageUrl}
                revisedPrompt={result?.revisedPrompt}
                error={error}
                canManage={canManage}
                generationStatus={generationStatus}
                enableUserPrompt={enableUserPrompt}
                userPrompt={userPrompt}
                annotationTokenCount={annotationTokenCount}
              />
            )}
            {!specialTemplateWorkspace && (
              <>
                <div className={`overflow-hidden rounded-[22px] border shadow-sm transition-colors duration-500 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col ${
                  darkMode ? 'border-[#2f3a31] bg-[#1a201b]' : 'border-gray-200 bg-white'
                }`}>
                  <div className={`border-b px-4 py-3.5 ${darkMode ? 'border-[#2f3a31] bg-[#1a201b]' : 'border-gray-200 bg-gray-50/70'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <h2 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {referenceBatchMode ? '批量结果预览' : '生成结果预览'}
                      </h2>
                      <div className="flex items-center gap-2">
                        {referenceBatchMode ? (
                          <ActionIconButton
                            label="打包下载"
                            icon={Archive}
                            onClick={handleBatchDownload}
                            disabled={successfulBatchResults.length === 0}
                            darkMode={darkMode}
                          />
                        ) : (
                          <ActionIconButton
                            label="下载"
                            icon={Download}
                            onClick={handleDownload}
                            disabled={!result?.imageUrl}
                            darkMode={darkMode}
                          />
                        )}
                        <ActionIconButton
                          label={referenceBatchMode ? '重新批量生成' : '重新生成'}
                          icon={RotateCcw}
                          onClick={handleGenerate}
                          disabled={isAnyGenerating || !canGenerateCurrentMode}
                          darkMode={darkMode}
                        />
                        {!referenceBatchMode && (
                          <ActionIconButton
                            label="全屏预览"
                            icon={Eye}
                            onClick={() => result?.imageUrl && setPreviewImage(result.imageUrl)}
                            disabled={!result?.imageUrl}
                            darkMode={darkMode}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
                    {referenceBatchMode ? (
                      <div className="space-y-4">
                        <div className={`rounded-2xl border px-4 py-3 text-sm ${darkMode ? 'border-[#2f3a31] bg-[#141915]/72 text-stone-300' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                          {batchGenerating
                            ? `正在按参考图轮换生成 (${batchProgress.current}/${batchProgress.total})`
                            : `共 ${userImages.length} 张参考图，已成功生成 ${successfulBatchResults.length} 张`}
                        </div>
                        {batchResults.length > 0 ? (
                          <div className="grid gap-4 xl:grid-cols-2">
                            {batchResults.map((item, index) => (
                              <div
                                key={item.id}
                                className={`overflow-hidden rounded-2xl border ${darkMode ? 'border-[#2f3a31] bg-[#141915]/72' : 'border-gray-200 bg-gray-50/80'}`}
                              >
                                <div className={`flex items-center justify-between border-b px-4 py-3 ${darkMode ? 'border-[#2f3a31] bg-[#1a201b]/90' : 'border-gray-200 bg-white/80'}`}>
                                  <div className="min-w-0">
                                    <p className={`truncate text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>批量结果 {index + 1}</p>
                                    <p className={`truncate text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{item.sourceImage.name}</p>
                                  </div>
                                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                    item.status === 'success'
                                      ? 'bg-emerald-500 text-white'
                                      : item.status === 'error'
                                        ? 'bg-red-500 text-white'
                                        : item.status === 'generating'
                                          ? 'bg-violet-500 text-white'
                                          : darkMode
                                            ? 'bg-[#222923] text-stone-300'
                                            : 'bg-gray-200 text-gray-700'
                                  }`}>
                                    {item.status === 'success'
                                      ? '已完成'
                                      : item.status === 'error'
                                        ? '失败'
                                        : item.generationStatus || '等待中'}
                                  </span>
                                </div>
                                <div className="grid gap-3 p-4">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className={`overflow-hidden rounded-xl border ${darkMode ? 'border-[#2f3a31] bg-[#1a201b]' : 'border-gray-200 bg-white'}`}>
                                      <div className="px-3 py-2 text-[11px] font-semibold tracking-[0.18em] text-gray-500">参考图</div>
                                      <img src={item.sourceImage.url} alt={item.sourceImage.name} className="h-32 w-full object-contain" />
                                    </div>
                                    <div className={`overflow-hidden rounded-xl border ${darkMode ? 'border-[#2f3a31] bg-[#1a201b]' : 'border-gray-200 bg-white'}`}>
                                      <div className="px-3 py-2 text-[11px] font-semibold tracking-[0.18em] text-gray-500">生成结果</div>
                                      {item.result?.imageUrl ? (
                                        <button type="button" onClick={() => setPreviewImage(item.result.imageUrl)} className="block w-full">
                                          <img src={item.result.imageUrl} alt={`批量结果 ${index + 1}`} className="h-32 w-full object-contain" />
                                        </button>
                                      ) : (
                                        <div className="flex h-32 items-center justify-center">
                                          {item.status === 'generating' ? (
                                            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                                          ) : (
                                            <ImageIcon className={`h-6 w-6 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {item.error && (
                                    <div className={`rounded-xl border px-3 py-2 text-xs ${darkMode ? 'border-red-900/60 bg-red-950/30 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
                                      {item.error}
                                    </div>
                                  )}
                                  {item.result?.imageUrl && (
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setPreviewImage(item.result.imageUrl)}
                                        className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium ${darkMode ? 'bg-[#222923] text-white hover:bg-[#2a332b]' : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-200'}`}
                                      >
                                        预览
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadByUrl(item.result.imageUrl, `${template?.name || 'generated'}_${item.sourceImage.name}`)}
                                        className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium ${darkMode ? 'bg-violet-600 text-white hover:bg-violet-500' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'}`}
                                      >
                                        下载
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className={`flex min-h-[360px] items-center justify-center rounded-[20px] border px-8 text-center ${darkMode ? 'border-[#2f3a31] bg-[#141915] text-stone-400' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                            <div>
                              <Archive className="mx-auto h-10 w-10" />
                              <p className="mt-4 text-base font-semibold">等待批量结果</p>
                              <p className="mt-2 text-sm">切到批量模式后，会按上传顺序轮换参考图生成，并在这里汇总展示。</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className={`relative flex items-center justify-center overflow-hidden rounded-[20px] border transition-[min-height] duration-300 lg:flex-1 ${
                          result?.imageUrl || generating ? 'min-h-[360px]' : 'min-h-[320px]'
                        } ${
                          darkMode ? 'border-[#2f3a31] bg-[#141915]' : 'border-gray-200 bg-gray-50'
                        }`}>
                          <AnimatePresence>
                            {error && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className={`absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur-sm transition-colors duration-500 ${
                                  darkMode
                                    ? 'border-red-800 bg-red-950/85 text-red-300'
                                    : 'border-red-200 bg-red-50/95 text-red-700'
                                }`}
                              >
                                <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="mb-1 font-medium">生成失败</p>
                                  <p className="text-sm">{error}</p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          {result?.imageUrl ? (
                            <div className="w-full">
                              <AnimatePresence>
                                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="w-full">
                                  <div className="relative cursor-pointer" onClick={() => setPreviewImage(result.imageUrl)}>
                                    <img
                                      src={result.imageUrl}
                                      alt="生成结果"
                                      className="max-h-[500px] w-full object-contain"
                                    />
                                    <div className="absolute inset-0 bg-black/0 transition-all hover:bg-black/20" />
                                  </div>
                                </motion.div>
                              </AnimatePresence>
                            </div>
                          ) : (
                            <div className="flex max-w-xl flex-col items-center justify-center px-6 py-6 text-center">
                              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${darkMode ? 'bg-[#222923] text-stone-400' : 'bg-gray-100 text-gray-500'}`}>
                                {generating ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImageIcon className="h-6 w-6" />}
                              </div>
                              <h3 className={`mt-3 text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                {generating ? '正在创作' : '等待生成'}
                              </h3>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {!referenceBatchMode && canManage && result?.revisedPrompt && (
                      <div className={`mt-4 rounded-2xl border p-4 ${darkMode ? 'border-[#2f3a31] bg-[#141915]/72' : 'border-gray-200 bg-gray-50/80'}`}>
                        <p className={`mb-2 flex items-center gap-2 text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                          <Shield className="h-4 w-4" />
                          管理员可见 - 实际使用的提示词
                        </p>
                        <pre className={`max-h-48 overflow-y-auto whitespace-pre-wrap text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          {result.revisedPrompt}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`relative overflow-hidden rounded-[22px] border shadow-sm transition-colors duration-500 lg:flex lg:min-h-0 ${historyPanelOpen ? 'lg:flex-1' : 'lg:flex-none'} lg:flex-col ${
                  darkMode ? 'border-[#2f3a31] bg-[#1a201b]' : 'border-gray-200 bg-white'
                }`}>
                  <div className={`border-b px-4 py-3.5 ${darkMode ? 'border-[#2f3a31] bg-[#1a201b]' : 'border-gray-200 bg-gray-50/70'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>该模板最近记录</h2>
                      <div className="flex items-center gap-2">
                        <ActionIconButton
                          label={historyPanelOpen ? '关闭最近记录' : '查看最近记录'}
                          icon={Eye}
                          onClick={() => setHistoryPanelOpen((prev) => !prev)}
                          disabled={loadingTemplateHistories || templateHistories.length === 0}
                          darkMode={darkMode}
                          className="h-8 w-8 rounded-full"
                        />
                        <ActionIconButton
                          label={`删除失败任务${failedTemplateHistories.length > 0 ? `（${failedTemplateHistories.length}）` : ''}`}
                          icon={Trash2}
                          onClick={handleOpenDeleteFailedHistoriesModal}
                          disabled={loadingTemplateHistories || deletingFailedHistories || failedTemplateHistories.length === 0}
                          darkMode={darkMode}
                          className={`h-8 w-8 rounded-full ${
                            darkMode
                              ? 'border-red-900/60 bg-red-950/20 text-red-300 hover:bg-red-950/35 hover:text-red-200'
                              : 'border-red-200 bg-white text-red-500 hover:bg-red-50 hover:text-red-600'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 lg:flex lg:min-h-0 ${historyPanelOpen ? 'lg:flex-1' : 'lg:flex-none'} lg:flex-col`}>
                    {loadingTemplateHistories ? (
                      <div className="flex min-h-[220px] items-center justify-center">
                        <Loader2 className={`h-8 w-8 animate-spin ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                      </div>
                    ) : templateHistories.length > 0 ? (
                      <>
                        <div
                          className="haipablo-scrollbar flex gap-3 overflow-x-auto pb-1"
                          onWheel={(e) => {
                            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                              e.preventDefault();
                              e.currentTarget.scrollLeft += e.deltaY;
                            }
                          }}
                        >
                          {templateHistories.map((item) => (
                            <div
                              role="button"
                              tabIndex={item.outputImageUrl ? 0 : -1}
                              key={item.id}
                              onClick={() => item.outputImageUrl && setPreviewImage(item.outputImageUrl)}
                              onKeyDown={(event) => {
                                if (!item.outputImageUrl) return;
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  setPreviewImage(item.outputImageUrl);
                                }
                              }}
                              aria-disabled={!item.outputImageUrl}
                              className={`group relative w-[calc((100%-1.5rem)/3)] min-w-[calc((100%-1.5rem)/3)] flex-none overflow-hidden rounded-2xl border transition-colors ${
                                item.outputImageUrl ? 'cursor-pointer' : 'cursor-default'
                              } ${darkMode ? 'border-[#2f3a31] bg-[#141915]/72 hover:border-[#425143]' : 'border-gray-200 bg-gray-50/80 hover:border-gray-300'}`}
                            >
                              <div className={`group relative aspect-[16/11] overflow-hidden ${darkMode ? 'bg-[#141915]' : 'bg-white'}`}>
                                {item.outputImageUrl ? (
                                  <img
                                    src={item.thumbnailUrl || item.outputImageUrl}
                                    alt={item.templateName}
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center">
                                    <ImageIcon className={`h-5 w-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                                  </div>
                                )}
                                <div className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.status === 'success' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-white'}`}>
                                  {item.status === 'success' ? '已生成' : item.status}
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                  <ActionIconButton
                                    label="套用本次参数"
                                    icon={RotateCcw}
                                    onClick={() => handleReuseHistory(item)}
                                    darkMode={darkMode}
                                    className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                                  />
                                  <ActionIconButton
                                    label="预览"
                                    icon={Eye}
                                    onClick={() => item.outputImageUrl && setPreviewImage(item.outputImageUrl)}
                                    disabled={!item.outputImageUrl}
                                    darkMode={darkMode}
                                    className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                                  />
                                  <ActionIconButton
                                    label="下载"
                                    icon={Download}
                                    onClick={() => item.outputImageUrl && handleDownloadByUrl(item.outputImageUrl, item.templateName)}
                                    disabled={!item.outputImageUrl}
                                    darkMode={darkMode}
                                    className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <AnimatePresence>
                          {historyPanelOpen && (
                            <motion.div
                              initial={{ y: 48, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ y: 48, opacity: 0 }}
                              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                              className={`fixed inset-4 top-[5.25rem] z-[90] overflow-hidden rounded-[28px] border shadow-2xl lg:flex lg:min-h-0 lg:flex-col ${
                                darkMode ? 'border-[#334034] bg-[#141915]' : 'border-gray-200 bg-white'
                              }`}
                            >
                              <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${darkMode ? 'border-[#2f3a31] bg-[#141915]' : 'border-gray-200 bg-gray-50'}`}>
                                <div>
                                  <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>完整记录</p>
                                  <p className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>鼠标移入后可在此区域内上下滑动</p>
                                </div>
                                <ActionIconButton
                                  label="关闭完整记录"
                                  icon={X}
                                  onClick={() => setHistoryPanelOpen(false)}
                                  darkMode={darkMode}
                                  className="h-8 w-8 rounded-full"
                                />
                              </div>

                              <div className="haipablo-scrollbar p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                                <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-4 content-start md:grid-cols-2 lg:grid-cols-3">
                                  {templateHistories.map((item) => (
                                    <div
                                      key={item.id}
                                      className={`overflow-hidden rounded-2xl border transition-colors ${darkMode ? 'border-[#2f3a31] bg-[#141915]' : 'border-gray-200 bg-white'}`}
                                    >
                                      <div
                                        className={`group relative aspect-[16/10] cursor-pointer overflow-hidden ${darkMode ? 'bg-[#141915]' : 'bg-white'}`}
                                        onClick={() => item.outputImageUrl && setPreviewImage(item.outputImageUrl)}
                                      >
                                        {item.outputImageUrl ? (
                                          <img
                                            src={item.thumbnailUrl || item.outputImageUrl}
                                            alt={item.templateName}
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <div className="flex h-full items-center justify-center">
                                            <div className="text-center">
                                              <ImageIcon className={`mx-auto h-8 w-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                                              <p className={`mt-2 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>暂无出图</p>
                                            </div>
                                          </div>
                                        )}
                                        <div className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.status === 'success' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-white'}`}>
                                          {item.status === 'success' ? '已生成' : item.status}
                                        </div>
                                        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                          <ActionIconButton
                                            label="套用本次参数"
                                            icon={RotateCcw}
                                            onClick={() => handleReuseHistory(item)}
                                            darkMode={darkMode}
                                            className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                                          />
                                          <ActionIconButton
                                            label="预览"
                                            icon={Eye}
                                            onClick={() => item.outputImageUrl && setPreviewImage(item.outputImageUrl)}
                                            disabled={!item.outputImageUrl}
                                            darkMode={darkMode}
                                            className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                                          />
                                          <ActionIconButton
                                            label="下载"
                                            icon={Download}
                                            onClick={() => item.outputImageUrl && handleDownloadByUrl(item.outputImageUrl, item.templateName)}
                                            disabled={!item.outputImageUrl}
                                            darkMode={darkMode}
                                            className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                                          />
                                        </div>
                                      </div>

                                      <div className="space-y-3 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className={`truncate text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{item.templateName}</p>
                                            <p className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                              {new Date(item.createdAt).toLocaleString('zh-CN', {
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}
                                            </p>
                                          </div>
                                          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600 border border-gray-200'}`}>
                                            消耗 {item.creditsUsed ?? (item.status === 'success' ? 1 : 0)}
                                          </span>
                                        </div>

                                        <div className="flex items-center justify-end gap-2">
                                          <ActionIconButton
                                            label="套用本次参数"
                                            icon={RotateCcw}
                                            onClick={() => handleReuseHistory(item)}
                                            darkMode={darkMode}
                                          />
                                          <ActionIconButton
                                            label="预览"
                                            icon={Eye}
                                            onClick={() => item.outputImageUrl && setPreviewImage(item.outputImageUrl)}
                                            disabled={!item.outputImageUrl}
                                            darkMode={darkMode}
                                          />
                                          <ActionIconButton
                                            label="下载"
                                            icon={Download}
                                            onClick={() => item.outputImageUrl && handleDownloadByUrl(item.outputImageUrl, item.templateName)}
                                            disabled={!item.outputImageUrl}
                                            darkMode={darkMode}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    ) : (
                      <div className="flex min-h-[140px] items-center justify-center rounded-[24px] border border-dashed border-gray-300 px-8 text-center dark:border-gray-700 lg:flex-1">
                        <div>
                          <History className={`mx-auto h-8 w-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                          <p className={`mt-3 text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>暂无记录</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

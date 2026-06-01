'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminThemeModal } from '@/components/AdminThemeModal';
import { UserMenuDropdown } from '@/components/UserMenuDropdown';
import type { ImageProviderSummary } from '@/lib/image-provider-types';
import {
  ArrowLeft,
  Upload,
  Sparkles,
  Loader2,
  CheckCircle,
  XCircle,
  Download,
  Image as ImageIcon,
  Info,
  Eye,
  X,
  Layers,
  Archive,
  RefreshCw,
  Palette,
  SlidersHorizontal,
  Moon,
  Sun,
  Shield,
  History,
  LogOut
} from 'lucide-react';
import { SIZE_OPTIONS, QUALITY_OPTIONS } from '@/lib/types';
import {
  applyAdminColorTheme,
  getStoredAdminColorTheme,
  persistAdminColorTheme,
  type AdminColorTheme
} from '@/lib/admin-color-theme';

interface ReferenceImage {
  id: string;
  url: string;
  name: string;
}

interface TemplateVariable {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'color' | 'select' | 'image';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
}

interface SpecifiedColor {
  name: string;
  color: string;
  order: number;
  label?: string;
  text?: string;
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
  variables: TemplateVariable[];
  allowUserPrompt?: boolean;
  userPromptPriorityDefault?: boolean;
  enableSpecifiedColors?: boolean;
  specifiedColors?: Array<{ name: string; color: string; order: number; label?: string }>;
}

interface TemplateCardState {
  template: Template;
  formData: Record<string, string>;
  selectedPresetImage: ReferenceImage | null;
  enableUserPrompt: boolean;
  userPromptPriority: boolean;
  userPrompt: string;
  specifiedColors: SpecifiedColor[];
  result: any;
  generating: boolean;
  error: string;
  generationStatus: string;
}

interface ImageProviderResponse {
  providers: ImageProviderSummary[];
  defaultProviderId: string | null;
  requestId?: string;
}

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

async function readResponseBodySafely(response: Response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function extractSpecifiedColorNames(text: string) {
  const matches = [...text.matchAll(/指定色(\d+)/g)];
  return Array.from(new Set(matches.map((match) => match[0])));
}

function buildSpecifiedColors(
  template: Template,
  userPrompt = '',
  existingColors: SpecifiedColor[] = []
): SpecifiedColor[] {
  if (!template.enableSpecifiedColors) return [];

  const templateColorNames = (template.specifiedColors || []).map((color) => color.name);
  const detectedColorNames = extractSpecifiedColorNames(`${template.promptTemplate || ''}\n${userPrompt}`);
  const allColorNames = Array.from(new Set([...templateColorNames, ...detectedColorNames]));

  return allColorNames
    .map((name) => {
      const templateColor = template.specifiedColors?.find((color) => color.name === name);
      const existingColor = existingColors.find((color) => color.name === name);
      const safeColor =
        existingColor?.color && HEX_COLOR_REGEX.test(existingColor.color)
          ? existingColor.color
          : templateColor?.color && HEX_COLOR_REGEX.test(templateColor.color)
            ? templateColor.color
            : '#888888';

      return {
        name,
        color: safeColor,
        text: existingColor?.text || safeColor,
        order: parseInt(name.replace('指定色', ''), 10) || templateColor?.order || 0,
        label: existingColor?.label ?? templateColor?.label ?? ''
      };
    })
    .sort((a, b) => a.order - b.order);
}

function toSerializableSpecifiedColors(colors: SpecifiedColor[]) {
  return colors.map(({ name, color, order, label }) => ({ name, color, order, label }));
}

export default function BatchGeneratePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateIdsParam = searchParams.get('templateIds');
  const templateIds = templateIdsParam ? JSON.parse(decodeURIComponent(templateIdsParam)) : [];

  const [user, setUser] = useState<any>(null);
  const [imageProviders, setImageProviders] = useState<ImageProviderSummary[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAdminThemeModal, setShowAdminThemeModal] = useState(false);
  const [adminColorTheme, setAdminColorTheme] = useState<AdminColorTheme>('forest-amber');
  const [loading, setLoading] = useState(true);
  const [kvImage, setKvImage] = useState<{ id: string; url: string; name: string } | null>(null);
  const [uploadingKv, setUploadingKv] = useState(false);
  const [cards, setCards] = useState<TemplateCardState[]>([]);
  const [size, setSize] = useState('auto');
  const [quality, setQuality] = useState('medium');
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false);
  const hasFetched = useRef(false);
  const canManage = user?.role === 'admin' || user?.role === 'sub_admin';
  const isAdmin = user?.role === 'admin';
  const isSubAdmin = user?.role === 'sub_admin';

  const fetchImageProviders = useCallback(async () => {
    const requestStartedAt = Date.now();

    try {
      console.info('[batch][providers] 开始获取供应商列表');
      const res = await fetch('/api/image/providers', { cache: 'no-store' });
      const payload = await readResponseBodySafely(res);

      if (!res.ok) {
        console.error('[batch][providers] 请求失败', {
          status: res.status,
          statusText: res.statusText,
          durationMs: Date.now() - requestStartedAt,
          requestId: res.headers.get('X-Request-Id'),
          payload,
        });
        return;
      }

      const data = (payload || {}) as ImageProviderResponse;
      setImageProviders(Array.isArray(data.providers) ? data.providers : []);
      setSelectedProviderId((prev) => {
        if (prev && data.providers?.some((provider) => provider.id === prev)) {
          return prev;
        }
        return data.defaultProviderId || data.providers?.[0]?.id || '';
      });

      console.info('[batch][providers] 获取成功', {
        durationMs: Date.now() - requestStartedAt,
        count: Array.isArray(data.providers) ? data.providers.length : 0,
        defaultProviderId: data.defaultProviderId || null,
        requestId: data.requestId || res.headers.get('X-Request-Id'),
      });
    } catch (error) {
      console.error('[batch][providers] 网络异常', {
        durationMs: Date.now() - requestStartedAt,
        message: getErrorMessage(error),
        error,
      });
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

    if (templateIds.length > 0 && !hasFetched.current) {
      hasFetched.current = true;
      fetchTemplates();
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [fetchImageProviders]);

  useEffect(() => {
    if (!hasFetched.current && templateIds.length > 0) {
      hasFetched.current = true;
      fetchTemplates();
    }
  }, [templateIds]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const promises = templateIds.map((id: string) => fetch(`/api/templates/${id}`).then((res) => res.json()));
      const results = await Promise.all(promises);
      const validResults = results.filter((result) => result && result.id);

      const initialCards: TemplateCardState[] = validResults.map((template: Template) => ({
        template,
        formData:
          template.variables?.reduce((acc: Record<string, string>, variable) => {
            acc[variable.key] = '';
            return acc;
          }, {}) || {},
        selectedPresetImage: template.referenceImages?.[0] || null,
        enableUserPrompt: template.allowUserPrompt !== false,
        userPromptPriority: template.userPromptPriorityDefault || false,
        userPrompt: '',
        specifiedColors: buildSpecifiedColors(template, '', []),
        result: null,
        generating: false,
        error: '',
        generationStatus: ''
      }));

      setCards(initialCards);
    } catch (error) {
      console.error('获取模板失败:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('登出失败:', err);
    }
    router.push('/auth');
  };

  const refreshCredits = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        setUser(await res.json());
      }
    } catch (err) {
      console.error('刷新用户信息失败:', err);
    }
  };

  const handleKvImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingKv(true);
    const requestStartedAt = Date.now();

    try {
      console.info('[batch][upload] 开始上传主视觉', {
        name: file.name,
        type: file.type || 'unknown',
        size: file.size,
      });

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const payload = await readResponseBodySafely(response);

      if (!response.ok) {
        const errorMessage =
          typeof payload === 'object' && payload
            ? ((payload as { error?: string; message?: string }).message ||
              (payload as { error?: string; message?: string }).error)
            : null;

        console.error('[batch][upload] 服务端返回失败', {
          status: response.status,
          statusText: response.statusText,
          durationMs: Date.now() - requestStartedAt,
          requestId:
            (typeof payload === 'object' && payload && 'requestId' in payload
              ? String((payload as { requestId?: string }).requestId || '')
              : '') || response.headers.get('X-Request-Id'),
          payload,
          file: {
            name: file.name,
            type: file.type || 'unknown',
            size: file.size,
          },
        });

        throw new Error(errorMessage || `上传失败（HTTP ${response.status}）`);
      }

      const data =
        typeof payload === 'object' && payload
          ? (payload as { url: string; requestId?: string })
          : null;

      if (!data?.url) {
        console.error('[batch][upload] 返回结果缺少 url', {
          durationMs: Date.now() - requestStartedAt,
          requestId: response.headers.get('X-Request-Id'),
          payload,
        });
        throw new Error('上传成功，但服务端未返回图片地址');
      }

      setKvImage({
        id: `kv_${Date.now()}`,
        url: data.url,
        name: file.name
      });

      console.info('[batch][upload] 上传成功', {
        durationMs: Date.now() - requestStartedAt,
        requestId: data.requestId || response.headers.get('X-Request-Id'),
        url: data.url,
        file: {
          name: file.name,
          type: file.type || 'unknown',
          size: file.size,
        },
      });
    } catch (error) {
      console.error('[batch][upload] 上传异常', {
        durationMs: Date.now() - requestStartedAt,
        message: getErrorMessage(error),
        error,
        file: {
          name: file.name,
          type: file.type || 'unknown',
          size: file.size,
        },
      });
      alert(`图片上传失败：${getErrorMessage(error)}`);
    } finally {
      setUploadingKv(false);
    }
  };

  const handleRemoveKvImage = () => {
    setKvImage(null);
  };

  const handleCardFormChange = (cardIndex: number, key: string, value: string) => {
    setCards((prev) =>
      prev.map((card, index) =>
        index === cardIndex ? { ...card, formData: { ...card.formData, [key]: value } } : card
      )
    );
  };

  const handleUserPromptToggle = (cardIndex: number, checked: boolean) => {
    setCards((prev) =>
      prev.map((card, index) => (index === cardIndex ? { ...card, enableUserPrompt: checked } : card))
    );
  };

  const handleUserPromptPriorityToggle = (cardIndex: number) => {
    setCards((prev) =>
      prev.map((card, index) =>
        index === cardIndex ? { ...card, userPromptPriority: !card.userPromptPriority } : card
      )
    );
  };

  const handleUserPromptChange = (cardIndex: number, value: string) => {
    setCards((prev) =>
      prev.map((card, index) => {
        if (index !== cardIndex) return card;

        return {
          ...card,
          userPrompt: value,
          specifiedColors: buildSpecifiedColors(card.template, value, card.specifiedColors)
        };
      })
    );
  };

  const handleSpecifiedColorPickerChange = (cardIndex: number, colorName: string, value: string) => {
    setCards((prev) =>
      prev.map((card, index) => {
        if (index !== cardIndex) return card;

        return {
          ...card,
          specifiedColors: card.specifiedColors.map((color) =>
            color.name === colorName ? { ...color, color: value, text: value } : color
          )
        };
      })
    );
  };

  const handleSpecifiedColorTextChange = (cardIndex: number, colorName: string, value: string) => {
    setCards((prev) =>
      prev.map((card, index) => {
        if (index !== cardIndex) return card;

        return {
          ...card,
          specifiedColors: card.specifiedColors.map((color) => {
            if (color.name !== colorName) return color;
            return {
              ...color,
              text: value,
              color: HEX_COLOR_REGEX.test(value) ? value : color.color
            };
          })
        };
      })
    );
  };

  const handleSpecifiedColorTextBlur = (cardIndex: number, colorName: string) => {
    setCards((prev) =>
      prev.map((card, index) => {
        if (index !== cardIndex) return card;

        return {
          ...card,
          specifiedColors: card.specifiedColors.map((color) => {
            if (color.name !== colorName) return color;
            return {
              ...color,
              text: HEX_COLOR_REGEX.test(color.text || '') ? color.text : color.color
            };
          })
        };
      })
    );
  };

  const handlePresetImageToggle = (cardIndex: number, image: ReferenceImage) => {
    setCards((prev) =>
      prev.map((card, index) => {
        if (index !== cardIndex) return card;

        return {
          ...card,
          selectedPresetImage: image
        };
      })
    );
  };

  const getActiveReferenceImages = (card: TemplateCardState) => {
    if (!card.selectedPresetImage) {
      return card.template.referenceImages || [];
    }

    const matchedImage = card.template.referenceImages?.find((image) => image.id === card.selectedPresetImage?.id);
    return matchedImage ? [matchedImage] : card.template.referenceImages || [];
  };

  const getRenderedPrompt = (card: TemplateCardState) => {
    if (!card.template.promptTemplate) return '';

    let prompt = card.template.promptTemplate;

    for (const [key, value] of Object.entries(card.formData)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      prompt = prompt.replace(regex, value || '');
    }

    if (card.enableUserPrompt && card.userPrompt.trim()) {
      prompt = card.userPromptPriority
        ? `${card.userPrompt.trim()}\n\n${prompt}`
        : `${prompt}\n\n${card.userPrompt.trim()}`;
    }

    card.specifiedColors.forEach((color) => {
      const regex = new RegExp(color.name, 'g');
      prompt = prompt.replace(regex, color.color);
    });

    return prompt;
  };

  const generateCard = async (card: TemplateCardState) => {
    const renderedPrompt = getRenderedPrompt(card);

    const requestData = {
      userId: user?.id,
      templateId: card.template.id,
      templateName: card.template.name,
      mode: card.template.mode || 'generation',
      promptTemplate: renderedPrompt,
      negativePrompt: card.template.negativePrompt,
      variables: card.formData,
      size,
      quality,
      providerId: selectedProviderId || undefined,
      referenceImages: getActiveReferenceImages(card).map((img) => img.url),
      images: kvImage ? [kvImage.url] : [],
      userPrompt: card.enableUserPrompt ? card.userPrompt : null,
      userPromptPriority: card.userPromptPriority,
      config: {
        formData: card.formData,
        selectedPresetImage: card.selectedPresetImage,
        userPrompt: card.userPrompt,
        enableUserPrompt: card.enableUserPrompt,
        userPromptPriority: card.userPromptPriority,
        size,
        quality,
        specifiedColors: toSerializableSpecifiedColors(card.specifiedColors)
      }
    };

    console.log('=== 批量发送生成请求 ===');
    console.log('请求数据:', JSON.stringify(requestData, null, 2));

    const response = await fetch('/api/image/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });

    return {
      response,
      data: await response.json()
    };
  };

  const handleGenerateSingle = async (cardIndex: number) => {
    const card = cards[cardIndex];
    if (!card) return;

    if (!kvImage) {
      setCards((prev) =>
        prev.map((item, index) => (index === cardIndex ? { ...item, error: '请先上传主视觉图片' } : item))
      );
      return;
    }

    const renderedPrompt = getRenderedPrompt(card);
    if (!renderedPrompt.trim()) {
      setCards((prev) =>
        prev.map((item, index) =>
          index === cardIndex ? { ...item, error: '模板缺少提示词，请联系管理员检查模板配置' } : item
        )
      );
      return;
    }

    setCards((prev) =>
      prev.map((item, index) =>
        index === cardIndex
          ? {
              ...item,
              generating: true,
              error: '',
              result: null,
              generationStatus: '正在生成中...'
            }
          : item
      )
    );

    try {
      const { response, data } = await generateCard(card);

      if (response.ok && data.success) {
        setCards((prev) =>
          prev.map((item, index) =>
            index === cardIndex ? { ...item, generating: false, generationStatus: '', result: data } : item
          )
        );
        refreshCredits();
      } else {
        setCards((prev) =>
          prev.map((item, index) =>
            index === cardIndex
              ? {
                  ...item,
                  generating: false,
                  generationStatus: '',
                  error: data.message || data.error || '生成失败'
                }
              : item
          )
        );
      }
    } catch (error: any) {
      console.error('生成失败:', error);
      setCards((prev) =>
        prev.map((item, index) =>
          index === cardIndex
            ? {
                ...item,
                generating: false,
                generationStatus: '',
                error: `网络错误：${error.message || '请检查网络连接'}`
              }
            : item
        )
      );
    }
  };

  const handleGenerateAll = async () => {
    if (!kvImage) {
      alert('请先上传主视觉图片');
      return;
    }

    if (user && user.credits < cards.length) {
      setShowInsufficientCredits(true);
      return;
    }

    setBatchGenerating(true);
    setBatchProgress({ current: 0, total: cards.length });

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const generateWithDelay = async (card: TemplateCardState, index: number) => {
      setCards((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                generating: true,
                error: '',
                result: null,
                generationStatus: '排队处理中...'
              }
            : item
        )
      );

      setBatchProgress((prev) => ({ ...prev, current: index + 1 }));

      if (index > 0) {
        const randomDelay = Math.floor(Math.random() * 5000) + 5000;
        await delay(randomDelay);
      }

      try {
        const { response, data } = await generateCard(card);

        if (response.ok && data.success) {
          setCards((prev) =>
            prev.map((item, itemIndex) =>
              itemIndex === index ? { ...item, generating: false, generationStatus: '', result: data } : item
            )
          );
        } else {
          setCards((prev) =>
            prev.map((item, itemIndex) =>
              itemIndex === index
                ? {
                    ...item,
                    generating: false,
                    generationStatus: '',
                    error: data.message || data.error || '生成失败'
                  }
                : item
            )
          );
        }
      } catch (error: any) {
        console.error('批量生成失败:', error);
        setCards((prev) =>
          prev.map((item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  generating: false,
                  generationStatus: '',
                  error: `网络错误：${error.message || '请检查网络连接'}`
                }
              : item
          )
        );
      }
    };

    await Promise.all(cards.map((card, index) => generateWithDelay(card, index)));
    setBatchGenerating(false);
    refreshCredits();
  };

  const handleRegenerateSingle = async (cardIndex: number) => {
    setCards((prev) =>
      prev.map((item, index) => (index === cardIndex ? { ...item, result: null, error: '' } : item))
    );
    await handleGenerateSingle(cardIndex);
  };

  const handleDownloadSingle = (card: TemplateCardState) => {
    if (!card.result?.imageUrl) return;

    const link = document.createElement('a');
    link.href = card.result.imageUrl;
    link.download = `${card.template.name}_${Date.now()}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBatchDownload = async () => {
    const generatedCards = cards.filter((card) => card.result?.imageUrl);

    if (generatedCards.length === 0) {
      alert('没有可下载的图片');
      return;
    }

    if (generatedCards.length === 1) {
      handleDownloadSingle(generatedCards[0]);
      return;
    }

    try {
      const response = await fetch('/api/image/batch-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: generatedCards.map((card) => ({
            url: card.result.imageUrl,
            name: card.template.name
          }))
        })
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.message || '下载失败，请重试');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `批量生成_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('批量下载失败:', error);
      alert('批量下载失败，请重试');
    }
  };

  const handlePreviewClose = () => {
    setPreviewImage(null);
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!previewImage) return;

    const scaleStep = 0.1;
    const nextScale = e.deltaY < 0 ? zoomScale + scaleStep : zoomScale - scaleStep;
    setZoomScale(Math.max(0.1, Math.min(10, nextScale)));
  };

  const handleMouseDown = () => {
    if (zoomScale > 1) {
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    setZoomPosition((prev) => ({
      x: prev.x + e.movementX,
      y: prev.y + e.movementY
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const generatedCount = cards.filter((card) => card.result).length;
  const panelTitleClass = darkMode ? 'text-[var(--foreground)]' : 'text-slate-900';
  const panelBodyClass = darkMode ? 'text-[var(--muted-foreground)]' : 'text-slate-500';
  const panelLabelClass = darkMode ? 'text-[#ddd6c8]' : 'text-slate-700';
  const panelCaptionClass = darkMode ? 'text-[#8d968a]' : 'text-slate-400';
  const insetPanelClass = darkMode
    ? 'border-white/10 bg-[linear-gradient(180deg,rgba(27,33,28,0.82),rgba(18,23,19,0.72))]'
    : 'border-slate-100 bg-slate-50/80';
  const elevatedPanelClass = darkMode
    ? 'border-white/10 bg-[linear-gradient(180deg,rgba(28,35,29,0.94),rgba(20,26,21,0.86))] shadow-[inset_0_1px_0_rgba(255,244,214,0.04)]'
    : 'border-slate-100 bg-white/80 shadow-sm';
  const accentPanelClass = darkMode
    ? 'border-violet-500/20 bg-violet-500/10'
    : 'border-violet-100 bg-violet-50/70';
  const successPanelClass = darkMode
    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
    : 'border-emerald-100 bg-emerald-50 text-emerald-700';
  const inputSurfaceClass = darkMode
    ? 'border-white/10 bg-[#151b17] text-[var(--foreground)] placeholder:text-[#8d968a] disabled:bg-[#1b211d]'
    : 'border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 disabled:bg-slate-50';
  const featureIconBadgeClass = darkMode
    ? 'bg-[linear-gradient(135deg,rgba(124,58,237,0.34),rgba(168,85,247,0.18))] text-violet-100 ring-1 ring-violet-300/15 shadow-[0_18px_38px_-24px_rgba(76,29,149,0.58),inset_0_1px_0_rgba(255,255,255,0.08)]'
    : 'bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-200';

  const renderVariableField = (card: TemplateCardState, cardIndex: number, variable: TemplateVariable) => {
    const commonClassName =
      `w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all focus:border-violet-300 focus:ring-4 focus:ring-violet-100 ${inputSurfaceClass}`;

    if (variable.type === 'textarea') {
      return (
        <textarea
          value={card.formData[variable.key] || ''}
          onChange={(e) => handleCardFormChange(cardIndex, variable.key, e.target.value)}
          rows={3}
          className={`${commonClassName} resize-none`}
          placeholder={variable.placeholder || `请输入${variable.label}`}
        />
      );
    }

    if (variable.type === 'select') {
      return (
        <select
          value={card.formData[variable.key] || ''}
          onChange={(e) => handleCardFormChange(cardIndex, variable.key, e.target.value)}
          className={commonClassName}
        >
          <option value="">请选择{variable.label}</option>
          {variable.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (variable.type === 'color') {
      const currentColor = HEX_COLOR_REGEX.test(card.formData[variable.key] || '')
        ? card.formData[variable.key]
        : '#ffffff';

      return (
        <div className="flex items-center gap-3">
          <div
            className={`relative h-11 w-11 overflow-hidden rounded-2xl border shadow-inner ${
              darkMode ? 'border-white/10' : 'border-slate-200'
            }`}
            style={{ backgroundColor: currentColor }}
          >
            <input
              type="color"
              value={currentColor}
              onChange={(e) => handleCardFormChange(cardIndex, variable.key, e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
          <input
            type="text"
            value={card.formData[variable.key] || ''}
            onChange={(e) => handleCardFormChange(cardIndex, variable.key, e.target.value)}
            className={`${commonClassName} font-mono`}
            placeholder={variable.placeholder || '#FFFFFF'}
          />
        </div>
      );
    }

    if (variable.type === 'image') {
      return (
        <div className={`rounded-2xl border border-dashed px-4 py-3 text-sm ${darkMode ? 'border-gray-700 bg-gray-800/70 text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
          批量页暂不支持图片字段，请使用单独生成页处理该模板。
        </div>
      );
    }

    return (
      <input
        type={variable.type === 'number' ? 'number' : 'text'}
        value={card.formData[variable.key] || ''}
        onChange={(e) => handleCardFormChange(cardIndex, variable.key, e.target.value)}
        className={commonClassName}
        placeholder={variable.placeholder || `请输入${variable.label}`}
      />
    );
  };

  if (loading) {
    return (
      <div className={`haipablo-static-shell flex min-h-screen items-center justify-center transition-colors duration-500 ${darkMode ? 'bg-gray-950' : ''}`}>
        <div className="text-center">
          <Loader2 className={`mx-auto mb-4 h-12 w-12 animate-spin ${darkMode ? 'text-white' : 'text-violet-600'}`} />
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>加载模板中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`haipablo-static-shell min-h-screen transition-colors duration-500 ${darkMode ? 'bg-gray-950 text-white' : 'text-slate-900'}`}>
      <AdminThemeModal
        darkMode={darkMode}
        isOpen={showAdminThemeModal}
        currentTheme={adminColorTheme}
        onClose={() => setShowAdminThemeModal(false)}
        onThemeChange={handleAdminColorThemeChange}
        onOpenAdminUsers={() => router.push('/admin/users?tab=image_providers')}
      />
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/90 p-8 backdrop-blur-sm"
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
                className="max-h-[90vh] max-w-[90vw] select-none rounded-lg object-contain shadow-2xl"
                draggable={false}
              />
            </div>

            <div className="pointer-events-none absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs text-white backdrop-blur-md">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                滚轮缩放: {Math.round(zoomScale * 100)}%
              </div>
              <div className="h-3 w-px bg-white/20" />
              <div>左键按住可拖拽</div>
            </div>

            <button
              onClick={handlePreviewClose}
              className="absolute right-6 top-6 rounded-full border border-white/10 bg-white/10 p-3 text-white transition-all hover:bg-red-500/50"
            >
              <X className="h-6 w-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInsufficientCredits && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
            onClick={() => setShowInsufficientCredits(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="haipablo-modal-panel w-full max-w-sm rounded-[28px] border p-6 text-center shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)]"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <h2 className={`mb-2 text-xl font-bold ${panelTitleClass}`}>潮能力不足</h2>
              <p className={`mb-6 text-sm leading-6 ${panelBodyClass}`}>
                当前批量生成需要 <span className="font-bold text-violet-600">{cards.length}</span> 点潮能力，
                您当前仅剩 <span className="font-bold text-red-500">{user?.credits ?? 0}</span> 点。
              </p>
              <button
                onClick={() => setShowInsufficientCredits(false)}
                className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200"
              >
                我知道了
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className={`haipablo-topbar sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-500 ${darkMode ? 'bg-gray-950/70 border-white/10' : 'bg-white/60 border-white/50'}`}>
        <div className="mx-auto flex w-[min(96vw,1880px)] items-center relative px-6 py-4 2xl:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/templates')}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-700'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="hidden md:block">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-violet-500">Batch Studio</p>
              <h1 className={`text-xl font-bold transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>批量生成</h1>
              <p className={`text-xs transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{cards.length} 个模板待生成</p>
            </div>
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <img
              src={darkMode ? '/img/white.png' : '/img/black.png'}
              alt="HAIPablo Logo"
              className="h-14 object-contain cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => router.push('/')}
            />
          </div>

          <div className="flex-1 flex items-center justify-end gap-4">
            {cards.some((card) => card.result) && (
              <button
                onClick={handleBatchDownload}
                className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${darkMode ? 'bg-violet-900/20 border-violet-800/50 text-violet-300 hover:bg-violet-900/30' : 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100'}`}
              >
                <Archive className="w-4 h-4" />
                批量下载
              </button>
            )}
            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${darkMode ? 'bg-violet-900/20 border-violet-800/50 text-violet-300' : 'bg-violet-50 border-violet-200 text-violet-700'}`}>
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">潮能力: {user?.credits ?? 0}</span>
            </div>
            <div className={`hidden sm:flex px-2 py-1 text-xs font-medium rounded-full items-center gap-1 w-fit ${darkMode ? 'bg-violet-900/30 text-violet-200 border border-violet-800' : 'bg-violet-50 text-violet-700 border border-violet-200'}`}>
              已完成 {generatedCount}/{cards.length}
            </div>
            {user?.role === 'admin' && (
              <span className={`hidden sm:flex px-2 py-1 text-xs font-medium rounded-full items-center gap-1 w-fit ${darkMode ? 'bg-amber-900/50 text-amber-400 border border-amber-800' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                <Shield className="w-3 h-3" />
                管理员
              </span>
            )}
            {user?.role === 'sub_admin' && (
              <span className={`hidden sm:flex px-2 py-1 text-xs font-medium rounded-full items-center gap-1 w-fit ${darkMode ? 'bg-blue-900/50 text-blue-400 border border-blue-800' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                <Shield className="w-3 h-3" />
                子管理员
              </span>
            )}
            <button
              onClick={toggleDarkMode}
              className={`p-2.5 rounded-xl transition-all duration-300 group ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-amber-400 hover:text-amber-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900'}`}
            >
              {darkMode ? (
                <Sun className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              ) : (
                <Moon className="w-5 h-5 group-hover:-rotate-12 transition-transform" />
              )}
            </button>
            {user && (
              <UserMenuDropdown
                user={user}
                darkMode={darkMode}
                isOpen={showUserMenu}
                onToggle={() => setShowUserMenu((prev) => !prev)}
                onClose={() => setShowUserMenu(false)}
                onHistory={() => router.push('/history')}
                onThemeSettings={() => setShowAdminThemeModal(true)}
                onAdminUsers={() => router.push('/admin/users')}
                onLogout={handleLogout}
                canManage={canManage}
                isAdmin={isAdmin}
                isSubAdmin={isSubAdmin}
                manageLabel={isAdmin ? '用户与部门管理' : '人员列表'}
                avatarSize="lg"
                showTriggerName={true}
                showTriggerEmail={true}
                triggerClassName="flex items-center gap-3 hover:opacity-80 transition-opacity"
                triggerTextClassName="hidden lg:block"
              />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-[min(96vw,1880px)] px-6 py-8 2xl:px-8">
        <section className="mb-8 grid gap-6 xl:grid-cols-[1.45fr_1fr] 2xl:grid-cols-[1.55fr_1fr]">
          <div className="haipablo-glass-panel relative overflow-hidden rounded-[32px] border p-6 shadow-[0_24px_80px_-36px_rgba(109,40,217,0.35)]">
            <div className="absolute right-6 top-6 grid grid-cols-4 gap-1 opacity-40">
              {Array.from({ length: 12 }).map((_, index) => (
                <span key={index} className="h-1.5 w-1.5 rounded-full bg-violet-200" />
              ))}
            </div>

            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${featureIconBadgeClass}`}>
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-violet-400">Step 01</p>
                  <h2 className={`text-xl font-bold ${panelTitleClass}`}>上传主视觉</h2>
                </div>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-medium ${successPanelClass}`}>
                {kvImage ? '素材已就绪' : '等待上传'}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] 2xl:grid-cols-[0.82fr_1.18fr]">
              <div className="space-y-4">
                <p className={`text-sm leading-7 ${panelBodyClass}`}>
                  上传一张统一主视觉图，作为所有模板的共同参考素材。推荐使用完整成图或主体清晰的产品图。
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="haipablo-glass-subtle rounded-2xl border px-4 py-3">
                    <p className={`text-[11px] uppercase tracking-[0.2em] ${panelCaptionClass}`}>模板数</p>
                    <p className={`mt-1 text-lg font-semibold ${panelTitleClass}`}>{cards.length}</p>
                  </div>
                  <div className="haipablo-glass-subtle rounded-2xl border px-4 py-3">
                    <p className={`text-[11px] uppercase tracking-[0.2em] ${panelCaptionClass}`}>潮能力</p>
                    <p className={`mt-1 text-lg font-semibold ${panelTitleClass}`}>{user?.credits ?? 0}</p>
                  </div>
                </div>

                {kvImage && (
                  <div className={`rounded-2xl border px-4 py-3 text-sm ${successPanelClass}`}>
                    已上传素材：{kvImage.name}
                  </div>
                )}
              </div>

              <div className="relative">
                {kvImage ? (
                  <div className="haipablo-glass-subtle group relative overflow-hidden rounded-[28px] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <img
                      src={kvImage.url}
                      alt="主视觉"
                      className="h-72 w-full rounded-[22px] object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/35 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={handleRemoveKvImage}
                        className={`rounded-2xl px-4 py-2 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.02] ${
                          darkMode ? 'bg-[#151b17] text-[var(--foreground)]' : 'bg-white text-slate-900'
                        }`}
                      >
                        重新上传
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="haipablo-glass-subtle rounded-[28px] border border-dashed border-violet-200 p-6">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleKvImageUpload}
                      className="hidden"
                      id="kv-upload"
                      disabled={uploadingKv}
                    />
                    <label htmlFor="kv-upload" className="block cursor-pointer text-center">
                      <div
                        className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[24px] shadow-[0_16px_40px_-28px_rgba(109,40,217,0.55)] ${
                          darkMode ? 'bg-[#151b17] ring-1 ring-white/10' : 'bg-white'
                        }`}
                      >
                        {uploadingKv ? (
                          <Loader2 className="h-9 w-9 animate-spin text-violet-600" />
                        ) : (
                          <Upload className="h-9 w-9 text-violet-400" />
                        )}
                      </div>
                      <p className={`text-lg font-semibold ${panelTitleClass}`}>
                        {uploadingKv ? '正在上传素材...' : '点击上传主视觉图片'}
                      </p>
                      <p className={`mt-2 text-sm ${panelCaptionClass}`}>支持 PNG / JPG / WEBP，建议使用高清素材</p>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="haipablo-glass-panel rounded-[32px] border p-6 shadow-[0_24px_80px_-36px_rgba(109,40,217,0.25)]">
            <div className="mb-5 flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${featureIconBadgeClass}`}>
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-violet-400">Step 02</p>
                <h2 className={`text-xl font-bold ${panelTitleClass}`}>统一配置</h2>
              </div>
            </div>

            <div className="space-y-4">
              {imageProviders.length > 0 && (
                <div className="haipablo-glass-subtle rounded-[24px] border p-4">
                  <label className={`mb-2 block text-sm font-semibold ${panelLabelClass}`}>生成供应商</label>
                  <div className="relative">
                    <select
                      value={selectedProviderId}
                      onChange={(e) => setSelectedProviderId(e.target.value)}
                      onFocus={() => void fetchImageProviders()}
                      className="w-full appearance-none rounded-2xl border border-white/70 bg-white px-4 py-3 pr-11 text-sm font-medium text-slate-900 outline-none transition-all focus:border-violet-300 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-slate-950/60 dark:text-white"
                    >
                      {imageProviders.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                    <Sparkles className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                  <p className={`mt-2 text-xs leading-5 ${panelBodyClass}`}>
                    前端只负责切换供应商，具体地址、密钥和兼容逻辑由后端按供应商配置处理。
                  </p>
                </div>
              )}

              <div className="haipablo-glass-subtle rounded-[24px] border p-4">
                <label className={`mb-2 block text-sm font-semibold ${panelLabelClass}`}>输出尺寸</label>
                <div className="relative">
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-white/70 bg-white px-4 py-3 pr-11 text-sm font-medium text-slate-900 outline-none transition-all focus:border-violet-300 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-slate-950/60 dark:text-white"
                  >
                    {SIZE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Layers className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="haipablo-glass-subtle rounded-[24px] border p-4">
                <label className={`mb-2 block text-sm font-semibold ${panelLabelClass}`}>生成质量</label>
                <div className="relative">
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-white/70 bg-white px-4 py-3 pr-11 text-sm font-medium text-slate-900 outline-none transition-all focus:border-violet-300 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-slate-950/60 dark:text-white"
                  >
                    {QUALITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Sparkles className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className={`haipablo-glass-subtle rounded-[24px] border p-4 ${darkMode ? 'border-violet-500/20' : 'border-violet-100'}`}>
                <div className={`flex items-start gap-3 text-sm ${darkMode ? 'text-violet-100' : 'text-violet-800'}`}>
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>批量模式会将当前尺寸与质量配置应用到所有模板卡片，并保留各自的提示词与指定色设置。</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerateAll}
              disabled={!kvImage || batchGenerating || cards.length === 0}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-[22px] bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-4 text-base font-semibold text-white shadow-[0_22px_45px_-24px_rgba(124,58,237,0.75)] transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              {batchGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  正在批量创作 ({batchProgress.current}/{batchProgress.total})
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  立即批量生成
                </>
              )}
            </button>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2 2xl:gap-8">
          {cards.map((card, cardIndex) => (
            <motion.div
              key={card.template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: cardIndex * 0.06 }}
              className="haipablo-glass-panel overflow-hidden rounded-[32px] border shadow-[0_28px_90px_-38px_rgba(109,40,217,0.28)]"
            >
              <div
                className={`relative border-b px-6 py-5 ${
                  darkMode
                    ? 'border-white/10 bg-[linear-gradient(180deg,rgba(65,36,104,0.35),rgba(24,31,26,0.96))]'
                    : 'border-violet-100/70 bg-[linear-gradient(180deg,rgba(247,244,255,0.92),rgba(245,244,250,0.88))]'
                }`}
              >
                <div className="absolute right-6 top-5 grid grid-cols-4 gap-1 opacity-50">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <span key={index} className={`h-1 w-1 rounded-full ${darkMode ? 'bg-violet-300/70' : 'bg-violet-200'}`} />
                  ))}
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${featureIconBadgeClass}`}>
                      <Layers className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className={`text-2xl font-bold ${panelTitleClass}`}>{card.template.name}</h3>
                      <p className={`mt-1 text-sm ${panelBodyClass}`}>{card.template.description || '当前模板已准备好，可直接生成。'}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {card.result && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? 'bg-emerald-500/10 text-emerald-200' : 'bg-emerald-50 text-emerald-700'}`}>
                        <CheckCircle className="h-3.5 w-3.5" />
                        已生成
                      </span>
                    )}
                    {card.generating && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? 'bg-violet-500/10 text-violet-200' : 'bg-violet-50 text-violet-700'}`}>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        生成中
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className={`border-b px-6 py-6 lg:border-b-0 lg:border-r ${darkMode ? 'border-white/10' : 'border-slate-100'}`}>
                  <div className="grid gap-6">
                    <div>
                      <div className="mb-4 flex items-center gap-2">
                        <span className="h-5 w-1 rounded-full bg-violet-500" />
                        <span className={`text-lg font-bold ${panelTitleClass}`}>配置选项</span>
                      </div>

                      <div className="space-y-3">
                        {card.template.variables?.length > 0 ? (
                          card.template.variables.map((variable) => (
                            <div
                              key={variable.key}
                              className={`rounded-[22px] border p-4 ${insetPanelClass}`}
                            >
                              <label className={`mb-2 block text-sm font-semibold ${panelLabelClass}`}>
                                {variable.label}
                                {variable.required && <span className="ml-1 text-red-500">*</span>}
                              </label>
                              {renderVariableField(card, cardIndex, variable)}
                            </div>
                          ))
                        ) : card.template.referenceImages?.length > 0 ? (
                          <div className={`rounded-[22px] border p-4 ${elevatedPanelClass}`}>
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <p className={`text-sm font-semibold ${panelTitleClass}`}>模板选择</p>
                                <p className={`mt-1 text-xs leading-5 ${panelCaptionClass}`}>
                                  默认选中第一张预设图；点击下方缩略图可切换当前使用的模板图。
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                  card.selectedPresetImage
                                    ? 'bg-violet-600 text-white'
                                    : darkMode
                                      ? 'bg-white/10 text-[var(--muted-foreground)]'
                                      : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {card.selectedPresetImage ? '已选择 1 张' : `共 ${card.template.referenceImages.length} 张`}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              {card.template.referenceImages.map((image, imageIndex) => {
                                const isSelected = card.selectedPresetImage?.id === image.id;

                                return (
                                  <div
                                    key={image.id}
                                    onClick={() => handlePresetImageToggle(cardIndex, image)}
                                    className={`group relative cursor-pointer overflow-hidden rounded-xl transition-all ${
                                      isSelected
                                        ? `ring-2 ring-violet-500 ring-offset-2 ${darkMode ? 'ring-offset-[#171c18]' : ''}`
                                        : darkMode
                                          ? 'hover:ring-2 hover:ring-white/20'
                                          : 'hover:ring-2 hover:ring-gray-300'
                                    }`}
                                  >
                                    <img
                                      src={image.url}
                                      alt={`参考图 ${imageIndex + 1}`}
                                      className="h-[68px] w-full object-contain"
                                      style={{ objectPosition: 'center center' }}
                                    />
                                    <div
                                      className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                        isSelected ? 'bg-violet-600 text-white' : 'bg-gray-800 text-white'
                                      }`}
                                    >
                                      {isSelected ? '已选中' : `图${imageIndex + 1}`}
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPreviewImage(image.url);
                                        }}
                                        className={`rounded-full p-2 shadow-lg transition-transform hover:scale-105 ${
                                          darkMode ? 'bg-[#151b17]/90 text-[var(--foreground)]' : 'bg-white/90 text-gray-900'
                                        }`}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className={`rounded-[22px] border p-4 text-sm ${insetPanelClass} ${panelCaptionClass}`}>
                            当前模板没有额外输入项，可直接生成。
                          </div>
                        )}
                      </div>
                    </div>

                    {card.template.allowUserPrompt !== false && (
                      <div className="space-y-3">
                        <label
                          className={`flex cursor-pointer items-center justify-between rounded-[22px] border p-4 transition-colors ${
                            darkMode
                              ? 'border-violet-500/20 bg-violet-500/10 hover:bg-violet-500/15'
                              : 'border-violet-100 bg-violet-50/70 hover:bg-violet-50'
                          }`}
                        >
                          <div>
                            <p className={`text-sm font-semibold ${panelTitleClass}`}>启用自定义提示词</p>
                            <p className={`mt-1 text-xs ${panelCaptionClass}`}>开启后可为当前模板追加独立描述</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={card.enableUserPrompt}
                            onChange={(e) => handleUserPromptToggle(cardIndex, e.target.checked)}
                            className="h-4 w-4 rounded border-violet-300 text-violet-600 focus:ring-violet-500"
                          />
                        </label>

                        <div
                          onClick={() => handleUserPromptPriorityToggle(cardIndex)}
                          className={`flex cursor-pointer items-center justify-between rounded-[22px] border px-4 py-3 transition-colors ${
                            darkMode
                              ? 'border-white/10 bg-[linear-gradient(180deg,rgba(28,35,29,0.94),rgba(20,26,21,0.86))] hover:border-violet-500/20'
                              : 'border-violet-100 bg-white hover:border-violet-200'
                          }`}
                        >
                          <div>
                            <p className={`text-sm font-semibold ${panelTitleClass}`}>优先</p>
                            <p className={`mt-1 text-xs ${panelCaptionClass}`}>优先时会把补充提示词放到模板提示词前面</p>
                          </div>
                          <div className={`relative h-6 w-11 rounded-full transition-colors ${card.userPromptPriority ? 'bg-violet-500' : darkMode ? 'bg-white/10' : 'bg-slate-200'}`}>
                            <motion.div
                              animate={{ x: card.userPromptPriority ? 22 : 2 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              className="absolute top-1 h-4 w-4 rounded-full bg-white shadow"
                            />
                          </div>
                        </div>

                        <textarea
                          value={card.userPrompt}
                          onChange={(e) => handleUserPromptChange(cardIndex, e.target.value)}
                          rows={4}
                          disabled={!card.enableUserPrompt}
                          className={`w-full resize-none rounded-[22px] border px-4 py-3 text-sm outline-none transition-all focus:border-violet-300 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed ${inputSurfaceClass}`}
                          placeholder="在这里输入额外的提示词描述..."
                        />
                      </div>
                    )}

                    {card.specifiedColors.length > 0 && (
                      <div className={`rounded-[22px] border p-4 ${accentPanelClass}`}>
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Palette className="h-4 w-4 text-violet-500" />
                            <span className={`text-sm font-semibold ${panelTitleClass}`}>自定义颜色</span>
                          </div>
                          <span className={`text-xs ${panelCaptionClass}`}>共 {card.specifiedColors.length} 个</span>
                        </div>

                        <div className="space-y-2">
                          {card.specifiedColors.map((color) => (
                            <div
                              key={color.name}
                              className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${elevatedPanelClass}`}
                            >
                              <div className="relative shrink-0">
                                <div
                                  className={`h-8 w-8 rounded-full border-2 shadow-inner ${darkMode ? 'border-white/10' : 'border-slate-200'}`}
                                  style={{ backgroundColor: color.color }}
                                >
                                  <input
                                    type="color"
                                    value={HEX_COLOR_REGEX.test(color.color) ? color.color : '#888888'}
                                    onChange={(e) =>
                                      handleSpecifiedColorPickerChange(cardIndex, color.name, e.target.value)
                                    }
                                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                  />
                                </div>
                                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                                  {color.name.replace('指定色', '')}
                                </span>
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className={`truncate text-sm ${panelTitleClass}`}>{color.label || color.name}</p>
                              </div>

                              <input
                                type="text"
                                value={color.text || color.color}
                                onChange={(e) =>
                                  handleSpecifiedColorTextChange(cardIndex, color.name, e.target.value)
                                }
                                onBlur={() => handleSpecifiedColorTextBlur(cardIndex, color.name)}
                                className={`w-24 rounded-xl border px-2 py-1.5 text-xs font-mono outline-none transition-all focus:border-violet-300 focus:ring-4 focus:ring-violet-100 ${inputSurfaceClass}`}
                                placeholder="#888888"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => handleGenerateSingle(cardIndex)}
                      disabled={!kvImage || card.generating || batchGenerating}
                      className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-4 text-base font-semibold text-white shadow-[0_18px_40px_-24px_rgba(124,58,237,0.75)] transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {card.generating ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          正在生成
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-5 w-5" />
                          立即生成
                        </>
                      )}
                    </button>

                    {card.error && (
                      <div className={`flex items-start gap-3 rounded-[22px] border px-4 py-3 text-sm ${darkMode ? 'border-red-500/20 bg-red-500/10 text-red-200' : 'border-red-100 bg-red-50 text-red-700'}`}>
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>{card.error}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-6 py-6">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-violet-500" />
                    <span className={`text-lg font-bold ${panelTitleClass}`}>预览效果</span>
                  </div>

                  {card.result ? (
                    <div className="space-y-4">
                      <div
                        className={`group relative cursor-pointer overflow-hidden rounded-[24px] border p-3 ${elevatedPanelClass}`}
                        onClick={() => setPreviewImage(card.result.imageUrl)}
                      >
                        <img
                          src={card.result.imageUrl}
                          alt={`${card.template.name} 生成结果`}
                          className="max-h-[340px] min-h-[280px] w-full rounded-[18px] object-contain"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/30 opacity-0 transition-opacity group-hover:opacity-100">
                          <div className="rounded-full border border-white/30 bg-white/20 p-3 text-white backdrop-blur">
                            <Eye className="h-5 w-5" />
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          onClick={() => handleDownloadSingle(card)}
                          className="flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
                        >
                          <Download className="h-4 w-4" />
                          下载结果
                        </button>
                        <button
                          onClick={() => handleRegenerateSingle(cardIndex)}
                          disabled={batchGenerating}
                          className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                            darkMode
                              ? 'border-white/10 bg-[#151b17] text-[var(--foreground)] hover:bg-[#1b211d]'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <RefreshCw className="h-4 w-4" />
                          重新生成
                        </button>
                      </div>

                      {card.result.revisedPrompt && (user?.role === 'admin' || user?.role === 'sub_admin') && (
                        <div className={`rounded-2xl border p-3 ${insetPanelClass}`}>
                          <p className={`mb-1 text-[10px] font-bold uppercase tracking-[0.2em] ${panelCaptionClass}`}>
                            Prompt
                          </p>
                          <p className={`line-clamp-3 text-xs italic leading-5 ${panelBodyClass}`}>
                            {card.result.revisedPrompt}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`flex min-h-[420px] flex-col rounded-[26px] border-2 border-dashed p-6 ${
                        darkMode
                          ? 'border-violet-500/25 bg-[linear-gradient(180deg,rgba(38,27,51,0.6),rgba(21,26,22,0.96))]'
                          : 'border-violet-200 bg-[linear-gradient(180deg,rgba(250,248,255,0.96),rgba(255,255,255,0.96))]'
                      }`}
                    >
                      <div className={`mb-6 flex items-center justify-between text-xs ${panelCaptionClass}`}>
                        <span>待生成区域</span>
                        <span>{card.generating ? card.generationStatus || '处理中...' : '等待中'}</span>
                      </div>

                      <div className="flex flex-1 flex-col items-center justify-center text-center">
                        {card.generating ? (
                          <>
                            <div className="relative mb-6">
                              <div className={`h-16 w-16 animate-spin rounded-full border-4 border-t-violet-500 ${darkMode ? 'border-violet-500/15' : 'border-violet-100'}`} />
                              <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-violet-400" />
                            </div>
                            <p className="text-lg font-bold text-violet-700">正在生成</p>
                            <p className={`mt-2 text-sm ${panelCaptionClass}`}>请稍候，系统正在生成当前模板效果图</p>
                          </>
                        ) : (
                          <>
                            <div className="relative mb-6">
                              <div
                                className={`mx-auto flex h-20 w-20 items-center justify-center rounded-[22px] border shadow-[0_18px_40px_-28px_rgba(124,58,237,0.45)] ${
                                  darkMode ? 'border-violet-500/20 bg-[#151b17]' : 'border-violet-200 bg-white'
                                }`}
                              >
                                <ImageIcon className="h-9 w-9 text-violet-300" />
                              </div>
                              <span className="absolute -right-2 top-1 h-2 w-2 rounded-full bg-violet-200" />
                              <span className="absolute left-1 top-7 h-1.5 w-1.5 rounded-full bg-violet-200" />
                            </div>
                            <p className="text-2xl font-bold text-violet-700">等待生成</p>
                            <p className={`mt-2 text-sm leading-6 ${panelCaptionClass}`}>点击左侧生成按钮开始创作</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </section>
      </main>
    </div>
  );
}

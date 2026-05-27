'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { UserAvatar } from '@/components/UserAvatar';
import { AdminThemeModal } from '@/components/AdminThemeModal';
import {
  applyAdminColorTheme,
  getStoredAdminColorTheme,
  persistAdminColorTheme,
  type AdminColorTheme
} from '@/lib/admin-color-theme';
import { 
  ArrowLeft, 
  Layers, 
  Palette, 
  Image as ImageIcon, 
  Eye,
  User,
  Sparkles,
  Plus,
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
  Settings2,
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
  enabled?: boolean;
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
    badge?: string;
    specialTemplateType?: string;
    specialTemplateLabel?: string;
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

type PreviewGlowColor = {
  r: number;
  g: number;
  b: number;
};

type PreviewGlowPalette = {
  left: PreviewGlowColor;
  center: PreviewGlowColor;
  right: PreviewGlowColor;
};

const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const rgba = (color: PreviewGlowColor, alpha: number) =>
  `rgba(${clampChannel(color.r)}, ${clampChannel(color.g)}, ${clampChannel(color.b)}, ${alpha})`;

const mixColor = (
  from: PreviewGlowColor,
  to: PreviewGlowColor,
  amount: number
): PreviewGlowColor => ({
  r: from.r + (to.r - from.r) * amount,
  g: from.g + (to.g - from.g) * amount,
  b: from.b + (to.b - from.b) * amount
});

const createFallbackGlowPalette = (darkMode: boolean): PreviewGlowPalette => {
  if (darkMode) {
    return {
      left: { r: 54, g: 68, b: 88 },
      center: { r: 78, g: 96, b: 120 },
      right: { r: 72, g: 82, b: 108 }
    };
  }

  return {
    left: { r: 196, g: 205, b: 220 },
    center: { r: 222, g: 228, b: 238 },
    right: { r: 205, g: 212, b: 225 }
  };
};

const getDominantRegionColor = (
  pixels: Uint8ClampedArray,
  imageWidth: number,
  startX: number,
  endX: number,
  startY: number,
  endY: number
): PreviewGlowColor | null => {
  const buckets = new Map<string, { score: number; r: number; g: number; b: number; weight: number }>();

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = (y * imageWidth + x) * 4;
      const alpha = pixels[index + 3] / 255;
      if (alpha < 0.12) continue;

      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const maxChannel = Math.max(r, g, b);
      const minChannel = Math.min(r, g, b);
      const saturation = maxChannel - minChannel;
      const brightness = (r + g + b) / 3;
      const quantizedR = Math.round(r / 24) * 24;
      const quantizedG = Math.round(g / 24) * 24;
      const quantizedB = Math.round(b / 24) * 24;
      const key = `${quantizedR}|${quantizedG}|${quantizedB}`;
      const edgeWeight = 1 + saturation / 92 + Math.abs(brightness - 127) / 255 + alpha * 1.35;
      const current = buckets.get(key) ?? { score: 0, r: 0, g: 0, b: 0, weight: 0 };

      current.score += edgeWeight;
      current.r += r * edgeWeight;
      current.g += g * edgeWeight;
      current.b += b * edgeWeight;
      current.weight += edgeWeight;
      buckets.set(key, current);
    }
  }

  let dominant: { score: number; r: number; g: number; b: number; weight: number } | null = null;

  for (const candidate of buckets.values()) {
    if (!dominant || candidate.score > dominant.score) {
      dominant = candidate;
    }
  }

  if (!dominant || dominant.weight === 0) {
    return null;
  }

  return {
    r: dominant.r / dominant.weight,
    g: dominant.g / dominant.weight,
    b: dominant.b / dominant.weight
  };
};

const samplePreviewGlowPalette = (image: HTMLImageElement): PreviewGlowPalette | null => {
  const { naturalWidth, naturalHeight } = image;
  if (!naturalWidth || !naturalHeight) {
    return null;
  }

  const sampleMaxSize = 160;
  const scale = Math.min(1, sampleMaxSize / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(12, Math.round(naturalWidth * scale));
  const height = Math.max(12, Math.round(naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, width, height);

  let pixels: Uint8ClampedArray;
  try {
    pixels = context.getImageData(0, 0, width, height).data;
  } catch {
    return null;
  }

  const sideStripWidth = Math.max(2, Math.floor(width * 0.12));
  const trimY = Math.max(0, Math.floor(height * 0.04));
  const startY = trimY;
  const endY = Math.max(startY + 1, height - trimY);

  const left = getDominantRegionColor(pixels, width, 0, sideStripWidth, startY, endY);
  const right = getDominantRegionColor(pixels, width, width - sideStripWidth, width, startY, endY);
  const top = getDominantRegionColor(
    pixels,
    width,
    sideStripWidth,
    Math.max(sideStripWidth + 1, width - sideStripWidth),
    0,
    Math.max(1, Math.floor(height * 0.12))
  );
  const bottom = getDominantRegionColor(
    pixels,
    width,
    sideStripWidth,
    Math.max(sideStripWidth + 1, width - sideStripWidth),
    Math.max(0, height - Math.max(1, Math.floor(height * 0.12))),
    height
  );

  const fallback = left ?? right ?? top ?? bottom;
  if (!fallback) {
    return null;
  }

  const resolvedLeft = left ?? mixColor(fallback, right ?? fallback, 0.25);
  const resolvedRight = right ?? mixColor(fallback, left ?? fallback, 0.25);
  const verticalBlend = mixColor(top ?? fallback, bottom ?? fallback, 0.5);
  const center = mixColor(mixColor(resolvedLeft, resolvedRight, 0.5), verticalBlend, 0.35);

  return {
    left: resolvedLeft,
    center,
    right: resolvedRight
  };
};

function TemplatePreviewImage({
  url,
  alt,
  title,
  darkMode
}: {
  url: string;
  alt: string;
  title?: string;
  darkMode: boolean;
}) {
  const [isPortrait, setIsPortrait] = useState(false);
  const [glowPalette, setGlowPalette] = useState<PreviewGlowPalette | null>(null);

  useEffect(() => {
    setGlowPalette(null);
  }, [url]);

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    const { naturalWidth, naturalHeight } = image;
    setIsPortrait(naturalHeight > naturalWidth * 1.08);

    const nextPalette = samplePreviewGlowPalette(image);
    setGlowPalette(nextPalette);
  };

  const activePalette = glowPalette ?? createFallbackGlowPalette(darkMode);

  return (
    <div
      className={`relative mb-3 w-full aspect-video overflow-hidden rounded-lg ${
        darkMode ? 'bg-gray-800' : 'bg-gray-100'
      }`}
    >
      {isPortrait ? (
        <>
          <div
            className="absolute inset-y-[-12%] left-[-8%] w-[40%] scale-125 blur-3xl"
            style={{
              background: `radial-gradient(circle at 0% 50%, ${rgba(activePalette.left, 0.96)} 0%, ${rgba(activePalette.center, 0.58)} 48%, transparent 82%)`
            }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-[-12%] right-[-8%] w-[40%] scale-125 blur-3xl"
            style={{
              background: `radial-gradient(circle at 100% 50%, ${rgba(activePalette.right, 0.96)} 0%, ${rgba(activePalette.center, 0.58)} 48%, transparent 82%)`
            }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 left-[18%] right-[18%]"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${rgba(activePalette.center, darkMode ? 0.16 : 0.24)} 50%, transparent 100%)`
            }}
            aria-hidden="true"
          />
        </>
      ) : (
        <div
          className="absolute inset-[-8%] scale-105 blur-3xl"
          style={{
            background: `linear-gradient(120deg, ${rgba(activePalette.left, 0.82)} 0%, ${rgba(activePalette.center, 0.7)} 50%, ${rgba(activePalette.right, 0.82)} 100%)`
          }}
          aria-hidden="true"
        />
      )}
      <div
        className={`absolute inset-0 ${
          isPortrait
            ? 'bg-gradient-to-r from-black/10 via-white/5 to-black/10'
            : 'bg-gradient-to-br from-white/20 via-white/5 to-black/10'
        }`}
        aria-hidden="true"
      />
      <div
        className={`absolute inset-0 z-10 ${
          isPortrait
            ? 'bg-[radial-gradient(ellipse_at_center,transparent_54%,rgba(255,255,255,0.12)_74%,rgba(255,255,255,0.2)_100%)]'
            : 'bg-[radial-gradient(ellipse_at_center,transparent_58%,rgba(255,255,255,0.1)_78%,rgba(255,255,255,0.18)_100%)]'
        }`}
        aria-hidden="true"
      />
      <img
        src={url}
        alt={alt}
        className="relative z-20 w-full h-full object-contain"
        style={{ objectPosition: 'center top' }}
        onLoad={handleImageLoad}
      />
      {title && (
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/70 to-transparent p-3">
          <p className="truncate text-sm font-medium text-white">
            {title}
          </p>
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const [featureGroups, setFeatureGroups] = useState<FeatureGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<FeatureGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [featureGroupsError, setFeatureGroupsError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<FeatureGroup | null>(null);
  const [templatePendingDelete, setTemplatePendingDelete] = useState<{
    template: Template;
    a: number;
    b: number;
    expected: number;
  } | null>(null);
  const [deleteVerificationInput, setDeleteVerificationInput] = useState('');
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [newGroupData, setNewGroupData] = useState({
    name: '',
    key: '',
    description: '',
    icon: 'Layers'
  });
  const [saving, setSaving] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAdminThemeModal, setShowAdminThemeModal] = useState(false);
  const [adminColorTheme, setAdminColorTheme] = useState<AdminColorTheme>('forest-amber');
  const featureGroupsScrollRef = useRef<HTMLDivElement | null>(null);
  const templatesScrollRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const canManage = user?.role === 'admin' || user?.role === 'sub_admin';
  const isAdmin = user?.role === 'admin';
  const isSubAdmin = user?.role === 'sub_admin';

  const availableIcons = [
    { key: 'Layers', component: Layers, name: '图层' },
    { key: 'Palette', component: Palette, name: '调色板' },
    { key: 'Image', component: ImageIcon, name: '图片' },
    { key: 'User', component: User, name: '用户' },
    { key: 'Sparkles', component: Sparkles, name: '闪亮' }
  ];

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    const savedAdminTheme = getStoredAdminColorTheme();
    setAdminColorTheme(savedAdminTheme);
    applyAdminColorTheme(savedAdminTheme);
    if (savedDarkMode === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

    const bindScrollReveal = (element: HTMLElement | null) => {
      if (!element) return () => {};

      const handleScroll = () => {
        element.classList.add('is-scrolling');
        const existingTimer = timers.get(element);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const nextTimer = setTimeout(() => {
          element.classList.remove('is-scrolling');
          timers.delete(element);
        }, 720);

        timers.set(element, nextTimer);
      };

      element.addEventListener('scroll', handleScroll, { passive: true });

      return () => {
        const existingTimer = timers.get(element);
        if (existingTimer) {
          clearTimeout(existingTimer);
          timers.delete(element);
        }
        element.removeEventListener('scroll', handleScroll);
      };
    };

    const cleanupFeatureGroups = bindScrollReveal(featureGroupsScrollRef.current);
    const cleanupTemplates = bindScrollReveal(templatesScrollRef.current);

    return () => {
      cleanupFeatureGroups();
      cleanupTemplates();
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

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

  const fetchFeatureGroups = async (requesterId?: string) => {
    try {
      const query = new URLSearchParams({ enabled: 'true' });
      if (requesterId) query.set('requesterId', requesterId);
      const response = await fetch(`/api/feature-groups?${query.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || '获取功能组失败');
      }

      if (!Array.isArray(data)) {
        throw new Error('功能组数据格式异常');
      }

      setFeatureGroupsError('');
      setFeatureGroups(data);
      setSelectedGroup(data.length > 0 ? data[0] : null);
    } catch (error) {
      console.error('获取功能组失败:', error);
      setFeatureGroups([]);
      setSelectedGroup(null);
      setFeatureGroupsError(error instanceof Error ? error.message : '获取功能组失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
          fetchFeatureGroups(userData.id);
        } else {
          router.push('/auth');
        }
      } catch {
        router.push('/auth');
      }
    };

    fetchUser();
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
    
    if (!canManage) {
      alert('权限不足，无法编辑模板');
      return;
    }
    
    router.push(`/templates/config?id=${template.id}`);
  };

  const closeDeleteTemplateModal = () => {
    if (deletingTemplateId) return;
    setTemplatePendingDelete(null);
    setDeleteVerificationInput('');
  };

  const handleDeleteTemplate = async (e: React.MouseEvent, template: Template) => {
    e.stopPropagation();
    
    if (!canManage) {
      alert('权限不足，无法删除模板');
      return;
    }
    
    const a = Math.floor(Math.random() * 90) + 10;
    const b = Math.floor(Math.random() * 90) + 10;
    setTemplatePendingDelete({
      template,
      a,
      b,
      expected: a * b
    });
    setDeleteVerificationInput('');
  };

  const handleConfirmDeleteTemplate = async () => {
    if (!templatePendingDelete || !user) return;

    const parsed = parseInt(deleteVerificationInput.trim(), 10);
    if (!Number.isFinite(parsed) || parsed !== templatePendingDelete.expected) {
      alert('答案不正确，已取消删除');
      setDeleteVerificationInput('');
      return;
    }

    setDeletingTemplateId(templatePendingDelete.template.id);
    try {
      const response = await fetch(`/api/templates/${templatePendingDelete.template.id}?requesterId=${user.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('模板删除成功');
        setTemplatePendingDelete(null);
        setDeleteVerificationInput('');
        fetchFeatureGroups(user.id);
      } else {
        throw new Error('删除失败');
      }
    } catch (error) {
      console.error('删除模板失败:', error);
      alert('删除失败，请重试');
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const handleNewTemplate = () => {
    if (!canManage) {
      alert('权限不足，无法创建模板');
      return;
    }
    router.push(`/templates/config?groupId=${selectedGroup?.id}`);
  };

  const handleAddGroup = () => {
    if (!canManage) {
      alert('权限不足，无法添加功能分类');
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
        body: JSON.stringify({ ...newGroupData, requesterId: user.id })
      });

      if (response.ok) {
        setShowAddGroupModal(false);
        fetchFeatureGroups(user.id);
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
    if (!canManage) {
      alert('权限不足，无法编辑功能分类');
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
        body: JSON.stringify({ ...newGroupData, requesterId: user.id })
      });

      if (response.ok) {
        setShowEditGroupModal(false);
        fetchFeatureGroups(user.id);
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
    if (!canManage) {
      alert('权限不足，无法删除功能分类');
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
      const response = await fetch(`/api/feature-groups/${group.id}?requesterId=${user.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        if (selectedGroup?.id === group.id) {
          const remaining = featureGroups.filter(g => g.id !== group.id);
          setSelectedGroup(remaining.length > 0 ? remaining[0] : null);
        }
        fetchFeatureGroups(user.id);
        alert('功能分类删除成功');
      } else {
        throw new Error('删除失败');
      }
    } catch (error) {
      console.error('删除功能分类失败:', error);
      alert('删除失败，请重试');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('登出失败:', err);
    }
    router.push('/auth');
  };

  if (loading) {
    return (
      <div className={`haipablo-static-shell min-h-screen flex items-center justify-center transition-colors duration-500 ${darkMode ? 'bg-[#121612]' : ''}`}>
        <Loader2 className={`w-12 h-12 animate-spin ${darkMode ? 'text-white' : 'text-gray-800'}`} />
      </div>
    );
  }

  return (
    <div className={`haipablo-static-shell min-h-screen transition-colors duration-500 lg:flex lg:h-screen lg:flex-col lg:overflow-hidden ${darkMode ? 'bg-[#121612]' : ''}`}>
      <AdminThemeModal
        darkMode={darkMode}
        isOpen={showAdminThemeModal}
        currentTheme={adminColorTheme}
        onClose={() => setShowAdminThemeModal(false)}
        onThemeChange={handleAdminColorThemeChange}
        onOpenAdminUsers={() => router.push('/admin/users')}
      />
      <header className="z-50 px-4 pt-4 transition-colors duration-500 lg:shrink-0 sm:px-6 lg:px-8">
        <div
          className={`mx-auto flex w-[min(96vw,1880px)] items-center relative rounded-[1.75rem] px-6 py-4 shadow-[0_10px_40px_rgba(10,10,30,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl 2xl:px-8 ${
            darkMode
              ? 'border border-[#f5ecd9]/10 bg-[linear-gradient(90deg,rgba(245,236,217,0.06),rgba(245,236,217,0.12),rgba(193,245,214,0.06))] shadow-[0_12px_42px_rgba(8,10,8,0.28),inset_0_1px_0_rgba(255,244,214,0.06)]'
              : 'border border-black/[0.06] bg-[linear-gradient(90deg,rgba(255,255,255,0.78),rgba(255,255,255,0.92),rgba(255,255,255,0.78))] shadow-[0_10px_40px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.7)]'
          }`}
        >
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'text-stone-400 hover:bg-white/[0.07] hover:text-stone-100' : 'hover:bg-gray-100 text-gray-700'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="hidden md:block">
              <h1 className={`text-xl font-bold transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>模板中心</h1>
              <p className={`text-xs transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>选择生成模板，开始创作</p>
            </div>
          </div>

          {/* Centered Logo - Enlarged by 20% */}
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
                  ? 'bg-[#f4ede0] text-[#2b241d] border-[#f4ede0]/25' 
                  : 'bg-gray-950 text-white border-gray-900'
              }`}>
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">潮能力: {user.credits ?? 0}</span>
              </div>
            )}
            <button
              onClick={toggleDarkMode}
              className={`p-2.5 rounded-xl transition-all duration-300 group ${
                darkMode 
                  ? 'bg-[#f5ecd9]/10 hover:bg-[#f5ecd9]/16 text-[#f7f2ea] hover:text-white hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgba(245,236,217,0.35)]' 
                  : 'bg-gray-900 hover:bg-black text-white hover:text-white hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgba(15,23,42,0.45)]'
              }`}
            >
              {darkMode ? (
                <Sun className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
              ) : (
                <Moon className="w-5 h-5 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
              )}
            </button>
            {user && (
              <div className="relative user-menu-container">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center hover:opacity-80 transition-opacity"
                >
                  <UserAvatar user={user} size="lg" darkMode={darkMode} />
                </button>

                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`haipablo-modal-panel absolute right-0 top-full mt-2 w-56 rounded-xl shadow-lg border overflow-hidden z-50 transition-colors duration-500 ${
                        darkMode 
                          ? 'bg-[#1b211c]/95 border-[#f5ecd9]/10' 
                          : 'bg-white border-white/60'
                      }`}
                      onClick={() => setShowUserMenu(false)}
                    >
                      <div className={`p-4 border-b transition-colors duration-500 ${
                        darkMode 
                          ? 'bg-[#f5ecd9]/[0.035] border-[#f5ecd9]/10' 
                          : 'bg-white/45 border-white/60'
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
                              ? 'bg-amber-950/40 text-amber-200 border border-amber-800/60' 
                              : 'bg-violet-50 text-violet-700 border border-violet-100'
                          }`}>
                            <Sparkles className="w-3 h-3" />
                            潮能力: {user.credits ?? 0}
                          </span>
                          {isAdmin && (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 w-fit ${
                              darkMode 
                                ? 'bg-amber-950/45 text-amber-300' 
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              <Shield className="w-3 h-3" />
                              管理员
                            </span>
                          )}
                          {isSubAdmin && (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 w-fit ${
                              darkMode 
                                ? 'bg-teal-950/45 text-teal-300' 
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
                              ? 'text-stone-300 hover:bg-white/[0.06] hover:text-white' 
                              : 'text-gray-700 hover:bg-white/80 hover:text-gray-900'
                          }`}
                        >
                          <History className="w-4 h-4" />
                          我的历史
                        </button>

                        {canManage && (
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              setShowAdminThemeModal(true);
                            }}
                            className={`w-full px-4 py-2.5 text-left rounded-lg transition-colors flex items-center gap-3 mt-1 ${
                              darkMode
                                ? 'text-stone-300 hover:bg-white/[0.06] hover:text-white'
                                : 'text-gray-700 hover:bg-white/80 hover:text-gray-900'
                            }`}
                          >
                            <Settings2 className="w-4 h-4" />
                            后台管理
                          </button>
                        )}

                        {canManage && (
                          <button
                            onClick={() => router.push('/admin/users')}
                            className={`w-full px-4 py-2.5 text-left rounded-lg transition-colors flex items-center gap-3 mt-1 ${
                              darkMode 
                                ? 'text-amber-300 hover:bg-amber-950/30' 
                                : 'text-amber-700 hover:bg-amber-50/80'
                            }`}
                          >
                            <Users className="w-4 h-4" />
                            {isAdmin ? '用户与部门管理' : '人员列表'}
                          </button>
                        )}

                        <div className={`my-2 border-t transition-colors duration-500 ${darkMode ? 'border-white/10' : 'border-white/55'}`} />

                        <button
                          onClick={handleLogout}
                          className={`w-full px-4 py-2.5 text-left rounded-lg transition-colors flex items-center gap-3 ${
                            darkMode 
                              ? 'text-red-400 hover:bg-red-950/30' 
                              : 'text-red-600 hover:bg-red-50/80'
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

      <div className="mx-auto w-[min(96vw,1880px)] px-6 py-8 2xl:px-8 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        <div className="grid grid-cols-12 gap-8 lg:h-full lg:min-h-0">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="col-span-12 min-h-0 lg:col-span-3"
          >
            <div className="haipablo-glass-panel rounded-[1.75rem] shadow-sm transition-colors duration-500 overflow-hidden lg:flex lg:h-full lg:flex-col">
              <div className={`p-6 border-b transition-colors duration-500 ${darkMode ? 'border-white/10' : 'border-white/55'}`}>
                <h2 className={`text-lg font-semibold mb-2 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>功能分类</h2>
                <p className={`text-sm transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>选择生成大类</p>
              </div>
              
              <div ref={featureGroupsScrollRef} className="haipablo-scrollbar p-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                {featureGroupsError && (
                  <div className={`mb-3 rounded-xl border px-4 py-3 text-sm ${
                    darkMode
                      ? 'border-red-900/60 bg-red-950/30 text-red-300'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}>
                    {featureGroupsError}
                  </div>
                )}
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
                              ? 'bg-[linear-gradient(180deg,rgba(245,236,217,0.16),rgba(193,245,214,0.07))] text-white shadow-lg shadow-black/20'
                              : 'bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(30,41,59,0.88))] text-white shadow-lg'
                            : darkMode
                              ? 'hover:bg-white/[0.05] text-stone-300'
                              : 'hover:bg-white/75 text-gray-700'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isSelected 
                            ? darkMode ? 'bg-white/20' : 'bg-white/20'
                            : darkMode ? 'bg-white/[0.08]' : 'bg-white/80'
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
                      
                      {canManage && (
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
                                  ? 'bg-white/[0.07] hover:bg-white/[0.11] text-stone-300' 
                                  : 'bg-white/80 hover:bg-white text-gray-600'
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
                                  ? 'bg-white/[0.07] hover:bg-red-950/30 text-stone-300 hover:text-red-300' 
                                  : 'bg-white/80 hover:bg-red-50 text-gray-600 hover:text-red-600'
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
                
                {canManage && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: featureGroups.length * 0.1 }}
                    onClick={handleAddGroup}
                    className={`w-full p-4 rounded-xl flex items-center gap-3 transition-all mb-2 border-2 border-dashed ${
                      darkMode 
                        ? 'hover:bg-white/[0.04] text-stone-400 border-[#f5ecd9]/10 hover:border-[#f5ecd9]/15' 
                        : 'hover:bg-white/75 text-gray-600 border-white/60 hover:border-white/90'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${darkMode ? 'bg-white/[0.07]' : 'bg-white/80'}`}>
                      <FolderPlus className={`w-5 h-5 ${darkMode ? 'text-stone-300' : 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">添加分类</div>
                      <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        创建新的功能分类
                      </div>
                    </div>
                  </motion.button>
                )}
                {!featureGroupsError && featureGroups.length === 0 && (
                  <div className={`rounded-xl px-4 py-8 text-center text-sm ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    暂无可用功能分类
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="col-span-12 min-h-0 lg:col-span-9"
          >
            <div className="haipablo-glass-panel rounded-[1.75rem] shadow-sm transition-colors duration-500 overflow-hidden lg:flex lg:h-full lg:flex-col">
              <div className={`p-6 border-b transition-colors duration-500 ${darkMode ? 'border-white/10' : 'border-white/55'}`}>
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
                      className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 border ${
                        batchMode 
                          ? darkMode
                            ? 'bg-[#f4ede0] text-[#2b241d] border-[#f4ede0]/25 hover:bg-[#fbf6ed]'
                            : 'bg-gray-950 text-white border-gray-900 hover:bg-gray-800'
                          : darkMode
                            ? 'bg-[#1d231e] text-[#f7f2ea] border-[#f5ecd9]/10 hover:bg-[#252c26]'
                            : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      <LayersIcon className="w-4 h-4" />
                      {batchMode ? '取消批量' : '批量生成'}
                    </button>
                    {canManage && (
                      <button 
                        onClick={handleNewTemplate}
                        className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                          darkMode 
                            ? 'bg-[#f4ede0] text-[#2b241d] hover:bg-[#fbf6ed]' 
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

              <div ref={templatesScrollRef} className="haipablo-scrollbar p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
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
                              ? 'bg-[#202722] text-stone-300 hover:bg-[#283029]' 
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
                          className={`group relative rounded-[1.5rem] p-4 border transition-all duration-300 cursor-pointer overflow-hidden ${
                            batchMode 
                              ? selectedTemplates.includes(template.id)
                                ? darkMode
                                  ? 'border-emerald-400/60 bg-emerald-950/18'
                                  : 'border-green-400/80 bg-emerald-50/70'
                                : darkMode
                                  ? 'border-[#f5ecd9]/10 hover:border-[#f5ecd9]/15 hover:shadow-lg bg-[linear-gradient(180deg,rgba(245,236,217,0.08),rgba(193,245,214,0.04))]'
                                  : 'border-slate-200/85 shadow-[0_10px_30px_-22px_rgba(15,23,42,0.35),inset_0_1px_0_rgba(255,255,255,0.95)] hover:border-slate-300 hover:shadow-lg bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,0.76))]'
                              : darkMode
                                ? 'border-[#f5ecd9]/10 hover:border-[#f5ecd9]/15 hover:shadow-lg bg-[linear-gradient(180deg,rgba(245,236,217,0.08),rgba(193,245,214,0.04))]'
                                : 'border-slate-200/85 shadow-[0_10px_30px_-22px_rgba(15,23,42,0.35),inset_0_1px_0_rgba(255,255,255,0.95)] hover:border-slate-300 hover:shadow-lg bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,0.76))]'
                          }`}
                        >
                          <div className={`absolute inset-0 transition-opacity ${darkMode ? 'bg-[linear-gradient(180deg,rgba(255,244,214,0.05),rgba(193,245,214,0.04))] opacity-0 group-hover:opacity-100' : 'bg-slate-200/20 opacity-0 group-hover:opacity-100'}`} />
                          {template.enabled === false && (batchMode || !canManage) && (
                            <div
                              className={`absolute right-3 top-3 z-10 rounded-lg border px-2 py-1 ${
                                darkMode ? 'border-[#f5ecd9]/10 bg-[#161b17]/85 text-stone-400' : 'border-white/75 bg-white/85 text-gray-500'
                              }`}
                              title="已关闭"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Eye className="h-4 w-4" />
                            </div>
                          )}
                          
                          <div className="relative">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                {batchMode && (
                                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                                    selectedTemplates.includes(template.id)
                                      ? 'bg-green-500 border-green-500'
                                      : darkMode
                                        ? 'border-white/12 bg-white/[0.06]'
                                        : 'border-white/80 bg-white'
                                  }`}>
                                    {selectedTemplates.includes(template.id) && (
                                      <CheckSquare className="w-4 h-4 text-white" />
                                    )}
                                  </div>
                                )}
                                <h3 className={`min-w-0 text-base font-semibold line-clamp-1 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {template.name}
                                </h3>
                              </div>
                              {canManage && !batchMode && (
                                <div className="flex items-center gap-1">
                                  {template.enabled === false && (
                                    <div
                                      className={`rounded-lg border px-2 py-1 ${
                                        darkMode ? 'border-[#f5ecd9]/10 bg-[#171c18]/70 text-stone-400' : 'border-white/75 bg-white/80 text-gray-500'
                                      }`}
                                      title="已关闭"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </div>
                                  )}
                                  <button
                                    onClick={(e) => handleEditTemplate(e, template)}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      darkMode 
                                        ? 'hover:bg-white/[0.08] text-stone-400 hover:text-white' 
                                        : 'hover:bg-white/80 text-gray-500 hover:text-gray-700'
                                    }`}
                                    title="编辑模板"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteTemplate(e, template)}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      darkMode 
                                        ? 'hover:bg-red-950/30 text-stone-400 hover:text-red-300' 
                                        : 'hover:bg-red-50/80 text-gray-500 hover:text-red-600'
                                    }`}
                                    title="删除模板"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {template.coverMetadata?.specialTemplateType && (
                              <div className="mb-2">
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                                  {template.coverMetadata.badge || '特殊模板'}
                                </span>
                              </div>
                            )}
                            
                            {template.coverImage ? (
                              <TemplatePreviewImage
                                url={template.coverImage.url}
                                alt={template.coverImage.name}
                                title={template.coverMetadata?.title}
                                darkMode={darkMode}
                              />
                            ) : template.referenceImages && template.referenceImages.length > 0 ? (
                              <TemplatePreviewImage
                                url={template.referenceImages[0].url}
                                alt={template.referenceImages[0].name}
                                darkMode={darkMode}
                              />
                            ) : (
                              <div className={`w-full aspect-video rounded-lg flex items-center justify-center mb-3 ${
                                darkMode ? 'bg-white/[0.06]' : 'bg-white/75'
                              }`}>
                                <ImageIcon className={`w-8 h-8 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                              </div>
                            )}

                            {template.description?.trim() && (
                              <p className={`text-sm mb-2 line-clamp-1 h-5 transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {template.description}
                              </p>
                            )}
                            
                            {batchMode && (
                              <div className={`text-sm font-medium ${
                                selectedTemplates.includes(template.id)
                                  ? darkMode ? 'text-green-400' : 'text-green-600'
                                  : darkMode ? 'text-gray-500' : 'text-gray-500'
                              }`}>
                                {selectedTemplates.includes(template.id) ? '✓ 已选择' : '点击选择'}
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
                        className={`haipablo-glass-subtle mt-6 p-4 rounded-2xl border transition-colors duration-500 ${
                          darkMode 
                            ? 'bg-[linear-gradient(90deg,rgba(5,46,22,0.35),rgba(6,78,59,0.18))] border-emerald-700/35' 
                            : 'bg-gradient-to-r from-green-50/80 to-emerald-50/80 border-white/70'
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
                      darkMode ? 'bg-white/[0.08]' : 'bg-white/80'
                    }`}>
                      <Layers className={`w-10 h-10 ${darkMode ? 'text-gray-500' : 'text-gray-600'}`} />
                    </div>
                    <h3 className={`text-xl font-semibold mb-3 transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>该分类下暂无模板</h3>
                    <p className={`mb-6 transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>创建一个新模板开始使用</p>
                    {canManage && (
                      <button
                        onClick={handleNewTemplate}
                        className={`px-6 py-3 rounded-lg transition-colors inline-flex items-center gap-2 ${
                          darkMode 
                            ? 'bg-[#f4ede0] text-[#2b241d] hover:bg-[#fbf6ed]' 
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
              className="haipablo-modal-panel rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-colors duration-500"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`p-6 border-b flex items-center justify-between transition-colors duration-500 ${
                darkMode ? 'border-white/10' : 'border-white/55'
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
                        ? 'bg-white/[0.05] border-white/10 text-white placeholder-gray-500' 
                        : 'bg-white/80 border-white/70 text-gray-900'
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
                        ? 'bg-white/[0.05] border-white/10 text-white placeholder-gray-500' 
                        : 'bg-white/80 border-white/70 text-gray-900'
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
                        ? 'bg-white/[0.05] border-white/10 text-white placeholder-gray-500' 
                        : 'bg-white/80 border-white/70 text-gray-900'
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
                                ? 'border-gray-500 bg-white/[0.08]'
                                : 'border-gray-500 bg-white/80'
                              : darkMode
                                ? 'border-white/10 hover:border-white/15'
                                : 'border-white/70 hover:border-white'
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
                darkMode ? 'border-white/10' : 'border-white/55'
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
              className="haipablo-modal-panel rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-colors duration-500"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`p-6 border-b flex items-center justify-between transition-colors duration-500 ${
                darkMode ? 'border-white/10' : 'border-white/55'
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
                        ? 'bg-white/[0.05] border-white/10 text-white placeholder-gray-500' 
                        : 'bg-white/80 border-white/70 text-gray-900'
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
                        ? 'bg-white/[0.05] border-white/10 text-white placeholder-gray-500' 
                        : 'bg-white/80 border-white/70 text-gray-900'
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
                        ? 'bg-white/[0.05] border-white/10 text-white placeholder-gray-500' 
                        : 'bg-white/80 border-white/70 text-gray-900'
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
                                ? 'border-gray-500 bg-white/[0.08]'
                                : 'border-gray-500 bg-white/80'
                              : darkMode
                                ? 'border-white/10 hover:border-white/15'
                                : 'border-white/70 hover:border-white'
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
                darkMode ? 'border-white/10' : 'border-white/55'
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

      <AnimatePresence>
        {templatePendingDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={closeDeleteTemplateModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="haipablo-modal-panel w-full max-w-md overflow-hidden rounded-2xl shadow-2xl transition-colors duration-500"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between border-b p-6 transition-colors duration-500 ${
                darkMode ? 'border-white/10' : 'border-white/55'
              }`}>
                <div>
                  <h3 className={`text-xl font-semibold transition-colors duration-500 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    删除模板校验
                  </h3>
                  <p className={`mt-1 text-sm transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    输入正确答案后才会删除模板
                  </p>
                </div>
                <button
                  onClick={closeDeleteTemplateModal}
                  disabled={!!deletingTemplateId}
                  className={`rounded-lg p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    darkMode ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 p-6">
                <div className={`rounded-xl border px-4 py-3 text-sm ${
                  darkMode ? 'border-red-900/40 bg-red-950/20 text-red-200' : 'border-red-100 bg-red-50 text-red-700'
                }`}>
                  即将删除模板「{templatePendingDelete.template.name}」，此操作不可恢复。
                </div>

                <div>
                  <label className={`mb-2 block text-sm font-medium transition-colors duration-500 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    请输入 {templatePendingDelete.a} x {templatePendingDelete.b} 的答案
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={deleteVerificationInput}
                    onChange={(e) => setDeleteVerificationInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void handleConfirmDeleteTemplate();
                      }
                    }}
                    placeholder="输入计算结果"
                    disabled={!!deletingTemplateId}
                    className={`w-full rounded-lg border px-4 py-2.5 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60 ${
                      darkMode
                        ? 'border-white/10 bg-white/[0.05] text-white placeholder-gray-500'
                        : 'border-white/70 bg-white/80 text-gray-900'
                    }`}
                  />
                </div>
              </div>

              <div className={`flex justify-end gap-3 border-t p-6 transition-colors duration-500 ${
                darkMode ? 'border-white/10' : 'border-white/55'
              }`}>
                <button
                  onClick={closeDeleteTemplateModal}
                  disabled={!!deletingTemplateId}
                  className={`rounded-lg px-4 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  取消
                </button>
                <button
                  onClick={() => void handleConfirmDeleteTemplate()}
                  disabled={!deleteVerificationInput.trim() || !!deletingTemplateId}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2 text-white transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingTemplateId ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      删除中...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      确认删除
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

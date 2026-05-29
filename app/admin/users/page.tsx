'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { UserAvatar } from '@/components/UserAvatar';
import { UserMenuDropdown } from '@/components/UserMenuDropdown';
import type { ImageProviderSettingsPayload, ManagedImageProviderConfig } from '@/lib/image-provider-types';
import type { MaintenanceModeSettings } from '@/lib/maintenance-mode-types';
import { DEFAULT_MAINTENANCE_MODE_SETTINGS } from '@/lib/maintenance-mode-types';
import { 
  ArrowLeft, 
  User, 
  Users, 
  Plus, 
  Trash2, 
  Shield,
  Loader2,
  Clock,
  Image as ImageIcon,
  X,
  CheckCircle,
  AlertCircle,
  History,
  LogOut,
  Download,
  Upload,
  Database,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  CheckSquare,
  Square,
  Search,
  Sparkles,
  Settings2,
  Save
} from 'lucide-react';

interface UserData {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  role: string;
  credits: number;
  departmentId: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
  _count: {
    histories: number;
    jobs: number;
  };
}

interface ProviderTestState {
  loading: boolean;
  status: 'idle' | 'success' | 'error';
  message: string;
}

function createEmptyProvider(index: number): ManagedImageProviderConfig {
  return {
    id: `provider_${Date.now()}_${index}`,
    label: `新供应商 ${index + 1}`,
    kind: 'openai_compatible',
    model: 'gpt-image-2',
    isDefault: false,
    supportsEdit: true,
    enabled: true,
    baseUrl: '',
    apiKey: '',
    timeoutMs: 150000,
    maxRetries: 0,
  };
}

function AdminUsersPageContent() {
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userHistories, setUserHistories] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingCreditsUser, setEditingCreditsUser] = useState<UserData | null>(null);
  const [editingRoleUser, setEditingRoleUser] = useState<UserData | null>(null);
  const [newCredits, setNewCredits] = useState<number>(0);
  const [newRole, setNewRole] = useState<string>('user');
  const [updatingCredits, setUpdatingCredits] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [restoreMessage, setRestoreMessage] = useState('');
  const [restoreSuccess, setRestoreSuccess] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'all_records' | 'image_providers' | 'maintenance'>('users');
  const [showCreateDeptModal, setShowCreateDeptModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedDept, setSelectedDept] = useState<any>(null);
  const [newDeptName, setNewDeptName] = useState('');
  const [allocateAmount, setAllocateAmount] = useState<number>(10);
  const [processingDept, setProcessingDept] = useState(false);
  const [syncingDingTalk, setSyncingDingTalk] = useState(false);
  const [selectedFilterDeptId, setSelectedFilterDeptId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [allHistories, setAllHistories] = useState<any[]>([]);
  const [totalHistories, setTotalHistories] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [loadingAllHistories, setLoadingAllHistories] = useState(false);
  const historyLimit = 50;

  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
  const [providerSettings, setProviderSettings] = useState<ImageProviderSettingsPayload>({
    defaultProviderId: null,
    providers: [],
  });
  const [loadingProviderSettings, setLoadingProviderSettings] = useState(false);
  const [savingProviderSettings, setSavingProviderSettings] = useState(false);
  const [providerTestStates, setProviderTestStates] = useState<Record<string, ProviderTestState>>({});
  const [maintenanceSettings, setMaintenanceSettings] = useState<MaintenanceModeSettings>(DEFAULT_MAINTENANCE_MODE_SETTINGS);
  const [loadingMaintenanceSettings, setLoadingMaintenanceSettings] = useState(false);
  const [savingMaintenanceSettings, setSavingMaintenanceSettings] = useState(false);

  const handleTabChange = (tab: 'users' | 'departments' | 'all_records' | 'image_providers' | 'maintenance') => {
    setActiveTab(tab);
    const targetUrl = tab === 'users' ? '/admin/users' : `/admin/users?tab=${tab}`;
    router.replace(targetUrl);
  };

  // 自定义弹窗状态
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'alert' });

  const showAlert = (message: string, title = '提示') => {
    setDialogConfig({
      isOpen: true,
      title,
      message,
      type: 'alert',
      onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const showConfirm = (message: string, onConfirm: () => void, title = '确认操作') => {
    setDialogConfig({
      isOpen: true,
      title,
      message,
      type: 'confirm',
      onConfirm: () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      },
      onCancel: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    name: '',
    role: 'user',
    departmentId: ''
  });
  
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
          if (userData.role === 'admin' || userData.username === 'admin') {
            fetchUsers(userData.id);
            fetchDepartments();
          } else {
            router.push('/');
          }
        } else {
          router.push('/auth');
        }
      } catch {
        router.push('/auth');
      }
    };

    fetchUser();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
        
        // 默认展开顶层部门
        const rootDepts = data.filter((d: any) => !d.parentId);
        setExpandedDepts(new Set(rootDepts.map((d: any) => d.id)));
      }
    } catch (error) {
      console.error('获取部门列表失败:', error);
    }
  };

  const fetchUsers = async (requesterId: string) => {
    try {
      const response = await fetch(`/api/users?requesterId=${requesterId}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllHistories = async (page: number = 1) => {
    if (!user) return;
    setLoadingAllHistories(true);
    try {
      const offset = (page - 1) * historyLimit;
      const response = await fetch(`/api/history?requesterId=${user.id}&limit=${historyLimit}&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        setAllHistories(data.items);
        setTotalHistories(data.total);
      }
    } catch (error) {
      console.error('获取全量历史记录失败:', error);
    } finally {
      setLoadingAllHistories(false);
    }
  };

  const fetchProviderSettings = async () => {
    setLoadingProviderSettings(true);
    try {
      const response = await fetch('/api/admin/image-providers');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '获取供应商配置失败');
      }

      setProviderSettings({
        defaultProviderId: data.defaultProviderId || data.providers?.[0]?.id || null,
        providers: Array.isArray(data.providers) ? data.providers : [],
      });
    } catch (providerError: any) {
      showAlert(providerError.message || '获取供应商配置失败');
    } finally {
      setLoadingProviderSettings(false);
    }
  };

  const fetchMaintenanceSettings = async () => {
    setLoadingMaintenanceSettings(true);
    try {
      const response = await fetch('/api/admin/maintenance');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '获取维护模式配置失败');
      }

      setMaintenanceSettings({
        ...DEFAULT_MAINTENANCE_MODE_SETTINGS,
        ...data,
      });
    } catch (maintenanceError: any) {
      showAlert(maintenanceError.message || '获取维护模式配置失败');
    } finally {
      setLoadingMaintenanceSettings(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'all_records' && user?.role === 'admin') {
      fetchAllHistories(historyPage);
    }
  }, [activeTab, historyPage]);

  useEffect(() => {
    if (activeTab === 'image_providers' && user?.role === 'admin') {
      fetchProviderSettings();
    }
  }, [activeTab, user?.role]);

  useEffect(() => {
    if (activeTab === 'maintenance' && user?.role === 'admin') {
      fetchMaintenanceSettings();
    }
  }, [activeTab, user?.role]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'departments' || tab === 'all_records' || tab === 'image_providers' || tab === 'maintenance' || tab === 'users') {
      setActiveTab(tab);
    } else {
      setActiveTab('users');
    }
  }, [searchParams]);

  const updateProviderField = <K extends keyof ManagedImageProviderConfig>(
    providerId: string,
    key: K,
    value: ManagedImageProviderConfig[K]
  ) => {
    setProviderSettings((prev) => ({
      ...prev,
      providers: prev.providers.map((provider) =>
        provider.id === providerId ? { ...provider, [key]: value } : provider
      ),
    }));
  };

  const handleAddProvider = () => {
    setProviderSettings((prev) => {
      const nextProvider = createEmptyProvider(prev.providers.length);
      return {
        ...prev,
        defaultProviderId: prev.defaultProviderId || nextProvider.id,
        providers: [...prev.providers, nextProvider],
      };
    });
  };

  const handleRemoveProvider = (providerId: string) => {
    setProviderSettings((prev) => {
      const nextProviders = prev.providers.filter((provider) => provider.id !== providerId);
      return {
        defaultProviderId:
          prev.defaultProviderId === providerId ? nextProviders[0]?.id || null : prev.defaultProviderId,
        providers: nextProviders,
      };
    });
  };

  const handleSetDefaultProvider = (providerId: string) => {
    setProviderSettings((prev) => ({
      ...prev,
      defaultProviderId: providerId,
      providers: prev.providers.map((provider) => ({
        ...provider,
        isDefault: provider.id === providerId,
      })),
    }));
  };

  const handleSaveProviderSettings = async () => {
    if (providerSettings.providers.length === 0) {
      showAlert('请至少保留一个供应商配置');
      return;
    }

    setSavingProviderSettings(true);
    setSuccess('');
    setError('');

    try {
      const response = await fetch('/api/admin/image-providers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          defaultProviderId:
            providerSettings.defaultProviderId || providerSettings.providers.find((provider) => provider.isDefault)?.id || providerSettings.providers[0]?.id || null,
          providers: providerSettings.providers,
        } satisfies ImageProviderSettingsPayload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '保存供应商配置失败');
      }

      setProviderSettings(data);
      setSuccess('供应商配置已保存，前端切换列表会直接读取新配置');
    } catch (providerError: any) {
      setError(providerError.message || '保存供应商配置失败');
    } finally {
      setSavingProviderSettings(false);
    }
  };

  const handleTestProvider = async (provider: ManagedImageProviderConfig) => {
    setProviderTestStates((prev) => ({
      ...prev,
      [provider.id]: {
        loading: true,
        status: 'idle',
        message: '',
      },
    }));

    try {
      const response = await fetch('/api/admin/image-providers/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider }),
      });

      const data = await response.json();
      const success = response.ok && data.success;

      setProviderTestStates((prev) => ({
        ...prev,
        [provider.id]: {
          loading: false,
          status: success ? 'success' : 'error',
          message: data.message || (success ? '连通成功' : '连通失败'),
        },
      }));
    } catch (providerError: any) {
      setProviderTestStates((prev) => ({
        ...prev,
        [provider.id]: {
          loading: false,
          status: 'error',
          message: providerError?.message || '测试请求失败',
        },
      }));
    }
  };

  const handleSaveMaintenanceSettings = async () => {
    setSavingMaintenanceSettings(true);
    setSuccess('');
    setError('');

    try {
      const response = await fetch('/api/admin/maintenance', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(maintenanceSettings),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '保存维护模式配置失败');
      }

      setMaintenanceSettings({
        ...DEFAULT_MAINTENANCE_MODE_SETTINGS,
        ...data,
      });
      setSuccess(data.enabled ? '维护模式已开启，普通访问者现在会看到维护页' : '维护模式已关闭，站点已恢复访问');
    } catch (maintenanceError: any) {
      setError(maintenanceError.message || '保存维护模式配置失败');
    } finally {
      setSavingMaintenanceSettings(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requesterId: user.id,
          ...formData
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '创建失败');
      }

      setSuccess('用户创建成功');
      setFormData({
        username: '',
        password: '',
        email: '',
        name: '',
        role: 'user',
        departmentId: ''
      });
      
      setTimeout(() => {
        setShowCreateModal(false);
        setSuccess('');
        fetchUsers(user.id);
      }, 1500);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    showConfirm('确定要删除该用户吗？删除后该用户的所有历史记录也将被清除。', async () => {
      try {
        const response = await fetch(`/api/users?requesterId=${user.id}&userId=${userId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          fetchUsers(user.id);
        }
      } catch (error) {
        console.error('删除用户失败:', error);
      }
    });
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('登出失败:', err);
    }
    router.push('/auth');
  };

  const handleViewUserHistory = async (userData: any) => {
    setSelectedUser(userData);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    
    try {
      const response = await fetch(`/api/history?userId=${userData.id}`);
      if (response.ok) {
        const data = await response.json();
        setUserHistories(data);
      }
    } catch (error) {
      console.error('获取用户历史记录失败:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return formatDate(dateString);
  };

  const formatFullTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    setBackupMessage('');

    try {
      const response = await fetch('/api/backup');
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '备份失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `haipablo-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setBackupMessage('备份成功！请妥善保管备份文件。');
      setTimeout(() => setShowBackupModal(false), 2000);
    } catch (error: any) {
      setBackupMessage('备份失败: ' + error.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showConfirm('⚠️ 警告：恢复操作将覆盖所有现有数据！\n\n此操作不可逆，请确保已备份当前数据。\n\n确定要继续吗？', async () => {
      setRestoreLoading(true);
      setRestoreMessage('');

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/backup/restore', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || '恢复失败');
        }

        setRestoreSuccess(result);
        setRestoreMessage('恢复成功！');
        setTimeout(() => {
          setShowRestoreModal(false);
          fetchUsers(user.id);
        }, 3000);
      } catch (error: any) {
        setRestoreMessage('恢复失败: ' + error.message);
      } finally {
        setRestoreLoading(false);
        e.target.value = '';
      }
    });
  };

  const handleUpdateCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCreditsUser) return;
    
    setUpdatingCredits(true);
    try {
      const response = await fetch(`/api/users/${editingCreditsUser.id}/credits`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits: newCredits, requesterId: user.id })
      });
      
      if (response.ok) {
        setShowCreditsModal(false);
        fetchUsers(user.id);
      } else {
        const data = await response.json();
        alert(data.error || '更新失败');
      }
    } catch (error) {
      console.error('更新算力失败:', error);
      alert('更新算力失败');
    } finally {
      setUpdatingCredits(false);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoleUser) return;
    
    setUpdatingRole(true);
    try {
      const response = await fetch(`/api/users/${editingRoleUser.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole, requesterId: user.id })
      });
      
      if (response.ok) {
        setShowRoleModal(false);
        fetchUsers(user.id);
      } else {
        const data = await response.json();
        alert(data.error || '更新失败');
      }
    } catch (error) {
      console.error('更新角色失败:', error);
      alert('更新角色失败');
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    
    setProcessingDept(true);
    try {
      const response = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeptName.trim() })
      });
      
      if (response.ok) {
        setNewDeptName('');
        setShowCreateDeptModal(false);
        fetchDepartments();
      } else {
        alert('创建部门失败');
      }
    } catch (error) {
      console.error('创建部门失败:', error);
    } finally {
      setProcessingDept(false);
    }
  };

  const handleAllocateCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDepts.size === 0 || allocateAmount <= 0) return;
    
    setProcessingDept(true);
    try {
      const response = await fetch(`/api/departments/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          departmentIds: Array.from(selectedDepts), 
          amount: allocateAmount, 
          requesterId: user.id 
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setShowAllocateModal(false);
        fetchUsers(user.id);
        alert(data.message || '分配算力成功');
      } else {
        const data = await response.json();
        alert(data.error || '分配算力失败');
      }
    } catch (error) {
      console.error('分配算力失败:', error);
      alert('分配算力失败');
    } finally {
      setProcessingDept(false);
    }
  };

  const handleSyncDingTalk = async () => {
    showConfirm('即将从钉钉拉取最新部门架构和人员，这可能需要几秒钟的时间。确定继续吗？', async () => {
      setSyncingDingTalk(true);
      try {
        const response = await fetch('/api/dingtalk/sync', { method: 'POST' });
        const data = await response.json();
        
        if (response.ok) {
          showAlert(data.message || '同步成功');
          fetchDepartments();
          fetchUsers(user.id);
        } else {
          showAlert('同步失败: ' + (data.error || '未知错误'));
        }
      } catch (error) {
        console.error('同步钉钉失败:', error);
        showAlert('同步失败，请检查网络或控制台日志');
      } finally {
        setSyncingDingTalk(false);
      }
    });
  };

  // 树形结构相关方法
  const getDeptChildren = (parentId: string | null) => {
    return departments.filter(d => d.parentId === parentId);
  };

  // 递归计算部门总人数（包含子部门）
  const getDeptTotalUsers = (deptId: string): number => {
    // 1. 直属员工
    const directUsersCount = users.filter(u => u.departmentId === deptId).length;
    
    // 2. 子部门员工
    const children = getDeptChildren(deptId);
    let totalCount = directUsersCount;
    children.forEach(c => {
      totalCount += getDeptTotalUsers(c.id);
    });
    
    return totalCount;
  };

  const getAllDescendantIds = (deptId: string): string[] => {
    const children = getDeptChildren(deptId);
    let ids = children.map(c => c.id);
    children.forEach(c => {
      ids = [...ids, ...getAllDescendantIds(c.id)];
    });
    return ids;
  };

  const toggleExpand = (deptId: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  };

  const toggleSelect = (deptId: string) => {
    setSelectedDepts(prev => {
      const next = new Set(prev);
      const isSelected = next.has(deptId);
      const descendantIds = getAllDescendantIds(deptId);
      
      if (isSelected) {
        next.delete(deptId);
        descendantIds.forEach(id => next.delete(id));
      } else {
        next.add(deptId);
        descendantIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const renderDepartmentTree = (parentId: string | null = null, level: number = 0) => {
    const nodes = getDeptChildren(parentId);
    if (nodes.length === 0) return null;

    return (
      <div className="space-y-2">
        {nodes.map(dept => {
          const deptUsers = users.filter(u => u.departmentId === dept.id);
          const hasChildrenDepts = getDeptChildren(dept.id).length > 0;
          const hasContent = hasChildrenDepts || deptUsers.length > 0;
          const isExpanded = expandedDepts.has(dept.id);
          const isSelected = selectedDepts.has(dept.id);
          const totalUsersCount = getDeptTotalUsers(dept.id);
          
          return (
            <div key={dept.id} className="w-full">
              <div 
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  isSelected ? 'bg-violet-50 border-violet-200' : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                }`}
                style={{ marginLeft: `${level * 24}px` }}
              >
                <button 
                  onClick={() => hasContent && toggleExpand(dept.id)}
                  className={`p-1 rounded hover:bg-gray-200 transition-colors ${hasContent ? 'visible' : 'invisible'}`}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </button>

                <button 
                  onClick={() => toggleSelect(dept.id)}
                  className="flex items-center justify-center transition-colors"
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-violet-600" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                <div className="flex-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className={`w-4 h-4 ${isSelected ? 'text-violet-600' : 'text-gray-500'}`} />
                    <span className="font-medium text-gray-900">{dept.name}</span>
                    {dept.dingtalkDeptId && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full font-medium border border-blue-100 ml-2">
                        钉钉同步
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 font-medium">
                    {totalUsersCount} 人
                  </div>
                </div>
              </div>

              {isExpanded && hasContent && (
                <div className="mt-2 space-y-2">
                  {/* 先渲染部门下的人员 */}
                  {deptUsers.map(u => (
                    <div 
                      key={u.id} 
                      className="flex items-center justify-between p-2 rounded-lg border border-gray-50 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                      style={{ marginLeft: `${(level + 1) * 24}px` }}
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar user={u} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{u.name || u.username}</p>
                          <p className="text-xs text-gray-500">{u.email || u.username}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium text-gray-500">潮能力:</span>
                          <span className="text-sm font-bold text-violet-600">{u.credits}</span>
                        </div>
                        {u.lastLoginAt ? (
                          <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] rounded-full font-medium border border-green-100">
                            已激活
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] rounded-full font-medium border border-gray-200">
                            未登录
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* 再渲染子部门 */}
                  {renderDepartmentTree(dept.id, level + 1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50">
      {/* 弹窗组件 */}
      <AnimatePresence>
        {dialogConfig.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    dialogConfig.type === 'confirm' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{dialogConfig.title}</h3>
                </div>
                <p className="text-gray-600 whitespace-pre-wrap">{dialogConfig.message}</p>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3">
                {dialogConfig.type === 'confirm' && (
                  <button
                    onClick={dialogConfig.onCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    取消
                  </button>
                )}
                <button
                  onClick={dialogConfig.onConfirm}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                    dialogConfig.type === 'confirm' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  确定
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <header className="glass sticky top-0 z-50 border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center relative">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className="p-2 hover:bg-violet-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="hidden md:block">
              <h1 className="text-xl font-bold text-gray-900">用户管理</h1>
              <p className="text-xs text-gray-600">管理系统用户账号</p>
            </div>
          </div>

          {/* Centered Logo - Enlarged by 20% */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <img 
              src="/img/black.png" 
              alt="HAIPablo Logo" 
              className="h-14 object-contain cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => router.push('/')}
            />
          </div>

          <div className="flex-1 flex items-center justify-end gap-4">
            {user.role === 'admin' && (
              <>
                <button
                  onClick={() => setShowBackupModal(true)}
                  className="hidden lg:flex btn-primary items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <Download className="w-5 h-5" />
                  备份
                </button>

                <button
                  onClick={() => setShowRestoreModal(true)}
                  className="hidden lg:flex btn-primary items-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
                >
                  <Upload className="w-5 h-5" />
                  恢复
                </button>
              </>
            )}

            {user.role === 'admin' && (
              activeTab === 'users' ? (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">创建用户</span>
                </button>
              ) : activeTab === 'departments' ? (
                <button
                  onClick={() => setShowCreateDeptModal(true)}
                  className="btn-primary flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">新建组</span>
                </button>
              ) : null
            )}

            {activeTab === 'maintenance' && user.role === 'admin' && (
              <button
                onClick={handleSaveMaintenanceSettings}
                disabled={savingMaintenanceSettings || loadingMaintenanceSettings}
                className="btn-primary flex items-center gap-2 bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 py-1.5 px-4 text-sm disabled:opacity-50"
              >
                {savingMaintenanceSettings ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                保存维护设置
              </button>
            )}

            {activeTab === 'image_providers' && user.role === 'admin' && (
              <>
                <button
                  onClick={handleAddProvider}
                  className="btn-primary flex items-center gap-2 bg-white text-violet-700 border border-violet-200 hover:bg-violet-50 py-1.5 px-4 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  新增供应商
                </button>
                <button
                  onClick={handleSaveProviderSettings}
                  disabled={savingProviderSettings || loadingProviderSettings}
                  className="btn-primary flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 py-1.5 px-4 text-sm disabled:opacity-50"
                >
                  {savingProviderSettings ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  保存配置
                </button>
              </>
            )}

            {user && (
              <UserMenuDropdown
                user={user}
                isOpen={showUserMenu}
                onToggle={() => setShowUserMenu((prev) => !prev)}
                onClose={() => setShowUserMenu(false)}
                onHistory={() => router.push('/history')}
                onAdminUsers={() => router.push('/admin/users')}
                onLogout={handleLogout}
                activeItem="admin-users"
                canManage={user.role === 'admin' || user.role === 'sub_admin'}
                isAdmin={user.role === 'admin'}
                isSubAdmin={user.role === 'sub_admin'}
                manageLabel={user.role === 'admin' ? '用户与部门管理' : '人员列表'}
                avatarSize="lg"
                showTriggerName={true}
                showTriggerEmail={true}
              />
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-4 border-b border-gray-200 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-8">
            <button
              onClick={() => handleTabChange('users')}
              className={`pb-4 text-sm font-medium transition-colors relative ${
                activeTab === 'users' ? 'text-violet-600' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              人员列表
              {activeTab === 'users' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600"
                />
              )}
            </button>
            <button
              onClick={() => handleTabChange('departments')}
              className={`pb-4 text-sm font-medium transition-colors relative ${
                activeTab === 'departments' ? 'text-violet-600' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              组 / 部门列表
              {activeTab === 'departments' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600"
                />
              )}
            </button>
            {user.role === 'admin' && (
              <button
                onClick={() => handleTabChange('all_records')}
                className={`pb-4 text-sm font-medium transition-colors relative ${
                  activeTab === 'all_records' ? 'text-violet-600' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                全量记录
                {activeTab === 'all_records' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600"
                  />
                )}
              </button>
            )}
            {user.role === 'admin' && (
              <button
                onClick={() => handleTabChange('maintenance')}
                className={`pb-4 text-sm font-medium transition-colors relative ${
                  activeTab === 'maintenance' ? 'text-violet-600' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                维护模式
                {activeTab === 'maintenance' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600"
                  />
                )}
              </button>
            )}
            {user.role === 'admin' && (
              <button
                onClick={() => handleTabChange('image_providers')}
                className={`pb-4 text-sm font-medium transition-colors relative ${
                  activeTab === 'image_providers' ? 'text-violet-600' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                供应商配置
                {activeTab === 'image_providers' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600"
                  />
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 pb-2">
            {activeTab === 'users' && (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="搜索邮箱或名称..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field py-1.5 pl-9 pr-3 text-sm min-w-[200px] bg-white"
                  />
                </div>
                <select
                  value={selectedFilterDeptId}
                  onChange={(e) => setSelectedFilterDeptId(e.target.value)}
                  className="input-field py-1.5 px-3 text-sm min-w-[150px] bg-white"
                >
                  <option value="all">所有部门人员</option>
                  <option value="unassigned">未分配部门</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            {activeTab === 'departments' && selectedDepts.size > 0 && user.role === 'admin' && (
              <button
                onClick={() => {
                  setAllocateAmount(10);
                  setShowAllocateModal(true);
                }}
                className="btn-primary flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 py-1.5 px-4 text-sm"
              >
                <Shield className="w-4 h-4" />
                分配潮能力 ({selectedDepts.size})
              </button>
            )}

            {user.role === 'admin' && (
              <button
                onClick={handleSyncDingTalk}
                disabled={syncingDingTalk}
                className="btn-primary flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 py-1.5 px-4 text-sm disabled:opacity-50"
              >
                {syncingDingTalk ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
                )}
                同步
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-8">
        {activeTab === 'users' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users
              .filter(u => {
                if (selectedFilterDeptId === 'all') return true;
                if (selectedFilterDeptId === 'unassigned') return !u.departmentId;
                return u.departmentId === selectedFilterDeptId;
              })
              .filter(u => {
                if (!searchQuery.trim()) return true;
                const query = searchQuery.toLowerCase();
                return (
                  (u.name && u.name.toLowerCase().includes(query)) ||
                  (u.email && u.email.toLowerCase().includes(query)) ||
                  (u.username && u.username.toLowerCase().includes(query))
                );
              })
              .map((userData, index) => (
              <motion.div
                key={userData.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <UserAvatar user={userData} size="xl" className="bg-gray-50" />
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {userData.name || userData.username}
                    </h3>
                    <p className="text-sm text-gray-500">{userData.email || userData.username}</p>
                  </div>
                </div>
                
                {userData.role === 'admin' ? (
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    管理员
                  </span>
                ) : userData.role === 'sub_admin' ? (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    子管理员
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-violet-100 text-violet-700 text-xs font-medium rounded-full">
                    普通用户
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between mb-2">
                <div>
                  {userData.email && (
                    <p className="text-sm text-gray-600">
                      📧 {userData.email}
                    </p>
                  )}
                  {userData.departmentId && (
                    <p className="text-sm text-gray-600">
                      🏢 {departments.find(d => d.id === userData.departmentId)?.name || '未知部门'}
                    </p>
                  )}
                </div>
                {user.role === 'admin' && userData.id !== user.id && (
                  <button
                    onClick={() => {
                      setEditingRoleUser(userData);
                      setNewRole(userData.role);
                      setShowRoleModal(true);
                    }}
                    className="text-[10px] text-violet-600 hover:text-violet-700 font-medium bg-violet-50 hover:bg-violet-100 px-2 py-1 rounded transition-colors"
                  >
                    修改身份
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between bg-violet-50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-violet-700">{userData.credits ?? 0}</span>
                  <span className="text-xs text-violet-600 font-medium">潮能力</span>
                </div>
                {user.role === 'admin' && (
                  <button
                    onClick={() => {
                      setEditingCreditsUser(userData);
                      setNewCredits(userData.credits ?? 0);
                      setShowCreditsModal(true);
                    }}
                    className="text-xs bg-white text-violet-600 border border-violet-200 hover:bg-violet-100 px-3 py-1.5 rounded-md transition-colors font-medium"
                  >
                    充值/修改
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <button
                  onClick={() => handleViewUserHistory(userData)}
                  className="bg-violet-50 rounded-lg p-3 text-left hover:bg-violet-100 transition-colors group"
                >
                  <div className="flex items-center gap-2 text-violet-600 text-xs mb-1">
                    <Clock className="w-3 h-3" />
                    生成日志
                  </div>
                  <p className="text-lg font-bold text-violet-700 flex items-center justify-between">
                    {userData._count.histories} 条
                    <span className="text-xs font-normal opacity-0 group-hover:opacity-100 transition-opacity">
                      点击查看 →
                    </span>
                  </p>
                </button>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                    <Clock className="w-3 h-3" />
                    注册时间
                  </div>
                  <p className="text-xs font-medium text-gray-700">
                    {formatDate(userData.createdAt)}
                  </p>
                </div>
              </div>

              {userData.id !== user.id && user.role === 'admin' && userData.role !== 'admin' && (
                <button
                  onClick={() => handleDeleteUser(userData.id)}
                  className="w-full py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  删除用户
                </button>
              )}
            </motion.div>
          ))}
          </div>
        ) : activeTab === 'departments' ? (
          departments.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">部门架构</h3>
                  <p className="text-sm text-gray-500">勾选部门可以批量为部门下的所有人员分配潮能力</p>
                </div>
              </div>
              
              {/* 树状结构渲染 */}
              <div className="max-w-3xl">
                {renderDepartmentTree(null)}
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-violet-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无部门 / 组信息</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                目前系统还没有任何部门数据。你可以手动点击右上角的“新建组”来创建，或者等待用户通过钉钉登录时系统自动同步。
              </p>
              <button
                onClick={() => setShowCreateDeptModal(true)}
                className="btn-primary inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Plus className="w-5 h-5" />
                新建组
              </button>
            </div>
          )
        ) : activeTab === 'maintenance' ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-fuchsia-100 bg-[linear-gradient(135deg,rgba(250,232,255,0.9),rgba(255,255,255,1),rgba(237,233,254,0.92))] p-6">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-semibold text-fuchsia-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    全站维护模式
                  </div>
                  <h3 className="mt-3 text-xl font-semibold text-gray-900">前端一键切换维护页</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                    开启后，普通访问者会直接看到统一维护页；管理员可继续访问站点和后台，便于你在维护期间继续调整配置或排查问题。
                  </p>
                </div>
                <div className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
                  maintenanceSettings.enabled
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}>
                  <p className="font-semibold">{maintenanceSettings.enabled ? '当前已开启维护模式' : '当前为正常访问状态'}</p>
                  <p className="mt-1 text-xs opacity-80">
                    {maintenanceSettings.updatedByName
                      ? `最近操作人：${maintenanceSettings.updatedByName}`
                      : '尚未记录维护操作'}
                  </p>
                </div>
              </div>
            </div>

            {loadingMaintenanceSettings ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">正在加载维护模式配置...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">维护页文案</h4>
                      <p className="mt-1 text-sm text-gray-500">这里修改的标题与说明会实时用于全站维护页展示。</p>
                    </div>
                    <label className="flex items-center gap-3 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-4 py-2 text-sm font-medium text-fuchsia-700">
                      <span>{maintenanceSettings.enabled ? '已开启' : '已关闭'}</span>
                      <input
                        type="checkbox"
                        checked={maintenanceSettings.enabled}
                        onChange={(e) => setMaintenanceSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
                        className="h-4 w-4 rounded border-fuchsia-300 text-fuchsia-600 focus:ring-fuchsia-500"
                      />
                    </label>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-600">维护标题</label>
                      <input
                        value={maintenanceSettings.title}
                        onChange={(e) => setMaintenanceSettings((prev) => ({ ...prev, title: e.target.value }))}
                        className="input-field bg-white"
                        placeholder="例如：系统维护中"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-600">维护说明</label>
                      <textarea
                        value={maintenanceSettings.message}
                        onChange={(e) => setMaintenanceSettings((prev) => ({ ...prev, message: e.target.value }))}
                        className="input-field min-h-[160px] resize-y bg-white"
                        placeholder="例如：我们正在进行系统升级与稳定性维护，请稍后再试。"
                      />
                    </div>
                    <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                      <div>
                        <div className="font-medium text-gray-900">允许管理员绕过维护页</div>
                        <div className="mt-1 text-xs text-gray-500">开启后，管理员登录态下仍可进入前台与后台页面。</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={maintenanceSettings.allowAdminBypass}
                        onChange={(e) => setMaintenanceSettings((prev) => ({ ...prev, allowAdminBypass: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                      />
                    </label>
                  </div>
                </div>

                <div className="bg-gray-950 rounded-2xl border border-gray-900 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.3)]">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-fuchsia-100">
                    PREVIEW
                  </div>
                  <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.3),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,1))] p-6 text-white">
                    <div className="flex items-center gap-3">
                      <img src="/img/white.png" alt="HAIPablo" className="h-10 object-contain" />
                      <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
                    </div>
                    <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.24em] text-fuchsia-100">
                      SYSTEM MAINTENANCE
                    </div>
                    <h4 className="mt-6 text-3xl font-semibold leading-tight text-white">
                      {maintenanceSettings.title || DEFAULT_MAINTENANCE_MODE_SETTINGS.title}
                    </h4>
                    <p className="mt-4 text-sm leading-7 text-slate-200">
                      {maintenanceSettings.message || DEFAULT_MAINTENANCE_MODE_SETTINGS.message}
                    </p>
                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">显示状态</div>
                        <div className="mt-1 text-sm font-semibold text-emerald-300">
                          {maintenanceSettings.enabled ? '维护进行中' : '站点正常开放'}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">管理员访问</div>
                        <div className="mt-1 text-sm font-semibold text-slate-100">
                          {maintenanceSettings.allowAdminBypass ? '允许绕过' : '同样受限'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'image_providers' ? (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 rounded-2xl border border-violet-100 p-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                    <Settings2 className="w-3.5 h-3.5" />
                    图像供应商控制台
                  </div>
                  <h3 className="mt-3 text-xl font-semibold text-gray-900">可视化管理生成供应商</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                    这里配置的供应商会直接同步到前台的“生成供应商”下拉框。你可以配置建一帆兼容通道，也可以新增标准 OpenAI 接口风格的 `gpt-image-2` 供应商。
                  </p>
                </div>
                <div className="rounded-2xl border border-violet-100 bg-white/90 px-4 py-3 text-sm text-gray-600 shadow-sm">
                  <p>
                    当前默认供应商：
                    <span className="ml-2 font-semibold text-violet-700">
                      {providerSettings.providers.find((provider) => provider.id === providerSettings.defaultProviderId)?.label || '未设置'}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    保存后，单图页和批量页会立即读取新配置。
                  </p>
                </div>
              </div>
            </div>

            {loadingProviderSettings ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">正在加载供应商配置...</p>
              </div>
            ) : providerSettings.providers.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <Settings2 className="w-10 h-10 text-violet-300 mx-auto mb-3" />
                <h4 className="text-lg font-semibold text-gray-900">还没有供应商配置</h4>
                <p className="mt-2 text-sm text-gray-500">点击右上角“新增供应商”，先添加一个可用通道。</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {providerSettings.providers.map((provider, index) => (
                  <div key={provider.id} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-semibold text-gray-900">{provider.label || `供应商 ${index + 1}`}</h4>
                          {provider.id === providerSettings.defaultProviderId && (
                            <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-medium">
                              默认
                            </span>
                          )}
                          {!provider.enabled && (
                            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                              已禁用
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">供应商 ID：{provider.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTestProvider(provider)}
                          disabled={providerTestStates[provider.id]?.loading}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 transition-colors disabled:opacity-50"
                        >
                          {providerTestStates[provider.id]?.loading ? '测试中...' : '测试连通性'}
                        </button>
                        <button
                          onClick={() => handleSetDefaultProvider(provider.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            provider.id === providerSettings.defaultProviderId
                              ? 'bg-violet-100 text-violet-700'
                              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          设为默认
                        </button>
                        <button
                          onClick={() =>
                            showConfirm(`确定删除供应商“${provider.label}”吗？`, () => handleRemoveProvider(provider.id), '删除供应商')
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-600">显示名称</label>
                        <input
                          value={provider.label}
                          onChange={(e) => updateProviderField(provider.id, 'label', e.target.value)}
                          className="input-field bg-white"
                          placeholder="例如：OpenAI 标准"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-600">供应商 ID</label>
                        <input
                          value={provider.id}
                          onChange={(e) => updateProviderField(provider.id, 'id', e.target.value)}
                          className="input-field bg-white"
                          placeholder="例如：openai_std"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-600">接口类型</label>
                        <select
                          value={provider.kind}
                          onChange={(e) => updateProviderField(provider.id, 'kind', e.target.value as ManagedImageProviderConfig['kind'])}
                          className="input-field bg-white"
                        >
                          <option value="openai_compatible">标准 OpenAI</option>
                          <option value="legacy_jyf">建一帆兼容</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-600">模型名</label>
                        <input
                          value={provider.model}
                          onChange={(e) => updateProviderField(provider.id, 'model', e.target.value)}
                          className="input-field bg-white"
                          placeholder="gpt-image-2"
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <label className="mb-1.5 block text-xs font-medium text-gray-600">Base URL</label>
                        <input
                          value={provider.baseUrl}
                          onChange={(e) => updateProviderField(provider.id, 'baseUrl', e.target.value)}
                          className="input-field bg-white"
                          placeholder="https://api.openai.com"
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <label className="mb-1.5 block text-xs font-medium text-gray-600">API Key</label>
                        <input
                          type="password"
                          value={provider.apiKey}
                          onChange={(e) => updateProviderField(provider.id, 'apiKey', e.target.value)}
                          className="input-field bg-white"
                          placeholder="sk-..."
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-600">超时毫秒</label>
                        <input
                          type="number"
                          min={1000}
                          value={provider.timeoutMs}
                          onChange={(e) => updateProviderField(provider.id, 'timeoutMs', Number(e.target.value))}
                          className="input-field bg-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-600">失败重试次数</label>
                        <input
                          type="number"
                          min={0}
                          value={provider.maxRetries}
                          onChange={(e) => updateProviderField(provider.id, 'maxRetries', Number(e.target.value))}
                          className="input-field bg-white"
                        />
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        <span>启用此供应商</span>
                        <input
                          type="checkbox"
                          checked={provider.enabled}
                          onChange={(e) => updateProviderField(provider.id, 'enabled', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                        />
                      </label>
                      <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        <span>支持编辑接口</span>
                        <input
                          type="checkbox"
                          checked={provider.supportsEdit}
                          onChange={(e) => updateProviderField(provider.id, 'supportsEdit', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                        />
                      </label>
                    </div>

                    {providerTestStates[provider.id]?.message && (
                      <div
                        className={`mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                          providerTestStates[provider.id]?.status === 'success'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                        }`}
                      >
                        {providerTestStates[provider.id]?.status === 'success' ? (
                          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        ) : (
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        )}
                        <p>{providerTestStates[provider.id]?.message}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">全量生成记录</h3>
                <p className="text-sm text-gray-500">查看系统所有用户的生成历史和请求详情</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-500">
                  共 <span className="font-bold text-violet-600">{totalHistories}</span> 条记录
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    disabled={historyPage === 1 || loadingAllHistories}
                    className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 rotate-180" />
                  </button>
                  <span className="text-sm font-medium w-12 text-center">
                    {historyPage} / {Math.ceil(totalHistories / historyLimit) || 1}
                  </span>
                  <button
                    onClick={() => setHistoryPage(p => p + 1)}
                    disabled={historyPage >= Math.ceil(totalHistories / historyLimit) || loadingAllHistories}
                    className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">时间 / 用户</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">模版 / 状态</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">提示词 (Prompt)</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">生成结果</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingAllHistories ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">正在加载记录...</p>
                      </td>
                    </tr>
                  ) : allHistories.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <History className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">暂无生成记录</p>
                      </td>
                    </tr>
                  ) : (
                    allHistories.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2">
                            <span className="text-xs text-gray-400 font-mono">
                              {formatFullTime(item.createdAt)}
                            </span>
                            <div className="flex items-center gap-2">
                              <UserAvatar user={item.user} size="sm" />
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900">{item.user?.name || item.user?.username}</span>
                                <span className="text-[10px] text-gray-400">{item.user?.email || '无邮箱'}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            <span className="px-2 py-0.5 bg-violet-50 text-violet-600 text-[10px] rounded-full font-medium border border-violet-100 w-fit">
                              {item.templateName || '未命名模版'}
                            </span>
                            <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium border w-fit ${
                              item.status === 'success' 
                                ? 'bg-green-50 text-green-600 border-green-100' 
                                : 'bg-red-50 text-red-600 border-red-100'
                            }`}>
                              {item.status === 'success' ? '生成成功' : '生成失败'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600 line-clamp-2 max-w-md" title={item.prompt}>
                            {item.prompt}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {item.thumbnailUrl || item.outputImageUrl ? (
                            <div className="inline-block relative group">
                              <img 
                                src={item.thumbnailUrl || item.outputImageUrl} 
                                alt="生成结果" 
                                className="w-12 h-12 rounded-lg object-cover border border-gray-100 shadow-sm group-hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => window.open(item.outputImageUrl, '_blank')}
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center pointer-events-none">
                                <ImageIcon className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">无图片</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">创建新用户</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    用户名 *
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="input-field"
                    placeholder="请输入用户名"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    密码 *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input-field"
                    placeholder="请输入密码"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    昵称
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="请输入昵称"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    邮箱
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                    placeholder="请输入邮箱"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    用户角色
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="input-field"
                  >
                    <option value="user">普通用户</option>
                    <option value="sub_admin">子管理员</option>
                    <option value="admin">系统管理员</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    所属部门
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="input-field"
                  >
                    <option value="">-- 不分配部门 --</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </motion.div>
                  )}
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {success}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={creating}
                  className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      创建用户
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreditsModal && editingCreditsUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreditsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">修改潮能力</h2>
                <button
                  onClick={() => setShowCreditsModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                正在为用户 <span className="font-semibold text-gray-900">{editingCreditsUser.name || editingCreditsUser.username}</span> 修改潮能力。
              </p>

              <form onSubmit={handleUpdateCredits} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    潮能力数量
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newCredits}
                    onChange={(e) => setNewCredits(parseInt(e.target.value) || 0)}
                    className="input-field"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={updatingCredits}
                  className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {updatingCredits ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    '保存修改'
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRoleModal && editingRoleUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowRoleModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">修改用户身份</h2>
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                正在为用户 <span className="font-semibold text-gray-900">{editingRoleUser.name || editingRoleUser.username}</span> 修改身份权限。
              </p>

              <form onSubmit={handleUpdateRole} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择新身份
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="input-field"
                    required
                  >
                    <option value="user">普通用户</option>
                    <option value="sub_admin">子管理员 (可管理模板)</option>
                    <option value="admin">系统管理员 (全权限)</option>
                  </select>
                </div>

                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                  <p className="text-xs text-amber-700 leading-relaxed">
                    💡 提示：管理员拥有最高权限，子管理员仅拥有模板和功能管理权限。请谨慎分配高权限角色。
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={updatingRole}
                  className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {updatingRole ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    '确认修改'
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateDeptModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateDeptModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">新建组</h2>
                <button
                  onClick={() => setShowCreateDeptModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleCreateDepartment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    组名称 *
                  </label>
                  <input
                    type="text"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="input-field"
                    placeholder="请输入组名称"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={processingDept}
                  className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {processingDept ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      创建组
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAllocateModal && selectedDepts.size > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAllocateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">分配潮能力</h2>
                <button
                  onClick={() => setShowAllocateModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                将为选中的 <span className="font-bold text-violet-600">{selectedDepts.size}</span> 个部门及下属部门的所有成员分配相同的潮能力数量。
              </p>

              <form onSubmit={handleAllocateCredits} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    分配数量 (每个成员)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={allocateAmount}
                    onChange={(e) => setAllocateAmount(parseInt(e.target.value) || 0)}
                    className="input-field"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={processingDept}
                  className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processingDept ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      分配中...
                    </>
                  ) : (
                    '确认分配'
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistoryModal && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowHistoryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    selectedUser.role === 'admin' 
                      ? 'bg-gradient-to-br from-amber-500 to-orange-500' 
                      : 'bg-gradient-to-br from-violet-600 to-purple-600'
                  }`}>
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedUser.name || selectedUser.username} 的生成日志
                    </h2>
                    <p className="text-sm text-gray-500">
                      共 {userHistories.length} 条记录
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                  </div>
                ) : userHistories.length > 0 ? (
                  <div className="space-y-4">
                    {userHistories.map((history: any) => (
                      <div
                        key={history.id}
                        className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          {history.outputImageUrl ? (
                            <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                              <img
                                src={history.outputImageUrl}
                                alt={history.templateName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <ImageIcon className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900 truncate">
                                {history.templateName}
                              </h3>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                  history.creditsUsed > 0 
                                    ? 'bg-violet-100 text-violet-700' 
                                    : 'bg-gray-100 text-gray-500'
                                }`}>
                                  消耗 {history.creditsUsed ?? (history.status === 'success' ? 1 : 0)} 潮能力
                                </span>
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                  history.status === 'success'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {history.status === 'success' ? '成功' : '失败'}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                              {history.prompt}
                            </p>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-gray-400">
                                {formatRelativeTime(history.createdAt)}
                              </p>
                              <p className="text-[10px] text-gray-300">
                                {formatFullTime(history.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500">暂无生成记录</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBackupModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowBackupModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                    <Database className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">备份数据</h2>
                    <p className="text-sm text-gray-500">导出所有配置和数据</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBackupModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 mb-4 border border-green-200">
                <h3 className="font-medium text-green-800 mb-2">备份内容包含：</h3>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• 所有用户账号和权限</li>
                  <li>• 所有功能组和模板配置</li>
                  <li>• 所有项目设置</li>
                  <li>• 所有生成历史记录</li>
                  <li>• 系统设置</li>
                </ul>
              </div>

              {backupMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-lg text-sm mb-4 ${
                    backupLoading ? 'bg-blue-50 border border-blue-200 text-blue-700' : 'bg-green-50 border border-green-200 text-green-700'
                  }`}
                >
                  {backupMessage}
                </motion.div>
              )}

              <button
                onClick={handleBackup}
                disabled={backupLoading}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {backupLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    正在生成备份文件...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    下载备份文件
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center mt-3">
                💡 建议定期备份，并将备份文件保存在安全的位置
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRestoreModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowRestoreModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">恢复数据</h2>
                    <p className="text-sm text-gray-500">从备份文件导入数据</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRestoreModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 mb-4 border border-amber-200">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <h3 className="font-medium text-amber-800">重要警告：</h3>
                </div>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• 恢复操作将覆盖所有现有数据</li>
                  <li>• 此操作不可逆</li>
                  <li>• 建议先备份当前数据</li>
                </ul>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleRestore}
                className="hidden"
                id="restore-file-input"
              />

              <label
                htmlFor="restore-file-input"
                className="block w-full py-8 border-2 border-dashed border-gray-300 rounded-xl text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-all"
              >
                {restoreLoading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-orange-600 animate-spin mb-2" />
                    <span className="text-sm text-gray-600">正在恢复数据...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">点击选择备份文件</span>
                    <span className="text-xs text-gray-500 mt-1">仅支持 .json 格式</span>
                  </div>
                )}
              </label>

              {restoreMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-lg text-sm mt-4 ${
                    restoreSuccess 
                      ? 'bg-green-50 border border-green-200 text-green-700' 
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  {restoreMessage}
                  {restoreSuccess && (
                    <div className="mt-2 text-xs space-y-1">
                      <p>✅ 用户：{restoreSuccess.restored.users} 个</p>
                      <p>✅ 功能组：{restoreSuccess.restored.featureGroups} 个</p>
                      <p>✅ 模板：{restoreSuccess.restored.templates} 个</p>
                      <p>✅ 项目：{restoreSuccess.restored.projects} 个</p>
                    </div>
                  )}
                </motion.div>
              )}

              <p className="text-xs text-gray-500 text-center mt-3">
                ⚠️ 恢复后请刷新页面查看最新数据
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={null}>
      <AdminUsersPageContent />
    </Suspense>
  );
}

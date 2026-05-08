'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
  Search
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

export default function AdminUsersPage() {
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
  const [editingCreditsUser, setEditingCreditsUser] = useState<UserData | null>(null);
  const [newCredits, setNewCredits] = useState<number>(0);
  const [updatingCredits, setUpdatingCredits] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [restoreMessage, setRestoreMessage] = useState('');
  const [restoreSuccess, setRestoreSuccess] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<'users' | 'departments'>('users');
  const [showCreateDeptModal, setShowCreateDeptModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedDept, setSelectedDept] = useState<any>(null);
  const [newDeptName, setNewDeptName] = useState('');
  const [allocateAmount, setAllocateAmount] = useState<number>(10);
  const [processingDept, setProcessingDept] = useState(false);
  const [syncingDingTalk, setSyncingDingTalk] = useState(false);
  const [selectedFilterDeptId, setSelectedFilterDeptId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());

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
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUser(user);
      if (user.role === 'admin' || user.username === 'admin') {
        fetchUsers(user.id);
        fetchDepartments();
      } else {
        router.push('/');
      }
    } else {
      router.push('/auth');
    }
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

  const handleLogout = () => {
    localStorage.removeItem('user');
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
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-violet-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{u.name || u.username}</p>
                          <p className="text-xs text-gray-500">@{u.username}</p>
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
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className="p-2 hover:bg-violet-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
              <p className="text-sm text-gray-600">管理系统用户账号</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowBackupModal(true)}
              className="btn-primary flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <Download className="w-5 h-5" />
              备份
            </button>

            <button
              onClick={() => setShowRestoreModal(true)}
              className="btn-primary flex items-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
            >
              <Upload className="w-5 h-5" />
              恢复
            </button>

            {activeTab === 'users' ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                创建用户
              </button>
            ) : (
              <button
                onClick={() => setShowCreateDeptModal(true)}
                className="btn-primary flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Plus className="w-5 h-5" />
                新建组
              </button>
            )}

            {user && (
              <div className="relative user-menu-container">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-gray-900">{user.name || user.username}</p>
                    <p className="text-xs text-gray-500">@{user.username}</p>
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
                      <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{user.name || user.username}</p>
                            <p className="text-xs text-gray-500">@{user.username}</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1 w-fit">
                            <Shield className="w-3 h-3" />
                            管理员
                          </span>
                        </div>
                      </div>

                      <div className="p-2">
                        <button
                          onClick={() => router.push('/history')}
                          className="w-full px-4 py-2.5 text-left text-gray-700 hover:bg-violet-50 hover:text-violet-600 rounded-lg transition-colors flex items-center gap-3"
                        >
                          <History className="w-4 h-4" />
                          我的历史
                        </button>

                        <button
                          onClick={() => router.push('/admin/users')}
                          className="w-full px-4 py-2.5 text-left text-amber-700 bg-amber-50 rounded-lg flex items-center gap-3 mt-1"
                        >
                          <Users className="w-4 h-4" />
                          用户与部门管理
                        </button>

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

      <div className="max-w-7xl mx-auto px-6 py-4 border-b border-gray-200 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('users')}
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
              onClick={() => setActiveTab('departments')}
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

            {activeTab === 'departments' && selectedDepts.size > 0 && (
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
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    userData.role === 'admin' 
                      ? 'bg-gradient-to-br from-amber-500 to-orange-500' 
                      : 'bg-gradient-to-br from-violet-600 to-purple-600'
                  }`}>
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {userData.name || userData.username}
                    </h3>
                    <p className="text-sm text-gray-500">@{userData.username}</p>
                  </div>
                </div>
                
                {userData.role === 'admin' ? (
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    管理员
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-violet-100 text-violet-700 text-xs font-medium rounded-full">
                    普通用户
                  </span>
                )}
              </div>

              {userData.email && (
                <p className="text-sm text-gray-600 mb-2">
                  📧 {userData.email}
                </p>
              )}

              {userData.departmentId && (
                <p className="text-sm text-gray-600 mb-2">
                  🏢 部门: {departments.find(d => d.id === userData.departmentId)?.name || '未知'}
                </p>
              )}

              <div className="flex items-center justify-between bg-violet-50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-violet-700">{userData.credits ?? 0}</span>
                  <span className="text-xs text-violet-600 font-medium">潮能力</span>
                </div>
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

              {userData.id !== user.id && userData.role !== 'admin' && (
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
        ) : departments.length > 0 ? (
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
                    <option value="admin">管理员</option>
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
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900 truncate">
                                {history.templateName}
                              </h3>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                history.status === 'success'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {history.status === 'success' ? '成功' : '失败'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                              {history.prompt}
                            </p>
                            <p className="text-xs text-gray-400">
                              {formatRelativeTime(history.createdAt)}
                            </p>
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

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FolderKanban, Plus, Clock, CheckCircle, Loader2 } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  clientName: string | null;
  eventName: string | null;
  city: string | null;
  brandName: string | null;
  status: string;
  createdAt: string;
  _count: {
    assets: number;
    jobs: number;
  };
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error('获取项目列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = () => {
    router.push('/projects/new');
  };

  const handleProjectClick = (id: string) => {
    router.push(`/projects/${id}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button 
            onClick={() => router.push('/')}
            className="p-2 hover:bg-violet-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">项目管理</h1>
            <p className="text-sm text-gray-600">管理和查看你的创作项目</p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Actions */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">所有项目</h2>
            <p className="text-gray-600">共 {projects.length} 个项目</p>
          </div>
          <button 
            onClick={handleCreateProject}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            新建项目
          </button>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
          </div>
        ) : projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                onClick={() => handleProjectClick(project.id)}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:border-violet-300 transition-all duration-300 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                    <FolderKanban className="w-6 h-6 text-violet-600" />
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    project.status === 'active' 
                      ? 'bg-green-100 text-green-700' 
                      : project.status === 'draft'
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {project.status === 'active' ? '进行中' : project.status === 'draft' ? '草稿' : '已归档'}
                  </div>
                </div>

                <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-violet-600 transition-colors">
                  {project.name}
                </h3>

                {project.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {project.description}
                  </p>
                )}

                <div className="space-y-2 mb-4">
                  {project.clientName && (
                    <div className="text-sm text-gray-500">
                      <span className="font-medium">客户:</span> {project.clientName}
                    </div>
                  )}
                  {project.eventName && (
                    <div className="text-sm text-gray-500">
                      <span className="font-medium">活动:</span> {project.eventName}
                    </div>
                  )}
                  {project.city && (
                    <div className="text-sm text-gray-500">
                      <span className="font-medium">城市:</span> {project.city}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{project._count.assets} 个素材</span>
                    <span>{project._count.jobs} 个任务</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>{formatDate(project.createdAt)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FolderKanban className="w-10 h-10 text-violet-600" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">暂无项目</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              创建你的第一个项目，开始使用 AI 视觉生成工作台
            </p>
            <button 
              onClick={handleCreateProject}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              新建项目
            </button>
          </div>
        )}
      </div>
    </div>
  );
}



'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Upload,
  Sparkles,
  Loader2,
  CheckCircle,
  XCircle,
  Download,
  Image as ImageIcon,
  RotateCcw,
  Info,
  Eye,
  X,
  Layers,
  Archive,
  RefreshCw
} from 'lucide-react';
import { SIZE_OPTIONS, QUALITY_OPTIONS } from '@/lib/types';

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
}

interface TemplateCardState {
  template: Template;
  formData: Record<string, string>;
  enableUserPrompt: boolean;
  userPromptPriority: boolean;
  userPrompt: string;
  result: any;
  generating: boolean;
  error: string;
  generationStatus: string;
}

export default function BatchGeneratePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateIdsParam = searchParams.get('templateIds');
  const templateIds = templateIdsParam ? JSON.parse(decodeURIComponent(templateIdsParam)) : [];
  const [user, setUser] = useState<any>(null);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [kvImage, setKvImage] = useState<{ id: string; url: string; name: string } | null>(null);
  const [uploadingKv, setUploadingKv] = useState(false);
  const [cards, setCards] = useState<TemplateCardState[]>([]);
  const [size, setSize] = useState('auto');
  const [quality, setQuality] = useState('medium');
  const [allGenerated, setAllGenerated] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // 预览图片缩放和拖拽状态
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      // Fetch latest user data for credits
      fetch(`/api/users?requesterId=${parsedUser.id}`)
        .then(res => res.json())
        .then(users => {
          if (Array.isArray(users)) {
            const me = users.find((u: any) => u.id === parsedUser.id);
            if (me) {
              const updatedUser = { ...parsedUser, credits: me.credits };
              setUser(updatedUser);
              localStorage.setItem('user', JSON.stringify(updatedUser));
            }
          }
        })
        .catch(console.error);
    }
    
    if (templateIds.length > 0 && !hasFetched.current) {
      hasFetched.current = true;
      fetchTemplates();
    }
  }, []);

  useEffect(() => {
    if (!hasFetched.current && templateIds.length > 0) {
      hasFetched.current = true;
      fetchTemplates();
    }
  }, [templateIds]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const promises = templateIds.map((id: string) => 
        fetch(`/api/templates/${id}`).then(res => res.json())
      );
      const results = await Promise.all(promises);
      const validResults = results.filter(r => r && r.id);
      setTemplates(validResults);

      const initialCards: TemplateCardState[] = validResults.map((template: Template) => ({
        template,
        formData: template.variables?.reduce((acc: Record<string, string>, v: any) => {
          acc[v.key] = '';
          return acc;
        }, {}) || {},
        enableUserPrompt: template.allowUserPrompt !== false,
        userPromptPriority: template.userPromptPriorityDefault || false,
        userPrompt: '',
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

  const handleKvImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingKv(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('上传失败');

      const data = await response.json();
      setKvImage({
        id: `kv_${Date.now()}`,
        url: data.url,
        name: file.name
      });
    } catch (error) {
      console.error('上传失败:', error);
      alert('图片上传失败');
    } finally {
      setUploadingKv(false);
    }
  };

  const handleRemoveKvImage = () => {
    setKvImage(null);
  };

  const handleCardFormChange = (index: number, key: string, value: string) => {
    setCards(prev => prev.map((card, i) => 
      i === index ? { ...card, formData: { ...card.formData, [key]: value } } : card
    ));
  };

  const getRenderedPrompt = (card: TemplateCardState) => {
    if (!card.template.promptTemplate) return '';
    
    let prompt = card.template.promptTemplate;
    for (const [key, value] of Object.entries(card.formData)) {
      if (value) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        prompt = prompt.replace(regex, value);
      }
    }
    
    if (card.enableUserPrompt && card.userPrompt.trim()) {
      if (card.userPromptPriority) {
        prompt = card.userPrompt.trim() + '\n\n' + prompt;
      } else {
        prompt = prompt + '\n\n' + card.userPrompt.trim();
      }
    }
    
    return prompt;
  };

  const handleGenerateSingle = async (index: number) => {
    const card = cards[index];

    if (!kvImage) {
      setCards(prev => prev.map((c, i) => 
        i === index ? { ...c, error: '请上传主视觉图片' } : c
      ));
      return;
    }

    const renderedPrompt = getRenderedPrompt(card);
    if (!renderedPrompt || !renderedPrompt.trim()) {
      setCards(prev => prev.map((c, i) => 
        i === index ? { ...c, error: '模板缺少提示词，请联系管理员检查模板配置' } : c
      ));
      return;
    }

    setCards(prev => prev.map((c, i) => 
      i === index ? { ...c, generating: true, error: '', result: null, generationStatus: '正在生成...' } : c
    ));

    try {
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
        referenceImages: card.template.referenceImages ? card.template.referenceImages.map((img: any) => img.url) : [],
        images: [kvImage.url],
        userPrompt: card.enableUserPrompt ? card.userPrompt : null,
        userPromptPriority: card.userPromptPriority
      };

      console.log('=== 批量发送生成请求 ===');
      console.log('请求数据:', JSON.stringify(requestData, null, 2));

      const response = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCards(prev => prev.map((c, i) => 
          i === index ? { ...c, generating: false, generationStatus: '', result: data } : c
        ));
      } else {
        setCards(prev => prev.map((c, i) => 
          i === index ? { ...c, generating: false, generationStatus: '', error: data.message || data.error || '生成失败' } : c
        ));
      }

      checkAllGenerated();
    } catch (error: any) {
      console.error('生成失败:', error);
      setCards(prev => prev.map((c, i) => 
        i === index ? { ...c, generating: false, generationStatus: '', error: '网络错误：' + (error.message || '请检查网络连接') } : c
      ));
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

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const generateWithDelay = async (index: number) => {
      setBatchProgress(prev => ({ ...prev, current: index + 1 }));
      if (index > 0) {
        const randomDelay = Math.floor(Math.random() * 5000) + 5000;
        await delay(randomDelay);
      }
      await handleGenerateSingle(index);
    };

    await Promise.all(cards.map((_, index) => generateWithDelay(index)));

    setBatchGenerating(false);
    
    // 生成结束后更新一下最新的算力
    if (user) {
      fetch(`/api/users?requesterId=${user.id}`)
        .then(res => res.json())
        .then(users => {
          if (Array.isArray(users)) {
            const me = users.find((u: any) => u.id === user.id);
            if (me) {
              const updatedUser = { ...user, credits: me.credits };
              setUser(updatedUser);
              localStorage.setItem('user', JSON.stringify(updatedUser));
            }
          }
        })
        .catch(console.error);
    }
  };

  const checkAllGenerated = () => {
    const allDone = cards.every(card => card.result !== null);
    setAllGenerated(allDone);
  };

  const handleRegenerateSingle = (index: number) => {
    setCards(prev => prev.map((c, i) => 
      i === index ? { ...c, result: null, error: '' } : c
    ));
    handleGenerateSingle(index);
  };

  const handleDownloadSingle = (card: TemplateCardState) => {
    if (card.result?.imageUrl) {
      const link = document.createElement('a');
      link.href = card.result.imageUrl;
      link.download = `${card.template.name}_${Date.now()}.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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

  const handleBatchDownload = async () => {
    const generatedCards = cards.filter(card => card.result?.imageUrl);
    
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
          images: generatedCards.map(card => ({
            url: card.result.imageUrl,
            name: card.template.name
          }))
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `批量生成_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        alert(data.message || '下载失败，请重试');
      }
    } catch (error) {
      console.error('批量下载失败:', error);
      alert('批量下载失败，请重试');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-violet-600 mx-auto mb-4" />
          <p className="text-gray-600">加载模板中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50">
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

      <AnimatePresence>
        {showInsufficientCredits && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowInsufficientCredits(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center"
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">潮能力不足</h2>
              <p className="text-sm text-gray-600 mb-6">
                当前批量生成需要 <span className="font-bold text-violet-600">{cards.length}</span> 点潮能力，您当前仅剩 <span className="font-bold text-red-600">{user?.credits ?? 0}</span> 点，请联系管理员充值后再试。
              </p>
              <button
                onClick={() => setShowInsufficientCredits(false)}
                className="w-full btn-primary py-2.5"
              >
                我知道了
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="glass sticky top-0 z-50 border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setPreviewImage(null);
                router.push('/templates');
              }}
              className="p-2 hover:bg-violet-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">批量生成</h1>
              <p className="text-sm text-gray-600">{cards.length} 个模板待生成</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {cards.some(c => c.result) && (
              <button
                onClick={handleBatchDownload}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-2"
              >
                <Archive className="w-5 h-5" />
                批量下载
              </button>
            )}
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">
                已生成 {cards.filter(c => c.result).length} / {cards.length}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-12 space-y-8">
          <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-8 hover:shadow-md transition-shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                <Upload className="w-6 h-6 text-violet-600" />
              </div>
              第一步：上传主视觉图片
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  上传一张主视觉图片（KV），系统将以此作为所有模板的核心参考。支持产品图、海报图等各种视觉素材。
                </p>
                {kvImage && (
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-2xl border border-green-100">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    <div>
                      <p className="text-sm font-bold text-green-900">已上传成功</p>
                      <p className="text-xs text-green-600">{kvImage.name}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                {kvImage ? (
                  <div className="relative group">
                    <img
                      src={kvImage.url}
                      alt="主视觉"
                      className="w-full h-64 object-cover rounded-2xl border border-gray-100 shadow-inner"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                      <button
                        onClick={handleRemoveKvImage}
                        className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors flex items-center gap-2 font-bold"
                      >
                        <X className="w-4 h-4" />
                        移除并重新上传
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-200 rounded-[2rem] p-12 text-center hover:border-violet-400 hover:bg-violet-50/30 transition-all group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleKvImageUpload}
                      className="hidden"
                      id="kv-upload"
                      disabled={uploadingKv}
                    />
                    <label htmlFor="kv-upload" className="cursor-pointer block">
                      {uploadingKv ? (
                        <div className="space-y-4">
                          <div className="w-16 h-16 border-4 border-violet-100 border-t-violet-600 rounded-full animate-spin mx-auto" />
                          <p className="text-violet-600 font-bold">正在上传素材...</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform shadow-sm">
                            <Upload className="w-10 h-10 text-gray-300 group-hover:text-violet-400" />
                          </div>
                          <div>
                            <p className="text-gray-900 font-bold text-lg">点击或拖拽上传</p>
                            <p className="text-sm text-gray-400">支持 PNG, JPG, WEBP (最大 20MB)</p>
                          </div>
                        </div>
                      )}
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-8 hover:shadow-md transition-shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-purple-600" />
              </div>
              第二步：统一生成配置
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 ml-1">
                  输出尺寸
                </label>
                <div className="relative">
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none appearance-none font-medium text-gray-900"
                  >
                    {SIZE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <Layers className="w-5 h-5" />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 ml-1">
                  生成质量
                </label>
                <div className="relative">
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none appearance-none font-medium text-gray-900"
                  >
                    {QUALITY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-col items-center gap-4">
              <button
                onClick={handleGenerateAll}
                disabled={!kvImage || batchGenerating}
                className="group relative px-12 py-5 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white rounded-[2rem] hover:shadow-2xl hover:shadow-violet-200 transition-all flex items-center gap-4 text-xl font-bold disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed transform active:scale-95 overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                {batchGenerating ? (
                  <>
                    <div className="w-7 h-7 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>正在批量创作中 ({batchProgress.current}/{batchProgress.total})</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-7 h-7" />
                    <span>一键开启批量生成</span>
                  </>
                )}
              </button>
              <p className="text-sm text-gray-400 flex items-center gap-2">
                <Info className="w-4 h-4" />
                将会根据以上配置为所有待生成模板开启任务
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {cards.map((card, index) => (
            <motion.div
              key={card.template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:shadow-violet-500/5 transition-all duration-300"
            >
              <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-purple-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Layers className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{card.template.name}</h3>
                      <p className="text-sm text-gray-600">{card.template.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {card.result && (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        已生成
                      </span>
                    )}
                    {card.generating && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-1">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        生成中
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8">
                <div className="flex flex-col xl:flex-row gap-8">
                  <div className="flex-1 space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 uppercase tracking-wider">
                        <Info className="w-4 h-4 text-violet-600" />
                        配置选项
                      </h4>
                      
                      {card.template.variables && card.template.variables.length > 0 && (
                        <div className="grid grid-cols-1 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                          {card.template.variables.map((variable) => (
                            <div key={variable.key} className="space-y-1.5">
                              <label className="block text-xs font-bold text-gray-500 ml-1">
                                {variable.label}
                                {variable.required && <span className="text-red-500 ml-1">*</span>}
                              </label>
                              {variable.type === 'textarea' ? (
                                <textarea
                                  value={card.formData[variable.key] || ''}
                                  onChange={(e) => handleCardFormChange(index, variable.key, e.target.value)}
                                  rows={3}
                                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none text-sm resize-none shadow-sm"
                                  placeholder={variable.placeholder || `请输入${variable.label}`}
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={card.formData[variable.key] || ''}
                                  onChange={(e) => handleCardFormChange(index, variable.key, e.target.value)}
                                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none text-sm shadow-sm"
                                  placeholder={variable.placeholder || `请输入${variable.label}`}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {card.template.allowUserPrompt !== false && (
                      <div className="pt-4 border-t border-gray-100 space-y-3">
                        <label className="flex items-center gap-3 p-3 bg-violet-50/50 rounded-xl cursor-pointer hover:bg-violet-50 transition-colors border border-violet-100/50">
                          <input
                            type="checkbox"
                            checked={card.enableUserPrompt}
                            onChange={(e) => setCards(prev => prev.map((c, i) => 
                              i === index ? { ...c, enableUserPrompt: e.target.checked } : c
                            ))}
                            className="w-5 h-5 text-violet-600 rounded-lg border-gray-300 focus:ring-violet-500 transition-all"
                          />
                          <span className="text-sm font-bold text-violet-900">启用自定义提示词</span>
                        </label>
                        
                        {card.enableUserPrompt && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="space-y-3 overflow-hidden"
                          >
                            <textarea
                              value={card.userPrompt}
                              onChange={(e) => setCards(prev => prev.map((c, i) => 
                                i === index ? { ...c, userPrompt: e.target.value } : c
                              ))}
                              rows={3}
                              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none text-sm resize-none shadow-sm"
                              placeholder="在这里输入额外的提示词描述..."
                            />
                            
                            <div className="flex items-center gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={card.userPromptPriority}
                                  onChange={(e) => setCards(prev => prev.map((c, i) => 
                                    i === index ? { ...c, userPromptPriority: e.target.checked } : c
                                  ))}
                                  className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                                />
                                <span className="text-xs font-bold text-amber-800">
                                  优先使用此提示词
                                </span>
                              </label>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        onClick={() => handleGenerateSingle(index)}
                        disabled={!kvImage || card.generating}
                        className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl hover:from-violet-700 hover:to-purple-700 transition-all flex items-center justify-center gap-3 font-bold shadow-lg shadow-violet-200 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed transform active:scale-[0.98]"
                      >
                        {card.generating ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            正在创作中...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5" />
                            立即生成
                          </>
                        )}
                      </button>
                    </div>

                    {card.error && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm flex items-start gap-3"
                      >
                        <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <p>{card.error}</p>
                      </motion.div>
                    )}
                  </div>

                  <div className="w-full xl:w-80 shrink-0 space-y-4">
                    <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 uppercase tracking-wider">
                      <ImageIcon className="w-4 h-4 text-violet-600" />
                      预览效果
                    </h4>
                    
                    {card.result ? (
                      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-4">
                        <div className="relative group cursor-pointer overflow-hidden rounded-xl border border-gray-100 shadow-inner" onClick={() => setPreviewImage(card.result.imageUrl)}>
                          <img
                            src={card.result.imageUrl}
                            alt={`${card.template.name} 生成结果`}
                            className="w-full h-auto min-h-[200px] max-h-[400px] object-contain transform group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                            <div className="p-3 bg-white/20 backdrop-blur-md rounded-full border border-white/30 text-white">
                              <Eye className="w-6 h-6" />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleDownloadSingle(card)}
                            className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-all flex items-center justify-center gap-2 text-sm font-bold shadow-md shadow-violet-100"
                          >
                            <Download className="w-4 h-4" />
                            下载结果
                          </button>
                          <button
                            onClick={() => handleRegenerateSingle(index)}
                            className="flex-1 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2 text-sm font-bold"
                          >
                            <RefreshCw className="w-4 h-4" />
                            重试
                          </button>
                        </div>
                        {card.result.revisedPrompt && (user?.role === 'admin' || user?.role === 'sub_admin') && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">PROMPT</p>
                            <p className="text-xs text-gray-500 line-clamp-2 italic leading-relaxed">{card.result.revisedPrompt}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50/50 rounded-2xl p-8 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center min-h-[300px] text-center space-y-4">
                        {card.generating ? (
                          <div className="space-y-4 flex flex-col items-center">
                            <div className="relative">
                              <div className="w-16 h-16 border-4 border-violet-100 border-t-violet-600 rounded-full animate-spin" />
                              <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-violet-400 animate-pulse" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-violet-900">{card.generationStatus || '正在构思中...'}</p>
                              <p className="text-xs text-gray-400">预计需要 15-30 秒</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-slate-100">
                              <ImageIcon className="w-8 h-8 text-slate-300" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-400">等待生成</p>
                              <p className="text-xs text-slate-300">点击左侧生成按钮开始创作</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

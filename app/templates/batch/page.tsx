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
        const randomDelay = Math.floor(Math.random() * 2000) + 1000;
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
            className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-8"
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
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-violet-600" />
              上传主视觉（统一使用）
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              上传一张主视觉图片，所有模板将以此作为参考图进行生成
            </p>

            {kvImage ? (
              <div className="relative inline-block">
                <img
                  src={kvImage.url}
                  alt="主视觉"
                  className="max-w-md h-48 object-cover rounded-lg border border-gray-200"
                />
                <button
                  onClick={handleRemoveKvImage}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <p className="text-sm text-gray-500 mt-2">{kvImage.name}</p>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-violet-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleKvImageUpload}
                  className="hidden"
                  id="kv-upload"
                  disabled={uploadingKv}
                />
                <label htmlFor="kv-upload" className="cursor-pointer">
                  {uploadingKv ? (
                    <>
                      <Loader2 className="w-12 h-12 text-violet-600 mx-auto mb-4 animate-spin" />
                      <p className="text-violet-600 mb-2">上传中...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-2">点击上传主视觉图片</p>
                    </>
                  )}
                  <p className="text-sm text-gray-500">
                    支持 PNG, JPG, JPEG, WEBP 格式，最大 20MB
                  </p>
                </label>
              </div>
            )}
          </div>

          <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">生成参数（统一设置）</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  输出尺寸
                </label>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="input-field"
                >
                  {SIZE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  质量
                </label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="input-field"
                >
                  {QUALITY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <button
              onClick={handleGenerateAll}
              disabled={!kvImage || batchGenerating}
              className="px-8 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 transition-colors flex items-center gap-3 text-lg font-medium shadow-lg shadow-violet-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {batchGenerating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  {batchProgress.current}/{batchProgress.total} 生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  一键生成全部
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          {cards.map((card, index) => (
            <motion.div
              key={card.template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1 min-w-[300px]"
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

              <div className="p-6">
                <div className="flex gap-6">
                  <div className="flex-1 space-y-4">
                     <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                       <Info className="w-4 h-4 text-violet-600" />
                       附加填写信息
                     </h4>
                    {card.template.variables && card.template.variables.length > 0 && (
                      <div className="space-y-3">
                        {card.template.variables.map((variable) => (
                          <div key={variable.key}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {variable.label}
                              {variable.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {variable.type === 'textarea' ? (
                              <textarea
                                value={card.formData[variable.key] || ''}
                                onChange={(e) => handleCardFormChange(index, variable.key, e.target.value)}
                                rows={2}
                                className="input-field resize-none text-sm"
                                placeholder={variable.placeholder || `请输入${variable.label}`}
                              />
                            ) : (
                              <input
                                type="text"
                                value={card.formData[variable.key] || ''}
                                onChange={(e) => handleCardFormChange(index, variable.key, e.target.value)}
                                className="input-field text-sm"
                                placeholder={variable.placeholder || `请输入${variable.label}`}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {card.template.allowUserPrompt !== false && (
                      <div className="pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={card.enableUserPrompt}
                              onChange={(e) => setCards(prev => prev.map((c, i) => 
                                i === index ? { ...c, enableUserPrompt: e.target.checked } : c
                              ))}
                              className="w-4 h-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500"
                            />
                            <span className="text-sm font-medium text-gray-700">补充提示词</span>
                          </label>
                        </div>
                        
                        {card.enableUserPrompt && (
                          <div className="mt-2 space-y-2">
                            <textarea
                              value={card.userPrompt}
                              onChange={(e) => setCards(prev => prev.map((c, i) => 
                                i === index ? { ...c, userPrompt: e.target.value } : c
                              ))}
                              rows={2}
                              className="input-field resize-none text-sm"
                              placeholder="请输入补充提示词..."
                            />
                            
                            <div className="flex items-center gap-3 bg-amber-50 p-2 rounded-lg">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={card.userPromptPriority}
                                  onChange={(e) => setCards(prev => prev.map((c, i) => 
                                    i === index ? { ...c, userPromptPriority: e.target.checked } : c
                                  ))}
                                  className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                                />
                                <span className="text-xs font-medium text-amber-800">
                                  补充提示词优先
                                </span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => handleGenerateSingle(index)}
                      disabled={!kvImage || card.generating}
                      className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {card.generating ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" />
                          生成
                        </>
                      )}
                    </button>

                    {card.error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {card.error}
                      </div>
                    )}
                  </div>

                  <div className="w-64 space-y-4">
                    {card.result ? (
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 border border-green-200">
                        <div className="relative group cursor-pointer" onClick={() => setPreviewImage(card.result.imageUrl)}>
                          <img
                            src={card.result.imageUrl}
                            alt={`${card.template.name} 生成结果`}
                            className="w-full h-auto max-h-48 object-contain rounded-lg shadow-md"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all rounded-lg">
                            <Eye className="w-8 h-8 text-white" />
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleDownloadSingle(card)}
                            className="flex-1 btn-primary flex items-center justify-center gap-1 text-xs py-1.5"
                          >
                            <Download className="w-4 h-4" />
                            下载
                          </button>
                          <button
                            onClick={() => handleRegenerateSingle(index)}
                            className="flex-1 btn-secondary flex items-center justify-center gap-1 text-xs py-1.5"
                          >
                            <RefreshCw className="w-4 h-4" />
                            重新生成
                          </button>
                        </div>
                        {card.result.revisedPrompt && (user?.role === 'admin' || user?.username === 'admin') && (
                          <div className="mt-3 p-2 bg-white rounded-lg border border-green-200">
                            <p className="text-xs font-medium text-gray-700 mb-1">实际提示词：</p>
                            <p className="text-xs text-gray-600 line-clamp-3">{card.result.revisedPrompt}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-xl p-6 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center h-48">
                        {card.generating ? (
                          <>
                            <Loader2 className="w-8 h-8 text-violet-600 mb-2 animate-spin" />
                            <p className="text-sm text-gray-600">{card.generationStatus || '正在生成...'}</p>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                            <p className="text-xs text-gray-500">生成结果将显示在这里</p>
                          </>
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

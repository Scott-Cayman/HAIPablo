'use client';

import type { ChangeEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Camera,
  CheckCircle,
  Eye,
  Image as ImageIcon,
  Loader2,
  Palette,
  Pencil,
  Settings2,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  XCircle
} from 'lucide-react';
import {
  THREE_D_AI_RENDER_PRESET,
  type SpecialTemplateOption
} from '@/lib/special-template-presets';

interface ReferenceImage {
  id: string;
  url: string;
  name: string;
  annotationTokens?: Array<{ id: string }>;
}

interface TemplateVariable {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'color' | 'select' | 'image';
  placeholder?: string;
  required?: boolean;
  options?: SpecialTemplateOption[];
  multiSelect?: boolean;
  maxSelections?: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  allowUserPrompt?: boolean;
  coverMetadata?: {
    badge?: string;
    specialTemplateLabel?: string;
  };
}

interface AnnotationPromptEntry {
  referenceLabel: string;
  tokens: Array<{
    id: string;
    label: string;
  }>;
}

interface SpecialTemplateSection {
  title: string;
  description?: string;
  variables: TemplateVariable[];
}

interface SizeOption {
  value: string;
  label: string;
}

interface QualityOption {
  value: string;
  label: string;
}

interface AnnotationEditorContext {
  scope: 'main' | 'variable' | 'templateCustom';
  referenceLabel: string;
  variableKey?: string;
}

interface MainColumnProps {
  darkMode: boolean;
  template: Template;
  allImages: ReferenceImage[];
  size: string;
  quality: string;
  setSize: (value: string) => void;
  setQuality: (value: string) => void;
  sizeOptions: SizeOption[];
  qualityOptions: QualityOption[];
  userImages: ReferenceImage[];
  selectedUserImage: ReferenceImage | null;
  isReferenceCardSelected: (image: ReferenceImage) => boolean;
  setSelectedUserImage: (image: ReferenceImage | null) => void;
  setPreviewImage: (url: string) => void;
  handleOpenAnnotationEditor: (image: ReferenceImage, context: AnnotationEditorContext) => void;
  getMainReferenceLabel: () => string;
  handleRemoveImage: (id: string) => void;
  uploadingImage: boolean;
  handleImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  userPromptPriority: boolean;
  setUserPromptPriority: (value: boolean) => void;
  enableUserPrompt: boolean;
  setEnableUserPrompt: (value: boolean) => void;
  annotationPromptEntries: AnnotationPromptEntry[];
  annotationTokenCount: number;
  handleInsertAnnotationLabel: (label: string) => void;
  userPrompt: string;
  handleUserPromptChange: (value: string) => void;
  specialTemplateSections: SpecialTemplateSection[];
  parseStoredValues: (value?: string) => string[];
  formData: Record<string, string>;
  handleMultiSelectToggle: (key: string, value: string, maxSelections?: number) => void;
  handleFormChange: (key: string, value: string) => void;
  canGenerateCurrentMode: boolean;
  missingRequiredVariable: { label: string } | null;
  generating: boolean;
  handleGenerate: () => void;
}

interface SidebarProps {
  darkMode: boolean;
  userImages: ReferenceImage[];
  selectedUserImage: ReferenceImage | null;
  setPreviewImage: (url: string) => void;
  generating: boolean;
  canGenerateCurrentMode: boolean;
  missingRequiredVariable: { label: string } | null;
  handleGenerate: () => void;
  handleDownload: () => void;
  resultImageUrl?: string | null;
  revisedPrompt?: string | null;
  error: string;
  canManage: boolean;
  generationStatus: string;
  enableUserPrompt: boolean;
  userPrompt: string;
  annotationTokenCount: number;
}

export const threeDAIRenderWorkspaceLayout = {
  containerClassName: 'w-[min(96vw,1600px)] px-3 py-3 xl:px-4 2xl:px-5 pb-10',
  gridClassName: 'grid grid-cols-1 gap-4 items-start xl:grid-cols-[minmax(0,1.28fr)_minmax(360px,440px)] 2xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,470px)]',
  mainColumnClassName: 'space-y-4',
  sidebarClassName: 'space-y-4 xl:sticky xl:top-24'
};

export function ThreeDAIRenderMainColumn({
  darkMode,
  template,
  allImages,
  size,
  quality,
  setSize,
  setQuality,
  sizeOptions,
  qualityOptions,
  userImages,
  selectedUserImage,
  isReferenceCardSelected,
  setSelectedUserImage,
  setPreviewImage,
  handleOpenAnnotationEditor,
  getMainReferenceLabel,
  handleRemoveImage,
  uploadingImage,
  handleImageUpload,
  userPromptPriority,
  setUserPromptPriority,
  enableUserPrompt,
  setEnableUserPrompt,
  annotationPromptEntries,
  annotationTokenCount,
  handleInsertAnnotationLabel,
  userPrompt,
  handleUserPromptChange,
  specialTemplateSections,
  parseStoredValues,
  formData,
  handleMultiSelectToggle,
  handleFormChange,
  canGenerateCurrentMode,
  missingRequiredVariable,
  generating,
  handleGenerate
}: MainColumnProps) {
  return (
    <div className={`haipablo-glass-panel rounded-[34px] border p-6 shadow-sm transition-colors duration-500 overflow-hidden md:p-8 xl:p-9 ${
      darkMode ? 'border-[#f5ecd9]/10 bg-[#1b211c]/90' : 'border-white/60 bg-white'
    }`}>
      <div className="relative">
        <div
          className={`absolute inset-0 rounded-[26px] opacity-70 ${
            darkMode
              ? 'bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.16),transparent_42%)]'
              : 'bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_38%)]'
          }`}
        />
        <div className="relative space-y-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(260px,320px)] xl:items-end">
            <div className="w-full min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-emerald-700">
                  {template.coverMetadata?.badge || '特殊模板'}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.16em] ${
                    darkMode ? 'bg-white/6 text-stone-300 ring-1 ring-white/10' : 'bg-white/80 text-gray-600 ring-1 ring-gray-200/80'
                  }`}
                >
                  WIDE WORKSPACE
                </span>
              </div>
              <h2 className={`mt-4 text-3xl font-semibold tracking-tight md:text-4xl ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {template.coverMetadata?.specialTemplateLabel || template.name}
              </h2>
              <p className={`mt-3 max-w-3xl text-sm leading-7 md:text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {template.description || THREE_D_AI_RENDER_PRESET.description}
              </p>
            </div>
            <div className={`haipablo-glass-subtle rounded-[26px] border px-4 py-4 xl:min-w-0 ${
              darkMode ? 'border-[#f5ecd9]/10 bg-[#141915]/55' : 'border-white/65 bg-white/70'
            }`}>
              <p className={`text-xs uppercase tracking-[0.2em] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>当前状态</p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>已选参考图</span>
                  <span className={darkMode ? 'text-white' : 'text-gray-900'}>{allImages.length} 张</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>输出尺寸</span>
                  <span className={darkMode ? 'text-white' : 'text-gray-900'}>{sizeOptions.find((option) => option.value === size)?.label || size}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>生成质量</span>
                  <span className={darkMode ? 'text-white' : 'text-gray-900'}>{qualityOptions.find((option) => option.value === quality)?.label || quality}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.08fr)]">
            <div className={`haipablo-glass-subtle rounded-[28px] border p-5 ${
              darkMode ? 'border-[#f5ecd9]/10 bg-[#141915]/55' : 'border-white/65 bg-white/72'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                  darkMode ? 'bg-[#222923] text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>上传白膜 / 草图 / 线稿</h3>
                  <p className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>上传结构参考图，系统将尽量保留原始造型与透视。</p>
                </div>
              </div>

              <div className="mt-5">
                {userImages.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {userImages.map((image, index) => {
                        const isSelected = isReferenceCardSelected(image);
                        return (
                          <div
                            key={image.id}
                            className={`group relative cursor-pointer overflow-hidden rounded-2xl border transition-all ${
                              isSelected
                                ? 'border-emerald-400 ring-2 ring-emerald-400/30'
                                : darkMode
                                  ? 'border-gray-800 hover:border-gray-700'
                                  : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => setSelectedUserImage(selectedUserImage?.id === image.id ? null : image)}
                          >
                            <img src={image.url} alt={`上传参考图 ${index + 1}`} className="h-28 w-full object-contain bg-black/[0.03]" />
                            <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-medium text-white">
                              {isSelected ? '已选中' : `参考图 ${index + 1}`}
                            </div>
                            {isSelected && (
                              <div className="absolute bottom-2 right-2 rounded-full bg-emerald-500 p-1.5 text-white shadow-lg">
                                <CheckCircle className="h-3.5 w-3.5" />
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setPreviewImage(image.url);
                                }}
                                className="rounded-full bg-white/90 p-2 text-gray-900 shadow-lg transition-transform hover:scale-105"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
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
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleRemoveImage(image.id);
                                }}
                                className="rounded-full bg-red-500 p-2 text-white shadow-lg transition-transform hover:scale-105"
                                aria-label="删除参考图"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            {image.annotationTokens && image.annotationTokens.length > 0 && (
                              <div className="absolute bottom-2 left-2 rounded-full bg-violet-600/90 px-2 py-1 text-[10px] font-semibold text-white shadow-lg">
                                已标注 {image.annotationTokens.length}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <label className={`flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed px-4 py-3 text-sm transition-colors ${
                      darkMode ? 'border-[#334034] text-stone-300 hover:border-[#425143]' : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}>
                      <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                      {uploadingImage ? '上传中...' : '继续添加参考图'}
                    </label>
                  </div>
                ) : (
                  <div className={`rounded-[24px] border-2 border-dashed px-6 py-10 text-center transition-colors ${
                    darkMode ? 'border-[#334034] hover:border-[#425143]' : 'border-gray-300 hover:border-gray-400'
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

            <div className={`haipablo-glass-subtle rounded-[28px] border p-5 ${
              darkMode ? 'border-white/10 bg-gray-950/45' : 'border-white/65 bg-white/72'
            }`}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className={`rounded-2xl border p-4 ${darkMode ? 'border-[#f5ecd9]/10 bg-[#f5ecd9]/[0.035]' : 'border-white/65 bg-white/80'}`}>
                  <div className="flex items-center gap-2">
                    <Palette className={`h-4 w-4 ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`} />
                    <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>输出参数</p>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className={`mb-1.5 block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>输出尺寸</label>
                      <select
                        value={size}
                        onChange={(event) => setSize(event.target.value)}
                        className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${darkMode ? 'border-[#f5ecd9]/10 bg-[#151a16]/80 text-white' : 'border-white/70 bg-white text-gray-900'}`}
                      >
                        {sizeOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={`mb-1.5 block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>生成质量</label>
                      <select
                        value={quality}
                        onChange={(event) => setQuality(event.target.value)}
                        className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${darkMode ? 'border-[#f5ecd9]/10 bg-[#151a16]/80 text-white' : 'border-white/70 bg-white text-gray-900'}`}
                      >
                        {qualityOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className={`rounded-2xl border p-4 ${darkMode ? 'border-[#2f3a31] bg-[#1a201b]' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <Settings2 className={`h-4 w-4 ${darkMode ? 'text-cyan-300' : 'text-cyan-700'}`} />
                    <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>系统规则</p>
                  </div>
                  <p className={`mt-3 text-sm leading-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    严格保留原图结构、比例、镜头角度和透视，只增强材质、灯光、真实感与空间氛围。
                  </p>
                </div>
              </div>

              {template.allowUserPrompt !== false && (
                <div className={`mt-4 rounded-2xl border p-4 ${darkMode ? 'border-[#2f3a31] bg-[#1a201b]' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>附加文本要求</p>
                      <p className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>用于补充项目特有的品牌调性、展示语境或禁忌项。</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setUserPromptPriority(!userPromptPriority)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                          !userPromptPriority
                            ? 'bg-amber-500 text-white'
                            : darkMode
                              ? 'bg-[#242b25] text-stone-300'
                              : 'border border-gray-200 bg-white text-gray-600'
                        }`}
                      >
                        模板优先
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnableUserPrompt(!enableUserPrompt)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                          enableUserPrompt
                            ? 'bg-violet-600 text-white'
                            : darkMode
                              ? 'bg-[#242b25] text-stone-300'
                              : 'border border-gray-200 bg-white text-gray-600'
                        }`}
                      >
                        补充提示词
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
                        onChange={(event) => handleUserPromptChange(event.target.value)}
                        rows={4}
                        className={`mt-4 w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none ${darkMode ? 'border-[#334034] bg-[#141915] text-white placeholder:text-stone-500' : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400'}`}
                        placeholder="例如：强化品牌高级感，入口视觉更聚焦，灯光不要过冷。"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-5 2xl:grid-cols-2">
            {specialTemplateSections.map((section) => (
              <div
                key={section.title}
                className={`rounded-[24px] border p-5 ${darkMode ? 'border-[#2f3a31] bg-[#141915]/80' : 'border-gray-200 bg-white/80'}`}
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
                          <div className="grid gap-3 sm:grid-cols-2">
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
                                        ? 'border-[#334034] bg-[#1b211c] text-stone-300 hover:border-[#425143]'
                                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                  }`}
                                >
                                  <div className="font-medium">{option.label}</div>
                                  {option.description && (
                                    <div className={`mt-1 text-xs ${active ? 'text-white/80' : darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                      {option.description}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {variable.type === 'select' && !variable.multiSelect && (
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                                        ? 'border-[#334034] bg-[#1b211c] text-stone-300 hover:border-[#425143]'
                                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                  }`}
                                >
                                  <div className="font-medium">{option.label}</div>
                                  {option.description && (
                                    <div className={`mt-1 text-xs ${active ? 'text-white/80' : darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                      {option.description}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {variable.type === 'textarea' && (
                          <textarea
                            value={formData[variable.key] || ''}
                            onChange={(event) => handleFormChange(variable.key, event.target.value)}
                            rows={4}
                            className={`w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none ${darkMode ? 'border-[#334034] bg-[#1b211c] text-white placeholder:text-stone-500' : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400'}`}
                            placeholder={variable.placeholder || `请输入${variable.label}`}
                          />
                        )}

                        {variable.type === 'text' && (
                          <input
                            type="text"
                            value={formData[variable.key] || ''}
                            onChange={(event) => handleFormChange(variable.key, event.target.value)}
                            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${darkMode ? 'border-[#334034] bg-[#1b211c] text-white placeholder:text-stone-500' : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400'}`}
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

          <div className={`flex flex-col gap-4 rounded-[24px] border p-5 md:flex-row md:items-center md:justify-between ${darkMode ? 'border-[#2f3a31] bg-[#141915]/80' : 'border-gray-200 bg-white/80'}`}>
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${darkMode ? 'bg-[#222923] text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <p className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>渲染说明</p>
                <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>系统会自动拼接中英文结构化 Prompt，并把本次配置完整保存到历史记录。</p>
              </div>
            </div>
            <span className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold ${darkMode ? 'bg-[#222923] text-stone-300' : 'bg-gray-100 text-gray-600'}`}>
              {canGenerateCurrentMode
                ? '参数已就绪，可直接开始'
                : missingRequiredVariable
                  ? `请先完成「${missingRequiredVariable.label}」`
                  : '请先上传至少一张参考图'}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center pb-4 pt-8">
            <button
              onClick={handleGenerate}
              disabled={generating || !canGenerateCurrentMode}
              className={`group relative flex w-full max-w-md items-center justify-center gap-3 overflow-hidden rounded-2xl px-8 py-5 text-lg font-bold text-white shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${
                !canGenerateCurrentMode ? 'grayscale opacity-50' : ''
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 via-pink-500 to-orange-400 opacity-90 transition-opacity group-hover:opacity-100" />
              <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.3)_45%,rgba(255,255,255,0.3)_55%,transparent_75%)] bg-[length:200%_100%] animate-[shimmer_2s_infinite] opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative flex items-center gap-3">
                {generating ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Sparkles className="h-6 w-6 transition-transform group-hover:rotate-12" />
                )}
                <span className="tracking-widest">{generating ? '创作中...' : '立即开始创作'}</span>
              </div>
            </button>
            {!canGenerateCurrentMode && (
              <p className={`mt-4 text-sm font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                {missingRequiredVariable
                  ? `请先完成必填项「${missingRequiredVariable.label}」后再创作`
                  : '请先上传至少一张参考图以开启创作'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThreeDAIRenderSidebar({
  darkMode,
  userImages,
  selectedUserImage,
  setPreviewImage,
  generating,
  canGenerateCurrentMode,
  missingRequiredVariable,
  handleGenerate,
  handleDownload,
  resultImageUrl,
  revisedPrompt,
  error,
  canManage,
  generationStatus,
  enableUserPrompt,
  userPrompt,
  annotationTokenCount
}: SidebarProps) {
  const specialReferencePreview = selectedUserImage || userImages[0] || null;
  const specialStageImage = resultImageUrl || specialReferencePreview?.url || null;
  const specialStageTitle = resultImageUrl ? '最新渲染结果' : specialReferencePreview ? '当前结构参考' : '结果舞台';

  return (
    <>
      <div className={`overflow-hidden rounded-[30px] border shadow-sm transition-colors duration-500 ${
        darkMode ? 'border-[#334034] bg-[#151a16]/94' : 'border-white/70 bg-white/92'
      }`}>
        <div className={`border-b px-5 py-4 ${darkMode ? 'border-[#2f3a31] bg-[#141915]/92' : 'border-gray-200 bg-white/70'}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${darkMode ? 'text-violet-300/70' : 'text-violet-600'}`}>Result Stage</p>
              <h2 className={`mt-2 text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{specialStageTitle}</h2>
              <p className={`mt-1 text-xs leading-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {resultImageUrl ? '点击画面可查看大图，支持继续微调后再次生成。' : specialReferencePreview ? '当前尚未出图，先展示正在使用的结构参考。' : '先上传至少一张结构参考，再从这里发起渲染。'}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
              resultImageUrl
                ? 'bg-emerald-500 text-white'
                : generating
                  ? 'bg-violet-500 text-white'
                  : darkMode
                    ? 'bg-[#222923] text-stone-300'
                    : 'bg-gray-100 text-gray-600'
            }`}>
              {resultImageUrl ? '已生成' : generating ? '渲染中' : '待开始'}
            </span>
          </div>
        </div>

        <div className="p-5">
          <div className={`relative overflow-hidden rounded-[24px] border ${
            darkMode ? 'border-[#2f3a31] bg-[#0f1411]' : 'border-gray-200 bg-gray-50'
          }`}>
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur-sm transition-colors duration-500 ${
                    darkMode ? 'border-red-800 bg-red-950/85 text-red-300' : 'border-red-200 bg-red-50/95 text-red-700'
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

            {specialStageImage ? (
              <button type="button" onClick={() => setPreviewImage(specialStageImage)} className="group block w-full">
                <div className="relative">
                  <img
                    src={specialStageImage}
                    alt={resultImageUrl ? '生成结果' : '当前结构参考'}
                    className="max-h-[640px] w-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/0 transition-all duration-300 group-hover:bg-black/18" />
                  {!resultImageUrl && (
                    <div className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold text-white">
                      当前主图预览
                    </div>
                  )}
                </div>
              </button>
            ) : (
              <div className="flex min-h-[360px] items-center justify-center px-8 text-center">
                <div>
                  <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${darkMode ? 'bg-[#222923] text-stone-400' : 'bg-gray-100 text-gray-500'}`}>
                    {generating ? <Loader2 className="h-7 w-7 animate-spin" /> : <ImageIcon className="h-7 w-7" />}
                  </div>
                  <h3 className={`mt-4 text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {generating ? '正在创作' : '等待结果'}
                  </h3>
                  <p className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    完成左侧配置后，这里会优先显示最新渲染结果。
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={handleGenerate}
              disabled={generating || !canGenerateCurrentMode}
              className={`group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl px-5 py-4 text-sm font-bold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${
                !canGenerateCurrentMode ? 'grayscale opacity-50' : ''
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 via-pink-500 to-orange-400 opacity-95 transition-opacity group-hover:opacity-100" />
              <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.3)_45%,rgba(255,255,255,0.3)_55%,transparent_75%)] bg-[length:200%_100%] animate-[shimmer_2s_infinite] opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative flex items-center gap-3">
                {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5 transition-transform group-hover:rotate-12" />}
                <span>{generating ? '创作中...' : '立即开始创作'}</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => resultImageUrl && setPreviewImage(resultImageUrl)}
              disabled={!resultImageUrl}
              className={`rounded-2xl px-5 py-4 text-sm font-semibold transition-colors ${
                resultImageUrl
                  ? darkMode
                    ? 'bg-[#222923] text-white hover:bg-[#2a332b]'
                    : 'border border-gray-200 bg-white text-gray-900 hover:bg-gray-50'
                  : darkMode
                    ? 'cursor-not-allowed bg-[#1f2620] text-gray-500'
                    : 'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400'
              }`}
            >
              全屏预览
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!resultImageUrl}
              className={`rounded-2xl px-5 py-3.5 text-sm font-semibold transition-colors ${
                resultImageUrl
                  ? darkMode
                    ? 'bg-violet-600 text-white hover:bg-violet-500'
                    : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                  : darkMode
                    ? 'cursor-not-allowed bg-[#1f2620] text-gray-500'
                    : 'cursor-not-allowed bg-gray-100 text-gray-400'
              }`}
            >
              下载结果
            </button>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !canGenerateCurrentMode}
              className={`rounded-2xl px-5 py-3.5 text-sm font-semibold transition-colors ${
                canGenerateCurrentMode
                  ? darkMode
                    ? 'bg-[#222923] text-stone-200 hover:bg-[#2a332b]'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  : darkMode
                    ? 'cursor-not-allowed bg-[#1f2620] text-gray-500'
                    : 'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400'
              }`}
            >
              重新生成
            </button>
          </div>

          {!canGenerateCurrentMode && (
            <p className={`mt-4 text-sm font-medium ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {missingRequiredVariable
                ? `请先完成必填项「${missingRequiredVariable.label}」后再创作`
                : '请先上传至少一张参考图以开启创作'}
            </p>
          )}
        </div>
      </div>

      <div className={`overflow-hidden rounded-[28px] border shadow-sm transition-colors duration-500 ${
        darkMode ? 'border-[#334034] bg-[#151a16]/92' : 'border-white/70 bg-white/92'
      }`}>
        <div className={`border-b px-5 py-4 ${darkMode ? 'border-[#2f3a31] bg-[#141915]/92' : 'border-gray-200 bg-white/70'}`}>
          <h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>本次渲染摘要</h3>
        </div>
        <div className="space-y-4 p-5">
          <div className={`rounded-2xl border px-4 py-3 ${darkMode ? 'border-[#2f3a31] bg-[#111611]' : 'border-gray-200 bg-gray-50'}`}>
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Prompt 组成</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['任务', '场景', '材质', '光照', '镜头', '约束'].map((item) => (
                <span
                  key={item}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                    darkMode ? 'bg-[#222923] text-stone-300' : 'bg-white text-gray-600 ring-1 ring-gray-200'
                  }`}
                >
                  {item}
                </span>
              ))}
              {enableUserPrompt && userPrompt.trim() && (
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${darkMode ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30' : 'bg-violet-100 text-violet-800 ring-1 ring-violet-200'}`}>
                  补充要求
                </span>
              )}
              {annotationTokenCount > 0 && (
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${darkMode ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/30' : 'bg-cyan-100 text-cyan-800 ring-1 ring-cyan-200'}`}>
                  标注提示 {annotationTokenCount}
                </span>
              )}
            </div>
          </div>

          <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${darkMode ? 'border-[#2f3a31] bg-[#111611] text-stone-300' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
            {generationStatus
              ? `当前状态：${generationStatus}`
              : resultImageUrl
                ? '已拿到最新渲染结果，可继续微调左侧参数后再次生成。'
                : '出图前显示当前结构参考，出图后自动切换为最新渲染结果。'}
          </div>

          {canManage && revisedPrompt && (
            <div className={`rounded-2xl border p-4 ${darkMode ? 'border-[#2f3a31] bg-[#141915]/72' : 'border-gray-200 bg-gray-50/80'}`}>
              <p className={`mb-2 flex items-center gap-2 text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                <Shield className="h-4 w-4" />
                管理员可见 - 实际使用的提示词
              </p>
              <pre className={`max-h-64 overflow-y-auto whitespace-pre-wrap text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {revisedPrompt}
              </pre>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

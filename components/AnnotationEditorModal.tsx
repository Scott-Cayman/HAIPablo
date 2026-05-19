'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Circle,
  CornerDownRight,
  Eraser,
  Redo2,
  Save,
  Square,
  Undo2,
  X
} from 'lucide-react';
import {
  ANNOTATION_COLOR_OPTIONS,
  AnnotationColorName,
  AnnotationItem,
  AnnotationPoint,
  AnnotationPromptToken,
  buildAnnotationPromptTokens,
  createAnnotationAtPoint,
  getAnnotationCenter,
  getAnnotationBaseLabel,
  getAnnotationColorOption,
  getAnnotationPath,
  hasDuplicateAnnotationLabel,
  translateAnnotation,
  updateAnnotationCorner
} from '@/lib/annotation';

interface EditorImageData {
  id: string;
  name: string;
  url: string;
  originalUrl?: string;
  annotations?: AnnotationItem[];
  annotationTokens?: AnnotationPromptToken[];
}

interface SavePayload {
  annotations: AnnotationItem[];
  annotationTokens: AnnotationPromptToken[];
  file?: File;
  restoredOriginal?: boolean;
}

interface AnnotationEditorModalProps {
  isOpen: boolean;
  darkMode: boolean;
  image: EditorImageData | null;
  referenceLabel?: string;
  onClose: () => void;
  onSave: (payload: SavePayload) => Promise<void>;
}

type DragState =
  | { type: 'move'; annotationId: string; start: AnnotationPoint }
  | { type: 'corner'; annotationId: string; cornerIndex: number }
  | null;

const STAGE_MAX_WIDTH = 1200;
const STAGE_MAX_HEIGHT = 760;

function deepCloneAnnotations(annotations: AnnotationItem[]): AnnotationItem[] {
  return annotations.map((annotation) => ({
    ...annotation,
    corners: annotation.corners.map((corner) => ({ ...corner })) as AnnotationItem['corners']
  }));
}

async function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = src;
  });
}

async function exportAnnotatedImage(
  imageSrc: string,
  width: number,
  height: number,
  annotations: AnnotationItem[]
): Promise<File | undefined> {
  if (!annotations.length) return undefined;

  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${annotations
        .map((annotation) => {
          const color = getAnnotationColorOption(annotation.color);
          const strokeWidth = Math.max(width, height) * 0.006;
          return `<path d="${getAnnotationPath(annotation)}" fill="${annotation.filled ? color.fill : 'transparent'}" stroke="${color.stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" />`;
        })
        .join('')}
    </svg>
  `;

  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const [baseImage, overlayImage] = await Promise.all([
      loadHtmlImage(imageSrc),
      loadHtmlImage(svgUrl)
    ]);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    ctx.drawImage(baseImage, 0, 0, width, height);
    ctx.drawImage(overlayImage, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return undefined;

    return new File([blob], `annotated_${Date.now()}.png`, { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export function AnnotationEditorModal({
  isOpen,
  darkMode,
  image,
  referenceLabel,
  onClose,
  onSave
}: AnnotationEditorModalProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeShape, setActiveShape] = useState<'circle' | 'rect'>('circle');
  const [activeColor, setActiveColor] = useState<AnnotationColorName>('red');
  const [fillEnabled, setFillEnabled] = useState(false);
  const [createMode, setCreateMode] = useState<'circle' | 'rect' | null>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [history, setHistory] = useState<AnnotationItem[][]>([]);
  const [future, setFuture] = useState<AnnotationItem[][]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorNotice, setEditorNotice] = useState('');

  const baseImageUrl = image?.originalUrl || image?.url || '';

  useEffect(() => {
    if (!isOpen || !baseImageUrl) return;

    let active = true;
    setLoading(true);

    loadImageSize(baseImageUrl)
      .then((size) => {
        if (!active) return;
        setImageSize(size);
        const nextAnnotations = deepCloneAnnotations(image?.annotations || []);
        setAnnotations(nextAnnotations);
        setSelectedId(nextAnnotations[0]?.id || null);
        setHistory([]);
        setFuture([]);
        setEditorNotice('');
      })
      .catch((error) => {
        console.error('加载标注底图失败:', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, baseImageUrl, image?.annotations]);

  const stageSize = useMemo(() => {
    if (!imageSize.width || !imageSize.height) {
      return { width: 0, height: 0 };
    }

    const ratio = Math.min(STAGE_MAX_WIDTH / imageSize.width, STAGE_MAX_HEIGHT / imageSize.height, 1);
    return {
      width: imageSize.width * ratio,
      height: imageSize.height * ratio
    };
  }, [imageSize]);

  const selectedAnnotation = annotations.find((annotation) => annotation.id === selectedId) || null;

  const commitHistory = (nextAnnotations: AnnotationItem[]) => {
    setHistory((prev) => [...prev, deepCloneAnnotations(annotations)]);
    setFuture([]);
    setAnnotations(nextAnnotations);
  };

  useEffect(() => {
    if (!selectedAnnotation) return;
    setActiveShape(selectedAnnotation.type);
    setActiveColor(selectedAnnotation.color);
    setFillEnabled(selectedAnnotation.filled);
  }, [selectedAnnotation]);

  const getCanvasPoint = (event: PointerEvent | React.PointerEvent): AnnotationPoint | null => {
    const stage = stageRef.current;
    if (!stage || !imageSize.width || !imageSize.height) return null;
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const x = ((event.clientX - rect.left) / rect.width) * imageSize.width;
    const y = ((event.clientY - rect.top) / rect.height) * imageSize.height;
    return { x, y };
  };

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (event: PointerEvent) => {
      const point = getCanvasPoint(event);
      if (!point) return;

      setAnnotations((current) =>
        current.map((annotation) => {
          if (annotation.id !== dragState.annotationId) return annotation;

          if (dragState.type === 'move') {
            const dx = point.x - dragState.start.x;
            const dy = point.y - dragState.start.y;
            setDragState({ ...dragState, start: point });
            return translateAnnotation(annotation, dx, dy, imageSize.width, imageSize.height);
          }

          return updateAnnotationCorner(annotation, dragState.cornerIndex, point, imageSize.width, imageSize.height);
        })
      );
    };

    const handlePointerUp = () => {
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, imageSize]);

  const placeAnnotationAtPoint = (type: 'circle' | 'rect', point: AnnotationPoint) => {
    if (!imageSize.width || !imageSize.height || !image) return;
    const newAnnotation = createAnnotationAtPoint(imageSize.width, imageSize.height, type, activeColor, point);
    newAnnotation.filled = fillEnabled;

    if (hasDuplicateAnnotationLabel(newAnnotation, annotations)) {
      setEditorNotice(`${getAnnotationBaseLabel(newAnnotation)} 已存在，同一标签只能保留一个`);
      return;
    }

    const next = [...annotations, newAnnotation];
    commitHistory(next);
    setSelectedId(newAnnotation.id);
    setActiveShape(type);
    setCreateMode(null);
    setEditorNotice('');
    console.info('[annotate] create', {
      imageId: image.id,
      referenceLabel,
      type,
      color: newAnnotation.color,
      filled: newAnnotation.filled,
      sequence: next.length
    });
  };

  const handleUpdateSelected = (updater: (annotation: AnnotationItem) => AnnotationItem) => {
    if (!selectedId) return;
    const currentAnnotation = annotations.find((annotation) => annotation.id === selectedId);
    if (!currentAnnotation) return;
    const updatedAnnotation = updater(currentAnnotation);

    if (hasDuplicateAnnotationLabel(updatedAnnotation, annotations, selectedId)) {
      setEditorNotice(`${getAnnotationBaseLabel(updatedAnnotation)} 已存在，同一标签只能保留一个`);
      return;
    }

    const next = annotations.map((annotation) => (annotation.id === selectedId ? updatedAnnotation : annotation));
    setEditorNotice('');
    commitHistory(next);
  };

  const toggleFill = () => {
    const next = !(selectedAnnotation?.filled ?? fillEnabled);
    setFillEnabled(next);
    if (selectedAnnotation) {
      handleUpdateSelected((annotation) => ({ ...annotation, filled: next }));
    }
  };

  const applyShapeToSelected = (type: 'circle' | 'rect') => {
    setActiveShape(type);
    if (selectedAnnotation) {
      handleUpdateSelected((annotation) => ({ ...annotation, type }));
    }
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    commitHistory(annotations.filter((annotation) => annotation.id !== selectedId));
    setSelectedId(null);
    setEditorNotice('');
  };

  const handleUndo = () => {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setFuture((current) => [deepCloneAnnotations(annotations), ...current]);
    setHistory((current) => current.slice(0, -1));
    setAnnotations(deepCloneAnnotations(previous));
    setSelectedId(previous[previous.length - 1]?.id || null);
  };

  const handleRedo = () => {
    if (!future.length) return;
    const next = future[0];
    setHistory((current) => [...current, deepCloneAnnotations(annotations)]);
    setFuture((current) => current.slice(1));
    setAnnotations(deepCloneAnnotations(next));
    setSelectedId(next[next.length - 1]?.id || null);
  };

  const startMove = (event: React.PointerEvent, annotationId: string) => {
    event.stopPropagation();
    const point = getCanvasPoint(event);
    if (!point) return;
    setHistory((prev) => [...prev, deepCloneAnnotations(annotations)]);
    setFuture([]);
    setSelectedId(annotationId);
    setDragState({ type: 'move', annotationId, start: point });
  };

  const startCornerDrag = (event: React.PointerEvent, annotationId: string, cornerIndex: number) => {
    event.stopPropagation();
    setHistory((prev) => [...prev, deepCloneAnnotations(annotations)]);
    setFuture([]);
    setSelectedId(annotationId);
    setDragState({ type: 'corner', annotationId, cornerIndex });
  };

  const handleStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragState) return;
    const point = getCanvasPoint(event);
    if (!point) return;

    if (createMode) {
      placeAnnotationAtPoint(createMode, point);
      return;
    }

    setSelectedId(null);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (isEditable) return;

      const key = event.key.toLowerCase();
      const withMeta = event.ctrlKey || event.metaKey;

      if (withMeta && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (withMeta && key === 'y') {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (key === 'delete' || key === 'backspace') {
        if (selectedAnnotation) {
          event.preventDefault();
          handleDeleteSelected();
        }
        return;
      }

      if (key === 'escape') {
        if (createMode) {
          setCreateMode(null);
        } else {
          setSelectedId(null);
        }
        setEditorNotice('');
        return;
      }

      if (key === 'c') {
        setCreateMode('circle');
        setActiveShape('circle');
        return;
      }

      if (key === 'r') {
        setCreateMode('rect');
        setActiveShape('rect');
        return;
      }

      if (key === 'f') {
        event.preventDefault();
        toggleFill();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createMode, isOpen, selectedAnnotation, fillEnabled, annotations, history, future]);

  const handleSave = async () => {
    if (!image || !baseImageUrl) return;
    setSaving(true);

    try {
      if (!annotations.length && image.originalUrl) {
        await onSave({
          annotations: [],
          annotationTokens: [],
          restoredOriginal: true
        });
        onClose();
        return;
      }

      const file = await exportAnnotatedImage(baseImageUrl, imageSize.width, imageSize.height, annotations);
      const annotationTokens = buildAnnotationPromptTokens(annotations);

      await onSave({
        annotations,
        annotationTokens,
        file,
        restoredOriginal: false
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !image) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md p-4 md:p-8"
      >
        <div className={`mx-auto flex h-full max-w-[1600px] flex-col overflow-hidden rounded-[32px] border ${
          darkMode ? 'border-gray-800 bg-gray-950 text-white' : 'border-white/70 bg-[#f7f5ef] text-gray-900'
        }`}>
          <div className={`flex items-center justify-between border-b px-6 py-4 ${
            darkMode ? 'border-gray-800' : 'border-gray-200/80'
          }`}>
            <div>
              <h2 className="text-lg font-semibold">参考图标注</h2>
              <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {referenceLabel ? `${referenceLabel} · ` : ''}
                {image.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className={`rounded-full p-2 transition-colors ${
                darkMode ? 'bg-gray-900 hover:bg-gray-800' : 'bg-white hover:bg-gray-100'
              }`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr),340px]">
            <div className="min-h-0 overflow-auto p-6">
              <div className="flex h-full items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-black/25 p-4">
                {loading ? (
                  <div className="text-sm text-gray-400">正在加载底图...</div>
                ) : (
                  <div
                    ref={stageRef}
                    className={`relative select-none ${createMode ? 'cursor-crosshair' : ''}`}
                    style={{ width: stageSize.width, height: stageSize.height }}
                    onPointerDown={handleStagePointerDown}
                  >
                    <img
                      src={baseImageUrl}
                      alt={image.name}
                      className="h-full w-full rounded-[20px] object-contain shadow-2xl"
                      draggable={false}
                    />

                    <svg
                      className="absolute inset-0 h-full w-full"
                      viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                    >
                      {annotations.map((annotation) => {
                        const color = getAnnotationColorOption(annotation.color);
                        const isSelected = annotation.id === selectedId;
                        const strokeWidth = Math.max(imageSize.width, imageSize.height) * 0.006;
                        const handleRadius = Math.max(imageSize.width, imageSize.height) * 0.012;

                        return (
                          <g key={annotation.id}>
                            <path
                              d={getAnnotationPath(annotation)}
                              fill={annotation.filled ? color.fill : 'transparent'}
                              stroke={color.stroke}
                              strokeWidth={strokeWidth}
                              strokeLinejoin="round"
                              strokeLinecap="round"
                              className="cursor-move"
                              onPointerDown={(event) => startMove(event, annotation.id)}
                            />
                            <path
                              d={getAnnotationPath(annotation)}
                              fill="transparent"
                              stroke="transparent"
                              strokeWidth={Math.max(strokeWidth * 3, 30)}
                              className="cursor-move"
                              onPointerDown={(event) => startMove(event, annotation.id)}
                            />
                            <g pointerEvents="none">
                              <circle
                                cx={getAnnotationCenter(annotation).x}
                                cy={getAnnotationCenter(annotation).y}
                                r={Math.max(handleRadius * 1.15, 14)}
                                fill="rgba(15,23,42,0.82)"
                                stroke="white"
                                strokeWidth={Math.max(strokeWidth * 0.35, 2)}
                              />
                              <text
                                x={getAnnotationCenter(annotation).x}
                                y={getAnnotationCenter(annotation).y}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill="white"
                                fontSize={Math.max(handleRadius * 1.25, 14)}
                                fontWeight="700"
                              >
                                {annotation === selectedAnnotation
                                  ? selectedAnnotation
                                    ? annotations.findIndex((item) => item.id === selectedAnnotation.id) + 1
                                    : ''
                                  : annotations.findIndex((item) => item.id === annotation.id) + 1}
                              </text>
                            </g>

                            {isSelected &&
                              annotation.corners.map((corner, index) => (
                                <g key={`${annotation.id}-${index}`}>
                                  <line
                                    x1={corner.x}
                                    y1={corner.y}
                                    x2={annotation.corners[(index + 1) % 4].x}
                                    y2={annotation.corners[(index + 1) % 4].y}
                                    stroke="rgba(255,255,255,0.55)"
                                    strokeDasharray="12 10"
                                    strokeWidth={Math.max(strokeWidth * 0.5, 4)}
                                  />
                                  <circle
                                    cx={corner.x}
                                    cy={corner.y}
                                    r={handleRadius}
                                    fill={color.stroke}
                                    stroke="white"
                                    strokeWidth={Math.max(strokeWidth * 0.5, 3)}
                                    className="cursor-pointer"
                                    onPointerDown={(event) => startCornerDrag(event, annotation.id, index)}
                                  />
                                </g>
                              ))}
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                )}
              </div>
            </div>

            <aside className={`min-h-0 overflow-auto border-l px-5 py-6 ${
              darkMode ? 'border-gray-800 bg-gray-925' : 'border-gray-200/80 bg-white/70'
            }`}>
              <div className="space-y-5">
                <section>
                  <p className={`mb-3 text-xs font-semibold uppercase tracking-[0.2em] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    放置图形
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCreateMode('circle');
                        setActiveShape('circle');
                      }}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${
                        createMode === 'circle'
                          ? 'border-violet-500 bg-violet-500 text-white'
                          : darkMode
                            ? 'border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Circle className="mx-auto mb-2 h-4 w-4" />
                      圆形
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreateMode('rect');
                        setActiveShape('rect');
                      }}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${
                        createMode === 'rect'
                          ? 'border-violet-500 bg-violet-500 text-white'
                          : darkMode
                            ? 'border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Square className="mx-auto mb-2 h-4 w-4" />
                      方框
                    </button>
                  </div>
                  <p className={`mt-3 text-xs leading-5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    选择图形后，点击画布即可在对应位置创建标注；按 `Esc` 可退出放置模式。
                  </p>
                </section>

                <section className={`rounded-3xl border p-4 ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-[#fffdf8]'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">选中标注</p>
                      <p className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {selectedAnnotation
                          ? `当前为第 ${annotations.findIndex((annotation) => annotation.id === selectedAnnotation.id) + 1} 个标注`
                          : '未选中任何标注'}
                      </p>
                    </div>
                    {selectedAnnotation && (
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${darkMode ? 'bg-violet-500/15 text-violet-200' : 'bg-violet-100 text-violet-800'}`}>
                        #{annotations.findIndex((annotation) => annotation.id === selectedAnnotation.id) + 1}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={!selectedAnnotation}
                      onClick={() => applyShapeToSelected('circle')}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                        activeShape === 'circle'
                          ? 'border-cyan-500 bg-cyan-500 text-white'
                          : darkMode
                            ? 'border-gray-800 bg-gray-950 text-gray-300 hover:border-gray-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      改成圆形
                    </button>
                    <button
                      type="button"
                      disabled={!selectedAnnotation}
                      onClick={() => applyShapeToSelected('rect')}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                        activeShape === 'rect'
                          ? 'border-cyan-500 bg-cyan-500 text-white'
                          : darkMode
                            ? 'border-gray-800 bg-gray-950 text-gray-300 hover:border-gray-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      改成方框
                    </button>
                  </div>
                </section>

                <section>
                  <p className={`mb-3 text-xs font-semibold uppercase tracking-[0.2em] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    颜色
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    {ANNOTATION_COLOR_OPTIONS.map((color) => (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => {
                          setActiveColor(color.name);
                          if (selectedAnnotation) {
                            handleUpdateSelected((annotation) => ({ ...annotation, color: color.name }));
                          }
                        }}
                        className={`rounded-2xl border p-2 transition-all ${
                          (selectedAnnotation?.color || activeColor) === color.name
                            ? darkMode
                              ? 'border-white'
                              : 'border-gray-900'
                            : darkMode
                              ? 'border-gray-800'
                              : 'border-transparent'
                        }`}
                        title={color.label}
                      >
                        <div className="h-8 w-full rounded-xl" style={{ backgroundColor: color.stroke }} />
                      </button>
                    ))}
                  </div>
                </section>

                <section className={`rounded-3xl border p-4 ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-[#fffdf8]'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">区域填充</p>
                      <p className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>开启后会自动映射为“颜色区域”</p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleFill}
                      className={`relative h-7 w-12 rounded-full transition-colors ${
                        (selectedAnnotation?.filled ?? fillEnabled) ? 'bg-violet-500' : darkMode ? 'bg-gray-800' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          (selectedAnnotation?.filled ?? fillEnabled) ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </section>

                <section className={`rounded-3xl border p-4 ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-[#fffdf8]'}`}>
                  <p className="text-sm font-semibold">编辑提示</p>
                  <div className={`mt-3 space-y-2 text-xs leading-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    <p>拖动图形主体可移动标注位置，数字编号会同步映射到提示词。</p>
                    <p>拖动四个角点可做真实四角透视变形，支持圆形与方框互相切换。</p>
                    <p>快捷键：`C` 圆形，`R` 方框，`F` 填充，`Delete` 删除，`Ctrl/Cmd+Z` 撤销。</p>
                  </div>
                  {editorNotice && (
                    <div className={`mt-3 rounded-2xl px-3 py-2 text-xs font-medium ${
                      darkMode ? 'bg-amber-950/50 text-amber-300 ring-1 ring-amber-900' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                    }`}>
                      {editorNotice}
                    </div>
                  )}
                </section>

                <section className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={!history.length}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      darkMode ? 'border-gray-800 bg-gray-900 text-gray-200 hover:bg-gray-800' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Undo2 className="mx-auto mb-2 h-4 w-4" />
                    撤销
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={!future.length}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      darkMode ? 'border-gray-800 bg-gray-900 text-gray-200 hover:bg-gray-800' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Redo2 className="mx-auto mb-2 h-4 w-4" />
                    重做
                  </button>
                </section>

                <section className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={!selectedAnnotation}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      darkMode ? 'border-red-900 bg-red-950/40 text-red-300 hover:bg-red-950/60' : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                    }`}
                  >
                    <Eraser className="mx-auto mb-2 h-4 w-4" />
                    删除选中
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHistory((prev) => [...prev, deepCloneAnnotations(annotations)]);
                      setFuture([]);
                      setAnnotations([]);
                      setSelectedId(null);
                    }}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      darkMode ? 'border-amber-900 bg-amber-950/30 text-amber-300 hover:bg-amber-950/50' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    <CornerDownRight className="mx-auto mb-2 h-4 w-4" />
                    恢复原图
                  </button>
                </section>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                >
                  <Save className="mr-2 inline h-4 w-4" />
                  {saving ? '保存中...' : '保存并替换参考图'}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export type AnnotationColorName =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'blue'
  | 'purple';

export type AnnotationShape = 'circle' | 'rect';

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface AnnotationItem {
  id: string;
  type: AnnotationShape;
  color: AnnotationColorName;
  filled: boolean;
  corners: [AnnotationPoint, AnnotationPoint, AnnotationPoint, AnnotationPoint];
}

export interface AnnotationPromptToken {
  id: string;
  annotationId: string;
  color: AnnotationColorName;
  type: AnnotationShape;
  filled: boolean;
  label: string;
}

export interface AnnotationPromptEntry {
  referenceLabel: string;
  tokens: AnnotationPromptToken[];
}

export interface AnnotatedImageState {
  originalUrl?: string;
  annotations?: AnnotationItem[];
  annotationTokens?: AnnotationPromptToken[];
}

export interface AnnotationColorOption {
  name: AnnotationColorName;
  label: string;
  stroke: string;
  fill: string;
}

export const ANNOTATION_COLOR_OPTIONS: AnnotationColorOption[] = [
  { name: 'red', label: '红色', stroke: '#ef4444', fill: 'rgba(239,68,68,0.24)' },
  { name: 'orange', label: '橙色', stroke: '#f97316', fill: 'rgba(249,115,22,0.24)' },
  { name: 'yellow', label: '黄色', stroke: '#eab308', fill: 'rgba(234,179,8,0.24)' },
  { name: 'green', label: '绿色', stroke: '#22c55e', fill: 'rgba(34,197,94,0.24)' },
  { name: 'cyan', label: '青色', stroke: '#06b6d4', fill: 'rgba(6,182,212,0.24)' },
  { name: 'blue', label: '蓝色', stroke: '#3b82f6', fill: 'rgba(59,130,246,0.24)' },
  { name: 'purple', label: '紫色', stroke: '#a855f7', fill: 'rgba(168,85,247,0.24)' }
];

export function getAnnotationColorOption(color: AnnotationColorName): AnnotationColorOption {
  return ANNOTATION_COLOR_OPTIONS.find((option) => option.name === color) || ANNOTATION_COLOR_OPTIONS[0];
}

export function getAnnotationBaseLabel(annotation: Pick<AnnotationItem, 'color' | 'type' | 'filled'>): string {
  const colorLabel = getAnnotationColorOption(annotation.color).label;
  if (annotation.filled) {
    return `${colorLabel}区域`;
  }
  return annotation.type === 'circle' ? `${colorLabel}圆圈` : `${colorLabel}方框`;
}

export function getAnnotationLabel(annotation: Pick<AnnotationItem, 'color' | 'type' | 'filled'>): string {
  return getAnnotationBaseLabel(annotation);
}

export function hasDuplicateAnnotationLabel(
  target: Pick<AnnotationItem, 'color' | 'type' | 'filled'> & { id?: string },
  annotations: AnnotationItem[],
  ignoreId?: string
): boolean {
  const targetLabel = getAnnotationBaseLabel(target);
  return annotations.some((annotation) => {
    if (annotation.id === ignoreId) return false;
    return getAnnotationBaseLabel(annotation) === targetLabel;
  });
}

export function buildAnnotationPromptTokens(annotations: AnnotationItem[]): AnnotationPromptToken[] {
  return annotations.map((annotation) => {
    return {
    id: `anno_${annotation.id}`,
    annotationId: annotation.id,
    color: annotation.color,
    type: annotation.type,
    filled: annotation.filled,
    label: getAnnotationLabel(annotation)
    };
  });
}

export function buildAnnotationPromptBlock(tokens: AnnotationPromptToken[]): string {
  if (!tokens.length) return '';

  const lines = tokens.map((token) => `- ${token.label}：请严格按照参考图中该标注区域理解与执行要求`);
  return ['参考图标注说明：', ...lines].join('\n');
}

export function buildReferenceAnnotationPromptBlock(entries: AnnotationPromptEntry[]): string {
  const lines = entries.flatMap((entry) =>
    entry.tokens.map((token) => `- ${entry.referenceLabel} 的 ${token.label}：请严格按照参考图中该标注区域理解与执行要求`)
  );

  if (!lines.length) return '';
  return ['参考图标注说明：', ...lines].join('\n');
}

export function createAnnotationAtPoint(
  imageWidth: number,
  imageHeight: number,
  type: AnnotationShape,
  color: AnnotationColorName,
  center: AnnotationPoint
): AnnotationItem {
  const width = imageWidth * 0.26;
  const height = imageHeight * 0.2;
  const clampedCenter = clampPoint(center, imageWidth, imageHeight);
  const left = Math.min(Math.max(clampedCenter.x - width / 2, 0), Math.max(imageWidth - width, 0));
  const top = Math.min(Math.max(clampedCenter.y - height / 2, 0), Math.max(imageHeight - height, 0));

  return {
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    color,
    filled: false,
    corners: [
      { x: left, y: top },
      { x: left + width, y: top },
      { x: left + width, y: top + height },
      { x: left, y: top + height }
    ]
  };
}

export function createDefaultAnnotation(
  imageWidth: number,
  imageHeight: number,
  type: AnnotationShape,
  color: AnnotationColorName
): AnnotationItem {
  return createAnnotationAtPoint(imageWidth, imageHeight, type, color, {
    x: imageWidth / 2,
    y: imageHeight / 2
  });
}

export function clampPoint(point: AnnotationPoint, width: number, height: number): AnnotationPoint {
  return {
    x: Math.min(Math.max(point.x, 0), width),
    y: Math.min(Math.max(point.y, 0), height)
  };
}

export function translateAnnotation(
  annotation: AnnotationItem,
  dx: number,
  dy: number,
  imageWidth: number,
  imageHeight: number
): AnnotationItem {
  const moved = annotation.corners.map((corner) => clampPoint({ x: corner.x + dx, y: corner.y + dy }, imageWidth, imageHeight)) as AnnotationItem['corners'];
  return { ...annotation, corners: moved };
}

export function updateAnnotationCorner(
  annotation: AnnotationItem,
  cornerIndex: number,
  point: AnnotationPoint,
  imageWidth: number,
  imageHeight: number
): AnnotationItem {
  const nextCorners = annotation.corners.map((corner, index) =>
    index === cornerIndex ? clampPoint(point, imageWidth, imageHeight) : corner
  ) as AnnotationItem['corners'];

  return {
    ...annotation,
    corners: nextCorners
  };
}

export function getQuadPath(corners: AnnotationItem['corners']): string {
  return `M ${corners[0].x} ${corners[0].y} L ${corners[1].x} ${corners[1].y} L ${corners[2].x} ${corners[2].y} L ${corners[3].x} ${corners[3].y} Z`;
}

export function getAnnotationCenter(annotation: AnnotationItem): AnnotationPoint {
  const total = annotation.corners.reduce(
    (result, corner) => ({
      x: result.x + corner.x,
      y: result.y + corner.y
    }),
    { x: 0, y: 0 }
  );

  return {
    x: total.x / annotation.corners.length,
    y: total.y / annotation.corners.length
  };
}

function bilinearPoint(corners: AnnotationItem['corners'], u: number, v: number): AnnotationPoint {
  const [lt, rt, rb, lb] = corners;
  return {
    x:
      lt.x * (1 - u) * (1 - v) +
      rt.x * u * (1 - v) +
      rb.x * u * v +
      lb.x * (1 - u) * v,
    y:
      lt.y * (1 - u) * (1 - v) +
      rt.y * u * (1 - v) +
      rb.y * u * v +
      lb.y * (1 - u) * v
  };
}

export function getWarpedCirclePath(corners: AnnotationItem['corners'], samples = 36): string {
  const points: AnnotationPoint[] = [];

  for (let i = 0; i <= samples; i += 1) {
    const angle = (Math.PI * 2 * i) / samples;
    const u = 0.5 + Math.cos(angle) * 0.5;
    const v = 0.5 + Math.sin(angle) * 0.5;
    points.push(bilinearPoint(corners, u, v));
  }

  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ') + ' Z';
}

export function getAnnotationPath(annotation: AnnotationItem): string {
  return annotation.type === 'circle' ? getWarpedCirclePath(annotation.corners) : getQuadPath(annotation.corners);
}

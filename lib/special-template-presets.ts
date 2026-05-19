export const SPECIAL_TEMPLATE_3D_RENDER = '3d_ai_render';

export interface SpecialTemplateOption {
  label: string;
  value: string;
  description?: string;
}

export interface SpecialTemplateVariable {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'color' | 'select' | 'image';
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  options?: SpecialTemplateOption[];
  multiSelect?: boolean;
  maxSelections?: number;
  section?: string;
  sectionDescription?: string;
}

export interface SpecialTemplateCoverMetadata {
  title: string;
  description: string;
  badge?: string;
  specialTemplateType?: string;
  specialTemplateLabel?: string;
}

export interface SpecialTemplatePreset {
  name: string;
  description: string;
  promptTemplate: string;
  negativePrompt: string;
  defaultSize: string;
  defaultQuality: string;
  showMainVisual: boolean;
  allowUserPrompt: boolean;
  userPromptPriorityDefault: boolean;
  coverMetadata: SpecialTemplateCoverMetadata;
  variables: SpecialTemplateVariable[];
}

const QUALITY_PROMPT_ZH = [
  '高精度细节',
  '真实比例',
  '准确透视',
  '结构清晰',
  '边缘干净',
  '真实接触阴影',
  '材质纹理细腻',
  '商业级3D渲染质感'
];

const QUALITY_PROMPT_EN = [
  'highly detailed',
  'ultra realistic',
  'physically accurate rendering',
  'clean geometry',
  'realistic scale',
  'accurate perspective',
  'sharp focus',
  'refined edges',
  'realistic contact shadows',
  'high-resolution textures',
  'detailed surface imperfections',
  'professional 3D visualization',
  'premium commercial render',
  'no distortion',
  'no extra objects',
  'no messy background'
];

const SYSTEM_PROMPT_ZH = [
  '你需要将用户上传的参考图转化为专业3D渲染图。',
  '必须严格以原图为结构参考，保留原图的几何结构、比例、轮廓、布局、镜头角度和透视关系。',
  '除非用户明确要求改设计，否则只增强材质、灯光、渲染质量、空间氛围和真实感。',
  '避免随机文字、水印、结构变形、无关物体、错误阴影、物体漂浮和混乱背景。'
].join('\n');

const SYSTEM_PROMPT_EN = [
  'You are transforming the uploaded reference image into a professional 3D-rendered visualization.',
  'Use the uploaded image as the strict structural reference.',
  'Preserve the original geometry, proportions, silhouette, layout, camera angle, and perspective.',
  'Only enhance materials, lighting, rendering quality, atmosphere, and visual realism unless the user explicitly requests design changes.',
  'Avoid random text, watermark, distorted geometry, extra unrelated objects, incorrect shadows, floating objects, and messy background.'
].join(' ');

export const THREE_D_AI_RENDER_PRESET: SpecialTemplatePreset = {
  name: '3D AI 渲染特殊模板',
  description: '用于白膜、草图、线稿和灰模的结构化 3D 渲染模板，支持渲染任务、光照、材质、镜头、风格与约束条件配置。',
  promptTemplate: [
    '基于上传的白膜/草图/线稿进行 3D 渲染优化。',
    '严格保留原图的主体结构、比例关系、构图角度、空间布局和主要轮廓，不要擅自改变造型。',
    '',
    '将画面渲染为：{{renderTask}}',
    '场景类型：{{sceneType}}',
    '视觉风格：{{renderStyle}}',
    '材质系统：{{materials}}',
    '光照系统：{{lighting}}',
    '镜头语言：{{camera}}',
    '画面质量：{{qualityLevel}}',
    '约束要求：{{constraints}}',
    '补充要求：{{extraRequirements}}',
    '',
    '英文增强关键词：',
    '{{englishBoost}}',
    '',
    SYSTEM_PROMPT_ZH
  ].join('\n'),
  negativePrompt: [
    '不要改变原图主体结构。',
    '不要改变原图透视角度。',
    '不要改变原图比例关系。',
    '不要删除关键物体。',
    '不要添加无关装饰。',
    '不要添加文字、水印、logo，除非用户明确要求。',
    '不要生成卡通风。',
    '不要生成油腻塑料感。',
    '不要过度锐化。',
    '不要过度曝光。',
    '不要让材质显得廉价。',
    '不要让物体漂浮。',
    '不要出现错误阴影。',
    '不要出现混乱背景。'
  ].join('\n'),
  defaultSize: '1536x1024',
  defaultQuality: 'high',
  showMainVisual: true,
  allowUserPrompt: true,
  userPromptPriorityDefault: false,
  coverMetadata: {
    title: '3D AI 渲染',
    description: '白膜/草图/线稿一键转商业级 3D 渲染',
    badge: '特殊模板',
    specialTemplateType: SPECIAL_TEMPLATE_3D_RENDER,
    specialTemplateLabel: '3D AI 渲染'
  },
  variables: [
    {
      id: 'three_d_render_task',
      key: 'renderTask',
      label: '渲染任务',
      type: 'select',
      required: true,
      section: '任务类型',
      sectionDescription: '先定义本次渲染的基础目标，决定整体表达逻辑。',
      defaultValue: 'clay model to photorealistic 3D render',
      options: [
        { label: '白膜转写实渲染', value: 'clay model to photorealistic 3D render', description: '适合已有白膜、灰模或建模截图。' },
        { label: '草图转 3D 概念渲染', value: 'sketch to 3D concept render', description: '适合手绘草图和方案概念稿。' },
        { label: '线稿转产品渲染', value: 'line art to product render', description: '适合工业设计、包装和装置线稿。' },
        { label: '低模精修', value: 'low-poly model enhancement', description: '用于提升低模结构的完整度与质感。' },
        { label: '灰模材质上色', value: 'clay render materialization', description: '重点强化灯光与材质，不大改结构。' },
        { label: '展台空间渲染', value: 'exhibition booth visualization', description: '适合会展、展陈和快闪店方案。' },
        { label: '舞台空间渲染', value: 'stage design rendering', description: '适合发布会、论坛和演艺舞台。' },
        { label: '建筑外观渲染', value: 'architectural exterior visualization', description: '用于建筑、园区和展馆外立面。' },
        { label: '室内空间渲染', value: 'interior architectural visualization', description: '适合办公、酒店和展厅空间。' },
        { label: '产品级商业渲染', value: 'commercial product rendering', description: '适合产品海报与电商视觉。' },
        { label: '电影级概念渲染', value: 'cinematic concept rendering', description: '适合氛围图、KV 和概念图。' }
      ]
    },
    {
      id: 'three_d_scene_type',
      key: 'sceneType',
      label: '场景类型',
      type: 'select',
      required: true,
      section: '任务类型',
      sectionDescription: '将任务归到合适的场景语义，帮助模型理解空间类别。',
      defaultValue: '展台',
      options: [
        { label: '展台', value: '展台' },
        { label: '建筑', value: '建筑' },
        { label: '室内', value: '室内' },
        { label: '产品', value: '产品' },
        { label: '舞台', value: '舞台' },
        { label: '装置', value: '装置' },
        { label: '角色', value: '角色' },
        { label: '工业设计', value: '工业设计' }
      ]
    },
    {
      id: 'three_d_render_style',
      key: 'renderStyle',
      label: '视觉风格',
      type: 'select',
      required: true,
      multiSelect: true,
      maxSelections: 2,
      section: '风格基调',
      sectionDescription: '建议选择 1 到 2 个风格，不要堆砌过多视觉参考。',
      defaultValue: JSON.stringify(['photorealistic 3D render', 'premium commercial 3D rendering']),
      options: [
        { label: '写实 3D 渲染', value: 'photorealistic 3D render', description: '强调真实比例、光影和材质。' },
        { label: '高级商业渲染', value: 'premium commercial 3D rendering', description: '突出商业提案感和高级完成度。' },
        { label: '建筑可视化', value: 'architectural visualization, archviz', description: '适合建筑和空间展示。' },
        { label: '产品摄影级渲染', value: 'product photography style render', description: '靠近高端产品摄影表现。' },
        { label: '电影级 CGI', value: 'cinematic CGI render', description: '强调叙事氛围和戏剧光影。' },
        { label: '游戏引擎质感', value: 'Unreal Engine 5 style real-time rendering', description: '带有实时引擎的科技感与锐度。' },
        { label: 'V-Ray 建筑质感', value: 'V-Ray style architectural rendering', description: '常用于建筑和展厅。' },
        { label: 'Octane 高级光影', value: 'Octane render style', description: '高对比高级光影。' },
        { label: 'KeyShot 产品渲染', value: 'KeyShot product render style', description: '适合产品级商业出图。' },
        { label: 'Blender Cycles 写实', value: 'Blender Cycles realistic render', description: '细节和真实质感均衡。' },
        { label: 'Corona 室内渲染', value: 'Corona Renderer interior visualization', description: '偏柔和高端室内氛围。' },
        { label: 'Redshift 商业广告质感', value: 'Redshift commercial render', description: '偏广告和高光质感。' },
        { label: '极简白棚渲染', value: 'minimalist studio render', description: '适合干净的产品白棚图。' },
        { label: '高级奢华渲染', value: 'luxury premium render', description: '强调奢华材质和精致氛围。' },
        { label: '科技未来感渲染', value: 'futuristic tech render', description: '适合科技展台与装置。' },
        { label: '艺术装置渲染', value: 'artistic installation render', description: '适合艺术性空间表达。' },
        { label: '博物馆展陈渲染', value: 'museum exhibition visualization', description: '适合展陈和馆陈空间。' },
        { label: '会展提案级渲染', value: 'professional event proposal rendering', description: '适合提案效果图。' }
      ]
    },
    {
      id: 'three_d_lighting',
      key: 'lighting',
      label: '光照系统',
      type: 'select',
      required: true,
      multiSelect: true,
      maxSelections: 4,
      section: '光照系统',
      sectionDescription: '组合基础真实光照和氛围光照，控制整体层次与戏剧性。',
      defaultValue: JSON.stringify(['global illumination', 'ray traced shadows', 'ambient occlusion', 'contact shadows']),
      options: [
        { label: '全局光照', value: 'global illumination' },
        { label: '光线追踪阴影', value: 'ray traced shadows' },
        { label: '环境光遮蔽', value: 'ambient occlusion' },
        { label: '接触阴影', value: 'contact shadows' },
        { label: '反弹光', value: 'bounce lighting' },
        { label: '柔和阴影', value: 'soft shadows' },
        { label: '硬边阴影', value: 'hard shadows' },
        { label: '物理真实光照', value: 'physically accurate lighting' },
        { label: 'HDRI 照明', value: 'HDRI lighting' },
        { label: '面积光柔光箱', value: 'area light softbox' },
        { label: '大型柔光棚', value: 'large studio softbox lighting' },
        { label: '顶部柔光', value: 'overhead soft lighting' },
        { label: '侧向柔光', value: 'side soft light' },
        { label: '背景补光', value: 'background fill light' },
        { label: '环境漫射光', value: 'diffused ambient light' },
        { label: '体积光', value: 'volumetric lighting' },
        { label: '轮廓光', value: 'rim light accent' },
        { label: '三点布光', value: 'three-point lighting setup' },
        { label: '逆光', value: 'backlighting' },
        { label: '低调光', value: 'low-key lighting' },
        { label: '高调光', value: 'high-key lighting' },
        { label: '舞台光束', value: 'theatrical light beams' },
        { label: 'LED 氛围光', value: 'LED ambient glow' },
        { label: '霓虹光', value: 'neon lighting' },
        { label: '泛光灯', value: 'flood lighting' },
        { label: '聚光灯', value: 'spotlight' },
        { label: '彩色渐变光', value: 'colored gradient lighting' },
        { label: '焦散光斑', value: 'caustic light patterns' },
        { label: '镜面反射高光', value: 'specular highlights' },
        { label: '泛光辉光', value: 'bloom glow' },
        { label: '镜头光晕', value: 'lens flare' },
        { label: '光雾', value: 'light haze' },
        { label: '丁达尔光', value: 'god rays, crepuscular rays' },
        { label: '柔焦高光', value: 'soft highlight rolloff' }
      ]
    },
    {
      id: 'three_d_materials',
      key: 'materials',
      label: '材质系统',
      type: 'select',
      required: true,
      multiSelect: true,
      maxSelections: 5,
      section: '材质系统',
      sectionDescription: '按主体选择 3 到 5 个关键词，集中描述主要材质语言。',
      defaultValue: JSON.stringify(['PBR materials', 'brushed metal', 'translucent acrylic']),
      options: [
        { label: 'PBR 材质', value: 'PBR materials' },
        { label: '次表面散射', value: 'subsurface scattering' },
        { label: '金属粗糙度', value: 'metallic roughness' },
        { label: '各向异性反射', value: 'anisotropic reflection' },
        { label: '菲涅耳效果', value: 'fresnel effect' },
        { label: '置换贴图', value: 'displacement mapping' },
        { label: '法线贴图细节', value: 'normal map detail' },
        { label: '透光着色器', value: 'translucency shader' },
        { label: '程序化材质', value: 'procedural materials' },
        { label: '微表面细节', value: 'micro surface detail' },
        { label: '真实反射', value: 'realistic reflections' },
        { label: '真实折射', value: 'realistic refraction' },
        { label: '粗糙度变化', value: 'roughness variation' },
        { label: '细微磨损', value: 'subtle edge wear' },
        { label: '倒角高光', value: 'bevelled edge highlights' },
        { label: '拉丝金属', value: 'brushed metal' },
        { label: '镜面金属', value: 'polished mirror metal' },
        { label: '阳极氧化铝', value: 'anodized aluminum' },
        { label: '香槟金金属', value: 'champagne gold metal' },
        { label: '黑钛金属', value: 'black titanium metal' },
        { label: '不锈钢', value: 'stainless steel' },
        { label: '哑光金属', value: 'matte metal' },
        { label: '铜质氧化', value: 'oxidized copper' },
        { label: '铬面反射', value: 'chrome reflective surface' },
        { label: '金属边框倒角', value: 'beveled metallic edges' },
        { label: '透明玻璃', value: 'clear glass' },
        { label: '磨砂玻璃', value: 'frosted glass' },
        { label: '有机玻璃 / 亚克力', value: 'acrylic material' },
        { label: '半透明亚克力', value: 'translucent acrylic' },
        { label: '彩色透明亚克力', value: 'colored transparent acrylic' },
        { label: '玻璃折射', value: 'glass refraction' },
        { label: '玻璃焦散', value: 'glass caustics' },
        { label: '水晶质感', value: 'crystal-like material' },
        { label: '高透光材质', value: 'high-transparency material' },
        { label: '边缘发光亚克力', value: 'edge-lit acrylic' },
        { label: '胡桃木', value: 'walnut wood' },
        { label: '橡木', value: 'oak wood' },
        { label: '木纹贴图', value: 'natural wood grain texture' },
        { label: '大理石', value: 'marble material' },
        { label: '洞石', value: 'travertine stone' },
        { label: '水磨石', value: 'terrazzo' },
        { label: '微水泥', value: 'microcement' },
        { label: '清水混凝土', value: 'fair-faced concrete' },
        { label: '哑光石材', value: 'matte stone surface' },
        { label: '石材纹理置换', value: 'stone displacement texture' },
        { label: '高级织物', value: 'premium fabric' },
        { label: '绒面材质', value: 'velvet material' },
        { label: '亚麻纹理', value: 'linen texture' },
        { label: '皮革', value: 'leather material' },
        { label: '纳帕皮', value: 'nappa leather' },
        { label: '软包材质', value: 'upholstered padding' },
        { label: '缝线细节', value: 'stitching detail' },
        { label: '织物法线纹理', value: 'fabric normal map detail' },
        { label: '柔软漫反射', value: 'soft diffuse fabric shading' },
        { label: '哑光塑料', value: 'matte plastic' },
        { label: '高光塑料', value: 'glossy plastic' },
        { label: '软触感涂层', value: 'soft-touch coating' },
        { label: '半透明塑料', value: 'translucent plastic' },
        { label: '工程塑料', value: 'engineering plastic' },
        { label: '橡胶材质', value: 'rubber material' },
        { label: '细腻磨砂表面', value: 'fine matte surface' },
        { label: '产品级外壳质感', value: 'product-grade shell material' },
        { label: '自发光材质', value: 'emissive material' },
        { label: 'LED 屏幕', value: 'LED screen material' },
        { label: '霓虹发光', value: 'neon glow' },
        { label: '灯带发光', value: 'LED strip lighting' },
        { label: '柔和屏幕光', value: 'soft screen glow' },
        { label: '像素点细节', value: 'visible pixel grid detail' },
        { label: '发光边缘', value: 'glowing edges' },
        { label: '透明屏效果', value: 'transparent LED screen effect' },
        { label: '全息投影', value: 'holographic projection material' }
      ]
    },
    {
      id: 'three_d_camera',
      key: 'camera',
      label: '镜头语言',
      type: 'select',
      required: true,
      multiSelect: true,
      maxSelections: 3,
      section: '镜头与构图',
      sectionDescription: '组合视角、焦段和构图，让结果更接近真实出图语法。',
      defaultValue: JSON.stringify(['perspective view', 'wide-angle lens, 24mm', 'cinematic composition']),
      options: [
        { label: '正视图', value: 'front view' },
        { label: '侧视图', value: 'side view' },
        { label: '俯视图', value: 'top-down view' },
        { label: '鸟瞰图', value: 'aerial view, bird’s-eye view' },
        { label: '等轴测', value: 'isometric view' },
        { label: '透视视角', value: 'perspective view' },
        { label: '广角镜头', value: 'wide-angle lens, 24mm' },
        { label: '标准镜头', value: '35mm lens, 50mm lens' },
        { label: '长焦压缩', value: 'telephoto compression, 85mm lens' },
        { label: '微距镜头', value: 'macro lens' },
        { label: '浅景深', value: 'shallow depth of field' },
        { label: '深景深', value: 'deep focus' },
        { label: '移轴镜头', value: 'tilt-shift lens' },
        { label: '电影构图', value: 'cinematic composition' },
        { label: '居中构图', value: 'centered composition' },
        { label: '三分法构图', value: 'rule of thirds composition' },
        { label: '对称构图', value: 'symmetrical composition' }
      ]
    },
    {
      id: 'three_d_constraints',
      key: 'constraints',
      label: '约束条件',
      type: 'select',
      required: true,
      multiSelect: true,
      maxSelections: 6,
      section: '约束条件',
      sectionDescription: '这些规则会直接写入提示词，约束模型不要乱改结构。',
      defaultValue: JSON.stringify([
        '严格保留原图结构',
        '保持原图透视',
        '保持原图比例',
        '不添加无关物体',
        '不添加文字水印'
      ]),
      options: [
        { label: '严格保留原图结构', value: '严格保留原图结构' },
        { label: '保持原图透视', value: '保持原图透视' },
        { label: '保持原图比例', value: '保持原图比例' },
        { label: '不添加无关物体', value: '不添加无关物体' },
        { label: '不添加文字水印', value: '不添加文字水印' },
        { label: '只增强材质和灯光', value: '只增强材质和灯光' },
        { label: '不要过度曝光', value: '不要过度曝光' },
        { label: '不要错误阴影', value: '不要错误阴影' },
        { label: '不要廉价塑料感', value: '不要廉价塑料感' },
        { label: '不要混乱背景', value: '不要混乱背景' }
      ]
    },
    {
      id: 'three_d_extra_requirements',
      key: 'extraRequirements',
      label: '补充要求',
      type: 'textarea',
      required: false,
      section: '补充说明',
      sectionDescription: '这里填写项目特定要求，例如品牌氛围、应用场景或禁忌项。',
      defaultValue: '无额外要求',
      placeholder: '例如：整体偏高端科技感，材质不要过于冰冷，保留主入口导视关系。'
    },
    {
      id: 'three_d_english_boost',
      key: 'englishBoost',
      label: '英文增强关键词',
      type: 'textarea',
      required: false,
      section: '补充说明',
      sectionDescription: '如果需要额外强化英文渲染词，可以单独补充。',
      defaultValue: '',
      placeholder: '例如：premium event proposal rendering, clean geometry, realistic contact shadows'
    }
  ]
};

function safeParseArray(value: string | undefined): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
  } catch {
    return value
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function joinOptionValues(options: SpecialTemplateOption[], selectedValues: string[]): string {
  const selected = options.filter((option) => selectedValues.includes(option.value));
  return selected.map((option) => `${option.label} (${option.value})`).join('，');
}

function joinConstraintValues(options: SpecialTemplateOption[], selectedValues: string[]): string {
  const selected = options.filter((option) => selectedValues.includes(option.value));
  return selected.map((option) => option.label).join('，');
}

export function buildThreeDAIRenderPrompt(formData: Record<string, string>): string {
  const variableMap = Object.fromEntries(
    THREE_D_AI_RENDER_PRESET.variables.map((variable) => [variable.key, variable])
  ) as Record<string, SpecialTemplateVariable>;

  const renderTask = variableMap.renderTask.options?.find((option) => option.value === formData.renderTask);
  const sceneType = formData.sceneType || '未指定';
  const renderStyles = safeParseArray(formData.renderStyle);
  const lighting = safeParseArray(formData.lighting);
  const materials = safeParseArray(formData.materials);
  const camera = safeParseArray(formData.camera);
  const constraints = safeParseArray(formData.constraints);
  const extraRequirements = (formData.extraRequirements || '无额外要求').trim();
  const englishBoostInput = (formData.englishBoost || '').trim();

  const renderStyleText = joinOptionValues(variableMap.renderStyle.options || [], renderStyles);
  const lightingText = joinOptionValues(variableMap.lighting.options || [], lighting);
  const materialsText = joinOptionValues(variableMap.materials.options || [], materials);
  const cameraText = joinOptionValues(variableMap.camera.options || [], camera);
  const constraintsText = joinConstraintValues(variableMap.constraints.options || [], constraints);

  const englishKeywords = [
    renderTask?.value,
    sceneType,
    ...renderStyles,
    ...materials,
    ...lighting,
    ...camera,
    ...constraints.map((item) => {
      const found = variableMap.constraints.options?.find((option) => option.value === item);
      return found?.label || item;
    }),
    ...QUALITY_PROMPT_EN,
    SYSTEM_PROMPT_EN,
    englishBoostInput
  ].filter(Boolean);

  return [
    '基于上传的白膜/草图/线稿进行 3D 渲染优化。',
    '严格保留原图的主体结构、比例关系、构图角度、空间布局和主要轮廓，不要擅自改变造型。',
    '',
    `将画面渲染为：${renderTask ? `${renderTask.label} (${renderTask.value})` : '未指定'}`,
    `场景类型：${sceneType}`,
    `视觉风格：${renderStyleText || '未指定'}`,
    `材质系统：${materialsText || '未指定'}`,
    `光照系统：${lightingText || '未指定'}`,
    `镜头语言：${cameraText || '未指定'}`,
    `画面质量：${QUALITY_PROMPT_ZH.join('，')}`,
    `约束要求：${constraintsText || '未指定'}`,
    `补充要求：${extraRequirements}`,
    '',
    '英文增强关键词：',
    englishKeywords.join(', '),
    '',
    SYSTEM_PROMPT_ZH
  ].join('\n');
}

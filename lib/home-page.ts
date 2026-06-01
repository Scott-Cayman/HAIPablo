export interface HomeCoverImage {
  id: string;
  url: string;
  name: string;
}

export interface HomeTemplate {
  id: string;
  name: string;
  description?: string | null;
  featureGroupId?: string;
  featureGroup?: {
    id?: string;
    key: string;
    name: string;
  } | null;
  coverImage?: HomeCoverImage | null;
  coverMetadata?: {
    title?: string;
    description?: string;
    badge?: string;
  } | null;
}

export interface HomeFeatureGroup {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  templates: HomeTemplate[];
}

const GROUP_GRADIENTS: Record<string, string> = {
  material_extension: 'from-blue-400 to-indigo-500',
  poster_generation: 'from-sky-400 to-blue-500',
  portrait_generation: 'from-emerald-400 to-teal-500',
  countdown: 'from-orange-400 to-red-500',
  success_report: 'from-rose-400 to-pink-500'
};

const FALLBACK_GRADIENTS = [
  'from-blue-400 to-indigo-500',
  'from-orange-400 to-red-500',
  'from-violet-400 to-purple-500',
  'from-pink-400 to-rose-500',
  'from-emerald-400 to-teal-500',
  'from-slate-400 to-slate-500'
];

export const getTemplateImageUrl = (template?: HomeTemplate | null) => template?.coverImage?.url ?? null;

export const getTemplateGradient = (
  template?: Pick<HomeTemplate, 'featureGroup'> | null,
  index = 0
) => {
  const groupKey = template?.featureGroup?.key;
  if (groupKey && GROUP_GRADIENTS[groupKey]) {
    return GROUP_GRADIENTS[groupKey];
  }

  return FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length];
};

export const pickFeaturePreviewTemplates = (
  groups: HomeFeatureGroup[],
  groupKey: string,
  limit = 2
) => {
  const group = groups.find((item) => item.key === groupKey);
  if (!group) return [];

  return group.templates.slice(0, limit).map((template) => ({
    ...template,
    featureGroup: template.featureGroup ?? {
      id: group.id,
      key: group.key,
      name: group.name
    }
  }));
};

export const pickFeatureHeroTemplate = (groups: HomeFeatureGroup[], groupKey: string) => {
  const groupTemplates = pickFeaturePreviewTemplates(groups, groupKey, 6);
  const groupWithCover = groupTemplates.find((template) => getTemplateImageUrl(template));
  if (groupWithCover) {
    return groupWithCover;
  }

  return groupTemplates[0] ?? null;
};

export const pickCommonTemplates = (groups: HomeFeatureGroup[], limit = 4) => {
  const templates = groups.flatMap((group) =>
    group.templates.map((template) => ({
      ...template,
      featureGroup: template.featureGroup ?? {
        id: group.id,
        key: group.key,
        name: group.name
      }
    }))
  );

  return templates
    .sort((left, right) => {
      const leftHasCover = getTemplateImageUrl(left) ? 1 : 0;
      const rightHasCover = getTemplateImageUrl(right) ? 1 : 0;
      return rightHasCover - leftHasCover;
    })
    .slice(0, limit);
};

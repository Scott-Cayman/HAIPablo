'use client';

import { ThreeDAIRenderMainColumn, ThreeDAIRenderSidebar, threeDAIRenderWorkspaceLayout } from './three-d-ai-render/ThreeDAIRenderWorkspace';

export interface SpecialTemplateWorkspaceModule {
  layout: {
    containerClassName: string;
    gridClassName: string;
    mainColumnClassName: string;
    sidebarClassName: string;
  };
  MainColumn: React.ComponentType<any>;
  SidebarColumn: React.ComponentType<any>;
}

const specialTemplateWorkspaceRegistry: Record<string, SpecialTemplateWorkspaceModule> = {
  cmpc0gpxx000dj7djl51ojxus: {
    layout: threeDAIRenderWorkspaceLayout,
    MainColumn: ThreeDAIRenderMainColumn,
    SidebarColumn: ThreeDAIRenderSidebar
  }
};

export function getSpecialTemplateWorkspace(templateId?: string | null): SpecialTemplateWorkspaceModule | null {
  if (!templateId) return null;
  return specialTemplateWorkspaceRegistry[templateId] || null;
}

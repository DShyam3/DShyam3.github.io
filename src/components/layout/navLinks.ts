import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ALL_APP_MANIFESTS } from '@/apps/useActiveApp';
import type { AppGroup, AppManifest } from '@/apps/types';

export interface SiteNavLink {
  id: string;
  to: string;
  label: string;
  tagline: string;
  group: AppGroup;
  requiresAuth?: boolean;
  accentHsl?: string;
}

function toNavLink(app: AppManifest): SiteNavLink {
  return {
    id: app.id,
    to: app.basePath,
    label: app.name,
    tagline: app.tagline,
    group: app.group,
    requiresAuth: app.requiresAuth,
    accentHsl: app.accentHsl,
  };
}

/** The suite's registered apps and pages, minus any this visitor cannot open. */
export function useSiteNavLinks(): SiteNavLink[] {
  const { isAdmin } = useAuth();
  return useMemo(
    () =>
      ALL_APP_MANIFESTS
        .filter((app) => app.showInNav !== false && app.group !== 'system')
        .filter((app) => !app.requiresAuth || isAdmin)
        .map(toNavLink),
    [isAdmin],
  );
}

import { useLocation } from 'react-router-dom';
import { CORE_APP_MANIFESTS, resolveAppByPath } from './manifests';
import { PORTABLE_APPS } from './portable';
import type { AppManifest } from './types';

/** All registered apps: built-in suite apps plus any portable drop-in apps. */
export const ALL_APP_MANIFESTS: readonly AppManifest[] = [
  ...CORE_APP_MANIFESTS,
  ...PORTABLE_APPS,
];

/** Returns the manifest for whichever app owns the current URL pathname. */
export function useActiveApp(): AppManifest | undefined {
  const { pathname } = useLocation();
  return resolveAppByPath(pathname, ALL_APP_MANIFESTS);
}

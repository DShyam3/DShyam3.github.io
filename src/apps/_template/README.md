# Portable App Starter Template

Develop any standalone page and drop it into the suite in two steps:

1. **Copy this template** to `src/apps/<your-app>/<YourApp>.tsx` (or anywhere under `src/pages/` or `src/features/`).
2. **Register it once** in `src/apps/portable.tsx`:

```tsx
import { lazy } from 'react';
import { SFSparkles } from '@/components/ui/sf-symbols';
import { definePortableApp } from './types';

const MyApp = lazy(() => import('./my-app/MyApp'));

export const PORTABLE_APPS = [
  definePortableApp({
    id: 'my-app',
    basePath: '/my-app',
    name: 'My App',
    tagline: 'Short Subtitle',
    description: 'One-sentence description for browser tab and link previews.',
    icon: SFSparkles,
    group: 'app',
    accentHsl: '205 82% 58%', // Optional custom accent colour (raw HSL channels)
    element: <MyApp />,
  }),
];
```

### What happens automatically
- **Routing**: Mounted at `basePath` (open `/my-app?standalone=1` to launch with the sidebar collapsed).
- **Shell**: Wrapped in `<AppShell>` (Header, Apps sidebar, scrollable middle card, Footer). Set `wrapInShell: false` if your page renders its own `<AppShell>` with a custom `toolbar` or `layout="workspace"`.
- **Navigation**: Added to the desktop sidebar, mobile App Switcher, and `⌘K` Command Palette with its icon and accent colour.
- **Metadata & Isolation**: Gets its own browser tab title, Open Graph description, and `RouteErrorBoundary` isolation.

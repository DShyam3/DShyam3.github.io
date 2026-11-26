import type { PortableAppDefinition } from './types';

/**
 * Drop-in portable apps.
 *
 * To add a new standalone page/app to the suite, create your component and
 * append a single `definePortableApp({ ... })` entry here. It automatically:
 *   1. Mounts at `basePath` inside the shared Header / Sidebar / Middle Card / Footer frame
 *   2. Appears in the left sidebar page list, mobile App Switcher, and ⌘K palette
 *   3. Gets its own app-first header identity, browser tab title, and error boundary
 *
 * Example:
 *   definePortableApp({
 *     id: 'notes',
 *     basePath: '/notes',
 *     name: 'Notes',
 *     tagline: 'Scratchpad',
 *     description: 'Quick personal notes and snippets.',
 *     icon: SFNoteText,
 *     group: 'app',
 *     accentHsl: '205 82% 58%',
 *     element: <NotesPage />,
 *   })
 */
export const PORTABLE_APPS: readonly PortableAppDefinition[] = [];

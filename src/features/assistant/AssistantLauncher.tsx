/**
 * The assistant's way in, mounted by AppShell on every route.
 *
 * Renders nothing unless the visitor is an administrator and the Edge
 * Function reports a provider with a key. The panel itself is a separate
 * chunk, fetched on first hover or focus and mounted on first open, so a
 * visitor who never asks downloads none of it.
 *
 * Header hands this two places and it shows in one per width: the header's
 * control cluster from 768px, where it fits on every route, and the menu
 * panel's action row below that, where the cluster is already full. Each copy
 * hides itself rather than sitting in a wrapper, so with nothing to offer
 * there is no empty box to take a gap.
 */

import { lazy, Suspense, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import type { MenuControls } from '@/components/layout/NavMenu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAssistantProvider } from './useAssistantProvider';

const loadPanel = () => import('./AssistantPanel');
const AssistantPanel = lazy(loadPanel);

interface AssistantLauncherProps {
  placement: 'header' | 'menu';
  /** Present in the menu placement: the panel closes, and focus returns to its button. */
  menu?: MenuControls;
}

export function AssistantLauncher({ placement, menu }: AssistantLauncherProps) {
  const { isAdmin } = useAuth();
  const provider = useAssistantProvider(isAdmin);
  const [open, setOpen] = useState(false);
  // Kept mounted once opened, so the sheet can animate closed.
  const [mounted, setMounted] = useState(false);
  // The sheet is opened by state rather than by a SheetTrigger, so Radix has
  // no trigger to hand focus back to; it is told where instead.
  const headerButton = useRef<HTMLButtonElement>(null);

  if (!provider) return null;

  const warm = () => { void loadPanel(); };
  const openPanel = () => {
    // The menu closes first: its button is where focus goes back to, since
    // this one is hidden inside the closed panel by then.
    menu?.close();
    setMounted(true);
    setOpen(true);
  };

  return (
    <>
      {placement === 'header' ? (
        // The same plain, labelled control as the menu beside it, for the
        // reason NavMenu gives: a bare glyph next to the theme toggle reads
        // as decoration rather than as something to press.
        <button
          ref={headerButton}
          type="button"
          onClick={openPanel}
          onPointerEnter={warm}
          onFocus={warm}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            'nav-link hidden min-h-11 flex-shrink-0 items-center rounded px-2 py-1.5 md:flex',
            'ring-offset-background hover:bg-secondary/70 focus-visible:outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            open && 'bg-secondary/70',
          )}
        >
          <DotMatrixText text="ASK" size="xs" />
          <span className="sr-only">Ask the site assistant</span>
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="md:hidden"
          onClick={openPanel}
          onPointerEnter={warm}
          onFocus={warm}
          aria-haspopup="dialog"
        >
          <MessageSquare aria-hidden="true" />
          Ask the site
        </Button>
      )}
      {mounted && (
        <Suspense fallback={null}>
          <AssistantPanel
            provider={provider}
            open={open}
            onOpenChange={setOpen}
            returnFocusTo={menu ? menu.trigger : () => headerButton.current}
          />
        </Suspense>
      )}
    </>
  );
}

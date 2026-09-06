import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { DotMatrixIcon } from '@/components/dot-matrix/DotMatrixIcon';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { useSiteNavLinks } from './navLinks';
import { cn } from '@/lib/utils';

/**
 * The site nav, at every width.
 *
 * It replaced a strip of thirteen Doto labels that only fitted from about
 * 1400px and side-scrolled with a hidden scrollbar below that. The strip is
 * gone rather than kept for wide screens: one nav that behaves the same on
 * every screen beats two that diverge, and dropping the second header row
 * gives the card wall back 41px on every one of them.
 *
 * A disclosure rather than a drawer or an overlay: it opens downward from the
 * header's own bottom edge, in the header's colours, and closes on Escape, on
 * a click outside and on navigating. Nothing slides in from off-screen, which
 * would have been the one piece of motion on the site that came from
 * somewhere other than where you clicked.
 *
 * Both halves are returned as a fragment so the panel's `absolute` resolves
 * against `header.app-header` -- the button sits in the header's right-hand
 * cluster, while the panel spans the full header width underneath it.
 */
export function NavMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const links = useSiteNavLinks();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on navigating. The panel is not unmounted by the route change --
  // it lives in the shell, which outlives every page.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      // Escape has to hand focus back, or a keyboard user is dropped at the
      // top of the document with no idea where they were.
      buttonRef.current?.focus();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    // Capture, so a click that lands on something which stops propagation
    // still closes the panel.
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open]);

  return (
    <>
      {/* Deliberately not the ghost Button: that variant hovers to
          `bg-accent`, which is orange here. It reads fine behind a 36px icon
          square like the theme toggle, but as a wide labelled block it
          announced itself louder than anything else in the header. This is
          the link it replaces, styled as one. */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          'nav-link flex flex-shrink-0 items-center gap-2 rounded px-2 py-1.5',
          'ring-offset-background hover:bg-secondary/70 focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          // The fill alone marks the open state. `nav-link-active` also
          // brings text-foreground, font-bold and a 1.04 scale, which
          // thickened and darkened the glyph's dots on open -- the one thing
          // in the header that should look identical in both states, since
          // it is the same nine cells either way.
          open && 'bg-secondary/70',
          className,
        )}
      >
        <DotMatrixIcon icon="menu" size="grid" />
        {/* Labelled at every width, phones included. Bare, the glyph is a
            3x3 of dots sitting next to the theme toggle's dot cluster, and
            the pair read as two pieces of decoration rather than a control.
            It costs about 47px on a phone, which the row has.

            Both words occupy the same grid cell, so the button is always as
            wide as the longer of the two and only the text changes on open.
            Swapping one label for the other reflowed the button, which
            dragged the glyph left by the width of a character -- the one
            part of the control that should never move, since it is the same
            nine cells in both states. */}
        <span className="grid">
          <DotMatrixText
            text="MENU"
            size="xs"
            className={cn('col-start-1 row-start-1', open && 'invisible')}
          />
          <DotMatrixText
            text="CLOSE"
            size="xs"
            className={cn('col-start-1 row-start-1', !open && 'invisible')}
          />
        </span>
        <span className="sr-only">
          {open ? 'Close navigation menu' : 'Open navigation menu'}
        </span>
      </button>

      <div
        id={panelId}
        ref={panelRef}
        hidden={!open}
        // A panel, not a second header band: it is inset from the header's
        // own edges, rounded, and floats on its shadow. Full-bleed with a
        // bottom rule read as the site growing a third row rather than as
        // something you had opened and could close.
        // The shell clips at one viewport now, so a panel taller than the
        // room under the header would be cut off with no way to reach the
        // rest. It fits today at every size; this is the guard for the day it
        // does not.
        className="app-scroll absolute left-2 right-2 top-full z-40 mt-2 max-h-[65dvh] overflow-y-auto rounded-xl border border-border bg-background p-2 shadow-[0_2px_4px_-2px_hsl(30_10%_15%/0.12),0_18px_40px_-12px_hsl(30_10%_15%/0.28)] sm:p-3 md:left-0 md:right-0 dark:shadow-[0_2px_4px_-2px_hsl(0_0%_0%/0.5),0_18px_40px_-12px_hsl(0_0%_0%/0.7)]"
      >
        <nav
          aria-label="Site"
          // Two columns on a phone, four once there is room. Thirteen labels
          // in one column would have been taller than a phone screen. The
          // grid carries no negative margin: a row's hover fill is the panel's
          // padding box inset, so the highlight stops short of the border
          // instead of running out past it.
          className="grid grid-cols-2 gap-x-1 gap-y-0.5 sm:grid-cols-3 lg:grid-cols-4"
        >
          {links.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'nav-link rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/60',
                  active && 'nav-link-active bg-secondary/60',
                )}
              >
                <DotMatrixText
                  text={link.label.toUpperCase()}
                  size="xs"
                  className="nav-label"
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

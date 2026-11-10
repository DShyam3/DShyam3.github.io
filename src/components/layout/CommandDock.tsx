import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { ArrowUpRight, Compass, Search, Terminal, X } from 'lucide-react';
import { useWorkspaceInspector } from '@/contexts/WorkspaceInspectorContext';
import { collections } from '@/collections/registry';
import { collectionQuery } from '@/collections/useCollection';
import {
  MIN_RECORD_QUERY_LENGTH,
  searchRecords,
  type RecordHit,
} from '@/collections/record-search';
import type { CollectionRow } from '@/collections/types';
import { DialogOverlay } from '@/components/ui/dialog';
import { ignoreOverlayPointerDown } from '@/components/ui/dismiss-on-release';
import { cn } from '@/lib/utils';
import { useSiteNavLinks } from './navLinks';
import { useReturnFocus } from './useReturnFocus';

/**
 * The bar above the footer and the palette it opens: jump to a section, or
 * find a record by its title. It searches rows the site has already read and
 * answers no questions.
 *
 * The palette is a combobox: focus stays in the input, the arrow keys move a
 * highlight through the results, and Enter opens the highlighted one. Radix
 * supplies the modal half -- the focus trap and Escape -- and
 * `useReturnFocus` hands focus back to whatever opened it.
 */
export function CommandDock() {
  const { commandOpen, setCommandOpen } = useWorkspaceInspector();
  const links = useSiteNavLinks();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const returnFocus = useReturnFocus();
  const [query, setQueryState] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const setQuery = (next: string) => {
    setQueryState(next);
    setActiveIndex(0);
  };

  useEffect(() => {
    if (!commandOpen) return;
    setQueryState('');
    setActiveIndex(0);
  }, [commandOpen]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(!commandOpen);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandOpen, setCommandOpen]);

  const normalizedQuery = query.trim().toLowerCase();
  const searching = commandOpen && normalizedQuery.length >= MIN_RECORD_QUERY_LENGTH;

  // Only collections this visitor can open and that have a search box, since
  // the palette matches the same fields that box does.
  const searchable = useMemo(
    () =>
      collections.filter(
        (config) =>
          config.searchFields?.length && links.some((link) => link.to === config.path),
      ),
    [links],
  );
  const results = useQueries({
    queries: searchable.map((config) => ({
      ...collectionQuery<CollectionRow, unknown>(config),
      enabled: searching,
    })),
  });

  const sources = searchable.map((config, index) => ({ config, rows: results[index]?.data }));
  const recordHits = searching ? searchRecords(sources, normalizedQuery) : [];
  const recordsLoading = searching && results.some((result) => result.isLoading);
  const recordsFailed = searching && results.some((result) => result.isError);

  const filteredLinks = useMemo(() => {
    if (!normalizedQuery) return links;
    return links.filter(
      (link) =>
        link.label.toLowerCase().includes(normalizedQuery) ||
        link.to.toLowerCase().includes(normalizedQuery),
    );
  }, [links, normalizedQuery]);

  const handleSelectRoute = (to: string) => {
    returnFocus.forget();
    setCommandOpen(false);
    navigate(to);
  };

  const handleSelectRecord = (hit: RecordHit) => {
    returnFocus.forget();
    setCommandOpen(false);
    navigate(hit.path, { state: { revealId: hit.id } });
  };

  // One list for the keyboard: sections first, then records, as drawn.
  const optionCount = filteredLinks.length + recordHits.length;
  const active = optionCount > 0 ? Math.min(activeIndex, optionCount - 1) : -1;
  const optionId = (index: number) => `${listId}-option-${index}`;
  const activeId = active >= 0 ? optionId(active) : undefined;

  useEffect(() => {
    if (!commandOpen || !activeId) return;
    document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [commandOpen, activeId]);

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter and the arrows belong to an input method while it is composing.
    if (event.nativeEvent.isComposing || optionCount === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((active + 1) % optionCount);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((active - 1 + optionCount) % optionCount);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (active < filteredLinks.length) {
        handleSelectRoute(filteredLinks[active].to);
      } else {
        handleSelectRecord(recordHits[active - filteredLinks.length]);
      }
    }
  };

  const optionClass = (index: number) =>
    cn(
      'group flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors',
      index === active
        ? 'border-primary/45 bg-secondary/45'
        : 'border-border/50 bg-background/45',
    );

  return (
    <>
      {/* From md only: below it the header's search button opens the same
          palette, and a second bar would cost a phone 68px. */}
      <div className="hidden md:block shrink-0 wide-container relative z-30 pb-1.5 pt-1">
        <div className="flex items-center rounded-2xl border border-border/60 bg-card/75 px-3 py-1.5 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="flex flex-1 min-w-0 items-center justify-between gap-2 rounded-xl px-2 py-1 text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0 truncate">
              <Terminal className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
              <span className="truncate font-mono">Search sections and records</span>
            </span>
            <kbd className="shrink-0 rounded border border-border/70 bg-background/80 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>

      <DialogPrimitive.Root open={commandOpen} onOpenChange={setCommandOpen}>
        <DialogPrimitive.Portal>
          <DialogOverlay className="bg-background/75" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
              returnFocus.remember();
              event.preventDefault();
              inputRef.current?.focus();
            }}
            onCloseAutoFocus={returnFocus.restore}
            onPointerDownOutside={ignoreOverlayPointerDown()}
            className="!fixed left-1/2 top-3 z-50 flex max-h-[82dvh] w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border/75 bg-popover/95 shadow-2xl hud-corners focus:outline-none sm:top-6 sm:w-[calc(100%-3rem)] md:top-16"
          >
            <DialogPrimitive.Title className="sr-only">
              Search sections and records
            </DialogPrimitive.Title>
            <div className="flex items-center gap-2.5 border-b border-border/50 px-4 py-3">
              <Search className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search sections and records"
                aria-label="Search sections and records"
                role="combobox"
                aria-expanded={optionCount > 0}
                aria-autocomplete="list"
                aria-controls={listId}
                aria-activedescendant={activeId}
                autoComplete="off"
                spellCheck={false}
                className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    // The button unmounts with the query; keep the keyboard
                    // in the input, where the arrow keys are handled.
                    inputRef.current?.focus();
                  }}
                  className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                aria-label="Close search"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div
              id={listId}
              role="listbox"
              aria-label="Results"
              className="app-scroll overflow-y-auto p-4 space-y-4"
            >
              <div role="presentation" className="space-y-2">
                <p id={`${listId}-sections`} className="readout-label">
                  Sections ({filteredLinks.length})
                </p>
                {filteredLinks.length > 0 ? (
                  <div
                    role="group"
                    aria-labelledby={`${listId}-sections`}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-1.5"
                  >
                    {filteredLinks.map((link, index) => {
                      const badge = String(links.indexOf(link) + 1).padStart(2, '0');
                      return (
                        <button
                          key={link.to}
                          id={optionId(index)}
                          type="button"
                          role="option"
                          aria-selected={index === active}
                          tabIndex={-1}
                          onPointerMove={() => setActiveIndex(index)}
                          onClick={() => handleSelectRoute(link.to)}
                          className={cn(optionClass(index), 'gap-2 text-xs')}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <Compass className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                            <span className="tabular-nums font-mono text-xs text-muted-foreground">
                              {badge}
                            </span>
                            <span className="truncate font-medium text-foreground">
                              {link.label}
                            </span>
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">{link.to}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground px-1">No section matches.</p>
                )}
              </div>

              {searching ? (
                <div role="presentation" className="space-y-2">
                  <p id={`${listId}-records`} className="readout-label">
                    Records ({recordHits.length})
                  </p>
                  {recordsFailed ? (
                    <p className="text-xs text-destructive px-1">
                      Could not load some records.
                    </p>
                  ) : null}
                  {recordHits.length > 0 ? (
                    <div
                      role="group"
                      aria-labelledby={`${listId}-records`}
                      className="grid grid-cols-1 gap-1.5"
                    >
                      {recordHits.map((hit, hitIndex) => {
                        const index = filteredLinks.length + hitIndex;
                        return (
                          <button
                            key={hit.key}
                            id={optionId(index)}
                            type="button"
                            role="option"
                            aria-selected={index === active}
                            tabIndex={-1}
                            onPointerMove={() => setActiveIndex(index)}
                            onClick={() => handleSelectRecord(hit)}
                            className={cn(optionClass(index), 'gap-3')}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-medium text-foreground">
                                {hit.title}
                              </span>
                              {hit.subtitle ? (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {hit.subtitle}
                                </span>
                              ) : null}
                            </span>
                            <span className="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground">
                              <span>{hit.collectionTitle}</span>
                              <ArrowUpRight
                                className={cn('h-4 w-4', index === active && 'text-primary')}
                                aria-hidden="true"
                              />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground px-1">
                      {recordsLoading ? 'Loading records…' : 'No record matches.'}
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <p
              aria-hidden="true"
              className="max-md:hidden border-t border-border/50 px-4 py-2 font-mono text-xs text-muted-foreground"
            >
              ↑↓ move · ↵ open · esc close
            </p>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

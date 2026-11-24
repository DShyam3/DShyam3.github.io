import { useEffect, useId, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { useWorkspaceInspector } from '@/contexts/WorkspaceInspectorContext';
import { useDisplayMode } from '@/contexts/DisplayModeContext';
import { AppIcon, getSectionIcon } from '@/components/ui/icon';
import {
  SFAppleTerminalFill,
  SFArrowUpRight,
  SFDisplay,
  SFMoonStarsFill,
  SFSunMaxFill,
  SFXmark,
} from '@/components/ui/sf-symbols';
import { collections } from '@/collections/registry';
import { collectionQuery } from '@/collections/useCollection';
import {
  MIN_RECORD_QUERY_LENGTH,
  searchRecords,
  type RecordHit,
} from '@/collections/record-search';
import type { CollectionRow } from '@/collections/types';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { DialogOverlay } from '@/components/ui/dialog';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { ignoreOverlayPointerDown } from '@/components/ui/dismiss-on-release';
import { cn } from '@/lib/utils';
import { useSiteNavLinks } from './navLinks';
import { useReturnFocus } from './useReturnFocus';

/**
 * The bar above the footer and the ⌘K palette it opens: jump to a section,
 * find a record by its title, or run a quick display/theme toggle.
 *
 * Powered by `cmdk` (`shouldFilter={false}` + `loop`) inside a zero-animation
 * Radix Dialog (per Emil Kowalski's Raycast principle: 100+/day keyboard
 * actions never animate open/close).
 */
export function CommandDock() {
  const { commandOpen, setCommandOpen } = useWorkspaceInspector();
  const links = useSiteNavLinks();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const { largerDisplay, toggleDisplaySize } = useDisplayMode();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const returnFocus = useReturnFocus();
  const [query, setQuery] = useState('');
  const [selectedValue, setSelectedValue] = useState('');

  useEffect(() => {
    if (!commandOpen) return;
    setQuery('');
    setSelectedValue('');
  }, [commandOpen]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        // Holding the keys would otherwise toggle the palette on every repeat.
        if (event.repeat) return;
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

  const quickActions = useMemo(() => {
    const isDark = resolvedTheme !== 'light';
    const all = [
      {
        key: 'action:theme',
        label: isDark ? 'Switch to Light theme' : 'Switch to Dark theme',
        hint: 'Theme',
        keywords: 'theme dark light mode appearance colour color',
        Icon: isDark ? SFSunMaxFill : SFMoonStarsFill,
        run: () => setTheme(isDark ? 'light' : 'dark'),
      },
      {
        key: 'action:display',
        label: largerDisplay ? 'Switch to Standard reading size' : 'Switch to Larger reading size (125%)',
        hint: largerDisplay ? 'Standard' : 'Larger',
        keywords: 'display size zoom text font larger standard reading',
        Icon: SFDisplay,
        run: () => toggleDisplaySize(),
      },
    ];
    if (!normalizedQuery) return all;
    return all.filter(
      (item) =>
        item.label.toLowerCase().includes(normalizedQuery) ||
        item.keywords.includes(normalizedQuery),
    );
  }, [resolvedTheme, setTheme, largerDisplay, toggleDisplaySize, normalizedQuery]);

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

  const handleSelectAction = (run: () => void) => {
    run();
    setCommandOpen(false);
  };

  return (
    <>
      {/* From md only: below it the header's search button opens the same
          palette, and a second bar would cost a phone 68px. */}
      <div className="hidden md:block shrink-0 wide-container relative z-30 pb-1.5 pt-1">
        <div className="flex items-center rounded-2xl border border-border/60 bg-card/75 px-3 py-1.5 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="t-press flex flex-1 min-w-0 items-center justify-between gap-2 rounded-xl px-2 py-1 text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0 truncate">
              <AppIcon icon={SFAppleTerminalFill} className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">
                <DotMatrixText text="Search sections and records" size="ui" wrap={false} />
              </span>
            </span>
            <kbd className="shrink-0 rounded border border-border/70 bg-background/80 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>

      <DialogPrimitive.Root open={commandOpen} onOpenChange={setCommandOpen}>
        <DialogPrimitive.Portal>
          <DialogOverlay className="bg-background/75 !animate-none" />
          <DialogPrimitive.Content
            data-command-dock=""
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
              returnFocus.remember();
              event.preventDefault();
              inputRef.current?.focus();
            }}
            onCloseAutoFocus={returnFocus.restore}
            onPointerDownOutside={ignoreOverlayPointerDown()}
            className="!fixed left-1/2 top-3 z-50 flex max-h-[82dvh] w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border/75 bg-popover/95 shadow-2xl focus:outline-none sm:top-6 sm:w-[calc(100%-3rem)] md:top-16"
          >
            <DialogPrimitive.Title className="sr-only">
              Search sections and records
            </DialogPrimitive.Title>

            <Command
              shouldFilter={false}
              loop
              value={selectedValue}
              onValueChange={setSelectedValue}
              className="bg-transparent"
            >
              <CommandInput
                ref={inputRef}
                value={query}
                onValueChange={setQuery}
                placeholder="Search sections and records"
                aria-label="Search sections and records"
                aria-controls={listId}
                autoComplete="off"
                spellCheck={false}
                trailing={
                  <>
                    {query ? (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery('');
                          inputRef.current?.focus();
                        }}
                        className="t-press rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Clear
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setCommandOpen(false)}
                      aria-label="Close search"
                      className="t-press inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <AppIcon icon={SFXmark} className="h-3.5 w-3.5" />
                    </button>
                  </>
                }
              />

              <CommandList id={listId} aria-label="Results">
                {filteredLinks.length > 0 ? (
                  <CommandGroup
                    heading={<span className="readout-label"><DotMatrixText text={`Sections (${filteredLinks.length})`} size="ui" /></span>}
                    className="[&_[cmdk-group-items]]:grid [&_[cmdk-group-items]]:grid-cols-1 sm:[&_[cmdk-group-items]]:grid-cols-2 [&_[cmdk-group-items]]:gap-1.5"
                  >
                    {filteredLinks.map((link) => {
                      const badge = String(links.indexOf(link) + 1).padStart(2, '0');
                      const itemValue = `route:${link.to}`;
                      const SectionIcon = getSectionIcon(link.to);
                      return (
                        <CommandItem
                          key={link.to}
                          value={itemValue}
                          onSelect={() => handleSelectRoute(link.to)}
                          className="gap-2 text-xs"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <AppIcon icon={SectionIcon} className="h-3.5 w-3.5 text-primary" />
                            <DotMatrixText
                              text={badge}
                              size="ui"
                              wrap={false}
                              className="tabular-nums text-muted-foreground"
                            />
                            <span className="truncate text-foreground">
                              <DotMatrixText text={link.label} size="ui" wrap={false} />
                            </span>
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">{link.to}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ) : (
                  <div role="presentation" className="space-y-2">
                    <p className="readout-label"><DotMatrixText text="Sections (0)" size="ui" /></p>
                    <p className="text-xs text-muted-foreground px-1">No section matches.</p>
                  </div>
                )}

                {searching ? (
                  recordHits.length > 0 ? (
                    <CommandGroup
                      heading={
                        <span className="block space-y-1">
                          <span className="readout-label block"><DotMatrixText text={`Records (${recordHits.length})`} size="ui" /></span>
                          {recordsFailed ? (
                            <span className="block text-xs normal-case tracking-normal text-destructive px-1">
                              Could not load some records.
                            </span>
                          ) : null}
                        </span>
                      }
                      className="[&_[cmdk-group-items]]:grid [&_[cmdk-group-items]]:grid-cols-1 [&_[cmdk-group-items]]:gap-1.5"
                    >
                      {recordHits.map((hit) => {
                        const itemValue = `record:${hit.key}`;
                        const isSelected = selectedValue === itemValue;
                        return (
                          <CommandItem
                            key={hit.key}
                            value={itemValue}
                            onSelect={() => handleSelectRecord(hit)}
                            className="gap-3"
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
                              <AppIcon
                                icon={SFArrowUpRight}
                                className={cn('h-3.5 w-3.5', isSelected && 'text-primary')}
                              />
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  ) : (
                    <div role="presentation" className="space-y-2">
                      <p className="readout-label"><DotMatrixText text="Records (0)" size="ui" /></p>
                      {recordsFailed ? (
                        <p className="text-xs text-destructive px-1">
                          Could not load some records.
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground px-1">
                        {recordsLoading ? 'Loading records…' : 'No record matches.'}
                      </p>
                    </div>
                  )
                ) : null}

                {quickActions.length > 0 ? (
                  <CommandGroup
                    heading={<span className="readout-label"><DotMatrixText text={`Quick actions (${quickActions.length})`} size="ui" /></span>}
                    className="[&_[cmdk-group-items]]:grid [&_[cmdk-group-items]]:grid-cols-1 sm:[&_[cmdk-group-items]]:grid-cols-2 [&_[cmdk-group-items]]:gap-1.5"
                  >
                    {quickActions.map((action) => {
                      const Icon = action.Icon;
                      return (
                        <CommandItem
                          key={action.key}
                          value={action.key}
                          onSelect={() => handleSelectAction(action.run)}
                          className="gap-2 text-xs"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <Icon className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                            <span className="truncate text-foreground">{action.label}</span>
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">{action.hint}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ) : null}
              </CommandList>

              <p
                aria-hidden="true"
                className="max-md:hidden border-t border-border/50 px-4 py-2 font-mono text-xs text-muted-foreground"
              >
                ↑↓ move · ↵ open · esc close
              </p>
            </Command>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

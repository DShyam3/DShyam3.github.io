import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useSiteNavLinks } from './navLinks';

/**
 * The bar above the footer and the palette it opens: jump to a section, or
 * find a record by its title. It searches rows the site has already read and
 * answers no questions.
 */
export function CommandDock() {
  const { commandOpen, setCommandOpen } = useWorkspaceInspector();
  const links = useSiteNavLinks();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!commandOpen) return;
    setQuery('');
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(timer);
  }, [commandOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(!commandOpen);
        return;
      }
      if (event.key === 'Escape' && commandOpen) {
        event.preventDefault();
        setCommandOpen(false);
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
    setCommandOpen(false);
    navigate(to);
  };

  const handleSelectRecord = (hit: RecordHit) => {
    setCommandOpen(false);
    navigate(hit.path, { state: { revealId: hit.id } });
  };

  return (
    <>
      <div className="shrink-0 wide-container relative z-30 pb-1.5 pt-1">
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

      {commandOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-background/75 backdrop-blur-sm p-3 sm:p-6 md:pt-16"
          onClick={() => setCommandOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search sections and records"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl border border-border/75 bg-popover/95 shadow-2xl overflow-hidden hud-corners flex flex-col max-h-[82dvh]"
          >
            <div className="flex items-center gap-2.5 border-b border-border/50 px-4 py-3">
              <Search className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sections and records"
                aria-label="Search sections and records"
                className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
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

            <div className="app-scroll overflow-y-auto p-4 space-y-4">
              <div className="space-y-2">
                <p className="readout-label">Sections ({filteredLinks.length})</p>
                {filteredLinks.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {filteredLinks.map((link) => {
                      const badge = String(links.indexOf(link) + 1).padStart(2, '0');
                      return (
                        <button
                          key={link.to}
                          type="button"
                          onClick={() => handleSelectRoute(link.to)}
                          className="group flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/45 px-3 py-2 text-left text-xs transition-colors hover:border-primary/45 hover:bg-secondary/45"
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
                <div className="space-y-2">
                  <p className="readout-label">Records ({recordHits.length})</p>
                  {recordsFailed ? (
                    <p className="text-xs text-destructive px-1">
                      Could not load some records.
                    </p>
                  ) : null}
                  {recordHits.length > 0 ? (
                    <div className="grid grid-cols-1 gap-1.5">
                      {recordHits.map((hit) => (
                        <button
                          key={hit.key}
                          type="button"
                          onClick={() => handleSelectRecord(hit)}
                          className="group flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-left transition-colors hover:border-primary/45 hover:bg-secondary/45"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-foreground group-hover:text-primary transition-colors">
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
                            <ArrowUpRight className="h-4 w-4 group-hover:text-primary transition-colors" aria-hidden="true" />
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground px-1">
                      {recordsLoading ? 'Loading records…' : 'No record matches.'}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

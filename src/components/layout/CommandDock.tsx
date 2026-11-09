import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Compass, Layers, Search, Sparkles, Terminal, X } from 'lucide-react';
import {
  useWorkspaceInspector,
  type WorkspaceInspectorTarget,
} from '@/contexts/WorkspaceInspectorContext';
import { useSiteNavLinks } from './navLinks';

interface SemanticRecordEntry {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  to: string;
  keywords: string;
  requiresFinance?: boolean;
  answer: string;
  target: WorkspaceInspectorTarget;
}

const SEMANTIC_RECORDS: SemanticRecordEntry[] = [
  {
    id: 'sem-travel',
    code: 'TRV',
    title: 'Travel Atlas · Countries & Cities',
    subtitle: 'Countries & cities logged across continents on a dot-matrix world map',
    to: '/travel',
    keywords: 'cities visited travel countries world map atlas trips flights',
    answer: 'Countries and cities logged on the travel atlas, drawn on a dot-matrix world map.',
    target: {
      id: 'travel-atlas-overview',
      eyebrow: 'Spatial Record',
      title: 'Global Travel Atlas',
      summary:
        'Interactive dot-matrix world map and country/city drill-down with historical visit records.',
      rows: [
        { label: 'Coverage', value: 'Countries & city hubs', tone: 'sky' },
        { label: 'Source', value: 'travel_countries · travel_cities', tone: 'accent' },
        { label: 'Projection', value: 'Dot-matrix atlas' },
      ],
      backlinks: [
        {
          id: 'bl-photos',
          code: 'PHO',
          label: 'Field Photography Archive',
          to: '/photos',
          meta: 'Visual notes',
        },
        {
          id: 'bl-home',
          code: 'HOM',
          label: 'Semantic Constellation Overview',
          to: '/',
          meta: 'Home',
        },
      ],
      primaryAction: { label: 'Open Travel Atlas', to: '/travel' },
      secondaryAction: { label: 'View Photos', to: '/photos' },
    },
  },
  {
    id: 'sem-inventory',
    code: 'INV',
    title: 'Camera Gear & Everyday Carry Rig',
    subtitle: 'Everyday carry, desk & camera gear with category filters',
    to: '/inventory',
    keywords: 'camera gear inventory edc everyday carry hardware workstation lenses',
    answer: 'Catalogued everyday carry, desk and camera kit, filterable by category.',
    target: {
      id: 'inventory-edc-overview',
      eyebrow: 'Hardware Record',
      title: 'Camera Gear & Everyday Carry',
      summary:
        'Structured inventory of daily workstation tools, camera optics, audio gear, and field accessories.',
      rows: [
        { label: 'Collection', value: 'Inventory · EDC', tone: 'accent' },
        { label: 'Categories', value: 'Tech · Optics · Carry', tone: 'sky' },
        { label: 'State', value: 'Active rotation' },
      ],
      backlinks: [
        {
          id: 'bl-photos-inv',
          code: 'PHO',
          label: 'Shot on Field Optics',
          to: '/photos',
          meta: 'Photos',
        },
        {
          id: 'bl-travel-inv',
          code: 'TRV',
          label: 'Travel Packing & Atlas',
          to: '/travel',
          meta: 'Atlas',
        },
      ],
      primaryAction: { label: 'Browse Inventory', to: '/inventory' },
    },
  },
  {
    id: 'sem-architecture',
    code: 'SYS',
    title: 'Site Architecture & Local-First Design',
    subtitle: 'Workspace shell, numbered rail, and deterministic inspector',
    to: '/',
    keywords: 'site architecture redesign workspace shell local-first design system',
    answer:
      'Built as an editorial workspace shell (numbered section rail, scrollable viewport, contextual inspector with connected backlinks) with deterministic local calculations.',
    target: {
      id: 'site-redesign-2026',
      eyebrow: 'Architecture Record',
      title: 'Site Architecture & Workspace Shell',
      summary:
        'Editorial workspace combining a numbered left rail, center viewport, contextual right inspector, and local-first command dock.',
      rows: [
        { label: 'Layout', value: 'Workspace Shell + Dock', tone: 'accent' },
        { label: 'Typography', value: 'Doto + Space Mono' },
        { label: 'Data model', value: 'Deterministic · Local-first', tone: 'sky' },
      ],
      backlinks: [
        {
          id: 'bl-links-arch',
          code: 'LNK',
          label: 'Saved Links & References',
          to: '/links',
          meta: 'Bookmarks',
        },
        {
          id: 'bl-thoughts-arch',
          code: 'THO',
          label: 'Notes & Short-Form Thoughts',
          to: '/thoughts',
          meta: 'Stream',
        },
      ],
      primaryAction: { label: 'Open Home', to: '/' },
    },
  },
  {
    id: 'sem-reading',
    code: 'BKS',
    title: 'Reading Library & Saved Articles',
    subtitle: 'Bookshelf, long-form articles, and media watchlist',
    to: '/books',
    keywords: 'reading library books articles watchlist literature notes',
    answer: 'Books, saved long-form articles and a tracked film and series watchlist.',
    target: {
      id: 'reading-library-overview',
      eyebrow: 'Library Record',
      title: 'Reading Library & Articles',
      summary:
        'Curated bookshelf paired with saved long-form articles and a live film & series watchlist.',
      rows: [
        { label: 'Primary', value: '/books · /articles', tone: 'accent' },
        { label: 'Companion', value: '/watchlist' },
      ],
      backlinks: [
        {
          id: 'bl-articles-lib',
          code: 'ART',
          label: 'Saved Long-Form Articles',
          to: '/articles',
          meta: 'Reading',
        },
        {
          id: 'bl-watchlist-lib',
          code: 'WTC',
          label: 'Film & Series Watchlist',
          to: '/watchlist',
          meta: 'Tracker',
        },
      ],
      primaryAction: { label: 'Open Books', to: '/books' },
      secondaryAction: { label: 'Open Articles', to: '/articles' },
    },
  },
  {
    id: 'sem-resume',
    code: 'CV',
    title: 'Resume, CV & Engineering Background',
    subtitle: 'Experience, technical stack, and London base',
    to: '/',
    keywords: 'resume cv career work experience london engineer profile about',
    answer: 'Experience, education and the downloadable CV, based in London.',
    target: {
      id: 'resume-cv-record',
      eyebrow: 'Profile Record',
      title: 'Resume & Engineering Profile',
      summary:
        'Overview of engineering work, systems design, and personal collections based in London.',
      rows: [
        { label: 'Base', value: 'London, UK', tone: 'accent' },
        { label: 'Focus', value: 'Systems · Interfaces · Data', tone: 'sky' },
      ],
      backlinks: [
        {
          id: 'bl-travel-cv',
          code: 'TRV',
          label: 'Global Travel Atlas',
          to: '/travel',
          meta: 'Atlas',
        },
        {
          id: 'bl-inv-cv',
          code: 'INV',
          label: 'Workstation & Hardware Rig',
          to: '/inventory',
          meta: 'Inventory',
        },
      ],
      primaryAction: { label: 'View About', to: '/' },
    },
  },
  {
    id: 'sem-finance',
    code: 'FIN',
    title: 'Personal Treasury & Deterministic Ledger',
    subtitle: 'Pure TypeScript calculation modules for balances, budgets, and UK tax',
    to: '/finance',
    keywords: 'finance ledger treasury cash flow budget tax savings',
    requiresFinance: true,
    answer:
      'Anchored personal ledger where every balance, projection, and UK tax band is computed locally by pure functions.',
    target: {
      id: 'finance-ledger-overview',
      eyebrow: 'Deterministic Ledger',
      title: 'Personal Treasury & Cash Flow',
      summary:
        'All balances, budgets, and tax figures are computed locally from rows by pure functions.',
      rows: [
        { label: 'Engine', value: 'Pure TypeScript calculation modules', tone: 'accent' },
        { label: 'Privacy', value: 'Admin RLS · Allowlist', tone: 'amber' },
      ],
      backlinks: [
        {
          id: 'bl-inv-fin2',
          code: 'INV',
          label: 'Hardware & Gear Inventory',
          to: '/inventory',
          meta: 'Assets',
        },
      ],
      primaryAction: { label: 'Open Finance', to: '/finance' },
    },
  },
];

const QUICK_PROMPTS = ['Cities visited', 'Camera gear', 'Site architecture'] as const;

export function CommandDock() {
  const {
    commandOpen,
    setCommandOpen,
    commandDraft,
    openCommandWithDraft,
    target,
    setInspectorSheetOpen,
    selectTarget,
  } = useWorkspaceInspector();
  const links = useSiteNavLinks();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  const hasFinanceAccess = useMemo(
    () => links.some((link) => link.to === '/finance'),
    [links],
  );

  useEffect(() => {
    if (commandOpen) {
      setQuery(commandDraft);
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
      return () => window.clearTimeout(timer);
    }
  }, [commandOpen, commandDraft]);

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

  const visibleRecords = useMemo(
    () => SEMANTIC_RECORDS.filter((rec) => !rec.requiresFinance || hasFinanceAccess),
    [hasFinanceAccess],
  );

  const normalizedQuery = query.trim().toLowerCase();

  const filteredRecords = useMemo(() => {
    if (!normalizedQuery) return visibleRecords;
    return visibleRecords.filter((rec) => {
      const haystack = `${rec.title} ${rec.subtitle} ${rec.keywords} ${rec.code}`.toLowerCase();
      return (
        haystack.includes(normalizedQuery) ||
        normalizedQuery
          .split(/\s+/)
          .filter((token) => token.length > 2)
          .some((token) => haystack.includes(token))
      );
    });
  }, [visibleRecords, normalizedQuery]);

  const filteredLinks = useMemo(() => {
    if (!normalizedQuery) return links;
    return links.filter(
      (link) =>
        link.label.toLowerCase().includes(normalizedQuery) ||
        link.to.toLowerCase().includes(normalizedQuery),
    );
  }, [links, normalizedQuery]);

  const matchedPromptRecord = useMemo(() => {
    if (!normalizedQuery) return null;
    return filteredRecords[0] ?? null;
  }, [normalizedQuery, filteredRecords]);

  const handleSelectRecord = (record: SemanticRecordEntry) => {
    setCommandOpen(false);
    navigate(record.to);
    selectTarget(record.target);
    window.setTimeout(() => {
      selectTarget(record.target);
    }, 0);
  };

  // A section jump is navigation, not a record: it leaves the inspector empty
  // so the new page opens at full width.
  const handleSelectRoute = (to: string) => {
    setCommandOpen(false);
    navigate(to);
  };

  return (
    <>
      <div className="shrink-0 wide-container relative z-30 pb-1.5 pt-1">
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card/75 px-3 py-1.5 backdrop-blur-md">
          <button
            type="button"
            onClick={() => openCommandWithDraft('')}
            className="flex flex-1 min-w-0 items-center justify-between gap-2 rounded-xl px-2 py-1 text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0 truncate">
              <Terminal className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
              <span className="truncate font-mono">
                &gt; Ask across pages, records, travel, or gear...
              </span>
            </span>
            <kbd className="shrink-0 rounded border border-border/70 bg-background/80 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => openCommandWithDraft(prompt)}
                className="rounded-lg border border-border/55 bg-background/55 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/45 hover:text-foreground transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          {target ? (
            <button
              type="button"
              onClick={() => setInspectorSheetOpen(true)}
              className="xl:hidden inline-flex items-center gap-1.5 rounded-xl border border-primary/35 bg-primary/10 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-primary/20 transition-colors shrink-0 max-w-[13rem]"
            >
              <Layers className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
              <span className="truncate">Inspector: {target.title}</span>
            </button>
          ) : null}
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
            aria-label="Ask or search workspace"
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
                placeholder="Ask a question or jump to any route, city, or gear record..."
                aria-label="Search routes, records, or ask a question"
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
                aria-label="Close command modal"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-b border-border/40 bg-background/40 px-4 py-2">
              <span className="readout-label mr-1">
                Starter prompts:
              </span>
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setQuery(prompt)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card/75 px-2 py-0.5 text-xs text-muted-foreground hover:border-primary/45 hover:text-foreground transition-colors"
                >
                  <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
                  <span>{prompt}</span>
                </button>
              ))}
            </div>

            <div className="app-scroll overflow-y-auto p-4 space-y-4">
              {matchedPromptRecord ? (
                <div className="rounded-xl border border-primary/35 bg-primary/10 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="readout-label text-primary">
                      Curated summary · {matchedPromptRecord.code}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {matchedPromptRecord.to}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground">
                    {matchedPromptRecord.answer}
                  </p>
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectRecord(matchedPromptRecord)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/45 bg-primary/20 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-primary/30 transition-colors"
                    >
                      <span>Inspect &amp; Open {matchedPromptRecord.title}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="readout-label">
                  Semantic Records ({filteredRecords.length})
                </p>
                {filteredRecords.length > 0 ? (
                  <div className="grid grid-cols-1 gap-1.5">
                    {filteredRecords.map((record) => (
                      <button
                        key={record.id}
                        type="button"
                        onClick={() => handleSelectRecord(record)}
                        className="group flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-left transition-colors hover:border-primary/45 hover:bg-secondary/45"
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className="rounded border border-border/70 bg-card/80 px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wider text-primary shrink-0">
                            {record.code}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                              {record.title}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {record.subtitle}
                            </span>
                          </span>
                        </span>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground px-1">
                    No curated semantic records matched &ldquo;{query}&rdquo;.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <p className="readout-label">
                  Workspace Sections ({filteredLinks.length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {filteredLinks.map((link) => {
                    const idx = links.findIndex((item) => item.to === link.to);
                    const badge = String((idx >= 0 ? idx : 0) + 1).padStart(2, '0');
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
                        <span className="font-mono text-xs text-muted-foreground">
                          {link.to}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

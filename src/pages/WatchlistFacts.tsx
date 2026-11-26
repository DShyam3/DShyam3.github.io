import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  Clapperboard,
  Clock,
  Film,
  Loader2,
  Search,
  Sparkles,
  Trophy,
  Tv,
  User,
  Users,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { BarList, CategoryBar } from '@/components/ui/bar-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MetricTile } from '@/components/ui/metric-tile';
import { NativeSelect } from '@/components/ui/native-select';
import { WatchlistNav } from '@/features/watchlist/components/WatchlistNav';
import { SegmentedControl } from '@/features/watchlist/components/SegmentedControl';
import { PersonFilmographyDialog } from '@/features/watchlist/components/PersonFilmographyDialog';
import { PlatformLogo, hasPlatformLogo } from '@/features/watchlist/components/PlatformLogo';
import { SectionFailure } from '@/features/watchlist/components/SectionFailure';
import {
  computeCoolFacts,
  type LabelCount,
  type WatchedPersonStat,
} from '@/features/watchlist/cool-facts';
import { fetchWatchlistCreditsIndex } from '@/features/watchlist/cool-facts-query';
import { fetchTmdbPersonProfileUrl } from '@/features/watchlist/person-credits-query';
import { useWatchlist } from '@/features/watchlist/useWatchlist';
import { cn } from '@/lib/utils';

type PeopleTab = 'all' | 'cast' | 'directors' | 'creators';

const PEOPLE_TABS: readonly { key: PeopleTab; label: string }[] = [
  { key: 'all', label: 'All roles' },
  { key: 'cast', label: 'Cast' },
  { key: 'directors', label: 'Directors' },
  { key: 'creators', label: 'Creators' },
];

const INITIAL_PEOPLE_LIMIT = 5;

function formatRuntimeHoursMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins <= 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function PersonAvatar({
  name,
  fetchPhoto,
  size = 'md',
}: {
  name: string;
  fetchPhoto: boolean;
  size?: 'md' | 'lg';
}) {
  const { data: profileUrl } = useQuery({
    queryKey: ['tmdb-person-avatar', name],
    queryFn: () => fetchTmdbPersonProfileUrl(name),
    enabled: fetchPhoto,
    staleTime: 60 * 60_000,
    retry: false,
  });

  const dims = size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';

  if (profileUrl) {
    return (
      <img
        src={profileUrl}
        alt=""
        className={cn(dims, 'shrink-0 rounded-full border border-border/60 bg-muted object-cover')}
      />
    );
  }
  return (
    <span className={cn(dims, 'flex shrink-0 items-center justify-center rounded-full bg-secondary')}>
      <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </span>
  );
}

function PersonLeaderboardCard({
  title,
  description,
  icon: Icon,
  people,
  expandedByDefault = false,
  onSelectPerson,
}: {
  title: string;
  description: string;
  icon: typeof Users;
  people: WatchedPersonStat[];
  expandedByDefault?: boolean;
  onSelectPerson: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const showAll = expandedByDefault || expanded || people.length <= INITIAL_PEOPLE_LIMIT;
  const visiblePeople = showAll ? people : people.slice(0, INITIAL_PEOPLE_LIMIT);
  const maxCount = people[0]?.titleCount ?? 1;

  return (
    <Card className="surface-card flex flex-col justify-between overflow-hidden">
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-primary/25 bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>{title}</span>
            </CardTitle>
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
              {people.length}
            </span>
          </div>
          <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-2.5">
          {people.length === 0 ? (
            <p className="py-4 text-xs text-muted-foreground">No matching watched credits found.</p>
          ) : (
            <ol className="space-y-2">
              {visiblePeople.map((person, index) => {
                const pct = Math.max(8, Math.round((person.titleCount / maxCount) * 100));
                const isTopThree = index < 3;
                const breakdown = [
                  person.movieCount > 0
                    ? `${person.movieCount} ${person.movieCount === 1 ? 'film' : 'films'}`
                    : null,
                  person.showCount > 0 ? `${person.showCount} series` : null,
                  person.episodeCount > 0 ? `${person.episodeCount} ep` : null,
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <li key={person.name}>
                    <button
                      type="button"
                      onClick={() => onSelectPerson(person.name)}
                      aria-label={`Inspect ${person.name} (${person.titleCount} watched ${person.titleCount === 1 ? 'title' : 'titles'})`}
                      className={cn(
                        't-press group relative flex w-full flex-col gap-2 rounded-sm border p-2.5 text-left transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isTopThree
                          ? 'border-border/80 bg-background/75 hover:border-primary/50 hover:bg-muted/35'
                          : 'border-border/50 bg-background/40 hover:border-border hover:bg-muted/30',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <span className="flex min-w-0 flex-1 items-center gap-2.5">
                          <span
                            className={cn(
                              'flex h-6 w-6 shrink-0 items-center justify-center rounded-sm font-mono text-xs font-semibold tabular-nums',
                              index === 0
                                ? 'bg-primary text-primary-foreground'
                                : isTopThree
                                  ? 'border border-primary/35 bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {index + 1}
                          </span>
                          <PersonAvatar
                            name={person.name}
                            fetchPhoto={index < 6}
                            size={index === 0 ? 'lg' : 'md'}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-foreground group-hover:underline">
                              {person.name}
                            </span>
                            <span className="block truncate font-mono text-xs text-muted-foreground tabular-nums">
                              {person.titleCount} {person.titleCount === 1 ? 'title' : 'titles'}
                              {breakdown ? ` · ${breakdown}` : ''}
                            </span>
                          </span>
                        </span>

                        {person.sampleItems.length > 0 ? (
                          <span className="hidden sm:flex shrink-0 items-center gap-1" aria-hidden="true">
                            {person.sampleItems.slice(0, 3).map((sample, sampleIdx) =>
                              sample.imageUrl ? (
                                <img
                                  key={`${sample.title}-${sampleIdx}`}
                                  src={sample.imageUrl}
                                  alt=""
                                  title={sample.title}
                                  className="h-9 w-6 shrink-0 rounded-sm border border-border/50 bg-muted object-cover"
                                />
                              ) : null,
                            )}
                          </span>
                        ) : null}
                      </div>

                      <div className="space-y-1">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/80">
                          <div
                            className={cn(
                              'h-full rounded-full transition-[width] duration-200',
                              index === 0 ? 'bg-primary' : 'bg-primary/70',
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {person.sampleItems.length > 0 ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {person.sampleItems.map((s) => s.title).join(', ')}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </div>

      {!expandedByDefault && people.length > INITIAL_PEOPLE_LIMIT ? (
        <div className="border-t border-border/50 px-4 py-2.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={showAll}
            onClick={() => setExpanded((prev) => !prev)}
            className="w-full justify-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            <span>
              {showAll
                ? 'Show top 5'
                : `Show all ${people.length}`}
            </span>
            <ChevronDown
              data-open={showAll}
              className="t-chevron-flip h-3.5 w-3.5"
              aria-hidden="true"
            />
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function DecadesChartCard({ rows, totalTitles }: { rows: LabelCount[]; totalTitles: number }) {
  const chronological = useMemo(
    () => [...rows].sort((a, b) => a.label.localeCompare(b.label)),
    [rows],
  );
  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  return (
    <Card className="surface-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Top decades</CardTitle>
        <CardDescription className="text-xs">
          Release eras across your watched films and series.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No watched data yet.</p>
        ) : (
          <>
            <div
              className="flex h-28 items-end gap-2 rounded-sm border border-border/50 bg-background/50 px-3 pb-2 pt-5"
              role="img"
              aria-label="Watched titles by release decade"
            >
              {chronological.map((row) => {
                const heightPct = Math.max(10, Math.round((row.count / maxCount) * 100));
                return (
                  <div
                    key={row.label}
                    className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                    aria-hidden="true"
                  >
                    <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                      {row.count}
                    </span>
                    <div className="flex min-h-0 w-full flex-1 items-end justify-center">
                      <div
                        className="w-full max-w-[2.25rem] rounded-t-sm bg-primary/80 transition-[height] duration-200"
                        style={{ height: `${heightPct}%` }}
                        title={`${row.label}: ${row.count}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 px-3" aria-hidden="true">
              {chronological.map((row) => (
                <span
                  key={row.label}
                  className="min-w-0 flex-1 truncate text-center font-mono text-xs text-muted-foreground"
                >
                  {row.label}
                </span>
              ))}
            </div>

            <BarList
              data={rows.map((r) => {
                const share = totalTitles > 0 ? Math.round((r.count / totalTitles) * 100) : 0;
                return {
                  key: r.label,
                  name: r.label,
                  value: r.count,
                  meta: share > 0 ? `${share}%` : undefined,
                  color: 'hsl(var(--chart-3))',
                };
              })}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Cool facts: most-watched cast, directors, creators, genres, and watch time. */
export default function WatchlistFacts() {
  const { watchlist, loading: libraryLoading } = useWatchlist();
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [peopleTab, setPeopleTab] = useState<PeopleTab>('all');
  const [personQuery, setPersonQuery] = useState('');

  const creditsQuery = useQuery({
    queryKey: ['watchlist-credits-index'],
    queryFn: fetchWatchlistCreditsIndex,
    staleTime: 10 * 60_000,
  });

  const facts = useMemo(
    () => computeCoolFacts(watchlist, creditsQuery.data ?? new Map()),
    [watchlist, creditsQuery.data],
  );

  const watchedHours = Math.round(facts.totalWatchedMinutes / 60);
  const movieHours = Math.round(facts.movieWatchedMinutes / 60);
  const showHours = Math.round(facts.showWatchedMinutes / 60);
  const watchedDays = (facts.totalWatchedMinutes / (60 * 24)).toFixed(1);
  const totalWatchedTitles = facts.watchedMoviesCount + facts.watchedShowsCount;
  const loading = libraryLoading || creditsQuery.isLoading;

  const normalizedPersonQuery = personQuery.trim().toLowerCase();
  const filterPeople = (list: WatchedPersonStat[]) =>
    normalizedPersonQuery
      ? list.filter(
          (p) =>
            p.name.toLowerCase().includes(normalizedPersonQuery) ||
            p.sampleItems.some((s) => s.title.toLowerCase().includes(normalizedPersonQuery)),
        )
      : list;

  const filteredCast = useMemo(
    () => filterPeople(facts.topCast),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterPeople reads normalizedPersonQuery.
    [facts.topCast, normalizedPersonQuery],
  );
  const filteredDirectors = useMemo(
    () => filterPeople(facts.topDirectors),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterPeople reads normalizedPersonQuery.
    [facts.topDirectors, normalizedPersonQuery],
  );
  const filteredCreators = useMemo(
    () => filterPeople(facts.topCreators),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterPeople reads normalizedPersonQuery.
    [facts.topCreators, normalizedPersonQuery],
  );

  const toolbar = (
    <div className="watchlist-toolbar space-y-2 py-2">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <WatchlistNav current="facts" />
      </div>
    </div>
  );

  return (
    <AppShell
      title="Watchlist"
      subtitle="Cool facts"
      toolbar={toolbar}
    >
      <div className="space-y-8 pb-8">
        <p className="text-sm text-muted-foreground">
          Deterministic watch-time milestones, most-watched cast, directors, creators, genres, and eras across your library. Click any person to inspect their full filmography.
        </p>

        {creditsQuery.isError ? (
          <SectionFailure>
            Could not load credits index.
          </SectionFailure>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Crunching your watch stats…</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricTile
                label="Total watch time"
                value={
                  facts.totalWatchedMinutes > 0 && facts.totalWatchedMinutes < 60
                    ? `${facts.totalWatchedMinutes}m`
                    : watchedHours
                }
                suffix={
                  facts.totalWatchedMinutes > 0 && facts.totalWatchedMinutes < 60
                    ? undefined
                    : 'h'
                }
                variant="gradient"
                icon={<Clock className="h-4 w-4" aria-hidden="true" />}
                detail={`≈ ${watchedDays} days of screen time (${movieHours.toLocaleString()}h films · ${showHours.toLocaleString()}h series)`}
              />
              <MetricTile
                label="Films watched"
                value={facts.watchedMoviesCount}
                icon={<Film className="h-4 w-4" aria-hidden="true" />}
                detail={
                  facts.averageMovieMinutes > 0
                    ? `${movieHours.toLocaleString()}h total · avg ${facts.averageMovieMinutes}m per film`
                    : `${movieHours.toLocaleString()}h total film runtime`
                }
              />
              <MetricTile
                label="Series started"
                value={facts.watchedShowsCount}
                icon={<Tv className="h-4 w-4" aria-hidden="true" />}
                detail={`${facts.completedShowsCount} completed (all listed episodes watched)`}
              />
              <MetricTile
                label="Episodes watched"
                value={facts.watchedEpisodesCount}
                icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                detail={`${showHours.toLocaleString()}h across watched episodes`}
              />
            </div>

            {facts.totalWatchedMinutes > 0 || facts.mostWatchedShow || facts.longestWatchedMovie ? (
              <div className="grid gap-3 lg:grid-cols-3">
                <Card className="surface-card">
                  <CardHeader className="pb-2.5">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                      Screen-time allocation
                    </CardTitle>
                    <CardDescription className="text-xs">
                      How your total watched hours divide between films and series.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CategoryBar
                      ariaLabel="Screen-time split between films and series"
                      segments={[
                        {
                          label: 'Films',
                          value: facts.movieWatchedMinutes,
                          color: 'hsl(var(--primary))',
                        },
                        {
                          label: 'Series',
                          value: facts.showWatchedMinutes,
                          color: 'hsl(var(--chart-2))',
                        },
                      ]}
                      valueFormatter={(val, pct) => `${Math.round(val / 60).toLocaleString()}h (${pct.toFixed(0)}%)`}
                    />
                  </CardContent>
                </Card>

                {facts.mostWatchedShow ? (
                  <Card className="surface-card">
                    <CardHeader className="pb-2.5">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <Trophy className="h-4 w-4 text-primary" aria-hidden="true" />
                        Most binged series
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Highest watched episode count in your library.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        {facts.mostWatchedShow.imageUrl ? (
                          <img
                            src={facts.mostWatchedShow.imageUrl}
                            alt=""
                            className="h-14 w-10 shrink-0 rounded-sm border border-border/60 bg-muted object-cover"
                          />
                        ) : (
                          <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-sm bg-muted">
                            <Tv className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {facts.mostWatchedShow.title}
                          </p>
                          <p className="font-mono text-xs tabular-nums text-muted-foreground">
                            {facts.mostWatchedShow.episodes} episodes watched
                            {facts.mostWatchedShow.minutes > 0
                              ? ` · ${Math.round(facts.mostWatchedShow.minutes / 60).toLocaleString()}h`
                              : ''}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {facts.longestWatchedMovie ? (
                  <Card className="surface-card">
                    <CardHeader className="pb-2.5">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <Film className="h-4 w-4 text-primary" aria-hidden="true" />
                        Longest film watched
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Longest single feature runtime in your watched shelf.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        {facts.longestWatchedMovie.imageUrl ? (
                          <img
                            src={facts.longestWatchedMovie.imageUrl}
                            alt=""
                            className="h-14 w-10 shrink-0 rounded-sm border border-border/60 bg-muted object-cover"
                          />
                        ) : (
                          <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-sm bg-muted">
                            <Film className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {facts.longestWatchedMovie.title}
                          </p>
                          <p className="font-mono text-xs tabular-nums text-muted-foreground">
                            {formatRuntimeHoursMinutes(facts.longestWatchedMovie.minutes)} ({facts.longestWatchedMovie.minutes}m)
                            {facts.longestWatchedMovie.year ? ` · ${facts.longestWatchedMovie.year}` : ''}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ) : null}

            <section aria-labelledby="facts-people-heading" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
                <div className="space-y-1">
                  <h2 id="facts-people-heading">
                    <DotMatrixText text="PEOPLE & COLLABORATORS" size="xs" />
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Select any actor, director, or creator row to open their library and TMDB filmography.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[13rem]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      type="search"
                      value={personQuery}
                      onChange={(e) => setPersonQuery(e.target.value)}
                      placeholder="Filter people or titles…"
                      aria-label="Filter people"
                      className={cn('h-11 pl-9', personQuery && 'pr-10')}
                    />
                    {personQuery ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="group/clear absolute right-0 top-0 h-11 w-11 text-muted-foreground hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                        aria-label="Clear people filter"
                        onClick={() => setPersonQuery('')}
                      >
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors group-hover/clear:bg-secondary group-hover/clear:text-secondary-foreground group-focus-visible/clear:ring-2 group-focus-visible/clear:ring-ring">
                          <X className="h-4 w-4" />
                        </span>
                      </Button>
                    ) : null}
                  </div>

                  <NativeSelect
                    aria-label="Filter people category"
                    value={peopleTab}
                    onChange={(e) => setPeopleTab(e.target.value as PeopleTab)}
                    wrapperClassName="w-auto sm:hidden"
                  >
                    {PEOPLE_TABS.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </NativeSelect>
                  <SegmentedControl
                    label="Filter people category"
                    options={PEOPLE_TABS}
                    value={peopleTab}
                    onChange={setPeopleTab}
                    className="hidden sm:inline-flex"
                  />
                </div>
              </div>

              <div
                className={cn(
                  'grid gap-4',
                  peopleTab === 'all' ? 'lg:grid-cols-3' : 'grid-cols-1 max-w-3xl',
                )}
              >
                {(peopleTab === 'all' || peopleTab === 'cast') && (
                  <PersonLeaderboardCard
                    title="Most watched cast"
                    description="Across your watched films & series (from stored top-3 cast)."
                    icon={Users}
                    people={filteredCast}
                    expandedByDefault={peopleTab === 'cast' || normalizedPersonQuery.length > 0}
                    onSelectPerson={setSelectedPerson}
                  />
                )}
                {(peopleTab === 'all' || peopleTab === 'directors') && (
                  <PersonLeaderboardCard
                    title="Most watched directors"
                    description="Directors of films you have watched."
                    icon={Clapperboard}
                    people={filteredDirectors}
                    expandedByDefault={peopleTab === 'directors' || normalizedPersonQuery.length > 0}
                    onSelectPerson={setSelectedPerson}
                  />
                )}
                {(peopleTab === 'all' || peopleTab === 'creators') && (
                  <PersonLeaderboardCard
                    title="Most watched creators"
                    description="Creators of series you have started or finished."
                    icon={Tv}
                    people={filteredCreators}
                    expandedByDefault={peopleTab === 'creators' || normalizedPersonQuery.length > 0}
                    onSelectPerson={setSelectedPerson}
                  />
                )}
              </div>
            </section>

            <section aria-labelledby="facts-taste-heading" className="space-y-4">
              <div className="space-y-1 border-b border-border/50 pb-3">
                <h2 id="facts-taste-heading">
                  <DotMatrixText text="TASTE, PLATFORMS & ERAS" size="xs" />
                </h2>
                <p className="text-xs text-muted-foreground">
                  Distribution of genres, streaming homes, and release decades across your watched titles.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card className="surface-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Top genres</CardTitle>
                    <CardDescription className="text-xs">
                      Most frequent genres on your watched shelf.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BarList
                      emptyLabel="No watched data yet."
                      data={facts.topGenres.map((row) => {
                        const share =
                          totalWatchedTitles > 0
                            ? Math.round((row.count / totalWatchedTitles) * 100)
                            : 0;
                        return {
                          key: row.label,
                          name: row.label,
                          value: row.count,
                          meta: share > 0 ? `${share}%` : undefined,
                          color: 'hsl(var(--primary))',
                        };
                      })}
                    />
                  </CardContent>
                </Card>

                <Card className="surface-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Top platforms</CardTitle>
                    <CardDescription className="text-xs">
                      Where your watched films and series stream.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BarList
                      emptyLabel="No watched data yet."
                      data={facts.topPlatforms.map((row) => {
                        const share =
                          totalWatchedTitles > 0
                            ? Math.round((row.count / totalWatchedTitles) * 100)
                            : 0;
                        return {
                          key: row.label,
                          name: row.label,
                          value: row.count,
                          meta: share > 0 ? `${share}%` : undefined,
                          color: 'hsl(var(--chart-2))',
                          icon: hasPlatformLogo(row.label) ? (
                            <PlatformLogo platform={row.label} size={14} maxWidth={56} className="shrink-0" />
                          ) : undefined,
                        };
                      })}
                    />
                  </CardContent>
                </Card>

                <DecadesChartCard rows={facts.topDecades} totalTitles={totalWatchedTitles} />
              </div>
            </section>
          </>
        )}

        <PersonFilmographyDialog
          name={selectedPerson}
          open={selectedPerson !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedPerson(null);
          }}
        />
      </div>
    </AppShell>
  );
}

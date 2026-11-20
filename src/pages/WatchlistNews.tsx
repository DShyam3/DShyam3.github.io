import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Calendar, Tv } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { Button } from '@/components/ui/button';
import { SectionFailure } from '@/features/watchlist/components/SectionFailure';
import { WatchlistDetailDialog } from '@/features/watchlist/components/WatchlistDetailDialog';
import { PosterCard } from '@/features/watchlist/components/PosterCard';
import { PlatformBadge } from '@/features/watchlist/components/PlatformLogo';
import { WatchlistNav } from '@/features/watchlist/components/WatchlistNav';
import { useWatchlist } from '@/features/watchlist/useWatchlist';
import {
  usePinnedTitle,
  usePremiereSeasonEpisodes,
  useRecentEpisodes,
  useUpcomingEpisodes,
  useRecentMovies,
  useUpcomingMovies,
  useWatchlistEvents,
  useRecentAnnouncements,
  useFeaturedExtras,
  type WatchlistNewsEpisode,
} from '@/features/watchlist/useWatchlistNews';
import {
  buildUpdatesFeed,
  daysUntil,
  filterRecentByWindow,
  filterUpcomingByWindow,
  filterUpdatesByWindow,
  getStatusColor,
  groupAnnouncementsByShow,
  groupRecentEpisodesByShow,
  isPremiereEpisode,
  isSeasonFinished,
  movieReleaseSentence,
  relativeDay,
  seasonPremiereSentence,
  seasonRun,
  type SeasonRun,
  type UpdatesFeedRow,
  type UpdatesWindow,
} from '@/features/watchlist/watchlist-utils';
import { formatDate } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import { useSchedule, type ScheduleItem as ScheduleEntry } from '@/features/watchlist/useSchedule';
import { useAuth } from '@/contexts/AuthContext';
import { SmartScheduleDialog, scheduleReleaseDate } from '@/features/watchlist/components/SmartScheduleDialog';
import './WatchlistNews.css';
import { DiscoverySection } from '@/features/watchlist/components/DiscoverySection';
import { SegmentedControl } from '@/features/watchlist/components/SegmentedControl';
import { LIBRARY_TYPE_OPTIONS, type LibraryType, isFollowedState } from '@/features/watchlist/library-state';
import { readDeclinedReleases, YourWeek } from '@/features/watchlist/components/YourWeek';

/** Which entity a click on a card or row resolves to -- looked up in
 *  `useWatchlist()`'s list by both fields, since a TV show and a movie id
 *  can collide. */
type EntityRef = { entityType: 'tv_show' | 'movie'; entityId: number };

/** News data adapter for the same poster and schedule action used by Library. */
function NewsPosterCard({
  title,
  poster,
  sub,
  platform,
  pill,
  onClick,
  schedule,
}: {
  title: string;
  poster: string | null;
  sub: string;
  platform: string | null;
  pill?: ReactNode;
  srLabel?: string;
  onClick: () => void;
  schedule?: {
    scheduled: boolean;
    releaseDate?: string;
    defaultMode: 'weekly' | 'date';
    onAdd: (day: ScheduleEntry['day'], date: string, mode: 'weekly' | 'date') => void;
    onRemove: () => void;
  };
}) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  return (
    <>
      <PosterCard
        title={title}
        poster={poster}
        subtitle={sub}
        meta={
          <div className="flex flex-wrap items-center gap-1.5">
            <PlatformBadge platform={platform ?? undefined} size={18} />
            {pill}
          </div>
        }
        scheduled={schedule?.scheduled}
        onSchedule={
          schedule
            ? () => {
                if (schedule.scheduled) schedule.onRemove();
                else setScheduleOpen(true);
              }
            : undefined
        }
        onOpen={onClick}
      />
      {schedule && (
        <SmartScheduleDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          title={title}
          releaseDate={schedule.releaseDate}
          defaultMode={schedule.defaultMode}
          onAdd={schedule.onAdd}
        />
      )}
    </>
  );
}

/** The countdown pill on an Upcoming card, styled as the library card's
 *  dated status pill. Just "3d", not "Out in 3d": at a narrow card
 *  width, the longer text pushed the pill onto its own line
 *  beside a text platform badge, and those cards stood taller than their
 *  row. The card's accessible name carries the full sentence. */
function CountdownPill({ days }: { days: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium tabular-nums',
        getStatusColor('Releases in'),
      )}
    >
      <Calendar className="h-3 w-3 shrink-0 text-muted-foreground" />
      {days <= 0 ? 'Today' : `${days}d`}
    </span>
  );
}

/** One row of the merged Updates list, laid out on fixed grid tracks --
 *  poster | title (with the line stacked beneath) | platform | date -- so
 *  every column lines up down the list. The line sits under the title rather
 *  than in a column of its own, which on a wide screen left a gap across the
 *  middle of every row. Below `sm` the platform column is hidden
 *  (REHAUL_PLAN.md 8.C-bis). */
function UpdateRow({
  row,
  today,
  onClick,
}: {
  row: UpdatesFeedRow;
  today: Date;
  onClick: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const showFallback = !row.poster || broken;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${row.title} — open details`}
      className="news-update-row grid w-full grid-cols-[44px_minmax(0,1fr)_64px] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:grid-cols-[56px_minmax(0,1fr)_104px_72px] sm:gap-x-4"
    >
      <div className="col-start-1 row-span-2 row-start-1 aspect-[2/3] w-11 shrink-0 self-center overflow-hidden rounded bg-muted sm:w-14">
        {showFallback ? (
          <div className="missing-art flex h-full w-full items-center justify-center">
            <Tv className="h-3.5 w-3.5" />
          </div>
        ) : (
          <img
            src={row.poster ?? undefined}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-contain"
          />
        )}
      </div>

      <span className="col-start-2 row-start-1 min-w-0 self-end truncate font-serif text-sm font-medium sm:text-base">
        {row.title}
      </span>

      <span className="col-start-2 row-start-2 min-w-0 self-start truncate text-xs text-muted-foreground sm:text-sm">
        {row.sentence}
      </span>

      <span className="hidden min-w-0 items-center sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:flex">
        <PlatformBadge platform={row.platform ?? undefined} size={16} />
      </span>

      <span className="col-start-3 row-span-2 row-start-1 shrink-0 justify-self-end text-right text-xs text-muted-foreground sm:col-start-4 sm:text-sm">
        {relativeDay(row.occurredAt, today)}
      </span>
    </button>
  );
}

/** THIS WEEK / THIS MONTH -- the one page-level window (REHAUL_PLAN.md
 *  8.C-bis) that scopes Out Now and Updates (backward) and Upcoming
 *  (forward); see `WatchlistNews`'s toolbar, the only place it is rendered. */
const NEWS_WINDOW_OPTIONS: { key: UpdatesWindow; label: string }[] = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
];

type NewsPanel = 'following' | 'discover';
const NEWS_PANEL_OPTIONS: { key: NewsPanel; label: string }[] = [
  { key: 'following', label: 'Following' },
  { key: 'discover', label: 'Discover' },
];

/** Remembered choices; unavailable storage falls back to the default. */
function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return allowed.find((value) => value === stored) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The choice resets next visit.
  }
}

/** "Wed 18 Nov": the day matters more than the year for something this close. */
const shortDay = (date: string) =>
  new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

interface FeaturedRow extends EntityRef {
  title: string;
  poster: string | null;
  platform: string | null;
  date: string;
  line: string;
  /** Set for a season premiere, so the card can describe that season's run. */
  seasonNumber?: number;
}

/** "Weekly · 3 of 8 out · finale Wed 31 Dec", from the season's own rows. */
function seasonRunLine(run: SeasonRun): string {
  const parts = [run.pattern === 'all-at-once' ? 'All at once' : 'Weekly'];
  parts.push(run.aired >= run.total ? `${run.total} episode${run.total === 1 ? '' : 's'}` : `${run.aired} of ${run.total} out`);
  if (run.finale && run.pattern === 'weekly') parts.push(`finale ${shortDay(run.finale)}`);
  return parts.join(' · ');
}

/**
 * One title worth your attention: the poster opens it, a quiet button does
 * too. Its backdrop fills the card behind a gradient, with the plot and the
 * season's run beside the poster.
 */
function FeaturedCard({ featured, run, onOpen }: { featured: FeaturedRow; run: SeasonRun | null; onOpen: () => void }) {
  const [broken, setBroken] = useState(false);
  const [backdropBroken, setBackdropBroken] = useState(false);
  const { backdrop, overview } = useFeaturedExtras(featured.entityType, featured.entityId);
  const showBackdrop = !!backdrop && !backdropBroken;
  return (
    <section aria-labelledby="news-featured-title" className="news-featured relative overflow-hidden rounded-3xl border border-border/60 bg-card p-5 sm:p-6">
      {showBackdrop && (
        <>
          <img src={backdrop} alt="" aria-hidden="true" onError={() => setBackdropBroken(true)} className="news-featured-backdrop pointer-events-none absolute inset-y-0 right-0 h-full w-full object-cover sm:w-3/4" />
          <div aria-hidden="true" className="news-featured-scrim pointer-events-none absolute inset-0" />
        </>
      )}
      <div className="relative">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Worth your attention</p>
        <div className="mt-4 flex items-start gap-4 sm:gap-6">
          <button type="button" onClick={onOpen} aria-label={`${featured.title} — open details`} className="aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-2xl bg-muted shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-32">
            {featured.poster && !broken
              ? <img src={featured.poster} alt="" onError={() => setBroken(true)} className="h-full w-full object-cover" />
              : <span className="flex h-full items-center justify-center"><Tv className="h-6 w-6 text-muted-foreground" /></span>}
          </button>
          <div className="min-w-0 max-w-xl flex-1 space-y-3">
            <h2 id="news-featured-title" className="text-xl font-semibold leading-tight sm:text-2xl" style={{ textWrap: 'balance' }}>{featured.title}</h2>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>{featured.line} · {shortDay(featured.date)}</span>
              {featured.platform && <PlatformBadge platform={featured.platform} />}
            </p>
            {run && <p className="text-xs text-muted-foreground">{seasonRunLine(run)}</p>}
            {overview && <p className="hidden text-sm leading-relaxed text-foreground/80 sm:line-clamp-3">{overview}</p>}
            <div className="pt-1">
              <Button variant="outline" onClick={onOpen}>View details</Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const NEWS_WINDOW_STORAGE_KEY = 'watchlist-news-updates-window';

/** A throwing or unavailable store, or nothing stored yet, reads as "This
 *  week" -- the default the control opens on either way. */
const readStoredNewsWindow = (): UpdatesWindow => {
  try {
    return localStorage.getItem(NEWS_WINDOW_STORAGE_KEY) === 'month' ? 'month' : 'week';
  } catch {
    return 'week';
  }
};

/** The merged Updates list -- Released recently, Platform changes, Status
 *  changes and Announcements as one feed, newest first (REHAUL_PLAN.md
 *  8.C-bis) -- scoped by the page-level window control in the toolbar. An
 *  empty window shows one muted line rather than hiding the section. */
function UpdatesList({
  rows,
  activeWindow,
  today,
  onSelect,
  failed,
}: {
  rows: UpdatesFeedRow[];
  activeWindow: UpdatesWindow;
  today: Date;
  onSelect: (ref: EntityRef) => void;
  failed: boolean;
}) {
  return (
    <section className="news-pane news-pane-updates flex min-h-0 flex-1 flex-col min-w-0 rounded-2xl border border-border/60 bg-card p-4 space-y-3" aria-label="Updates">
      <h2 className="news-pane-heading shrink-0"><DotMatrixText text="UPDATES" size="sm" /></h2>
      {failed && (
        <SectionFailure>
          {rows.length === 0 ? 'Could not load updates' : 'Some updates could not load'}
        </SectionFailure>
      )}
      {rows.length === 0 ? (
        !failed && (
        <p className="px-2 py-3 text-xs text-muted-foreground">
          {activeWindow === 'week' ? 'Nothing this week' : 'Nothing this month'}
        </p>
        )
      ) : (
        <div className="watchlist-updates-scroll news-updates-grid">
          {rows.map((row) => (
            <UpdateRow
              key={row.key}
              row={row}
              today={today}
              onClick={() => onSelect({ entityType: row.entityType, entityId: row.entityId })}
            />
          ))}
        </div>
      )}
    </section>
  );
}

type OutNowRow =
  | {
      key: string;
      kind: 'premiere';
      title: string;
      poster: string | null;
      platform: string;
      date: string;
      seasonNumber: number;
      entityId: number;
    }
  | {
      key: string;
      kind: 'movie';
      title: string;
      poster: string | null;
      platform: string;
      date: string;
      entityId: number;
    };

interface UpcomingRow extends EntityRef {
  key: string;
  title: string;
  poster: string | null;
  platform: string;
  date: string;
  days: number;
  sentence: string;
}

/** From `WatchlistNewsEpisode`/`WatchlistNewsMovie`, only the ones that count as a premiere. */
const premieresOf = (episodes: WatchlistNewsEpisode[]) =>
  episodes.filter((ep) => isPremiereEpisode(ep.episode_number, ep.season_number));

/** Upcoming's card wall (REHAUL_PLAN.md 8.C-bis): a bounded, wrapping grid,
 *  not a horizontal rail with a "+N more" -- so a full week or month of
 *  premieres and releases is visible without scrolling, nearest first.
 *  Scoped by the same page-level window as Updates (`WatchlistNews`'s
 *  toolbar), just counting forward instead of back. An empty window keeps
 *  the heading and shows one muted line, matching Updates' own empty state. */
function UpcomingGrid({
  items,
  activeWindow,
  onSelect,
  scheduleFor,
  failed,
}: {
  items: UpcomingRow[];
  activeWindow: UpdatesWindow;
  onSelect: (ref: EntityRef) => void;
  scheduleFor?: (item: UpcomingRow) => React.ComponentProps<typeof NewsPosterCard>['schedule'];
  failed: boolean;
}) {
  return (
    <section className="news-pane news-pane-upcoming min-w-0 space-y-3">
      <h2 className="news-pane-heading"><DotMatrixText text="UPCOMING" size="sm" /></h2>
      {failed && (
        <SectionFailure>
          {items.length === 0 ? 'Could not load upcoming releases' : 'Some upcoming releases could not load'}
        </SectionFailure>
      )}
      {items.length === 0 ? (
        !failed && (
        <p className="px-2 py-3 text-xs text-muted-foreground">
          {activeWindow === 'week' ? 'Nothing coming this week' : 'Nothing coming this month'}
        </p>
        )
      ) : (
        <div className="news-card-grid">
          {items.map((item) => (
            <NewsPosterCard
              key={item.key}
              title={item.title}
              poster={item.poster}
              platform={item.platform || null}
              sub={formatDate(item.date)}
              pill={<CountdownPill days={item.days} />}
              srLabel={`${item.title} -- ${item.sentence}`}
              onClick={() => onSelect(item)}
              schedule={scheduleFor?.(item)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * The watchlist's front door (REHAUL_PLAN.md 8.C-bis): what to watch now,
 * before what is owned. Every section shares one anatomy -- a poster, a
 * title, one sentence -- folds a show's multiple episodes into one card, and
 * renders nothing when it has nothing to say, so the page stays short. Every
 * card opens the title's detail dialog, held once at page level and matched
 * from `useWatchlist()` by category and id together, since a TV show and a
 * movie can share a numeric id.
 *
 * A show appears in at most one of Watch Next, Out Now and a released-episode
 * Updates row, priority Watch Next > Out Now > Updates -- built from the
 * actual rendered Watch Next and Out Now rows below, not re-derived.
 */
const WatchlistNews = () => {
  const today = new Date();
  const { watchlist, loading: watchlistLoading, getAutoStatus, isEpisodeWatched, isSeasonWatched, toggleEpisodeWatched } = useWatchlist();
  const { isAdmin } = useAuth();
  const { schedule, loading: scheduleLoading, addToSchedule, removeFromSchedule, updateScheduleDay, removeFromScheduleByWatchlistId, isInSchedule } = useSchedule();
  const [detailScheduleOpen, setDetailScheduleOpen] = useState(false);
  const [selectedRef, setSelectedRef] = useState<EntityRef | null>(null);
  const [declinedReleases, setDeclinedReleases] = useState<string[]>(readDeclinedReleases);
  // Page level (REHAUL_PLAN.md 8.C-bis): drives both Upcoming (forward) and
  // Updates (backward), and Out Now (backward) too.
  const [newsWindow, setNewsWindow] = useState<UpdatesWindow>(readStoredNewsWindow);
  const [newsPanel, setNewsPanel] = useState<NewsPanel>(() => readStored('watchlist-news-panel', ['following', 'discover'], 'following'));
  const [newsType, setNewsType] = useState<LibraryType>(() => readStored('watchlist-news-type', ['all', 'movie', 'tv'], 'all'));
  useEffect(() => writeStored('watchlist-news-panel', newsPanel), [newsPanel]);
  useEffect(() => writeStored('watchlist-news-type', newsType), [newsType]);
  const typeMatches = (entityType: EntityRef['entityType']) =>
    newsType === 'all' || (newsType === 'movie' ? entityType === 'movie' : entityType === 'tv_show');

  useEffect(() => {
    try {
      localStorage.setItem(NEWS_WINDOW_STORAGE_KEY, newsWindow);
    } catch {
      // A throwing or unavailable store just means the choice resets to
      // "This week" next visit -- see readStoredNewsWindow.
    }
  }, [newsWindow]);

  const selectedItem =
    selectedRef &&
    watchlist.find(
      (item) =>
        item.category === (selectedRef.entityType === 'tv_show' ? 'TV Shows' : 'Movies') &&
        item.id === String(selectedRef.entityId),
    );

  const openDetail = useCallback((ref: EntityRef) => setSelectedRef(ref), []);

  const scheduleFor = useCallback((entityType: EntityRef['entityType'], entityId: number, title: string, date: string): React.ComponentProps<typeof NewsPosterCard>['schedule'] => {
    if (!isAdmin) return undefined;
    const watchlistItemId = String(entityId);
    const category = entityType === 'tv_show' ? 'TV Shows' : 'Movies';
    return {
      scheduled: isInSchedule({ id: watchlistItemId, category }),
      releaseDate: date,
      defaultMode: entityType === 'tv_show' ? ('weekly' as const) : ('date' as const),
      onAdd: (day: ScheduleEntry['day'], scheduledDate: string, mode: 'weekly' | 'date') => addToSchedule({
        watchlistItemId,
        day: mode === 'date'
          ? new Date(`${scheduledDate}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' }) as ScheduleEntry['day']
          : day,
        title,
        category,
        image_url: undefined,
        scheduledDate: mode === 'date' ? scheduledDate : undefined,
        mode,
      }),
      onRemove: () => { void removeFromScheduleByWatchlistId({ id: watchlistItemId, category }); },
    };
  }, [addToSchedule, isAdmin, isInSchedule, removeFromScheduleByWatchlistId]);

  const activeKeys = new Set(watchlist.filter((item) => isFollowedState(item.library_state)).map((item) => `${item.category === 'Movies' ? 'movie' : 'tv_show'}:${item.id}`));
  const isFollowing = (entityType: EntityRef['entityType'], id: number) => activeKeys.has(`${entityType}:${id}`);

  const { pinned, loading: pinnedLoading, failed: pinnedFailed } = usePinnedTitle();
  const pinnedDays = pinned ? daysUntil(pinned.release_date, today) : null;
  const showCountdown =
    !!pinned &&
    pinnedDays !== null &&
    pinnedDays >= 0 &&
    isFollowing(pinned.media_type === 'tv' ? 'tv_show' : 'movie', pinned.id);

  // Out Now and Updates both fetch their widest window (30 days) once; the
  // page-level window filters client-side (filterRecentByWindow here,
  // filterUpdatesByWindow below), so switching it never refetches. The one
  // episode fetch serves both sections.
  const { episodes: recentEpisodes, loading: recentLoading, failed: recentFailed } = useRecentEpisodes(30);
  const { movies: outNowMovies, loading: outNowMovieLoading, failed: outNowMovieFailed } = useRecentMovies(30);

  const outNowPremiereCandidates = premieresOf(recentEpisodes);
  const { episodesBySeason: premiereSeasonEpisodes, loading: premiereSeasonLoading, failed: premiereSeasonFailed } =
    usePremiereSeasonEpisodes(
      outNowPremiereCandidates.map((ep) => ({
        tv_show_id: ep.tv_show_id,
        season_number: ep.season_number,
      })),
    );
  // Every list filters on the library, so it is loading until that is.
  const outNowLoading = watchlistLoading || recentLoading || outNowMovieLoading || premiereSeasonLoading;
  const outNowFailed = recentFailed || outNowMovieFailed || premiereSeasonFailed;

  // A premiere drops out of Out Now when its season is already finished (the
  // user is caught up -- see isSeasonFinished) or when the same show already
  // has a Watch Next card (priority Watch Next > Out Now).
  const outNowPremieres = outNowPremiereCandidates.filter((ep) => {
    if (!isFollowing('tv_show', ep.tv_show_id)) return false;
    const seasonEpisodes = premiereSeasonEpisodes.get(`${ep.tv_show_id}:${ep.season_number}`);
    if (seasonEpisodes && isSeasonFinished(seasonEpisodes, today)) return false;
    return true;
  });
  const outNowItems: OutNowRow[] = filterRecentByWindow(
    [
      ...outNowPremieres.map((ep): OutNowRow => ({
        key: `tv-${ep.tv_show_id}-${ep.season_number}`,
        kind: 'premiere',
        title: ep.title,
        poster: ep.poster,
        platform: ep.platform,
        date: ep.release_date,
        seasonNumber: ep.season_number,
        entityId: ep.tv_show_id,
      })),
      ...outNowMovies.filter((movie) => isFollowing('movie', movie.id) && !watchlist.find((item) => item.category === 'Movies' && item.id === String(movie.id))?.watched).map((movie): OutNowRow => ({
        key: `movie-${movie.id}`,
        kind: 'movie',
        title: movie.title,
        poster: movie.poster,
        platform: movie.platform,
        date: movie.release_date,
        entityId: movie.id,
      })),
    ],
    newsWindow,
    today,
  ).sort((a, b) => b.date.localeCompare(a.date));
  // From the rendered, windowed rows -- a premiere outside the window is not on
  // screen, so it must not keep its show out of Updates either.
  const outNowTvIds = new Set(
    outNowItems.filter((item) => item.kind === 'premiere').map((item) => item.entityId),
  );

  const { episodes: upcomingEpisodes, loading: upcomingTvLoading, failed: upcomingTvFailed } = useUpcomingEpisodes();
  const { movies: upcomingMovies, loading: upcomingMovieLoading, failed: upcomingMovieFailed } = useUpcomingMovies();
  const upcomingLoading = watchlistLoading || upcomingTvLoading || upcomingMovieLoading;
  const upcomingFailed = upcomingTvFailed || upcomingMovieFailed;
  const upcomingItems: UpcomingRow[] = [
    ...premieresOf(upcomingEpisodes).filter((ep) => isFollowing('tv_show', ep.tv_show_id)).map((ep): UpcomingRow => {
      const days = daysUntil(ep.release_date, today) ?? 0;
      return {
        key: `tv-${ep.tv_show_id}-${ep.season_number}`,
        title: ep.title,
        poster: ep.poster,
        platform: ep.platform,
        date: ep.release_date,
        days,
        sentence: seasonPremiereSentence(ep.season_number, days),
        entityType: 'tv_show',
        entityId: ep.tv_show_id,
      };
    }),
    ...upcomingMovies.filter((movie) => isFollowing('movie', movie.id)).map((movie): UpcomingRow => {
      const days = daysUntil(movie.release_date, today) ?? 0;
      return {
        key: `movie-${movie.id}`,
        title: movie.title,
        poster: movie.poster,
        platform: movie.platform,
        date: movie.release_date,
        days,
        sentence: movieReleaseSentence(days, movie.release_date),
        entityType: 'movie',
        entityId: movie.id,
      };
    }),
  ].sort((a, b) => a.date.localeCompare(b.date));
  // Fetched unbounded (every future row); the page-level window filters
  // client-side (filterUpcomingByWindow), same pattern as Updates below.
  const upcomingWindowItems = filterUpcomingByWindow(upcomingItems, newsWindow, today);

  // Updates fetches its widest window (30 days) once from every source; the
  // page-level window control filters client-side (filterUpdatesByWindow),
  // so switching it never refetches.
  const { events, loading: eventsLoading, failed: eventsFailed } = useWatchlistEvents(30);

  // A show already shown in Watch Next or Out Now does not also get a
  // released-episode row here (priority Watch Next > Out Now > Updates).
  // Platform and status rows are not deduplicated -- they are different news.
  const excludedFromUpdates = new Set([...outNowTvIds]);
  const recentGroups = groupRecentEpisodesByShow(recentEpisodes).filter(
    (group) => !excludedFromUpdates.has(group.tv_show_id),
  );

  const { announcements, firstSeenByShow, loading: announcementsLoading, failed: announcementsFailed } =
    useRecentAnnouncements(30);
  const announcementGroups = groupAnnouncementsByShow(announcements, firstSeenByShow, today);

  const updatesLoading = watchlistLoading || eventsLoading || recentLoading || announcementsLoading;
  const updatesFailed = eventsFailed || recentFailed || announcementsFailed;
  const updatesFeed = filterUpdatesByWindow(
    buildUpdatesFeed(recentGroups, events, announcementGroups, today),
    newsWindow,
    today,
  );

  // One title per feed. The featured slot goes to something watchable now,
  // then the pinned countdown, then the next release; the lists below skip
  // whatever it took.
  const rowLimit = 24;
  const typedOutNow = outNowItems.filter((row) => typeMatches(row.kind === 'movie' ? 'movie' : 'tv_show'));
  const typedUpcoming = upcomingWindowItems.filter((row) => typeMatches(row.entityType));
  const pinnedType: EntityRef['entityType'] | null = pinned ? (pinned.media_type === 'tv' ? 'tv_show' : 'movie') : null;
  const pinnedRow: UpcomingRow | null = pinned && pinnedType && showCountdown && typeMatches(pinnedType) && pinned.release_date
    ? {
        key: `pinned-${pinnedType}-${pinned.id}`,
        title: pinned.title,
        poster: pinned.poster,
        platform: watchlist.find((item) => item.category === (pinnedType === 'tv_show' ? 'TV Shows' : 'Movies') && item.id === String(pinned.id))?.streaming_platform ?? '',
        date: pinned.release_date,
        days: pinnedDays ?? 0,
        sentence: pinnedDays === 0 ? 'Out today' : `${pinnedDays} day${pinnedDays === 1 ? '' : 's'} to go`,
        entityType: pinnedType,
        entityId: pinned.id,
      }
    : null;
  const nextUp = pinnedRow ?? typedUpcoming[0];
  const featured: FeaturedRow | undefined = typedOutNow[0]
    ? {
        entityType: typedOutNow[0].kind === 'movie' ? 'movie' : 'tv_show',
        entityId: typedOutNow[0].entityId,
        title: typedOutNow[0].title,
        poster: typedOutNow[0].poster,
        platform: typedOutNow[0].platform || null,
        date: typedOutNow[0].date,
        line: typedOutNow[0].kind === 'premiere' ? `Season ${typedOutNow[0].seasonNumber} is out` : 'Out now',
        seasonNumber: typedOutNow[0].kind === 'premiere' ? typedOutNow[0].seasonNumber : undefined,
      }
    : nextUp
      ? { entityType: nextUp.entityType, entityId: nextUp.entityId, title: nextUp.title, poster: nextUp.poster, platform: nextUp.platform || null, date: nextUp.date, line: nextUp.sentence }
      : undefined;
  const featuredSeason = featured?.seasonNumber !== undefined
    ? watchlist
      .find((item) => item.category === 'TV Shows' && item.id === String(featured.entityId))
      ?.seasons?.find((season) => season.season_number === featured.seasonNumber)
    : undefined;
  const featuredRun = featuredSeason ? seasonRun(featuredSeason.episodes, today) : null;
  const used = new Set<string>(featured ? [`${featured.entityType}:${featured.entityId}`] : []);
  const takeUnique = <T,>(items: T[], refOf: (item: T) => EntityRef, limit: number): T[] => {
    const result: T[] = [];
    for (const item of items) {
      if (result.length >= limit) break;
      const ref = refOf(item);
      const key = `${ref.entityType}:${ref.entityId}`;
      if (used.has(key) || !isFollowing(ref.entityType, ref.entityId)) continue;
      used.add(key);
      result.push(item);
    }
    return result;
  };
  const visibleOutNow = takeUnique(
    typedOutNow,
    (row) => ({ entityType: row.kind === 'movie' ? 'movie' : 'tv_show', entityId: row.entityId }),
    rowLimit,
  );
  // A pinned title beyond the window still shows, first, when it is not featured.
  const upcomingWithPinned = pinnedRow && !typedUpcoming.some((row) => row.entityType === pinnedRow.entityType && row.entityId === pinnedRow.entityId)
    ? [pinnedRow, ...typedUpcoming]
    : typedUpcoming;
  const visibleUpcoming = takeUnique(upcomingWithPinned, (row) => row, rowLimit);
  const visibleUpdates = updatesFeed
    .filter((row) => typeMatches(row.entityType) && isFollowing(row.entityType, row.entityId) && (row.kind !== 'released' || !used.has(`${row.entityType}:${row.entityId}`)))
    .slice(0, rowLimit);

  const toolbar = (
    <div className="ultrawide-toolbar flex flex-wrap items-center justify-between gap-3">
      <WatchlistNav current="news" />
      <SegmentedControl label="News view" options={NEWS_PANEL_OPTIONS} value={newsPanel} onChange={setNewsPanel} />
    </div>
  );

  return (
    <AppShell
      title="Watchlist"
      subtitle="A little inspiration for your next watch"
      toolbar={toolbar}
    >
      <div className={cn('curated-news py-2', newsPanel === 'following' ? 'curated-news-following flex flex-col gap-4' : 'space-y-8 py-4')}>
        <div className="ultrawide-toolbar flex shrink-0 flex-wrap items-center justify-between gap-3">
          <SegmentedControl label="Show films, series or both" options={LIBRARY_TYPE_OPTIONS} value={newsType} onChange={setNewsType} />
          {newsPanel === 'following' && <SegmentedControl label="News time range" options={NEWS_WINDOW_OPTIONS} value={newsWindow} onChange={setNewsWindow} />}
        </div>
        {newsPanel === 'following' ? (
          <div className="ultrawide-news-grid">
            <div className="news-left-col flex flex-col gap-5 min-w-0">
              {featured && <div className="shrink-0"><FeaturedCard key={`${featured.entityType}:${featured.entityId}`} featured={featured} run={featuredRun} onOpen={() => openDetail(featured)} /></div>}
              {!pinnedLoading && pinnedFailed && <SectionFailure>Could not load the countdown.</SectionFailure>}
              <section className="shrink-0 space-y-3" aria-labelledby="news-out-now">
                <h2 id="news-out-now" className="news-pane-heading"><DotMatrixText text="OUT NOW" size="sm" /></h2>
                {outNowLoading && <p role="status" className="text-sm text-muted-foreground">Loading new releases…</p>}
                {outNowFailed && <SectionFailure>Some new releases could not load.</SectionFailure>}
                {!outNowLoading && !outNowFailed && visibleOutNow.length === 0 && (
                  <p className="px-2 py-3 text-xs text-muted-foreground">{newsWindow === 'week' ? 'Nothing new this week' : 'Nothing new this month'}</p>
                )}
                {visibleOutNow.length > 0 && (
                  <div className="news-card-grid">
                    {visibleOutNow.map((item) => (
                      <NewsPosterCard
                        key={item.key}
                        title={item.title}
                        poster={item.poster}
                        platform={item.platform}
                        sub={`${item.kind === 'premiere' ? `Season ${item.seasonNumber} · ` : ''}Out ${shortDay(item.date)}`}
                        onClick={() => openDetail({ entityType: item.kind === 'movie' ? 'movie' : 'tv_show', entityId: item.entityId })}
                        schedule={scheduleFor(item.kind === 'movie' ? 'movie' : 'tv_show', item.entityId, item.title, item.date)}
                      />
                    ))}
                  </div>
                )}
              </section>
              {upcomingLoading ? <p role="status" className="text-sm text-muted-foreground">Loading upcoming releases…</p> : <UpcomingGrid items={visibleUpcoming} activeWindow={newsWindow} onSelect={openDetail} scheduleFor={(item) => scheduleFor(item.entityType, item.entityId, item.title, item.date)} failed={upcomingFailed} />}
            </div>
            <div className="flex min-h-0 flex-col gap-4 min-w-0">
              <section aria-label="Your week" className="shrink-0 rounded-2xl border border-border/60 bg-card p-4">
                <YourWeek
                  schedule={schedule}
                  loading={scheduleLoading || watchlistLoading}
                  watchlist={watchlist}
                  declined={declinedReleases}
                  onDeclineChange={setDeclinedReleases}
                  removeFromSchedule={isAdmin ? removeFromSchedule : undefined}
                  updateScheduleDay={isAdmin ? updateScheduleDay : undefined}
                  addToSchedule={isAdmin ? addToSchedule : undefined}
                  toggleEpisodeWatched={isAdmin ? toggleEpisodeWatched : undefined}
                  isEpisodeWatched={isEpisodeWatched}
                  isSeasonWatched={isSeasonWatched}
                  getAutoStatus={getAutoStatus}
                  isInSchedule={isInSchedule}
                />
              </section>
              {updatesLoading ? <p role="status" className="text-sm text-muted-foreground">Loading updates…</p> : <UpdatesList rows={visibleUpdates} activeWindow={newsWindow} today={today} onSelect={openDetail} failed={updatesFailed} />}
            </div>
          </div>
        ) : <DiscoverySection type={newsType} />}
      </div>

      {selectedItem && (
        <WatchlistDetailDialog
          open={!!selectedItem}
          onOpenChange={(open) => {
            if (!open) setSelectedRef(null);
          }}
          item={selectedItem}
          status={getAutoStatus(selectedItem)}
          onSchedule={isAdmin ? () => setDetailScheduleOpen(true) : undefined}
          onRemoveFromSchedule={isAdmin ? () => { void removeFromScheduleByWatchlistId(selectedItem); } : undefined}
          isScheduled={isInSchedule(selectedItem)}
          toggleEpisodeWatched={isAdmin ? toggleEpisodeWatched : undefined}
          isEpisodeWatched={isEpisodeWatched}
          isSeasonWatched={isSeasonWatched}
        />
      )}
      {selectedItem && isAdmin && <SmartScheduleDialog
        open={detailScheduleOpen} onOpenChange={setDetailScheduleOpen}
        title={selectedItem.title} releaseDate={scheduleReleaseDate(selectedItem)}
        defaultMode={selectedItem.category === 'TV Shows' ? 'weekly' : 'date'}
        onAdd={(day, date, mode) => { void addToSchedule({ watchlistItemId: selectedItem.id, category: selectedItem.category, title: selectedItem.title, image_url: selectedItem.image_url, day, mode, scheduledDate: mode === 'date' ? date : undefined }); }}
      />}
    </AppShell>
  );
};

export default WatchlistNews;

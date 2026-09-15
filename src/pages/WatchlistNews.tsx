import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Library, Tv } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { Button } from '@/components/ui/button';
import { CARD_GRID } from '@/theme/layout';
import { CountdownCard } from '@/components/shared/CountdownCard';
import { UpNextRail } from '@/features/watchlist/components/UpNextRail';
import { WatchlistDetailDialog } from '@/features/watchlist/components/WatchlistDetailDialog';
import { PlatformBadge } from '@/features/watchlist/components/PlatformLogo';
import { useWatchlist } from '@/features/watchlist/useWatchlist';
import { useUpNext } from '@/features/watchlist/useUpNext';
import {
  usePinnedTitle,
  usePremiereSeasonEpisodes,
  useRecentEpisodes,
  useUpcomingEpisodes,
  useRecentMovies,
  useUpcomingMovies,
  useWatchlistEvents,
  useRecentAnnouncements,
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
  type UpdatesFeedRow,
  type UpdatesWindow,
} from '@/features/watchlist/watchlist-utils';
import { formatDate } from '@/lib/format-date';
import { cn } from '@/lib/utils';

/** Which entity a click on a card or row resolves to -- looked up in
 *  `useWatchlist()`'s list by both fields, since a TV show and a movie id
 *  can collide. */
type EntityRef = { entityType: 'tv_show' | 'movie'; entityId: number };

/** Out Now's and Upcoming's card: the library's poster card
 *  (`WatchlistCard`) in anatomy and classes -- a whole 2:3 poster, then
 *  title, one sub line, and platform left / pill right -- so it sits in the
 *  library's `.card-grid`, at the fixed size `.news-card-grid` gives it.
 *  The artwork is portrait, which is why these are not landscape cards: a
 *  landscape frame crops a poster through its title art. Without the library
 *  card's actions, which belong there. */
function NewsPosterCard({
  title,
  poster,
  sub,
  platform,
  pill,
  srLabel,
  onClick,
}: {
  title: string;
  poster: string | null;
  sub: string;
  platform: string | null;
  pill?: ReactNode;
  srLabel?: string;
  onClick: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const showFallback = !poster || broken;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${srLabel ?? title} — open details`}
      className="item-card group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-muted">
        {showFallback ? (
          <div className="missing-art flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center">
            <Tv className="h-5 w-5" />
            <span className="line-clamp-3 text-xs font-medium">{title}</span>
          </div>
        ) : (
          <img
            src={poster ?? undefined}
            alt={title}
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-contain"
          />
        )}
      </div>

      <div className="card-body p-2.5">
        <h3 className="card-title min-h-[2.5rem] font-serif text-sm font-medium leading-tight">
          <span className="line-clamp-3" style={{ textWrap: 'balance' }}>
            {title}
          </span>
        </h3>
        <p className="card-sub mt-0.5 min-h-[1rem] text-xs text-muted-foreground">{sub}</p>
        <div className="card-meta mt-1.5 flex min-h-[22px] flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <PlatformBadge platform={platform ?? undefined} size={18} />
          {pill}
        </div>
      </div>
    </button>
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
      className="grid w-full grid-cols-[44px_minmax(0,1fr)_64px] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:grid-cols-[56px_minmax(0,1fr)_104px_72px] sm:gap-x-4"
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
  { key: 'week', label: 'THIS WEEK' },
  { key: 'month', label: 'THIS MONTH' },
];

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
}: {
  rows: UpdatesFeedRow[];
  activeWindow: UpdatesWindow;
  today: Date;
  onSelect: (ref: EntityRef) => void;
}) {
  return (
    <section className="min-w-0 space-y-1">
      <DotMatrixText text="UPDATES" size="xs" />
      {rows.length === 0 ? (
        <p className="px-2 py-3 text-xs text-muted-foreground">
          {activeWindow === 'week' ? 'Nothing this week' : 'Nothing this month'}
        </p>
      ) : (
        <div className="divide-y divide-border/50">
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
}: {
  items: UpcomingRow[];
  activeWindow: UpdatesWindow;
  onSelect: (ref: EntityRef) => void;
}) {
  return (
    <section className="min-w-0 space-y-3">
      <DotMatrixText text="UPCOMING" size="xs" />
      {items.length === 0 ? (
        <p className="px-2 py-3 text-xs text-muted-foreground">
          {activeWindow === 'week' ? 'Nothing coming this week' : 'Nothing coming this month'}
        </p>
      ) : (
        <div className={cn(CARD_GRID, 'news-card-grid')}>
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
  const { watchlist, getAutoStatus, isEpisodeWatched, isSeasonWatched } = useWatchlist();
  const [selectedRef, setSelectedRef] = useState<EntityRef | null>(null);
  // Page level (REHAUL_PLAN.md 8.C-bis): drives both Upcoming (forward) and
  // Updates (backward), and Out Now (backward) too.
  const [newsWindow, setNewsWindow] = useState<UpdatesWindow>(readStoredNewsWindow);

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

  const { pinned, loading: pinnedLoading } = usePinnedTitle();
  const pinnedDays = pinned ? daysUntil(pinned.release_date, today) : null;
  const showCountdown = !!pinned && pinnedDays !== null && pinnedDays >= 0;

  const { upNext } = useUpNext();
  const watchNextIds = new Set(upNext.map((item) => item.tv_show_id));

  // Out Now and Updates both fetch their widest window (30 days) once; the
  // page-level window filters client-side (filterRecentByWindow here,
  // filterUpdatesByWindow below), so switching it never refetches. The one
  // episode fetch serves both sections.
  const { episodes: recentEpisodes, loading: recentLoading } = useRecentEpisodes(30);
  const { movies: outNowMovies, loading: outNowMovieLoading } = useRecentMovies(30);

  const outNowPremiereCandidates = premieresOf(recentEpisodes);
  const { episodesBySeason: premiereSeasonEpisodes, loading: premiereSeasonLoading } =
    usePremiereSeasonEpisodes(
      outNowPremiereCandidates.map((ep) => ({
        tv_show_id: ep.tv_show_id,
        season_number: ep.season_number,
      })),
    );
  const outNowLoading = recentLoading || outNowMovieLoading || premiereSeasonLoading;

  // A premiere drops out of Out Now when its season is already finished (the
  // user is caught up -- see isSeasonFinished) or when the same show already
  // has a Watch Next card (priority Watch Next > Out Now).
  const outNowPremieres = outNowPremiereCandidates.filter((ep) => {
    if (watchNextIds.has(ep.tv_show_id)) return false;
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
      ...outNowMovies.map((movie): OutNowRow => ({
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

  const { episodes: upcomingEpisodes, loading: upcomingTvLoading } = useUpcomingEpisodes();
  const { movies: upcomingMovies, loading: upcomingMovieLoading } = useUpcomingMovies();
  const upcomingLoading = upcomingTvLoading || upcomingMovieLoading;
  const upcomingItems: UpcomingRow[] = [
    ...premieresOf(upcomingEpisodes).map((ep): UpcomingRow => {
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
    ...upcomingMovies.map((movie): UpcomingRow => {
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
  const { events, loading: eventsLoading } = useWatchlistEvents(30);

  // A show already shown in Watch Next or Out Now does not also get a
  // released-episode row here (priority Watch Next > Out Now > Updates).
  // Platform and status rows are not deduplicated -- they are different news.
  const excludedFromUpdates = new Set([...watchNextIds, ...outNowTvIds]);
  const recentGroups = groupRecentEpisodesByShow(recentEpisodes).filter(
    (group) => !excludedFromUpdates.has(group.tv_show_id),
  );

  const { announcements, firstSeenByShow, loading: announcementsLoading } =
    useRecentAnnouncements(30);
  const announcementGroups = groupAnnouncementsByShow(announcements, firstSeenByShow, today);

  const updatesLoading = eventsLoading || recentLoading || announcementsLoading;
  const updatesFeed = filterUpdatesByWindow(
    buildUpdatesFeed(recentGroups, events, announcementGroups, today),
    newsWindow,
    today,
  );

  const toolbar = (
    <div className="flex items-center justify-between px-4 pt-2 md:px-0">
      {/* A segmented control rather than nav-link text: `nav-link-active` only
          changes weight and tints to --primary, which in light mode is nearly
          the same dark tone as unselected text, so the selected window was
          not visible. The selected option is a filled --primary pill. */}
      <nav
        aria-label="News time range"
        className="inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-card/60 p-0.5"
      >
        {NEWS_WINDOW_OPTIONS.map((option) => {
          const selected = newsWindow === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setNewsWindow(option.key)}
              aria-pressed={selected}
              className={cn(
                'rounded-full px-3 py-1 transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                selected
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground/75 hover:bg-muted hover:text-foreground',
              )}
            >
              <DotMatrixText text={option.label} size="xs" wrap={false} />
            </button>
          );
        })}
      </nav>
      <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 sm:h-9">
        <Link to="/watchlist/library">
          <Library className="h-4 w-4" />
          <DotMatrixText text="LIBRARY" size="xs" wrap={false} />
        </Link>
      </Button>
    </div>
  );

  return (
    <AppShell title="Watchlist" subtitle="What to watch now" toolbar={toolbar}>
      <div className="space-y-8 px-4 py-6 md:px-0">
        {!pinnedLoading && showCountdown && pinned && (
          <section className="min-w-0 space-y-3">
            <DotMatrixText text="COUNTDOWN" size="xs" />
            <CountdownCard
              label={pinned.title}
              date={pinned.release_date!}
              days={pinnedDays!}
              srLabel={`${pinnedDays} day${pinnedDays === 1 ? '' : 's'} until ${pinned.title}`}
              image={pinned.poster}
              imageAlt={pinned.title}
              className="w-full sm:max-w-md"
            />
          </section>
        )}

        {!outNowLoading && outNowItems.length > 0 && (
          <section className="min-w-0 space-y-3">
            <DotMatrixText text="OUT NOW" size="xs" />
            <div className={cn(CARD_GRID, 'news-card-grid')}>
              {outNowItems.map((item) => (
                <NewsPosterCard
                  key={item.key}
                  title={item.title}
                  poster={item.poster}
                  platform={item.platform}
                  sub={
                    item.kind === 'premiere' && item.seasonNumber > 1
                      ? `Season ${item.seasonNumber} · ${formatDate(item.date)}`
                      : formatDate(item.date)
                  }
                  onClick={() =>
                    openDetail({
                      entityType: item.kind === 'premiere' ? 'tv_show' : 'movie',
                      entityId: item.entityId,
                    })
                  }
                />
              ))}
            </div>
          </section>
        )}

        <UpNextRail
          items={upNext}
          onSelect={(tvShowId) => openDetail({ entityType: 'tv_show', entityId: tvShowId })}
        />

        {!upcomingLoading && (
          <UpcomingGrid
            items={upcomingWindowItems}
            activeWindow={newsWindow}
            onSelect={openDetail}
          />
        )}

        {!updatesLoading && (
          <UpdatesList rows={updatesFeed} activeWindow={newsWindow} today={today} onSelect={openDetail} />
        )}
      </div>

      {selectedItem && (
        <WatchlistDetailDialog
          open={!!selectedItem}
          onOpenChange={(open) => {
            if (!open) setSelectedRef(null);
          }}
          item={selectedItem}
          status={getAutoStatus(selectedItem)}
          isEpisodeWatched={isEpisodeWatched}
          isSeasonWatched={isSeasonWatched}
        />
      )}
    </AppShell>
  );
};

export default WatchlistNews;

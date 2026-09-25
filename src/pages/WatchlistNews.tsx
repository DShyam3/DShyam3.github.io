import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Library, Newspaper, Tv } from 'lucide-react';
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
import { useSchedule, type ScheduleItem as ScheduleEntry } from '@/features/watchlist/useSchedule';
import { useAuth } from '@/contexts/AuthContext';
import { PosterCard } from '@/features/watchlist/components/PosterCard';
import { SmartScheduleDialog, scheduleReleaseDate } from '@/features/watchlist/components/SmartScheduleDialog';
import { YourWeek } from '@/features/watchlist/components/YourWeek';

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
  srLabel,
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
      <PosterCard title={title} poster={poster}
        subtitle={<span aria-label={srLabel}>{sub}</span>}
        meta={<><PlatformBadge platform={platform ?? undefined} size={18} />{pill}</>}
        onOpen={onClick} scheduled={schedule?.scheduled}
        onSchedule={schedule ? () => { if (schedule.scheduled) schedule.onRemove(); else setScheduleOpen(true); } : undefined}
      />
      {schedule && <SmartScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} title={title} releaseDate={schedule.releaseDate} defaultMode={schedule.defaultMode} onAdd={schedule.onAdd} />}
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
        // Its own scroll only from xl, where it is a column beside Upcoming;
        // stacked, a capped list would be a scroller inside the page's.
        <div className="watchlist-updates-scroll divide-y divide-border/50 rounded-xl border border-border/50 xl:max-h-[min(36rem,65dvh)] xl:overflow-y-auto xl:overscroll-contain xl:pr-2" tabIndex={0} role="region" aria-label="Recent watchlist updates">
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
}: {
  items: UpcomingRow[];
  activeWindow: UpdatesWindow;
  onSelect: (ref: EntityRef) => void;
  scheduleFor?: (item: UpcomingRow) => React.ComponentProps<typeof NewsPosterCard>['schedule'];
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
  const scheduleFor = useCallback((entityType: EntityRef['entityType'], entityId: number, title: string, date: string): React.ComponentProps<typeof NewsPosterCard>['schedule'] => {
    if (!isAdmin) return undefined;
    const watchlistItemId = String(entityId);
    const category = entityType === 'tv_show' ? 'TV Shows' : 'Movies';
    return {
      scheduled: isInSchedule(watchlistItemId),
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
      onRemove: () => { void removeFromScheduleByWatchlistId(watchlistItemId); },
    };
  }, [addToSchedule, isAdmin, isInSchedule, removeFromScheduleByWatchlistId]);

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
    <div className="flex flex-wrap items-center justify-between gap-4">
      <nav aria-label="Watchlist" className="flex flex-wrap items-center gap-2">
        <Button asChild variant="secondary"><Link to="/watchlist" aria-current="page"><Newspaper />News</Link></Button>
        <Button asChild variant="ghost"><Link to="/watchlist/library"><Library />Library</Link></Button>
      </nav>
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

    </div>
  );

  return (
    <AppShell title="Watchlist" subtitle="What to watch now" toolbar={toolbar}>
      <div className="watchlist-news-grid grid grid-cols-1 gap-8 py-6">
        <UpNextRail
          items={upNext}
          onSelect={(tvShowId) => openDetail({ entityType: 'tv_show', entityId: tvShowId })}
          plannedDays={Object.fromEntries(schedule.filter((entry) => entry.category === 'TV Shows').map((entry) => [entry.watchlistItemId, entry.mode === 'date' && entry.scheduledDate ? new Date(`${entry.scheduledDate}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : entry.day]))}
        />

        <YourWeek
          schedule={schedule}
          loading={scheduleLoading || watchlistLoading}
          watchlist={watchlist}
          removeFromSchedule={isAdmin ? removeFromSchedule : undefined}
          updateScheduleDay={isAdmin ? updateScheduleDay : undefined}
          addToSchedule={isAdmin ? addToSchedule : undefined}
          toggleEpisodeWatched={isAdmin ? toggleEpisodeWatched : undefined}
          isEpisodeWatched={isEpisodeWatched}
          isSeasonWatched={isSeasonWatched}
          getAutoStatus={getAutoStatus}
          isInSchedule={isInSchedule}
        />

        {!outNowLoading && outNowItems.length > 0 && (
          <section className="min-w-0 space-y-3">
            <DotMatrixText text="OUT NOW" size="xs" />
            <div className={cn(CARD_GRID, 'news-card-grid', 'watchlist-news-full-width')}>
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
                  schedule={scheduleFor(item.kind === 'premiere' ? 'tv_show' : 'movie', item.entityId, item.title, item.date)}
                />
              ))}
            </div>
          </section>
        )}

        {!upcomingLoading && (
          <UpcomingGrid
          items={upcomingWindowItems}
          activeWindow={newsWindow}
          onSelect={openDetail}
          scheduleFor={(item) => scheduleFor(item.entityType, item.entityId, item.title, item.date)}
          />
        )}

        {!updatesLoading && (
          <UpdatesList rows={updatesFeed} activeWindow={newsWindow} today={today} onSelect={openDetail} />
        )}

        {!pinnedLoading && showCountdown && pinned && (
          <section className="col-span-full min-w-0 space-y-3">
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
          onRemoveFromSchedule={isAdmin ? () => { void removeFromScheduleByWatchlistId(selectedItem.id); } : undefined}
          isScheduled={isInSchedule(selectedItem.id)}
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

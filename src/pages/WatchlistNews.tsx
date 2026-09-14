import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Library, Tv } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { Button } from '@/components/ui/button';
import { CountdownCard } from '@/components/shared/CountdownCard';
import { UpNextRail } from '@/features/watchlist/components/UpNextRail';
import { WatchlistDetailDialog } from '@/features/watchlist/components/WatchlistDetailDialog';
import {
  hasPlatformLogo,
  PlatformBadge,
  PlatformLogo,
} from '@/features/watchlist/components/PlatformLogo';
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
  filterUpcomingByWindow,
  filterUpdatesByWindow,
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
import { cn } from '@/lib/utils';

/** Which entity a click on a card or row resolves to -- looked up in
 *  `useWatchlist()`'s list by both fields, since a TV show and a movie id
 *  can collide. */
type EntityRef = { entityType: 'tv_show' | 'movie'; entityId: number };

/** A row of horizontally-scrolling cards: a heading, then a keyboard-reachable
 *  scroller. `min-w-0` keeps the section from stretching its grid/flex column
 *  to fit the scroller's content -- without it the scroller grows the whole
 *  column and the page scrolls sideways (REHAUL_PLAN.md 8.C-bis).
 *
 *  `overflow-x-auto` forces the used value of `overflow-y` to `auto` too
 *  (the CSS rule for a box with one axis non-`visible`), which clips
 *  anything a card paints outside this box on hover or focus: the
 *  `-translate-y-1` lift (4px), the focus ring/outline (ring-2 +
 *  ring-offset-2, plus `.item-card:focus-visible`'s own 2px outline at a
 *  3px offset -- 5px total), and `--shadow-card-hover`'s blur (up to 30px
 *  in dark mode). `py-8` (32px) gives the scroller's own clip edge enough
 *  room above and below to paint all three without cropping; `-my-8`
 *  cancels the added height so cards sit exactly where they did and the
 *  gap to the next section is unchanged. Left/right are left alone: this
 *  same trick horizontally would bleed the scroller past its section (a
 *  block box with negative inline margins grows into that space either
 *  way `width` is computed), and `AppShell`'s `<main>` has an explicit
 *  `overflow-y-auto` that -- by the same rule -- makes its own `overflow-x`
 *  `auto` too, so that bleed would open a real, if narrow, page-level
 *  horizontal scrollbar. The trade-off: a card at either end of the rail
 *  can still lose a couple of pixels of ring or shadow sideways, the way
 *  most horizontal card rails do. */
function NewsRow<T>({
  heading,
  items,
  keyFor,
  renderItem,
}: {
  heading: string;
  items: T[];
  keyFor: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}) {
  if (items.length === 0) return null;

  return (
    <section className="min-w-0 space-y-3">
      <DotMatrixText text={heading} size="xs" />
      {/* A plain wrapper, not the scroller itself, absorbs `space-y-3`'s
          margin-top: that utility's compiled selector (two chained
          `:not([hidden])`) outweighs a plain `-my-*` on the same element, so
          a cancelling margin on the scroller itself would lose. See the
          scroller's own comment for what the padding is for. */}
      <div>
        <div
          className="flex gap-3 overflow-x-auto py-8 -my-8"
          tabIndex={0}
          role="region"
          aria-label={heading}
        >
          {items.map((item) => (
            <Fragment key={keyFor(item)}>{renderItem(item)}</Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The platform mark shown over an Out Now card: `PlatformLogo` where one
 *  exists, otherwise a plain text pill, both over a small scrim so either
 *  reads on any poster. Renders nothing when there is no platform. */
function OutNowPlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return null;
  return (
    <div className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-1">
      {hasPlatformLogo(platform) ? (
        <PlatformLogo platform={platform} size={14} />
      ) : (
        <span className="text-[10px] font-medium uppercase tracking-wide text-white">
          {platform}
        </span>
      )}
    </div>
  );
}

/** Wide, image-filling card with the title over a dark scrim -- Out Now. The
 *  caption line is always reserved, invisible when absent, so the title sits
 *  on the same baseline whether or not the card has one. */
function OutNowCard({
  title,
  poster,
  platform,
  caption,
  onClick,
}: {
  title: string;
  poster: string | null;
  platform: string | null;
  caption?: string;
  onClick: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const showFallback = !poster || broken;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title} — open details`}
      className="item-card relative aspect-[16/9] w-60 shrink-0 overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {showFallback ? (
        <div className="missing-art absolute inset-0 flex items-center justify-center p-4 text-center">
          <span className="line-clamp-3 font-serif text-lg font-medium leading-tight">
            {title}
          </span>
        </div>
      ) : (
        <img
          src={poster ?? undefined}
          alt={title}
          loading="lazy"
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <OutNowPlatformBadge platform={platform} />
      <div className="absolute inset-x-3 bottom-3 text-white">
        <p className="line-clamp-2 text-base font-medium leading-tight drop-shadow">{title}</p>
        <p className={cn('mt-0.5 text-xs text-white/70', !caption && 'invisible')}>
          {caption || ' '}
        </p>
      </div>
    </button>
  );
}

/** One row of the merged Updates list, laid out on fixed grid tracks --
 *  poster | title | line | platform | date -- so every column lines up down
 *  the list. Below `sm` it collapses to poster | title (with the line
 *  stacked beneath) | date, hiding the platform column (REHAUL_PLAN.md
 *  8.C-bis). */
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
      className="grid w-full grid-cols-[40px_minmax(0,1fr)_64px] items-center gap-x-3 gap-y-0.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:grid-cols-[40px_minmax(0,1.4fr)_minmax(0,1fr)_88px_72px]"
    >
      <div className="col-start-1 row-span-2 row-start-1 h-12 w-8 shrink-0 self-center overflow-hidden rounded bg-muted sm:row-span-1">
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

      <span className="col-start-2 row-start-1 min-w-0 truncate font-serif text-sm font-medium">
        {row.title}
      </span>

      <span className="col-start-2 row-start-2 min-w-0 truncate text-xs text-muted-foreground sm:col-start-3 sm:row-start-1">
        {row.sentence}
      </span>

      <span className="hidden min-w-0 items-center sm:col-start-4 sm:row-start-1 sm:flex">
        <PlatformBadge platform={row.platform ?? undefined} size={14} />
      </span>

      <span className="col-start-3 row-span-2 row-start-1 shrink-0 justify-self-end text-right text-xs text-muted-foreground sm:col-start-5 sm:row-span-1">
        {relativeDay(row.occurredAt, today)}
      </span>
    </button>
  );
}

/** THIS WEEK / THIS MONTH -- the one page-level window (REHAUL_PLAN.md
 *  8.C-bis) that scopes both Upcoming (forward) and Updates (backward); see
 *  `WatchlistNews`'s toolbar, the only place it is rendered. Out Now stays
 *  fixed at 7 days and does not read this. */
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item)}
              aria-label={`${item.title} — open details`}
              className="rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <CountdownCard
                label={item.title}
                date={item.date}
                days={item.days}
                srLabel={`${item.title} -- ${item.sentence}`}
                image={item.poster}
                imageAlt={item.title}
                size="compact"
                className="w-full"
              />
            </button>
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
  // Updates (backward). Out Now stays fixed at 7 days and does not read this.
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

  // Out Now is this week only (REHAUL_PLAN.md 8.C-bis) -- it was 14 days for
  // episodes and 30 for movies.
  const { episodes: outNowEpisodes, loading: outNowTvLoading } = useRecentEpisodes(7);
  const { movies: outNowMovies, loading: outNowMovieLoading } = useRecentMovies(7);

  const outNowPremiereCandidates = premieresOf(outNowEpisodes);
  const { episodesBySeason: premiereSeasonEpisodes, loading: premiereSeasonLoading } =
    usePremiereSeasonEpisodes(
      outNowPremiereCandidates.map((ep) => ({
        tv_show_id: ep.tv_show_id,
        season_number: ep.season_number,
      })),
    );
  const outNowLoading = outNowTvLoading || outNowMovieLoading || premiereSeasonLoading;

  // A premiere drops out of Out Now when its season is already finished (the
  // user is caught up -- see isSeasonFinished) or when the same show already
  // has a Watch Next card (priority Watch Next > Out Now).
  const outNowPremieres = outNowPremiereCandidates.filter((ep) => {
    if (watchNextIds.has(ep.tv_show_id)) return false;
    const seasonEpisodes = premiereSeasonEpisodes.get(`${ep.tv_show_id}:${ep.season_number}`);
    if (seasonEpisodes && isSeasonFinished(seasonEpisodes, today)) return false;
    return true;
  });
  const outNowTvIds = new Set(outNowPremieres.map((ep) => ep.tv_show_id));

  const outNowItems: OutNowRow[] = [
    ...outNowPremieres.map(
      (ep): OutNowRow => ({
        key: `tv-${ep.tv_show_id}-${ep.season_number}`,
        kind: 'premiere',
        title: ep.title,
        poster: ep.poster,
        platform: ep.platform,
        date: ep.release_date,
        seasonNumber: ep.season_number,
        entityId: ep.tv_show_id,
      }),
    ),
    ...outNowMovies.map(
      (movie): OutNowRow => ({
        key: `movie-${movie.id}`,
        kind: 'movie',
        title: movie.title,
        poster: movie.poster,
        platform: movie.platform,
        date: movie.release_date,
        entityId: movie.id,
      }),
    ),
  ].sort((a, b) => b.date.localeCompare(a.date));

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

  const { episodes: recentEpisodes, loading: recentLoading } = useRecentEpisodes(30);
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
      <nav aria-label="News time range" className="flex items-center gap-x-3">
        {NEWS_WINDOW_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setNewsWindow(option.key)}
            aria-pressed={newsWindow === option.key}
            className={cn('nav-link py-1', newsWindow === option.key && 'nav-link-active')}
          >
            <DotMatrixText text={option.label} size="xs" wrap={false} />
          </button>
        ))}
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

        {!outNowLoading && (
          <NewsRow
            heading="OUT NOW"
            items={outNowItems}
            keyFor={(item) => item.key}
            renderItem={(item) => (
              <OutNowCard
                title={item.title}
                poster={item.poster}
                platform={item.platform}
                caption={
                  item.kind === 'premiere' && item.seasonNumber > 1
                    ? `Season ${item.seasonNumber}`
                    : undefined
                }
                onClick={() =>
                  openDetail({
                    entityType: item.kind === 'premiere' ? 'tv_show' : 'movie',
                    entityId: item.entityId,
                  })
                }
              />
            )}
          />
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

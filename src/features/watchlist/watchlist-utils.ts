import type { WatchlistItem } from './WatchlistContext';

export const formatRuntime = (minutes?: number) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
};

export const isUpcomingStatus = (status?: string) =>
    !!status &&
    (status.toLowerCase().includes('releases in') || status === 'Coming Soon');

/**
 * Status pills carry their meaning through weight, not hue. The page already
 * has one accent colour and a wall of poster art; giving every status its own
 * Tailwind hue -- orange watching, green watched, amber upcoming, purple
 * coming soon -- turned the grid into a colour chart. Four tiers instead:
 *
 *   solid    a title being watched now, the one state worth spotting
 *   muted    everything settled -- to watch, watched, released
 *   dated    a countdown to a real date: outlined, but read at full strength
 *   outline  nothing to watch yet, so nothing filled in
 *
 * `dated` exists because the countdown pill is the one status that carries a
 * number rather than a label, and it has to survive outside the Upcoming tab.
 * There every card holds one, so the outline alone was enough to read it; on
 * TV Shows it sits alone in a row of filled "To Watch" pills, where the
 * faintest tier on the page was also the only one asking to be read. It keeps
 * the outline -- that silhouette is what tells it apart from a label pill --
 * and takes the foreground for its text, so the shape says "this is a date"
 * and the contrast makes the date legible. No new colour: same border, same
 * ink as the title above it.
 */
const STATUS_ACTIVE = 'bg-foreground/10 text-foreground';
const STATUS_SETTLED = 'bg-secondary text-muted-foreground';
const STATUS_DATED =
    'bg-transparent text-foreground ring-1 ring-inset ring-border';
const STATUS_PENDING =
    'bg-transparent text-muted-foreground ring-1 ring-inset ring-border';

export const getStatusColor = (status: string) => {
    if (status === 'Watching') return STATUS_ACTIVE;
    if (status === 'Coming Soon') return STATUS_PENDING;
    if (status.toLowerCase().includes('releases in')) return STATUS_DATED;
    return STATUS_SETTLED;
};

/**
 * Titles come out of TMDB with a disambiguating year on some entries
 * ("Hell's Paradise (2023)"). Every surface already prints the year on its own
 * line, so strip it when it is the same year rather than showing it twice.
 */
export const displayTitle = (title: string, year?: number | null) => {
    if (!year) return title;
    return title.replace(new RegExp(`\\s*\\(${year}\\)\\s*$`), '');
};

/**
 * "S1 releases in 46 days" -> "S1 in 46d", so an upcoming title's badge is the
 * same single-line pill as every other status instead of a two-line block.
 *
 * A film has no season to name, so its status is a bare "releases in 33 days",
 * which compacted to "in 33d" -- a preposition and a number, with nothing
 * saying what arrives. Inside the Upcoming tab the tab title answered that;
 * on Movies it did not. "Out in 33d" costs three characters and carries its
 * own subject, so the pill reads the same wherever it is shown.
 */
export const compactUpcomingStatus = (status: string) =>
    status
        .replace(/^releases in\s*/i, 'Out in ')
        .replace(/\s*releases in\s*/i, ' in ')
        .replace(/\s*days?$/i, 'd')
        .replace(/^Coming Soon$/i, 'Coming Soon')
        .trim();

/**
 * Whole calendar days between `today` and a `date`-typed column (`YYYY-MM-DD`),
 * positive when `dateStr` is in the future, negative when it has passed, zero
 * when it is today. Both sides are truncated to midnight before subtracting,
 * so two timestamps on the same calendar day always come out as zero
 * regardless of the time of day `today` carries. Returns null for a null or
 * unparseable date, never `NaN`.
 */
export const daysUntil = (
    dateStr: string | null | undefined,
    today: Date,
): number | null => {
    if (!dateStr) return null;
    const target = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(target.getTime())) return null;
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffMs = target.getTime() - start.getTime();
    return Math.round(diffMs / 86_400_000);
};

/** A show belongs on the Up Next rail for one of two reasons -- see below. */
export type UpNextReason = 'Continue' | 'New';

/** The columns `upNextReason` needs, a subset of `UpNextItem`. */
export interface UpNextRailCandidate {
    state: 'ready' | 'upcoming' | 'unscheduled';
    release_date?: string | null;
    season_in_progress: boolean;
}

/** A drop counts as "just dropped" for this many days after it airs. */
const JUST_DROPPED_WINDOW_DAYS = 14;

/**
 * The Up Next rail's inclusion rule (REHAUL_PLAN.md 8.C): every started show
 * used to qualify, which made the rail a thirteen-card library rather than a
 * next action. A row belongs on it for one of two reasons instead:
 *
 *   Continue -- `season_in_progress`: an episode of THIS season is already
 *   watched, so the next one is a continuation no matter how old it is.
 *   New -- the episode has aired (`state === 'ready'`) within the last
 *   14 days, whether or not the show has ever been started.
 *
 * `today` is a parameter rather than `new Date()` so the boundary is
 * testable without mocking the clock. Returns null when neither reason
 * applies, so the row is left off the rail.
 */
export const upNextReason = (
    item: UpNextRailCandidate,
    today: Date,
): UpNextReason | null => {
    if (item.season_in_progress) return 'Continue';

    if (item.state === 'ready') {
        const age = daysUntil(item.release_date, today);
        // daysUntil is negative once the date has passed; `ready` never sits
        // in the future, but the range guards it anyway rather than assuming.
        if (age !== null && age <= 0 && age >= -JUST_DROPPED_WINDOW_DAYS) {
            return 'New';
        }
    }

    return null;
};

/**
 * Filters and orders the rail: continuing shows first, then just-dropped
 * ones by air date descending (newest first). Rows matching neither reason
 * are dropped entirely -- there is no in-between state to render.
 */
export const selectUpNextRail = <T extends UpNextRailCandidate>(
    items: T[],
    today: Date,
): (T & { reason: UpNextReason })[] =>
    items
        .reduce<(T & { reason: UpNextReason })[]>((acc, item) => {
            const reason = upNextReason(item, today);
            if (reason) acc.push({ ...item, reason });
            return acc;
        }, [])
        .sort((a, b) => {
            if (a.reason !== b.reason) return a.reason === 'Continue' ? -1 : 1;
            if (a.reason === 'Continue') return 0;
            return (b.release_date ?? '').localeCompare(a.release_date ?? '');
        });

/**
 * Total minutes watched: `sum(runtime) where watched`, over every episode of
 * every show. An episode with no stored runtime -- TMDB does not always have
 * one -- contributes zero rather than making the total `NaN`.
 */
export const totalWatchedRuntime = (
    watchlist: Pick<WatchlistItem, 'seasons'>[],
): number =>
    watchlist.reduce((total, item) => {
        if (!item.seasons) return total;
        return (
            total +
            item.seasons.reduce(
                (seasonTotal, season) =>
                    seasonTotal +
                    season.episodes.reduce(
                        (episodeTotal, episode) =>
                            episodeTotal + (episode.watched ? episode.runtime || 0 : 0),
                        0,
                    ),
                0,
            )
        );
    }, 0);

// ─── The News page (REHAUL_PLAN.md 8.C-bis) ────────────────────────────────
//
// Grouping, premiere detection, sentence building and day-count formatting
// for the News page. All pure and dependent only on their arguments -- see
// `selectUpNextRail` above for why "now" is always a parameter, never
// `new Date()` read inside the function.

/**
 * TMDB files specials, extras and behind-the-scenes under season 0. Neither
 * a "premiere" nor an "announcement" in the sense this page means it, so
 * every season-0 check on this page goes through here rather than repeating
 * the magic number.
 */
export const isSpecialsSeason = (seasonNumber: number): boolean =>
    seasonNumber === 0;

/** Episode 1 of any real season is the premiere; season 0 (specials) never counts. */
export const isPremiereEpisode = (
    episodeNumber: number,
    seasonNumber: number,
): boolean => episodeNumber === 1 && !isSpecialsSeason(seasonNumber);

/** The columns `isSeasonFinished` needs, a subset of a `tv_show_episodes` row. */
export interface SeasonEpisodeCandidate {
    release_date: string;
    watched: boolean;
}

/**
 * A TV season is finished when every episode that has already aired
 * (`release_date <= today`) is watched, and at least one has aired -- an
 * unaired episode never counts against it, so a weekly season with one
 * episode still to come still reads as finished until that episode drops.
 * A season with nothing aired yet is never finished; there is nothing to
 * have finished.
 *
 * TV only: films have no equivalent state, because the `movies` table has no
 * `watched`/`status` column, so there is nothing to check and no heuristic
 * is invented to approximate one here.
 */
export const isSeasonFinished = (
    episodes: SeasonEpisodeCandidate[],
    today: Date,
): boolean => {
    const aired = episodes.filter((ep) => {
        const age = daysUntil(ep.release_date, today);
        return age !== null && age <= 0;
    });
    if (aired.length === 0) return false;
    return aired.every((ep) => ep.watched);
};

const SHORT_MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const LONG_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

/** "12 Sep", for a folded multi-episode sentence. Deliberately not `toLocaleDateString`
 *  -- `en-GB` renders September as "Sept" (four letters), not the three the card needs. */
const formatShortDate = (dateStr: string): string => {
    const date = new Date(`${dateStr}T00:00:00`);
    return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;
};

/** "6 April" -- a year-free absolute date, for a release too far out to count down to. */
const formatLongDateNoYear = (dateStr: string): string => {
    const date = new Date(`${dateStr}T00:00:00`);
    return `${date.getDate()} ${LONG_MONTHS[date.getMonth()]}`;
};

/**
 * A future season premiere's sentence. `days` is `daysUntil` applied to the
 * premiere's `release_date` -- passed in rather than computed here so this
 * stays a string-formatting function with no clock of its own.
 */
export const seasonPremiereSentence = (
    seasonNumber: number,
    days: number,
): string => {
    if (days === 0) return `Season ${seasonNumber} starts today`;
    if (days === 1) return `Season ${seasonNumber} starts tomorrow`;
    return `Season ${seasonNumber} starts in ${days} days`;
};

/** Beyond this many days out, a relative count ("in 43 days") reads worse than the date. */
const RELATIVE_COUNTDOWN_LIMIT_DAYS = 30;

/** A future movie release's sentence, `days` and `dateStr` both the same date. */
export const movieReleaseSentence = (days: number, dateStr: string): string => {
    if (days === 0) return 'Releases today';
    if (days === 1) return 'Releases tomorrow';
    if (days <= RELATIVE_COUNTDOWN_LIMIT_DAYS) return `Releases in ${days} days`;
    return `Releases ${formatLongDateNoYear(dateStr)}`;
};

/**
 * `watchlist_events.payload` for a `platform_change` row -- either side may be
 * null (a platform just gained or lost, not swapped). Both null cannot happen
 * from the trigger that writes this table (it only fires when the two sides
 * differ), but returns null here too rather than guessing at a sentence.
 * Kept to an arrow rather than a full sentence ("Moved from Netflix to
 * Disney+") because the card that renders this truncates a two-clause
 * sentence long before it truncates two names either side of a glyph.
 */
export const platformChangeSentence = (
    from: string | null,
    to: string | null,
): string | null => {
    if (from && to) return `${from} → ${to}`;
    if (!from && to) return `Now on ${to}`;
    if (from && !to) return `Left ${from}`;
    return null;
};

/** The sync's own vocabulary for a status, mapped to the shorter word this
 *  page shows. A status not in this table is shown exactly as written --
 *  never invented -- so an unfamiliar status still reads as *something*. */
const STATUS_LABELS: Record<string, string> = {
    Ended: 'Ended',
    Canceled: 'Cancelled',
    Cancelled: 'Cancelled',
    'In Production': 'In production',
    'Returning Series': 'Returning',
};

const statusLabel = (status: string | null): string => {
    if (!status) return 'Unknown';
    return STATUS_LABELS[status] ?? status;
};

/**
 * `watchlist_events.payload` for a `status_change` row. When the destination
 * maps to a known label, that label alone is the sentence -- "Ended", not
 * "In production → Ended" -- because the destination is the news; where it
 * came from rarely is. Only when the destination is unmapped is there
 * nothing to say on its own, so it falls back to the arrow form between the
 * two mapped (or raw) labels, same shape as `platformChangeSentence`.
 */
export const statusChangeSentence = (
    from: string | null,
    to: string | null,
): string => {
    if (to !== null && to in STATUS_LABELS) return STATUS_LABELS[to];
    return `${statusLabel(from)} → ${statusLabel(to)}`;
};

/** The columns `groupRecentEpisodesByShow` needs, a subset of `WatchlistNewsEpisode`. */
export interface RecentEpisodeCandidate {
    tv_show_id: number;
    title: string;
    poster: string | null;
    platform: string;
    season_number: number;
    episode_number: number;
    episode_title: string | null;
    release_date: string;
    watched: boolean;
}

export interface RecentEpisodeGroup {
    tv_show_id: number;
    title: string;
    poster: string | null;
    platform: string;
    sentence: string;
    latest_release_date: string;
}

/** TMDB's placeholder title for an episode it has no real name for --
 *  "Episode 6" says nothing `S1E6` doesn't already, so it is treated the same
 *  as a missing title in `releasedEpisodeSentence`. */
const GENERIC_EPISODE_TITLE = /^Episode \d+$/i;

/**
 * The line for one released episode in an Updates row: `S1E6 · Episode
 * title`, or just `S1E6` when the title is missing or generic. The date is
 * deliberately not part of this sentence -- the row's own date column
 * already shows it (REHAUL_PLAN.md 8.C-bis).
 */
export const releasedEpisodeSentence = (
    ep: Pick<RecentEpisodeCandidate, 'season_number' | 'episode_number' | 'episode_title'>,
): string => {
    const label = `S${ep.season_number}E${ep.episode_number}`;
    if (ep.episode_title && !GENERIC_EPISODE_TITLE.test(ep.episode_title)) {
        return `${label} · ${ep.episode_title}`;
    }
    return label;
};

/**
 * Groups recently-released episodes by show (REHAUL_PLAN.md 8.C-bis): the
 * unit of the Released Recently section is the show, never the episode, so a
 * show with three new episodes is one card, not three near-identical rows.
 * The card names only the latest episode -- no count -- and groups are
 * sorted by that episode's date, newest first.
 *
 * A show whose latest released episode is already watched is dropped
 * outright: the user is caught up, so there is nothing to tell them. TV
 * only -- a film has no per-episode watched state to be caught up on.
 */
export const groupRecentEpisodesByShow = (
    episodes: RecentEpisodeCandidate[],
): RecentEpisodeGroup[] => {
    const byShow = new Map<number, RecentEpisodeCandidate[]>();
    for (const ep of episodes) {
        const list = byShow.get(ep.tv_show_id);
        if (list) list.push(ep);
        else byShow.set(ep.tv_show_id, [ep]);
    }

    return Array.from(byShow.values())
        .map(
            (group) =>
                [...group].sort((a, b) => b.release_date.localeCompare(a.release_date))[0],
        )
        .filter((latest) => !latest.watched)
        .map((latest) => ({
            tv_show_id: latest.tv_show_id,
            title: latest.title,
            poster: latest.poster,
            platform: latest.platform,
            sentence: releasedEpisodeSentence(latest),
            latest_release_date: latest.release_date,
        }))
        .sort((a, b) => b.latest_release_date.localeCompare(a.latest_release_date));
};

/** The columns `groupAnnouncementsByShow` needs, a superset of the rows
 *  `useWatchlistNews.ts` fetches for the Announcements section. */
export interface AnnouncementCandidate {
    kind: 'season' | 'episode';
    tv_show_id: number;
    title: string;
    poster: string | null;
    platform: string | null;
    season_number: number;
    episode_number?: number;
    episode_title?: string | null;
    /** Episodes only -- what tells `announcementSentence` whether the
     *  episode is still ahead of `today` or has already aired. */
    release_date?: string | null;
    created_at: string;
}

export interface AnnouncementGroup {
    tv_show_id: number;
    title: string;
    poster: string | null;
    platform: string | null;
    sentence: string;
    latest_created_at: string;
}

/** The columns `computeFirstSeenAt` needs, a subset of a `tv_show_seasons` row. */
export interface SeasonFirstSeenCandidate {
    tv_show_id: number;
    created_at: string | null;
}

/**
 * A show's first-seen time: the earliest `created_at` across every season it
 * has, or `null` when any of them predates tracking (a season row inserted
 * before migration 20260912090000 added the column carries a null
 * `created_at` -- see the COMMENT ON COLUMN in
 * `supabase/schemas/20_watchlist.sql`). `null` here is a deliberate
 * negative infinity, not a missing value: every non-null row on that show
 * is free to count as an announcement, because there is no reliable
 * first-seen time to measure it against. Takes every season for a show,
 * including the null ones, which is why this reads from the full season
 * list rather than folding into the announcement candidates themselves.
 */
export const computeFirstSeenAt = (
    seasons: SeasonFirstSeenCandidate[],
): Map<number, string | null> => {
    const earliest = new Map<number, string>();
    const predatesTracking = new Set<number>();

    for (const season of seasons) {
        if (season.created_at === null) {
            predatesTracking.add(season.tv_show_id);
            continue;
        }
        const current = earliest.get(season.tv_show_id);
        if (current === undefined || season.created_at < current) {
            earliest.set(season.tv_show_id, season.created_at);
        }
    }

    const result = new Map<number, string | null>(earliest);
    for (const showId of predatesTracking) {
        result.set(showId, null);
    }
    return result;
};

/** Absorbs the few seconds a single "add show" or sync batch takes -- see
 *  `isAnnouncement` -- and is reused as the width of an announcement batch
 *  below, so "one per show" picks the same window either way. */
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * A season or episode row counts as an announcement only if it landed
 * strictly more than an hour after the show it belongs to was first
 * tracked. Adding a show inserts its whole back catalogue with fresh
 * `created_at` values in the same minute or two; without the margin, every
 * one of those rows reads as news the moment the show is added.
 * `showFirstSeenAt` of `null` means the show predates tracking entirely (see
 * `computeFirstSeenAt`) -- treated as negative infinity, so every non-null
 * row on that show counts. A row exactly one hour after first-seen is NOT
 * an announcement: the margin is closed on the near side, open on the far
 * side, so the boundary itself still reads as the same batch.
 */
export const isAnnouncement = (
    rowCreatedAt: string,
    showFirstSeenAt: string | null,
): boolean => {
    if (showFirstSeenAt === null) return true;
    const elapsed = new Date(rowCreatedAt).getTime() - new Date(showFirstSeenAt).getTime();
    return elapsed > ONE_HOUR_MS;
};

/** Rows within one hour of the group's newest `created_at` -- the batch this
 *  show's single announcement card is built from. */
const isSameBatch = (createdAt: string, newestCreatedAt: string): boolean =>
    new Date(newestCreatedAt).getTime() - new Date(createdAt).getTime() <= ONE_HOUR_MS;

/**
 * One show's announcement sentence, built from its latest batch. A season
 * in the batch wins outright and names the highest season number in it
 * (season 0 never reaches here -- excluded upstream in
 * `groupAnnouncementsByShow`); otherwise the latest episode names itself,
 * with a future `release_date` read as a schedule rather than a drop.
 */
const announcementSentence = (batch: AnnouncementCandidate[], today: Date): string => {
    const seasons = batch.filter((item) => item.kind === 'season');
    if (seasons.length > 0) {
        const highest = Math.max(...seasons.map((item) => item.season_number));
        return `Season ${highest} announced`;
    }

    const episodes = [...batch]
        .filter((item) => item.kind === 'episode')
        .sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''));
    const latest = episodes[0];
    const label = `S${latest.season_number}E${latest.episode_number}`;
    const days = latest.release_date ? daysUntil(latest.release_date, today) : null;
    if (days !== null && days > 0) {
        return `${label} scheduled for ${formatShortDate(latest.release_date as string)}`;
    }
    return `${label} added`;
};

/**
 * Groups announced seasons/episodes by show (REHAUL_PLAN.md 8.C-bis): one
 * card per show, not one per row, built from the show's latest announcement
 * batch rather than a count -- see `isAnnouncement` and `announcementSentence`.
 * Season 0 (specials) is excluded here rather than upstream, so a show whose
 * only announcements are specials produces no group at all. Sorted by each
 * show's newest announcement, newest first.
 */
export const groupAnnouncementsByShow = (
    items: AnnouncementCandidate[],
    firstSeenByShow: Map<number, string | null>,
    today: Date,
): AnnouncementGroup[] => {
    const byShow = new Map<number, AnnouncementCandidate[]>();
    for (const item of items) {
        if (isSpecialsSeason(item.season_number)) continue;
        const firstSeen = firstSeenByShow.get(item.tv_show_id) ?? null;
        if (!isAnnouncement(item.created_at, firstSeen)) continue;
        const list = byShow.get(item.tv_show_id);
        if (list) list.push(item);
        else byShow.set(item.tv_show_id, [item]);
    }

    return Array.from(byShow.values())
        .map((group) => {
            const newestCreatedAt = group.reduce(
                (max, item) => (item.created_at > max ? item.created_at : max),
                group[0].created_at,
            );
            const batch = group.filter((item) => isSameBatch(item.created_at, newestCreatedAt));
            return {
                tv_show_id: group[0].tv_show_id,
                title: group[0].title,
                poster: group[0].poster,
                platform: group[0].platform,
                sentence: announcementSentence(batch, today),
                latest_created_at: newestCreatedAt,
            };
        })
        .sort((a, b) => b.latest_created_at.localeCompare(a.latest_created_at));
};

/** "today" / "yesterday" / "2d" ... "6d", then a short absolute date. A date
 *  seven or more days back, or any date in the future, reads worse as a
 *  count than as a date -- see `movieReleaseSentence`'s same trade-off. Takes
 *  either a `YYYY-MM-DD` column or a full timestamp: only the calendar-day
 *  prefix is read, so a `watchlist_events.occurred_at` and a plain
 *  `release_date` compare on the same terms. */
export const relativeDay = (dateStr: string, today: Date): string => {
    const dayOnly = dateStr.slice(0, 10);
    const days = daysUntil(dayOnly, today);
    if (days === 0) return 'today';
    if (days === -1) return 'yesterday';
    if (days !== null && days <= -2 && days >= -6) return `${-days}d`;
    return formatShortDate(dayOnly);
};

/** One row of the News page's merged Updates list -- see `buildUpdatesFeed`. */
export interface UpdatesFeedRow {
    key: string;
    kind: 'released' | 'platform' | 'status' | 'announced';
    entityType: 'tv_show' | 'movie';
    entityId: number;
    title: string;
    poster: string | null;
    platform: string | null;
    sentence: string;
    occurredAt: string;
}

/** The columns `buildUpdatesFeed`'s platform/status argument needs, a subset
 *  of `WatchlistEvent` in useWatchlistNews.ts. */
export interface UpdateEventCandidate {
    entity_type: 'tv_show' | 'movie';
    entity_id: number;
    kind: 'platform_change' | 'status_change';
    occurred_at: string;
    payload: { from: string | null; to: string | null };
    title: string;
    poster: string | null;
    platform: string | null;
}

/** Newest-first tie-break when two rows share an `occurredAt` day: by kind
 *  in this fixed order, then by title -- both arbitrary but deterministic,
 *  so the same inputs always render in the same order. */
const UPDATE_KIND_ORDER: Record<UpdatesFeedRow['kind'], number> = {
    released: 0,
    platform: 1,
    status: 2,
    announced: 3,
};

/** For sorting only: a bare `YYYY-MM-DD` (a released group's date column)
 *  sorts as its UTC midnight instant, so it compares correctly against a
 *  full timestamp (an event's or announcement's) on the same calendar day
 *  instead of always reading as older purely for being ten characters
 *  shorter. */
const sortableInstant = (occurredAt: string): string =>
    occurredAt.length === 10 ? `${occurredAt}T00:00:00Z` : occurredAt;

/**
 * Merges the News page's three update sources -- recently released
 * episodes, platform/status changes and announcements -- into one feed,
 * newest first (REHAUL_PLAN.md 8.C-bis). Consumes each source's own grouped
 * shape rather than re-deriving anything: `released` is
 * `groupRecentEpisodesByShow`'s output and `announcements` is
 * `groupAnnouncementsByShow`'s; only the platform/status events are raw,
 * because a single row can be either kind depending on `event.kind`.
 *
 * A show can appear once per kind -- once as released and once as announced
 * is fine, two rows -- so `key` folds in both `kind` and `entityType`: a TV
 * show and a movie can share a numeric id, and `entityType` alone does not
 * distinguish a released row from an announced one for the same title.
 *
 * `today` is accepted rather than read internally for the same reason as
 * `selectUpNextRail`'s -- every date-aware function on this page takes the
 * clock as an argument so it stays testable -- even though this particular
 * merge does no date maths of its own; each source already stamped its own
 * `occurredAt`.
 */
export const buildUpdatesFeed = (
    released: RecentEpisodeGroup[],
    events: UpdateEventCandidate[],
    announcements: AnnouncementGroup[],
    today: Date,
): UpdatesFeedRow[] => {
    const rows: UpdatesFeedRow[] = released.map((group) => ({
        key: `released-tv_show-${group.tv_show_id}`,
        kind: 'released',
        entityType: 'tv_show',
        entityId: group.tv_show_id,
        title: group.title,
        poster: group.poster,
        platform: group.platform,
        sentence: group.sentence,
        occurredAt: group.latest_release_date,
    }));

    for (const event of events) {
        const sentence =
            event.kind === 'platform_change'
                ? platformChangeSentence(event.payload.from, event.payload.to)
                : statusChangeSentence(event.payload.from, event.payload.to);
        if (!sentence) continue;
        const kind: 'platform' | 'status' =
            event.kind === 'platform_change' ? 'platform' : 'status';
        rows.push({
            key: `${kind}-${event.entity_type}-${event.entity_id}`,
            kind,
            entityType: event.entity_type,
            entityId: event.entity_id,
            title: event.title,
            poster: event.poster,
            platform: event.platform,
            sentence,
            occurredAt: event.occurred_at,
        });
    }

    for (const group of announcements) {
        rows.push({
            key: `announced-tv_show-${group.tv_show_id}`,
            kind: 'announced',
            entityType: 'tv_show',
            entityId: group.tv_show_id,
            title: group.title,
            poster: group.poster,
            platform: group.platform,
            sentence: group.sentence,
            occurredAt: group.latest_created_at,
        });
    }

    return rows.sort((a, b) => {
        const byDate = sortableInstant(b.occurredAt).localeCompare(sortableInstant(a.occurredAt));
        if (byDate !== 0) return byDate;
        const byKind = UPDATE_KIND_ORDER[a.kind] - UPDATE_KIND_ORDER[b.kind];
        if (byKind !== 0) return byKind;
        return a.title.localeCompare(b.title);
    });
};

/** The Updates section's time-range control: "This week" or "Past month". */
export type UpdatesWindow = 'week' | 'month';

const UPDATES_WINDOW_DAYS: Record<UpdatesWindow, number> = {
    week: 7,
    month: 30,
};

/**
 * Keeps only the feed rows within the selected window, applied client-side to
 * a feed already fetched once over the widest window (30 days) so switching
 * "This week"/"This month" never refetches (REHAUL_PLAN.md 8.C-bis).
 * `occurredAt` may be a bare `YYYY-MM-DD` (a released episode's date) or a
 * full timestamp (an event's or an announcement's) -- only the calendar-day
 * prefix is compared, same as `relativeDay`.
 */
export const filterUpdatesByWindow = (
    rows: UpdatesFeedRow[],
    window: UpdatesWindow,
    today: Date,
): UpdatesFeedRow[] => {
    const windowDays = UPDATES_WINDOW_DAYS[window];
    return rows.filter((row) => {
        const age = daysUntil(row.occurredAt.slice(0, 10), today);
        return age !== null && age <= 0 && age >= -windowDays;
    });
};

/** The column `filterUpcomingByWindow` needs, a subset of `UpcomingRow` in
 *  WatchlistNews.tsx. */
export interface UpcomingWindowCandidate {
    date: string | null;
}

/**
 * Keeps only the Upcoming rows releasing within the selected window, the
 * forward mirror of `filterUpdatesByWindow`'s backward one: the same
 * `UpdatesWindow` (7 or 30 days) and the same closed-at-today, inclusive
 * boundary, just counting ahead instead of back -- a release exactly on the
 * boundary day counts, one day beyond it does not. A null or unparseable
 * date is dropped, same as a past one, since `daysUntil` returns null for
 * both.
 */
export const filterUpcomingByWindow = <T extends UpcomingWindowCandidate>(
    rows: T[],
    window: UpdatesWindow,
    today: Date,
): T[] => {
    const windowDays = UPDATES_WINDOW_DAYS[window];
    return rows.filter((row) => {
        const age = daysUntil(row.date, today);
        return age !== null && age >= 0 && age <= windowDays;
    });
};

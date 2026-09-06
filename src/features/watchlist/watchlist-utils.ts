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

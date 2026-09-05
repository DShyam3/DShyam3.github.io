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
 * coming soon -- turned the grid into a colour chart. Three tiers instead:
 *
 *   solid    a title being watched now, the one state worth spotting
 *   muted    everything settled -- to watch, watched, released
 *   outline  nothing to watch yet, so nothing filled in
 */
const STATUS_ACTIVE = 'bg-foreground/10 text-foreground';
const STATUS_SETTLED = 'bg-secondary text-muted-foreground';
const STATUS_PENDING =
    'bg-transparent text-muted-foreground ring-1 ring-inset ring-border';

export const getStatusColor = (status: string) => {
    if (status === 'Watching') return STATUS_ACTIVE;
    if (status === 'Coming Soon') return STATUS_PENDING;
    if (status.toLowerCase().includes('releases in')) return STATUS_PENDING;
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
 */
export const compactUpcomingStatus = (status: string) =>
    status
        .replace(/\s*releases in\s*/i, ' in ')
        .replace(/\s*days?$/i, 'd')
        .replace(/^Coming Soon$/i, 'Coming Soon')
        .trim();

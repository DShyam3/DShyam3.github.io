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

export const getStatusColor = (status: string) => {
    if (status === 'Watching') return 'bg-orange-500/10 text-orange-600 dark:text-orange-400';
    if (status === 'To Watch') return 'bg-primary/10 text-primary';
    if (status === 'Completed' || status === 'Watched') return 'bg-green-500/10 text-green-600 dark:text-green-400';
    if (status === 'Coming Soon') return 'bg-purple-500/10 text-purple-600 dark:text-purple-400';
    if (status.toLowerCase().includes('releases in')) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    if (status === 'Released') return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
    return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
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

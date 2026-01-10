export const formatRuntime = (minutes?: number) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
};

export const getPlatformColor = (platform?: string) => {
    if (!platform) return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';

    switch (platform) {
        case 'Netflix':
            return 'bg-red-500/10 text-red-600 dark:text-red-400';
        case 'Prime Video':
            return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
        case 'Disney+':
            return 'bg-blue-600/10 text-blue-700 dark:text-blue-300';
        case 'Apple TV+':
            return 'bg-slate-500/10 text-slate-700 dark:text-slate-300';
        case 'BBC iPlayer':
            return 'bg-pink-500/10 text-pink-600 dark:text-pink-400';
        case 'Online':
            return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
        default:
            return 'bg-orange-500/10 text-orange-600 dark:text-orange-400';
    }
};

import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { PlatformLogo, hasPlatformLogo, platformLabel } from '@/features/watchlist/components/PlatformLogo';
import { LIBRARY_CATEGORIES, type LibraryCategory } from '@/features/watchlist/library-categories';
import type { LibraryType } from '@/features/watchlist/library-state';
import { ALL_GENRES, ALL_PLATFORMS } from '@/features/watchlist/watchlist-shelves';

interface LibraryFiltersPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraryType: LibraryType;
  selectedPlatform: string | null;
  onPlatformChange: (value: string | null) => void;
  selectedAutoCategory: LibraryCategory | null;
  onAutoCategoryChange: (value: LibraryCategory | null) => void;
  selectedGenre: string | null;
  onGenreChange: (value: string | null) => void;
  selectedStatus: string | null;
  onStatusChange: (value: string | null) => void;
  platformCounts: Record<string, number>;
  autoCategoryCounts: Record<LibraryCategory, number>;
  genreCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  onReset: () => void;
  ariaLabel?: string;
  heading?: string;
}

export function LibraryFiltersPopover({
  open,
  onOpenChange,
  libraryType,
  selectedPlatform,
  onPlatformChange,
  selectedAutoCategory,
  onAutoCategoryChange,
  selectedGenre,
  onGenreChange,
  selectedStatus,
  onStatusChange,
  platformCounts,
  autoCategoryCounts,
  genreCounts,
  statusCounts,
  onReset,
  ariaLabel = 'Library filters',
  heading = 'Filter library',
}: LibraryFiltersPopoverProps) {
  const activeFilterCount = [
    selectedPlatform,
    selectedGenre,
    selectedAutoCategory,
    selectedStatus,
  ].filter(Boolean).length;

  const getPlatformCount = (platform: string) => platformCounts[platform] || 0;
  const getGenreCount = (genre: string) => genreCounts[genre] || 0;
  const getStatusCount = (status: string) => statusCounts[status] || 0;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-11 gap-2">
          <Filter className="h-4 w-4" />
          Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        className="w-80 max-w-[calc(100vw-24px)] overflow-y-auto overscroll-contain space-y-3"
        style={{ maxHeight: 'min(480px, var(--radix-popover-content-available-height))' }}
        aria-label={ariaLabel}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{heading}</h3>
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset
          </Button>
        </div>

        <Select
          value={selectedPlatform || 'all'}
          onValueChange={(v) => onPlatformChange(v === 'all' ? null : v)}
        >
          <SelectTrigger aria-label="Platform" className="w-full h-11 text-sm">
            <div className="flex items-center gap-2 truncate">
              {!selectedPlatform && <Filter className="h-3 w-3 opacity-50" />}
              <SelectValue placeholder="Platform">
                {!selectedPlatform ? (
                  'All Platforms'
                ) : hasPlatformLogo(selectedPlatform) ? (
                  <PlatformLogo platform={selectedPlatform} size={16} maxWidth={90} />
                ) : (
                  platformLabel(selectedPlatform)
                )}
              </SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {ALL_PLATFORMS.filter((p) => getPlatformCount(p) > 0).map((p) => (
              <SelectItem key={p} value={p}>
                <div className="flex items-center justify-between gap-4 w-full">
                  <span className="flex items-center gap-2">
                    <PlatformLogo platform={p} size={18} />
                    <span className={cn(hasPlatformLogo(p) && 'sr-only')}>
                      {platformLabel(p)}
                    </span>
                  </span>
                  <span className="text-xs opacity-50">({getPlatformCount(p)})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedAutoCategory ?? 'all'}
          onValueChange={(value) =>
            onAutoCategoryChange(value === 'all' ? null : (value as LibraryCategory))
          }
        >
          <SelectTrigger aria-label="Automatic category" className="w-full h-11 text-sm">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {LIBRARY_CATEGORIES.filter(
              (category) =>
                autoCategoryCounts[category] > 0 || selectedAutoCategory === category,
            ).map((category) => (
              <SelectItem key={category} value={category}>
                {category} ({autoCategoryCounts[category]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedGenre || 'all'}
          onValueChange={(v) => onGenreChange(v === 'all' ? null : v)}
        >
          <SelectTrigger aria-label="Genre" className="w-full h-11 text-sm">
            <div className="flex items-center gap-2 truncate">
              <Filter className="h-3 w-3 opacity-50" />
              <SelectValue placeholder="Genre" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genres</SelectItem>
            {ALL_GENRES.filter((g) => getGenreCount(g) > 0).map((g) => (
              <SelectItem key={g} value={g}>
                <div className="flex items-center justify-between gap-4 w-full">
                  <span>{g}</span>
                  <span className="text-xs opacity-50">({getGenreCount(g)})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {libraryType !== 'movie' && Object.keys(statusCounts).length > 0 && (
          <Select
            value={selectedStatus || 'all'}
            onValueChange={(v) => onStatusChange(v === 'all' ? null : v)}
          >
            <SelectTrigger aria-label="Series status" className="w-full h-11 text-sm">
              <div className="flex items-center gap-2 truncate">
                <Filter className="h-3 w-3 opacity-50" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.keys(statusCounts)
                .sort()
                .map((status) => (
                  <SelectItem key={status} value={status}>
                    <div className="flex items-center justify-between gap-4 w-full">
                      <span>{status === 'Canceled' ? 'Cancelled' : status}</span>
                      <span className="text-xs opacity-50">({getStatusCount(status)})</span>
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </PopoverContent>
    </Popover>
  );
}

import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ChevronDown, Film, Loader2, Plus, Tv, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { statusLabel } from '@/features/watchlist/library-state';
import {
  groupLibraryItemsByShelf,
  mergePersonFilmography,
} from '@/features/watchlist/person-credits';
import {
  fetchPersonLibraryMatches,
  fetchTmdbPersonFilmography,
} from '@/features/watchlist/person-credits-query';
import type { TmdbPersonCredit } from '@/features/watchlist/person-credits';
import { useWatchlist } from '@/features/watchlist/useWatchlist';
import { useAddToLibrary } from '@/features/watchlist/components/franchise/useAddToLibrary';

interface PersonFilmographyDialogProps {
  name: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  subtle = false,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  subtle?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-md py-1 text-left hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`}
          />
          <span
            className={
              subtle
                ? 'text-xs font-medium text-muted-foreground'
                : 'text-xs font-semibold uppercase tracking-wider text-muted-foreground'
            }
          >
            {title}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </button>
      {open ? children : null}
    </section>
  );
}

function MediaSplit<T>({
  items,
  isTv,
  renderGrid,
  defaultOpen = true,
}: {
  items: T[];
  isTv: (item: T) => boolean;
  renderGrid: (subset: T[]) => ReactNode;
  defaultOpen?: boolean;
}) {
  const tv = items.filter(isTv);
  const movies = items.filter((item) => !isTv(item));
  return (
    <div className="space-y-3 pl-2">
      {tv.length > 0 ? (
        <CollapsibleSection title="TV Shows" count={tv.length} defaultOpen={defaultOpen} subtle>
          {renderGrid(tv)}
        </CollapsibleSection>
      ) : null}
      {movies.length > 0 ? (
        <CollapsibleSection title="Movies" count={movies.length} defaultOpen={defaultOpen} subtle>
          {renderGrid(movies)}
        </CollapsibleSection>
      ) : null}
    </div>
  );
}

export function PersonFilmographyDialog({
  name,
  open,
  onOpenChange,
}: PersonFilmographyDialogProps) {
  const { watchlist } = useWatchlist();
  const { isAdmin } = useAuth();
  const { addToLibrary, isAdding } = useAddToLibrary();

  const libraryQuery = useQuery({
    queryKey: ['person-library', name],
    queryFn: () => fetchPersonLibraryMatches(name ?? '', watchlist),
    enabled: open && !!name,
    staleTime: 5 * 60_000,
  });

  const tmdbQuery = useQuery({
    queryKey: ['tmdb-person-filmography', name],
    queryFn: () => fetchTmdbPersonFilmography(name ?? ''),
    enabled: open && !!name,
    staleTime: 30 * 60_000,
  });

  const { shelfGroups, upcomingNotInLibrary, otherNotInLibrary } = useMemo(() => {
    const libraryMatches = libraryQuery.data ?? [];
    const tmdbCredits = tmdbQuery.data?.credits ?? [];
    const merged = mergePersonFilmography(libraryMatches, tmdbCredits, watchlist);
    return {
      shelfGroups: groupLibraryItemsByShelf(merged.inLibrary, isAdmin),
      upcomingNotInLibrary: merged.notInLibrary.filter((c) => c.upcoming),
      otherNotInLibrary: merged.notInLibrary.filter((c) => !c.upcoming),
    };
  }, [isAdmin, libraryQuery.data, tmdbQuery.data, watchlist]);

  const renderTmdbCreditCard = (credit: TmdbPersonCredit) => {
    const adding = isAdding(credit.key);
    return (
      <div
        key={credit.key}
        className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/60 p-2"
      >
        {credit.posterUrl ? (
          <img
            src={credit.posterUrl}
            alt={credit.title}
            className="h-14 w-10 rounded-md object-cover shrink-0 bg-muted"
          />
        ) : (
          <div className="h-14 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
            {credit.mediaType === 'tv' ? <Tv className="h-4 w-4 text-muted-foreground" /> : <Film className="h-4 w-4 text-muted-foreground" />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{credit.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {credit.year ?? 'TBA'} · {credit.mediaType === 'tv' ? 'Series' : 'Film'}
            {credit.roles.length > 0 ? ` · ${credit.roles.slice(0, 2).join(', ')}` : ''}
          </p>
          {credit.upcoming ? (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">
              <CalendarClock className="h-3 w-3" />
              Upcoming ({credit.releaseDate})
            </span>
          ) : null}
        </div>
        {isAdmin ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="shrink-0 h-8 px-2"
            disabled={adding}
            aria-label={`Add ${credit.title} to library`}
            onClick={() =>
              addToLibrary({
                key: credit.key,
                tmdbId: credit.tmdbId,
                mediaType: credit.mediaType,
                title: credit.title,
                releaseDate: credit.releaseDate,
                poster: credit.posterUrl ?? null,
              })
            }
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        ) : null}
      </div>
    );
  };

  const totalLibraryCount = shelfGroups.reduce((sum, g) => sum + g.items.length, 0);
  const profile = tmdbQuery.data?.person;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {profile?.profileUrl ? (
              <img
                src={profile.profileUrl}
                alt={profile.name}
                className="h-12 w-12 rounded-full object-cover border border-border/60 shrink-0"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <DialogTitle className="truncate">{name ?? 'Person'}</DialogTitle>
              <DialogDescription>
                {profile?.knownForDepartment
                  ? `${profile.knownForDepartment} · ${totalLibraryCount} in your library`
                  : `${totalLibraryCount} ${totalLibraryCount === 1 ? 'title' : 'titles'} in your library`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-5 app-scroll">
          {libraryQuery.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking your library…</span>
            </div>
          ) : shelfGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No titles in your library credit {name} as a director, creator, or top-3 cast member.
            </p>
          ) : (
            <div className="space-y-4">
              {shelfGroups.map((group) => (
                <CollapsibleSection key={group.shelf} title={group.shelf} count={group.items.length}>
                  <MediaSplit
                    items={group.items}
                    isTv={(item) => item.category === 'TV Shows'}
                    renderGrid={(subset) => (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {subset.map((item) => {
                          const label = statusLabel(item);
                          const isTv = item.category === 'TV Shows';
                          return (
                            <div
                              key={`${item.category}:${item.id}`}
                              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 p-2"
                            >
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.title}
                                  className="h-14 w-10 rounded-md object-cover shrink-0 bg-muted"
                                />
                              ) : (
                                <div className="h-14 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                                  {isTv ? <Tv className="h-4 w-4 text-muted-foreground" /> : <Film className="h-4 w-4 text-muted-foreground" />}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{item.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.year ?? 'TBA'} · {isTv ? 'Series' : 'Film'}
                                </p>
                                <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">
                                  {label}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  />
                </CollapsibleSection>
              ))}
            </div>
          )}

          <div className="border-t border-border/60 pt-4 space-y-3">
            {tmdbQuery.isLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading full filmography from TMDB…</span>
              </div>
            ) : tmdbQuery.isError ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                <span>Could not load TMDB filmography right now.</span>
                <Button type="button" size="sm" variant="outline" onClick={() => tmdbQuery.refetch()}>
                  Retry
                </Button>
              </div>
            ) : tmdbQuery.data === null ? (
              <p className="text-xs text-muted-foreground">No matching person found on TMDB.</p>
            ) : upcomingNotInLibrary.length === 0 && otherNotInLibrary.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Everything in {profile?.name ?? name}’s TMDB filmography is already in your library.
              </p>
            ) : (
              <div className="space-y-4">
                {upcomingNotInLibrary.length > 0 ? (
                  <CollapsibleSection title="Upcoming (not in library)" count={upcomingNotInLibrary.length}>
                    <MediaSplit
                      items={upcomingNotInLibrary}
                      isTv={(c) => c.mediaType === 'tv'}
                      renderGrid={(subset) => (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {subset.map(renderTmdbCreditCard)}
                        </div>
                      )}
                    />
                  </CollapsibleSection>
                ) : null}
                {otherNotInLibrary.length > 0 ? (
                  <CollapsibleSection title="Other work (not in library)" count={otherNotInLibrary.length}>
                    <MediaSplit
                      items={otherNotInLibrary}
                      isTv={(c) => c.mediaType === 'tv'}
                      renderGrid={(subset) => (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {subset.map(renderTmdbCreditCard)}
                        </div>
                      )}
                    />
                  </CollapsibleSection>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

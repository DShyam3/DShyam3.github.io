import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Clapperboard, Film, Loader2, Sparkles, Tv, User, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WatchlistNav } from '@/features/watchlist/components/WatchlistNav';
import { PersonFilmographyDialog } from '@/features/watchlist/components/PersonFilmographyDialog';
import { PlatformLogo, hasPlatformLogo } from '@/features/watchlist/components/PlatformLogo';
import { SectionFailure } from '@/features/watchlist/components/SectionFailure';
import {
  computeCoolFacts,
  type LabelCount,
  type WatchedPersonStat,
} from '@/features/watchlist/cool-facts';
import { fetchWatchlistCreditsIndex } from '@/features/watchlist/cool-facts-query';
import { fetchTmdbPersonProfileUrl } from '@/features/watchlist/person-credits-query';
import { useWatchlist } from '@/features/watchlist/useWatchlist';

function PersonAvatar({ name, fetchPhoto }: { name: string; fetchPhoto: boolean }) {
  const { data: profileUrl } = useQuery({
    queryKey: ['tmdb-person-avatar', name],
    queryFn: () => fetchTmdbPersonProfileUrl(name),
    enabled: fetchPhoto,
    staleTime: 60 * 60_000,
    retry: false,
  });

  if (profileUrl) {
    return (
      <img
        src={profileUrl}
        alt={name}
        className="h-8 w-8 rounded-full object-cover border border-border/60 shrink-0 bg-muted"
      />
    );
  }
  return (
    <span className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
      <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
    </span>
  );
}

function PersonLeaderboardCard({
  title,
  description,
  icon: Icon,
  people,
  onSelectPerson,
}: {
  title: string;
  description: string;
  icon: typeof Users;
  people: WatchedPersonStat[];
  onSelectPerson: (name: string) => void;
}) {
  const maxCount = people[0]?.titleCount ?? 1;
  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {people.length === 0 ? (
          <p className="text-xs text-muted-foreground">No watched credits recorded yet.</p>
        ) : (
          <ol className="space-y-3">
            {people.map((person, index) => {
              const pct = Math.max(8, Math.round((person.titleCount / maxCount) * 100));
              const breakdown = [
                person.movieCount > 0 ? `${person.movieCount} ${person.movieCount === 1 ? 'film' : 'films'}` : null,
                person.showCount > 0 ? `${person.showCount} series` : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <li key={person.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-muted-foreground w-4 shrink-0">
                        {index + 1}.
                      </span>
                      <PersonAvatar name={person.name} fetchPhoto={index < 5} />
                      <button
                        type="button"
                        onClick={() => onSelectPerson(person.name)}
                        className="font-medium truncate underline decoration-border underline-offset-4 hover:decoration-foreground transition-colors text-left"
                      >
                        {person.name}
                      </button>
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {person.titleCount} {person.titleCount === 1 ? 'title' : 'titles'}
                      {breakdown ? ` (${breakdown})` : ''}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {person.sampleItems.length > 0 ? (
                    <div className="flex items-center gap-1.5 pl-6 pt-0.5">
                      {person.sampleItems.map((sample) =>
                        sample.imageUrl ? (
                          <img
                            key={sample.title}
                            src={sample.imageUrl}
                            alt={sample.title}
                            title={sample.title}
                            className="h-8 w-5 rounded-sm object-cover bg-muted border border-border/40 shrink-0"
                          />
                        ) : null,
                      )}
                      <span className="text-[11px] text-muted-foreground truncate">
                        {person.sampleItems.map((s) => s.title).join(', ')}
                      </span>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownCard({
  title,
  rows,
  withPlatformLogo = false,
}: {
  title: string;
  rows: LabelCount[];
  withPlatformLogo?: boolean;
}) {
  const maxCount = rows[0]?.count ?? 1;
  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No watched data yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((row) => (
              <li key={row.label} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 min-w-0 truncate">
                    {withPlatformLogo && hasPlatformLogo(row.label) ? (
                      <PlatformLogo platform={row.label} size={14} maxWidth={56} className="shrink-0" />
                    ) : null}
                    <span className="truncate">{row.label}</span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{row.count}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{ width: `${Math.max(8, Math.round((row.count / maxCount) * 100))}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Cool facts: most-watched cast, directors, creators, genres, and watch time. */
export default function WatchlistFacts() {
  const { watchlist, loading: libraryLoading } = useWatchlist();
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

  const creditsQuery = useQuery({
    queryKey: ['watchlist-credits-index'],
    queryFn: fetchWatchlistCreditsIndex,
    staleTime: 10 * 60_000,
  });

  const facts = useMemo(
    () => computeCoolFacts(watchlist, creditsQuery.data ?? new Map()),
    [watchlist, creditsQuery.data],
  );

  const watchedHours = Math.round(facts.totalWatchedMinutes / 60);
  const loading = libraryLoading || creditsQuery.isLoading;

  return (
    <AppShell
      title="Watchlist"
      subtitle="Cool facts"
      toolbar={<WatchlistNav current="facts" />}
    >
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Your most-watched cast, directors, creators, genres, and platforms. Click any person to inspect their full filmography.
        </p>

        {creditsQuery.isError ? (
          <SectionFailure>
            Could not load credits index.
          </SectionFailure>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Crunching your watch stats…</span>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border/60 bg-card/60">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <Film className="h-3.5 w-3.5" aria-hidden="true" />
                    Films watched
                  </CardDescription>
                  <CardTitle className="text-2xl font-mono">{facts.watchedMoviesCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-border/60 bg-card/60">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <Tv className="h-3.5 w-3.5" aria-hidden="true" />
                    Series started
                  </CardDescription>
                  <CardTitle className="text-2xl font-mono">{facts.watchedShowsCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-border/60 bg-card/60">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Episodes watched
                  </CardDescription>
                  <CardTitle className="text-2xl font-mono">{facts.watchedEpisodesCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-border/60 bg-card/60">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Total watch time
                  </CardDescription>
                  <CardTitle className="text-2xl font-mono">{watchedHours.toLocaleString()}h</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <PersonLeaderboardCard
                title="Most watched cast"
                description="Across your watched films & series (from stored top-3 cast)."
                icon={Users}
                people={facts.topCast}
                onSelectPerson={setSelectedPerson}
              />
              <PersonLeaderboardCard
                title="Most watched directors"
                description="Directors of films you have watched."
                icon={Clapperboard}
                people={facts.topDirectors}
                onSelectPerson={setSelectedPerson}
              />
              <PersonLeaderboardCard
                title="Most watched creators"
                description="Creators of series you have started or finished."
                icon={Tv}
                people={facts.topCreators}
                onSelectPerson={setSelectedPerson}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <BreakdownCard title="Top genres" rows={facts.topGenres} />
              <BreakdownCard title="Top platforms" rows={facts.topPlatforms} withPlatformLogo />
              <BreakdownCard title="Top decades" rows={facts.topDecades} />
            </div>
          </>
        )}

        <PersonFilmographyDialog
          name={selectedPerson}
          open={selectedPerson !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedPerson(null);
          }}
        />
      </div>
    </AppShell>
  );
}

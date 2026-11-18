import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { NativeSelect } from '@/components/ui/native-select';
import { useAuth } from '@/contexts/AuthContext';
import { DiaryList } from '@/features/watchlist/components/diary/DiaryList';
import { WatchHistoryImport } from '@/features/watchlist/components/import/WatchHistoryImport';
import { YearReviewView } from '@/features/watchlist/components/diary/YearReviewView';
import { SectionFailure } from '@/features/watchlist/components/SectionFailure';
import { WatchlistNav } from '@/features/watchlist/components/WatchlistNav';
import { buildDiary, type DiaryRow } from '@/features/watchlist/diary';
import { diaryQueryOptions } from '@/features/watchlist/diary-query';
import { useWatchlist } from '@/features/watchlist/useWatchlist';
import { buildYearReview, yearsWithData, type RatedThing } from '@/features/watchlist/year-review';
import { cn } from '@/lib/utils';

type Tab = 'diary' | 'year';
const TABS: { key: Tab; label: string }[] = [
  { key: 'diary', label: 'DIARY' },
  { key: 'year', label: 'YEAR IN REVIEW' },
];

export default function WatchlistDiary() {
  const [tab, setTab] = useState<Tab>('diary');
  const [pickedYear, setPickedYear] = useState<number | null>(null);
  const { isAdmin } = useAuth();
  const { watchlist, setWatchedDates } = useWatchlist();
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery(diaryQueryOptions);
  const records = useMemo(() => data?.records ?? [], [data]);

  const undated = data?.undated ?? 0;
  const diary = useMemo(() => ({ ...buildDiary(records), undated }), [records, undated]);
  const years = useMemo(() => yearsWithData(records), [records]);
  const year = pickedYear !== null && years.includes(pickedYear) ? pickedYear : years[0];

  const ratings = useMemo(() => {
    const things: RatedThing[] = [];
    for (const item of watchlist) {
      if (item.category === 'Movies' && item.rating) {
        things.push({ kind: 'movie', titleId: item.id, title: item.title, poster: item.image_url ?? null, rating: item.rating });
      }
      for (const season of item.seasons ?? []) {
        if (season.rating) {
          things.push({ kind: 'season', titleId: item.id, title: item.title, poster: item.image_url ?? null, seasonNumber: season.season_number, rating: season.rating });
        }
      }
    }
    return things;
  }, [watchlist]);

  const review = useMemo(
    () => (year === undefined ? null : { ...buildYearReview({ records, ratings, year }), undated }),
    [records, ratings, year, undated],
  );

  const setDate = async (row: DiaryRow, watchedAt: string | null) => {
    for (const kind of ['episode', 'movie'] as const) {
      const ids = row.records.filter((record) => record.kind === kind).map((record) => record.id);
      if (ids.length > 0) await setWatchedDates(kind, ids, watchedAt);
    }
    await queryClient.invalidateQueries({ queryKey: diaryQueryOptions.queryKey });
  };

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <WatchlistNav current="diary" />
      <div data-slot="diary-actions" className="ml-auto">
        <WatchHistoryImport />
      </div>
    </div>
  );

  return (
    <AppShell title="Watchlist" subtitle="Diary" toolbar={toolbar}>
      <div className="space-y-4">
        <div role="group" aria-label="Diary view" className="inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-card/60 p-0.5">
          {TABS.map((option) => {
            const selected = tab === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setTab(option.key)}
                aria-pressed={selected}
                className={cn(
                  'min-h-10 rounded-full px-3 py-1 transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  selected ? 'bg-primary text-primary-foreground' : 'text-foreground/75 hover:bg-muted hover:text-foreground',
                )}
              >
                <DotMatrixText text={option.label} size="xs" wrap={false} />
              </button>
            );
          })}
        </div>

      {isPending && (
        <div role="status" aria-label="Loading the diary" className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}
        </div>
      )}
      {isError && <SectionFailure>Could not load the diary</SectionFailure>}

      {data && tab === 'diary' && <DiaryList diary={diary} onSetDate={isAdmin ? setDate : undefined} />}

      {data && tab === 'year' && (
        review && year !== undefined ? (
          <div className="space-y-6">
            <label className="flex items-center gap-3 text-sm">
              <span>Year</span>
              <NativeSelect
                value={year}
                onChange={(event) => setPickedYear(Number(event.target.value))}
                wrapperClassName="w-32"
                className="rounded-lg border bg-background text-sm"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </NativeSelect>
            </label>
            <YearReviewView review={review} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing in the diary yet. Marking episodes and films watched adds them here.</p>
        )
      )}
      </div>
    </AppShell>
  );
}

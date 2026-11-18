import type { YearReview } from '@/features/watchlist/year-review';
import { formatDayHeading, formatMinutes, formatTotal } from './format';

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date(2000, i, 1)));

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-3">
      <dd className="font-serif text-xl font-semibold tabular-nums">{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}

function Heading({ children }: { children: string }) {
  return <h2 className="font-serif text-base font-semibold">{children}</h2>;
}

function MonthChart({ months }: { months: YearReview['months'] }) {
  const max = Math.max(...months.map((m) => m.minutes), 1);
  return (
    <section className="space-y-2">
      <Heading>By month</Heading>
      <div className="flex h-32 items-end gap-1 sm:gap-2" role="img" aria-label="Minutes watched per month, values in the table below">
        {months.map((m) => (
          <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col justify-end" aria-hidden="true">
            <div className="w-full rounded-t bg-primary/70" style={{ height: `${(m.minutes / max) * 100}%` }} title={`${MONTH_NAMES[m.month - 1]}: ${formatMinutes(m.minutes)}`} />
          </div>
        ))}
      </div>
      <div className="flex gap-1 sm:gap-2" aria-hidden="true">
        {months.map((m) => (
          <span key={m.month} className="min-w-0 flex-1 text-center text-[10px] text-muted-foreground sm:text-xs">{MONTH_NAMES[m.month - 1].slice(0, 1)}<span className="hidden sm:inline">{MONTH_NAMES[m.month - 1].slice(1)}</span></span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Time watched per month</caption>
        <thead><tr><th>Month</th><th>Time watched</th></tr></thead>
        <tbody>
          {months.map((m) => <tr key={m.month}><td>{MONTH_NAMES[m.month - 1]}</td><td>{formatMinutes(m.minutes)}</td></tr>)}
        </tbody>
      </table>
    </section>
  );
}

function Rated({ title, things }: { title: string; things: YearReview['topRatedFilms'] }) {
  if (things.length === 0) return null;
  return (
    <section className="space-y-2">
      <Heading>{title}</Heading>
      <ol className="divide-y divide-border/50">
        {things.map((t) => (
          <li key={`${t.kind}:${t.titleId}:${t.seasonNumber ?? ''}`} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
            <span className="min-w-0 truncate">{t.title}{t.kind === 'season' ? ` · Season ${t.seasonNumber}` : ''}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{t.rating}/10</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function YearReviewView({ review }: { review: YearReview }) {
  const { totals } = review;
  const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;
  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Figure label="Time watched" value={formatTotal(totals.minutes, totals.unknownRuntime)} />
        <Figure label="Episodes" value={String(totals.episodes)} />
        <Figure label="Films" value={String(totals.films)} />
        <Figure label="Shows" value={String(totals.shows)} />
        <Figure label="Days with something watched" value={String(totals.days)} />
      </dl>

      <MonthChart months={review.months} />

      <div className="grid gap-8 md:grid-cols-2">
        {review.topShows.length > 0 && (
          <section className="space-y-2">
            <Heading>Top shows</Heading>
            <ol className="divide-y divide-border/50">
              {review.topShows.map((s) => (
                <li key={s.titleId} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate">{s.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{s.episodes} ep · {formatMinutes(s.minutes)}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {review.genres.length > 0 && (
          <section className="space-y-2">
            <Heading>Genres</Heading>
            <ul className="space-y-2">
              {review.genres.map((g) => {
                const percent = Math.round(g.share * 100);
                return (
                  <li key={g.genre} className="space-y-1 text-sm">
                    <div className="flex justify-between gap-3"><span className="truncate">{g.genre}</span><span className="tabular-nums text-muted-foreground">{percent}%</span></div>
                    <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary/70" style={{ width: `${percent}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {review.platforms.length > 0 && (
          <section className="space-y-2">
            <Heading>Platforms</Heading>
            <ul className="divide-y divide-border/50">
              {review.platforms.map((p) => (
                <li key={p.platform} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate">{p.platform}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatMinutes(p.minutes)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(review.busiestDay || review.longestStreak) && (
          <section className="space-y-2">
            <Heading>Highlights</Heading>
            <ul className="space-y-1 text-sm">
              {review.busiestDay && <li>Busiest day: {formatDayHeading(review.busiestDay.day)}, {formatMinutes(review.busiestDay.minutes)} across {review.busiestDay.records} watch{review.busiestDay.records === 1 ? '' : 'es'}.</li>}
              {review.longestStreak && <li>Longest streak: {days(review.longestStreak.days)}, {formatDayHeading(review.longestStreak.start)} to {formatDayHeading(review.longestStreak.end)}.</li>}
            </ul>
          </section>
        )}

        <Rated title="Top rated films" things={review.topRatedFilms} />
        <Rated title="Top rated seasons" things={review.topRatedSeasons} />
      </div>

      <p className="text-xs text-muted-foreground">
        Counts only watches with a date. Times use known runtimes.
        {review.undated > 0 && ` ${review.undated} watched with no date — not counted.`}
      </p>
    </div>
  );
}

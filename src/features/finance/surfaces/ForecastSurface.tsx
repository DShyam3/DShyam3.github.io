/**
 * The next 60 days of the Checking accounts, day by day.
 *
 * The arithmetic is `forecastBalance` in lib/finance: pure, deterministic and
 * tested. Nothing is computed here. This shows the balance it returns, the
 * paydays and bills it placed, and -- as plainly as the figures -- whatever it
 * left out, so a partial forecast is never read as a complete one.
 */

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatGBP } from '@/features/finance/utils/calculations';
import type { ForecastEvent, ForecastUnavailableReason } from '@/lib/finance/balance-forecast';
import { useBalanceForecast } from '../useBalanceForecast';

/** Dates of events shown before "Show all". */
const PREVIEW_DATES = 10;

const UNAVAILABLE: Record<ForecastUnavailableReason, string> = {
  no_cash_account: 'Add a Checking account under Wealth → Accounts to see a forecast.',
  unknown_balance: 'A Checking account has no readable balance, so there is no forecast.',
  invalid_window: 'Forecast unavailable.',
};

const shortDate = (date: string) => format(parseISO(date), 'd MMM');
const longDate = (date: string) => format(parseISO(date), 'EEE d MMM');

const axisGBP = (value: number) => {
  const abs = Math.abs(value);
  const text = abs >= 1000 ? `${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(Math.round(abs));
  return `${value < 0 ? '−' : ''}£${text}`;
};

const unique = (names: string[]) => [...new Set(names)];

export default function ForecastSurface() {
  const { forecast, ready, exclusionsUnreliable } = useBalanceForecast();
  const [showAll, setShowAll] = useState(false);

  const days = useMemo(() => {
    const byDate = new Map<string, ForecastEvent[]>();
    for (const event of forecast.events) {
      byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
    }
    return [...byDate.entries()];
  }, [forecast.events]);

  const header = (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-sans text-lg font-semibold">Next 60 days</h2>
        <Badge variant="outline" className="text-xs font-mono border-border/40 text-muted-foreground">Forecast</Badge>
      </div>
      <p className="font-sans text-sm text-muted-foreground">
        Checking accounts, active bills and modelled take-home. Day-to-day spending is not included.
      </p>
    </div>
  );

  if (!ready) {
    return (
      <div className="flex flex-col gap-8" role="status" aria-label="Loading forecast">
        {header}
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (forecast.available === false) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <p className="font-sans text-sm text-muted-foreground">{UNAVAILABLE[forecast.reason]}</p>
      </div>
    );
  }

  const { lowest, firstBelowZero, endBalance, points, overdue, excluded, unplaced, payModelled } = forecast;
  const shown = showAll ? days : days.slice(0, PREVIEW_DATES);

  const stats = [
    { label: 'Lowest point', value: formatGBP(lowest.balance), negative: lowest.balance < 0, note: shortDate(lowest.date) },
    { label: 'First day below zero', value: firstBelowZero ? shortDate(firstBelowZero) : 'None in the next 60 days', negative: false, note: null },
    { label: 'In 60 days', value: formatGBP(endBalance), negative: endBalance < 0, note: null },
  ];

  return (
    <div className="flex flex-col gap-8">
      {header}

      <dl className="grid gap-4 sm:grid-cols-3">
        {stats.map(stat => (
          <div key={stat.label} className="min-w-0">
            <dt className="font-sans text-xs text-muted-foreground">{stat.label}</dt>
            <dd className={cn('font-mono text-xl font-bold tabular-nums', stat.negative ? 'text-destructive' : 'text-foreground')}>
              {stat.value}
            </dd>
            {stat.note ? <dd className="font-sans text-xs text-muted-foreground">{stat.note}</dd> : null}
          </div>
        ))}
      </dl>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="forecast-balance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              interval="preserveStartEnd"
              minTickGap={32}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={axisGBP}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius)',
                fontSize: 12,
              }}
              labelFormatter={(date: string) => longDate(date)}
              formatter={(value: number) => [formatGBP(value), 'Balance']}
            />
            {lowest.balance < 0 ? (
              <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
            ) : null}
            <Area type="monotone" dataKey="balance" name="Balance" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#forecast-balance)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <section aria-label="Pay and bills in the next 60 days" className="space-y-3">
        <p className="font-sans text-xs text-muted-foreground">Pay and bills</p>
        {days.length === 0 ? (
          <p className="font-sans text-sm text-muted-foreground">No pay or bills fall in the next 60 days.</p>
        ) : (
          <div className="space-y-3">
            {shown.map(([date, events]) => (
              <div key={date} className="space-y-1">
                <p className="font-sans text-xs text-muted-foreground">{longDate(date)}</p>
                <ul className="space-y-0.5">
                  {events.map(event => (
                    <li
                      key={`${event.kind}-${event.billId ?? 'pay'}-${event.label}`}
                      className={cn('flex min-w-0 items-baseline gap-3 font-mono text-sm', event.kind === 'pay' ? 'text-positive' : 'text-foreground')}
                    >
                      <span className="shrink-0 font-bold tabular-nums">
                        {event.kind === 'pay' ? '+' : '−'}{formatGBP(event.amount)}
                      </span>
                      <span className="min-w-0 truncate">{event.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {days.length > PREVIEW_DATES && (
              <button
                type="button"
                onClick={() => setShowAll(open => !open)}
                aria-expanded={showAll}
                className="text-xs font-mono text-muted-foreground hover:text-foreground"
              >
                {showAll ? 'Show fewer' : `Show all ${days.length} dates`}
              </button>
            )}
          </div>
        )}
      </section>

      <div className="space-y-2 font-sans text-xs text-muted-foreground">
        {overdue.length > 0 ? (
          <p>Not confirmed, so not counted: {overdue.map(bill => `${bill.name} (${shortDate(bill.date)})`).join(', ')}</p>
        ) : null}
        {excluded.length > 0 ? (
          <p>Paid from another account, so not counted: {unique(excluded.map(bill => bill.name)).join(', ')}</p>
        ) : null}
        {unplaced.length > 0 ? (
          <p>Bills that can't be placed on a date are not counted: {unplaced.map(bill => bill.name).join(', ')}</p>
        ) : null}
        {payModelled ? null : (
          <p>Pay isn&apos;t included: set salary and payday under Income → Tax &amp; Income.</p>
        )}
        {exclusionsUnreliable ? (
          <p className="text-chart-4">Transfers could not load, so bank payments are not matched to bills, and money moved between your accounts before payday may be read as pay. Treat this forecast as rough until the page reloads.</p>
        ) : null}
      </div>
    </div>
  );
}

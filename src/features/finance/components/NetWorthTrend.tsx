import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { netWorthChangeSince, startOfMonth, type NetWorthPoint } from '@/lib/finance';
import { formatGBP } from '@/features/finance/utils/calculations';
import { cn } from '@/lib/utils';

/**
 * Net worth over time, and what it has done this month.
 *
 * The series only began when 7.4 landed, and it cannot be backfilled, so this
 * says what it actually has rather than drawing a confident line through two
 * points. A chart of one day is a dot, and claiming a trend from it would be
 * the same failure as reporting "under pace by £0.00" against no budget.
 */
export function NetWorthTrend({ points, today }: { points: NetWorthPoint[]; today: string }) {
  const change = netWorthChangeSince(points, startOfMonth(today));

  if (points.length === 0) {
    return (
      <p className="font-sans text-xs text-muted-foreground">
        No history recorded yet. A snapshot is taken nightly.
      </p>
    );
  }

  if (points.length < 2 || !change.previous) {
    return (
      <p className="font-sans text-xs text-muted-foreground">
        Recording since {points[0].capturedOn}. A comparison needs a second night.
      </p>
    );
  }

  const values = points.map(p => p.netWorth);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = max === min ? Math.max(1, Math.abs(max) * 0.01) : (max - min) * 0.1;
  const domain: [number, number] = [min - pad, max + pad];

  const tone =
    change.direction === 'up' ? 'text-positive'
    : change.direction === 'down' ? 'text-destructive'
    : 'text-muted-foreground';

  return (
    <div className="space-y-2">
      <p className="font-sans text-xs text-muted-foreground">
        <span className={cn('font-bold tabular-nums', tone)}>
          {change.absolute > 0 ? '+' : ''}{formatGBP(change.absolute)}
        </span>
        {change.percent === null ? null : (
          <span className={cn('tabular-nums', tone)}> ({change.percent > 0 ? '+' : ''}{change.percent}%)</span>
        )}{' '}
        over {change.spanDays} {change.spanDays === 1 ? 'day' : 'days'}
      </p>
      {/* Two points are a horizontal line, which occupies space to say nothing.
          The summary above already carries the whole story until there is a
          shape worth drawing. */}
      {points.length < 3 ? null : (
      <div className="h-16 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="nw-trend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* Net worth is often negative and rarely near zero, so a domain
                anchored at 0 would flatten every real movement out of view.
                An unchanged series collapses dataMin onto dataMax and renders
                nothing at all, so a flat run gets a little padding to draw
                against -- which is the common case in the first few days. */}
            <YAxis hide domain={domain} />
            <Tooltip
              cursor={false}
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius)',
                fontSize: 12,
              }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.capturedOn ?? ''}
              formatter={(v: number) => [formatGBP(v), 'Net worth']}
            />
            <Area
              type="monotone"
              dataKey="netWorth"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="url(#nw-trend)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      )}
    </div>
  );
}

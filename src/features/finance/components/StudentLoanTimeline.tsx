/**
 * A student loan's life, month by month, with a playhead.
 *
 * The point of the simulator is watching the balance grow while you study and
 * then fall -- or not -- once you earn, so the chart carries a scrubber and a
 * play control rather than only a tooltip. The readout above it describes the
 * month under the playhead; every figure in it is a field of that month in
 * `simulateStudentLoan`'s result. Nothing is computed here but formatting.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatGBP } from '@/features/finance/utils/calculations';
import type { StudentLoanMonth, StudentLoanPhase, StudentLoanSimResult } from '@/lib/finance';

const PHASE_LABEL: Record<StudentLoanPhase, string> = {
  study: 'Studying',
  pre_repayment: 'Graduated, not yet repaying',
  repayment: 'Repaying',
};

/** `YYYY-MM-01` as a fractional year, so the axis is linear in time. */
const toT = (date: string) => {
  const [y, m] = date.split('-').map(Number);
  return y + (m - 1) / 12;
};

const monthLabel = (date: string) => {
  const [y, m] = date.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

/** About six seconds end to end, whatever the length of the loan. */
const PLAY_MS = 6000;
const FRAME_MS = 40;

export function StudentLoanTimeline({
  result,
  realTerms,
  today,
  courseEnd,
}: {
  result: StudentLoanSimResult;
  realTerms: boolean;
  /** YYYY-MM-DD */
  today: string;
  courseEnd: string;
}) {
  const { months } = result;
  const todayMonth = `${today.slice(0, 7)}-01`;
  const todayIndex = months.findIndex(m => m.date === todayMonth);

  const [index, setIndex] = useState(() => (todayIndex >= 0 ? todayIndex : 0));
  const [playing, setPlaying] = useState(false);
  // Play runs the loan from the first draw unless it was paused part-way, so
  // the growth while studying is part of what you watch.
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);

  // A new result can be shorter than the last; keep the playhead on the chart.
  const last = Math.max(months.length - 1, 0);
  const at = Math.min(index, last);

  useEffect(() => {
    if (!playing) return;
    const step = Math.max(1, Math.round(months.length / (PLAY_MS / FRAME_MS)));
    timer.current = window.setInterval(() => {
      setIndex(i => {
        const next = Math.min(i + step, months.length - 1);
        if (next >= months.length - 1) setPlaying(false);
        return next;
      });
    }, FRAME_MS);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [playing, months.length]);

  const data = useMemo(
    () => months.map(m => ({
      t: toT(m.date),
      balance: realTerms ? m.balanceReal : m.balance,
      paid: realTerms ? m.cumulativePaidReal : m.cumulativePaid,
    })),
    [months, realTerms],
  );

  const ticks = useMemo(() => {
    if (data.length === 0) return [];
    const first = Math.ceil(data[0].t);
    const end = Math.floor(data[data.length - 1].t);
    const span = end - first;
    const every = span > 30 ? 10 : span > 12 ? 5 : span > 5 ? 2 : 1;
    const out: number[] = [];
    for (let y = Math.ceil(first / every) * every; y <= end; y += every) out.push(y);
    return out;
  }, [data]);

  if (months.length === 0) {
    return <p className="text-sm text-muted-foreground">Add some borrowing to see the loan play out.</p>;
  }

  const month: StudentLoanMonth = months[at];
  const shownBalance = realTerms ? month.balanceReal : month.balance;
  const shownPaid = realTerms ? month.cumulativePaidReal : month.cumulativePaid;
  const endT = toT(result.endDate);
  const anchored = months.find(m => m.anchored);

  const togglePlay = () => {
    if (playing) { setPlaying(false); setPaused(true); return; }
    // Reduced motion still gets the result, without the journey.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setIndex(last); return; }
    if (!paused || at >= last) setIndex(0);
    setPaused(false);
    setPlaying(true);
  };

  const isEnd = at === last && result.outcome !== 'horizon';
  const phaseText = isEnd
    ? (result.outcome === 'written_off' ? 'Written off' : 'Cleared')
    : PHASE_LABEL[month.phase];

  return (
    <div className="space-y-4">
      {/* Silent while playing: 150 announcements in six seconds is noise. */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3" aria-live={playing ? 'off' : 'polite'}>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {monthLabel(month.date)} · {phaseText}{month.anchored ? ' · verified balance' : ''}
          </p>
          <p className="text-3xl font-semibold tabular-nums">{formatGBP(shownBalance)}</p>
          {month.pendingTopUp >= 1 && (
            <p className="text-xs text-muted-foreground">
              Plus <span className="tabular-nums text-foreground">{formatGBP(month.pendingTopUp)}</span> interest waiting on HMRC to confirm income
            </p>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-right">
          <div>
            <dt className="text-xs text-muted-foreground">Interest</dt>
            <dd className="text-sm font-semibold tabular-nums">{month.annualRate.toFixed(2)}%</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Paying</dt>
            <dd className="text-sm font-semibold tabular-nums">{formatGBP(month.payment)}/mo</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Repaid so far</dt>
            <dd className="text-sm font-semibold tabular-nums">{formatGBP(shownPaid)}</dd>
          </div>
        </dl>
      </div>

      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 16, right: 8, bottom: 0, left: 8 }}
            onClick={(state: { activeTooltipIndex?: number } | null) => {
              if (state && typeof state.activeTooltipIndex === 'number') {
                setPlaying(false);
                setPaused(false);
                setIndex(state.activeTooltipIndex);
              }
            }}
          >
            <defs>
              <linearGradient id="sl-balance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              ticks={ticks}
              tickFormatter={(t: number) => String(Math.round(t))}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `£${Math.round(v / 1000)}k`}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <ReferenceLine x={toT(`${courseEnd.slice(0, 7)}-01`)} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4"
              label={{ value: 'Graduate', position: 'insideTopLeft', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            {todayIndex >= 0 && (
              <ReferenceLine x={toT(todayMonth)} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4"
                label={{ value: 'Today', position: 'insideTopRight', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            )}
            {result.outcome !== 'horizon' && (
              <ReferenceLine x={endT} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4"
                label={{ value: result.outcome === 'written_off' ? 'Written off' : 'Cleared', position: 'insideTopRight', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            )}
            <Area type="monotone" dataKey="balance" name="Balance" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#sl-balance)" isAnimationActive={false} />
            <Line type="monotone" dataKey="paid" name="Repaid" stroke="hsl(var(--positive))" strokeWidth={2} dot={false} isAnimationActive={false} />
            {anchored && (
              <ReferenceDot x={toT(anchored.date)} y={realTerms ? anchored.balanceReal : anchored.balance} r={4}
                fill="hsl(var(--background))" stroke="hsl(var(--foreground))" strokeWidth={2} />
            )}
            <ReferenceLine x={data[at].t} stroke="hsl(var(--primary))" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="icon" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play the loan from start to end'}>
          {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
        </Button>
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={at}
          onChange={e => { setPlaying(false); setPaused(false); setIndex(Number(e.target.value)); }}
          aria-label="Month"
          aria-valuetext={`${monthLabel(month.date)}, ${formatGBP(shownBalance)} owed`}
          className="h-2 flex-1 cursor-pointer accent-primary"
        />
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span><span className="mr-1.5 inline-block h-2 w-3 rounded-sm bg-destructive align-middle" aria-hidden />Balance</span>
        <span><span className="mr-1.5 inline-block h-0.5 w-3 bg-positive align-middle" aria-hidden />Repaid so far</span>
        {anchored && <span>○ Verified statement</span>}
        {realTerms && <span>In today&apos;s money</span>}
      </p>
    </div>
  );
}

/**
 * What the pension is on course to be worth (REHAUL_PLAN.md 7.14).
 *
 * Every figure comes from `projectPension`, which is pure and tested. The three
 * inputs it cannot know — when you stop, what growth to assume, whether
 * contributions rise — are controls rather than hidden constants, because a
 * projection whose assumptions you cannot see is a guess wearing a suit.
 */

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatGBP } from '@/features/finance/utils/calculations';
import {
  annualPensionContribution,
  projectPension,
  SAFE_WITHDRAWAL_PERCENT,
} from '@/lib/finance';
import { useFinanceData } from '../FinanceDataContext';

/** Long-run global equity returns after inflation sit around here. */
const DEFAULT_REAL_GROWTH = 4.5;
const DEFAULT_RETIREMENT_AGE = 68;

export default function RetirementSurface() {
  const { settings, bankAccounts } = useFinanceData();

  const [currentAge, setCurrentAge] = useState('30');
  const [retireAge, setRetireAge] = useState(String(DEFAULT_RETIREMENT_AGE));
  const [growth, setGrowth] = useState(String(DEFAULT_REAL_GROWTH));

  // Whatever is already tracked as a pension. Nothing else is assumed to be
  // retirement money -- an ISA is not a pension unless you say so.
  const currentPot = bankAccounts
    .filter(a => /pension|sipp/i.test(a.name) || /pension|sipp/i.test(a.issuer ?? ''))
    .reduce((sum, a) => sum + Math.max(0, a.balance), 0);

  const annualContribution = annualPensionContribution(
    settings.grossSalary ?? 0,
    settings.personalPensionPercent ?? 0,
    settings.employerPensionPercent ?? 0,
  );

  const years = Math.max(0, (Number(retireAge) || 0) - (Number(currentAge) || 0));
  const realGrowthPercent = Number(growth) || 0;

  const projection = useMemo(
    () => projectPension({ currentPot, annualContribution, years, realGrowthPercent }),
    [currentPot, annualContribution, years, realGrowthPercent],
  );

  const field = (id: string, label: string, value: string, set: (v: string) => void, suffix?: string) => (
    <div className="space-y-1">
      <Label htmlFor={id} className="font-sans text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-baseline gap-1">
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={e => set(e.target.value)}
          className="h-9 w-20 font-sans text-sm tabular-nums"
        />
        {suffix ? <span className="font-sans text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">
          Projected pot at {retireAge}
        </p>
        <p className="font-sans text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
          {formatGBP(projection.finalPot)}
        </p>
        {/* Said plainly, because the alternative -- a nominal figure -- is the
            most misleading number in consumer pension tooling. */}
        <p className="font-sans text-xs text-muted-foreground">
          In today's money, after inflation. Roughly{' '}
          <span className="font-bold text-foreground">{formatGBP(projection.sustainableAnnualIncome)}</span>{' '}
          a year at {SAFE_WITHDRAWAL_PERCENT}%.
        </p>
      </div>

      <div className="flex flex-wrap gap-6">
        {field('ret-age-now', 'Age now', currentAge, setCurrentAge)}
        {field('ret-age-stop', 'Retire at', retireAge, setRetireAge)}
        {field('ret-growth', 'Real growth', growth, setGrowth, '% a year')}
      </div>

      {years > 0 ? (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projection.years} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="pension-pot" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="year"
                tickFormatter={(y: number) => String((Number(currentAge) || 0) + y)}
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
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: 12,
                }}
                labelFormatter={(y: number) => `Age ${(Number(currentAge) || 0) + y}`}
                formatter={(v: number) => [formatGBP(v), 'Pot']}
              />
              <Area
                type="monotone"
                dataKey="pot"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill="url(#pension-pot)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="font-sans text-sm text-muted-foreground">
          Set a retirement age later than your current age to see a projection.
        </p>
      )}

      <section className="space-y-3 border-t border-border/40 pt-6">
        <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Assumptions</p>
        {[
          {
            label: 'Pot today',
            value: formatGBP(currentPot),
            note: 'Accounts named pension or SIPP. Nothing else is assumed to be retirement money.',
          },
          {
            label: 'Paid in each year',
            value: formatGBP(annualContribution),
            note: `${settings.personalPensionPercent ?? 0}% from you and ${settings.employerPensionPercent ?? 0}% from your employer, on ${formatGBP(settings.grossSalary ?? 0)}. Held flat in real terms.`,
          },
          {
            label: 'Growth',
            value: `${realGrowthPercent}% a year`,
            note: 'After inflation, so the result is in today\'s money. Long-run global equity returns sit around 4-5% real.',
          },
          {
            label: 'Of which growth',
            value: formatGBP(projection.totalGrowth),
            note: `${formatGBP(projection.totalContributed)} paid in over ${years} years, the rest is compounding.`,
          },
        ].map(a => (
          <div key={a.label}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-sans text-sm text-muted-foreground">{a.label}</span>
              <span className="font-sans text-sm font-bold tabular-nums text-foreground">{a.value}</span>
            </div>
            <p className="font-sans text-xs text-muted-foreground">{a.note}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

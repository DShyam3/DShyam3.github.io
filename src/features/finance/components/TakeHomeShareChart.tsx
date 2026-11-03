/**
 * Where each pound of income goes, across incomes: the share kept as cash at
 * the bottom, and what takes the rest stacked above it, in the same colours as
 * the take-home slices. One what-if (no student loan, no pension, more
 * pension, salary sacrifice) can be laid over it as a dashed line, so the
 * effect of a choice reads as the gap between two lines.
 *
 * Every share comes from `ukTakeHomeShareCurve` / `ukTakeHomeShareAt`, and
 * every what-if input from `ukWhatIfs`; nothing here does arithmetic.
 */

import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatWholeGBP } from '@/features/finance/utils/calculations';
import {
  ukTakeHomeShareAt,
  ukTakeHomeShareCurve,
  ukWhatIfs,
  type UkTakeHomeSharePoint,
  type UkTaxInput,
  type UkWhatIf,
  type UkWhatIfKey,
} from '@/lib/finance';
import { cn } from '@/lib/utils';

type Share = Exclude<keyof UkTakeHomeSharePoint, 'income'>;

/** Bottom to top, the order the stack and the legend both use. */
const SHARES: { key: Share; label: string; swatch: string; fill: string; opacity: number }[] = [
  { key: 'takeHome', label: 'Take-home', swatch: 'bg-positive', fill: 'hsl(var(--positive))', opacity: 0.85 },
  { key: 'pension', label: 'Pension', swatch: 'bg-positive/45', fill: 'hsl(var(--positive))', opacity: 0.45 },
  { key: 'incomeTax', label: 'Income tax', swatch: 'bg-chart-3', fill: 'hsl(var(--chart-3))', opacity: 0.85 },
  { key: 'nationalInsurance', label: 'National Insurance', swatch: 'bg-chart-4', fill: 'hsl(var(--chart-4))', opacity: 0.85 },
  { key: 'studentLoan', label: 'Student loan', swatch: 'bg-chart-2', fill: 'hsl(var(--chart-2))', opacity: 0.85 },
  { key: 'childBenefitCharge', label: 'Child benefit charge', swatch: 'bg-chart-5', fill: 'hsl(var(--chart-5))', opacity: 0.85 },
];

const Y_TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];
const axisTick = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' };

const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`;

type Point = UkTakeHomeSharePoint & { whatIf?: number };

/**
 * A what-if's name. The extra pension is a fixed number of pounds held at
 * every income, like the contribution entered, so it is named in pounds: a
 * percentage would only be true at your own income.
 */
const whatIfLabel = (w: UkWhatIf): string => {
  switch (w.key) {
    case 'no-loan': return 'No student loan';
    case 'no-pension': return 'No pension';
    case 'more-pension': return `Pension +${formatWholeGBP(w.extraPension)}`;
    case 'salary-sacrifice': return 'Pension by salary sacrifice';
  }
};

function ShareTooltip({ active, payload, whatIfLabel }: {
  active?: boolean;
  payload?: { payload: Point }[];
  whatIfLabel?: string;
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="min-w-[200px] rounded-lg border border-border/60 bg-popover p-3 font-mono text-xs text-foreground shadow-xl">
      <p className="mb-2 border-b border-border/40 pb-2 font-semibold">{formatWholeGBP(point.income)} income</p>
      <ul className="space-y-1">
        {SHARES.filter(s => point[s.key] > 0).map(s => (
          <li key={s.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span aria-hidden="true" className={cn('h-2 w-2 rounded-sm shrink-0', s.swatch)} />
              {s.label}
            </span>
            <span className="tabular-nums">{percent(point[s.key])}</span>
          </li>
        ))}
      </ul>
      {whatIfLabel && point.whatIf !== undefined && (
        <p className="mt-2 flex items-center justify-between gap-4 border-t border-border/40 pt-2">
          <span className="text-muted-foreground">{whatIfLabel}</span>
          <span className="tabular-nums">{percent(point.whatIf)} kept</span>
        </p>
      )}
    </div>
  );
}

export function TakeHomeShareChart({ input, chartMax, step, xTicks }: {
  input: UkTaxInput;
  chartMax: number;
  step: number;
  xTicks: number[];
}) {
  const [whatIfKey, setWhatIfKey] = useState<UkWhatIfKey | 'none'>('none');
  const options = useMemo(() => ukWhatIfs(input), [input]);
  // An option can vanish when the inputs change (no loan left to remove).
  const whatIf = options.find(o => o.key === whatIfKey);
  const label = whatIf ? whatIfLabel(whatIf) : undefined;

  const curve = useMemo(() => ukTakeHomeShareCurve(input, { maxIncome: chartMax, step }), [input, chartMax, step]);
  const whatIfCurve = useMemo(
    () => (whatIf ? ukTakeHomeShareCurve(whatIf.input, { maxIncome: chartMax, step }) : []),
    [whatIf, chartMax, step],
  );
  const data = useMemo<Point[]>(
    () => curve.map((p, i) => ({ ...p, whatIf: whatIfCurve[i]?.takeHome })),
    [curve, whatIfCurve],
  );
  const shown = SHARES.filter(s => curve.some(p => p[s.key] > 0));
  const hasIncome = input.income > 0;
  const yours = useMemo(() => ukTakeHomeShareAt(input), [input]);
  const yoursWhatIf = useMemo(() => (whatIf ? ukTakeHomeShareAt(whatIf.input) : undefined), [whatIf]);

  return (
    <>
      <div className="mt-4 h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="income"
              type="number"
              domain={[0, chartMax]}
              ticks={xTicks}
              tickFormatter={(v: number) => `£${Math.round(v / 1000)}k`}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
            />
            {/* Below a large net-pay pension the stack can pass 100% (NI on
                pay on top of a pension share of all of it): clip rather than
                let the axis stretch past 100%. */}
            <YAxis
              domain={[0, 1]}
              allowDataOverflow
              ticks={Y_TICKS}
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip content={<ShareTooltip whatIfLabel={label} />} />
            {shown.map(s => (
              <Area
                key={s.key}
                type="linear"
                dataKey={s.key}
                stackId="shares"
                fill={s.fill}
                fillOpacity={s.opacity}
                stroke="hsl(var(--card))"
                strokeWidth={1}
                isAnimationActive={false}
                activeDot={false}
              />
            ))}
            <ReferenceLine
              x={input.income}
              stroke="hsl(var(--primary))"
              label={{ value: 'You', position: 'top', fontSize: 12, fill: 'hsl(var(--primary))' }}
            />
            {whatIf && (
              <Line
                type="linear"
                dataKey="whatIf"
                stroke="hsl(var(--foreground))"
                strokeDasharray="5 4"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-mono">
          {shown.map(s => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-sm shrink-0', s.swatch)} />
              <span className="text-muted-foreground">{s.label}</span>
              {hasIncome && <span className="font-semibold tabular-nums text-foreground">{percent(yours[s.key])}</span>}
            </li>
          ))}
          {whatIf && (
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-0 w-4 shrink-0 border-t-2 border-dashed border-foreground" />
              <span className="text-muted-foreground">{label}</span>
              {hasIncome && yoursWhatIf && <span className="font-semibold tabular-nums text-foreground">{percent(yoursWhatIf.takeHome)} kept</span>}
            </li>
          )}
        </ul>
        {options.length > 0 && (
          <div className="space-y-1.5 sm:w-60 shrink-0">
            <Label htmlFor="taxcalc-what-if" className="text-xs text-muted-foreground">Compare with</Label>
            <Select value={whatIf ? whatIf.key : 'none'} onValueChange={v => setWhatIfKey(v as UkWhatIfKey | 'none')}>
              <SelectTrigger id="taxcalc-what-if" className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nothing</SelectItem>
                {options.map(o => (
                  <SelectItem key={o.key} value={o.key}>{whatIfLabel(o)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {hasIncome && (
        <p className="mt-3 text-xs text-muted-foreground">
          Legend figures are at your {formatWholeGBP(input.income)}. Child benefit itself and childcare support are not
          pay, so they are left out.
          {shown.some(s => s.key === 'childBenefitCharge') && (
            <> The child benefit charge is paid through Self Assessment rather than from your payslip.</>
          )}
        </p>
      )}
    </>
  );
}

/**
 * The share of income kept as cash, across incomes: one line, drawn like the
 * marginal-rate line beside it, falling from 100% as the pension, income tax,
 * National Insurance and loans start. What takes the rest at any income is in
 * the tooltip, and at your own income in the legend. One what-if (no student
 * loan, no pension, more pension, salary sacrifice) can be laid over it as a
 * dashed line, so the effect of a choice reads as the gap between two lines.
 *
 * Every share comes from `ukTakeHomeShareCurve` / `ukTakeHomeShareAt`, and
 * every what-if input from `ukWhatIfs`; nothing here does arithmetic.
 */

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatShare, formatWholeGBP } from '@/features/finance/utils/calculations';
import {
  ukTakeHomeShareAt,
  ukTakeHomeShareCurve,
  ukWhatIfs,
  type UkTakeHomeSharePoint,
  type UkTaxInput,
  type UkWhatIf,
  type UkWhatIfKey,
} from '@/lib/finance';

type Deduction = Exclude<keyof UkTakeHomeSharePoint, 'income' | 'takeHome'>;

/** What takes the part not kept, in the order the tooltip and the legend list it. */
const DEDUCTIONS: { key: Deduction; label: string }[] = [
  { key: 'pension', label: 'Pension' },
  { key: 'incomeTax', label: 'Income tax' },
  { key: 'nationalInsurance', label: 'National Insurance' },
  { key: 'studentLoan', label: 'Student loan' },
  { key: 'childBenefitCharge', label: 'Child benefit charge' },
];

const Y_TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];
const axisTick = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' };

const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`;

type Point = UkTakeHomeSharePoint & { whatIf?: number };

/**
 * A what-if's name. The extra pension is a share, taken afresh at every income
 * like the pension entered, so it is named by the share it comes to: "at 10%"
 * is true all along the curve, where a sum in pounds would only be true at one
 * income, and "+5%" would read as a relative rise.
 */
const whatIfLabel = (w: UkWhatIf): string => {
  switch (w.key) {
    case 'no-loan': return 'No student loan';
    case 'no-pension': return 'No pension';
    case 'more-pension': return `Pension at ${formatShare(w.input.pensionShare ?? 0)}`;
    case 'salary-sacrifice': return 'Pension by salary sacrifice';
  }
};

const TakeHomeSwatch = () => <span aria-hidden="true" className="h-0 w-4 shrink-0 border-t-2 border-chart-1" />;

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
      <p className="flex items-center justify-between gap-4 font-semibold">
        <span className="flex items-center gap-1.5"><TakeHomeSwatch />Take-home</span>
        <span className="tabular-nums">{percent(point.takeHome)}</span>
      </p>
      <ul className="mt-1 space-y-1">
        {DEDUCTIONS.filter(d => point[d.key] > 0).map(d => (
          // Indented by the swatch and its gap, so the labels line up under "Take-home".
          <li key={d.key} className="flex items-center justify-between gap-4 pl-[1.375rem]">
            <span className="text-muted-foreground">{d.label}</span>
            <span className="tabular-nums">{percent(point[d.key])}</span>
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
  const hasIncome = input.income > 0;
  const yours = useMemo(() => ukTakeHomeShareAt(input), [input]);
  const yoursWhatIf = useMemo(() => (whatIf ? ukTakeHomeShareAt(whatIf.input) : undefined), [whatIf]);
  const taken = DEDUCTIONS.filter(d => yours[d.key] > 0);

  return (
    <>
      <div className="mt-4 h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
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
            <YAxis
              domain={[0, 1]}
              ticks={Y_TICKS}
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip content={<ShareTooltip whatIfLabel={label} />} />
            {hasIncome && (
              <ReferenceLine
                x={input.income}
                stroke="hsl(var(--primary))"
                label={{ value: 'You', position: 'top', fontSize: 12, fill: 'hsl(var(--primary))' }}
              />
            )}
            <Line
              type="linear"
              dataKey="takeHome"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
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
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-mono">
          <li className="flex items-center gap-1.5">
            <TakeHomeSwatch />
            <span className="text-muted-foreground">Take-home</span>
            {hasIncome && <span className="font-semibold tabular-nums text-foreground">{percent(yours.takeHome)}</span>}
          </li>
          {hasIncome && taken.map(d => (
            <li key={d.key} className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{d.label}</span>
              <span className="tabular-nums text-foreground">{percent(yours[d.key])}</span>
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
          Figures beside the line are at your {formatWholeGBP(input.income)}; hover the line for any other income.
          Child benefit itself and childcare support are not pay, so they are left out.
          {taken.some(d => d.key === 'childBenefitCharge') && (
            <> The child benefit charge is paid through Self Assessment rather than from your payslip.</>
          )}
        </p>
      )}
    </>
  );
}

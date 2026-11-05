/**
 * What each salary keeps, across incomes, on one chart and one axis: the share
 * of salary kept as cash, and what the next pound loses to tax, NI, loans and
 * the child benefit charge. Both are percentages, so they share the axis; the
 * take-home in pounds, and what takes the rest, are in the tooltip at any
 * income rather than on a second axis. One what-if (no student loan, no
 * pension, a bigger pension, salary sacrifice) can be laid over the kept line
 * as a dashed line, so the effect of a choice reads as the gap between two.
 *
 * Every figure comes from `ukTaxCurve`, `ukTakeHomeShareCurve`,
 * `ukTakeHomeShareAt`, `ukMarginalRate` and `ukWhatIfs`, and the shading and
 * markers from the bands and cliffs the page passes in. The two curves are
 * joined on income; nothing here does arithmetic beyond the axis and a year
 * shown as a month.
 */

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatShare, formatWholeGBP } from '@/features/finance/utils/calculations';
import {
  ukMarginalRate,
  ukTakeHomeShareAt,
  ukTakeHomeShareCurve,
  ukTaxCurve,
  ukWhatIfs,
  type UkIncomeBand,
  type UkTakeHomeSharePoint,
  type UkTaxCliff,
  type UkTaxCurvePoint,
  type UkTaxInput,
  type UkWhatIf,
  type UkWhatIfKey,
} from '@/lib/finance';

type Deduction = Exclude<keyof UkTakeHomeSharePoint, 'income' | 'takeHome'>;

/** What takes the part not kept, in the order the tooltip and the legend list it. */
const DEDUCTIONS: { key: Deduction; label: string; inSentence: string }[] = [
  { key: 'pension', label: 'Pension', inSentence: 'pension' },
  { key: 'incomeTax', label: 'Income tax', inSentence: 'income tax' },
  { key: 'nationalInsurance', label: 'National Insurance', inSentence: 'National Insurance' },
  { key: 'studentLoan', label: 'Student loan', inSentence: 'student loan' },
  { key: 'childBenefitCharge', label: 'Child benefit charge', inSentence: 'the child benefit charge' },
];

/**
 * Kept follows take-home's colour everywhere on the page; the marginal rate is
 * a total of several deductions with no colour of its own, so it is ink. The
 * step shape and the end labels tell the two apart without colour.
 */
const KEPT = 'hsl(var(--positive))';
const LOST = 'hsl(var(--foreground))';

const axisTick = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' };
const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`;

type Point = UkTaxCurvePoint & {
  /** Where each pound goes here; absent at an income of 0, where a share is undefined. */
  share?: UkTakeHomeSharePoint;
  kept?: number;
  whatIf?: number;
};

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

const Swatch = ({ color, dashed = false }: { color: 'positive' | 'foreground'; dashed?: boolean }) => (
  <span
    aria-hidden="true"
    className={`h-0 w-4 shrink-0 border-t-2 ${dashed ? 'border-dashed' : ''} ${color === 'positive' ? 'border-positive' : 'border-foreground'}`}
  />
);

/** A line's name at its right-hand end, above or below it so the two names keep apart. */
const endLabel = (text: string, last: number, below: boolean) =>
  function EndLabel({ x, y, index }: { x?: number; y?: number; index?: number }) {
    if (index !== last || x === undefined || y === undefined) return null;
    return (
      <text x={x - 4} y={below ? y + 16 : y - 8} textAnchor="end" fontSize={12} fill="hsl(var(--muted-foreground))">
        {text}
      </text>
    );
  };

function CurveTooltip({ active, payload, whatIfLabel, showSupport }: {
  active?: boolean;
  payload?: { payload: Point }[];
  whatIfLabel?: string;
  showSupport: boolean;
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  const share = point.share;
  return (
    <div className="min-w-[220px] rounded-lg border border-border/60 bg-popover p-3 font-mono text-xs text-foreground shadow-xl">
      <p className="mb-2 border-b border-border/40 pb-2 font-semibold">{formatWholeGBP(point.income)} income</p>
      <p className="flex justify-between gap-4">
        <span className="text-muted-foreground">Take-home</span>
        <span className="tabular-nums">{formatWholeGBP(point.takeHome)} a year</span>
      </p>
      <p className="flex justify-end tabular-nums text-muted-foreground">{formatWholeGBP(point.takeHome / 12)} a month</p>
      {showSupport && (
        <p className="flex justify-between gap-4">
          <span className="text-muted-foreground">With childcare</span>
          <span className="tabular-nums">{formatWholeGBP(point.netWithSupport)}</span>
        </p>
      )}
      {share && (
        <>
          <p className="mt-2 flex items-center justify-between gap-4 font-semibold">
            <span className="flex items-center gap-1.5"><Swatch color="positive" />Kept</span>
            <span className="tabular-nums">{percent(share.takeHome)}</span>
          </p>
          <ul className="mt-1 space-y-1">
            {DEDUCTIONS.filter(d => share[d.key] > 0).map(d => (
              // Indented by the swatch and its gap, so the labels line up under "Kept".
              <li key={d.key} className="flex items-center justify-between gap-4 pl-[1.375rem]">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="tabular-nums">{percent(share[d.key])}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-2 flex items-center justify-between gap-4 font-semibold">
        <span className="flex items-center gap-1.5"><Swatch color="foreground" />Next pound loses</span>
        <span className="tabular-nums">{percent(point.marginalRate)}</span>
      </p>
      {whatIfLabel && point.whatIf !== undefined && (
        <p className="mt-2 flex items-center justify-between gap-4 border-t border-border/40 pt-2">
          <span className="flex items-center gap-1.5 text-muted-foreground"><Swatch color="positive" dashed />{whatIfLabel}</span>
          <span className="tabular-nums">{percent(point.whatIf)} kept</span>
        </p>
      )}
    </div>
  );
}

export function TaxCurveChart({ input, chartMax, step, xTicks, highlighted, childBenefitBand, cliffs }: {
  input: UkTaxInput;
  chartMax: number;
  step: number;
  xTicks: number[];
  /** The step the list below is pointing at, shaded on the chart. */
  highlighted?: UkIncomeBand;
  /** Limited by the page to one that starts inside the plotted range. */
  childBenefitBand: UkIncomeBand | null;
  /** Limited by the page to the plotted range. */
  cliffs: UkTaxCliff[];
}) {
  const [whatIfKey, setWhatIfKey] = useState<UkWhatIfKey | 'none'>('none');
  const options = useMemo(() => ukWhatIfs(input), [input]);
  // An option can vanish when the inputs change (no loan left to remove).
  const whatIf = options.find(o => o.key === whatIfKey);
  const label = whatIf ? whatIfLabel(whatIf) : undefined;

  const curve = useMemo(() => ukTaxCurve(input, { maxIncome: chartMax, step }), [input, chartMax, step]);
  const shares = useMemo(() => ukTakeHomeShareCurve(input, { maxIncome: chartMax, step }), [input, chartMax, step]);
  const whatIfShares = useMemo(
    () => (whatIf ? ukTakeHomeShareCurve(whatIf.input, { maxIncome: chartMax, step }) : []),
    [whatIf, chartMax, step],
  );
  // Both curves visit the same incomes, so they join on income exactly.
  const data = useMemo<Point[]>(() => {
    const byIncome = new Map(shares.map(p => [p.income, p]));
    const whatIfByIncome = new Map(whatIfShares.map(p => [p.income, p.takeHome]));
    return curve.map(p => {
      const share = byIncome.get(p.income);
      return { ...p, share, kept: share?.takeHome, whatIf: whatIfByIncome.get(p.income) };
    });
  }, [curve, shares, whatIfShares]);

  const hasIncome = input.income > 0;
  const showSupport = input.childcareSupport > 0;
  const yours = useMemo(() => ukTakeHomeShareAt(input), [input]);
  const yoursMarginal = useMemo(() => ukMarginalRate(input), [input]);
  const yoursWhatIf = useMemo(() => (whatIf ? ukTakeHomeShareAt(whatIf.input) : undefined), [whatIf]);
  const taken = DEDUCTIONS.filter(d => yours[d.key] > 0);

  // Round 20% steps, up to 100% for the kept line and past it only if a
  // marginal rate goes higher (many children under the charge can).
  const yTop = Math.max(1, Math.ceil(curve.reduce((top, p) => Math.max(top, p.marginalRate), 0) * 5) / 5);
  const yTicks = Array.from({ length: Math.round(yTop / 0.2) + 1 }, (_, i) => i * 0.2);
  const last = data.length - 1;
  const keptEnd = data[last]?.kept ?? 0;
  const lostEnd = data[last]?.marginalRate ?? 0;

  return (
    <>
      <div className="mt-4 h-64 w-full sm:h-80">
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
              domain={[0, yTop]}
              ticks={yTicks}
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip content={<CurveTooltip whatIfLabel={label} showSupport={showSupport} />} />
            {/* Named in the legend below rather than on the plot: inline labels
                collide with each other and with "You" on a phone. */}
            {childBenefitBand && (
              <ReferenceArea
                x1={childBenefitBand.from}
                x2={Math.min(childBenefitBand.to, chartMax)}
                ifOverflow="hidden"
                fill="hsl(var(--chart-4))"
                fillOpacity={0.15}
              />
            )}
            {highlighted && (
              <ReferenceArea
                x1={highlighted.from}
                x2={highlighted.to}
                ifOverflow="hidden"
                fill="hsl(var(--chart-1))"
                fillOpacity={0.18}
              />
            )}
            {cliffs.map(c => (
              <ReferenceLine key={c.kind} x={c.atIncome} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
            ))}
            {hasIncome && (
              <ReferenceLine
                x={input.income}
                stroke="hsl(var(--primary))"
                label={{ value: 'You', position: 'top', fontSize: 12, fill: 'hsl(var(--primary))' }}
              />
            )}
            <Line
              type="linear"
              dataKey="kept"
              name="Kept"
              stroke={KEPT}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              label={endLabel('Kept', last, keptEnd < lostEnd)}
            />
            <Line
              type="stepAfter"
              dataKey="marginalRate"
              name="Next pound loses"
              stroke={LOST}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              label={endLabel('Next £1 loses', last, lostEnd <= keptEnd)}
            />
            {whatIf && (
              <Line
                type="linear"
                dataKey="whatIf"
                name={label}
                stroke={KEPT}
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
            <Swatch color="positive" />
            <span className="text-muted-foreground">Share of salary kept</span>
            {hasIncome && <span className="font-semibold tabular-nums text-foreground">{percent(yours.takeHome)}</span>}
          </li>
          <li className="flex items-center gap-1.5">
            <Swatch color="foreground" />
            <span className="text-muted-foreground">Next pound loses</span>
            {hasIncome && <span className="font-semibold tabular-nums text-foreground">{percent(yoursMarginal)}</span>}
          </li>
          {whatIf && (
            <li className="flex items-center gap-1.5">
              <Swatch color="positive" dashed />
              <span className="text-muted-foreground">{label}</span>
              {hasIncome && yoursWhatIf && <span className="font-semibold tabular-nums text-foreground">{percent(yoursWhatIf.takeHome)} kept</span>}
            </li>
          )}
          {childBenefitBand && (
            <li className="flex items-center gap-1.5 text-muted-foreground">
              <span aria-hidden="true" className="h-3 w-3 rounded-sm bg-chart-4/15" />
              Child benefit clawback
            </li>
          )}
          {cliffs.map(c => (
            <li key={c.kind} className="flex items-center gap-1.5 text-muted-foreground">
              <span aria-hidden="true" className="h-3 w-0 border-l-2 border-dashed border-destructive" />
              {c.kind === 'childcare' ? 'Childcare lost' : 'Marriage allowance lost'}
            </li>
          ))}
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
      <p className="mt-3 text-xs text-muted-foreground">
        {hasIncome && taken.length > 0 && (
          <>At your {formatWholeGBP(input.income)} the rest goes to {taken.map(d => `${d.inSentence} ${percent(yours[d.key])}`).join(', ')}. </>
        )}
        Hover the chart for take-home in pounds at any income. Child benefit itself and childcare support are not pay,
        so the share kept leaves them out.
        {taken.some(d => d.key === 'childBenefitCharge') && (
          <> The child benefit charge is paid through Self Assessment rather than from your payslip.</>
        )}
      </p>
    </>
  );
}

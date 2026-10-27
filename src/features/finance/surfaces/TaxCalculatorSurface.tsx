/**
 * Tax Calculator — what any income takes home, and what the next pound keeps.
 *
 * Every figure comes from `calculateUkTax`, `ukMarginalRate`, `ukTaxCliffs` and
 * `ukTaxCurve`, which are pure and tested. The fields start from your own
 * settings and stay a what-if: editing one never writes back, because a
 * calculator that quietly changes your payroll is not a calculator.
 *
 * While finance figures are hidden the salary is not seeded. Painting over the
 * £ text is not enough here: the "You" marker on a fixed £0-£200k axis, the
 * slider thumb and the effective rate would each read it back.
 */

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Calculator, RotateCcw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { formatGBP } from '@/features/finance/utils/calculations';
import {
  UK_CHILD_BENEFIT_WEEKS,
  UK_TAX_YEAR_LABEL,
  calculateUkTax,
  ukMarginalRate,
  ukTaxCliffs,
  ukTaxCurve,
  type UkIncomeKind,
  type UkPensionMethod,
  type UkTaxInput,
  type UkTaxRegion,
  type UkUndergradPlan,
} from '@/lib/finance';
import { cn } from '@/lib/utils';
import { useFinanceData } from '../FinanceDataContext';
import type { FinanceSettings } from '../finance-types';
import { PillSwitch } from '../components/PillSwitch';
import { SurfaceHero } from '../components/SurfaceHero';

/** The form as typed. Amounts stay strings so a half-typed number survives. */
interface Draft {
  income: string;
  kind: UkIncomeKind;
  region: UkTaxRegion;
  benefitsInKind: string;
  pensionContribution: string;
  pensionMethod: UkPensionMethod;
  undergradPlan: UkUndergradPlan;
  postgradLoan: boolean;
  children: string;
  childcareSupport: string;
  marriageAllowance: boolean;
}

type ChartMode = 'marginal' | 'net';

const SLIDER_MAX = 250_000;
const CHART_POINTS = 400;
const X_TICK_STEPS = [25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];

const KINDS = [
  { key: 'employed', label: 'Employed' },
  { key: 'self-employed', label: 'Self-employed' },
] as const satisfies readonly { key: UkIncomeKind; label: string }[];

const REGIONS = [
  { key: 'rUK', label: 'England, Wales & NI' },
  { key: 'scotland', label: 'Scotland' },
] as const satisfies readonly { key: UkTaxRegion; label: string }[];

const CHART_MODES = [
  { key: 'marginal', label: 'Marginal rate' },
  { key: 'net', label: 'Take-home' },
] as const satisfies readonly { key: ChartMode; label: string }[];

const PENSION_METHODS: { key: UkPensionMethod; label: string }[] = [
  { key: 'salary-sacrifice', label: 'Salary sacrifice' },
  { key: 'net-pay', label: 'Net pay' },
  { key: 'relief-at-source', label: 'Relief at source' },
];

const UNDERGRAD_PLANS: { key: UkUndergradPlan; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'plan1', label: 'Plan 1' },
  { key: 'plan2', label: 'Plan 2' },
  { key: 'plan4', label: 'Plan 4 (Scotland)' },
  { key: 'plan5', label: 'Plan 5' },
];

const CHILDCARE_STEPS = Array.from({ length: 9 }, (_, i) => i * 2_500);

const PENSION_FROM_SETTINGS: Record<FinanceSettings['pensionType'], UkPensionMethod> = {
  salary_sacrifice: 'salary-sacrifice',
  net_pay: 'net-pay',
  relief_at_source: 'relief-at-source',
};

const wholeGBP = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`;

/** A typed amount as pounds. Anything unreadable is nothing, not an error. */
const amount = (text: string) => {
  const n = Number(text.replace(/[£,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const draftFromSettings = (
  /** Zero while figures are hidden, so nothing on the page is your salary. */
  grossSalary: number,
  ukRegion: FinanceSettings['ukRegion'],
  pensionType: FinanceSettings['pensionType'],
  personalPensionPercent: number,
  studentLoanPlan: FinanceSettings['studentLoanPlan'],
): Draft => ({
  income: grossSalary > 0 ? String(Math.round(grossSalary)) : '',
  kind: 'employed',
  region: ukRegion === 'scotland' ? 'scotland' : 'rUK',
  benefitsInKind: '',
  // The settings hold a percentage of salary, read here as the gross amount
  // paid in. Tax & Income deducts that amount in full and models no relief at
  // source or Scottish bands, so for those profiles the two pages differ
  // (REHAUL_PLAN.md 8.H).
  pensionContribution: personalPensionPercent > 0
    ? String(Math.round(grossSalary * personalPensionPercent / 100))
    : '',
  pensionMethod: PENSION_FROM_SETTINGS[pensionType] ?? 'salary-sacrifice',
  undergradPlan: studentLoanPlan === 'postgrad' ? 'none' : studentLoanPlan,
  postgradLoan: studentLoanPlan === 'postgrad',
  children: '',
  childcareSupport: '0',
  marriageAllowance: false,
});

const tooltipStyle = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 'var(--radius)',
  fontSize: 12,
};
const axisTick = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' };

export default function TaxCalculatorSurface({ figuresHidden }: { figuresHidden: boolean }) {
  const { settings, hasLoaded } = useFinanceData();

  // The seed follows your settings until you change a field; an edited field
  // is an override and wins until Reset. Pulled out as primitives so a refetch
  // that returns the same values does not rebuild the seed.
  const grossSalary = figuresHidden ? 0 : settings.grossSalary ?? 0;
  const ukRegion = settings.ukRegion;
  const pensionType = settings.pensionType;
  const personalPensionPercent = settings.personalPensionPercent ?? 0;
  const studentLoanPlan = settings.studentLoanPlan;
  const seed = useMemo(
    () => draftFromSettings(grossSalary, ukRegion, pensionType, personalPensionPercent, studentLoanPlan),
    [grossSalary, ukRegion, pensionType, personalPensionPercent, studentLoanPlan],
  );
  const [overrides, setOverrides] = useState<Partial<Draft>>({});
  const [chartMode, setChartMode] = useState<ChartMode>('marginal');

  const draft = useMemo<Draft>(() => ({ ...seed, ...overrides }), [seed, overrides]);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setOverrides(prev => ({ ...prev, [key]: value }));
  const edited = Object.keys(overrides).length > 0;

  const employed = draft.kind === 'employed';
  // Salary sacrifice and net pay are payroll arrangements, so a self-employed
  // profit only has relief at source. The engine applies the same rule.
  const pensionMethod: UkPensionMethod = employed ? draft.pensionMethod : 'relief-at-source';

  const input = useMemo<UkTaxInput>(() => ({
    income: amount(draft.income),
    kind: draft.kind,
    region: draft.region,
    benefitsInKind: amount(draft.benefitsInKind),
    pensionContribution: amount(draft.pensionContribution),
    pensionMethod: draft.pensionMethod,
    undergradPlan: draft.undergradPlan,
    postgradLoan: draft.postgradLoan,
    children: Math.floor(amount(draft.children)),
    childcareSupport: amount(draft.childcareSupport),
    marriageAllowance: draft.marriageAllowance,
  }), [draft]);

  const result = useMemo(() => calculateUkTax(input), [input]);
  const marginal = useMemo(() => ukMarginalRate(input), [input]);
  const cliffs = useMemo(() => ukTaxCliffs(input), [input]);

  // Wide enough to show the 60% band and what lies past it, and always a
  // quarter beyond the income typed so the marker never sits on the edge.
  const chartMax = Math.max(200_000, Math.ceil((input.income * 1.25) / 10_000) * 10_000);
  const curve = useMemo(
    () => ukTaxCurve(input, { maxIncome: chartMax, step: chartMax / CHART_POINTS }),
    [input, chartMax],
  );
  // Round steps on both axes: recharts' own picks land on £35k and 70%.
  const xStep = X_TICK_STEPS.find(s => chartMax / s <= 8) ?? chartMax / 8;
  const xTicks = Array.from({ length: Math.floor(chartMax / xStep) + 1 }, (_, i) => i * xStep);
  const yTop = Math.max(0.6, Math.ceil(curve.reduce((top, p) => Math.max(top, p.marginalRate), 0) * 5) / 5);
  const yTicks = Array.from({ length: Math.round(yTop / 0.2) + 1 }, (_, i) => i * 0.2);
  const showSupport = input.childcareSupport > 0;

  const taperGap = result.aboveTaperStart;
  const inTaper = taperGap > 0 && result.personalAllowance > 0;
  const nearTaper = taperGap <= 0 && taperGap > -10_000;
  const inChildBenefitBand = input.children > 0 && result.childBenefitCharge > 0
    && result.aboveChildBenefitStart < 20_000;

  const rows: {
    key: string;
    label: string;
    note?: string;
    value: number;
    sign?: '+' | '-';
    tone?: string;
    kind?: 'result';
  }[] = [
    {
      key: 'income',
      label: employed ? 'Salary' : 'Taxable profit',
      value: input.income,
    },
    ...(employed && input.benefitsInKind > 0 ? [{
      key: 'bik',
      label: 'Benefits in kind',
      note: 'Taxed, but not paid to you, so not in take-home.',
      value: input.benefitsInKind,
      tone: 'text-muted-foreground',
    }] : []),
    ...(result.pensionFromPay > 0 ? [{
      key: 'pension',
      label: 'Pension',
      note: pensionMethod === 'relief-at-source'
        ? `You pay ${wholeGBP(result.pensionFromPay)}; the provider claims basic-rate relief on top.`
        : pensionMethod === 'net-pay'
          ? 'Taken before income tax, after National Insurance.'
          : 'Taken before income tax and National Insurance.',
      value: result.pensionFromPay,
      sign: '-' as const,
    }] : []),
    {
      key: 'tax',
      label: 'Income tax',
      note: `${wholeGBP(result.personalAllowance)} personal allowance`
        + (result.marriageAllowanceRelief > 0 ? `, ${wholeGBP(result.marriageAllowanceRelief)} marriage allowance relief` : '')
        + '.',
      value: result.incomeTax,
      sign: '-',
      tone: 'text-destructive',
    },
    {
      key: 'ni',
      label: 'National Insurance',
      note: employed ? 'Class 1, employee.' : 'Class 4, on profits.',
      value: result.nationalInsurance,
      sign: '-',
      tone: 'text-destructive',
    },
    ...(input.undergradPlan !== 'none' ? [{
      key: 'sl',
      label: 'Student loan',
      note: UNDERGRAD_PLANS.find(p => p.key === input.undergradPlan)?.label,
      value: result.studentLoan,
      sign: '-' as const,
      tone: 'text-destructive',
    }] : []),
    ...(input.postgradLoan ? [{
      key: 'pgl',
      label: 'Postgraduate loan',
      value: result.postgradLoan,
      sign: '-' as const,
      tone: 'text-destructive',
    }] : []),
    ...(input.children > 0 ? [
      {
        key: 'cb',
        label: 'Child benefit',
        note: `${input.children} ${input.children === 1 ? 'child' : 'children'}, ${UK_CHILD_BENEFIT_WEEKS} weeks.`,
        value: result.childBenefit,
        sign: '+' as const,
        tone: 'text-positive',
      },
      {
        key: 'hicbc',
        label: 'Child benefit charge',
        note: 'High Income Child Benefit Charge, paid through Self Assessment.',
        value: result.childBenefitCharge,
        sign: '-' as const,
        tone: 'text-destructive',
      },
    ] : []),
    {
      key: 'take-home',
      label: 'Take-home',
      value: result.takeHome,
      tone: 'text-positive',
      kind: 'result',
    },
    ...(showSupport ? [{
      key: 'support',
      label: 'With childcare support',
      note: result.childcareSupportKept > 0
        ? input.region === 'scotland'
          ? 'Tax-Free Childcare, as entered. Scotland\'s funded hours are not income-tested, so leave them out.'
          : 'Funded hours and Tax-Free Childcare, as entered.'
        : 'Lost: adjusted net income is over £100,000.',
      value: result.netWithSupport,
      tone: 'text-positive',
      kind: 'result' as const,
    }] : []),
  ];

  const field = (id: string, label: string, key: 'income' | 'benefitsInKind' | 'pensionContribution' | 'children', count = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        {!count && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
        )}
        <Input
          id={id}
          inputMode={count ? 'numeric' : 'decimal'}
          value={draft[key]}
          placeholder="0"
          onChange={e => set(key, e.target.value)}
          className={cn('h-9 font-mono text-sm tabular-nums', !count && 'pl-7')}
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      {/* The answer first: what this income takes home, and what the next
          pound keeps, because the second is the number no payslip shows. */}
      <SurfaceHero
        label="Take-home"
        value={formatGBP(result.takeHome)}
        loading={!hasLoaded}
        detail={<>
          On {formatGBP(input.income)}{employed && input.benefitsInKind > 0 ? ' plus benefits' : ''},{' '}
          {formatGBP(result.takeHome / 12)} a month, {UK_TAX_YEAR_LABEL} rules.
        </>}
        aside={
        <dl className="grid grid-cols-3 gap-4 sm:gap-8">
          <div>
            <dt className="text-xs font-mono uppercase text-muted-foreground">Effective</dt>
            <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">{percent(result.effectiveRate)}</dd>
          </div>
          <div>
            <dt className="text-xs font-mono uppercase text-muted-foreground">Marginal</dt>
            <dd className={cn('mt-1 font-mono text-lg font-bold tabular-nums', marginal >= 0.5 ? 'text-destructive' : 'text-foreground')}>
              {percent(marginal)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-mono uppercase text-muted-foreground">Next pound kept</dt>
            <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">{Math.round(100 * (1 - marginal))}p</dd>
          </div>
        </dl>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Inputs */}
        <section aria-labelledby="taxcalc-inputs" className="surface-card rounded-lg border border-border/40 bg-card/50 p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <h3 id="taxcalc-inputs" className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary shrink-0" /> Your circumstances
            </h3>
            {edited && (
              <Button variant="ghost" size="sm" className="h-7 -mt-1 gap-1.5 text-xs" onClick={() => setOverrides({})}>
                <RotateCcw className="h-3.5 w-3.5" /> My settings
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {field('taxcalc-income', employed ? 'Gross salary' : 'Taxable profit', 'income')}
            <Slider
              aria-label={employed ? 'Gross salary' : 'Taxable profit'}
              aria-valuetext={formatGBP(input.income)}
              min={0}
              max={SLIDER_MAX}
              step={500}
              value={[Math.min(input.income, SLIDER_MAX)]}
              onValueChange={([v]) => set('income', String(v))}
            />
            {figuresHidden && overrides.income === undefined && (
              <p className="text-xs text-muted-foreground">
                Figures are hidden, so this starts empty. Show figures to start from your salary.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="space-y-1.5">
              <span className="block text-xs text-muted-foreground">Paid as</span>
              <PillSwitch label="Paid as" options={KINDS} value={draft.kind} onChange={v => set('kind', v)} />
            </div>
            <div className="space-y-1.5">
              <span className="block text-xs text-muted-foreground">Where you live</span>
              <PillSwitch label="Where you live" options={REGIONS} value={draft.region} onChange={v => set('region', v)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {field('taxcalc-pension', 'Pension contribution (gross, a year)', 'pensionContribution')}
            <div className="space-y-1.5">
              <Label htmlFor="taxcalc-pension-method" className="text-xs text-muted-foreground">Paid by</Label>
              <Select
                value={pensionMethod}
                onValueChange={v => set('pensionMethod', v as UkPensionMethod)}
                disabled={!employed}
              >
                <SelectTrigger id="taxcalc-pension-method" className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PENSION_METHODS.map(m => (
                    <SelectItem key={m.key} value={m.key} className="text-sm">{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="taxcalc-plan" className="text-xs text-muted-foreground">Student loan</Label>
              <Select value={draft.undergradPlan} onValueChange={v => set('undergradPlan', v as UkUndergradPlan)}>
                <SelectTrigger id="taxcalc-plan" className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNDERGRAD_PLANS.map(p => (
                    <SelectItem key={p.key} value={p.key} className="text-sm">{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3 sm:pt-6">
              <Label htmlFor="taxcalc-postgrad" className="text-xs text-muted-foreground">Postgraduate loan</Label>
              <Switch id="taxcalc-postgrad" checked={draft.postgradLoan} onCheckedChange={v => set('postgradLoan', v)} />
            </div>
          </div>

          {employed && field('taxcalc-bik', 'Benefits in kind (company car, medical cover)', 'benefitsInKind')}

          <div className="grid gap-4 sm:grid-cols-2">
            {field('taxcalc-children', 'Children claiming child benefit', 'children', true)}
            <div className="space-y-1.5">
              <Label htmlFor="taxcalc-childcare" className="text-xs text-muted-foreground">Childcare support a year</Label>
              <Select value={draft.childcareSupport} onValueChange={v => set('childcareSupport', v)}>
                <SelectTrigger id="taxcalc-childcare" className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHILDCARE_STEPS.map(n => (
                    <SelectItem key={n} value={String(n)} className="text-sm">{n === 0 ? 'None' : wholeGBP(n)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="taxcalc-marriage" className="text-xs text-muted-foreground">
              Receives marriage allowance from a partner
            </Label>
            <Switch id="taxcalc-marriage" checked={draft.marriageAllowance} onCheckedChange={v => set('marriageAllowance', v)} />
          </div>
        </section>

        {/* Breakdown */}
        <section aria-labelledby="taxcalc-breakdown" className="surface-card rounded-lg border border-border/40 bg-card/50 p-5 sm:p-6">
          <h3 id="taxcalc-breakdown" className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground">
            Where it goes
          </h3>
          <table className="mt-4 w-full text-sm">
            <caption className="sr-only">Annual and monthly breakdown</caption>
            <thead>
              <tr className="border-b border-border/50 text-xs text-muted-foreground">
                <th scope="col" className="pb-2.5 pr-4 text-left font-normal"><span className="sr-only">Item</span></th>
                <th scope="col" className="pb-2.5 pl-4 text-right font-normal">Year</th>
                <th scope="col" className="pb-2.5 pl-4 text-right font-normal">Month</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const cell = cn('py-2 align-top', i === 0 && 'pt-3', row.kind === 'result' && 'pt-4 text-base');
                return (
                  <tr key={row.key} className={cn(row.kind === 'result' && 'border-t border-border/70')}>
                    <th scope="row" className={cn(cell, 'pr-4 text-left text-foreground', row.kind ? 'font-semibold' : 'font-normal')}>
                      {row.label}
                      {row.note && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{row.note}</span>}
                    </th>
                    {[row.value, row.value / 12].map((v, j) => (
                      <td
                        key={j}
                        className={cn(cell, 'pl-4 text-right font-mono tabular-nums whitespace-nowrap', row.tone ?? 'text-foreground', row.kind && 'font-semibold')}
                      >
                        {row.sign}{formatGBP(v)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Only the pointers that apply. Each is arithmetic on the breakdown
              above, worded; none of it is advice. */}
          {(inTaper || nearTaper || inChildBenefitBand || cliffs.length > 0) && (
            <ul className="mt-6 space-y-2 border-t border-border/40 pt-4 text-xs text-muted-foreground">
              {inTaper && (
                <li>
                  Adjusted net income is {formatGBP(taperGap)} over £100,000, so the personal allowance is being withdrawn.
                  A further {formatGBP(taperGap)} of pension contribution would restore it in full.
                </li>
              )}
              {nearTaper && (
                <li>{formatGBP(-taperGap)} more adjusted net income before the personal allowance starts to go.</li>
              )}
              {inChildBenefitBand && (
                <li>
                  The child benefit charge takes {formatGBP(result.childBenefitCharge)}. Bringing adjusted net income
                  down by {formatGBP(result.aboveChildBenefitStart)} would clear it.
                </li>
              )}
              {cliffs.map(c => (
                <li key={c.kind}>
                  {c.kind === 'childcare'
                    ? <>Above {formatGBP(c.atIncome)} the childcare support goes at once: one pound more costs {formatGBP(c.cost)}.</>
                    : <>Above {formatGBP(c.atIncome)} the marriage allowance stops: one pound more costs {formatGBP(c.cost)}.</>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Chart */}
      <section aria-labelledby="taxcalc-chart" className="surface-card rounded-lg border border-border/40 bg-card/50 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1 min-w-0">
            <h3 id="taxcalc-chart" className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary shrink-0" />
              {chartMode === 'marginal' ? 'What the next pound loses' : 'Take-home against income'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {chartMode === 'marginal'
                ? 'Income tax, National Insurance, student loans and the child benefit charge on each extra pound, everything else held as entered.'
                : `Pay after every deduction, everything else held as entered. The dashed line is gross income${showSupport ? '; the upper solid line adds the childcare support' : ''}.`}
            </p>
          </div>
          <PillSwitch label="Chart" options={CHART_MODES} value={chartMode} onChange={setChartMode} className="shrink-0 self-start" />
        </div>

        <div className="mt-4 h-64 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curve} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
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
              {chartMode === 'marginal' ? (
                <YAxis
                  domain={[0, yTop]}
                  ticks={yTicks}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
              ) : (
                <YAxis
                  tickFormatter={(v: number) => `£${Math.round(v / 1000)}k`}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
              )}
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(v: number) => `${wholeGBP(v)} income`}
                formatter={(v: number, name: string) => chartMode === 'marginal'
                  ? [percent(v), 'Marginal rate']
                  : [formatGBP(v), name]}
              />
              {cliffs.map(c => (
                <ReferenceLine
                  key={c.kind}
                  x={c.atIncome}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="4 4"
                  label={{ value: c.kind === 'childcare' ? 'Childcare' : 'Marriage', position: 'insideTopLeft', fontSize: 12, fill: 'hsl(var(--destructive))' }}
                />
              ))}
              <ReferenceLine
                x={input.income}
                stroke="hsl(var(--primary))"
                label={{ value: 'You', position: 'top', fontSize: 12, fill: 'hsl(var(--primary))' }}
              />
              {chartMode === 'marginal' ? (
                <Line
                  type="stepAfter"
                  dataKey="marginalRate"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ) : (
                <>
                  <Line
                    type="linear"
                    dataKey="income"
                    name="Gross"
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="takeHome"
                    name="Take-home"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  {showSupport && (
                    <Line
                      type="linear"
                      dataKey="netWithSupport"
                      name="With childcare"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-2 border-t border-border/40 pt-6 text-xs text-muted-foreground">
        <p className="font-sans uppercase tracking-wider">Assumptions</p>
        <p>
          {UK_TAX_YEAR_LABEL} rates for England, Wales and Northern Ireland, or Scotland. Annual figures:
          payroll spreads them over pay periods, so a payslip can differ by a few pence.
        </p>
        <p>
          The marginal rate treats the allowance taper and child benefit charge as smooth, so the line
          does not saw-tooth every £2 or £200; the amounts above use the exact rules. Cliffs, where one
          pound loses a lump sum, are marked separately.
        </p>
        <p>
          Not modelled: savings, dividends, rent and gains; the pension annual allowance; employer
          National Insurance; Universal Credit and other benefits; a partner&apos;s income.
          Childcare eligibility, including its minimum-earnings test, is not checked: the support
          entered counts at any income up to £100,000 of adjusted net income.
        </p>
        <p>
          Your pension percentage from settings is read as the gross contribution. Child benefit
          counts {UK_CHILD_BENEFIT_WEEKS} weeks, the Mondays in the {UK_TAX_YEAR_LABEL} tax year.
        </p>
        <p>
          Rules follow the{' '}
          <a
            href="https://taxpolicy.org.uk/uk-tax-calculator/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Tax Policy Associates UK tax calculator
          </a>
          , checked against GOV.UK rates. Nothing here is sent anywhere.
        </p>
      </section>
    </div>
  );
}

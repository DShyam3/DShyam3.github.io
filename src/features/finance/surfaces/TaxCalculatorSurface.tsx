/**
 * Tax Calculator — what any income takes home, and what the next pound keeps.
 *
 * Every figure comes from `calculateUkTax`, `ukMarginalRate`, `ukTaxCliffs`,
 * `ukTaxCurve`, `ukMarginalBands` and `ukTakeHomeShareCurve`, which are pure
 * and tested. It opens on Standard, `UK_STANDARD_TAX_INPUT` with a salary to
 * type: what anyone on the ordinary terms keeps. Yours starts from your own
 * settings instead. Both stay a what-if: editing a field never writes back,
 * because a calculator that quietly changes your payroll is not a calculator.
 *
 * While finance figures are hidden Yours seeds no salary. Painting over the
 * £ text is not enough here: the "You" marker on a fixed £0-£200k axis, the
 * slider thumb and the effective rate would each read it back.
 */

import { useMemo, useState } from 'react';
import { Calculator, RotateCcw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { formatGBP, formatShare, formatWholeGBP } from '@/features/finance/utils/calculations';
import {
  UK_AUTO_ENROLMENT,
  UK_CHILDCARE_CUTOFF,
  UK_CHILD_BENEFIT_CHARGE_END,
  UK_CHILD_BENEFIT_CHARGE_START,
  UK_CHILD_BENEFIT_CHARGE_STEP,
  UK_CHILD_BENEFIT_WEEKS,
  UK_STANDARD_TAX_INPUT,
  UK_TAX_YEAR_LABEL,
  calculateUkTax,
  ukChildBenefitBand,
  ukMarginalBands,
  ukMarginalRate,
  ukNextPound,
  ukTaxCliffs,
  type UkIncomeKind,
  type UkPensionBasis,
  type UkPensionMethod,
  type UkTaxInput,
  type UkTaxRegion,
  type UkUndergradPlan,
} from '@/lib/finance';
import { cn } from '@/lib/utils';
import { useFinanceData } from '../FinanceDataContext';
import { useFinanceTotals } from '../useFinanceTotals';
import { MarginalSteps } from '../components/MarginalSteps';
import { PillSwitch } from '../components/PillSwitch';
import { SurfaceHero } from '../components/SurfaceHero';
import { TaxCurveChart } from '../components/TaxCurveChart';
import { TakeHomeSlices } from '../components/TakeHomeSlices';

/** The form as typed. Amounts stay strings so a half-typed number survives. */
interface Draft {
  income: string;
  kind: UkIncomeKind;
  region: UkTaxRegion;
  benefitsInKind: string;
  /** Empty means the statutory allowance; settings fill it from the tax code. */
  personalAllowance: string;
  /** Gross percent of `pensionBasis`, so it moves with income across the charts. */
  pensionPercent: string;
  pensionBasis: UkPensionBasis;
  pensionMethod: UkPensionMethod;
  undergradPlan: UkUndergradPlan;
  postgradLoan: boolean;
  children: string;
  childcareSupport: string;
  marriageAllowance: boolean;
}

type Profile = 'standard' | 'yours';

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

const PROFILES = [
  { key: 'standard', label: 'Standard' },
  { key: 'yours', label: 'Yours' },
] as const satisfies readonly { key: Profile; label: string }[];

/** What every chart holds still while income moves along it. */
const HELD_AS_ENTERED = 'The pension is worked out afresh at each income; everything else is held as entered.';

/** `inSentence` finishes "the pension is paid …" in Standard's description. */
const PENSION_METHODS: { key: UkPensionMethod; label: string; inSentence: string }[] = [
  { key: 'salary-sacrifice', label: 'Salary sacrifice', inSentence: 'by salary sacrifice' },
  { key: 'net-pay', label: 'Net pay', inSentence: 'through net pay' },
  { key: 'relief-at-source', label: 'Relief at source', inSentence: 'by relief at source' },
];

const UNDERGRAD_PLANS: { key: UkUndergradPlan; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'plan1', label: 'Plan 1' },
  { key: 'plan2', label: 'Plan 2' },
  { key: 'plan4', label: 'Plan 4 (Scotland)' },
  { key: 'plan5', label: 'Plan 5' },
];

const CHILDCARE_STEPS = Array.from({ length: 9 }, (_, i) => i * 2_500);

const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`;

/**
 * A typed allowance. Empty or unreadable is the statutory one, never zero: a
 * typo must not silently become a code that taxes every pound.
 */
const allowanceFrom = (text: string): number | undefined => {
  const n = Number(text.replace(/[£,\s]/g, ''));
  return text.trim() === '' || !Number.isFinite(n) || n < 0 ? undefined : n;
};

/** A typed amount as pounds. Anything unreadable is nothing, not an error. */
const amount = (text: string) => {
  const n = Number(text.replace(/[£,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** A typed percentage as the share the engine takes, "5" or "5%" as 0.05. */
const shareFrom = (text: string) => amount(text.replace('%', '')) / 100;

/** Pounds as a field shows them: whole pounds without a trailing ".00". */
const asField = (n: number) => (n > 0 ? String(Math.round(n * 100) / 100) : '');

/**
 * A share as the percentage field shows it, exact but for float noise, so
 * 5.125% in settings seeds 5.125 and Yours agrees with Tax & Income.
 */
const asPercentField = (share: number) => (share > 0 ? String(Number((share * 100).toPrecision(12))) : '');

/**
 * The form an engine input fills: the standard case, or your settings through
 * the same input Tax & Income computes with, so the two pages agree. The
 * pension is a gross percentage. Benefits in kind are added unless the tax
 * code already collects their tax, as Tax & Income does. The pension's fixed
 * sum is not a field, and neither input carries one.
 */
const draftFrom = (base: UkTaxInput): Draft => ({
  income: asField(base.income),
  kind: 'employed',
  region: base.region,
  benefitsInKind: asField(base.benefitsInKind),
  personalAllowance: base.personalAllowance === undefined ? '' : String(base.personalAllowance),
  pensionPercent: asPercentField(base.pensionShare ?? 0),
  pensionBasis: base.pensionBasis ?? 'salary',
  pensionMethod: base.pensionMethod,
  undergradPlan: base.undergradPlan,
  postgradLoan: base.postgradLoan,
  children: '',
  childcareSupport: '0',
  marriageAllowance: false,
});

/** Standard opens with no salary: there is nobody's to start from. */
const STANDARD_DRAFT = draftFrom(UK_STANDARD_TAX_INPUT);

export default function TaxCalculatorSurface({ figuresHidden }: { figuresHidden: boolean }) {
  const { hasLoaded } = useFinanceData();

  // Yours follows your settings until you change a field; an edited field is
  // an override and wins until Reset. Each view keeps its own edits, so
  // switching between them loses neither. While figures are hidden nothing is
  // seeded from settings: the salary, its pension and benefits, and the
  // tax-code allowance all start empty.
  const { results } = useFinanceTotals();
  const yoursSeed = useMemo(
    () =>
      figuresHidden
        ? draftFrom({
            ...results.taxInput,
            income: 0,
            benefitsInKind: 0,
            pensionContribution: 0,
            pensionShare: 0,
            personalAllowance: undefined,
          })
        : draftFrom(results.taxInput),
    [results.taxInput, figuresHidden],
  );
  const [profile, setProfile] = useState<Profile>('standard');
  const standard = profile === 'standard';
  const [overrides, setOverrides] = useState<Record<Profile, Partial<Draft>>>({ standard: {}, yours: {} });

  const draft = useMemo<Draft>(
    () => ({ ...(profile === 'standard' ? STANDARD_DRAFT : yoursSeed), ...overrides[profile] }),
    [profile, yoursSeed, overrides],
  );
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setOverrides(prev => ({ ...prev, [profile]: { ...prev[profile], [key]: value } }));
  const edited = Object.keys(overrides[profile]).length > 0;

  const employed = draft.kind === 'employed';
  // Salary sacrifice and net pay are payroll arrangements, so a self-employed
  // profit only has relief at source. The engine applies the same rule.
  const pensionMethod: UkPensionMethod = employed ? draft.pensionMethod : 'relief-at-source';

  const input = useMemo<UkTaxInput>(() => ({
    income: amount(draft.income),
    kind: draft.kind,
    region: draft.region,
    benefitsInKind: amount(draft.benefitsInKind),
    personalAllowance: allowanceFrom(draft.personalAllowance),
    pensionContribution: 0,
    pensionShare: shareFrom(draft.pensionPercent),
    pensionBasis: draft.pensionBasis,
    pensionMethod: draft.pensionMethod,
    undergradPlan: draft.undergradPlan,
    postgradLoan: draft.postgradLoan,
    children: Math.floor(amount(draft.children)),
    childcareSupport: amount(draft.childcareSupport),
    marriageAllowance: draft.marriageAllowance,
  }), [draft]);

  const result = useMemo(() => calculateUkTax(input), [input]);
  const marginal = useMemo(() => ukMarginalRate(input), [input]);
  const nextPound = useMemo(() => ukNextPound(input), [input]);
  const cliffs = useMemo(() => ukTaxCliffs(input), [input]);

  // Wide enough to show the 60% band and what lies past it, and always a
  // quarter beyond the income typed so the marker never sits on the edge.
  const chartMax = Math.max(200_000, Math.ceil((input.income * 1.25) / 10_000) * 10_000);
  const bands = useMemo(() => ukMarginalBands(input, { maxIncome: chartMax }), [input, chartMax]);
  // Keyed by where the band starts, so a recompute while hovering cannot shade a different band.
  const [highlightedBand, setHighlightedBand] = useState<number | null>(null);
  const shownBand = bands.find(b => b.from === highlightedBand);
  // Round steps on both axes: recharts' own picks land on £35k and 70%.
  const xStep = X_TICK_STEPS.find(s => chartMax / s <= 8) ?? chartMax / 8;
  const xTicks = Array.from({ length: Math.floor(chartMax / xStep) + 1 }, (_, i) => i * xStep);
  const showSupport = input.childcareSupport > 0;

  const taperGap = result.aboveTaperStart;
  const inTaper = taperGap > 0 && result.personalAllowance > 0;
  const nearTaper = taperGap <= 0 && taperGap > -10_000;
  // Where child benefit stands against its charge. The charge is stepped, so
  // "below" means nothing taken yet rather than under the start threshold.
  const hasChildBenefit = input.children > 0 && result.childBenefit > 0;
  const belowChildBenefitBand = hasChildBenefit && result.childBenefitCharge === 0;
  const inChildBenefitBand = hasChildBenefit && result.childBenefitCharge > 0
    && result.childBenefitCharge < result.childBenefit;
  const aboveChildBenefitBand = hasChildBenefit && result.childBenefitCharge >= result.childBenefit;
  const childBenefitBand = useMemo(() => ukChildBenefitBand(input), [input]);
  // A large pension can push the band past the plotted range; then neither
  // the shading nor its legend entry would point at anything.
  const shownChildBenefitBand = childBenefitBand && childBenefitBand.from < chartMax ? childBenefitBand : null;
  const shownCliffs = cliffs.filter(c => c.atIncome <= chartMax);
  const childBenefitHeadroom = -result.aboveChildBenefitStart;

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
        ? `You pay ${formatWholeGBP(result.pensionFromPay)}; the provider claims basic-rate relief on top.`
        : pensionMethod === 'net-pay'
          ? 'Taken before income tax, after National Insurance.'
          : 'Taken before income tax and National Insurance.',
      value: result.pensionFromPay,
      sign: '-' as const,
    }] : []),
    {
      key: 'tax',
      label: 'Income tax',
      note: `${formatWholeGBP(result.personalAllowance)} personal allowance`
        + (result.marriageAllowanceRelief > 0 ? `, ${formatWholeGBP(result.marriageAllowanceRelief)} marriage allowance relief` : '')
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
        : `Lost: adjusted net income is over ${formatWholeGBP(UK_CHILDCARE_CUTOFF)}.`,
      value: result.netWithSupport,
      tone: 'text-positive',
      kind: 'result' as const,
    }] : []),
  ];

  const field = (
    id: string,
    label: string,
    key: 'income' | 'benefitsInKind' | 'personalAllowance' | 'pensionPercent' | 'children',
    unit: 'pounds' | 'percent' | 'count' = 'pounds',
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        {unit === 'pounds' && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
        )}
        <Input
          id={id}
          inputMode={unit === 'count' ? 'numeric' : 'decimal'}
          value={draft[key]}
          placeholder={key === 'personalAllowance' ? '12,570' : '0'}
          onChange={e => set(key, e.target.value)}
          className={cn('h-9 font-mono text-sm tabular-nums', unit === 'pounds' && 'pl-7', unit === 'percent' && 'pr-7')}
        />
        {unit === 'percent' && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
        )}
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
        detail={input.income > 0 ? <>
          On {formatGBP(input.income)}{employed && input.benefitsInKind > 0 ? ' plus benefits' : ''},{' '}
          {formatGBP(result.takeHome / 12)} a month, {UK_TAX_YEAR_LABEL} rules.
        </> : <>Type a salary to see what it takes home under {UK_TAX_YEAR_LABEL} rules.</>}
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
            <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">{Math.round(100 * nextPound.kept)}p</dd>
            {/* The pension is not lost, so it is not in the marginal rate, but
                it is not cash either: say where the rest of the pound went. */}
            {nextPound.pension > 0 && (
              <dd className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">+{Math.round(100 * nextPound.pension)}p to pension</dd>
            )}
          </div>
        </dl>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Inputs */}
        <section aria-labelledby="taxcalc-inputs" className="surface-card rounded-lg border border-border/40 bg-card/50 p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <h3 id="taxcalc-inputs" className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary shrink-0" /> {standard ? 'Circumstances' : 'Your circumstances'}
            </h3>
            {edited && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 -mt-1 gap-1.5 text-xs"
                onClick={() => setOverrides(prev => ({ ...prev, [profile]: {} }))}
              >
                <RotateCcw className="h-3.5 w-3.5" /> {standard ? 'Reset' : 'My settings'}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <PillSwitch label="Start from" options={PROFILES} value={profile} onChange={setProfile} />
            <p className="text-xs text-muted-foreground">
              {standard
                ? `An ordinary employee: the standard tax code (1257L), the auto-enrolment minimum pension of
                  ${formatShare(UK_AUTO_ENROLMENT.minimumEmployeeShare)} of pay between
                  ${formatWholeGBP(UK_AUTO_ENROLMENT.lowerQualifyingEarnings)} and
                  ${formatWholeGBP(UK_AUTO_ENROLMENT.upperQualifyingEarnings)} paid
                  ${PENSION_METHODS.find(m => m.key === pensionMethod)?.inSentence ?? ''}, and no benefits,
                  children or marriage allowance. Yours starts from your settings and shows every field.`
                : 'Filled in from your finance settings. Change anything here; it never writes back to them.'}
            </p>
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
            {!standard && figuresHidden && overrides.yours.income === undefined && (
              <p className="text-xs text-muted-foreground">
                Figures are hidden, so this starts empty. Show figures to start from your salary.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {!standard && (
              <div className="space-y-1.5">
                <span className="block text-xs text-muted-foreground">Paid as</span>
                <PillSwitch label="Paid as" options={KINDS} value={draft.kind} onChange={v => set('kind', v)} />
              </div>
            )}
            <div className="space-y-1.5">
              <span className="block text-xs text-muted-foreground">Where you live</span>
              <PillSwitch label="Where you live" options={REGIONS} value={draft.region} onChange={v => set('region', v)} />
            </div>
          </div>

          {/* Standard keeps the auto-enrolment minimum but lets its payment
              method change: many larger employers pay it by salary sacrifice.
              Alone there, it takes the whole row. */}
          <div className={cn('grid gap-4', !standard && 'sm:grid-cols-2')}>
            {!standard && field('taxcalc-pension', `Pension (% of ${employed ? 'salary' : 'profit'}, gross)`, 'pensionPercent', 'percent')}
            <div className="space-y-1.5">
              <Label htmlFor="taxcalc-pension-method" className="text-xs text-muted-foreground">
                {standard ? 'Pension paid by' : 'Paid by'}
              </Label>
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

          {!standard && (<>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('taxcalc-allowance', 'Personal allowance (from tax code)', 'personalAllowance')}
            {employed && field('taxcalc-bik', 'Benefits in kind (company car, medical cover)', 'benefitsInKind')}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {field('taxcalc-children', 'Children claiming child benefit', 'children', 'count')}
            <div className="space-y-1.5">
              <Label htmlFor="taxcalc-childcare" className="text-xs text-muted-foreground">Childcare support a year</Label>
              <Select value={draft.childcareSupport} onValueChange={v => set('childcareSupport', v)}>
                <SelectTrigger id="taxcalc-childcare" className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHILDCARE_STEPS.map(n => (
                    <SelectItem key={n} value={String(n)} className="text-sm">{n === 0 ? 'None' : formatWholeGBP(n)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Child benefit is clawed back between {formatWholeGBP(UK_CHILD_BENEFIT_CHARGE_START)} and
              {' '}{formatWholeGBP(UK_CHILD_BENEFIT_CHARGE_END)} of adjusted net income: 1% for every
              {' '}{formatWholeGBP(UK_CHILD_BENEFIT_CHARGE_STEP)} over, all of it by {formatWholeGBP(UK_CHILD_BENEFIT_CHARGE_END)}.
              Childcare support goes at once above {formatWholeGBP(UK_CHILDCARE_CUTOFF)}.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="taxcalc-marriage" className="text-xs text-muted-foreground">
              Receives marriage allowance from a partner
            </Label>
            <Switch id="taxcalc-marriage" checked={draft.marriageAllowance} onCheckedChange={v => set('marriageAllowance', v)} />
          </div>
          </>)}
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
                        {v > 0 ? row.sign : ''}{formatGBP(v)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Only the pointers that apply. Each is arithmetic on the breakdown
              above, worded; none of it is advice. */}
          {(inTaper || nearTaper || belowChildBenefitBand || inChildBenefitBand || aboveChildBenefitBand || cliffs.length > 0) && (
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
              {belowChildBenefitBand && (
                <li>
                  You keep all {formatGBP(result.childBenefit)} of child benefit. The charge takes 1% for every
                  full {formatWholeGBP(UK_CHILD_BENEFIT_CHARGE_STEP)} of adjusted net income over
                  {' '}{formatWholeGBP(UK_CHILD_BENEFIT_CHARGE_START)}
                  {childBenefitHeadroom > 0 ? <>, which is {formatGBP(childBenefitHeadroom)} further on</> : null},
                  and all of it by {formatWholeGBP(UK_CHILD_BENEFIT_CHARGE_END)}.
                </li>
              )}
              {inChildBenefitBand && (
                <li>
                  The child benefit charge takes back {formatGBP(result.childBenefitCharge)} of
                  {' '}{formatGBP(result.childBenefit)}. Bringing adjusted net income down by
                  {' '}{formatGBP(result.aboveChildBenefitStart)} would clear it.
                </li>
              )}
              {aboveChildBenefitBand && (
                <li>
                  The charge takes back all {formatGBP(result.childBenefit)} of child benefit. It starts to come
                  back once adjusted net income falls below {formatWholeGBP(UK_CHILD_BENEFIT_CHARGE_END)}.
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

      <TakeHomeSlices input={input} />

      {/* Chart */}
      <section aria-labelledby="taxcalc-chart" className="surface-card rounded-lg border border-border/40 bg-card/50 p-5 sm:p-6">
        <div className="space-y-1 min-w-0">
          <h3 id="taxcalc-chart" className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary shrink-0" />
            What each salary keeps
          </h3>
          <p className="text-xs text-muted-foreground">
            {`Two lines across incomes: the share of salary kept as cash after the pension, tax, NI and loans, and the marginal rate: what the next pound loses to tax, NI, loans and the child benefit charge. ${HELD_AS_ENTERED} Each step of the marginal rate is explained below the chart.`}
          </p>
        </div>

        <TaxCurveChart
          input={input}
          chartMax={chartMax}
          step={chartMax / CHART_POINTS}
          xTicks={xTicks}
          highlighted={shownBand}
          childBenefitBand={shownChildBenefitBand}
          cliffs={shownCliffs}
        />
        <MarginalSteps
            bands={bands}
            income={input.income}
            ctx={{
              kind: input.kind,
              undergradPlan: input.undergradPlan,
              pensionShare: input.pensionShare ?? 0,
              pensionBasis: draft.pensionBasis,
              pensionMethod,
              benefitsInKind: input.benefitsInKind,
              marriageAllowance: input.marriageAllowance,
            }}
            highlighted={highlightedBand}
            onHighlight={setHighlightedBand}
          />
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
          Standard pays the auto-enrolment minimum at every income, including below the
          {' '}{formatWholeGBP(UK_AUTO_ENROLMENT.earningsTrigger)} at which an employer must enrol you, as if you had
          opted in; employer contributions are on top and not shown. Yours reads the pension percentage
          from settings as a gross share of the whole salary. Child benefit counts {UK_CHILD_BENEFIT_WEEKS} weeks,
          the Mondays in the {UK_TAX_YEAR_LABEL} tax year.
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

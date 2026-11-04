/**
 * The marginal-rate chart as a list: one row per stretch of income where the
 * rate holds still, what each deduction takes of the next pound there, and
 * what changed to make the step.
 *
 * The bands, their rates, the income tax band and whether the allowance taper
 * is running all come from `ukMarginalBands`. Only the sentences are written
 * here, and they are rules over those fields: which component started,
 * stopped or changed, and to what. Nothing is computed for display.
 */

import { formatShare, formatWholeGBP } from '@/features/finance/utils/calculations';
import {
  UK_ALLOWANCE_TAPER_RATE,
  UK_ALLOWANCE_TAPER_START,
  UK_AUTO_ENROLMENT,
  UK_CHILD_BENEFIT_CHARGE_START,
  type UkIncomeKind,
  type UkMarginalBand,
  type UkPensionBasis,
  type UkPensionMethod,
  type UkUndergradPlan,
} from '@/lib/finance';
import { cn } from '@/lib/utils';

/** The inputs the sentences need beyond the bands themselves. */
export interface MarginalStepsContext {
  kind: UkIncomeKind;
  undergradPlan: UkUndergradPlan;
  /** Gross share of `pensionBasis` paid in; 0 for no pension. */
  pensionShare: number;
  pensionBasis: UkPensionBasis;
  pensionMethod: UkPensionMethod;
  benefitsInKind: number;
  marriageAllowance: boolean;
}

type Component = 'incomeTax' | 'nationalInsurance' | 'studentLoan' | 'postgradLoan' | 'childBenefitCharge';

/** Fixed order and colours, matching the take-home slices above. */
const COMPONENTS: { key: Component; label: string; swatch: string }[] = [
  { key: 'incomeTax', label: 'Income tax', swatch: 'bg-chart-3' },
  { key: 'nationalInsurance', label: 'NI', swatch: 'bg-chart-4' },
  { key: 'studentLoan', label: 'Student loan', swatch: 'bg-chart-2' },
  { key: 'postgradLoan', label: 'Postgrad loan', swatch: 'bg-chart-2' },
  { key: 'childBenefitCharge', label: 'Child benefit charge', swatch: 'bg-chart-5' },
];

const PLAN_LABELS: Record<UkUndergradPlan, string> = {
  none: '',
  plan1: 'Plan 1',
  plan2: 'Plan 2',
  plan4: 'Plan 4',
  plan5: 'Plan 5',
};

const EPSILON = 1e-6;
const same = (a: number, b: number) => Math.abs(a - b) < EPSILON;

const capitalised = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;

const TAPER = `above ${formatWholeGBP(UK_ALLOWANCE_TAPER_START)} of adjusted net income every £${Math.round(1 / UK_ALLOWANCE_TAPER_RATE)} removes £1 of personal allowance`;

const incomeTaxSentence = (prev: UkMarginalBand, band: UkMarginalBand, ctx: MarginalStepsContext): string => {
  const name = band.incomeTaxBand;
  const rate = formatShare(band.incomeTax);
  if (!name) return 'Income tax stops.';
  if (!prev.incomeTaxBand) {
    const marriage = ctx.marriageAllowance ? ' Marriage allowance’s tax reduction is used up below this point.' : '';
    return `Income tax starts at the ${name} rate: ${rate} of each pound.${marriage}`;
  }
  if (band.allowanceTapering && !prev.allowanceTapering) {
    return `The allowance taper: ${TAPER}, so ${name}-rate tax costs ${rate}.`;
  }
  if (prev.allowanceTapering && !band.allowanceTapering) {
    return `The allowance is gone, so the taper ends: ${name}-rate tax takes ${rate}.`;
  }
  if (band.allowanceTapering) {
    return `The ${name}-rate band starts while the taper is still running, so it costs ${rate}.`;
  }
  if (prev.incomeTaxBand !== name) return `${capitalised(name)}-rate income tax: ${rate}.`;
  return `Income tax ${band.incomeTax > prev.incomeTax ? 'rises' : 'falls'} to ${rate}.`;
};

const niSentence = (prev: number, next: number, ctx: MarginalStepsContext): string => {
  const ni = ctx.kind === 'self-employed' ? 'Class 4 National Insurance' : 'National Insurance';
  const limit = ctx.kind === 'self-employed' ? 'upper profits limit' : 'upper earnings limit';
  if (same(prev, 0)) return `${ni} starts at ${formatShare(next)}.`;
  if (same(next, 0)) return `${ni} stops.`;
  return next < prev
    ? `${ni} drops from ${formatShare(prev)} to ${formatShare(next)} above the ${limit}.`
    : `${ni} rises to ${formatShare(next)}.`;
};

const loanSentence = (label: string, prev: number, next: number): string => {
  if (same(prev, 0)) return `${label} repayments start: ${formatShare(next)} of income over the threshold.`;
  if (same(next, 0)) return `${label} repayments stop.`;
  return `${label} repayments change to ${formatShare(next)}.`;
};

const childBenefitSentence = (prev: number, next: number): string => {
  if (same(prev, 0)) {
    return `The child benefit charge starts at ${formatWholeGBP(UK_CHILD_BENEFIT_CHARGE_START)} of adjusted net income, taking back ${formatShare(next)} of each extra pound.`;
  }
  if (same(next, 0)) return 'The child benefit charge has taken all of it back, so it stops.';
  return `The child benefit charge now takes ${formatShare(next)}.`;
};

const NOTHING: Omit<UkMarginalBand, 'from' | 'to'> = {
  incomeTax: 0,
  nationalInsurance: 0,
  studentLoan: 0,
  postgradLoan: 0,
  childBenefitCharge: 0,
  total: 0,
  incomeTaxBand: null,
  allowanceTapering: false,
};

/** What changed between two neighbouring bands, one sentence per component that moved. */
const explain = (before: UkMarginalBand | undefined, band: UkMarginalBand, ctx: MarginalStepsContext): string[] => {
  if (!before && same(band.total, 0)) {
    return ['Nothing is taken: inside the personal allowance and below the National Insurance threshold.'];
  }
  // A reduced tax code or benefits in kind can start a deduction from the first pound.
  const prev = before ?? { ...band, ...NOTHING };
  const out: string[] = [];
  if (
    !same(prev.incomeTax, band.incomeTax)
    || prev.incomeTaxBand !== band.incomeTaxBand
    || prev.allowanceTapering !== band.allowanceTapering
  ) {
    out.push(incomeTaxSentence(prev, band, ctx));
  }
  if (!same(prev.nationalInsurance, band.nationalInsurance)) out.push(niSentence(prev.nationalInsurance, band.nationalInsurance, ctx));
  if (!same(prev.studentLoan, band.studentLoan)) out.push(loanSentence(`${PLAN_LABELS[ctx.undergradPlan]} student loan`.trim(), prev.studentLoan, band.studentLoan));
  if (!same(prev.postgradLoan, band.postgradLoan)) out.push(loanSentence('Postgraduate loan', prev.postgradLoan, band.postgradLoan));
  if (!same(prev.childBenefitCharge, band.childBenefitCharge)) out.push(childBenefitSentence(prev.childBenefitCharge, band.childBenefitCharge));
  return out;
};

const QUALIFYING = `pay between ${formatWholeGBP(UK_AUTO_ENROLMENT.lowerQualifyingEarnings)} and ${formatWholeGBP(UK_AUTO_ENROLMENT.upperQualifyingEarnings)}`;

/** Bands whose income tax rate is above the basic rate: the ones a relief-at-source share stretches. */
const BELOW_STRETCH: readonly (UkMarginalBand['incomeTaxBand'])[] = [null, 'starter', 'basic'];

/**
 * Why the steps sit where they do for these inputs rather than at the headline
 * thresholds. The pension is a share, so it moves the steps by a different
 * number of pounds at each one; the notes say which way, not by how much.
 */
const shiftNotes = (ctx: MarginalStepsContext, bands: UkMarginalBand[]): string[] => {
  const notes: string[] = [];
  if (ctx.pensionShare > 0) {
    const qualifying = ctx.pensionBasis === 'qualifying';
    const of = qualifying ? QUALIFYING : ctx.kind === 'self-employed' ? 'profit' : 'salary';
    const pension = `The pension, ${formatShare(ctx.pensionShare)} of ${of},`;
    // Where the pension still grows with each pound, it takes a slice of the pound before the rates do.
    const where = qualifying ? ` up to ${formatWholeGBP(UK_AUTO_ENROLMENT.upperQualifyingEarnings)}` : '';
    const method = ctx.kind === 'self-employed' ? 'relief-at-source' : ctx.pensionMethod;
    if (method === 'net-pay') {
      notes.push(`${pension} is paid from pay before income tax, so income tax only reaches what it leaves: the income tax steps and the child benefit charge sit higher than their headline thresholds, and${where} income tax rates sit a little under the headline ones. National Insurance and student loan steps don't move.`);
    } else if (method === 'salary-sacrifice') {
      notes.push(`${pension} is given up by salary sacrifice, so it comes off before everything: every step sits higher than its headline threshold, and${where} every rate a little under its headline one.`);
    } else {
      // Only while the pension still grows does it stretch the band under each
      // extra pound: on qualifying earnings that is up to the upper limit,
      // which a band above the basic rate reaches only in Scotland.
      const stretched = bands.some(b =>
        !BELOW_STRETCH.includes(b.incomeTaxBand)
        && (!qualifying || b.from < UK_AUTO_ENROLMENT.upperQualifyingEarnings));
      const under = stretched ? `, and${where} every rate above the basic rate sits a little under its headline one` : '';
      notes.push(`${pension} is paid by relief at source, so income tax still starts at the personal allowance. The basic-rate band widens by the gross paid in, so higher-rate tax starts later${under}. Adjusted net income falls by it too, so the ${formatWholeGBP(UK_ALLOWANCE_TAPER_START)} taper and the child benefit charge start later.`);
    }
  }
  if (ctx.kind === 'employed' && ctx.benefitsInKind > 0) {
    notes.push(`Your ${formatWholeGBP(ctx.benefitsInKind)} of benefits in kind count as taxable income, so the income tax steps and the child benefit charge sit that much lower.`);
  }
  return notes;
};

export function MarginalSteps({ bands, income, ctx, highlighted, onHighlight }: {
  bands: UkMarginalBand[];
  /** The income entered, to mark the band it falls in. */
  income: number;
  ctx: MarginalStepsContext;
  /** `from` of the band shaded on the chart. */
  highlighted: number | null;
  onHighlight: (from: number | null) => void;
}) {
  if (bands.length === 0) return null;
  const notes = shiftNotes(ctx, bands);
  // With no income typed there is nobody to mark.
  const yours = income > 0 ? bands.findIndex(b => income >= b.from && income < b.to) : -1;

  return (
    <div className="mt-5 space-y-3">
      <ol className="grid gap-2 lg:grid-cols-2" aria-label="Each step of the marginal rate" onMouseLeave={() => onHighlight(null)}>
        {bands.map((band, i) => {
          const isYours = i === yours;
          const parts = COMPONENTS.filter(c => band[c.key] > EPSILON);
          const last = i === bands.length - 1;
          return (
            <li
              key={band.from}
              tabIndex={0}
              onMouseEnter={() => onHighlight(band.from)}
              onFocus={() => onHighlight(band.from)}
              onBlur={() => onHighlight(null)}
              className={cn(
                'rounded-md border px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isYours ? 'border-primary/50 bg-primary/5' : 'border-border/30 bg-muted/10',
                highlighted === band.from && 'border-foreground/40 bg-muted/40',
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {last ? `${formatWholeGBP(band.from)}+` : `${formatWholeGBP(band.from)} – ${formatWholeGBP(band.to)}`}
                  {isYours && <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">You</span>}
                </span>
                <span className="font-mono text-sm font-semibold text-foreground tabular-nums">{formatShare(band.total)}</span>
              </div>
              {parts.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono" aria-label="Made up of">
                  {parts.map(c => (
                    <li key={c.key} className="flex items-center gap-1.5">
                      <span aria-hidden="true" className={cn('h-2 w-2 rounded-sm shrink-0', c.swatch)} />
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="text-foreground tabular-nums">{formatShare(band[c.key])}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">{explain(bands[i - 1], band, ctx).join(' ')}</p>
            </li>
          );
        })}
      </ol>
      {notes.map(note => (
        <p key={note} className="text-xs text-muted-foreground">{note}</p>
      ))}
    </div>
  );
}

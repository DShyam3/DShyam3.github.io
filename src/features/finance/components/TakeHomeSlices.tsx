/**
 * Take-home, slice by slice: what each part of pay actually loses.
 *
 * Income tax bands, National Insurance thresholds and student loan thresholds
 * start in different places, so "the 40% band" is not what a pound in it
 * loses. Every figure here comes from `ukTakeHomeBySlice`: the slices of pay
 * over which each rate holds still, what each one takes and keeps, and the
 * totals and shares of pay they add up to. This component only words them,
 * and shows the year's take-home as twelve months.
 *
 * The switch takes the pension and benefits in kind out, leaving the salary
 * alone, or puts them back, so the share kept is what actually reaches the
 * bank. Shared by Tax & Income (your settings) and the Tax Calculator.
 */

import { useId, useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatGBP, formatGBPNoPence } from '@/features/finance/utils/calculations';
import {
  UK_TAX_BAND_NAMES,
  ukTakeHomeBySlice,
  type UkPaySlice,
  type UkTaxInput,
  type UkTaxRegion,
} from '@/lib/finance';
import { cn } from '@/lib/utils';

type SegmentKey = 'pension' | 'take-home' | 'tax' | 'charge' | 'ni' | 'loan';

/**
 * Fill and order of the bar. Take-home is the positive green and the pension
 * a tint of it, since both are yours; the deductions keep off green, and the
 * child benefit charge is a tint of income tax's purple. Checked with the
 * dataviz palette validator on both themes' card surfaces: every pair that can
 * end up side by side, whichever optional segments are missing, stays apart in
 * normal and colour-blind vision. The tints are under 3:1 against the card, so
 * the legend under the bar names every value.
 */
const SEGMENT_FILL: Record<SegmentKey, string> = {
  pension: 'bg-positive/40',
  'take-home': 'bg-positive',
  tax: 'bg-chart-3',
  charge: 'bg-chart-3/50',
  ni: 'bg-chart-4',
  loan: 'bg-chart-2',
};

/** A share as a percentage, to one decimal place only where it needs one. */
const pct = (share: number) => {
  const p = Math.round(share * 1000) / 10;
  return `${Number.isInteger(p) ? p : p.toFixed(1)}%`;
};

/** Below this an amount is float dust, not a deduction worth naming. */
const PENNY = 0.005;

const bandName = (slice: UkPaySlice, region: UkTaxRegion): string => {
  if (slice.taxBand === null) return 'Personal allowance';
  const band = UK_TAX_BAND_NAMES[region][slice.taxBand] ?? 'Taxed';
  return slice.allowanceTaper ? `${band}, allowance withdrawn` : band;
};

export function TakeHomeSlices({
  input,
  hidden = false,
  benefitsInTaxCode = false,
  fromSettings = false,
  className,
}: {
  input: UkTaxInput;
  /** Finance figures are hidden: the shares would give the salary away, so none are shown. */
  hidden?: boolean;
  /** The tax code already collects the benefits' tax, so it is in every slice and the switch cannot take it out. */
  benefitsInTaxCode?: boolean;
  /** The input is the saved settings, not a typed figure, so an empty salary is set in Settings. */
  fromSettings?: boolean;
  className?: string;
}) {
  const switchId = useId();
  const [withExtras, setWithExtras] = useState(true);

  const employed = input.kind !== 'self-employed';
  const region: UkTaxRegion = input.region === 'scotland' ? 'scotland' : 'rUK';
  const noun = employed ? 'salary' : 'profit';
  const hasExtras = input.pensionContribution > 0 || (employed && input.benefitsInKind > 0);

  const view = useMemo<UkTaxInput>(
    () => (withExtras ? input : { ...input, pensionContribution: 0, benefitsInKind: 0 }),
    [input, withExtras],
  );
  const pay = useMemo(() => ukTakeHomeBySlice(view), [view]);

  const hasLoan = view.undergradPlan !== 'none' || view.postgradLoan;
  const loanLabel = view.postgradLoan && view.undergradPlan !== 'none'
    ? 'student loans'
    : view.postgradLoan ? 'postgraduate loan' : 'student loan';
  const pensionOffPay = pay.pension > PENNY && pay.reliefAtSource > 0;
  // A row under a penny wide has nothing to show; the totals still count it.
  const rows = pay.slices.filter(slice => slice.width > PENNY);

  const segments = ([
    { key: 'pension', label: 'Pension', value: pay.pension, share: pay.pensionShare },
    { key: 'take-home', label: 'Take-home', value: pay.kept, share: pay.keptShare },
    { key: 'tax', label: 'Income tax', value: pay.incomeTax, share: pay.incomeTaxShare },
    { key: 'charge', label: 'Child benefit charge', value: pay.childBenefitCharge, share: pay.childBenefitChargeShare },
    { key: 'ni', label: 'National Insurance', value: pay.nationalInsurance, share: pay.nationalInsuranceShare },
    {
      key: 'loan',
      label: loanLabel.charAt(0).toUpperCase() + loanLabel.slice(1),
      value: pay.studentLoan,
      share: pay.studentLoanShare,
    },
  ] as const satisfies readonly { key: SegmentKey; label: string; value: number; share: number }[])
    .filter(s => s.value > PENNY);

  const rates = (slice: UkPaySlice): string => {
    const parts = ([
      [slice.incomeTax, slice.rates.incomeTax, 'income tax'],
      [slice.nationalInsurance, slice.rates.nationalInsurance, 'NI'],
      [slice.studentLoan, slice.rates.studentLoan, loanLabel],
      [slice.childBenefitCharge, slice.rates.childBenefitCharge, 'child benefit charge'],
    ] as const)
      .filter(([amount]) => amount > PENNY)
      .map(([, rate, label]) => `${pct(rate)} ${label}`);
    return parts.length > 0 ? parts.join(', ') : 'nothing taken';
  };

  const sliceNote = (slice: UkPaySlice): string => {
    if (slice.kind === 'pension') {
      return view.pensionMethod === 'salary-sacrifice'
        ? `Pension by salary sacrifice, off the top: no income tax, NI${hasLoan ? ` or ${loanLabel}` : ''} on it.`
        : `Pension by net pay, off the top: no income tax on it; ${rates(slice)}.`;
    }
    if (slice.kind === 'benefits-in-kind') {
      return `Benefits in kind, ${bandName(slice, region).toLowerCase()}: ${rates(slice)}. Taxed, not paid, so it comes out of your pay.`;
    }
    return `${bandName(slice, region)}: ${rates(slice)}.`;
  };

  const benefitsTaxed = withExtras && employed && view.benefitsInKind > 0;
  const takenFrom = [
    benefitsTaxed ? 'income tax (with the tax on benefits in kind)' : 'income tax',
    'National Insurance',
    ...(pay.studentLoan > PENNY ? [loanLabel] : []),
    ...(pay.childBenefitCharge > PENNY ? ['the child benefit charge'] : []),
    ...(pay.pension > PENNY ? ['pension'] : []),
  ];
  const what = `after ${takenFrom.slice(0, -1).join(', ')} and ${takenFrom[takenFrom.length - 1]}`;

  return (
    <section
      aria-labelledby={`${switchId}-title`}
      className={cn('surface-card rounded-lg border border-border/40 bg-card/50 p-5 sm:p-6', className)}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <h3 id={`${switchId}-title`} className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary shrink-0" /> Your pay, slice by slice
          </h3>
          <p className="text-xs text-muted-foreground">
            A band&apos;s rate applies only to the part of your {noun} inside it, and income tax, National
            Insurance and student loan bands start in different places. Each row is a slice where every rate
            holds still, and what it actually keeps.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-start">
          <Label htmlFor={switchId} className="text-xs text-muted-foreground">
            After pension and benefits in kind
          </Label>
          <Switch
            id={switchId}
            checked={withExtras && hasExtras}
            onCheckedChange={setWithExtras}
            disabled={hidden || !hasExtras}
          />
        </div>
      </div>

      {hidden ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Figures are hidden. Show figures to see what each slice of your {noun} keeps.
        </p>
      ) : pay.pay === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          {fromSettings
            ? `Set a ${noun} in Settings to see what each slice of it keeps.`
            : `Enter a ${noun} to see what each slice of it keeps.`}
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end sm:gap-8">
            <div>
              <p className="text-xs text-muted-foreground">You keep</p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-tight tabular-nums text-foreground">
                {pay.shortfall > 0 ? 'None' : pct(pay.keptShare)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground sm:pb-1">
              {pay.shortfall > 0 ? (
                <>
                  Pension and deductions come to {formatGBP(pay.shortfall)} more than your {noun}, so none of it
                  reaches the bank.
                </>
              ) : (
                <>
                  of your {noun}: {formatGBP(pay.kept)} a year, {formatGBP(pay.kept / 12)} a month, {what}.
                  {pay.taken > PENNY && <> {pct(pay.takenShare)} of it, {formatGBP(pay.taken)}, is taken.</>}
                </>
              )}
              {pay.childBenefit > 0 && <> Child benefit of {formatGBP(pay.childBenefit)} comes on top.</>}
              {benefitsInTaxCode && (
                <> Your tax code collects the tax on your benefits in kind, so it is in every slice either way.</>
              )}
              {!withExtras && hasExtras && <> Pension and benefits in kind left out.</>}
              {!hasExtras && (
                <> No pension{benefitsInTaxCode ? '' : ' or benefits in kind'} to take out, so the switch is off.</>
              )}
            </p>
          </div>

          {pay.shortfall === 0 && segments.length > 0 && (
            /* The legend under it carries every value; the bar is the picture of it. */
            <div aria-hidden="true" className="mt-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
              {segments.map(s => (
                <div
                  key={s.key}
                  title={`${s.label}: ${pct(s.share)}`}
                  className={SEGMENT_FILL[s.key]}
                  style={{ width: `${s.share * 100}%` }}
                />
              ))}
            </div>
          )}
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            {segments.map(s => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span aria-hidden="true" className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', SEGMENT_FILL[s.key])} />
                <span className="text-foreground">{s.label}</span>
                <span className="font-mono tabular-nums">{pct(s.share)}</span>
                <span className="font-mono tabular-nums">{formatGBP(s.value)}</span>
              </li>
            ))}
          </ul>

          {/* Three columns from 640px. Narrower, "Taken" moves under the slice
              so the slice keeps room to read and nothing scrolls sideways. */}
          <table className="mt-6 w-full text-sm">
            <caption className="sr-only">
              Each slice of your {noun}, what is taken from it and what it keeps, a year
            </caption>
            <thead>
              <tr className="border-b border-border/50 text-xs text-muted-foreground">
                <th scope="col" className="pb-2.5 pr-4 text-left font-normal">Slice of {noun}</th>
                <th scope="col" className="hidden pb-2.5 pl-4 text-right font-normal sm:table-cell">Taken</th>
                <th scope="col" className="pb-2.5 pl-4 text-right font-normal">You keep</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((slice, i) => {
                const ownPay = slice.kind === 'salary';
                const cell = cn('py-2 align-top', i === 0 && 'pt-3');
                return (
                  <tr key={`${slice.kind}-${slice.from}`}>
                    <th scope="row" className={cn(cell, 'pr-4 text-left font-normal text-foreground')}>
                      <span className="font-mono tabular-nums">
                        {slice.kind === 'benefits-in-kind'
                          ? `${formatGBP(slice.width)} of benefits`
                          : `${formatGBPNoPence(slice.from)} to ${formatGBPNoPence(slice.to)}`}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {sliceNote(slice)}
                        {slice.taken > PENNY && (
                          <span className="sm:hidden">
                            {' '}Taken: {formatGBP(slice.taken)}, {pct(slice.rates.taken)}.
                          </span>
                        )}
                      </span>
                    </th>
                    <td className={cn(cell, 'hidden pl-4 text-right font-mono tabular-nums whitespace-nowrap text-foreground sm:table-cell')}>
                      {formatGBP(slice.taken)}
                      <span className="mt-0.5 block text-xs text-muted-foreground">{pct(slice.rates.taken)}</span>
                    </td>
                    <td className={cn(cell, 'pl-4 text-right font-mono tabular-nums whitespace-nowrap text-foreground')}>
                      {slice.kept < -PENNY ? `-${formatGBP(-slice.kept)}` : formatGBP(Math.max(0, slice.kept))}
                      <span className="mt-0.5 block whitespace-normal text-xs text-muted-foreground">
                        {ownPay
                          ? pct(slice.rates.kept)
                          : slice.kind === 'pension'
                            ? `${formatGBP(slice.width)} to pension`
                            : 'from your pay'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {pay.marriageAllowanceLost > PENNY && (
                <tr>
                  <th scope="row" className="py-2 pr-4 align-top text-left font-normal text-foreground">
                    Marriage allowance lost
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Taxable income passes the limit for it, so the relief stops: one step, not a rate.
                      {' '}<span className="sm:hidden">Taken: {formatGBP(pay.marriageAllowanceLost)}.</span>
                    </span>
                  </th>
                  <td className="hidden py-2 pl-4 align-top text-right font-mono tabular-nums whitespace-nowrap text-foreground sm:table-cell">
                    {formatGBP(pay.marriageAllowanceLost)}
                  </td>
                  <td className="py-2 pl-4 align-top text-right font-mono tabular-nums whitespace-nowrap text-foreground">
                    -{formatGBP(pay.marriageAllowanceLost)}
                  </td>
                </tr>
              )}
              {pensionOffPay && (
                <tr>
                  <th scope="row" className="py-2 pr-4 align-top text-left font-normal text-foreground">
                    Pension, relief at source
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Paid from take-home; the provider adds basic-rate relief. The bands above the basic
                      rate, the allowance taper and the child benefit charge all start
                      {' '}{formatGBP(pay.reliefAtSource)} later.
                    </span>
                  </th>
                  <td className="hidden py-2 pl-4 align-top text-right font-mono tabular-nums text-muted-foreground sm:table-cell">
                    <span aria-hidden="true">–</span>
                    <span className="sr-only">Nothing taken</span>
                  </td>
                  <td className="py-2 pl-4 align-top text-right font-mono tabular-nums whitespace-nowrap text-foreground">
                    -{formatGBP(pay.pension)}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-border/70">
                <th scope="row" className="pt-4 pr-4 align-top text-left font-semibold text-foreground">
                  All of it
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    Shares of your {noun}.
                    <span className="sm:hidden"> Taken: {formatGBP(pay.taken)}, {pct(pay.takenShare)}.</span>
                  </span>
                </th>
                <td className="hidden pt-4 pl-4 align-top text-right font-mono font-semibold tabular-nums whitespace-nowrap text-destructive sm:table-cell">
                  {formatGBP(pay.taken)}
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{pct(pay.takenShare)}</span>
                </td>
                <td className={cn(
                  'pt-4 pl-4 align-top text-right font-mono font-semibold tabular-nums whitespace-nowrap',
                  pay.shortfall > 0 ? 'text-destructive' : 'text-positive',
                )}>
                  {pay.shortfall > 0 ? `-${formatGBP(pay.shortfall)}` : formatGBP(pay.kept)}
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {pay.shortfall > 0 ? 'short' : pct(pay.keptShare)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </section>
  );
}

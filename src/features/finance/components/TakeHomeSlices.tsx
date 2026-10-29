import { useId, useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { formatGBP, formatWholeGBP } from '@/features/finance/utils/calculations';
import { ukTakeHomeBySlice, type UkPaySlice, type UkTaxInput } from '@/lib/finance';
import { PillSwitch } from './PillSwitch';

export interface TakeHomeSlicesProps {
  input: UkTaxInput;
  /** True when benefits in kind exist on the profile but their tax is already collected via a reduced tax-code allowance. */
  benefitTaxCollectedByCode?: boolean;
  /** Value of those coded benefits in kind, £/yr. */
  codedBenefitsInKind?: number;
}

type SliceViewMode = 'after' | 'salary';

const VIEW_MODES = [
  { key: 'after', label: 'After pension & benefits' },
  { key: 'salary', label: 'Salary only' },
] as const satisfies readonly { key: SliceViewMode; label: string }[];

const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`;

const sliceLabel = (slice: UkPaySlice): string => {
  const range = `${formatWholeGBP(slice.from)} – ${formatWholeGBP(slice.to)}`;
  if (slice.kind === 'pension') return `Pension (${range})`;
  if (slice.kind === 'benefit-in-kind') return `Benefits in kind (${range})`;
  return range;
};

export function TakeHomeSlices({
  input,
  benefitTaxCollectedByCode = false,
  codedBenefitsInKind = 0,
}: TakeHomeSlicesProps) {
  const headingId = useId();
  const [mode, setMode] = useState<SliceViewMode>('after');

  const summary = useMemo(
    () => ukTakeHomeBySlice(input, { includePensionAndBenefits: mode === 'after' }),
    [input, mode],
  );

  const showLoan = summary.studentLoan > 0 || input.undergradPlan !== 'none' || input.postgradLoan;
  const showPension = summary.pensionFromPay > 0;

  const contextualNote = (() => {
    if (benefitTaxCollectedByCode && codedBenefitsInKind > 0) {
      return `${formatWholeGBP(codedBenefitsInKind)} of benefits in kind are already taxed through your reduced personal allowance.`;
    }
    if (mode === 'after' && summary.pensionContribution === 0 && summary.benefitsInKind === 0) {
      return 'No pension contributions or taxable benefits in kind are entered, so this matches salary only.';
    }
    if (mode === 'salary' && (input.pensionContribution > 0 || input.benefitsInKind > 0)) {
      return 'Showing gross pay before pension contributions and taxable benefits in kind.';
    }
    if (mode === 'after') {
      const pensionPart = summary.pensionFromPay > 0 ? `${formatWholeGBP(summary.pensionFromPay)} pension from pay` : '';
      const connector = summary.pensionFromPay > 0 && summary.benefitsInKind > 0 ? ' and ' : '';
      const bikPart = summary.benefitsInKind > 0 ? `tax on ${formatWholeGBP(summary.benefitsInKind)} of benefits in kind` : '';
      return `After ${pensionPart}${connector}${bikPart}.`;
    }
    return null;
  })();

  const legendItems = [
    {
      key: 'take-home',
      label: 'Cash remaining',
      swatch: 'bg-positive',
      amount: summary.rawTakeHome,
      share: summary.shares.takeHome,
    },
    ...(summary.pensionFromPay > 0
      ? [
          {
            key: 'pension',
            label: 'Pension',
            swatch: 'bg-positive/45',
            amount: summary.pensionFromPay,
            share: summary.shares.pension,
          },
        ]
      : []),
    {
      key: 'income-tax',
      label: 'Income tax',
      swatch: 'bg-chart-3',
      amount: summary.incomeTax,
      share: summary.shares.incomeTax,
    },
    {
      key: 'ni',
      label: 'National Insurance',
      swatch: 'bg-chart-4',
      amount: summary.nationalInsurance,
      share: summary.shares.nationalInsurance,
    },
    ...(summary.studentLoan > 0
      ? [
          {
            key: 'student-loan',
            label: 'Student loan',
            swatch: 'bg-chart-2',
            amount: summary.studentLoan,
            share: summary.shares.studentLoan,
          },
        ]
      : []),
  ];

  return (
    <section
      aria-labelledby={headingId}
      className="surface-card rounded-lg border border-border/40 bg-card/50 p-5 sm:p-6 hover:border-border/80 transition-colors space-y-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <h3
            id={headingId}
            className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2"
          >
            <Layers aria-hidden="true" className="w-4 h-4 text-primary shrink-0" /> Take-home by income slice
          </h3>
          <p className="text-xs text-muted-foreground">
            Cash pay after income tax, National Insurance, student loans, and pension. Child benefit and childcare support are excluded.
          </p>
        </div>
        <PillSwitch
          label="Slice view"
          options={VIEW_MODES}
          value={mode}
          onChange={setMode}
          className="shrink-0 self-start"
        />
      </div>

      <div className="bg-muted/20 rounded-lg p-3.5 border border-border/30 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2.5">
          {summary.rawTakeHome >= 0 && <span className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-positive">
            {percent(summary.takeHomeRate)}
          </span>}
          <span className="text-xs sm:text-sm font-mono tabular-nums text-foreground">
            {formatGBP(summary.rawTakeHome)} cash remaining from {formatWholeGBP(summary.income)}
          </span>
        </div>
        {contextualNote && (
          <p className="text-xs text-muted-foreground">{contextualNote}</p>
        )}
      </div>

      {summary.rawTakeHome < 0 && (
        <p className="text-sm text-destructive">
          These deductions exceed cash pay. The negative cash balance includes tax due on non-cash benefits.
        </p>
      )}

      {summary.income > 0 && (
        <div className="space-y-3">
          {summary.rawTakeHome >= 0 && (
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted/40 flex" aria-hidden="true">
            <div className="bg-positive" style={{ width: `${summary.shares.takeHome * 100}%` }} />
            <div className="bg-positive/45" style={{ width: `${summary.shares.pension * 100}%` }} />
            <div className="bg-chart-3" style={{ width: `${summary.shares.incomeTax * 100}%` }} />
            <div className="bg-chart-4" style={{ width: `${summary.shares.nationalInsurance * 100}%` }} />
            <div className="bg-chart-2" style={{ width: `${summary.shares.studentLoan * 100}%` }} />
          </div>
          )}

          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-mono">
            {legendItems.map(item => (
              <li key={item.key} className="flex items-center gap-1.5">
                <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm shrink-0 ${item.swatch}`} />
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-semibold tabular-nums text-foreground">{formatGBP(item.amount)}</span>
                {summary.rawTakeHome >= 0 && <span className="text-muted-foreground tabular-nums">({percent(item.share)})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.slices.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Enter a gross income above £0 to see how each band is taxed and how much you keep.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Cash impact and deductions by income slice. Negative cash impacts reduce pay from other slices.</caption>
            <thead>
              <tr className="border-b border-border/50 text-xs text-muted-foreground">
                <th scope="col" className="pb-2.5 pr-4 text-left font-normal">Slice</th>
                <th scope="col" className="pb-2.5 px-3 text-right font-normal">Gross</th>
                <th scope="col" className="pb-2.5 px-3 text-right font-normal">Income tax</th>
                <th scope="col" className="pb-2.5 px-3 text-right font-normal">NI</th>
                {showLoan && (
                  <th scope="col" className="pb-2.5 px-3 text-right font-normal">Student loan</th>
                )}
                {showPension && (
                  <th scope="col" className="pb-2.5 px-3 text-right font-normal">Pension</th>
                )}
                <th scope="col" className="pb-2.5 pl-3 text-right font-normal">Cash impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 font-mono text-xs sm:text-sm">
              {summary.slices.map(slice => (
                <tr key={`${slice.kind}-${slice.from}-${slice.to}`}>
                  <th scope="row" className="py-2.5 pr-4 text-left font-normal text-foreground align-top whitespace-nowrap">
                    <div>{sliceLabel(slice)}</div>
                    {slice.kind === 'income' && slice.kept >= 0 && <div
                      aria-hidden="true"
                      className="mt-1.5 flex h-1.5 w-full max-w-[11rem] overflow-hidden rounded-full bg-muted/40"
                    >
                      <div className="bg-positive" style={{ width: `${slice.keptRate * 100}%` }} />
                      <div className="bg-positive/45" style={{ width: `${slice.pensionRate * 100}%` }} />
                      <div className="bg-chart-3" style={{ width: `${slice.incomeTaxRate * 100}%` }} />
                      <div className="bg-chart-4" style={{ width: `${slice.nationalInsuranceRate * 100}%` }} />
                      <div className="bg-chart-2" style={{ width: `${slice.studentLoanRate * 100}%` }} />
                    </div>}
                  </th>
                  <td className="py-2.5 px-3 text-right tabular-nums text-foreground align-top whitespace-nowrap">
                    {formatWholeGBP(slice.gross)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-foreground align-top whitespace-nowrap">
                    {slice.incomeTax > 0 ? (
                      <>
                        -{formatGBP(slice.incomeTax)}
                        <span className="block text-xs text-muted-foreground">{percent(slice.incomeTaxRate)}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-foreground align-top whitespace-nowrap">
                    {slice.nationalInsurance > 0 ? (
                      <>
                        -{formatGBP(slice.nationalInsurance)}
                        <span className="block text-xs text-muted-foreground">{percent(slice.nationalInsuranceRate)}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  {showLoan && (
                    <td className="py-2.5 px-3 text-right tabular-nums text-foreground align-top whitespace-nowrap">
                      {slice.studentLoan > 0 ? (
                        <>
                          -{formatGBP(slice.studentLoan)}
                          <span className="block text-xs text-muted-foreground">{percent(slice.studentLoanRate)}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  )}
                  {showPension && (
                    <td className="py-2.5 px-3 text-right tabular-nums text-foreground align-top whitespace-nowrap">
                      {slice.pension > 0 ? (
                        <>
                          -{formatGBP(slice.pension)}
                          <span className="block text-xs text-muted-foreground">{percent(slice.pensionRate)}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  )}
                  <td className="py-2.5 pl-3 text-right tabular-nums align-top whitespace-nowrap">
                    <span className={`${slice.kept < 0 ? 'text-destructive' : 'text-positive'} font-semibold`}>{formatGBP(slice.kept)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {slice.kind === 'benefit-in-kind' ? 'Tax from cash pay' : percent(slice.keptRate)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border/70 font-mono text-xs sm:text-sm font-semibold">
                <th scope="row" className="pt-3 pr-4 text-left text-foreground align-top whitespace-nowrap">
                  Total cash pay
                </th>
                <td className="pt-3 px-3 text-right tabular-nums text-foreground align-top whitespace-nowrap">
                  {formatWholeGBP(summary.income)}
                </td>
                <td className="pt-3 px-3 text-right tabular-nums text-foreground align-top whitespace-nowrap">
                  {summary.incomeTax > 0 ? `-${formatGBP(summary.incomeTax)}` : formatGBP(0)}
                  {summary.rawTakeHome >= 0 && <span className="block text-xs font-normal text-muted-foreground">
                    {percent(summary.shares.incomeTax)}
                  </span>}
                </td>
                <td className="pt-3 px-3 text-right tabular-nums text-foreground align-top whitespace-nowrap">
                  {summary.nationalInsurance > 0 ? `-${formatGBP(summary.nationalInsurance)}` : formatGBP(0)}
                  {summary.rawTakeHome >= 0 && <span className="block text-xs font-normal text-muted-foreground">
                    {percent(summary.shares.nationalInsurance)}
                  </span>}
                </td>
                {showLoan && (
                  <td className="pt-3 px-3 text-right tabular-nums text-foreground align-top whitespace-nowrap">
                    {summary.studentLoan > 0 ? `-${formatGBP(summary.studentLoan)}` : formatGBP(0)}
                    {summary.rawTakeHome >= 0 && <span className="block text-xs font-normal text-muted-foreground">
                      {percent(summary.shares.studentLoan)}
                    </span>}
                  </td>
                )}
                {showPension && (
                  <td className="pt-3 px-3 text-right tabular-nums text-foreground align-top whitespace-nowrap">
                    {summary.pensionFromPay > 0 ? `-${formatGBP(summary.pensionFromPay)}` : formatGBP(0)}
                    {summary.rawTakeHome >= 0 && <span className="block text-xs font-normal text-muted-foreground">
                      {percent(summary.shares.pension)}
                    </span>}
                  </td>
                )}
                <td className="pt-3 pl-3 text-right tabular-nums align-top whitespace-nowrap">
                  <span className={summary.rawTakeHome < 0 ? 'text-destructive' : 'text-positive'}>{formatGBP(summary.rawTakeHome)}</span>
                  {summary.rawTakeHome >= 0 && <span className="block text-xs font-normal text-muted-foreground">
                    {percent(summary.takeHomeRate)}
                  </span>}
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            Negative cash impacts are paid from the other income slices. Benefits in kind add taxable value, not cash pay.
          </p>
        </div>
      )}
    </section>
  );
}

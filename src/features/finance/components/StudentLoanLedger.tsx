/**
 * What a student loan costs and what repays it, month by month and by tax
 * year: the repayments against the interest added, and what that does to the
 * amount owed. Every figure is a field of `studentLoanLedger`, itself a
 * transform of the simulation; this only lays it out.
 */

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatDayMonth, formatMonthYear } from '@/lib/format-date';
import { formatGBP } from '@/features/finance/utils/calculations';
import { studentLoanLedger, type StudentLoanSimResult } from '@/lib/finance';
import { PillSwitch } from './PillSwitch';

type View = 'month' | 'year';

const VIEWS = [
  { key: 'month', label: 'By month' },
  { key: 'year', label: 'By tax year' },
] as const;

const signed = (amount: number) => `${amount < 0 ? '−' : '+'}${formatGBP(Math.abs(amount))}`;

/** A small note after a figure. */
const Tag = ({ children }: { children: string }) => (
  <span className="ml-1 text-xs text-muted-foreground">{children}</span>
);

const numeric = 'py-1 pl-3 text-right tabular-nums whitespace-nowrap';
const head = 'pb-2 pl-3 text-right font-normal';

export function StudentLoanLedger({
  result,
  today,
  anchorDate,
}: {
  result: StudentLoanSimResult;
  today: string;
  /** The date of the SLC balance the run starts from; unset when it starts from anything else. */
  anchorDate?: string;
}) {
  const [view, setView] = useState<View>('month');
  const { months, taxYears } = useMemo(() => studentLoanLedger(result), [result]);

  const thisMonth = `${today.slice(0, 7)}-01`;
  const nowIndex = months.findIndex(m => m.date === thisMonth);
  const now = nowIndex >= 0 ? months[nowIndex] : undefined;

  // A year back to a year ahead; the whole run when today is outside it.
  const centre = nowIndex >= 0 ? nowIndex : thisMonth < (months[0]?.date ?? '') ? 0 : months.length - 1;
  const rows = months.slice(Math.max(0, centre - 11), centre + 13);
  const showDrawn = rows.some(m => m.drawn + m.refunded !== 0);
  // Borrowing and refunds are named so that interest, less repaid, plus these is the change stated.
  const moved = now ? [
    now.drawn !== 0 && `${formatGBP(now.drawn)} borrowed`,
    now.refunded !== 0 && `${formatGBP(now.refunded)} refunded to you`,
  ].filter(Boolean) : [];

  return (
    <section aria-label="Repaid and interest" className="surface-card space-y-4 rounded-3xl border p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-lg font-semibold">Repaid and interest</h3>
          {now?.phase === 'repayment' && (
            <p className="text-sm text-muted-foreground">
              {now.anchored && anchorDate ? `Since SLC's balance on ${formatDayMonth(anchorDate)}, about` : 'This month about'}
              {' '}{formatGBP(now.interestAccrued)} of interest is added against {formatGBP(now.repaid + now.paidExtra)} repaid
              {moved.length > 0 && `, with ${moved.join(' and ')}`},
              so what you owe {now.owedChange >= 0 ? 'rises' : 'falls'} by {formatGBP(Math.abs(now.owedChange))}.
              {now.topUpAccrued > 0 && ` ${formatGBP(now.topUpAccrued)} of that interest is added by SLC later, once HMRC confirms your income.`}
            </p>
          )}
        </div>
        <PillSwitch label="Ledger view" options={VIEWS} value={view} onChange={setView} className="shrink-0 self-start" />
      </div>

      <div className="overflow-x-auto">
        {view === 'month' ? (
          <table className="w-full min-w-[30rem] text-sm">
            <caption className="sr-only">Repaid, interest and balance by month</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="pb-2 font-normal">Month</th>
                {showDrawn && <th scope="col" className={head}>Borrowed or refunded</th>}
                <th scope="col" className={head}>Repaid</th>
                <th scope="col" className={head}>Interest</th>
                <th scope="col" className={head}>Net</th>
                <th scope="col" className={head}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(m => (
                <tr key={m.date} className={cn(m.date === thisMonth && 'bg-muted/30')}>
                  <th scope="row" className="py-1 pr-3 text-left font-normal text-muted-foreground whitespace-nowrap">
                    {formatMonthYear(m.date)}
                    {m.anchored && <Tag>SLC balance</Tag>}
                  </th>
                  {showDrawn && <td className={numeric}>{formatGBP(m.drawn + m.refunded)}</td>}
                  <td className={numeric}>
                    {formatGBP(m.repaid + m.paidExtra)}
                    {(m.paymentSource === 'modelled' || m.date > thisMonth) && <Tag>est.</Tag>}
                  </td>
                  <td className={numeric}>{formatGBP(m.interestAccrued)}</td>
                  <td className={numeric}>{signed(m.owedChange)}</td>
                  <td className={numeric}>{formatGBP(m.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[26rem] text-sm">
            <caption className="sr-only">Repaid, interest and closing balance by tax year</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="pb-2 font-normal">Tax year</th>
                <th scope="col" className={head}>Repaid</th>
                <th scope="col" className={head}>Interest</th>
                <th scope="col" className={head}>Net</th>
                <th scope="col" className={head}>Closing balance</th>
              </tr>
            </thead>
            <tbody>
              {taxYears.map(y => (
                <tr key={y.taxYear}>
                  <th scope="row" className="py-1 pr-3 text-left font-normal text-muted-foreground whitespace-nowrap">
                    {y.taxYear}–{String(y.taxYear + 1).slice(2)}
                    {y.containsAnchor && <Tag>SLC balance</Tag>}
                  </th>
                  <td className={numeric}>
                    {formatGBP(y.repaid + y.paidExtra)}
                    {y.repaidModelled > 0 && <Tag>part est.</Tag>}
                  </td>
                  <td className={numeric}>{formatGBP(y.interestAccrued)}</td>
                  <td className={numeric}>{signed(y.owedChange)}</td>
                  <td className={numeric}>{formatGBP(y.closingBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Interest includes the income-linked part SLC adds once HMRC confirms the year&apos;s income, so Net is the change in what you owe;
        Balance is what SLC shows, which leaves that part out until it lands.
      </p>
    </section>
  );
}

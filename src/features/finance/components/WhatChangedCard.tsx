/**
 * The dashboard's short, deterministic ledger comparison.
 *
 * The numbers and windows come from `deriveFinanceChangeSummary`; this file
 * only decides how to phrase and arrange them. That keeps “what changed?” as
 * reproducible as every other financial figure on the page.
 */

import { ArrowDownRight, ArrowUpRight, Equal, ReceiptText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatGBP } from '@/features/finance/utils/calculations';
import { cn } from '@/lib/utils';
import type { FinanceChangeSummary } from '@/lib/finance';
import { Figure } from './Figure';

type Kind = 'income' | 'spending' | 'net';

const changeLabel = (amount: number, kind: Kind): string => {
  if (amount === 0) return 'No change';
  const value = formatGBP(Math.abs(amount));
  if (kind === 'income') return `${value} ${amount > 0 ? 'more' : 'less'} received`;
  if (kind === 'spending') return `${value} ${amount > 0 ? 'more' : 'less'} spent`;
  return `${value} ${amount > 0 ? 'higher' : 'lower'}`;
};

const changeTone = (amount: number, kind: Kind): string => {
  if (amount === 0) return 'text-muted-foreground';
  const favourable = kind === 'spending' ? amount < 0 : amount > 0;
  return favourable ? 'text-positive' : 'text-destructive';
};

const Change = ({ amount, kind }: { amount: number; kind: Kind }) => {
  const Icon = amount === 0 ? Equal : amount > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn('flex items-center gap-1 text-xs tabular-nums', changeTone(amount, kind))}
      aria-label={changeLabel(amount, kind)}
      title={changeLabel(amount, kind)}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{amount === 0 ? 'No change' : formatGBP(Math.abs(amount))}</span>
    </span>
  );
};

export function WhatChangedCard({ summary, loading }: { summary: FinanceChangeSummary; loading?: boolean }) {
  const hasCurrentData = summary.current.transactionCount > 0;
  const topChange = summary.largestSpendingChange;
  const metrics: { label: string; value: number; delta: number; kind: Kind }[] = [
    { label: 'Received', value: summary.current.income, delta: summary.deltas.income, kind: 'income' },
    { label: 'Spent', value: summary.current.spending, delta: summary.deltas.spending, kind: 'spending' },
    { label: 'Net', value: summary.current.net, delta: summary.deltas.net, kind: 'net' },
  ];

  return (
    <Card data-palette="sage" className="surface-card rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors">
      <CardHeader className="flex-row items-start gap-2 space-y-0 border-b border-border/30 p-0 pb-4">
        <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">What changed</CardTitle>
          <CardDescription className="mt-0.5 text-xs text-muted-foreground font-mono">
            {summary.currentPeriod.label} against {summary.previousPeriod.label}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-0 pt-4 font-mono">
        {!hasCurrentData && !loading ? (
          <p className="text-xs text-muted-foreground">
            No transactions recorded in this period yet. Sync a bank or import a statement to start the comparison.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {metrics.map(({ label, value, delta, kind }) => (
                <div key={label} className="min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <Figure loading={loading} skeletonClassName="h-4 w-14">
                    <span className="block truncate text-xs font-semibold text-foreground tabular-nums">{formatGBP(value)}</span>
                  </Figure>
                  {summary.hasComparison ? <Change amount={delta} kind={kind} /> : null}
                </div>
              ))}
            </div>

            {summary.hasComparison ? (
              topChange ? (
                <p className="border-t border-border/30 pt-3 text-xs text-muted-foreground">
                  <span className="text-foreground">{topChange.category}</span> changed most: {formatGBP(Math.abs(topChange.change))}{' '}
                  {topChange.change > 0 ? 'more' : 'less'} spent.
                </p>
              ) : (
                <p className="border-t border-border/30 pt-3 text-xs text-muted-foreground">
                  Category spending is unchanged from the comparable period.
                </p>
              )
            ) : (
              <p className="border-t border-border/30 pt-3 text-xs text-muted-foreground">
                Import or sync earlier history to compare this period with the previous month.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

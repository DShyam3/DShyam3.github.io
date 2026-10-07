import React from 'react';
import { RecurringBill } from '@/features/finance/finance-types';
import { Check, Plus, Edit2, Trash2 } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { RecurringCandidate } from '@/lib/finance/recurring-detection';

interface RecurringsTabProps {
  recurrings: RecurringBill[];
  candidates: RecurringCandidate[];
  onReviewCandidate: (candidate: RecurringCandidate) => void;
  onDismissCandidate: (candidate: RecurringCandidate) => void;
  busy?: boolean;
  detectionUnavailable?: boolean;
  paymentEvidence?: ReadonlyMap<string, { date: string; amount: number }>;
  currentMonth: number;
  formatGBP: (num: number) => string;
  onOpenAddModal: () => void;
  onTogglePaid: (id: string) => void;
  onEditRecurring: (bill: RecurringBill) => void;
  onDeleteRecurring: (id: string) => void;
}

const isDueThisMonth = (bill: RecurringBill, currentMonth: number): boolean => {
  if (bill.frequency === 'monthly') return true;
  if (bill.frequency === 'weekly') return true;
  if (bill.frequency === 'annually' && bill.dueMonth === currentMonth) return true;
  if (bill.frequency === 'quarterly') {
    const startMonth = bill.dueMonth || 1;
    return (currentMonth - startMonth) % 3 === 0;
  }
  return false;
};

const getDueDateText = (bill: RecurringBill, currentMonth: number, displayMonth?: number): string => {
  const monthToUse = displayMonth || currentMonth;
  const monthStr = new Date(2026, monthToUse - 1, 1).toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
  const dayStr = String(bill.dueDate).padStart(2, '0');
  return `${dayStr} ${monthStr}`;
};

export const RecurringsTab: React.FC<RecurringsTabProps> = ({
  recurrings,
  candidates,
  onReviewCandidate,
  onDismissCandidate,
  busy = false,
  detectionUnavailable = false,
  paymentEvidence,
  currentMonth,
  formatGBP,
  onOpenAddModal,
  onTogglePaid,
  onEditRecurring,
  onDeleteRecurring,
}) => {
  const activeBills = recurrings.filter(bill => !bill.status || bill.status === 'active');
  const inactiveBills = recurrings.filter(bill => bill.status === 'inactive' || bill.status === 'dismissed');
  const thisMonthBills = activeBills.filter(r => isDueThisMonth(r, currentMonth));
  const todayDay = new Date().getDate();
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

  interface DisplayBill extends RecurringBill {
    displayMonth?: number;
  }

  const futureBills: DisplayBill[] = [];
  activeBills.forEach(r => {
    const isDueThis = isDueThisMonth(r, currentMonth);
    if (!isDueThis) {
      futureBills.push({
        ...r,
        displayMonth: r.dueMonth || nextMonth
      });
    } else {
      if (todayDay >= 25 && r.dueDate <= 7) {
        futureBills.push({
          ...r,
          displayMonth: nextMonth
        });
      }
    }
  });

  const totalAmount = thisMonthBills.reduce((sum, r) => sum + r.amount, 0);
  const paidAmount = thisMonthBills.filter(r => r.isPaid).reduce((sum, r) => sum + r.amount, 0);
  const leftAmount = Math.max(0, totalAmount - paidAmount);

  const recurringCategoryData = thisMonthBills.reduce((acc, bill) => {
    const cat = bill.category || 'Other';
    const existing = acc.find(item => item.name === cat);
    if (existing) {
      existing.value += bill.amount;
    } else {
      acc.push({ name: cat, value: bill.amount });
    }
    return acc;
  }, [] as { name: string; value: number }[])
  .map((item, idx) => ({
    ...item,
    color: [
      'hsl(var(--chart-3))',
      'hsl(var(--positive))',
      'hsl(var(--chart-4))',
      'hsl(var(--destructive))',
      'hsl(var(--chart-5))',
      'hsl(var(--chart-5))',
      'hsl(var(--chart-2))',
      'hsl(var(--chart-4))',
    ][idx % 8]
  }));

  const recurringPieData = recurringCategoryData.length > 0
    ? recurringCategoryData
    : [{ name: 'No bills', value: 1, color: 'hsl(var(--muted))' }];

  return (
    <div className="space-y-6">
      {/* Recurrings Header */}
      <div className="flex items-center gap-3 border-b border-border/50 pb-4">
        <h3 className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">
          Recurrings
        </h3>
        <Button variant="outline" size="sm" onClick={onOpenAddModal} disabled={busy} className="text-xs font-mono">
          <Plus className="h-4 w-4 mr-2" /> Add manually
        </Button>
      </div>

      <section className="surface-card bg-card/50 border border-border/40 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-semibold font-mono">Suggested recurring payments ({candidates.length})</h4>
        <p className="text-xs text-muted-foreground">
          Detected from repeated payments in your imported bank records. Confirm each suggestion before it joins your schedule.
          A payment last seen in records does not prove the subscription is still active.
        </p>
        {detectionUnavailable ? (
          <p className="text-xs text-muted-foreground">Suggestions are unavailable until transactions and transfer checks finish loading.</p>
        ) : candidates.length === 0 && (
          <p className="text-xs text-muted-foreground">No new recurring payments detected. Import more bank records or add a payment manually.</p>
        )}
        {!detectionUnavailable && candidates.map(candidate => (
          <div key={candidate.key} className="border-t border-border/40 pt-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-semibold break-words">{candidate.name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {formatGBP(candidate.amount)} · {candidate.frequency} · Last seen: {candidate.lastPaidDate}
                </p>
                {candidate.stale && <p className="text-xs text-muted-foreground">May have stopped</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="text-xs" disabled={busy} onClick={() => onReviewCandidate(candidate)}>Review</Button>
                <Button size="sm" variant="outline" className="text-xs" disabled={busy} onClick={() => onDismissCandidate(candidate)}>Not recurring</Button>
              </div>
            </div>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Payment history ({candidate.payments.length})</summary>
              <ul className="mt-2 space-y-1">
                {candidate.payments.map(payment => (
                  <li key={payment.id} className="flex flex-wrap justify-between gap-2 font-mono">
                    <span>{payment.date} · {payment.name}</span><span>{formatGBP(Math.abs(payment.amount))}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ))}
      </section>

      <div className="space-y-8">
        {/* Progress Card */}
        <div className="surface-card bg-card/50 border border-border/40 rounded-lg p-6 md:p-8 flex flex-col sm:flex-row items-center justify-around gap-6 hover:border-border/80 transition-colors">
          <div className="text-center sm:text-left space-y-1">
            <span className="text-3xl md:text-4xl font-bold font-mono text-foreground block">
              {formatGBP(leftAmount)}
            </span>
            <span className="text-xs text-muted-foreground block font-sans font-medium uppercase tracking-wider">
              left to pay
            </span>
          </div>

          <div className="w-24 h-24 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={recurringPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={38}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="none"
                >
                  {recurringPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(v: number) => formatGBP(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="text-center sm:text-right space-y-1">
            <span className="text-3xl md:text-4xl font-bold font-mono text-foreground block">
              {formatGBP(paidAmount)}
            </span>
            <span className="text-xs text-muted-foreground block font-sans font-medium uppercase tracking-wider">
              paid so far
            </span>
          </div>
        </div>

        {inactiveBills.length > 0 && (
          <section className="surface-card bg-card/50 rounded-lg border border-border/40 p-4 space-y-3">
            <h4 className="text-sm font-semibold font-mono">Inactive / dismissed ({inactiveBills.length})</h4>
            <p className="text-xs text-muted-foreground">Excluded from your recurring schedule. Edit an entry to make it active again.</p>
            {inactiveBills.map(bill => (
              <div key={bill.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
                <div className="text-xs space-y-1">
                  <p className="font-semibold">{bill.name} · {bill.status === 'dismissed' ? 'Not recurring' : 'Inactive'}</p>
                  {bill.lastPaidDate && <p className="text-muted-foreground">Last paid (confirmed): {bill.lastPaidDate}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-xs" disabled={busy} onClick={() => onEditRecurring(bill)}>Edit / restore</Button>
                  <Button size="sm" variant="outline" className="text-xs text-destructive" disabled={busy} onClick={() => onDeleteRecurring(bill.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Grouped Lists */}
        <div className="space-y-8">
          {/* Section 1: Due This Month */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider font-mono">
                Due this month ({thisMonthBills.length})
              </h4>
              <span className="text-xs font-mono font-medium text-muted-foreground">
                Total: {formatGBP(totalAmount)}
              </span>
            </div>

            <div className="surface-card bg-card/50 rounded-lg border border-border/40 p-4 space-y-1 hover:border-border/80 transition-colors">
              {thisMonthBills.map(bill => {
                const dueDateText = getDueDateText(bill, currentMonth);
                return (
                  <div
                    key={bill.id}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-0 py-2 border-b border-border/5 last:border-b-0"
                  >
                    <div className="flex items-center gap-6 min-w-0 flex-1">
                      <span className="shrink-0 w-16 text-muted-foreground/60 font-mono text-xs">
                        {dueDateText}
                      </span>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {bill.emoji && <span className="shrink-0 text-sm">{bill.emoji}</span>}
                          <span className="flex items-baseline gap-1 min-w-0">
                            <span className={cn("font-semibold text-xs truncate", bill.isPaid ? "line-through text-muted-foreground/50" : "text-foreground")}>
                              {bill.name}
                            </span>
                            {bill.provider && (
                              <span className="text-xs text-muted-foreground font-normal truncate max-w-[50%]">· {bill.provider}</span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground/50 lowercase font-normal shrink-0">
                            {bill.frequency}
                          </span>
                        </div>
                        {bill.lastPaidDate && <p className="text-xs text-muted-foreground">Last paid (confirmed): {bill.lastPaidDate}</p>}
                        {paymentEvidence?.has(bill.id) && (
                          <p className="text-xs text-muted-foreground">
                            Last seen in records: {paymentEvidence.get(bill.id)!.date} · {formatGBP(paymentEvidence.get(bill.id)!.amount)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0 justify-between sm:justify-end sm:ml-auto">
                      <div className="flex items-center gap-0.5 card-actions transition-opacity mr-2">
                        <button
                          disabled={busy}
                          onClick={() => onEditRecurring(bill)}
                          className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => onDeleteRecurring(bill.id)}
                          className="text-destructive hover:text-destructive p-1 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      <span className={cn("px-2 py-0.5 rounded-sm text-xs font-mono uppercase border border-border/30 bg-muted/20 text-muted-foreground flex items-center gap-1")}>
                        {bill.emoji && <span>{bill.emoji}</span>}
                        {bill.tag || bill.category || 'BILL'}
                      </span>

                      <span className={cn("font-mono font-bold text-xs w-20 text-right", bill.isPaid ? "text-muted-foreground/50 line-through" : "text-foreground")}>
                        {formatGBP(bill.amount)}
                      </span>

                      <button
                        disabled={busy}
                        onClick={() => onTogglePaid(bill.id)}
                        className={cn(
                          "w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0",
                          bill.isPaid
                            ? "bg-positive border-positive text-white"
                            : "border-border/40 hover:border-primary/50 bg-background/50"
                        )}
                        title={bill.isPaid ? "Mark as unpaid" : "Mark as paid"}
                      >
                        {bill.isPaid && <Check className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                );
              })}

              {thisMonthBills.length === 0 && (
                <p className="text-xs text-muted-foreground italic py-6 text-center">No recurring bills due this month.</p>
              )}
            </div>
          </div>

          {/* Section 2: Future Bills */}
          <div>
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider font-mono mb-4">
              Future / Scheduled ({futureBills.length})
            </h4>

            <div className="surface-card bg-card/50 rounded-lg border border-border/40 p-4 space-y-1 hover:border-border/80 transition-colors">
              {futureBills.map(bill => {
                const dueDateText = getDueDateText(bill, currentMonth, bill.displayMonth);
                return (
                  <div
                    key={bill.id}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-0 py-2 border-b border-border/5 last:border-b-0"
                  >
                    <div className="flex items-center gap-6 min-w-0 flex-1">
                      <span className="shrink-0 w-16 text-muted-foreground/60 font-mono text-xs">
                        {dueDateText}
                      </span>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {bill.emoji && <span className="shrink-0 text-sm">{bill.emoji}</span>}
                          <span className="flex items-baseline gap-1 min-w-0">
                            <span className="font-semibold text-xs text-foreground truncate">
                              {bill.name}
                            </span>
                            {bill.provider && (
                              <span className="text-xs text-muted-foreground font-normal truncate max-w-[50%]">· {bill.provider}</span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground/50 lowercase font-normal shrink-0">
                            {bill.frequency}
                          </span>
                        </div>
                        {bill.lastPaidDate && <p className="text-xs text-muted-foreground">Last paid (confirmed): {bill.lastPaidDate}</p>}
                        {paymentEvidence?.has(bill.id) && (
                          <p className="text-xs text-muted-foreground">
                            Last seen in records: {paymentEvidence.get(bill.id)!.date} · {formatGBP(paymentEvidence.get(bill.id)!.amount)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0 justify-between sm:justify-end sm:ml-auto">
                      <div className="flex items-center gap-0.5 card-actions transition-opacity mr-2">
                        <button
                          disabled={busy}
                          onClick={() => onEditRecurring(bill)}
                          className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => onDeleteRecurring(bill.id)}
                          className="text-destructive hover:text-destructive p-1 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      <span className={cn("px-2 py-0.5 rounded-sm text-xs font-mono uppercase border border-border/30 bg-muted/20 text-muted-foreground flex items-center gap-1")}>
                        {bill.emoji && <span>{bill.emoji}</span>}
                        {bill.tag || bill.category || 'BILL'}
                      </span>

                      <span className="font-mono font-bold text-xs text-foreground w-20 text-right">
                        {formatGBP(bill.amount)}
                      </span>

                      <div className="w-5" />
                    </div>
                  </div>
                );
              })}

              {futureBills.length === 0 && (
                <p className="text-xs text-muted-foreground italic py-6 text-center">No future bills scheduled.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

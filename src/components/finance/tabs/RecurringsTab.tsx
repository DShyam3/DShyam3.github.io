import React from 'react';
import { RecurringBill } from '@/types/finance';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { cn } from '@/lib/utils';

interface RecurringsTabProps {
  recurrings: RecurringBill[];
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
  currentMonth,
  formatGBP,
  onOpenAddModal,
  onTogglePaid,
  onEditRecurring,
  onDeleteRecurring,
}) => {
  const getTagColor = (category: string | undefined) => {
    switch (category?.toLowerCase()) {
      case 'rent':
      case 'housing':
        return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
      case 'subscriptions':
      case 'video entertainment':
        return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
      case 'gym':
        return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
      case 'donations':
        return 'bg-orange-500/10 text-orange-500 border border-orange-500/20';
      case 'insurance':
        return 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20';
      case 'groceries':
      case 'needs':
        return 'bg-teal-500/10 text-teal-500 border border-teal-500/20';
      default:
        return 'bg-muted/30 text-muted-foreground border border-border/30';
    }
  };

  const thisMonthBills = recurrings.filter(r => isDueThisMonth(r, currentMonth));
  const todayDay = new Date().getDate();
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

  interface DisplayBill extends RecurringBill {
    displayMonth?: number;
  }

  const futureBills: DisplayBill[] = [];
  recurrings.forEach(r => {
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
      '#3b82f6',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#ec4899',
      '#14b8a6',
      '#f97316',
    ][idx % 8]
  }));

  const recurringPieData = recurringCategoryData.length > 0
    ? recurringCategoryData
    : [{ name: 'No bills', value: 1, color: 'rgba(255,255,255,0.1)' }];

  return (
    <div className="space-y-6">
      {/* Recurrings Header */}
      <div className="flex items-center gap-3 border-b border-border/50 pb-4">
        <h3 className="font-serif text-lg font-semibold text-foreground">
          Recurrings
        </h3>
        <button
          onClick={onOpenAddModal}
          className="h-7 w-7 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center text-foreground transition-colors"
          title="Add Recurring Bill"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-8">
        {/* Progress Card */}
        <div className="bg-card/20 backdrop-blur-sm border border-primary/10 rounded-[2rem] p-6 md:p-8 flex flex-col sm:flex-row items-center justify-around gap-6">
          <div className="text-center sm:text-left space-y-1">
            <span className="text-3xl md:text-4xl font-extrabold font-mono text-foreground block">
              {formatGBP(leftAmount)}
            </span>
            <span className="text-[10px] text-muted-foreground block font-sans font-medium uppercase tracking-wider">
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
            <span className="text-3xl md:text-4xl font-extrabold font-mono text-foreground block">
              {formatGBP(paidAmount)}
            </span>
            <span className="text-[10px] text-muted-foreground block font-sans font-medium uppercase tracking-wider">
              paid so far
            </span>
          </div>
        </div>

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

            <div className="bg-card/40 backdrop-blur-sm rounded-2xl border border-primary/10 p-4 space-y-1">
              {thisMonthBills.map(bill => {
                const dueDateText = getDueDateText(bill, currentMonth);
                return (
                  <div
                    key={bill.id}
                    className="group flex items-center justify-between py-2 border-b border-border/5 last:border-b-0"
                  >
                    <div className="flex items-center gap-6 min-w-0 flex-1">
                      <span className="shrink-0 w-16 text-muted-foreground/60 font-mono text-[11px]">
                        {dueDateText}
                      </span>
                      <div className="flex items-center gap-2 min-w-0">
                        {bill.emoji && <span className="shrink-0 text-sm">{bill.emoji}</span>}
                        <span className={cn("font-semibold text-xs truncate", bill.isPaid ? "line-through text-muted-foreground/50" : "text-foreground")}>
                          {bill.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50 lowercase font-normal shrink-0">
                          {bill.frequency}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex mr-2">
                        <button
                          onClick={() => onEditRecurring(bill)}
                          className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => onDeleteRecurring(bill.id)}
                          className="text-rose-500 hover:text-rose-600 p-1 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      <span className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase font-mono shadow-sm flex items-center gap-1", getTagColor(bill.category))}>
                        {bill.emoji && <span>{bill.emoji}</span>}
                        {bill.tag || bill.category || 'BILL'}
                      </span>

                      <span className={cn("font-mono font-bold text-xs w-20 text-right", bill.isPaid ? "text-muted-foreground/50 line-through" : "text-foreground")}>
                        {formatGBP(bill.amount)}
                      </span>

                      <button
                        onClick={() => onTogglePaid(bill.id)}
                        className={cn(
                          "w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0",
                          bill.isPaid
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-border/40 hover:border-primary/50 bg-background/50"
                        )}
                        title={bill.isPaid ? "Mark as unpaid" : "Mark as paid"}
                      >
                        {bill.isPaid && <span className="text-xs">✓</span>}
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

            <div className="bg-card/40 backdrop-blur-sm rounded-2xl border border-primary/10 p-4 space-y-1">
              {futureBills.map(bill => {
                const dueDateText = getDueDateText(bill, currentMonth, bill.displayMonth);
                return (
                  <div
                    key={bill.id}
                    className="group flex items-center justify-between py-2 border-b border-border/5 last:border-b-0"
                  >
                    <div className="flex items-center gap-6 min-w-0 flex-1">
                      <span className="shrink-0 w-16 text-muted-foreground/60 font-mono text-[11px]">
                        {dueDateText}
                      </span>
                      <div className="flex items-center gap-2 min-w-0">
                        {bill.emoji && <span className="shrink-0 text-sm">{bill.emoji}</span>}
                        <span className="font-semibold text-xs text-foreground truncate">
                          {bill.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50 lowercase font-normal shrink-0">
                          {bill.frequency}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex mr-2">
                        <button
                          onClick={() => onEditRecurring(bill)}
                          className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => onDeleteRecurring(bill.id)}
                          className="text-rose-500 hover:text-rose-600 p-1 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      <span className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase font-mono shadow-sm flex items-center gap-1", getTagColor(bill.category))}>
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

import React, { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RecurringBill } from '@/features/finance/finance-types';
import { getDaysInMonth, getStartDayOfWeek } from '@/lib/finance/dates';
import {
  occurrenceTotals,
  scheduleBills,
  type BillOccurrence,
  type BillOccurrenceStatus,
} from '@/lib/finance/bill-schedule';

interface BillsCalendarProps {
  recurrings: RecurringBill[];
  paymentEvidence?: ReadonlyMap<string, { date: string; amount: number }>;
  formatGBP: (n: number) => string;
}

/** The shown month runs from the current month to this many months ahead. */
const MAX_MONTHS_AHEAD = 11;

const STATUS_TONE: Record<BillOccurrenceStatus, string> = {
  overdue: 'text-chart-4',
  due: 'text-foreground',
  seen: 'text-muted-foreground',
  paid: 'text-positive',
};

// "Not confirmed" is deliberate: an overdue row is usually a payment the app
// could not match, not a missed bill.
const STATUS_LABEL: Record<BillOccurrenceStatus, string> = {
  paid: 'Paid',
  seen: 'Seen in bank',
  overdue: 'Not confirmed',
  due: 'Due',
};

/** Worst first: the marker on a day takes the tone of the first status found. */
const STATUS_SEVERITY: BillOccurrenceStatus[] = ['overdue', 'due', 'seen', 'paid'];

const pad = (n: number): string => String(n).padStart(2, '0');

const billCount = (n: number): string => `${n} ${n === 1 ? 'bill' : 'bills'}`;

export const BillsCalendar: React.FC<BillsCalendarProps> = ({ recurrings, paymentEvidence, formatGBP }) => {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  const [todayYear, todayMonth] = today.split('-').map(Number);
  const shown = new Date(todayYear, todayMonth - 1 + monthOffset, 1);
  const year = shown.getFullYear();
  const monthIndex = shown.getMonth();
  const daysInMonth = getDaysInMonth(year, monthIndex);
  const startDayOfWeek = getStartDayOfWeek(year, monthIndex);
  const from = `${year}-${pad(monthIndex + 1)}-01`;
  const to = `${year}-${pad(monthIndex + 1)}-${pad(daysInMonth)}`;

  const evidence = useMemo(
    () => new Map([...(paymentEvidence ?? [])].map(([id, payment]) => [id, payment.date] as const)),
    [paymentEvidence],
  );

  const { occurrences, unplaced } = useMemo(
    () => scheduleBills(recurrings, from, to, today, evidence),
    [recurrings, evidence, from, to, today],
  );

  const byDate = useMemo(() => {
    const grouped = new Map<string, BillOccurrence[]>();
    for (const occurrence of occurrences) {
      const day = grouped.get(occurrence.date);
      if (day) day.push(occurrence);
      else grouped.set(occurrence.date, [occurrence]);
    }
    return grouped;
  }, [occurrences]);

  const monthTotals = occurrenceTotals(occurrences);
  // A selection that no longer holds a bill (the data changed) filters nothing.
  const activeDay = selectedDay && byDate.has(selectedDay) ? selectedDay : null;
  const listed = activeDay ? byDate.get(activeDay)! : occurrences;
  const monthName = format(shown, 'MMMM');

  const changeMonth = (step: number) => {
    setMonthOffset(offset => Math.min(MAX_MONTHS_AHEAD, Math.max(0, offset + step)));
    setSelectedDay(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Previous month"
          disabled={monthOffset === 0}
          onClick={() => changeMonth(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-mono font-semibold text-foreground" aria-live="polite">
          {monthName} {year}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Next month"
          disabled={monthOffset === MAX_MONTHS_AHEAD}
          onClick={() => changeMonth(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-mono text-foreground">
        <span>{formatGBP(monthTotals.scheduled)} scheduled · {formatGBP(monthTotals.outstanding)} still to pay</span>
        <Badge variant="outline" className="text-xs font-mono border-border/40 text-muted-foreground">Forecast</Badge>
      </div>

      <div>
        <div className="grid grid-cols-7 gap-1 mb-1 text-xs font-mono font-semibold text-muted-foreground text-center">
          <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} aria-hidden="true" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const date = `${year}-${pad(monthIndex + 1)}-${pad(dayNum)}`;
            const bills = byDate.get(date) ?? [];
            const totals = occurrenceTotals(bills);
            const worst = STATUS_SEVERITY.find(status => bills.some(bill => bill.status === status));
            const isSelected = activeDay === date;
            const label = bills.length === 0
              ? `${dayNum} ${monthName}, no bills`
              : `${dayNum} ${monthName}, ${billCount(bills.length)}, ${formatGBP(totals.scheduled)}${
                  worst ? `, ${STATUS_LABEL[worst].toLowerCase()}` : ''
                }`;

            return (
              <button
                key={date}
                type="button"
                aria-label={label}
                aria-pressed={isSelected}
                aria-current={date === today ? 'date' : undefined}
                disabled={bills.length === 0}
                onClick={() => setSelectedDay(isSelected ? null : date)}
                className={cn(
                  'flex min-h-11 min-w-0 flex-col items-center gap-0.5 overflow-hidden rounded-sm border border-border/30 bg-muted/20 p-1 text-xs font-mono sm:min-h-14',
                  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  bills.length > 0 && 'hover:bg-muted/40',
                  isSelected && 'border-border/70 bg-muted/40',
                  date === today && 'ring-1 ring-primary',
                )}
              >
                <span className="font-medium text-foreground">{dayNum}</span>
                {worst && (
                  <span className={cn('flex w-full min-w-0 justify-center', STATUS_TONE[worst])}>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-0.5 h-2 w-2 rounded-full sm:hidden',
                        worst === 'overdue' ? 'border-2 border-current' : 'bg-current',
                      )}
                    />
                    <span aria-hidden="true" className="hidden max-w-full truncate font-semibold sm:block">
                      {bills.length === 1 ? formatGBP(bills[0].amount) : billCount(bills.length)}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {listed.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-4 text-center">No bills scheduled this month.</p>
      ) : (
        <ul>
          {listed.map(occurrence => (
            <li
              key={`${occurrence.billId}-${occurrence.date}`}
              className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 border-t border-border/40 py-2 text-xs font-mono sm:grid-cols-[3.5rem_minmax(0,1fr)_auto_7rem]"
            >
              <span className="text-muted-foreground">{format(parseISO(occurrence.date), 'd MMM')}</span>
              <span className="flex min-w-0 items-center gap-2">
                {occurrence.emoji && <span className="shrink-0 text-sm">{occurrence.emoji}</span>}
                <span className="truncate font-semibold text-foreground">
                  {occurrence.name}
                  {occurrence.provider && (
                    <span className="font-normal text-muted-foreground"> · {occurrence.provider}</span>
                  )}
                </span>
              </span>
              <div className="col-start-2 flex items-center justify-between gap-3 sm:contents">
                <span className="font-bold text-foreground sm:text-right">{formatGBP(occurrence.amount)}</span>
                <span className={cn('text-right', STATUS_TONE[occurrence.status])}>{STATUS_LABEL[occurrence.status]}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {unplaced.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Can't place on the calendar: {unplaced.map(bill => bill.name).join(', ')}. Check each one's amount and due date; a weekly bill also needs one payment marked paid.
        </p>
      )}
    </div>
  );
};

import { cn } from '@/lib/utils';
import type { FinanceSettings } from '@/features/finance/finance-types';
import type { getNextPaydayDetails } from '@/features/finance/finance-calcs';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ordinal = (n: number) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

/** The configured pay schedule as a short phrase. Defaults match `getNextPaydayDetails`. */
export function paydayScheduleLabel(
  settings: Pick<FinanceSettings, 'paydaySchedule' | 'payDayOfMonth' | 'paydayWeekday'>,
): string {
  switch (settings.paydaySchedule) {
    case 'last_working_day': return 'Last working day';
    case 'last_friday': return 'Last Friday of the month';
    case 'biweekly': return 'Every two weeks';
    case 'weekly': return `Every ${WEEKDAYS[settings.paydayWeekday ?? 5]}`;
    case 'semimonthly': return '15th and last working day';
    default: return `Monthly on the ${ordinal(settings.payDayOfMonth || 25)}`;
  }
}

/** Days to payday as a phrase, shared by every place that shows the countdown. */
export const paydayCountdown = (daysRemaining: number): string =>
  daysRemaining === 0 ? 'Paid today' : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`;

interface PaydaySummaryProps {
  settings: Pick<FinanceSettings, 'paydaySchedule' | 'payDayOfMonth' | 'paydayWeekday'>;
  nextPayday: ReturnType<typeof getNextPaydayDetails>;
}

/**
 * Next payday for the income hero's secondary slot. It sits beside the year's
 * take-home because the two answer one question -- what arrives, and when --
 * which a separate card made the reader assemble.
 */
export function PaydaySummary({ settings, nextPayday }: PaydaySummaryProps) {
  const { date, daysRemaining, adjusted, adjustReason } = nextPayday;
  const paidToday = daysRemaining === 0;
  return (
    <>
      <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Next payday</p>
      <p className="font-sans text-lg font-bold">
        {date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })}
      </p>
      <p className="font-sans text-xs text-muted-foreground">
        <span className={cn('font-semibold tabular-nums', paidToday ? 'text-positive' : 'text-foreground')}>
          {paydayCountdown(daysRemaining)}
        </span>
        {' · '}
        {paydayScheduleLabel(settings)}
      </p>
      {adjusted ? (
        <p className="font-sans text-xs text-muted-foreground">
          Brought forward: the usual day is {adjustReason === 'weekend' ? 'a weekend' : 'a bank holiday'}
        </p>
      ) : null}
    </>
  );
}

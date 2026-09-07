import { AlertTriangle, CircleAlert, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatGBP } from '@/features/finance/utils/calculations';
import type { AlertSeverity, FinanceAlert } from '@/lib/finance';

/**
 * The phrasing layer for `deriveAlerts`.
 *
 * The engine returns codes and numbers; the words live here, so the rules stay
 * pure and a sentence can change without touching the logic that decided it
 * applied.
 */

const ICON: Record<AlertSeverity, typeof Info> = {
  critical: CircleAlert,
  warning: AlertTriangle,
  info: Info,
};

const TONE: Record<AlertSeverity, string> = {
  critical: 'text-destructive',
  warning: 'text-chart-4',
  info: 'text-muted-foreground',
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function phrase(alert: FinanceAlert): string {
  switch (alert.code) {
    case 'emergency_fund_short':
      return `Emergency fund is ${formatGBP(alert.shortfall)} short of its ${formatGBP(alert.target)} target.`;
    case 'bills_overdue':
      return `${plural(alert.count, 'bill is', 'bills are')} past due, totalling ${formatGBP(alert.total)}.`;
    case 'bills_due_soon':
      return `${plural(alert.count, 'bill', 'bills')} due within ${alert.withinDays} days, totalling ${formatGBP(alert.total)}.`;
    case 'over_budget':
      return `Spending is ${formatGBP(alert.overBy)} over budget this month.`;
    case 'goal_off_track':
      return `${alert.goalName} needs ${plural(alert.monthsNeeded, 'month', 'months')} at the current rate but has ${alert.monthsAvailable}.`;
    case 'no_budget':
      return 'No budget set, so spending has nothing to be measured against.';
    case 'unreviewed_transactions':
      return `${plural(alert.count, 'transaction', 'transactions')} waiting to be reviewed.`;
  }
}

/** A stable key: one alert of each kind exists at a time, bar goals. */
const keyOf = (a: FinanceAlert) => (a.code === 'goal_off_track' ? `${a.code}:${a.goalId}` : a.code);

export function AlertList({ alerts }: { alerts: FinanceAlert[] }) {
  if (alerts.length === 0) {
    return (
      <p className="font-sans text-xs text-muted-foreground">
        Nothing needs attention.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {alerts.map(alert => {
        const Icon = ICON[alert.severity];
        return (
          <li key={keyOf(alert)} className="flex items-start gap-2">
            <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', TONE[alert.severity])} aria-hidden />
            <span className="font-sans text-xs text-foreground">{phrase(alert)}</span>
          </li>
        );
      })}
    </ul>
  );
}

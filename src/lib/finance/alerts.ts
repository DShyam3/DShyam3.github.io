/**
 * What the position is trying to tell you.
 *
 * Every alert is derived, never stored: it is a function of the current
 * position and today's date, so it appears when the condition is true and
 * disappears when it stops being true. Nothing to mark as read, nothing to go
 * stale, and no second source of truth to reconcile against the ledger.
 *
 * Alerts carry a code and typed data rather than a sentence. Phrasing is the
 * UI's job — the same reason `Verdict` is a code and not a paragraph — and it
 * keeps this module pure and translatable.
 */

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type FinanceAlert =
  /** Half the app measures against a budget that does not exist. */
  | { code: 'no_budget'; severity: 'info' }
  /** Spending has passed the budget for the month. */
  | { code: 'over_budget'; severity: 'warning'; overBy: number }
  /** Bills whose due day has already passed and are still unpaid. */
  | { code: 'bills_overdue'; severity: 'critical'; count: number; total: number }
  | { code: 'bills_due_soon'; severity: 'warning'; count: number; total: number; withinDays: number }
  /** Spendable cash has fallen below what the emergency fund should hold. */
  | { code: 'emergency_fund_short'; severity: 'critical'; shortfall: number; target: number }
  | { code: 'unreviewed_transactions'; severity: 'info'; count: number }
  /** At the current contribution rate the goal misses its target date. */
  | {
      code: 'goal_off_track';
      severity: 'warning';
      goalId: string;
      goalName: string;
      monthsNeeded: number;
      monthsAvailable: number;
    };

export interface AlertBill {
  id: string;
  name: string;
  amount: number;
  /** Day of the month it falls due. */
  dueDate: number;
  isPaid: boolean;
  dueThisMonth: boolean;
}

export interface AlertGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  /** YYYY-MM-DD, or empty when the goal has no deadline. */
  targetDate: string;
}

export interface AlertInput {
  hasBudget: boolean;
  totalBudget: number;
  totalSpent: number;
  liquidAssets: number;
  emergencyFundTarget: number;
  unreviewedCount: number;
  bills: AlertBill[];
  goals: AlertGoal[];
}

/** A bill falling due within this many days counts as imminent. */
const DUE_SOON_DAYS = 7;

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Whole months from `today` to `target`, or null when there is no target. */
const monthsUntil = (today: string, target: string): number | null => {
  if (!target) return null;
  const [ty, tm] = target.split('-').map(Number);
  const [ny, nm] = today.split('-').map(Number);
  if (!ty || !tm || !ny || !nm) return null;
  return (ty - ny) * 12 + (tm - nm);
};

/**
 * Derives every alert that currently applies, most serious first.
 *
 * `today` is passed rather than read from the clock so the same position gives
 * the same alerts whenever it is evaluated.
 */
export const deriveAlerts = (input: AlertInput, today: string): FinanceAlert[] => {
  const alerts: FinanceAlert[] = [];
  const dayOfMonth = Number(today.slice(8, 10));

  const emergencyShortfall = round2(
    Math.max(0, input.emergencyFundTarget - input.liquidAssets),
  );
  if (input.emergencyFundTarget > 0 && emergencyShortfall > 0) {
    alerts.push({
      code: 'emergency_fund_short',
      severity: 'critical',
      shortfall: emergencyShortfall,
      target: input.emergencyFundTarget,
    });
  }

  const dueThisMonth = input.bills.filter(b => b.dueThisMonth && !b.isPaid);

  const overdue = dueThisMonth.filter(b => b.dueDate < dayOfMonth);
  if (overdue.length > 0) {
    alerts.push({
      code: 'bills_overdue',
      severity: 'critical',
      count: overdue.length,
      total: round2(overdue.reduce((s, b) => s + b.amount, 0)),
    });
  }

  const soon = dueThisMonth.filter(
    b => b.dueDate >= dayOfMonth && b.dueDate - dayOfMonth <= DUE_SOON_DAYS,
  );
  if (soon.length > 0) {
    alerts.push({
      code: 'bills_due_soon',
      severity: 'warning',
      count: soon.length,
      total: round2(soon.reduce((s, b) => s + b.amount, 0)),
      withinDays: DUE_SOON_DAYS,
    });
  }

  // Only meaningful against a budget that exists; "over £0" is not a fact about
  // spending, it is a fact about configuration, and no_budget says that better.
  if (input.hasBudget && input.totalSpent > input.totalBudget) {
    alerts.push({
      code: 'over_budget',
      severity: 'warning',
      overBy: round2(input.totalSpent - input.totalBudget),
    });
  }

  for (const goal of input.goals) {
    const remaining = goal.targetAmount - goal.currentAmount;
    if (remaining <= 0 || goal.monthlyContribution <= 0) continue;
    const monthsAvailable = monthsUntil(today, goal.targetDate);
    if (monthsAvailable === null) continue;
    const monthsNeeded = Math.ceil(remaining / goal.monthlyContribution);
    if (monthsNeeded > monthsAvailable) {
      alerts.push({
        code: 'goal_off_track',
        severity: 'warning',
        goalId: goal.id,
        goalName: goal.name,
        monthsNeeded,
        monthsAvailable,
      });
    }
  }

  if (!input.hasBudget) {
    alerts.push({ code: 'no_budget', severity: 'info' });
  }

  if (input.unreviewedCount > 0) {
    alerts.push({
      code: 'unreviewed_transactions',
      severity: 'info',
      count: input.unreviewedCount,
    });
  }

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
};

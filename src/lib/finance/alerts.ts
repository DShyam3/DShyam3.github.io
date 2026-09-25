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
    }
  /** Debt costing more than cash could plausibly earn, while cash beyond the
   *  emergency fund sits idle. Information, not a recommendation. */
  | {
      code: 'costly_debt_beside_cash';
      severity: 'warning';
      spareCash: number;
      costlyDebtTotal: number;
      coverable: number;
      annualInterestCovered: number;
      highestAprDebtName: string;
      highestAprPercent: number;
      aprThresholdPercent: number;
    }
  /** Share of known card limits in use is above the level scoring bands step at. */
  | {
      code: 'credit_utilisation_high';
      severity: 'warning';
      utilisationPercent: number;
      totalOwed: number;
      totalLimit: number;
      thresholdPercent: number;
      highestCardName: string;
      highestCardPercent: number;
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

export interface AlertDebt {
  id: string;
  name: string;
  type: 'mortgage' | 'student' | 'auto' | 'personal' | 'credit' | 'other';
  repaymentType: 'amortising' | 'income_contingent' | 'pcp';
  /** Outstanding, positive. */
  balance: number;
  /** Annual percentage rate, e.g. 24.9. */
  aprPercent: number;
}

export interface AlertCreditCard {
  id: string;
  name: string;
  /** Ledger sign: negative = owed, positive = in credit. */
  balance: number;
  /** Null when unknown -- never treat as zero. */
  creditLimit: number | null;
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
  debts: AlertDebt[];
  creditCards: AlertCreditCard[];
}

/** A bill falling due within this many days counts as imminent. */
const DUE_SOON_DAYS = 7;

// Comfortably above what easy-access cash has paid in the UK in recent years
// (Bank Rate peaked at 5.25% in 2023), so a debt at or above it costs more
// than the cash beside it can earn. No account interest rates are stored, so
// this bound stands in for them.
export const COSTLY_DEBT_APR_PERCENT = 10;

/** GBP/year. Below this, a year's saved interest is noise, not guidance. */
export const MIN_ANNUAL_INTEREST_WORTH_NOTING = 25;

// Where UK credit scoring bands commonly step, per commonly cited bureau
// guidance -- not a regulation, and not the same figure every bureau uses.
export const CREDIT_UTILISATION_THRESHOLD_PERCENT = 30;

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

  // Costly debt beside idle cash. Without an emergency fund target there is no
  // way to tell which cash is spare, so the rule stays silent.
  if (input.emergencyFundTarget > 0) {
    const spareCash = round2(input.liquidAssets - input.emergencyFundTarget);
    if (spareCash > 0) {
      // "Clear it with cash" is a different question for both of these,
      // whatever their APR: a student loan is income-contingent and may be
      // written off, so cash paid in can be cash that was never owed; a
      // mortgage carries early-repayment charges and overpayment caps.
      const eligible = input.debts
        .filter(
          d =>
            d.repaymentType !== 'income_contingent' &&
            d.type !== 'student' &&
            d.type !== 'mortgage' &&
            d.balance > 0 &&
            Number.isFinite(d.aprPercent) &&
            d.aprPercent >= COSTLY_DEBT_APR_PERCENT,
        )
        .sort(
          (a, b) =>
            b.aprPercent - a.aprPercent || b.balance - a.balance || a.id.localeCompare(b.id),
        );

      if (eligible.length > 0) {
        // Greedy allocation, highest APR first: spare cash would clear the
        // most expensive balance before the next, so that is the interest it
        // could plausibly cover.
        let remaining = spareCash;
        let annualInterestCovered = 0;
        for (const debt of eligible) {
          const allocated = Math.min(remaining, debt.balance);
          // One year's simple interest at today's balance and rate -- an
          // approximation, not a schedule.
          annualInterestCovered += (allocated * debt.aprPercent) / 100;
          remaining -= allocated;
        }
        annualInterestCovered = round2(annualInterestCovered);
        const costlyDebtTotal = round2(eligible.reduce((s, d) => s + d.balance, 0));

        if (annualInterestCovered >= MIN_ANNUAL_INTEREST_WORTH_NOTING) {
          alerts.push({
            code: 'costly_debt_beside_cash',
            severity: 'warning',
            spareCash,
            costlyDebtTotal,
            coverable: round2(Math.min(spareCash, costlyDebtTotal)),
            annualInterestCovered,
            highestAprDebtName: eligible[0].name,
            highestAprPercent: eligible[0].aprPercent,
            aprThresholdPercent: COSTLY_DEBT_APR_PERCENT,
          });
        }
      }
    }
  }

  // Cards with an unknown limit are excluded entirely -- neither owed nor
  // limit counts -- rather than assuming a limit or treating them as maxed.
  const cardsWithLimit = input.creditCards.filter(
    c => c.creditLimit !== null && Number.isFinite(c.creditLimit) && c.creditLimit > 0,
  );
  if (cardsWithLimit.length > 0) {
    const owed = (c: AlertCreditCard) => Math.max(0, -c.balance);
    const totalOwed = round2(cardsWithLimit.reduce((s, c) => s + owed(c), 0));
    const totalLimit = round2(cardsWithLimit.reduce((s, c) => s + (c.creditLimit as number), 0));
    // Compare the rounded, displayed percentage rather than the raw ratio so
    // the number shown and the reason the alert fired never disagree.
    const utilisationPercent = Math.round((totalOwed / totalLimit) * 100);

    if (utilisationPercent > CREDIT_UTILISATION_THRESHOLD_PERCENT) {
      const highestCard = [...cardsWithLimit].sort((a, b) => {
        const pa = owed(a) / (a.creditLimit as number);
        const pb = owed(b) / (b.creditLimit as number);
        return pb - pa || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
      })[0];

      alerts.push({
        code: 'credit_utilisation_high',
        severity: 'warning',
        utilisationPercent,
        totalOwed,
        totalLimit,
        thresholdPercent: CREDIT_UTILISATION_THRESHOLD_PERCENT,
        highestCardName: highestCard.name,
        highestCardPercent: Math.round(
          (owed(highestCard) / (highestCard.creditLimit as number)) * 100,
        ),
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

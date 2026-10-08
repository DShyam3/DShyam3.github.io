/**
 * The typed finance tools an assistant may call.
 *
 * The rule this exists to enforce: the model never computes a financial value.
 * It chooses a tool and reads the result. Every number an answer contains comes
 * from `lib/finance`, which is pure and tested, so an answer can be traced to
 * the arithmetic that produced it rather than to a model's confidence.
 *
 * Executing here rather than in an edge function is deliberate. The arithmetic
 * already exists, tested, in this module; re-implementing it in Deno to run
 * server-side would create the same hand-mirrored duplication the plan already
 * regrets in `watchlist-cron-sync`. The edge function holds the API key and
 * proxies the model; the tools run against the one implementation.
 *
 * Every result is a projection built as an allowlist: each executor names the
 * fields it returns, so a field added to the context later is not sent until
 * someone adds it here on purpose.
 */

import type { ToolSchema } from '../assistant/protocol';
import type { FinanceAlert } from './alerts';
import { completeRecordedMonths, monthlyCashFlow, summariseCashFlow, type CashFlowTransaction } from './cash-flow';
import { runSpendScenario, type ScenarioResult, type ScenarioState } from './scenario';

export interface FinancialPosition {
  freeToSpend: number;
  hasBudget: boolean;
  totalBudget: number;
  totalSpent: number;
  monthlyIncome: number;
  netWorth: number;
  totalAssets: number;
  totalDebt: number;
  /** Null when no payday is known, rather than a 0 that reads as "today". */
  daysUntilPayday: number | null;
  daysRemainingInMonth: number;
}

export interface GoalSummary {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  isEmergencyFund: boolean;
  /** Whole months at the current rate, or null when unfunded. */
  monthsToTarget: number | null;
}

/**
 * The ledger rows cash flow is summed from: confirmed transfers already
 * removed, exactly as Home and Cash Flow remove them (`useSpendingLedger`).
 * Built without names, payers or accounts, so no tool can leak one.
 */
export interface CashFlowToolInput {
  transactions: CashFlowTransaction[];
  /** YYYY-MM, local time. Later months are future and count nothing. */
  currentMonth: string;
  /** True when the transfer exclusions failed to load, so totals may count transfers. */
  exclusionsUnreliable: boolean;
}

/** Everything the tools are allowed to see. Nothing else is reachable. */
export interface FinanceToolContext {
  position: FinancialPosition;
  scenario: ScenarioState;
  goals: GoalSummary[];
  alerts: FinanceAlert[];
  cashFlow: CashFlowToolInput;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * An alert as the model receives it: the figures, without the user-entered
 * account names two of the codes carry (see `projectAlert`).
 */
export type AlertProjection = DistributiveOmit<FinanceAlert, 'highestAprDebtName' | 'highestCardName'>;

export type ToolName = 'get_position' | 'run_spend_scenario' | 'get_goals' | 'get_alerts' | 'get_cash_flow';

/** One month of money in and out. Aggregates only: no row is ever listed. */
export interface CashFlowMonthTotals {
  month: string;
  income: number;
  spend: number;
  net: number;
}

export interface CashFlowAverages {
  /** How many months were averaged, and which. */
  months: number;
  from: string;
  through: string;
  income: number;
  spend: number;
  net: number;
  /** Averaged months with no ledger row at all: possibly unrecorded, counted as zero. */
  emptyMonths: string[];
}

export interface CashFlowToolResult {
  from: string;
  through: string;
  /** False for a month still in progress, so its totals are partial. */
  complete: boolean;
  income: number;
  spend: number;
  net: number;
  /**
   * Monthly averages over the range's complete, recorded months only
   * (`completeRecordedMonths`): not the month in progress, not the ledger's
   * own partial first month, not months before it. Null when the range holds
   * no such month.
   */
  averages: CashFlowAverages | null;
  /** Spending by category across the range, largest first. */
  categories: { name: string; amount: number }[];
  /** Present when the range spans more than one month. */
  months?: CashFlowMonthTotals[];
  /** Savings rate across the range, null when nothing came in. */
  savingsRatePercent: number | null;
  /** True when internal transfers may be counted as income and spend. */
  transfersMayBeIncluded: boolean;
  /**
   * The ledger's first month, or null when it is empty. A range before it
   * sums to zero because nothing was recorded, not because nothing moved.
   */
  ledgerStartsMonth: string | null;
}

export type ToolResult =
  | { tool: 'get_position'; data: FinancialPosition }
  | { tool: 'run_spend_scenario'; data: ScenarioResult }
  | { tool: 'get_goals'; data: GoalSummary[] }
  | { tool: 'get_alerts'; data: AlertProjection[] }
  | { tool: 'get_cash_flow'; data: CashFlowToolResult }
  | { tool: ToolName; error: string };

/**
 * Schemas handed to the model. Descriptions are part of the contract: they are
 * what stops it reaching for a scenario when it was asked for a balance.
 */
export const TOOL_SCHEMAS = [
  {
    name: 'get_position',
    description:
      'The current financial position: what is left to spend this month, income, net worth, '
      + 'assets, debts and how many days until payday. Use for any "where am I" or "how much '
      + 'do I have" question. Takes no arguments.',
    input_schema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'run_spend_scenario',
    description:
      'Works out the effect of a hypothetical one-off spend on the rest of the month, on cash, '
      + 'on the emergency fund and on each goal. Use for "can I afford", "what happens if I buy" '
      + 'and "should I spend" questions. Never estimate this; always call it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        amount: { type: 'number' as const, description: 'The amount in pounds, as a positive number.' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'get_alerts',
    description:
      'Everything currently needing attention: overdue or imminent bills, an emergency fund '
      + 'below target, spending over budget, goals that cannot reach their date at the current '
      + 'rate, and transactions awaiting review. Use for "what should I look at" or "is anything '
      + 'wrong". These are derived from the position, not a stored list. Takes no arguments.',
    input_schema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'get_goals',
    description:
      'Every active savings goal with its target, progress, monthly contribution and how many '
      + 'months remain at the current rate. Use for questions about goals or saving.',
    input_schema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'get_cash_flow',
    description:
      'Money that actually moved in a calendar month, or a range of months: income, spending, '
      + 'net, monthly averages and spending by category, from the ledger with internal transfers '
      + 'removed. Use for "how much did I make/spend last month", "this year" or "on average". For a '
      + 'range, pass `through`; totals and averages are worked out for you, so never add or divide '
      + 'yourself. ledgerStartsMonth says where records begin: a month before it is unrecorded, not '
      + 'zero. Averages cover only complete months of records and say which; quote that span, and '
      + 'name any emptyMonths, which may be unrecorded. Totals only: it never lists individual '
      + 'transactions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        month: { type: 'string' as const, description: 'First month, as YYYY-MM.' },
        through: {
          type: 'string' as const,
          description: 'Optional last month, as YYYY-MM, inclusive. Omit for a single month.',
        },
      },
      required: ['month'],
    },
  },
] as const satisfies readonly ToolSchema[];

/** A range longer than this is almost certainly a model's typo. */
const MAX_CASH_FLOW_MONTHS = 60;

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const monthIndex = (key: string): number => {
  const [, year, month] = MONTH_RE.exec(key) as RegExpExecArray;
  return Number(year) * 12 + Number(month) - 1;
};

const projectPosition = (p: FinancialPosition): FinancialPosition => ({
  freeToSpend: p.freeToSpend,
  hasBudget: p.hasBudget,
  totalBudget: p.totalBudget,
  totalSpent: p.totalSpent,
  monthlyIncome: p.monthlyIncome,
  netWorth: p.netWorth,
  totalAssets: p.totalAssets,
  totalDebt: p.totalDebt,
  daysUntilPayday: p.daysUntilPayday,
  daysRemainingInMonth: p.daysRemainingInMonth,
});

const projectGoal = (g: GoalSummary): GoalSummary => ({
  id: g.id,
  name: g.name,
  targetAmount: g.targetAmount,
  currentAmount: g.currentAmount,
  monthlyContribution: g.monthlyContribution,
  isEmergencyFund: g.isEmergencyFund,
  monthsToTarget: g.monthsToTarget,
});

/**
 * Field by field per alert code. The union is closed, so a new code fails to
 * typecheck here until someone decides what of it may be sent.
 */
const projectAlert = (a: FinanceAlert): AlertProjection => {
  switch (a.code) {
    case 'no_budget':
      return { code: a.code, severity: a.severity };
    case 'over_budget':
      return { code: a.code, severity: a.severity, overBy: a.overBy };
    case 'bills_overdue':
      return { code: a.code, severity: a.severity, count: a.count, total: a.total };
    case 'bills_due_soon':
      return { code: a.code, severity: a.severity, count: a.count, total: a.total, withinDays: a.withinDays };
    case 'emergency_fund_short':
      return { code: a.code, severity: a.severity, shortfall: a.shortfall, target: a.target };
    case 'unreviewed_transactions':
      return { code: a.code, severity: a.severity, count: a.count };
    case 'goal_off_track':
      return {
        code: a.code,
        severity: a.severity,
        goalId: a.goalId,
        goalName: a.goalName,
        monthsNeeded: a.monthsNeeded,
        monthsAvailable: a.monthsAvailable,
      };
    // The debt's and card's names stay behind. A user-entered account name
    // can carry a card's last digits or a lender's personal name, and the
    // figures answer the question without them.
    case 'costly_debt_beside_cash':
      return {
        code: a.code,
        severity: a.severity,
        spareCash: a.spareCash,
        costlyDebtTotal: a.costlyDebtTotal,
        coverable: a.coverable,
        annualInterestCovered: a.annualInterestCovered,
        highestAprPercent: a.highestAprPercent,
        aprThresholdPercent: a.aprThresholdPercent,
      };
    case 'credit_utilisation_high':
      return {
        code: a.code,
        severity: a.severity,
        utilisationPercent: a.utilisationPercent,
        totalOwed: a.totalOwed,
        totalLimit: a.totalLimit,
        thresholdPercent: a.thresholdPercent,
        highestCardPercent: a.highestCardPercent,
      };
  }
};

const projectScenario = (r: ScenarioResult): ScenarioResult => ({
  verdict: r.verdict,
  amount: r.amount,
  freeToSpendAfter: r.freeToSpendAfter,
  dailyAllowanceAfter: r.dailyAllowanceAfter,
  liquidAfter: r.liquidAfter,
  emergencyShortfall: r.emergencyShortfall,
  goalImpacts: r.goalImpacts.map(g => ({ id: g.id, name: g.name, monthsDelayed: g.monthsDelayed })),
  maxComfortable: r.maxComfortable,
  monthsToSaveInstead: r.monthsToSaveInstead,
});

/**
 * Income, spend and categories for `month` through `through`. Only the
 * aggregates leave: `monthlyCashFlow` also builds income rows with payer
 * names, and none of them is read here.
 */
const cashFlow = (
  input: Record<string, unknown>,
  context: CashFlowToolInput,
): ToolResult => {
  const from = typeof input.month === 'string' ? input.month.trim() : '';
  const throughRaw = typeof input.through === 'string' && input.through.trim() !== ''
    ? input.through.trim()
    : from;
  if (!MONTH_RE.test(from) || !MONTH_RE.test(throughRaw)) {
    return { tool: 'get_cash_flow', error: 'month and through must be YYYY-MM' };
  }
  const span = monthIndex(throughRaw) - monthIndex(from) + 1;
  if (span < 1) return { tool: 'get_cash_flow', error: 'through must not be before month' };
  if (span > MAX_CASH_FLOW_MONTHS) {
    return { tool: 'get_cash_flow', error: `a range may cover at most ${MAX_CASH_FLOW_MONTHS} months` };
  }

  const months = monthlyCashFlow(context.transactions, from, throughRaw, context.currentMonth);
  const summary = summariseCashFlow(months);
  const recorded = completeRecordedMonths(months, context.transactions);
  const averaged = recorded.months;
  const averageSummary = averaged.length > 0 ? summariseCashFlow(averaged) : null;

  return {
    tool: 'get_cash_flow',
    data: {
      from,
      through: throughRaw,
      complete: months.every(m => !m.isCurrent && !m.isFuture),
      income: summary.income,
      spend: summary.spend,
      net: summary.net,
      averages: averageSummary
        ? {
            months: averaged.length,
            from: averaged[0].key,
            through: averaged[averaged.length - 1].key,
            income: averageSummary.avgMonthlyIncome,
            spend: averageSummary.avgMonthlySpend,
            net: averageSummary.avgMonthlyNet,
            emptyMonths: recorded.emptyMonths,
          }
        : null,
      categories: summary.categories.map(c => ({ name: c.name, amount: c.amount })),
      ...(span > 1
        ? { months: months.map(m => ({ month: m.key, income: m.income, spend: m.spend, net: m.net })) }
        : {}),
      savingsRatePercent: summary.savingsRatePercent,
      transfersMayBeIncluded: context.exclusionsUnreliable,
      ledgerStartsMonth: recorded.firstMonth,
    },
  };
};


/**
 * Runs one tool call. Unknown names and bad arguments come back as an error
 * result rather than throwing, because the model is allowed to be wrong and
 * the conversation should survive it.
 */
export const executeTool = (
  name: string,
  input: Record<string, unknown>,
  context: FinanceToolContext,
): ToolResult => {
  switch (name) {
    case 'get_position':
      return { tool: 'get_position', data: projectPosition(context.position) };

    case 'get_goals':
      return { tool: 'get_goals', data: context.goals.map(projectGoal) };

    case 'get_alerts':
      return { tool: 'get_alerts', data: context.alerts.map(projectAlert) };

    case 'get_cash_flow':
      return cashFlow(input, context.cashFlow);

    case 'run_spend_scenario': {
      const amount = typeof input.amount === 'number' ? input.amount : Number(input.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return {
          tool: 'run_spend_scenario',
          error: 'amount must be a positive number of pounds',
        };
      }
      return { tool: 'run_spend_scenario', data: projectScenario(runSpendScenario(amount, context.scenario)) };
    }

    default:
      return { tool: name as ToolName, error: `unknown tool: ${name}` };
  }
};

/** Months to reach a goal at its current rate; null when nothing is going in. */
export const monthsToTarget = (
  targetAmount: number,
  currentAmount: number,
  monthlyContribution: number,
): number | null => {
  const remaining = targetAmount - currentAmount;
  if (remaining <= 0) return 0;
  if (monthlyContribution <= 0) return null;
  return Math.ceil(remaining / monthlyContribution);
};

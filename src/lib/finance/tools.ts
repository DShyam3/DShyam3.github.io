/**
 * The typed tools an assistant may call.
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
 */

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
  daysUntilPayday: number;
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

/** Everything the tools are allowed to see. Nothing else is reachable. */
export interface FinanceToolContext {
  position: FinancialPosition;
  scenario: ScenarioState;
  goals: GoalSummary[];
}

export type ToolName = 'get_position' | 'run_spend_scenario' | 'get_goals';

export type ToolResult =
  | { tool: 'get_position'; data: FinancialPosition }
  | { tool: 'run_spend_scenario'; data: ScenarioResult }
  | { tool: 'get_goals'; data: GoalSummary[] }
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
    name: 'get_goals',
    description:
      'Every active savings goal with its target, progress, monthly contribution and how many '
      + 'months remain at the current rate. Use for questions about goals or saving.',
    input_schema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
] as const;

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
      return { tool: 'get_position', data: context.position };

    case 'get_goals':
      return { tool: 'get_goals', data: context.goals };

    case 'run_spend_scenario': {
      const amount = typeof input.amount === 'number' ? input.amount : Number(input.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return {
          tool: 'run_spend_scenario',
          error: 'amount must be a positive number of pounds',
        };
      }
      return { tool: 'run_spend_scenario', data: runSpendScenario(amount, context.scenario) };
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

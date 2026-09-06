/**
 * "What happens if I do X?"
 *
 * The question the whole product is organised around, and the one part of it
 * that must never be delegated to a language model: the arithmetic here is
 * deterministic, auditable and reproducible, and an assistant's job is to
 * explain the result rather than to produce it.
 *
 * Pure by construction — no React, no Supabase, no clock. Every input the
 * answer depends on is an argument, including today's date, so a scenario run
 * twice gives the same answer twice.
 */

export interface ScenarioGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  /** What actually goes in each month. Zero means the goal is not being funded. */
  monthlyContribution: number;
}

export interface ScenarioState {
  /** Budget (or income, when no budget is set) less spending and unpaid bills. */
  freeToSpend: number;
  daysRemainingInMonth: number;
  /** Cash that could genuinely be drawn on today, ignoring investments. */
  liquidAssets: number;
  /** What the emergency fund is meant to hold. Zero if none is set. */
  emergencyFundTarget: number;
  /** Monthly surplus available to save, used to answer "how long until I could". */
  monthlySurplus: number;
  goals: ScenarioGoal[];
}

export type Verdict =
  /** Leaves the month comfortable. */
  | 'comfortable'
  /** Affordable, but leaves little room before payday. */
  | 'tight'
  /** Puts the month over its budget, though the cash exists. */
  | 'over_budget'
  /** Takes the emergency fund below its target. */
  | 'breaks_emergency_fund'
  /** The cash is not there. */
  | 'unaffordable';

export interface GoalImpact {
  id: string;
  name: string;
  /** Whole months added to the goal, rounded up. Null when unfunded, because
   *  an unfunded goal has no date to move. */
  monthsDelayed: number | null;
}

export interface ScenarioResult {
  verdict: Verdict;
  amount: number;
  freeToSpendAfter: number;
  /** Per-day allowance for the rest of the month, floored at zero. */
  dailyAllowanceAfter: number;
  liquidAfter: number;
  emergencyShortfall: number;
  goalImpacts: GoalImpact[];
  /** The largest spend that would still come back 'comfortable'. */
  maxComfortable: number;
  /** Whole months of saving to afford it outright, null when there is no
   *  surplus to save from — "never at this rate" rather than Infinity. */
  monthsToSaveInstead: number | null;
}

/** Below this share of the remaining free-to-spend, a spend counts as tight. */
const TIGHT_THRESHOLD = 0.2;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Runs a hypothetical one-off spend against the current position.
 *
 * Ordering matters: the verdict reports the *most serious* consequence, so a
 * spend that both breaks the emergency fund and busts the budget is reported
 * as the former.
 */
export const runSpendScenario = (amount: number, state: ScenarioState): ScenarioResult => {
  const spend = Math.max(0, amount);

  const freeToSpendAfter = round2(state.freeToSpend - spend);
  const liquidAfter = round2(state.liquidAssets - spend);
  const days = Math.max(1, state.daysRemainingInMonth);

  const emergencyShortfall = round2(Math.max(0, state.emergencyFundTarget - liquidAfter));

  const verdict: Verdict =
    spend > state.liquidAssets
      ? 'unaffordable'
      : emergencyShortfall > 0
        ? 'breaks_emergency_fund'
        : freeToSpendAfter < 0
          ? 'over_budget'
          : freeToSpendAfter < state.freeToSpend * TIGHT_THRESHOLD
            ? 'tight'
            : 'comfortable';

  // A goal is delayed by however many months of its own contributions the
  // spend consumes. An unfunded goal has no schedule to push back.
  const goalImpacts: GoalImpact[] = state.goals.map(goal => ({
    id: goal.id,
    name: goal.name,
    monthsDelayed:
      goal.monthlyContribution > 0 ? Math.ceil(spend / goal.monthlyContribution) : null,
  }));

  const maxComfortable = round2(Math.max(0, state.freeToSpend * (1 - TIGHT_THRESHOLD)));

  const monthsToSaveInstead =
    spend <= state.liquidAssets
      ? 0
      : state.monthlySurplus > 0
        ? Math.ceil((spend - state.liquidAssets) / state.monthlySurplus)
        : null;

  return {
    verdict,
    amount: spend,
    freeToSpendAfter,
    dailyAllowanceAfter: round2(Math.max(0, freeToSpendAfter) / days),
    liquidAfter,
    emergencyShortfall,
    goalImpacts,
    maxComfortable,
    monthsToSaveInstead,
  };
};

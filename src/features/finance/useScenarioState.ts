/**
 * Builds the scenario engine's input from the current position.
 *
 * The engine is pure and takes every figure as an argument, which means
 * something has to decide what those figures are. Several of those decisions
 * are judgement calls rather than facts, so this returns them alongside the
 * state: the UI shows its assumptions rather than presenting a derived answer
 * as if it were measured.
 */

import { useFinanceData } from './FinanceDataContext';
import { useFinanceTotals } from './useFinanceTotals';
import type { ScenarioState } from '@/lib/finance';

/** Months of past contributions averaged to guess what a goal receives monthly. */
const CONTRIBUTION_WINDOW = 3;

export interface ScenarioAssumption {
  label: string;
  value: string;
  /** Why this number was chosen, shown when it is inferred rather than set. */
  note?: string;
}

export function useScenarioState(): { state: ScenarioState; assumptions: ScenarioAssumption[] } {
  const { bankAccounts, goals } = useFinanceData();
  const { freeToSpend, daysRemainingInMonth, netCashFlow, hasBudget } = useFinanceTotals();

  // Cash you could actually spend today. Investments are excluded on purpose:
  // selling to cover a takeaway is not what "can I afford this" means.
  const liquidAssets = bankAccounts
    .filter(a => (a.type === 'checking' || a.type === 'savings') && a.balance > 0)
    .reduce((sum, a) => sum + a.balance, 0);

  const active = goals.filter(g => g.status !== 'archived');

  const monthlyFor = (contributions: { amount: number; date: string }[]) => {
    if (contributions.length === 0) return 0;
    const recent = [...contributions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, CONTRIBUTION_WINDOW);
    return recent.reduce((s, c) => s + c.amount, 0) / recent.length;
  };

  // There is no "this is my emergency fund" flag in the schema, so the goal is
  // matched by name. Shown as an assumption precisely because a name match is a
  // guess, and a wrong one changes the verdict.
  const emergencyGoal = active.find(g => /emergency/i.test(g.name));

  const state: ScenarioState = {
    freeToSpend,
    daysRemainingInMonth,
    liquidAssets,
    emergencyFundTarget: emergencyGoal?.targetAmount ?? 0,
    monthlySurplus: Math.max(0, netCashFlow),
    goals: active.map(g => ({
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      monthlyContribution: monthlyFor(g.contributions || []),
    })),
  };

  const gbp = (n: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

  const assumptions: ScenarioAssumption[] = [
    {
      label: 'Spendable cash',
      value: gbp(liquidAssets),
      note: 'Current and savings accounts in credit. Investments are not counted.',
    },
    {
      label: 'Left this month',
      value: gbp(freeToSpend),
      note: hasBudget
        ? 'Budget less spending and unpaid bills.'
        : 'No budget set, so measured against take-home pay instead.',
    },
    {
      label: 'Emergency fund target',
      value: emergencyGoal ? gbp(emergencyGoal.targetAmount) : 'none',
      note: emergencyGoal
        ? `Taken from your "${emergencyGoal.name}" goal, matched by name.`
        : 'No goal looks like an emergency fund, so nothing is protected.',
    },
    {
      label: 'Monthly surplus',
      value: gbp(Math.max(0, netCashFlow)),
      note: 'Take-home less spending. Used to answer how long saving would take.',
    },
  ];

  return { state, assumptions };
}

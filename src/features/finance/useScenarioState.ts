/**
 * Builds the scenario engine's input from the current position.
 *
 * The engine is pure and takes every figure as an argument, which means
 * something has to decide what those figures are. Those decisions are stated
 * back alongside the state, so the UI can show its workings rather than
 * presenting a derived answer as if it were measured.
 *
 * Two of them used to be guesses — the emergency fund matched by name, a goal's
 * monthly rate averaged from recent contributions. Both are columns now, so
 * what is left here is composition rather than inference.
 */

import { useFinanceData } from './FinanceDataContext';
import { useFinanceTotals } from './useFinanceTotals';
import type { ScenarioState } from '@/lib/finance';

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

  // Both of these used to be inferred -- the emergency fund matched by name,
  // the monthly rate averaged from the last three contributions. They are
  // stored now, so the engine runs on stated facts rather than guesses.
  const emergencyGoal = active.find(g => g.isEmergencyFund);

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
      monthlyContribution: g.monthlyContribution ?? 0,
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
        ? `Set on your "${emergencyGoal.name}" goal.`
        : 'No goal is marked as an emergency fund, so nothing is protected.',
    },
    {
      label: 'Monthly surplus',
      value: gbp(Math.max(0, netCashFlow)),
      note: 'Take-home less spending. Used to answer how long saving would take.',
    },
  ];

  return { state, assumptions };
}

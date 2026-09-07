/**
 * Assembles everything the tools are allowed to see.
 *
 * This is the boundary. A tool cannot reach past the context it is handed, so
 * what is built here is exactly what an assistant can ever learn — no raw
 * table access, no tokens, no other profile. Widening a tool's reach means
 * widening this object deliberately rather than by accident.
 */

import { useFinanceData } from './FinanceDataContext';
import { useFinanceTotals } from './useFinanceTotals';
import { useScenarioState } from './useScenarioState';
import { useFinanceAlerts } from './useFinanceAlerts';
import { monthsToTarget, type FinanceToolContext } from '@/lib/finance';

export function useFinanceToolContext(): FinanceToolContext {
  const { goals } = useFinanceData();
  const {
    freeToSpend, hasBudget, totalBudget, totalSpent, monthlyIncome,
    netWorth, totalAssets, totalDebt, daysRemainingInMonth, nextPayday,
  } = useFinanceTotals();
  const { state } = useScenarioState();
  const alerts = useFinanceAlerts(new Date().toISOString().slice(0, 10));

  return {
    position: {
      freeToSpend,
      hasBudget,
      totalBudget,
      totalSpent,
      monthlyIncome,
      netWorth,
      totalAssets,
      totalDebt,
      daysUntilPayday: nextPayday?.daysRemaining ?? 0,
      daysRemainingInMonth,
    },
    scenario: state,
    alerts,
    goals: goals
      .filter(g => g.status !== 'archived')
      .map(g => ({
        id: g.id,
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        monthlyContribution: g.monthlyContribution ?? 0,
        isEmergencyFund: g.isEmergencyFund ?? false,
        monthsToTarget: monthsToTarget(g.targetAmount, g.currentAmount, g.monthlyContribution ?? 0),
      })),
  };
}

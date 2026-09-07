/**
 * Feeds the alert engine from the current position.
 *
 * Composition only — every rule lives in `lib/finance/alerts`, so what shows on
 * screen is the same set a tool would return.
 */

import { useFinanceData } from './FinanceDataContext';
import { useFinanceTotals } from './useFinanceTotals';
import { deriveAlerts, type FinanceAlert } from '@/lib/finance';
import { isDueThisMonth } from './finance-defaults';

export function useFinanceAlerts(today: string): FinanceAlert[] {
  const { recurrings, mockTransactions, goals, bankAccounts } = useFinanceData();
  const { hasBudget, totalBudget, totalSpent, currentMonth } = useFinanceTotals();

  const liquidAssets = bankAccounts
    .filter(a => (a.type === 'checking' || a.type === 'savings') && a.balance > 0)
    .reduce((sum, a) => sum + a.balance, 0);

  const active = goals.filter(g => g.status !== 'archived');
  const emergency = active.find(g => g.isEmergencyFund);

  return deriveAlerts(
    {
      hasBudget,
      totalBudget,
      totalSpent,
      liquidAssets,
      emergencyFundTarget: emergency?.targetAmount ?? 0,
      unreviewedCount: mockTransactions.filter(t => !t.isReviewed).length,
      bills: recurrings.map(r => ({
        id: r.id,
        name: r.name,
        amount: r.amount,
        dueDate: r.dueDate,
        isPaid: r.isPaid,
        dueThisMonth: isDueThisMonth(r, currentMonth),
      })),
      goals: active.map(g => ({
        id: g.id,
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        monthlyContribution: g.monthlyContribution ?? 0,
        targetDate: g.targetDate || '',
      })),
    },
    today,
  );
}

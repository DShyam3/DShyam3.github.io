/**
 * Every derived figure the finance surfaces share.
 *
 * These were plain consts in FinancePage, which is why Home and Income could
 * not be split out (REHAUL_PLAN.md 7.2c-i): each read a handful, so each would
 * have needed them as props. As a hook, every surface builds its own from the
 * provider and none takes a prop for a number it can derive.
 *
 * Cheap by construction -- reductions over at most a few hundred rows -- so it
 * is not memoised. If that stops being true, memoise here rather than at the
 * call sites.
 */

import { getDaysInMonth } from '@/lib/finance';
import { useFinanceData } from './FinanceDataContext';
import { makeBudgetMath, isDueThisMonth } from './finance-defaults';
import { calculateFinance, getNextPaydayDetails } from './finance-calcs';

export function useFinanceTotals() {
  const {
    settings,
    taxConfig,
    budgetCategories,
    bankAccounts,
    recurrings,
    debts,
    bankHolidaysList,
    breakdownRateMode,
  } = useFinanceData();

  const { isItemActive, getCategoryBudget, getCategorySpent } = makeBudgetMath(
    settings.activeSavingsTypes,
    bankAccounts,
    recurrings,
  );

  const results = calculateFinance(settings, taxConfig);
  const breakdownRates =
    breakdownRateMode === 'normal'
      ? results.breakdown.standard
      : breakdownRateMode === 'including_leave'
      ? results.breakdown.includingLeave
      : results.breakdown.excludingLeave;
  const breakdownWorkingDays =
    breakdownRateMode === 'normal'
      ? results.workingDaysStandard
      : breakdownRateMode === 'including_leave'
      ? results.workingDaysIncludingLeave
      : results.workingDaysExcludingLeave;
  const nextPayday = getNextPaydayDetails(settings, bankHolidaysList);
  const totalBudget = budgetCategories.reduce((sum, cat) => sum + getCategoryBudget(cat), 0);
  const totalSpent = budgetCategories.reduce((sum, cat) => sum + getCategorySpent(cat), 0);
  const currentMonth = new Date().getMonth() + 1;
  const allBudgetItems = budgetCategories.flatMap(cat =>
    (cat.items || []).filter(item => isItemActive(item, cat)).map(item => ({
      id: item.id,
      label: `${cat.name} > ${item.name}`
    }))
  );
  const totalAssets = bankAccounts.filter(a => a.balance > 0).reduce((sum, a) => sum + a.balance, 0);
  const totalLoanBalance = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalDebt = Math.abs(bankAccounts.filter(a => a.balance < 0).reduce((sum, a) => sum + a.balance, 0)) + totalLoanBalance;
  const netWorth = totalAssets - totalDebt;
  const monthlyIncome = results.netTakeHome / 12;
  const netCashFlow = monthlyIncome - totalSpent;
  const totalFlow = monthlyIncome + totalSpent;
  const incomeFlowPercent = totalFlow > 0 ? (monthlyIncome / totalFlow) * 100 : 50;
  const spendFlowPercent = totalFlow > 0 ? (totalSpent / totalFlow) * 100 : 50;
  const unpaidRecurrings = recurrings
    .filter(r => isDueThisMonth(r, currentMonth) && !r.isPaid)
    .reduce((sum, r) => sum + r.amount, 0);
  /**
   * What is left to spend this month.
   *
   * Measured against the budget when one is set, and against take-home income
   * when one is not. The old form was always `totalBudget - spent - bills`,
   * which with no budget just reported the spending back as a negative -- so
   * the dashboard and Plan both opened on a red number that described nothing
   * but the absence of a budget. Falling back to income answers the same
   * question honestly rather than alarmingly.
   */
  const hasBudget = totalBudget > 0;
  const freeToSpend = (hasBudget ? totalBudget : monthlyIncome) - totalSpent - unpaidRecurrings;
  const todayDateObj = new Date();
  const currentYear = todayDateObj.getFullYear();
  const currentMonthIdx = todayDateObj.getMonth();
  const daysInMonth = getDaysInMonth(currentYear, currentMonthIdx);
  const daysRemainingInMonth = Math.max(1, daysInMonth - todayDateObj.getDate() + 1);
  const dailyFreeToSpend = freeToSpend > 0 ? freeToSpend / daysRemainingInMonth : 0;

  return {
    allBudgetItems,
    breakdownRates,
    breakdownWorkingDays,
    currentMonth,
    currentMonthIdx,
    currentYear,
    dailyFreeToSpend,
    daysInMonth,
    daysRemainingInMonth,
    freeToSpend,
    hasBudget,
    incomeFlowPercent,
    monthlyIncome,
    netCashFlow,
    netWorth,
    nextPayday,
    results,
    spendFlowPercent,
    todayDateObj,
    totalAssets,
    totalBudget,
    totalDebt,
    totalFlow,
    totalLoanBalance,
    totalSpent,
    unpaidRecurrings,
    isItemActive,
    getCategoryBudget,
    getCategorySpent,
  };
}

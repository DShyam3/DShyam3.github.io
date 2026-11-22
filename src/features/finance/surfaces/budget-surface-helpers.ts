import { isDueThisMonth } from '../finance-defaults';
import type { BudgetCategory, MockTransaction, RecurringBill } from '@/features/finance/finance-types';

export const CATEGORY_CHART_COLORS = [
  'hsl(var(--chart-3))', // blue
  'hsl(var(--positive))', // emerald
  'hsl(var(--chart-4))', // amber
  'hsl(var(--destructive))', // red
  'hsl(var(--chart-5))', // violet
  'hsl(var(--chart-5))', // pink
  'hsl(var(--chart-2))', // teal
  'hsl(var(--chart-4))', // orange
] as const;

export const SAVINGS_CHART_COLORS = [
  'hsl(var(--positive))', // emerald
  'hsl(var(--chart-2))', // teal
  'hsl(var(--chart-2))', // cyan
  'hsl(var(--chart-3))', // blue
  'hsl(var(--chart-5))', // indigo
  'hsl(var(--chart-5))', // violet
  'hsl(var(--chart-5))', // pink
  'hsl(var(--chart-4))', // amber
  'hsl(var(--destructive))', // red
  'hsl(var(--chart-4))', // orange
] as const;

export const isTxInCategory = (tx: MockTransaction, cat?: BudgetCategory): boolean => {
  if (!cat) return true;
  const catNameLower = cat.name.toLowerCase();
  const txCatLower = (tx.category || '').toLowerCase();
  if (txCatLower === catNameLower) return true;
  return cat.items.some(item => {
    const itemNameLower = item.name.toLowerCase();
    return txCatLower === itemNameLower || txCatLower.includes(itemNameLower) || itemNameLower.includes(txCatLower);
  });
};

export const isBillInCategory = (bill: RecurringBill, cat?: BudgetCategory): boolean => {
  if (!cat) return true;
  if (bill.linkedBudgetItemId && cat.items.some(i => i.id === bill.linkedBudgetItemId)) return true;
  const catNameLower = cat.name.toLowerCase();
  const billCatLower = (bill.category || '').toLowerCase();
  return billCatLower === catNameLower;
};

export const recurringTotalForMonth = (
  recurrings: RecurringBill[],
  month: number,
  cat?: BudgetCategory,
): number =>
  recurrings
    .filter(r => isBillInCategory(r, cat) && isDueThisMonth(r, month))
    .reduce((sum, r) => sum + r.amount, 0);

import { toISODate } from '@/lib/finance/dates';
import type { BankAccount, Goal, MockTransaction } from '@/features/finance/finance-types';

/* Rows drawn at once. The whole ledger on screen was 18,000+ DOM nodes at
   1,000 transactions, and opening anything over it -- the sync popover took
   1.2s -- meant restyling all of them. Filters, search, select-all and the
   review queue still run over every matching row; only drawing is paged. */
export const TRANSACTION_PAGE_SIZE = 100;

// Color mapper for categories matching dashboard presets
export const getCategoryColor = (category: string): string => {
  const catLower = category.toLowerCase();
  if (catLower.includes('restaurants') || catLower.includes('food') || catLower.includes('drink')) {
    return 'bg-chart-4/15 text-chart-4 border-chart-4/30';
  }
  if (catLower.includes('shopping') || catLower.includes('wardrobe') || catLower.includes('clothes')) {
    return 'bg-chart-5/15 text-chart-5 border-chart-5/30';
  }
  if (catLower.includes('gas') || catLower.includes('transport') || catLower.includes('car') || catLower.includes('travel')) {
    return 'bg-chart-4/15 text-chart-4 border-chart-4/30';
  }
  if (catLower.includes('internet') || catLower.includes('utilities') || catLower.includes('bills')) {
    return 'bg-chart-3/15 text-chart-3 border-chart-3/30';
  }
  if (catLower.includes('rent') || catLower.includes('housing') || catLower.includes('home')) {
    return 'bg-chart-5/15 text-chart-5 border-chart-5/30';
  }
  if (catLower.includes('savings') || catLower.includes('investment') || catLower.includes('interest')) {
    return 'bg-positive/15 text-positive border-positive/30';
  }
  if (catLower.includes('groceries')) {
    return 'bg-chart-2/15 text-chart-2 border-chart-2/30';
  }
  return 'bg-muted/15 text-muted-foreground border-border/30';
};

// Account details matching list
export const getAccountInfo = (bankAccounts: BankAccount[], accountId?: string): BankAccount | null => {
  if (!accountId) return null;
  return bankAccounts.find(acc => acc.id === accountId) || null;
};

// Goal details matching list
export const getGoalInfo = (goals: Goal[], goalId?: string): Goal | null => {
  if (!goalId) return null;
  return goals.find(g => g.id === goalId) || null;
};

export const groupTransactionsByDate = (visibleTransactions: MockTransaction[]) => {
  const groups: { [key: string]: MockTransaction[] } = {};
  const todayStr = toISODate(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toISODate(yesterday);
  const currentYear = new Date().getFullYear();

  visibleTransactions.forEach(tx => {
    let groupKey = tx.date;
    const txDateObj = new Date(tx.date);

    if (tx.date === todayStr) {
      groupKey = 'TODAY';
    } else if (tx.date === yesterdayStr) {
      groupKey = 'YESTERDAY';
    } else {
      // Format as: "THU, JULY 16" or "SAT, JULY 18, 2026"
      const weekday = txDateObj.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
      const month = txDateObj.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase();
      const day = txDateObj.getDate();
      const year = txDateObj.getFullYear();

      if (year === currentYear) {
        groupKey = `${weekday}, ${month} ${day}`;
      } else {
        groupKey = `${weekday}, ${month} ${day}, ${year}`;
      }
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(tx);
  });

  return Object.entries(groups).map(([date, list]) => ({ date, list }));
};

export const buildTransactionsCsv = (
  transactions: MockTransaction[],
  bankAccounts: BankAccount[],
  goals: Goal[],
): string => {
  const headers = ['ID', 'Date', 'Name', 'Category', 'Amount', 'Reviewed', 'Account', 'Goal', 'Notes', 'Tags'];
  const rows = transactions.map(tx => [
    tx.id,
    tx.date,
    `"${tx.name.replace(/"/g, '""')}"`,
    tx.category || '',
    tx.amount.toFixed(2),
    tx.isReviewed ? 'Yes' : 'No',
    getAccountInfo(bankAccounts, tx.bankAccountId)?.name || '',
    getGoalInfo(goals, tx.goalId)?.name || '',
    `"${(tx.notes || '').replace(/"/g, '""')}"`,
    (tx.tags || []).join(', '),
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
};

import { BankAccount, BudgetCategory, BudgetItem, RecurringBill } from '@/types/finance';
import defaultPresets from '@/data/presets.json';

const { DEFAULT_CATEGORY_PRESETS } = defaultPresets;

/**
 * Hex equivalents of the CSS `--fin-*` tokens (src/index.css), for chart libs
 * (Recharts/SVG) that need literal color strings rather than Tailwind classes.
 */
export const FIN_HEX = {
  positive: '#2f9e6e',
  negative: '#d1495b',
  accent: '#6c63d1',
  warn: '#d99a3d',
} as const;

/**
 * Small, deliberately curated categorical palette shared by every chart in the
 * finance module (budget/recurring/investment/time breakdowns), so category
 * colors read as one coordinated system instead of each chart picking its own
 * ad-hoc set of saturated defaults.
 */
export const FIN_CHART_PALETTE = [
  '#6c63d1', // indigo-violet
  '#2f9e6e', // green
  '#d99a3d', // amber
  '#d1495b', // coral-red
  '#4f8fdb', // blue
  '#c77dc9', // orchid
  '#3fb5ab', // teal
  '#b8925a', // tan
] as const;

export const DEFAULT_GROUPS: Record<string, 'needs' | 'wants' | 'savings'> = {
  home: 'needs',
  housing: 'needs',
  needs: 'needs',
  food_drink: 'needs',
  transportation: 'needs',
  insurance: 'needs',
  utilities: 'needs',
  rent: 'needs',
  subscriptions: 'wants',
  video_ent: 'wants',
  shopping: 'wants',
  entertainment: 'wants',
  pet: 'wants',
  self_care: 'wants',
  donations: 'wants',
  travel: 'wants',
  gifts: 'wants',
  other: 'wants',
  wants: 'wants',
  savings: 'savings'
};

export const calculateWeekends = (year: number): number => {
  let count = 0;
  const date = new Date(year, 0, 1);
  while (date.getFullYear() === year) {
    const day = date.getDay();
    if (day === 0 || day === 6) count++;
    date.setDate(date.getDate() + 1);
  }
  return count;
};

export const formatGBP = (num: number) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

export const stripNumberFormatting = (value: string) => value.replace(/,/g, '');

export const formatNumberInput = (value: string | number) => {
  const rawValue = String(value).replace(/,/g, '');
  if (rawValue === '') return '';

  const isNegative = rawValue.startsWith('-');
  const unsignedValue = rawValue.replace(/-/g, '');
  const [wholePart, ...decimalParts] = unsignedValue.split('.');
  const formattedWholePart = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimalPart = decimalParts.join('');

  return `${isNegative ? '-' : ''}${formattedWholePart}${unsignedValue.includes('.') ? `.${decimalPart}` : ''}`;
};

export const parseFormattedFloat = (value: string) => parseFloat(stripNumberFormatting(value));

export const parseFormattedInt = (value: string) => parseInt(stripNumberFormatting(value), 10);

export const formatReadableDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  const parts = dateStr.split('-');
  if (parts.length < 2) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parts[2] ? parseInt(parts[2], 10) : 1;
  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

export const getCategoryDefaultEmoji = (name: string): string => {
  const preset = DEFAULT_CATEGORY_PRESETS.find(
    p => p.name.toLowerCase() === name.toLowerCase()
  );
  if (preset) return preset.emoji;

  const lower = name.toLowerCase();
  if (lower.includes('housing') || lower.includes('rent') || lower.includes('mortgage') || lower.includes('home')) return '🏠';
  if (lower.includes('food') || lower.includes('grocery') || lower.includes('supermarket') || lower.includes('groceries')) return '🛒';
  if (lower.includes('dining') || lower.includes('restaurant') || lower.includes('eat') || lower.includes('cafe')) return '🍔';
  if (lower.includes('transport') || lower.includes('car') || lower.includes('uber') || lower.includes('taxi') || lower.includes('fuel') || lower.includes('gas')) return '🚗';
  if (lower.includes('utilities') || lower.includes('bills') || lower.includes('energy') || lower.includes('water') || lower.includes('electricity') || lower.includes('internet') || lower.includes('phone')) return '⚡';
  if (lower.includes('entertainment') || lower.includes('fun') || lower.includes('movie') || lower.includes('netflix') || lower.includes('game') || lower.includes('sub')) return '🎬';
  if (lower.includes('savings') || lower.includes('invest') || lower.includes('investing') || lower.includes('emergency')) return '💰';
  if (lower.includes('shopping') || lower.includes('clothes') || lower.includes('shop')) return '🛍️';
  if (lower.includes('health') || lower.includes('medical') || lower.includes('gym') || lower.includes('fitness') || lower.includes('care')) return '❤️';
  if (lower.includes('donation')) return '🤝';
  if (lower.includes('travel') || lower.includes('vacation')) return '✈️';
  if (lower.includes('gift')) return '🎁';
  if (lower.includes('pet')) return '🐶';
  if (lower.includes('insurance')) return '☂️';
  if (lower.includes('loan')) return '💰';
  return '📂';
};

export const getAccountDefaultEmoji = (type: string, name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('chase')) return '🏦';
  if (lower.includes('monzo')) return '🍊';
  if (lower.includes('revolut')) return '💳';
  if (lower.includes('amex') || lower.includes('american express')) return '✈️';
  if (lower.includes('vanguard')) return '📈';
  if (lower.includes('checking') || lower.includes('current')) return '💵';
  if (lower.includes('savings')) return '🐷';
  if (type === 'credit') return '💳';
  if (type === 'investment') return '📈';
  return '💰';
};

export const getAccountDefaultColor = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('chase')) return '#115e59'; // teal
  if (lower.includes('monzo')) return '#ff4f00'; // monzo hot coral
  if (lower.includes('revolut')) return '#3b82f6'; // blue
  if (lower.includes('amex') || lower.includes('american express')) return '#1e3a8a'; // deep blue
  if (lower.includes('vanguard')) return '#991b1b'; // dark red
  return '#475569'; // slate
};

export const sanitizeBankAccounts = (accounts: any[]): BankAccount[] => {
  if (!Array.isArray(accounts)) return [];
  return accounts.map(acc => ({
    ...acc,
    emoji: acc.emoji || getAccountDefaultEmoji(acc.type || '', acc.name || ''),
    color: acc.color || getAccountDefaultColor(acc.name || '')
  }));
};

export const sanitizeBudgetCategories = (categories: any[]): BudgetCategory[] => {
  if (!Array.isArray(categories)) return [];
  return categories.map(cat => {
    let group = cat.group;
    if (!group) {
      const id = cat.id?.toLowerCase() || '';
      const name = cat.name?.toLowerCase() || '';
      if (id in DEFAULT_GROUPS) {
        group = DEFAULT_GROUPS[id];
      } else if (name in DEFAULT_GROUPS) {
        group = DEFAULT_GROUPS[name];
      } else if (id === 'housing' || id === 'needs' || id === 'insurance' || name === 'housing' || name === 'needs' || name === 'insurance') {
        group = 'needs';
      } else if (id === 'savings' || name === 'savings') {
        group = 'savings';
      } else {
        group = 'wants';
      }
    }
    return {
      ...cat,
      group,
      budgeted: cat.budgeted !== undefined ? cat.budgeted : 0,
      items: cat.items || [],
      emoji: cat.emoji || getCategoryDefaultEmoji(cat.name || '')
    };
  });
};

export const getBudgetItemSpent = (item: BudgetItem, bankAccounts: BankAccount[], recurrings: RecurringBill[]) => {
  if (item.linkedAccountId) {
    const account = bankAccounts.find(a => a.id === item.linkedAccountId);
    if (account) return Math.abs(account.balance);
  }
  const matchingBills = recurrings.filter(r => r.linkedBudgetItemId === item.id);
  if (matchingBills.length > 0) {
    return matchingBills.reduce((sum, b) => sum + b.amount, 0);
  }
  return item.spent || 0;
};

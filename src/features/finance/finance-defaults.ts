/**
 * Budget defaults, category predicates and the small formatting helpers the
 * finance feature shares.
 *
 * Pulled out of FinancePage so the data provider and the surfaces can both
 * reach them without importing the page (REHAUL_PLAN.md 7.2b). Unlike
 * `lib/finance`, this module is finance-feature-specific and knows about the
 * seeded category presets, so it lives beside the feature rather than in lib.
 */

import defaultPresets from '@/data/presets.json';
import type {
  BankAccount,
  BudgetCategory,
  BudgetItem,
  FinanceSettings,
  RecurringBill,
  RecurringTemplate,
} from '@/features/finance/finance-types';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const { DEFAULT_CATEGORY_PRESETS } = defaultPresets;

export const presetsToDefaultCategories = (presets: { name: string; emoji: string; group: string }[]): BudgetCategory[] =>
  presets.map(preset => ({
    id: `preset_${preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    name: preset.name,
    budgeted: 0,
    group: (['needs', 'wants', 'savings'].includes(preset.group) ? preset.group : 'needs') as 'needs' | 'wants' | 'savings',
    items: [],
    emoji: preset.emoji,
  }));

export const createDefaultBudgetCategories = (): BudgetCategory[] => [
  {
    id: 'home',
    name: 'Home',
    budgeted: 0,
    group: 'needs',
    emoji: '🏠',
    items: [
      { id: 'item_rent', name: 'Rent', budgeted: 0, spent: 0 },
      { id: 'item_phone', name: 'Phone', budgeted: 0, spent: 0 },
      { id: 'item_electric', name: 'Electric Bill', budgeted: 0, spent: 0 },
      { id: 'item_internet', name: 'Internet', budgeted: 0, spent: 0 },
    ],
  },
  {
    id: 'food_drink',
    name: 'Food & Drink',
    budgeted: 0,
    group: 'needs',
    emoji: '🌮',
    items: [
      { id: 'item_groceries', name: 'Groceries', budgeted: 0, spent: 0 },
      { id: 'item_restaurants', name: 'Restaurants', budgeted: 0, spent: 0 },
    ],
  },
  {
    id: 'shopping',
    name: 'Shopping',
    budgeted: 0,
    group: 'wants',
    emoji: '🛍️',
    items: [],
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    budgeted: 0,
    group: 'wants',
    emoji: '🎬',
    items: [],
  },
  {
    id: 'transportation',
    name: 'Transportation',
    budgeted: 0,
    group: 'needs',
    emoji: '🚗',
    items: [
      { id: 'item_car_insurance', name: 'Car Insurance', budgeted: 0, spent: 0 },
      { id: 'item_gas', name: 'Gas', budgeted: 0, spent: 0 },
      { id: 'item_uber', name: 'Uber', budgeted: 0, spent: 0 },
    ],
  },
  {
    id: 'pet',
    name: 'Pet',
    budgeted: 0,
    group: 'wants',
    emoji: '🐶',
    items: [],
  },
  {
    id: 'self_care',
    name: 'Self Care',
    budgeted: 0,
    group: 'wants',
    emoji: '💛',
    items: [
      { id: 'item_personal_care', name: 'Personal Care', budgeted: 0, spent: 0 },
      { id: 'item_gym', name: 'Gym', budgeted: 0, spent: 0 },
    ],
  },
  {
    id: 'subscriptions',
    name: 'Subscriptions',
    budgeted: 0,
    group: 'wants',
    emoji: '💳',
    items: [
      { id: 'item_netflix', name: 'Netflix', budgeted: 0, spent: 0 },
      { id: 'item_audible', name: 'Audible', budgeted: 0, spent: 0 },
      { id: 'item_apple_tv', name: 'Apple TV+', budgeted: 0, spent: 0 },
      { id: 'item_hulu', name: 'Hulu', budgeted: 0, spent: 0 },
      { id: 'item_spotify', name: 'Spotify', budgeted: 0, spent: 0 },
      { id: 'item_copilot', name: 'Copilot', budgeted: 0, spent: 0 },
    ],
  },
  {
    id: 'donations',
    name: 'Donations',
    budgeted: 0,
    group: 'wants',
    emoji: '🤝',
    items: [],
  },
  {
    id: 'travel',
    name: 'Travel',
    budgeted: 0,
    group: 'wants',
    emoji: '✈️',
    items: [],
  },
  {
    id: 'gifts',
    name: 'Gifts',
    budgeted: 0,
    group: 'wants',
    emoji: '🎁',
    items: [],
  },
  {
    id: 'other',
    name: 'Other',
    budgeted: 0,
    group: 'wants',
    emoji: '🙋',
    items: [],
  },
  {
    id: 'savings',
    name: 'Savings',
    budgeted: 0,
    group: 'savings',
    emoji: '🐷',
    items: [
      { id: 'item_cash_isa', name: 'Cash ISA', budgeted: 0, spent: 0 },
      { id: 'item_stocks_shares_isa', name: 'Stocks & Shares ISA', budgeted: 0, spent: 0 },
      { id: 'item_lifetime_isa', name: 'Lifetime ISA', budgeted: 0, spent: 0 },
      { id: 'item_innovative_finance_isa', name: 'Innovative Finance ISA', budgeted: 0, spent: 0 },
      { id: 'item_junior_isa', name: 'Junior ISA', budgeted: 0, spent: 0 },
      { id: 'item_company_shares', name: 'Company Shares', budgeted: 0, spent: 0 },
      { id: 'item_investment_account', name: 'Investment account', budgeted: 0, spent: 0 },
      { id: 'item_cryptocurrency', name: 'Cryptocurrency', budgeted: 0, spent: 0 },
      { id: 'item_emergency_fund', name: 'Emergency Fund', budgeted: 0, spent: 0 },
      { id: 'item_easy_access_savings', name: 'Easy Access Savings', budgeted: 0, spent: 0 },
      { id: 'item_notice_savings_account', name: 'Notice Savings Account', budgeted: 0, spent: 0 },
      { id: 'item_regular_saver', name: 'Regular Saver', budgeted: 0, spent: 0 },
      { id: 'item_help_to_buy', name: 'Help to Buy ISA', budgeted: 0, spent: 0 },
      { id: 'item_short_term', name: 'Short term', budgeted: 0, spent: 0 },
      { id: 'item_long_term', name: 'Long term', budgeted: 0, spent: 0 },
      { id: 'item_workplace_pensions', name: 'Workplace Pensions', budgeted: 0, spent: 0 },
      { id: 'item_sipp', name: 'SIPP', budgeted: 0, spent: 0 },
      { id: 'item_premium_bonds', name: 'Premium Bonds', budgeted: 0, spent: 0 },
      { id: 'item_fixed_bonds', name: 'Fixed Bonds', budgeted: 0, spent: 0 },
      { id: 'item_fixed_rates', name: 'Fixed Rates', budgeted: 0, spent: 0 },
      { id: 'item_gilts_uk_government_bonds', name: 'Gilts (UK Government Bonds)', budgeted: 0, spent: 0 },
      { id: 'item_physical_assets', name: 'Physical Assets', budgeted: 0, spent: 0 },
    ],
  },
];

export const DEFAULT_BUDGET_CATEGORIES = createDefaultBudgetCategories();

export const DEFAULT_RECURRING_TEMPLATES: RecurringTemplate[] = [
  { name: 'Rent', category: 'Rent', emoji: '🏠', tag: 'RENT', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_rent', budgetCategoryName: 'Home' },
  { name: 'Phone Bill', category: 'Phone', emoji: '📱', tag: 'PHONE', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_phone', budgetCategoryName: 'Home' },
  { name: 'Electric Bill', category: 'Electric Bill', emoji: '💡', tag: 'ELECTRIC BILL', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_electric', budgetCategoryName: 'Home' },
  { name: 'Internet', category: 'Internet', emoji: '📶', tag: 'INTERNET', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_internet', budgetCategoryName: 'Home' },
  { name: 'Car Insurance', category: 'Car Insurance', emoji: '🚗', tag: 'CAR INSURANCE', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_car_insurance', budgetCategoryName: 'Transportation' },
  { name: 'Gym membership', category: 'Gym', emoji: '💪', tag: 'GYM', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_gym', budgetCategoryName: 'Self Care' },
  { name: 'Netflix', category: 'Netflix', emoji: '🎬', tag: 'NETFLIX', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_netflix', budgetCategoryName: 'Subscriptions' },
  { name: 'Spotify', category: 'Spotify', emoji: '🎵', tag: 'SPOTIFY', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_spotify', budgetCategoryName: 'Subscriptions' },
  { name: 'Hulu', category: 'Hulu', emoji: '📺', tag: 'HULU', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_hulu', budgetCategoryName: 'Subscriptions' },
  { name: 'Apple TV+', category: 'Apple TV+', emoji: '📺', tag: 'APPLE TV+', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_apple_tv', budgetCategoryName: 'Subscriptions' },
  { name: 'Audible', category: 'Audible', emoji: '📚', tag: 'AUDIBLE', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_audible', budgetCategoryName: 'Subscriptions' },
  { name: 'Copilot', category: 'Copilot', emoji: '✨', tag: 'COPILOT', defaultAmount: 0, frequency: 'annually', linkedBudgetItemId: 'item_copilot', budgetCategoryName: 'Subscriptions' },
  { name: 'ASPCA', category: 'Donations', emoji: '🐾', tag: 'DONATIONS', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: '', budgetCategoryName: 'Donations' },
];

export const {
  SAVINGS_PRESETS,
  FOOD_ENTERTAINMENT_PRESETS,
  HOUSING_PRESETS,
  INSURANCE_PRESETS,
  TRANSPORT_PRESETS,
  SUBSCRIPTION_PRESETS,
  LOANS_PRESETS,
  GIFTS_DONATIONS_PRESETS,
  HEALTH_WELLNESS_PRESETS,
  PETS_PRESETS,
  SHOPPING_PRESETS,
  TRAVEL_HOLIDAYS_PRESETS,
  OTHER_PRESETS,
  FAMILY_KIDS_PRESETS,
  EDUCATION_CAREER_PRESETS
} = defaultPresets;

export const ALL_PRESETS_FALLBACK = defaultPresets;

export const isDiscretionaryCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  const group = cat.group;
  return group === 'wants' || name.includes('food') || name.includes('drink') || name.includes('dining') || name.includes('entertainment');
};

export const isHousingCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  const group = cat.group;
  return group === 'needs' && (name.includes('home') || name.includes('house') || name.includes('rent') || name.includes('accommodation') || name.includes('living'));
};

export const isInsuranceCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('insurance') || name.includes('protect') || name.includes('insure') || name.includes('cover');
};

export const isTransportCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('transport') || name.includes('travel') || name.includes('car') || name.includes('vehicle') || name.includes('commute') || name.includes('transit');
};

export const isSubscriptionsCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('subscription') || name.includes('recurring') || name.includes('member');
};

export const isLoansCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('loan') || name.includes('debt') || name.includes('repayment') || name.includes('mortgage') || name.includes('borrow');
};

export const isGiftsDonationsCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('gift') || name.includes('donation') || name.includes('charity') || name.includes('giving');
};

export const isHealthWellnessCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('health') || name.includes('wellness') || name.includes('medical') || name.includes('gym') || name.includes('fitness') || name.includes('doctor') || name.includes('therapy');
};

export const isPetsCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('pet') || name.includes('dog') || name.includes('cat') || name.includes('animal') || name.includes('vet');
};

export const isShoppingCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('shopping') || name.includes('store') || name.includes('purchase') || name.includes('clothes') || name.includes('apparel');
};

export const isTravelHolidaysCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('holiday') || name.includes('vacation') || name.includes('trip') || (name.includes('travel') && !name.includes('local') && !name.includes('commute'));
};

export const isOtherCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('other') || name.includes('misc') || name.includes('ad-hoc') || name.includes('general') || name.includes('cash') || name.includes('uncategorised');
};

export const isFamilyKidsCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('family') || name.includes('kid') || name.includes('child') || name.includes('baby') || name.includes('parent');
};

export const isEducationCareerCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('education') || name.includes('career') || name.includes('course') || name.includes('stud') || name.includes('learn');
};

export const ALL_SAVINGS_IDS = SAVINGS_PRESETS.map(p => p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'));

export const DEFAULT_CATEGORY_TEMPLATES = presetsToDefaultCategories(DEFAULT_CATEGORY_PRESETS);

export const mergeMissingDefaultCategories = (loaded: BudgetCategory[], defaults: BudgetCategory[]): BudgetCategory[] => {
  const merged = [...loaded];
  defaults.forEach(defCat => {
    const exists = merged.some(c => c.name.toLowerCase() === defCat.name.toLowerCase() || c.id === defCat.id);
    if (!exists) {
      merged.push(defCat);
    }
  });
  return merged;
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
//
// Note: getBudgetItemSpent below is intentionally NOT imported from
// components/finance/utils/calculations.ts -- that module has a
// same-named function that has diverged (different balance-sign handling
// and recurring-bill matching). This is the version actually driving the
// live budget calculations on this page; do not replace it without
// reconciling the two implementations first.
export const getBudgetItemSpent = (item: BudgetItem, bankAccounts: BankAccount[], recurrings: RecurringBill[]) => {
  if (item.linkedAccountId) {
    const acc = bankAccounts.find(a => a.id === item.linkedAccountId);
    return acc ? acc.balance : item.spent;
  }
  const linkedRecurrings = recurrings.filter(r => r.linkedBudgetItemId === item.id && r.isPaid);
  const recurringsSpent = linkedRecurrings.reduce((sum, r) => sum + r.amount, 0);
  return item.spent + recurringsSpent;
};



export const getOrdinal = (d: number) => {
  if (d > 3 && d < 21) return 'th';
  switch (d % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
};

export const getDueDateText = (bill: RecurringBill, currentMonth: number, overrideMonth?: number) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayStr = `${bill.dueDate}${getOrdinal(bill.dueDate)}`;
  if (bill.frequency === 'monthly' || bill.frequency === 'weekly') {
    const targetMonth = overrideMonth !== undefined ? overrideMonth : currentMonth;
    const monthName = months[(targetMonth - 1 + 12) % 12];
    return `${monthName} ${dayStr}`;
  } else {
    const monthName = months[(bill.dueMonth || 1) - 1];
    return `${monthName} ${dayStr}`;
  }
};

export const isDueThisMonth = (bill: RecurringBill, currentMonth: number) => {
  if (bill.frequency === 'monthly') return true;
  if (bill.frequency === 'weekly') return true;
  if (bill.frequency === 'annually') {
    return bill.dueMonth === currentMonth;
  }
  if (bill.frequency === 'quarterly') {
    const startMonth = bill.dueMonth || 1;
    return (currentMonth - startMonth) % 3 === 0;
  }
  return true;
};

export const getPlanName = (plan: FinanceSettings['studentLoanPlan']) => {
  switch (plan) {
    case 'none': return 'None';
    case 'plan1': return 'Plan 1';
    case 'plan2': return 'Plan 2';
    case 'plan4': return 'Plan 4';
    case 'plan5': return 'Plan 5';
    case 'postgrad': return 'Postgraduate';
  }
};

/**
 * Narrows a preset's `group`, which presets.json types as a plain string, to
 * the three groups a budget category can actually be in. Anything unexpected
 * falls to 'needs' rather than being cast through and trusted.
 */
export const asBudgetGroup = (group?: string): BudgetCategory['group'] =>
  group === 'needs' || group === 'wants' || group === 'savings' ? group : 'needs';

/**
 * The budget arithmetic several views share.
 *
 * These used to be closures inside FinancePage over `settings`, `bankAccounts`
 * and `recurrings`, which is why Budget and the dashboard could not be pulled
 * apart (REHAUL_PLAN.md 7.2c-i). A factory keeps the call sites reading exactly
 * as they did while letting any surface build its own from the provider.
 */
export const makeBudgetMath = (
  activeSavingsTypes: string[] | undefined,
  bankAccounts: BankAccount[],
  recurrings: RecurringBill[],
) => {
  /** A savings preset the user has switched off does not count toward a total. */
  const isItemActive = (item: BudgetItem, cat: BudgetCategory) => {
    if (cat.group !== 'savings') return true;
    const key = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const isPreset = SAVINGS_PRESETS.some(p => p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') === key);
    if (!isPreset) return true; // custom item
    return (activeSavingsTypes || ALL_SAVINGS_IDS).includes(key);
  };

  const getCategoryBudget = (cat: BudgetCategory) => {
    if (cat.group === 'savings') {
      return cat.items.filter(item => isItemActive(item, cat)).reduce((s, i) => s + (i.budgeted || 0), 0);
    }
    return cat.budgeted !== undefined ? cat.budgeted : cat.items.reduce((s, i) => s + (i.budgeted || 0), 0);
  };

  const getCategorySpent = (cat: BudgetCategory) => {
    const itemsToSum = cat.group === 'savings'
      ? cat.items.filter(item => isItemActive(item, cat))
      : cat.items;
    return itemsToSum.reduce((s, i) => s + getBudgetItemSpent(i, bankAccounts, recurrings), 0);
  };

  return { isItemActive, getCategoryBudget, getCategorySpent };
};

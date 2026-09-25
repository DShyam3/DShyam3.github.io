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
import { exactTaxYearOf } from '@/lib/finance/student-loan';
import type {
  BankAccount,
  BudgetCategory,
  BudgetItem,
  FinanceSettings,
  RecurringBill,
  RecurringTemplate,
  TaxConfig,
} from '@/features/finance/finance-types';

/**
 * The UK tax year (starting 6 April) `today` falls in; 2026 means 2026/27.
 *
 * Compared on local date fields. Going through an ISO string and `taxYearOf`
 * reparses it as UTC midnight, which west of Greenwich puts 6 April back in
 * the previous tax year.
 */
export const currentTaxYear = (today: Date = new Date()): number => exactTaxYearOf(today);

/**
 * Where a fortnightly pay cycle is counted from when none has been set.
 *
 * Any past Friday serves: only the date's parity against today matters, so
 * this does not go stale as years pass. It is a constant rather than today
 * because "today" would move the computed payday every day it was read, and
 * every fallback site must agree or the settings form and the payday
 * calculation disagree about the same unset field.
 */
export const DEFAULT_BIWEEKLY_ANCHOR = '2026-01-02';

/**
 * The settings a fresh profile starts from. Shared by the data provider's
 * initial state and the settings dialog's "reset to defaults" fallback, so
 * the two never drift the way the duplicated literals used to.
 */
export const createDefaultFinanceSettings = (activeSavingsTypes: string[], today: Date = new Date()): FinanceSettings => ({
  grossSalary: 0,
  pensionType: 'net_pay',
  personalPensionPercent: 0,
  employerPensionPercent: 0,
  studentLoanPlan: 'none',
  taxCode: '1257L',
  personalAllowance: 12570,
  weekends: 104,
  bankHolidays: 8,
  workHolidays: 25,
  workingHoursPerDay: 7.5,
  taxYear: currentTaxYear(today),
  ukRegion: 'england-and-wales',
  holidaysByUser: {},
  activeSavingsTypes,
});

/** A zeroed tax-rate timeline, effective from that tax year's 6 April, used
 *  until real rates are loaded or set. */
export const createEmptyTaxConfig = (today: Date = new Date()): TaxConfig => ({
  effectiveFrom: `${currentTaxYear(today)}-04-06`,
  studentLoanThresholds: { none: Infinity, plan1: 0, plan2: 0, plan4: 0, plan5: 0, postgrad: 0 },
  studentLoanRates: { none: 0, plan1: 0, plan2: 0, plan4: 0, plan5: 0, postgrad: 0 },
  incomeTaxBands: { basicRateLimit: 0, higherRateLimit: 0, basicRatePercent: 0, higherRatePercent: 0, additionalRatePercent: 0 },
  nationalInsuranceBands: { lowerThreshold: 0, upperThreshold: 0, mainRatePercent: 0, upperRatePercent: 0 },
});

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
      { id: 'item_council_tax', name: 'Council Tax', budgeted: 0, spent: 0 },
      { id: 'item_electric', name: 'Energy', budgeted: 0, spent: 0 },
      { id: 'item_water', name: 'Water', budgeted: 0, spent: 0 },
      { id: 'item_internet', name: 'Internet', budgeted: 0, spent: 0 },
      { id: 'item_phone', name: 'Phone', budgeted: 0, spent: 0 },
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
      { id: 'item_fuel', name: 'Fuel', budgeted: 0, spent: 0 },
      { id: 'item_public_transport', name: 'Public Transport', budgeted: 0, spent: 0 },
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
    items: [],
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
  { name: 'Council Tax', category: 'Council Tax', emoji: '🏛️', tag: 'COUNCIL TAX', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_council_tax', budgetCategoryName: 'Home' },
  { name: 'Energy', category: 'Energy', emoji: '💡', tag: 'ENERGY', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_electric', budgetCategoryName: 'Home' },
  { name: 'Water', category: 'Water', emoji: '💧', tag: 'WATER', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_water', budgetCategoryName: 'Home' },
  { name: 'Internet', category: 'Internet', emoji: '📶', tag: 'INTERNET', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_internet', budgetCategoryName: 'Home' },
  { name: 'Phone Bill', category: 'Phone', emoji: '📱', tag: 'PHONE', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_phone', budgetCategoryName: 'Home' },
  { name: 'Car Insurance', category: 'Car Insurance', emoji: '🚗', tag: 'CAR INSURANCE', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_car_insurance', budgetCategoryName: 'Transportation' },
  { name: 'Gym membership', category: 'Gym', emoji: '💪', tag: 'GYM', defaultAmount: 0, frequency: 'monthly', linkedBudgetItemId: 'item_gym', budgetCategoryName: 'Self Care' },
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
  // 'rent' is whole-word: a substring match also catches "parent", "current"
  // and "different" -- the same collision class as isPetsCategory's 'cat'.
  return group === 'needs' && (name.includes('home') || name.includes('house') || /\brent(s|al|als)?\b/.test(name) || name.includes('accommodation') || name.includes('living'));
};

export const isInsuranceCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  // 'cover' is whole-word (plus its inflections): a substring match also
  // catches "recovery" and "discover".
  return name.includes('insurance') || name.includes('protect') || name.includes('insure') || /\bcover(s|ed|age)?\b/.test(name);
};

export const isTransportCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  // 'car' is whole-word: a substring match also catches "care" and
  // "childcare" -- it would otherwise claim the shipped "Self Care" category.
  return name.includes('transport') || name.includes('travel') || /\bcars?\b/.test(name) || name.includes('vehicle') || name.includes('commute') || name.includes('transit');
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
  // Whole-word only: a plain substring match on 'cat' also catches
  // "Education", "Vacation" and "Communication", and 'pet' would catch
  // "Carpet". Each is matched with its plural, since a word-boundary regex
  // does not stop mid-word (e.g. \bcat\b would not match "cats").
  return /\b(pets?|dogs?|cats?|animals?|vets?|veterinary)\b/.test(name);
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
  // 'other' is whole-word: a substring match also catches "mother",
  // "another" and "brother".
  return /\bothers?\b/.test(name) || name.includes('misc') || name.includes('ad-hoc') || name.includes('general') || name.includes('cash') || name.includes('uncategorised');
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

import {
  BankAccount,
  BudgetCategory,
  BudgetItem,
  RecurringBill,
  FinanceSettings,
  UserHoliday,
  RecurringTemplate,
  CategoryPreset,
  BureauBand,
  UniversalStanding,
} from '@/types/finance';
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

// ==========================================
// CREDIT SCORE HELPERS
// ==========================================

export const BUREAU_BANDS: Record<'experian' | 'transunion' | 'equifax', BureauBand[]> = {
  experian: [
    { name: 'Low', min: 0, max: 640, color: '#d1495b', hoverColor: '#dc2626', description: 'Borrowing may be difficult and interest rates could be high. But our tools can help get your score moving in the right direction. Every small increase helps, and things should improve as you get closer to a Fair score.' },
    { name: 'Fair', min: 641, max: 860, color: '#d99a3d', hoverColor: '#d97706', description: 'You might get limited credit options, higher interest rates, and lower borrowing limits. But our tools can help improve your score. And as it grows, so will your choices.' },
    { name: 'Good', min: 861, max: 1000, color: '#2f9e6e', hoverColor: '#65a30d', description: 'You should see a wide range of credit cards, loans and mortgages (but you might have to pay a bit more interest).' },
    { name: 'Very Good', min: 1001, max: 1120, color: '#2f9e6e', hoverColor: '#059669', description: 'You should get most credit cards, loans and mortgages (but you might not get the very best deals).' },
    { name: 'Excellent', min: 1121, max: 1250, color: '#2f9e6e', hoverColor: '#065f46', description: 'You should get the best credit cards, loans and mortgages (but there are no guarantees).' }
  ],
  transunion: [
    { name: 'Needs Work', min: 0, max: 565, color: '#d1495b', hoverColor: '#dc2626', description: 'Your credit history needs work. You may struggle to get credit, and if you do, interest rates will likely be high.' },
    { name: 'Fair', min: 566, max: 603, color: '#d99a3d', hoverColor: '#d97706', description: 'You have a fair credit history. You may find it harder to get credit or might have to pay higher interest rates.' },
    { name: 'Good', min: 604, max: 627, color: '#2f9e6e', hoverColor: '#059669', description: 'You have a good credit history and should be approved for most credit offers, though you may not get the lowest rates.' },
    { name: 'Excellent', min: 628, max: 710, color: '#2f9e6e', hoverColor: '#065f46', description: 'You have a great credit history and are highly likely to be approved for credit and get the best interest rates.' }
  ],
  equifax: [
    { name: 'Start Climbing', min: 0, max: 409, color: '#d1495b', hoverColor: '#dc2626', description: 'Your score is low. You might find it difficult to get credit, or have to pay very high interest rates.' },
    { name: 'Moving On Up', min: 410, max: 519, color: '#d99a3d', hoverColor: '#d97706', description: 'You\'re starting to build your score. Credit options may be limited and rates could be higher.' },
    { name: 'On Good Ground', min: 520, max: 604, color: '#2f9e6e', hoverColor: '#65a30d', description: 'Your score is okay. You might get accepted for credit, but interest rates might be higher.' },
    { name: 'Looking Bright', min: 605, max: 724, color: '#2f9e6e', hoverColor: '#059669', description: 'You\'re in a good position. You should be accepted for most credit, with decent interest rates.' },
    { name: 'Soaring High', min: 725, max: 1000, color: '#2f9e6e', hoverColor: '#065f46', description: 'Lenders will see you as a very low risk. You\'re likely to get the best deals on loans, credit cards, and mortgages.' }
  ]
};

export function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

export function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, startAngle);
  const end = polarToCartesian(x, y, radius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 1, end.x, end.y
  ].join(' ');
}

export function getUniversalStanding(creditScores: {
  experian: { score: number }[];
  transunion: { score: number }[];
  equifax: { score: number }[];
}): UniversalStanding | null {
  const ratings: number[] = [];

  // Experian
  const expEntries = creditScores.experian || [];
  if (expEntries.length > 0) {
    const score = expEntries[expEntries.length - 1].score;
    if (score >= 1121) ratings.push(5);
    else if (score >= 1001) ratings.push(4.2);
    else if (score >= 861) ratings.push(3.5);
    else if (score >= 641) ratings.push(2.5);
    else ratings.push(1);
  }

  // Transunion
  const tuEntries = creditScores.transunion || [];
  if (tuEntries.length > 0) {
    const score = tuEntries[tuEntries.length - 1].score;
    if (score >= 628) ratings.push(5);
    else if (score >= 604) ratings.push(3.8);
    else if (score >= 566) ratings.push(2.5);
    else ratings.push(1);
  }

  // Equifax
  const eqEntries = creditScores.equifax || [];
  if (eqEntries.length > 0) {
    const score = eqEntries[eqEntries.length - 1].score;
    if (score >= 725) ratings.push(5);
    else if (score >= 605) ratings.push(4.2);
    else if (score >= 520) ratings.push(3.2);
    else if (score >= 410) ratings.push(2.2);
    else ratings.push(1);
  }

  if (ratings.length === 0) return null;

  const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;

  if (average >= 4.5) {
    return {
      label: 'Excellent',
      rating: average,
      color: '#2f9e6e',
      cls: 'text-fin-positive',
      desc: 'Lenders will view you as an extremely reliable borrower. You qualify for the best financial deals.',
    };
  }
  if (average >= 3.5) {
    return {
      label: 'Very Good',
      rating: average,
      color: '#2f9e6e',
      cls: 'text-fin-positive',
      desc: 'Your credit standing is strong. You are likely to qualify for premium rates and high limits.',
    };
  }
  if (average >= 2.8) {
    return {
      label: 'Good',
      rating: average,
      color: '#2f9e6e',
      cls: 'text-fin-positive',
      desc: 'You have a healthy credit history. You will see a wide choice of loans and credit cards.',
    };
  }
  if (average >= 1.8) {
    return {
      label: 'Fair',
      rating: average,
      color: '#d99a3d',
      cls: 'text-fin-warn',
      desc: 'Your credit score is acceptable, but you may face higher interest rates or lower borrowing limits.',
    };
  }
  return {
    label: 'Needs Work',
    rating: average,
    color: '#d1495b',
    cls: 'text-fin-negative',
    desc: 'Borrowing options are limited. Focus on rebuilding your payment history to improve your rating.',
  };
}

// ==========================================
// BUDGET CATEGORY DEFAULTS & CLASSIFICATION
// ==========================================

export const presetsToDefaultCategories = (presets: CategoryPreset[]): BudgetCategory[] =>
  presets.map(preset => ({
    id: `preset_${preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    name: preset.name,
    budgeted: 0,
    group: preset.group,
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

const {
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

// Guards against a corrupted/malformed localStorage value crashing this
// page's mount -- these run inside useState initializers, so an uncaught
// parse error here previously took down the entire Finance page.
export const safeParseJSON = <T,>(saved: string | null, fallback: T): T => {
  if (!saved) return fallback;
  try {
    return JSON.parse(saved) as T;
  } catch (e) {
    console.error('Failed to parse stored finance data, using fallback:', e);
    return fallback;
  }
};

export const resolveStoredList = <T,>(saved: string | null, fallback: T[]): T[] => {
  if (!saved) return fallback;
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
};

// ==========================================
// DATE / HOLIDAY / PAYDAY HELPERS
// ==========================================

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

export const parseDays = (datesStr: string): number[] => {
  const days: number[] = [];
  if (!datesStr) return days;

  const parts = datesStr.split(/[+,;]/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const rangeParts = trimmed.split('-');
      if (rangeParts.length === 2) {
        const start = parseInt(rangeParts[0].trim(), 10);
        const end = parseInt(rangeParts[1].trim(), 10);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            days.push(i);
          }
        }
      }
    } else {
      const day = parseInt(trimmed, 10);
      if (!isNaN(day)) {
        days.push(day);
      }
    }
  }
  return days;
};

export const formatDaysList = (days: number[]): string => {
  if (days.length === 0) return '';
  const sorted = [...days].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
    } else {
      if (start === prev) {
        ranges.push(start.toString());
      } else {
        ranges.push(`${start}-${prev}`);
      }
      start = current;
      prev = current;
    }
  }
  return ranges.join(' + ');
};

export const getDaysInMonth = (year: number, monthIndex: number) => {
  return new Date(year, monthIndex + 1, 0).getDate();
};

export const getStartDayOfWeek = (year: number, monthIndex: number) => {
  const day = new Date(year, monthIndex, 1).getDay();
  return day === 0 ? 6 : day - 1; // 0 for Mon, 6 for Sun
};

export const parseEntryDays = (entry: string): number => {
  const clean = entry.trim();
  const rangeMatch = clean.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return end - start + 1;
    }
  }
  const single = parseInt(clean, 10);
  if (!isNaN(single)) {
    return 1;
  }
  return 0;
};

export const getNormalizedHolidays = (settings: FinanceSettings, holidayDefaults: any): UserHoliday[] => {
  const hols = settings.holidaysByUser || holidayDefaults || {};
  if (Array.isArray(hols)) {
    return hols;
  }

  const list: UserHoliday[] = [];
  Object.entries(hols).forEach(([monthKey, val]: [string, any]) => {
    const monthIdx = parseInt(monthKey, 10);
    if (isNaN(monthIdx)) return;
    if (val && val.dates && val.count > 0) {
      const segments = val.dates.split(/[,+]/).map((s: string) => s.trim()).filter(Boolean);
      segments.forEach((seg: string, segIdx: number) => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const rangeMatch = seg.match(/^(\d+)-(\d+)$/);
        let startDay = 1;
        let endDay = 1;
        if (rangeMatch) {
          startDay = parseInt(rangeMatch[1], 10);
          endDay = parseInt(rangeMatch[2], 10);
        } else {
          const single = parseInt(seg, 10);
          if (!isNaN(single)) {
            startDay = single;
            endDay = single;
          }
        }

        const year = settings.taxYear || new Date().getFullYear();
        const startStr = `${year}-${pad(monthIdx + 1)}-${pad(startDay)}`;
        const endStr = `${year}-${pad(monthIdx + 1)}-${pad(endDay)}`;

        list.push({
          id: `legacy-${monthIdx}-${segIdx}-${Date.now()}`,
          startDate: startStr,
          endDate: endStr,
          occasion: val.occasion || 'Leave',
          count: parseEntryDays(seg)
        });
      });
    }
  });
  return list;
};

export const getBookedDaysForMonth = (holidays: UserHoliday[], year: number, monthIdx: number, bankHolidays: string[]): { day: number; occasion: string }[] => {
  const booked: { day: number; occasion: string }[] = [];
  holidays.forEach(hol => {
    const start = new Date(hol.startDate);
    const end = new Date(hol.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

    const current = new Date(start);
    while (current <= end) {
      if (current.getFullYear() === year && current.getMonth() === monthIdx) {
        const dayOfWeek = current.getDay();
        const mm = String(current.getMonth() + 1).padStart(2, '0');
        const dd = String(current.getDate()).padStart(2, '0');
        const dateStr = `${year}-${mm}-${dd}`;
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isBankHoliday = bankHolidays.includes(dateStr);

        if (!isWeekend && !isBankHoliday) {
          booked.push({
            day: current.getDate(),
            occasion: hol.occasion
          });
        }
      }
      current.setDate(current.getDate() + 1);
    }
  });
  return booked;
};

export const calculateWorkingDaysInRange = (startStr: string, endStr: string, bankHolidays: string[]): number => {
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isBankHoliday = bankHolidays.includes(dateStr);

    if (!isWeekend && !isBankHoliday) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
};

export const formatHolidayDates = (startStr: string, endStr: string): string => {
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';

  const optWithoutYear: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const optWithYear: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: '2-digit' };

  if (startStr === endStr) {
    return start.toLocaleDateString('en-GB', optWithYear);
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-GB', optWithoutYear)} - ${end.toLocaleDateString('en-GB', optWithYear)}`;
  }
  return `${start.toLocaleDateString('en-GB', optWithYear)} - ${end.toLocaleDateString('en-GB', optWithYear)}`;
};

export const calculateActualPayday = (year: number, monthIndex: number, scheduledDay: number, bankHolidays: string[]) => {
  const maxDay = getDaysInMonth(year, monthIndex);
  const targetDay = Math.min(scheduledDay, maxDay);
  const date = new Date(year, monthIndex, targetDay);

  let adjusted = false;
  let adjustReason: 'weekend' | 'bank_holiday' | null = null;

  while (true) {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      adjusted = true;
      adjustReason = 'weekend';
      date.setDate(date.getDate() - 1);
    } else if (bankHolidays.includes(dateStr)) {
      adjusted = true;
      adjustReason = 'bank_holiday';
      date.setDate(date.getDate() - 1);
    } else {
      break;
    }
  }

  return { date, adjusted, adjustReason };
};

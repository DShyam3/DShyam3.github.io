import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Settings,
  TrendingUp,
  DollarSign,
  Briefcase,
  Calendar,
  Percent,
  Info,
  Edit2,
  Check,
  Undo2,
  Loader2,
  Trash2,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  CreditCard,
  PiggyBank,
  PlusCircle,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Activity,
  Award,
  CheckCircle2,
  Circle,
  ShieldAlert,
  X,
  RefreshCw,
  TrendingDown,
  Pencil,
  Sliders,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as UICalendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  ReferenceLine
} from 'recharts';

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface FinanceSettings {
  grossSalary: number;
  pensionType: 'net_pay' | 'salary_sacrifice' | 'relief_at_source';
  personalPensionPercent: number;
  employerPensionPercent: number;
  studentLoanPlan: 'none' | 'plan1' | 'plan2' | 'plan4' | 'plan5' | 'postgrad';
  taxCode: string;
  personalAllowance: number;
  weekends: number;
  bankHolidays: number;
  workHolidays: number;
  workingHoursPerDay: number;
  taxYear: number;
  ukRegion: 'england-and-wales' | 'scotland' | 'northern-ireland';
  holidaysByUser?: Record<number, { count: number; dates: string; occasion: string }> | UserHoliday[];
  payDayOfMonth?: number;
  paydaySchedule?: 'monthly_date' | 'last_working_day' | 'last_friday' | 'biweekly' | 'weekly' | 'semimonthly';
  paydayWeekday?: number;
  paydayBiweeklyAnchor?: string;
}

export interface UserHoliday {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  occasion: string;
  count: number;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // YYYY-MM-DD
  contributions: { id: string; amount: number; date: string; note?: string; bankAccountId?: string }[];
  startDate?: string; // YYYY-MM-DD
}

export interface BankAccount {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment';
  issuer: string;
  balance: number; // Positive for asset, negative for debt
  annualFee: number;
  useCase?: string;
  emoji?: string;
  color?: string;
}

export interface Membership {
  id: string;
  name: string;
  type: 'points' | 'cashback' | 'miles' | 'perks';
  status: string; // e.g., "Silver", "Active"
  annualFee: number;
  useCase?: string;
}

export interface BudgetItem {
  id: string;
  name: string;
  budgeted: number;
  spent: number;
  linkedAccountId?: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  budgeted: number;
  group?: 'needs' | 'wants' | 'savings';
  items: BudgetItem[];
  emoji?: string;
}

export interface RecurringBill {
  id: string;
  name: string;
  amount: number;
  dueDate: number; // Day of month
  isPaid: boolean;
  frequency: 'monthly' | 'annually' | 'quarterly' | 'weekly';
  dueMonth?: number; // 1-12, relevant for annually/quarterly
  emoji?: string;
  category?: string; // e.g. Rent, Subscriptions
  tag?: string; // e.g. RENT, SPOTIFY
  linkedBudgetItemId?: string;
  linkedAccountId?: string;
}

export interface CreditScoreEntry {
  id: string;
  date: string; // YYYY-MM-DD
  score: number;
}

export interface CreditScores {
  experian: CreditScoreEntry[];
  transunion: CreditScoreEntry[];
  equifax: CreditScoreEntry[];
}

export interface MockTransaction {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  isReviewed: boolean;
}

export interface TaxConfig {
  studentLoanThresholds: Record<'none' | 'plan1' | 'plan2' | 'plan4' | 'plan5' | 'postgrad', number>;
  studentLoanRates: Record<'none' | 'plan1' | 'plan2' | 'plan4' | 'plan5' | 'postgrad', number>;
  incomeTaxBands: {
    basicRateLimit: number;
    higherRateLimit: number;
    basicRatePercent: number;
    higherRatePercent: number;
    additionalRatePercent: number;
  };
  nationalInsuranceBands: {
    lowerThreshold: number;
    upperThreshold: number;
    mainRatePercent: number;
    upperRatePercent: number;
  };
}

export interface RecurringTemplate {
  name: string;
  category: string;
  emoji: string;
  tag: string;
  defaultAmount: number;
  frequency: 'monthly' | 'annually' | 'quarterly' | 'weekly';
  linkedBudgetItemId: string;
  budgetCategoryName?: string;
}

interface CategoryPreset {
  name: string;
  emoji: string;
  group: 'needs' | 'wants' | 'savings';
}

export interface CreditBureauConfig {
  key: 'experian' | 'transunion' | 'equifax';
  label: string;
  emoji: string;
  color: string;
  maxScore: number;
  gradient: string;
}

// ==========================================
// CONSTANTS & DEFAULTS
// ==========================================

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'budget', label: 'Budget' },
  { key: 'recurrings', label: 'Recurrings' },
  { key: 'cash-flow', label: 'Cash Flow' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'goals', label: 'Goals' },
  { key: 'tax-income', label: 'Tax & Income' },
] as const;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DEFAULT_GROUPS: Record<string, 'needs' | 'wants' | 'savings'> = {
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

const DEFAULT_CATEGORY_PRESETS: CategoryPreset[] = [
  { name: 'Bars & Nightlife', emoji: '🥃', group: 'wants' },
  { name: 'Beauty', emoji: '💄', group: 'wants' },
  { name: 'Car', emoji: '🚗', group: 'needs' },
  { name: 'Children', emoji: '🚸', group: 'needs' },
  { name: 'Clothing', emoji: '👕', group: 'wants' },
  { name: 'Dance', emoji: '💃', group: 'wants' },
  { name: 'Donations', emoji: '🤝', group: 'wants' },
  { name: 'Education', emoji: '📘', group: 'needs' },
  { name: 'Entertainment', emoji: '🎟️', group: 'wants' },
  { name: 'Groceries', emoji: '🥑', group: 'needs' },
  { name: 'Gym', emoji: '👟', group: 'wants' },
  { name: 'Healthcare', emoji: '💊', group: 'needs' },
  { name: 'Home', emoji: '🏠', group: 'needs' },
  { name: 'Insurance', emoji: '☂️', group: 'needs' },
  { name: 'Loans', emoji: '💰', group: 'needs' },
  { name: 'Personal Care', emoji: '✂️', group: 'wants' },
  { name: 'Pets', emoji: '🐶', group: 'wants' },
  { name: 'Recreation', emoji: '🎫', group: 'wants' },
  { name: 'Rent', emoji: '🔑', group: 'needs' },
  { name: 'Restaurants', emoji: '🍔', group: 'wants' },
  { name: 'Senior Care', emoji: '👵', group: 'needs' },
  { name: 'Shops', emoji: '🛍️', group: 'wants' },
  { name: 'Sports', emoji: '🚴', group: 'wants' },
  { name: 'Subscriptions', emoji: '💳', group: 'wants' },
  { name: 'Transportation', emoji: '🚌', group: 'needs' },
  { name: 'Travel & Vacation', emoji: '🏖️', group: 'wants' },
  { name: 'Utilities', emoji: '🔌', group: 'needs' },
  { name: 'Work Expenses', emoji: '💼', group: 'needs' },
  { name: 'Yoga & Pilates', emoji: '🧘', group: 'wants' },
];

const presetsToDefaultCategories = (presets: CategoryPreset[]): BudgetCategory[] =>
  presets.map(preset => ({
    id: `preset_${preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    name: preset.name,
    budgeted: 0,
    group: preset.group,
    items: [],
    emoji: preset.emoji,
  }));

const createDefaultBudgetCategories = (): BudgetCategory[] => [
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
];

const DEFAULT_BUDGET_CATEGORIES = createDefaultBudgetCategories();

const DEFAULT_RECURRING_TEMPLATES: RecurringTemplate[] = [
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

const DEFAULT_CATEGORY_TEMPLATES = presetsToDefaultCategories(DEFAULT_CATEGORY_PRESETS);

const resolveStoredList = <T,>(saved: string | null, fallback: T[]): T[] => {
  if (!saved) return fallback;
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

const calculateWeekends = (year: number): number => {
  let count = 0;
  const date = new Date(year, 0, 1);
  while (date.getFullYear() === year) {
    const day = date.getDay();
    if (day === 0 || day === 6) count++;
    date.setDate(date.getDate() + 1);
  }
  return count;
};

const formatGBP = (num: number) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

const stripNumberFormatting = (value: string) => value.replace(/,/g, '');

const formatNumberInput = (value: string | number) => {
  const rawValue = String(value).replace(/,/g, '');
  if (rawValue === '') return '';

  const isNegative = rawValue.startsWith('-');
  const unsignedValue = rawValue.replace(/-/g, '');
  const [wholePart, ...decimalParts] = unsignedValue.split('.');
  const formattedWholePart = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimalPart = decimalParts.join('');

  return `${isNegative ? '-' : ''}${formattedWholePart}${unsignedValue.includes('.') ? `.${decimalPart}` : ''}`;
};

const parseFormattedFloat = (value: string) => parseFloat(stripNumberFormatting(value));

const parseFormattedInt = (value: string) => parseInt(stripNumberFormatting(value), 10);

const formatReadableDate = (dateStr?: string) => {
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



const getCategoryDefaultEmoji = (name: string): string => {
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

const getAccountDefaultEmoji = (type: string, name: string): string => {
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

const getAccountDefaultColor = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('chase')) return '#115e59'; // teal
  if (lower.includes('monzo')) return '#ff4f00'; // monzo hot coral
  if (lower.includes('revolut')) return '#3b82f6'; // blue
  if (lower.includes('amex') || lower.includes('american express')) return '#1e3a8a'; // deep blue
  if (lower.includes('vanguard')) return '#991b1b'; // dark red
  return '#475569'; // slate
};

const sanitizeBankAccounts = (accounts: any[]): BankAccount[] => {
  if (!Array.isArray(accounts)) return [];
  return accounts.map(acc => ({
    ...acc,
    emoji: acc.emoji || getAccountDefaultEmoji(acc.type || '', acc.name || ''),
    color: acc.color || getAccountDefaultColor(acc.name || '')
  }));
};

const sanitizeBudgetCategories = (categories: any[]): BudgetCategory[] => {
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

const getBudgetItemSpent = (item: BudgetItem, bankAccounts: BankAccount[], recurrings: RecurringBill[]) => {
  if (item.linkedAccountId) {
    const acc = bankAccounts.find(a => a.id === item.linkedAccountId);
    return acc ? acc.balance : item.spent;
  }
  const linkedRecurrings = recurrings.filter(r => r.linkedBudgetItemId === item.id && r.isPaid);
  const recurringsSpent = linkedRecurrings.reduce((sum, r) => sum + r.amount, 0);
  return item.spent + recurringsSpent;
};



const getOrdinal = (d: number) => {
  if (d > 3 && d < 21) return 'th';
  switch (d % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
};

const getDueDateText = (bill: RecurringBill, currentMonth: number) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayStr = `${bill.dueDate}${getOrdinal(bill.dueDate)}`;
  if (bill.frequency === 'monthly' || bill.frequency === 'weekly') {
    const currentMonthName = months[currentMonth - 1];
    return `${currentMonthName} ${dayStr}`;
  } else {
    const monthName = months[(bill.dueMonth || 1) - 1];
    return `${monthName} ${dayStr}`;
  }
};

const isDueThisMonth = (bill: RecurringBill, currentMonth: number) => {
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

const getPlanName = (plan: FinanceSettings['studentLoanPlan']) => {
  switch (plan) {
    case 'none': return 'None';
    case 'plan1': return 'Plan 1';
    case 'plan2': return 'Plan 2';
    case 'plan4': return 'Plan 4';
    case 'plan5': return 'Plan 5';
    case 'postgrad': return 'Postgraduate';
  }
};

const parseDays = (datesStr: string): number[] => {
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

const formatDaysList = (days: number[]): string => {
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

const getDaysInMonth = (year: number, monthIndex: number) => {
  return new Date(year, monthIndex + 1, 0).getDate();
};

const getStartDayOfWeek = (year: number, monthIndex: number) => {
  const day = new Date(year, monthIndex, 1).getDay();
  return day === 0 ? 6 : day - 1; // 0 for Mon, 6 for Sun
};

const parseEntryDays = (entry: string): number => {
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

const getNormalizedHolidays = (settings: FinanceSettings, holidayDefaults: any): UserHoliday[] => {
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

const getBookedDaysForMonth = (holidays: UserHoliday[], year: number, monthIdx: number, bankHolidays: string[]): { day: number; occasion: string }[] => {
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

const calculateWorkingDaysInRange = (startStr: string, endStr: string, bankHolidays: string[]): number => {
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

const formatHolidayDates = (startStr: string, endStr: string): string => {
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

const calculateActualPayday = (year: number, monthIndex: number, scheduledDay: number, bankHolidays: string[]) => {
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

const Sparkline = ({ data }: { data: number[] }) => {
  if (data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 30;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="w-24 h-8 text-primary overflow-visible" viewBox={`0 0 ${width} ${height}`}>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function Finance() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  // Tab State with LocalStorage Persistence
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['key']>(() => {
    const saved = localStorage.getItem('finance_active_tab');
    if (saved) {
      const isValid = TABS.some(tab => tab.key === saved);
      if (isValid) return saved as typeof TABS[number]['key'];
    }
    return 'dashboard';
  });

  // Cash flow period selector
  const [cfPeriod, setCfPeriod] = useState<'ytd' | 'mtd' | 'last_12m' | 'last_3m' | 'last_4w' | 'custom'>('ytd');
  const [cfPeriodOpen, setCfPeriodOpen] = useState(false);
  const [cfCustomStart, setCfCustomStart] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-01-01`;
  });
  const [cfCustomEnd, setCfCustomEnd] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [cfStartOpen, setCfStartOpen] = useState(false);
  const [cfEndOpen, setCfEndOpen] = useState(false);

  // Store defaults from database
  const [databaseDefaults, setDatabaseDefaults] = useState<Record<string, any>>({});

  // Data States
  const [settings, setSettings] = useState<FinanceSettings>(() => {
    const saved = localStorage.getItem('finance_settings');
    return saved ? JSON.parse(saved) : {
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
      taxYear: 2026,
      ukRegion: 'england-and-wales',
      holidaysByUser: {}
    };
  });

  const [goals, setGoals] = useState<Goal[]>(() => {
    const saved = localStorage.getItem('finance_goals');
    return saved ? JSON.parse(saved) : [];
  });

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => {
    const saved = localStorage.getItem('finance_bank_accounts');
    return sanitizeBankAccounts(saved ? JSON.parse(saved) : []);
  });

  const [memberships, setMemberships] = useState<Membership[]>(() => {
    const saved = localStorage.getItem('finance_memberships');
    return saved ? JSON.parse(saved) : [];
  });

  const [recurrings, setRecurrings] = useState<RecurringBill[]>(() => {
    const saved = localStorage.getItem('finance_recurrings');
    return saved ? JSON.parse(saved) : [];
  });

  const [creditScores, setCreditScores] = useState<CreditScores>(() => {
    const saved = localStorage.getItem('finance_credit_scores');
    return saved ? JSON.parse(saved) : { experian: [], transunion: [], equifax: [] };
  });

  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>(() => {
    const saved = localStorage.getItem('finance_budget');
    return sanitizeBudgetCategories(resolveStoredList(saved, DEFAULT_BUDGET_CATEGORIES));
  });

  const [mockTransactions, setMockTransactions] = useState<MockTransaction[]>(() => {
    const saved = localStorage.getItem('finance_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  // Dynamic configurations fetched from Supabase
  const [taxConfig, setTaxConfig] = useState<TaxConfig>(() => {
    const saved = localStorage.getItem('finance_tax_config');
    return saved ? JSON.parse(saved) : {
      studentLoanThresholds: { none: Infinity, plan1: 0, plan2: 0, plan4: 0, plan5: 0, postgrad: 0 },
      studentLoanRates: { none: 0, plan1: 0, plan2: 0, plan4: 0, plan5: 0, postgrad: 0 },
      incomeTaxBands: { basicRateLimit: 0, higherRateLimit: 0, basicRatePercent: 0, higherRatePercent: 0, additionalRatePercent: 0 },
      nationalInsuranceBands: { lowerThreshold: 0, upperThreshold: 0, mainRatePercent: 0, upperRatePercent: 0 }
    };
  });
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplate[]>(() => {
    const saved = localStorage.getItem('finance_recurring_templates');
    return resolveStoredList(saved, DEFAULT_RECURRING_TEMPLATES);
  });
  const [creditBureaus, setCreditBureaus] = useState<CreditBureauConfig[]>(() => {
    const saved = localStorage.getItem('finance_credit_bureaus');
    return saved ? JSON.parse(saved) : [
      { key: 'experian', label: 'Experian', emoji: '🟣', color: '#8b5cf6', maxScore: 1250, gradient: 'from-violet-500/10 to-violet-500/5' },
      { key: 'transunion', label: 'Credit Karma', emoji: '🔵', color: '#06b6d4', maxScore: 710, gradient: 'from-cyan-500/10 to-cyan-500/5' },
      { key: 'equifax', label: 'ClearScore', emoji: '🟡', color: '#f59e0b', maxScore: 1000, gradient: 'from-amber-500/10 to-amber-500/5' }
    ];
  });
  const [holidayDefaults, setHolidayDefaults] = useState<Record<number, { count: number; dates: string; occasion: string }>>(() => {
    const saved = localStorage.getItem('finance_holiday_defaults');
    return saved ? JSON.parse(saved) : {};
  });
  const [defaultBudgetCategories, setDefaultBudgetCategories] = useState<BudgetCategory[]>(() => {
    const saved = localStorage.getItem('finance_default_budget_categories');
    return resolveStoredList(saved, DEFAULT_CATEGORY_TEMPLATES);
  });

  const autoCategorizeRecurring = (name: string) => {
    const cleanName = name.trim().toLowerCase();
    const match = recurringTemplates.find(t =>
      cleanName.includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(cleanName)
    );
    return match || null;
  };

  useEffect(() => {
    localStorage.setItem('finance_tax_config', JSON.stringify(taxConfig));
  }, [taxConfig]);
  useEffect(() => {
    localStorage.setItem('finance_recurring_templates', JSON.stringify(recurringTemplates));
  }, [recurringTemplates]);
  useEffect(() => {
    localStorage.setItem('finance_credit_bureaus', JSON.stringify(creditBureaus));
  }, [creditBureaus]);
  useEffect(() => {
    localStorage.setItem('finance_holiday_defaults', JSON.stringify(holidayDefaults));
  }, [holidayDefaults]);
  useEffect(() => {
    localStorage.setItem('finance_default_budget_categories', JSON.stringify(defaultBudgetCategories));
  }, [defaultBudgetCategories]);

  // UI Status
  const [loadingDb, setLoadingDb] = useState(false);
  const [fetchingHolidays, setFetchingHolidays] = useState(false);
  const [savingDb, setSavingDb] = useState(false);
  const [bankHolidaysList, setBankHolidaysList] = useState<string[]>([]);
  const [bankHolidaysMap, setBankHolidaysMap] = useState<Record<string, string>>({});

  // Dialog / Edit States
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [isAddMembershipOpen, setIsAddMembershipOpen] = useState(false);
  const [isEditMembershipOpen, setIsEditMembershipOpen] = useState(false);
  const [isAddRecurringOpen, setIsAddRecurringOpen] = useState(false);
  const [addRecTemplate, setAddRecTemplate] = useState("scratch");
  const [isEditRecurringOpen, setIsEditRecurringOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [isAddCreditScoreOpen, setIsAddCreditScoreOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Form Draft States for Configuration Editor
  const [draftTaxConfig, setDraftTaxConfig] = useState<TaxConfig>(taxConfig);
  const [draftRecurringTemplates, setDraftRecurringTemplates] = useState<RecurringTemplate[]>(recurringTemplates);
  const [draftCreditBureaus, setDraftCreditBureaus] = useState<CreditBureauConfig[]>(creditBureaus);
  const [expandedSection, setExpandedSection] = useState<'none' | 'tax' | 'recurring' | 'bureaus'>('none');

  useEffect(() => {
    if (isSettingsOpen) {
      setDraftTaxConfig(taxConfig);
      setDraftRecurringTemplates(recurringTemplates);
      setDraftCreditBureaus(creditBureaus);
      setExpandedSection('none');
      setGrossInput(formatNumberInput(settings.grossSalary));
      setPersonalPensionInput(settings.personalPensionPercent.toString());
      setEmployerPensionInput(settings.employerPensionPercent.toString());
      setTaxCodeInput(settings.taxCode);
      setAllowanceInput(formatNumberInput(settings.personalAllowance));
      setWeekendsInput(settings.weekends.toString());
      setBankHolsInput(settings.bankHolidays.toString());
      setWorkHolsInput(settings.workHolidays.toString());
      setHoursInput(settings.workingHoursPerDay.toString());
      setPayDayInput((settings.payDayOfMonth || 25).toString());
      setPaydaySchedule(settings.paydaySchedule || 'monthly_date');
      setPaydayWeekday(settings.paydayWeekday !== undefined ? settings.paydayWeekday : 5);
      setPaydayBiweeklyAnchor(settings.paydayBiweeklyAnchor || '2026-01-02');
    }
  }, [isSettingsOpen, taxConfig, recurringTemplates, creditBureaus, settings]);
  const [includeWorkLeaveInActual, setIncludeWorkLeaveInActual] = useState(true);
  const [newCreditScore, setNewCreditScore] = useState<{ bureau: 'experian' | 'transunion' | 'equifax'; score: number; date: string }>({ bureau: 'experian', score: 700, date: new Date().toISOString().split('T')[0] });

  // Form Fields State
  const [newGoal, setNewGoal] = useState({ name: '', targetAmount: 0, targetDate: '', startDate: '' });
  const [newContribution, setNewContribution] = useState({ amount: 0, note: '', date: new Date().toISOString().split('T')[0], bankAccountId: '' });
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const [activeAccount, setActiveAccount] = useState<BankAccount | null>(null);
  const [newAccount, setNewAccount] = useState<Omit<BankAccount, 'id'>>({ name: '', type: 'checking', issuer: '', balance: 0, annualFee: 0, useCase: '', emoji: '', color: '#475569' });

  const [activeMembership, setActiveMembership] = useState<Membership | null>(null);
  const [newMembership, setNewMembership] = useState<Omit<Membership, 'id'>>({ name: '', type: 'points', status: 'Active', annualFee: 0, useCase: '' });

  const [activeRecurring, setActiveRecurring] = useState<RecurringBill | null>(null);
  const [newRecurring, setNewRecurring] = useState<Omit<RecurringBill, 'id'>>({
    name: '',
    amount: 0,
    dueDate: 15,
    isPaid: false,
    frequency: 'monthly',
    dueMonth: new Date().getMonth() + 1,
    emoji: '',
    category: '',
    tag: '',
    linkedBudgetItemId: '',
    linkedAccountId: ''
  });

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryBudget, setNewCategoryBudget] = useState<number>(0);
  const [newCategoryGroup, setNewCategoryGroup] = useState<'needs' | 'wants' | 'savings'>('needs');
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('');
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [newBudgetItem, setNewBudgetItem] = useState({ name: '', budgeted: 0, spent: 0, linkedAccountId: '' });
  const [activeBudgetItem, setActiveBudgetItem] = useState<{ id: string, name: string, budgeted: number, spent: number, categoryId: string, linkedAccountId?: string } | null>(null);

  // Holiday Tracker State (Tax & Income tab)
  const [expandedMonthIdx, setExpandedMonthIdx] = useState<number | null>(null);
  const [inlineBookMonthIdx, setInlineBookMonthIdx] = useState<number | null>(null);
  const [inlineOccasion, setInlineOccasion] = useState('');
  const [inlineStartDate, setInlineStartDate] = useState('');
  const [inlineEndDate, setInlineEndDate] = useState('');
  const [inlineCount, setInlineCount] = useState('1');
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [thisMonthCollapsed, setThisMonthCollapsed] = useState(false);
  const [futureCollapsed, setFutureCollapsed] = useState(false);

  // Config settings form inputs (in settings dialog)
  const [grossInput, setGrossInput] = useState(formatNumberInput(settings.grossSalary));
  const [personalPensionInput, setPersonalPensionInput] = useState(settings.personalPensionPercent.toString());
  const [employerPensionInput, setEmployerPensionInput] = useState(settings.employerPensionPercent.toString());
  const [taxCodeInput, setTaxCodeInput] = useState(settings.taxCode);
  const [allowanceInput, setAllowanceInput] = useState(formatNumberInput(settings.personalAllowance));
  const [weekendsInput, setWeekendsInput] = useState(settings.weekends.toString());
  const [bankHolsInput, setBankHolsInput] = useState(settings.bankHolidays.toString());
  const [workHolsInput, setWorkHolsInput] = useState(settings.workHolidays.toString());
  const [hoursInput, setHoursInput] = useState(settings.workingHoursPerDay.toString());
  const [payDayInput, setPayDayInput] = useState(settings.payDayOfMonth?.toString() || '25');
  const [paydaySchedule, setPaydaySchedule] = useState<FinanceSettings['paydaySchedule']>(() => settings.paydaySchedule || 'monthly_date');
  const [paydayWeekday, setPaydayWeekday] = useState<number>(() => settings.paydayWeekday !== undefined ? settings.paydayWeekday : 5);
  const [paydayBiweeklyAnchor, setPaydayBiweeklyAnchor] = useState<string>(() => settings.paydayBiweeklyAnchor || '2026-01-02');

  // ==========================================
  // SYNC & FETCH EFFECT
  // ==========================================

  // Fetch all finance keys on mount
  useEffect(() => {
    if (!isAdmin) return;

    const fetchSupabaseData = async () => {
      setLoadingDb(true);
      try {
        // 1. Fetch defaults first
        const { data: defaultsData, error: defaultsError } = await supabase
          .from('finance_defaults')
          .select('key, content');

        if (defaultsError) throw defaultsError;

        const defaultsMap: Record<string, any> = {};
        if (defaultsData) {
          defaultsData.forEach(d => {
            try {
              defaultsMap[d.key] = JSON.parse(d.content);
            } catch (e) {
              console.error('Failed to parse default key:', d.key, e);
            }
          });
          setDatabaseDefaults(defaultsMap);
        }

        // 2. Fetch user data
        const { data: userData, error: userError } = await supabase
          .from('finance_data')
          .select('key, content');

        if (userError) throw userError;

        const userMap: Record<string, any> = {};
        if (userData) {
          userData.forEach(d => {
            try {
              userMap[d.key] = JSON.parse(d.content);
            } catch (e) {
              console.error('Failed to parse user key:', d.key, e);
            }
          });
        }

        // Helper to get value: user custom value or fallback to database default
        const getValue = (key: string) => {
          return userMap[key] !== undefined ? userMap[key] : defaultsMap[key];
        };

        // Populate settings
        const loadedSettings = getValue('settings');
        if (loadedSettings) {
          setSettings(prev => ({
            ...prev,
            ...loadedSettings,
            holidaysByUser: loadedSettings.holidaysByUser || prev.holidaysByUser
          }));
          setPayDayInput((loadedSettings.payDayOfMonth || 25).toString());
          setPaydaySchedule(loadedSettings.paydaySchedule || 'monthly_date');
          setPaydayWeekday(loadedSettings.paydayWeekday !== undefined ? loadedSettings.paydayWeekday : 5);
          setPaydayBiweeklyAnchor(loadedSettings.paydayBiweeklyAnchor || '2026-01-02');
        }

        // Populate goals
        const loadedGoals = getValue('goals');
        if (loadedGoals) {
          setGoals(loadedGoals);
          if (loadedGoals.length > 0) setSelectedGoalId(loadedGoals[0].id);
        }

        // Populate accounts
        const loadedAccounts = getValue('accounts');
        if (loadedAccounts) {
          setBankAccounts(loadedAccounts.bankAccounts || []);
          setMemberships(loadedAccounts.memberships || []);
          if (loadedAccounts.creditScores) setCreditScores(loadedAccounts.creditScores);
        }

        // Populate budget
        const loadedBudget = getValue('budget');
        if (loadedBudget && loadedBudget.length > 0) {
          setBudgetCategories(sanitizeBudgetCategories(loadedBudget));
        } else {
          setBudgetCategories(prev => prev.length > 0 ? prev : sanitizeBudgetCategories(DEFAULT_BUDGET_CATEGORIES));
        }

        // Populate recurrings
        const loadedRecurrings = getValue('recurrings');
        if (loadedRecurrings) {
          setRecurrings(loadedRecurrings);
        }

        // Populate transactions
        const loadedTransactions = getValue('transactions');
        if (loadedTransactions) {
          setMockTransactions(loadedTransactions);
        }

        // Populate taxConfig
        const loadedTaxConfig = getValue('tax_config');
        if (loadedTaxConfig) {
          setTaxConfig(loadedTaxConfig);
        }

        // Populate recurringTemplates
        const loadedTemplates = getValue('recurring_templates');
        if (loadedTemplates && loadedTemplates.length > 0) {
          setRecurringTemplates(loadedTemplates);
        } else {
          setRecurringTemplates(prev => prev.length > 0 ? prev : DEFAULT_RECURRING_TEMPLATES);
        }

        // Populate creditBureaus
        const loadedBureaus = getValue('credit_bureaus');
        if (loadedBureaus) {
          setCreditBureaus(loadedBureaus);
        }

        // Populate holidayDefaults
        const loadedHolidayDefaults = getValue('holiday_defaults');
        if (loadedHolidayDefaults) {
          setHolidayDefaults(loadedHolidayDefaults);
        }

        // Populate defaultBudgetCategories
        const loadedDefaultBudgetCategories = getValue('default_budget_categories');
        if (loadedDefaultBudgetCategories && loadedDefaultBudgetCategories.length > 0) {
          setDefaultBudgetCategories(loadedDefaultBudgetCategories);
        } else {
          setDefaultBudgetCategories(prev => prev.length > 0 ? prev : DEFAULT_CATEGORY_TEMPLATES);
        }
      } catch (err) {
        console.error('Error fetching settings from Supabase:', err);
      } finally {
        setLoadingDb(false);
      }
    };

    fetchSupabaseData();
  }, [isAdmin]);

  // Fetch UK Bank Holidays dynamically
  useEffect(() => {
    const fetchHolidays = async () => {
      setFetchingHolidays(true);
      try {
        const res = await fetch('https://www.gov.uk/bank-holidays.json');
        if (!res.ok) throw new Error('Failed to fetch holidays');
        const data = await res.json();

        const region = settings.ukRegion || 'england-and-wales';
        const events = (data[region]?.events || []) as any[];

        const yearStr = settings.taxYear.toString();
        const holsInYear = events
          .filter((e) => e.date.startsWith(yearStr))
          .map((e) => e.date);

        setBankHolidaysList(holsInYear);

        const holsMap: Record<string, string> = {};
        events.forEach((e) => {
          if (e.date.startsWith(yearStr)) {
            holsMap[e.date] = e.title;
          }
        });
        setBankHolidaysMap(holsMap);

        const calculatedWeekends = calculateWeekends(settings.taxYear);
        const calculatedHolidays = holsInYear.length;

        setSettings(prev => {
          if (prev.bankHolidays === calculatedHolidays && prev.weekends === calculatedWeekends) {
            return prev;
          }
          return {
            ...prev,
            bankHolidays: calculatedHolidays,
            weekends: calculatedWeekends
          };
        });
      } catch (err) {
        console.error('Error fetching bank holidays:', err);
      } finally {
        setFetchingHolidays(false);
      }
    };

    fetchHolidays();
  }, [settings.taxYear, settings.ukRegion]);

  // Sync inputs with settings updates
  useEffect(() => {
    setGrossInput(formatNumberInput(settings.grossSalary));
    setPersonalPensionInput(settings.personalPensionPercent.toString());
    setEmployerPensionInput(settings.employerPensionPercent.toString());
    setTaxCodeInput(settings.taxCode);
    setAllowanceInput(formatNumberInput(settings.personalAllowance));
    setWeekendsInput(settings.weekends.toString());
    setBankHolsInput(settings.bankHolidays.toString());
    setWorkHolsInput(settings.workHolidays.toString());
    setHoursInput(settings.workingHoursPerDay.toString());

    localStorage.setItem('finance_settings', JSON.stringify(settings));
  }, [settings]);

  // Local storage backups for other states
  useEffect(() => {
    localStorage.setItem('finance_goals', JSON.stringify(goals));
  }, [goals]);
  useEffect(() => {
    localStorage.setItem('finance_bank_accounts', JSON.stringify(bankAccounts));
  }, [bankAccounts]);
  useEffect(() => {
    localStorage.setItem('finance_memberships', JSON.stringify(memberships));
  }, [memberships]);
  useEffect(() => {
    localStorage.setItem('finance_recurrings', JSON.stringify(recurrings));
  }, [recurrings]);
  useEffect(() => {
    localStorage.setItem('finance_credit_scores', JSON.stringify(creditScores));
  }, [creditScores]);
  useEffect(() => {
    localStorage.setItem('finance_budget', JSON.stringify(budgetCategories));
  }, [budgetCategories]);
  useEffect(() => {
    localStorage.setItem('finance_transactions', JSON.stringify(mockTransactions));
  }, [mockTransactions]);

  // Save active tab selection
  useEffect(() => {
    localStorage.setItem('finance_active_tab', activeTab);
  }, [activeTab]);

  // Scroll to current month in holiday tracker when tax-income tab is selected
  useEffect(() => {
    if (activeTab === 'tax-income') {
      const timer = setTimeout(() => {
        const currentMonthIdx = new Date().getMonth();
        const container = document.getElementById('holiday-months-container');
        const element = document.getElementById(`holiday-month-${currentMonthIdx}`);
        if (container && element) {
          const containerRect = container.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();
          const relativeTop = elementRect.top - containerRect.top + container.scrollTop;
          container.scrollTo({
            top: relativeTop,
            behavior: 'smooth'
          });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // ==========================================
  // GENERAL CLOUD SAVE HELPER
  // ==========================================

  const saveDataToSupabase = async (key: string, contentData: any) => {
    if (!isAdmin) return;
    try {
      const stringified = JSON.stringify(contentData);
      const { error } = await supabase
        .from('finance_data')
        .upsert(
          { key, content: stringified, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );
      if (error) throw error;
    } catch (err) {
      console.error(`Error saving ${key} to Supabase:`, err);
    }
  };

  // ==========================================
  // CALCULATIONS / FORMULA LOGIC
  // ==========================================

  const calculateFinance = () => {
    const {
      grossSalary,
      pensionType,
      personalPensionPercent,
      employerPensionPercent,
      studentLoanPlan,
      personalAllowance: rawPersonalAllowance,
      weekends,
      bankHolidays,
      workHolidays,
      workingHoursPerDay,
    } = settings;

    const personalPensionRate = grossSalary * (personalPensionPercent / 100);
    const employerPensionRate = grossSalary * (employerPensionPercent / 100);

    const incomeTaxGross = pensionType === 'net_pay' || pensionType === 'salary_sacrifice'
      ? Math.max(0, grossSalary - personalPensionRate)
      : grossSalary;

    const niGross = pensionType === 'salary_sacrifice'
      ? Math.max(0, grossSalary - personalPensionRate)
      : grossSalary;

    const studentLoanGross = pensionType === 'salary_sacrifice'
      ? Math.max(0, grossSalary - personalPensionRate)
      : grossSalary;

    let personalAllowance = rawPersonalAllowance;
    if (incomeTaxGross > 100000) {
      const excess = incomeTaxGross - 100000;
      personalAllowance = Math.max(0, personalAllowance - excess / 2);
    }

    let incomeTax = 0;
    if (incomeTaxGross > personalAllowance) {
      const taxableAmount = incomeTaxGross - personalAllowance;
      const { basicRateLimit, higherRateLimit, basicRatePercent, higherRatePercent, additionalRatePercent } = taxConfig.incomeTaxBands;

      if (incomeTaxGross <= higherRateLimit) {
        const basicRateAmount = Math.min(taxableAmount, basicRateLimit);
        const higherRateAmount = Math.max(0, taxableAmount - basicRateAmount);
        incomeTax = basicRateAmount * (basicRatePercent / 100) + higherRateAmount * (higherRatePercent / 100);
      } else {
        const basicRateAmount = basicRateLimit;
        const higherRateAmount = higherRateLimit - basicRateLimit;
        const additionalRateAmount = Math.max(0, incomeTaxGross - higherRateLimit);
        incomeTax = basicRateAmount * (basicRatePercent / 100) + higherRateAmount * (higherRatePercent / 100) + additionalRateAmount * (additionalRatePercent / 100);
      }
    }

    let nationalInsurance = 0;
    const { lowerThreshold, upperThreshold, mainRatePercent, upperRatePercent } = taxConfig.nationalInsuranceBands;
    if (niGross > lowerThreshold) {
      const mainBandAmount = Math.min(niGross, upperThreshold) - lowerThreshold;
      const upperBandAmount = Math.max(0, niGross - upperThreshold);
      nationalInsurance = mainBandAmount * (mainRatePercent / 100) + upperBandAmount * (upperRatePercent / 100);
    }

    let studentLoan = 0;
    if (studentLoanPlan !== 'none') {
      const threshold = taxConfig.studentLoanThresholds[studentLoanPlan];
      const rate = taxConfig.studentLoanRates[studentLoanPlan];
      if (studentLoanGross > threshold) {
        studentLoan = (studentLoanGross - threshold) * rate;
      }
    }

    const totalDeductions = incomeTax + nationalInsurance + studentLoan + personalPensionRate;
    const netTakeHome = grossSalary - totalDeductions;
    const workingDaysIncludingLeave = Math.max(0, 365 - weekends - 1);
    const workingDaysExcludingLeave = Math.max(0, 365 - weekends - 1 - bankHolidays - workHolidays);

    const getBreakdown = (annualAmount: number, daysInYear: number) => {
      const monthly = annualAmount / 12;
      const weekly = annualAmount / 52;
      const daily = annualAmount / (daysInYear || 1);
      const hourly = daily / workingHoursPerDay;
      return { annual: annualAmount, monthly, weekly, daily, hourly };
    };

    const buildBreakdown = (daysInYear: number) => ({
      preTax: getBreakdown(grossSalary, daysInYear),
      tax: getBreakdown(incomeTax, daysInYear),
      ni: getBreakdown(nationalInsurance, daysInYear),
      pension: getBreakdown(personalPensionRate, daysInYear),
      studentLoan: getBreakdown(studentLoan, daysInYear),
      postTax: getBreakdown(netTakeHome, daysInYear),
      deductions: getBreakdown(totalDeductions, daysInYear),
    });

    return {
      personalPensionRate,
      employerPensionRate,
      personalAllowance,
      incomeTax,
      nationalInsurance,
      studentLoan,
      totalDeductions,
      netTakeHome,
      workingDaysExcludingLeave,
      workingDaysIncludingLeave,
      breakdown: {
        excludingLeave: buildBreakdown(workingDaysExcludingLeave),
        includingLeave: buildBreakdown(workingDaysIncludingLeave),
      }
    };
  };

  const results = calculateFinance();
  const breakdownRates = includeWorkLeaveInActual ? results.breakdown.includingLeave : results.breakdown.excludingLeave;
  const breakdownWorkingDays = includeWorkLeaveInActual ? results.workingDaysIncludingLeave : results.workingDaysExcludingLeave;

  // Calculate remaining bank holidays
  const getBankHolidaysLeft = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return bankHolidaysList.filter(dateStr => {
      const bhDate = new Date(dateStr);
      bhDate.setHours(0, 0, 0, 0);
      return bhDate.getTime() >= today.getTime();
    }).length;
  };

  const bankHolidaysLeft = getBankHolidaysLeft();

  // Calculate next payday details
  const getNextPaydayDetails = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const schedule = settings.paydaySchedule || 'monthly_date';
    const scheduledPayday = settings.payDayOfMonth || 25;
    const weekday = settings.paydayWeekday !== undefined ? settings.paydayWeekday : 5; // default Friday
    const anchorStr = settings.paydayBiweeklyAnchor || '2026-01-02';

    let paydayDate = new Date();
    let adjusted = false;
    let adjustReason: 'weekend' | 'bank_holiday' | null = null;

    const adjustIfWeekendOrHoliday = (date: Date): { date: Date; adjusted: boolean; adjustReason: 'weekend' | 'bank_holiday' | null } => {
      let isAdj = false;
      let reason: 'weekend' | 'bank_holiday' | null = null;
      const d = new Date(date);
      while (true) {
        const dayOfWeek = d.getDay();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        if (dayOfWeek === 0 || dayOfWeek === 6) {
          isAdj = true;
          reason = 'weekend';
          d.setDate(d.getDate() - 1);
        } else if (bankHolidaysList.includes(dateStr)) {
          isAdj = true;
          reason = 'bank_holiday';
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }
      return { date: d, adjusted: isAdj, adjustReason: reason };
    };

    if (schedule === 'monthly_date') {
      let targetYear = today.getFullYear();
      let targetMonthIdx = today.getMonth();

      let res = calculateActualPayday(targetYear, targetMonthIdx, scheduledPayday, bankHolidaysList);
      const resDate = new Date(res.date);
      resDate.setHours(0, 0, 0, 0);

      if (resDate.getTime() < today.getTime()) {
        targetMonthIdx += 1;
        if (targetMonthIdx > 11) {
          targetMonthIdx = 0;
          targetYear += 1;
        }
        res = calculateActualPayday(targetYear, targetMonthIdx, scheduledPayday, bankHolidaysList);
      }
      paydayDate = res.date;
      adjusted = res.adjusted;
      adjustReason = res.adjustReason;

    } else if (schedule === 'last_working_day') {
      let targetYear = today.getFullYear();
      let targetMonthIdx = today.getMonth();

      const targetDateOfLastDay = new Date(targetYear, targetMonthIdx + 1, 0);
      let res = adjustIfWeekendOrHoliday(targetDateOfLastDay);
      res.date.setHours(0, 0, 0, 0);

      if (res.date.getTime() < today.getTime()) {
        targetMonthIdx += 1;
        if (targetMonthIdx > 11) {
          targetMonthIdx = 0;
          targetYear += 1;
        }
        const nextMonthLastDay = new Date(targetYear, targetMonthIdx + 1, 0);
        res = adjustIfWeekendOrHoliday(nextMonthLastDay);
      }
      paydayDate = res.date;
      adjusted = res.adjusted;
      adjustReason = res.adjustReason;

    } else if (schedule === 'last_friday') {
      let targetYear = today.getFullYear();
      let targetMonthIdx = today.getMonth();

      const getLastFridayOfMonth = (year: number, monthIdx: number): Date => {
        const d = new Date(year, monthIdx + 1, 0);
        while (d.getDay() !== 5) {
          d.setDate(d.getDate() - 1);
        }
        return d;
      };

      const lastFri = getLastFridayOfMonth(targetYear, targetMonthIdx);
      let res = adjustIfWeekendOrHoliday(lastFri);
      res.date.setHours(0, 0, 0, 0);

      if (res.date.getTime() < today.getTime()) {
        targetMonthIdx += 1;
        if (targetMonthIdx > 11) {
          targetMonthIdx = 0;
          targetYear += 1;
        }
        const nextMonthLastFri = getLastFridayOfMonth(targetYear, targetMonthIdx);
        res = adjustIfWeekendOrHoliday(nextMonthLastFri);
      }
      paydayDate = res.date;
      adjusted = res.adjusted;
      adjustReason = res.adjustReason;

    } else if (schedule === 'biweekly') {
      const anchor = new Date(anchorStr);
      anchor.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - anchor.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      let candidate = new Date(anchor);
      if (diffDays >= 0) {
        const biweeks = Math.floor(diffDays / 14);
        candidate.setDate(candidate.getDate() + (biweeks * 14));

        let res = adjustIfWeekendOrHoliday(candidate);
        res.date.setHours(0, 0, 0, 0);

        if (res.date.getTime() < today.getTime()) {
          candidate = new Date(candidate);
          candidate.setDate(candidate.getDate() + 14);
          res = adjustIfWeekendOrHoliday(candidate);
        }
        paydayDate = res.date;
        adjusted = res.adjusted;
        adjustReason = res.adjustReason;
      } else {
        const res = adjustIfWeekendOrHoliday(anchor);
        paydayDate = res.date;
        adjusted = res.adjusted;
        adjustReason = res.adjustReason;
      }

    } else if (schedule === 'weekly') {
      const daysToAdd = (weekday - today.getDay() + 7) % 7;
      let candidate = new Date(today);
      candidate.setDate(candidate.getDate() + daysToAdd);

      let res = adjustIfWeekendOrHoliday(candidate);
      res.date.setHours(0, 0, 0, 0);

      if (res.date.getTime() < today.getTime()) {
        candidate = new Date(candidate);
        candidate.setDate(candidate.getDate() + 7);
        res = adjustIfWeekendOrHoliday(candidate);
      }
      paydayDate = res.date;
      adjusted = res.adjusted;
      adjustReason = res.adjustReason;

    } else if (schedule === 'semimonthly') {
      let targetYear = today.getFullYear();
      let targetMonthIdx = today.getMonth();

      const getSemimonthlyDates = (year: number, monthIdx: number) => {
        const d15 = new Date(year, monthIdx, 15);
        const res15 = adjustIfWeekendOrHoliday(d15);
        res15.date.setHours(0, 0, 0, 0);

        const dLast = new Date(year, monthIdx + 1, 0);
        const resLast = adjustIfWeekendOrHoliday(dLast);
        resLast.date.setHours(0, 0, 0, 0);

        return [res15, resLast];
      };

      let candidates = getSemimonthlyDates(targetYear, targetMonthIdx);
      let found = candidates.find(c => c.date.getTime() >= today.getTime());

      if (!found) {
        targetMonthIdx += 1;
        if (targetMonthIdx > 11) {
          targetMonthIdx = 0;
          targetYear += 1;
        }
        candidates = getSemimonthlyDates(targetYear, targetMonthIdx);
        found = candidates[0];
      }

      paydayDate = found.date;
      adjusted = found.adjusted;
      adjustReason = found.adjustReason;
    }

    paydayDate.setHours(0, 0, 0, 0);
    const timeDiff = paydayDate.getTime() - today.getTime();
    const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));

    return {
      date: paydayDate,
      adjusted,
      adjustReason,
      daysRemaining
    };
  };

  const nextPayday = getNextPaydayDetails();

  // ==========================================
  // HANDLERS: TAB CATEGORY NAVIGATION COUNT
  // ==========================================

  const getHolidaysUsedCount = () => {
    const normalizedHolidays = getNormalizedHolidays(settings, holidayDefaults);
    return normalizedHolidays.reduce((sum, h) => sum + (h.count || 0), 0);
  };

  // ==========================================
  // HANDLERS: GOALS CRUD
  // ==========================================

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.name || newGoal.targetAmount <= 0) {
      toast({ title: 'Invalid Goal', description: 'Please enter a valid name and target amount.', variant: 'destructive' });
      return;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const created: Goal = {
      id: 'g_' + Date.now(),
      name: newGoal.name,
      targetAmount: newGoal.targetAmount,
      currentAmount: 0,
      targetDate: newGoal.targetDate || todayStr,
      startDate: newGoal.startDate || todayStr,
      contributions: []
    };
    const updated = [...goals, created];
    setGoals(updated);
    saveDataToSupabase('goals', updated);
    setIsAddGoalOpen(false);
    setNewGoal({ name: '', targetAmount: 0, targetDate: '', startDate: '' });
    setSelectedGoalId(created.id);
    toast({ title: 'Goal Added', description: `Successfully created goal "${created.name}".` });
  };

  const handleDeleteGoal = (id: string) => {
    const updated = goals.filter(g => g.id !== id);
    setGoals(updated);
    saveDataToSupabase('goals', updated);
    if (selectedGoalId === id) {
      setSelectedGoalId(updated[0]?.id || null);
    }
    toast({ title: 'Goal Deleted', description: 'Savings goal removed.' });
  };

  const handleAddContribution = (e: React.FormEvent, goalId: string) => {
    e.preventDefault();
    if (newContribution.amount <= 0) {
      toast({ title: 'Invalid Amount', description: 'Contribution must be greater than £0.00.', variant: 'destructive' });
      return;
    }

    let updatedAccounts = [...bankAccounts];
    if (newContribution.bankAccountId) {
      const accId = newContribution.bankAccountId;
      const amt = newContribution.amount;
      const selectedAcc = bankAccounts.find(a => a.id === accId);
      if (selectedAcc) {
        const isSavingsOrInvestment = selectedAcc.type === 'savings' || selectedAcc.type === 'investment';
        updatedAccounts = bankAccounts.map(acc => {
          if (acc.id === accId) {
            return {
              ...acc,
              balance: acc.balance + (isSavingsOrInvestment ? amt : -amt)
            };
          }
          return acc;
        });
        setBankAccounts(updatedAccounts);
        saveDataToSupabase('accounts', { bankAccounts: updatedAccounts, memberships, creditScores });
      }
    }

    const updated = goals.map(g => {
      if (g.id === goalId) {
        const contrib = {
          id: 'c_' + Date.now(),
          amount: newContribution.amount,
          date: newContribution.date || new Date().toISOString().split('T')[0],
          note: newContribution.note,
          bankAccountId: newContribution.bankAccountId || undefined
        };
        return {
          ...g,
          currentAmount: g.currentAmount + contrib.amount,
          contributions: [contrib, ...g.contributions]
        };
      }
      return g;
    });
    setGoals(updated);
    saveDataToSupabase('goals', updated);
    setNewContribution({ amount: 0, note: '', date: new Date().toISOString().split('T')[0], bankAccountId: '' });
    toast({ title: 'Contribution Logged', description: `Added ${formatGBP(newContribution.amount)} and updated linked account.` });
  };

  const handleDeleteContribution = (goalId: string, contribId: string) => {
    let updatedAccounts = [...bankAccounts];
    const updated = goals.map(g => {
      if (g.id === goalId) {
        const contrib = g.contributions.find(c => c.id === contribId);
        if (!contrib) return g;

        if (contrib.bankAccountId) {
          const accId = contrib.bankAccountId;
          const amt = contrib.amount;
          const selectedAcc = bankAccounts.find(a => a.id === accId);
          if (selectedAcc) {
            const isSavingsOrInvestment = selectedAcc.type === 'savings' || selectedAcc.type === 'investment';
            updatedAccounts = bankAccounts.map(acc => {
              if (acc.id === accId) {
                return {
                  ...acc,
                  balance: acc.balance - (isSavingsOrInvestment ? amt : -amt)
                };
              }
              return acc;
            });
            setBankAccounts(updatedAccounts);
            saveDataToSupabase('accounts', { bankAccounts: updatedAccounts, memberships, creditScores });
          }
        }

        return {
          ...g,
          currentAmount: Math.max(0, g.currentAmount - contrib.amount),
          contributions: g.contributions.filter(c => c.id !== contribId)
        };
      }
      return g;
    });
    setGoals(updated);
    saveDataToSupabase('goals', updated);
    toast({ title: 'Contribution Deleted', description: 'Contribution removed and account balance reverted.' });
  };

  // ==========================================
  // HANDLERS: ACCOUNTS CRUD
  // ==========================================

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.name || !newAccount.issuer) {
      toast({ title: 'Error', description: 'Please fill in name and issuer.', variant: 'destructive' });
      return;
    }
    const created: BankAccount = {
      ...newAccount,
      emoji: newAccount.emoji || getAccountDefaultEmoji(newAccount.type, newAccount.name),
      color: newAccount.color || getAccountDefaultColor(newAccount.name),
      id: 'a_' + Date.now()
    };
    const updated = [...bankAccounts, created];
    setBankAccounts(updated);
    saveDataToSupabase('accounts', { bankAccounts: updated, memberships, creditScores });
    setIsAddAccountOpen(false);
    setNewAccount({ name: '', type: 'checking', issuer: '', balance: 0, annualFee: 0, useCase: '', emoji: '', color: '#475569' });
    toast({ title: 'Account Added', description: `Added ${created.name}.` });
  };

  const handleEditAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) return;
    const updated = bankAccounts.map(a => a.id === activeAccount.id ? activeAccount : a);
    setBankAccounts(updated);
    saveDataToSupabase('accounts', { bankAccounts: updated, memberships, creditScores });
    setIsEditAccountOpen(false);
    setActiveAccount(null);
    toast({ title: 'Account Updated', description: 'Successfully saved changes.' });
  };

  const handleDeleteAccount = (id: string) => {
    const updated = bankAccounts.filter(a => a.id !== id);
    setBankAccounts(updated);
    saveDataToSupabase('accounts', { bankAccounts: updated, memberships, creditScores });
    toast({ title: 'Account Deleted', description: 'Bank account removed.' });
  };

  const handleAddMembership = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMembership.name) {
      toast({ title: 'Error', description: 'Please enter membership name.', variant: 'destructive' });
      return;
    }
    const created: Membership = {
      ...newMembership,
      id: 'm_' + Date.now()
    };
    const updated = [...memberships, created];
    setMemberships(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships: updated, creditScores });
    setIsAddMembershipOpen(false);
    setNewMembership({ name: '', type: 'points', status: 'Active', annualFee: 0, useCase: '' });
    toast({ title: 'Membership Added', description: `Added "${created.name}".` });
  };

  const handleEditMembership = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMembership) return;
    const updated = memberships.map(m => m.id === activeMembership.id ? activeMembership : m);
    setMemberships(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships: updated, creditScores });
    setIsEditMembershipOpen(false);
    setActiveMembership(null);
    toast({ title: 'Membership Updated', description: 'Membership details saved.' });
  };

  const handleDeleteMembership = (id: string) => {
    const updated = memberships.filter(m => m.id !== id);
    setMemberships(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships: updated, creditScores });
    toast({ title: 'Membership Deleted', description: 'Membership removed.' });
  };

  // ==========================================
  // HANDLERS: CREDIT SCORES
  // ==========================================

  const handleAddCreditScore = (e: React.FormEvent) => {
    e.preventDefault();
    const maxScore = creditBureaus.find(b => b.key === newCreditScore.bureau)?.maxScore ?? 1000;
    if (newCreditScore.score < 0 || newCreditScore.score > maxScore) {
      toast({ title: 'Invalid Score', description: `Score must be between 0 and ${maxScore}.`, variant: 'destructive' });
      return;
    }
    const entry: CreditScoreEntry = {
      id: 'cs_' + Date.now(),
      date: newCreditScore.date,
      score: newCreditScore.score
    };
    const updated = {
      ...creditScores,
      [newCreditScore.bureau]: [...creditScores[newCreditScore.bureau], entry].sort((a, b) => a.date.localeCompare(b.date))
    };
    setCreditScores(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships, creditScores: updated });
    setIsAddCreditScoreOpen(false);
    setNewCreditScore({ bureau: 'experian', score: 700, date: new Date().toISOString().split('T')[0] });
    toast({ title: 'Credit Score Added', description: `Logged ${newCreditScore.bureau.charAt(0).toUpperCase() + newCreditScore.bureau.slice(1)} score of ${newCreditScore.score}.` });
  };

  const handleDeleteCreditScore = (bureau: 'experian' | 'transunion' | 'equifax', entryId: string) => {
    const updated = {
      ...creditScores,
      [bureau]: creditScores[bureau].filter(e => e.id !== entryId)
    };
    setCreditScores(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships, creditScores: updated });
    toast({ title: 'Score Entry Deleted', description: 'Credit score entry removed.' });
  };

  // ==========================================
  // HANDLERS: BUDGET CRUD
  // ==========================================

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const normalizedName = newCategoryName.trim();
    const alreadyExists = budgetCategories.some(
      cat => cat.name.toLowerCase() === normalizedName.toLowerCase()
    );
    if (alreadyExists) {
      toast({ title: 'Category Exists', description: `"${normalizedName}" is already in your budget.`, variant: 'destructive' });
      return;
    }

    const preset = DEFAULT_CATEGORY_PRESETS.find(
      p => p.name.toLowerCase() === normalizedName.toLowerCase()
    );

    const created: BudgetCategory = {
      id: 'cat_' + Date.now(),
      name: normalizedName,
      budgeted: newCategoryBudget,
      group: newCategoryGroup || preset?.group || 'needs',
      items: [],
      emoji: newCategoryEmoji.trim() || preset?.emoji || getCategoryDefaultEmoji(normalizedName)
    };
    const updated = [...budgetCategories, created];
    setBudgetCategories(updated);
    saveDataToSupabase('budget', updated);
    setIsAddCategoryOpen(false);
    setNewCategoryName('');
    setNewCategoryBudget(0);
    setNewCategoryGroup('needs');
    setNewCategoryEmoji('');
    toast({ title: 'Category Created', description: `Created category "${created.name}".` });
  };

  const handleEditCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCategoryId || !newCategoryName.trim()) return;
    const updated = budgetCategories.map(cat => {
      if (cat.id === activeCategoryId) {
        return {
          ...cat,
          name: newCategoryName.trim(),
          budgeted: newCategoryBudget,
          group: newCategoryGroup,
          emoji: newCategoryEmoji.trim() || cat.emoji || getCategoryDefaultEmoji(newCategoryName)
        };
      }
      return cat;
    });
    setBudgetCategories(updated);
    saveDataToSupabase('budget', updated);
    setIsEditCategoryOpen(false);
    setActiveCategoryId(null);
    setNewCategoryName('');
    setNewCategoryBudget(0);
    setNewCategoryGroup('needs');
    setNewCategoryEmoji('');
    toast({ title: 'Category Updated', description: 'Updated category name and budget limit.' });
  };

  const handleDeleteCategory = (catId: string) => {
    const updated = budgetCategories.filter(cat => cat.id !== catId);
    setBudgetCategories(updated);
    saveDataToSupabase('budget', updated);
    toast({ title: 'Category Deleted', description: 'Category and items removed.' });
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCategoryId || !newBudgetItem.name) return;
    const item: BudgetItem = {
      id: 'item_' + Date.now(),
      name: newBudgetItem.name,
      budgeted: 0,
      spent: newBudgetItem.spent
    };
    const updated = budgetCategories.map(cat => {
      if (cat.id === activeCategoryId) {
        return {
          ...cat,
          items: [...cat.items, item]
        };
      }
      return cat;
    });
    setBudgetCategories(updated);
    saveDataToSupabase('budget', updated);
    setIsAddItemOpen(false);
    setNewBudgetItem({ name: '', budgeted: 0, spent: 0 });
    toast({ title: 'Item Added', description: `Added "${item.name}" to budget.` });
  };

  const handleEditItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBudgetItem) return;
    const updated = budgetCategories.map(cat => {
      if (cat.id === activeBudgetItem.categoryId) {
        return {
          ...cat,
          items: cat.items.map(item => item.id === activeBudgetItem.id ? {
            id: item.id,
            name: activeBudgetItem.name,
            budgeted: 0,
            spent: activeBudgetItem.spent
          } : item)
        };
      }
      return cat;
    });
    setBudgetCategories(updated);
    saveDataToSupabase('budget', updated);
    setIsEditItemOpen(false);
    setActiveBudgetItem(null);
    toast({ title: 'Budget Updated', description: 'Successfully saved changes.' });
  };

  const handleDeleteItem = (catId: string, itemId: string) => {
    const updated = budgetCategories.map(cat => {
      if (cat.id === catId) {
        return {
          ...cat,
          items: cat.items.filter(item => item.id !== itemId)
        };
      }
      return cat;
    });
    setBudgetCategories(updated);
    saveDataToSupabase('budget', updated);
    toast({ title: 'Item Deleted', description: 'Item removed.' });
  };

  // ==========================================
  // HANDLERS: RECURRINGS CRUD
  // ==========================================

  const handleAddRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecurring.name || newRecurring.amount <= 0) return;

    let updatedBudget = [...budgetCategories];
    let finalLinkedBudgetItemId = newRecurring.linkedBudgetItemId;

    const template = autoCategorizeRecurring(newRecurring.name);
    const resolvedEmoji = newRecurring.emoji || template?.emoji || '💸';
    const resolvedCategory = newRecurring.category || template?.category || 'Subscriptions';
    const resolvedTag = newRecurring.tag || template?.tag || newRecurring.name.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (finalLinkedBudgetItemId === 'create' || (!finalLinkedBudgetItemId && newRecurring.name)) {
      const targetCatName = template?.budgetCategoryName || template?.category || 'Subscriptions';
      const targetCatId = targetCatName.toLowerCase();
      const targetCat = updatedBudget.find(
        c => c.id === targetCatId || c.name.toLowerCase() === targetCatId
      );
      if (targetCat) {
        const existingItem = targetCat.items.find(i => i.name.toLowerCase() === newRecurring.name.toLowerCase());
        if (existingItem) {
          finalLinkedBudgetItemId = existingItem.id;
        } else {
          const newItemId = 'item_' + Date.now();
          const newBudgetItem: BudgetItem = {
            id: newItemId,
            name: newRecurring.name,
            budgeted: 0,
            spent: 0
          };
          updatedBudget = updatedBudget.map(c => {
            if (c.id === targetCat.id) {
              return { ...c, items: [...c.items, newBudgetItem] };
            }
            return c;
          });
          finalLinkedBudgetItemId = newItemId;
          setBudgetCategories(updatedBudget);
          saveDataToSupabase('budget', updatedBudget);
        }
      }
    }

    const created: RecurringBill = {
      ...newRecurring,
      id: 'rec_' + Date.now(),
      emoji: resolvedEmoji,
      category: resolvedCategory,
      tag: resolvedTag,
      linkedBudgetItemId: finalLinkedBudgetItemId || undefined,
      linkedAccountId: newRecurring.linkedAccountId || undefined
    } as RecurringBill;

    const updated = [...recurrings, created];
    setRecurrings(updated);
    saveDataToSupabase('recurrings', updated);
    setIsAddRecurringOpen(false);
    setNewRecurring({
      name: '',
      amount: 0,
      dueDate: 15,
      isPaid: false,
      frequency: 'monthly',
      dueMonth: new Date().getMonth() + 1,
      emoji: '',
      category: '',
      tag: '',
      linkedBudgetItemId: '',
      linkedAccountId: ''
    });
    toast({ title: 'Recurring Added', description: `Successfully added recurring bill "${created.name}".` });
  };

  const handleEditRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRecurring) return;

    // Balance reconciliation if amount or linked account changed
    let updatedAccounts = [...bankAccounts];
    const oldBill = recurrings.find(r => r.id === activeRecurring.id);
    if (oldBill && oldBill.isPaid) {
      // Revert old payment
      if (oldBill.linkedAccountId) {
        updatedAccounts = updatedAccounts.map(acc =>
          acc.id === oldBill.linkedAccountId ? { ...acc, balance: acc.balance + oldBill.amount } : acc
        );
      }
      // Apply new payment
      if (activeRecurring.linkedAccountId && activeRecurring.isPaid) {
        updatedAccounts = updatedAccounts.map(acc =>
          acc.id === activeRecurring.linkedAccountId ? { ...acc, balance: acc.balance - activeRecurring.amount } : acc
        );
      }
    }

    const updated = recurrings.map(r => r.id === activeRecurring.id ? activeRecurring : r);
    setRecurrings(updated);
    saveDataToSupabase('recurrings', updated);
    setIsEditRecurringOpen(false);
    setActiveRecurring(null);
    if (updatedAccounts !== bankAccounts) {
      setBankAccounts(updatedAccounts);
      saveDataToSupabase('accounts', { bankAccounts: updatedAccounts, memberships, creditScores });
    }
    toast({ title: 'Recurring Bill Updated', description: 'Bill details saved.' });
  };

  const handleDeleteRecurring = (id: string) => {
    let updatedAccounts = [...bankAccounts];
    const bill = recurrings.find(r => r.id === id);
    if (bill && bill.isPaid && bill.linkedAccountId) {
      const accId = bill.linkedAccountId;
      const amt = bill.amount;
      updatedAccounts = updatedAccounts.map(acc => {
        if (acc.id === accId) {
          return { ...acc, balance: acc.balance + amt };
        }
        return acc;
      });
    }
    const updated = recurrings.filter(r => r.id !== id);
    setRecurrings(updated);
    saveDataToSupabase('recurrings', updated);
    if (updatedAccounts !== bankAccounts) {
      setBankAccounts(updatedAccounts);
      saveDataToSupabase('accounts', { bankAccounts: updatedAccounts, memberships, creditScores });
    }
    toast({ title: 'Recurring Bill Deleted', description: 'Recurring bill removed.' });
  };

  const toggleRecurringPaid = (id: string) => {
    let updatedAccounts = [...bankAccounts];
    const updated = recurrings.map(r => {
      if (r.id === id) {
        const nextPaid = !r.isPaid;
        if (r.linkedAccountId) {
          const accId = r.linkedAccountId;
          const amt = r.amount;
          updatedAccounts = updatedAccounts.map(acc => {
            if (acc.id === accId) {
              return {
                ...acc,
                balance: acc.balance + (nextPaid ? -amt : amt)
              };
            }
            return acc;
          });
        }
        return { ...r, isPaid: nextPaid };
      }
      return r;
    });
    setRecurrings(updated);
    saveDataToSupabase('recurrings', updated);
    if (updatedAccounts !== bankAccounts) {
      setBankAccounts(updatedAccounts);
      saveDataToSupabase('accounts', { bankAccounts: updatedAccounts, memberships, creditScores });
    }
  };

  // ==========================================
  // HANDLERS: TRANSACTION CHECKLIST (DASHBOARD)
  // ==========================================

  const toggleTransactionReviewed = (id: string) => {
    const updated = mockTransactions.map(t => t.id === id ? { ...t, isReviewed: !t.isReviewed } : t);
    setMockTransactions(updated);
    saveDataToSupabase('transactions', updated);
  };

  // ==========================================
  // HANDLERS: HOLIDAY TRACKER (TAX & INCOME TAB)
  // ==========================================

  const resetInlineHolidayForm = () => {
    setInlineBookMonthIdx(null);
    setEditingHolidayId(null);
    setInlineOccasion('');
    setInlineStartDate('');
    setInlineEndDate('');
    setInlineCount('1');
  };

  const handleStartEditHoliday = (holiday: UserHoliday, monthIdx: number) => {
    setExpandedMonthIdx(monthIdx);
    setInlineBookMonthIdx(monthIdx);
    setEditingHolidayId(holiday.id);
    setInlineOccasion(holiday.occasion);
    setInlineStartDate(holiday.startDate);
    setInlineEndDate(holiday.endDate);
    setInlineCount(holiday.count.toString());
  };

  const handleStartNewHoliday = (monthIdx: number) => {
    setInlineBookMonthIdx(monthIdx);
    setEditingHolidayId(null);
    setInlineOccasion('');
    const year = settings.taxYear || new Date().getFullYear();
    const pad = (n: number) => n.toString().padStart(2, '0');
    setInlineStartDate(`${year}-${pad(monthIdx + 1)}-01`);
    setInlineEndDate(`${year}-${pad(monthIdx + 1)}-01`);
    setInlineCount('1');
  };

  const handleSaveInlineHoliday = (monthIdx: number) => {
    const countVal = parseFloat(inlineCount);
    if (!inlineStartDate || !inlineEndDate) {
      toast({ title: 'Missing Dates', description: 'Start and end dates are required.', variant: 'destructive' });
      return;
    }
    if (isNaN(countVal) || countVal < 0) {
      toast({ title: 'Invalid Days Count', description: 'Leave days count must be a non-negative number.', variant: 'destructive' });
      return;
    }

    const normalizedHolidays = getNormalizedHolidays(settings, holidayDefaults);

    const savedHoliday: UserHoliday = {
      id: editingHolidayId || 'hol_' + Date.now(),
      startDate: inlineStartDate,
      endDate: inlineEndDate,
      occasion: inlineOccasion.trim() || 'Leave',
      count: countVal
    };

    const updatedHolidaysList = editingHolidayId
      ? normalizedHolidays.map(holiday => holiday.id === editingHolidayId ? savedHoliday : holiday)
      : [...normalizedHolidays, savedHoliday];

    const updatedSettings = {
      ...settings,
      holidaysByUser: updatedHolidaysList
    };

    setSettings(updatedSettings);
    saveDataToSupabase('settings', updatedSettings);

    resetInlineHolidayForm();
    toast({
      title: editingHolidayId ? 'Leave updated' : 'Leave booked',
      description: `${editingHolidayId ? 'Updated' : 'Successfully booked'} "${savedHoliday.occasion}".`
    });
  };

  const handleDeleteHoliday = (holidayId: string) => {
    const normalizedHolidays = getNormalizedHolidays(settings, holidayDefaults);
    const updatedHolidaysList = normalizedHolidays.filter(h => h.id !== holidayId);

    const updatedSettings = {
      ...settings,
      holidaysByUser: updatedHolidaysList
    };

    setSettings(updatedSettings);
    saveDataToSupabase('settings', updatedSettings);
    if (editingHolidayId === holidayId) {
      resetInlineHolidayForm();
    }
    toast({ title: 'Holiday deleted', description: 'Booked leave has been successfully removed.' });
  };

  // ==========================================
  // HANDLERS: SETTINGS CONFIG SAVE & RESET
  // ==========================================

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    const newGross = parseFormattedFloat(grossInput);
    const newPersonalPension = parseFloat(personalPensionInput);
    const newEmployerPension = parseFloat(employerPensionInput);
    const newAllowance = parseFormattedFloat(allowanceInput);
    const newWeekends = parseInt(weekendsInput, 10);
    const newBankHols = parseInt(bankHolsInput, 10);
    const newWorkHols = parseInt(workHolsInput, 10);
    const newHours = parseFloat(hoursInput);

    if (isNaN(newGross) || newGross < 0) {
      toast({ title: 'Invalid Salary', description: 'Please enter a valid gross salary.', variant: 'destructive' });
      return;
    }
    if (isNaN(newPersonalPension) || newPersonalPension < 0 || newPersonalPension > 100) {
      toast({ title: 'Invalid Pension', description: 'Personal pension contribution must be 0% - 100%.', variant: 'destructive' });
      return;
    }
    if (isNaN(newEmployerPension) || newEmployerPension < 0 || newEmployerPension > 100) {
      toast({ title: 'Invalid Pension', description: 'Employer pension contribution must be 0% - 100%.', variant: 'destructive' });
      return;
    }
    if (isNaN(newAllowance) || newAllowance < 0) {
      toast({ title: 'Invalid Allowance', description: 'Personal allowance must be a positive number.', variant: 'destructive' });
      return;
    }
    if (isNaN(newWeekends) || newWeekends < 0 || newWeekends > 365) {
      toast({ title: 'Invalid Days', description: 'Weekends must be 0 - 365 days.', variant: 'destructive' });
      return;
    }
    if (isNaN(newHours) || newHours <= 0 || newHours > 24) {
      toast({ title: 'Invalid Hours', description: 'Working hours must be 0.1 - 24 hours/day.', variant: 'destructive' });
      return;
    }

    let newPayDay = parseInt(payDayInput, 10);
    if (paydaySchedule === 'monthly_date') {
      if (isNaN(newPayDay) || newPayDay < 1 || newPayDay > 31) {
        toast({ title: 'Invalid Payday', description: 'Pay day of month must be between 1 and 31.', variant: 'destructive' });
        return;
      }
    } else {
      if (isNaN(newPayDay) || newPayDay < 1 || newPayDay > 31) {
        newPayDay = 25; // default fallback
      }
    }

    // Additional biweekly anchor validation
    if (paydaySchedule === 'biweekly' && !paydayBiweeklyAnchor) {
      toast({ title: 'Invalid Anchor Date', description: 'Please select a reference anchor date for the bi-weekly schedule.', variant: 'destructive' });
      return;
    }

    const updatedSettings: FinanceSettings = {
      ...settings,
      grossSalary: newGross,
      personalPensionPercent: newPersonalPension,
      employerPensionPercent: newEmployerPension,
      taxCode: taxCodeInput.trim() || '1257L',
      personalAllowance: newAllowance,
      weekends: newWeekends,
      bankHolidays: newBankHols,
      workHolidays: newWorkHols,
      workingHoursPerDay: newHours,
      payDayOfMonth: newPayDay,
      paydaySchedule,
      paydayWeekday,
      paydayBiweeklyAnchor,
    };

    setSettings(updatedSettings);
    setTaxConfig(draftTaxConfig);
    setRecurringTemplates(draftRecurringTemplates);
    setCreditBureaus(draftCreditBureaus);

    setSavingDb(true);
    try {
      await Promise.all([
        saveDataToSupabase('settings', updatedSettings),
        saveDataToSupabase('tax_config', draftTaxConfig),
        saveDataToSupabase('recurring_templates', draftRecurringTemplates),
        saveDataToSupabase('credit_bureaus', draftCreditBureaus)
      ]);
      toast({ title: 'Settings Saved', description: 'Configurations synchronized with Supabase.' });
      setIsSettingsOpen(false);
    } catch (err) {
      console.error(err);
      toast({ title: 'Local Save Only', description: 'Failed to sync with Supabase, saved to browser cache.', variant: 'destructive' });
      setIsSettingsOpen(false);
    } finally {
      setSavingDb(false);
    }
  };

  const handleResetDefaults = () => {
    const defaultSettings = databaseDefaults.settings || {
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
      taxYear: 2026,
      ukRegion: 'england-and-wales',
      holidaysByUser: {}
    };
    const defaultTaxConfig = databaseDefaults.tax_config || {
      studentLoanThresholds: { none: Infinity, plan1: 0, plan2: 0, plan4: 0, plan5: 0, postgrad: 0 },
      studentLoanRates: { none: 0, plan1: 0, plan2: 0, plan4: 0, plan5: 0, postgrad: 0 },
      incomeTaxBands: { basicRateLimit: 0, higherRateLimit: 0, basicRatePercent: 0, higherRatePercent: 0, additionalRatePercent: 0 },
      nationalInsuranceBands: { lowerThreshold: 0, upperThreshold: 0, mainRatePercent: 0, upperRatePercent: 0 }
    };
    const defaultRecurringTemplates = databaseDefaults.recurring_templates?.length
      ? databaseDefaults.recurring_templates
      : DEFAULT_RECURRING_TEMPLATES;
    const defaultCreditBureaus = databaseDefaults.credit_bureaus || [];
    const defaultCategoryTemplates = databaseDefaults.default_budget_categories?.length
      ? databaseDefaults.default_budget_categories
      : DEFAULT_CATEGORY_TEMPLATES;

    setSettings(defaultSettings);
    setDraftTaxConfig(defaultTaxConfig);
    setDraftRecurringTemplates(defaultRecurringTemplates);
    setDraftCreditBureaus(defaultCreditBureaus);
    setDefaultBudgetCategories(defaultCategoryTemplates);

    setGrossInput(formatNumberInput(defaultSettings.grossSalary));
    setPersonalPensionInput(defaultSettings.personalPensionPercent.toString());
    setEmployerPensionInput(defaultSettings.employerPensionPercent.toString());
    setTaxCodeInput(defaultSettings.taxCode);
    setAllowanceInput(formatNumberInput(defaultSettings.personalAllowance));
    setWeekendsInput(defaultSettings.weekends.toString());
    setBankHolsInput(defaultSettings.bankHolidays.toString());
    setWorkHolsInput(defaultSettings.workHolidays.toString());
    setHoursInput(defaultSettings.workingHoursPerDay.toString());
    setPayDayInput((defaultSettings.payDayOfMonth || 25).toString());
    setPaydaySchedule(defaultSettings.paydaySchedule || 'monthly_date');
    setPaydayWeekday(defaultSettings.paydayWeekday !== undefined ? defaultSettings.paydayWeekday : 5);
    setPaydayBiweeklyAnchor(defaultSettings.paydayBiweeklyAnchor || '2026-01-02');
    toast({ title: 'Reset successful', description: 'Returned configurations to default values.' });
  };

  const handleTaxCodeChange = (code: string) => {
    setTaxCodeInput(code);
    const cleaned = code.trim().toUpperCase();
    const match = cleaned.match(/^(\d+)L$/);
    if (match) {
      const numVal = parseInt(match[1], 10) * 10;
      setAllowanceInput(formatNumberInput(numVal));
    }
  };

  // Redirect if not admin
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Helper values for calculations
  const totalBudget = budgetCategories.reduce((sum, cat) => sum + (cat.budgeted || 0), 0);
  const totalSpent = budgetCategories.reduce((sum, cat) => sum + cat.items.reduce((s, item) => s + getBudgetItemSpent(item, bankAccounts, recurrings), 0), 0);
  const currentMonth = new Date().getMonth() + 1;
  const allBudgetItems = budgetCategories.flatMap(cat =>
    (cat.items || []).map(item => ({
      id: item.id,
      label: `${cat.name} > ${item.name}`
    }))
  );

  const totalAssets = bankAccounts.filter(a => a.balance > 0).reduce((sum, a) => sum + a.balance, 0);
  const totalDebt = Math.abs(bankAccounts.filter(a => a.balance < 0).reduce((sum, a) => sum + a.balance, 0));
  const netWorth = totalAssets - totalDebt;

  const monthlyIncome = results.netTakeHome / 12;
  const netCashFlow = monthlyIncome - totalSpent;

  // ─── COPILOT STYLE CALCULATIONS ──────────────────────────────────────
  const unpaidRecurrings = recurrings
    .filter(r => isDueThisMonth(r, currentMonth) && !r.isPaid)
    .reduce((sum, r) => sum + r.amount, 0);

  const freeToSpend = totalBudget - totalSpent - unpaidRecurrings;

  const todayDateObj = new Date();
  const currentYear = todayDateObj.getFullYear();
  const currentMonthIdx = todayDateObj.getMonth();
  const daysInMonth = getDaysInMonth(currentYear, currentMonthIdx);
  const daysRemainingInMonth = Math.max(1, daysInMonth - todayDateObj.getDate() + 1);
  const dailyFreeToSpend = freeToSpend > 0 ? freeToSpend / daysRemainingInMonth : 0;

  // Composition bar percentages
  const spentPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const billsPercent = totalBudget > 0 ? (unpaidRecurrings / totalBudget) * 100 : 0;
  const freePercent = totalBudget > 0 ? (Math.max(0, freeToSpend) / totalBudget) * 100 : 0;

  // Spending progress cumulative daily chart data
  const getSpendingProgressData = () => {
    const prefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}-`;
    const monthTx = mockTransactions.filter(tx => tx.date.startsWith(prefix));

    const dailyAmounts: Record<number, number> = {};
    monthTx.forEach(tx => {
      const day = parseInt(tx.date.split('-')[2], 10);
      if (!isNaN(day)) {
        dailyAmounts[day] = (dailyAmounts[day] || 0) + tx.amount;
      }
    });

    const data = [];
    let cumulativeSpent = 0;
    const todayDay = todayDateObj.getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const idealCumulative = totalBudget > 0 ? (day / daysInMonth) * totalBudget : 0;
      let actualCumulative: number | undefined = undefined;

      if (day <= todayDay) {
        cumulativeSpent += (dailyAmounts[day] || 0);
        actualCumulative = cumulativeSpent;
      }

      data.push({
        day,
        label: `${day}`,
        "Ideal Limit": parseFloat(idealCumulative.toFixed(2)),
        "Actual Spent": actualCumulative !== undefined ? parseFloat(actualCumulative.toFixed(2)) : undefined
      });
    }

    return data;
  };

  const spendingProgressData = getSpendingProgressData();
  const todayDayNum = todayDateObj.getDate();
  const todayProgress = spendingProgressData.find(d => d.day === todayDayNum);
  const isOverBudgetToday = todayProgress && todayProgress["Actual Spent"] !== undefined && todayProgress["Actual Spent"] > todayProgress["Ideal Limit"];

  const progressLineColor = isOverBudgetToday ? '#f97316' : '#10b981'; // orange/amber vs emerald
  const progressGradientColor = isOverBudgetToday ? '#f97316' : '#10b981';

  // Transactions to review state
  const unreviewedCount = mockTransactions.filter(tx => !tx.isReviewed).length;
  const displayedTransactions = showAllTransactions
    ? mockTransactions
    : mockTransactions.filter(tx => !tx.isReviewed);

  // Spent progress color bar
  const getProgressColor = (spent: number, budgeted: number) => {
    if (budgeted <= 0) return spent > 0 ? 'bg-rose-500' : 'bg-[#40a02b] dark:bg-[#a6e3a1]';
    const percent = spent / budgeted;
    if (percent <= 0.75) return 'bg-[#40a02b] dark:bg-[#a6e3a1]';
    if (percent <= 1.0) return 'bg-orange-500';
    return 'bg-rose-500';
  };

  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/30">
      <div className="wide-container flex-1 flex flex-col">
        <Header title="Finance" subtitle="Personal Income & Tax Dashboard" />

        {/* Sub Navigation Bar matching Inventory CategoryNav layout */}
        <div className="flex items-center justify-between border-b border-border/50 px-4 md:px-0 gap-4">
          <nav className="flex flex-nowrap items-center justify-start gap-2 md:gap-4 py-4 overflow-x-auto scrollbar-hide flex-1">
            {TABS.map((tab, index) => {
              const isActive = activeTab === tab.key;
              return (
                <div key={tab.key} className="flex items-center gap-2 md:gap-4">
                  <button
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'nav-link relative py-1 text-xs whitespace-nowrap flex items-center gap-1.5',
                      isActive && 'nav-link-active'
                    )}
                  >
                    <DotMatrixText text={tab.label.toUpperCase()} size="xs" />
                  </button>
                  {index < TABS.length - 1 && (
                    <span className="text-muted-foreground/30 hidden md:inline">·</span>
                  )}
                </div>
              );
            })}
          </nav>
          {loadingDb && (
            <span className="text-[10px] text-muted-foreground animate-pulse flex items-center gap-1 shrink-0 pb-1 font-sans">
              <Loader2 className="h-3 w-3 animate-spin text-primary" /> syncing...
            </span>
          )}
        </div>

        <main className="flex-1 flex flex-col py-6 sm:py-8 max-w-6xl mx-auto w-full min-w-0">
          {/* ==========================================
              TAB 1: DASHBOARD
              ========================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">

              {/* PRIMARY COCKPIT: Spending Progress & Core Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Column 1 & 2: Spending Progress cumulative chart */}
                <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 lg:col-span-2 shadow-xl flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <CardTitle className="text-sm font-serif font-semibold text-foreground flex items-center gap-1.5">
                          <Activity className="h-4 w-4 text-primary" /> Spending Progress
                        </CardTitle>
                        <CardDescription className="text-[10px] text-muted-foreground">Cumulative monthly spent vs budget trajectory</CardDescription>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground block">Tracked status</span>
                        <span className={cn(
                          "text-xs font-bold font-mono px-2 py-0.5 rounded-full inline-block mt-0.5",
                          isOverBudgetToday ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
                        )}>
                          {isOverBudgetToday
                            ? `Over pace by ${formatGBP((todayProgress?.["Actual Spent"] || 0) - (todayProgress?.["Ideal Limit"] || 0))}`
                            : `Under pace by ${formatGBP((todayProgress?.["Ideal Limit"] || 0) - (todayProgress?.["Actual Spent"] || 0))}`
                          }
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-3 text-xs">
                      <div>
                        <span className="text-muted-foreground text-[10px] uppercase block">Spent Today</span>
                        <span className="text-lg font-bold font-mono text-foreground">{formatGBP(totalSpent)}</span>
                      </div>
                      <div className="border-l border-border/50 pl-4">
                        <span className="text-muted-foreground text-[10px] uppercase block">Budget Limit</span>
                        <span className="text-lg font-bold font-mono text-muted-foreground">{formatGBP(totalBudget)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Recharts Cumulative spending chart */}
                  <div className="h-[200px] w-full mt-4 min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={spendingProgressData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="progressGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={progressGradientColor} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={progressGradientColor} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                          dataKey="day"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 9 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `£${v}`}
                          tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 9 }}
                        />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '1rem' }}
                          itemStyle={{ color: 'hsl(var(--foreground))', fontSize: '11px' }}
                          labelStyle={{ fontWeight: 'bold', fontSize: '11px' }}
                          formatter={(value) => [formatGBP(Number(value)), undefined]}
                        />
                        {/* Ideal Curve (grey dashed line) */}
                        <Line
                          type="monotone"
                          dataKey="Ideal Limit"
                          stroke="#64748b"
                          strokeDasharray="4 4"
                          dot={false}
                          strokeWidth={1.5}
                          name="Ideal Limit"
                        />
                        {/* Actual Curve (solid colored area) */}
                        <Area
                          type="monotone"
                          dataKey="Actual Spent"
                          stroke={progressLineColor}
                          fill="url(#progressGrad)"
                          strokeWidth={2.5}
                          connectNulls={false}
                          dot={false}
                          name="Actual Spent"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Column 3: Copilot Key Metrics Side-Panel */}
                <div className="space-y-6 flex flex-col justify-between">

                  {/* Free to Spend Card (Composition Bar) */}
                  <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-xl p-4 sm:p-5 rounded-3xl flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Free to Spend</span>
                        <PiggyBank className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="pt-1">
                        <span className={cn("text-3xl font-extrabold font-mono", freeToSpend >= 0 ? "text-emerald-500" : "text-rose-500")}>
                          {formatGBP(freeToSpend)}
                        </span>
                        {freeToSpend > 0 ? (
                          <p className="text-[10px] text-muted-foreground mt-1 font-sans">
                            <span className="font-bold text-foreground font-mono">{formatGBP(dailyFreeToSpend)}</span> per day remaining for this month
                          </p>
                        ) : (
                          <p className="text-[10px] text-rose-500/80 mt-1 font-sans font-medium">
                            Budget limit exceeded. Consider rebalancing categories.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Proportional Segmented Progress Bar */}
                    <div className="space-y-2">
                      <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden flex">
                        <div className="h-full bg-indigo-500 rounded-l-full transition-all duration-300" style={{ width: `${Math.min(100, spentPercent)}%` }} title={`Spent: ${spentPercent.toFixed(0)}%`} />
                        <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${Math.min(100 - spentPercent, billsPercent)}%` }} title={`Bills: ${billsPercent.toFixed(0)}%`} />
                        <div className="h-full bg-emerald-500 rounded-r-full transition-all duration-300" style={{ width: `${Math.max(0, 100 - spentPercent - billsPercent)}%` }} title={`Free: ${freePercent.toFixed(0)}%`} />
                      </div>

                      {/* Composition Legend */}
                      <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground pt-1">
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Spent</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Bills ({formatGBP(unpaidRecurrings)})</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Free</span>
                      </div>
                    </div>
                  </Card>

                  {/* Net Assets, Debt & Net Cash Flow block */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-lg p-3 sm:p-4 rounded-3xl space-y-1.5 text-left">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">Net Worth</span>
                      <span className="text-base font-bold font-mono text-emerald-500 block truncate">{formatGBP(netWorth)}</span>
                      <div className="flex justify-between text-[8px] text-muted-foreground border-t border-border/20 pt-1.5 font-mono">
                        <span className="text-emerald-500/80">A: {formatGBP(totalAssets)}</span>
                        <span className="text-rose-500/80">D: {formatGBP(totalDebt)}</span>
                      </div>
                    </Card>

                    <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-lg p-3 sm:p-4 rounded-3xl space-y-1.5 text-left">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">Cash Flow</span>
                      <span className={cn("text-base font-bold font-mono block truncate", netCashFlow >= 0 ? "text-emerald-500" : "text-rose-500")}>
                        {formatGBP(netCashFlow)}
                      </span>
                      <div className="text-[8px] text-muted-foreground border-t border-border/20 pt-1.5 font-mono text-center truncate">
                        Post tax take-home
                      </div>
                    </Card>
                  </div>

                  {/* Payday details card */}
                  <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-lg p-3 sm:p-4 rounded-3xl flex justify-between items-center text-xs">
                    <div className="space-y-0.5 text-left">
                      <span className="text-[9px] uppercase text-muted-foreground font-semibold">Next Payday</span>
                      <span className="font-bold block text-foreground">
                        {nextPayday.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-[10px] text-emerald-500 font-mono font-semibold block mt-0.5">
                        +{formatGBP(breakdownRates.postTax.monthly)} expected
                      </span>
                    </div>
                    <span className={cn(
                      "font-mono px-2 py-0.5 rounded-lg font-bold text-[10px]",
                      nextPayday.daysRemaining === 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-muted/60 text-muted-foreground"
                    )}>
                      {nextPayday.daysRemaining === 0 ? "Paid today!" : `${nextPayday.daysRemaining} days left`}
                    </span>
                  </Card>

                </div>

              </div>

              {/* LOWER ROW: Interactive Reviews, Top Categories, Upcoming bills */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Side: Unreviewed Transaction Checklist (lg:col-span-8) */}
                <div className="lg:col-span-8 space-y-6">

                  <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl">
                    <CardHeader className="p-0 pb-4 border-b border-border/30 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-serif font-semibold text-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-primary" /> Transactions Checklist
                        </CardTitle>
                        <CardDescription className="text-[11px] text-muted-foreground mt-0.5">Review recent aggregate card activity</CardDescription>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllTransactions(!showAllTransactions)}
                        className="text-[10px] rounded-xl hover:bg-muted font-sans font-semibold h-8 text-muted-foreground hover:text-foreground"
                      >
                        {showAllTransactions ? "Show Pending Only" : `View All (${mockTransactions.length})`}
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0 pt-4">

                      {/* Unreviewed list with Exit Animation */}
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        <AnimatePresence mode="popLayout">
                          {displayedTransactions.map(tx => (
                            <motion.div
                              key={tx.id}
                              layout
                              initial={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, x: -80, scale: 0.95, transition: { duration: 0.2 } }}
                              className={cn(
                                "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 rounded-2xl border border-border/30 transition-all duration-200",
                                tx.isReviewed ? "opacity-60 bg-muted/10" : "bg-card/40 hover:bg-muted/30"
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="text-lg shrink-0 p-1.5 rounded-xl bg-muted/30">
                                  {getCategoryDefaultEmoji(tx.category)}
                                </span>
                                <div className="space-y-0.5 min-w-0">
                                  <span className={cn("text-xs font-semibold block truncate text-foreground", tx.isReviewed && "line-through text-muted-foreground")}>
                                    {tx.name}
                                  </span>
                                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground font-mono">
                                    <span>{tx.date}</span>
                                    <span>•</span>
                                    <span className="uppercase text-[9px] tracking-wider font-semibold text-primary/70">{tx.category}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 self-end sm:self-center">
                                <span className="text-xs font-bold font-mono text-foreground">{formatGBP(tx.amount)}</span>
                                <Button
                                  onClick={() => toggleTransactionReviewed(tx.id)}
                                  size="sm"
                                  variant={tx.isReviewed ? "ghost" : "default"}
                                  className={cn(
                                    "h-8 rounded-xl text-[10px] gap-1 px-3 shrink-0 font-semibold",
                                    tx.isReviewed
                                      ? "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                      : "bg-emerald-500 hover:bg-emerald-600 text-white"
                                  )}
                                >
                                  {tx.isReviewed ? (
                                    <>Revert</>
                                  ) : (
                                    <><Check className="h-3 w-3" /> Review</>
                                  )}
                                </Button>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>

                        {/* Empty pending state */}
                        {displayedTransactions.length === 0 && !showAllTransactions && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center py-12 text-center space-y-3"
                          >
                            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-lg">
                              ✨
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-xs font-semibold text-foreground font-serif uppercase tracking-wider">All Caught Up!</h4>
                              <p className="text-[10px] text-muted-foreground max-w-[220px] mx-auto">No pending transactions left to review. Your budget and metrics are in perfect sync.</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowAllTransactions(true)}
                              className="rounded-xl text-[10px] h-8 font-sans font-medium"
                            >
                              View Reviewed Ledger
                            </Button>
                          </motion.div>
                        )}
                      </div>

                    </CardContent>
                  </Card>

                  {/* Top Spending Categories gauge */}
                  <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl">
                    <CardHeader className="p-0 pb-4 border-b border-border/30 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-serif font-semibold text-foreground">Top Spending Categories</CardTitle>
                        <CardDescription className="text-[11px] text-muted-foreground mt-0.5">Highest spend across your active budget groups</CardDescription>
                      </div>
                      <span className="text-lg">📊</span>
                    </CardHeader>
                    <CardContent className="p-0 pt-4 space-y-4">
                      {budgetCategories
                        .map(cat => {
                          const budget = cat.budgeted !== undefined ? cat.budgeted : cat.items.reduce((s, i) => s + i.budgeted, 0);
                          const spent = cat.items.reduce((s, i) => s + getBudgetItemSpent(i, bankAccounts, recurrings), 0);
                          return { name: cat.name, emoji: cat.emoji || '📂', budget, spent };
                        })
                        .sort((a, b) => b.spent - a.spent)
                        .slice(0, 3)
                        .map(cat => (
                          <div key={cat.name} className="space-y-1 text-xs">
                            <div className="flex justify-between gap-2 font-medium min-w-0 items-center">
                              <span className="truncate flex items-center gap-1.5 text-foreground font-semibold">
                                <span className="text-lg leading-none shrink-0">{cat.emoji}</span>
                                <span className="truncate">{cat.name}</span>
                              </span>
                              <span className="font-mono text-muted-foreground shrink-0 whitespace-nowrap text-[10px]">
                                {formatGBP(cat.spent)} / {formatGBP(cat.budget)}
                              </span>
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all duration-300", getProgressColor(cat.spent, cat.budget))}
                                style={{ width: `${Math.min(100, cat.budget > 0 ? (cat.spent / cat.budget) * 100 : 0)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </CardContent>
                  </Card>

                </div>

                {/* Right Side: Recurrings List & Active savings goals (lg:col-span-4) */}
                <div className="lg:col-span-4 space-y-6">

                  {/* Next two weeks recurrings card */}
                  <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl">
                    <CardHeader className="p-0 pb-4 border-b border-border/30">
                      <CardTitle className="text-sm font-serif font-semibold text-foreground">Upcoming Recurring Bills</CardTitle>
                      <CardDescription className="text-[11px] text-muted-foreground mt-0.5">Bills due in the calendar cycle</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 pt-4 space-y-3">
                      {recurrings
                        .filter(r => isDueThisMonth(r, currentMonth) && !r.isPaid)
                        .sort((a, b) => a.dueDate - b.dueDate)
                        .slice(0, 3)
                        .map(bill => (
                          <div key={bill.id} className="flex items-center justify-between text-xs p-2.5 rounded-2xl bg-muted/10 border border-border/20 gap-3">
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 font-semibold text-foreground min-w-0">
                                <span className="text-lg shrink-0 leading-none">{bill.emoji || '💸'}</span>
                                <span className="truncate">{bill.name}</span>
                              </div>
                              <span className="text-[9px] text-muted-foreground block font-mono uppercase tracking-wider">{getDueDateText(bill, currentMonth)}</span>
                            </div>
                            <span className="font-bold font-mono shrink-0">{formatGBP(bill.amount)}</span>
                          </div>
                        ))}
                      {recurrings.filter(r => isDueThisMonth(r, currentMonth) && !r.isPaid).length === 0 && (
                        <p className="text-[11px] text-muted-foreground italic text-center py-4">No upcoming bills left to pay!</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Active Goals Summary card */}
                  <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl">
                    <CardHeader className="p-0 pb-4 border-b border-border/30">
                      <CardTitle className="text-sm font-serif font-semibold text-foreground">Active Savings Milestones</CardTitle>
                      <CardDescription className="text-[11px] text-muted-foreground mt-0.5">Target goals and current saved values</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 pt-4 space-y-4">
                      {goals.slice(0, 2).map(goal => {
                        const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                        return (
                          <div key={goal.id} className="space-y-1 text-xs">
                            <div className="flex justify-between gap-2 font-semibold min-w-0">
                              <span className="truncate text-foreground font-semibold">{goal.name}</span>
                              <span className="font-mono text-emerald-500 font-bold">
                                {progress.toFixed(0)}%
                              </span>
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                              <span>{formatGBP(goal.currentAmount)}</span>
                              <span>Target: {formatGBP(goal.targetAmount)}</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      {goals.length === 0 && (
                        <p className="text-[11px] text-muted-foreground italic text-center py-4">No active savings goals set up.</p>
                      )}
                    </CardContent>
                  </Card>

                </div>

              </div>

            </div>
          )}

          {/* ==========================================
              TAB 2: TAX & INCOME
              ========================================== */}
          {activeTab === 'tax-income' && (
            <div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Side: Payroll breakdown rate tables */}
                <div className="lg:col-span-8 flex flex-col gap-4">

                  {/* Standard Rates Breakdown */}
                  <div className="bg-card/40 backdrop-blur-sm rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 border border-primary/10 shadow-sm">
                    <div className="flex flex-col gap-3 mb-4 border-b border-border/50 pb-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-0.5 text-left min-w-0">
                          <h3 className="font-serif text-base sm:text-lg text-foreground flex items-center gap-2 font-semibold">
                            <DollarSign className="w-5 h-5 text-primary shrink-0" /> Breakdown Rates
                          </h3>
                          <p className="text-[11px] text-muted-foreground font-sans">
                            Rules applied ({settings.ukRegion === 'england-and-wales' ? 'England' : settings.ukRegion})
                          </p>
                          <p className="text-xs text-muted-foreground pt-1">
                            {includeWorkLeaveInActual
                              ? `${breakdownWorkingDays} paid days per year — weekends and bank holidays excluded, ${settings.workHolidays} days paid leave included.`
                              : `${breakdownWorkingDays} working days per year — weekends, bank holidays, and ${settings.workHolidays} days paid leave excluded.`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0 rounded-xl border border-border/40 bg-muted/20 px-3 py-2 self-start">
                          <Label htmlFor="include-work-leave" className="text-[11px] font-medium text-muted-foreground cursor-pointer">
                            {includeWorkLeaveInActual ? 'Including paid leave' : 'Excluding paid leave'}
                          </Label>
                          <Switch
                            id="include-work-leave"
                            checked={includeWorkLeaveInActual}
                            onCheckedChange={setIncludeWorkLeaveInActual}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto -mx-1 px-1 scrollbar-thin">
                      <table className="min-w-[640px] w-full text-sm text-left border-collapse">
                        <thead>
                          <tr className="border-b border-border/40 text-foreground text-xs uppercase tracking-wider font-bold">
                            <th className="py-3 pr-4 whitespace-nowrap">Category</th>
                            <th className="py-3 px-2 text-right whitespace-nowrap">Annual</th>
                            <th className="py-3 px-2 text-right whitespace-nowrap">Monthly</th>
                            <th className="py-3 px-2 text-right whitespace-nowrap">Weekly</th>
                            <th className="py-3 px-2 text-right whitespace-nowrap">Daily</th>
                            <th className="py-3 pl-2 text-right whitespace-nowrap">Hourly</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30 font-mono text-xs text-foreground">

                          {/* Gross Salary */}
                          <tr className="hover:bg-muted/10 transition-colors font-medium">
                            <td className="py-3 pr-4 font-bold font-sans text-foreground whitespace-nowrap">Gross Salary</td>
                            <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.annual)}</td>
                            <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.monthly)}</td>
                            <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.weekly)}</td>
                            <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.daily)}</td>
                            <td className="py-3 pl-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.hourly)}</td>
                          </tr>

                          {/* Pension Contributions */}
                          {results.personalPensionRate > 0 && (
                            <tr className="hover:bg-muted/10 transition-colors text-foreground">
                              <td className="py-3 pr-4 font-sans text-left">
                                <div className="flex flex-col justify-center min-w-[120px]">
                                  <span className="font-bold text-foreground">Pension ({settings.personalPensionPercent}%)</span>
                                  <span className="text-[10px] text-muted-foreground/90 font-medium leading-normal mt-0.5">
                                    {settings.pensionType === 'net_pay' ? 'Net Pay' :
                                      settings.pensionType === 'salary_sacrifice' ? 'Salary Sacrifice' :
                                        'Relief at Source'}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-right text-rose-600 dark:text-rose-400 font-semibold whitespace-nowrap">-{formatGBP(breakdownRates.pension.annual)}</td>
                              <td className="py-3 px-2 text-right text-rose-600 dark:text-rose-400 font-semibold whitespace-nowrap">-{formatGBP(breakdownRates.pension.monthly)}</td>
                              <td className="py-3 px-2 text-right text-rose-600 dark:text-rose-400 font-semibold whitespace-nowrap">-{formatGBP(breakdownRates.pension.weekly)}</td>
                              <td className="py-3 px-2 text-right text-rose-600 dark:text-rose-400 font-semibold whitespace-nowrap">-{formatGBP(breakdownRates.pension.daily)}</td>
                              <td className="py-3 pl-2 text-right text-rose-600 dark:text-rose-400 font-semibold whitespace-nowrap">-{formatGBP(breakdownRates.pension.hourly)}</td>
                            </tr>
                          )}

                          {/* Income Tax */}
                          {results.incomeTax > 0 && (
                            <tr className="hover:bg-muted/10 transition-colors text-foreground">
                              <td className="py-3 font-sans font-bold text-foreground">Income Tax</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.tax.annual)}</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.tax.monthly)}</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.tax.weekly)}</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.tax.daily)}</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.tax.hourly)}</td>
                            </tr>
                          )}

                          {/* National Insurance */}
                          {results.nationalInsurance > 0 && (
                            <tr className="hover:bg-muted/10 transition-colors text-foreground">
                              <td className="py-3 pr-4 font-sans text-left">
                                <div className="flex flex-col justify-center min-w-[120px]">
                                  <span className="font-bold text-foreground">National Insurance</span>
                                  <span className="text-[10px] text-muted-foreground/90 font-medium leading-normal mt-0.5">
                                    8% (£12,570-£50,270), 2% above
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.ni.annual)}</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.ni.monthly)}</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.ni.weekly)}</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.ni.daily)}</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.ni.hourly)}</td>
                            </tr>
                          )}

                          {/* Student Loan */}
                          {results.studentLoan > 0 && (
                            <tr className="hover:bg-muted/10 transition-colors text-foreground">
                              <td className="py-3 font-sans font-bold text-foreground">Student Loan ({getPlanName(settings.studentLoanPlan)})</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.studentLoan.annual)}</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.studentLoan.monthly)}</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.studentLoan.weekly)}</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.studentLoan.daily)}</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.studentLoan.hourly)}</td>
                            </tr>
                          )}

                          {/* Total Deductions */}
                          <tr className="hover:bg-rose-500/10 transition-colors text-rose-700 dark:text-rose-300 bg-rose-500/5 dark:bg-rose-500/10 font-sans">
                            <td className="py-3 font-bold">Total Deductions</td>
                            <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.annual)}</td>
                            <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.monthly)}</td>
                            <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.weekly)}</td>
                            <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.daily)}</td>
                            <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.hourly)}</td>
                          </tr>

                          {/* Take Home Pay */}
                          <tr className="hover:bg-emerald-500/10 transition-colors text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 dark:bg-emerald-500/10 font-sans">
                            <td className="py-3 font-bold text-sm">Take-Home Pay</td>
                            <td className="py-3 text-right font-mono font-bold text-sm">{formatGBP(breakdownRates.postTax.annual)}</td>
                            <td className="py-3 text-right font-mono font-bold text-sm">{formatGBP(breakdownRates.postTax.monthly)}</td>
                            <td className="py-3 text-right font-mono font-bold text-sm">{formatGBP(breakdownRates.postTax.weekly)}</td>
                            <td className="py-3 text-right font-mono font-bold text-sm">{formatGBP(breakdownRates.postTax.daily)}</td>
                            <td className="py-3 text-right font-mono font-bold text-sm">{formatGBP(breakdownRates.postTax.hourly)}</td>
                          </tr>

                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl border border-primary/10 bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-serif text-sm font-semibold text-foreground">Settings</p>
                      <p className="text-[11px] text-muted-foreground">
                        {settings.ukRegion === 'england-and-wales' ? 'England & Wales' : settings.ukRegion === 'scotland' ? 'Scotland' : 'Northern Ireland'} tax rules and income assumptions
                      </p>
                    </div>
                    <Button onClick={() => setIsSettingsOpen(true)} className="h-9 rounded-xl gap-1.5 bg-primary text-primary-foreground shrink-0 self-start sm:self-auto">
                      <Settings className="h-4 w-4" /> Settings
                    </Button>
                  </div>

                </div>

                {/* Right Side: Combined leave balances and holiday tracker */}
                <div className="lg:col-span-4 flex flex-col gap-6">

                  <div className="bg-card/40 backdrop-blur-sm rounded-[2rem] p-6 border border-primary/10 shadow-sm space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border/30 pb-3">
                      <div className="min-w-0">
                        <h3 className="font-serif text-sm font-semibold text-foreground flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-primary shrink-0" /> Holiday Tracker
                        </h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Click a month card to expand details. Book leave inline or remove booked events easily.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-b border-border/30 pb-4">
                      <div className="rounded-xl bg-muted/20 px-2.5 py-2 text-left">
                        <span className="block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Allowance</span>
                        <span className="mt-1 block font-mono text-sm font-bold text-foreground">
                          {settings.workHolidays}
                          <span className="ml-1 text-[9px] font-normal text-muted-foreground">days</span>
                        </span>
                      </div>
                      <div className="rounded-xl bg-[#40a02b]/10 px-2.5 py-2 text-left">
                        <span className="block text-[9px] font-semibold uppercase tracking-wider text-[#40a02b] dark:text-[#a6e3a1]">Left</span>
                        <span className="mt-1 block font-mono text-sm font-bold text-[#40a02b] dark:text-[#a6e3a1]">
                          {settings.workHolidays - getHolidaysUsedCount()}
                          <span className="ml-1 text-[9px] font-normal">days</span>
                        </span>
                      </div>
                      <div className="rounded-xl bg-[#8839ef]/10 px-2.5 py-2 text-left">
                        <span className="block text-[9px] font-semibold uppercase tracking-wider text-[#8839ef] dark:text-[#cba6f7]">Bank</span>
                        <span className="mt-1 block font-mono text-sm font-bold text-[#8839ef] dark:text-[#cba6f7]">
                          {bankHolidaysLeft}/{settings.bankHolidays}
                          <span className="ml-1 text-[9px] font-normal">left</span>
                        </span>
                      </div>
                    </div>

                    <TooltipProvider delayDuration={150}>
                      <div id="holiday-months-container" className="holiday-scrollbar space-y-4 max-h-[330px] overflow-y-auto pr-3 lg:max-h-[315px]">
                        {MONTH_NAMES.map((month, monthIdx) => {
                          const daysInMonth = getDaysInMonth(settings.taxYear, monthIdx);
                          const startDayOfWeek = getStartDayOfWeek(settings.taxYear, monthIdx);

                          const normalizedHolidays = getNormalizedHolidays(settings, holidayDefaults);
                          const bookedDaysForMonth = getBookedDaysForMonth(normalizedHolidays, settings.taxYear, monthIdx, bankHolidaysList);

                          // Sum up the working days (excl. weekends & bank holidays) booked in this specific month
                          const monthWorkingDaysBooked = bookedDaysForMonth.length;

                          const isExpanded = expandedMonthIdx === monthIdx;

                          // Get overlapping holidays for this month
                          const overlappingHolidays = normalizedHolidays.filter(hol => {
                            const start = new Date(hol.startDate);
                            const end = new Date(hol.endDate);
                            if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;

                            const startVal = start.getFullYear() * 12 + start.getMonth();
                            const endVal = end.getFullYear() * 12 + end.getMonth();
                            const currentVal = settings.taxYear * 12 + monthIdx;

                            return currentVal >= startVal && currentVal <= endVal;
                          });

                          return (
                            <div
                              key={month}
                              id={`holiday-month-${monthIdx}`}
                              onClick={() => setExpandedMonthIdx(isExpanded ? null : monthIdx)}
                              className={cn(
                                "p-3 rounded-2xl bg-muted/10 border border-border/20 flex flex-col transition-all cursor-pointer hover:border-primary/20",
                                isExpanded && "border-primary/30 ring-1 ring-primary/10 shadow-sm animate-in fade-in zoom-in-95 duration-200"
                              )}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-foreground">{month}</span>
                                <div className="flex items-center gap-1.5 text-[10px]">
                                  {monthWorkingDaysBooked > 0 && (
                                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold px-1.5 py-0.5 rounded font-sans">
                                      🏝️ {monthWorkingDaysBooked} {monthWorkingDaysBooked === 1 ? 'day' : 'days'}
                                    </span>
                                  )}
                                  <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", isExpanded && "rotate-90")} />
                                </div>
                              </div>

                              {/* Week headers */}
                              <div className="grid grid-cols-7 gap-1 mb-1 text-[9px] font-semibold text-muted-foreground text-center">
                                <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
                              </div>

                              {/* Days Grid */}
                              <div className="grid grid-cols-7 gap-x-1 gap-y-1 text-center justify-items-center">
                                {Array.from({ length: startDayOfWeek }).map((_, i) => (
                                  <div key={`empty-${i}`} className="w-7 h-7 sm:w-6 sm:h-6" />
                                ))}

                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                  const dayNum = i + 1;
                                  const pad = (n: number) => n.toString().padStart(2, '0');
                                  const dateStr = `${settings.taxYear}-${pad(monthIdx + 1)}-${pad(dayNum)}`;

                                  const isBankHoliday = bankHolidaysList.includes(dateStr);

                                  const isBookedHoliday = bookedDaysForMonth.some(b => b.day === dayNum);
                                  const bookedOccasion = bookedDaysForMonth.find(b => b.day === dayNum)?.occasion || 'Leave';

                                  const dateObj = new Date(settings.taxYear, monthIdx, dayNum);
                                  const dayOfWeek = dateObj.getDay();
                                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                                  let cellClass = "w-7 h-7 sm:w-6 sm:h-6 text-[10px] font-mono flex items-center justify-center rounded-full font-medium ";

                                  if (isBookedHoliday) {
                                    cellClass += "text-[#40a02b] dark:text-[#a6e3a1] font-bold";
                                  } else if (isBankHoliday) {
                                    cellClass += "text-[#8839ef] dark:text-[#cba6f7] font-bold";
                                  } else if (isWeekend) {
                                    cellClass += "text-muted-foreground/30";
                                  } else {
                                    cellClass += "text-foreground";
                                  }

                                  const getTooltipDetails = () => {
                                    const list = [];
                                    if (isBankHoliday) {
                                      list.push(`Bank Holiday: ${bankHolidaysMap[dateStr] || 'Public Holiday'}`);
                                    }
                                    if (isBookedHoliday) {
                                      list.push(`Booked Leave: ${bookedOccasion}`);
                                    }
                                    if (isWeekend) {
                                      list.push('Weekend');
                                    }
                                    if (list.length === 0) {
                                      list.push('Working Day');
                                    }
                                    return list;
                                  };

                                  return (
                                    <Tooltip key={dayNum}>
                                      <TooltipTrigger asChild>
                                        <div className={cellClass}>
                                          {dayNum}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs p-2.5 rounded-2xl bg-popover border border-border/80 shadow-md">
                                        <p className="font-bold text-foreground mb-1">{dayNum} {month} {settings.taxYear}</p>
                                        <div className="space-y-1 text-muted-foreground font-sans">
                                          {getTooltipDetails().map((detail, idx) => {
                                            let colorClass = "text-foreground/80";
                                            if (detail.startsWith('Bank Holiday')) {
                                              colorClass = "text-[#8839ef] dark:text-[#cba6f7] font-semibold";
                                            } else if (detail.startsWith('Booked Leave')) {
                                              colorClass = "text-[#40a02b] dark:text-[#a6e3a1] font-semibold";
                                            } else if (detail === 'Weekend') {
                                              colorClass = "text-muted-foreground/50";
                                            }
                                            return (
                                              <p key={idx} className={colorClass}>{detail}</p>
                                            );
                                          })}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                              </div>

                              {/* Expanded details section */}
                              {isExpanded && (
                                <div className="border-t border-border/20 mt-3 pt-3 space-y-3">
                                  {/* Overlapping Holidays List */}
                                  <div className="space-y-1.5">
                                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider block">Booked Leave</span>
                                    {overlappingHolidays.length > 0 ? (
                                      <div className="space-y-1.5">
                                        {overlappingHolidays.map(hol => (
                                          <div
                                            key={hol.id}
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-muted/35 border border-border/15 rounded-xl p-2.5 flex items-center justify-between text-xs"
                                          >
                                            <div className="space-y-0.5 min-w-0 pr-2 text-left">
                                              <span className="font-semibold text-foreground block truncate">{hol.occasion}</span>
                                              <span className="text-[10px] text-muted-foreground block font-mono">
                                                {formatHolidayDates(hol.startDate, hol.endDate)} ({hol.count} {hol.count === 1 ? 'day' : 'days'})
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleStartEditHoliday(hol, monthIdx);
                                                }}
                                                className="h-7 w-7 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-foreground"
                                                title="Edit holiday"
                                              >
                                                <Pencil className="h-3.5 w-3.5" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteHoliday(hol.id);
                                                }}
                                                className="h-7 w-7 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500"
                                                title="Delete holiday"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-[10px] text-muted-foreground italic text-center py-1">
                                        No leave booked for this month.
                                      </div>
                                    )}
                                  </div>

                                  {/* Add Holiday Button or Form */}
                                  {inlineBookMonthIdx === monthIdx ? (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="bg-muted/40 border border-primary/10 rounded-xl p-3 space-y-3 text-left"
                                    >
                                      <span className="text-[10px] font-semibold uppercase tracking-wider block text-primary">
                                        {editingHolidayId ? 'Edit Leave' : 'Book New Leave'}
                                      </span>
                                      <div className="space-y-2">
                                        <div className="space-y-0.5">
                                          <Label className="text-[10px] text-muted-foreground">Occasion</Label>
                                          <Input
                                            placeholder="e.g. Skiing, Paris Trip"
                                            value={inlineOccasion}
                                            onChange={(e) => setInlineOccasion(e.target.value)}
                                            className="h-8 rounded-lg text-xs border-primary/20 bg-background/50"
                                          />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="space-y-0.5">
                                            <Label className="text-[10px] text-muted-foreground">Start Date</Label>
                                            <Input
                                              type="date"
                                              value={inlineStartDate}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                setInlineStartDate(val);
                                                if (inlineEndDate) {
                                                  const workingDays = calculateWorkingDaysInRange(val, inlineEndDate, bankHolidaysList);
                                                  setInlineCount(workingDays.toString());
                                                }
                                              }}
                                              className="h-8 rounded-lg text-[10px] border-primary/20 bg-background/50 font-mono"
                                            />
                                          </div>
                                          <div className="space-y-0.5">
                                            <Label className="text-[10px] text-muted-foreground">End Date</Label>
                                            <Input
                                              type="date"
                                              value={inlineEndDate}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                setInlineEndDate(val);
                                                if (inlineStartDate) {
                                                  const workingDays = calculateWorkingDaysInRange(inlineStartDate, val, bankHolidaysList);
                                                  setInlineCount(workingDays.toString());
                                                }
                                              }}
                                              className="h-8 rounded-lg text-[10px] border-primary/20 bg-background/50 font-mono"
                                            />
                                          </div>
                                        </div>
                                        <div className="space-y-0.5">
                                          <Label className="text-[10px] text-muted-foreground">Days count (working days)</Label>
                                          <Input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            value={inlineCount}
                                            onChange={(e) => setInlineCount(e.target.value)}
                                            className="h-8 rounded-lg text-xs border-primary/20 bg-background/50 font-mono"
                                          />
                                        </div>
                                      </div>
                                      <div className="flex justify-end gap-1.5 pt-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={resetInlineHolidayForm}
                                          className="h-7 px-2.5 rounded-lg text-[10px]"
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => handleSaveInlineHoliday(monthIdx)}
                                          className="h-7 px-2.5 rounded-lg text-[10px] bg-primary text-primary-foreground"
                                        >
                                          {editingHolidayId ? 'Update' : 'Save'}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartNewHoliday(monthIdx);
                                      }}
                                      className="w-full h-8 rounded-xl text-xs gap-1 border-dashed hover:bg-muted/50"
                                    >
                                      <Plus className="h-3 w-3" /> Book Leave
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </TooltipProvider>

                  </div>

                  {/* Card 2: Payday Details */}
                  <div className="bg-card/40 backdrop-blur-sm rounded-[2rem] p-6 border border-primary/10 shadow-sm space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border/30 pb-3">
                      <div className="min-w-0">
                        <h3 className="font-serif text-sm font-semibold text-foreground flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-primary shrink-0" /> Payday Details
                        </h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Your configured payday schedule and next expected pay date.</p>
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-medium">Schedule Type</span>
                        <span className="font-semibold text-foreground capitalize">
                          {settings.paydaySchedule === 'monthly_date' && `Monthly (${settings.payDayOfMonth || 25}th)`}
                          {settings.paydaySchedule === 'last_working_day' && 'Last Working Day'}
                          {settings.paydaySchedule === 'last_friday' && 'Last Friday of Month'}
                          {settings.paydaySchedule === 'biweekly' && 'Bi-weekly (Every 2 weeks)'}
                          {settings.paydaySchedule === 'weekly' && `Weekly (${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][settings.paydayWeekday ?? 5]}s)`}
                          {settings.paydaySchedule === 'semimonthly' && 'Semi-monthly (15th & Last working day)'}
                          {!settings.paydaySchedule && `Monthly (${settings.payDayOfMonth || 25}th)`}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-medium">Next Payday</span>
                        <span className="font-semibold text-foreground">
                          {nextPayday.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-medium">Status</span>
                        <span className={cn(
                          "font-mono px-2 py-0.5 rounded-lg font-bold text-[10px]",
                          nextPayday.daysRemaining === 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-muted/60 text-muted-foreground"
                        )}>
                          {nextPayday.daysRemaining === 0 ? "Paid today!" : `${nextPayday.daysRemaining} days left`}
                        </span>
                      </div>

                      {nextPayday.adjusted && (
                        <div className="rounded-xl bg-[#df8e1d]/10 p-2.5 text-[10px] text-[#df8e1d] dark:text-[#f9e2af] flex items-start gap-1.5 leading-normal">
                          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>
                            Adjusted to working day before due to {nextPayday.adjustReason === 'weekend' ? 'a weekend' : 'a bank holiday'}.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* ==========================================
              TAB 3: BUDGET
              ========================================== */}
          {activeTab === 'budget' && (() => {
            const savingsCategories = budgetCategories.filter(cat => cat.group === 'savings');
            const savingsItems = savingsCategories.flatMap(cat => cat.items.map(item => ({ name: item.name, value: getBudgetItemSpent(item, bankAccounts, recurrings) })));
            const totalSavings = savingsItems.reduce((sum, item) => sum + item.value, 0);

            const needsTotal = budgetCategories
              .filter(cat => cat.group === 'needs')
              .reduce((sum, cat) => sum + cat.items.reduce((s, i) => s + getBudgetItemSpent(i, bankAccounts, recurrings), 0), 0);

            const wantsTotal = budgetCategories
              .filter(cat => cat.group === 'wants')
              .reduce((sum, cat) => sum + cat.items.reduce((s, i) => s + getBudgetItemSpent(i, bankAccounts, recurrings), 0), 0);

            const totalBudgetLimit = budgetCategories.reduce((sum, cat) => sum + (cat.budgeted || 0), 0);
            const totalSpent = needsTotal + wantsTotal + totalSavings;
            const showWarning = totalBudgetLimit > 0 && totalSpent > totalBudgetLimit;

            const allocationData = [
              { name: 'Needs', value: needsTotal, color: '#3b82f6' },
              { name: 'Savings', value: totalSavings, color: '#10b981' },
              { name: 'Wants', value: wantsTotal, color: '#8892b0' }
            ].filter(d => d.value > 0);

            const currentMonthName = new Date().toLocaleDateString('en-GB', { month: 'short' });

            const categoryData = budgetCategories
              .map((cat, idx) => {
                const spent = cat.items.reduce((s, i) => s + getBudgetItemSpent(i, bankAccounts, recurrings), 0);
                return {
                  name: cat.name,
                  value: spent,
                  color: [
                    '#3b82f6', // blue
                    '#10b981', // emerald
                    '#f59e0b', // amber
                    '#ef4444', // red
                    '#8b5cf6', // violet
                    '#ec4899', // pink
                    '#14b8a6', // teal
                    '#f97316', // orange
                  ][idx % 8]
                };
              })
              .filter(d => d.value > 0);

            const donutData = categoryData.length > 0 ? categoryData : [{ name: 'Budget', value: 1, color: 'rgba(255,255,255,0.1)' }];

            return (
              <div className="space-y-6">

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
                  <div className="min-w-0">
                    <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary shrink-0" /> Budget vs Spent Manager
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Customize your monthly budget target limits and record current spending progress</p>
                  </div>
                  <Button onClick={() => setIsAddCategoryOpen(true)} className="rounded-xl gap-1.5 bg-primary text-primary-foreground shrink-0 self-start sm:self-auto">
                    <Plus className="h-4 w-4" /> Add Category
                  </Button>
                </div>

                {/* Header Overview: Spent vs Total Budget gauge */}
                <div className="bg-card/30 backdrop-blur-sm rounded-[2rem] p-6 border border-primary/10 shadow-sm flex flex-col md:flex-row items-center justify-around gap-6">

                  {/* Left: Total Spent */}
                  <div className="text-center md:text-left space-y-1">
                    <span className="text-3xl md:text-4xl font-bold font-mono text-foreground block">
                      {formatGBP(totalSpent)}
                    </span>
                    <span className="text-xs text-muted-foreground block font-sans font-medium">
                      spent in {currentMonthName}
                    </span>
                  </div>

                  {/* Middle: Custom Donut Gauge */}
                  <div className="w-28 h-28 flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={28}
                          outerRadius={38}
                          paddingAngle={categoryData.length > 1 ? 3 : 0}
                          dataKey="value"
                          cornerRadius={3}
                        >
                          {donutData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(v: number) => formatGBP(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Right: Total Budget Limit */}
                  <div className="text-center md:text-right space-y-1">
                    <span className="text-3xl md:text-4xl font-bold font-mono text-foreground block">
                      {formatGBP(totalBudgetLimit)}
                    </span>
                    <span className="text-xs text-muted-foreground block font-sans font-medium">
                      total budget
                    </span>
                  </div>

                </div>

                {/* Money Allocation & Savings Dashboard */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                  {/* Left Column: Savings breakdown */}
                  <div className="lg:col-span-5 bg-card/30 backdrop-blur-sm rounded-[2rem] p-6 border border-primary/10 shadow-sm space-y-4">
                    <h4 className="font-serif text-sm font-semibold text-foreground border-b border-border/30 pb-2">Savings Allocation</h4>
                    <div className="overflow-hidden rounded-2xl border border-border/20">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border/20 font-serif font-bold text-foreground">
                            <th className="p-3">Category</th>
                            <th className="p-3 text-right">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/10 font-mono text-[11px]">
                          {savingsItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-muted/10">
                              <td className="p-3 font-sans font-medium text-foreground">{item.name}</td>
                              <td className="p-3 text-right">{formatGBP(item.value)}</td>
                            </tr>
                          ))}
                          {savingsItems.length === 0 && (
                            <tr>
                              <td colSpan={2} className="p-3 text-center text-muted-foreground italic font-sans">No savings logged yet.</td>
                            </tr>
                          )}
                          <tr className="bg-muted/20 font-bold border-t border-border/20 text-foreground">
                            <td className="p-3 font-sans text-xs">Total</td>
                            <td className="p-3 text-right text-xs">{formatGBP(totalSavings)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Money Allocation Summary & Pie Chart */}
                  <div className="lg:col-span-7 bg-card/30 backdrop-blur-sm rounded-[2rem] p-6 border border-primary/10 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Summary table */}
                    <div className="space-y-4">
                      <h4 className="font-serif text-sm font-semibold text-foreground border-b border-border/30 pb-2">Money Allocation</h4>
                      <div className="overflow-hidden rounded-2xl border border-border/20">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="bg-muted/30 border-b border-border/20 font-serif font-bold text-foreground">
                              <th className="p-3">Category</th>
                              <th className="p-3 text-right">Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/10 font-mono text-[11px]">
                            <tr className="hover:bg-muted/10">
                              <td className="p-3 font-sans font-medium text-foreground">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shrink-0" /> Needs
                                </div>
                              </td>
                              <td className="p-3 text-right">{formatGBP(needsTotal)}</td>
                            </tr>
                            <tr className="hover:bg-muted/10">
                              <td className="p-3 font-sans font-medium text-foreground">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shrink-0" /> Savings
                                </div>
                              </td>
                              <td className="p-3 text-right">{formatGBP(totalSavings)}</td>
                            </tr>
                            <tr className="hover:bg-muted/10">
                              <td className="p-3 font-sans font-medium text-foreground">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full bg-[#8892b0] shrink-0" /> Wants
                                </div>
                              </td>
                              <td className="p-3 text-right">{formatGBP(wantsTotal)}</td>
                            </tr>
                            <tr className="bg-muted/20 font-bold border-t border-border/20 text-foreground">
                              <td className="p-3 font-sans text-xs">Total</td>
                              <td className="p-3 text-right text-xs">{formatGBP(needsTotal + wantsTotal + totalSavings)}</td>
                            </tr>
                            <tr className="font-bold border-t border-border/20">
                              <td className="p-3 font-sans text-xs text-foreground">Spend Status</td>
                              <td className="p-3 text-right text-xs">
                                {showWarning ? (
                                  <span className="inline-flex items-center text-rose-500 gap-1 font-sans" title="Spent exceeds budget limit!">
                                    ⚠️ Over Limit
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-emerald-500 gap-1 font-sans">
                                    ✓ Within Budget
                                  </span>
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Recharts Pie Chart */}
                    <div className="flex flex-col items-center justify-center space-y-4">
                      {needsTotal + wantsTotal + totalSavings > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={140}>
                            <PieChart>
                              <Pie
                                data={allocationData}
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={55}
                                paddingAngle={4}
                                dataKey="value"
                              >
                                {allocationData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <RechartsTooltip formatter={(v: number) => formatGBP(v)} />
                            </PieChart>
                          </ResponsiveContainer>

                          {/* Legend / Percentages breakdown */}
                          <div className="flex flex-wrap justify-center gap-3 text-[10px] text-muted-foreground font-mono">
                            {allocationData.map((entry, index) => {
                              const percent = (entry.value / (needsTotal + wantsTotal + totalSavings)) * 100;
                              return (
                                <div key={index} className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                  <span>{entry.name}: {percent.toFixed(0)}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground italic text-center py-8">Add items and costs to visualize allocation.</p>
                      )}
                    </div>

                  </div>

                </div>

                {/* Grid of Budget Categories */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {budgetCategories.map(category => {
                    const catBudget = category.budgeted !== undefined ? category.budgeted : category.items.reduce((s, i) => s + i.budgeted, 0);
                    const catSpent = category.items.reduce((s, i) => s + getBudgetItemSpent(i, bankAccounts, recurrings), 0);
                    const catColor = getProgressColor(catSpent, catBudget);

                    return (
                      <Card key={category.id} className="bg-card/40 border border-primary/10 rounded-3xl p-6 flex flex-col justify-between space-y-4">

                        {/* Header block */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                          <div className="space-y-1 min-w-0 flex-1 flex items-start gap-2.5">
                            <span className="text-2xl pt-0.5 leading-none shrink-0">{category.emoji || '📂'}</span>
                            <div className="min-w-0">
                              <span className="text-sm font-bold font-serif text-foreground block truncate">{category.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono block">
                                {formatGBP(catSpent)} Spent / {formatGBP(catBudget)} Budgeted
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-1 shrink-0 self-end sm:self-start">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setActiveCategoryId(category.id);
                                setIsAddItemOpen(true);
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Add item"
                            >
                              <PlusCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setActiveCategoryId(category.id);
                                setNewCategoryName(category.name);
                                setNewCategoryBudget(category.budgeted !== undefined ? category.budgeted : category.items.reduce((s, i) => s + i.budgeted, 0));
                                setNewCategoryEmoji(category.emoji || '');
                                setNewCategoryGroup(category.group || 'needs');
                                setIsEditCategoryOpen(true);
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Edit Category"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteCategory(category.id)}
                              className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                              title="Delete Category"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Total progress bar for category */}
                        <div className="space-y-1.5">
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all duration-300", catColor)}
                              style={{ width: `${Math.min(100, catBudget > 0 ? (catSpent / catBudget) * 100 : 0)}%` }}
                            />
                          </div>
                        </div>

                        {/* Children Items */}
                        <div className="space-y-2 pt-2 border-t border-border/20">
                          {category.items.map(item => {
                            const spentVal = getBudgetItemSpent(item, bankAccounts, recurrings);
                            const linkedAcc = item.linkedAccountId ? bankAccounts.find(a => a.id === item.linkedAccountId) : null;
                            return (
                              <div key={item.id} className="group flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center text-xs py-1">
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-foreground/95 truncate">{item.name}</span>
                                  {linkedAcc && (
                                    <span className="text-[9px] text-primary/70 font-mono">
                                      Linked: {linkedAcc.name}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                  <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                                    {formatGBP(spentVal)}
                                  </span>

                                  <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => {
                                        setActiveBudgetItem({ ...item, categoryId: category.id });
                                        setIsEditItemOpen(true);
                                      }}
                                      className="text-muted-foreground hover:text-foreground p-0.5"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(category.id, item.id)}
                                      className="text-rose-500 hover:text-rose-600 p-0.5"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {category.items.length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic text-center py-2">No items. Click '+' to add.</p>
                          )}
                        </div>

                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ==========================================
              TAB 4: CASH FLOW
              ========================================== */}
          {activeTab === 'cash-flow' && (() => {
            // ── Cash Flow Period Definitions ──
            const cfMonthlyIncome = breakdownRates.postTax.monthly;
            const cfCurrentMonthIdx = todayDateObj.getMonth();
            const cfYear = todayDateObj.getFullYear();

            // Compute period start/end dates based on selected period
            const getPeriodRange = () => {
              const today = new Date(todayDateObj);
              today.setHours(0, 0, 0, 0);
              switch (cfPeriod) {
                case 'ytd':
                  return { start: new Date(cfYear, 0, 1), end: today };
                case 'mtd':
                  return { start: new Date(cfYear, cfCurrentMonthIdx, 1), end: today };
                case 'last_12m': {
                  const s = new Date(today);
                  s.setMonth(s.getMonth() - 11);
                  s.setDate(1);
                  return { start: s, end: today };
                }
                case 'last_3m': {
                  const s = new Date(today);
                  s.setMonth(s.getMonth() - 2);
                  s.setDate(1);
                  return { start: s, end: today };
                }
                case 'last_4w': {
                  const s = new Date(today);
                  s.setDate(s.getDate() - 27);
                  return { start: s, end: today };
                }
                case 'custom': {
                  const s = new Date(cfCustomStart);
                  const e = new Date(cfCustomEnd);
                  s.setHours(0, 0, 0, 0);
                  e.setHours(23, 59, 59, 999);
                  return {
                    start: isNaN(s.getTime()) ? new Date(cfYear, 0, 1) : s,
                    end: isNaN(e.getTime()) ? today : e
                  };
                }
                default:
                  return { start: new Date(cfYear, 0, 1), end: today };
              }
            };

            const { start: cfPeriodStart, end: cfPeriodEnd } = getPeriodRange();

            const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
            const periodStartLabel = fmtDate(cfPeriodStart);
            const periodEndLabel = fmtDate(cfPeriodEnd);

            const CF_PERIOD_OPTIONS = [
              { key: 'ytd' as const, label: 'Year to Date' },
              { key: 'mtd' as const, label: 'Month to Date' },
              { key: 'last_12m' as const, label: 'Last 12 Months' },
              { key: 'last_3m' as const, label: 'Last 3 Months' },
              { key: 'last_4w' as const, label: 'Last 4 Weeks' },
              { key: 'custom' as const, label: 'Custom Range' },
            ];

            const activePeriodLabel = CF_PERIOD_OPTIONS.find(o => o.key === cfPeriod)?.label || 'Year to Date';

            // Build monthly data buckets covering the period
            const buildMonthlyBuckets = () => {
              const buckets: { year: number; month: number; name: string; fullName: string; spend: number; income: number; net: number; isFuture: boolean; isCurrent: boolean; monthIdx: number }[] = [];
              const cursor = new Date(cfPeriodStart.getFullYear(), cfPeriodStart.getMonth(), 1);
              const endMonth = new Date(cfPeriodEnd.getFullYear(), cfPeriodEnd.getMonth(), 1);
              const now = new Date(todayDateObj.getFullYear(), todayDateObj.getMonth(), 1);

              while (cursor <= endMonth) {
                const yr = cursor.getFullYear();
                const mo = cursor.getMonth();
                const isFuture = cursor > now;
                const isCurrent = yr === now.getFullYear() && mo === now.getMonth();
                const shortName = MONTH_NAMES[mo].slice(0, 3);

                const prefix = `${yr}-${String(mo + 1).padStart(2, '0')}-`;
                const monthSpend = isFuture ? 0 : mockTransactions
                  .filter(tx => tx.date.startsWith(prefix))
                  .reduce((sum, tx) => sum + tx.amount, 0);

                const monthRecurringSpend = isFuture ? 0 : recurrings
                  .filter(r => isDueThisMonth(r, mo + 1))
                  .reduce((sum, r) => sum + r.amount, 0);

                const spend = monthSpend + monthRecurringSpend;
                const income = isFuture ? 0 : cfMonthlyIncome;
                const net = income - spend;

                // For Last 12 months spanning two years, show "Jan '25" style
                const label = cfPeriod === 'last_12m' || cfPeriod === 'last_3m' || cfPeriod === 'custom'
                  ? `${shortName} '${String(yr).slice(2)}`
                  : shortName;

                buckets.push({ year: yr, month: mo, name: label, fullName: MONTH_NAMES[mo], spend, income, net, isFuture, isCurrent, monthIdx: mo });
                cursor.setMonth(cursor.getMonth() + 1);
              }
              return buckets;
            };

            // For dynamic range weekly buckets
            const buildWeeklyBuckets = () => {
              const buckets: { name: string; fullName: string; spend: number; income: number; net: number; isFuture: boolean; isCurrent: boolean; monthIdx: number }[] = [];
              const weekStart = new Date(cfPeriodStart);
              const weeklyIncome = cfMonthlyIncome / 4.33; // approximate weekly income
              let w = 0;

              while (weekStart <= cfPeriodEnd) {
                const wEnd = new Date(weekStart);
                wEnd.setDate(wEnd.getDate() + 6);
                if (wEnd > cfPeriodEnd) wEnd.setTime(cfPeriodEnd.getTime());

                const wStartStr = `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()].slice(0, 3)}`;
                const isCurrent = todayDateObj >= weekStart && todayDateObj <= wEnd;
                const isFuture = weekStart > todayDateObj;

                let spend = 0;
                const cursor = new Date(weekStart);
                while (cursor <= wEnd) {
                  const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
                  spend += mockTransactions
                    .filter(tx => tx.date === dateStr)
                    .reduce((sum, tx) => sum + tx.amount, 0);
                  cursor.setDate(cursor.getDate() + 1);
                }

                // Add proportional recurring spend
                const weekRecurring = recurrings
                  .filter(r => r.frequency === 'monthly' || r.frequency === 'weekly')
                  .reduce((sum, r) => sum + (r.frequency === 'weekly' ? r.amount : r.amount / 4.33), 0);
                spend += weekRecurring;

                const income = isFuture ? 0 : weeklyIncome;
                const net = income - spend;

                buckets.push({ name: `Wk ${w + 1}`, fullName: wStartStr, spend, income, net, isFuture, isCurrent, monthIdx: w });
                weekStart.setDate(weekStart.getDate() + 7);
                w++;
              }
              return buckets;
            };

            const diffDays = Math.ceil((cfPeriodEnd.getTime() - cfPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
            const useWeekly = cfPeriod === 'last_4w' || (cfPeriod === 'custom' && diffDays <= 60);
            const cfMonthlyData = useWeekly ? buildWeeklyBuckets() : buildMonthlyBuckets();

            const activeData = cfMonthlyData.filter(m => !m.isFuture);
            const elapsedMonths = activeData.length;
            const ytdIncome = activeData.reduce((s, m) => s + m.income, 0);
            const ytdSpend = activeData.reduce((s, m) => s + m.spend, 0);
            const ytdNet = ytdIncome - ytdSpend;
            const avgMonthlyNet = elapsedMonths > 0 ? ytdNet / elapsedMonths : 0;
            const savingsRate = ytdIncome > 0 ? ((ytdIncome - ytdSpend) / ytdIncome) * 100 : 0;
            const totalMonthlyRecurrings = recurrings
              .filter(r => r.frequency === 'monthly')
              .reduce((sum, r) => sum + r.amount, 0);
            const recurringBurnRate = cfMonthlyIncome > 0 ? (totalMonthlyRecurrings / cfMonthlyIncome) * 100 : 0;

            // Custom bar shape that renders rounded-top bars
            const RoundedBar = (props: { x?: number; y?: number; width?: number; height?: number; fill?: string; opacity?: number }) => {
              const { x = 0, y = 0, width = 0, height = 0, fill, opacity = 1 } = props;
              if (height <= 0) return null;
              const r = Math.min(4, width / 2, height);
              return (
                <path
                  d={`M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`}
                  fill={fill}
                  opacity={opacity}
                />
              );
            };

            // Custom tick to render "Now" label on current bucket
            const CashFlowXTick = (props: { x?: number; y?: number; payload?: { value: string; index: number } }) => {
              const { x = 0, y = 0, payload } = props;
              if (!payload) return null;
              const dataPoint = cfMonthlyData[payload.index];
              const isCurr = dataPoint?.isCurrent;
              return (
                <g transform={`translate(${x},${y})`}>
                  <text x={0} y={0} dy={12} textAnchor="middle" fill="currentColor" opacity={dataPoint?.isFuture ? 0.25 : 0.5} fontSize={9}>
                    {payload.value}
                  </text>
                  {isCurr && (
                    <g>
                      <rect x={-14} y={18} width={28} height={14} rx={4} fill="hsl(var(--foreground))" opacity={0.9} />
                      <text x={0} y={28} textAnchor="middle" fill="hsl(var(--background))" fontSize={8} fontWeight={700}>Now</text>
                    </g>
                  )}
                </g>
              );
            };

            const cfTooltipStyle = {
              backgroundColor: 'hsl(var(--popover))',
              borderColor: 'hsl(var(--border))',
              borderRadius: '1rem',
              fontSize: '11px',
              padding: '8px 12px',
            };

            return (
            <div className="space-y-6">

              {/* Period Header Row */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
                <div className="min-w-0">
                  <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary shrink-0" /> Cash Flow
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Overview of income, spending, and net position</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Custom Date Picker Popovers */}
                  {cfPeriod === 'custom' && (
                    <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
                      <Popover open={cfStartOpen} onOpenChange={setCfStartOpen}>
                        <PopoverTrigger asChild>
                          <button className="text-[10px] font-mono font-semibold px-3 py-1.5 rounded-full bg-background border border-border/50 text-foreground outline-none hover:border-primary/40 focus:border-primary/50 transition-colors flex items-center gap-1.5 hover:bg-muted/30">
                            <Calendar className="h-3 w-3 text-primary shrink-0" />
                            {fmtDate(cfPeriodStart)}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-50 bg-popover border border-border rounded-2xl shadow-xl" align="end">
                          <MonthYearPicker
                            value={cfCustomStart}
                            onChange={(val) => {
                              setCfCustomStart(val);
                              setCfStartOpen(false);
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                      <span className="text-[10px] text-muted-foreground font-mono">to</span>
                      <Popover open={cfEndOpen} onOpenChange={setCfEndOpen}>
                        <PopoverTrigger asChild>
                          <button className="text-[10px] font-mono font-semibold px-3 py-1.5 rounded-full bg-background border border-border/50 text-foreground outline-none hover:border-primary/40 focus:border-primary/50 transition-colors flex items-center gap-1.5 hover:bg-muted/30">
                            <Calendar className="h-3 w-3 text-primary shrink-0" />
                            {fmtDate(cfPeriodEnd)}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-50 bg-popover border border-border rounded-2xl shadow-xl" align="end">
                          <MonthYearPicker
                            value={cfCustomEnd}
                            onChange={(val) => {
                              setCfCustomEnd(val);
                              setCfEndOpen(false);
                            }}
                            isEnd
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {/* Period Selector Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setCfPeriodOpen(!cfPeriodOpen)}
                      className="text-[10px] font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono flex items-center gap-1.5 hover:bg-primary/20 transition-colors"
                    >
                      {activePeriodLabel}
                      <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", cfPeriodOpen && "rotate-180")} />
                    </button>
                    {cfPeriodOpen && (
                      <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[240px] bg-popover border border-border rounded-2xl shadow-xl p-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                        {CF_PERIOD_OPTIONS.map(opt => {
                          // Compute the date range for each option label
                          const optRange = (() => {
                            const today = new Date(todayDateObj);
                            today.setHours(0, 0, 0, 0);
                            switch (opt.key) {
                              case 'ytd': return { s: new Date(cfYear, 0, 1), e: today };
                              case 'mtd': return { s: new Date(cfYear, cfCurrentMonthIdx, 1), e: today };
                              case 'last_12m': { const d = new Date(today); d.setMonth(d.getMonth() - 11); d.setDate(1); return { s: d, e: today }; }
                              case 'last_3m': { const d = new Date(today); d.setMonth(d.getMonth() - 2); d.setDate(1); return { s: d, e: today }; }
                              case 'last_4w': { const d = new Date(today); d.setDate(d.getDate() - 27); return { s: d, e: today }; }
                              case 'custom': return { s: new Date(cfCustomStart), e: new Date(cfCustomEnd) };
                              default: return { s: new Date(cfYear, 0, 1), e: today };
                            }
                          })();
                          const rangeStr = `${fmtDate(optRange.s)} - ${fmtDate(optRange.e)}`;
                          const isActive = cfPeriod === opt.key;
                          return (
                            <button
                              key={opt.key}
                              onClick={() => { setCfPeriod(opt.key); setCfPeriodOpen(false); }}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-3 transition-colors",
                                isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground"
                              )}
                            >
                              <span className="flex items-center gap-2">
                                {isActive && <Check className="h-3 w-3 text-primary shrink-0" />}
                                <span className={cn("font-semibold", !isActive && "ml-5")}>{opt.label}</span>
                              </span>
                              <span className="text-[9px] text-muted-foreground font-mono shrink-0">{rangeStr}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                    {periodStartLabel} – {periodEndLabel}
                  </span>
                </div>
              </div>

              {/* ─── NET INCOME HERO CARD ─── */}
              <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Income</span>
                    <p className="text-[10px] text-muted-foreground">{periodStartLabel} – {periodEndLabel}</p>
                    <p className={cn("text-3xl font-extrabold font-mono", ytdNet >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {formatGBP(ytdNet)}
                    </p>
                  </div>
                </div>

                <div className="h-[220px] sm:h-[280px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cfMonthlyData} margin={{ top: 10, right: 4, left: -16, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={(props) => <CashFlowXTick {...props} />}
                        interval={0}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `£${v >= 0 ? '' : '-'}${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(1)}K` : Math.abs(v)}`}
                        tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 9 }}
                      />
                      <RechartsTooltip
                        contentStyle={cfTooltipStyle}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                        labelStyle={{ fontWeight: 'bold' }}
                        formatter={(value: number) => [formatGBP(value), 'Net Income']}
                      />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
                      <Bar
                        dataKey="net"
                        shape={(props: Record<string, unknown>) => {
                          const dataPoint = cfMonthlyData[(props as { index: number }).index];
                          const val = (props as { value?: number }).value ?? (props as { net?: number }).net ?? 0;
                          return (
                            <RoundedBar
                              {...props as { x: number; y: number; width: number; height: number }}
                              fill={val >= 0 ? '#10b981' : '#f43f5e'}
                              opacity={dataPoint?.isFuture ? 0.15 : 1}
                            />
                          );
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* ─── SPEND + INCOME SIDE-BY-SIDE ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Spend Card */}
                <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl">
                  <div className="space-y-1 mb-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Spend</span>
                    <p className="text-[10px] text-muted-foreground">{periodStartLabel} – {periodEndLabel}</p>
                    <p className="text-2xl font-extrabold font-mono text-rose-500">{formatGBP(ytdSpend)}</p>
                  </div>
                  <div className="h-[180px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cfMonthlyData} margin={{ top: 5, right: 4, left: -20, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                          tick={(props) => <CashFlowXTick {...props} />}
                          interval={0}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `£${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`}
                          tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 9 }}
                        />
                        <RechartsTooltip
                          contentStyle={cfTooltipStyle}
                          itemStyle={{ color: 'hsl(var(--foreground))' }}
                          formatter={(value: number) => [formatGBP(value), 'Spend']}
                        />
                        <Bar
                          dataKey="spend"
                          shape={(props: Record<string, unknown>) => {
                            const dataPoint = cfMonthlyData[(props as { index: number }).index];
                            return (
                              <RoundedBar
                                {...props as { x: number; y: number; width: number; height: number }}
                                fill="#f43f5e"
                                opacity={dataPoint?.isFuture ? 0.15 : 0.85}
                              />
                            );
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Income Card */}
                <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl">
                  <div className="space-y-1 mb-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Income</span>
                    <p className="text-[10px] text-muted-foreground">{periodStartLabel} – {periodEndLabel}</p>
                    <p className="text-2xl font-extrabold font-mono text-cyan-500">{formatGBP(ytdIncome)}</p>
                  </div>
                  <div className="h-[180px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cfMonthlyData} margin={{ top: 5, right: 4, left: -20, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                          tick={(props) => <CashFlowXTick {...props} />}
                          interval={0}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `£${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`}
                          tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 9 }}
                        />
                        <RechartsTooltip
                          contentStyle={cfTooltipStyle}
                          itemStyle={{ color: 'hsl(var(--foreground))' }}
                          formatter={(value: number) => [formatGBP(value), 'Income']}
                        />
                        <Bar
                          dataKey="income"
                          shape={(props: Record<string, unknown>) => {
                            const dataPoint = cfMonthlyData[(props as { index: number }).index];
                            return (
                              <RoundedBar
                                {...props as { x: number; y: number; width: number; height: number }}
                                fill="#06b6d4"
                                opacity={dataPoint?.isFuture ? 0.15 : 0.85}
                              />
                            );
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

              </div>

              {/* ─── METRIC SUMMARY ROW ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-lg p-4 sm:p-5 rounded-3xl space-y-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Avg Monthly Net</span>
                  <span className={cn("text-xl font-extrabold font-mono block", avgMonthlyNet >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {formatGBP(avgMonthlyNet)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">across {elapsedMonths} month{elapsedMonths !== 1 ? 's' : ''}</span>
                </Card>

                <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-lg p-4 sm:p-5 rounded-3xl space-y-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Savings Rate</span>
                  <span className={cn("text-xl font-extrabold font-mono block", savingsRate >= 20 ? "text-emerald-500" : savingsRate >= 0 ? "text-amber-500" : "text-rose-500")}>
                    {savingsRate.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground">of income retained YTD</span>
                </Card>

                <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-lg p-4 sm:p-5 rounded-3xl space-y-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Recurring Burn</span>
                  <span className={cn("text-xl font-extrabold font-mono block", recurringBurnRate <= 30 ? "text-emerald-500" : recurringBurnRate <= 50 ? "text-amber-500" : "text-rose-500")}>
                    {recurringBurnRate.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground">{formatGBP(totalMonthlyRecurrings)} / {formatGBP(cfMonthlyIncome)} monthly</span>
                </Card>
              </div>

            </div>
            );
          })()}

          {/* ==========================================
              TAB 5: GOALS
              ========================================== */}
          {activeTab === 'goals' && (
            <div className="space-y-6">

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
                <div className="min-w-0">
                  <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
                    <PiggyBank className="h-5 w-5 text-primary shrink-0" /> Savings Goals & Contributions
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Manage financial milestones and track contribution deposits manually</p>
                </div>
                <Button onClick={() => setIsAddGoalOpen(true)} className="rounded-xl gap-1.5 bg-primary text-primary-foreground shrink-0 self-start sm:self-auto">
                  <Plus className="h-4 w-4" /> Add Goal
                </Button>
              </div>

              {/* Sidebar list + Details layout */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                {/* Left side: Goal List sidebar */}
                <div className="md:col-span-5 space-y-3">
                  {goals.map(goal => {
                    const isActiveGoal = goal.id === selectedGoalId;
                    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

                    return (
                      <div
                        key={goal.id}
                        onClick={() => setSelectedGoalId(isActiveGoal ? null : goal.id)}
                        className={cn(
                          "p-4 rounded-3xl border cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-3",
                          isActiveGoal
                            ? "bg-primary/5 border-primary shadow-sm"
                            : "bg-card/40 border-border/30 hover:bg-muted/30"
                        )}
                      >
                        <div className="flex justify-between items-start gap-2 min-w-0">
                          <span className="text-xs font-bold font-serif text-foreground truncate">{goal.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">{formatReadableDate(goal.targetDate)}</span>
                        </div>
                        <div className="space-y-1.5 text-[10px]">
                          <div className="flex justify-between items-baseline">
                            <span className="text-muted-foreground">
                              <span className="font-bold text-foreground font-mono">{formatGBP(goal.currentAmount)}</span>
                              <span> of </span>
                              <span className="font-mono">{formatGBP(goal.targetAmount)}</span>
                            </span>
                            <span className="font-bold text-emerald-500 font-mono text-[11px]">{progress.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {goals.length === 0 && (
                    <p className="text-xs text-muted-foreground italic text-center py-8">No savings goals created yet.</p>
                  )}
                </div>

                {/* Right side: Selected Goal Details Panel */}
                <div className="md:col-span-7">
                  {(() => {
                    const goal = goals.find(g => g.id === selectedGoalId);
                    if (!goal) return <p className="text-xs text-muted-foreground italic text-center py-8">Select a goal from the list to view its details.</p>;

                    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

                    const sortedContributions = [...(goal.contributions || [])].sort((a, b) => a.date.localeCompare(b.date));
                    const startD = goal.startDate || (sortedContributions[0] ? sortedContributions[0].date : new Date().toISOString().split('T')[0]);

                    let currentTotal = 0;
                    const chartData = [{
                      date: startD,
                      amount: 0,
                      formattedDate: formatReadableDate(startD)
                    }];

                    sortedContributions.forEach(c => {
                      currentTotal += c.amount;
                      chartData.push({
                        date: c.date,
                        amount: currentTotal,
                        formattedDate: formatReadableDate(c.date)
                      });
                    });

                    const todayStr = new Date().toISOString().split('T')[0];
                    if (chartData[chartData.length - 1].date < todayStr) {
                      chartData.push({
                        date: todayStr,
                        amount: currentTotal,
                        formattedDate: formatReadableDate(todayStr)
                      });
                    }

                    return (
                      <Card className="bg-card/40 border border-primary/10 rounded-3xl p-6 space-y-6">

                        {/* Title Block */}
                        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start border-b border-border/30 pb-4">
                          <div className="space-y-1 min-w-0">
                            <span className="text-xl md:text-2xl font-bold font-serif text-foreground block break-words">{goal.name}</span>
                            <span className="text-xs text-muted-foreground block">Timeline: {formatReadableDate(startD)} – {formatReadableDate(goal.targetDate)}</span>
                          </div>
                          <div className="flex items-start justify-between md:justify-end gap-4 shrink-0">
                            <div className="text-right">
                              <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Saved</span>
                              <span className="text-xl font-bold text-emerald-500 font-mono block">{formatGBP(goal.currentAmount)}</span>
                              <span className="text-[10px] text-emerald-500/80 font-medium block mt-0.5">
                                {progress >= 100 ? "Goal achieved!" : `${progress.toFixed(0)}% complete`}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteGoal(goal.id)}
                              className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Chart: Progress Over Time */}
                        <div className="h-44 w-full bg-muted/5 rounded-2xl border border-border/10 p-2 min-w-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                              <defs>
                                <linearGradient id="goalProgressGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                              <XAxis
                                dataKey="formattedDate"
                                tickLine={false}
                                axisLine={false}
                                interval="preserveStartEnd"
                                tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 9 }}
                              />
                              <YAxis
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v) => `£${v}`}
                                tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 9 }}
                              />
                              <RechartsTooltip
                                formatter={(value: number) => [formatGBP(value), 'Saved']}
                                labelFormatter={(label) => `Date: ${label}`}
                                contentStyle={{
                                  backgroundColor: 'rgba(30, 30, 46, 0.9)',
                                  borderColor: 'rgba(255, 255, 255, 0.1)',
                                  borderRadius: '16px',
                                  fontSize: '11px',
                                  color: '#cdd6f4'
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="amount"
                                stroke="#10b981"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#goalProgressGrad)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Summary Block */}
                        <div className="pt-2">
                          <span className="text-xs font-bold text-foreground block mb-3">Summary</span>
                          <div className="space-y-2.5 text-xs">
                            <div className="flex justify-between border-b border-border/20 pb-1.5">
                              <span className="text-muted-foreground">Goal amount</span>
                              <span className="font-bold font-mono text-foreground">{formatGBP(goal.targetAmount)}</span>
                            </div>
                            <div className="flex justify-between border-b border-border/20 pb-1.5">
                              <span className="text-muted-foreground">Start date</span>
                              <span className="font-medium text-foreground">{formatReadableDate(startD)}</span>
                            </div>
                            <div className="flex justify-between border-b border-border/20 pb-1.5">
                              <span className="text-muted-foreground">Target date</span>
                              <span className="font-medium text-foreground">{formatReadableDate(goal.targetDate)}</span>
                            </div>
                            <div className="flex justify-between pb-1">
                              <span className="text-muted-foreground">Saving mode</span>
                              <span className="font-medium text-foreground">Target date</span>
                            </div>
                          </div>
                        </div>

                        {/* Contribution Logging Form */}
                        <form onSubmit={(e) => handleAddContribution(e, goal.id)} className="space-y-3 pt-2">
                          <span className="text-xs font-bold text-foreground">Log New Contribution</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            <Input
                              type="number"
                              placeholder="Amount (£)"
                              value={newContribution.amount || ''}
                              onChange={(e) => setNewContribution({ ...newContribution, amount: parseFloat(e.target.value) || 0 })}
                              className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs"
                              required
                            />
                            <Input
                              type="text"
                              placeholder="Note / Source"
                              value={newContribution.note}
                              onChange={(e) => setNewContribution({ ...newContribution, note: e.target.value })}
                              className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs"
                            />
                            <select
                              value={newContribution.bankAccountId || ''}
                              onChange={(e) => setNewContribution({ ...newContribution, bankAccountId: e.target.value })}
                              className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                            >
                              <option value="">No linked account (Manual)</option>
                              {bankAccounts.map(acc => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.name} ({acc.type} - {formatGBP(acc.balance)})
                                </option>
                              ))}
                            </select>
                            <Button type="submit" className="rounded-xl h-10 bg-primary text-primary-foreground font-medium text-xs">
                              Add Contribution
                            </Button>
                          </div>
                        </form>

                        {/* Contributions List */}
                        <div className="space-y-3 pt-4 border-t border-border/30">
                          <span className="text-xs font-bold text-foreground">Contribution Ledger</span>
                          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                            {goal.contributions.map(c => {
                              const acc = c.bankAccountId ? bankAccounts.find(a => a.id === c.bankAccountId) : null;
                              return (
                                <div key={c.id} className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center p-3 rounded-2xl bg-muted/10 border border-border/20 text-xs">
                                  <div className="space-y-0.5 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-bold font-mono">{formatGBP(c.amount)}</span>
                                      {acc && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-medium">
                                          {acc.name}
                                        </span>
                                      )}
                                    </div>
                                    {c.note && <span className="text-[10px] text-muted-foreground block">"{c.note}"</span>}
                                    <span className="text-[9px] text-muted-foreground/60 block font-mono">{c.date}</span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteContribution(goal.id, c.id)}
                                    className="h-7 w-7 text-rose-500 hover:text-rose-600 shrink-0 self-end sm:self-center"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              );
                            })}
                            {goal.contributions.length === 0 && (
                              <p className="text-[11px] text-muted-foreground italic text-center py-4">No contributions logged yet.</p>
                            )}
                          </div>
                        </div>

                      </Card>
                    );
                  })()}
                </div>

              </div>

            </div>
          )}

          {/* ==========================================
              TAB 6: ACCOUNTS
              ========================================== */}
          {activeTab === 'accounts' && (
            <div className="space-y-8">

              {/* SECTION A: Bank Accounts */}
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
                  <div className="min-w-0">
                    <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary shrink-0" /> Bank Accounts & Credit Cards
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Monitor current balances, card products, and credit accounts</p>
                  </div>
                  <Button onClick={() => setIsAddAccountOpen(true)} className="rounded-xl gap-1.5 bg-primary text-primary-foreground shrink-0 self-start sm:self-auto">
                    <Plus className="h-4 w-4" /> Add Account
                  </Button>
                </div>

                <div className="overflow-x-auto bg-card/40 border border-primary/10 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-sm -mx-0">
                  <table className="min-w-[720px] w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/40 text-muted-foreground uppercase tracking-wider font-semibold">
                        <th className="py-3 px-3 whitespace-nowrap">Name</th>
                        <th className="py-3 px-3 whitespace-nowrap">Type</th>
                        <th className="py-3 px-3 whitespace-nowrap">Issuer</th>
                        <th className="py-3 px-3 text-right whitespace-nowrap">Balance</th>
                        <th className="py-3 px-3 text-right whitespace-nowrap">Annual Fee</th>
                        <th className="py-3 px-3 whitespace-nowrap">Use Case</th>
                        <th className="py-3 px-3 text-center whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {bankAccounts.map(account => (
                        <tr key={account.id} className="hover:bg-muted/10 transition-colors">
                          <td className="py-3 px-3 font-semibold text-foreground flex items-center gap-2">
                            <span
                              className="w-1.5 h-6 rounded-full shrink-0"
                              style={{ backgroundColor: account.color || '#475569' }}
                            />
                            <span className="text-base shrink-0 leading-none">{account.emoji || '💰'}</span>
                            <span>{account.name}</span>
                          </td>
                          <td className="py-3 px-3 capitalize">{account.type}</td>
                          <td className="py-3 px-3">{account.issuer}</td>
                          <td className={cn("py-3 px-3 text-right font-mono font-bold", account.balance >= 0 ? "text-emerald-500" : "text-rose-500")}>
                            {formatGBP(account.balance)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">{formatGBP(account.annualFee)}</td>
                          <td className="py-3 px-3 text-muted-foreground truncate max-w-[150px]">{account.useCase || '—'}</td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setActiveAccount(account);
                                  setIsEditAccountOpen(true);
                                }}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteAccount(account.id)}
                                className="h-8 w-8 text-rose-500 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {bankAccounts.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-6 italic text-muted-foreground">No bank accounts added.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION B: Memberships & Rewards */}
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
                  <div className="min-w-0">
                    <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary shrink-0" /> Memberships & Reward Programs
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Keep track of reward accounts, points programs, and loyalty systems</p>
                  </div>
                  <Button onClick={() => setIsAddMembershipOpen(true)} className="rounded-xl gap-1.5 bg-primary text-primary-foreground shrink-0 self-start sm:self-auto">
                    <Plus className="h-4 w-4" /> Add Membership
                  </Button>
                </div>

                <div className="overflow-x-auto bg-card/40 border border-primary/10 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-sm">
                  <table className="min-w-[640px] w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/40 text-muted-foreground uppercase tracking-wider font-semibold">
                        <th className="py-3 px-3 whitespace-nowrap">Name</th>
                        <th className="py-3 px-3 whitespace-nowrap">Type</th>
                        <th className="py-3 px-3 whitespace-nowrap">Status / Points</th>
                        <th className="py-3 px-3 text-right whitespace-nowrap">Annual Fee</th>
                        <th className="py-3 px-3 whitespace-nowrap">Use Case</th>
                        <th className="py-3 px-3 text-center whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {memberships.map(membership => (
                        <tr key={membership.id} className="hover:bg-muted/10 transition-colors">
                          <td className="py-3 px-3 font-semibold text-foreground">{membership.name}</td>
                          <td className="py-3 px-3 capitalize">{membership.type}</td>
                          <td className="py-3 px-3">{membership.status}</td>
                          <td className="py-3 px-3 text-right font-mono">{formatGBP(membership.annualFee)}</td>
                          <td className="py-3 px-3 text-muted-foreground truncate max-w-[200px]">{membership.useCase || '—'}</td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setActiveMembership(membership);
                                  setIsEditMembershipOpen(true);
                                }}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteMembership(membership.id)}
                                className="h-8 w-8 text-rose-500 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {memberships.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-6 italic text-muted-foreground">No reward memberships added.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION C: Credit Reports */}
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
                  <div className="min-w-0">
                    <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-primary shrink-0" /> Credit Reports
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Track your credit scores across all three bureaus over time</p>
                  </div>
                  <Button onClick={() => setIsAddCreditScoreOpen(true)} className="rounded-xl gap-1.5 bg-primary text-primary-foreground shrink-0 self-start sm:self-auto">
                    <Plus className="h-4 w-4" /> Log Score
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {creditBureaus.map(bureau => {
                    const entries = creditScores[bureau.key];
                    const latest = entries.length > 0 ? entries[entries.length - 1] : null;
                    const prev = entries.length > 1 ? entries[entries.length - 2] : null;
                    const delta = latest && prev ? latest.score - prev.score : 0;
                    const pct = latest ? Math.min((latest.score / bureau.maxScore) * 100, 100) : 0;

                    const gaugeRadius = 58;
                    const gaugeCircumference = 2 * Math.PI * gaugeRadius;
                    const gaugeOffset = gaugeCircumference - (pct / 100) * gaugeCircumference;

                    const getRating = (score: number, key: string) => {
                      if (key === 'experian') {
                        if (score >= 1121) return { text: 'Excellent', cls: 'text-emerald-500' };
                        if (score >= 1001) return { text: 'Very Good', cls: 'text-teal-500' };
                        if (score >= 861) return { text: 'Good', cls: 'text-cyan-500' };
                        if (score >= 641) return { text: 'Fair', cls: 'text-amber-500' };
                        return { text: 'Low', cls: 'text-rose-500' };
                      }
                      if (key === 'transunion') {
                        if (score >= 628) return { text: 'Excellent', cls: 'text-emerald-500' };
                        if (score >= 604) return { text: 'Good', cls: 'text-cyan-500' };
                        if (score >= 566) return { text: 'Fair', cls: 'text-amber-500' };
                        return { text: 'Needs Work', cls: 'text-rose-500' };
                      }
                      if (key === 'equifax') {
                        if (score >= 725) return { text: 'Soaring High', cls: 'text-emerald-500' };
                        if (score >= 605) return { text: 'Looking Bright', cls: 'text-teal-500' };
                        if (score >= 520) return { text: 'On Good Ground', cls: 'text-cyan-500' };
                        if (score >= 410) return { text: 'Moving On Up', cls: 'text-amber-500' };
                        return { text: 'Start Climbing', cls: 'text-rose-500' };
                      }
                      const ratio = score / bureau.maxScore;
                      if (ratio >= 0.8) return { text: 'Excellent', cls: 'text-emerald-500' };
                      if (ratio >= 0.6) return { text: 'Good', cls: 'text-cyan-500' };
                      if (ratio >= 0.4) return { text: 'Fair', cls: 'text-amber-500' };
                      return { text: 'Poor', cls: 'text-rose-500' };
                    };
                    const rating = latest ? getRating(latest.score, bureau.key) : null;

                    return (
                      <Card key={bureau.key} className={cn("bg-gradient-to-br border border-primary/10 rounded-[2rem] overflow-hidden", bureau.gradient)}>
                        <CardContent className="pt-6 pb-2 px-6 flex flex-col items-center">
                          {/* Bureau Label */}
                          <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-4">{bureau.label}</span>

                          {/* Circular Gauge */}
                          <div className="relative w-36 h-36 flex items-center justify-center">
                            <svg className="w-36 h-36 transform -rotate-90">
                              {/* Background track */}
                              <circle
                                cx="72"
                                cy="72"
                                r={gaugeRadius}
                                stroke="currentColor"
                                className="text-primary/10"
                                strokeWidth="10"
                                fill="transparent"
                              />
                              {/* Score arc */}
                              <circle
                                cx="72"
                                cy="72"
                                r={gaugeRadius}
                                stroke={bureau.color}
                                strokeWidth="10"
                                fill="transparent"
                                strokeDasharray={gaugeCircumference}
                                strokeDashoffset={latest ? gaugeOffset : gaugeCircumference}
                                strokeLinecap="round"
                                className="transition-all duration-700 ease-out"
                              />
                            </svg>
                            {/* Center text */}
                            <div className="absolute flex flex-col items-center justify-center">
                              <span className="font-mono text-3xl font-extrabold" style={{ color: bureau.color }}>
                                {latest ? latest.score : '—'}
                              </span>
                              <span className="text-[9px] text-muted-foreground font-medium">of {bureau.maxScore}</span>
                            </div>
                          </div>

                          {/* Rating + Delta */}
                          <div className="flex items-center gap-3 mt-3 mb-1">
                            {rating && (
                              <span className={cn("text-xs font-bold", rating.cls)}>{rating.text}</span>
                            )}
                            {delta !== 0 && (
                              <span className={cn("text-xs font-bold font-mono flex items-center gap-0.5", delta > 0 ? "text-emerald-500" : "text-rose-500")}>
                                {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {delta > 0 ? '+' : ''}{delta}
                              </span>
                            )}
                          </div>
                          {latest && (
                            <span className="text-[10px] text-muted-foreground">Last checked: {latest.date}</span>
                          )}
                        </CardContent>

                        {/* Score history list */}
                        {entries.length > 0 && (
                          <div className="px-6 pb-5 pt-2">
                            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">History</div>
                            <div className="space-y-1 max-h-[120px] overflow-y-auto">
                              {[...entries].reverse().map(entry => (
                                <div key={entry.id} className="group flex items-center justify-between py-1 border-b border-border/10 last:border-b-0">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground font-mono w-20">{entry.date}</span>
                                    <span className="text-xs font-mono font-bold" style={{ color: bureau.color }}>{entry.score}</span>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteCreditScore(bureau.key, entry.id)}
                                    className="text-rose-500 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ==========================================
              TAB 7: RECURRINGS
              ========================================== */}
          {activeTab === 'recurrings' && (() => {
            const getTagColor = (category: string | undefined) => {
              switch (category?.toLowerCase()) {
                case 'rent':
                  return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
                case 'subscriptions':
                case 'video entertainment':
                  return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
                case 'gym':
                  return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
                case 'donations':
                  return 'bg-orange-500/10 text-orange-500 border border-orange-500/20';
                case 'insurance':
                  return 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20';
                case 'groceries':
                case 'needs':
                  return 'bg-teal-500/10 text-teal-500 border border-teal-500/20';
                default:
                  return 'bg-muted/30 text-muted-foreground border border-border/30';
              }
            };

            const thisMonthBills = recurrings.filter(r => isDueThisMonth(r, currentMonth));
            const futureBills = recurrings.filter(r => !isDueThisMonth(r, currentMonth));

            const totalAmount = thisMonthBills.reduce((sum, r) => sum + r.amount, 0);
            const paidAmount = thisMonthBills.filter(r => r.isPaid).reduce((sum, r) => sum + r.amount, 0);
            const leftAmount = Math.max(0, totalAmount - paidAmount);
            const progress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

            const radius = 36;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset = circumference - (progress / 100) * circumference;

            return (
              <div className="space-y-6">

                {/* Recurrings Title Header with [+] button */}
                <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                  <h3 className="font-serif text-lg font-semibold text-foreground">
                    Recurrings
                  </h3>
                  <button
                    onClick={() => {
                      setIsAddRecurringOpen(true);
                      setAddRecTemplate("scratch");
                    }}
                    className="h-7 w-7 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center text-foreground transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-8">

                  {/* Circular progress card */}
                  <div className="bg-card/20 backdrop-blur-sm border border-primary/10 rounded-[2rem] p-6 md:p-8 flex flex-col sm:flex-row items-center justify-around gap-6">
                    <div className="text-center sm:text-left space-y-1">
                      <span className="text-3xl md:text-4xl font-extrabold font-mono text-foreground block">
                        {formatGBP(leftAmount)}
                      </span>
                      <span className="text-[10px] text-muted-foreground block font-sans font-medium uppercase tracking-wider">
                        left to pay
                      </span>
                    </div>

                    <div className="relative w-24 h-24 flex items-center justify-center">
                      <svg className="w-24 h-24 transform -rotate-90">
                        <circle
                          cx="48"
                          cy="48"
                          r={radius}
                          className="stroke-primary/10"
                          strokeWidth="8"
                          fill="transparent"
                        />
                        <circle
                          cx="48"
                          cy="48"
                          r={radius}
                          className="stroke-[#1d70b8] transition-all duration-500 ease-out"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    <div className="text-center sm:text-right space-y-1">
                      <span className="text-3xl md:text-4xl font-extrabold font-mono text-foreground block">
                        {formatGBP(paidAmount)}
                      </span>
                      <span className="text-[10px] text-muted-foreground block font-sans font-medium uppercase tracking-wider">
                        paid so far
                      </span>
                    </div>
                  </div>

                  {/* Grouped Lists */}
                  <div className="space-y-8">

                    {/* Section: This Month */}
                    <div className="space-y-3">
                      <button
                        onClick={() => setThisMonthCollapsed(!thisMonthCollapsed)}
                        className="flex items-center gap-2 text-sm font-bold text-foreground tracking-wide px-1 hover:text-primary transition-colors outline-none"
                      >
                        <span className="text-[10px] text-muted-foreground transition-transform duration-200">
                          {thisMonthCollapsed ? '▶' : '▼'}
                        </span>
                        This month
                      </button>

                      {!thisMonthCollapsed && (
                        <div className="space-y-1 px-1">
                          {thisMonthBills
                            .sort((a, b) => a.dueDate - b.dueDate)
                            .map(bill => {
                              const dueDateText = getDueDateText(bill, currentMonth);
                              return (
                                <div
                                  key={bill.id}
                                  className={cn(
                                    "group flex items-center justify-between py-2 border-b border-border/5 last:border-b-0 transition-opacity",
                                    bill.isPaid && "opacity-60"
                                  )}
                                >
                                  {/* Left side: Date, Emoji + Subscription Name, Frequency */}
                                  <div className="flex items-center gap-6 min-w-0 flex-1">
                                    <span className="shrink-0 w-16 text-muted-foreground/60 font-mono text-[11px]">
                                      {dueDateText}
                                    </span>
                                    <div className="flex items-center gap-2 min-w-0">
                                      {bill.emoji && <span className="shrink-0 text-sm">{bill.emoji}</span>}
                                      <span className={cn("font-semibold text-xs text-foreground truncate", bill.isPaid && "line-through text-muted-foreground")}>
                                        {bill.name}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground/50 lowercase font-normal shrink-0">
                                        {bill.frequency}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Right side: Pill Badge, Price, Paid Status */}
                                  <div className="flex items-center gap-3 shrink-0">
                                    {/* Action Edit/Delete Overlay */}
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex mr-2">
                                      <button
                                        onClick={() => {
                                          setActiveRecurring(bill);
                                          setIsEditRecurringOpen(true);
                                        }}
                                        className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                                        title="Edit"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteRecurring(bill.id)}
                                        className="text-rose-500 hover:text-rose-600 p-1 transition-colors"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>

                                    {/* Pill Badge */}
                                    <span className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase font-mono shadow-sm flex items-center gap-1", getTagColor(bill.category))}>
                                      {bill.emoji && <span>{bill.emoji}</span>}
                                      {bill.tag || bill.category || 'BILL'}
                                    </span>

                                    {/* Price */}
                                    <span className="font-mono font-bold text-xs text-foreground w-20 text-right">
                                      {formatGBP(bill.amount)}
                                    </span>

                                    {/* Checkmark paid status */}
                                    <button
                                      onClick={() => toggleRecurringPaid(bill.id)}
                                      className={cn(
                                        "h-5 w-5 rounded-lg flex items-center justify-center border transition-all shrink-0",
                                        bill.isPaid
                                          ? "bg-transparent border-transparent text-foreground font-bold"
                                          : "border-border/40 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-transparent hover:text-emerald-500/70"
                                      )}
                                    >
                                      <Check className="h-3.5 w-3.5 font-bold" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                          {thisMonthBills.length === 0 && (
                            <p className="text-xs text-muted-foreground italic py-6 text-center">No bills due this month.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Section: In the Future */}
                    <div className="space-y-3">
                      <button
                        onClick={() => setFutureCollapsed(!futureCollapsed)}
                        className="flex items-center gap-2 text-sm font-bold text-foreground tracking-wide px-1 hover:text-primary transition-colors outline-none"
                      >
                        <span className="text-[10px] text-muted-foreground transition-transform duration-200">
                          {futureCollapsed ? '▶' : '▼'}
                        </span>
                        In the future
                      </button>

                      {!futureCollapsed && (
                        <div className="space-y-1 px-1">
                          {futureBills
                            .sort((a, b) => {
                              const mDiff = (a.dueMonth || 1) - (b.dueMonth || 1);
                              if (mDiff !== 0) return mDiff;
                              return a.dueDate - b.dueDate;
                            })
                            .map(bill => {
                              const dueDateText = getDueDateText(bill, currentMonth);
                              return (
                                <div
                                  key={bill.id}
                                  className="group flex items-center justify-between py-2 border-b border-border/5 last:border-b-0"
                                >
                                  {/* Left side: Date, Emoji + Subscription Name, Frequency */}
                                  <div className="flex items-center gap-6 min-w-0 flex-1">
                                    <span className="shrink-0 w-16 text-muted-foreground/60 font-mono text-[11px]">
                                      {dueDateText}
                                    </span>
                                    <div className="flex items-center gap-2 min-w-0">
                                      {bill.emoji && <span className="shrink-0 text-sm">{bill.emoji}</span>}
                                      <span className="font-semibold text-xs text-foreground truncate">
                                        {bill.name}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground/50 lowercase font-normal shrink-0">
                                        {bill.frequency}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Right side: Pill Badge, Price, Empty spacer */}
                                  <div className="flex items-center gap-3 shrink-0">
                                    {/* Action Edit/Delete Overlay */}
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex mr-2">
                                      <button
                                        onClick={() => {
                                          setActiveRecurring(bill);
                                          setIsEditRecurringOpen(true);
                                        }}
                                        className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                                        title="Edit"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteRecurring(bill.id)}
                                        className="text-rose-500 hover:text-rose-600 p-1 transition-colors"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>

                                    {/* Pill Badge */}
                                    <span className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase font-mono shadow-sm flex items-center gap-1", getTagColor(bill.category))}>
                                      {bill.emoji && <span>{bill.emoji}</span>}
                                      {bill.tag || bill.category || 'BILL'}
                                    </span>

                                    {/* Price */}
                                    <span className="font-mono font-bold text-xs text-foreground w-20 text-right">
                                      {formatGBP(bill.amount)}
                                    </span>

                                    {/* Empty spacer to align with checkmark */}
                                    <div className="w-5" />
                                  </div>
                                </div>
                              );
                            })}

                          {futureBills.length === 0 && (
                            <p className="text-xs text-muted-foreground italic py-6 text-center">No future bills scheduled.</p>
                          )}
                        </div>
                      )}
                    </div>

                  </div>

                </div>

              </div>
            );
          })()}

        </main>

        <Footer />
      </div>

      {/* ==========================================
          DIALOGS & DIALOG FORMS
          ========================================== */}

      {/* DIALOG: Tax & Income Settings */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="!flex !flex-col rounded-3xl border-primary/10 w-[calc(100vw-1.5rem)] sm:w-full max-w-2xl lg:max-w-3xl max-h-[90dvh] gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-border/40 text-left shrink-0">
            <DialogTitle className="font-serif text-xl">Tax & Income Settings</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Salary, pension, tax code, and working day parameters.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveSettings} className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-8">
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Salary & Pension</h3>
                    <p className="text-[11px] text-muted-foreground">Core income and contribution settings</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="grossSalary" className="text-xs font-medium text-muted-foreground">Annual gross salary</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
                      <Input
                        id="grossSalary"
                        type="text"
                        inputMode="decimal"
                        value={grossInput}
                        onChange={(e) => setGrossInput(formatNumberInput(e.target.value))}
                        className="rounded-xl h-11 pl-7 border-primary/20 bg-background/50 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="paydaySchedule" className="text-xs font-medium text-muted-foreground">Payday Schedule</Label>
                    <Select
                      value={paydaySchedule}
                      onValueChange={(val) => setPaydaySchedule(val as FinanceSettings['paydaySchedule'])}
                    >
                      <SelectTrigger id="paydaySchedule" className="rounded-xl h-11 border-primary/20 bg-background/50">
                        <SelectValue placeholder="Select schedule..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-primary/10">
                        <SelectItem value="monthly_date">Monthly on specific date</SelectItem>
                        <SelectItem value="last_working_day">Last working day of month</SelectItem>
                        <SelectItem value="last_friday">Last Friday of month</SelectItem>
                        <SelectItem value="biweekly">Every 2 weeks (Bi-weekly)</SelectItem>
                        <SelectItem value="weekly">Every week (Weekly)</SelectItem>
                        <SelectItem value="semimonthly">Semi-monthly (15th & Last working day)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {paydaySchedule === 'monthly_date' && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      <Label htmlFor="payDay" className="text-xs font-medium text-muted-foreground">Scheduled Payday (Day of Month)</Label>
                      <Input
                        id="payDay"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="31"
                        value={payDayInput}
                        onChange={(e) => setPayDayInput(e.target.value)}
                        className="rounded-xl h-11 border-primary/20 bg-background/50 font-mono"
                        required
                      />
                    </div>
                  )}

                  {paydaySchedule === 'weekly' && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      <Label htmlFor="paydayWeekday" className="text-xs font-medium text-muted-foreground">Weekly Payday</Label>
                      <Select
                        value={paydayWeekday.toString()}
                        onValueChange={(val) => setPaydayWeekday(parseInt(val, 10))}
                      >
                        <SelectTrigger id="paydayWeekday" className="rounded-xl h-11 border-primary/20 bg-background/50">
                          <SelectValue placeholder="Select day..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-primary/10">
                          <SelectItem value="1">Monday</SelectItem>
                          <SelectItem value="2">Tuesday</SelectItem>
                          <SelectItem value="3">Wednesday</SelectItem>
                          <SelectItem value="4">Thursday</SelectItem>
                          <SelectItem value="5">Friday</SelectItem>
                          <SelectItem value="6">Saturday</SelectItem>
                          <SelectItem value="0">Sunday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {paydaySchedule === 'biweekly' && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      <Label htmlFor="paydayBiweeklyAnchor" className="text-xs font-medium text-muted-foreground">Bi-weekly Reference Payday (Anchor Date)</Label>
                      <Input
                        id="paydayBiweeklyAnchor"
                        type="date"
                        value={paydayBiweeklyAnchor}
                        onChange={(e) => setPaydayBiweeklyAnchor(e.target.value)}
                        className="rounded-xl h-11 border-primary/20 bg-background/50 font-mono"
                        required
                      />
                      <p className="text-[10px] text-muted-foreground">Any past pay date to calculate every two weeks from.</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="pensionType" className="text-xs font-medium text-muted-foreground">Pension arrangement</Label>
                      <Select
                        value={settings.pensionType}
                        onValueChange={(val) => setSettings({ ...settings, pensionType: val as FinanceSettings['pensionType'] })}
                      >
                        <SelectTrigger id="pensionType" className="rounded-xl h-11 border-primary/20 bg-background/50">
                          <SelectValue placeholder="Select arrangement..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-primary/10">
                          <SelectItem value="net_pay">Net Pay (Pre-Tax)</SelectItem>
                          <SelectItem value="salary_sacrifice">Salary Sacrifice</SelectItem>
                          <SelectItem value="relief_at_source">Relief at Source</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="studentLoan" className="text-xs font-medium text-muted-foreground">Student loan plan</Label>
                      <Select
                        value={settings.studentLoanPlan}
                        onValueChange={(val) => setSettings({ ...settings, studentLoanPlan: val as FinanceSettings['studentLoanPlan'] })}
                      >
                        <SelectTrigger id="studentLoan" className="rounded-xl h-11 border-primary/20 bg-background/50">
                          <SelectValue placeholder="Select plan..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-primary/10">
                          <SelectItem value="none">No student loan</SelectItem>
                          <SelectItem value="plan1">Plan 1</SelectItem>
                          <SelectItem value="plan2">Plan 2</SelectItem>
                          <SelectItem value="plan4">Plan 4</SelectItem>
                          <SelectItem value="plan5">Plan 5</SelectItem>
                          <SelectItem value="postgrad">Postgraduate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="personalPension" className="text-xs font-medium text-muted-foreground">Personal pension (%)</Label>
                      <Input
                        id="personalPension"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        step="0.1"
                        value={personalPensionInput}
                        onChange={(e) => setPersonalPensionInput(e.target.value)}
                        className="rounded-xl h-11 border-primary/20 bg-background/50 font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="employerPension" className="text-xs font-medium text-muted-foreground">Employer pension (%)</Label>
                      <Input
                        id="employerPension"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        step="0.1"
                        value={employerPensionInput}
                        onChange={(e) => setEmployerPensionInput(e.target.value)}
                        className="rounded-xl h-11 border-primary/20 bg-background/50 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="taxCode" className="text-xs font-medium text-muted-foreground">Tax code</Label>
                      <Input
                        id="taxCode"
                        type="text"
                        value={taxCodeInput}
                        onChange={(e) => handleTaxCodeChange(e.target.value)}
                        className="rounded-xl h-11 border-primary/20 bg-background/50 uppercase font-mono"
                        placeholder="1257L"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="allowance" className="text-xs font-medium text-muted-foreground">Personal allowance override</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
                        <Input
                          id="allowance"
                          type="text"
                          inputMode="numeric"
                          value={allowanceInput}
                          onChange={(e) => setAllowanceInput(formatNumberInput(e.target.value))}
                          className="rounded-xl h-11 pl-7 border-primary/20 bg-background/50 font-mono"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4 pt-2 border-t border-border/40">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Working days</h3>
                    <p className="text-[11px] text-muted-foreground">Region, tax year, leave, and hours</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">UK region</Label>
                      <Select
                        value={settings.ukRegion}
                        onValueChange={(val) => setSettings({ ...settings, ukRegion: val as FinanceSettings['ukRegion'] })}
                      >
                        <SelectTrigger className="rounded-xl h-11 border-primary/20 bg-background/50">
                          <SelectValue placeholder="Select region..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-primary/10">
                          <SelectItem value="england-and-wales">England & Wales</SelectItem>
                          <SelectItem value="scotland">Scotland</SelectItem>
                          <SelectItem value="northern-ireland">Northern Ireland</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Tax year</Label>
                      <Select
                        value={settings.taxYear.toString()}
                        onValueChange={(val) => setSettings({ ...settings, taxYear: parseInt(val, 10) })}
                      >
                        <SelectTrigger className="rounded-xl h-11 border-primary/20 bg-background/50">
                          <SelectValue placeholder="Select year..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-primary/10">
                          <SelectItem value="2025">2025</SelectItem>
                          <SelectItem value="2026">2026</SelectItem>
                          <SelectItem value="2027">2027</SelectItem>
                          <SelectItem value="2028">2028</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Weekends</p>
                      <p className="mt-0.5 text-sm font-mono font-semibold text-foreground">
                        {settings.weekends}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">days</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        Bank holidays
                        {fetchingHolidays && <Loader2 className="h-3 w-3 animate-spin" />}
                      </p>
                      <p className="mt-0.5 text-sm font-mono font-semibold text-foreground">
                        {settings.bankHolidays}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">days</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="workHolidays" className="text-xs font-medium text-muted-foreground">Annual work leave</Label>
                      <Input
                        id="workHolidays"
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="365"
                        value={workHolsInput}
                        onChange={(e) => setWorkHolsInput(e.target.value)}
                        className="rounded-xl h-11 border-primary/20 bg-background/50 font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hours" className="text-xs font-medium text-muted-foreground">Hours per day</Label>
                      <Input
                        id="hours"
                        type="number"
                        inputMode="decimal"
                        min="0.1"
                        max="24"
                        step="0.1"
                        value={hoursInput}
                        onChange={(e) => setHoursInput(e.target.value)}
                        className="rounded-xl h-11 border-primary/20 bg-background/50 font-mono"
                        required
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION: Advanced Database Configurations */}
              <section className="space-y-4 pt-4 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                      <Sliders className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Advanced Configurations</h3>
                      <p className="text-[11px] text-muted-foreground">Customize tax bands, recurring templates, and credit bureaus</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Item 1: Tax Bands */}
                  <div className="rounded-xl border border-border/40 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedSection(expandedSection === 'tax' ? 'none' : 'tax')}
                      className="w-full flex items-center justify-between p-3.5 bg-muted/10 text-xs font-semibold hover:bg-muted/20 transition-colors text-left"
                    >
                      <span className="flex items-center gap-2"><DollarSign className="w-3.5 h-3.5 text-primary" /> Income Tax & NI Bands</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedSection === 'tax' ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedSection === 'tax' && (
                      <div className="p-4 bg-background/30 border-t border-border/20 space-y-4 text-xs">
                        <div className="space-y-3">
                          <h4 className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">Income Tax Bands (£)</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Basic Rate Limit</Label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={formatNumberInput(draftTaxConfig.incomeTaxBands.basicRateLimit)}
                                onChange={(e) => setDraftTaxConfig({
                                  ...draftTaxConfig,
                                  incomeTaxBands: {
                                    ...draftTaxConfig.incomeTaxBands,
                                    basicRateLimit: parseFormattedFloat(e.target.value) || 0
                                  }
                                })}
                                className="h-9 rounded-lg font-mono text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Higher Rate Limit</Label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={formatNumberInput(draftTaxConfig.incomeTaxBands.higherRateLimit)}
                                onChange={(e) => setDraftTaxConfig({
                                  ...draftTaxConfig,
                                  incomeTaxBands: {
                                    ...draftTaxConfig.incomeTaxBands,
                                    higherRateLimit: parseFormattedFloat(e.target.value) || 0
                                  }
                                })}
                                className="h-9 rounded-lg font-mono text-xs"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Basic Rate %</Label>
                              <Input
                                type="number"
                                value={draftTaxConfig.incomeTaxBands.basicRatePercent}
                                onChange={(e) => setDraftTaxConfig({
                                  ...draftTaxConfig,
                                  incomeTaxBands: {
                                    ...draftTaxConfig.incomeTaxBands,
                                    basicRatePercent: parseFloat(e.target.value) || 0
                                  }
                                })}
                                className="h-9 rounded-lg font-mono text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Higher Rate %</Label>
                              <Input
                                type="number"
                                value={draftTaxConfig.incomeTaxBands.higherRatePercent}
                                onChange={(e) => setDraftTaxConfig({
                                  ...draftTaxConfig,
                                  incomeTaxBands: {
                                    ...draftTaxConfig.incomeTaxBands,
                                    higherRatePercent: parseFloat(e.target.value) || 0
                                  }
                                })}
                                className="h-9 rounded-lg font-mono text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Additional Rate %</Label>
                              <Input
                                type="number"
                                value={draftTaxConfig.incomeTaxBands.additionalRatePercent}
                                onChange={(e) => setDraftTaxConfig({
                                  ...draftTaxConfig,
                                  incomeTaxBands: {
                                    ...draftTaxConfig.incomeTaxBands,
                                    additionalRatePercent: parseFloat(e.target.value) || 0
                                  }
                                })}
                                className="h-9 rounded-lg font-mono text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 pt-3 border-t border-border/20">
                          <h4 className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">National Insurance Bands (£)</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Lower Threshold</Label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={formatNumberInput(draftTaxConfig.nationalInsuranceBands.lowerThreshold)}
                                onChange={(e) => setDraftTaxConfig({
                                  ...draftTaxConfig,
                                  nationalInsuranceBands: {
                                    ...draftTaxConfig.nationalInsuranceBands,
                                    lowerThreshold: parseFormattedFloat(e.target.value) || 0
                                  }
                                })}
                                className="h-9 rounded-lg font-mono text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Upper Threshold</Label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={formatNumberInput(draftTaxConfig.nationalInsuranceBands.upperThreshold)}
                                onChange={(e) => setDraftTaxConfig({
                                  ...draftTaxConfig,
                                  nationalInsuranceBands: {
                                    ...draftTaxConfig.nationalInsuranceBands,
                                    upperThreshold: parseFormattedFloat(e.target.value) || 0
                                  }
                                })}
                                className="h-9 rounded-lg font-mono text-xs"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Main Rate %</Label>
                              <Input
                                type="number"
                                value={draftTaxConfig.nationalInsuranceBands.mainRatePercent}
                                onChange={(e) => setDraftTaxConfig({
                                  ...draftTaxConfig,
                                  nationalInsuranceBands: {
                                    ...draftTaxConfig.nationalInsuranceBands,
                                    mainRatePercent: parseFloat(e.target.value) || 0
                                  }
                                })}
                                className="h-9 rounded-lg font-mono text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Upper Rate %</Label>
                              <Input
                                type="number"
                                value={draftTaxConfig.nationalInsuranceBands.upperRatePercent}
                                onChange={(e) => setDraftTaxConfig({
                                  ...draftTaxConfig,
                                  nationalInsuranceBands: {
                                    ...draftTaxConfig.nationalInsuranceBands,
                                    upperRatePercent: parseFloat(e.target.value) || 0
                                  }
                                })}
                                className="h-9 rounded-lg font-mono text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 pt-3 border-t border-border/20">
                          <h4 className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">Student Loan Thresholds (£)</h4>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                            {(Object.keys(draftTaxConfig.studentLoanThresholds) as Array<keyof typeof draftTaxConfig.studentLoanThresholds>).map((plan) => {
                              if (plan === 'none') return null;
                              return (
                                <div key={plan} className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground uppercase">{plan}</Label>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={formatNumberInput(draftTaxConfig.studentLoanThresholds[plan])}
                                    onChange={(e) => setDraftTaxConfig({
                                      ...draftTaxConfig,
                                      studentLoanThresholds: {
                                        ...draftTaxConfig.studentLoanThresholds,
                                        [plan]: parseFormattedFloat(e.target.value) || 0
                                      }
                                    })}
                                    className="h-9 rounded-lg font-mono text-xs"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Item 2: Recurring Bill Templates */}
                  <div className="rounded-xl border border-border/40 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedSection(expandedSection === 'recurring' ? 'none' : 'recurring')}
                      className="w-full flex items-center justify-between p-3.5 bg-muted/10 text-xs font-semibold hover:bg-muted/20 transition-colors text-left"
                    >
                      <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-primary" /> Recurring Bill Templates</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedSection === 'recurring' ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedSection === 'recurring' && (
                      <div className="p-4 bg-background/30 border-t border-border/20 space-y-4 text-xs">
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {draftRecurringTemplates.map((template, idx) => (
                            <div key={idx} className="flex flex-col gap-2 p-2.5 rounded-xl border border-border bg-card/50 relative group">
                              <button
                                type="button"
                                onClick={() => setDraftRecurringTemplates(draftRecurringTemplates.filter((_, i) => i !== idx))}
                                className="absolute top-2 right-2 text-rose-500 hover:text-rose-700 opacity-60 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <div className="grid grid-cols-12 gap-2 pr-6">
                                <div className="col-span-2 space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">Emoji</Label>
                                  <Input
                                    value={template.emoji}
                                    onChange={(e) => {
                                      const updated = [...draftRecurringTemplates];
                                      updated[idx] = { ...template, emoji: e.target.value };
                                      setDraftRecurringTemplates(updated);
                                    }}
                                    className="h-8 text-center rounded-lg text-xs p-1"
                                  />
                                </div>
                                <div className="col-span-5 space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">Name</Label>
                                  <Input
                                    value={template.name}
                                    onChange={(e) => {
                                      const updated = [...draftRecurringTemplates];
                                      updated[idx] = { ...template, name: e.target.value };
                                      setDraftRecurringTemplates(updated);
                                    }}
                                    className="h-8 rounded-lg text-xs"
                                  />
                                </div>
                                <div className="col-span-5 space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">Category</Label>
                                  <Input
                                    value={template.category}
                                    onChange={(e) => {
                                      const updated = [...draftRecurringTemplates];
                                      updated[idx] = { ...template, category: e.target.value };
                                      setDraftRecurringTemplates(updated);
                                    }}
                                    className="h-8 rounded-lg text-xs"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">Amount (£)</Label>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={formatNumberInput(template.defaultAmount)}
                                    onChange={(e) => {
                                      const updated = [...draftRecurringTemplates];
                                      updated[idx] = { ...template, defaultAmount: parseFormattedFloat(e.target.value) || 0 };
                                      setDraftRecurringTemplates(updated);
                                    }}
                                    className="h-8 rounded-lg text-xs font-mono"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">Tag</Label>
                                  <Input
                                    value={template.tag}
                                    onChange={(e) => {
                                      const updated = [...draftRecurringTemplates];
                                      updated[idx] = { ...template, tag: e.target.value.toUpperCase() };
                                      setDraftRecurringTemplates(updated);
                                    }}
                                    className="h-8 rounded-lg text-xs font-mono uppercase"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">Frequency</Label>
                                  <select
                                    value={template.frequency}
                                    onChange={(e) => {
                                      const updated = [...draftRecurringTemplates];
                                      updated[idx] = { ...template, frequency: e.target.value as any };
                                      setDraftRecurringTemplates(updated);
                                    }}
                                    className="flex w-full rounded-lg border border-primary/20 bg-background/50 h-8 px-2 text-[10px] text-foreground focus:outline-none"
                                  >
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="quarterly">Quarterly</option>
                                    <option value="annually">Annually</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setDraftRecurringTemplates([
                            ...draftRecurringTemplates,
                            { name: 'New Bill', category: 'General', emoji: '💸', tag: 'NEW_BILL', defaultAmount: 10, frequency: 'monthly', linkedBudgetItemId: '' }
                          ])}
                          className="w-full h-8 text-[11px] rounded-xl border-dashed border-primary/30"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add Custom Template
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Item 3: Credit Bureaus */}
                  <div className="rounded-xl border border-border/40 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedSection(expandedSection === 'bureaus' ? 'none' : 'bureaus')}
                      className="w-full flex items-center justify-between p-3.5 bg-muted/10 text-xs font-semibold hover:bg-muted/20 transition-colors text-left"
                    >
                      <span className="flex items-center gap-2"><ShieldAlert className="w-3.5 h-3.5 text-primary" /> Credit Bureau Gauges</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedSection === 'bureaus' ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedSection === 'bureaus' && (
                      <div className="p-4 bg-background/30 border-t border-border/20 space-y-4 text-xs">
                        <div className="space-y-3">
                          {draftCreditBureaus.map((bureau, idx) => (
                            <div key={bureau.key} className="flex flex-col gap-2 p-2.5 rounded-xl border border-border bg-card/50">
                              <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
                                {bureau.emoji} {bureau.label} Config
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">Label</Label>
                                  <Input
                                    value={bureau.label}
                                    onChange={(e) => {
                                      const updated = [...draftCreditBureaus];
                                      updated[idx] = { ...bureau, label: e.target.value };
                                      setDraftCreditBureaus(updated);
                                    }}
                                    className="h-8 rounded-lg text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">Max Score</Label>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={formatNumberInput(bureau.maxScore)}
                                    onChange={(e) => {
                                      const updated = [...draftCreditBureaus];
                                      updated[idx] = { ...bureau, maxScore: parseFormattedInt(e.target.value) || 1000 };
                                      setDraftCreditBureaus(updated);
                                    }}
                                    className="h-8 rounded-lg text-xs font-mono"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] text-muted-foreground">Emoji</Label>
                                  <Input
                                    value={bureau.emoji}
                                    onChange={(e) => {
                                      const updated = [...draftCreditBureaus];
                                      updated[idx] = { ...bureau, emoji: e.target.value };
                                      setDraftCreditBureaus(updated);
                                    }}
                                    className="h-8 rounded-lg text-xs text-center"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <DialogFooter className="shrink-0 gap-2 sm:gap-3 px-4 sm:px-6 py-4 border-t border-border/40 bg-background/95 backdrop-blur-sm">
              <Button
                type="button"
                variant="outline"
                onClick={handleResetDefaults}
                className="w-full sm:w-auto rounded-xl h-11 gap-2 border-primary/20"
                disabled={savingDb}
              >
                <Undo2 className="h-4 w-4" />
                <span className="sm:hidden">Reset</span>
                <span className="hidden sm:inline">Reset to defaults</span>
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto rounded-xl h-11 gap-2 px-6 bg-primary text-primary-foreground"
                disabled={savingDb}
              >
                {savingDb ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save settings
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Add Savings Goal */}
      <Dialog open={isAddGoalOpen} onOpenChange={setIsAddGoalOpen}>
        <DialogContent className="rounded-3xl border-primary/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Add Savings Goal</DialogTitle>
            <DialogDescription className="text-xs">Create a new milestone target and timeline.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddGoal} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="goal-name">Goal Name</Label>
              <Input
                id="goal-name"
                placeholder="e.g. New Macbook Pro"
                value={newGoal.name}
                onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="goal-target">Target Amount (£)</Label>
              <Input
                id="goal-target"
                type="number"
                placeholder="e.g. 2500"
                value={newGoal.targetAmount || ''}
                onChange={(e) => setNewGoal({ ...newGoal, targetAmount: parseFloat(e.target.value) || 0 })}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="goal-start-date">Start Date</Label>
              <Input
                id="goal-start-date"
                type="date"
                value={newGoal.startDate}
                onChange={(e) => setNewGoal({ ...newGoal, startDate: e.target.value })}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="goal-date">Target Date</Label>
              <Input
                id="goal-date"
                type="date"
                value={newGoal.targetDate}
                onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
              />
            </div>
            <DialogFooter className="pt-4 gap-2 sm:gap-0">
              <Button variant="outline" type="button" onClick={() => setIsAddGoalOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Goal</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Add Account */}
      <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
        <DialogContent className="rounded-3xl border-primary/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Add Bank Account</DialogTitle>
            <DialogDescription className="text-xs">Add a new personal bank account or credit card.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddAccount} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="acc-name">Account Name</Label>
              <Input
                id="acc-name"
                placeholder="e.g. Chase Saver"
                value={newAccount.name}
                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="acc-type">Account Type</Label>
              <Select
                value={newAccount.type}
                onValueChange={(val) => setNewAccount({ ...newAccount, type: val as BankAccount['type'] })}
              >
                <SelectTrigger id="acc-type" className="bg-background/50 border-primary/20 rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10">
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="credit">Credit Card</SelectItem>
                  <SelectItem value="investment">Investment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="acc-issuer">Issuer / Bank</Label>
              <Input
                id="acc-issuer"
                placeholder="e.g. Chase Bank"
                value={newAccount.issuer}
                onChange={(e) => setNewAccount({ ...newAccount, issuer: e.target.value })}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="acc-balance">Balance (£)</Label>
              <Input
                id="acc-balance"
                type="number"
                step="0.01"
                placeholder="e.g. 5200 (Use negative for credit balance)"
                value={newAccount.balance || ''}
                onChange={(e) => setNewAccount({ ...newAccount, balance: parseFloat(e.target.value) || 0 })}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="acc-fee">Annual Fee (£)</Label>
              <Input
                id="acc-fee"
                type="number"
                placeholder="e.g. 195"
                value={newAccount.annualFee || ''}
                onChange={(e) => setNewAccount({ ...newAccount, annualFee: parseFloat(e.target.value) || 0 })}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="acc-use">Primary Use Case</Label>
              <Input
                id="acc-use"
                placeholder="e.g. Salary deposits, tech purchases"
                value={newAccount.useCase}
                onChange={(e) => setNewAccount({ ...newAccount, useCase: e.target.value })}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="acc-emoji">Emoji Icon</Label>
                <Input
                  id="acc-emoji"
                  placeholder="e.g. 🏦"
                  value={newAccount.emoji || ''}
                  onChange={(e) => setNewAccount({ ...newAccount, emoji: e.target.value })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50 text-center text-lg"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="acc-color">Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="acc-color"
                    type="color"
                    value={newAccount.color || '#475569'}
                    onChange={(e) => setNewAccount({ ...newAccount, color: e.target.value })}
                    className="rounded-xl h-10 w-12 border-primary/20 bg-background/50 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={newAccount.color || '#475569'}
                    onChange={(e) => setNewAccount({ ...newAccount, color: e.target.value })}
                    className="rounded-xl h-10 border-primary/20 bg-background/50 font-mono text-xs uppercase flex-1"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="pt-4 gap-2 sm:gap-0">
              <Button variant="outline" type="button" onClick={() => setIsAddAccountOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Edit Account */}
      <Dialog open={isEditAccountOpen} onOpenChange={setIsEditAccountOpen}>
        <DialogContent className="rounded-3xl border-primary/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Account</DialogTitle>
            <DialogDescription className="text-xs">Update account metrics.</DialogDescription>
          </DialogHeader>
          {activeAccount && (
            <form onSubmit={handleEditAccount} className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="edit-acc-name">Account Name</Label>
                <Input
                  id="edit-acc-name"
                  value={activeAccount.name}
                  onChange={(e) => setActiveAccount({ ...activeAccount, name: e.target.value })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-acc-balance">Balance (£)</Label>
                <Input
                  id="edit-acc-balance"
                  type="number"
                  step="0.01"
                  value={activeAccount.balance}
                  onChange={(e) => setActiveAccount({ ...activeAccount, balance: parseFloat(e.target.value) || 0 })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-acc-fee">Annual Fee (£)</Label>
                <Input
                  id="edit-acc-fee"
                  type="number"
                  value={activeAccount.annualFee}
                  onChange={(e) => setActiveAccount({ ...activeAccount, annualFee: parseFloat(e.target.value) || 0 })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-acc-use">Primary Use Case</Label>
                <Input
                  id="edit-acc-use"
                  value={activeAccount.useCase || ''}
                  onChange={(e) => setActiveAccount({ ...activeAccount, useCase: e.target.value })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="edit-acc-emoji">Emoji Icon</Label>
                  <Input
                    id="edit-acc-emoji"
                    placeholder="e.g. 🏦"
                    value={activeAccount.emoji || ''}
                    onChange={(e) => setActiveAccount({ ...activeAccount, emoji: e.target.value })}
                    className="rounded-xl h-10 border-primary/20 bg-background/50 text-center text-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-acc-color">Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="edit-acc-color"
                      type="color"
                      value={activeAccount.color || '#475569'}
                      onChange={(e) => setActiveAccount({ ...activeAccount, color: e.target.value })}
                      className="rounded-xl h-10 w-12 border-primary/20 bg-background/50 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={activeAccount.color || '#475569'}
                      onChange={(e) => setActiveAccount({ ...activeAccount, color: e.target.value })}
                      className="rounded-xl h-10 border-primary/20 bg-background/50 font-mono text-xs uppercase flex-1"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="pt-4 gap-2 sm:gap-0">
                <Button variant="outline" type="button" onClick={() => setIsEditAccountOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG: Add Membership */}
      <Dialog open={isAddMembershipOpen} onOpenChange={setIsAddMembershipOpen}>
        <DialogContent className="rounded-3xl border-primary/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Add Reward Membership</DialogTitle>
            <DialogDescription className="text-xs">Add a new point, loyalty or reward system.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMembership} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="mem-name">Membership Program</Label>
              <Input
                id="mem-name"
                placeholder="e.g. Tesco Clubcard"
                value={newMembership.name}
                onChange={(e) => setNewMembership({ ...newMembership, name: e.target.value })}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mem-type">Program Type</Label>
              <Select
                value={newMembership.type}
                onValueChange={(val) => setNewMembership({ ...newMembership, type: val as Membership['type'] })}
              >
                <SelectTrigger id="mem-type" className="bg-background/50 border-primary/20 rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10">
                  <SelectItem value="points">Points Program</SelectItem>
                  <SelectItem value="cashback">Cashback Reward</SelectItem>
                  <SelectItem value="miles">Airline Miles</SelectItem>
                  <SelectItem value="perks">Exclusive Perks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="mem-status">Status / Tier / Point Count</Label>
              <Input
                id="mem-status"
                placeholder="e.g. Silver Tier (1200 points)"
                value={newMembership.status}
                onChange={(e) => setNewMembership({ ...newMembership, status: e.target.value })}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mem-fee">Annual Fee (£)</Label>
              <Input
                id="mem-fee"
                type="number"
                placeholder="e.g. 0"
                value={newMembership.annualFee || ''}
                onChange={(e) => setNewMembership({ ...newMembership, annualFee: parseFloat(e.target.value) || 0 })}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mem-use">Primary Use Case</Label>
              <Input
                id="mem-use"
                placeholder="e.g. Grocery cash savings"
                value={newMembership.useCase}
                onChange={(e) => setNewMembership({ ...newMembership, useCase: e.target.value })}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
              />
            </div>
            <DialogFooter className="pt-4 gap-2 sm:gap-0">
              <Button variant="outline" type="button" onClick={() => setIsAddMembershipOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Program</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Edit Membership */}
      <Dialog open={isEditMembershipOpen} onOpenChange={setIsEditMembershipOpen}>
        <DialogContent className="rounded-3xl border-primary/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Reward Program</DialogTitle>
            <DialogDescription className="text-xs">Update loyalty account details.</DialogDescription>
          </DialogHeader>
          {activeMembership && (
            <form onSubmit={handleEditMembership} className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="edit-mem-name">Program Name</Label>
                <Input
                  id="edit-mem-name"
                  value={activeMembership.name}
                  onChange={(e) => setActiveMembership({ ...activeMembership, name: e.target.value })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-mem-status">Status / Tier</Label>
                <Input
                  id="edit-mem-status"
                  value={activeMembership.status}
                  onChange={(e) => setActiveMembership({ ...activeMembership, status: e.target.value })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-mem-fee">Annual Fee (£)</Label>
                <Input
                  id="edit-mem-fee"
                  type="number"
                  value={activeMembership.annualFee}
                  onChange={(e) => setActiveMembership({ ...activeMembership, annualFee: parseFloat(e.target.value) || 0 })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-mem-use">Primary Use Case</Label>
                <Input
                  id="edit-mem-use"
                  value={activeMembership.useCase || ''}
                  onChange={(e) => setActiveMembership({ ...activeMembership, useCase: e.target.value })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50"
                />
              </div>
              <DialogFooter className="pt-4 gap-2 sm:gap-0">
                <Button variant="outline" type="button" onClick={() => setIsEditMembershipOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG: Add Recurring Bill */}
      <Dialog open={isAddRecurringOpen} onOpenChange={setIsAddRecurringOpen}>
        <DialogContent className="rounded-3xl border-primary/10 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Add Recurring Bill</DialogTitle>
            <DialogDescription className="text-xs">Add an automated recurring bill payment, linked to budgets and accounts.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddRecurring} className="space-y-4 py-2">

            {/* Quick Templates Dropdown */}
            <div className="space-y-1">
              <Label htmlFor="rec-template" className="text-xs">Select Template (Auto-fills details)</Label>
              <Select
                value={addRecTemplate}
                onValueChange={(val) => {
                  setAddRecTemplate(val);
                  if (val !== "scratch") {
                    const idx = parseInt(val, 10);
                    if (!isNaN(idx) && recurringTemplates[idx]) {
                      const temp = recurringTemplates[idx];
                      setNewRecurring({
                        ...newRecurring,
                        name: temp.name,
                        amount: temp.defaultAmount,
                        frequency: temp.frequency as any,
                        emoji: temp.emoji,
                        category: temp.category,
                        tag: temp.tag,
                        linkedBudgetItemId: temp.linkedBudgetItemId || ''
                      });
                    }
                  }
                }}
              >
                <SelectTrigger id="rec-template" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs">
                  <SelectValue placeholder="Start a new one from scratch" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10">
                  <SelectItem value="scratch" className="text-xs">Start a new one from scratch</SelectItem>
                  {recurringTemplates.map((temp, idx) => (
                    <SelectItem key={idx} value={String(idx)} className="text-xs">
                      {temp.emoji} {temp.name} ({temp.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bill Name */}
            <div className="space-y-1">
              <Label htmlFor="rec-name" className="text-xs">Bill Name</Label>
              <Input
                id="rec-name"
                placeholder="e.g. Spotify Premium"
                value={newRecurring.name}
                onChange={(e) => {
                  const nameVal = e.target.value;
                  const match = autoCategorizeRecurring(nameVal);
                  if (match) {
                    setNewRecurring({
                      ...newRecurring,
                      name: nameVal,
                      emoji: match.emoji,
                      category: match.category,
                      tag: match.tag,
                      frequency: match.frequency as any,
                      amount: newRecurring.amount === 0 ? match.defaultAmount : newRecurring.amount,
                      linkedBudgetItemId: match.linkedBudgetItemId
                    });
                  } else {
                    setNewRecurring({
                      ...newRecurring,
                      name: nameVal
                    });
                  }
                }}
                className="rounded-xl h-10 border-primary/20 bg-background/50 text-sm"
                required
              />
            </div>

            {/* Grid for Emoji and Tag */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-1">
                <Label htmlFor="rec-emoji" className="text-xs">Emoji</Label>
                <Input
                  id="rec-emoji"
                  placeholder="e.g. 🎵"
                  value={newRecurring.emoji || ''}
                  onChange={(e) => setNewRecurring({ ...newRecurring, emoji: e.target.value })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50 text-center"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label htmlFor="rec-tag" className="text-xs">Tag / Badge Code</Label>
                <Input
                  id="rec-tag"
                  placeholder="e.g. SPOTIFY"
                  value={newRecurring.tag || ''}
                  onChange={(e) => setNewRecurring({ ...newRecurring, tag: e.target.value.toUpperCase() })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50 text-sm"
                />
              </div>
            </div>

            {/* Grid for Amount, Frequency, Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rec-amount" className="text-xs">Amount (£)</Label>
                <Input
                  id="rec-amount"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 10.99"
                  value={newRecurring.amount || ''}
                  onChange={(e) => setNewRecurring({ ...newRecurring, amount: parseFloat(e.target.value) || 0 })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50 text-sm font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rec-frequency" className="text-xs">Frequency</Label>
                <Select
                  value={newRecurring.frequency}
                  onValueChange={(val) => setNewRecurring({ ...newRecurring, frequency: val as any })}
                >
                  <SelectTrigger id="rec-frequency" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs">
                    <SelectValue placeholder="Select frequency..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-primary/10">
                    <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                    <SelectItem value="weekly" className="text-xs">Weekly</SelectItem>
                    <SelectItem value="quarterly" className="text-xs">Quarterly</SelectItem>
                    <SelectItem value="annually" className="text-xs">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Grid for Month & Day */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rec-day" className="text-xs">Due Day of Month (1-31)</Label>
                <Input
                  id="rec-day"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="e.g. 15"
                  value={newRecurring.dueDate || ''}
                  onChange={(e) => setNewRecurring({ ...newRecurring, dueDate: parseInt(e.target.value, 10) || 1 })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50 text-sm font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="rec-month" className="text-xs">Due Month</Label>
                <Select
                  value={String(newRecurring.dueMonth || 1)}
                  onValueChange={(val) => setNewRecurring({ ...newRecurring, dueMonth: parseInt(val, 10) })}
                  disabled={newRecurring.frequency === 'monthly' || newRecurring.frequency === 'weekly'}
                >
                  <SelectTrigger id="rec-month" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs disabled:opacity-50">
                    <SelectValue placeholder="Select month..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-primary/10">
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => (
                      <SelectItem key={idx} value={String(idx + 1)} className="text-xs">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Category selection */}
            <div className="space-y-1">
              <Label htmlFor="rec-category" className="text-xs">Dashboard Category</Label>
              <Select
                value={newRecurring.category || 'none'}
                onValueChange={(val) => setNewRecurring({ ...newRecurring, category: val === 'none' ? '' : val })}
              >
                <SelectTrigger id="rec-category" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10">
                  <SelectItem value="none" className="text-xs">Select category...</SelectItem>
                  <SelectItem value="Rent" className="text-xs">Rent / Housing</SelectItem>
                  <SelectItem value="Subscriptions" className="text-xs">Subscriptions</SelectItem>
                  <SelectItem value="Insurance" className="text-xs">Insurance</SelectItem>
                  <SelectItem value="Entertainment" className="text-xs">Entertainment</SelectItem>
                  <SelectItem value="Gym" className="text-xs">Gym</SelectItem>
                  <SelectItem value="Donations" className="text-xs">Donations</SelectItem>
                  <SelectItem value="Groceries" className="text-xs">Groceries</SelectItem>
                  <SelectItem value="Car" className="text-xs">Car</SelectItem>
                  <SelectItem value="Healthcare" className="text-xs">Healthcare</SelectItem>
                  <SelectItem value="Other" className="text-xs">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Symlink: Linked Budget Item */}
            <div className="space-y-1">
              <Label htmlFor="rec-link-budget" className="text-xs">Link to Budget Item</Label>
              <Select
                value={newRecurring.linkedBudgetItemId || 'none'}
                onValueChange={(val) => setNewRecurring({ ...newRecurring, linkedBudgetItemId: val === 'none' ? '' : val })}
              >
                <SelectTrigger id="rec-link-budget" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs">
                  <SelectValue placeholder="No linked budget item (Create automatically on save)" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10">
                  <SelectItem value="none" className="text-xs">No linked budget item (Create automatically on save)</SelectItem>
                  <SelectItem value="create" className="text-xs">Force create new item</SelectItem>
                  {allBudgetItems.map(item => (
                    <SelectItem key={item.id} value={item.id} className="text-xs">
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Symlink: Linked Bank Account */}
            <div className="space-y-1">
              <Label htmlFor="rec-link-account" className="text-xs">Link to Bank Account (Source for payments)</Label>
              <Select
                value={newRecurring.linkedAccountId || 'none'}
                onValueChange={(val) => setNewRecurring({ ...newRecurring, linkedAccountId: val === 'none' ? '' : val })}
              >
                <SelectTrigger id="rec-link-account" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs">
                  <SelectValue placeholder="No linked account (Manual cash payment)" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10">
                  <SelectItem value="none" className="text-xs">No linked account (Manual cash payment)</SelectItem>
                  {bankAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id} className="text-xs">
                      {acc.name} ({acc.type} - {formatGBP(acc.balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4 gap-2 sm:gap-0">
              <Button variant="outline" type="button" onClick={() => setIsAddRecurringOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Bill</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Edit Recurring Bill */}
      <Dialog open={isEditRecurringOpen} onOpenChange={setIsEditRecurringOpen}>
        <DialogContent className="rounded-3xl border-primary/10 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Recurring Bill</DialogTitle>
            <DialogDescription className="text-xs">Update your recurring bill parameters.</DialogDescription>
          </DialogHeader>
          {activeRecurring && (
            <form onSubmit={handleEditRecurring} className="space-y-4 py-2">

              {/* Bill Name */}
              <div className="space-y-1">
                <Label htmlFor="edit-rec-name" className="text-xs">Bill Name</Label>
                <Input
                  id="edit-rec-name"
                  value={activeRecurring.name}
                  onChange={(e) => setActiveRecurring({ ...activeRecurring, name: e.target.value })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50 text-sm"
                  required
                />
              </div>

              {/* Grid for Emoji and Tag */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-1">
                  <Label htmlFor="edit-rec-emoji" className="text-xs">Emoji</Label>
                  <Input
                    id="edit-rec-emoji"
                    placeholder="e.g. 🎵"
                    value={activeRecurring.emoji || ''}
                    onChange={(e) => setActiveRecurring({ ...activeRecurring, emoji: e.target.value })}
                    className="rounded-xl h-10 border-primary/20 bg-background/50 text-center"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="edit-rec-tag" className="text-xs">Tag / Badge Code</Label>
                  <Input
                    id="edit-rec-tag"
                    placeholder="e.g. SPOTIFY"
                    value={activeRecurring.tag || ''}
                    onChange={(e) => setActiveRecurring({ ...activeRecurring, tag: e.target.value.toUpperCase() })}
                    className="rounded-xl h-10 border-primary/20 bg-background/50 text-sm"
                  />
                </div>
              </div>

              {/* Grid for Amount, Frequency, Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-rec-amount" className="text-xs">Amount (£)</Label>
                  <Input
                    id="edit-rec-amount"
                    type="number"
                    step="0.01"
                    value={activeRecurring.amount}
                    onChange={(e) => setActiveRecurring({ ...activeRecurring, amount: parseFloat(e.target.value) || 0 })}
                    className="rounded-xl h-10 border-primary/20 bg-background/50 text-sm font-mono"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-rec-frequency" className="text-xs">Frequency</Label>
                  <Select
                    value={activeRecurring.frequency}
                    onValueChange={(val) => setActiveRecurring({ ...activeRecurring, frequency: val as any })}
                  >
                    <SelectTrigger id="edit-rec-frequency" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs">
                      <SelectValue placeholder="Select frequency..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-primary/10">
                      <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                      <SelectItem value="weekly" className="text-xs">Weekly</SelectItem>
                      <SelectItem value="quarterly" className="text-xs">Quarterly</SelectItem>
                      <SelectItem value="annually" className="text-xs">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Grid for Month & Day */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-rec-day" className="text-xs">Due Day of Month (1-31)</Label>
                  <Input
                    id="edit-rec-day"
                    type="number"
                    min="1"
                    max="31"
                    value={activeRecurring.dueDate}
                    onChange={(e) => setActiveRecurring({ ...activeRecurring, dueDate: parseInt(e.target.value, 10) || 1 })}
                    className="rounded-xl h-10 border-primary/20 bg-background/50 text-sm font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-rec-month" className="text-xs">Due Month</Label>
                  <Select
                    value={String(activeRecurring.dueMonth || 1)}
                    onValueChange={(val) => setActiveRecurring({ ...activeRecurring, dueMonth: parseInt(val, 10) })}
                    disabled={activeRecurring.frequency === 'monthly' || activeRecurring.frequency === 'weekly'}
                  >
                    <SelectTrigger id="edit-rec-month" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs disabled:opacity-50">
                      <SelectValue placeholder="Select month..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-primary/10">
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => (
                        <SelectItem key={idx} value={String(idx + 1)} className="text-xs">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Category selection */}
              <div className="space-y-1">
                <Label htmlFor="edit-rec-category" className="text-xs">Dashboard Category</Label>
                <Select
                  value={activeRecurring.category || 'none'}
                  onValueChange={(val) => setActiveRecurring({ ...activeRecurring, category: val === 'none' ? '' : val })}
                >
                  <SelectTrigger id="edit-rec-category" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs">
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-primary/10">
                    <SelectItem value="none" className="text-xs">Select category...</SelectItem>
                    <SelectItem value="Rent" className="text-xs">Rent / Housing</SelectItem>
                    <SelectItem value="Subscriptions" className="text-xs">Subscriptions</SelectItem>
                    <SelectItem value="Insurance" className="text-xs">Insurance</SelectItem>
                    <SelectItem value="Entertainment" className="text-xs">Entertainment</SelectItem>
                    <SelectItem value="Gym" className="text-xs">Gym</SelectItem>
                    <SelectItem value="Donations" className="text-xs">Donations</SelectItem>
                    <SelectItem value="Groceries" className="text-xs">Groceries</SelectItem>
                    <SelectItem value="Car" className="text-xs">Car</SelectItem>
                    <SelectItem value="Healthcare" className="text-xs">Healthcare</SelectItem>
                    <SelectItem value="Other" className="text-xs">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Symlink: Linked Budget Item */}
              <div className="space-y-1">
                <Label htmlFor="edit-rec-link-budget" className="text-xs">Link to Budget Item</Label>
                <Select
                  value={activeRecurring.linkedBudgetItemId || 'none'}
                  onValueChange={(val) => setActiveRecurring({ ...activeRecurring, linkedBudgetItemId: val === 'none' ? '' : val })}
                >
                  <SelectTrigger id="edit-rec-link-budget" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs">
                    <SelectValue placeholder="No linked budget item" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-primary/10">
                    <SelectItem value="none" className="text-xs">No linked budget item</SelectItem>
                    {allBudgetItems.map(item => (
                      <SelectItem key={item.id} value={item.id} className="text-xs">
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Symlink: Linked Bank Account */}
              <div className="space-y-1">
                <Label htmlFor="edit-rec-link-account" className="text-xs">Link to Bank Account (Source for payments)</Label>
                <Select
                  value={activeRecurring.linkedAccountId || 'none'}
                  onValueChange={(val) => setActiveRecurring({ ...activeRecurring, linkedAccountId: val === 'none' ? '' : val })}
                >
                  <SelectTrigger id="edit-rec-link-account" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs">
                    <SelectValue placeholder="No linked account (Manual cash payment)" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-primary/10">
                    <SelectItem value="none" className="text-xs">No linked account (Manual cash payment)</SelectItem>
                    {bankAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id} className="text-xs">
                        {acc.name} ({acc.type} - {formatGBP(acc.balance)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-4 gap-2 sm:gap-0">
                <Button variant="outline" type="button" onClick={() => setIsEditRecurringOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG: Add Credit Score */}
      <Dialog open={isAddCreditScoreOpen} onOpenChange={setIsAddCreditScoreOpen}>
        <DialogContent className="rounded-3xl border-primary/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Log Credit Score</DialogTitle>
            <DialogDescription className="text-xs">Manually log your latest credit score from any bureau.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCreditScore} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="cs-bureau" className="text-xs">Credit Bureau</Label>
              <Select
                value={newCreditScore.bureau}
                onValueChange={(val) => setNewCreditScore({ ...newCreditScore, bureau: val as any })}
              >
                <SelectTrigger id="cs-bureau" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs">
                  <SelectValue placeholder="Select bureau..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10">
                  {creditBureaus.map(b => (
                    <SelectItem key={b.key} value={b.key} className="text-xs">
                      {b.emoji} {b.label} (0–{b.maxScore})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cs-score" className="text-xs">Score</Label>
              <Input
                id="cs-score"
                type="number"
                min="0"
                placeholder="e.g. 720"
                value={newCreditScore.score || ''}
                onChange={(e) => setNewCreditScore({ ...newCreditScore, score: parseInt(e.target.value, 10) || 0 })}
                className="rounded-xl h-10 border-primary/20 bg-background/50 text-sm font-mono"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cs-date" className="text-xs">Date Checked</Label>
              <Input
                id="cs-date"
                type="date"
                value={newCreditScore.date}
                onChange={(e) => setNewCreditScore({ ...newCreditScore, date: e.target.value })}
                className="rounded-xl h-10 border-primary/20 bg-background/50 text-sm"
                required
              />
            </div>
            <DialogFooter className="pt-4 gap-2 sm:gap-0">
              <Button variant="outline" type="button" onClick={() => setIsAddCreditScoreOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Log Score</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Add Budget Category */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="rounded-3xl border-primary/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Add Budget Category</DialogTitle>
            <DialogDescription className="text-xs">Create a new container category with a monthly budget limit.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCategory} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="cat-template" className="text-xs">Select Template (Auto-fills details)</Label>
              <select
                id="cat-template"
                onChange={(e) => {
                  const idx = parseInt(e.target.value, 10);
                  if (!isNaN(idx) && defaultBudgetCategories[idx]) {
                    const preset = defaultBudgetCategories[idx];
                    setNewCategoryName(preset.name);
                    setNewCategoryEmoji(preset.emoji || '');
                    setNewCategoryGroup(preset.group || 'needs');
                  } else {
                    setNewCategoryName('');
                    setNewCategoryEmoji('');
                    setNewCategoryGroup('needs');
                    setNewCategoryBudget(0);
                  }
                }}
                className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                defaultValue=""
              >
                <option value="">Start a new one from scratch</option>
                {defaultBudgetCategories.map((preset, idx) => (
                  <option key={preset.id} value={idx}>
                    {preset.emoji} {preset.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cat-new-name">Category Name</Label>
              <Input
                id="cat-new-name"
                placeholder="e.g. Travel & Transport"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cat-new-budget">Budget Limit (£)</Label>
              <Input
                id="cat-new-budget"
                type="number"
                step="0.01"
                placeholder="e.g. 500"
                value={newCategoryBudget || ''}
                onChange={(e) => setNewCategoryBudget(parseFloat(e.target.value) || 0)}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cat-new-group">Allocation Group</Label>
              <select
                id="cat-new-group"
                value={newCategoryGroup}
                onChange={(e) => setNewCategoryGroup(e.target.value as 'needs' | 'wants' | 'savings')}
                className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="needs">Needs</option>
                <option value="wants">Wants</option>
                <option value="savings">Savings</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cat-new-emoji">Category Emoji</Label>
              <Input
                id="cat-new-emoji"
                placeholder="e.g. 🍔 (Leave blank for default)"
                value={newCategoryEmoji}
                onChange={(e) => setNewCategoryEmoji(e.target.value)}
                className="rounded-xl h-10 border-primary/20 bg-background/50 text-center text-lg"
              />
            </div>
            <DialogFooter className="pt-4 gap-2 sm:gap-0">
              <Button variant="outline" type="button" onClick={() => setIsAddCategoryOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Category</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Edit Budget Category */}
      <Dialog open={isEditCategoryOpen} onOpenChange={setIsEditCategoryOpen}>
        <DialogContent className="rounded-3xl border-primary/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Budget Category</DialogTitle>
            <DialogDescription className="text-xs">Modify the name or limit for this budget category.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditCategory} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="cat-edit-name">Category Name</Label>
              <Input
                id="cat-edit-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cat-edit-budget">Budget Limit (£)</Label>
              <Input
                id="cat-edit-budget"
                type="number"
                step="0.01"
                value={newCategoryBudget || ''}
                onChange={(e) => setNewCategoryBudget(parseFloat(e.target.value) || 0)}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cat-edit-group">Allocation Group</Label>
              <select
                id="cat-edit-group"
                value={newCategoryGroup}
                onChange={(e) => setNewCategoryGroup(e.target.value as 'needs' | 'wants' | 'savings')}
                className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="needs">Needs</option>
                <option value="wants">Wants</option>
                <option value="savings">Savings</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cat-edit-emoji">Category Emoji</Label>
              <Input
                id="cat-edit-emoji"
                placeholder="e.g. 🍔"
                value={newCategoryEmoji}
                onChange={(e) => setNewCategoryEmoji(e.target.value)}
                className="rounded-xl h-10 border-primary/20 bg-background/50 text-center text-lg"
              />
            </div>
            <DialogFooter className="pt-4 gap-2 sm:gap-0">
              <Button variant="outline" type="button" onClick={() => { setIsEditCategoryOpen(false); setActiveCategoryId(null); }} className="rounded-xl">Cancel</Button>
              <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Add Budget Item */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="rounded-3xl border-primary/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Add Budget Item</DialogTitle>
            <DialogDescription className="text-xs">Add a new specific item inside the selected category.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddItem} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="item-new-name">Item Name</Label>
              <Input
                id="item-new-name"
                placeholder="e.g. Weekly Fuel"
                value={newBudgetItem.name}
                onChange={(e) => setNewBudgetItem({ ...newBudgetItem, name: e.target.value })}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-new-spent">Currently Spent (£)</Label>
              <Input
                id="item-new-spent"
                type="number"
                step="0.01"
                placeholder="e.g. 45"
                value={newBudgetItem.spent || ''}
                onChange={(e) => setNewBudgetItem({ ...newBudgetItem, spent: parseFloat(e.target.value) || 0 })}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
                required
              />
            </div>
            <DialogFooter className="pt-4 gap-2 sm:gap-0">
              <Button variant="outline" type="button" onClick={() => setIsAddItemOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Item</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Edit Budget Item */}
      <Dialog open={isEditItemOpen} onOpenChange={setIsEditItemOpen}>
        <DialogContent className="rounded-3xl border-primary/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Budget Item</DialogTitle>
            <DialogDescription className="text-xs">Modify values for this specific budget item.</DialogDescription>
          </DialogHeader>
          {activeBudgetItem && (
            <form onSubmit={handleEditItem} className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="edit-item-name">Item Name</Label>
                <Input
                  id="edit-item-name"
                  value={activeBudgetItem.name}
                  onChange={(e) => setActiveBudgetItem({ ...activeBudgetItem, name: e.target.value })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-item-spent">Currently Spent (£)</Label>
                <Input
                  id="edit-item-spent"
                  type="number"
                  step="0.01"
                  value={activeBudgetItem.spent}
                  onChange={(e) => setActiveBudgetItem({ ...activeBudgetItem, spent: parseFloat(e.target.value) || 0 })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50"
                  required
                />
              </div>
              <DialogFooter className="pt-4 gap-2 sm:gap-0">
                <Button variant="outline" type="button" onClick={() => setIsEditItemOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>



    </div>
  );
}

// Simple placeholder components for icons not directly available
function PieChartIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}

interface MonthYearPickerProps {
  value: string;
  onChange: (val: string) => void;
  isEnd?: boolean;
}

function MonthYearPicker({ value, onChange, isEnd }: MonthYearPickerProps) {
  const parsedDate = new Date(value);
  const initialYear = isNaN(parsedDate.getTime()) ? new Date().getFullYear() : parsedDate.getFullYear();
  const initialMonth = isNaN(parsedDate.getTime()) ? new Date().getMonth() : parsedDate.getMonth();
  const initialDay = isNaN(parsedDate.getTime()) ? (isEnd ? 30 : 1) : parsedDate.getDate();

  const [view, setView] = useState<'months' | 'days'>('months');
  const [pickerYear, setPickerYear] = useState(initialYear);
  const [pickerMonth, setPickerMonth] = useState(initialMonth);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  if (view === 'days') {
    const daysInMonth = getDaysInMonth(pickerYear, pickerMonth);
    const startDayOfWeek = getStartDayOfWeek(pickerYear, pickerMonth);

    return (
      <div className="w-[300px] p-4 bg-popover text-foreground select-none">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setView('months')}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-muted text-foreground flex items-center gap-1 hover:bg-muted/80 transition-colors"
          >
            <ChevronLeft className="h-3 w-3" /> Back
          </button>
          <span className="text-xs font-bold text-foreground">
            {months[pickerMonth]} {pickerYear}
          </span>
          <div className="w-[45px]" />
        </div>

        {/* Week headers */}
        <div className="grid grid-cols-7 gap-1 mb-1.5 text-[9px] font-semibold text-muted-foreground text-center">
          <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center justify-items-center">
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="w-7 h-7" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const isSelected = initialYear === pickerYear && initialMonth === pickerMonth && initialDay === dayNum;

            return (
              <button
                key={dayNum}
                onClick={() => {
                  const yrStr = String(pickerYear);
                  const moStr = String(pickerMonth + 1).padStart(2, '0');
                  const dyStr = String(dayNum).padStart(2, '0');
                  onChange(`${yrStr}-${moStr}-${dyStr}`);
                }}
                className={cn(
                  "w-7 h-7 text-[10px] font-semibold transition-all flex items-center justify-center rounded-lg",
                  isSelected
                    ? "bg-[#1d70b8] text-white shadow-sm"
                    : "text-foreground/80 hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {dayNum}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-[300px] p-4 bg-popover text-foreground select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        {/* Year Dropdown Selector */}
        <select
          value={pickerYear}
          onChange={(e) => setPickerYear(Number(e.target.value))}
          className="appearance-none bg-background/60 hover:bg-background/80 text-foreground border border-border/80 rounded-xl pl-3 pr-8 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_10px_center] bg-no-repeat transition-colors"
        >
          {Array.from({ length: 21 }, (_, i) => 2015 + i).map(y => (
            <option key={y} value={y} className="bg-popover text-foreground">{y}</option>
          ))}
        </select>

        {/* Prev / Next Chevrons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPickerYear(prev => prev - 1)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setPickerYear(prev => prev + 1)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 3x4 Month Grid */}
      <div className="grid grid-cols-3 gap-2">
        {months.map((mName, idx) => {
          const isSelected = initialYear === pickerYear && initialMonth === idx;
          return (
            <button
              key={mName}
              onClick={() => {
                setPickerMonth(idx);
                setView('days');
              }}
              className={cn(
                "py-2 text-[10px] font-medium transition-all text-center rounded-xl",
                isSelected
                  ? "bg-[#1d70b8] text-white font-semibold shadow-sm"
                  : "text-foreground/80 hover:bg-muted/50 hover:text-foreground"
              )}
            >
              {mName}
            </button>
          );
        })}
      </div>
    </div>
  );
}


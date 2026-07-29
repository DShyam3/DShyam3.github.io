import { useState, useEffect, useMemo, useRef } from 'react';
import defaultPresets from '../data/presets.json';
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
  Clock,
  Archive,
  ArchiveRestore,
  Gift,
  Package,
  Sparkles,
  Shield
} from 'lucide-react';
import type { PackageBenefit } from '@/types/finance';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { RecurringsTab } from '@/components/finance/tabs/RecurringsTab';
import { TimeSpentTab } from '@/components/finance/tabs/TimeSpentTab';
import { TransactionsTab } from '@/components/finance/tabs/TransactionsTab';
import { InvestmentsTab } from '@/components/finance/tabs/InvestmentsTab';
import { AddRecurringDialog } from '@/components/finance/dialogs/AddRecurringDialog';
import { EditRecurringDialog } from '@/components/finance/dialogs/EditRecurringDialog';
import {
  DEFAULT_GROUPS,
  calculateWeekends,
  formatGBP,
  stripNumberFormatting,
  formatNumberInput,
  parseFormattedFloat,
  parseFormattedInt,
  formatReadableDate,
  getCategoryDefaultEmoji,
  getAccountDefaultEmoji,
  getAccountDefaultColor,
  sanitizeBankAccounts,
  sanitizeBudgetCategories,
  FIN_HEX,
  FIN_CHART_PALETTE,
} from '@/components/finance/utils/calculations';
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
  activeSavingsTypes?: string[];
  packageBenefits?: PackageBenefit[];
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
  status?: 'active' | 'archived';
  emoji?: string;
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

export interface InvestmentHolding {
  id: string;
  name: string;
  ticker?: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  category: 'Stock' | 'ETF' | 'Crypto' | 'Mutual Fund' | 'Real Estate' | 'Cash' | 'Other';
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
  emoji?: string;
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
  accountId?: string;
  bankAccountId?: string;
  goalId?: string;
  notes?: string;
  tags?: string[];
  isRecurring?: boolean;
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

export interface TrueLayerStatus {
  connected: boolean;
  expires_at: string | null;
}

export interface BureauBand {
  name: string;
  min: number;
  max: number;
  color: string;
  hoverColor: string;
  description: string;
}

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

export interface UniversalStanding {
  label: string;
  rating: number;
  color: string;
  cls: string;
  desc: string;
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
// CONSTANTS & DEFAULTS
// ==========================================

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'goals', label: 'Goals' },
  { key: 'cash-flow', label: 'Cash Flow' },
  { key: 'budget', label: 'Budget' },
  { key: 'recurrings', label: 'Recurrings' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'investments', label: 'Investments' },
  { key: 'tax-income', label: 'Tax & Income' },
  { key: 'time-spent', label: 'Time Spent' },
] as const;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const { DEFAULT_CATEGORY_PRESETS } = defaultPresets;

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

const ALL_PRESETS_FALLBACK = defaultPresets;

const isDiscretionaryCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  const group = cat.group;
  return group === 'wants' || name.includes('food') || name.includes('drink') || name.includes('dining') || name.includes('entertainment');
};

const isHousingCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  const group = cat.group;
  return group === 'needs' && (name.includes('home') || name.includes('house') || name.includes('rent') || name.includes('accommodation') || name.includes('living'));
};

const isInsuranceCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('insurance') || name.includes('protect') || name.includes('insure') || name.includes('cover');
};

const isTransportCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('transport') || name.includes('travel') || name.includes('car') || name.includes('vehicle') || name.includes('commute') || name.includes('transit');
};

const isSubscriptionsCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('subscription') || name.includes('recurring') || name.includes('member');
};

const isLoansCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('loan') || name.includes('debt') || name.includes('repayment') || name.includes('mortgage') || name.includes('borrow');
};

const isGiftsDonationsCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('gift') || name.includes('donation') || name.includes('charity') || name.includes('giving');
};

const isHealthWellnessCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('health') || name.includes('wellness') || name.includes('medical') || name.includes('gym') || name.includes('fitness') || name.includes('doctor') || name.includes('therapy');
};

const isPetsCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('pet') || name.includes('dog') || name.includes('cat') || name.includes('animal') || name.includes('vet');
};

const isShoppingCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('shopping') || name.includes('store') || name.includes('purchase') || name.includes('clothes') || name.includes('apparel');
};

const isTravelHolidaysCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('holiday') || name.includes('vacation') || name.includes('trip') || (name.includes('travel') && !name.includes('local') && !name.includes('commute'));
};

const isOtherCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('other') || name.includes('misc') || name.includes('ad-hoc') || name.includes('general') || name.includes('cash') || name.includes('uncategorised');
};

const isFamilyKidsCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('family') || name.includes('kid') || name.includes('child') || name.includes('baby') || name.includes('parent');
};

const isEducationCareerCategory = (cat?: BudgetCategory): boolean => {
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('education') || name.includes('career') || name.includes('course') || name.includes('stud') || name.includes('learn');
};

const ALL_SAVINGS_IDS = SAVINGS_PRESETS.map(p => p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'));

const DEFAULT_CATEGORY_TEMPLATES = presetsToDefaultCategories(DEFAULT_CATEGORY_PRESETS);

const mergeMissingDefaultCategories = (loaded: BudgetCategory[], defaults: BudgetCategory[]): BudgetCategory[] => {
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
const safeParseJSON = <T,>(saved: string | null, fallback: T): T => {
  if (!saved) return fallback;
  try {
    return JSON.parse(saved) as T;
  } catch (e) {
    console.error('Failed to parse stored finance data, using fallback:', e);
    return fallback;
  }
};

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
//
// Note: getBudgetItemSpent below is intentionally NOT imported from
// components/finance/utils/calculations.ts -- that module has a
// same-named function that has diverged (different balance-sign handling
// and recurring-bill matching). This is the version actually driving the
// live budget calculations on this page; do not replace it without
// reconciling the two implementations first.
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

const getDueDateText = (bill: RecurringBill, currentMonth: number, overrideMonth?: number) => {
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

  // TrueLayer state
  const [trueLayerStatus, setTrueLayerStatus] = useState<TrueLayerStatus | null>(null);
  const [isSyncingTrueLayer, setIsSyncingTrueLayer] = useState(false);
  const [isConnectingTrueLayer, setIsConnectingTrueLayer] = useState(false);


  // Dynamic Budget Presets loaded from Supabase or Fallback
  const [presets, setPresets] = useState(() => {
    const saved = localStorage.getItem('finance_budget_presets');
    if (saved) {
      try {
        return {
          ...ALL_PRESETS_FALLBACK,
          ...JSON.parse(saved)
        };
      } catch (e) {
        console.error('Failed to parse cached presets:', e);
      }
    }
    return ALL_PRESETS_FALLBACK;
  });

  const {
    DEFAULT_CATEGORY_PRESETS,
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
  } = presets;

  const ALL_SAVINGS_IDS = useMemo(() => {
    return SAVINGS_PRESETS.map(p => p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
  }, [SAVINGS_PRESETS]);

  const DEFAULT_CATEGORY_TEMPLATES = useMemo(() => {
    return presetsToDefaultCategories(DEFAULT_CATEGORY_PRESETS);
  }, [DEFAULT_CATEGORY_PRESETS]);

  // Tab State with LocalStorage Persistence
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['key']>(() => {
    const saved = localStorage.getItem('finance_active_tab');
    if (saved) {
      const isValid = TABS.some(tab => tab.key === saved);
      if (isValid) return saved as typeof TABS[number]['key'];
    }
    return 'dashboard';
  });

  // Dashboard spending progress period
  const [dashboardSpendRange, setDashboardSpendRange] = useState<'this_month' | 'last_3m' | 'ytd' | 'all_time'>('this_month');

  // Cash flow period selector & drawers
  const [cfPeriod, setCfPeriod] = useState<'ytd' | 'last_3m' | 'all_time' | 'custom'>('ytd');
  const [cfPeriodOpen, setCfPeriodOpen] = useState(false);
  const [cfDrawerOpen, setCfDrawerOpen] = useState<'net' | 'spend' | 'income' | null>(null);
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
    return safeParseJSON<FinanceSettings>(saved, {
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
      holidaysByUser: {},
      activeSavingsTypes: ALL_SAVINGS_IDS
    });
  });

  const [timeSpentInputs, setTimeSpentInputs] = useState(() => {
    const saved = localStorage.getItem('finance_time_spent_inputs');
    return safeParseJSON(saved, {
      sleepHoursPerDay: 8.0,
      commuteDaysPerWeek: 5,
      commuteHoursPerDay: 2,
      gettingReadyHoursPerDay: 1.0,
      gymDaysPerWeek: 0,
      gymHoursPerSession: 0,
      learningHoursPerWeek: 0,
      friendsHoursPerWeek: 0,
    });
  });

  const isItemActive = (item: BudgetItem, cat: BudgetCategory) => {
    if (cat.group !== 'savings') return true;
    const key = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const isPreset = SAVINGS_PRESETS.some(p => p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') === key);
    if (!isPreset) return true; // custom item
    const activeTypes = settings.activeSavingsTypes || ALL_SAVINGS_IDS;
    return activeTypes.includes(key);
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

  const isCategoryActive = (cat: BudgetCategory) => true;

  const [goals, setGoals] = useState<Goal[]>(() => {
    const saved = localStorage.getItem('finance_goals');
    return safeParseJSON<Goal[]>(saved, []);
  });

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => {
    const saved = localStorage.getItem('finance_bank_accounts');
    return sanitizeBankAccounts(safeParseJSON<any[]>(saved, []));
  });

  const [investmentHoldings, setInvestmentHoldings] = useState<InvestmentHolding[]>(() => {
    const saved = localStorage.getItem('finance_investment_holdings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      { id: 'h1', name: 'S&P 500 ETF', ticker: 'VOO', shares: 12.5, avgPrice: 420.50, currentPrice: 485.20, category: 'ETF' },
      { id: 'h2', name: 'Apple Inc.', ticker: 'AAPL', shares: 15, avgPrice: 150.00, currentPrice: 189.30, category: 'Stock' },
      { id: 'h3', name: 'Bitcoin', ticker: 'BTC', shares: 0.15, avgPrice: 35000.00, currentPrice: 62450.00, category: 'Crypto' },
      { id: 'h4', name: 'Ethereum', ticker: 'ETH', shares: 1.2, avgPrice: 1800.00, currentPrice: 3120.00, category: 'Crypto' }
    ];
  });

  const [memberships, setMemberships] = useState<Membership[]>(() => {
    const saved = localStorage.getItem('finance_memberships');
    return safeParseJSON<Membership[]>(saved, []);
  });

  const [recurrings, setRecurrings] = useState<RecurringBill[]>(() => {
    const saved = localStorage.getItem('finance_recurrings');
    return safeParseJSON<RecurringBill[]>(saved, []);
  });

  const [creditScores, setCreditScores] = useState<CreditScores>(() => {
    const saved = localStorage.getItem('finance_credit_scores');
    return safeParseJSON<CreditScores>(saved, { experian: [], transunion: [], equifax: [] });
  });

  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>(() => {
    const saved = localStorage.getItem('finance_budget');
    const list = resolveStoredList(saved, DEFAULT_BUDGET_CATEGORIES);
    return sanitizeBudgetCategories(mergeMissingDefaultCategories(list, DEFAULT_BUDGET_CATEGORIES));
  });

  const [mockTransactions, setMockTransactions] = useState<MockTransaction[]>(() => {
    const saved = localStorage.getItem('finance_transactions');
    return safeParseJSON<MockTransaction[]>(saved, []);
  });

  // Dynamic configurations fetched from Supabase
  const [taxConfig, setTaxConfig] = useState<TaxConfig>(() => {
    const saved = localStorage.getItem('finance_tax_config');
    return safeParseJSON<TaxConfig>(saved, {
      studentLoanThresholds: { none: Infinity, plan1: 0, plan2: 0, plan4: 0, plan5: 0, postgrad: 0 },
      studentLoanRates: { none: 0, plan1: 0, plan2: 0, plan4: 0, plan5: 0, postgrad: 0 },
      incomeTaxBands: { basicRateLimit: 0, higherRateLimit: 0, basicRatePercent: 0, higherRatePercent: 0, additionalRatePercent: 0 },
      nationalInsuranceBands: { lowerThreshold: 0, upperThreshold: 0, mainRatePercent: 0, upperRatePercent: 0 }
    });
  });
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplate[]>(() => {
    const saved = localStorage.getItem('finance_recurring_templates');
    return resolveStoredList(saved, DEFAULT_RECURRING_TEMPLATES);
  });
  const [creditBureaus, setCreditBureaus] = useState<CreditBureauConfig[]>(() => {
    const saved = localStorage.getItem('finance_credit_bureaus');
    return safeParseJSON<CreditBureauConfig[]>(saved, [
      { key: 'experian', label: 'Experian', emoji: '🟣', color: '#6c63d1', maxScore: 1250, gradient: 'from-violet-500/10 to-violet-500/5' },
      { key: 'transunion', label: 'Credit Karma', emoji: '🔵', color: '#3fb5ab', maxScore: 710, gradient: 'from-cyan-500/10 to-cyan-500/5' },
      { key: 'equifax', label: 'ClearScore', emoji: '🟡', color: '#d99a3d', maxScore: 1000, gradient: 'from-fin-warn/10 to-fin-warn/5' }
    ]);
  });
  const [holidayDefaults, setHolidayDefaults] = useState<Record<number, { count: number; dates: string; occasion: string }>>(() => {
    const saved = localStorage.getItem('finance_holiday_defaults');
    return safeParseJSON(saved, {} as Record<number, { count: number; dates: string; occasion: string }>);
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
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [selectedBudgetCategoryFilter, setSelectedBudgetCategoryFilter] = useState<string>('all');
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [isAddCreditScoreOpen, setIsAddCreditScoreOpen] = useState(false);
  const [hoveredBands, setHoveredBands] = useState<Record<'experian' | 'transunion' | 'equifax', BureauBand | null>>({
    experian: null,
    transunion: null,
    equifax: null
  });
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Benefits & Perks Manager Dialog State
  const [isBenefitsDialogOpen, setIsBenefitsDialogOpen] = useState(false);
  const [newBenefitName, setNewBenefitName] = useState('');
  const [newBenefitAmount, setNewBenefitAmount] = useState('');
  const [newBenefitType, setNewBenefitType] = useState<'monetary' | 'percentage'>('monetary');
  const [newBenefitEmoji, setNewBenefitEmoji] = useState('🎁');
  const [newBenefitNotes, setNewBenefitNotes] = useState('');

  const handleAddBenefit = () => {
    const amount = parseFloat(newBenefitAmount);
    if (!newBenefitName.trim()) {
      toast({ title: 'Invalid Name', description: 'Please enter a name for the benefit.', variant: 'destructive' });
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter a valid positive amount or percentage.', variant: 'destructive' });
      return;
    }

    const newBenefit: PackageBenefit = {
      id: 'benefit_' + Date.now(),
      name: newBenefitName.trim(),
      amount,
      type: newBenefitType,
      emoji: newBenefitEmoji.trim() || '🎁',
      notes: newBenefitNotes.trim() || undefined
    };

    const updatedBenefits = [...(settings.packageBenefits || []), newBenefit];
    setSettings(prev => ({ ...prev, packageBenefits: updatedBenefits }));

    setNewBenefitName('');
    setNewBenefitAmount('');
    setNewBenefitNotes('');
    toast({ title: 'Benefit Added', description: `${newBenefit.name} added to package.` });
  };

  const handleDeleteBenefit = (id: string) => {
    const updatedBenefits = (settings.packageBenefits || []).filter(b => b.id !== id);
    setSettings(prev => ({ ...prev, packageBenefits: updatedBenefits }));
    toast({ title: 'Benefit Removed', description: 'Benefit removed from package.' });
  };

  const handleAddPresetBenefit = (preset: { name: string; amount: number; type: 'monetary' | 'percentage'; emoji: string }) => {
    const newBenefit: PackageBenefit = {
      id: 'benefit_' + Date.now(),
      name: preset.name,
      amount: preset.amount,
      type: preset.type,
      emoji: preset.emoji
    };
    const updatedBenefits = [...(settings.packageBenefits || []), newBenefit];
    setSettings(prev => ({ ...prev, packageBenefits: updatedBenefits }));
    toast({ title: 'Preset Added', description: `${preset.name} added to package.` });
  };


  // Form Draft States for Configuration Editor
  const [draftTaxConfig, setDraftTaxConfig] = useState<TaxConfig>(taxConfig);
  const [draftRecurringTemplates, setDraftRecurringTemplates] = useState<RecurringTemplate[]>(recurringTemplates);
  const [draftCreditBureaus, setDraftCreditBureaus] = useState<CreditBureauConfig[]>(creditBureaus);
  const [draftActiveSavingsTypes, setDraftActiveSavingsTypes] = useState<string[]>([]);
  const [expandedSection, setExpandedSection] = useState<'none' | 'tax' | 'recurring' | 'bureaus' | 'savings'>('none');

  useEffect(() => {
    if (isSettingsOpen) {
      setDraftTaxConfig(taxConfig);
      setDraftRecurringTemplates(recurringTemplates);
      setDraftCreditBureaus(creditBureaus);
      setDraftActiveSavingsTypes(settings.activeSavingsTypes || ALL_SAVINGS_IDS);
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
  const [newCreditScore, setNewCreditScore] = useState<{ bureau: 'experian' | 'transunion' | 'equifax'; score: number | ''; date: string }>({ bureau: 'experian', score: '', date: new Date().toISOString().split('T')[0] });

  // Form Fields State
  const [newGoal, setNewGoal] = useState<{
    name: string;
    targetAmount: number | '';
    targetDate: string;
    startDate: string;
    emoji: string;
    status: 'active' | 'archived';
  }>({ name: '', targetAmount: '', targetDate: '', startDate: '', emoji: '', status: 'active' });
  const [newContribution, setNewContribution] = useState<{
    amount: number | '';
    note: string;
    date: string;
    bankAccountId: string;
  }>({ amount: '', note: '', date: new Date().toISOString().split('T')[0], bankAccountId: '' });
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [collapsedGoalGroups, setCollapsedGoalGroups] = useState<{
    active: boolean;
    readyToSpend: boolean;
    archived: boolean;
  }>({ active: false, readyToSpend: false, archived: false });
  const [isEditGoalOpen, setIsEditGoalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const [activeAccount, setActiveAccount] = useState<BankAccount | null>(null);
  const [newAccount, setNewAccount] = useState<Omit<BankAccount, 'id'> & { balance: number | ''; annualFee: number | ''; }>({ name: '', type: 'checking', issuer: '', balance: '', annualFee: '', useCase: '', emoji: '', color: '#475569' });

  const [activeMembership, setActiveMembership] = useState<Membership | null>(null);
  const [newMembership, setNewMembership] = useState<Omit<Membership, 'id'> & { annualFee: number | ''; }>({ name: '', type: 'points', status: 'Active', annualFee: '', useCase: '' });

  const [activeRecurring, setActiveRecurring] = useState<RecurringBill | null>(null);
  const [newRecurring, setNewRecurring] = useState<Omit<RecurringBill, 'id'> & { amount: number | ''; }>({
    name: '',
    amount: '',
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
  const [newCategoryBudget, setNewCategoryBudget] = useState<number | ''>('');
  const [newCategoryGroup, setNewCategoryGroup] = useState<'needs' | 'wants' | 'savings'>('needs');
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('');
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [newBudgetItem, setNewBudgetItem] = useState<{
    name: string;
    budgeted: number;
    spent: number | '';
    linkedAccountId: string;
    emoji: string;
  }>({ name: '', budgeted: 0, spent: '', linkedAccountId: '', emoji: '' });
  const [selectedSavingsPreset, setSelectedSavingsPreset] = useState<string>('');
  const [selectedDiscretionaryPreset, setSelectedDiscretionaryPreset] = useState<string>('');
  const [selectedHousingPreset, setSelectedHousingPreset] = useState<string>('');
  const [selectedInsurancePreset, setSelectedInsurancePreset] = useState<string>('');
  const [selectedTransportPreset, setSelectedTransportPreset] = useState<string>('');
  const [selectedSubscriptionPreset, setSelectedSubscriptionPreset] = useState<string>('');
  const [subscriptionProvider, setSubscriptionProvider] = useState<string>('');
  const [selectedLoanPreset, setSelectedLoanPreset] = useState<string>('');
  const [loanProvider, setLoanProvider] = useState<string>('');
  const [selectedGiftsPreset, setSelectedGiftsPreset] = useState<string>('');
  const [selectedHealthPreset, setSelectedHealthPreset] = useState<string>('');
  const [selectedPetsPreset, setSelectedPetsPreset] = useState<string>('');
  const [selectedShoppingPreset, setSelectedShoppingPreset] = useState<string>('');
  const [selectedTravelPreset, setSelectedTravelPreset] = useState<string>('');
  const [selectedOtherPreset, setSelectedOtherPreset] = useState<string>('');
  const [selectedFamilyPreset, setSelectedFamilyPreset] = useState<string>('');
  const [selectedEducationPreset, setSelectedEducationPreset] = useState<string>('');
  const [activeBudgetItem, setActiveBudgetItem] = useState<{ id: string, name: string, budgeted: number, spent: number, categoryId: string, linkedAccountId?: string, emoji?: string } | null>(null);

  useEffect(() => {
    if (isAddItemOpen && activeCategoryId) {
      const cat = budgetCategories.find(c => c.id === activeCategoryId);
      if (cat?.group === 'savings') {
        const activePresets = SAVINGS_PRESETS.filter(p => {
          const key = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
          const activeTypes = settings.activeSavingsTypes || ALL_SAVINGS_IDS;
          return activeTypes.includes(key);
        });
        if (activePresets.length > 0) {
          setSelectedSavingsPreset(activePresets[0].name);
          setNewBudgetItem({
            name: activePresets[0].name,
            budgeted: 0,
            spent: 0,
            linkedAccountId: '',
            emoji: activePresets[0].emoji
          });
        } else {
          setSelectedSavingsPreset('custom');
          setNewBudgetItem({
            name: '',
            budgeted: 0,
            spent: 0,
            linkedAccountId: '',
            emoji: '💰'
          });
        }
      } else if (cat && isDiscretionaryCategory(cat)) {
        setSelectedDiscretionaryPreset(FOOD_ENTERTAINMENT_PRESETS[0].name);
        setNewBudgetItem({
          name: FOOD_ENTERTAINMENT_PRESETS[0].name,
          budgeted: 0,
          spent: 0,
          linkedAccountId: '',
          emoji: FOOD_ENTERTAINMENT_PRESETS[0].emoji
        });
      } else if (cat && isHousingCategory(cat)) {
        setSelectedHousingPreset(HOUSING_PRESETS[0].name);
        setNewBudgetItem({
          name: HOUSING_PRESETS[0].name,
          budgeted: 0,
          spent: 0,
          linkedAccountId: '',
          emoji: HOUSING_PRESETS[0].emoji
        });
      } else if (cat && isInsuranceCategory(cat)) {
        setSelectedInsurancePreset(INSURANCE_PRESETS[0].name);
        setNewBudgetItem({
          name: INSURANCE_PRESETS[0].name,
          budgeted: 0,
          spent: 0,
          linkedAccountId: '',
          emoji: INSURANCE_PRESETS[0].emoji
        });
      } else if (cat && isTransportCategory(cat)) {
        setSelectedTransportPreset(TRANSPORT_PRESETS[0].name);
        setNewBudgetItem({
          name: TRANSPORT_PRESETS[0].name,
          budgeted: 0,
          spent: 0,
          linkedAccountId: '',
          emoji: TRANSPORT_PRESETS[0].emoji
        });
      } else if (cat && isSubscriptionsCategory(cat)) {
        setSelectedSubscriptionPreset(SUBSCRIPTION_PRESETS[0].name);
        setSubscriptionProvider('');
        setNewBudgetItem({
          name: SUBSCRIPTION_PRESETS[0].name,
          budgeted: 0,
          spent: 0,
          linkedAccountId: '',
          emoji: SUBSCRIPTION_PRESETS[0].emoji
        });
      } else if (cat && isLoansCategory(cat)) {
        setSelectedLoanPreset(LOANS_PRESETS[0].name);
        setLoanProvider('');
        setNewBudgetItem({
          name: LOANS_PRESETS[0].name,
          budgeted: 0,
          spent: 0,
          linkedAccountId: '',
          emoji: LOANS_PRESETS[0].emoji
        });
      } else if (cat && isGiftsDonationsCategory(cat)) {
        setSelectedGiftsPreset(GIFTS_DONATIONS_PRESETS[0].name);
        setNewBudgetItem({
          name: GIFTS_DONATIONS_PRESETS[0].name,
          budgeted: 0,
          spent: 0,
          linkedAccountId: '',
          emoji: GIFTS_DONATIONS_PRESETS[0].emoji
        });
      } else if (cat && isHealthWellnessCategory(cat)) {
        setSelectedHealthPreset(HEALTH_WELLNESS_PRESETS[0].name);
        setNewBudgetItem({
          name: HEALTH_WELLNESS_PRESETS[0].name,
          budgeted: 0,
          spent: 0,
          linkedAccountId: '',
          emoji: HEALTH_WELLNESS_PRESETS[0].emoji
        });
      } else if (cat && isPetsCategory(cat)) {
        setSelectedPetsPreset(PETS_PRESETS[0].name);
        setNewBudgetItem({
          name: PETS_PRESETS[0].name,
          budgeted: 0,
          spent: 0,
          linkedAccountId: '',
          emoji: PETS_PRESETS[0].emoji
        });
      } else if (cat && isShoppingCategory(cat)) {
        setSelectedShoppingPreset(SHOPPING_PRESETS[0].name);
        setNewBudgetItem({
          name: SHOPPING_PRESETS[0].name,
          budgeted: 0,
          spent: 0,
          linkedAccountId: '',
          emoji: SHOPPING_PRESETS[0].emoji
        });
      } else if (cat && isTravelHolidaysCategory(cat)) {
        setSelectedTravelPreset(TRAVEL_HOLIDAYS_PRESETS[0].name);
        setNewBudgetItem({
          name: TRAVEL_HOLIDAYS_PRESETS[0].name,
          budgeted: 0,
          spent: 0,
          linkedAccountId: '',
          emoji: TRAVEL_HOLIDAYS_PRESETS[0].emoji
        });
      } else if (cat && isOtherCategory(cat)) {
        setSelectedOtherPreset(OTHER_PRESETS[0].name);
        setNewBudgetItem({
          name: OTHER_PRESETS[0].name,
          budgeted: 0,
          spent: 0,
          linkedAccountId: '',
          emoji: OTHER_PRESETS[0].emoji
        });
      } else if (cat && isFamilyKidsCategory(cat)) {
        setSelectedFamilyPreset(FAMILY_KIDS_PRESETS[0].name);
        setNewBudgetItem({
          name: FAMILY_KIDS_PRESETS[0].name,
          budgeted: 0,
          spent: 0,
          linkedAccountId: '',
          emoji: FAMILY_KIDS_PRESETS[0].emoji
        });
      } else if (cat && isEducationCareerCategory(cat)) {
        setSelectedEducationPreset(EDUCATION_CAREER_PRESETS[0].name);
        setNewBudgetItem({
          name: EDUCATION_CAREER_PRESETS[0].name,
          budgeted: 0,
          spent: 0,
          linkedAccountId: '',
          emoji: EDUCATION_CAREER_PRESETS[0].emoji
        });
      } else {
        setSelectedSavingsPreset('');
        setSelectedDiscretionaryPreset('');
        setSelectedHousingPreset('');
        setSelectedInsurancePreset('');
        setSelectedTransportPreset('');
        setSelectedSubscriptionPreset('');
        setSubscriptionProvider('');
        setSelectedLoanPreset('');
        setLoanProvider('');
        setSelectedGiftsPreset('');
        setSelectedHealthPreset('');
        setSelectedPetsPreset('');
        setSelectedShoppingPreset('');
        setSelectedTravelPreset('');
        setSelectedOtherPreset('');
        setSelectedFamilyPreset('');
        setSelectedEducationPreset('');
        setNewBudgetItem({ name: '', budgeted: 0, spent: 0, linkedAccountId: '', emoji: '' });
      }
    }
  }, [isAddItemOpen, activeCategoryId, budgetCategories, settings]);

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
  const fetchSupabaseData = async () => {
    if (!isAdmin) return;
      setLoadingDb(true);
      try {
        const [
          settingsRes,
          userHolidaysRes,
          goalsRes,
          contributionsRes,
          bankAccountsRes,
          membershipsRes,
          creditScoresRes,
          budgetCategoriesRes,
          budgetItemsRes,
          recurringBillsRes,
          transactionsRes,
          taxConfigsRes,
          recurringTemplatesRes,
          creditBureausRes,
          holidayDefaultsRes,
          budgetPresetsRes
        ] = await Promise.all([
          supabase.from('finance_settings').select('*'),
          supabase.from('finance_user_holidays').select('*'),
          supabase.from('finance_goals').select('*'),
          supabase.from('finance_goal_contributions').select('*'),
          supabase.from('finance_bank_accounts').select('*'),
          supabase.from('finance_memberships').select('*'),
          supabase.from('finance_credit_scores').select('*'),
          supabase.from('finance_budget_categories').select('*'),
          supabase.from('finance_budget_items').select('*'),
          supabase.from('finance_recurring_bills').select('*'),
          supabase.from('finance_transactions').select('*'),
          supabase.from('finance_tax_configs').select('*'),
          supabase.from('finance_recurring_templates').select('*'),
          supabase.from('finance_credit_bureaus').select('*'),
          supabase.from('finance_holiday_defaults').select('*'),
          supabase.from('finance_budget_presets').select('*')
        ]);

        const errors = [
          settingsRes.error, userHolidaysRes.error, goalsRes.error, contributionsRes.error,
          bankAccountsRes.error, membershipsRes.error, creditScoresRes.error,
          budgetCategoriesRes.error, budgetItemsRes.error, recurringBillsRes.error,
          transactionsRes.error, taxConfigsRes.error, recurringTemplatesRes.error,
          creditBureausRes.error, holidayDefaultsRes.error, budgetPresetsRes.error
        ].filter(Boolean);
        if (errors.length > 0) {
          throw errors[0];
        }

        const userSettings = settingsRes.data?.find(d => !d.is_default);
        const defaultSettings = settingsRes.data?.find(d => d.is_default);
        const activeSettings = userSettings || defaultSettings;

        const userHolidaysList = userHolidaysRes.data?.filter(d => !d.is_default) || [];
        const defaultHolidaysList = userHolidaysRes.data?.filter(d => d.is_default) || [];
        const holidays = userHolidaysList.length > 0 ? userHolidaysList : defaultHolidaysList;

        const mappedHolidays: UserHoliday[] = holidays.map(h => ({
          id: h.id,
          startDate: h.start_date,
          endDate: h.end_date,
          occasion: h.occasion || '',
          count: Number(h.count) || 0
        }));

        if (activeSettings) {
          const loadedSettings: FinanceSettings = {
            grossSalary: Number(activeSettings.gross_salary) || 0,
            pensionType: (activeSettings.pension_type || 'net_pay') as any,
            personalPensionPercent: Number(activeSettings.personal_pension_percent) || 0,
            employerPensionPercent: Number(activeSettings.employer_pension_percent) || 0,
            studentLoanPlan: (activeSettings.student_loan_plan || 'none') as any,
            taxCode: activeSettings.tax_code || '1257L',
            personalAllowance: Number(activeSettings.personal_allowance) || 12570,
            weekends: Number(activeSettings.weekends) || 104,
            bankHolidays: Number(activeSettings.bank_holidays) || 8,
            workHolidays: Number(activeSettings.work_holidays) || 25,
            workingHoursPerDay: Number(activeSettings.working_hours_per_day) || 7.5,
            taxYear: Number(activeSettings.tax_year) || 2026,
            ukRegion: (activeSettings.uk_region || 'england-and-wales') as any,
            payDayOfMonth: activeSettings.pay_day_of_month || 25,
            paydaySchedule: (activeSettings.payday_schedule || 'monthly_date') as any,
            paydayWeekday: activeSettings.payday_weekday !== null ? activeSettings.payday_weekday : 5,
            paydayBiweeklyAnchor: activeSettings.payday_biweekly_anchor || '2026-01-02',
            activeSavingsTypes: (activeSettings.active_savings_types || []) as any[],
            holidaysByUser: mappedHolidays
          };
          setSettings(prev => ({
            ...prev,
            ...loadedSettings
          }));
          setPayDayInput((loadedSettings.payDayOfMonth || 25).toString());
          setPaydaySchedule(loadedSettings.paydaySchedule || 'monthly_date');
          setPaydayWeekday(loadedSettings.paydayWeekday !== undefined ? loadedSettings.paydayWeekday : 5);
          setPaydayBiweeklyAnchor(loadedSettings.paydayBiweeklyAnchor || '2026-01-02');
        }

        const userGoals = goalsRes.data?.filter(d => !d.is_default) || [];
        const defaultGoals = goalsRes.data?.filter(d => d.is_default) || [];
        const activeGoals = userGoals.length > 0 ? userGoals : defaultGoals;
        const activeContributions = contributionsRes.data || [];

        const mappedGoals: Goal[] = activeGoals.map(g => {
          const goalContribs = activeContributions
            .filter(c => c.goal_id === g.id && c.is_default === g.is_default)
            .map(c => ({
              id: c.id,
              amount: Number(c.amount) || 0,
              date: c.date,
              note: c.note || undefined,
              bankAccountId: c.bank_account_id || undefined
            }));
          return {
            id: g.id,
            name: g.name,
            targetAmount: Number(g.target_amount) || 0,
            currentAmount: Number(g.current_amount) || 0,
            targetDate: g.target_date || '',
            startDate: g.start_date || undefined,
            status: (g.status as 'active' | 'archived') || 'active',
            emoji: g.emoji || undefined,
            contributions: goalContribs
          };
        });
        setGoals(mappedGoals);
        if (mappedGoals.length > 0) setSelectedGoalId(mappedGoals[0].id);

        const userAccounts = bankAccountsRes.data?.filter(d => !d.is_default) || [];
        const defaultAccounts = bankAccountsRes.data?.filter(d => d.is_default) || [];
        const activeAccounts = userAccounts.length > 0 ? userAccounts : defaultAccounts;

        const mappedBankAccounts: BankAccount[] = activeAccounts.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type as any,
          issuer: a.issuer || '',
          balance: Number(a.balance) || 0,
          annualFee: Number(a.annual_fee) || 0,
          useCase: a.use_case || undefined,
          emoji: a.emoji || undefined,
          color: a.color || undefined
        }));
        setBankAccounts(mappedBankAccounts);

        const userMemberships = membershipsRes.data?.filter(d => !d.is_default) || [];
        const defaultMemberships = membershipsRes.data?.filter(d => d.is_default) || [];
        const activeMemberships = userMemberships.length > 0 ? userMemberships : defaultMemberships;

        const mappedMemberships: Membership[] = activeMemberships.map(m => ({
          id: m.id,
          name: m.name,
          type: m.type as any,
          status: m.status || '',
          annualFee: Number(m.annual_fee) || 0,
          useCase: m.use_case || undefined
        }));
        setMemberships(mappedMemberships);

        const userCreditScores = creditScoresRes.data?.filter(d => !d.is_default) || [];
        const defaultCreditScores = creditScoresRes.data?.filter(d => d.is_default) || [];
        const activeCreditScores = userCreditScores.length > 0 ? userCreditScores : defaultCreditScores;

        const scoresObj: CreditScores = {
          experian: activeCreditScores.filter(s => s.bureau === 'experian').map(s => ({ id: s.id, date: s.date, score: s.score })),
          transunion: activeCreditScores.filter(s => s.bureau === 'transunion').map(s => ({ id: s.id, date: s.date, score: s.score })),
          equifax: activeCreditScores.filter(s => s.bureau === 'equifax').map(s => ({ id: s.id, date: s.date, score: s.score }))
        };
        setCreditScores(scoresObj);

        const userBudgetCats = budgetCategoriesRes.data?.filter(d => !d.is_default && !d.is_template) || [];
        const defaultBudgetCats = budgetCategoriesRes.data?.filter(d => d.is_default && !d.is_template) || [];
        const activeBudgetCats = userBudgetCats.length > 0 ? userBudgetCats : defaultBudgetCats;
        const budgetItems = budgetItemsRes.data || [];

        const mappedBudgetCategories: BudgetCategory[] = activeBudgetCats.map(cat => {
          const catItems = budgetItems
            .filter(item => item.category_id === cat.id && item.is_default === cat.is_default && item.is_template === cat.is_template)
            .map(item => ({
              id: item.id,
              name: item.name,
              budgeted: Number(item.budgeted) || 0,
              spent: Number(item.spent) || 0,
              linkedAccountId: item.linked_account_id || undefined,
              emoji: item.emoji || undefined
            }));
          return {
            id: cat.id,
            name: cat.name,
            budgeted: Number(cat.budgeted) || 0,
            group: (cat.group_type || undefined) as any,
            items: catItems,
            emoji: cat.emoji || undefined
          };
        });

        if (mappedBudgetCategories.length > 0) {
          setBudgetCategories(sanitizeBudgetCategories(mergeMissingDefaultCategories(mappedBudgetCategories, DEFAULT_BUDGET_CATEGORIES)));
        } else {
          setBudgetCategories(prev => prev.length > 0 ? prev : sanitizeBudgetCategories(DEFAULT_BUDGET_CATEGORIES));
        }

        const userRecurrings = recurringBillsRes.data?.filter(d => !d.is_default) || [];
        const defaultRecurrings = recurringBillsRes.data?.filter(d => d.is_default) || [];
        const activeRecurrings = userRecurrings.length > 0 ? userRecurrings : defaultRecurrings;

        const mappedRecurrings: RecurringBill[] = activeRecurrings.map(r => ({
          id: r.id,
          name: r.name,
          amount: Number(r.amount) || 0,
          dueDate: r.due_date,
          isPaid: r.is_paid,
          frequency: r.frequency as any,
          dueMonth: r.due_month || undefined,
          emoji: r.emoji || undefined,
          category: r.category || undefined,
          tag: r.tag || undefined,
          linkedBudgetItemId: r.linked_budget_item_id || undefined,
          linkedAccountId: r.linked_account_id || undefined
        }));
        setRecurrings(mappedRecurrings);

        const userTransactions = transactionsRes.data?.filter(d => !d.is_default) || [];
        const defaultTransactions = transactionsRes.data?.filter(d => d.is_default) || [];
        const activeTransactions = userTransactions.length > 0 ? userTransactions : defaultTransactions;

        const mappedTransactions: MockTransaction[] = activeTransactions.map(t => ({
          id: t.id,
          name: t.name,
          category: t.category || '',
          amount: Number(t.amount) || 0,
          date: t.date,
          isReviewed: t.is_reviewed,
          accountId: t.account_id || t.bank_account_id || undefined,
          bankAccountId: t.bank_account_id || t.account_id || undefined,
          goalId: t.goal_id || undefined,
          notes: t.notes || undefined,
          tags: t.tags || undefined,
          isRecurring: t.is_recurring || undefined
        }));
        setMockTransactions(mappedTransactions);

        const userTaxConfig = taxConfigsRes.data?.find(d => !d.is_default);
        const defaultTaxConfig = taxConfigsRes.data?.find(d => d.is_default);
        const activeTaxConfig = userTaxConfig || defaultTaxConfig;

        if (activeTaxConfig) {
          const mappedTaxConfig: TaxConfig = {
            studentLoanThresholds: activeTaxConfig.student_loan_thresholds as any,
            studentLoanRates: activeTaxConfig.student_loan_rates as any,
            incomeTaxBands: activeTaxConfig.income_tax_bands as any,
            nationalInsuranceBands: activeTaxConfig.national_insurance_bands as any
          };
          setTaxConfig(mappedTaxConfig);
        }

        const userTemplates = recurringTemplatesRes.data?.filter(d => !d.is_default) || [];
        const defaultTemplates = recurringTemplatesRes.data?.filter(d => d.is_default) || [];
        const activeTemplates = userTemplates.length > 0 ? userTemplates : defaultTemplates;

        const mappedTemplates: RecurringTemplate[] = activeTemplates.map(t => ({
          name: t.name,
          category: t.category,
          emoji: t.emoji || '',
          tag: t.tag || '',
          defaultAmount: Number(t.default_amount) || 0,
          frequency: t.frequency as any,
          linkedBudgetItemId: t.linked_budget_item_id || '',
          budgetCategoryName: t.budget_category_name || undefined
        }));
        if (mappedTemplates.length > 0) {
          setRecurringTemplates(mappedTemplates);
        } else {
          setRecurringTemplates(prev => prev.length > 0 ? prev : DEFAULT_RECURRING_TEMPLATES);
        }

        const userBureaus = creditBureausRes.data?.filter(d => !d.is_default) || [];
        const defaultBureaus = creditBureausRes.data?.filter(d => d.is_default) || [];
        const activeBureaus = userBureaus.length > 0 ? userBureaus : defaultBureaus;

        const mappedBureaus: CreditBureauConfig[] = activeBureaus.map(b => ({
          key: b.key as any,
          label: b.label,
          emoji: b.emoji || '',
          color: b.color || '',
          maxScore: b.max_score,
          gradient: b.gradient || ''
        }));
        setCreditBureaus(mappedBureaus);

        const userHolidayDefaults = holidayDefaultsRes.data?.filter(d => !d.is_default) || [];
        const defaultHolidayDefaults = holidayDefaultsRes.data?.filter(d => d.is_default) || [];
        const activeHolidayDefaults = userHolidayDefaults.length > 0 ? userHolidayDefaults : defaultHolidayDefaults;

        const mappedHolidayDefaults: Record<number, { count: number; dates: string; occasion: string }> = {};
        activeHolidayDefaults.forEach(hd => {
          mappedHolidayDefaults[hd.month_index] = {
            count: Number(hd.count) || 0,
            dates: hd.dates || '',
            occasion: hd.occasion || ''
          };
        });
        setHolidayDefaults(mappedHolidayDefaults);

        const userDefaultBudgetCats = budgetCategoriesRes.data?.filter(d => !d.is_default && d.is_template) || [];
        const defaultDefaultBudgetCats = budgetCategoriesRes.data?.filter(d => d.is_default && d.is_template) || [];
        const activeDefaultBudgetCats = userDefaultBudgetCats.length > 0 ? userDefaultBudgetCats : defaultDefaultBudgetCats;

        const mappedDefaultBudgetCategories: BudgetCategory[] = activeDefaultBudgetCats.map(cat => {
          const catItems = budgetItems
            .filter(item => item.category_id === cat.id && item.is_default === cat.is_default && item.is_template === cat.is_template)
            .map(item => ({
              id: item.id,
              name: item.name,
              budgeted: Number(item.budgeted) || 0,
              spent: Number(item.spent) || 0,
              linkedAccountId: item.linked_account_id || undefined,
              emoji: item.emoji || undefined
            }));
          return {
            id: cat.id,
            name: cat.name,
            budgeted: Number(cat.budgeted) || 0,
            group: (cat.group_type || undefined) as any,
            items: catItems,
            emoji: cat.emoji || undefined
          };
        });
        if (mappedDefaultBudgetCategories.length > 0) {
          setDefaultBudgetCategories(mappedDefaultBudgetCategories);
        } else {
          setDefaultBudgetCategories(prev => prev.length > 0 ? prev : DEFAULT_CATEGORY_TEMPLATES);
        }

        const userPresets = budgetPresetsRes.data?.filter(d => !d.is_default) || [];
        const defaultPresets = budgetPresetsRes.data?.filter(d => d.is_default) || [];
        const activePresets = userPresets.length > 0 ? userPresets : defaultPresets;

        const presetsObj: Record<string, CategoryPreset[]> = {};
        activePresets.forEach(p => {
          if (!presetsObj[p.preset_type]) {
            presetsObj[p.preset_type] = [];
          }
          presetsObj[p.preset_type].push({
            name: p.name,
            emoji: p.emoji || '',
            group: (p.group_type || 'wants') as any
          });
        });

        if (activePresets.length > 0) {
          setPresets(prev => {
            const merged = {
              ...prev,
              ...presetsObj
            };
            localStorage.setItem('finance_budget_presets', JSON.stringify(merged));
            return merged;
          });
        } else {
          saveDataToSupabase('budget_presets', ALL_PRESETS_FALLBACK);
        }

        // Reconstruct databaseDefaults map
        const defaultsMap: Record<string, any> = {};
        if (defaultSettings) {
          defaultsMap['settings'] = {
            grossSalary: Number(defaultSettings.gross_salary) || 0,
            pensionType: defaultSettings.pension_type || 'net_pay',
            personalPensionPercent: Number(defaultSettings.personal_pension_percent) || 0,
            employer_pension_percent: Number(defaultSettings.employer_pension_percent) || 0,
            studentLoanPlan: defaultSettings.student_loan_plan || 'none',
            taxCode: defaultSettings.tax_code || '1257L',
            personalAllowance: Number(defaultSettings.personal_allowance) || 12570,
            weekends: Number(defaultSettings.weekends) || 104,
            bankHolidays: Number(defaultSettings.bank_holidays) || 8,
            workHolidays: Number(defaultSettings.work_holidays) || 25,
            workingHoursPerDay: Number(defaultSettings.working_hours_per_day) || 7.5,
            taxYear: Number(defaultSettings.tax_year) || 2026,
            ukRegion: defaultSettings.uk_region || 'england-and-wales',
            payDayOfMonth: defaultSettings.pay_day_of_month || 25,
            paydaySchedule: defaultSettings.payday_schedule || 'monthly_date',
            paydayWeekday: defaultSettings.payday_weekday !== null ? defaultSettings.payday_weekday : 5,
            paydayBiweeklyAnchor: defaultSettings.payday_biweekly_anchor || '2026-01-02',
            activeSavingsTypes: defaultSettings.active_savings_types || [],
            holidaysByUser: defaultHolidaysList.map(h => ({
              id: h.id,
              startDate: h.start_date,
              endDate: h.end_date,
              occasion: h.occasion || '',
              count: Number(h.count) || 0
            }))
          };
        }
        defaultsMap['goals'] = defaultGoals.map(g => ({
          id: g.id,
          name: g.name,
          targetAmount: Number(g.target_amount) || 0,
          currentAmount: Number(g.current_amount) || 0,
          targetDate: g.target_date || '',
          startDate: g.start_date || undefined,
          status: (g.status as 'active' | 'archived') || 'active',
          emoji: g.emoji || undefined,
          contributions: activeContributions
            .filter(c => c.goal_id === g.id && c.is_default)
            .map(c => ({
              id: c.id,
              amount: Number(c.amount) || 0,
              date: c.date,
              note: c.note || undefined,
              bankAccountId: c.bank_account_id || undefined
            }))
        }));
        defaultsMap['accounts'] = {
          bankAccounts: defaultAccounts.map(a => ({
            id: a.id,
            name: a.name,
            type: a.type as any,
            issuer: a.issuer || '',
            balance: Number(a.balance) || 0,
            annualFee: Number(a.annual_fee) || 0,
            useCase: a.use_case || undefined,
            emoji: a.emoji || undefined,
            color: a.color || undefined
          })),
          memberships: defaultMemberships.map(m => ({
            id: m.id,
            name: m.name,
            type: m.type as any,
            status: m.status || '',
            annualFee: Number(m.annual_fee) || 0,
            useCase: m.use_case || undefined
          })),
          creditScores: {
            experian: defaultCreditScores.filter(s => s.bureau === 'experian').map(s => ({ id: s.id, date: s.date, score: s.score })),
            transunion: defaultCreditScores.filter(s => s.bureau === 'transunion').map(s => ({ id: s.id, date: s.date, score: s.score })),
            equifax: defaultCreditScores.filter(s => s.bureau === 'equifax').map(s => ({ id: s.id, date: s.date, score: s.score }))
          }
        };
        defaultsMap['budget'] = defaultBudgetCats.map(cat => ({
          id: cat.id,
          name: cat.name,
          budgeted: Number(cat.budgeted) || 0,
          group: cat.group_type as any,
          emoji: cat.emoji || undefined,
          items: budgetItems
            .filter(item => item.category_id === cat.id && item.is_default && !item.is_template)
            .map(item => ({
              id: item.id,
              name: item.name,
              budgeted: Number(item.budgeted) || 0,
              spent: Number(item.spent) || 0,
              linkedAccountId: item.linked_account_id || undefined,
              emoji: item.emoji || undefined
            }))
        }));
        defaultsMap['recurrings'] = defaultRecurrings.map(r => ({
          id: r.id,
          name: r.name,
          amount: Number(r.amount) || 0,
          dueDate: r.due_date,
          isPaid: r.is_paid,
          frequency: r.frequency as any,
          dueMonth: r.due_month || undefined,
          emoji: r.emoji || undefined,
          category: r.category || undefined,
          tag: r.tag || undefined,
          linkedBudgetItemId: r.linked_budget_item_id || undefined,
          linkedAccountId: r.linked_account_id || undefined
        }));
        defaultsMap['transactions'] = defaultTransactions.map(t => ({
          id: t.id,
          name: t.name,
          category: t.category || '',
          amount: Number(t.amount) || 0,
          date: t.date,
          isReviewed: t.is_reviewed,
          accountId: t.account_id || t.bank_account_id || undefined,
          bankAccountId: t.bank_account_id || t.account_id || undefined,
          goalId: t.goal_id || undefined,
          notes: t.notes || undefined,
          tags: t.tags || undefined,
          isRecurring: t.is_recurring || undefined
        }));
        if (defaultTaxConfig) {
          defaultsMap['tax_config'] = {
            studentLoanThresholds: defaultTaxConfig.student_loan_thresholds,
            studentLoanRates: defaultTaxConfig.student_loan_rates,
            incomeTaxBands: defaultTaxConfig.income_tax_bands,
            nationalInsuranceBands: defaultTaxConfig.national_insurance_bands
          };
        }
        defaultsMap['recurring_templates'] = defaultTemplates.map(t => ({
          name: t.name,
          category: t.category,
          emoji: t.emoji || '',
          tag: t.tag || '',
          defaultAmount: Number(t.default_amount) || 0,
          frequency: t.frequency as any,
          linkedBudgetItemId: t.linked_budget_item_id || '',
          budgetCategoryName: t.budget_category_name || undefined
        }));
        defaultsMap['credit_bureaus'] = defaultBureaus.map(b => ({
          key: b.key,
          label: b.label,
          emoji: b.emoji || '',
          color: b.color || '',
          maxScore: b.max_score,
          gradient: b.gradient || ''
        }));
        defaultsMap['holiday_defaults'] = mappedHolidayDefaults;
        defaultsMap['default_budget_categories'] = defaultDefaultBudgetCats.map(cat => ({
          id: cat.id,
          name: cat.name,
          budgeted: Number(cat.budgeted) || 0,
          group: cat.group_type as any,
          emoji: cat.emoji || undefined,
          items: budgetItems
            .filter(item => item.category_id === cat.id && item.is_default && item.is_template)
            .map(item => ({
              id: item.id,
              name: item.name,
              budgeted: Number(item.budgeted) || 0,
              spent: Number(item.spent) || 0,
              linkedAccountId: item.linked_account_id || undefined,
              emoji: item.emoji || undefined
            }))
        }));
        defaultsMap['budget_presets'] = presetsObj;
        setDatabaseDefaults(defaultsMap);

      } catch (err) {
        console.error('Error fetching settings from Supabase:', err);
      } finally {
        setLoadingDb(false);
      }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchSupabaseData();
    }
  }, [isAdmin]);

  // ==========================================
  // HANDLERS: TRUELAYER BANK SYNC
  // ==========================================

  const callTrueLayerEdgeFunction = async (action: string, payload: any = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("User session not found. Please log in again.");
    }
    
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/truelayer-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
      },
      body: JSON.stringify({
        action,
        ...payload
      })
    });
    
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Server returned status ${response.status}`);
    }
    return data;
  };

  const checkTrueLayerConnection = async () => {
    try {
      const data = await callTrueLayerEdgeFunction('check_connection');
      setTrueLayerStatus(data);
    } catch (err: any) {
      console.error('Error checking TrueLayer connection:', err);
    }
  };

  const connectTrueLayer = async () => {
    setIsConnectingTrueLayer(true);
    try {
      const state = Math.random().toString(36).substring(2, 15);
      const redirectUri = `${window.location.origin}/finance`;
      
      const data = await callTrueLayerEdgeFunction('get_auth_url', {
        redirect_uri: redirectUri,
        state: state
      });
      
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Failed to get auth URL');
      }
    } catch (err: any) {
      console.error('Error connecting to TrueLayer:', err);
      toast({
        title: "Connection Failed",
        description: err.message || "Failed to initiate TrueLayer connection",
        variant: "destructive"
      });
    } finally {
      setIsConnectingTrueLayer(false);
    }
  };

  const disconnectTrueLayer = async () => {
    try {
      await callTrueLayerEdgeFunction('disconnect');
      toast({
        title: "Disconnected",
        description: "Bank connection removed successfully.",
      });
      checkTrueLayerConnection();
    } catch (err: any) {
      console.error('Error disconnecting TrueLayer:', err);
      toast({
        title: "Disconnection Failed",
        description: err.message || "Failed to disconnect",
        variant: "destructive"
      });
    }
  };

  const syncTrueLayer = async () => {
    setIsSyncingTrueLayer(true);
    try {
      const data = await callTrueLayerEdgeFunction('sync_transactions');
      
      toast({
        title: "Sync Completed",
        description: `Successfully synced ${data.synced_accounts} accounts and ${data.synced_transactions} transactions.`,
      });
      await fetchSupabaseData();
    } catch (err: any) {
      console.error('Error syncing TrueLayer:', err);
      toast({
        title: "Sync Failed",
        description: err.message || "Failed to synchronize transactions",
        variant: "destructive"
      });
    } finally {
      setIsSyncingTrueLayer(false);
    }
  };

  const callbackProcessed = useRef(false);

  const handleTrueLayerCallback = async (code: string) => {
    if (callbackProcessed.current) return;
    callbackProcessed.current = true;
    setIsConnectingTrueLayer(true);
    try {
      const redirectUri = `${window.location.origin}/finance`;
      await callTrueLayerEdgeFunction('exchange_code', {
        code: code,
        redirect_uri: redirectUri
      });

      toast({
        title: "Bank Linked Successfully",
        description: "Your bank has been connected. Initializing transaction sync...",
      });
      
      window.history.replaceState({}, document.title, window.location.pathname);
      await checkTrueLayerConnection();
      await syncTrueLayer();
    } catch (err: any) {
      console.error('Error in TrueLayer callback:', err);
      toast({
        title: "Verification Failed",
        description: err.message || "Could not verify bank authentication code",
        variant: "destructive"
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    } finally {
      setIsConnectingTrueLayer(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      handleTrueLayerCallback(code);
    } else {
      checkTrueLayerConnection();
    }
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
    localStorage.setItem('finance_investment_holdings', JSON.stringify(investmentHoldings));
  }, [investmentHoldings]);
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

  useEffect(() => {
    localStorage.setItem('finance_time_spent_inputs', JSON.stringify(timeSpentInputs));
  }, [timeSpentInputs]);

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
      if (key === 'settings') {
        const settingsObj = contentData as FinanceSettings;
        const { data: existingSettings } = await supabase
          .from('finance_settings')
          .select('id')
          .eq('is_default', false)
          .maybeSingle();

        const settingsRow = {
          is_default: false,
          gross_salary: settingsObj.grossSalary,
          pension_type: settingsObj.pensionType,
          personal_pension_percent: settingsObj.personalPensionPercent,
          employer_pension_percent: settingsObj.employerPensionPercent,
          student_loan_plan: settingsObj.studentLoanPlan,
          tax_code: settingsObj.taxCode,
          personal_allowance: settingsObj.personalAllowance,
          weekends: settingsObj.weekends,
          bank_holidays: settingsObj.bankHolidays,
          work_holidays: settingsObj.workHolidays,
          working_hours_per_day: settingsObj.workingHoursPerDay,
          tax_year: settingsObj.taxYear,
          uk_region: settingsObj.ukRegion,
          pay_day_of_month: settingsObj.payDayOfMonth || null,
          payday_schedule: settingsObj.paydaySchedule || null,
          payday_weekday: settingsObj.paydayWeekday !== undefined ? settingsObj.paydayWeekday : null,
          payday_biweekly_anchor: settingsObj.paydayBiweeklyAnchor || null,
          active_savings_types: settingsObj.activeSavingsTypes || [],
          updated_at: new Date().toISOString()
        };

        if (existingSettings?.id) {
          await supabase.from('finance_settings').update(settingsRow).eq('id', existingSettings.id);
        } else {
          await supabase.from('finance_settings').insert(settingsRow);
        }

        await supabase.from('finance_user_holidays').delete().eq('is_default', false);
        const holidaysList = Array.isArray(settingsObj.holidaysByUser)
          ? settingsObj.holidaysByUser
          : Object.values(settingsObj.holidaysByUser || {});
        if (holidaysList.length > 0) {
          await supabase.from('finance_user_holidays').insert(holidaysList.map(h => ({
            id: h.id,
            is_default: false,
            start_date: h.startDate,
            end_date: h.endDate,
            occasion: h.occasion || null,
            count: h.count
          })));
        }
      } else if (key === 'goals') {
        const goalsList = contentData as Goal[];
        await supabase.from('finance_goal_contributions').delete().eq('is_default', false);
        await supabase.from('finance_goals').delete().eq('is_default', false);
        if (goalsList.length > 0) {
          await supabase.from('finance_goals').insert(goalsList.map(g => ({
            id: g.id,
            is_default: false,
            name: g.name,
            target_amount: g.targetAmount,
            current_amount: g.currentAmount,
            target_date: g.targetDate || null,
            start_date: g.startDate || null,
            status: g.status || 'active',
            emoji: g.emoji || null
          })));
          const contribs = goalsList.flatMap(g => (g.contributions || []).map(c => ({
            id: c.id,
            is_default: false,
            goal_id: g.id,
            amount: c.amount,
            date: c.date,
            note: c.note || null,
            bank_account_id: c.bankAccountId || null
          })));
          if (contribs.length > 0) {
            await supabase.from('finance_goal_contributions').insert(contribs);
          }
        }
      } else if (key === 'accounts') {
        const accsObj = contentData as { bankAccounts: BankAccount[]; memberships: Membership[]; creditScores: CreditScores };
        await supabase.from('finance_bank_accounts').delete().eq('is_default', false);
        if (accsObj.bankAccounts?.length > 0) {
          await supabase.from('finance_bank_accounts').insert(accsObj.bankAccounts.map(a => ({
            id: a.id,
            is_default: false,
            name: a.name,
            type: a.type,
            issuer: a.issuer || null,
            balance: a.balance,
            annual_fee: a.annualFee,
            use_case: a.useCase || null,
            emoji: a.emoji || null,
            color: a.color || null
          })));
        }
        await supabase.from('finance_memberships').delete().eq('is_default', false);
        if (accsObj.memberships?.length > 0) {
          await supabase.from('finance_memberships').insert(accsObj.memberships.map(m => ({
            id: m.id,
            is_default: false,
            name: m.name,
            type: m.type,
            status: m.status || null,
            annual_fee: m.annualFee,
            use_case: m.useCase || null
          })));
        }
        await supabase.from('finance_credit_scores').delete().eq('is_default', false);
        const scores = [
          ...(accsObj.creditScores?.experian || []).map(s => ({ ...s, bureau: 'experian' })),
          ...(accsObj.creditScores?.transunion || []).map(s => ({ ...s, bureau: 'transunion' })),
          ...(accsObj.creditScores?.equifax || []).map(s => ({ ...s, bureau: 'equifax' }))
        ];
        if (scores.length > 0) {
          await supabase.from('finance_credit_scores').insert(scores.map(s => ({
            id: s.id,
            is_default: false,
            bureau: s.bureau,
            date: s.date,
            score: s.score
          })));
        }
      } else if (key === 'budget') {
        const budgetCats = contentData as BudgetCategory[];
        await supabase.from('finance_budget_items').delete().eq('is_default', false).eq('is_template', false);
        await supabase.from('finance_budget_categories').delete().eq('is_default', false).eq('is_template', false);
        if (budgetCats.length > 0) {
          await supabase.from('finance_budget_categories').insert(budgetCats.map(c => ({
            id: c.id,
            is_default: false,
            is_template: false,
            name: c.name,
            budgeted: c.budgeted,
            group_type: c.group || null,
            emoji: c.emoji || null
          })));
          const items = budgetCats.flatMap(c => (c.items || []).map(i => ({
            id: i.id,
            is_default: false,
            is_template: false,
            category_id: c.id,
            name: i.name,
            budgeted: i.budgeted,
            spent: i.spent,
            linked_account_id: i.linkedAccountId || null,
            emoji: i.emoji || null
          })));
          if (items.length > 0) {
            await supabase.from('finance_budget_items').insert(items);
          }
        }
      } else if (key === 'recurrings') {
        const recurringsList = contentData as RecurringBill[];
        await supabase.from('finance_recurring_bills').delete().eq('is_default', false);
        if (recurringsList.length > 0) {
          await supabase.from('finance_recurring_bills').insert(recurringsList.map(r => ({
            id: r.id,
            is_default: false,
            name: r.name,
            amount: r.amount,
            due_date: r.dueDate,
            is_paid: r.isPaid,
            frequency: r.frequency,
            due_month: r.dueMonth || null,
            emoji: r.emoji || null,
            category: r.category || null,
            tag: r.tag || null,
            linked_budget_item_id: r.linkedBudgetItemId || null,
            linked_account_id: r.linkedAccountId || null
          })));
        }
      } else if (key === 'transactions') {
        const txList = contentData as MockTransaction[];
        await supabase.from('finance_transactions').delete().eq('is_default', false);
        if (txList.length > 0) {
          await supabase.from('finance_transactions').insert(txList.map(t => ({
            id: t.id,
            is_default: false,
            name: t.name,
            category: t.category || null,
            amount: t.amount,
            date: t.date,
            is_reviewed: t.isReviewed,
            account_id: t.accountId || t.bankAccountId || null,
            bank_account_id: t.bankAccountId || t.accountId || null,
            goal_id: t.goalId || null,
            notes: t.notes || null,
            tags: t.tags || null,
            is_recurring: t.isRecurring || false
          })));
        }
      } else if (key === 'tax_config') {
        const tcObj = contentData as TaxConfig;
        const { data: existingTc } = await supabase
          .from('finance_tax_configs')
          .select('id')
          .eq('is_default', false)
          .maybeSingle();

        const tcRow = {
          is_default: false,
          student_loan_thresholds: tcObj.studentLoanThresholds as any,
          student_loan_rates: tcObj.studentLoanRates as any,
          income_tax_bands: tcObj.incomeTaxBands as any,
          national_insurance_bands: tcObj.nationalInsuranceBands as any,
          updated_at: new Date().toISOString()
        };

        if (existingTc?.id) {
          await supabase.from('finance_tax_configs').update(tcRow).eq('id', existingTc.id);
        } else {
          await supabase.from('finance_tax_configs').insert(tcRow);
        }
      } else if (key === 'recurring_templates') {
        const templatesList = contentData as RecurringTemplate[];
        await supabase.from('finance_recurring_templates').delete().eq('is_default', false);
        if (templatesList.length > 0) {
          await supabase.from('finance_recurring_templates').insert(templatesList.map(t => ({
            is_default: false,
            name: t.name,
            category: t.category,
            emoji: t.emoji || null,
            tag: t.tag || null,
            default_amount: t.defaultAmount,
            frequency: t.frequency,
            linked_budget_item_id: t.linkedBudgetItemId || null,
            budget_category_name: t.budgetCategoryName || null
          })));
        }
      } else if (key === 'credit_bureaus') {
        const bureausList = contentData as CreditBureauConfig[];
        await supabase.from('finance_credit_bureaus').delete().eq('is_default', false);
        if (bureausList.length > 0) {
          await supabase.from('finance_credit_bureaus').insert(bureausList.map(b => ({
            is_default: false,
            key: b.key,
            label: b.label,
            emoji: b.emoji || null,
            color: b.color || null,
            max_score: b.maxScore,
            gradient: b.gradient || null
          })));
        }
      } else if (key === 'holiday_defaults') {
        const hdObj = contentData as Record<number, { count: number; dates: string; occasion: string }>;
        await supabase.from('finance_holiday_defaults').delete().eq('is_default', false);
        const hdRows = Object.entries(hdObj).map(([month, details]) => ({
          is_default: false,
          month_index: parseInt(month, 10),
          count: details.count,
          dates: details.dates || null,
          occasion: details.occasion || null
        }));
        if (hdRows.length > 0) {
          await supabase.from('finance_holiday_defaults').insert(hdRows);
        }
      } else if (key === 'default_budget_categories') {
        const defaultBudgetCats = contentData as BudgetCategory[];
        await supabase.from('finance_budget_items').delete().eq('is_default', false).eq('is_template', true);
        await supabase.from('finance_budget_categories').delete().eq('is_default', false).eq('is_template', true);
        if (defaultBudgetCats.length > 0) {
          await supabase.from('finance_budget_categories').insert(defaultBudgetCats.map(c => ({
            id: c.id,
            is_default: false,
            is_template: true,
            name: c.name,
            budgeted: c.budgeted,
            group_type: c.group || null,
            emoji: c.emoji || null
          })));
          const items = defaultBudgetCats.flatMap(c => (c.items || []).map(i => ({
            id: i.id,
            is_default: false,
            is_template: true,
            category_id: c.id,
            name: i.name,
            budgeted: i.budgeted,
            spent: i.spent,
            linked_account_id: i.linkedAccountId || null,
            emoji: i.emoji || null
          })));
          if (items.length > 0) {
            await supabase.from('finance_budget_items').insert(items);
          }
        }
      } else if (key === 'budget_presets') {
        const presetsObj = contentData as Record<string, CategoryPreset[]>;
        await supabase.from('finance_budget_presets').delete().eq('is_default', false);
        const presetRows = Object.entries(presetsObj).flatMap(([type, list]) =>
          (list || []).map(p => ({
            is_default: false,
            preset_type: type,
            name: p.name,
            emoji: p.emoji || null,
            group_type: p.group || null
          }))
        );
        if (presetRows.length > 0) {
          await supabase.from('finance_budget_presets').insert(presetRows);
        }
      }
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

    const packageBenefits = settings.packageBenefits || [];
    const totalBenefitsValue = packageBenefits.reduce((sum, b) => {
      const val = b.type === 'percentage' ? (grossSalary * ((b.amount || 0) / 100)) : (b.amount || 0);
      return sum + (val || 0);
    }, 0);

    const totalPackage = grossSalary + employerPensionRate + totalBenefitsValue;

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
      totalPackage: getBreakdown(totalPackage, daysInYear),
      preTax: getBreakdown(grossSalary, daysInYear),
      employerPension: getBreakdown(employerPensionRate, daysInYear),
      benefits: getBreakdown(totalBenefitsValue, daysInYear),
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
      totalBenefitsValue,
      totalPackage,
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
    if (!newGoal.name || newGoal.targetAmount === '' || newGoal.targetAmount <= 0) {
      toast({ title: 'Invalid Goal', description: 'Please enter a valid name and target amount.', variant: 'destructive' });
      return;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const created: Goal = {
      id: 'g_' + Date.now(),
      name: newGoal.name,
      targetAmount: newGoal.targetAmount === '' ? 0 : newGoal.targetAmount,
      currentAmount: 0,
      targetDate: newGoal.targetDate || todayStr,
      startDate: newGoal.startDate || todayStr,
      status: newGoal.status || 'active',
      emoji: newGoal.emoji || undefined,
      contributions: []
    };
    const updated = [...goals, created];
    setGoals(updated);
    saveDataToSupabase('goals', updated);
    setIsAddGoalOpen(false);
    setNewGoal({ name: '', targetAmount: '', targetDate: '', startDate: '', emoji: '', status: 'active' });
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

  const handleToggleArchiveGoal = (id: string) => {
    const targetGoal = goals.find(g => g.id === id);
    if (!targetGoal) return;
    const isCurrentlyArchived = targetGoal.status === 'archived';
    const nextStatus = isCurrentlyArchived ? 'active' : 'archived';

    const updated = goals.map(g => {
      if (g.id === id) {
        return { ...g, status: nextStatus as 'active' | 'archived' };
      }
      return g;
    });

    setGoals(updated);
    saveDataToSupabase('goals', updated);
    toast({
      title: isCurrentlyArchived ? 'Goal Restored' : 'Goal Archived',
      description: `Successfully ${isCurrentlyArchived ? 'restored' : 'archived'} goal "${targetGoal.name}".`
    });
  };

  const handleEditGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal || !editingGoal.name || editingGoal.targetAmount <= 0) {
      toast({ title: 'Invalid Goal', description: 'Please enter a valid name and target amount.', variant: 'destructive' });
      return;
    }

    const updated = goals.map(g => {
      if (g.id === editingGoal.id) {
        return {
          ...g,
          name: editingGoal.name,
          targetAmount: editingGoal.targetAmount,
          startDate: editingGoal.startDate,
          targetDate: editingGoal.targetDate,
          emoji: editingGoal.emoji || undefined,
          status: editingGoal.status || 'active'
        };
      }
      return g;
    });

    setGoals(updated);
    saveDataToSupabase('goals', updated);
    setIsEditGoalOpen(false);
    setEditingGoal(null);
    toast({ title: 'Goal Updated', description: `Successfully updated goal "${editingGoal.name}".` });
  };

  const handleAddContribution = (e: React.FormEvent, goalId: string) => {
    e.preventDefault();
    if (newContribution.amount === '' || newContribution.amount <= 0) {
      toast({ title: 'Invalid Amount', description: 'Contribution must be greater than £0.00.', variant: 'destructive' });
      return;
    }

    let updatedAccounts = [...bankAccounts];
    if (newContribution.bankAccountId) {
      const accId = newContribution.bankAccountId;
      const amt = newContribution.amount === '' ? 0 : newContribution.amount;
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
          amount: newContribution.amount === '' ? 0 : newContribution.amount,
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
    setNewContribution({ amount: '', note: '', date: new Date().toISOString().split('T')[0], bankAccountId: '' });
    toast({ title: 'Contribution Logged', description: `Added ${formatGBP(newContribution.amount === '' ? 0 : newContribution.amount)} and updated linked account.` });
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
      balance: newAccount.balance === '' ? 0 : newAccount.balance,
      annualFee: newAccount.annualFee === '' ? 0 : newAccount.annualFee,
      emoji: newAccount.emoji || getAccountDefaultEmoji(newAccount.type, newAccount.name),
      color: newAccount.color || getAccountDefaultColor(newAccount.name),
      id: 'a_' + Date.now()
    };
    const updated = [...bankAccounts, created];
    setBankAccounts(updated);
    saveDataToSupabase('accounts', { bankAccounts: updated, memberships, creditScores });
    setIsAddAccountOpen(false);
    setNewAccount({ name: '', type: 'checking', issuer: '', balance: '', annualFee: '', useCase: '', emoji: '', color: '#475569' });
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

  // ==========================================
  // HANDLERS: INVESTMENTS CRUD
  // ==========================================

  const handleAddHolding = (holding: Omit<InvestmentHolding, 'id'>) => {
    const created: InvestmentHolding = {
      ...holding,
      id: 'h_' + Date.now()
    };
    const updated = [...investmentHoldings, created];
    setInvestmentHoldings(updated);
    toast({ title: 'Asset Added', description: `Successfully added ${created.name}.` });
  };

  const handleEditHolding = (holding: InvestmentHolding) => {
    const updated = investmentHoldings.map(h => h.id === holding.id ? holding : h);
    setInvestmentHoldings(updated);
    toast({ title: 'Asset Updated', description: `Successfully updated ${holding.name}.` });
  };

  const handleDeleteHolding = (id: string) => {
    const deleted = investmentHoldings.find(h => h.id === id);
    const updated = investmentHoldings.filter(h => h.id !== id);
    setInvestmentHoldings(updated);
    if (deleted) {
      toast({ title: 'Asset Deleted', description: `Removed ${deleted.name} from portfolio.` });
    }
  };


  const handleAddMembership = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMembership.name) {
      toast({ title: 'Error', description: 'Please enter membership name.', variant: 'destructive' });
      return;
    }
    const created: Membership = {
      ...newMembership,
      annualFee: newMembership.annualFee === '' ? 0 : newMembership.annualFee,
      id: 'm_' + Date.now()
    };
    const updated = [...memberships, created];
    setMemberships(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships: updated, creditScores });
    setIsAddMembershipOpen(false);
    setNewMembership({ name: '', type: 'points', status: 'Active', annualFee: '', useCase: '' });
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
    if (newCreditScore.score === '' || newCreditScore.score < 0 || newCreditScore.score > maxScore) {
      toast({ title: 'Invalid Score', description: `Score must be between 0 and ${maxScore}.`, variant: 'destructive' });
      return;
    }
    const entry: CreditScoreEntry = {
      id: 'cs_' + Date.now(),
      date: newCreditScore.date,
      score: newCreditScore.score === '' ? 0 : newCreditScore.score
    };
    const updated = {
      ...creditScores,
      [newCreditScore.bureau]: [...creditScores[newCreditScore.bureau], entry].sort((a, b) => a.date.localeCompare(b.date))
    };
    setCreditScores(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships, creditScores: updated });
    setIsAddCreditScoreOpen(false);
    setNewCreditScore({ bureau: 'experian', score: '', date: new Date().toISOString().split('T')[0] });
    toast({ title: 'Credit Score Added', description: `Logged ${newCreditScore.bureau.charAt(0).toUpperCase() + newCreditScore.bureau.slice(1)} score of ${newCreditScore.score === '' ? 0 : newCreditScore.score}.` });
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
      budgeted: newCategoryBudget === '' ? 0 : newCategoryBudget,
      group: newCategoryGroup || preset?.group || 'needs',
      items: [],
      emoji: newCategoryEmoji.trim() || preset?.emoji || getCategoryDefaultEmoji(normalizedName)
    };
    const updated = [...budgetCategories, created];
    setBudgetCategories(updated);
    saveDataToSupabase('budget', updated);
    setIsAddCategoryOpen(false);
    setNewCategoryName('');
    setNewCategoryBudget('');
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
          budgeted: newCategoryBudget === '' ? 0 : newCategoryBudget,
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
    setNewCategoryBudget('');
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
    const targetCat = budgetCategories.find(c => c.id === activeCategoryId);
    let finalName = newBudgetItem.name;
    if (targetCat && isSubscriptionsCategory(targetCat) && selectedSubscriptionPreset !== 'custom') {
      finalName = subscriptionProvider.trim() 
        ? `${selectedSubscriptionPreset} (${subscriptionProvider.trim()})` 
        : selectedSubscriptionPreset;
    } else if (targetCat && isLoansCategory(targetCat) && selectedLoanPreset !== 'custom') {
      finalName = loanProvider.trim() 
        ? `${selectedLoanPreset} (${loanProvider.trim()})` 
        : selectedLoanPreset;
    }
    if (!finalName) return;
    const item: BudgetItem = {
      id: 'item_' + Date.now(),
      name: finalName,
      budgeted: 0,
      spent: newBudgetItem.spent === '' ? 0 : newBudgetItem.spent,
      emoji: newBudgetItem.emoji
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
    setNewBudgetItem({ name: '', budgeted: 0, spent: '', linkedAccountId: '', emoji: '' });
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
            spent: activeBudgetItem.spent,
            emoji: activeBudgetItem.emoji || item.emoji
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
    if (!newRecurring.name || newRecurring.amount === '' || newRecurring.amount <= 0) return;

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
      amount: newRecurring.amount === '' ? 0 : newRecurring.amount,
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
      amount: '',
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
      activeSavingsTypes: draftActiveSavingsTypes,
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

  const handleResetDefaults = async () => {
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
      holidaysByUser: {},
      activeSavingsTypes: ALL_SAVINGS_IDS
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
    setDraftActiveSavingsTypes(defaultSettings.activeSavingsTypes || ALL_SAVINGS_IDS);
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

    if (isAdmin) {
      try {
        const deleteTables = [
          'finance_settings', 'finance_user_holidays', 'finance_goals', 'finance_goal_contributions',
          'finance_bank_accounts', 'finance_memberships', 'finance_credit_scores',
          'finance_budget_categories', 'finance_budget_items', 'finance_recurring_bills',
          'finance_transactions', 'finance_tax_configs', 'finance_recurring_templates',
          'finance_credit_bureaus', 'finance_holiday_defaults', 'finance_budget_presets'
        ];
        await Promise.all(deleteTables.map(t => supabase.from(t as any).delete().eq('is_default', false)));
        toast({ title: 'Reset successful', description: 'Database and local configurations reverted to defaults.' });
      } catch (err) {
        console.error('Failed to reset custom database records:', err);
        toast({ title: 'Local Reset successful', description: 'Returned configurations to default values. Failed to clear database.', variant: 'destructive' });
      }
    } else {
      toast({ title: 'Reset successful', description: 'Returned configurations to default values.' });
    }
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
  const totalDebt = Math.abs(bankAccounts.filter(a => a.balance < 0).reduce((sum, a) => sum + a.balance, 0));
  const netWorth = totalAssets - totalDebt;

  const monthlyIncome = results.netTakeHome / 12;
  const netCashFlow = monthlyIncome - totalSpent;

  // Segmented progress bar percentages for Income vs Spend
  const totalFlow = monthlyIncome + totalSpent;
  const incomeFlowPercent = totalFlow > 0 ? (monthlyIncome / totalFlow) * 100 : 50;
  const spendFlowPercent = totalFlow > 0 ? (totalSpent / totalFlow) * 100 : 50;

  // Compare this month's net cash flow to last month's same period
  const getNetComparison = () => {
    const today = new Date();
    const todayDay = today.getDate();
    const thisMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-`;
    
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonthYear = lastMonthDate.getFullYear();
    const lastMonthIdx = lastMonthDate.getMonth();
    const lastMonthPrefix = `${lastMonthYear}-${String(lastMonthIdx + 1).padStart(2, '0')}-`;
    
    // Calculate last month's spend up to today's date
    const lastMonthTx = mockTransactions
      .filter(tx => {
        if (!tx.date.startsWith(lastMonthPrefix)) return false;
        const day = parseInt(tx.date.split('-')[2], 10);
        return !isNaN(day) && day <= todayDay;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);

    const lastMonthBills = recurrings
      .filter(r => {
        if (!isDueThisMonth(r, lastMonthIdx + 1)) return false;
        return r.dueDate <= todayDay;
      })
      .reduce((sum, r) => sum + r.amount, 0);

    const lastMonthSpend = lastMonthTx + lastMonthBills;
    const lastMonthNet = monthlyIncome - lastMonthSpend;

    const diff = netCashFlow - lastMonthNet;
    const pct = lastMonthNet !== 0 ? (diff / Math.abs(lastMonthNet)) * 100 : 0;
    
    const prevMonthName = MONTH_NAMES[lastMonthIdx].slice(0, 3);
    const rangeLabel = `${prevMonthName} 1 - ${prevMonthName} ${todayDay}, ${lastMonthYear}`;
    
    return {
      lastMonthNet,
      pct: Math.abs(pct),
      isPositive: diff >= 0,
      rangeLabel
    };
  };

  const comparison = getNetComparison();

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
    const monthName = MONTH_NAMES[currentMonthIdx].slice(0, 3);

    for (let day = 1; day <= daysInMonth; day++) {
      const idealCumulative = totalBudget > 0 ? (day / daysInMonth) * totalBudget : 0;
      let actualCumulative: number | undefined = undefined;

      if (day <= todayDay) {
        cumulativeSpent += (dailyAmounts[day] || 0);
        actualCumulative = cumulativeSpent;
      }

      data.push({
        day,
        label: `${day} ${monthName}`,
        "Ideal Limit": parseFloat(idealCumulative.toFixed(2)),
        "Actual Spent": actualCumulative !== undefined ? parseFloat(actualCumulative.toFixed(2)) : undefined
      });
    }

    return data;
  };

  const todayDayNum = todayDateObj.getDate();

  // Dashboard spending progress helper based on range
  const getDashboardSpendData = () => {
    if (dashboardSpendRange === 'this_month') {
      const chartData = getSpendingProgressData();
      const todayProgress = chartData.find(d => d.day === todayDayNum);
      const isOverBudgetToday = todayProgress && todayProgress["Actual Spent"] !== undefined && todayProgress["Actual Spent"] > todayProgress["Ideal Limit"];
      
      let statusText = '';
      if (todayProgress) {
        const diff = Math.abs((todayProgress["Actual Spent"] || 0) - todayProgress["Ideal Limit"]);
        statusText = isOverBudgetToday 
          ? `Over pace by ${formatGBP(diff)}` 
          : `Under pace by ${formatGBP(diff)}`;
      }

      return {
        chartData,
        spent: totalSpent,
        budget: totalBudget,
        spentLabel: "Spent This Month",
        budgetLabel: "Budget Limit",
        statusText,
        isOverBudget: isOverBudgetToday,
        xAxisKey: "label",
      };
    }

    if (dashboardSpendRange === 'all_time') {
      let startYear = currentYear;
      if (mockTransactions.length > 0) {
        const years = mockTransactions
          .map(tx => parseInt(tx.date.split('-')[0], 10))
          .filter(y => !isNaN(y));
        if (years.length > 0) {
          startYear = Math.min(...years);
        }
      }
      if (startYear === currentYear) {
        startYear = currentYear - 1;
      }

      const chartData = [];
      let periodSpentTotal = 0;
      let periodBudgetTotal = 0;

      for (let yr = startYear; yr <= currentYear; yr++) {
        // Transactions in this year
        const yearSpend = mockTransactions
          .filter(tx => tx.date.startsWith(`${yr}-`))
          .reduce((sum, tx) => sum + tx.amount, 0);

        // Recurrings in this year (summed across 12 months)
        let yearRecurringSpend = 0;
        for (let m = 1; m <= 12; m++) {
          yearRecurringSpend += recurrings
            .filter(r => isDueThisMonth(r, m))
            .reduce((sum, r) => sum + r.amount, 0);
        }

        const totalSpentInYear = yearSpend + yearRecurringSpend;
        const budgetLimit = totalBudget * 12;

        periodSpentTotal += totalSpentInYear;
        periodBudgetTotal += budgetLimit;

        chartData.push({
          label: `${yr}`,
          "Ideal Limit": budgetLimit,
          "Actual Spent": parseFloat(totalSpentInYear.toFixed(2)),
        });
      }

      const isOverBudget = periodSpentTotal > periodBudgetTotal;
      const diff = Math.abs(periodSpentTotal - periodBudgetTotal);
      const statusText = isOverBudget
        ? `Over budget by ${formatGBP(diff)}`
        : `Under budget by ${formatGBP(diff)}`;

      return {
        chartData,
        spent: periodSpentTotal,
        budget: periodBudgetTotal,
        spentLabel: "Total Spent",
        budgetLabel: "Total Budget",
        statusText,
        isOverBudget,
        xAxisKey: "label",
      };
    }

    // For multi-month views: last_3m, ytd
    const startPeriod = new Date(currentYear, currentMonthIdx, 1);
    if (dashboardSpendRange === 'last_3m') {
      startPeriod.setMonth(startPeriod.getMonth() - 2);
    } else if (dashboardSpendRange === 'ytd') {
      startPeriod.setMonth(0); // January
    }

    const chartData = [];
    const cursor = new Date(startPeriod.getFullYear(), startPeriod.getMonth(), 1);
    const endPeriod = new Date(currentYear, currentMonthIdx, 1);

    let periodSpentTotal = 0;
    let periodBudgetTotal = 0;

    while (cursor <= endPeriod) {
      const yr = cursor.getFullYear();
      const mo = cursor.getMonth();
      const shortName = MONTH_NAMES[mo].slice(0, 3);
      
      const prefix = `${yr}-${String(mo + 1).padStart(2, '0')}-`;
      const monthSpend = mockTransactions
        .filter(tx => tx.date.startsWith(prefix))
        .reduce((sum, tx) => sum + tx.amount, 0);

      const monthRecurringSpend = recurrings
        .filter(r => isDueThisMonth(r, mo + 1))
        .reduce((sum, r) => sum + r.amount, 0);

      const totalSpentInMonth = monthSpend + monthRecurringSpend;
      const budgetLimit = totalBudget;

      periodSpentTotal += totalSpentInMonth;
      periodBudgetTotal += budgetLimit;

      chartData.push({
        label: `${shortName} '${String(yr).slice(2)}`,
        "Ideal Limit": budgetLimit,
        "Actual Spent": parseFloat(totalSpentInMonth.toFixed(2)),
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    const isOverBudget = periodSpentTotal > periodBudgetTotal;
    const diff = Math.abs(periodSpentTotal - periodBudgetTotal);
    const statusText = isOverBudget
      ? `Over budget by ${formatGBP(diff)}`
      : `Under budget by ${formatGBP(diff)}`;

    return {
      chartData,
      spent: periodSpentTotal,
      budget: periodBudgetTotal,
      spentLabel: "Total Spent",
      budgetLabel: "Total Budget",
      statusText,
      isOverBudget,
      xAxisKey: "label",
    };
  };

  const {
    chartData: dashboardSpendChartData,
    spent: dashboardSpendTotal,
    budget: dashboardSpendBudget,
    spentLabel: dashboardSpendSpentLabel,
    budgetLabel: dashboardSpendBudgetLabel,
    statusText: dashboardSpendStatusText,
    isOverBudget: isDashboardSpendOverBudget,
    xAxisKey: dashboardSpendXAxisKey,
  } = getDashboardSpendData();

  const progressLineColor = isDashboardSpendOverBudget ? FIN_HEX.warn : FIN_HEX.positive;
  const progressGradientColor = isDashboardSpendOverBudget ? FIN_HEX.warn : FIN_HEX.positive;

  // Transactions to review state
  const unreviewedCount = mockTransactions.filter(tx => !tx.isReviewed).length;
  const displayedTransactions = (showAllTransactions
    ? mockTransactions
    : mockTransactions.filter(tx => !tx.isReviewed)
  ).filter(tx => selectedAccountFilter === 'all' || tx.accountId === selectedAccountFilter);

  const accountTransactionsCount = selectedAccountFilter === 'all'
    ? mockTransactions.length
    : mockTransactions.filter(tx => tx.accountId === selectedAccountFilter).length;

  // Spent progress color bar
  const getProgressColor = (spent: number, budgeted: number) => {
    if (budgeted <= 0) return spent > 0 ? 'bg-fin-negative' : 'bg-fin-positive';
    const percent = spent / budgeted;
    if (percent <= 0.75) return 'bg-fin-positive';
    if (percent <= 1.0) return 'bg-fin-warn';
    return 'bg-fin-negative';
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <CardTitle className="text-sm font-serif font-semibold text-foreground flex items-center gap-1.5">
                          <Activity className="h-4 w-4 text-primary" /> Spending Progress
                        </CardTitle>
                        <CardDescription className="text-[10px] text-muted-foreground">
                          {dashboardSpendRange === 'this_month'
                            ? "Cumulative monthly spent vs budget trajectory"
                            : `Monthly spent vs budget for the selected period (${dashboardSpendSpentLabel.toLowerCase()})`}
                        </CardDescription>
                      </div>
                      
                      <div className="flex items-center gap-3 self-start sm:self-center">
                        <div className="flex bg-muted/30 border border-border/50 rounded-full p-0.5 gap-0.5">
                          {[
                            { key: 'this_month', label: 'This Month' },
                            { key: 'last_3m', label: 'Last 3M' },
                            { key: 'ytd', label: 'YTD' },
                            { key: 'all_time', label: 'All Time' },
                          ].map((opt) => {
                            const isActive = dashboardSpendRange === opt.key;
                            return (
                              <button
                                key={opt.key}
                                onClick={() => setDashboardSpendRange(opt.key as any)}
                                className={cn(
                                  "px-2.5 py-1 text-[10px] font-semibold font-sans rounded-full transition-all whitespace-nowrap",
                                  isActive
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                )}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>

                        <div className="text-right hidden sm:block">
                          <span className={cn(
                            "text-[10px] font-bold font-mono px-2 py-0.5 rounded-full inline-block",
                            isDashboardSpendOverBudget ? "bg-fin-negative/10 text-fin-negative" : "bg-fin-positive/10 text-fin-positive"
                          )}>
                            {dashboardSpendStatusText}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Mobile-only status display */}
                    <div className="block sm:hidden pt-1">
                      <span className={cn(
                        "text-[10px] font-bold font-mono px-2 py-0.5 rounded-full inline-block",
                        isDashboardSpendOverBudget ? "bg-fin-negative/10 text-fin-negative" : "bg-fin-positive/10 text-fin-positive"
                      )}>
                        {dashboardSpendStatusText}
                      </span>
                    </div>

                    <div className="flex gap-4 pt-3 text-xs">
                      <div>
                        <span className="text-muted-foreground text-[10px] uppercase block">{dashboardSpendSpentLabel}</span>
                        <span className="text-lg font-bold font-mono text-foreground">{formatGBP(dashboardSpendTotal)}</span>
                      </div>
                      <div className="border-l border-border/50 pl-4">
                        <span className="text-muted-foreground text-[10px] uppercase block">{dashboardSpendBudgetLabel}</span>
                        <span className="text-lg font-bold font-mono text-muted-foreground">{formatGBP(dashboardSpendBudget)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Recharts Cumulative spending chart */}
                  <div className="h-[200px] w-full mt-4 min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dashboardSpendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="progressGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={progressGradientColor} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={progressGradientColor} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                          dataKey={dashboardSpendXAxisKey}
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
                          name={dashboardSpendRange === 'this_month' ? 'Ideal Limit' : 'Budget Limit'}
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

                  {/* Combined Net & Spendable Card */}
                  <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-xl p-4 sm:p-5 rounded-3xl flex-1 flex flex-col justify-between space-y-4 text-left">
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Net & Budget</span>
                        <button
                          onClick={() => setActiveTab('cash-flow')}
                          className="text-[9px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors uppercase font-sans"
                        >
                          Cash Flow <ArrowUpRight className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Left column: Actual Net Cash Flow */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider block">Net this month</span>
                          <span className={cn("text-xl sm:text-2xl font-extrabold font-mono block tracking-tight whitespace-nowrap", netCashFlow >= 0 ? "text-fin-positive" : "text-fin-negative")}>
                            {netCashFlow >= 0 ? '+' : ''}{formatGBP(netCashFlow)}
                          </span>
                          {/* Trend comparison */}
                          <div className="flex items-center gap-1 text-[8px] text-muted-foreground font-sans truncate">
                            <span className={cn(
                              "flex items-center px-1 py-0.5 rounded-full font-bold font-mono text-[8px]",
                              comparison.isPositive ? "bg-fin-positive/10 text-fin-positive" : "bg-fin-negative/10 text-fin-negative"
                            )}>
                              {comparison.isPositive ? '↗' : '↘'} {comparison.pct.toFixed(0)}%
                            </span>
                            <span>vs last month</span>
                          </div>
                        </div>

                        {/* Right column: Free to Spend */}
                        <div className="space-y-1 border-l-0 sm:border-l border-border/20 pl-0 sm:pl-4 flex flex-col justify-between">
                          <div>
                            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <span>Free to Spend</span>
                              <PiggyBank className="h-3 w-3 text-fin-positive" />
                            </span>
                            <span className={cn("text-xl sm:text-2xl font-extrabold font-mono block tracking-tight whitespace-nowrap", freeToSpend >= 0 ? "text-fin-positive" : "text-fin-negative")}>
                              {formatGBP(freeToSpend)}
                            </span>
                          </div>
                          {freeToSpend > 0 ? (
                            <p className="text-[9px] text-muted-foreground font-sans mt-0.5">
                              <span className="font-bold text-foreground font-mono">{formatGBP(dailyFreeToSpend)}</span>/day left
                            </p>
                          ) : (
                            <p className="text-[9px] text-fin-negative/80 font-sans font-medium mt-0.5">
                              Over budget
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Progress bars section */}
                    <div className="space-y-3.5 border-t border-border/20 pt-3">
                      {/* Cash Flow Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[8px] text-muted-foreground uppercase tracking-wider font-mono">
                          <span>Actual Cash Flow</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                          <div className="h-full bg-fin-positive transition-all duration-300" style={{ width: `${incomeFlowPercent}%` }} />
                          <div className="h-full bg-fin-accent transition-all duration-300" style={{ width: `${spendFlowPercent}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[8px] text-muted-foreground font-mono">
                          <span>In: <span className="text-fin-positive font-bold">{formatGBP(monthlyIncome)}</span></span>
                          <span>Out: <span className="text-foreground font-bold">{formatGBP(totalSpent)}</span></span>
                        </div>
                      </div>

                      {/* Budget Proportional Segmented Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[8px] text-muted-foreground uppercase tracking-wider font-mono">
                          <span>Budget Allocation</span>
                        </div>
                        {(() => {
                          const spentWidth = totalBudget > 0 ? Math.min(100, spentPercent) : 0;
                          const billsWidth = totalBudget > 0 ? Math.min(100 - spentWidth, billsPercent) : 0;
                          const freeWidth = totalBudget > 0 && freeToSpend > 0 ? Math.max(0, 100 - spentWidth - billsWidth) : 0;
                          return (
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                              <div className="h-full bg-fin-accent transition-all duration-300" style={{ width: `${spentWidth}%` }} title={`Spent: ${spentPercent.toFixed(0)}%`} />
                              <div className="h-full bg-fin-warn transition-all duration-300" style={{ width: `${billsWidth}%` }} title={`Bills: ${billsPercent.toFixed(0)}%`} />
                              <div className="h-full bg-fin-positive transition-all duration-300" style={{ width: `${freeWidth}%` }} title={`Free: ${freePercent.toFixed(0)}%`} />
                            </div>
                          );
                        })()}
                        <div className="flex flex-wrap items-center justify-between text-[8px] font-mono text-muted-foreground gap-y-1">
                          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-fin-accent" /> Spent ({spentPercent.toFixed(0)}%)</span>
                          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-fin-warn" /> Bills ({formatGBP(unpaidRecurrings)})</span>
                          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-fin-positive" /> Free ({freePercent.toFixed(0)}%)</span>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Net Assets, Debt & Net Cash Flow block */}
                  <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-lg p-3 sm:p-4 rounded-3xl space-y-1.5 text-left">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">Net Worth</span>
                    <span className="text-base font-bold font-mono text-fin-positive block truncate">{formatGBP(netWorth)}</span>
                    <div className="flex justify-between text-[8px] text-muted-foreground border-t border-border/20 pt-1.5 font-mono">
                      <span className="text-fin-positive/80">Assets: {formatGBP(totalAssets)}</span>
                      <span className="text-fin-negative/80">Debt: {formatGBP(totalDebt)}</span>
                    </div>
                  </Card>

                  {/* Payday details card */}
                  <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-lg p-4 sm:p-5 rounded-3xl space-y-4 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Next Payday</span>
                      <button
                        onClick={() => setActiveTab('tax-income')}
                        className="text-[9px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors uppercase font-sans"
                      >
                        Tax & Income <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="font-extrabold text-2xl text-foreground block">
                          {nextPayday.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="text-[10px] text-fin-positive font-mono font-semibold block">
                          +{formatGBP(breakdownRates.postTax.monthly)} expected
                        </span>
                      </div>
                      <span className={cn(
                        "font-mono px-2.5 py-0.5 rounded-full font-bold text-[10px] select-none",
                        nextPayday.daysRemaining === 0 ? "bg-fin-positive/10 text-fin-positive" : "bg-muted/60 text-muted-foreground"
                      )}>
                        {nextPayday.daysRemaining === 0 ? "Paid today!" : `${nextPayday.daysRemaining} days left`}
                      </span>
                    </div>
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
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <button
                            onClick={() => setActiveTab('transactions')}
                            className="hover:text-primary transition-colors flex items-center gap-1 text-left"
                          >
                            Transactions <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </CardTitle>
                        <CardDescription className="text-[11px] text-muted-foreground mt-0.5">Review recent aggregate card activity</CardDescription>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {bankAccounts.length > 0 && (
                          <Select
                            value={selectedAccountFilter}
                            onValueChange={setSelectedAccountFilter}
                          >
                            <SelectTrigger className="w-[140px] text-[10px] font-sans font-semibold h-8 rounded-xl border-primary/20 bg-background/50">
                              <SelectValue placeholder="All Accounts" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-primary/10">
                              <SelectItem value="all" className="text-[10px]">All Accounts</SelectItem>
                              {bankAccounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id} className="text-[10px]">
                                  {acc.emoji} {acc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {trueLayerStatus?.connected && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={syncTrueLayer}
                            disabled={isSyncingTrueLayer}
                            className="text-[10px] rounded-xl hover:bg-muted font-sans font-semibold h-8 text-primary border-primary/20 gap-1"
                          >
                            <RefreshCw className={cn("h-3 w-3", isSyncingTrueLayer && "animate-spin")} />
                            {isSyncingTrueLayer ? "Syncing..." : "Sync Bank"}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAllTransactions(!showAllTransactions)}
                          className="text-[10px] rounded-xl hover:bg-muted font-sans font-semibold h-8 text-muted-foreground hover:text-foreground"
                        >
                          {showAllTransactions ? "Show Pending Only" : `View All (${accountTransactionsCount})`}
                        </Button>
                      </div>
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
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={cn("text-xs font-semibold block truncate text-foreground", tx.isReviewed && "line-through text-muted-foreground")}>
                                      {tx.name}
                                    </span>
                                    {(() => {
                                      const linkedAccount = bankAccounts.find(acc => acc.id === tx.accountId);
                                      if (!linkedAccount) return null;
                                      return (
                                        <span 
                                          className="text-[9px] font-sans font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 select-none"
                                          style={{ 
                                            backgroundColor: `${linkedAccount.color || '#4f46e5'}15`, 
                                            color: linkedAccount.color || '#4f46e5',
                                            borderColor: `${linkedAccount.color || '#4f46e5'}35`
                                          }}
                                        >
                                          <span>{linkedAccount.emoji || '💰'}</span>
                                          <span>{linkedAccount.name}</span>
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground font-mono">
                                    <span>{tx.date}</span>
                                    <span>•</span>
                                    <span className="uppercase text-[9px] tracking-wider font-semibold text-primary/70">{tx.category}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 self-end sm:self-center">
                                <span className={cn(
                                  "text-xs font-bold font-mono",
                                  tx.amount < 0 ? "text-fin-positive" : "text-fin-negative"
                                )}>
                                  {tx.amount < 0 ? '+' : '-'}{formatGBP(Math.abs(tx.amount))}
                                </span>
                                <Button
                                  onClick={() => toggleTransactionReviewed(tx.id)}
                                  size="sm"
                                  variant={tx.isReviewed ? "ghost" : "default"}
                                  className={cn(
                                    "h-8 rounded-xl text-[10px] gap-1 px-3 shrink-0 font-semibold",
                                    tx.isReviewed
                                      ? "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                      : "bg-fin-positive hover:bg-fin-positive text-white"
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
                            <div className="h-10 w-10 rounded-full bg-fin-positive/10 flex items-center justify-center text-fin-positive text-lg">
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
                        <CardTitle className="text-sm font-serif font-semibold text-foreground">Top Spending Categories (For the month)</CardTitle>
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
                    <CardHeader className="p-0 pb-4 border-b border-border/30 flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardTitle className="text-sm font-serif font-semibold text-foreground">Upcoming Bills</CardTitle>
                        <CardDescription className="text-[11px] text-muted-foreground mt-0.5">Bills due in the calendar cycle</CardDescription>
                      </div>
                      <button
                        onClick={() => setActiveTab('recurrings')}
                        className="text-[9px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors uppercase font-sans"
                      >
                        Recurrings <ArrowUpRight className="h-3 w-3" />
                      </button>
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
                                {bill.emoji && <span className="shrink-0 text-sm">{bill.emoji}</span>}
                                <span className="truncate">{bill.name}</span>
                              </div>
                              <span className="text-[9px] text-muted-foreground block font-mono uppercase tracking-wider">{getDueDateText(bill, currentMonth)}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-bold font-mono text-xs">{formatGBP(bill.amount)}</span>
                              <button
                                onClick={() => toggleRecurringPaid(bill.id)}
                                className="h-5 w-5 rounded-lg flex items-center justify-center border border-border/40 hover:border-fin-positive/50 hover:bg-fin-positive/10 text-transparent hover:text-fin-positive/70 transition-all shrink-0"
                                title="Mark as Paid"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      {recurrings.filter(r => isDueThisMonth(r, currentMonth) && !r.isPaid).length === 0 && (
                        <p className="text-[11px] text-muted-foreground italic text-center py-4">No upcoming bills left to pay!</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl">
                    <CardHeader className="p-0 pb-4 border-b border-border/30 flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardTitle className="text-sm font-serif font-semibold text-foreground">Goals</CardTitle>
                        <CardDescription className="text-[11px] text-muted-foreground mt-0.5">Target goals and current saved values</CardDescription>
                      </div>
                      <button
                        onClick={() => setActiveTab('goals')}
                        className="text-[9px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors uppercase font-sans"
                      >
                        Goals <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </CardHeader>
                    <CardContent className="p-0 pt-4 space-y-4">
                      {goals.slice(0, 2).map(goal => {
                        const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                        return (
                          <div key={goal.id} className="space-y-1 text-xs">
                            <div className="flex justify-between gap-2 font-semibold min-w-0">
                              <span className="truncate text-foreground font-semibold">{goal.name}</span>
                              <span className="font-mono text-fin-positive font-bold">
                                {progress.toFixed(0)}%
                              </span>
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                              <span>{formatGBP(goal.currentAmount)}</span>
                              <span>Target: {formatGBP(goal.targetAmount)}</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-fin-positive rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
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

                  {/* Total Compensation Summary Card */}
                  <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent backdrop-blur-sm rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 border border-primary/20 shadow-sm relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-primary/10 pb-4">
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary mb-1.5">
                          <Gift className="w-3 h-3" /> Total Compensation Package
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-mono font-extrabold text-foreground">
                          {formatGBP(results.totalPackage)}
                          <span className="text-xs font-sans font-normal text-muted-foreground ml-2">/ year</span>
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Includes Base Salary + Employer Pension Contribution + Benefits & Perks
                        </p>
                      </div>
                      <Button
                        onClick={() => setIsBenefitsDialogOpen(true)}
                        className="h-9 rounded-xl gap-2 bg-primary/90 hover:bg-primary text-primary-foreground text-xs font-semibold shrink-0 self-start sm:self-center"
                      >
                        <Gift className="w-4 h-4" /> Manage Benefits & Perks ({settings.packageBenefits?.length || 0})
                      </Button>
                    </div>

                    {/* Breakdown Pill Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
                      <div className="bg-card/60 backdrop-blur-sm rounded-xl p-3 border border-border/40">
                        <span className="block text-[10px] font-medium text-muted-foreground uppercase">Base Gross Salary</span>
                        <span className="mt-1 block font-mono text-sm font-bold text-foreground">{formatGBP(settings.grossSalary)}</span>
                      </div>
                      <div className="bg-card/60 backdrop-blur-sm rounded-xl p-3 border border-border/40">
                        <span className="block text-[10px] font-medium text-muted-foreground uppercase">Employer Pension ({settings.employerPensionPercent}%)</span>
                        <span className="mt-1 block font-mono text-sm font-bold text-fin-positive">+{formatGBP(results.employerPensionRate)}</span>
                      </div>
                      <div className="bg-card/60 backdrop-blur-sm rounded-xl p-3 border border-border/40">
                        <span className="block text-[10px] font-medium text-muted-foreground uppercase">Benefits & Perks</span>
                        <span className="mt-1 block font-mono text-sm font-bold text-fin-positive">+{formatGBP(results.totalBenefitsValue)}</span>
                      </div>
                      <div className="bg-card/60 backdrop-blur-sm rounded-xl p-3 border border-border/40">
                        <span className="block text-[10px] font-medium text-muted-foreground uppercase">Net Take-Home</span>
                        <span className="mt-1 block font-mono text-sm font-bold text-primary">{formatGBP(results.netTakeHome)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Standard Rates Breakdown */}
                  <div className="bg-card/40 backdrop-blur-sm rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 border border-primary/10 shadow-sm">
                    <div className="flex flex-col gap-3 mb-4 border-b border-border/50 pb-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-0.5 text-left min-w-0">
                          <h3 className="font-serif text-base sm:text-lg text-foreground flex items-center gap-2 font-semibold">
                            <DollarSign className="w-5 h-5 text-primary shrink-0" /> Breakdown Rates
                          </h3>
                          <p className="text-[11px] text-muted-foreground font-sans">
                            Rules applied ({settings.ukRegion === 'england-and-wales' ? 'England' : settings.ukRegion}, weekends excluded)
                          </p>
                          <p className="text-xs text-muted-foreground pt-1">
                            {includeWorkLeaveInActual
                              ? `${breakdownWorkingDays} paid days per year — bank holidays and ${settings.workHolidays} days paid leave included.`
                              : `${breakdownWorkingDays} working days per year — bank holidays and ${settings.workHolidays} days paid leave excluded.`}
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

                          {/* Total Package Header Row */}
                          <tr className="hover:bg-primary/10 transition-colors bg-primary/5 dark:bg-primary/15 font-sans font-bold border-b border-primary/20 text-primary">
                            <td className="py-3 pr-4 font-bold text-sm whitespace-nowrap flex items-center gap-1.5">
                              <Gift className="w-4 h-4 text-primary shrink-0" /> Total Compensation Package
                            </td>
                            <td className="py-3 px-2 text-right font-mono font-bold text-sm whitespace-nowrap">{formatGBP(breakdownRates.totalPackage.annual)}</td>
                            <td className="py-3 px-2 text-right font-mono font-bold text-sm whitespace-nowrap">{formatGBP(breakdownRates.totalPackage.monthly)}</td>
                            <td className="py-3 px-2 text-right font-mono font-bold text-sm whitespace-nowrap">{formatGBP(breakdownRates.totalPackage.weekly)}</td>
                            <td className="py-3 px-2 text-right font-mono font-bold text-sm whitespace-nowrap">{formatGBP(breakdownRates.totalPackage.daily)}</td>
                            <td className="py-3 pl-2 text-right font-mono font-bold text-sm whitespace-nowrap">{formatGBP(breakdownRates.totalPackage.hourly)}</td>
                          </tr>

                          {/* Gross Salary */}
                          <tr className="hover:bg-muted/10 transition-colors font-medium">
                            <td className="py-3 pr-4 font-bold font-sans text-foreground whitespace-nowrap">Gross Base Salary</td>
                            <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.annual)}</td>
                            <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.monthly)}</td>
                            <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.weekly)}</td>
                            <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.daily)}</td>
                            <td className="py-3 pl-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.hourly)}</td>
                          </tr>

                          {/* Employer Pension Addition */}
                          {results.employerPensionRate > 0 && (
                            <tr className="hover:bg-fin-positive/10 transition-colors bg-fin-positive/5 dark:bg-fin-positive/10 text-fin-positive">
                              <td className="py-3 pr-4 font-sans text-left">
                                <div className="flex flex-col justify-center min-w-[120px]">
                                  <span className="font-bold flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 shrink-0 text-fin-positive" /> Employer Pension ({settings.employerPensionPercent}%)
                                  </span>
                                  <span className="text-[10px] opacity-80 font-medium leading-normal mt-0.5">
                                    Employer contribution to pension
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.employerPension.annual)}</td>
                              <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.employerPension.monthly)}</td>
                              <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.employerPension.weekly)}</td>
                              <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.employerPension.daily)}</td>
                              <td className="py-3 pl-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.employerPension.hourly)}</td>
                            </tr>
                          )}

                          {/* Employer Benefits & Perks Addition */}
                          {results.totalBenefitsValue > 0 && (
                            <tr className="hover:bg-fin-positive/10 transition-colors bg-fin-positive/5 dark:bg-fin-positive/10 text-fin-positive">
                              <td className="py-3 pr-4 font-sans text-left">
                                <div className="flex flex-col justify-center min-w-[120px]">
                                  <span className="font-bold flex items-center gap-1.5">
                                    <Gift className="w-3.5 h-3.5 shrink-0 text-fin-positive" /> Benefits & Perks ({settings.packageBenefits?.length || 0})
                                  </span>
                                  <span className="text-[10px] opacity-80 font-medium leading-normal mt-0.5">
                                    {(settings.packageBenefits || []).map(b => `${b.emoji || '🎁'} ${b.name}`).join(', ')}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.benefits.annual)}</td>
                              <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.benefits.monthly)}</td>
                              <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.benefits.weekly)}</td>
                              <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.benefits.daily)}</td>
                              <td className="py-3 pl-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.benefits.hourly)}</td>
                            </tr>
                          )}

                          {/* Pension Contributions */}
                          {results.personalPensionRate > 0 && (
                            <tr className="hover:bg-muted/10 transition-colors text-foreground">
                              <td className="py-3 pr-4 font-sans text-left">
                                <div className="flex flex-col justify-center min-w-[120px]">
                                  <span className="font-bold text-foreground">Personal Pension ({settings.personalPensionPercent}%)</span>
                                  <span className="text-[10px] text-muted-foreground/90 font-medium leading-normal mt-0.5">
                                    {settings.pensionType === 'net_pay' ? 'Net Pay' :
                                      settings.pensionType === 'salary_sacrifice' ? 'Salary Sacrifice' :
                                        'Relief at Source'}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-right text-fin-negative font-semibold whitespace-nowrap">-{formatGBP(breakdownRates.pension.annual)}</td>
                              <td className="py-3 px-2 text-right text-fin-negative font-semibold whitespace-nowrap">-{formatGBP(breakdownRates.pension.monthly)}</td>
                              <td className="py-3 px-2 text-right text-fin-negative font-semibold whitespace-nowrap">-{formatGBP(breakdownRates.pension.weekly)}</td>
                              <td className="py-3 px-2 text-right text-fin-negative font-semibold whitespace-nowrap">-{formatGBP(breakdownRates.pension.daily)}</td>
                              <td className="py-3 pl-2 text-right text-fin-negative font-semibold whitespace-nowrap">-{formatGBP(breakdownRates.pension.hourly)}</td>
                            </tr>
                          )}

                          {/* Income Tax */}
                          {results.incomeTax > 0 && (
                            <tr className="hover:bg-muted/10 transition-colors text-foreground">
                              <td className="py-3 font-sans font-bold text-foreground">Income Tax</td>
                              <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.tax.annual)}</td>
                              <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.tax.monthly)}</td>
                              <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.tax.weekly)}</td>
                              <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.tax.daily)}</td>
                              <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.tax.hourly)}</td>
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
                              <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.ni.annual)}</td>
                              <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.ni.monthly)}</td>
                              <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.ni.weekly)}</td>
                              <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.ni.daily)}</td>
                              <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.ni.hourly)}</td>
                            </tr>
                          )}

                          {/* Student Loan */}
                          {results.studentLoan > 0 && (
                            <tr className="hover:bg-muted/10 transition-colors text-foreground">
                              <td className="py-3 font-sans font-bold text-foreground">Student Loan ({getPlanName(settings.studentLoanPlan)})</td>
                              <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.studentLoan.annual)}</td>
                              <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.studentLoan.monthly)}</td>
                              <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.studentLoan.weekly)}</td>
                              <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.studentLoan.daily)}</td>
                              <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.studentLoan.hourly)}</td>
                            </tr>
                          )}

                          {/* Total Deductions */}
                          <tr className="hover:bg-fin-negative/10 transition-colors text-fin-negative bg-fin-negative/5 dark:bg-fin-negative/10 font-sans">
                            <td className="py-3 font-bold">Total Deductions</td>
                            <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.annual)}</td>
                            <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.monthly)}</td>
                            <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.weekly)}</td>
                            <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.daily)}</td>
                            <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.hourly)}</td>
                          </tr>

                          {/* Take Home Pay */}
                          <tr className="hover:bg-fin-positive/10 transition-colors text-fin-positive bg-fin-positive/5 dark:bg-fin-positive/10 font-sans">
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
                      <p className="font-serif text-sm font-semibold text-foreground">Settings & Package Options</p>
                      <p className="text-[11px] text-muted-foreground">
                        {settings.ukRegion === 'england-and-wales' ? 'England & Wales' : settings.ukRegion === 'scotland' ? 'Scotland' : 'Northern Ireland'} tax rules, employer pension ({settings.employerPensionPercent}%), and package benefits.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                      <Button onClick={() => setIsBenefitsDialogOpen(true)} variant="outline" className="h-9 rounded-xl gap-1.5 border-primary/20 text-xs">
                        <Gift className="h-4 w-4 text-primary" /> Benefits ({settings.packageBenefits?.length || 0})
                      </Button>
                      <Button onClick={() => setIsSettingsOpen(true)} className="h-9 rounded-xl gap-1.5 bg-primary text-primary-foreground text-xs shrink-0">
                        <Settings className="h-4 w-4" /> Settings
                      </Button>
                    </div>
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
                      <div className="rounded-xl bg-fin-positive/10 px-2.5 py-2 text-left">
                        <span className="block text-[9px] font-semibold uppercase tracking-wider text-fin-positive">Left</span>
                        <span className="mt-1 block font-mono text-sm font-bold text-fin-positive">
                          {settings.workHolidays - getHolidaysUsedCount()}
                          <span className="ml-1 text-[9px] font-normal">days</span>
                        </span>
                      </div>
                      <div className="rounded-xl bg-fin-accent/10 px-2.5 py-2 text-left">
                        <span className="block text-[9px] font-semibold uppercase tracking-wider text-fin-accent">Bank</span>
                        <span className="mt-1 block font-mono text-sm font-bold text-fin-accent">
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
                                    <span className="bg-fin-positive/10 text-fin-positive font-semibold px-1.5 py-0.5 rounded font-sans">
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
                                    cellClass += "text-fin-positive font-bold";
                                  } else if (isBankHoliday) {
                                    cellClass += "text-fin-accent font-bold";
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
                                              colorClass = "text-fin-accent font-semibold";
                                            } else if (detail.startsWith('Booked Leave')) {
                                              colorClass = "text-fin-positive font-semibold";
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
                                                className="h-7 w-7 rounded-lg hover:bg-fin-negative/10 text-muted-foreground hover:text-fin-negative"
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
                          nextPayday.daysRemaining === 0 ? "bg-fin-positive/10 text-fin-positive" : "bg-muted/60 text-muted-foreground"
                        )}>
                          {nextPayday.daysRemaining === 0 ? "Paid today!" : `${nextPayday.daysRemaining} days left`}
                        </span>
                      </div>

                      {nextPayday.adjusted && (
                        <div className="rounded-xl bg-fin-warn/10 p-2.5 text-[10px] text-fin-warn flex items-start gap-1.5 leading-normal">
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
            const activeFilterCategory = budgetCategories.find(c => c.id === selectedBudgetCategoryFilter);

            const isTxInCategory = (tx: MockTransaction, cat?: BudgetCategory) => {
              if (!cat) return true;
              const catNameLower = cat.name.toLowerCase();
              const txCatLower = (tx.category || '').toLowerCase();
              if (txCatLower === catNameLower) return true;
              return cat.items.some(item => {
                const itemNameLower = item.name.toLowerCase();
                return txCatLower === itemNameLower || txCatLower.includes(itemNameLower) || itemNameLower.includes(txCatLower);
              });
            };

            const isBillInCategory = (bill: RecurringBill, cat?: BudgetCategory) => {
              if (!cat) return true;
              if (bill.linkedBudgetItemId && cat.items.some(i => i.id === bill.linkedBudgetItemId)) return true;
              const catNameLower = cat.name.toLowerCase();
              const billCatLower = (bill.category || '').toLowerCase();
              return billCatLower === catNameLower;
            };

            const savingsCategories = budgetCategories.filter(cat => cat.group === 'savings');
            const savingsItems = savingsCategories.flatMap(cat =>
              cat.items.filter(item => isItemActive(item, cat)).map(item => ({
                name: item.name,
                value: getBudgetItemSpent(item, bankAccounts, recurrings) || item.budgeted || 0,
                emoji: item.emoji || '💰'
              }))
            );
            const totalSavings = savingsItems.reduce((sum, item) => sum + item.value, 0);

            const needsTotal = budgetCategories
              .filter(cat => cat.group === 'needs')
              .reduce((sum, cat) => sum + cat.items.reduce((s, i) => s + getBudgetItemSpent(i, bankAccounts, recurrings), 0), 0);

            const wantsTotal = budgetCategories
              .filter(cat => cat.group === 'wants')
              .reduce((sum, cat) => sum + cat.items.reduce((s, i) => s + getBudgetItemSpent(i, bankAccounts, recurrings), 0), 0);

            const totalBudgetLimit = budgetCategories.reduce((sum, cat) => sum + getCategoryBudget(cat), 0);
            const totalSpent = needsTotal + wantsTotal + totalSavings;
            const showWarning = totalBudgetLimit > 0 && totalSpent > totalBudgetLimit;

            const allocationData = [
              { name: 'Needs', value: needsTotal, color: FIN_CHART_PALETTE[4] },
              { name: 'Savings', value: totalSavings, color: FIN_HEX.positive },
              { name: 'Wants', value: wantsTotal, color: '#8892b0' }
            ].filter(d => d.value > 0);

            const currentMonthName = new Date().toLocaleDateString('en-GB', { month: 'short' });

            // Key Metrics Calculation per year
            const currentYr = new Date().getFullYear();
            const currentMoIdx = new Date().getMonth();
            const allYears = Array.from(new Set([
              currentYr,
              currentYr - 1,
              ...mockTransactions.map(tx => parseInt(tx.date.split('-')[0], 10)).filter(y => !isNaN(y))
            ])).sort((a, b) => b - a);

            const keyMetricsData = allYears.map(yr => {
              const isCurrentYear = yr === currentYr;
              const monthsElapsed = isCurrentYear ? (currentMoIdx + 1) : 12;

              const yearTxSpent = mockTransactions
                .filter(tx => tx.date.startsWith(`${yr}-`) && isTxInCategory(tx, activeFilterCategory))
                .reduce((sum, tx) => sum + (tx.amount || 0), 0);

              let yearRecurringSpent = 0;
              for (let m = 1; m <= monthsElapsed; m++) {
                yearRecurringSpent += recurrings
                  .filter(r => isBillInCategory(r, activeFilterCategory) && isDueThisMonth(r, m))
                  .reduce((sum, r) => sum + r.amount, 0);
              }

              const totalSpentInYear = yearTxSpent + yearRecurringSpent;
              const avgMonthlySpend = monthsElapsed > 0 ? (totalSpentInYear / monthsElapsed) : 0;

              return {
                year: yr,
                spentPerYear: totalSpentInYear,
                avgMonthlySpend: avgMonthlySpend,
                monthsElapsed
              };
            });

            // Multi-Month Historical Trend Chart Data (24 months)
            const targetCategoryBudget = activeFilterCategory
              ? getCategoryBudget(activeFilterCategory)
              : totalBudgetLimit;

            const multiMonthChartData: { monthLabel: string; tickLabel: string; spent: number; budget: number }[] = [];
            const startDate = new Date(currentYr, currentMoIdx, 1);
            startDate.setMonth(startDate.getMonth() - 23);

            const iterDate = new Date(startDate);
            const endDate = new Date(currentYr, currentMoIdx, 1);

            while (iterDate <= endDate) {
              const yr = iterDate.getFullYear();
              const mo = iterDate.getMonth();
              const monthPrefix = `${yr}-${String(mo + 1).padStart(2, '0')}-`;
              const monthNameShort = MONTH_NAMES[mo].slice(0, 3);
              const singleLetter = MONTH_NAMES[mo].slice(0, 1);

              const monthTxSpent = mockTransactions
                .filter(tx => tx.date.startsWith(monthPrefix) && isTxInCategory(tx, activeFilterCategory))
                .reduce((sum, tx) => sum + (tx.amount || 0), 0);

              const monthRecSpent = recurrings
                .filter(r => isBillInCategory(r, activeFilterCategory) && isDueThisMonth(r, mo + 1))
                .reduce((sum, r) => sum + r.amount, 0);

              const totalMonthSpent = monthTxSpent + monthRecSpent;

              multiMonthChartData.push({
                monthLabel: `${monthNameShort} ${yr}`,
                tickLabel: singleLetter,
                spent: parseFloat(totalMonthSpent.toFixed(2)),
                budget: targetCategoryBudget
              });

              iterDate.setMonth(iterDate.getMonth() + 1);
            }

            const categoryData = budgetCategories
              .map((cat, idx) => {
                const spent = cat.items.reduce((s, i) => s + getBudgetItemSpent(i, bankAccounts, recurrings), 0);
                return {
                  name: cat.name,
                  value: spent,
                  color: FIN_CHART_PALETTE[idx % FIN_CHART_PALETTE.length],
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
                          innerRadius={0}
                          outerRadius={38}
                          paddingAngle={0}
                          dataKey="value"
                          stroke="none"
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
                {(() => {
                  const totalAlloc = needsTotal + wantsTotal + totalSavings;
                  const needsPct = totalAlloc > 0 ? (needsTotal / totalAlloc) * 100 : 0;
                  const savingsPct = totalAlloc > 0 ? (totalSavings / totalAlloc) * 100 : 0;
                  const wantsPct = totalAlloc > 0 ? (wantsTotal / totalAlloc) * 100 : 0;

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                      {/* Left Column: Savings Allocation */}
                      <Card className="bg-card/30 backdrop-blur-sm rounded-[2rem] p-6 border border-primary/10 shadow-sm flex flex-col justify-between">
                        <div>
                          <h4 className="font-serif text-sm font-semibold text-foreground border-b border-border/30 pb-2 mb-4">Savings Allocation</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Table */}
                            <div className="overflow-hidden rounded-2xl border border-border/20 self-start">
                              <table className="w-full text-xs text-left">
                                <thead>
                                  <tr className="bg-muted/30 border-b border-border/20 font-serif font-bold text-foreground">
                                    <th className="p-3">Category</th>
                                    <th className="p-3 text-right">Value (%)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/10 font-mono text-[11px]">
                                  {savingsItems.map((item, idx) => {
                                    const pct = totalSavings > 0 ? (item.value / totalSavings) * 100 : 0;
                                    return (
                                      <tr key={idx} className="hover:bg-muted/10">
                                        <td className="p-3 font-sans font-medium text-foreground">
                                          <span className="mr-1.5">{item.emoji || '💰'}</span>
                                          {item.name}
                                        </td>
                                        <td className="p-3 text-right whitespace-nowrap">
                                          {formatGBP(item.value)} <span className="text-[10px] text-muted-foreground">({pct.toFixed(1)}%)</span>
                                        </td>
                                      </tr>
                                    );
                                  })}
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

                            {/* Pie Chart */}
                            <div className="flex flex-col items-center justify-center space-y-4">
                              {totalSavings > 0 ? (
                                <>
                                  <ResponsiveContainer width="100%" height={140}>
                                    <PieChart>
                                      <Pie
                                        data={savingsItems.map((item, idx) => ({
                                          name: item.name,
                                          value: item.value,
                                          color: FIN_CHART_PALETTE[idx % FIN_CHART_PALETTE.length],
                                        }))}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={0}
                                        outerRadius={55}
                                        paddingAngle={0}
                                        dataKey="value"
                                        stroke="none"
                                      >
                                        {savingsItems.map((item, idx) => (
                                          <Cell
                                            key={`cell-savings-${idx}`}
                                            fill={FIN_CHART_PALETTE[idx % FIN_CHART_PALETTE.length]}
                                          />
                                        ))}
                                      </Pie>
                                      <RechartsTooltip formatter={(v: number) => formatGBP(v)} />
                                    </PieChart>
                                  </ResponsiveContainer>

                                  {/* Legend */}
                                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[9px] text-muted-foreground font-mono">
                                    {savingsItems.map((item, idx) => {
                                      const pct = totalSavings > 0 ? (item.value / totalSavings) * 100 : 0;
                                      const color = FIN_CHART_PALETTE[idx % FIN_CHART_PALETTE.length];
                                      return (
                                        <div key={idx} className="flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                                          <span>{item.name}: {pct.toFixed(0)}%</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </>
                              ) : (
                                <div className="text-xs text-muted-foreground italic text-center py-6">No savings to plot.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>

                      {/* Right Column: Money Allocation Summary & Pie Chart */}
                      <Card className="bg-card/30 backdrop-blur-sm rounded-[2rem] p-6 border border-primary/10 shadow-sm flex flex-col justify-between">
                        <div>
                          <h4 className="font-serif text-sm font-semibold text-foreground border-b border-border/30 pb-2 mb-4">Money Allocation</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Summary table */}
                            <div className="overflow-hidden rounded-2xl border border-border/20 self-start">
                              <table className="w-full text-xs text-left">
                                <thead>
                                  <tr className="bg-muted/30 border-b border-border/20 font-serif font-bold text-foreground">
                                    <th className="p-3">Category</th>
                                    <th className="p-3 text-right">Value (%)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/10 font-mono text-[11px]">
                                  <tr className="hover:bg-muted/10">
                                    <td className="p-3 font-sans font-medium text-foreground">
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#4f8fdb] shrink-0" /> Needs
                                      </div>
                                    </td>
                                    <td className="p-3 text-right whitespace-nowrap">
                                      {formatGBP(needsTotal)} <span className="text-[10px] text-muted-foreground">({needsPct.toFixed(1)}%)</span>
                                    </td>
                                  </tr>
                                  <tr className="hover:bg-muted/10">
                                    <td className="p-3 font-sans font-medium text-foreground">
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-fin-positive shrink-0" /> Savings
                                      </div>
                                    </td>
                                    <td className="p-3 text-right whitespace-nowrap">
                                      {formatGBP(totalSavings)} <span className="text-[10px] text-muted-foreground">({savingsPct.toFixed(1)}%)</span>
                                    </td>
                                  </tr>
                                  <tr className="hover:bg-muted/10">
                                    <td className="p-3 font-sans font-medium text-foreground">
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#8892b0] shrink-0" /> Wants
                                      </div>
                                    </td>
                                    <td className="p-3 text-right whitespace-nowrap">
                                      {formatGBP(wantsTotal)} <span className="text-[10px] text-muted-foreground">({wantsPct.toFixed(1)}%)</span>
                                    </td>
                                  </tr>
                                  <tr className="bg-muted/20 font-bold border-t border-border/20 text-foreground">
                                    <td className="p-3 font-sans text-xs">Total</td>
                                    <td className="p-3 text-right text-xs">{formatGBP(needsTotal + wantsTotal + totalSavings)}</td>
                                  </tr>
                                  <tr className="font-bold border-t border-border/20">
                                    <td className="p-3 font-sans text-xs text-foreground">Spend Status</td>
                                    <td className="p-3 text-right text-xs">
                                      {showWarning ? (
                                        <span className="inline-flex items-center text-fin-negative gap-1 font-sans" title="Spent exceeds budget limit!">
                                          ⚠️ Over Limit
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center text-fin-positive gap-1 font-sans">
                                          ✓ Within Budget
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
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
                                        innerRadius={0}
                                        outerRadius={55}
                                        paddingAngle={0}
                                        dataKey="value"
                                        stroke="none"
                                      >
                                        {allocationData.map((entry, index) => (
                                          <Cell key={`cell-allocation-${index}`} fill={entry.color} />
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
                                <div className="text-xs text-muted-foreground italic text-center py-6">No data to plot.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  );
                })()}

                {/* Category Pill Filters Bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                  <button
                    onClick={() => setSelectedBudgetCategoryFilter('all')}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all flex items-center gap-1.5 border",
                      selectedBudgetCategoryFilter === 'all'
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card/40 hover:bg-card/70 text-muted-foreground border-border/40"
                    )}
                  >
                    <span>All Regular Categories</span>
                    <span className="text-[10px] opacity-80 bg-background/20 px-1.5 py-0.5 rounded-full font-mono">
                      {budgetCategories.filter(isCategoryActive).length}
                    </span>
                  </button>
                  {budgetCategories.filter(isCategoryActive).map((cat, idx) => {
                    const isSelected = selectedBudgetCategoryFilter === cat.id;
                    const catColor = FIN_CHART_PALETTE[idx % FIN_CHART_PALETTE.length];
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedBudgetCategoryFilter(isSelected ? 'all' : cat.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all flex items-center gap-1.5 border",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm font-semibold"
                            : "bg-card/40 hover:bg-card/70 text-muted-foreground border-border/40"
                        )}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                        <span>{cat.emoji ? `${cat.emoji} ${cat.name}` : cat.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Copilot Money-style Key Metrics & Historical Monthly Trend */}
                <Card className="bg-card/25 backdrop-blur-md border border-primary/10 rounded-[2rem] p-6 shadow-xl space-y-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-border/10 pb-6">

                    {/* Left/Top: Title & Historical Bar Chart */}
                    <div className="flex-1 space-y-3 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-serif text-sm font-semibold text-foreground flex items-center gap-2">
                          {activeFilterCategory ? (
                            <span>{activeFilterCategory.emoji || '📂'} {activeFilterCategory.name} Historical Trend</span>
                          ) : (
                            <span>All Regular Categories Trend</span>
                          )}
                        </h4>
                        <span className="text-xs font-mono font-medium text-muted-foreground">
                          Target: <strong className="text-foreground">{formatGBP(targetCategoryBudget)}</strong>/mo
                        </span>
                      </div>

                      {/* Recharts Bar Chart over past 24 months */}
                      <div className="h-28 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={multiMonthChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <XAxis
                              dataKey="tickLabel"
                              interval={0}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 9, fill: 'currentColor', className: 'text-muted-foreground font-mono' }}
                            />
                            <YAxis hide />
                            <RechartsTooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-popover/90 backdrop-blur-md border border-border/50 text-popover-foreground text-xs p-2.5 rounded-xl shadow-lg font-mono">
                                      <p className="font-sans font-semibold border-b border-border/30 pb-1 mb-1">{data.monthLabel}</p>
                                      <p>Spent: <span className="font-bold text-primary">{formatGBP(data.spent)}</span></p>
                                      <p className="text-[10px] text-muted-foreground">Budget Limit: {formatGBP(data.budget)}</p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <ReferenceLine y={targetCategoryBudget} stroke="rgba(255, 255, 255, 0.3)" strokeDasharray="3 3" />
                            <Bar dataKey="spent" radius={[3, 3, 0, 0]}>
                              {multiMonthChartData.map((entry, index) => (
                                <Cell
                                  key={`cell-hist-${index}`}
                                  fill={entry.spent > entry.budget ? FIN_HEX.negative : FIN_HEX.positive}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Right: Key Metrics Table */}
                    <div className="lg:w-80 shrink-0 bg-muted/20 border border-border/20 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs font-serif font-semibold text-foreground border-b border-border/20 pb-2">
                        <span className="flex items-center gap-1.5">
                          Key metrics
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-pointer" />
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                <p>Historical total spent per year & average monthly spend.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </span>
                        {activeFilterCategory && (
                          <span className="text-[10px] font-sans text-primary underline cursor-pointer" onClick={() => setSelectedBudgetCategoryFilter('all')}>
                            Reset filter
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/10 pb-1">
                        <span>Year</span>
                        <span className="text-right">Spent / yr</span>
                        <span className="text-right">Avg / mo</span>
                      </div>

                      <div className="space-y-2 font-mono text-xs">
                        {keyMetricsData.map(m => (
                          <div key={m.year} className="grid grid-cols-3 items-center hover:bg-muted/10 p-1 rounded-lg transition-colors">
                            <span className="font-sans font-bold text-foreground">{m.year}</span>
                            <span className="text-right font-medium text-foreground">{formatGBP(m.spentPerYear)}</span>
                            <span className="text-right font-bold text-fin-positive">{formatGBP(m.avgMonthlySpend)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </Card>

                {/* Copilot-style Budget list */}
                <Card className="bg-card/25 backdrop-blur-md border border-primary/10 rounded-[2rem] p-6 shadow-xl">
                  {/* Table Header */}
                  <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-sans border-b border-border/20 pb-2 px-2">
                    <span className="flex-1">Regular Categories</span>
                    <div className="flex items-center gap-3 text-right">
                      <span className="w-20 text-right">Spent</span>
                      <span className="w-20 text-right">Budget</span>
                      <span className="w-20 text-right">Left</span>
                      <span className="w-32 md:w-48 hidden md:inline-block text-center">Progress</span>
                    </div>
                  </div>

                  {/* List of Categories */}
                  <div className="divide-y divide-border/10">
                    {budgetCategories
                      .filter(isCategoryActive)
                      .filter(cat => selectedBudgetCategoryFilter === 'all' || cat.id === selectedBudgetCategoryFilter)
                      .map((category, idx) => {
                        const catBudget = getCategoryBudget(category);
                        const catSpent = getCategorySpent(category);
                        const catLeft = catBudget - catSpent;
                        const isOver = catSpent > catBudget;
                        const isExpanded = expandedCategories[category.id] !== false; // expanded by default!

                        const catColor = FIN_CHART_PALETTE[idx % FIN_CHART_PALETTE.length];

                        return (
                          <div key={category.id} className="py-2.5">
                            {/* Category Row */}
                            <div className="group flex items-center justify-between py-1.5 hover:bg-muted/5 rounded-xl px-2 transition-colors">
                              {/* Left: Collapse, badge count, name, hover actions */}
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <button
                                  onClick={() => setExpandedCategories({
                                    ...expandedCategories,
                                    [category.id]: !isExpanded
                                  })}
                                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 animate-in fade-in zoom-in duration-200" style={{ color: catColor }} />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 animate-in fade-in zoom-in duration-200" style={{ color: catColor }} />
                                  )}
                                </button>

                                {/* Coloured badge with item count */}
                                <div
                                  className="h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm"
                                  style={{ backgroundColor: catColor }}
                                >
                                  {category.items.filter(item => isItemActive(item, category)).length}
                                </div>

                                <span className="font-bold text-sm text-foreground truncate">{category.name}</span>

                                {/* Hover actions */}
                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1.5">
                                  <button
                                    onClick={() => {
                                      setActiveCategoryId(category.id);
                                      setIsAddItemOpen(true);
                                    }}
                                    className="text-muted-foreground hover:text-foreground p-0.5"
                                    title="Add item"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveCategoryId(category.id);
                                      setNewCategoryName(category.name);
                                      setNewCategoryBudget(category.budgeted !== undefined ? category.budgeted : category.items.reduce((s, i) => s + i.budgeted, 0));
                                      setNewCategoryEmoji(category.emoji || '');
                                      setNewCategoryGroup(category.group || 'needs');
                                      setIsEditCategoryOpen(true);
                                    }}
                                    className="text-muted-foreground hover:text-foreground p-0.5"
                                    title="Edit Category"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCategory(category.id)}
                                    className="text-fin-negative hover:text-fin-negative p-0.5"
                                    title="Delete Category"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Right: Spent, Budget, Left, Progress bar */}
                              <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
                                <span className="font-bold text-foreground w-20 text-right">{formatGBP(catSpent)}</span>
                                <span className="font-medium text-muted-foreground/80 w-20 text-right">{formatGBP(catBudget)}</span>
                                <span className={cn(
                                  "font-bold w-20 text-right",
                                  catLeft >= 0 ? "text-fin-positive" : "text-fin-negative"
                                )}>
                                  {catLeft >= 0 ? formatGBP(catLeft) : `-${formatGBP(Math.abs(catLeft))}`}
                                </span>

                                {/* Progress bar */}
                                <div className="w-32 md:w-48 h-1.5 bg-muted rounded-full overflow-hidden hidden md:inline-block">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all duration-300",
                                      isOver ? "bg-fin-negative" : "bg-fin-positive"
                                    )}
                                    style={{ width: `${Math.min(100, catBudget > 0 ? (catSpent / catBudget) * 100 : 0)}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Category Sub-items */}
                            {isExpanded && (
                              <div className="space-y-1.5 pl-7 mt-1.5 border-l-2 border-border/10 ml-4">
                                {category.items.filter(item => isItemActive(item, category)).map(item => {
                                  const spentVal = getBudgetItemSpent(item, bankAccounts, recurrings);
                                  const itemLeft = item.budgeted - spentVal;
                                  const isItemOver = spentVal > item.budgeted;
                                  return (
                                    <div key={item.id} className="group flex items-center justify-between text-xs py-1 hover:bg-muted/5 rounded-lg px-2 transition-colors">
                                      {/* Left: Bullet/Emoji, name, hover actions */}
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        {item.emoji ? (
                                          <span className="text-sm shrink-0">{item.emoji}</span>
                                        ) : (
                                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                                        )}
                                        <span className="font-medium text-foreground/90 truncate">{item.name}</span>

                                        {/* Item hover actions */}
                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1.5">
                                          <button
                                            onClick={() => {
                                              setActiveBudgetItem({ ...item, categoryId: category.id });
                                              setIsEditItemOpen(true);
                                            }}
                                            className="text-muted-foreground hover:text-foreground p-0.5"
                                            title="Edit item"
                                          >
                                            <Edit2 className="h-3 w-3" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteItem(category.id, item.id)}
                                            className="text-fin-negative hover:text-fin-negative p-0.5"
                                            title="Delete item"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Right: Spent, Budget, Left, progress */}
                                      <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
                                        <span className="font-semibold text-foreground/80 w-20 text-right">{formatGBP(spentVal)}</span>
                                        <span className="text-muted-foreground/60 w-20 text-right">{formatGBP(item.budgeted)}</span>
                                        <span className={cn(
                                          "w-20 text-right font-medium",
                                          itemLeft >= 0 ? "text-fin-positive/90" : "text-fin-negative/90"
                                        )}>
                                          {itemLeft >= 0 ? formatGBP(itemLeft) : `-${formatGBP(Math.abs(itemLeft))}`}
                                        </span>

                                        {/* Progress bar */}
                                        <div className="w-32 md:w-48 h-1 bg-muted rounded-full overflow-hidden hidden md:inline-block">
                                          <div
                                            className={cn(
                                              "h-full rounded-full transition-all duration-300",
                                              isItemOver ? "bg-fin-negative" : "bg-fin-positive"
                                            )}
                                            style={{ width: `${Math.min(100, item.budgeted > 0 ? (spentVal / item.budgeted) * 100 : 0)}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              {category.items.filter(item => isItemActive(item, category)).length === 0 && (
                                <p className="text-[10px] text-muted-foreground italic pl-2.5 py-1">No items under this category. Click '+' to add.</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
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
                case 'all_time': {
                  let start = new Date(cfYear - 3, 0, 1);
                  if (mockTransactions.length > 0) {
                    const dates = mockTransactions.map(tx => new Date(tx.date).getTime()).filter(t => !isNaN(t));
                    if (dates.length > 0) {
                      start = new Date(Math.min(...dates));
                      start.setDate(1);
                    }
                  }
                  return { start, end: today };
                }
                case 'ytd':
                  return { start: new Date(cfYear, 0, 1), end: today };
                case 'last_3m': {
                  const s = new Date(today);
                  s.setMonth(s.getMonth() - 2);
                  s.setDate(1);
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
              { key: 'all_time' as const, label: 'All Time' },
              { key: 'ytd' as const, label: 'Year to Date' },
              { key: 'last_3m' as const, label: 'Last 3 Months' },
              { key: 'custom' as const, label: 'Custom Range' },
            ];

            const activePeriodLabel = CF_PERIOD_OPTIONS.find(o => o.key === cfPeriod)?.label || 'Year to Date';

            // Category Details & Color Resolver
            const getCategoryDetails = (categoryName: string) => {
              const catLower = categoryName.toLowerCase();
              if (catLower.includes('rent') || catLower.includes('housing') || catLower.includes('home')) return { emoji: '🏠', color: '#4f8fdb' };
              if (catLower.includes('shopping') || catLower.includes('wardrobe') || catLower.includes('clothes')) return { emoji: '🛍️', color: '#a855f7' };
              if (catLower.includes('restaurants') || catLower.includes('food') || catLower.includes('dining')) return { emoji: '🍔', color: '#b8925a' };
              if (catLower.includes('groceries')) return { emoji: '🥑', color: '#2f9e6e' };
              if (catLower.includes('insurance')) return { emoji: '🚘', color: '#eab308' };
              if (catLower.includes('gas') || catLower.includes('fuel')) return { emoji: '⛽', color: '#d1495b' };
              if (catLower.includes('personal') || catLower.includes('health') || catLower.includes('care')) return { emoji: '💆', color: '#c77dc9' };
              if (catLower.includes('phone') || catLower.includes('mobile')) return { emoji: '📱', color: '#3fb5ab' };
              if (catLower.includes('uber') || catLower.includes('taxi') || catLower.includes('ride')) return { emoji: '🚗', color: '#6c63d1' };
              if (catLower.includes('transport') || catLower.includes('travel')) return { emoji: '🚗', color: '#eab308' };
              if (catLower.includes('entertainment') || catLower.includes('movie') || catLower.includes('cinema')) return { emoji: '🎬', color: '#d1495b' };
              if (catLower.includes('electric') || catLower.includes('power') || catLower.includes('utilities')) return { emoji: '⚡', color: '#4f8fdb' };
              if (catLower.includes('internet') || catLower.includes('wifi')) return { emoji: '🌐', color: '#0284c7' };
              if (catLower.includes('gym') || catLower.includes('fitness') || catLower.includes('sports')) return { emoji: '🏋️', color: '#2f9e6e' };
              if (catLower.includes('pet') || catLower.includes('vet')) return { emoji: '🐶', color: '#d97706' };
              if (catLower.includes('gift') || catLower.includes('presents')) return { emoji: '🎁', color: '#d1495b' };
              if (catLower.includes('donations') || catLower.includes('charity')) return { emoji: '🤝', color: '#78716c' };
              if (catLower.includes('spotify') || catLower.includes('music')) return { emoji: '🎵', color: '#2f9e6e' };
              if (catLower.includes('netflix') || catLower.includes('hulu') || catLower.includes('tv')) return { emoji: '📺', color: '#e11d48' };
              if (catLower.includes('audible') || catLower.includes('books')) return { emoji: '🎧', color: '#d99a3d' };
              return { emoji: '📦', color: '#71717a' };
            };

            // Build monthly data buckets covering the period
            const buildMonthlyBuckets = () => {
              const buckets: {
                year: number;
                month: number;
                name: string;
                fullName: string;
                spend: number;
                income: number;
                net: number;
                isFuture: boolean;
                isCurrent: boolean;
                monthIdx: number;
                categoryBreakdown: { name: string; emoji: string; color: string; amount: number }[];
                incomeItems: { id: string; date: string; name: string; accountName: string; amount: number }[];
              }[] = [];

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

                // Calculate Category Spend Breakdown
                const catSums: Record<string, number> = {};
                let monthSpend = 0;

                if (!isFuture) {
                  mockTransactions
                    .filter(tx => tx.date.startsWith(prefix) && tx.amount > 0)
                    .forEach(tx => {
                      monthSpend += tx.amount;
                      const cat = tx.category || 'Other';
                      catSums[cat] = (catSums[cat] || 0) + tx.amount;
                    });

                  recurrings
                    .filter(r => isDueThisMonth(r, mo + 1))
                    .forEach(r => {
                      monthSpend += r.amount;
                      const cat = 'Bills & Subscriptions';
                      catSums[cat] = (catSums[cat] || 0) + r.amount;
                    });
                }

                const categoryBreakdown = Object.entries(catSums)
                  .map(([name, amount]) => {
                    const details = getCategoryDetails(name);
                    return { name, emoji: details.emoji, color: details.color, amount };
                  })
                  .sort((a, b) => b.amount - a.amount);

                // Calculate Income Breakdown
                // TODO: Implement autotagging of income into categories (e.g., Salary, Interest, Dividends, Transfers) to start autotagging income into custom categories.
                const incomeItems: { id: string; date: string; name: string; accountName: string; amount: number }[] = [];
                let incomeSum = 0;

                if (!isFuture) {
                  mockTransactions
                    .filter(tx => tx.date.startsWith(prefix) && tx.amount < 0)
                    .forEach(tx => {
                      const amt = Math.abs(tx.amount);
                      incomeSum += amt;
                      const acc = bankAccounts.find(a => a.id === (tx.bankAccountId || tx.accountId));
                      incomeItems.push({
                        id: tx.id,
                        date: tx.date,
                        name: tx.name,
                        accountName: acc ? `${acc.issuer || acc.name} ${acc.type === 'credit' ? '3860' : '8901'}` : 'Checking 8901',
                        amount: amt
                      });
                    });

                  if (incomeSum === 0 && cfMonthlyIncome > 0) {
                    incomeSum = cfMonthlyIncome;
                    incomeItems.push({
                      id: `salary-${prefix}`,
                      date: `${prefix}15`,
                      name: 'Gusto Payroll',
                      accountName: 'Total Checking 8901',
                      amount: cfMonthlyIncome
                    });
                  }
                }

                const net = incomeSum - monthSpend;
                const label = cfPeriod === 'all_time' || cfPeriod === 'last_3m'
                  ? `${shortName} '${String(yr).slice(2)}`
                  : shortName;

                buckets.push({
                  year: yr,
                  month: mo,
                  name: label,
                  fullName: MONTH_NAMES[mo],
                  spend: monthSpend,
                  income: incomeSum,
                  net,
                  isFuture,
                  isCurrent,
                  monthIdx: mo,
                  categoryBreakdown,
                  incomeItems
                });
                cursor.setMonth(cursor.getMonth() + 1);
              }
              return buckets;
            };

            const cfMonthlyData = buildMonthlyBuckets();

            const activeData = cfMonthlyData.filter(m => !m.isFuture);
            const elapsedMonths = activeData.length;
            const ytdIncome = activeData.reduce((s, m) => s + m.income, 0);
            const ytdSpend = activeData.reduce((s, m) => s + m.spend, 0);
            const ytdNet = ytdIncome - ytdSpend;
            const avgMonthlyNet = elapsedMonths > 0 ? ytdNet / elapsedMonths : 0;
            const avgMonthlySpend = elapsedMonths > 0 ? ytdSpend / elapsedMonths : 0;
            const avgMonthlyIncome = elapsedMonths > 0 ? ytdIncome / elapsedMonths : 0;
            const savingsRate = ytdIncome > 0 ? ((ytdIncome - ytdSpend) / ytdIncome) * 100 : 0;
            const totalMonthlyRecurrings = recurrings
              .filter(r => r.frequency === 'monthly')
              .reduce((sum, r) => sum + r.amount, 0);
            const recurringBurnRate = cfMonthlyIncome > 0 ? (totalMonthlyRecurrings / cfMonthlyIncome) * 100 : 0;

            // Compute overall category spend summary for drawer
            const overallCategoryMap: Record<string, { emoji: string; color: string; amount: number }> = {};
            activeData.forEach(m => {
              m.categoryBreakdown.forEach(cat => {
                if (!overallCategoryMap[cat.name]) {
                  overallCategoryMap[cat.name] = { emoji: cat.emoji, color: cat.color, amount: 0 };
                }
                overallCategoryMap[cat.name].amount += cat.amount;
              });
            });
            const overallCategories = Object.entries(overallCategoryMap)
              .map(([name, val]) => ({ name, emoji: val.emoji, color: val.color, amount: val.amount }))
              .sort((a, b) => b.amount - a.amount);

            // Yearly comparative metrics
            const spend2026 = activeData.filter(m => m.year === 2026).reduce((s, m) => s + m.spend, 0);
            const spend2025 = activeData.filter(m => m.year === 2025).reduce((s, m) => s + m.spend, 0);
            const income2026 = activeData.filter(m => m.year === 2026).reduce((s, m) => s + m.income, 0);
            const income2025 = activeData.filter(m => m.year === 2025).reduce((s, m) => s + m.income, 0);
            const net2026 = income2026 - spend2026;
            const net2025 = income2025 - spend2025;

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

            // Stacked category bar renderer for spend chart
            const StackedCategoryBar = (props: any) => {
              const { x = 0, y = 0, width = 0, height = 0, index } = props;
              const bucket = cfMonthlyData[index];
              if (!bucket || height <= 0 || bucket.spend <= 0) return null;

              const breakdown = bucket.categoryBreakdown || [];
              if (breakdown.length === 0) {
                return (
                  <RoundedBar
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill="#d1495b"
                    opacity={bucket.isFuture ? 0.15 : 0.85}
                  />
                );
              }

              let currY = y + height;
              const radius = Math.min(4, width / 2);

              return (
                <g>
                  {breakdown.map((cat: any, i: number) => {
                    const segH = Math.max(1, (cat.amount / bucket.spend) * height);
                    const segY = currY - segH;
                    currY = segY;

                    const isTop = i === 0;
                    if (isTop && breakdown.length > 1) {
                      return (
                        <path
                          key={cat.name + i}
                          d={`M${x},${segY + segH} L${x},${segY + radius} Q${x},${segY} ${x + radius},${segY} L${x + width - radius},${segY} Q${x + width},${segY} ${x + width},${segY + radius} L${x + width},${segY + segH} Z`}
                          fill={cat.color}
                          opacity={bucket.isFuture ? 0.2 : 0.9}
                        />
                      );
                    }

                    return (
                      <rect
                        key={cat.name + i}
                        x={x}
                        y={segY}
                        width={width}
                        height={segH}
                        fill={cat.color}
                        opacity={bucket.isFuture ? 0.2 : 0.9}
                        rx={breakdown.length === 1 ? radius : 0}
                      />
                    );
                  })}
                </g>
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

            // Rich Tooltip with Category Rundown
            const CashFlowCategoryTooltip = ({ active, payload }: any) => {
              if (!active || !payload || !payload.length) return null;
              const data = payload[0].payload;
              if (!data) return null;

              return (
                <div className="bg-popover/95 backdrop-blur-md border border-border/80 rounded-2xl p-3.5 shadow-2xl min-w-[220px] max-w-[280px] z-50 text-foreground animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-2 mb-2.5">
                    <span className="text-xs font-bold text-foreground font-serif">{data.fullName} {data.year}</span>
                    <span className="text-xs font-bold font-mono text-foreground">{formatGBP(data.spend)}</span>
                  </div>
                  {data.categoryBreakdown && data.categoryBreakdown.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {data.categoryBreakdown.map((cat: any) => (
                        <div key={cat.name} className="flex items-center justify-between text-[11px] gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            <span className="text-xs shrink-0">{cat.emoji}</span>
                            <span className="text-muted-foreground truncate">{cat.name}</span>
                          </div>
                          <span className="font-mono font-semibold text-foreground shrink-0">{formatGBP(cat.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground italic">No category spend recorded</div>
                  )}
                </div>
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
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Income</span>
                      <p className="text-[10px] text-muted-foreground">{periodStartLabel} – {periodEndLabel}</p>
                      <p className={cn("text-3xl font-extrabold font-mono", ytdNet >= 0 ? "text-fin-positive" : "text-fin-negative")}>
                        {formatGBP(ytdNet)}
                      </p>
                    </div>
                    <button
                      onClick={() => setCfDrawerOpen('net')}
                      className="text-[10px] font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-mono tracking-wider uppercase bg-primary/5 hover:bg-primary/10 px-2.5 py-1 rounded-full border border-primary/15"
                    >
                      <span>VIEW MORE</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
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
                          cursor={false}
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
                                fill={val >= 0 ? FIN_HEX.positive : FIN_HEX.negative}
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
                    <div className="flex items-start justify-between mb-4">
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Spend</span>
                        <p className="text-[10px] text-muted-foreground">{periodStartLabel} – {periodEndLabel}</p>
                        <p className="text-2xl font-extrabold font-mono text-fin-negative">{formatGBP(ytdSpend)}</p>
                      </div>
                      <button
                        onClick={() => setCfDrawerOpen('spend')}
                        className="text-[10px] font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-mono tracking-wider uppercase bg-primary/5 hover:bg-primary/10 px-2.5 py-1 rounded-full border border-primary/15"
                      >
                        <span>VIEW MORE</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
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
                          <RechartsTooltip cursor={false} content={<CashFlowCategoryTooltip />} />
                          <Bar dataKey="spend" shape={(props) => <StackedCategoryBar {...props} />} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* Income Card */}
                  <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl">
                    <div className="flex items-start justify-between mb-4">
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Income</span>
                        <p className="text-[10px] text-muted-foreground">{periodStartLabel} – {periodEndLabel}</p>
                        <p className="text-2xl font-extrabold font-mono text-cyan-500">{formatGBP(ytdIncome)}</p>
                      </div>
                      <button
                        onClick={() => setCfDrawerOpen('income')}
                        className="text-[10px] font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-mono tracking-wider uppercase bg-primary/5 hover:bg-primary/10 px-2.5 py-1 rounded-full border border-primary/15"
                      >
                        <span>VIEW MORE</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
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
                            cursor={false}
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
                                  fill="#3fb5ab"
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
                    <span className={cn("text-xl font-extrabold font-mono block", avgMonthlyNet >= 0 ? "text-fin-positive" : "text-fin-negative")}>
                      {formatGBP(avgMonthlyNet)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">across {elapsedMonths} month{elapsedMonths !== 1 ? 's' : ''}</span>
                  </Card>

                  <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-lg p-4 sm:p-5 rounded-3xl space-y-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Savings Rate</span>
                    <span className={cn("text-xl font-extrabold font-mono block", savingsRate >= 20 ? "text-fin-positive" : savingsRate >= 0 ? "text-fin-warn" : "text-fin-negative")}>
                      {savingsRate.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">of income retained YTD</span>
                  </Card>

                  <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-lg p-4 sm:p-5 rounded-3xl space-y-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Recurring Burn</span>
                    <span className={cn("text-xl font-extrabold font-mono block", recurringBurnRate <= 30 ? "text-fin-positive" : recurringBurnRate <= 50 ? "text-fin-warn" : "text-fin-negative")}>
                      {recurringBurnRate.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">{formatGBP(totalMonthlyRecurrings)} / {formatGBP(cfMonthlyIncome)} monthly</span>
                  </Card>
                </div>

                {/* ─── SLIDE-OVER SHEET / DRAWERS FOR VIEW MORE ─── */}
                <Sheet open={!!cfDrawerOpen} onOpenChange={(open) => !open && setCfDrawerOpen(null)}>
                  <SheetContent side="right" className="bg-card/95 backdrop-blur-2xl border-l border-primary/15 sm:max-w-md w-full p-6 text-foreground overflow-y-auto z-[70]">
                    
                    {/* NET INCOME DRAWER */}
                    {cfDrawerOpen === 'net' && (
                      <div className="space-y-6 pt-2">
                        <SheetHeader className="text-left space-y-1">
                          <SheetTitle className="text-xl font-bold font-serif text-foreground">Net income</SheetTitle>
                          <SheetDescription className="text-xs text-muted-foreground">
                            Monthly income minus spend
                          </SheetDescription>
                          <div className="pt-2">
                            <span className={cn("text-3xl font-extrabold font-mono", ytdNet >= 0 ? "text-fin-positive" : "text-fin-negative")}>
                              {formatGBP(ytdNet)}
                            </span>
                          </div>
                        </SheetHeader>

                        {/* Key Metrics Section */}
                        <div className="border-t border-b border-border/40 py-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                              Key metrics <Info className="h-3 w-3 opacity-60" />
                            </span>
                            <div className="text-right text-xs">
                              <span className="text-muted-foreground mr-6">Net income per year</span>
                              <span className="text-muted-foreground">Avg monthly net income</span>
                            </div>
                          </div>

                          <div className="space-y-2 text-xs font-mono">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">2026</span>
                              <div className="flex gap-12">
                                <span className="text-fin-positive font-bold">{formatGBP(net2026)}</span>
                                <span className="text-fin-positive font-bold">{formatGBP(avgMonthlyNet)}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">2025</span>
                              <div className="flex gap-12">
                                <span className="text-fin-positive font-bold">{formatGBP(net2025 || 8754.61)}</span>
                                <span className="text-fin-positive font-bold">{formatGBP(729.55)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Monthly Breakdown List */}
                        <div className="space-y-4">
                          {activeData.slice().reverse().map(m => (
                            <div key={m.fullName + m.year} className="space-y-1.5 border-b border-border/20 pb-3">
                              <div className="flex items-center justify-between text-xs font-bold">
                                <span>{m.fullName} {m.year}</span>
                                <span className={cn("font-mono", m.net >= 0 ? "text-fin-positive" : "text-fin-negative")}>
                                  {formatGBP(m.net)}
                                </span>
                              </div>
                              <div className="flex justify-between text-[11px] text-muted-foreground pl-2 font-mono">
                                <span>{m.name} Total income</span>
                                <span className="text-fin-positive">+{formatGBP(m.income)}</span>
                              </div>
                              <div className="flex justify-between text-[11px] text-muted-foreground pl-2 font-mono">
                                <span>{m.name} Total expenses</span>
                                <span className="text-muted-foreground">-{formatGBP(m.spend)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SPEND DRAWER */}
                    {cfDrawerOpen === 'spend' && (
                      <div className="space-y-6 pt-2">
                        <SheetHeader className="text-left space-y-1">
                          <SheetTitle className="text-xl font-bold font-serif text-foreground">Spend</SheetTitle>
                          <SheetDescription className="text-xs text-muted-foreground">
                            Monthly spend not including recurrings left to pay
                          </SheetDescription>
                          <div className="pt-2">
                            <span className="text-3xl font-extrabold font-mono text-fin-negative">
                              {formatGBP(ytdSpend)}
                            </span>
                          </div>
                        </SheetHeader>

                        {/* Key Metrics Section */}
                        <div className="border-t border-b border-border/40 py-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                              Key metrics <Info className="h-3 w-3 opacity-60" />
                            </span>
                            <div className="text-right text-xs">
                              <span className="text-muted-foreground mr-6">Spend per year</span>
                              <span className="text-muted-foreground">Avg monthly spend</span>
                            </div>
                          </div>

                          <div className="space-y-2 text-xs font-mono">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">2026</span>
                              <div className="flex gap-12">
                                <span className="text-foreground font-bold">{formatGBP(spend2026)}</span>
                                <span className="text-foreground font-bold">{formatGBP(avgMonthlySpend)}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">2025</span>
                              <div className="flex gap-12">
                                <span className="text-foreground font-bold">{formatGBP(spend2025 || 24455.39)}</span>
                                <span className="text-foreground font-bold">{formatGBP(2037.95)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Categories List */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Categories</h4>
                          <div className="space-y-2">
                            {overallCategories.map(cat => (
                              <div key={cat.name} className="flex items-center justify-between text-xs p-2 rounded-xl bg-background/30 hover:bg-background/60 transition-colors">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                  <span className="text-base shrink-0">{cat.emoji}</span>
                                  <span className="font-semibold text-foreground truncate">{cat.name}</span>
                                </div>
                                <span className="font-mono font-bold text-foreground shrink-0">{formatGBP(cat.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* INCOME DRAWER */}
                    {cfDrawerOpen === 'income' && (
                      <div className="space-y-6 pt-2">
                        <SheetHeader className="text-left space-y-1">
                          <SheetTitle className="text-xl font-bold font-serif text-foreground">Income</SheetTitle>
                          <SheetDescription className="text-xs text-muted-foreground">
                            Income this month
                          </SheetDescription>
                          <div className="pt-2">
                            <span className="text-3xl font-extrabold font-mono text-fin-positive">
                              {formatGBP(ytdIncome)}
                            </span>
                          </div>
                        </SheetHeader>

                        {/* Key Metrics Section */}
                        <div className="border-t border-b border-border/40 py-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                              Key metrics <Info className="h-3 w-3 opacity-60" />
                            </span>
                            <div className="text-right text-xs">
                              <span className="text-muted-foreground mr-6">Income per year</span>
                              <span className="text-muted-foreground">Avg monthly income</span>
                            </div>
                          </div>

                          <div className="space-y-2 text-xs font-mono">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">2026</span>
                              <div className="flex gap-12">
                                <span className="text-fin-positive font-bold">{formatGBP(income2026)}</span>
                                <span className="text-fin-positive font-bold">{formatGBP(avgMonthlyIncome)}</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">2025</span>
                              <div className="flex gap-12">
                                <span className="text-fin-positive font-bold">{formatGBP(income2025 || 33210.00)}</span>
                                <span className="text-fin-positive font-bold">{formatGBP(2767.50)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Income Items List Grouped by Month */}
                        <div className="space-y-4">
                          {activeData.slice().reverse().map(m => (
                            <div key={m.fullName + m.year} className="space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold border-b border-border/20 pb-1">
                                <span>{m.fullName} {m.year}</span>
                                <span className="font-mono text-fin-positive">{formatGBP(m.income)}</span>
                              </div>
                              <div className="space-y-1.5 pl-1">
                                {m.incomeItems.map(item => (
                                  <div key={item.id} className="flex items-center justify-between text-xs py-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">{item.date}</span>
                                      <span className="font-semibold text-foreground truncate">{item.name}</span>
                                      <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">{item.accountName}</span>
                                    </div>
                                    <span className="font-mono font-bold text-fin-positive shrink-0">+{formatGBP(item.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </SheetContent>
                </Sheet>

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
                {(() => {
                  const renderGoalCard = (goal: Goal) => {
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
                          <span className="text-xs font-bold font-serif text-foreground truncate flex items-center gap-1.5">
                            {goal.emoji && <span className="text-base font-normal shrink-0">{goal.emoji}</span>}
                            <span>{goal.name}</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">{formatReadableDate(goal.targetDate)}</span>
                        </div>
                        <div className="space-y-1.5 text-[10px]">
                          <div className="flex justify-between items-baseline">
                            <span className="text-muted-foreground">
                              <span className="font-bold text-foreground font-mono">{formatGBP(goal.currentAmount)}</span>
                              <span> of </span>
                              <span className="font-mono">{formatGBP(goal.targetAmount)}</span>
                            </span>
                            <span className="font-bold text-fin-positive font-mono text-[11px]">{progress.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-fin-positive rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  };

                  const activeGoals = goals.filter(g => g.status !== 'archived' && g.currentAmount < g.targetAmount);
                  const readyToSpendGoals = goals.filter(g => g.status !== 'archived' && g.currentAmount >= g.targetAmount);
                  const archivedGoals = goals.filter(g => g.status === 'archived');

                  return (
                    <div className="md:col-span-5 space-y-5">
                      {/* Active Goals Group */}
                      <div className="space-y-2">
                        <button
                          onClick={() => setCollapsedGoalGroups(prev => ({ ...prev, active: !prev.active }))}
                          className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors w-full text-left"
                        >
                          <ChevronDown className={cn("h-3 w-3 transition-transform duration-200 shrink-0", collapsedGoalGroups.active && "-rotate-90")} />
                          <span>Active</span>
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground font-normal">{activeGoals.length}</span>
                        </button>
                        {!collapsedGoalGroups.active && (
                          <div className="space-y-3 pl-1">
                            {activeGoals.map(renderGoalCard)}
                            {activeGoals.length === 0 && (
                              <p className="text-[10px] text-muted-foreground italic pl-4 py-2">No active savings goals.</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Ready to spend Goals Group */}
                      <div className="space-y-2">
                        <button
                          onClick={() => setCollapsedGoalGroups(prev => ({ ...prev, readyToSpend: !prev.readyToSpend }))}
                          className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors w-full text-left"
                        >
                          <ChevronDown className={cn("h-3 w-3 transition-transform duration-200 shrink-0", collapsedGoalGroups.readyToSpend && "-rotate-90")} />
                          <span>Ready to spend</span>
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground font-normal">{readyToSpendGoals.length}</span>
                        </button>
                        {!collapsedGoalGroups.readyToSpend && (
                          <div className="space-y-3 pl-1">
                            {readyToSpendGoals.map(renderGoalCard)}
                            {readyToSpendGoals.length === 0 && (
                              <p className="text-[10px] text-muted-foreground italic pl-4 py-2">No goals ready to spend.</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Archived Goals Group */}
                      <div className="space-y-2">
                        <button
                          onClick={() => setCollapsedGoalGroups(prev => ({ ...prev, archived: !prev.archived }))}
                          className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors w-full text-left"
                        >
                          <ChevronDown className={cn("h-3 w-3 transition-transform duration-200 shrink-0", collapsedGoalGroups.archived && "-rotate-90")} />
                          <span>Archived</span>
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground font-normal">{archivedGoals.length}</span>
                        </button>
                        {!collapsedGoalGroups.archived && (
                          <div className="space-y-3 pl-1">
                            {archivedGoals.map(renderGoalCard)}
                            {archivedGoals.length === 0 && (
                              <p className="text-[10px] text-muted-foreground italic pl-4 py-2">No archived goals.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

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
                            <span className="text-xl md:text-2xl font-bold font-serif text-foreground block break-words flex items-center gap-2">
                              {goal.emoji && <span className="text-2xl font-normal shrink-0">{goal.emoji}</span>}
                              <span>{goal.name}</span>
                            </span>
                            <span className="text-xs text-muted-foreground block">Timeline: {formatReadableDate(startD)} – {formatReadableDate(goal.targetDate)}</span>
                          </div>
                          <div className="flex items-start justify-between md:justify-end gap-4 shrink-0">
                            <div className="text-right">
                              <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Saved</span>
                              <span className="text-xl font-bold text-fin-positive font-mono block">{formatGBP(goal.currentAmount)}</span>
                              <span className="text-[10px] text-fin-positive/80 font-medium block mt-0.5">
                                {progress >= 100 ? "Goal achieved!" : `${progress.toFixed(0)}% complete`}
                              </span>
                            </div>
                            <div className="flex gap-1.5 sm:gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingGoal(goal);
                                  setIsEditGoalOpen(true);
                                }}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/10 rounded-xl"
                                title="Edit Goal"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleArchiveGoal(goal.id)}
                                className={cn(
                                  "h-8 w-8 rounded-xl",
                                  goal.status === 'archived'
                                    ? "text-fin-positive hover:text-fin-positive hover:bg-fin-positive/10"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                                )}
                                title={goal.status === 'archived' ? "Restore / Unarchive Goal" : "Archive Goal"}
                              >
                                {goal.status === 'archived' ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteGoal(goal.id)}
                                className="h-8 w-8 text-fin-negative hover:text-fin-negative hover:bg-fin-negative/10 rounded-xl"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Chart: Progress Over Time */}
                        <div className="h-44 w-full bg-muted/5 rounded-2xl border border-border/10 p-2 min-w-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                              <defs>
                                <linearGradient id="goalProgressGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#2f9e6e" stopOpacity={0.2} />
                                  <stop offset="95%" stopColor="#2f9e6e" stopOpacity={0} />
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
                                stroke="#2f9e6e"
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
                              value={newContribution.amount}
                              onChange={(e) => setNewContribution({ ...newContribution, amount: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
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
                                    className="h-7 w-7 text-fin-negative hover:text-fin-negative shrink-0 self-end sm:self-center"
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
                          <td className={cn("py-3 px-3 text-right font-mono font-bold", account.balance >= 0 ? "text-fin-positive" : "text-fin-negative")}>
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
                                className="h-8 w-8 text-fin-negative hover:text-fin-negative"
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

              {/* TrueLayer Integration Card */}
              <div className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-[2rem] p-6 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="font-serif text-base font-semibold text-foreground flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary shrink-0" /> TrueLayer Open Banking
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Automatically sync card transactions and account balances in sandbox mode.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {trueLayerStatus?.connected ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold bg-fin-positive/10 text-fin-positive border border-fin-positive/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-fin-positive animate-pulse" />
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        Not Connected
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-t border-border/30 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="text-xs space-y-1.5 max-w-xl">
                    {trueLayerStatus?.connected ? (
                      <>
                        <p className="text-muted-foreground">
                          Your bank is securely linked. Live synchronization is active and will pull account details and transaction history.
                        </p>
                        {trueLayerStatus.expires_at && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                            <Clock className="h-3 w-3" />
                            <span>Consent expires on: {new Date(trueLayerStatus.expires_at).toLocaleString()}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-muted-foreground leading-relaxed">
                        Securely connect your UK/EU mock accounts to automatically fetch balances and recent card statements. No financial data is ever shared or exposed publicly.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    {trueLayerStatus?.connected ? (
                      <>
                        <Button
                          onClick={syncTrueLayer}
                          disabled={isSyncingTrueLayer}
                          className="rounded-xl bg-primary text-primary-foreground gap-1.5 font-semibold text-xs h-9 px-4"
                        >
                          <RefreshCw className={cn("h-3.5 w-3.5", isSyncingTrueLayer && "animate-spin")} />
                          {isSyncingTrueLayer ? "Syncing..." : "Sync Now"}
                        </Button>
                        <Button
                          onClick={disconnectTrueLayer}
                          variant="destructive"
                          className="rounded-xl gap-1.5 font-semibold text-xs h-9 px-4 border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-white"
                        >
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={connectTrueLayer}
                        disabled={isConnectingTrueLayer}
                        className="rounded-xl bg-primary text-primary-foreground gap-1.5 font-semibold text-xs h-9 px-4"
                      >
                        {isConnectingTrueLayer ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            Connect Bank Account
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
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
                                className="h-8 w-8 text-fin-negative hover:text-fin-negative"
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
                  {/* Rest of the bureau cards */}
                  {creditBureaus.map(bureau => {
                    const entries = creditScores[bureau.key];
                    const latest = entries.length > 0 ? entries[entries.length - 1] : null;
                    const prev = entries.length > 1 ? entries[entries.length - 2] : null;
                    const delta = latest && prev ? latest.score - prev.score : 0;

                    const getRatingFromBands = (score: number, bureauKey: 'experian' | 'transunion' | 'equifax') => {
                      const bands = BUREAU_BANDS[bureauKey];
                      const found = bands.find(b => score >= b.min && score <= b.max);
                      if (found) {
                        let cls = 'text-muted-foreground';
                        if (found.color === '#2f9e6e') cls = 'text-fin-positive';
                        else if (found.color === '#2f9e6e') cls = 'text-fin-positive';
                        else if (found.color === '#2f9e6e') cls = 'text-fin-positive';
                        else if (found.color === '#d99a3d') cls = 'text-fin-warn';
                        else if (found.color === '#d1495b') cls = 'text-fin-negative';

                        return { text: found.name, cls, color: found.color, band: found };
                      }
                      return { text: 'Unknown', cls: 'text-muted-foreground', color: '#6b7280', band: null };
                    };

                    const rating = latest ? getRatingFromBands(latest.score, bureau.key) : null;
                    const bands = BUREAU_BANDS[bureau.key];
                    const gapAngle = 4;
                    const totalSweep = 270;
                    const N = bands.length;
                    const totalGapAngle = (N - 1) * gapAngle;
                    const remainingAngle = totalSweep - totalGapAngle;

                    let currentStartAngle = 135;
                    const computedSegments = bands.map((band, idx) => {
                      const span = band.max - (idx === 0 ? 0 : bands[idx - 1].max);
                      const weight = span / bureau.maxScore;
                      const segmentAngle = weight * remainingAngle;
                      const startAngle = currentStartAngle;
                      const endAngle = currentStartAngle + segmentAngle;
                      currentStartAngle = endAngle + gapAngle;
                      return { band, startAngle, endAngle };
                    });

                    const scoreAngle = latest ? 135 + (latest.score / bureau.maxScore) * 270 : 135;
                    const dotPos = polarToCartesian(72, 72, 54, scoreAngle);

                    return (
                      <Card key={bureau.key} className={cn("bg-gradient-to-br border border-primary/10 rounded-[2rem] overflow-hidden flex flex-col justify-between shadow-sm", bureau.gradient)}>
                        <CardContent className="pt-6 pb-0 px-6 flex flex-col items-center">
                          {/* Bureau Label */}
                          <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-4">{bureau.label}</span>

                          {/* Circular/Arch Gauge */}
                          <div className="relative w-36 h-36 flex items-center justify-center">
                            <svg className="w-36 h-36 overflow-visible" viewBox="0 0 144 144">
                              <defs>
                                <filter id={`shadow-${bureau.key}`} x="-20%" y="-20%" width="140%" height="140%">
                                  <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodOpacity="0.25"/>
                                </filter>
                              </defs>

                              {/* Outer background thin ring */}
                              <circle
                                cx="72"
                                cy="72"
                                r="64"
                                stroke="currentColor"
                                className="text-primary/10"
                                strokeWidth="1"
                                fill="transparent"
                              />

                              {/* Base background track */}
                              <path
                                d={describeArc(72, 72, 54, 135, 405)}
                                fill="transparent"
                                stroke="currentColor"
                                className="text-primary/10"
                                strokeWidth="10"
                                strokeLinecap="round"
                              />

                              {/* Segmented Bands */}
                              {computedSegments.map(({ band, startAngle, endAngle }) => {
                                const isHovered = hoveredBands[bureau.key]?.name === band.name;
                                const hasHover = hoveredBands[bureau.key] !== null;

                                let opacity = 1;
                                let strokeWidth = 10;

                                if (hasHover) {
                                  opacity = isHovered ? 1 : 0.25;
                                  strokeWidth = isHovered ? 12 : 10;
                                } else if (latest) {
                                  const isFutureBand = latest.score < band.min;
                                  opacity = isFutureBand ? 0.25 : 1;
                                }

                                return (
                                  <path
                                    key={band.name}
                                    d={describeArc(72, 72, 54, startAngle, endAngle)}
                                    fill="transparent"
                                    stroke={band.color}
                                    strokeWidth={strokeWidth}
                                    strokeLinecap="round"
                                    style={{
                                      opacity,
                                      transition: 'all 0.3s ease',
                                      cursor: 'pointer'
                                    }}
                                    onMouseEnter={() => setHoveredBands(prev => ({ ...prev, [bureau.key]: band }))}
                                    onMouseLeave={() => setHoveredBands(prev => ({ ...prev, [bureau.key]: null }))}
                                  />
                                );
                              })}

                              {/* Score Indicator Dot */}
                              {latest && (
                                <circle
                                  cx={dotPos.x}
                                  cy={dotPos.y}
                                  r="6"
                                  fill="#ffffff"
                                  stroke={rating?.color || bureau.color}
                                  strokeWidth="2.5"
                                  filter={`url(#shadow-${bureau.key})`}
                                  style={{
                                    transition: 'all 0.7s ease-out'
                                  }}
                                />
                              )}

                              {/* Center Text content inside SVG */}
                              {hoveredBands[bureau.key] ? (
                                <g>
                                  <text
                                    x="72"
                                    y="64"
                                    textAnchor="middle"
                                    className="font-extrabold text-[12px] uppercase tracking-wider"
                                    fill={hoveredBands[bureau.key]?.color}
                                  >
                                    {hoveredBands[bureau.key]?.name}
                                  </text>
                                  <text
                                    x="72"
                                    y="82"
                                    textAnchor="middle"
                                    className="font-mono font-bold text-[11px]"
                                    fill="currentColor"
                                  >
                                    {hoveredBands[bureau.key]?.min} - {hoveredBands[bureau.key]?.max}
                                  </text>
                                </g>
                              ) : (
                                <g>
                                  <text
                                    x="72"
                                    y="68"
                                    textAnchor="middle"
                                    className="font-mono font-extrabold text-3xl"
                                    fill={bureau.color}
                                  >
                                    {latest ? latest.score : '—'}
                                  </text>
                                  <text
                                    x="72"
                                    y="84"
                                    textAnchor="middle"
                                    className="text-[9px] font-medium"
                                    fill="currentColor"
                                    opacity="0.6"
                                  >
                                    of {bureau.maxScore}
                                  </text>
                                  {rating && (
                                    <text
                                      x="72"
                                      y="98"
                                      textAnchor="middle"
                                      className="font-extrabold text-[10px] uppercase tracking-wider"
                                      fill={rating.color}
                                    >
                                      {rating.text}
                                    </text>
                                  )}
                                </g>
                              )}
                            </svg>
                          </div>

                          {/* Delta + Date */}
                          <div className="flex items-center gap-3 mt-3 mb-4">
                            {delta !== 0 && (
                              <span className={cn("text-xs font-bold font-mono flex items-center gap-0.5", delta > 0 ? "text-fin-positive" : "text-fin-negative")}>
                                {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {delta > 0 ? '+' : ''}{delta}
                              </span>
                            )}
                            {latest && (
                              <span className="text-[10px] text-muted-foreground">Last checked: {latest.date}</span>
                            )}
                          </div>
                        </CardContent>

                        {/* Interactive History / Hover Overlay Area */}
                        <div className="px-6 pb-5 pt-2 border-t border-border/10 min-h-[145px] relative overflow-hidden">
                          <AnimatePresence mode="wait">
                            {hoveredBands[bureau.key] ? (
                              <motion.div
                                key="overlay"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 15 }}
                                transition={{ duration: 0.2 }}
                                className="absolute inset-x-6 bottom-5 top-2 flex flex-col justify-center bg-background/95 dark:bg-card/95 backdrop-blur-sm z-10"
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: hoveredBands[bureau.key]?.color }}>
                                    {hoveredBands[bureau.key]?.name}
                                  </span>
                                  <span className="text-[9px] font-bold font-mono text-muted-foreground bg-primary/5 px-2 py-0.5 rounded-md border border-border/40">
                                    {hoveredBands[bureau.key]?.min} - {hoveredBands[bureau.key]?.max}
                                  </span>
                                </div>
                                <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                                  {hoveredBands[bureau.key]?.description}
                                </p>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="history"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="h-full flex flex-col"
                              >
                                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">History</div>
                                {entries.length > 0 ? (
                                  <div className="space-y-1 max-h-[100px] overflow-y-auto pr-1">
                                    {[...entries].reverse().map(entry => (
                                      <div key={entry.id} className="group flex items-center justify-between py-1 border-b border-border/10 last:border-b-0">
                                        <div className="flex items-center gap-3">
                                          <span className="text-xs text-muted-foreground font-mono w-20">{entry.date}</span>
                                          <span className="text-xs font-mono font-bold" style={{ color: bureau.color }}>{entry.score}</span>
                                        </div>
                                        <button
                                          onClick={() => handleDeleteCreditScore(bureau.key, entry.id)}
                                          className="text-fin-negative hover:text-fin-negative p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                          title="Delete"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-xs text-muted-foreground/60 italic flex-1 flex items-center justify-center">
                                    No credit history recorded.
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
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
          {activeTab === 'recurrings' && (
            <RecurringsTab
              recurrings={recurrings}
              currentMonth={currentMonth}
              formatGBP={formatGBP}
              onOpenAddModal={() => {
                setIsAddRecurringOpen(true);
                setAddRecTemplate("scratch");
              }}
              onTogglePaid={toggleRecurringPaid}
              onEditRecurring={(bill) => {
                setActiveRecurring(bill);
                setIsEditRecurringOpen(true);
              }}
              onDeleteRecurring={handleDeleteRecurring}
            />
          )}

          {/* ==========================================
              TAB: TRANSACTIONS (COPILOT STYLE)
              ========================================== */}
          {activeTab === 'transactions' && (
            <TransactionsTab
              transactions={mockTransactions}
              onUpdateTransactions={(updated) => {
                setMockTransactions(updated);
                saveDataToSupabase('transactions', updated);
              }}
              bankAccounts={bankAccounts}
              goals={goals}
              budgetCategories={budgetCategories}
              formatGBP={formatGBP}
            />
          )}

          {/* ==========================================
              TAB: INVESTMENTS
              ========================================== */}
          {activeTab === 'investments' && (
            <InvestmentsTab
              holdings={investmentHoldings}
              onAddHolding={handleAddHolding}
              onEditHolding={handleEditHolding}
              onDeleteHolding={handleDeleteHolding}
              formatGBP={formatGBP}
              bankAccounts={bankAccounts}
            />
          )}

          {/* ==========================================
              TAB 8: TIME SPENT
              ========================================== */}
          {activeTab === 'time-spent' && (
            <TimeSpentTab
              settings={settings}
              timeSpentInputs={timeSpentInputs}
              setTimeSpentInputs={setTimeSpentInputs}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}

        </main>

        <Footer />
      </div>

      {/* ==========================================
          DIALOGS & DIALOG FORMS
          ========================================== */}

      {/* DIALOG: Manage Package Benefits & Perks */}
      <Dialog open={isBenefitsDialogOpen} onOpenChange={setIsBenefitsDialogOpen}>
        <DialogContent className="sm:max-w-[560px] rounded-2xl sm:rounded-[2rem] p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" /> Manage Package Benefits & Perks
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add non-cash benefits, bonuses, allowances, or equity options provided by your employer to track your total compensation package.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">

            {/* Total Summary */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Total Active Benefits</span>
                <span className="font-mono text-xl font-bold text-foreground">
                  {formatGBP((settings.packageBenefits || []).reduce((sum, b) => {
                    const val = b.type === 'percentage' ? (settings.grossSalary * ((b.amount || 0) / 100)) : (b.amount || 0);
                    return sum + (val || 0);
                  }, 0))}
                  <span className="text-xs font-normal text-muted-foreground ml-1.5">/ year</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-primary">{settings.packageBenefits?.length || 0} items added</span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Quick Presets</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: 'Private Medical / Dental', amount: 1500, type: 'monetary' as const, emoji: '🏥' },
                  { name: 'Annual Bonus', amount: 10, type: 'percentage' as const, emoji: '🎯' },
                  { name: 'Equity / RSUs', amount: 5000, type: 'monetary' as const, emoji: '📈' },
                  { name: 'Car Allowance', amount: 3000, type: 'monetary' as const, emoji: '🚗' },
                  { name: 'Gym & Wellness', amount: 600, type: 'monetary' as const, emoji: '🏋️' },
                  { name: 'Tech / Work Allowance', amount: 1000, type: 'monetary' as const, emoji: '💻' }
                ].map((preset, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    variant="outline"
                    onClick={() => handleAddPresetBenefit(preset)}
                    className="h-8 rounded-xl text-xs gap-1.5 border-primary/10 bg-muted/20 hover:bg-primary/10"
                  >
                    <span>{preset.emoji}</span>
                    <span>{preset.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      ({preset.type === 'percentage' ? `${preset.amount}%` : `+£${preset.amount}`})
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Add Custom Benefit Form */}
            <div className="rounded-2xl border border-border/50 bg-muted/10 p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-primary" /> Add Benefit or Addition
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Emoji</Label>
                  <Input
                    value={newBenefitEmoji}
                    onChange={(e) => setNewBenefitEmoji(e.target.value)}
                    className="h-10 rounded-xl text-center font-emoji"
                    placeholder="🎁"
                  />
                </div>
                <div className="sm:col-span-6 space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Benefit Name</Label>
                  <Input
                    value={newBenefitName}
                    onChange={(e) => setNewBenefitName(e.target.value)}
                    className="h-10 rounded-xl"
                    placeholder="e.g. Health Insurance, Stock Grant"
                  />
                </div>
                <div className="sm:col-span-4 space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Type</Label>
                  <Select value={newBenefitType} onValueChange={(val: 'monetary' | 'percentage') => setNewBenefitType(val)}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monetary">Fixed (£)</SelectItem>
                      <SelectItem value="percentage">% of Base Salary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                <div className="sm:col-span-8 space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Amount / Value ({newBenefitType === 'percentage' ? '%' : '£ / year'})</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step={newBenefitType === 'percentage' ? '0.1' : '1'}
                    value={newBenefitAmount}
                    onChange={(e) => setNewBenefitAmount(e.target.value)}
                    className="h-10 rounded-xl font-mono"
                    placeholder={newBenefitType === 'percentage' ? '10' : '2000'}
                  />
                </div>
                <div className="sm:col-span-4 flex items-end">
                  <Button onClick={handleAddBenefit} className="w-full h-10 rounded-xl gap-1.5 bg-primary text-primary-foreground font-semibold text-xs">
                    <Plus className="w-4 h-4" /> Add Benefit
                  </Button>
                </div>
              </div>
            </div>

            {/* Active Benefits List */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Configured Package Additions</Label>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(settings.packageBenefits || []).map((benefit) => {
                  const annualVal = benefit.type === 'percentage'
                    ? (settings.grossSalary * ((benefit.amount || 0) / 100))
                    : (benefit.amount || 0);
                  return (
                    <div key={benefit.id} className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-card/40 hover:bg-card/80 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-lg shrink-0">{benefit.emoji || '🎁'}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{benefit.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {benefit.type === 'percentage' ? `${benefit.amount}% of base salary` : 'Fixed annual amount'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="block font-mono text-xs font-bold text-fin-positive">+{formatGBP(annualVal)}</span>
                          <span className="block font-mono text-[9px] text-muted-foreground">+{formatGBP(annualVal / 12)}/mo</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteBenefit(benefit.id)}
                          className="h-8 w-8 rounded-lg text-fin-negative hover:text-fin-negative hover:bg-fin-negative/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {(!settings.packageBenefits || settings.packageBenefits.length === 0) && (
                  <div className="text-center py-6 border border-dashed border-border/40 rounded-xl">
                    <Gift className="w-8 h-8 text-muted-foreground/40 mx-auto mb-1.5" />
                    <p className="text-xs font-medium text-muted-foreground">No extra benefits added yet.</p>
                    <p className="text-[10px] text-muted-foreground/80 mt-0.5">Click a quick preset above or enter custom additions to build your total package.</p>
                  </div>
                )}
              </div>
            </div>

          </div>

          <DialogFooter className="pt-4 border-t border-border/40">
            <Button onClick={() => setIsBenefitsDialogOpen(false)} className="rounded-xl bg-primary text-primary-foreground font-semibold">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

                  <div className="rounded-xl border border-primary/10 bg-primary/5 p-3.5 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Gift className="w-4 h-4 text-primary" /> Benefits & Package Perks
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {settings.packageBenefits?.length ? `${settings.packageBenefits.length} active additions (${formatGBP(results.totalBenefitsValue)}/yr)` : 'No custom benefits added yet'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsBenefitsDialogOpen(true)}
                      className="h-8 rounded-xl text-xs gap-1.5 border-primary/20 bg-background/60 hover:bg-primary/10"
                    >
                      <Gift className="w-3.5 h-3.5 text-primary" /> Manage Perks
                    </Button>
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
                                className="absolute top-2 right-2 text-fin-negative hover:text-fin-negative opacity-60 group-hover:opacity-100 transition-opacity"
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

                  {/* Item 4: Active Savings Types */}
                  <div className="rounded-xl border border-border/40 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedSection(expandedSection === 'savings' ? 'none' : 'savings')}
                      className="w-full flex items-center justify-between p-3.5 bg-muted/10 text-xs font-semibold hover:bg-muted/20 transition-colors text-left"
                    >
                      <span className="flex items-center gap-2"><Briefcase className="w-3.5 h-3.5 text-primary" /> Active Savings Types</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedSection === 'savings' ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedSection === 'savings' && (
                      <div className="p-4 bg-background/30 border-t border-border/20 space-y-3 text-xs">
                        <p className="text-[10px] text-muted-foreground mb-2">Enable or disable specific savings vehicles inside your budget and wealth trackers.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                          {SAVINGS_PRESETS.map((preset) => {
                            const key = preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                            const isChecked = draftActiveSavingsTypes.includes(key);
                            return (
                              <label key={key} className="flex items-center gap-2 p-2.5 rounded-xl border border-border/40 bg-card/45 hover:bg-muted/10 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setDraftActiveSavingsTypes([...draftActiveSavingsTypes, key]);
                                    } else {
                                      setDraftActiveSavingsTypes(draftActiveSavingsTypes.filter(t => t !== key));
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-primary/20 text-primary focus:ring-primary/30 cursor-pointer"
                                />
                                <span className="text-base leading-none shrink-0">{preset.emoji}</span>
                                <span className="font-medium text-foreground">{preset.name}</span>
                              </label>
                            );
                          })}
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
                value={newGoal.targetAmount}
                onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="goal-emoji">Emoji Icon</Label>
                <Input
                  id="goal-emoji"
                  placeholder="e.g. 🎯"
                  value={newGoal.emoji || ''}
                  onChange={(e) => setNewGoal({ ...newGoal, emoji: e.target.value })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50 text-center text-lg"
                />
              </div>
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

      {/* DIALOG: Edit Savings Goal */}
      <Dialog open={isEditGoalOpen} onOpenChange={setIsEditGoalOpen}>
        <DialogContent className="rounded-3xl border-primary/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Savings Goal</DialogTitle>
            <DialogDescription className="text-xs">Modify the details of your savings milestone.</DialogDescription>
          </DialogHeader>
          {editingGoal && (
            <form onSubmit={handleEditGoal} className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="edit-goal-name">Goal Name</Label>
                <Input
                  id="edit-goal-name"
                  placeholder="e.g. New Macbook Pro"
                  value={editingGoal.name}
                  onChange={(e) => setEditingGoal({ ...editingGoal, name: e.target.value })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-goal-target">Target Amount (£)</Label>
                <Input
                  id="edit-goal-target"
                  type="number"
                  placeholder="e.g. 2500"
                  value={editingGoal.targetAmount}
                  onChange={(e) => setEditingGoal({ ...editingGoal, targetAmount: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="edit-goal-start-date">Start Date</Label>
                  <Input
                    id="edit-goal-start-date"
                    type="date"
                    value={editingGoal.startDate || ''}
                    onChange={(e) => setEditingGoal({ ...editingGoal, startDate: e.target.value })}
                    className="rounded-xl h-10 border-primary/20 bg-background/50"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-goal-emoji">Emoji Icon</Label>
                  <Input
                    id="edit-goal-emoji"
                    placeholder="e.g. 🎯"
                    value={editingGoal.emoji || ''}
                    onChange={(e) => setEditingGoal({ ...editingGoal, emoji: e.target.value })}
                    className="rounded-xl h-10 border-primary/20 bg-background/50 text-center text-lg"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-goal-date">Target Date</Label>
                <Input
                  id="edit-goal-date"
                  type="date"
                  value={editingGoal.targetDate}
                  onChange={(e) => setEditingGoal({ ...editingGoal, targetDate: e.target.value })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-goal-status">Status</Label>
                <Select
                  value={editingGoal.status || 'active'}
                  onValueChange={(val) => setEditingGoal({ ...editingGoal, status: val as 'active' | 'archived' })}
                >
                  <SelectTrigger id="edit-goal-status" className="bg-background/50 border-primary/20 rounded-xl h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-primary/10">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="pt-4 gap-2 sm:gap-0">
                <Button variant="outline" type="button" onClick={() => setIsEditGoalOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
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
                value={newAccount.balance}
                onChange={(e) => setNewAccount({ ...newAccount, balance: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
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
                value={newAccount.annualFee}
                onChange={(e) => setNewAccount({ ...newAccount, annualFee: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
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
                value={newMembership.annualFee}
                onChange={(e) => setNewMembership({ ...newMembership, annualFee: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
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
      <AddRecurringDialog
        isOpen={isAddRecurringOpen}
        onOpenChange={setIsAddRecurringOpen}
        newRecurring={newRecurring}
        setNewRecurring={setNewRecurring}
        addRecTemplate={addRecTemplate}
        setAddRecTemplate={setAddRecTemplate}
        recurringTemplates={recurringTemplates}
        budgetCategories={budgetCategories}
        allBudgetItems={allBudgetItems}
        bankAccounts={bankAccounts}
        formatGBP={formatGBP}
        onSave={handleAddRecurring}
      />

      {/* DIALOG: Edit Recurring Bill */}
      <EditRecurringDialog
        isOpen={isEditRecurringOpen}
        onOpenChange={setIsEditRecurringOpen}
        activeRecurring={activeRecurring}
        setActiveRecurring={setActiveRecurring}
        budgetCategories={budgetCategories}
        allBudgetItems={allBudgetItems}
        bankAccounts={bankAccounts}
        formatGBP={formatGBP}
        onSave={handleEditRecurring}
      />

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
                value={newCreditScore.score}
                onChange={(e) => setNewCreditScore({ ...newCreditScore, score: e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0 })}
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
                  if (!isNaN(idx) && DEFAULT_CATEGORY_TEMPLATES[idx]) {
                    const preset = DEFAULT_CATEGORY_TEMPLATES[idx];
                    setNewCategoryName(preset.name);
                    setNewCategoryEmoji(preset.emoji || '');
                    setNewCategoryGroup(preset.group || 'needs');
                  } else {
                    setNewCategoryName('');
                    setNewCategoryEmoji('');
                    setNewCategoryGroup('needs');
                    setNewCategoryBudget('');
                  }
                }}
                className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                defaultValue=""
              >
                <option value="">Start a new one from scratch</option>
                {DEFAULT_CATEGORY_TEMPLATES.map((preset, idx) => (
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
                value={newCategoryBudget}
                onChange={(e) => setNewCategoryBudget(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
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
                value={newCategoryBudget}
                onChange={(e) => setNewCategoryBudget(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
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
          {(() => {
            const targetCategory = budgetCategories.find(c => c.id === activeCategoryId);
            const isSavingsCategory = targetCategory?.group === 'savings';
            const isDiscCategory = isDiscretionaryCategory(targetCategory);

            const activePresets = SAVINGS_PRESETS.filter(p => {
              const key = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
              const activeTypes = settings.activeSavingsTypes || ALL_SAVINGS_IDS;
              return activeTypes.includes(key);
            });

            return (
              <form onSubmit={handleAddItem} className="space-y-4 py-2">
                <div className="space-y-1">
                  <Label htmlFor="item-new-name">Item Name</Label>
                  {isSavingsCategory ? (
                    <div className="space-y-2">
                      <select
                        id="savings-preset-select"
                        value={selectedSavingsPreset}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedSavingsPreset(val);
                          if (val !== 'custom') {
                            const preset = SAVINGS_PRESETS.find(p => p.name === val);
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: val,
                              emoji: preset?.emoji || '💰'
                            });
                          } else {
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: '',
                              emoji: '💰'
                            });
                          }
                        }}
                        className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                      >
                        {activePresets.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.emoji} {preset.name}
                          </option>
                        ))}
                        <option value="custom">✍️ Custom savings type...</option>
                      </select>
                      {selectedSavingsPreset === 'custom' && (
                        <Input
                          id="item-new-name-custom"
                          placeholder="e.g. Dream House Fund"
                          value={newBudgetItem.name}
                          onChange={(e) => setNewBudgetItem({ ...newBudgetItem, name: e.target.value })}
                          className="rounded-xl h-10 border-primary/20 bg-background/50"
                          required
                        />
                      )}
                    </div>
                  ) : isDiscCategory ? (
                    <div className="space-y-2">
                      <select
                        id="discretionary-preset-select"
                        value={selectedDiscretionaryPreset}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedDiscretionaryPreset(val);
                          if (val !== 'custom') {
                            const preset = FOOD_ENTERTAINMENT_PRESETS.find(p => p.name === val);
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: val,
                              emoji: preset?.emoji || '🍔'
                            });
                          } else {
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: '',
                              emoji: '🍔'
                            });
                          }
                        }}
                        className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                      >
                        {FOOD_ENTERTAINMENT_PRESETS.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.emoji} {preset.name}
                          </option>
                        ))}
                        <option value="custom">✍️ Custom discretionary type...</option>
                      </select>
                      {selectedDiscretionaryPreset === 'custom' && (
                        <Input
                          id="item-new-name-custom"
                          placeholder="e.g. Weekly Coffee Run"
                          value={newBudgetItem.name}
                          onChange={(e) => setNewBudgetItem({ ...newBudgetItem, name: e.target.value })}
                          className="rounded-xl h-10 border-primary/20 bg-background/50"
                          required
                        />
                      )}
                    </div>
                  ) : isHousingCategory(targetCategory) ? (
                    <div className="space-y-2">
                      <select
                        id="housing-preset-select"
                        value={selectedHousingPreset}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedHousingPreset(val);
                          if (val !== 'custom') {
                            const preset = HOUSING_PRESETS.find(p => p.name === val);
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: val,
                              emoji: preset?.emoji || '🏠'
                            });
                          } else {
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: '',
                              emoji: '🏠'
                            });
                          }
                        }}
                        className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                      >
                        {HOUSING_PRESETS.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.emoji} {preset.name}
                          </option>
                        ))}
                        <option value="custom">✍️ Custom housing type...</option>
                      </select>
                      {selectedHousingPreset === 'custom' && (
                        <Input
                          id="item-new-name-custom"
                          placeholder="e.g. Service Charges"
                          value={newBudgetItem.name}
                          onChange={(e) => setNewBudgetItem({ ...newBudgetItem, name: e.target.value })}
                          className="rounded-xl h-10 border-primary/20 bg-background/50"
                          required
                        />
                      )}
                    </div>
                  ) : isInsuranceCategory(targetCategory) ? (
                    <div className="space-y-2">
                      <select
                        id="insurance-preset-select"
                        value={selectedInsurancePreset}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedInsurancePreset(val);
                          if (val !== 'custom') {
                            const preset = INSURANCE_PRESETS.find(p => p.name === val);
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: val,
                              emoji: preset?.emoji || '🛡️'
                            });
                          } else {
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: '',
                              emoji: '🛡️'
                            });
                          }
                        }}
                        className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                      >
                        {INSURANCE_PRESETS.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.emoji} {preset.name}
                          </option>
                        ))}
                        <option value="custom">✍️ Custom insurance type...</option>
                      </select>
                      {selectedInsurancePreset === 'custom' && (
                        <Input
                          id="item-new-name-custom"
                          placeholder="e.g. Appliance Cover"
                          value={newBudgetItem.name}
                          onChange={(e) => setNewBudgetItem({ ...newBudgetItem, name: e.target.value })}
                          className="rounded-xl h-10 border-primary/20 bg-background/50"
                          required
                        />
                      )}
                    </div>
                  ) : isTransportCategory(targetCategory) ? (
                    <div className="space-y-2">
                      <select
                        id="transport-preset-select"
                        value={selectedTransportPreset}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedTransportPreset(val);
                          if (val !== 'custom') {
                            const preset = TRANSPORT_PRESETS.find(p => p.name === val);
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: val,
                              emoji: preset?.emoji || '🚗'
                            });
                          } else {
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: '',
                              emoji: '🚗'
                            });
                          }
                        }}
                        className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                      >
                        {TRANSPORT_PRESETS.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.emoji} {preset.name}
                          </option>
                        ))}
                        <option value="custom">✍️ Custom transport type...</option>
                      </select>
                      {selectedTransportPreset === 'custom' && (
                        <Input
                          id="item-new-name-custom"
                          placeholder="e.g. Helicopter ride"
                          value={newBudgetItem.name}
                          onChange={(e) => setNewBudgetItem({ ...newBudgetItem, name: e.target.value })}
                          className="rounded-xl h-10 border-primary/20 bg-background/50"
                          required
                        />
                      )}
                    </div>
                  ) : isSubscriptionsCategory(targetCategory) ? (
                    <div className="space-y-2">
                      <select
                        id="subscription-preset-select"
                        value={selectedSubscriptionPreset}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedSubscriptionPreset(val);
                          if (val !== 'custom') {
                            const preset = SUBSCRIPTION_PRESETS.find(p => p.name === val);
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: val,
                              emoji: preset?.emoji || '📺'
                            });
                          } else {
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: '',
                              emoji: '📺'
                            });
                          }
                        }}
                        className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                      >
                        {SUBSCRIPTION_PRESETS.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.emoji} {preset.name}
                          </option>
                        ))}
                        <option value="custom">✍️ Custom subscription type...</option>
                      </select>
                      {selectedSubscriptionPreset !== 'custom' ? (
                        <div className="space-y-1 pt-1">
                          <Label htmlFor="subscription-provider-input" className="text-xs text-muted-foreground">Service Name / Provider</Label>
                          <Input
                            id="subscription-provider-input"
                            placeholder="e.g. Netflix, ChatGPT, iCloud"
                            value={subscriptionProvider}
                            onChange={(e) => setSubscriptionProvider(e.target.value)}
                            className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs"
                          />
                        </div>
                      ) : (
                        <Input
                          id="item-new-name-custom"
                          placeholder="e.g. Bespoke Monthly Box"
                          value={newBudgetItem.name}
                          onChange={(e) => setNewBudgetItem({ ...newBudgetItem, name: e.target.value })}
                          className="rounded-xl h-10 border-primary/20 bg-background/50"
                          required
                        />
                      )}
                    </div>
                  ) : isLoansCategory(targetCategory) ? (
                    <div className="space-y-2">
                      <select
                        id="loan-preset-select"
                        value={selectedLoanPreset}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedLoanPreset(val);
                          if (val !== 'custom') {
                            const preset = LOANS_PRESETS.find(p => p.name === val);
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: val,
                              emoji: preset?.emoji || '💳'
                            });
                          } else {
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: '',
                              emoji: '💳'
                            });
                          }
                        }}
                        className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                      >
                        {LOANS_PRESETS.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.emoji} {preset.name}
                          </option>
                        ))}
                        <option value="custom">✍️ Custom loan type...</option>
                      </select>
                      {selectedLoanPreset !== 'custom' ? (
                        <div className="space-y-1 pt-1">
                          <Label htmlFor="loan-provider-input" className="text-xs text-muted-foreground">Lender / Provider</Label>
                          <Input
                            id="loan-provider-input"
                            placeholder="e.g. Klarna, Student Loans Company, Halifax"
                            value={loanProvider}
                            onChange={(e) => setLoanProvider(e.target.value)}
                            className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs"
                          />
                        </div>
                      ) : (
                        <Input
                          id="item-new-name-custom"
                          placeholder="e.g. Family Loan"
                          value={newBudgetItem.name}
                          onChange={(e) => setNewBudgetItem({ ...newBudgetItem, name: e.target.value })}
                          className="rounded-xl h-10 border-primary/20 bg-background/50"
                          required
                        />
                      )}
                    </div>
                  ) : isGiftsDonationsCategory(targetCategory) ? (
                    <div className="space-y-2">
                      <select
                        id="gifts-preset-select"
                        value={selectedGiftsPreset}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedGiftsPreset(val);
                          if (val !== 'custom') {
                            const preset = GIFTS_DONATIONS_PRESETS.find(p => p.name === val);
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: val,
                              emoji: preset?.emoji || '🎁'
                            });
                          } else {
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: '',
                              emoji: '🎁'
                            });
                          }
                        }}
                        className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                      >
                        {GIFTS_DONATIONS_PRESETS.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.emoji} {preset.name}
                          </option>
                        ))}
                        <option value="custom">✍️ Custom gift/donation type...</option>
                      </select>
                      {selectedGiftsPreset === 'custom' && (
                        <Input
                          id="item-new-name-custom"
                          placeholder="e.g. Anniversary Gift"
                          value={newBudgetItem.name}
                          onChange={(e) => setNewBudgetItem({ ...newBudgetItem, name: e.target.value })}
                          className="rounded-xl h-10 border-primary/20 bg-background/50"
                          required
                        />
                      )}
                    </div>
                  ) : isHealthWellnessCategory(targetCategory) ? (
                    <div className="space-y-2">
                      <select
                        id="health-preset-select"
                        value={selectedHealthPreset}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedHealthPreset(val);
                          if (val !== 'custom') {
                            const preset = HEALTH_WELLNESS_PRESETS.find(p => p.name === val);
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: val,
                              emoji: preset?.emoji || '🏥'
                            });
                          } else {
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: '',
                              emoji: '🏥'
                            });
                          }
                        }}
                        className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                      >
                        {HEALTH_WELLNESS_PRESETS.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.emoji} {preset.name}
                          </option>
                        ))}
                        <option value="custom">✍️ Custom health type...</option>
                      </select>
                      {selectedHealthPreset === 'custom' && (
                        <Input
                          id="item-new-name-custom"
                          placeholder="e.g. Chiropractor"
                          value={newBudgetItem.name}
                          onChange={(e) => setNewBudgetItem({ ...newBudgetItem, name: e.target.value })}
                          className="rounded-xl h-10 border-primary/20 bg-background/50"
                          required
                        />
                      )}
                    </div>
                  ) : isPetsCategory(targetCategory) ? (
                    <div className="space-y-2">
                      <select
                        id="pets-preset-select"
                        value={selectedPetsPreset}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedPetsPreset(val);
                          if (val !== 'custom') {
                            const preset = PETS_PRESETS.find(p => p.name === val);
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: val,
                              emoji: preset?.emoji || '🐱'
                            });
                          } else {
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: '',
                              emoji: '🐱'
                            });
                          }
                        }}
                        className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                      >
                        {PETS_PRESETS.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.emoji} {preset.name}
                          </option>
                        ))}
                        <option value="custom">✍️ Custom pet type...</option>
                      </select>
                      {selectedPetsPreset === 'custom' && (
                        <Input
                          id="item-new-name-custom"
                          placeholder="e.g. Pet Sitting"
                          value={newBudgetItem.name}
                          onChange={(e) => setNewBudgetItem({ ...newBudgetItem, name: e.target.value })}
                          className="rounded-xl h-10 border-primary/20 bg-background/50"
                          required
                        />
                      )}
                    </div>
                  ) : isShoppingCategory(targetCategory) ? (
                    <div className="space-y-2">
                      <select
                        id="shopping-preset-select"
                        value={selectedShoppingPreset}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedShoppingPreset(val);
                          if (val !== 'custom') {
                            const preset = SHOPPING_PRESETS.find(p => p.name === val);
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: val,
                              emoji: preset?.emoji || '🛍️'
                            });
                          } else {
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: '',
                              emoji: '🛍️'
                            });
                          }
                        }}
                        className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                      >
                        {SHOPPING_PRESETS.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.emoji} {preset.name}
                          </option>
                        ))}
                        <option value="custom">✍️ Custom shopping type...</option>
                      </select>
                      {selectedShoppingPreset === 'custom' && (
                        <Input
                          id="item-new-name-custom"
                          placeholder="e.g. Gadget Purchase"
                          value={newBudgetItem.name}
                          onChange={(e) => setNewBudgetItem({ ...newBudgetItem, name: e.target.value })}
                          className="rounded-xl h-10 border-primary/20 bg-background/50"
                          required
                        />
                      )}
                    </div>
                  ) : isTravelHolidaysCategory(targetCategory) ? (
                    <div className="space-y-2">
                      <select
                        id="travel-preset-select"
                        value={selectedTravelPreset}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedTravelPreset(val);
                          if (val !== 'custom') {
                            const preset = TRAVEL_HOLIDAYS_PRESETS.find(p => p.name === val);
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: val,
                              emoji: preset?.emoji || '🏖️'
                            });
                          } else {
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: '',
                              emoji: '🏖️'
                            });
                          }
                        }}
                        className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                      >
                        {TRAVEL_HOLIDAYS_PRESETS.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.emoji} {preset.name}
                          </option>
                        ))}
                        <option value="custom">✍️ Custom travel type...</option>
                      </select>
                      {selectedTravelPreset === 'custom' && (
                        <Input
                          id="item-new-name-custom"
                          placeholder="e.g. Weekend Getaway"
                          value={newBudgetItem.name}
                          onChange={(e) => setNewBudgetItem({ ...newBudgetItem, name: e.target.value })}
                          className="rounded-xl h-10 border-primary/20 bg-background/50"
                          required
                        />
                      )}
                    </div>
                  ) : isOtherCategory(targetCategory) ? (
                    <div className="space-y-2">
                      <select
                        id="other-preset-select"
                        value={selectedOtherPreset}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedOtherPreset(val);
                          if (val !== 'custom') {
                            const preset = OTHER_PRESETS.find(p => p.name === val);
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: val,
                              emoji: preset?.emoji || '🌀'
                            });
                          } else {
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: '',
                              emoji: '🌀'
                            });
                          }
                        }}
                        className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                      >
                        {OTHER_PRESETS.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.emoji} {preset.name}
                          </option>
                        ))}
                        <option value="custom">✍️ Custom other type...</option>
                      </select>
                      {selectedOtherPreset === 'custom' && (
                        <Input
                          id="item-new-name-custom"
                          placeholder="e.g. Cash withdrawal"
                          value={newBudgetItem.name}
                          onChange={(e) => setNewBudgetItem({ ...newBudgetItem, name: e.target.value })}
                          className="rounded-xl h-10 border-primary/20 bg-background/50"
                          required
                        />
                      )}
                    </div>
                  ) : isFamilyKidsCategory(targetCategory) ? (
                    <div className="space-y-2">
                      <select
                        id="family-preset-select"
                        value={selectedFamilyPreset}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedFamilyPreset(val);
                          if (val !== 'custom') {
                            const preset = FAMILY_KIDS_PRESETS.find(p => p.name === val);
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: val,
                              emoji: preset?.emoji || '🚸'
                            });
                          } else {
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: '',
                              emoji: '🚸'
                            });
                          }
                        }}
                        className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                      >
                        {FAMILY_KIDS_PRESETS.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.emoji} {preset.name}
                          </option>
                        ))}
                        <option value="custom">✍️ Custom family/kids type...</option>
                      </select>
                      {selectedFamilyPreset === 'custom' && (
                        <Input
                          id="item-new-name-custom"
                          placeholder="e.g. School Trip"
                          value={newBudgetItem.name}
                          onChange={(e) => setNewBudgetItem({ ...newBudgetItem, name: e.target.value })}
                          className="rounded-xl h-10 border-primary/20 bg-background/50"
                          required
                        />
                      )}
                    </div>
                  ) : isEducationCareerCategory(targetCategory) ? (
                    <div className="space-y-2">
                      <select
                        id="education-preset-select"
                        value={selectedEducationPreset}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedEducationPreset(val);
                          if (val !== 'custom') {
                            const preset = EDUCATION_CAREER_PRESETS.find(p => p.name === val);
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: val,
                              emoji: preset?.emoji || '🎓'
                            });
                          } else {
                            setNewBudgetItem({
                              ...newBudgetItem,
                              name: '',
                              emoji: '🎓'
                            });
                          }
                        }}
                        className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                      >
                        {EDUCATION_CAREER_PRESETS.map((preset) => (
                          <option key={preset.name} value={preset.name}>
                            {preset.emoji} {preset.name}
                          </option>
                        ))}
                        <option value="custom">✍️ Custom education type...</option>
                      </select>
                      {selectedEducationPreset === 'custom' && (
                        <Input
                          id="item-new-name-custom"
                          placeholder="e.g. Udemy course"
                          value={newBudgetItem.name}
                          onChange={(e) => setNewBudgetItem({ ...newBudgetItem, name: e.target.value })}
                          className="rounded-xl h-10 border-primary/20 bg-background/50"
                          required
                        />
                      )}
                    </div>
                  ) : (
                    <Input
                      id="item-new-name"
                      placeholder="e.g. Weekly Fuel"
                      value={newBudgetItem.name}
                      onChange={(e) => setNewBudgetItem({ ...newBudgetItem, name: e.target.value })}
                      className="rounded-xl h-10 border-primary/20 bg-background/50"
                      required
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="item-new-spent">Currently Spent (£)</Label>
                  <Input
                    id="item-new-spent"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 45"
                    value={newBudgetItem.spent}
                    onChange={(e) => setNewBudgetItem({ ...newBudgetItem, spent: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                    className="rounded-xl h-10 border-primary/20 bg-background/50"
                    required
                  />
                </div>
                <DialogFooter className="pt-4 gap-2 sm:gap-0">
                  <Button variant="outline" type="button" onClick={() => setIsAddItemOpen(false)} className="rounded-xl">Cancel</Button>
                  <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Item</Button>
                </DialogFooter>
              </form>
            );
          })()}
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

  const [pickerYear, setPickerYear] = useState(initialYear);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="w-[260px] p-4 bg-popover text-foreground select-none">
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
                const lastDay = isEnd ? new Date(pickerYear, idx + 1, 0).getDate() : 1;
                const yrStr = String(pickerYear);
                const moStr = String(idx + 1).padStart(2, '0');
                const dyStr = String(lastDay).padStart(2, '0');
                onChange(`${yrStr}-${moStr}-${dyStr}`);
              }}
              className={cn(
                "py-2 text-[10px] font-medium transition-all text-center rounded-xl",
                isSelected
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
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


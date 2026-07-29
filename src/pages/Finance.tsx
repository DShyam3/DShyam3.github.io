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
import { GoalsTab } from '@/components/finance/tabs/GoalsTab';
import { AccountsTab } from '@/components/finance/tabs/AccountsTab';
import { DashboardTab } from '@/components/finance/tabs/DashboardTab';
import { TaxIncomeTab } from '@/components/finance/tabs/TaxIncomeTab';
import { BudgetTab } from '@/components/finance/tabs/BudgetTab';
import { CashFlowTab } from '@/components/finance/tabs/CashFlowTab';
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
  BUREAU_BANDS,
  polarToCartesian,
  describeArc,
  getUniversalStanding,
  presetsToDefaultCategories,
  createDefaultBudgetCategories,
  DEFAULT_BUDGET_CATEGORIES,
  DEFAULT_RECURRING_TEMPLATES,
  ALL_PRESETS_FALLBACK,
  isDiscretionaryCategory,
  isHousingCategory,
  isInsuranceCategory,
  isTransportCategory,
  isSubscriptionsCategory,
  isLoansCategory,
  isGiftsDonationsCategory,
  isHealthWellnessCategory,
  isPetsCategory,
  isShoppingCategory,
  isTravelHolidaysCategory,
  isOtherCategory,
  isFamilyKidsCategory,
  isEducationCareerCategory,
  ALL_SAVINGS_IDS,
  DEFAULT_CATEGORY_TEMPLATES,
  mergeMissingDefaultCategories,
  safeParseJSON,
  resolveStoredList,
  getOrdinal,
  getDueDateText,
  isDueThisMonth,
  getPlanName,
  parseDays,
  formatDaysList,
  getDaysInMonth,
  getStartDayOfWeek,
  parseEntryDays,
  getNormalizedHolidays,
  getBookedDaysForMonth,
  calculateWorkingDaysInRange,
  formatHolidayDates,
  calculateActualPayday,
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
import type {
  FinanceSettings,
  UserHoliday,
  Goal,
  BankAccount,
  InvestmentHolding,
  Membership,
  BudgetItem,
  BudgetCategory,
  RecurringBill,
  CreditScoreEntry,
  CreditScores,
  MockTransaction,
  TaxConfig,
  RecurringTemplate,
  CategoryPreset,
  CreditBureauConfig,
  TrueLayerStatus,
  BureauBand,
  UniversalStanding,
  PackageBenefit,
} from '@/types/finance';
import { Sparkline, DeltaPill, FinMeter, FinSegmentedControl } from '@/components/finance/ui/primitives';

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
            <DashboardTab
              onNavigate={(tab) => setActiveTab(tab as typeof TABS[number]['key'])}
              dashboardSpendRange={dashboardSpendRange}
              onChangeSpendRange={setDashboardSpendRange}
              dashboardSpendSpentLabel={dashboardSpendSpentLabel}
              dashboardSpendBudgetLabel={dashboardSpendBudgetLabel}
              dashboardSpendTotal={dashboardSpendTotal}
              dashboardSpendBudget={dashboardSpendBudget}
              dashboardSpendStatusText={dashboardSpendStatusText}
              isDashboardSpendOverBudget={isDashboardSpendOverBudget}
              dashboardSpendChartData={dashboardSpendChartData}
              dashboardSpendXAxisKey={dashboardSpendXAxisKey}
              progressLineColor={progressLineColor}
              progressGradientColor={progressGradientColor}
              netCashFlow={netCashFlow}
              comparison={comparison}
              freeToSpend={freeToSpend}
              dailyFreeToSpend={dailyFreeToSpend}
              incomeFlowPercent={incomeFlowPercent}
              spendFlowPercent={spendFlowPercent}
              monthlyIncome={monthlyIncome}
              totalSpent={totalSpent}
              totalBudget={totalBudget}
              spentPercent={spentPercent}
              billsPercent={billsPercent}
              freePercent={freePercent}
              unpaidRecurrings={unpaidRecurrings}
              netWorth={netWorth}
              totalAssets={totalAssets}
              totalDebt={totalDebt}
              nextPayday={nextPayday}
              breakdownRates={breakdownRates}
              bankAccounts={bankAccounts}
              selectedAccountFilter={selectedAccountFilter}
              onChangeAccountFilter={setSelectedAccountFilter}
              trueLayerStatus={trueLayerStatus}
              isSyncingTrueLayer={isSyncingTrueLayer}
              onSyncTrueLayer={syncTrueLayer}
              showAllTransactions={showAllTransactions}
              onToggleShowAllTransactions={() => setShowAllTransactions(!showAllTransactions)}
              accountTransactionsCount={accountTransactionsCount}
              displayedTransactions={displayedTransactions}
              onToggleTransactionReviewed={toggleTransactionReviewed}
              budgetCategories={budgetCategories}
              recurrings={recurrings}
              getProgressColor={getProgressColor}
              currentMonth={currentMonth}
              isDueThisMonth={isDueThisMonth}
              getDueDateText={getDueDateText}
              onToggleRecurringPaid={toggleRecurringPaid}
              goals={goals}
            />
          )}

          {/* ==========================================
              TAB 2: TAX & INCOME
              ========================================== */}
          {activeTab === 'tax-income' && (
            <TaxIncomeTab
              settings={settings}
              results={results}
              breakdownRates={breakdownRates}
              breakdownWorkingDays={breakdownWorkingDays}
              includeWorkLeaveInActual={includeWorkLeaveInActual}
              onChangeIncludeWorkLeave={setIncludeWorkLeaveInActual}
              onOpenBenefitsDialog={() => setIsBenefitsDialogOpen(true)}
              onOpenSettingsDialog={() => setIsSettingsOpen(true)}
              bankHolidaysList={bankHolidaysList}
              bankHolidaysMap={bankHolidaysMap}
              bankHolidaysLeft={bankHolidaysLeft}
              holidayDefaults={holidayDefaults}
              getHolidaysUsedCount={getHolidaysUsedCount}
              expandedMonthIdx={expandedMonthIdx}
              onToggleExpandedMonth={setExpandedMonthIdx}
              inlineBookMonthIdx={inlineBookMonthIdx}
              inlineOccasion={inlineOccasion}
              onChangeInlineOccasion={setInlineOccasion}
              inlineStartDate={inlineStartDate}
              onChangeInlineStartDate={setInlineStartDate}
              inlineEndDate={inlineEndDate}
              onChangeInlineEndDate={setInlineEndDate}
              inlineCount={inlineCount}
              onChangeInlineCount={setInlineCount}
              editingHolidayId={editingHolidayId}
              onStartEditHoliday={handleStartEditHoliday}
              onStartNewHoliday={handleStartNewHoliday}
              onSaveInlineHoliday={handleSaveInlineHoliday}
              onDeleteHoliday={handleDeleteHoliday}
              onResetInlineHolidayForm={resetInlineHolidayForm}
              nextPayday={nextPayday}
            />
          )}

          {/* ==========================================
              TAB 3: BUDGET
              ========================================== */}
          {activeTab === 'budget' && (
            <BudgetTab
              budgetCategories={budgetCategories}
              bankAccounts={bankAccounts}
              recurrings={recurrings}
              mockTransactions={mockTransactions}
              getCategoryBudget={getCategoryBudget}
              getCategorySpent={getCategorySpent}
              isItemActive={isItemActive}
              isCategoryActive={isCategoryActive}
              selectedBudgetCategoryFilter={selectedBudgetCategoryFilter}
              onChangeCategoryFilter={setSelectedBudgetCategoryFilter}
              expandedCategories={expandedCategories}
              onToggleExpandedCategory={(categoryId, expanded) => setExpandedCategories({ ...expandedCategories, [categoryId]: expanded })}
              onOpenAddCategory={() => setIsAddCategoryOpen(true)}
              onOpenAddItem={(categoryId) => {
                setActiveCategoryId(categoryId);
                setIsAddItemOpen(true);
              }}
              onOpenEditCategory={(category) => {
                setActiveCategoryId(category.id);
                setNewCategoryName(category.name);
                setNewCategoryBudget(category.budgeted !== undefined ? category.budgeted : category.items.reduce((s, i) => s + i.budgeted, 0));
                setNewCategoryEmoji(category.emoji || '');
                setNewCategoryGroup(category.group || 'needs');
                setIsEditCategoryOpen(true);
              }}
              onDeleteCategory={handleDeleteCategory}
              onOpenEditItem={(item) => {
                setActiveBudgetItem(item);
                setIsEditItemOpen(true);
              }}
              onDeleteItem={handleDeleteItem}
            />
          )}

          {/* ==========================================
              TAB 4: CASH FLOW
              ========================================== */}
          {activeTab === 'cash-flow' && (
            <CashFlowTab
              breakdownRates={breakdownRates}
              mockTransactions={mockTransactions}
              recurrings={recurrings}
              bankAccounts={bankAccounts}
              cfPeriod={cfPeriod}
              onChangeCfPeriod={setCfPeriod}
              cfPeriodOpen={cfPeriodOpen}
              onToggleCfPeriodOpen={setCfPeriodOpen}
              cfCustomStart={cfCustomStart}
              cfCustomEnd={cfCustomEnd}
              cfDrawerOpen={cfDrawerOpen}
              onChangeCfDrawerOpen={setCfDrawerOpen}
            />
          )}

          {/* ==========================================
              TAB 5: GOALS
              ========================================== */}
          {activeTab === 'goals' && (
            <GoalsTab
              goals={goals}
              bankAccounts={bankAccounts}
              selectedGoalId={selectedGoalId}
              onSelectGoal={setSelectedGoalId}
              collapsedGoalGroups={collapsedGoalGroups}
              onToggleGroup={(group) => setCollapsedGoalGroups(prev => ({ ...prev, [group]: !prev[group] }))}
              onOpenAddGoal={() => setIsAddGoalOpen(true)}
              onEditGoal={(goal) => {
                setEditingGoal(goal);
                setIsEditGoalOpen(true);
              }}
              onToggleArchiveGoal={handleToggleArchiveGoal}
              onDeleteGoal={handleDeleteGoal}
              newContribution={newContribution}
              onChangeNewContribution={setNewContribution}
              onAddContribution={handleAddContribution}
              onDeleteContribution={handleDeleteContribution}
            />
          )}

          {/* ==========================================
              TAB 6: ACCOUNTS
              ========================================== */}
          {activeTab === 'accounts' && (
            <AccountsTab
              bankAccounts={bankAccounts}
              onOpenAddAccount={() => setIsAddAccountOpen(true)}
              onEditAccount={(account) => {
                setActiveAccount(account);
                setIsEditAccountOpen(true);
              }}
              onDeleteAccount={handleDeleteAccount}
              trueLayerStatus={trueLayerStatus}
              isSyncingTrueLayer={isSyncingTrueLayer}
              isConnectingTrueLayer={isConnectingTrueLayer}
              onSyncTrueLayer={syncTrueLayer}
              onDisconnectTrueLayer={disconnectTrueLayer}
              onConnectTrueLayer={connectTrueLayer}
              memberships={memberships}
              onOpenAddMembership={() => setIsAddMembershipOpen(true)}
              onEditMembership={(membership) => {
                setActiveMembership(membership);
                setIsEditMembershipOpen(true);
              }}
              onDeleteMembership={handleDeleteMembership}
              creditBureaus={creditBureaus}
              creditScores={creditScores}
              onOpenAddCreditScore={() => setIsAddCreditScoreOpen(true)}
              onDeleteCreditScore={handleDeleteCreditScore}
              hoveredBands={hoveredBands}
              onHoverBand={(bureau, band) => setHoveredBands(prev => ({ ...prev, [bureau]: band }))}
            />
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


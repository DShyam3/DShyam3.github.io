import { useState, useEffect, useMemo, useRef } from 'react';
import defaultPresets from '@/data/presets.json';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  pathForSurface,
  SURFACES,
  TAB_LABELS,
  tabFromPath,
  surfaceForTab,
  pathForTab,
  type TabKey,
} from './surfaces';
import { FinanceDataProvider, useFinanceData } from './FinanceDataContext';
import CashFlowSurface from './surfaces/CashFlowSurface';
import GoalsSurface from './surfaces/GoalsSurface';
import BudgetSurface from './surfaces/BudgetSurface';
import AccountsSurface from './surfaces/AccountsSurface';
import { useTrueLayer } from './useTrueLayer';
import {
  ALL_PRESETS_FALLBACK,
  makeBudgetMath,
  asBudgetGroup,
  ALL_SAVINGS_IDS,
  DEFAULT_BUDGET_CATEGORIES,
  DEFAULT_CATEGORY_PRESETS,
  DEFAULT_CATEGORY_TEMPLATES,
  DEFAULT_RECURRING_TEMPLATES,
  EDUCATION_CAREER_PRESETS,
  FAMILY_KIDS_PRESETS,
  FOOD_ENTERTAINMENT_PRESETS,
  GIFTS_DONATIONS_PRESETS,
  HEALTH_WELLNESS_PRESETS,
  HOUSING_PRESETS,
  INSURANCE_PRESETS,
  LOANS_PRESETS,
  MONTH_NAMES,
  OTHER_PRESETS,
  PETS_PRESETS,
  SAVINGS_PRESETS,
  SHOPPING_PRESETS,
  SUBSCRIPTION_PRESETS,
  TRANSPORT_PRESETS,
  TRAVEL_HOLIDAYS_PRESETS,
  getBudgetItemSpent,
  getDueDateText,
  getPlanName,
  isDiscretionaryCategory,
  isDueThisMonth,
  isEducationCareerCategory,
  isFamilyKidsCategory,
  isGiftsDonationsCategory,
  isHealthWellnessCategory,
  isHousingCategory,
  isInsuranceCategory,
  isLoansCategory,
  isOtherCategory,
  isPetsCategory,
  isShoppingCategory,
  isSubscriptionsCategory,
  isTransportCategory,
  isTravelHolidaysCategory,
  mergeMissingDefaultCategories,
  presetsToDefaultCategories,
  resolveStoredList,
  safeParseJSON,
} from './finance-defaults';
import {
  BUREAU_BANDS,
  calculateActualPayday,
  calculateWorkingDaysInRange,
  DEBT_TYPE_LABELS,
  describeArc,
  formatDaysList,
  formatHolidayDates,
  getBookedDaysForMonth,
  getDaysInMonth,
  getStartDayOfWeek,
  normalizeHolidays,
  parseDays,
  parseEntryDays,
  polarToCartesian,
  projectDebtBalance,
  STUDENT_LOAN_PLAN_LABELS,
  STUDENT_LOAN_WRITE_OFF_YEARS,
  type BureauBand,
  type StudentLoanPlanKey,
  type CreditTier,
} from '@/lib/finance';
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
  Shield,
  Landmark
} from 'lucide-react';
import type {
  BankAccount,
  BudgetCategory,
  BudgetItem,
  CreditBureauConfig,
  CreditScoreEntry,
  CreditScores,
  Debt,
  DebtDraw,
  FinanceSettings,
  Goal,
  InvestmentHolding,
  Membership,
  MockTransaction,
  PackageBenefit,
  RecurringBill,
  RecurringTemplate,
  TaxConfig,
  TrueLayerStatus,
  UserHoliday,
} from '@/features/finance/finance-types';
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
import { RecurringsTab } from '@/features/finance/tabs/RecurringsTab';
import { TimeSpentTab } from '@/features/finance/tabs/TimeSpentTab';
import { TransactionsTab } from '@/features/finance/tabs/TransactionsTab';
import { InvestmentsTab } from '@/features/finance/tabs/InvestmentsTab';
import { AddRecurringDialog } from '@/features/finance/dialogs/AddRecurringDialog';
import { EditRecurringDialog } from '@/features/finance/dialogs/EditRecurringDialog';
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
} from '@/features/finance/utils/calculations';
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
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';

// ==========================================
// TYPES & INTERFACES
// ==========================================




/** Adapts component state to `normalizeHolidays`, which takes the stored value
 *  and the tax year rather than the whole settings object. */
const getNormalizedHolidays = (
  settings: FinanceSettings,
  holidayDefaults: Parameters<typeof normalizeHolidays>[0],
): UserHoliday[] =>
  normalizeHolidays(
    settings.holidaysByUser || holidayDefaults,
    settings.taxYear || new Date().getFullYear(),
  );

interface CategoryPreset {
  name: string;
  emoji: string;
  group: 'needs' | 'wants' | 'savings';
}

// ==========================================
// CONSTANTS & DEFAULTS
// ==========================================



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

/**
 * The finance shell. Data comes from `FinanceDataProvider` below rather than
 * from local state, so the five surfaces can be split out of this file in 7.2c
 * without threading two dozen props through each of them.
 */
function FinanceView() {
  const {
    bankAccounts,
    budgetCategories,
    creditBureaus,
    creditScores,
    databaseDefaults,
    debts,
    defaultBudgetCategories,
    fetchSupabaseData,
    goals,
    holidayDefaults,
    investmentHoldings,
    loadingDb,
    memberships,
    mockTransactions,
    payDayInput,
    paydayBiweeklyAnchor,
    paydaySchedule,
    paydayWeekday,
    presets,
    profileId,
    recurringTemplates,
    recurrings,
    saveDataToSupabase,
    savingDb,
    selectedGoalId,
    setBankAccounts,
    setBudgetCategories,
    setCreditBureaus,
    setCreditScores,
    setDatabaseDefaults,
    setDebts,
    setDefaultBudgetCategories,
    setGoals,
    setHolidayDefaults,
    setInvestmentHoldings,
    setLoadingDb,
    setMemberships,
    setMockTransactions,
    setPayDayInput,
    setPaydayBiweeklyAnchor,
    setPaydaySchedule,
    setPaydayWeekday,
    setPresets,
    setProfileId,
    setRecurringTemplates,
    setRecurrings,
    setSavingDb,
    setSelectedGoalId,
    setSettings,
    setTaxConfig,
    setTimeSpentInputs,
    settings,
    taxConfig,
    timeSpentInputs,
  } = useFinanceData();

  // The visible section comes from the URL, not from state: a surface is a
  // route (REHAUL_PLAN.md 7.C), so a view is linkable and the back button
  // works. `setActiveTab` keeps its old signature so the cross-links further
  // down this file did not have to change.
  const navigate = useNavigate();
  const [, surfaceSeg, sectionSeg] = useLocation().pathname.split('/').slice(1);
  const activeTab = tabFromPath(surfaceSeg, sectionSeg);
  const activeSurface = surfaceForTab(activeTab);
  const setActiveTab = (tab: TabKey) => navigate(pathForTab(tab));
  const activeSections = (SURFACES.find(su => su.key === activeSurface)?.tabs ?? []) as readonly TabKey[];

  const [cfCustomStart, setCfCustomStart] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-01-01`;
  });

  // Shared budget arithmetic, built from the provider's data rather than
  // closed over here, so a surface can build its own (7.2c-i).
  const { isItemActive, getCategoryBudget, getCategorySpent } = makeBudgetMath(
    settings.activeSavingsTypes,
    bankAccounts,
    recurrings,
  );




  const autoCategorizeRecurring = (name: string) => {
    const cleanName = name.trim().toLowerCase();
    const match = recurringTemplates.find(t =>
      cleanName.includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(cleanName)
    );
    return match || null;
  };

  // Dashboard spending progress period
  const [dashboardSpendRange, setDashboardSpendRange] = useState<'this_month' | 'last_3m' | 'ytd' | 'all_time'>('this_month');

  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { askDelete, deleteDialog } = useDeleteConfirm();

  // Connect/sync lives in a hook because both Home and Wealth offer it (7.2c-i).
  const {
    trueLayerStatus,
    isSyncingTrueLayer,
    isConnectingTrueLayer,
    setIsConnectingTrueLayer,
    checkTrueLayerConnection,
    connectTrueLayer,
    disconnectTrueLayer,
    syncTrueLayer,
    callTrueLayerEdgeFunction,
  } = useTrueLayer(fetchSupabaseData);


  // Dynamic Budget Presets loaded from Supabase or Fallback
  const [fetchingHolidays, setFetchingHolidays] = useState(false);
  const [bankHolidaysList, setBankHolidaysList] = useState<string[]>([]);
  const [bankHolidaysMap, setBankHolidaysMap] = useState<Record<string, string>>({});

  const [isAddRecurringOpen, setIsAddRecurringOpen] = useState(false);
  const [addRecTemplate, setAddRecTemplate] = useState("scratch");
  const [isEditRecurringOpen, setIsEditRecurringOpen] = useState(false);
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

  const performDeleteBenefit = (id: string) => {
    const updatedBenefits = (settings.packageBenefits || []).filter(b => b.id !== id);
    setSettings(prev => ({ ...prev, packageBenefits: updatedBenefits }));
    toast({ title: 'Benefit Removed', description: 'Benefit removed from package.' });
  };

  const handleDeleteBenefit = (id: string) =>
    askDelete({
      name: (settings.packageBenefits || []).find(b => b.id === id)?.name,
      onConfirm: () => performDeleteBenefit(id),
    });

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





  const [activeRecurring, setActiveRecurring] = useState<RecurringBill | null>(null);
  const [newRecurring, setNewRecurring] = useState<Omit<RecurringBill, 'id' | 'amount'> & { amount: number | ''; }>({
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

  const [showAllTransactions, setShowAllTransactions] = useState(false);


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

  // ==========================================
  // SYNC & FETCH EFFECT
  // ==========================================

  // Fetch all finance keys on mount


  // ==========================================
  // HANDLERS: TRUELAYER BANK SYNC
  // ==========================================






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
    localStorage.setItem('finance_debts', JSON.stringify(debts));
  }, [debts]);
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









  // ==========================================
  // HANDLERS: ACCOUNTS CRUD
  // ==========================================





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

  const performDeleteHolding = (id: string) => {
    const deleted = investmentHoldings.find(h => h.id === id);
    const updated = investmentHoldings.filter(h => h.id !== id);
    setInvestmentHoldings(updated);
    if (deleted) {
      toast({ title: 'Asset Deleted', description: `Removed ${deleted.name} from portfolio.` });
    }
  };

  const handleDeleteHolding = (id: string) =>
    askDelete({
      name: investmentHoldings.find(h => h.id === id)?.name,
      onConfirm: () => performDeleteHolding(id),
    });






  // ==========================================
  // HANDLERS: DEBT
  // ==========================================










  // ==========================================
  // HANDLERS: CREDIT SCORES
  // ==========================================




  // ==========================================
  // HANDLERS: BUDGET CRUD
  // ==========================================









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
      amount: newRecurring.amount,
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

  const performDeleteRecurring = (id: string) => {
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

  const handleDeleteRecurring = (id: string) =>
    askDelete({
      name: recurrings.find(r => r.id === id)?.name,
      onConfirm: () => performDeleteRecurring(id),
    });

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

  const performDeleteHoliday = (holidayId: string) => {
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

  const handleDeleteHoliday = (holidayId: string) =>
    askDelete({
      title: 'Delete holiday',
      description: 'Delete this holiday? This action cannot be undone.',
      onConfirm: () => performDeleteHoliday(holidayId),
    });

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
          'finance_bank_accounts', 'finance_memberships', 'finance_debts', 'finance_credit_scores',
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
  const totalLoanBalance = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalDebt = Math.abs(bankAccounts.filter(a => a.balance < 0).reduce((sum, a) => sum + a.balance, 0)) + totalLoanBalance;
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

  const progressLineColor = isDashboardSpendOverBudget ? '#f97316' : '#10b981'; // orange/amber vs emerald
  const progressGradientColor = isDashboardSpendOverBudget ? '#f97316' : '#10b981';

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
    if (budgeted <= 0) return spent > 0 ? 'bg-rose-500' : 'bg-[#40a02b] dark:bg-[#a6e3a1]';
    const percent = spent / budgeted;
    if (percent <= 0.75) return 'bg-[#40a02b] dark:bg-[#a6e3a1]';
    if (percent <= 1.0) return 'bg-orange-500';
    return 'bg-rose-500';
  };

  /* Handed to AppShell's toolbar slot, so the surface and section navs stay
     pinned while the surface underneath scrolls. */
  const toolbar = (
    <div className="flex flex-col">
    {/* Primary navigation: the five surfaces. */}
    <div className="flex items-center justify-between border-b border-border/50 px-4 md:px-0 gap-4">
      <nav className="flex flex-nowrap items-center justify-start gap-2 md:gap-4 py-4 overflow-x-auto scrollbar-hide flex-1">
        {SURFACES.map((surface, index) => {
          const isActive = activeSurface === surface.key;
          return (
            <div key={surface.key} className="flex items-center gap-2 md:gap-4">
              <button
                onClick={() => navigate(pathForSurface(surface.key))}
                className={cn(
                  'nav-link relative py-1 text-xs whitespace-nowrap flex items-center gap-1.5',
                  isActive && 'nav-link-active'
                )}
              >
                <DotMatrixText text={surface.label.toUpperCase()} size="xs" />
              </button>
              {index < SURFACES.length - 1 && (
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

    {/* Secondary navigation: sections within a surface. Home has one
        section, so it renders no second row. */}
    {activeSections.length > 1 && (
      <nav className="flex flex-nowrap items-center gap-4 md:gap-5 py-3 px-4 md:px-0 overflow-x-auto scrollbar-hide border-b border-border/30">
        {activeSections.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'text-xs whitespace-nowrap font-sans transition-colors',
              activeTab === tab
                ? 'text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>
    )}
    </div>
  );

  return (
    <>
      <AppShell
        title="Finance"
        subtitle="Personal Income & Tax Dashboard"
        toolbar={toolbar}
      >
        {/* The shell owns the scroll container and the fluid padding; this
            just stacks the sections it hands us. */}
        <div className="flex flex-col py-6 sm:py-8 w-full min-w-0">
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
                            isDashboardSpendOverBudget ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
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
                        isDashboardSpendOverBudget ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
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
                          <span className={cn("text-xl sm:text-2xl font-extrabold font-mono block tracking-tight whitespace-nowrap", netCashFlow >= 0 ? "text-emerald-500" : "text-rose-500")}>
                            {netCashFlow >= 0 ? '+' : ''}{formatGBP(netCashFlow)}
                          </span>
                          {/* Trend comparison */}
                          <div className="flex items-center gap-1 text-[8px] text-muted-foreground font-sans truncate">
                            <span className={cn(
                              "flex items-center px-1 py-0.5 rounded-full font-bold font-mono text-[8px]",
                              comparison.isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
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
                              <PiggyBank className="h-3 w-3 text-emerald-500" />
                            </span>
                            <span className={cn("text-xl sm:text-2xl font-extrabold font-mono block tracking-tight whitespace-nowrap", freeToSpend >= 0 ? "text-emerald-500" : "text-rose-500")}>
                              {formatGBP(freeToSpend)}
                            </span>
                          </div>
                          {freeToSpend > 0 ? (
                            <p className="text-[9px] text-muted-foreground font-sans mt-0.5">
                              <span className="font-bold text-foreground font-mono">{formatGBP(dailyFreeToSpend)}</span>/day left
                            </p>
                          ) : (
                            <p className="text-[9px] text-rose-500/80 font-sans font-medium mt-0.5">
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
                          <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${incomeFlowPercent}%` }} />
                          <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${spendFlowPercent}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[8px] text-muted-foreground font-mono">
                          <span>In: <span className="text-emerald-500 font-bold">{formatGBP(monthlyIncome)}</span></span>
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
                              <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${spentWidth}%` }} title={`Spent: ${spentPercent.toFixed(0)}%`} />
                              <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${billsWidth}%` }} title={`Bills: ${billsPercent.toFixed(0)}%`} />
                              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${freeWidth}%` }} title={`Free: ${freePercent.toFixed(0)}%`} />
                            </div>
                          );
                        })()}
                        <div className="flex flex-wrap items-center justify-between text-[8px] font-mono text-muted-foreground gap-y-1">
                          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Spent ({spentPercent.toFixed(0)}%)</span>
                          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Bills ({formatGBP(unpaidRecurrings)})</span>
                          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Free ({freePercent.toFixed(0)}%)</span>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Net Assets, Debt & Net Cash Flow block */}
                  <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-lg p-3 sm:p-4 rounded-3xl space-y-1.5 text-left">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">Net Worth</span>
                    <span className="text-base font-bold font-mono text-emerald-500 block truncate">{formatGBP(netWorth)}</span>
                    <div className="flex justify-between text-[8px] text-muted-foreground border-t border-border/20 pt-1.5 font-mono">
                      <span className="text-emerald-500/80">Assets: {formatGBP(totalAssets)}</span>
                      <span className="text-rose-500/80">Debt: {formatGBP(totalDebt)}</span>
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
                        <span className="text-[10px] text-emerald-500 font-mono font-semibold block">
                          +{formatGBP(breakdownRates.postTax.monthly)} expected
                        </span>
                      </div>
                      <span className={cn(
                        "font-mono px-2.5 py-0.5 rounded-full font-bold text-[10px] select-none",
                        nextPayday.daysRemaining === 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-muted/60 text-muted-foreground"
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
                                  tx.amount < 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
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
                                className="h-5 w-5 rounded-lg flex items-center justify-center border border-border/40 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-transparent hover:text-emerald-500/70 transition-all shrink-0"
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
                        <span className="mt-1 block font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">+{formatGBP(results.employerPensionRate)}</span>
                      </div>
                      <div className="bg-card/60 backdrop-blur-sm rounded-xl p-3 border border-border/40">
                        <span className="block text-[10px] font-medium text-muted-foreground uppercase">Benefits & Perks</span>
                        <span className="mt-1 block font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">+{formatGBP(results.totalBenefitsValue)}</span>
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
                            <th className="py-3 pr-4 whitespace-nowrap sticky left-0 z-10 bg-background border-r border-border/40">Category</th>
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
                            <td className="py-3 pr-4 font-bold text-sm whitespace-nowrap flex items-center gap-1.5 sticky left-0 z-10 bg-background border-r border-border/40">
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
                            <td className="py-3 pr-4 font-bold font-sans text-foreground whitespace-nowrap sticky left-0 z-10 bg-background border-r border-border/40">Gross Base Salary</td>
                            <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.annual)}</td>
                            <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.monthly)}</td>
                            <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.weekly)}</td>
                            <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.daily)}</td>
                            <td className="py-3 pl-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.hourly)}</td>
                          </tr>

                          {/* Employer Pension Addition */}
                          {results.employerPensionRate > 0 && (
                            <tr className="hover:bg-emerald-500/10 transition-colors bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                              <td className="py-3 pr-4 font-sans text-left sticky left-0 z-10 bg-background border-r border-border/40">
                                <div className="flex flex-col justify-center min-w-[120px]">
                                  <span className="font-bold flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Employer Pension ({settings.employerPensionPercent}%)
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
                            <tr className="hover:bg-emerald-500/10 transition-colors bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                              <td className="py-3 pr-4 font-sans text-left sticky left-0 z-10 bg-background border-r border-border/40">
                                <div className="flex flex-col justify-center min-w-[120px]">
                                  <span className="font-bold flex items-center gap-1.5">
                                    <Gift className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Benefits & Perks ({settings.packageBenefits?.length || 0})
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
                              <td className="py-3 pr-4 font-sans text-left sticky left-0 z-10 bg-background border-r border-border/40">
                                <div className="flex flex-col justify-center min-w-[120px]">
                                  <span className="font-bold text-foreground">Personal Pension ({settings.personalPensionPercent}%)</span>
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
                              <td className="py-3 font-sans font-bold text-foreground sticky left-0 z-10 bg-background border-r border-border/40">Income Tax</td>
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
                              <td className="py-3 pr-4 font-sans text-left sticky left-0 z-10 bg-background border-r border-border/40">
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
                              <td className="py-3 font-sans font-bold text-foreground sticky left-0 z-10 bg-background border-r border-border/40">Student Loan ({getPlanName(settings.studentLoanPlan)})</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.studentLoan.annual)}</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.studentLoan.monthly)}</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.studentLoan.weekly)}</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.studentLoan.daily)}</td>
                              <td className="py-3 text-right text-rose-600 dark:text-rose-400 font-semibold">-{formatGBP(breakdownRates.studentLoan.hourly)}</td>
                            </tr>
                          )}

                          {/* Total Deductions */}
                          <tr className="hover:bg-rose-500/10 transition-colors text-rose-700 dark:text-rose-300 bg-rose-500/5 dark:bg-rose-500/10 font-sans">
                            <td className="py-3 font-bold sticky left-0 z-10 bg-background border-r border-border/40">Total Deductions</td>
                            <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.annual)}</td>
                            <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.monthly)}</td>
                            <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.weekly)}</td>
                            <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.daily)}</td>
                            <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.hourly)}</td>
                          </tr>

                          {/* Take Home Pay */}
                          <tr className="hover:bg-emerald-500/10 transition-colors text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 dark:bg-emerald-500/10 font-sans">
                            <td className="py-3 font-bold text-sm sticky left-0 z-10 bg-background border-r border-border/40">Take-Home Pay</td>
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
          {activeTab === 'budget' && <BudgetSurface totalSpent={totalSpent} />}

          {/* ==========================================
              TAB 4: CASH FLOW
              ========================================== */}
          {activeTab === 'cash-flow' && (
            <CashFlowSurface breakdownRates={breakdownRates} todayDateObj={todayDateObj} />
          )}

          {/* ==========================================
              TAB 5: GOALS
              ========================================== */}
          {activeTab === 'goals' && <GoalsSurface />}

          {/* ==========================================
              TAB 6: ACCOUNTS
              ========================================== */}
          {activeTab === 'accounts' && <AccountsSurface totalLoanBalance={totalLoanBalance}/>}

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

        </div>
      </AppShell>

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
                          <span className="block font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">+{formatGBP(annualVal)}</span>
                          <span className="block font-mono text-[9px] text-muted-foreground">+{formatGBP(annualVal / 12)}/mo</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteBenefit(benefit.id)}
                          className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
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

      {/* DIALOG: Edit Savings Goal */}

      {/* DIALOG: Add Account */}

      {/* DIALOG: Edit Account */}

      {/* DIALOG: Add Membership */}

      {/* DIALOG: Edit Membership */}

      {/* DIALOG: Add Debt */}

      {/* DIALOG: Edit Debt */}

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

      {/* DIALOG: Add Budget Category */}

      {/* DIALOG: Edit Budget Category */}

      {/* DIALOG: Add Budget Item */}

      {/* DIALOG: Edit Budget Item */}



      {deleteDialog}
    </>
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

export default function Finance() {
  return (
    <FinanceDataProvider>
      <FinanceView />
    </FinanceDataProvider>
  );
}

import { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react';
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
  showsSurfaceHero,
  type TabKey,
} from './surfaces';
import { FinanceDataProvider, useFinanceData } from './FinanceDataContext';
import { useCoalescedSave } from './useCoalescedSave';
const CashFlowSurface = lazy(() => import('./surfaces/CashFlowSurface'));
const GoalsSurface = lazy(() => import('./surfaces/GoalsSurface'));
const ScenariosSurface = lazy(() => import('./surfaces/ScenariosSurface'));
const RetirementSurface = lazy(() => import('./surfaces/RetirementSurface'));
const TransfersSurface = lazy(() => import('./surfaces/TransfersSurface'));
const BudgetSurface = lazy(() => import('./surfaces/BudgetSurface'));
const AccountsSurface = lazy(() => import('./surfaces/AccountsSurface'));
const TaxIncomeSurface = lazy(() => import('./surfaces/TaxIncomeSurface'));
const DashboardSurface = lazy(() => import('./surfaces/DashboardSurface'));
import { useTrueLayer } from './useTrueLayer';
import { useFinanceTotals } from './useFinanceTotals';
import { SurfaceHero } from './components/SurfaceHero';
import { ProfileAvatar } from './components/ProfileAvatar';
import { NetWorthTrend } from './components/NetWorthTrend';
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
const RecurringsTab = lazy(() => import('@/features/finance/tabs/RecurringsTab').then(m => ({ default: m.RecurringsTab })));
const TimeSpentTab = lazy(() => import('@/features/finance/tabs/TimeSpentTab').then(m => ({ default: m.TimeSpentTab })));
const TransactionsTab = lazy(() => import('@/features/finance/tabs/TransactionsTab').then(m => ({ default: m.TransactionsTab })));
const InvestmentsTab = lazy(() => import('@/features/finance/tabs/InvestmentsTab').then(m => ({ default: m.InvestmentsTab })));
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
    hasLoaded,
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
    fetchingHolidays,
    setFetchingHolidays,
    bankHolidaysList,
    setBankHolidaysList,
    bankHolidaysMap,
    setBankHolidaysMap,
    includeWorkLeaveInActual,
    setIncludeWorkLeaveInActual,
    profiles,
    netWorthHistory,
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


  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { askDelete, deleteDialog } = useDeleteConfirm();

  const saveTransactionsSoon = useCoalescedSave<MockTransaction[]>(
    (updated) => saveDataToSupabase('transactions', updated),
  );

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

  const [isAddRecurringOpen, setIsAddRecurringOpen] = useState(false);
  const [addRecTemplate, setAddRecTemplate] = useState("scratch");
  const [isEditRecurringOpen, setIsEditRecurringOpen] = useState(false);
  const [isBenefitsDialogOpen, setIsBenefitsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);







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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSettingsOpen, taxConfig, recurringTemplates, creditBureaus, settings]);






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
    } catch (err: unknown) {
      console.error('Error in TrueLayer callback:', err);
      toast({
        title: "Verification Failed",
        description: err instanceof Error ? err.message : "Could not verify bank authentication code",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Fetch UK Bank Holidays dynamically

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
  }, [settings]);




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


  // Every shared derived figure, so no surface takes a prop for a number it
  // can derive itself (7.2c-i).
  const {
    allBudgetItems,
    breakdownRates,
    breakdownWorkingDays,
    currentMonth,
    currentMonthIdx,
    currentYear,
    dailyFreeToSpend,
    daysInMonth,
    daysRemainingInMonth,
    hasBudget,
    freeToSpend,
    incomeFlowPercent,
    monthlyIncome,
    netCashFlow,
    netWorth,
    nextPayday,
    results,
    spendFlowPercent,
    todayDateObj,
    totalAssets,
    totalBudget,
    totalDebt,
    totalFlow,
    totalLoanBalance,
    totalSpent,
    unpaidRecurrings,
  } = useFinanceTotals();



  // Calculate next payday details


  // ==========================================
  // HANDLERS: TAB CATEGORY NAVIGATION COUNT
  // ==========================================


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


  // ==========================================
  // HANDLERS: HOLIDAY TRACKER (TAX & INCOME TAB)
  // ==========================================







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
    const defaultSettings: FinanceSettings = databaseDefaults.settings || {
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
    const defaultTaxConfig: TaxConfig = databaseDefaults.tax_config || {
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
        await Promise.all(deleteTables.map(t => supabase.from(t as 'finance_settings').delete().eq('is_default', false)));
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




  // Segmented progress bar percentages for Income vs Spend



  // ─── COPILOT STYLE CALCULATIONS ──────────────────────────────────────




  // Spending progress cumulative daily chart data
  // Dashboard spending progress helper based on range


  // Transactions to review state
  const unreviewedCount = mockTransactions.filter(tx => !tx.isReviewed).length;



  /**
   * The number each surface leads with. Home is absent on purpose: it is
   * already a cockpit of several figures, and crowning it with one more would
   * just repeat whichever it picked.
   */
  const surfaceHero = (() => {
    if (activeSurface === 'spending') {
      return (
        <SurfaceHero
          loading={!hasLoaded}
          label="Spent this month"
          value={formatGBP(totalSpent)}
          detail={
            totalBudget > 0
              ? `of ${formatGBP(totalBudget)} budgeted · ${formatGBP(Math.max(0, totalBudget - totalSpent))} left`
              : 'No budget set'
          }
          tone={totalBudget > 0 && totalSpent > totalBudget ? 'negative' : 'neutral'}
          aside={
            unpaidRecurrings > 0 ? (
              <>
                <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Bills unpaid</p>
                <p className="font-sans text-lg font-bold tabular-nums">{formatGBP(unpaidRecurrings)}</p>
              </>
            ) : null
          }
        />
      );
    }
    if (activeSurface === 'plan') {
      return (
        <SurfaceHero
          loading={!hasLoaded}
          // Not "projected balance": freeToSpend is budget minus spent minus
          // unpaid bills, which is what is left to commit, not what will be in
          // the account. Naming it the second thing would be a lie by label.
          label="Free to spend before payday"
          value={formatGBP(freeToSpend)}
          tone={freeToSpend < 0 ? 'negative' : 'neutral'}
          // dailyFreeToSpend floors at zero, so once you are over it would read
          // "£0.00 a day", which says nothing. Past that point the useful
          // number is the overspend itself.
          detail={
            freeToSpend >= 0
              ? `${formatGBP(dailyFreeToSpend)} a day across the ${daysRemainingInMonth} days left${hasBudget ? '' : ' · measured against take-home, no budget set'}`
              : `Over by ${formatGBP(Math.abs(freeToSpend))} with ${daysRemainingInMonth} days left in the month`
          }
          aside={
            <>
              <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Next payday</p>
              <p className="font-sans text-lg font-bold tabular-nums">{nextPayday?.daysRemaining ?? 0} days</p>
            </>
          }
        />
      );
    }
    if (activeSurface === 'wealth') {
      return (
        <SurfaceHero
          loading={!hasLoaded}
          label="Net worth"
          value={formatGBP(netWorth)}
          // Crisp neutral foreground text per Treasury standards.
          tone="neutral"
          detail={
            <>
              Assets {formatGBP(totalAssets)} · Debt {formatGBP(totalDebt)}
              <div className="mt-3 max-w-sm">
                <NetWorthTrend points={netWorthHistory} today={todayDateObj.toISOString().slice(0, 10)} />
              </div>
            </>
          }
          // Only when there are actual debt rows. A liability recorded as an
          // overdrawn account is already inside totalDebt above, so an empty
          // "Loans outstanding £0.00" beside a visible student loan reads as
          // wrong even though it is faithful to the table it comes from.
          aside={
            totalLoanBalance > 0 ? (
              <>
                <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Loans outstanding</p>
                <p className="font-sans text-lg font-bold tabular-nums">{formatGBP(totalLoanBalance)}</p>
              </>
            ) : null
          }
        />
      );
    }
    if (activeSurface === 'income') {
      return (
        <SurfaceHero
          loading={!hasLoaded}
          label="Take-home this tax year"
          value={formatGBP(results.netTakeHome)}
          tone="neutral"
          detail={`${formatGBP(monthlyIncome)} a month after tax, pension and student loan`}
          aside={
            <>
              <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Gross package</p>
              <p className="font-sans text-lg font-bold tabular-nums">{formatGBP(results.totalPackage)}</p>
            </>
          }
        />
      );
    }
    return null;
  })();

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
      {profiles.length > 1 && (
        <Select value={profileId ?? undefined} onValueChange={setProfileId}>
          <SelectTrigger className="h-7 w-auto gap-1.5 rounded-lg border border-border/40 bg-background/60 px-2.5 text-xs font-mono shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {profiles.map(p => (
              <SelectItem key={p.id} value={p.id} className="text-xs font-sans">
                <span className="flex items-center gap-2">
                  <ProfileAvatar profile={p} />
                  {p.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {loadingDb && (
        <span className="text-xs text-muted-foreground animate-pulse flex items-center gap-1 shrink-0 pb-1 font-sans">
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
        {/* Each section is its own chunk, so opening Home no longer downloads
            the charting and dialog code every other section needs. The
            fallback is deliberately bare: the shell, nav and footer are
            already painted, so only the middle is waiting. */}
        <div className="flex flex-col py-6 sm:py-8 w-full min-w-0">
          {showsSurfaceHero(activeTab) ? surfaceHero : null}

          <Suspense fallback={<div className="py-16 text-center text-sm text-muted-foreground font-sans">Loading…</div>}>
          {/* ==========================================
              TAB 1: DASHBOARD
              ========================================== */}
          {activeTab === 'dashboard' && <DashboardSurface toggleRecurringPaid={toggleRecurringPaid}/>}

          {/* ==========================================
              TAB 2: TAX & INCOME
              ========================================== */}
          {activeTab === 'tax-income' && <TaxIncomeSurface
              setIsSettingsOpen={setIsSettingsOpen}
              isBenefitsDialogOpen={isBenefitsDialogOpen}
              setIsBenefitsDialogOpen={setIsBenefitsDialogOpen}
            />}

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

          {activeTab === 'scenarios' && <ScenariosSurface />}

          {activeTab === 'retirement' && <RetirementSurface />}

          {activeTab === 'transfers' && <TransfersSurface />}

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
                // Coalesced: the review queue runs on held keys, and each
                // press rewrites the whole array.
                saveTransactionsSoon(updated);
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

          </Suspense>
        </div>
      </AppShell>

      {/* ==========================================
          DIALOGS & DIALOG FORMS
          ========================================== */}

      {/* DIALOG: Manage Package Benefits & Perks */}

      {/* DIALOG: Tax & Income Settings */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="!flex !flex-col sm:rounded-xl border border-border/40 bg-card font-mono w-[calc(100vw-1.5rem)] sm:w-full max-w-2xl lg:max-w-3xl max-h-[90dvh] gap-0 p-0 overflow-hidden shadow-none">
          <DialogHeader className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-border/40 text-left shrink-0">
            <DialogTitle className="font-mono text-base font-bold tracking-tight text-foreground">Tax & Income Settings</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">
              Salary, pension, tax code, and working day parameters.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveSettings} className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6">
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/20 border border-border/30">
                    <DollarSign className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Salary & Pension</h3>
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
                        className="rounded-lg h-9 pl-7 border border-border/40 bg-background/50 font-mono text-xs"
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
                      <SelectTrigger id="paydaySchedule" className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono">
                        <SelectValue placeholder="Select schedule..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border border-border/40 bg-popover font-mono text-xs">
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
                        className="rounded-lg h-9 border border-border/40 bg-background/50 font-mono text-xs"
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
                        <SelectTrigger id="paydayWeekday" className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono">
                          <SelectValue placeholder="Select day..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border border-border/40 bg-popover font-mono text-xs">
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
                        className="rounded-lg h-9 border border-border/40 bg-background/50 font-mono text-xs"
                        required
                      />
                      <p className="text-[11px] text-muted-foreground">Any past pay date to calculate every two weeks from.</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="pensionType" className="text-xs font-medium text-muted-foreground">Pension arrangement</Label>
                      <Select
                        value={settings.pensionType}
                        onValueChange={(val) => setSettings({ ...settings, pensionType: val as FinanceSettings['pensionType'] })}
                      >
                        <SelectTrigger id="pensionType" className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono">
                          <SelectValue placeholder="Select arrangement..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border border-border/40 bg-popover font-mono text-xs">
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
                        <SelectTrigger id="studentLoan" className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono">
                          <SelectValue placeholder="Select plan..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border border-border/40 bg-popover font-mono text-xs">
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
                        className="rounded-lg h-9 border border-border/40 bg-background/50 font-mono text-xs"
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
                        className="rounded-lg h-9 border border-border/40 bg-background/50 font-mono text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/30 bg-muted/20 p-3 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5 text-primary" /> Benefits & Package Perks
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {settings.packageBenefits?.length ? `${settings.packageBenefits.length} active additions (${formatGBP(results.totalBenefitsValue)}/yr)` : 'No custom benefits added yet'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsBenefitsDialogOpen(true)}
                      className="h-7 rounded-lg text-xs gap-1.5 border border-border/40 bg-background/60 hover:bg-muted/30 font-mono"
                    >
                      <Gift className="w-3 h-3 text-primary" /> Manage Perks
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
                        className="rounded-lg h-9 border border-border/40 bg-background/50 uppercase font-mono text-xs"
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
                          className="rounded-lg h-9 pl-7 border border-border/40 bg-background/50 font-mono text-xs"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4 pt-2 border-t border-border/40">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/20 border border-border/30">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Working days</h3>
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
                        <SelectTrigger className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono">
                          <SelectValue placeholder="Select region..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border border-border/40 bg-popover font-mono text-xs">
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
                        <SelectTrigger className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono">
                          <SelectValue placeholder="Select year..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border border-border/40 bg-popover font-mono text-xs">
                          <SelectItem value="2025">2025</SelectItem>
                          <SelectItem value="2026">2026</SelectItem>
                          <SelectItem value="2027">2027</SelectItem>
                          <SelectItem value="2028">2028</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Weekends</p>
                      <p className="mt-0.5 text-xs font-mono font-semibold text-foreground">
                        {settings.weekends}
                        <span className="ml-1 text-[11px] font-normal text-muted-foreground">days</span>
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        Bank holidays
                        {fetchingHolidays && <Loader2 className="h-3 w-3 animate-spin" />}
                      </p>
                      <p className="mt-0.5 text-xs font-mono font-semibold text-foreground">
                        {settings.bankHolidays}
                        <span className="ml-1 text-[11px] font-normal text-muted-foreground">days</span>
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
                        className="rounded-lg h-9 border border-border/40 bg-background/50 font-mono text-xs"
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
                        className="rounded-lg h-9 border border-border/40 bg-background/50 font-mono text-xs"
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
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/20 border border-border/30">
                      <Sliders className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Advanced Configurations</h3>
                      <p className="text-[11px] text-muted-foreground">Customize tax bands, recurring templates, and credit bureaus</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Item 1: Tax Bands */}
                  <div className="rounded-lg border border-border/30 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedSection(expandedSection === 'tax' ? 'none' : 'tax')}
                      className="w-full flex items-center justify-between p-2.5 bg-muted/10 text-xs font-semibold hover:bg-muted/20 transition-colors text-left font-mono"
                    >
                      <span className="flex items-center gap-2"><DollarSign className="w-3.5 h-3.5 text-primary" /> Income Tax & NI Bands</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedSection === 'tax' ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedSection === 'tax' && (
                      <div className="p-4 bg-background/30 border-t border-border/20 space-y-4 text-xs">
                        <div className="space-y-3">
                          <h4 className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider font-mono">Income Tax Bands (£)</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Basic Rate Limit</Label>
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
                                className="h-9 rounded-lg font-mono text-xs border-border/40"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Higher Rate Limit</Label>
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
                                className="h-9 rounded-lg font-mono text-xs border-border/40"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Basic Rate %</Label>
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
                                className="h-9 rounded-lg font-mono text-xs border-border/40"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Higher Rate %</Label>
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
                                className="h-9 rounded-lg font-mono text-xs border-border/40"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Additional Rate %</Label>
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
                                className="h-9 rounded-lg font-mono text-xs border-border/40"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 pt-3 border-t border-border/20">
                          <h4 className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider font-mono">National Insurance Bands (£)</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Lower Threshold</Label>
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
                                className="h-9 rounded-lg font-mono text-xs border-border/40"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Upper Threshold</Label>
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
                                className="h-9 rounded-lg font-mono text-xs border-border/40"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Main Rate %</Label>
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
                                className="h-9 rounded-lg font-mono text-xs border-border/40"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Upper Rate %</Label>
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
                                className="h-9 rounded-lg font-mono text-xs border-border/40"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 pt-3 border-t border-border/20">
                          <h4 className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider font-mono">Student Loan Thresholds (£)</h4>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                            {(Object.keys(draftTaxConfig.studentLoanThresholds) as Array<keyof typeof draftTaxConfig.studentLoanThresholds>).map((plan) => {
                              if (plan === 'none') return null;
                              return (
                                <div key={plan} className="space-y-1">
                                  <Label className="text-xs text-muted-foreground uppercase">{plan}</Label>
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
                                    className="h-9 rounded-lg font-mono text-xs border-border/40"
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
                  <div className="rounded-lg border border-border/30 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedSection(expandedSection === 'recurring' ? 'none' : 'recurring')}
                      className="w-full flex items-center justify-between p-2.5 bg-muted/10 text-xs font-semibold hover:bg-muted/20 transition-colors text-left font-mono"
                    >
                      <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-primary" /> Recurring Bill Templates</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedSection === 'recurring' ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedSection === 'recurring' && (
                      <div className="p-4 bg-background/30 border-t border-border/20 space-y-4 text-xs">
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {draftRecurringTemplates.map((template, idx) => (
                            <div key={idx} className="flex flex-col gap-2 p-2.5 rounded-lg border border-border/30 bg-card/50 relative group">
                              <button
                                type="button"
                                onClick={() => setDraftRecurringTemplates(draftRecurringTemplates.filter((_, i) => i !== idx))}
                                className="absolute top-2 right-2 text-destructive hover:text-destructive opacity-60 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <div className="grid grid-cols-12 gap-2 pr-6">
                                <div className="col-span-2 space-y-1">
                                  <Label className="text-xs text-muted-foreground">Emoji</Label>
                                  <Input
                                    value={template.emoji}
                                    onChange={(e) => {
                                      const updated = [...draftRecurringTemplates];
                                      updated[idx] = { ...template, emoji: e.target.value };
                                      setDraftRecurringTemplates(updated);
                                    }}
                                    className="h-8 text-center rounded-lg text-xs p-1 border-border/40"
                                  />
                                </div>
                                <div className="col-span-5 space-y-1">
                                  <Label className="text-xs text-muted-foreground">Name</Label>
                                  <Input
                                    value={template.name}
                                    onChange={(e) => {
                                      const updated = [...draftRecurringTemplates];
                                      updated[idx] = { ...template, name: e.target.value };
                                      setDraftRecurringTemplates(updated);
                                    }}
                                    className="h-8 rounded-lg text-xs border-border/40"
                                  />
                                </div>
                                <div className="col-span-5 space-y-1">
                                  <Label className="text-xs text-muted-foreground">Category</Label>
                                  <Input
                                    value={template.category}
                                    onChange={(e) => {
                                      const updated = [...draftRecurringTemplates];
                                      updated[idx] = { ...template, category: e.target.value };
                                      setDraftRecurringTemplates(updated);
                                    }}
                                    className="h-8 rounded-lg text-xs border-border/40"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Amount (£)</Label>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={formatNumberInput(template.defaultAmount)}
                                    onChange={(e) => {
                                      const updated = [...draftRecurringTemplates];
                                      updated[idx] = { ...template, defaultAmount: parseFormattedFloat(e.target.value) || 0 };
                                      setDraftRecurringTemplates(updated);
                                    }}
                                    className="h-8 rounded-lg text-xs font-mono border-border/40"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Tag</Label>
                                  <Input
                                    value={template.tag}
                                    onChange={(e) => {
                                      const updated = [...draftRecurringTemplates];
                                      updated[idx] = { ...template, tag: e.target.value.toUpperCase() };
                                      setDraftRecurringTemplates(updated);
                                    }}
                                    className="h-8 rounded-lg text-xs font-mono uppercase border-border/40"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Frequency</Label>
                                  <select
                                    value={template.frequency}
                                    onChange={(e) => {
                                      const updated = [...draftRecurringTemplates];
                                      updated[idx] = { ...template, frequency: e.target.value as RecurringTemplate['frequency'] };
                                      setDraftRecurringTemplates(updated);
                                    }}
                                    className="flex w-full rounded-lg border border-border/40 bg-background/50 h-8 px-2 text-xs text-foreground focus:outline-none font-mono"
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
                          className="w-full h-8 text-xs rounded-lg border-dashed border-border/40 font-mono"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add Custom Template
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Item 3: Credit Bureaus */}
                  <div className="rounded-lg border border-border/30 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedSection(expandedSection === 'bureaus' ? 'none' : 'bureaus')}
                      className="w-full flex items-center justify-between p-2.5 bg-muted/10 text-xs font-semibold hover:bg-muted/20 transition-colors text-left font-mono"
                    >
                      <span className="flex items-center gap-2"><ShieldAlert className="w-3.5 h-3.5 text-primary" /> Credit Bureau Gauges</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedSection === 'bureaus' ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedSection === 'bureaus' && (
                      <div className="p-4 bg-background/30 border-t border-border/20 space-y-4 text-xs">
                        <div className="space-y-3">
                          {draftCreditBureaus.map((bureau, idx) => (
                            <div key={bureau.key} className="flex flex-col gap-2 p-2.5 rounded-lg border border-border/30 bg-card/50">
                              <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
                                {bureau.emoji} {bureau.label} Config
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Label</Label>
                                  <Input
                                    value={bureau.label}
                                    onChange={(e) => {
                                      const updated = [...draftCreditBureaus];
                                      updated[idx] = { ...bureau, label: e.target.value };
                                      setDraftCreditBureaus(updated);
                                    }}
                                    className="h-8 rounded-lg text-xs border-border/40"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Max Score</Label>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={formatNumberInput(bureau.maxScore)}
                                    onChange={(e) => {
                                      const updated = [...draftCreditBureaus];
                                      updated[idx] = { ...bureau, maxScore: parseFormattedInt(e.target.value) || 1000 };
                                      setDraftCreditBureaus(updated);
                                    }}
                                    className="h-8 rounded-lg text-xs font-mono border-border/40"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Emoji</Label>
                                  <Input
                                    value={bureau.emoji}
                                    onChange={(e) => {
                                      const updated = [...draftCreditBureaus];
                                      updated[idx] = { ...bureau, emoji: e.target.value };
                                      setDraftCreditBureaus(updated);
                                    }}
                                    className="h-8 rounded-lg text-xs text-center border-border/40"
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
                  <div className="rounded-lg border border-border/30 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedSection(expandedSection === 'savings' ? 'none' : 'savings')}
                      className="w-full flex items-center justify-between p-2.5 bg-muted/10 text-xs font-semibold hover:bg-muted/20 transition-colors text-left font-mono"
                    >
                      <span className="flex items-center gap-2"><Briefcase className="w-3.5 h-3.5 text-primary" /> Active Savings Types</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedSection === 'savings' ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedSection === 'savings' && (
                      <div className="p-4 bg-background/30 border-t border-border/20 space-y-3 text-xs">
                        <p className="text-xs text-muted-foreground mb-2">Enable or disable specific savings vehicles inside your budget and wealth trackers.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                          {SAVINGS_PRESETS.map((preset) => {
                            const key = preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                            const isChecked = draftActiveSavingsTypes.includes(key);
                            return (
                              <label key={key} className="flex items-center gap-2 p-2 rounded-lg border border-border/30 bg-card/45 hover:bg-muted/10 cursor-pointer select-none text-xs font-mono">
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
                                  className="h-3.5 w-3.5 rounded border-border/40 text-primary focus:ring-primary/30 cursor-pointer"
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

            <DialogFooter className="shrink-0 gap-2 sm:gap-3 px-4 sm:px-6 py-3 border-t border-border/40 bg-background/95">
              <Button
                type="button"
                variant="outline"
                onClick={handleResetDefaults}
                className="w-full sm:w-auto rounded-lg h-9 gap-1.5 border-border/40 text-xs font-mono"
                disabled={savingDb}
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span className="sm:hidden">Reset</span>
                <span className="hidden sm:inline">Reset to defaults</span>
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto rounded-lg h-9 gap-1.5 px-5 bg-primary text-primary-foreground text-xs font-mono"
                disabled={savingDb}
              >
                {savingDb ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
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
                "py-2 text-xs font-medium transition-all text-center rounded-xl",
                isSelected
                  ? "bg-[hsl(var(--chart-3))] text-white font-semibold shadow-sm"
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

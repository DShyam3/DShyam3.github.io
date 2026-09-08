import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
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
import { consumeTrueLayerOAuthState } from './truelayer-oauth';
import { useFinanceTotals } from './useFinanceTotals';
import { SurfaceHero } from './components/SurfaceHero';
import { ProfileAvatar } from './components/ProfileAvatar';
import { NetWorthTrend } from './components/NetWorthTrend';
import { Loader2 } from 'lucide-react';
import type {
  BudgetItem,
  InvestmentHolding,
  MockTransaction,
  RecurringBill,
} from '@/features/finance/finance-types';
const RecurringsTab = lazy(() => import('@/features/finance/tabs/RecurringsTab').then(m => ({ default: m.RecurringsTab })));
const TimeSpentTab = lazy(() => import('@/features/finance/tabs/TimeSpentTab').then(m => ({ default: m.TimeSpentTab })));
const TransactionsTab = lazy(() => import('@/features/finance/tabs/TransactionsTab').then(m => ({ default: m.TransactionsTab })));
const InvestmentsTab = lazy(() => import('@/features/finance/tabs/InvestmentsTab').then(m => ({ default: m.InvestmentsTab })));
import { AddRecurringDialog } from '@/features/finance/dialogs/AddRecurringDialog';
import { EditRecurringDialog } from '@/features/finance/dialogs/EditRecurringDialog';
import { TaxIncomeSettingsDialog } from '@/features/finance/dialogs/TaxIncomeSettingsDialog';
import { formatGBP } from '@/features/finance/utils/calculations';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';

/**
 * The finance shell. Data comes from `FinanceDataProvider` below rather than
 * from local state, so the five surfaces can be split out of this file in 7.2c
 * without threading two dozen props through each of them.
 */
function FinanceView() {
  const {
    bankAccounts,
    budgetCategories,
    creditScores,
    fetchSupabaseData,
    goals,
    investmentHoldings,
    loadingDb,
    hasLoaded,
    memberships,
    mockTransactions,
    profileId,
    recurringTemplates,
    recurrings,
    saveDataToSupabase,
    setBankAccounts,
    setBudgetCategories,
    setInvestmentHoldings,
    setMockTransactions,
    setProfileId,
    setRecurrings,
    setTimeSpentInputs,
    settings,
    timeSpentInputs,
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

  // ==========================================
  // SYNC & FETCH EFFECT
  // ==========================================

  // Fetch all finance keys on mount
  const callbackProcessed = useRef(false);

  const handleTrueLayerCallback = async (code: string, state: string | null) => {
    if (callbackProcessed.current) return;
    callbackProcessed.current = true;
    setIsConnectingTrueLayer(true);
    try {
      if (!consumeTrueLayerOAuthState(window.sessionStorage, state)) {
        throw new Error('This bank-link request has expired or did not match. Please start again.');
      }

      const redirectUri = `${window.location.origin}/finance`;
      await callTrueLayerEdgeFunction('exchange_code', {
        code: code,
        redirect_uri: redirectUri,
        state,
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
      handleTrueLayerCallback(code, urlParams.get('state'));
    } else {
      checkTrueLayerConnection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Fetch UK Bank Holidays dynamically

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
  // HANDLERS: GOALS CRUD
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
  // HANDLERS: CREDIT SCORES
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
  // HANDLERS: HOLIDAY TRACKER (TAX & INCOME TAB)
  // ==========================================

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
          <SelectTrigger className="h-9 w-auto gap-2 rounded-lg border border-border/40 bg-background/60 px-3 text-sm font-mono shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {profiles.map(p => (
              <SelectItem key={p.id} value={p.id} className="text-sm font-sans">
                <span className="flex items-center gap-2">
                  {/* `md` so the memoji reads as a face rather than a smudge —
                      the trigger mirrors this row, so it is sized here. */}
                  <ProfileAvatar profile={p} size="md" />
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

      {/* DIALOG: Tax & Income Settings */}
      <TaxIncomeSettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        onOpenBenefits={() => setIsBenefitsDialogOpen(true)}
      />

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

      {deleteDialog}
    </>
  );
}

export default function Finance() {
  return (
    <FinanceDataProvider>
      <FinanceView />
    </FinanceDataProvider>
  );
}

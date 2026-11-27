import { toISODate } from '@/lib/finance/dates';
import { memo, Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { format } from 'date-fns';
import { SPRING_PILL } from '@/theme/motion';
import { Navigate, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { FinanceDataProvider, useFinanceData } from './FinanceDataContext';
import { useFinanceTarget } from './FinanceSession';
import { useCoalescedSave } from './useCoalescedSave';
import { prefersSavedData, whenIdle } from '@/lib/idle';
import {
  AccountsSurface,
  BudgetSurface,
  buildAddedRecurringBill,
  CashFlowSurface,
  DashboardSurface,
  DebtsSurface,
  draftFromCandidate,
  ForecastSurface,
  GoalsSurface,
  INITIAL_NEW_RECURRING,
  InvestmentsTab,
  mergeImportedHoldingsAndActivities,
  MoneyHubSurface,
  pathForSurface,
  pathForTab,
  RecurringsTab,
  RetirementSurface,
  ScenariosSurface,
  sectionChunks,
  showsSurfaceHero,
  StudentLoanSurface,
  surfaceForTab,
  SURFACES,
  TAB_LABELS,
  tabFromPath,
  TaxCalculatorSurface,
  TaxIncomeSurface,
  TransactionsTab,
  TransfersSurface,
  warmFinanceSections,
  type TabKey,
} from './finance-lazy-surfaces';
import { useTrueLayer } from './useTrueLayer';
import { announceTrueLayerLink, consumeTrueLayerConnectIntent, consumeTrueLayerOAuthState, TRUE_LAYER_CONNECT_PARAM } from './truelayer-oauth';
import { useSpendingLedger } from './useSpendingLedger';
import { useRecurringEvidence } from './useRecurringEvidence';
import { detectRecurringPayments, candidateMatchesBill, isRecurringPaidForPeriod, assignPaidPeriod, tickRecurring, untickRecurring, payRecurringEarly, coverageAfterEdit, type RecurringCandidate } from '@/lib/finance/recurring-detection';
import { useFinanceTotals } from './useFinanceTotals';
import { PaydaySummary, paydayCountdown } from './components/PaydaySummary';
import { SurfaceHero } from './components/SurfaceHero';
import { ProfileAvatar } from './components/ProfileAvatar';
import { NetWorthTrend } from './components/NetWorthTrend';
import { FinanceSectionBoundary, FinanceSectionLoading } from './components/FinanceSectionBoundary';
import { Button } from '@/components/ui/button';
import { coversAllProfileData, describeTables, isSharedTable } from './unloaded-tables';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useHiddenFigures } from './useHiddenFigures';
import type {
  BudgetCategory,
  InvestmentHolding,
  MockTransaction,
  RecurringBill,
} from '@/features/finance/finance-types';
import { AddRecurringDialog } from '@/features/finance/dialogs/AddRecurringDialog';
import { EditRecurringDialog } from '@/features/finance/dialogs/EditRecurringDialog';
import { TaxIncomeSettingsDialog } from '@/features/finance/dialogs/TaxIncomeSettingsDialog';
import { formatGBP } from '@/features/finance/utils/calculations';
import { BankSyncStatus } from '@/features/finance/components/BankSyncStatus';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import type {
  ImportedInvestmentActivity,
  ImportedInvestmentHolding,
  InvestmentImportProvider,
} from '@/lib/finance';

/**
 * The finance shell. Data comes from `FinanceDataProvider` below rather than
 * from local state, so the five surfaces can be split out of this file in 7.2c
 * without threading two dozen props through each of them.
 */
function FinanceView() {
  const prefersReducedMotion = useReducedMotion();
  const {
    bankAccounts,
    budgetCategories,
    fetchSupabaseData,
    goals,
    investmentActivities,
    investmentHoldings,
    loadingDb,
    hasLoaded,
    mockTransactions,
    profileId,
    profileLoadState,
    profileLoadError,
    retryProfiles,
    unloaded,
    retryUnloaded,
    recurringTemplates,
    allRecurrings: recurrings,
    recurringDataReady,
    saveDataToSupabase,
    currentLoadGenerations,
    registerBeforeLoadFlush,
    refreshIfStale,
    setBankAccounts,
    setBudgetCategories,
    setInvestmentHoldings,
    setInvestmentActivities,
    setMockTransactions,
    setProfileId,
    setRecurrings,
    settings,
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
  const figures = useHiddenFigures();
  // The not-loaded notice disappears once a retry reads every table, taking
  // its focused button with it. Focus then goes to the notice's slot, which
  // stays mounted, rather than dropping to the page body.
  const unloadedSlotRef = useRef<HTMLDivElement>(null);
  const unloadedRetryFocusedRef = useRef(false);
  const [unloadedCleared, setUnloadedCleared] = useState(false);
  const unloadedCount = unloaded.length;
  useEffect(() => {
    if (unloadedCount > 0) {
      setUnloadedCleared(false);
      return;
    }
    if (!unloadedRetryFocusedRef.current) return;
    unloadedRetryFocusedRef.current = false;
    setUnloadedCleared(true);
    unloadedSlotRef.current?.focus();
  }, [unloadedCount]);
  // Named only with more than one profile, and only when something listed is
  // that profile's own: tax rates and other shared tables belong to none.
  const unloadedProfileName = profiles.length > 1 && unloaded.some(name => !isSharedTable(name))
    ? profiles.find(p => p.id === profileId)?.name ?? 'this profile'
    : null;
  const nothingLoaded = coversAllProfileData(unloaded);
  const activeSections = (SURFACES.find(su => su.key === activeSurface)?.tabs ?? []) as readonly TabKey[];

  // The provider outlives this view (FinanceSession), so a return visit finds
  // its rows already loaded. Re-read them behind the ones on screen if they
  // are older than the query cache's staleTime, as the rest of the site does.
  useEffect(() => {
    refreshIfStale(10 * 60_000);
    // Mount only: a return visit, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the rows are in, prefetch every other section's chunk on idle so
  // switching sections never waits on network without saturating the initial paint.
  useEffect(() => {
    if (!hasLoaded || prefersSavedData()) return;
    return whenIdle(warmFinanceSections, 1500);
  }, [hasLoaded]);

  const [cfCustomStart, setCfCustomStart] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-01-01`;
  });

  const { isAdmin, isAuthLoading } = useAuth();
  const { toast } = useToast();
  const { askDelete, deleteDialog } = useDeleteConfirm();

  // The loads a list was built against are taken when it is scheduled, not
  // when it flushes: a refresh can land inside the coalesce window.
  const saveTransactionsSoon = useCoalescedSave<{ list: MockTransaction[]; builtAt: ReturnType<typeof currentLoadGenerations> }>(
    ({ list, builtAt }) => saveDataToSupabase('transactions', list, builtAt),
    { registerFlush: registerBeforeLoadFlush },
  );

  // Connect/sync lives in a hook because both Home and Wealth offer it (7.2c-i).
  const {
    trueLayerStatus,
    isSyncingTrueLayer,
    syncAvailableAt,
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
  const [newRecurring, setNewRecurring] = useState<Omit<RecurringBill, 'id' | 'amount'> & { amount: number | ''; }>(() => ({
    ...INITIAL_NEW_RECURRING,
    dueMonth: new Date().getMonth() + 1,
  }));

  const [recurringBusy, setRecurringBusy] = useState(false);
  const recurringSaveLock = useRef(false);
  const recurringProfile = useRef(profileId);
  recurringProfile.current = profileId;
  const { ledger, exclusionsUnreliable } = useSpendingLedger();
  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const detectedRecurrings = useMemo(
    () => (activeTab === 'recurrings' && recurringDataReady && !exclusionsUnreliable)
      ? detectRecurringPayments(ledger, todayISO)
      : [],
    [activeTab, ledger, todayISO, recurringDataReady, exclusionsUnreliable],
  );
  const recurringCandidates = detectedRecurrings.filter(c => !recurrings.some(b => candidateMatchesBill(c, b)));
  // Scans the whole ledger once per bill, so it runs only for the tab that
  // shows it, and not again on every keystroke in the recurring dialogs.
  const paymentEvidence = useRecurringEvidence(activeTab === 'recurrings');
  useEffect(() => {
    setIsAddRecurringOpen(false);
    setIsEditRecurringOpen(false);
    setActiveRecurring(null);
  }, [profileId]);

  const reviewRecurringCandidate = (candidate: RecurringCandidate) => {
    setNewRecurring(draftFromCandidate(candidate));
    setAddRecTemplate('scratch');
    setIsAddRecurringOpen(true);
  };

  // A review records an obligation, never another debit against a bank balance.
  const persistRecurringReview = async (updated: RecurringBill[], budget?: BudgetCategory[]): Promise<boolean> => {
    if (recurringSaveLock.current) return false;
    if (!recurringDataReady) {
      toast({ title: 'Not saved', description: 'Recurring bills and transactions must finish loading before saving. Try reloading if the load failed.', variant: 'destructive' });
      return false;
    }
    recurringSaveLock.current = true;
    setRecurringBusy(true);
    const owner = profileId;
    try {
      if (budget) {
        if (!(await saveDataToSupabase('budget', budget)) || recurringProfile.current !== owner) return false;
        setBudgetCategories(budget);
      }
      const saved = await saveDataToSupabase('recurrings', updated);
      if (!saved || recurringProfile.current !== owner) return false;
      setRecurrings(updated);
      return true;
    } finally {
      recurringSaveLock.current = false;
      setRecurringBusy(false);
    }
  };
  const dismissRecurringCandidate = async (candidate: RecurringCandidate) => {
    if (recurrings.some(b => candidateMatchesBill(candidate, b))) return;
    await persistRecurringReview([...recurrings, {
      ...draftFromCandidate(candidate), id: crypto.randomUUID(), status: 'dismissed', lastPaidDate: undefined,
    }]);
  };

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
      if (!consumeTrueLayerOAuthState(window.localStorage, state)) {
        throw new Error('This bank-link request has expired or did not match. Please start again.');
      }

      const redirectUri = `${window.location.origin}/finance`;
      await callTrueLayerEdgeFunction('exchange_code', {
        code: code,
        redirect_uri: redirectUri,
        state,
      });

      // Before the sync, which can be a long history import: a tab closed
      // partway through still leaves the starting tab knowing the bank linked.
      announceTrueLayerLink('linked');
      toast({
        title: "Bank Linked Successfully",
        description: "Your bank has been connected. Initializing transaction sync...",
      });

      window.history.replaceState({}, document.title, window.location.pathname);
      await checkTrueLayerConnection();
      await syncTrueLayer();
      announceTrueLayerLink('synced');
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
    } else if (urlParams.has(TRUE_LAYER_CONNECT_PARAM)) {
      // A tab opened by "Connect Another Bank" (useTrueLayer). The parameter
      // goes through the router, so no later navigation brings it back, and
      // the link starts only when a tap in this browser asked for it.
      navigate(window.location.pathname, { replace: true });
      if (consumeTrueLayerConnectIntent(window.localStorage)) void connectTrueLayer();
      else void checkTrueLayerConnection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Fetch UK Bank Holidays dynamically

  // Scroll to current month in holiday tracker when tax-income tab is selected
  useEffect(() => {
    if (activeTab !== 'tax-income') return;
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

  const handleAddHolding = async (holding: Omit<InvestmentHolding, 'id'>) => {
    const created: InvestmentHolding = {
      ...holding,
      id: 'h_' + Date.now()
    };
    const updated = [...investmentHoldings, created];
    setInvestmentHoldings(updated);
    if (await saveDataToSupabase('investments', updated)) {
      toast({ title: 'Asset Added', description: `Successfully added ${created.name}.` });
    } else {
      void fetchSupabaseData();
    }
  };

  const handleEditHolding = async (holding: InvestmentHolding) => {
    const updated = investmentHoldings.map(h => h.id === holding.id ? holding : h);
    setInvestmentHoldings(updated);
    if (await saveDataToSupabase('investments', updated)) {
      toast({ title: 'Asset Updated', description: `Successfully updated ${holding.name}.` });
    } else {
      void fetchSupabaseData();
    }
  };

  const performDeleteHolding = async (id: string) => {
    const deleted = investmentHoldings.find(h => h.id === id);
    const updated = investmentHoldings.filter(h => h.id !== id);
    setInvestmentHoldings(updated);
    if (deleted && await saveDataToSupabase('investments', updated)) {
      toast({ title: 'Asset Deleted', description: `Removed ${deleted.name} from portfolio.` });
    } else if (deleted) {
      void fetchSupabaseData();
    }
  };

  const handleDeleteHolding = (id: string) =>
    askDelete({
      name: investmentHoldings.find(h => h.id === id)?.name,
      onConfirm: () => { void performDeleteHolding(id); },
    });

  const handleImportHoldings = async (
    imported: ImportedInvestmentHolding[],
    importedActivities: ImportedInvestmentActivity[],
    accountId: string,
    provider: InvestmentImportProvider,
  ) => {
    const { updated, importedHistory, nextActivities, created, refreshed } = mergeImportedHoldingsAndActivities(
      investmentHoldings,
      investmentActivities,
      imported,
      importedActivities,
      accountId,
      provider,
    );

    setInvestmentHoldings(updated);
    if (await saveDataToSupabase('investments', updated)) {
      if (importedHistory.length > 0 && !(await saveDataToSupabase('investment-activities', importedHistory))) {
        void fetchSupabaseData();
        return false;
      }
      if (importedHistory.length > 0) setInvestmentActivities(nextActivities);
      const action = [created ? `${created} added` : '', refreshed ? `${refreshed} updated` : ''].filter(Boolean).join(', ');
      toast({
        title: 'Investment CSV imported',
        description: `${action || `${imported.length} saved`} from ${provider === 'kraken' ? 'Kraken' : 'Trading 212'}${importedHistory.length ? `; ${importedHistory.length} trade record${importedHistory.length === 1 ? '' : 's'} saved` : ''}. Review any unknown price facts.`,
      });
      return true;
    }
    void fetchSupabaseData();
    return false;
  };
  // ==========================================
  // HANDLERS: CREDIT SCORES
  // ==========================================
  // ==========================================
  // HANDLERS: RECURRINGS CRUD
  // ==========================================

  const handleAddRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recurringSaveLock.current || !newRecurring.name.trim() || newRecurring.amount === '' || !Number.isFinite(newRecurring.amount) || newRecurring.amount <= 0) return;
    if (newRecurring.lastPaidDate && newRecurring.lastPaidDate > todayISO) return;
    if (newRecurring.detectionKey && recurrings.some(b => b.detectionKey === newRecurring.detectionKey)) return;

    const { created, updatedBudget, budgetChanged } = buildAddedRecurringBill(
      { ...newRecurring, amount: newRecurring.amount },
      budgetCategories,
      recurringTemplates,
      todayISO,
    );

    const updated = [...recurrings, created];
    if (!(await persistRecurringReview(updated, budgetChanged ? updatedBudget : undefined))) return;
    setIsAddRecurringOpen(false);
    setNewRecurring({ ...INITIAL_NEW_RECURRING, dueMonth: new Date().getMonth() + 1 });
    toast({ title: 'Recurring Added', description: `Successfully added recurring bill "${created.name}".` });
  };

  const handleEditRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRecurring || !activeRecurring.name.trim() || !Number.isFinite(activeRecurring.amount) || activeRecurring.amount <= 0) return;
    if (activeRecurring.lastPaidDate && activeRecurring.lastPaidDate > todayISO) return;
    const previous = recurrings.find(bill => bill.id === activeRecurring.id);
    const scheduled: RecurringBill = { ...activeRecurring, dueMonth: activeRecurring.dueMonth || 1 };
    // The covered period is a due date under the old schedule, so an edit maps
    // it onto the new one (see coverageAfterEdit). A bill with no stored
    // original works it out from the date alone, without early credit.
    const paidForDueDate = previous
      ? coverageAfterEdit(previous, scheduled)
      : (scheduled.lastPaidDate ? assignPaidPeriod(scheduled, scheduled.lastPaidDate) : undefined);
    const normalizedRecurring: RecurringBill = {
      ...scheduled,
      paidForDueDate,
      // The tick is the owner's: a new payment date re-decides it. A new
      // frequency rebuilds the covered period but never revives an untick
      // (a weekly bill reads Paid from lastPaidDate alone). A due-day change
      // only moves the period, which the display re-checks.
      isPaid: scheduled.lastPaidDate !== previous?.lastPaidDate
        ? isRecurringPaidForPeriod({ ...scheduled, paidForDueDate }, todayISO)
        : scheduled.frequency !== previous?.frequency
          ? activeRecurring.isPaid && isRecurringPaidForPeriod({ ...scheduled, paidForDueDate }, todayISO)
          : activeRecurring.isPaid,
      provider: activeRecurring.provider?.trim() || undefined,
    };
    if (!(await persistRecurringReview(recurrings.map(r => r.id === activeRecurring.id ? normalizedRecurring : r)))) return;
    setIsEditRecurringOpen(false);
    setActiveRecurring(null);
    toast({ title: 'Recurring Bill Updated', description: 'Bill details saved.' });
  };

  const performDeleteRecurring = async (id: string) => {
    if (await persistRecurringReview(recurrings.filter(r => r.id !== id))) {
      toast({ title: 'Recurring Bill Deleted', description: 'Recurring bill removed.' });
    }
  };

  const handleDeleteRecurring = (id: string) =>
    askDelete({
      name: recurrings.find(r => r.id === id)?.name,
      onConfirm: () => { void performDeleteRecurring(id); },
    });

  // The dismissed row is what hides the suggestion, so removing it is an undo,
  // not a delete: no confirm, and "Not recurring" puts it straight back.
  const undismissRecurring = async (id: string) => {
    if (await persistRecurringReview(recurrings.filter(r => r.id !== id))) {
      toast({ title: 'Back in suggestions', description: 'Review it or mark it not recurring again.' });
    }
  };

  const toggleRecurringPaid = (id: string) => {
    // Bank evidence stays separate: clearing a tick does not erase lastPaidDate.
    void persistRecurringReview(recurrings.map(r => r.id === id ? {
      ...r,
      ...(r.isPaid ? untickRecurring(r, todayISO) : tickRecurring(r, todayISO)),
    } : r));
  };

  const recordEarlyPayment = (id: string) => {
    const bill = recurrings.find(r => r.id === id);
    if (!bill) return;
    const fields = payRecurringEarly(bill, todayISO);
    if (!fields) return;
    void persistRecurringReview(recurrings.map(r => r.id === id ? { ...r, ...fields } : r));
  };
  // ==========================================
  // HANDLERS: HOLIDAY TRACKER (TAX & INCOME TAB)
  // ==========================================

  // Keep deep links intact while Supabase restores the saved session.
  if (isAuthLoading) {
    return (
      <AppShell title="Finance" subtitle="Income & tax">
        <div role="status" className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          Loading finance…
        </div>
      </AppShell>
    );
  }

  // Redirect only after authentication has been resolved.
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
              <p className="font-sans text-lg font-bold tabular-nums">{paydayCountdown(nextPayday?.daysRemaining ?? 0)}</p>
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
                <NetWorthTrend points={netWorthHistory} today={toISODate(todayDateObj)} unavailable={unloaded.includes('net_worth_history')} />
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
          detail={`${formatGBP(monthlyIncome)} a month after tax, pension and student loan, modelled from your salary settings`}
          // Tax & Income shows the package in full just below, so this slot
          // carries payday. The other Income sections draw their own hero.
          aside={<PaydaySummary settings={settings} nextPayday={nextPayday} />}
        />
      );
    }
    return null;
  })();

  /* Handed to AppShell's toolbar slot, so the surface and section navs stay
     pinned while the surface underneath scrolls. */
  const toolbar = (
    <div className="finance-navigation flex flex-col">
    {/* Primary navigation: the five surfaces. */}
    <div className="flex flex-wrap items-center justify-between border-b border-border/50 px-4 md:px-0 gap-x-4">
      <nav aria-label="Finance" className="finance-surface-nav flex flex-wrap items-center justify-start gap-2 md:gap-4 py-3 flex-1">
        {SURFACES.map((surface) => {
          const isActive = activeSurface === surface.key;
          return (
            <div key={surface.key} className="flex items-center gap-2 md:gap-4">
              <button
                onClick={() => navigate(pathForSurface(surface.key))}
                onPointerEnter={() => sectionChunks[surface.tabs[0]]?.()}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'nav-link relative py-1 text-xs whitespace-nowrap flex items-center gap-1.5',
                  isActive && 'nav-link-active'
                )}
              >
                <DotMatrixText text={surface.label.toUpperCase()} size="xs" />
              </button>
            </div>
          );
        })}
      </nav>
      {/* A row of its own on phones, so the surface nav keeps the full width
          rather than stacking one link per line beside these. */}
      <div className="flex w-full items-center gap-2 pb-3 empty:hidden sm:w-auto sm:pb-0">
        {figures.supported && (
          <Button variant="ghost" size="sm" onClick={figures.toggle} className="shrink-0 text-xs">
            {figures.hidden ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
            <DotMatrixText text={figures.hidden ? 'Show figures' : 'Hide figures'} size="ui" wrap={false} />
          </Button>
        )}
        {loadingDb && (
          <span className="text-xs text-muted-foreground animate-pulse flex items-center gap-1 shrink-0 pb-1 font-sans">
            <Loader2 className="h-3 w-3 animate-spin text-primary" /> <span className="sr-only sm:not-sr-only">syncing...</span>
          </span>
        )}
        {profiles.length > 1 && (
          <Select value={profileId ?? undefined} onValueChange={setProfileId}>
            <SelectTrigger className="ml-auto h-9 w-auto gap-2 rounded-lg border border-border/40 bg-background/60 px-3 text-sm font-mono shrink-0">
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
      </div>
    </div>

    {/* Secondary navigation: sections within a surface. Home has one
        section, so it renders no second row. */}
    {activeSections.length > 1 && (
      <nav aria-label="Finance sections" className="flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-x-5 py-3 px-4 md:px-0 border-b border-border/30">
        {activeSections.map(tab => {
          const isCurrent = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              onPointerEnter={() => sectionChunks[tab]?.()}
              aria-current={isCurrent ? 'page' : undefined}
              className={cn(
                'relative pb-1 text-xs whitespace-nowrap font-sans transition-colors',
                isCurrent
                  ? 'text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {TAB_LABELS[tab]}
              {isCurrent && (
                <motion.span
                  layoutId="finance-section-underline"
                  transition={prefersReducedMotion ? { duration: 0 } : SPRING_PILL}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </nav>
    )}
    </div>
  );

  return (
    <>
      <AppShell
        title="Finance"
        subtitle="Income & tax"
        toolbar={toolbar}
      >
        {/* The shell owns the scroll container and the fluid padding; this
            just stacks the sections it hands us. */}
        {/* Each section is its own chunk, so opening Home no longer downloads
            the charting and dialog code every other section needs. The
            fallback is deliberately bare: the shell, nav and footer are
            already painted, so only the middle is waiting. */}
        <div className="flex flex-col py-6 sm:py-8 w-full min-w-0">
          {!profileId ? (
            <div role={profileLoadState === 'error' ? 'alert' : 'status'} className="py-16 text-center text-sm font-sans space-y-3">
              <p className="font-semibold">{profileLoadState === 'error' ? 'Finance could not load' : 'Loading finance profiles…'}</p>
              {profileLoadError && <p className="text-muted-foreground">{profileLoadError}</p>}
              {profileLoadState === 'error' && <Button variant="outline" onClick={() => { void retryProfiles(); }}>Try again</Button>}
            </div>
          ) : <>
          {/* Tables that failed to load for this profile are shown empty
              rather than as the previous profile's rows, so every figure
              built from them is short until a load reads them. */}
          {/* The slot stays mounted: focus lands here when a retry reads
              everything and the notice (with its focused button) goes. */}
          <div ref={unloadedSlotRef} tabIndex={-1} className="outline-none">
            <p role="status" className="sr-only">{unloadedCleared ? 'Finance data loaded.' : ''}</p>
            {unloaded.length > 0 && (
              <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 font-sans text-sm">
                <p role="alert" className="min-w-0 flex-1 text-pretty">
                  <span className="font-semibold">
                    {nothingLoaded
                      ? `Finance data${unloadedProfileName ? ` for ${unloadedProfileName}` : ''} did not load.`
                      : `Not loaded${unloadedProfileName ? ` for ${unloadedProfileName}` : ''}: ${describeTables(unloaded)}.`}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    {nothingLoaded
                      ? 'Figures are hidden until it loads.'
                      : 'Figures that use them are incomplete until they load.'}
                  </span>
                </p>
                {/* aria-disabled, not disabled: a disabled button loses focus,
                    which would drop it to the page body mid-retry. The label
                    stays put so the retry is not announced twice. */}
                <Button
                  variant="outline"
                  aria-disabled={loadingDb}
                  aria-busy={loadingDb}
                  onFocus={() => { unloadedRetryFocusedRef.current = true; }}
                  onBlur={() => { unloadedRetryFocusedRef.current = false; }}
                  onClick={retryUnloaded}
                  className="shrink-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-card/80 aria-disabled:hover:text-foreground"
                >
                  {loadingDb && <Loader2 aria-hidden="true" className="animate-spin" />}
                  Try again
                </Button>
              </div>
            )}
          </div>
          {/* After a load that threw on a switch, nothing on screen is this
              profile's: the notice stands alone until a load lands. */}
          {!nothingLoaded && showsSurfaceHero(activeTab) ? surfaceHero : null}

          {!nothingLoaded && <FinanceSectionBoundary>
            <Suspense fallback={<FinanceSectionLoading />}>
              {activeTab === 'dashboard' && <DashboardSurface toggleRecurringPaid={toggleRecurringPaid} />}
              {activeTab === 'tax-income' && (
                <TaxIncomeSurface
                  setIsSettingsOpen={setIsSettingsOpen}
                  isBenefitsDialogOpen={isBenefitsDialogOpen}
                  setIsBenefitsDialogOpen={setIsBenefitsDialogOpen}
                />
              )}
              {activeTab === 'budget' && <BudgetSurface totalSpent={totalSpent} />}
              {activeTab === 'cash-flow' && (
                <CashFlowSurface breakdownRates={breakdownRates} todayDateObj={todayDateObj} />
              )}
              {activeTab === 'forecast' && <ForecastSurface />}
              {activeTab === 'goals' && <GoalsSurface />}
              {activeTab === 'scenarios' && <ScenariosSurface />}
              {activeTab === 'retirement' && <RetirementSurface />}
              {activeTab === 'transfers' && <TransfersSurface />}
              {activeTab === 'accounts' && <AccountsSurface />}
              {activeTab === 'debts' && <DebtsSurface />}
              {activeTab === 'student-loan' && <StudentLoanSurface />}
              {activeTab === 'recurrings' && (
                <RecurringsTab
                  recurrings={recurrings}
                  candidates={recurringCandidates}
                  onReviewCandidate={reviewRecurringCandidate}
                  onDismissCandidate={dismissRecurringCandidate}
                  busy={recurringBusy || !recurringDataReady}
                  paymentEvidence={paymentEvidence}
                  detectionUnavailable={!recurringDataReady || exclusionsUnreliable}
                  currentMonth={currentMonth}
                  formatGBP={formatGBP}
                  onOpenAddModal={() => {
                    setNewRecurring({ name: '', amount: '', frequency: 'monthly', dueDate: 1, dueMonth: 1, isPaid: false, status: 'active' });
                    setIsAddRecurringOpen(true);
                    setAddRecTemplate("scratch");
                  }}
                  onTogglePaid={toggleRecurringPaid}
                  onPayEarly={recordEarlyPayment}
                  onEditRecurring={(bill) => {
                    setActiveRecurring(bill);
                    setIsEditRecurringOpen(true);
                  }}
                  onDeleteRecurring={handleDeleteRecurring}
                  onUndismissRecurring={(id) => { void undismissRecurring(id); }}
                />
              )}
              {activeTab === 'transactions' && (
                <TransactionsTab
                  transactions={mockTransactions}
                  onUpdateTransactions={(updated) => {
                    setMockTransactions(updated);
                    // Coalesced: the review queue runs on held keys, and each
                    // press rewrites the whole array.
                    saveTransactionsSoon({ list: updated, builtAt: currentLoadGenerations() });
                  }}
                  bankAccounts={bankAccounts}
                  goals={goals}
                  budgetCategories={budgetCategories}
                  formatGBP={formatGBP}
                  syncStatus={
                    <BankSyncStatus
                      status={trueLayerStatus}
                      isSyncing={isSyncingTrueLayer}
                      syncAvailableAt={syncAvailableAt}
                      onSync={syncTrueLayer}
                    />
                  }
                />
              )}
              {activeTab === 'investments' && (
                <InvestmentsTab
                  holdings={investmentHoldings}
                  activities={investmentActivities}
                  onAddHolding={handleAddHolding}
                  onEditHolding={handleEditHolding}
                  onDeleteHolding={handleDeleteHolding}
                  onImportHoldings={handleImportHoldings}
                  formatGBP={formatGBP}
                  bankAccounts={bankAccounts}
                />
              )}
              {activeTab === 'tax-calculator' && <TaxCalculatorSurface figuresHidden={figures.hidden} />}
              {activeTab === 'money-hub' && <MoneyHubSurface key={profileId} figuresHidden={figures.hidden} />}
            </Suspense>
          </FinanceSectionBoundary>}
          </>}
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
        busy={recurringBusy}
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
        busy={recurringBusy}
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

/**
 * Renders FinanceView into the /finance route mount point.
 *
 * Lives *inside* FinanceDataProvider and reads both `target` (via context) and
 * `useMatch('/finance/*')` here so FinanceDataProvider never re-renders when
 * navigating between site routes or switching internal Finance tabs.
 */
function FinancePortal() {
  const target = useFinanceTarget();
  // The route's mount point is cleared a commit after navigation. Without the
  // match the view would re-render once for the new path in between, falling
  // back to Dashboard and mounting it in a detached node.
  const onFinance = useMatch('/finance/*') !== null;
  if (!target || !onFinance) return null;
  return createPortal(<FinanceView />, target);
}

/**
 * The provider and, while /finance is open, the view rendered into the
 * route's mount point. Memoised with no props so FinanceSession updates
 * (e.g. `target` changing on route entry/exit) never re-render the provider.
 */
const FinanceHost = memo(function FinanceHost() {
  return (
    <FinanceDataProvider>
      <FinancePortal />
    </FinanceDataProvider>
  );
});

export default FinanceHost;

/**
 * The finance data layer: everything loaded from Supabase, and the two
 * functions that load and save it.
 *
 * Split out of FinancePage (REHAUL_PLAN.md 7.2b) so the five surfaces can
 * become separate components without passing two dozen props through each
 * one. Only *data* lives here -- dialog flags, filters and hover state stay
 * with whichever surface owns them.
 *
 * Postgres is the only source of truth. State starts at its defaults and is
 * replaced by the first fetch; nothing is cached in localStorage, which with
 * profiles would mean one profile's ledger surviving a switch to another.
 */

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import defaultPresets from '@/data/presets.json';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { Payslip, PayslipLine, ProfileTransfer } from '@/lib/finance';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { normalizeHolidays, type StudentLoanPlanKey } from '@/lib/finance';
import {
  asAccountType,
  asBudgetGroup,
  asBureauKey,
  asDebtType,
  asFrequency,
  asPensionType,
  asStudentLoanPlan,
  asMembershipType,
  asPaydaySchedule,
  asUkRegion,
  fromJsonb,
} from './finance-narrow';
import type {
  BankAccount,
  DatabaseDefaults,
  FinanceProfile,
  BudgetCategory,
  BudgetItem,
  CreditBureauConfig,
  CreditScoreEntry,
  CategoryPreset,
  CreditScores,
  Debt,
  DebtDraw,
  FinanceSettings,
  Goal,
  InvestmentHolding,
  Membership,
  MockTransaction,
  RecurringBill,
  RecurringTemplate,
  TaxConfig,
  TimeSpentInputs,
  UserHoliday,
} from '@/features/finance/finance-types';
import {
  ALL_PRESETS_FALLBACK,
  ALL_SAVINGS_IDS,
  createDefaultBudgetCategories,
  DEFAULT_BUDGET_CATEGORIES,
  DEFAULT_CATEGORY_TEMPLATES,
  DEFAULT_RECURRING_TEMPLATES,
  mergeMissingDefaultCategories,
  presetsToDefaultCategories,
} from './finance-defaults';

export type BreakdownRateMode = 'normal' | 'including_leave' | 'excluding_leave';
import {
  calculateWeekends,
  sanitizeBankAccounts,
  sanitizeBudgetCategories,
} from './utils/calculations';

/** All the state and the two Supabase functions. Kept as a hook so the context
 *  value's type is inferred from it rather than hand-maintained. */
function useProvideFinanceData() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [presets, setPresets] = useState(ALL_PRESETS_FALLBACK);

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

  // Store defaults from database
  const [databaseDefaults, setDatabaseDefaults] = useState<DatabaseDefaults>({});

  // Data States
  const [settings, setSettings] = useState<FinanceSettings>(() => {
    return {
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
  });

  const [timeSpentInputs, setTimeSpentInputs] = useState(() => {
    return {
      sleepHoursPerDay: 8.0,
      commuteDaysPerWeek: 5,
      commuteHoursPerDay: 2,
      gettingReadyHoursPerDay: 1.0,
      gymDaysPerWeek: 0,
      gymHoursPerSession: 0,
      learningHoursPerWeek: 0,
      friendsHoursPerWeek: 0,
    };
  });

  const [goals, setGoals] = useState<Goal[]>(() => {
    return [];
  });

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => {
    return sanitizeBankAccounts([]);
  });

  const [investmentHoldings, setInvestmentHoldings] = useState<InvestmentHolding[]>(() => {
    return [
      { id: 'h1', name: 'S&P 500 ETF', ticker: 'VOO', shares: 12.5, avgPrice: 420.50, currentPrice: 485.20, category: 'ETF' },
      { id: 'h2', name: 'Apple Inc.', ticker: 'AAPL', shares: 15, avgPrice: 150.00, currentPrice: 189.30, category: 'Stock' },
      { id: 'h3', name: 'Bitcoin', ticker: 'BTC', shares: 0.15, avgPrice: 35000.00, currentPrice: 62450.00, category: 'Crypto' },
      { id: 'h4', name: 'Ethereum', ticker: 'ETH', shares: 1.2, avgPrice: 1800.00, currentPrice: 3120.00, category: 'Crypto' }
    ];
  });

  const [memberships, setMemberships] = useState<Membership[]>(() => {
    return [];
  });

  const [debts, setDebts] = useState<Debt[]>(() => {
    // Normalize so cached rows written before draws/repaymentType existed still render
    return [].map(d => ({
      ...d,
      draws: Array.isArray(d.draws) ? d.draws : [],
      repaymentType: d.repaymentType || 'amortising'
    }));
  });

  const [recurrings, setRecurrings] = useState<RecurringBill[]>(() => {
    return [];
  });

  const [creditScores, setCreditScores] = useState<CreditScores>(() => {
    return { experian: [], transunion: [], equifax: [] };
  });

  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>(() => {
    const list = DEFAULT_BUDGET_CATEGORIES;
    return sanitizeBudgetCategories(mergeMissingDefaultCategories(list, DEFAULT_BUDGET_CATEGORIES));
  });

  const [mockTransactions, setMockTransactions] = useState<MockTransaction[]>(() => {
    return [];
  });

  // Dynamic configurations fetched from Supabase
  const [taxConfig, setTaxConfig] = useState<TaxConfig>(() => {
    return {
      studentLoanThresholds: { none: Infinity, plan1: 0, plan2: 0, plan4: 0, plan5: 0, postgrad: 0 },
      studentLoanRates: { none: 0, plan1: 0, plan2: 0, plan4: 0, plan5: 0, postgrad: 0 },
      incomeTaxBands: { basicRateLimit: 0, higherRateLimit: 0, basicRatePercent: 0, higherRatePercent: 0, additionalRatePercent: 0 },
      nationalInsuranceBands: { lowerThreshold: 0, upperThreshold: 0, mainRatePercent: 0, upperRatePercent: 0 }
    };
  });
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplate[]>(() => {
    return DEFAULT_RECURRING_TEMPLATES;
  });
  const [creditBureaus, setCreditBureaus] = useState<CreditBureauConfig[]>(() => {
    return [
      { key: 'experian', label: 'Experian', emoji: '🟣', color: 'hsl(var(--chart-5))', maxScore: 1250, gradient: 'from-chart-5/10 to-chart-5/5' },
      { key: 'transunion', label: 'Credit Karma', emoji: '🔵', color: 'hsl(var(--chart-2))', maxScore: 710, gradient: 'from-chart-3/10 to-chart-3/5' },
      { key: 'equifax', label: 'ClearScore', emoji: '🟡', color: 'hsl(var(--chart-4))', maxScore: 1000, gradient: 'from-chart-4/10 to-chart-4/5' }
    ];
  });
  const [holidayDefaults, setHolidayDefaults] = useState<Record<number, { count: number; dates: string; occasion: string }>>(() => {
    return {} as Record<number, { count: number; dates: string; occasion: string }>;
  });
  const [defaultBudgetCategories, setDefaultBudgetCategories] = useState<BudgetCategory[]>(() => {
    return DEFAULT_CATEGORY_TEMPLATES;
  });


  // Mirrors of loaded settings that the settings form edits, and the goal the
  // goals view opens on. Initialised from data, so they live with the data.
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [payDayInput, setPayDayInput] = useState(settings.payDayOfMonth?.toString() || '25');
  const [paydaySchedule, setPaydaySchedule] = useState<FinanceSettings['paydaySchedule']>(() => settings.paydaySchedule || 'monthly_date');
  const [paydayWeekday, setPaydayWeekday] = useState<number>(() => settings.paydayWeekday !== undefined ? settings.paydayWeekday : 5);
  const [paydayBiweeklyAnchor, setPaydayBiweeklyAnchor] = useState<string>(() => settings.paydayBiweeklyAnchor || '2026-01-02');

  // UK bank holidays, fetched once from gov.uk. Shared because payday, leave
  // and the tax view all need the same list (7.2c-i).
  const [fetchingHolidays, setFetchingHolidays] = useState(false);
  const [bankHolidaysList, setBankHolidaysList] = useState<string[]>([]);
  const [bankHolidaysMap, setBankHolidaysMap] = useState<Record<string, string>>({});
  const [breakdownRateMode, setBreakdownRateMode] = useState<BreakdownRateMode>('normal');
  const includeWorkLeaveInActual = breakdownRateMode !== 'excluding_leave';
  const setIncludeWorkLeaveInActual = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(includeWorkLeaveInActual) : val;
    setBreakdownRateMode(nextVal ? 'including_leave' : 'excluding_leave');
  };
  useEffect(() => {
    const fetchHolidays = async () => {
      setFetchingHolidays(true);
      try {
        const res = await fetch('https://www.gov.uk/bank-holidays.json');
        if (!res.ok) throw new Error('Failed to fetch holidays');
        const data = await res.json();

        const region = settings.ukRegion || 'england-and-wales';
        const events = (data[region]?.events ?? []) as { date: string; title: string }[];

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

  const [loadingDb, setLoadingDb] = useState(false);
  /**
   * False until the first fetch has come back.
   *
   * `loadingDb` cannot answer "is there data yet": it is false before the fetch
   * starts as well as after it finishes. Since 7.3b removed the localStorage
   * cache, state begins at its defaults, so without this every figure renders
   * £0.00 for the ~260 ms of the mount and then snaps to the real value.
   */
  const [hasLoaded, setHasLoaded] = useState(false);
  const [savingDb, setSavingDb] = useState(false);
  // The profile every non-template row is written against (Phase 7.1). One
  // operator, several subjects; a profile switcher arrives in 7.2d, once
  // reads are filtered by profile too.
  // Every profile the operator configures, and which one is on screen. The
  // self profile is the default; the switcher in the finance shell changes it,
  // and changing it refetches (7.2d).
  // The snapshot series 7.4 has been recording nightly. Read separately from
  // the mount batch: it is per-profile history rather than current state, and
  // the surfaces that show it can tolerate arriving a moment later.
  const [netWorthHistory, setNetWorthHistory] = useState<
    { capturedOn: string; netWorth: number; assets: number; liabilities: number }[]
  >([]);
  const [profiles, setProfiles] = useState<FinanceProfile[]>([]);
  // Movements between tracked profiles. Fetched for either side, because a
  // transfer belongs to both ledgers and the switcher may be on either.
  const [transfers, setTransfers] = useState<ProfileTransfer[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);

  /**
   * A scoped table holds this profile's rows plus the shared templates, which
   * carry a null profile_id (7.1). Both are wanted: the page separates them by
   * `is_default` once they arrive.
   */
  const scoped = <T,>(q: T): T => {
    if (!profileId) return q;
    return (q as { or: (f: string) => T }).or(`profile_id.eq.${profileId},is_default.eq.true`);
  };

  /**
   * Writes one profile's own fields. Separate from saveDataToSupabase, which
   * replaces whole collections of ledger rows; a profile is a single row and
   * its edits are patches, not replacements.
   */
  const updateProfile = async (
    id: string,
    patch: Partial<Pick<FinanceProfile, 'birthYear' | 'retirementAge' | 'pensionGrowthPercent' | 'name' | 'emoji'>>,
  ) => {
    if (!isAdmin) return;
    const row: Record<string, unknown> = {};
    if (patch.birthYear !== undefined) row.birth_year = patch.birthYear;
    if (patch.retirementAge !== undefined) row.retirement_age = patch.retirementAge;
    if (patch.pensionGrowthPercent !== undefined) row.pension_growth_percent = patch.pensionGrowthPercent;
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.emoji !== undefined) row.emoji = patch.emoji;
    if (Object.keys(row).length === 0) return;

    setProfiles(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
    const { error } = await supabase.from('finance_profiles').update(row).eq('id', id);
    if (error) {
      toast({
        title: 'Could not save profile',
        description: error.message,
        variant: 'destructive',
      });
      // The optimistic patch above is now wrong, so pull the truth back.
      void fetchSupabaseData();
    }
  };

  const fetchTransfers = useCallback(async (forProfile: string | null) => {
    if (!isAdmin || !forProfile) return;
    const { data, error } = await supabase
      .from('finance_profile_transfers')
      .select('id, from_profile_id, to_profile_id, from_transaction_id, to_transaction_id, amount, date, note')
      .or(`from_profile_id.eq.${forProfile},to_profile_id.eq.${forProfile}`)
      .order('date', { ascending: false });
    if (error) {
      console.warn('transfers unavailable', error.message);
      return;
    }
    setTransfers(
      (data ?? []).map(r => ({
        id: r.id,
        fromProfileId: r.from_profile_id,
        toProfileId: r.to_profile_id,
        fromTransactionId: r.from_transaction_id,
        toTransactionId: r.to_transaction_id,
        amount: Number(r.amount),
        date: r.date,
        note: r.note ?? undefined,
      })),
    );
  }, [isAdmin]);

  useEffect(() => {
    void fetchTransfers(profileId);
  }, [fetchTransfers, profileId]);

  const saveTransfer = async (t: Omit<ProfileTransfer, 'id'> & { id?: string }) => {
    if (!isAdmin) return;
    const row = {
      ...(t.id ? { id: t.id } : {}),
      from_profile_id: t.fromProfileId,
      to_profile_id: t.toProfileId,
      from_transaction_id: t.fromTransactionId ?? null,
      to_transaction_id: t.toTransactionId ?? null,
      amount: t.amount,
      date: t.date,
      note: t.note ?? null,
    };
    const { error } = await supabase.from('finance_profile_transfers').upsert(row);
    if (error) {
      toast({ title: 'Could not save transfer', description: error.message, variant: 'destructive' });
      return;
    }
    await fetchTransfers(profileId);
  };

  /* ---- Payslips (7.7) ---------------------------------------------------
     Their own table rather than part of the big fetch: they are captured a
     handful of times a year, and a surface that does not show them has no
     reason to load them. */
  const fetchPayslips = useCallback(async (forProfile: string | null) => {
    if (!isAdmin || !forProfile) {
      setPayslips([]);
      return;
    }
    const { data, error } = await supabase
      .from('finance_payslips')
      .select('id, pay_date, employer, gross, income_tax, national_insurance, pension_employee, pension_employer, student_loan, other_deductions, net, storage_path, notes, lines')
      .eq('profile_id', forProfile)
      .order('pay_date', { ascending: false });
    if (error) {
      console.warn('payslips unavailable', error.message);
      return;
    }
    setPayslips((data ?? []).map(r => ({
      id: r.id,
      payDate: r.pay_date,
      employer: r.employer || undefined,
      gross: Number(r.gross),
      incomeTax: Number(r.income_tax),
      nationalInsurance: Number(r.national_insurance),
      pensionEmployee: Number(r.pension_employee),
      pensionEmployer: Number(r.pension_employer),
      studentLoan: Number(r.student_loan),
      otherDeductions: Number(r.other_deductions),
      net: Number(r.net),
      storagePath: r.storage_path ?? undefined,
      notes: r.notes ?? undefined,
      lines: Array.isArray(r.lines) ? (r.lines as unknown as PayslipLine[]) : [],
    })));
  }, [isAdmin]);

  useEffect(() => {
    void fetchPayslips(profileId);
  }, [fetchPayslips, profileId]);

  const savePayslip = async (slip: Payslip) => {
    if (!isAdmin || !profileId) return;
    // Upsert on the natural key: capturing the same pay date twice corrects
    // the row rather than adding a second one, which the unique index would
    // reject anyway.
    const { error } = await supabase.from('finance_payslips').upsert({
      id: slip.id,
      profile_id: profileId,
      pay_date: slip.payDate,
      employer: slip.employer ?? '',
      gross: slip.gross,
      income_tax: slip.incomeTax,
      national_insurance: slip.nationalInsurance,
      pension_employee: slip.pensionEmployee,
      pension_employer: slip.pensionEmployer,
      student_loan: slip.studentLoan,
      other_deductions: slip.otherDeductions,
      net: slip.net,
      storage_path: slip.storagePath ?? null,
      notes: slip.notes ?? null,
      lines: (slip.lines ?? []) as unknown as never,
      updated_at: new Date().toISOString(),
    // Employer is part of the key: overlapping jobs can pay on the same day,
    // and without it the second payslip replaces the first (7.7).
    }, { onConflict: 'profile_id,employer,pay_date' });
    if (error) {
      toast({ title: 'Could not save payslip', description: error.message, variant: 'destructive' });
      return;
    }
    await fetchPayslips(profileId);
  };

  const deletePayslip = async (id: string) => {
    if (!isAdmin) return;
    const { error } = await supabase.from('finance_payslips').delete().eq('id', id);
    if (error) {
      toast({ title: 'Could not delete payslip', description: error.message, variant: 'destructive' });
      return;
    }
    await fetchPayslips(profileId);
  };

  const deleteTransfer = async (id: string) => {
    if (!isAdmin) return;
    const { error } = await supabase.from('finance_profile_transfers').delete().eq('id', id);
    if (error) {
      toast({ title: 'Could not delete transfer', description: error.message, variant: 'destructive' });
      return;
    }
    await fetchTransfers(profileId);
  };

  const fetchNetWorthHistory = useCallback(async (forProfile: string | null) => {
    if (!isAdmin || !forProfile) return;
    const { data, error } = await supabase
      .from('finance_net_worth_snapshots')
      .select('captured_on, net_worth, assets, liabilities')
      .eq('profile_id', forProfile)
      .order('captured_on', { ascending: true });
    if (error) {
      // A missing series is not worth a toast: every other figure on the page
      // is current state and still correct without it.
      console.warn('net worth history unavailable', error.message);
      return;
    }
    setNetWorthHistory(
      (data ?? []).map(r => ({
        capturedOn: r.captured_on,
        netWorth: Number(r.net_worth),
        assets: Number(r.assets),
        liabilities: Number(r.liabilities),
      })),
    );
  }, [isAdmin]);

  useEffect(() => {
    void fetchNetWorthHistory(profileId);
  }, [fetchNetWorthHistory, profileId]);

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
          debtsRes,
          creditScoresRes,
          budgetCategoriesRes,
          budgetItemsRes,
          recurringBillsRes,
          transactionsRes,
          taxConfigsRes,
          recurringTemplatesRes,
          creditBureausRes,
          holidayDefaultsRes,
          budgetPresetsRes,
          selfProfileRes
        ] = await Promise.all([
          scoped(supabase.from('finance_settings').select('*')),
          scoped(supabase.from('finance_user_holidays').select('*')),
          scoped(supabase.from('finance_goals').select('*')),
          scoped(supabase.from('finance_goal_contributions').select('*')),
          scoped(supabase.from('finance_bank_accounts').select('*')),
          scoped(supabase.from('finance_memberships').select('*')),
          scoped(supabase.from('finance_debts').select('*')),
          scoped(supabase.from('finance_credit_scores').select('*')),
          scoped(supabase.from('finance_budget_categories').select('*')),
          scoped(supabase.from('finance_budget_items').select('*')),
          scoped(supabase.from('finance_recurring_bills').select('*')),
          scoped(supabase.from('finance_transactions').select('*')),
          supabase.from('finance_tax_configs').select('*'),
          supabase.from('finance_recurring_templates').select('*'),
          supabase.from('finance_credit_bureaus').select('*'),
          supabase.from('finance_holiday_defaults').select('*'),
          supabase.from('finance_budget_presets').select('*'),
          // `*` rather than a column list, unusually for this codebase: profiles is a
          // handful of rows, and naming columns makes the query fail outright
          // during the window where a migration adding one is written but not yet
          // applied -- which silently empties the switcher rather than degrading.
          supabase
            .from('finance_profiles')
            .select('*')
            .order('is_self', { ascending: false })
        ]);

        // Written by the 7.1 migration, so at least the self profile is present
        // unless someone has deleted it. `saveDataToSupabase` refuses to write
        // without one.
        const loadedProfiles = (selfProfileRes.data ?? []).map(p => ({
          id: p.id,
          name: p.name,
          isSelf: p.is_self,
          isPublic: p.is_public,
          emoji: p.emoji,
          currency: p.currency,
          region: p.region,
          // Defaulted rather than assumed present, for the same reason.
          birthYear: p.birth_year ?? null,
          retirementAge: p.retirement_age ?? 68,
          pensionGrowthPercent: Number(p.pension_growth_percent ?? 4.5),
        }));
        setProfiles(loadedProfiles);
        if (!profileId) setProfileId(loadedProfiles.find(p => p.isSelf)?.id ?? loadedProfiles[0]?.id ?? null);

        // A single failing table used to `throw` here, aborting the whole load
        // and silently dropping the page back to localStorage — which is how a
        // table whose migration hadn't been applied yet could take out every
        // other tab. Instead, record what failed, skip only those state
        // updates (leaving the cached values in place rather than wiping them
        // to empty), and tell the user.
        const failedTables = ([
          ['settings', settingsRes],
          ['user_holidays', userHolidaysRes],
          ['goals', goalsRes],
          ['goal_contributions', contributionsRes],
          ['bank_accounts', bankAccountsRes],
          ['memberships', membershipsRes],
          ['debts', debtsRes],
          ['credit_scores', creditScoresRes],
          ['budget_categories', budgetCategoriesRes],
          ['budget_items', budgetItemsRes],
          ['recurring_bills', recurringBillsRes],
          ['transactions', transactionsRes],
          ['tax_configs', taxConfigsRes],
          ['recurring_templates', recurringTemplatesRes],
          ['credit_bureaus', creditBureausRes],
          ['holiday_defaults', holidayDefaultsRes],
          ['budget_presets', budgetPresetsRes]
        ] as const).filter(([, res]) => res.error);

        if (failedTables.length > 0) {
          console.error(
            'Failed to load finance tables from Supabase:',
            failedTables.map(([name, res]) => `${name}: ${res.error?.message}`)
          );
          toast({
            title: 'Some finance data failed to load',
            description: `Showing cached values for: ${failedTables.map(([name]) => name).join(', ')}. Check that all migrations have been applied.`,
            variant: 'destructive'
          });
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
            pensionType: asPensionType(activeSettings.pension_type),
            personalPensionPercent: Number(activeSettings.personal_pension_percent) || 0,
            employerPensionPercent: Number(activeSettings.employer_pension_percent) || 0,
            studentLoanPlan: asStudentLoanPlan(activeSettings.student_loan_plan),
            taxCode: activeSettings.tax_code || '1257L',
            personalAllowance: Number(activeSettings.personal_allowance) || 12570,
            weekends: Number(activeSettings.weekends) || 104,
            bankHolidays: Number(activeSettings.bank_holidays) || 8,
            workHolidays: Number(activeSettings.work_holidays) || 25,
            workingHoursPerDay: Number(activeSettings.working_hours_per_day) || 7.5,
            taxYear: Number(activeSettings.tax_year) || 2026,
            ukRegion: asUkRegion(activeSettings.uk_region),
            payDayOfMonth: activeSettings.pay_day_of_month || 25,
            paydaySchedule: asPaydaySchedule(activeSettings.payday_schedule),
            paydayWeekday: activeSettings.payday_weekday !== null ? activeSettings.payday_weekday : 5,
            paydayBiweeklyAnchor: activeSettings.payday_biweekly_anchor || '2026-01-02',
            activeSavingsTypes: activeSettings.active_savings_types ?? [],
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
            isEmergencyFund: g.is_emergency_fund ?? false,
            monthlyContribution: Number(g.monthly_contribution ?? 0),
            startDate: g.start_date || undefined,
            status: (g.status as 'active' | 'archived') || 'active',
            emoji: g.emoji || undefined,
            contributions: goalContribs
          };
        });
        if (!goalsRes.error && !contributionsRes.error) {
          setGoals(mappedGoals);
          if (mappedGoals.length > 0) setSelectedGoalId(mappedGoals[0].id);
        }

        const userAccounts = bankAccountsRes.data?.filter(d => !d.is_default) || [];
        const defaultAccounts = bankAccountsRes.data?.filter(d => d.is_default) || [];
        const activeAccounts = userAccounts.length > 0 ? userAccounts : defaultAccounts;

        const mappedBankAccounts: BankAccount[] = activeAccounts.map(a => ({
          id: a.id,
          name: a.name,
          type: asAccountType(a.type),
          issuer: a.issuer || '',
          balance: Number(a.balance) || 0,
          annualFee: Number(a.annual_fee) || 0,
          useCase: a.use_case || undefined,
          emoji: a.emoji || undefined,
          color: a.color || undefined
        }));
        if (!bankAccountsRes.error) setBankAccounts(mappedBankAccounts);

        const userMemberships = membershipsRes.data?.filter(d => !d.is_default) || [];
        const defaultMemberships = membershipsRes.data?.filter(d => d.is_default) || [];
        const activeMemberships = userMemberships.length > 0 ? userMemberships : defaultMemberships;

        const mappedMemberships: Membership[] = activeMemberships.map(m => ({
          id: m.id,
          name: m.name,
          type: asMembershipType(m.type),
          status: m.status || '',
          annualFee: Number(m.annual_fee) || 0,
          useCase: m.use_case || undefined
        }));
        if (!membershipsRes.error) setMemberships(mappedMemberships);

        const userDebts = debtsRes.data?.filter(d => !d.is_default) || [];
        const defaultDebts = debtsRes.data?.filter(d => d.is_default) || [];
        const activeDebts = userDebts.length > 0 ? userDebts : defaultDebts;

        const mappedDebts: Debt[] = activeDebts.map(d => ({
          id: d.id,
          name: d.name,
          type: asDebtType(d.type),
          lender: d.lender || '',
          originalAmount: Number(d.original_amount) || 0,
          balance: Number(d.balance) || 0,
          interestRate: Number(d.interest_rate) || 0,
          minPayment: Number(d.min_payment) || 0,
          startDate: d.start_date || undefined,
          payoffDate: d.payoff_date || undefined,
          repaymentType: (d.repayment_type as Debt['repaymentType']) || 'amortising',
          studentLoanPlan: (d.student_loan_plan as StudentLoanPlanKey) || undefined,
          writeOffYears: d.write_off_years ?? undefined,
          draws: Array.isArray(d.draws) ? (d.draws as unknown as DebtDraw[]) : [],
          notes: d.notes || undefined,
          emoji: d.emoji || undefined,
          color: d.color || undefined
        }));
        if (!debtsRes.error) setDebts(mappedDebts);

        const userCreditScores = creditScoresRes.data?.filter(d => !d.is_default) || [];
        const defaultCreditScores = creditScoresRes.data?.filter(d => d.is_default) || [];
        const activeCreditScores = userCreditScores.length > 0 ? userCreditScores : defaultCreditScores;

        const scoresObj: CreditScores = {
          experian: activeCreditScores.filter(s => s.bureau === 'experian').map(s => ({ id: s.id, date: s.date, score: s.score })),
          transunion: activeCreditScores.filter(s => s.bureau === 'transunion').map(s => ({ id: s.id, date: s.date, score: s.score })),
          equifax: activeCreditScores.filter(s => s.bureau === 'equifax').map(s => ({ id: s.id, date: s.date, score: s.score }))
        };
        if (!creditScoresRes.error) setCreditScores(scoresObj);

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
            group: asBudgetGroup(cat.group_type),
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
          frequency: asFrequency(r.frequency),
          dueMonth: r.due_month || undefined,
          emoji: r.emoji || undefined,
          category: r.category || undefined,
          tag: r.tag || undefined,
          linkedBudgetItemId: r.linked_budget_item_id || undefined,
          linkedAccountId: r.linked_account_id || undefined
        }));
        if (!recurringBillsRes.error) setRecurrings(mappedRecurrings);

        const userTransactions = transactionsRes.data?.filter(d => !d.is_default) || [];
        const defaultTransactions = transactionsRes.data?.filter(d => d.is_default) || [];
        const activeTransactions = userTransactions.length > 0 ? userTransactions : defaultTransactions;

        const mappedTransactions: MockTransaction[] = activeTransactions.map(t => ({
          id: t.id,
          name: t.name,
          merchant: t.merchant || undefined,
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
        if (!transactionsRes.error) setMockTransactions(mappedTransactions);

        const userTaxConfig = taxConfigsRes.data?.find(d => !d.is_default);
        const defaultTaxConfig = taxConfigsRes.data?.find(d => d.is_default);
        const activeTaxConfig = userTaxConfig || defaultTaxConfig;

        if (activeTaxConfig) {
          const mappedTaxConfig: TaxConfig = {
            studentLoanThresholds: fromJsonb(activeTaxConfig.student_loan_thresholds, {} as never),
            studentLoanRates: fromJsonb(activeTaxConfig.student_loan_rates, {} as never),
            incomeTaxBands: fromJsonb(activeTaxConfig.income_tax_bands, {} as never),
            nationalInsuranceBands: fromJsonb(
              activeTaxConfig.national_insurance_bands,
              {} as TaxConfig['nationalInsuranceBands'],
            )
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
          frequency: asFrequency(t.frequency),
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
          key: asBureauKey(b.key),
          label: b.label,
          emoji: b.emoji || '',
          color: b.color || '',
          maxScore: b.max_score,
          gradient: b.gradient || ''
        }));
        if (!creditBureausRes.error) setCreditBureaus(mappedBureaus);

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
        if (!holidayDefaultsRes.error) setHolidayDefaults(mappedHolidayDefaults);

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
            group: asBudgetGroup(cat.group_type),
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
            group: asBudgetGroup(p.group_type)
          });
        });

        if (activePresets.length > 0) {
          setPresets(prev => {
            const merged = {
              ...prev,
              ...presetsObj
            };
            return merged;
          });
        } else {
          saveDataToSupabase('budget_presets', ALL_PRESETS_FALLBACK);
        }

        // Reconstruct databaseDefaults map
        const defaultsMap: DatabaseDefaults = {};
        if (defaultSettings) {
          defaultsMap['settings'] = {
            grossSalary: Number(defaultSettings.gross_salary) || 0,
            pensionType: asPensionType(defaultSettings.pension_type),
            personalPensionPercent: Number(defaultSettings.personal_pension_percent) || 0,
            employerPensionPercent: Number(defaultSettings.employer_pension_percent) || 0,
            studentLoanPlan: asStudentLoanPlan(defaultSettings.student_loan_plan),
            taxCode: defaultSettings.tax_code || '1257L',
            personalAllowance: Number(defaultSettings.personal_allowance) || 12570,
            weekends: Number(defaultSettings.weekends) || 104,
            bankHolidays: Number(defaultSettings.bank_holidays) || 8,
            workHolidays: Number(defaultSettings.work_holidays) || 25,
            workingHoursPerDay: Number(defaultSettings.working_hours_per_day) || 7.5,
            taxYear: Number(defaultSettings.tax_year) || 2026,
            ukRegion: asUkRegion(defaultSettings.uk_region),
            payDayOfMonth: defaultSettings.pay_day_of_month || 25,
            paydaySchedule: asPaydaySchedule(defaultSettings.payday_schedule),
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
          isEmergencyFund: g.is_emergency_fund ?? false,
          monthlyContribution: Number(g.monthly_contribution ?? 0),
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
            type: asAccountType(a.type),
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
            type: asMembershipType(m.type),
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
          group: asBudgetGroup(cat.group_type),
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
          frequency: asFrequency(r.frequency),
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
          merchant: t.merchant || undefined,
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
            studentLoanThresholds: fromJsonb(
              defaultTaxConfig.student_loan_thresholds,
              {} as TaxConfig['studentLoanThresholds'],
            ),
            studentLoanRates: fromJsonb(
              defaultTaxConfig.student_loan_rates,
              {} as TaxConfig['studentLoanRates'],
            ),
            incomeTaxBands: fromJsonb(
              defaultTaxConfig.income_tax_bands,
              {} as TaxConfig['incomeTaxBands'],
            ),
            nationalInsuranceBands: fromJsonb(
              defaultTaxConfig.national_insurance_bands,
              {} as TaxConfig['nationalInsuranceBands'],
            ),
          };
        }
        defaultsMap['recurring_templates'] = defaultTemplates.map(t => ({
          name: t.name,
          category: t.category,
          emoji: t.emoji || '',
          tag: t.tag || '',
          defaultAmount: Number(t.default_amount) || 0,
          frequency: asFrequency(t.frequency),
          linkedBudgetItemId: t.linked_budget_item_id || '',
          budgetCategoryName: t.budget_category_name || undefined
        }));
        defaultsMap['credit_bureaus'] = defaultBureaus.map(b => ({
          key: asBureauKey(b.key),
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
          group: asBudgetGroup(cat.group_type),
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
        setHasLoaded(true);
      }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchSupabaseData();
    }
    // Refetches when the switcher changes profile: `scoped` filters on
    // profileId, so the whole ledger is a different set of rows (7.2d).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, profileId]);

  type ScopedFinanceTable =
    | 'finance_bank_accounts'
    | 'finance_budget_categories'
    | 'finance_budget_items'
    | 'finance_credit_scores'
    | 'finance_debts'
    | 'finance_goal_contributions'
    | 'finance_goals'
    | 'finance_memberships'
    | 'finance_recurring_bills'
    | 'finance_transactions'
    | 'finance_user_holidays';

  /**
   * Removes this profile's rows that are no longer in `keepIds`.
   *
   * Saves used to delete every non-template row and then insert the new set,
   * which leaves a window where the data is simply gone -- a constraint
   * violation or a dropped connection between the two took the lot. Each save
   * now upserts first and calls this after, so a failure leaves the previous
   * rows intact. Template rows (is_default) and other profiles are untouched.
   */
  const pruneScoped = async (
    table: ScopedFinanceTable,
    keepIds: string[],
    isTemplate?: boolean,
  ) => {
    const ids = keepIds.filter(Boolean);
    // `from` is generic per table, so the builder is typed differently for
    // each name in the union. The delete filters are identical across them and
    // touch no column-specific types, which is what this narrowing asserts.
    const base = supabase
      .from<ScopedFinanceTable, never>(table)
      .delete()
      .eq('is_default', false)
      .eq('profile_id', profileId);
    const scopedBase = isTemplate === undefined ? base : base.eq('is_template', isTemplate);
    const { error } = await (ids.length > 0
      ? scopedBase.not('id', 'in', `(${ids.join(',')})`)
      : scopedBase);
    if (error) throw error;
  };

  // Each branch narrows `contentData` to the shape its key implies; the caller
  // passes whichever collection it just changed.
  const saveDataToSupabase = async (key: string, contentData: unknown) => {
    if (!isAdmin) return;
    // Every non-template finance row carries a profile_id, and the database
    // enforces it with a CHECK. Writing without one would fail per-statement
    // and leave the delete-then-insert save half applied, so refuse up front.
    if (!profileId) {
      toast({
        title: 'No profile loaded',
        description: 'Finance data could not be saved because no profile was found.',
        variant: 'destructive',
      });
      return;
    }
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
          profile_id: profileId,
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

        const holidaysList = Array.isArray(settingsObj.holidaysByUser)
          ? settingsObj.holidaysByUser
          : Object.values(settingsObj.holidaysByUser || {});
        await pruneScoped('finance_user_holidays', holidaysList.map(h => h.id));
        if (holidaysList.length > 0) {
          await supabase.from('finance_user_holidays').upsert(holidaysList.map(h => ({
            id: h.id,
            is_default: false,
            profile_id: profileId,
            start_date: h.startDate,
            end_date: h.endDate,
            occasion: h.occasion || null,
            count: h.count
          })), { onConflict: 'id' });
        }
      } else if (key === 'goals') {
        const goalsList = contentData as Goal[];
        await pruneScoped('finance_goals', goalsList.map(g => g.id));
        if (goalsList.length > 0) {
          await supabase.from('finance_goals').upsert(goalsList.map(g => ({
            id: g.id,
            is_default: false,
            profile_id: profileId,
            name: g.name,
            target_amount: g.targetAmount,
            current_amount: g.currentAmount,
            target_date: g.targetDate || null,
            is_emergency_fund: g.isEmergencyFund ?? false,
            monthly_contribution: g.monthlyContribution ?? 0,
            start_date: g.startDate || null,
            status: g.status || 'active',
            emoji: g.emoji || null
          })), { onConflict: 'id' });
          const contribs = goalsList.flatMap(g => (g.contributions || []).map(c => ({
            id: c.id,
            is_default: false,
            profile_id: profileId,
            goal_id: g.id,
            amount: c.amount,
            date: c.date,
            note: c.note || null,
            bank_account_id: c.bankAccountId || null
          })));
          await pruneScoped('finance_goal_contributions', goalsList.flatMap(g => (g.contributions || []).map(c => c.id)));
          if (contribs.length > 0) {
            await supabase.from('finance_goal_contributions').upsert(contribs, { onConflict: 'id' });
          }
        }
      } else if (key === 'accounts') {
        // `debts` is optional so the existing account/membership/score callers
        // don't all have to thread it through; fall back to current state.
        const accsObj = contentData as { bankAccounts: BankAccount[]; memberships: Membership[]; creditScores: CreditScores; debts?: Debt[] };
        const debtsToSave = accsObj.debts ?? debts;
        await pruneScoped('finance_bank_accounts', (accsObj.bankAccounts || []).map(a => a.id));
        if (accsObj.bankAccounts?.length > 0) {
          await supabase.from('finance_bank_accounts').upsert(accsObj.bankAccounts.map(a => ({
            id: a.id,
            is_default: false,
            profile_id: profileId,
            name: a.name,
            type: a.type,
            issuer: a.issuer || null,
            balance: a.balance,
            annual_fee: a.annualFee,
            use_case: a.useCase || null,
            emoji: a.emoji || null,
            color: a.color || null
          })), { onConflict: 'id' });
        }
        await pruneScoped('finance_memberships', (accsObj.memberships || []).map(m => m.id));
        if (accsObj.memberships?.length > 0) {
          await supabase.from('finance_memberships').upsert(accsObj.memberships.map(m => ({
            id: m.id,
            is_default: false,
            profile_id: profileId,
            name: m.name,
            type: m.type,
            status: m.status || null,
            annual_fee: m.annualFee,
            use_case: m.useCase || null
          })), { onConflict: 'id' });
        }
        await pruneScoped('finance_debts', debtsToSave.map(d => d.id));
        if (debtsToSave.length > 0) {
          await supabase.from('finance_debts').upsert(debtsToSave.map(d => ({
            id: d.id,
            is_default: false,
            profile_id: profileId,
            name: d.name,
            type: d.type,
            lender: d.lender || null,
            original_amount: d.originalAmount,
            balance: d.balance,
            interest_rate: d.interestRate,
            min_payment: d.minPayment,
            start_date: d.startDate || null,
            payoff_date: d.payoffDate || null,
            repayment_type: d.repaymentType || 'amortising',
            student_loan_plan: d.studentLoanPlan || null,
            write_off_years: d.writeOffYears ?? null,
            draws: d.draws as unknown as Json,
            notes: d.notes || null,
            emoji: d.emoji || null,
            color: d.color || null
          })), { onConflict: 'id' });
        }
        const scores = [
          ...(accsObj.creditScores?.experian || []).map(s => ({ ...s, bureau: 'experian' })),
          ...(accsObj.creditScores?.transunion || []).map(s => ({ ...s, bureau: 'transunion' })),
          ...(accsObj.creditScores?.equifax || []).map(s => ({ ...s, bureau: 'equifax' }))
        ];
        await pruneScoped('finance_credit_scores', scores.map(s => s.id));
        if (scores.length > 0) {
          await supabase.from('finance_credit_scores').upsert(scores.map(s => ({
            id: s.id,
            is_default: false,
            profile_id: profileId,
            bureau: s.bureau,
            date: s.date,
            score: s.score
          })), { onConflict: 'id' });
        }
      } else if (key === 'budget') {
        const budgetCats = contentData as BudgetCategory[];
        await pruneScoped('finance_budget_items', budgetCats.flatMap(c => (c.items || []).map(i => i.id)), false);
        await pruneScoped('finance_budget_categories', budgetCats.map(c => c.id), false);
        if (budgetCats.length > 0) {
          await supabase.from('finance_budget_categories').upsert(budgetCats.map(c => ({
            id: c.id,
            is_default: false,
            profile_id: profileId,
            is_template: false,
            name: c.name,
            budgeted: c.budgeted,
            group_type: c.group || null,
            emoji: c.emoji || null
          })), { onConflict: 'id' });
          const items = budgetCats.flatMap(c => (c.items || []).map(i => ({
            id: i.id,
            is_default: false,
            profile_id: profileId,
            is_template: false,
            category_id: c.id,
            name: i.name,
            budgeted: i.budgeted,
            spent: i.spent,
            linked_account_id: i.linkedAccountId || null,
            emoji: i.emoji || null
          })));
          if (items.length > 0) {
            await supabase.from('finance_budget_items').upsert(items, { onConflict: 'id' });
          }
        }
      } else if (key === 'recurrings') {
        const recurringsList = contentData as RecurringBill[];
        await pruneScoped('finance_recurring_bills', recurringsList.map(r => r.id));
        if (recurringsList.length > 0) {
          await supabase.from('finance_recurring_bills').upsert(recurringsList.map(r => ({
            id: r.id,
            is_default: false,
            profile_id: profileId,
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
          })), { onConflict: 'id' });
        }
      } else if (key === 'transactions') {
        const txList = contentData as MockTransaction[];
        await pruneScoped('finance_transactions', txList.map(t => t.id));
        if (txList.length > 0) {
          await supabase.from('finance_transactions').upsert(txList.map(t => ({
            id: t.id,
            is_default: false,
            profile_id: profileId,
            name: t.name,
            // Round-tripped rather than left to the upsert's defaults: an
            // omitted column would be fine on conflict but NULLs the row on
            // an insert, which is how a synced merchant would quietly vanish.
            merchant: t.merchant || null,
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
          })), { onConflict: 'id' });
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
          student_loan_thresholds: tcObj.studentLoanThresholds as never,
          student_loan_rates: tcObj.studentLoanRates as never,
          income_tax_bands: tcObj.incomeTaxBands as never,
          national_insurance_bands: tcObj.nationalInsuranceBands as never,
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
        await pruneScoped('finance_budget_items', defaultBudgetCats.flatMap(c => (c.items || []).map(i => i.id)), true);
        await pruneScoped('finance_budget_categories', defaultBudgetCats.map(c => c.id), true);
        if (defaultBudgetCats.length > 0) {
          await supabase.from('finance_budget_categories').upsert(defaultBudgetCats.map(c => ({
            id: c.id,
            is_default: false,
            profile_id: profileId,
            is_template: true,
            name: c.name,
            budgeted: c.budgeted,
            group_type: c.group || null,
            emoji: c.emoji || null
          })), { onConflict: 'id' });
          const items = defaultBudgetCats.flatMap(c => (c.items || []).map(i => ({
            id: i.id,
            is_default: false,
            profile_id: profileId,
            is_template: true,
            category_id: c.id,
            name: i.name,
            budgeted: i.budgeted,
            spent: i.spent,
            linked_account_id: i.linkedAccountId || null,
            emoji: i.emoji || null
          })));
          if (items.length > 0) {
            await supabase.from('finance_budget_items').upsert(items, { onConflict: 'id' });
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

  const value = {
    transfers,
    saveTransfer,
    deleteTransfer,
    payslips,
    savePayslip,
    deletePayslip,
    updateProfile,
    netWorthHistory,
    profiles,
    setProfiles,
    fetchingHolidays,
    setFetchingHolidays,
    bankHolidaysList,
    setBankHolidaysList,
    bankHolidaysMap,
    setBankHolidaysMap,
    breakdownRateMode,
    setBreakdownRateMode,
    includeWorkLeaveInActual,
    setIncludeWorkLeaveInActual,
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
  };

  return value;
}

type FinanceDataValue = ReturnType<typeof useProvideFinanceData>;

const FinanceDataContext = createContext<FinanceDataValue | null>(null);

export function FinanceDataProvider({ children }: { children: ReactNode }) {
  return (
    <FinanceDataContext.Provider value={useProvideFinanceData()}>
      {children}
    </FinanceDataContext.Provider>
  );
}

/** Throws rather than returning undefined, so a surface rendered outside the
 *  provider fails loudly at the point of the mistake. */
export function useFinanceData() {
  const ctx = useContext(FinanceDataContext);
  if (!ctx) throw new Error('useFinanceData must be used inside FinanceDataProvider');
  return ctx;
}

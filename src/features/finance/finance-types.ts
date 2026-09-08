import type { DebtObservation, RatePeriod, StudentLoanPlanKey } from '@/lib/finance';
export type { DebtObservation, RatePeriod };

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

export interface PackageBenefit {
  id: string;
  name: string;
  amount: number;
  type: 'monetary' | 'percentage';
  emoji?: string;
  notes?: string;
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
  /** The profile's emergency reserve. At most one goal per profile. */
  isEmergencyFund?: boolean;
  /** What the goal is meant to receive each month. 0 means unfunded. */
  monthlyContribution?: number;
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
  /** Who the bank said was paid. Sync-written, never edited; see the
   *  `merchant` column comment in 20260907170000_transaction_merchant.sql. */
  merchant?: string;
  category: string;
  amount: number;
  date: string;
  isReviewed: boolean;
  bankAccountId?: string;
  goalId?: string;
  notes?: string;
  tags?: string[];
  isRecurring?: boolean;
  accountId?: string;
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

export interface CategoryPreset {
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

export interface TimeSpentInputs {
  sleepHoursPerDay: number;
  commuteDaysPerWeek: number;
  commuteHoursPerDay: number;
  gettingReadyHoursPerDay: number;
  gymDaysPerWeek: number;
  gymHoursPerSession: number;
  learningHoursPerWeek: number;
  friendsHoursPerWeek: number;
}

export interface TrueLayerConnection {
  id: string;
  provider_id: string;
  provider_name: string;
  provider_logo_uri: string | null;
  consent_expires_at: string | null;
  last_synced_at: string | null;
  backfilled_from: string | null;
  backfill_complete: boolean;
  expires_at: string | null;
  created_at?: string;
}

export interface TrueLayerStatus {
  connected: boolean;
  connections?: TrueLayerConnection[];
  expires_at: string | null;
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

export interface DebtDraw {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  label?: string; // e.g. "Year 1 tuition"
}

export interface Debt {
  id: string;
  name: string;
  type: 'mortgage' | 'student' | 'auto' | 'personal' | 'credit' | 'other';
  lender: string;
  originalAmount: number; // Amount borrowed; derived from draws when present
  balance: number; // Outstanding amount owed, stored positive (cached view of latest observation)
  interestRate: number; // Annual percentage rate
  minPayment: number; // Contractual monthly payment (amortising debts)
  startDate?: string; // When the debt was taken on (YYYY-MM-DD)
  payoffDate?: string; // Expected final payment (YYYY-MM-DD)
  // 'amortising' = fixed monthly payment (mortgage, car, personal loan).
  // 'income_contingent' = UK student loan: % of income above a threshold,
  // written off after a set number of years.
  // 'pcp' = car finance with balloon payment (finalPayment).
  repaymentType: 'amortising' | 'income_contingent' | 'pcp';
  studentLoanPlan?: StudentLoanPlanKey;
  writeOffYears?: number; // income_contingent only
  draws: DebtDraw[];
  ratePeriods?: RatePeriod[];
  finalPayment?: number;
  observations?: DebtObservation[];
  notes?: string;
  emoji?: string;
  color?: string;
}

export interface FinanceProfile {
  id: string;
  name: string;
  isSelf: boolean;
  isPublic: boolean;
  emoji: string | null;
  currency: string;
  region: string;
  /** Year of birth; null until set. A year is all the projection needs. */
  birthYear: number | null;
  retirementAge: number;
  /** Assumed annual growth after inflation. */
  pensionGrowthPercent: number;
}

/**
 * The seeded template rows, keyed by the collection they belong to.
 *
 * These are the `is_default` rows: what a fresh profile starts from. Typed
 * explicitly rather than as a bag of `any`, so a caller reaching for a key that
 * is never populated is a compile error rather than an undefined at runtime.
 */
export interface DatabaseDefaults {
  settings?: FinanceSettings;
  tax_config?: TaxConfig;
  recurring_templates?: RecurringTemplate[];
  credit_bureaus?: CreditBureauConfig[];
  default_budget_categories?: BudgetCategory[];
  budget_presets?: Record<string, CategoryPreset[]>;
  holiday_defaults?: Record<number, { count: number; dates: string; occasion: string }>;
  goals?: Goal[];
  accounts?: { bankAccounts?: BankAccount[]; memberships?: Membership[]; creditScores?: CreditScores };
  budget?: BudgetCategory[];
  recurrings?: RecurringBill[];
  transactions?: MockTransaction[];
}

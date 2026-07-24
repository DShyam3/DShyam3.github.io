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

export interface TrueLayerStatus {
  connected: boolean;
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



/**
 * One builder each way per table saved row by row: the load maps a stored row
 * to what the page shows (`…FromRow`), a save maps it back (`…Row`).
 *
 * A save decides what changed by comparing rows built by the `…Row` half, and
 * the load records what it read through the same half. So a value stored
 * differently from how the page shows it -- NULL for a fee shown as 0, a
 * synced transaction with only `account_id` set -- reads the same both ways
 * and never looks like an edit. `asLoaded` runs a stored row through both
 * halves, for comparing a row fetched outside the load.
 */

import type { Json, Tables, TablesInsert } from '@/integrations/supabase/types';
import type { StudentLoanPlanKey } from '@/lib/finance';
import type {
  BankAccount,
  CreditScoreEntry,
  CreditScores,
  Debt,
  DebtDraw,
  Goal,
  Membership,
  MockTransaction,
  RatePeriod,
  UserHoliday,
} from './finance-types';
import { asAccountType, asDebtType, asHalfDay, asMembershipType } from './finance-narrow';

export type GoalContribution = Goal['contributions'][number];
export type Bureau = keyof CreditScores;

// ─── Transactions ───────────────────────────────────────────────────────────

export const transactionFromRow = (t: Pick<Tables<'finance_transactions'>,
  'id' | 'name' | 'merchant' | 'category' | 'amount' | 'date' | 'is_reviewed' | 'account_id'
  | 'bank_account_id' | 'goal_id' | 'notes' | 'tags' | 'is_recurring'> & { provider_category?: string | null }): MockTransaction => ({
  id: t.id,
  name: t.name,
  merchant: t.merchant || undefined,
  providerCategory: t.provider_category || undefined,
  category: t.category || '',
  amount: Number(t.amount) || 0,
  date: t.date,
  isReviewed: t.is_reviewed,
  accountId: t.account_id || t.bank_account_id || undefined,
  bankAccountId: t.bank_account_id || t.account_id || undefined,
  goalId: t.goal_id || undefined,
  notes: t.notes || undefined,
  tags: t.tags || undefined,
  isRecurring: t.is_recurring || undefined,
});

export const transactionRow = (t: MockTransaction, profileId: string) => ({
  id: t.id,
  is_default: false,
  profile_id: profileId,
  name: t.name,
  // Round-tripped rather than left to the upsert's defaults: an omitted
  // column would be fine on conflict but NULLs the row on an insert, which is
  // how a synced merchant would quietly vanish.
  merchant: t.merchant || null,
  // provider_category is left out on purpose: only the sync writes it, an
  // update leaves an omitted column alone, and a row this client inserts is
  // manual, so NULL is the right value there.
  category: t.category || null,
  amount: t.amount,
  date: t.date,
  is_reviewed: t.isReviewed,
  account_id: t.accountId || t.bankAccountId || null,
  bank_account_id: t.bankAccountId || t.accountId || null,
  goal_id: t.goalId || null,
  notes: t.notes || null,
  tags: t.tags || null,
  is_recurring: t.isRecurring || false,
}) satisfies TablesInsert<'finance_transactions'>;

// ─── Bank accounts ──────────────────────────────────────────────────────────

export const bankAccountFromRow = (a: Pick<Tables<'finance_bank_accounts'>,
  'id' | 'name' | 'type' | 'issuer' | 'balance' | 'annual_fee' | 'credit_limit' | 'use_case' | 'emoji' | 'color'>): BankAccount => ({
  id: a.id,
  name: a.name,
  type: asAccountType(a.type),
  issuer: a.issuer || '',
  balance: Number(a.balance) || 0,
  annualFee: Number(a.annual_fee) || 0,
  creditLimit: a.credit_limit === null || a.credit_limit === undefined ? null : Number(a.credit_limit),
  useCase: a.use_case || undefined,
  emoji: a.emoji || undefined,
  color: a.color || undefined,
});

export const bankAccountRow = (a: BankAccount, profileId: string) => ({
  id: a.id,
  is_default: false,
  profile_id: profileId,
  name: a.name,
  type: a.type,
  issuer: a.issuer || null,
  balance: a.balance,
  annual_fee: a.annualFee,
  credit_limit: a.creditLimit ?? null,
  use_case: a.useCase || null,
  emoji: a.emoji || null,
  color: a.color || null,
}) satisfies TablesInsert<'finance_bank_accounts'>;

// ─── Goals and their contributions ──────────────────────────────────────────

export const contributionFromRow = (c: Pick<Tables<'finance_goal_contributions'>,
  'id' | 'amount' | 'date' | 'note' | 'bank_account_id'>): GoalContribution => ({
  id: c.id,
  amount: Number(c.amount) || 0,
  date: c.date,
  note: c.note || undefined,
  bankAccountId: c.bank_account_id || undefined,
});

/** A contribution as saved: the goal it belongs to is part of the row. */
export interface ContributionOfGoal {
  contribution: GoalContribution;
  goalId: string;
}

/** Every goal's contributions, each with the goal it belongs to. */
export const contributionsOf = (goals: readonly Goal[]): ContributionOfGoal[] =>
  goals.flatMap(goal => (goal.contributions || []).map(contribution => ({ contribution, goalId: goal.id })));

export const contributionRow = ({ contribution: c, goalId }: ContributionOfGoal, profileId: string) => ({
  id: c.id,
  is_default: false,
  profile_id: profileId,
  goal_id: goalId,
  amount: c.amount,
  date: c.date,
  note: c.note || null,
  bank_account_id: c.bankAccountId || null,
}) satisfies TablesInsert<'finance_goal_contributions'>;

export const goalFromRow = (g: Pick<Tables<'finance_goals'>,
  'id' | 'name' | 'target_amount' | 'current_amount' | 'target_date' | 'is_emergency_fund'
  | 'monthly_contribution' | 'start_date' | 'status' | 'emoji'>, contributions: GoalContribution[]): Goal => ({
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
  contributions,
});

/** Contributions are saved as their own rows, so the goal row leaves them out. */
export const goalRow = (g: Goal, profileId: string) => ({
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
  emoji: g.emoji || null,
}) satisfies TablesInsert<'finance_goals'>;

// ─── Memberships ────────────────────────────────────────────────────────────

export const membershipFromRow = (m: Pick<Tables<'finance_memberships'>,
  'id' | 'name' | 'type' | 'status' | 'annual_fee' | 'use_case'>): Membership => ({
  id: m.id,
  name: m.name,
  type: asMembershipType(m.type),
  status: m.status || '',
  annualFee: Number(m.annual_fee) || 0,
  useCase: m.use_case || undefined,
});

export const membershipRow = (m: Membership, profileId: string) => ({
  id: m.id,
  is_default: false,
  profile_id: profileId,
  name: m.name,
  type: m.type,
  status: m.status || null,
  annual_fee: m.annualFee,
  use_case: m.useCase || null,
}) satisfies TablesInsert<'finance_memberships'>;

// ─── Debts ──────────────────────────────────────────────────────────────────

/** The debt as stored. The load then takes its balance from the latest
 *  observation where there is one, and attaches the observations. */
export const debtFromRow = (d: Pick<Tables<'finance_debts'>,
  'id' | 'name' | 'type' | 'lender' | 'original_amount' | 'balance' | 'interest_rate' | 'min_payment'
  | 'start_date' | 'payoff_date' | 'repayment_type' | 'student_loan_plan' | 'write_off_years' | 'draws'
  | 'rate_periods' | 'final_payment' | 'notes' | 'emoji' | 'color' | 'course_end_date'>): Debt => ({
  id: d.id,
  name: d.name,
  type: asDebtType(d.type),
  lender: d.lender || '',
  originalAmount: Number(d.original_amount) || 0,
  balance: Number(d.balance) || 0,
  interestRate: Number(d.interest_rate) || 0,
  minPayment: Number(d.min_payment) || 0,
  startDate: d.start_date || undefined,
  courseEndDate: d.course_end_date || undefined,
  payoffDate: d.payoff_date || undefined,
  repaymentType: (d.repayment_type as Debt['repaymentType']) || 'amortising',
  studentLoanPlan: (d.student_loan_plan as StudentLoanPlanKey) || undefined,
  writeOffYears: d.write_off_years ?? undefined,
  draws: Array.isArray(d.draws) ? (d.draws as unknown as DebtDraw[]) : [],
  ratePeriods: Array.isArray(d.rate_periods) ? (d.rate_periods as unknown as RatePeriod[]) : [],
  finalPayment: Number(d.final_payment) || 0,
  observations: [],
  notes: d.notes || undefined,
  emoji: d.emoji || undefined,
  color: d.color || undefined,
});

export const debtRow = (d: Debt, profileId: string) => ({
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
  // Always sent, so clearing it is saved.
  course_end_date: d.courseEndDate || null,
  payoff_date: d.payoffDate || null,
  repayment_type: d.repaymentType || 'amortising',
  student_loan_plan: d.studentLoanPlan || null,
  write_off_years: d.writeOffYears ?? null,
  draws: d.draws as unknown as Json,
  rate_periods: (d.ratePeriods || []) as unknown as Json,
  final_payment: d.finalPayment || 0,
  notes: d.notes || null,
  emoji: d.emoji || null,
  color: d.color || null,
}) satisfies TablesInsert<'finance_debts'>;

// ─── Credit scores ──────────────────────────────────────────────────────────

export const creditScoreFromRow = (s: Pick<Tables<'finance_credit_scores'>,
  'id' | 'date' | 'score' | 'storage_path'>): CreditScoreEntry => ({
  id: s.id,
  date: s.date,
  score: s.score,
  storagePath: s.storage_path ?? undefined,
});

/** A score as saved: the bureau it is filed under is part of the row. */
export interface ScoreOfBureau {
  score: CreditScoreEntry;
  bureau: Bureau;
}

export const BUREAUS: readonly Bureau[] = ['experian', 'transunion', 'equifax'];

/** Every bureau's scores, each with the bureau it is filed under. */
export const scoresOf = (scores: CreditScores): ScoreOfBureau[] =>
  BUREAUS.flatMap(bureau => (scores[bureau] || []).map(score => ({ score, bureau })));

export const creditScoreRow = ({ score: s, bureau }: ScoreOfBureau, profileId: string) => ({
  id: s.id,
  is_default: false,
  profile_id: profileId,
  bureau,
  date: s.date,
  score: s.score,
  storage_path: s.storagePath || null,
}) satisfies TablesInsert<'finance_credit_scores'>;

// ─── Leave ──────────────────────────────────────────────────────────────────

export const holidayFromRow = (h: Pick<Tables<'finance_user_holidays'>,
  'id' | 'start_date' | 'end_date' | 'occasion' | 'count' | 'type' | 'half_day'>): UserHoliday => {
  const halfDay = asHalfDay(h.half_day);
  return {
    id: h.id,
    startDate: h.start_date,
    endDate: h.end_date,
    occasion: h.occasion || '',
    count: Number(h.count) || 0,
    type: (h.type as 'holiday' | 'sick') || 'holiday',
    ...(halfDay ? { halfDay } : {}),
  };
};

/** half_day is always sent, so turning a half day back into a full one clears it. */
export const holidayRow = (h: UserHoliday, profileId: string) => ({
  id: h.id,
  is_default: false,
  profile_id: profileId,
  start_date: h.startDate,
  end_date: h.endDate,
  occasion: h.occasion || null,
  count: h.count,
  type: h.type || 'holiday',
  half_day: h.halfDay ?? null,
}) satisfies TablesInsert<'finance_user_holidays'>;

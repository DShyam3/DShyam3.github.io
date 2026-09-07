/**
 * Narrowing values that arrive from the database as plain text.
 *
 * Postgres stores an account's type, a bill's frequency, a category's group and
 * the rest as `text`. TypeScript narrows them to unions. Bridging that with
 * `as any` at each read site asserts something nothing checks -- and the column
 * genuinely can hold anything, since no CHECK constrains it and rows predate
 * several of these unions.
 *
 * Each function below falls back to a sensible member rather than letting an
 * unexpected value through typed as if it were valid, so a stray row degrades
 * one field instead of breaking a screen.
 */

import type {
  BankAccount,
  BudgetCategory,
  CreditBureauConfig,
  Debt,
  FinanceSettings,
  Membership,
  RecurringBill,
} from '@/features/finance/finance-types';

const oneOf = <T extends string>(allowed: readonly T[], fallback: T) =>
  (value: string | null | undefined): T =>
    allowed.includes(value as T) ? (value as T) : fallback;

export const asAccountType = oneOf<BankAccount['type']>(
  ['checking', 'savings', 'credit', 'investment'],
  'checking',
);

export const asFrequency = oneOf<RecurringBill['frequency']>(
  ['monthly', 'annually', 'quarterly', 'weekly'],
  'monthly',
);

export const asBudgetGroup = oneOf<BudgetCategory['group']>(
  ['needs', 'wants', 'savings'],
  'needs',
);

export const asPensionType = oneOf<FinanceSettings['pensionType']>(
  ['net_pay', 'salary_sacrifice', 'relief_at_source'],
  'net_pay',
);

export const asStudentLoanPlan = oneOf<FinanceSettings['studentLoanPlan']>(
  ['none', 'plan1', 'plan2', 'plan4', 'plan5', 'postgrad'],
  'none',
);

export const asBureauKey = oneOf<CreditBureauConfig['key']>(
  ['experian', 'transunion', 'equifax'],
  'experian',
);

export const asDebtType = oneOf<Debt['type']>(
  ['mortgage', 'student', 'auto', 'personal', 'credit', 'other'],
  'other',
);

export const asMembershipType = oneOf<Membership['type']>(
  ['points', 'cashback', 'miles', 'perks'],
  'perks',
);

export const asUkRegion = oneOf<FinanceSettings['ukRegion']>(
  ['england-and-wales', 'scotland', 'northern-ireland'],
  'england-and-wales',
);

export const asPaydaySchedule = oneOf<NonNullable<FinanceSettings['paydaySchedule']>>(
  ['monthly_date', 'last_working_day', 'last_friday', 'biweekly', 'weekly', 'semimonthly'],
  'monthly_date',
);

/**
 * A jsonb column read back as a known shape.
 *
 * The generated type for jsonb is `Json`, which is accurate and unusable: the
 * shape lives in the application, not the column. This is still an assertion,
 * but a named one that says which columns are being trusted and why, rather
 * than `as any` scattered at each site.
 */
export const fromJsonb = <T>(value: unknown, fallback: T): T =>
  value === null || value === undefined ? fallback : (value as T);

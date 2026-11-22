import { supabase } from '@/integrations/supabase/client';
import type { FinanceProfile } from '@/features/finance/finance-types';
import type { StudentLoanRateRow } from '@/lib/finance';

export type BreakdownRateMode = 'normal' | 'including_leave' | 'excluding_leave';
export type PayslipSaveOutcome = 'saved' | 'failed' | 'unknown';

/** A published student loan rate row as stored: shipped (`isDefault`) or entered by you. */
export type StoredStudentLoanRate = StudentLoanRateRow & { id: string; isDefault: boolean; source?: string };

/**
 * One `finance_profiles` row as the app's own shape.
 *
 * Module-level because two callers map it -- the profile resolution that runs
 * before the bulk load, and the bulk load's own refresh of the switcher -- and
 * two copies of the defaulting below would drift.
 *
 * Every optional column is defaulted rather than assumed present, so a row
 * read during the window where a migration adding one is written but not yet
 * applied degrades instead of throwing.
 */
/**
 * Every column `toFinanceProfile` reads, and nothing else. Named rather than
 * `*` so a column added later -- `owner_user_id` already rides along unused --
 * does not reach the client until something here asks for it. A migration
 * adding a column the client reads must land before the client does; the
 * failure is a loud toast, not an empty switcher.
 */
export const readTaxConfigs = () =>
  supabase.from('finance_tax_configs').select('id, is_default, effective_from, student_loan_thresholds, student_loan_rates, income_tax_bands, national_insurance_bands');
export const readRecurringTemplates = () =>
  supabase.from('finance_recurring_templates').select('id, is_default, name, category, emoji, tag, default_amount, frequency, linked_budget_item_id, budget_category_name');
export const readCreditBureaus = () =>
  supabase.from('finance_credit_bureaus').select('id, is_default, key, label, emoji, color, max_score, gradient');
export const readHolidayDefaults = () =>
  supabase.from('finance_holiday_defaults').select('id, is_default, month_index, count, dates, occasion');
export const readBudgetPresets = () =>
  supabase.from('finance_budget_presets').select('id, is_default, preset_type, name, emoji, group_type');

export interface ReferenceTablesCache {
  taxConfigsRes: Awaited<ReturnType<typeof readTaxConfigs>>;
  recurringTemplatesRes: Awaited<ReturnType<typeof readRecurringTemplates>>;
  creditBureausRes: Awaited<ReturnType<typeof readCreditBureaus>>;
  holidayDefaultsRes: Awaited<ReturnType<typeof readHolidayDefaults>>;
  budgetPresetsRes: Awaited<ReturnType<typeof readBudgetPresets>>;
}

export const FINANCE_PROFILE_COLUMNS =
  'id, name, is_self, is_public, emoji, currency, region, birth_year, retirement_age, pension_growth_percent';

export const toFinanceProfile = (row: {
  id: string;
  name: string;
  is_self: boolean;
  is_public: boolean;
  emoji: string | null;
  currency: string;
  region: string;
  birth_year: number | null;
  retirement_age: number | null;
  pension_growth_percent: number | string | null;
}): FinanceProfile => ({
  id: row.id,
  name: row.name,
  isSelf: row.is_self,
  isPublic: row.is_public,
  emoji: row.emoji,
  currency: row.currency,
  region: row.region,
  birthYear: row.birth_year ?? null,
  retirementAge: row.retirement_age ?? 68,
  pensionGrowthPercent: Number(row.pension_growth_percent ?? 4.5),
});

/**
 * The `saveDataToSupabase` keys whose rows carry a `profile_id`.
 *
 * Listed rather than inferred, and as an allowlist rather than a list of
 * exceptions: a key added here without a profile_id column fails loudly on the
 * first save, whereas a denylist would silently let a new ledger table be
 * written unscoped. The rest -- tax_config, recurring_templates,
 * credit_bureaus, holiday_defaults, budget_presets -- are the shared reference
 * tables from 7.E-pre2 and have no profile_id at all.
 */
export const PROFILE_SCOPED_SAVE_KEYS = new Set([
  'settings',
  'goals',
  'accounts',
  'investments',
  'investment-activities',
  'budget',
  'recurrings',
  'transactions',
]);

export const todayInLocalTimezone = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * What a failed table load leaves on screen.
 *
 * The finance load sets each table's state only when its read succeeded, so a
 * failure keeps whatever was there. On a refresh of the same profile that is
 * the profile's own rows from the last load: older, but its own. After a
 * profile switch it is the previous profile's rows, shown under the new
 * profile's name -- the wrong ledger, and nothing on screen says so.
 *
 * These rules decide which failed tables to empty, which to report as not
 * loaded, and which honestly show an earlier load. Saves are refused for a
 * failed table either way (save-safety.ts); this is only about what is shown.
 */

/**
 * Read with no profile scope: every profile is shown the same rows, so after
 * a switch what is on screen is still right, and a failed read keeps it --
 * once it has loaded at all. Before that the page holds code fallbacks, which
 * for tax rates are empty: student loan rules read a repayment threshold of
 * £0, and the rate editor has nothing to show.
 */
const SHARED_TABLES: ReadonlySet<string> = new Set([
  'tax_configs',
  'recurring_templates',
  'credit_bureaus',
  'holiday_defaults',
  'budget_presets',
]);

/**
 * Tables shown as one collection: a goal carries its contributions, a budget
 * category its items. The load sets the pair only when both reads succeed, so
 * the pair is loaded or not as a whole.
 */
const COLLECTION_OF: Readonly<Record<string, string>> = {
  goal_contributions: 'goals',
  budget_items: 'budget_categories',
};

/** True for a table every profile is shown the same: not "for" any one. */
export const isSharedTable = (table: string): boolean => SHARED_TABLES.has(table);

/** The collection a table is shown as; a table on its own is its own. */
export const collectionOf = (table: string): string => COLLECTION_OF[table] ?? table;

/** Every profile collection the finance load reads, in display order. */
export const PROFILE_COLLECTIONS: readonly string[] = [
  'settings',
  'user_holidays',
  'goals',
  'bank_accounts',
  'investment_holdings',
  'investment_activities',
  'memberships',
  'debts',
  'debt_observations',
  'credit_scores',
  'budget_categories',
  'recurring_bills',
  'transactions',
  'category_rules',
];

/** How each collection or list is named to the owner. */
const LABELS: Readonly<Record<string, string>> = {
  settings: 'income settings',
  user_holidays: 'holidays',
  goals: 'goals',
  bank_accounts: 'bank accounts',
  investment_holdings: 'investments',
  investment_activities: 'investment activity',
  memberships: 'memberships',
  debts: 'debts',
  debt_observations: 'debt balances',
  credit_scores: 'credit scores',
  budget_categories: 'budget',
  recurring_bills: 'bills',
  transactions: 'transactions',
  category_rules: 'category rules',
  tax_configs: 'tax rates',
  recurring_templates: 'bill templates',
  credit_bureaus: 'credit bureau settings',
  holiday_defaults: 'holiday defaults',
  budget_presets: 'budget presets',
  // Lists loaded on their own, beside the main load.
  transfers: 'transfers between profiles',
  payslips: 'payslips',
  payslip_reconciliations: 'payslip matches',
  payslip_reimbursement_links: 'payslip reimbursements',
  net_worth_history: 'net worth history',
};

export interface FailedLoadInput {
  /** Tables whose read failed in this load. */
  failed: readonly string[];
  /** The profile whose load last finished: whose rows are on screen. */
  rowsOnScreenFor: string | null;
  /** The profile this load read. */
  loadingFor: string;
  /** Collections reported as not loaded for `loadingFor` before this load. */
  previous: readonly string[];
  /** Shared tables that have loaded at least once this session. */
  sharedLoaded: ReadonlySet<string>;
}

export interface FailedLoadPlan {
  /** Failed profile tables to empty: their rows on screen are not this profile's. */
  clear: string[];
  /** Collections and shared tables to report as not loaded. */
  unloaded: string[];
  /** Failed tables still showing an earlier load of their own. */
  kept: string[];
}

/**
 * Applies the rules to one load's failures.
 *
 * - Rows on screen belong to another profile, or to no load (the first, or
 *   one after a load that threw): every failed profile table is emptied and
 *   reported.
 * - A refresh of the same profile empties nothing. A collection already
 *   reported stays reported while any of its tables still fails, and is
 *   dropped once it loads. A collection that loaded earlier and fails now
 *   keeps that load's rows, which are this profile's own.
 * - A shared table is reported only until it has loaded once.
 */
export function planFailedLoad(input: FailedLoadInput): FailedLoadPlan {
  const { failed, rowsOnScreenFor, loadingFor, previous, sharedLoaded } = input;
  const sameProfile = rowsOnScreenFor === loadingFor;
  const failedProfileTables = failed.filter(table => !SHARED_TABLES.has(table));
  const clear = sameProfile ? [] : failedProfileTables;
  const failingCollections = new Set(failedProfileTables.map(collectionOf));
  const profileUnloaded = sameProfile
    ? previous.filter(collection => failingCollections.has(collection))
    : [...failingCollections];
  const sharedUnloaded = failed.filter(table => SHARED_TABLES.has(table) && !sharedLoaded.has(table));
  const unloaded = [...profileUnloaded, ...sharedUnloaded];
  const unloadedSet = new Set(unloaded);
  const kept = failed.filter(table => !unloadedSet.has(collectionOf(table)));
  return { clear, unloaded, kept };
}

/** True when nothing this profile owns loaded: the load threw part-way. */
export const coversAllProfileData = (unloaded: readonly string[]): boolean =>
  PROFILE_COLLECTIONS.every(collection => unloaded.includes(collection));

/** "bank accounts, transactions": one name per label, in the order given. */
export function describeTables(tables: readonly string[]): string {
  const labels = tables.map(table => LABELS[collectionOf(table)] ?? table.replace(/_/g, ' '));
  return [...new Set(labels)].join(', ');
}

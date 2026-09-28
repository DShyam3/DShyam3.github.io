/**
 * Rules that stop a save overwriting rows it never read.
 *
 * Most collections are saved whole: what is on screen is upserted on `id`
 * and this profile's rows that are not on screen are pruned. That is only
 * safe when what is on screen is what the database holds for this profile.
 * Ways it was not:
 *
 * - A collection whose load failed keeps whatever state it had -- the initial
 *   defaults, or an empty list -- and a save then pruned every stored row.
 * - Budget and bill ids are each table's whole primary key, shared by every
 *   profile and by the shared default rows. A profile shown a shared default
 *   (`h1`) or a code default another profile has already saved (`item_rent`)
 *   took that row over on its first save: moved to itself and overwritten.
 * - The bank sync also writes transactions and bank accounts, so a list on
 *   screen can predate rows the server gained or changed. Those two are never
 *   saved whole: only edited rows, only their changed columns, and deletes
 *   only by id (`rowsToWrite`, `planRowWrites`).
 */

import type { BudgetCategory, RecurringBill } from '@/features/finance/finance-types';

/**
 * The save keys a failed table load makes unsafe: every key whose save
 * writes that table. A table missing here is written by
 * something other than `saveDataToSupabase` and needs no guard.
 */
const SAVE_KEYS_BY_TABLE: Readonly<Record<string, readonly string[]>> = {
  settings: ['settings'],
  user_holidays: ['settings'],
  goals: ['goals'],
  goal_contributions: ['goals'],
  bank_accounts: ['accounts'],
  memberships: ['accounts'],
  debts: ['accounts'],
  credit_scores: ['accounts'],
  investment_holdings: ['investments'],
  investment_activities: ['investment-activities'],
  budget_categories: ['budget'],
  budget_items: ['budget'],
  recurring_bills: ['recurrings'],
  transactions: ['transactions'],
  tax_configs: ['tax_config'],
  recurring_templates: ['recurring_templates'],
  credit_bureaus: ['credit_bureaus'],
  holiday_defaults: ['holiday_defaults'],
  budget_presets: ['budget_presets'],
};

/** Save keys to refuse until a load of their tables succeeds. */
export const saveKeysBlockedBy = (failedTables: readonly string[]): Set<string> =>
  new Set(failedTables.flatMap(table => SAVE_KEYS_BY_TABLE[table] ?? []));

/**
 * Every guarded key: refused before the first load lands and while a load for
 * a newly selected profile is in flight, when what is on screen is the
 * initial defaults or the previous profile's rows.
 */
export const ALL_GUARDED_SAVE_KEYS: ReadonlySet<string> = saveKeysBlockedBy(Object.keys(SAVE_KEYS_BY_TABLE));

const SCOPE_SEPARATOR = '__';

/** `sourceId` made unique to one profile. Idempotent. */
export const profileScopedId = (sourceId: string, profileId: string): string => {
  const suffix = `${SCOPE_SEPARATOR}${profileId}`;
  return sourceId.endsWith(suffix) ? sourceId : `${sourceId}${suffix}`;
};

/** The template id a scoped id was made from; any other id unchanged. */
export const unscopedId = (id: string): string => {
  const at = id.indexOf(SCOPE_SEPARATOR);
  return at === -1 ? id : id.slice(0, at);
};

/**
 * Gives every category this profile did not load as its own row -- a shared
 * default, or a code default merged in -- and its items an id scoped to the
 * profile, so saving it writes a new row rather than taking over an existing
 * one. The profile's own categories keep their ids.
 */
export const materialiseBudgetForProfile = (
  categories: BudgetCategory[],
  ownCategoryIds: ReadonlySet<string>,
  profileId: string,
): BudgetCategory[] =>
  categories.map(cat => ownCategoryIds.has(cat.id) ? cat : {
    ...cat,
    id: profileScopedId(cat.id, profileId),
    items: cat.items.map(item => ({ ...item, id: profileScopedId(item.id, profileId) })),
  });

/**
 * Where a budget-item link written against template ids (a recurring
 * template's, or a bill saved before its item was scoped) points in
 * `categories`, which hold one profile's budget: the item itself when that id
 * is there, else its scoped copy, else nothing -- so adding a bill falls back
 * to matching the category by name rather than keeping a dead link.
 */
export const resolveBudgetItemLink = (
  link: string | undefined,
  categories: BudgetCategory[],
): string | undefined => {
  if (!link) return undefined;
  const itemIds = categories.flatMap(c => c.items.map(i => i.id));
  if (itemIds.includes(link)) return link;
  return itemIds.find(id => id.startsWith(`${link}${SCOPE_SEPARATOR}`));
};

/**
 * The same, for recurring bills: shared default bills get a scoped id, and
 * every bill's link follows its item to a scoped copy where there is one. A
 * link that resolves to nothing is kept as stored rather than dropped: it
 * counts toward no item either way, and dropping it would write NULL on the
 * next save, past undoing. `categories` is null when the budget did not load.
 */
export const materialiseRecurringsForProfile = (
  bills: RecurringBill[],
  ownBillIds: ReadonlySet<string>,
  profileId: string,
  categories: BudgetCategory[] | null,
): RecurringBill[] =>
  bills.map(bill => ({
    ...bill,
    id: ownBillIds.has(bill.id) ? bill.id : profileScopedId(bill.id, profileId),
    linkedBudgetItemId: categories
      ? resolveBudgetItemLink(bill.linkedBudgetItemId, categories) ?? bill.linkedBudgetItemId
      : bill.linkedBudgetItemId,
  }));

/**
 * A profile's settings are one row, read and written by the same rule: the
 * most recently saved non-default row (ties broken on id, as the dedupe
 * migration does), or nothing, leaving the shared default. Picked rather than
 * taken first because rows arrive in no particular order, and duplicates
 * exist from before the save's lookup was scoped to a profile.
 */
export const latestOwnRow = <T extends { id: string; is_default: boolean; updated_at: string }>(
  rows: readonly T[],
): T | undefined => {
  const savedAt = (row: T) => Date.parse(row.updated_at) || 0;
  return rows
    .filter(row => !row.is_default)
    .reduce<T | undefined>((best, row) => {
      if (!best) return row;
      const diff = savedAt(row) - savedAt(best);
      return diff > 0 || (diff === 0 && row.id > best.id) ? row : best;
    }, undefined);
};

/**
 * The rows a save of a collection the bank sync also writes may send.
 *
 * The list on screen can predate the latest refresh: a coalesced save flushes
 * a list built before a sync landed, or an async handler saves a list it
 * captured before an await. So a save sends only rows an edit replaced --
 * edits copy the row they change, untouched rows keep the object read from
 * the database -- and never infers a delete from what the list lacks. A row
 * the list never contained is never written or deleted; rows the sync changed
 * are not written back from a stale copy. Deletes are explicit, by id.
 */
export const rowsToWrite = <T extends object>(rows: readonly T[], isStored: (row: T) => boolean): T[] =>
  rows.filter(row => !isStored(row));

/** `items` in runs of `size`, so an id filter stays within a URL's length. */
export const inChunks = <T,>(items: readonly T[], size: number): T[][] => {
  const runs: T[][] = [];
  for (let at = 0; at < items.length; at += size) runs.push(items.slice(at, at + size));
  return runs;
};

/** A row as this page last read or wrote it, and the profile that owns it. */
export interface StoredRow {
  /** Null for a shared default row, which no profile's save may change. */
  profileId: string | null;
  row: Record<string, unknown>;
  /**
   * What the row held before the latest load replaced it. A copy made before
   * that load still carries these values; they are not edits.
   */
  previous?: Record<string, unknown>;
}

/** Columns a write never changes: identity and ownership. */
const FIXED_COLUMNS = new Set(['id', 'profile_id', 'is_default']);

/** The columns of `next` whose values differ from `stored`. */
export const changedColumns = (
  stored: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> => {
  const patch: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(next)) {
    if (FIXED_COLUMNS.has(column)) continue;
    if (JSON.stringify(value) !== JSON.stringify(stored[column])) patch[column] = value;
  }
  return patch;
};

/**
 * How to write edited rows of a table the bank sync also writes.
 *
 * - A row this page has stored for this profile is updated with only the
 *   columns the edit changed, by id and profile: a copy that predates a sync
 *   -- including one made before a refresh brought the sync in -- does not
 *   write back the columns the sync changed, and an update sent under
 *   another profile matches nothing.
 * - A row stored for another profile, or shared, is not written at all.
 * - A row never stored is inserted; an insert cannot overwrite a row.
 *
 * Updates with identical patches are grouped, so marking 50 rows reviewed is
 * one request, not 50.
 */
export const planRowWrites = (
  edited: readonly { id: string; row: Record<string, unknown> }[],
  stored: ReadonlyMap<string, StoredRow>,
  profileId: string,
): {
  inserts: Record<string, unknown>[];
  updates: { patch: Record<string, unknown>; ids: string[] }[];
  notOwned: string[];
} => {
  const inserts: Record<string, unknown>[] = [];
  const notOwned: string[] = [];
  const byPatch = new Map<string, { patch: Record<string, unknown>; ids: string[] }>();
  for (const { id, row } of edited) {
    const known = stored.get(id);
    if (!known) {
      inserts.push(row);
    } else if (known.profileId !== profileId) {
      notOwned.push(id);
    } else {
      const patch = changedColumns(known.row, row);
      // A column still holding the pre-refresh value is a stale copy, not an
      // edit: writing it would undo what the refresh (a bank sync) changed.
      if (known.previous) {
        for (const column of Object.keys(patch)) {
          if (JSON.stringify(known.previous[column]) === JSON.stringify(row[column])) delete patch[column];
        }
      }
      if (Object.keys(patch).length === 0) continue;
      const key = JSON.stringify(patch);
      const group = byPatch.get(key) ?? { patch, ids: [] };
      group.ids.push(id);
      byPatch.set(key, group);
    }
  }
  return { inserts, updates: [...byPatch.values()], notOwned };
};

import { describe, expect, it } from 'vitest';
import {
  ALL_GUARDED_SAVE_KEYS,
  changedColumns,
  editedFields,
  inChunks,
  latestOwnRow,
  listGenerationOf,
  planRowDeletes,
  planRowWrites,
  orderUpdates,
  recordSeen,
  SEEN_GENERATIONS_KEPT,
  scopeToProfile,
  materialiseBudgetForProfile,
  materialiseRecurringsForProfile,
  profileScopedId,
  rowsToWrite,
  resolveBudgetItemLink,
  saveKeysBlockedBy,
  type StoredRow,
} from './save-safety';
import { DEFAULT_BUDGET_CATEGORIES, mergeMissingDefaultCategories } from './finance-defaults';
import type { BudgetCategory, RecurringBill } from '@/features/finance/finance-types';

const OWNER = 'aa42da11-f4c9-4feb-99f9-9ae44ed6c0e7';
const DEMO = '6dbe06f8-dd50-47d0-8381-76eb1c7f4403';
const FRESH_A = '11111111-1111-4111-8111-111111111111';
const FRESH_B = '22222222-2222-4222-8222-222222222222';

const cat = (id: string, name: string, itemIds: string[] = []): BudgetCategory => ({
  id,
  name,
  budgeted: 0,
  group: 'needs',
  items: itemIds.map(itemId => ({ id: itemId, name: itemId, budgeted: 0, spent: 0 })),
});

/** The shared `is_default` rows as they stand live. */
const SHARED_DEFAULTS: BudgetCategory[] = [
  cat('housing', 'Housing', ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7']),
  cat('insurance', 'Insurance', ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8']),
  cat('needs', 'Needs', ['n1', 'n2']),
  cat('video_ent', 'Video Entertainment', ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v11']),
  cat('wants', 'Wants', ['w1', 'w2', 'w3', 'w4']),
];

/** Every row id a 'budget' save writes: categories and items. */
const writtenIds = (budget: BudgetCategory[]): string[] =>
  budget.flatMap(c => [c.id, ...c.items.map(i => i.id)]);

/** What the loader does for a profile, from its own rows (or none). */
const loadBudget = (own: BudgetCategory[], profileId: string): BudgetCategory[] =>
  materialiseBudgetForProfile(
    mergeMissingDefaultCategories(own.length > 0 ? own : SHARED_DEFAULTS, DEFAULT_BUDGET_CATEGORIES),
    new Set(own.map(c => c.id)),
    profileId,
  );

describe('profileScopedId', () => {
  it('differs per profile and never equals the source id', () => {
    const a = profileScopedId('item_rent', FRESH_A);
    const b = profileScopedId('item_rent', FRESH_B);
    expect(a).not.toBe(b);
    expect(a).not.toBe('item_rent');
  });

  it('is idempotent, so a reload does not grow the id', () => {
    const once = profileScopedId('h1', FRESH_A);
    expect(profileScopedId(once, FRESH_A)).toBe(once);
  });
});

describe('materialiseBudgetForProfile', () => {
  it('two new profiles saving the defaults never share or take over a row id', () => {
    const a = writtenIds(loadBudget([], FRESH_A));
    const b = writtenIds(loadBudget([], FRESH_B));
    const templateIds = new Set([...writtenIds(SHARED_DEFAULTS), ...writtenIds(DEFAULT_BUDGET_CATEGORIES)]);

    expect(a.filter(id => b.includes(id))).toEqual([]);
    expect(a.filter(id => templateIds.has(id))).toEqual([]);
    expect(b.filter(id => templateIds.has(id))).toEqual([]);
    expect(new Set(a).size).toBe(a.length);
  });

  it('a profile given the code defaults never writes another profile\'s ids', () => {
    // Live: the owner's categories carry the code-default ids; Demo's names
    // miss Home, Transportation, Self Care and more, so those merge in.
    const ownerRows = [
      cat('home', 'Home', ['item_rent', 'item_electric', 'item_internet', 'item_phone']),
      cat('self_care', 'Self Care', ['item_gym', 'item_personal_care']),
      cat('transportation', 'Transportation', ['item_car_insurance']),
    ];
    const demoRows = [cat('demo_cat_housing', 'Housing', ['demo_item_rent'])];

    const owner = writtenIds(loadBudget(ownerRows, OWNER));
    const demo = writtenIds(loadBudget(demoRows, DEMO));

    expect(demo.filter(id => owner.includes(id))).toEqual([]);
  });

  it('does not merge a default back in after the profile renames its copy', () => {
    // Demo saved the merged Home under its scoped id, then renamed it.
    const demoRows = [
      cat('demo_cat_housing', 'Housing', ['demo_item_rent']),
      cat(profileScopedId('home', DEMO), 'Bills', [profileScopedId('item_water', DEMO)]),
    ];
    const ids = writtenIds(loadBudget(demoRows, DEMO));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('merges a default category without items the budget already shows', () => {
    const own = [cat('mine', 'Mine', ['x'])];
    own[0].items[0].name = 'Rent';
    const home = loadBudget(own, OWNER).find(c => c.name === 'Home');
    expect(home?.items.map(i => i.name)).not.toContain('Rent');
    expect(home?.items.map(i => i.name)).toContain('Water');
  });

  it('keeps the ids of the profile\'s own rows', () => {
    const ownerRows = [cat('home', 'Home', ['item_rent'])];
    const loaded = loadBudget(ownerRows, OWNER);
    const home = loaded.find(c => c.name === 'Home');
    expect(home?.id).toBe('home');
    expect(home?.items[0].id).toBe('item_rent');
  });
});

describe('resolveBudgetItemLink', () => {
  const budget = [
    cat('home', 'Home', ['item_rent']),
    cat(profileScopedId('housing', DEMO), 'Housing', [profileScopedId('h1', DEMO), profileScopedId('h10', DEMO)]),
  ];

  it('keeps a link to an item this profile owns', () => {
    expect(resolveBudgetItemLink('item_rent', budget)).toBe('item_rent');
  });

  it('follows a template id to this profile\'s scoped copy', () => {
    expect(resolveBudgetItemLink('h1', budget)).toBe(profileScopedId('h1', DEMO));
  });

  it('drops a link that points at nothing, so the by-name fallback runs', () => {
    expect(resolveBudgetItemLink('s3', budget)).toBeUndefined();
    expect(resolveBudgetItemLink(undefined, budget)).toBeUndefined();
  });

  it('does not mistake one id for a longer one', () => {
    const onlyH10 = [cat('x', 'X', [profileScopedId('h10', DEMO)])];
    expect(resolveBudgetItemLink('h1', onlyH10)).toBeUndefined();
  });
});

describe('materialiseRecurringsForProfile', () => {
  const bill = (id: string, link?: string): RecurringBill => ({
    id, name: id, amount: 0, dueDate: 1, isPaid: false, frequency: 'monthly', linkedBudgetItemId: link,
  });

  it('scopes a shared default bill, keeps own bill ids, and resolves every link', () => {
    const budget = loadBudget([], FRESH_A);
    const bills = materialiseRecurringsForProfile(
      [bill('rec_default', 'h1'), bill('rec_own', 'h2')],
      new Set(['rec_own']),
      FRESH_A,
      budget,
    );
    expect(bills[0].id).toBe(profileScopedId('rec_default', FRESH_A));
    expect(bills[0].linkedBudgetItemId).toBe(profileScopedId('h1', FRESH_A));
    // An own bill saved while its item still had the template id follows it.
    expect(bills[1].id).toBe('rec_own');
    expect(bills[1].linkedBudgetItemId).toBe(profileScopedId('h2', FRESH_A));
  });

  it('keeps a link that resolves to nothing, so a save never writes it away', () => {
    const bills = materialiseRecurringsForProfile([bill('rec_own', 'gone')], new Set(['rec_own']), OWNER, loadBudget([], OWNER));
    expect(bills[0].linkedBudgetItemId).toBe('gone');
  });

  it('leaves links as stored when the budget did not load', () => {
    const bills = materialiseRecurringsForProfile([bill('rec_own', 'item_rent')], new Set(['rec_own']), OWNER, null);
    expect(bills[0].linkedBudgetItemId).toBe('item_rent');
  });
});

describe('saveKeysBlockedBy', () => {
  it('blocks the budget save when either budget table failed', () => {
    expect(saveKeysBlockedBy(['budget_items'])).toEqual(new Set(['budget']));
    expect(saveKeysBlockedBy(['budget_categories'])).toEqual(new Set(['budget']));
  });

  it('blocks every save that prunes a failed table', () => {
    expect(saveKeysBlockedBy(['recurring_bills'])).toEqual(new Set(['recurrings']));
    // The accounts save also writes debts, memberships and credit scores.
    expect(saveKeysBlockedBy(['debts'])).toEqual(new Set(['accounts']));
    expect(saveKeysBlockedBy(['credit_scores'])).toEqual(new Set(['accounts']));
    expect(saveKeysBlockedBy(['memberships'])).toEqual(new Set(['accounts']));
    // The settings save also writes holidays.
    expect(saveKeysBlockedBy(['user_holidays'])).toEqual(new Set(['settings']));
    expect(saveKeysBlockedBy(['debt_observations', 'unknown']).size).toBe(0);
    expect(saveKeysBlockedBy([]).size).toBe(0);
  });

  it('guards every collection before the first load', () => {
    for (const key of ['settings', 'goals', 'accounts', 'budget', 'recurrings', 'transactions', 'recurring_templates']) {
      expect(ALL_GUARDED_SAVE_KEYS.has(key)).toBe(true);
    }
  });
});

describe('latestOwnRow', () => {
  const row = (id: string, updated_at: string, is_default = false) => ({ id, updated_at, is_default });

  it('reads the most recently saved row, not the first one returned', () => {
    // Live shape: the row stored first is older than the one saved last.
    const rows = [
      row('de467d5c', '2026-09-08T20:41:00.829+00:00'),
      row('shared', '2026-09-30T00:00:00+00:00', true),
      row('6344a578', '2026-09-06T13:53:32.18+00:00'),
      row('86aa2a57', '2026-09-14T10:04:42.192+00:00'),
      row('b692f061', '2026-09-14T10:04:22.37+00:00'),
    ];
    expect(latestOwnRow(rows)?.id).toBe('86aa2a57');
  });

  it('never picks the shared default row', () => {
    expect(latestOwnRow([row('shared', '2026-09-30T00:00:00Z', true)])).toBeUndefined();
    expect(latestOwnRow([])).toBeUndefined();
  });

  it('breaks a timestamp tie on id, so the choice never depends on order', () => {
    const a = row('aaa', '2026-09-14T10:00:00Z');
    const b = row('bbb', '2026-09-14T10:00:00Z');
    expect(latestOwnRow([a, b])?.id).toBe('bbb');
    expect(latestOwnRow([b, a])?.id).toBe('bbb');
  });

  it('treats an unreadable timestamp as oldest', () => {
    expect(latestOwnRow([row('good', '2026-01-01T00:00:00Z'), row('bad', 'not a date')])?.id).toBe('good');
  });
});

describe('rowsToWrite', () => {
  type Tx = { id: string; reviewed: boolean; merchant: string };

  it('a save from a stale list writes only what was edited, and deletes nothing', () => {
    // The tab loaded a and b.
    const a = { id: 'a', reviewed: false, merchant: 'Old' };
    const b = { id: 'b', reviewed: false, merchant: 'Old' };
    const stored = new WeakSet<Tx>([a, b]);
    // A sync then adds c and renames b's merchant on the server; a refresh
    // records its own row objects, which this stale list does not hold.
    const refreshedB = { ...b, merchant: 'New' };
    const c = { id: 'c', reviewed: false, merchant: 'New' };
    stored.add(refreshedB).add(c);
    // The stale list, built before the refresh, marks a reviewed.
    const staleList = [{ ...a, reviewed: true }, b];
    const written = rowsToWrite(staleList, row => stored.has(row));
    expect(written.map(t => t.id)).toEqual(['a']);
    // b's stale merchant is not written back; c is neither written nor
    // deleted, because a save has no delete step at all.
    expect(written).not.toContain(b);
  });

  it('writes nothing when nothing was edited', () => {
    const a = { id: 'a', reviewed: false, merchant: 'x' };
    expect(rowsToWrite([a], row => new WeakSet([a]).has(row))).toEqual([]);
  });

  it('writes a row added on this page', () => {
    const added = { id: 'n', reviewed: false, merchant: 'x' };
    expect(rowsToWrite([added], () => false)).toEqual([added]);
  });
});

describe('inChunks', () => {
  it('splits into runs of at most the given size, in order', () => {
    expect(inChunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(inChunks([], 100)).toEqual([]);
  });
});

/** A row stored for `profileId`, as each listed generation saw it. */
const storedAs = (
  profileId: string | null,
  seen: [generation: number, row: Record<string, unknown>][],
  firstSeen = seen[0]?.[0] ?? 1,
): StoredRow => ({ profileId, row: seen[seen.length - 1][1], firstSeen, seen: seen.map(([generation, row]) => ({ generation, row })) });

describe('planRowWrites', () => {
  const OWNER_ID = 'owner';
  const stored = new Map([
    ['a', storedAs(OWNER_ID, [[1, { id: 'a', profile_id: OWNER_ID, amount: 10, is_reviewed: false }]])],
    ['b', storedAs(OWNER_ID, [[1, { id: 'b', profile_id: OWNER_ID, amount: 5, is_reviewed: false }]])],
    ['theirs', storedAs('demo', [[1, { id: 'theirs', profile_id: 'demo', amount: 1, is_reviewed: false }]])],
    ['shared', storedAs(null, [[1, { id: 'shared', profile_id: null, amount: 0, is_reviewed: false }]])],
  ]);

  it('sends only the columns an edit changed, so a stale copy leaves the sync\'s columns alone', () => {
    const plan = planRowWrites([{ id: 'a', row: { id: 'a', profile_id: OWNER_ID, amount: 10, is_reviewed: true } }], stored, OWNER_ID, 1, 1);
    expect(plan.updates).toEqual([{ patch: { is_reviewed: true }, ids: ['a'] }]);
    expect(plan.inserts).toEqual([]);
  });

  it('a copy made before a refresh does not write back what the refresh brought in', () => {
    // The tab loaded amount 10; a refresh then brought the sync's amount 12.
    // A copy made before the refresh (a pending save, an open edit dialog)
    // still says 10 and marks the row reviewed.
    const refreshed = new Map([['a', storedAs(OWNER_ID, [
      [1, { id: 'a', profile_id: OWNER_ID, amount: 10, is_reviewed: false }],
      [2, { id: 'a', profile_id: OWNER_ID, amount: 12, is_reviewed: false }],
    ])]]);
    const plan = planRowWrites([{ id: 'a', row: { id: 'a', profile_id: OWNER_ID, amount: 10, is_reviewed: true } }], refreshed, OWNER_ID, 1, 2);
    expect(plan.updates).toEqual([{ patch: { is_reviewed: true }, ids: ['a'] }]);
  });

  it('a list two loads stale does not undo a sync the load in between brought in', () => {
    // Load 1 read amount 10, load 2 the sync's 12, load 3 changed nothing.
    // Comparing against one load back (load 2's 12) sent the stale 10.
    const loads = new Map([['a', storedAs(OWNER_ID, [
      [1, { id: 'a', profile_id: OWNER_ID, amount: 10, category: 'Food' }],
      [2, { id: 'a', profile_id: OWNER_ID, amount: 12, category: 'Food' }],
      [3, { id: 'a', profile_id: OWNER_ID, amount: 12, category: 'Food' }],
    ])]]);
    const plan = planRowWrites([{ id: 'a', row: { id: 'a', profile_id: OWNER_ID, amount: 10, category: 'Bills' } }], loads, OWNER_ID, 1, 3);
    expect(plan.updates).toEqual([{ patch: { category: 'Bills' }, ids: ['a'] }]);
  });

  it('a list older than any kept copy leaves out a column matching any of them', () => {
    const loads = new Map([['a', storedAs(OWNER_ID, [
      [5, { id: 'a', profile_id: OWNER_ID, amount: 10 }],
      [6, { id: 'a', profile_id: OWNER_ID, amount: 12 }],
    ])]]);
    const plan = planRowWrites([{ id: 'a', row: { id: 'a', profile_id: OWNER_ID, amount: 10 } }], loads, OWNER_ID, 2, 6);
    expect(plan.updates).toEqual([]);
  });

  it('a list built after the refresh sends an edit back to the old value', () => {
    // Another device marked a reviewed; the refresh brought that in. The user
    // then un-marks it on this device, from the refreshed list.
    const refreshed = new Map([['a', storedAs(OWNER_ID, [
      [1, { id: 'a', profile_id: OWNER_ID, is_reviewed: false }],
      [2, { id: 'a', profile_id: OWNER_ID, is_reviewed: true }],
    ])]]);
    const plan = planRowWrites([{ id: 'a', row: { id: 'a', profile_id: OWNER_ID, is_reviewed: false } }], refreshed, OWNER_ID, 2, 2);
    expect(plan.updates).toEqual([{ patch: { is_reviewed: false }, ids: ['a'] }]);
  });

  it('a stale list sends the columns the user edited', () => {
    const loads = new Map([['a', storedAs(OWNER_ID, [
      [1, { id: 'a', profile_id: OWNER_ID, amount: 10, note: null }],
      [2, { id: 'a', profile_id: OWNER_ID, amount: 12, note: null }],
    ])]]);
    const plan = planRowWrites([{ id: 'a', row: { id: 'a', profile_id: OWNER_ID, amount: 15, note: 'x' } }], loads, OWNER_ID, 1, 2);
    expect(plan.updates).toEqual([{ patch: { amount: 15, note: 'x' }, ids: ['a'] }]);
  });

  it('a stale list whose edit matches what a later load brought sends nothing for that column', () => {
    // Built at load 1 (amount 10), the user typed 12 -- which load 2 also
    // brought. It already matches, so only the note is sent.
    const loads = new Map([['a', storedAs(OWNER_ID, [
      [1, { id: 'a', profile_id: OWNER_ID, amount: 10, note: null }],
      [2, { id: 'a', profile_id: OWNER_ID, amount: 12, note: null }],
    ])]]);
    const plan = planRowWrites([{ id: 'a', row: { id: 'a', profile_id: OWNER_ID, amount: 12, note: 'x' } }], loads, OWNER_ID, 1, 2);
    expect(plan.updates).toEqual([{ patch: { note: 'x' }, ids: ['a'] }]);
  });

  it('groups identical patches into one update', () => {
    const plan = planRowWrites([
      { id: 'a', row: { id: 'a', profile_id: OWNER_ID, amount: 10, is_reviewed: true } },
      { id: 'b', row: { id: 'b', profile_id: OWNER_ID, amount: 5, is_reviewed: true } },
    ], stored, OWNER_ID);
    expect(plan.updates).toEqual([{ patch: { is_reviewed: true }, ids: ['a', 'b'] }]);
  });

  it('never writes a row owned by another profile or shared, even when asked to under this one', () => {
    const plan = planRowWrites([
      { id: 'theirs', row: { id: 'theirs', profile_id: OWNER_ID, amount: 1, is_reviewed: true } },
      { id: 'shared', row: { id: 'shared', profile_id: OWNER_ID, amount: 0, is_reviewed: true } },
    ], stored, OWNER_ID);
    expect(plan.notOwned).toEqual(['theirs', 'shared']);
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toEqual([]);
  });

  it('inserts a row it has never stored, and sends nothing for an unchanged one', () => {
    const plan = planRowWrites([
      { id: 'n', row: { id: 'n', profile_id: OWNER_ID, amount: 3, is_reviewed: false } },
      { id: 'b', row: { id: 'b', profile_id: OWNER_ID, amount: 5, is_reviewed: false } },
    ], stored, OWNER_ID);
    expect(plan.inserts.map(r => r.id)).toEqual(['n']);
    expect(plan.updates).toEqual([]);
  });
});

describe('recordSeen', () => {
  it('replaces the same generation\'s copy, keeps order, and caps what it keeps', () => {
    let seen = recordSeen([], 1, { amount: 1 });
    seen = recordSeen(seen, 1, { amount: 2 });
    expect(seen).toEqual([{ generation: 1, row: { amount: 2 } }]);
    for (let generation = 2; generation <= SEEN_GENERATIONS_KEPT + 3; generation += 1) {
      seen = recordSeen(seen, generation, { amount: generation });
    }
    expect(seen).toHaveLength(SEEN_GENERATIONS_KEPT);
    expect(seen.map(entry => entry.generation)).toEqual([4, 5, 6, 7, 8]);
  });
});

describe('planRowDeletes', () => {
  const OWNER_ID = 'owner';
  const stored = new Map([
    ['kept', storedAs(OWNER_ID, [[1, { id: 'kept' }]])],
    ['removed', storedAs(OWNER_ID, [[1, { id: 'removed' }]])],
    ['arrivedLater', storedAs(OWNER_ID, [[3, { id: 'arrivedLater' }]])],
    ['theirs', storedAs('demo', [[1, { id: 'theirs' }]])],
    ['shared', storedAs(null, [[1, { id: 'shared' }]])],
  ]);

  it('deletes only what the list was built from and no longer holds', () => {
    expect(planRowDeletes(new Set(['kept']), stored, OWNER_ID, 2)).toEqual(['removed']);
  });

  it('deletes a row first recorded by the very load the list was built from', () => {
    expect(planRowDeletes(new Set(['kept', 'removed']), stored, OWNER_ID, 3)).toEqual(['arrivedLater']);
  });

  it('never deletes a row that arrived after the list was built, or one it does not own', () => {
    // Another device added `arrivedLater`; a list built at load 2 never held it.
    const deletes = planRowDeletes(new Set<string>(), stored, OWNER_ID, 2);
    expect(deletes).not.toContain('arrivedLater');
    expect(deletes).not.toContain('theirs');
    expect(deletes).not.toContain('shared');
  });
});

describe('orderUpdates', () => {
  it('sends a patch that frees a unique slot before one that may take it, else in list order', () => {
    // Goal x takes the emergency fund from goal f, and x comes first in the list.
    const updates = [
      { patch: { is_emergency_fund: true }, ids: ['x'] },
      { patch: { name: 'Renamed' }, ids: ['r'] },
      { patch: { is_emergency_fund: false }, ids: ['f'] },
    ];
    expect(orderUpdates(updates, patch => patch.is_emergency_fund === false).map(u => u.ids[0])).toEqual(['f', 'x', 'r']);
  });
});

describe('scopeToProfile', () => {
  it('gives rows shown from the shared defaults ids of the profile\'s own, and leaves owned rows alone', () => {
    const rows = [{ id: 'goal_1', name: 'Rainy day' }];
    expect(scopeToProfile(rows, false, 'p1')).toEqual([{ id: profileScopedId('goal_1', 'p1'), name: 'Rainy day' }]);
    expect(scopeToProfile(rows, true, 'p1')).toEqual(rows);
  });
});

describe('changedColumns', () => {
  it('ignores identity and ownership, and compares arrays by value', () => {
    expect(changedColumns(
      { id: 'a', profile_id: 'x', is_default: false, tags: ['one'], amount: 1 },
      { id: 'b', profile_id: 'y', is_default: true, tags: ['one'], amount: 2 },
    )).toEqual({ amount: 2 });
  });
});

describe('listGenerationOf', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };
  const edited = { id: 'e' };
  const generations = new WeakMap<object, number>([[a, 1], [b, 2]]);

  it('is the oldest load a row object in the list came from', () => {
    expect(listGenerationOf([a, b, edited], row => generations.get(row), 3)).toBe(1);
  });

  it('is when the save was asked for when the list holds nothing older, ignoring edited copies', () => {
    expect(listGenerationOf([b, edited], row => generations.get(row), 2)).toBe(2);
    expect(listGenerationOf([edited], row => generations.get(row), 2)).toBe(2);
  });
});

describe('editedFields', () => {
  it('returns only the fields changed since the dialog opened', () => {
    const opened = { id: 'x', name: 'Current', balance: 100, color: null as string | null };
    const saved = { ...opened, name: 'Everyday' };
    // The balance the dialog opened with is not sent, so a newer synced
    // balance on the row survives the rename.
    expect(editedFields(opened, saved)).toEqual({ name: 'Everyday' });
  });

  it('includes a field set back to null or changed to an equal-looking value of another type', () => {
    expect(editedFields({ limit: 500 as number | null }, { limit: null })).toEqual({ limit: null });
    expect(editedFields({ fee: 0 as number | string }, { fee: '0' })).toEqual({ fee: '0' });
  });
});

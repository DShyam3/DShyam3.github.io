import { describe, expect, it } from 'vitest';
import {
  ALL_GUARDED_SAVE_KEYS,
  changedColumns,
  inChunks,
  latestOwnRow,
  planRowWrites,
  materialiseBudgetForProfile,
  materialiseRecurringsForProfile,
  profileScopedId,
  rowsToWrite,
  resolveBudgetItemLink,
  saveKeysBlockedBy,
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

describe('planRowWrites', () => {
  const OWNER_ID = 'owner';
  const stored = new Map([
    ['a', { profileId: OWNER_ID, row: { id: 'a', profile_id: OWNER_ID, amount: 10, is_reviewed: false } }],
    ['b', { profileId: OWNER_ID, row: { id: 'b', profile_id: OWNER_ID, amount: 5, is_reviewed: false } }],
    ['theirs', { profileId: 'demo', row: { id: 'theirs', profile_id: 'demo', amount: 1, is_reviewed: false } }],
    ['shared', { profileId: null, row: { id: 'shared', profile_id: null, amount: 0, is_reviewed: false } }],
  ]);

  it('sends only the columns an edit changed, so a stale copy leaves the sync\'s columns alone', () => {
    // The sync has since changed a's amount on the server; the copy on screen
    // still says 10, and the user marks it reviewed.
    const plan = planRowWrites([{ id: 'a', row: { id: 'a', profile_id: OWNER_ID, amount: 10, is_reviewed: true } }], stored, OWNER_ID);
    expect(plan.updates).toEqual([{ patch: { is_reviewed: true }, ids: ['a'] }]);
    expect(plan.inserts).toEqual([]);
  });

  it('a copy made before a refresh does not write back what the refresh brought in', () => {
    // The tab loaded amount 10; a refresh then brought the sync's amount 12.
    // A copy made before the refresh (a pending save, an open edit dialog)
    // still says 10 and marks the row reviewed.
    const refreshed = new Map([
      ['a', {
        profileId: OWNER_ID,
        row: { id: 'a', profile_id: OWNER_ID, amount: 12, is_reviewed: false },
        previous: { id: 'a', profile_id: OWNER_ID, amount: 10, is_reviewed: false },
      }],
    ]);
    const plan = planRowWrites([{ id: 'a', row: { id: 'a', profile_id: OWNER_ID, amount: 10, is_reviewed: true } }], refreshed, OWNER_ID);
    expect(plan.updates).toEqual([{ patch: { is_reviewed: true }, ids: ['a'] }]);
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

describe('changedColumns', () => {
  it('ignores identity and ownership, and compares arrays by value', () => {
    expect(changedColumns(
      { id: 'a', profile_id: 'x', is_default: false, tags: ['one'], amount: 1 },
      { id: 'b', profile_id: 'y', is_default: true, tags: ['one'], amount: 2 },
    )).toEqual({ amount: 2 });
  });
});

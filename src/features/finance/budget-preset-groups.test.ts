import { describe, expect, it } from 'vitest';
import {
  BUDGET_PRESET_GROUPS,
  initialPresetSelection,
  presetGroupFor,
  resolveItemName,
} from './budget-preset-groups';
import type { BudgetCategory, FinanceSettings } from '@/features/finance/finance-types';

const cat = (over: Partial<BudgetCategory>): BudgetCategory => ({
  id: 'c1',
  name: 'Untitled',
  group: 'needs',
  budgeted: 0,
  spent: 0,
  items: [],
  ...over,
} as BudgetCategory);

const settings = (over: Partial<FinanceSettings> = {}) => ({ ...over } as FinanceSettings);

describe('BUDGET_PRESET_GROUPS', () => {
  it('covers all fifteen categories with unique kinds', () => {
    expect(BUDGET_PRESET_GROUPS).toHaveLength(15);
    const kinds = BUDGET_PRESET_GROUPS.map(g => g.kind);
    expect(new Set(kinds).size).toBe(15);
  });

  it('offers a non-empty preset list for every group', () => {
    for (const group of BUDGET_PRESET_GROUPS) {
      expect(group.options(settings()).length, group.kind).toBeGreaterThan(0);
    }
  });

  it('asks for a provider on subscriptions and loans only', () => {
    const withProvider = BUDGET_PRESET_GROUPS.filter(g => g.provider).map(g => g.kind);
    expect(withProvider).toEqual(['subscription', 'loan']);
  });
});

describe('presetGroupFor', () => {
  it('matches a savings category by group, not by name', () => {
    // The name is deliberately unhelpful: the original chain tested the group
    // first, so anything in `savings` must land here whatever it is called.
    expect(presetGroupFor(cat({ group: 'savings', name: 'Zzz' }))?.kind).toBe('savings');
  });

  it('matches the name-based groups', () => {
    // Housing wants both: the needs group and a housing-ish word. "Housing"
    // itself is not one of them -- the predicate looks for house/home/rent.
    expect(presetGroupFor(cat({ group: 'needs', name: 'Rent' }))?.kind).toBe('housing');
    expect(presetGroupFor(cat({ name: 'Subscriptions' }))?.kind).toBe('subscription');
    expect(presetGroupFor(cat({ name: 'Transport' }))?.kind).toBe('transport');
  });

  it('sends a category named Travel to transport, not travel', () => {
    // Pre-existing: isTransportCategory matches "travel", and transport sits
    // ahead of travel in the chain. Pinned because the table preserves the
    // old order rather than quietly fixing it.
    expect(presetGroupFor(cat({ name: 'Travel' }))?.kind).toBe('transport');
    expect(presetGroupFor(cat({ name: 'Holidays' }))?.kind).toBe('travel');
  });

  it('returns null for a category no group claims, and for no category', () => {
    expect(presetGroupFor(cat({ name: 'Nonsense Ledger' }))).toBeNull();
    expect(presetGroupFor(null)).toBeNull();
    expect(presetGroupFor(undefined)).toBeNull();
  });

  it('takes the first match when a savings category also matches by name', () => {
    // A savings category called "Travel" matches both arms; order decides.
    expect(presetGroupFor(cat({ group: 'savings', name: 'Travel' }))?.kind).toBe('savings');
  });
});

describe('initialPresetSelection', () => {
  it('preselects the first preset and its emoji', () => {
    const picked = initialPresetSelection(cat({ group: 'needs', name: 'Rent' }), settings());
    const first = BUDGET_PRESET_GROUPS.find(g => g.kind === 'housing')!.options(settings())[0];
    expect(picked).toEqual({
      kind: 'housing',
      selected: first.name,
      name: first.name,
      emoji: first.emoji,
    });
  });

  it('honours the savings types switched on in settings', () => {
    const all = BUDGET_PRESET_GROUPS.find(g => g.kind === 'savings')!;
    const second = all.options(settings())[1];
    const key = second.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const picked = initialPresetSelection(cat({ group: 'savings' }), settings({ activeSavingsTypes: [key] }));
    expect(picked?.selected).toBe(second.name);
  });

  it('falls through to custom when every savings type is switched off', () => {
    // The one case that must not preselect nothing: an empty dropdown with a
    // blank name would let an unnamed item be saved.
    expect(initialPresetSelection(cat({ group: 'savings' }), settings({ activeSavingsTypes: [] }))).toEqual({
      kind: 'savings',
      selected: 'custom',
      name: '',
      emoji: '💰',
    });
  });

  it('returns null for an unmatched category, so the caller clears the dialog', () => {
    expect(initialPresetSelection(cat({ name: 'Nonsense Ledger' }), settings())).toBeNull();
  });
});

describe('resolveItemName', () => {
  const subscription = BUDGET_PRESET_GROUPS.find(g => g.kind === 'subscription')!;
  const housing = BUDGET_PRESET_GROUPS.find(g => g.kind === 'housing')!;

  it('folds a provider into the preset name', () => {
    expect(resolveItemName(subscription, 'Streaming', 'Netflix', 'ignored')).toBe('Streaming (Netflix)');
  });

  it('keeps the bare preset when no provider is given', () => {
    expect(resolveItemName(subscription, 'Streaming', '   ', 'ignored')).toBe('Streaming');
  });

  it('uses the typed name for the custom entry, provider or not', () => {
    expect(resolveItemName(subscription, 'custom', 'Netflix', 'Bespoke Box')).toBe('Bespoke Box');
  });

  it('uses the typed name for groups that never ask for a provider', () => {
    expect(resolveItemName(housing, 'Rent', 'ignored', 'Rent')).toBe('Rent');
  });

  it('uses the typed name when no group matched at all', () => {
    expect(resolveItemName(null, '', '', 'Freeform')).toBe('Freeform');
  });
});

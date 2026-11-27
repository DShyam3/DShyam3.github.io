import { describe, expect, it } from 'vitest';
import {
  PROFILE_COLLECTIONS,
  coversAllProfileData,
  describeTables,
  planFailedLoad,
  type FailedLoadInput,
} from './unloaded-tables';

const plan = (overrides: Partial<FailedLoadInput>) => planFailedLoad({
  failed: [],
  rowsOnScreenFor: 'self',
  loadingFor: 'self',
  previous: [],
  sharedLoaded: new Set(['tax_configs', 'recurring_templates', 'credit_bureaus', 'holiday_defaults', 'budget_presets']),
  ...overrides,
});

describe('planFailedLoad after a switch', () => {
  it('empties and reports every failed profile table', () => {
    expect(plan({ failed: ['bank_accounts', 'transactions'], rowsOnScreenFor: 'self', loadingFor: 'partner' })).toEqual({
      clear: ['bank_accounts', 'transactions'],
      unloaded: ['bank_accounts', 'transactions'],
      kept: [],
    });
  });

  it('does the same on the first load and after a load that threw', () => {
    expect(plan({ failed: ['goals'], rowsOnScreenFor: null }).clear).toEqual(['goals']);
  });

  it('reports a pair once, under its collection', () => {
    const result = plan({ failed: ['budget_items', 'goal_contributions'], rowsOnScreenFor: 'self', loadingFor: 'partner' });
    expect(result.clear).toEqual(['budget_items', 'goal_contributions']);
    expect(result.unloaded).toEqual(['budget_categories', 'goals']);
  });

  it('keeps a shared table that has loaded, since every profile is shown the same', () => {
    expect(plan({ failed: ['tax_configs', 'debts'], rowsOnScreenFor: 'self', loadingFor: 'partner' })).toEqual({
      clear: ['debts'],
      unloaded: ['debts'],
      kept: ['tax_configs'],
    });
  });

  it('reports nothing after a clean switch, whatever the last profile lacked', () => {
    expect(plan({ previous: ['transactions'], rowsOnScreenFor: 'self', loadingFor: 'partner' }).unloaded).toEqual([]);
  });
});

describe('planFailedLoad on a refresh of the same profile', () => {
  it('empties nothing', () => {
    expect(plan({ failed: ['transactions', 'settings'] }).clear).toEqual([]);
  });

  it('keeps reporting a collection while its read still fails', () => {
    const result = plan({ failed: ['bank_accounts'], previous: ['bank_accounts', 'goals'] });
    expect(result.unloaded).toEqual(['bank_accounts']);
    expect(result.kept).toEqual([]);
  });

  it('keeps reporting a pair while either half still fails', () => {
    expect(plan({ failed: ['budget_items'], previous: ['budget_categories'] }).unloaded).toEqual(['budget_categories']);
    expect(plan({ failed: ['goal_contributions'], previous: ['goals'] }).unloaded).toEqual(['goals']);
  });

  it('counts a table an earlier load showed as kept, not unloaded', () => {
    expect(plan({ failed: ['debts'] })).toEqual({ clear: [], unloaded: [], kept: ['debts'] });
  });
});

describe('planFailedLoad for shared tables never loaded', () => {
  it('reports them, since the page holds empty fallbacks', () => {
    const result = plan({ failed: ['tax_configs'], rowsOnScreenFor: null, sharedLoaded: new Set() });
    expect(result).toEqual({ clear: [], unloaded: ['tax_configs'], kept: [] });
  });
});

describe('coversAllProfileData', () => {
  it('is true only when every profile collection is listed', () => {
    expect(coversAllProfileData(PROFILE_COLLECTIONS)).toBe(true);
    expect(coversAllProfileData(PROFILE_COLLECTIONS.slice(1))).toBe(false);
  });
});

describe('describeTables', () => {
  it('names each collection once, in order', () => {
    expect(describeTables(['budget_categories', 'budget_items', 'transactions', 'tax_configs'])).toBe('budget, transactions, tax rates');
  });

  it('names the lists loaded on their own', () => {
    expect(describeTables(['payslips', 'net_worth_history'])).toBe('payslips, net worth history');
  });

  it('falls back to the table name with spaces', () => {
    expect(describeTables(['some_new_table'])).toBe('some new table');
  });
});

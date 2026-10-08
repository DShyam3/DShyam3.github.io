import { describe, expect, it } from 'vitest';
import type { FinanceToolContext } from '@/lib/finance/tools';
import { FINANCE_NOT_LOADED, frameQuestion, runSiteTool, SITE_TOOL_SCHEMAS, SYSTEM_PROMPT, type SiteToolReaders } from './site-tools';

const finance: FinanceToolContext = {
  position: {
    freeToSpend: 100, hasBudget: true, totalBudget: 200, totalSpent: 100, monthlyIncome: 3000,
    netWorth: 5000, totalAssets: 6000, totalDebt: 1000, daysUntilPayday: 5, daysRemainingInMonth: 20,
  },
  scenario: { freeToSpend: 100, daysRemainingInMonth: 20, liquidAssets: 1000, emergencyFundTarget: 0, monthlySurplus: 0, goals: [] },
  goals: [],
  alerts: [],
  cashFlow: { transactions: [], currentMonth: '2026-10', exclusionsUnreliable: false },
};

const readers = (overrides: Partial<SiteToolReaders> = {}): SiteToolReaders => ({
  finance: () => finance,
  inventory: async () => [],
  releases: async () => [],
  today: () => new Date(2026, 9, 8),
  ...overrides,
});

const call = (name: string, args: Record<string, unknown> = {}) => ({ id: 'c', name, args });

describe('SITE_TOOL_SCHEMAS', () => {
  it('lists every tool once, and no tool that writes', () => {
    const names = SITE_TOOL_SCHEMAS.map(tool => tool.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.sort()).toEqual([
      'get_alerts', 'get_cash_flow', 'get_goals', 'get_position', 'get_releases', 'run_spend_scenario', 'search_inventory',
    ]);
  });
});

describe('runSiteTool', () => {
  it('routes a finance tool to the loaded finance context', async () => {
    expect(await runSiteTool(call('get_position'), readers())).toMatchObject({ tool: 'get_position', data: { netWorth: 5000 } });
  });

  it('says plainly when finance is not loaded on this page', async () => {
    expect(await runSiteTool(call('get_cash_flow', { month: '2026-09' }), readers({ finance: () => null }))).toEqual({
      tool: 'get_cash_flow',
      error: FINANCE_NOT_LOADED,
    });
  });

  it('validates release arguments before reading anything', async () => {
    let read = false;
    const result = await runSiteTool(call('get_releases', { to: 'soon' }), readers({
      releases: async () => { read = true; return []; },
    }));
    expect(result).toHaveProperty('error');
    expect(read).toBe(false);
  });

  it('hands the parsed range to the release reader', async () => {
    let asked: unknown;
    await runSiteTool(call('get_releases', { to: '2026-12-31', kind: 'movie' }), readers({
      releases: async args => { asked = args; return []; },
    }));
    expect(asked).toEqual({ from: '2026-10-08', to: '2026-12-31', kind: 'movie', title: null });
  });

  it('turns a failed read into a result, without the error detail', async () => {
    const result = await runSiteTool(call('search_inventory', { query: 'pc' }), readers({
      inventory: async () => { throw new Error('JWT expired at db.internal'); },
    }));
    expect(result).toEqual({ tool: 'search_inventory', error: 'the inventory could not be read just now' });
  });

  it('refuses a tool it does not have', async () => {
    expect(await runSiteTool(call('delete_row'), readers())).toEqual({ tool: 'delete_row', error: 'unknown tool: delete_row' });
  });
});

describe('SYSTEM_PROMPT and frameQuestion', () => {
  it('keeps everything that changes out of the system prompt', () => {
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(SYSTEM_PROMPT).toMatch(/Never compute/);
  });

  it('puts the date, the page and whether finance is loaded on the question', () => {
    const framed = frameQuestion('What is in my PC?', { today: '2026-10-08', page: '/inventory', financeLoaded: false });
    expect(framed).toBe('[Today is 2026-10-08. Asked from /inventory. Finance data is not loaded.]\n\nWhat is in my PC?');
  });
});

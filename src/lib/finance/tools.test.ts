import { describe, expect, it } from 'vitest';
import { executeTool, monthsToTarget, TOOL_SCHEMAS, type FinanceToolContext } from './tools';

const context: FinanceToolContext = {
  position: {
    freeToSpend: 1000, hasBudget: true, totalBudget: 2000, totalSpent: 800,
    monthlyIncome: 3000, netWorth: -4000, totalAssets: 6000, totalDebt: 10000,
    daysUntilPayday: 12, daysRemainingInMonth: 10,
  },
  scenario: {
    freeToSpend: 1000, daysRemainingInMonth: 10, liquidAssets: 5000,
    emergencyFundTarget: 2000, monthlySurplus: 500,
    goals: [{ id: 'g1', name: 'Trip', targetAmount: 3000, currentAmount: 600, monthlyContribution: 300 }],
  },
  goals: [{
    id: 'g1', name: 'Trip', targetAmount: 3000, currentAmount: 600,
    monthlyContribution: 300, isEmergencyFund: false, monthsToTarget: 8,
  }],
  alerts: [{ code: 'no_budget', severity: 'info' }],
  cashFlow: {
    currentMonth: '2026-10',
    exclusionsUnreliable: false,
    transactions: [
      // Built the way useFinanceToolContext builds them: no names, no accounts.
      { id: 't1', date: '2026-09-25', name: '', amount: -3000, category: 'Salary', accountId: null },
      { id: 't2', date: '2026-09-03', name: '', amount: 120.5, category: 'Groceries', accountId: null },
      { id: 't3', date: '2026-09-14', name: '', amount: 79.5, category: 'Groceries', accountId: null },
      { id: 't4', date: '2026-09-20', name: '', amount: 900, category: 'Rent', accountId: null },
      { id: 't5', date: '2026-08-25', name: '', amount: -3000, category: 'Salary', accountId: null },
      { id: 't6', date: '2026-08-10', name: '', amount: 950, category: 'Rent', accountId: null },
      { id: 't7', date: '2026-10-02', name: '', amount: 40, category: 'Groceries', accountId: null },
    ],
  },
};

describe('executeTool', () => {
  it('returns the position without touching it', () => {
    const r = executeTool('get_position', {}, context);
    expect(r).toEqual({ tool: 'get_position', data: context.position });
  });

  it('sends only the fields it lists, whatever else the context carries', () => {
    const widened = {
      ...context,
      position: { ...context.position, accountNumber: '12345678' },
      goals: [{ ...context.goals[0], notes: 'private' }],
    } as unknown as FinanceToolContext;
    const position = executeTool('get_position', {}, widened);
    expect('data' in position && position.data).not.toHaveProperty('accountNumber');
    const goals = executeTool('get_goals', {}, widened);
    expect('data' in goals && goals.tool === 'get_goals' && goals.data[0]).not.toHaveProperty('notes');
  });

  it('drops the account names two alert codes carry', () => {
    const r = executeTool('get_alerts', {}, {
      ...context,
      alerts: [
        {
          code: 'costly_debt_beside_cash', severity: 'warning', spareCash: 500, costlyDebtTotal: 2000,
          coverable: 500, annualInterestCovered: 110, highestAprDebtName: 'Amex 1234',
          highestAprPercent: 22.9, aprThresholdPercent: 10,
        },
        {
          code: 'credit_utilisation_high', severity: 'warning', utilisationPercent: 60, totalOwed: 3000,
          totalLimit: 5000, thresholdPercent: 30, highestCardName: 'Card 9876', highestCardPercent: 80,
        },
      ],
    });
    const sent = JSON.stringify(r);
    expect(sent).not.toContain('Amex');
    expect(sent).not.toContain('9876');
    expect(sent).toContain('22.9');
  });

  it('returns goals', () => {
    const r = executeTool('get_goals', {}, context);
    expect(r).toEqual({ tool: 'get_goals', data: context.goals });
  });

  it('returns alerts', () => {
    expect(executeTool('get_alerts', {}, context)).toEqual({
      tool: 'get_alerts',
      data: context.alerts,
    });
  });

  it('runs a scenario through the real engine', () => {
    const r = executeTool('run_spend_scenario', { amount: 300 }, context);
    expect(r).toMatchObject({ tool: 'run_spend_scenario' });
    if ('data' in r && r.tool === 'run_spend_scenario') {
      expect(r.data.freeToSpendAfter).toBe(700);
      expect(r.data.goalImpacts[0].monthsDelayed).toBe(1);
    }
  });

  it('coerces a numeric string, because models pass those', () => {
    const r = executeTool('run_spend_scenario', { amount: '250' }, context);
    expect('data' in r && r.tool === 'run_spend_scenario' && r.data.amount).toBe(250);
  });

  it('errors rather than throwing on a missing amount', () => {
    expect(executeTool('run_spend_scenario', {}, context)).toMatchObject({
      tool: 'run_spend_scenario',
      error: expect.stringContaining('positive number'),
    });
  });

  it('errors rather than throwing on a negative amount', () => {
    expect(executeTool('run_spend_scenario', { amount: -5 }, context)).toHaveProperty('error');
  });

  it('sums one month of cash flow, by category, with no row listed', () => {
    const r = executeTool('get_cash_flow', { month: '2026-09' }, context);
    expect(r).toEqual({
      tool: 'get_cash_flow',
      data: {
        from: '2026-09',
        through: '2026-09',
        complete: true,
        income: 3000,
        spend: 1100,
        net: 1900,
        recordsCompleteFrom: '2026-09',
        averages: { months: 1, from: '2026-09', through: '2026-09', income: 3000, spend: 1100, net: 1900, emptyMonths: [] },
        categories: [{ name: 'Rent', amount: 900 }, { name: 'Groceries', amount: 200 }],
        savingsRatePercent: 63.3,
        transfersMayBeIncluded: false,
        ledgerStartsMonth: '2026-08',
      },
    });
  });

  it('sums a range itself, so the model never adds months up', () => {
    const r = executeTool('get_cash_flow', { month: '2026-08', through: '2026-10' }, context);
    if (!('data' in r) || r.tool !== 'get_cash_flow') throw new Error('expected data');
    expect(r.data.income).toBe(6000);
    expect(r.data.spend).toBe(2090);
    expect(r.data.complete).toBe(false);
    expect(r.data.months?.map(m => m.month)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(r.data.months?.[2]).toEqual({ month: '2026-10', income: 0, spend: 40, net: -40 });
    // The ledger starts on 10 August and October is in progress, so only
    // September is a whole month of records, and the averages say so.
    expect(r.data.averages).toEqual({
      months: 1, from: '2026-09', through: '2026-09', income: 3000, spend: 1100, net: 1900, emptyMonths: [],
    });
  });

  it('averages from the first full month of records, not from the start of the range', () => {
    const fromFirst: FinanceToolContext = {
      ...context,
      cashFlow: {
        ...context.cashFlow,
        transactions: [
          { id: 's', date: '2026-08-01', name: '', amount: 10, category: 'Groceries', accountId: null },
          ...context.cashFlow.transactions,
        ],
      },
    };
    const r = executeTool('get_cash_flow', { month: '2026-01', through: '2026-10' }, fromFirst);
    if (!('data' in r) || r.tool !== 'get_cash_flow') throw new Error('expected data');
    expect(r.data.averages).toMatchObject({ months: 2, from: '2026-08', through: '2026-09', spend: 1030 });
    // The totals still cover the whole range, the current month included.
    expect(r.data.spend).toBe(2100);
  });

  it('marks the ledger\'s partial first month incomplete, and says where full records start', () => {
    // The fixture's ledger starts on 10 August.
    const r = executeTool('get_cash_flow', { month: '2026-08' }, context);
    expect(r).toMatchObject({
      data: { spend: 950, complete: false, recordsCompleteFrom: '2026-09', ledgerStartsMonth: '2026-08', averages: null },
    });
  });

  it('is never complete over an empty ledger', () => {
    const empty = { ...context, cashFlow: { ...context.cashFlow, transactions: [] } };
    expect(executeTool('get_cash_flow', { month: '2026-09' }, empty)).toMatchObject({
      data: { complete: false, recordsCompleteFrom: null, ledgerStartsMonth: null },
    });
  });

  it('names an averaged month that has no rows at all', () => {
    const gappy: FinanceToolContext = {
      ...context,
      cashFlow: {
        ...context.cashFlow,
        transactions: [
          { id: 'j', date: '2026-07-01', name: '', amount: 500, category: 'Rent', accountId: null },
          ...context.cashFlow.transactions.filter(t => !t.date.startsWith('2026-08')),
        ],
      },
    };
    const r = executeTool('get_cash_flow', { month: '2026-07', through: '2026-09' }, gappy);
    expect(r).toMatchObject({ data: { averages: { months: 3, emptyMonths: ['2026-08'] } } });
  });

  it('gives no averages when the range holds no complete, recorded month', () => {
    expect(executeTool('get_cash_flow', { month: '2026-10' }, context)).toMatchObject({ data: { averages: null } });
    expect(executeTool('get_cash_flow', { month: '2025-01', through: '2025-12' }, context)).toMatchObject({ data: { averages: null } });
  });

  it('says where the ledger starts, so an early month reads as unrecorded', () => {
    const r = executeTool('get_cash_flow', { month: '2025-01' }, context);
    expect(r).toMatchObject({ data: { income: 0, spend: 0, ledgerStartsMonth: '2026-08' } });
  });

  it('counts nothing for a future month and marks it incomplete', () => {
    const r = executeTool('get_cash_flow', { month: '2026-12' }, context);
    expect(r).toMatchObject({ data: { income: 0, spend: 0, complete: false } });
  });

  it('says when transfers may be counted', () => {
    const r = executeTool('get_cash_flow', { month: '2026-09' }, {
      ...context,
      cashFlow: { ...context.cashFlow, exclusionsUnreliable: true },
    });
    expect(r).toMatchObject({ data: { transfersMayBeIncluded: true } });
  });

  it('never sends a transaction name, even when the rows carry one', () => {
    const named: FinanceToolContext = {
      ...context,
      cashFlow: {
        ...context.cashFlow,
        transactions: [
          { id: 'n1', date: '2026-09-25', name: 'ACME PAYROLL', payer: 'Jane Smith', amount: -100, category: 'Salary', accountId: 'acc-1' },
        ],
      },
    };
    const sent = JSON.stringify(executeTool('get_cash_flow', { month: '2026-09' }, named));
    expect(sent).not.toContain('ACME');
    expect(sent).not.toContain('Jane');
    expect(sent).not.toContain('acc-1');
  });

  it('rejects a malformed or backwards range rather than guessing', () => {
    expect(executeTool('get_cash_flow', {}, context)).toHaveProperty('error');
    expect(executeTool('get_cash_flow', { month: '2026-13' }, context)).toHaveProperty('error');
    expect(executeTool('get_cash_flow', { month: 'September' }, context)).toHaveProperty('error');
    expect(executeTool('get_cash_flow', { month: '2026-09', through: '2026-08' }, context)).toMatchObject({
      error: 'through must not be before month',
    });
    expect(executeTool('get_cash_flow', { month: '2010-01', through: '2026-09' }, context)).toHaveProperty('error');
  });

  it('errors rather than throwing on an unknown tool', () => {
    expect(executeTool('delete_everything', {}, context)).toMatchObject({
      error: 'unknown tool: delete_everything',
    });
  });

  it('reaches nothing outside the context it is given', () => {
    const before = JSON.parse(JSON.stringify(context));
    executeTool('run_spend_scenario', { amount: 900 }, context);
    executeTool('get_position', {}, context);
    expect(context).toEqual(before);
  });
});

describe('TOOL_SCHEMAS', () => {
  it('describes every tool executeTool implements', () => {
    const named = TOOL_SCHEMAS.map(t => t.name).sort();
    expect(named).toEqual(['get_alerts', 'get_cash_flow', 'get_goals', 'get_position', 'run_spend_scenario']);
  });

  it('gives every tool a description, which is what stops it being misused', () => {
    for (const t of TOOL_SCHEMAS) expect(t.description.length).toBeGreaterThan(40);
  });

  it('marks amount as required on the scenario tool', () => {
    const t = TOOL_SCHEMAS.find(s => s.name === 'run_spend_scenario');
    expect(t?.input_schema.required).toEqual(['amount']);
  });
});

describe('monthsToTarget', () => {
  it('counts whole months at the current rate', () => {
    expect(monthsToTarget(3000, 600, 300)).toBe(8);
  });

  it('is zero for a goal already met', () => {
    expect(monthsToTarget(1000, 1000, 50)).toBe(0);
  });

  it('is null, not Infinity, for an unfunded goal', () => {
    expect(monthsToTarget(3000, 600, 0)).toBeNull();
  });
});

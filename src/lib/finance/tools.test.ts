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
};

describe('executeTool', () => {
  it('returns the position without touching it', () => {
    const r = executeTool('get_position', {}, context);
    expect(r).toEqual({ tool: 'get_position', data: context.position });
  });

  it('returns goals', () => {
    const r = executeTool('get_goals', {}, context);
    expect(r).toEqual({ tool: 'get_goals', data: context.goals });
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
    expect(named).toEqual(['get_goals', 'get_position', 'run_spend_scenario']);
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

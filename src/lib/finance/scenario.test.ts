import { describe, expect, it } from 'vitest';
import { runSpendScenario, type ScenarioState } from './scenario';

const base: ScenarioState = {
  freeToSpend: 1000,
  daysRemainingInMonth: 10,
  liquidAssets: 5000,
  emergencyFundTarget: 2000,
  monthlySurplus: 500,
  goals: [
    { id: 'g1', name: 'Emergency Fund', targetAmount: 15000, currentAmount: 12500, monthlyContribution: 500 },
    { id: 'g2', name: 'India Trip', targetAmount: 3000, currentAmount: 0, monthlyContribution: 0 },
  ],
};

describe('verdicts', () => {
  it('is comfortable when plenty is left', () => {
    expect(runSpendScenario(100, base).verdict).toBe('comfortable');
  });

  it('is tight once little of the month is left', () => {
    // 850 spent of 1000 leaves 150, under the 20% of 1000 threshold.
    expect(runSpendScenario(850, base).verdict).toBe('tight');
  });

  it('is over budget when it takes free-to-spend negative', () => {
    expect(runSpendScenario(1200, base).verdict).toBe('over_budget');
  });

  it('reports the emergency fund before the budget when both are hit', () => {
    // 3500 leaves 1500 liquid against a 2000 target, and also busts the budget.
    const r = runSpendScenario(3500, base);
    expect(r.verdict).toBe('breaks_emergency_fund');
    expect(r.emergencyShortfall).toBe(500);
  });

  it('is unaffordable when the cash is not there, above every other concern', () => {
    expect(runSpendScenario(6000, base).verdict).toBe('unaffordable');
  });

  it('treats spending exactly the liquid balance as affordable, not unaffordable', () => {
    expect(runSpendScenario(5000, base).verdict).not.toBe('unaffordable');
  });
});

describe('figures', () => {
  it('reduces free-to-spend and liquid by the amount', () => {
    const r = runSpendScenario(250, base);
    expect(r.freeToSpendAfter).toBe(750);
    expect(r.liquidAfter).toBe(4750);
  });

  it('spreads what is left across the days remaining', () => {
    expect(runSpendScenario(500, base).dailyAllowanceAfter).toBe(50);
  });

  it('never reports a negative daily allowance', () => {
    expect(runSpendScenario(2000, base).dailyAllowanceAfter).toBe(0);
  });

  it('does not divide by zero on the last day of the month', () => {
    const r = runSpendScenario(100, { ...base, daysRemainingInMonth: 0 });
    expect(Number.isFinite(r.dailyAllowanceAfter)).toBe(true);
    expect(r.dailyAllowanceAfter).toBe(900);
  });

  it('treats a negative amount as no spend rather than income', () => {
    const r = runSpendScenario(-500, base);
    expect(r.amount).toBe(0);
    expect(r.freeToSpendAfter).toBe(1000);
  });
});

describe('goal impact', () => {
  it('delays a funded goal by the months of contribution it consumes', () => {
    // 800 against a 500/month contribution is two whole months.
    expect(runSpendScenario(800, base).goalImpacts[0].monthsDelayed).toBe(2);
  });

  it('reports null rather than a delay for an unfunded goal', () => {
    expect(runSpendScenario(800, base).goalImpacts[1].monthsDelayed).toBeNull();
  });

  it('names each goal so a caller need not join back to the source', () => {
    expect(runSpendScenario(10, base).goalImpacts.map(g => g.name)).toEqual([
      'Emergency Fund',
      'India Trip',
    ]);
  });
});

describe('alternatives', () => {
  it('offers the largest spend that stays comfortable', () => {
    expect(runSpendScenario(900, base).maxComfortable).toBe(800);
  });

  it('needs no saving when the cash is already there', () => {
    expect(runSpendScenario(900, base).monthsToSaveInstead).toBe(0);
  });

  it('counts the months of surplus needed to cover a shortfall', () => {
    // 6000 wanted, 5000 liquid, 500 a month: two months.
    expect(runSpendScenario(6000, base).monthsToSaveInstead).toBe(2);
  });

  it('reports null, not Infinity, when there is no surplus to save from', () => {
    const r = runSpendScenario(6000, { ...base, monthlySurplus: 0 });
    expect(r.monthsToSaveInstead).toBeNull();
  });
});

describe('determinism', () => {
  it('gives the same answer twice', () => {
    expect(runSpendScenario(432.1, base)).toEqual(runSpendScenario(432.1, base));
  });

  it('does not mutate the state it is given', () => {
    const snapshot = JSON.parse(JSON.stringify(base));
    runSpendScenario(999, base);
    expect(base).toEqual(snapshot);
  });
});

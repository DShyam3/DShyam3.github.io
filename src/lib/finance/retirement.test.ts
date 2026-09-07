import { describe, expect, it } from 'vitest';
import { annualPensionContribution, projectPension, SAFE_WITHDRAWAL_PERCENT } from './retirement';

describe('projectPension', () => {
  it('returns just today when there are no years to project', () => {
    const p = projectPension({ currentPot: 1000, annualContribution: 500, years: 0, realGrowthPercent: 5 });
    expect(p.years).toEqual([{ year: 0, pot: 1000, contributed: 0, growth: 0 }]);
    expect(p.finalPot).toBe(1000);
  });

  it('grows the opening balance and then adds the year’s contribution', () => {
    // 1,000 grows 10% to 1,100, then 500 goes in.
    const p = projectPension({ currentPot: 1000, annualContribution: 500, years: 1, realGrowthPercent: 10 });
    expect(p.finalPot).toBe(1600);
  });

  it('does not credit a full year of growth to money paid in that year', () => {
    // The conservative convention: 1,600 rather than 1,650.
    const p = projectPension({ currentPot: 1000, annualContribution: 500, years: 1, realGrowthPercent: 10 });
    expect(p.finalPot).toBeLessThan((1000 + 500) * 1.1);
  });

  it('compounds across years', () => {
    const p = projectPension({ currentPot: 0, annualContribution: 1000, years: 3, realGrowthPercent: 10 });
    // 1000 -> 2100 -> 3310
    expect(p.years.map(y => y.pot)).toEqual([0, 1000, 2100, 3310]);
  });

  it('separates what was paid in from what growth added', () => {
    const p = projectPension({ currentPot: 0, annualContribution: 1000, years: 3, realGrowthPercent: 10 });
    expect(p.totalContributed).toBe(3000);
    expect(p.totalGrowth).toBe(310);
    expect(p.totalContributed + p.totalGrowth).toBe(p.finalPot);
  });

  it('still works with no growth at all', () => {
    const p = projectPension({ currentPot: 100, annualContribution: 100, years: 5, realGrowthPercent: 0 });
    expect(p.finalPot).toBe(600);
    expect(p.totalGrowth).toBe(0);
  });

  it('escalates contributions when asked', () => {
    const flat = projectPension({ currentPot: 0, annualContribution: 1000, years: 5, realGrowthPercent: 0 });
    const rising = projectPension({
      currentPot: 0, annualContribution: 1000, years: 5, realGrowthPercent: 0,
      contributionGrowthPercent: 10,
    });
    expect(rising.finalPot).toBeGreaterThan(flat.finalPot);
  });

  it('treats a negative pot or contribution as zero rather than draining it', () => {
    const p = projectPension({ currentPot: -500, annualContribution: -100, years: 3, realGrowthPercent: 5 });
    expect(p.finalPot).toBe(0);
  });

  it('rounds a fractional term down rather than part-projecting a year', () => {
    const a = projectPension({ currentPot: 0, annualContribution: 100, years: 2.9, realGrowthPercent: 0 });
    const b = projectPension({ currentPot: 0, annualContribution: 100, years: 2, realGrowthPercent: 0 });
    expect(a.finalPot).toBe(b.finalPot);
  });

  it('derives income from the pot at the stated withdrawal rate', () => {
    const p = projectPension({ currentPot: 500000, annualContribution: 0, years: 0, realGrowthPercent: 0 });
    expect(p.sustainableAnnualIncome).toBe(500000 * (SAFE_WITHDRAWAL_PERCENT / 100));
  });

  it('gives the same answer twice', () => {
    const i = { currentPot: 1234, annualContribution: 567, years: 20, realGrowthPercent: 4.5 };
    expect(projectPension(i)).toEqual(projectPension(i));
  });
});

describe('annualPensionContribution', () => {
  it('adds employee and employer shares', () => {
    expect(annualPensionContribution(50000, 5, 4)).toBe(4500);
  });

  it('is zero when nothing is contributed', () => {
    expect(annualPensionContribution(50000, 0, 0)).toBe(0);
  });
});

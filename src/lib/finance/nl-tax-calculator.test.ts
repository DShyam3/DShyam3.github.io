import { describe, expect, it } from 'vitest';
import {
  NL_ANW_RATE,
  NL_AOW_RATE,
  NL_BRACKET_1_RATE,
  NL_NATIONAL_INSURANCE_RATE,
  NL_TAX_YEAR_LABEL,
  NL_WAGE_TAX_RATE_BRACKET_1,
  NL_WLZ_RATE,
  calculateNlTax,
  nlGeneralTaxCredit,
  nlLabourTaxCredit,
  nlTaxBeforeCredits,
} from './nl-tax-calculator';

describe('calculateNlTax', () => {
  it('labels the tax year', () => {
    expect(NL_TAX_YEAR_LABEL).toBe('2026');
  });

  it('composes the first bracket from the published premium and wage-tax parts', () => {
    expect(NL_AOW_RATE + NL_ANW_RATE + NL_WLZ_RATE).toBeCloseTo(NL_NATIONAL_INSURANCE_RATE, 12);
    expect(NL_NATIONAL_INSURANCE_RATE).toBeCloseTo(0.2765, 12);
    expect(NL_NATIONAL_INSURANCE_RATE + NL_WAGE_TAX_RATE_BRACKET_1).toBeCloseTo(NL_BRACKET_1_RATE, 12);
    expect(NL_BRACKET_1_RATE).toBe(0.3575);
  });

  it('50,000', () => {
    const r = calculateNlTax({ income: 50_000 });
    expect(r.taxBeforeCredits).toBeCloseTo(18_076.2177, 6);
    expect(r.nationalInsuranceBeforeCredits).toBeCloseTo(10_751.1495, 6);
    expect(r.generalTaxCredit).toBeCloseTo(1_818.50928, 6);
    expect(r.labourTaxCredit).toBeCloseTo(5_398.0392, 6);
    expect(r.taxAfterCredits).toBeCloseTo(10_859.66922, 6);
    expect(r.takeHome).toBeCloseTo(39_140.33078, 6);
  });

  it('20,000', () => {
    const r = calculateNlTax({ income: 20_000 });
    expect(r.taxBeforeCredits).toBeCloseTo(7_150, 6);
    expect(r.generalTaxCredit).toBeCloseTo(3_115, 6);
    expect(r.labourTaxCredit).toBeCloseTo(3_487.57315, 6);
    expect(r.taxAfterCredits).toBeCloseTo(547.42685, 6);
    expect(r.takeHome).toBeCloseTo(19_452.57315, 6);
  });

  it('10,000: credits are capped at the tax due', () => {
    const r = calculateNlTax({ income: 10_000 });
    expect(r.taxBeforeCredits).toBeCloseTo(3_575, 6);
    expect(r.creditsApplied).toBeCloseTo(3_575, 6);
    expect(r.taxAfterCredits).toBeCloseTo(0, 6);
    expect(r.takeHome).toBeCloseTo(10_000, 6);
  });

  it('100,000', () => {
    const r = calculateNlTax({ income: 100_000 });
    expect(r.taxBeforeCredits).toBeCloseTo(39_432.1533, 6);
    expect(r.generalTaxCredit).toBe(0);
    expect(r.labourTaxCredit).toBeCloseTo(2_143.0392, 6);
    expect(r.takeHome).toBeCloseTo(62_710.8859, 6);
  });

  it('150,000 has no credits', () => {
    const r = calculateNlTax({ income: 150_000 });
    expect(r.labourTaxCredit).toBe(0);
    expect(r.generalTaxCredit).toBe(0);
    expect(r.creditsApplied).toBe(0);
  });

  it('zero income gives all zeros', () => {
    const r = calculateNlTax({ income: 0 });
    // The general credit is a table value (3,115 at 0), but none of it is applied.
    const { generalTaxCredit, ...rest } = r;
    expect(generalTaxCredit).toBe(3_115);
    expect(Object.values(rest).every((v) => v === 0)).toBe(true);
  });

  it('treats negative and non-finite income as 0', () => {
    for (const bad of [-5_000, NaN, Infinity, -Infinity]) {
      const r = calculateNlTax({ income: bad });
      expect(r.income).toBe(0);
      expect(r.takeHome).toBe(0);
      expect(r.taxBeforeCredits).toBe(0);
    }
  });

  it('a single euro is fully covered by credits', () => {
    const r = calculateNlTax({ income: 1 });
    expect(r.taxAfterCredits).toBe(0);
    expect(r.takeHome).toBe(1);
  });
});

describe('nlTaxBeforeCredits boundaries', () => {
  it('at the first bracket limit', () => {
    expect(nlTaxBeforeCredits(38_883)).toBeCloseTo(13_900.6725, 6);
    expect(calculateNlTax({ income: 38_883 }).nationalInsuranceBeforeCredits).toBeCloseTo(
      10_751.1495,
      6,
    );
  });

  it('just above the first bracket limit uses the second rate', () => {
    expect(nlTaxBeforeCredits(38_884) - nlTaxBeforeCredits(38_883)).toBeCloseTo(0.3756, 6);
  });

  it('at the second bracket limit', () => {
    expect(nlTaxBeforeCredits(78_426)).toBeCloseTo(13_900.6725 + 39_543 * 0.3756, 6);
  });

  it('just above the second bracket limit uses the top rate', () => {
    expect(nlTaxBeforeCredits(78_427) - nlTaxBeforeCredits(78_426)).toBeCloseTo(0.495, 6);
  });

  it('national insurance stops growing above the first bracket', () => {
    const a = calculateNlTax({ income: 60_000 }).nationalInsuranceBeforeCredits;
    const b = calculateNlTax({ income: 90_000 }).nationalInsuranceBeforeCredits;
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('nlGeneralTaxCredit boundaries', () => {
  it('is the maximum up to and including 29,736', () => {
    expect(nlGeneralTaxCredit(0)).toBe(3_115);
    expect(nlGeneralTaxCredit(29_736)).toBeCloseTo(3_115, 6);
  });

  it('phases out just above 29,736', () => {
    expect(nlGeneralTaxCredit(29_737)).toBeCloseTo(3_115 - 0.06398, 6);
  });

  it('reaches roughly 0 at 78,426 and never goes negative', () => {
    const v = nlGeneralTaxCredit(78_426);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeCloseTo(0, 1);
    expect(nlGeneralTaxCredit(78_427)).toBe(0);
    expect(nlGeneralTaxCredit(1_000_000)).toBe(0);
  });
});

describe('nlLabourTaxCredit boundaries', () => {
  it('at and just above 11,965', () => {
    expect(nlLabourTaxCredit(11_965)).toBeCloseTo(0.08324 * 11_965, 6);
    expect(nlLabourTaxCredit(11_966)).toBeCloseTo(996 + 0.31009, 6);
  });

  it('at and just above 25,845', () => {
    expect(nlLabourTaxCredit(25_845)).toBeCloseTo(996 + 0.31009 * 13_880, 6);
    expect(nlLabourTaxCredit(25_846)).toBeCloseTo(5_300.0195, 6);
  });

  it('at and just above 45,592', () => {
    expect(nlLabourTaxCredit(45_592)).toBeCloseTo(5_300 + 0.0195 * 19_747, 6);
    expect(nlLabourTaxCredit(45_593)).toBeCloseTo(5_685 - 0.0651, 6);
  });

  it('at and just above 132,920', () => {
    expect(nlLabourTaxCredit(132_920)).toBe(0);
    expect(nlLabourTaxCredit(132_921)).toBe(0);
    expect(nlLabourTaxCredit(132_919)).toBeCloseTo(5_685 - 0.0651 * 87_327, 6);
  });

  it('zero at zero income', () => {
    expect(nlLabourTaxCredit(0)).toBe(0);
  });
});

describe('take-home sweep', () => {
  it('is monotonic with a marginal take-home between 0 and 1', () => {
    let prev = calculateNlTax({ income: 0 }).takeHome;
    for (let income = 997; income <= 400_000; income += 997) {
      const next = calculateNlTax({ income }).takeHome;
      const marginal = (next - prev) / 997;
      expect(next).toBeGreaterThanOrEqual(prev - 0.05);
      expect(marginal).toBeGreaterThanOrEqual(-0.05 / 997);
      expect(marginal).toBeLessThanOrEqual(1 + 0.05 / 997);
      prev = next;
    }
  });
});

/**
 * Regression cases at the anchors of the Belastingdienst "Rates for 2026"
 * tables (Table 1 brackets, Tables 2a/2b credits). The expected values are this
 * module's own outputs at those anchors, so they guard against regressions
 * rather than check against an independent source; the white-table block below
 * is the independent check.
 */
describe('regression cases at the 2026 rate-table anchors', () => {
  it('matches Table 1 cumulative bracket anchors under AOW age', () => {
    const bracket1Top = calculateNlTax({ income: 38_883 });
    expect(bracket1Top.nationalInsuranceBeforeCredits).toBeCloseTo(38_883 * 0.2765, 10);
    expect(bracket1Top.nationalInsuranceBeforeCredits).toBeCloseTo(10_751.1495, 10);
    expect(bracket1Top.taxBeforeCredits - bracket1Top.nationalInsuranceBeforeCredits).toBeCloseTo(
      3_149.523,
      10,
    );
    expect(bracket1Top.taxBeforeCredits).toBeCloseTo(13_900.6725, 10);

    const bracket2Top = calculateNlTax({ income: 78_426 });
    expect(bracket2Top.nationalInsuranceBeforeCredits).toBeCloseTo(10_751.1495, 10);
    expect(bracket2Top.taxBeforeCredits).toBeCloseTo(28_753.0233, 10);
  });

  it('matches Table 2a/2b published segment base anchors and Rekenvoorschriften rounding', () => {
    expect(nlGeneralTaxCredit(29_736)).toBe(3_115);
    expect(nlGeneralTaxCredit(78_423)).toBeCloseTo(0.00574, 8);
    expect(nlGeneralTaxCredit(78_426)).toBe(0);

    expect(nlLabourTaxCredit(11_965)).toBeCloseTo(995.9666, 8);
    expect(Math.abs(nlLabourTaxCredit(11_965) - 996)).toBeLessThanOrEqual(0.04);

    expect(nlLabourTaxCredit(25_845)).toBeCloseTo(5_300.0492, 8);
    expect(Math.abs(nlLabourTaxCredit(25_845) - 5_300)).toBeLessThanOrEqual(0.05);

    expect(nlLabourTaxCredit(45_592)).toBeCloseTo(5_685.0665, 8);
    expect(Math.abs(nlLabourTaxCredit(45_592) - 5_685)).toBeLessThanOrEqual(0.07);

    expect(nlLabourTaxCredit(132_920)).toBe(0);
  });

  it.each([
    {
      income: 20_000,
      taxBeforeCredits: 7_150,
      generalTaxCredit: 3_115,
      labourTaxCredit: 3_487.57315,
      taxAfterCredits: 547.42685,
      takeHome: 19_452.57315,
    },
    {
      income: 38_883,
      taxBeforeCredits: 13_900.6725,
      generalTaxCredit: 2_529.77494,
      labourTaxCredit: 5_554.241,
      taxAfterCredits: 5_816.65656,
      takeHome: 33_066.34344,
    },
    {
      income: 50_000,
      taxBeforeCredits: 18_076.2177,
      generalTaxCredit: 1_818.50928,
      labourTaxCredit: 5_398.0392,
      taxAfterCredits: 10_859.66922,
      takeHome: 39_140.33078,
    },
    {
      income: 78_426,
      taxBeforeCredits: 28_753.0233,
      generalTaxCredit: 0,
      labourTaxCredit: 3_547.5066,
      taxAfterCredits: 25_205.5167,
      takeHome: 53_220.4833,
    },
    {
      income: 120_000,
      taxBeforeCredits: 49_332.1533,
      generalTaxCredit: 0,
      labourTaxCredit: 841.0392,
      taxAfterCredits: 48_491.1141,
      takeHome: 71_508.8859,
    },
  ])(
    'matches full-year Box 1 assessment and whole-euro table rounding at € $income',
    ({ income, taxBeforeCredits, generalTaxCredit, labourTaxCredit, taxAfterCredits, takeHome }) => {
      const result = calculateNlTax({ income });
      expect(result.taxBeforeCredits).toBeCloseTo(taxBeforeCredits, 8);
      expect(result.generalTaxCredit).toBeCloseTo(generalTaxCredit, 8);
      expect(result.labourTaxCredit).toBeCloseTo(labourTaxCredit, 8);
      expect(result.taxAfterCredits).toBeCloseTo(taxAfterCredits, 8);
      expect(result.takeHome).toBeCloseTo(takeHome, 8);

      const wholeEuroTableTax = Math.max(
        0,
        Math.round(result.taxBeforeCredits) -
          Math.round(result.generalTaxCredit) -
          Math.round(result.labourTaxCredit),
      );
      expect(Math.abs(result.taxAfterCredits - wholeEuroTableTax)).toBeLessThanOrEqual(2);
    },
  );
});


/**
 * Rows of the Belastingdienst's official 2026 white monthly wage tax table
 * (Witte Maandloon-tabel, Nederland, Standaard, uitgave januari 2026,
 * wit_mnd_nl_std_20260101.pdf from the loonbelastingtabellen tool), read on
 * 2026-11-05. Columns for employees below AOW age: tax and premiums without
 * the payroll tax credit, with it, and the labour tax credit applied. The
 * table rounds annual amounts before dividing by 12, so an unrounded annual
 * estimate lands within cents a month of each row.
 */
describe('Belastingdienst 2026 white monthly table', () => {
  it.each([
    { wage: 1_498.5, without: 535.67, withCredit: 37.58, labour: 238.5 },
    { wage: 1_669.5, without: 596.83, withCredit: 45.67, labour: 291.58 },
    { wage: 3_163.5, without: 1_130.92, withCredit: 453.75, labour: 461.42 },
    { wage: 3_334.5, without: 1_193.67, withCredit: 524.08, labour: 464.75 },
    { wage: 4_162.5, without: 1_504.67, withCredit: 902.67, labour: 450.17 },
    { wage: 4_333.5, without: 1_568.92, withCredit: 989, labour: 439 },
    { wage: 6_493.5, without: 2_380.25, withCredit: 2_079.08, labour: 298.42 },
    { wage: 6_664.5, without: 2_459.83, withCredit: 2_172.58, labour: 287.25 },
    { wage: 8_329.5, without: 3_284, withCredit: 3_105.08, labour: 178.92 },
    { wage: 8_334, without: 3_286.25, withCredit: 3_107.67, labour: 178.58 },
  ])('matches the table row for a monthly wage of $wage within cents', ({ wage, without, withCredit, labour }) => {
    const r = calculateNlTax({ income: wage * 12 });
    expect(Math.abs(r.taxBeforeCredits / 12 - without)).toBeLessThanOrEqual(0.15);
    expect(Math.abs(r.labourTaxCredit / 12 - labour)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(r.taxAfterCredits / 12 - withCredit)).toBeLessThanOrEqual(0.3);
  });
});

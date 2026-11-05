import { describe, expect, it } from 'vitest';
import {
  DE_AVERAGE_HEALTH_ADDITIONAL_RATE,
  DE_TAX_YEAR_LABEL,
  calculateDeTax,
  deIncomeTax,
  deSolidaritySurcharge,
} from './de-tax-calculator';

describe('constants', () => {
  it('labels the tax year', () => {
    expect(DE_TAX_YEAR_LABEL).toBe('2026');
    expect(DE_AVERAGE_HEALTH_ADDITIONAL_RATE).toBe(0.029);
  });
});

describe('deIncomeTax', () => {
  it('is 0 at and just above the basic allowance', () => {
    expect(deIncomeTax(12_348)).toBe(0);
    expect(deIncomeTax(12_349)).toBe(0);
  });
  it('is 0 for zero, negative and non-finite input', () => {
    expect(deIncomeTax(0)).toBe(0);
    expect(deIncomeTax(-5_000)).toBe(0);
    expect(deIncomeTax(Number.NaN)).toBe(0);
  });
  it('crosses the zone 2 / zone 3 boundary', () => {
    expect(deIncomeTax(17_799)).toBe(1_034);
    expect(deIncomeTax(17_800)).toBe(1_035);
  });
  it('crosses the zone 3 / zone 4 boundary', () => {
    expect(deIncomeTax(69_878)).toBe(18_213);
    expect(deIncomeTax(69_879)).toBe(18_213);
  });
  it('uses the top rate from 277,826', () => {
    expect(deIncomeTax(277_825)).toBe(105_550);
    expect(deIncomeTax(277_826)).toBe(105_551);
  });
  it('drops fractions of a euro first', () => {
    expect(deIncomeTax(38_684.99)).toBe(deIncomeTax(38_684));
    expect(deIncomeTax(38_684.99)).toBe(6_796);
  });
});

describe('deSolidaritySurcharge', () => {
  it('is 0 at and below the Freigrenze', () => {
    expect(deSolidaritySurcharge(20_350)).toBe(0);
    expect(deSolidaritySurcharge(0)).toBe(0);
    expect(deSolidaritySurcharge(-1)).toBe(0);
  });
  it('phases in at 11.9% above the Freigrenze', () => {
    expect(deSolidaritySurcharge(31_607)).toBeCloseTo(1_339.58, 6);
  });
  it('reaches the flat 5.5% for a very high tax', () => {
    expect(deSolidaritySurcharge(100_000)).toBeCloseTo(5_500, 6);
  });
});

describe('calculateDeTax', () => {
  it('50,000 childless', () => {
    const r = calculateDeTax({ income: 50_000, childless: true });
    expect(r.pensionInsurance).toBeCloseTo(4_650, 6);
    expect(r.unemploymentInsurance).toBeCloseTo(650, 6);
    expect(r.healthInsurance).toBeCloseTo(4_375, 6);
    expect(r.careInsurance).toBeCloseTo(1_200, 6);
    expect(r.socialContributions).toBeCloseTo(10_875, 6);
    expect(r.deductibleProvisions).toBeCloseTo(10_050, 6);
    expect(r.taxableIncome).toBe(38_684);
    expect(r.incomeTax).toBe(6_796);
    expect(r.solidaritySurcharge).toBe(0);
    expect(r.takeHome).toBeCloseTo(32_329, 6);
    expect(r.supported).toBe(true);
  });

  it('50,000 with children', () => {
    const r = calculateDeTax({ income: 50_000, childless: false });
    expect(r.careInsurance).toBeCloseTo(900, 6);
    expect(r.socialContributions).toBeCloseTo(10_575, 6);
    // 4,650 + 0.96 * 4,375 + 900 = 9,750; the 1,900 cap is already exceeded.
    expect(r.deductibleProvisions).toBeCloseTo(9_750, 6);
    expect(r.taxableIncome).toBe(38_984);
    expect(r.incomeTax).toBe(deIncomeTax(38_984));
    expect(r.solidaritySurcharge).toBe(0);
    expect(r.takeHome).toBeCloseTo(50_000 - 10_575 - r.incomeTax, 6);
  });

  it('120,000 childless, above both ceilings', () => {
    const r = calculateDeTax({ income: 120_000, childless: true });
    expect(r.pensionInsurance).toBeCloseTo(9_430.2, 6);
    expect(r.unemploymentInsurance).toBeCloseTo(1_318.2, 6);
    expect(r.healthInsurance).toBeCloseTo(6_103.125, 6);
    expect(r.careInsurance).toBeCloseTo(1_674, 6);
    expect(r.deductibleProvisions).toBeCloseTo(16_963.2, 6);
    expect(r.taxableIncome).toBe(101_770);
    expect(r.incomeTax).toBe(31_607);
    expect(r.solidaritySurcharge).toBeCloseTo(1_339.58, 6);
    expect(r.takeHome).toBeCloseTo(68_527.895, 6);
  });

  it('17,000 (Midijob band, still computed): basic part is under 1,900 so only part of unemployment is deductible', () => {
    const r = calculateDeTax({ income: 17_000, childless: true });
    const basic = r.healthInsurance * 0.96 + r.careInsurance;
    expect(basic).toBeLessThan(1_900);
    expect(basic + r.unemploymentInsurance).toBeGreaterThan(1_900);
    expect(r.deductibleProvisions).toBeCloseTo(r.pensionInsurance + 1_900, 6);
    const zve = Math.floor(17_000 - 1_230 - 36 - r.deductibleProvisions);
    expect(r.taxableIncome).toBe(zve);
    expect(r.incomeTax).toBe(deIncomeTax(zve));
  });

  it('always deducts the basic part in full even above the 1,900 cap', () => {
    const r = calculateDeTax({ income: 60_000, childless: true });
    const basic = r.healthInsurance * 0.96 + r.careInsurance;
    expect(basic).toBeGreaterThan(1_900);
    expect(r.deductibleProvisions).toBeCloseTo(r.pensionInsurance + basic, 6);
  });

  it('flags the Midijob band as unsupported', () => {
    expect(calculateDeTax({ income: 24_000, childless: true }).supported).toBe(false);
    expect(calculateDeTax({ income: 24_001, childless: true }).supported).toBe(true);
  });

  it('gives zeros and unsupported for zero, negative and non-finite income', () => {
    for (const income of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = calculateDeTax({ income, childless: true });
      expect(r.income).toBe(0);
      expect(r.socialContributions).toBe(0);
      expect(r.deductibleProvisions).toBe(0);
      expect(r.taxableIncome).toBe(0);
      expect(r.incomeTax).toBe(0);
      expect(r.solidaritySurcharge).toBe(0);
      expect(r.takeHome).toBe(0);
      expect(r.supported).toBe(false);
    }
  });

  it('caps the Arbeitnehmer-Pauschbetrag at a tiny income', () => {
    const r = calculateDeTax({ income: 500, childless: false });
    expect(r.taxableIncome).toBe(0);
    expect(r.incomeTax).toBe(0);
  });

  it('a health additional rate override changes health only', () => {
    const base = calculateDeTax({ income: 50_000, childless: true });
    const r = calculateDeTax({ income: 50_000, childless: true, healthAdditionalRate: 0.025 });
    expect(r.healthInsurance).toBeCloseTo(50_000 * (0.146 + 0.025) / 2, 6);
    expect(r.pensionInsurance).toBeCloseTo(base.pensionInsurance, 6);
    expect(r.unemploymentInsurance).toBeCloseTo(base.unemploymentInsurance, 6);
    expect(r.careInsurance).toBeCloseTo(base.careInsurance, 6);
  });

  it('take-home never falls as pay rises', () => {
    let previous = -Infinity;
    for (let income = 24_001; income <= 400_000; income += 997) {
      const { takeHome } = calculateDeTax({ income, childless: true });
      expect(takeHome).toBeGreaterThanOrEqual(previous);
      previous = takeHome;
    }
  });
});

/**
 * Reference cases from the Federal Ministry of Finance's official calculator,
 * https://www.bmf-steuerrechner.de, run on 2026-11-05.
 */
describe('BMF official calculator, 2026', () => {
  // Berechnung der Einkommensteuer: zvE in, alleinstehend, Berechnungsjahr 2026.
  it.each([
    { zvE: 17_799, incomeTax: 1_034, soli: 0 },
    { zvE: 38_684, incomeTax: 6_796, soli: 0 },
    { zvE: 69_878, incomeTax: 18_213, soli: 0 },
    { zvE: 101_770, incomeTax: 31_607, soli: 1_339.58 },
    { zvE: 277_826, incomeTax: 105_551, soli: 5_805.3 },
  ])('matches the Einkommensteuer result at zvE $zvE', ({ zvE, incomeTax, soli }) => {
    expect(deIncomeTax(zvE)).toBe(incomeTax);
    expect(deSolidaritySurcharge(incomeTax)).toBeCloseTo(soli, 10);
  });

  // Berechnung der Lohnsteuer 2026: Jahr, Steuerklasse 1, no church tax,
  // statutory RV/AloV/KV, Zusatzbeitrag 2.90%, PV mit Zuschlag (not Saxony).
  // Withholding is not the assessment: its Vorsorgepauschale deducts health
  // insurance at the reduced 14.0% base rather than the assessment's 4%
  // reduction, so it deducts slightly more and withholds slightly less. The
  // assessment estimate must sit just above it, never below.
  it.each([
    { income: 50_000, lohnsteuer: 6_788, soli: 0 },
    { income: 120_000, lohnsteuer: 31_593, soli: 1_337.91 },
  ])('sits just above BMF Lohnsteuer withholding at a gross of $income', ({ income, lohnsteuer, soli }) => {
    const result = calculateDeTax({ income, childless: true });
    expect(result.incomeTax - lohnsteuer).toBeGreaterThanOrEqual(0);
    expect(result.incomeTax - lohnsteuer).toBeLessThanOrEqual(20);
    expect(result.solidaritySurcharge - soli).toBeGreaterThanOrEqual(0);
    expect(result.solidaritySurcharge - soli).toBeLessThanOrEqual(2.5);
  });
});

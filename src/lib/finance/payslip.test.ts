import { describe, expect, it } from 'vitest';
import {
  checkPayslip, compareToModel, deductionRate, effectiveTaxRate, inTaxYear,
  studentLoanPaidInTaxYear, sumPayslips, taxYearOf, totalDeductions, type Payslip,
} from './payslip';

const slip = (over: Partial<Payslip> = {}): Payslip => ({
  id: 'p1',
  payDate: '2026-08-28',
  gross: 4000,
  incomeTax: 600,
  nationalInsurance: 250,
  pensionEmployee: 200,
  pensionEmployer: 300,
  studentLoan: 150,
  otherDeductions: 0,
  net: 2800,
  ...over,
});

describe('totalDeductions', () => {
  it('adds what came off gross', () => {
    expect(totalDeductions(slip())).toBe(1200);
  });

  it('excludes the employer pension contribution', () => {
    // The classic way to make net stop reconciling: it never came out of pay.
    expect(totalDeductions(slip({ pensionEmployer: 99999 }))).toBe(1200);
  });
});

describe('checkPayslip', () => {
  it('reconciles when gross minus deductions equals the stated net', () => {
    const check = checkPayslip(slip());
    expect(check.expectedNet).toBe(2800);
    expect(check.difference).toBe(0);
    expect(check.reconciles).toBe(true);
  });

  it('reports the gap when a figure was miskeyed', () => {
    const check = checkPayslip(slip({ net: 2750 }));
    expect(check.difference).toBe(-50);
    expect(check.reconciles).toBe(false);
  });

  it('tolerates floating-point noise rather than calling it a fault', () => {
    const check = checkPayslip(slip({ gross: 4000.1, net: 2800.1 }));
    expect(check.reconciles).toBe(true);
  });
});

describe('rates', () => {
  it('reports deductions and tax as shares of gross', () => {
    expect(deductionRate(slip())).toBeCloseTo(30, 6);
    expect(effectiveTaxRate(slip())).toBeCloseTo(21.25, 6);
  });

  it('returns zero on zero gross instead of NaN', () => {
    const empty = slip({ gross: 0 });
    expect(deductionRate(empty)).toBe(0);
    expect(effectiveTaxRate(empty)).toBe(0);
    expect(Number.isNaN(deductionRate(empty))).toBe(false);
  });
});

describe('sumPayslips', () => {
  it('totals every column and counts the slips', () => {
    const totals = sumPayslips([slip(), slip({ id: 'p2' })]);
    expect(totals.count).toBe(2);
    expect(totals.gross).toBe(8000);
    expect(totals.studentLoan).toBe(300);
    expect(totals.pensionEmployer).toBe(600);
  });

  it('returns zeroes for no payslips', () => {
    expect(sumPayslips([])).toEqual({
      count: 0, gross: 0, incomeTax: 0, nationalInsurance: 0,
      pensionEmployee: 0, pensionEmployer: 0, studentLoan: 0, otherDeductions: 0, net: 0,
    });
  });
});

describe('taxYearOf', () => {
  it('starts the year on 6 April', () => {
    expect(taxYearOf('2026-04-06')).toBe(2026);
    expect(taxYearOf('2026-04-05')).toBe(2025);
  });

  it('puts the calendar new year in the previous tax year', () => {
    expect(taxYearOf('2027-01-15')).toBe(2026);
    expect(taxYearOf('2026-12-31')).toBe(2026);
  });

  it('handles a date well inside the year', () => {
    expect(taxYearOf('2026-08-28')).toBe(2026);
  });
});

describe('tax-year selection', () => {
  const slips = [
    slip({ id: 'a', payDate: '2026-03-28', studentLoan: 100 }), // 2025/26
    slip({ id: 'b', payDate: '2026-04-28', studentLoan: 150 }), // 2026/27
    slip({ id: 'c', payDate: '2027-02-28', studentLoan: 175 }), // 2026/27
  ];

  it('selects by tax year, not calendar year', () => {
    expect(inTaxYear(slips, 2026).map(p => p.id)).toEqual(['b', 'c']);
    expect(inTaxYear(slips, 2025).map(p => p.id)).toEqual(['a']);
  });

  it('totals the student loan actually repaid in a tax year', () => {
    expect(studentLoanPaidInTaxYear(slips, 2026)).toBe(325);
    expect(studentLoanPaidInTaxYear(slips, 2024)).toBe(0);
  });
});

describe('compareToModel', () => {
  it('reports the gap and how far off it is', () => {
    expect(compareToModel(325, 300)).toEqual({
      actual: 325, modelled: 300, difference: 25, percentOff: 8.33,
    });
  });

  it('signs the difference so the payslip taking more is positive', () => {
    expect(compareToModel(280, 300).difference).toBe(-20);
  });

  it('distinguishes nothing to compare from a comparison of zero', () => {
    expect(compareToModel(325, null)).toEqual({
      actual: 325, modelled: null, difference: null, percentOff: null,
    });
    expect(compareToModel(325, 0)).toEqual({
      actual: 325, modelled: 0, difference: 325, percentOff: null,
    });
  });
});

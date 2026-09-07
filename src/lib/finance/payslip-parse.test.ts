import { describe, expect, it } from 'vitest';
import { parsePayslipFilename, parsePayslipText, parsedFieldCount } from './payslip-parse';

/**
 * Layouts, not real payslips. The figures are invented; what is being tested
 * is the wording and column arrangement UK payroll systems actually use.
 */
const TWO_COLUMN = `
ACME PAYROLL SERVICES
Employee: A N Other        Pay Date 28/08/2026
Payments                          Deductions
Basic Pay          3,500.00       PAYE Tax            612.40
Overtime             250.00       National Insurance  248.16
                                  Pension              210.00
                                  Student Loan         162.00
Gross Pay          3,750.00       Total Deductions   1,232.56
                                  Net Pay            2,517.44
`;

const RATE_UNITS_AMOUNT = `
Payment Date 28 August 2026
Description        Rate    Units      Amount
Basic Salary      21.50    160.00    3,440.00
Gross Pay                            3,440.00
PAYE                                   580.20
National Insurance                     235.10
Employee Pension                       172.00
Employer Pension                       258.00
Student Loan Plan 2                    145.00
Net Pay                              2,307.70
`;

const WITH_YTD = `
Pay Date 28/08/2026
                      This Period    Year to Date
Gross Pay                3,000.00       15,000.00
PAYE                       500.00        2,500.00
National Insurance         200.00        1,000.00
Net Pay                  2,300.00       11,500.00
Taxable Pay to Date                     15,000.00
`;

describe('parsePayslipText — two-column layout', () => {
  const parsed = parsePayslipText(TWO_COLUMN);

  it('finds every deduction and the totals', () => {
    expect(parsed.gross).toBe(3750);
    expect(parsed.incomeTax).toBe(612.4);
    expect(parsed.nationalInsurance).toBe(248.16);
    expect(parsed.pensionEmployee).toBe(210);
    expect(parsed.studentLoan).toBe(162);
    expect(parsed.net).toBe(2517.44);
  });

  it('reads the pay date', () => {
    expect(parsed.payDate).toBe('2026-08-28');
  });

  it('leaves what it did not find undefined rather than zero', () => {
    // Zero is a claim. Undefined is "you type this one".
    expect(parsed.pensionEmployer).toBeUndefined();
  });
});

describe('parsePayslipText — rate/units/amount rows', () => {
  const parsed = parsePayslipText(RATE_UNITS_AMOUNT);

  it('takes the amount, not the hourly rate or the unit count', () => {
    expect(parsed.gross).toBe(3440);
    expect(parsed.incomeTax).toBe(580.2);
  });

  it('keeps employer and employee pension apart', () => {
    // Swapping these makes net stop reconciling in a way that looks plausible.
    expect(parsed.pensionEmployee).toBe(172);
    expect(parsed.pensionEmployer).toBe(258);
  });

  it('reads a written-out date', () => {
    expect(parsed.payDate).toBe('2026-08-28');
  });

  it('matches a plan-numbered student loan line', () => {
    expect(parsed.studentLoan).toBe(145);
  });
});

describe('parsePayslipText — year-to-date columns', () => {
  const parsed = parsePayslipText(WITH_YTD);

  it('takes this period, never the running total', () => {
    // Getting this wrong enters a year's pay as a month's.
    expect(parsed.gross).toBe(3000);
    expect(parsed.incomeTax).toBe(500);
    expect(parsed.net).toBe(2300);
  });

  it('ignores a cumulative-only row entirely', () => {
    expect(parsed.gross).not.toBe(15000);
  });
});

describe('parsePayslipText — nothing useful', () => {
  it('returns an empty result rather than guessing', () => {
    expect(parsePayslipText('')).toEqual({});
    expect(parsePayslipText('Dear employee, your P60 is enclosed.')).toEqual({});
  });

  it('does not invent a figure from a label with no number', () => {
    expect(parsePayslipText('Net Pay').net).toBeUndefined();
  });
});

describe('parsedFieldCount', () => {
  it('counts only the money fields that were found', () => {
    expect(parsedFieldCount(parsePayslipText(TWO_COLUMN))).toBe(6);
    expect(parsedFieldCount(parsePayslipText(RATE_UNITS_AMOUNT))).toBe(7);
    expect(parsedFieldCount({})).toBe(0);
  });
});

describe('parsePayslipFilename', () => {
  it('reads a year-month name, dating it to the first as a placeholder', () => {
    expect(parsePayslipFilename('2026-06_Capgemini_Payslip.pdf')).toEqual({
      payDate: '2026-06-01',
      employer: 'Capgemini',
    });
  });

  it('prefers a full date when the name carries one', () => {
    expect(parsePayslipFilename('2026-06-28_Capgemini_Payslip.pdf').payDate).toBe('2026-06-28');
  });

  it('keeps a multi-word employer together', () => {
    expect(parsePayslipFilename('2025-12_UCL_Payslip.pdf').employer).toBe('UCL');
    expect(parsePayslipFilename('2022-07_Keysight_Payslip.pdf').employer).toBe('Keysight');
  });

  it('drops the document-kind word rather than treating it as an employer', () => {
    expect(parsePayslipFilename('2024-25_MyTutor_Earnings.xlsx').employer).toBe('MyTutor');
  });

  it('returns nothing useful for a name that says nothing', () => {
    expect(parsePayslipFilename('scan001.pdf')).toEqual({ employer: 'scan001' });
    expect(parsePayslipFilename('2026-13_Thing.pdf').payDate).toBeUndefined();
  });
});

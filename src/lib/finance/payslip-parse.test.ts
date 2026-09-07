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

/**
 * The shape that broke the first importer, with invented figures.
 *
 * Two things about it: "Gross pay" is the year-to-date figure, sitting under a
 * "Running Totals" heading on its own line, while the period gross is "Total
 * Earnings". And tax is negative, because that month it was a refund.
 */
const RUNNING_TOTALS_BLOCK = `
Payment date on HMRC Personal Tax Account will show as 28/08/2022
Earnings Units Rate Amount Deductions Amount
Base Pay 1,000.00 Tax(code 1257L) -50.00
NI(category M) 40.00
Total Earnings 1,000.00 Total Deductions -10.00
Running Totals Amount Paid
Tax Year to Date Earnings 1,000.00
Gross pay 2,000.00 Deductions -10.00
Taxable pay 2,050.00
Net pay 1,010.00
`;

describe('parsePayslipText — running-totals block', () => {
  const parsed = parsePayslipText(RUNNING_TOTALS_BLOCK);

  it('takes the period gross, not the running total beneath the heading', () => {
    // The failure this replaces read 2,000.00 and grew every month.
    expect(parsed.gross).toBe(1000);
  });

  it('keeps a negative tax, because that is a refund', () => {
    expect(parsed.incomeTax).toBe(-50);
  });

  it('reads a bracketed NI label', () => {
    expect(parsed.nationalInsurance).toBe(40);
  });

  it('reads net, and the whole thing reconciles', () => {
    expect(parsed.net).toBe(1010);
    // 1000 - (-50 + 40) = 1010.
    expect(parsed.gross! - (parsed.incomeTax! + parsed.nationalInsurance!)).toBe(1010);
  });

  it('reads the pay date from a sentence rather than a label', () => {
    expect(parsed.payDate).toBe('2022-08-28');
  });
});

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

/**
 * Salary sacrifice, with invented figures. The layout states the sacrifice and
 * the taxable pay left after it, and has no row called gross at all.
 */
const SACRIFICE = `
Payments Units Rate (£) Amount Deductions (£) Amount
Salary 4,000.00 Tax 700.00
Pension Salary Sacrifice -200.00 National Insurance 250.00
Student Loan Plan 2 150.00
Taxable Pay 3,800.00 Taxable Pay 11,400.00
Net Pay 2,700.00
`;

describe('parsePayslipText — salary sacrifice', () => {
  const parsed = parsePayslipText(SACRIFICE);

  it('works gross back out of taxable pay and the sacrifice', () => {
    expect(parsed.taxablePay).toBe(3800);
    expect(parsed.gross).toBe(4000);
  });

  it('records the sacrifice as a positive pension contribution', () => {
    // The payslip prints it negative, because that column subtracts it. As a
    // contribution it is an amount, and a minus would have every total add it
    // back.
    expect(parsed.pensionEmployee).toBe(200);
  });

  it('reconciles once gross is derived', () => {
    const deductions = parsed.incomeTax! + parsed.nationalInsurance!
      + parsed.pensionEmployee! + parsed.studentLoan!;
    expect(parsed.gross! - deductions).toBe(parsed.net);
  });

  it('does not derive a gross when the payslip states one', () => {
    const stated = parsePayslipText('Total Earnings 5,000.00\nTaxable Pay 3,800.00\nPension Salary Sacrifice -200.00');
    expect(stated.gross).toBe(5000);
  });

  it('leaves gross alone when there is no taxable pay to work from', () => {
    expect(parsePayslipText('Net Pay 2,700.00').gross).toBeUndefined();
  });
});

describe('parsePayslipText — competing date labels', () => {
  it('prefers the day paid over the day it appears at HMRC', () => {
    // One layout states both, two days apart. The pay day is the record.
    const both = `
      Payment date on HMRC Personal Tax Account will show as 28/05/2023
      1024009 Pay Day 26/05/2023
      Net Pay 1,200.00
    `;
    expect(parsePayslipText(both).payDate).toBe('2023-05-26');
  });

  it('takes a payment date when there is no pay day', () => {
    expect(parsePayslipText('Payment date 28/05/2023').payDate).toBe('2023-05-28');
  });

  it('reads a Pay Day label, which an earlier version missed entirely', () => {
    expect(parsePayslipText('Mr A N Other Pay Day 28/06/2023').payDate).toBe('2023-06-28');
  });
});

describe('parsePayslipText — a bare Earnings total', () => {
  it('takes the period earnings over the running-total gross', () => {
    // A leaving payslip states its period total as "Earnings" on a line that
    // begins with something else, so "Total Earnings" never matches and the
    // reader fell through to Gross Pay -- which here is the year to date.
    const leaver = `
      Earnings Units Rate Amount Deductions Amount
      Base Pay 1,370.00 Tax (Code 1257L) 66.40
      Total Hours 1.25 Earnings 1,380.54 Total Deductions 106.30
      Running Totals Amount Paid
      Gross Pay 7,412.92 Deductions 106.30
      Taxable Pay 7,412.92 Net Pay 1,274.24
    `;
    const parsed = parsePayslipText(leaver);
    expect(parsed.gross).toBe(1380.54);
    expect(parsed.net).toBe(1274.24);
  });

  it('ignores the column heading, which has no figure after it', () => {
    expect(parsePayslipText('Earnings Units Rate Amount').gross).toBeUndefined();
  });
});

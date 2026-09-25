import { describe, expect, it } from 'vitest';
import {
  parsePayslipFilename, parsePayslipText, parsePositionedPayslip, parsedFieldCount,
  type PositionedLine,
} from './payslip-parse';

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
    expect(parsePayslipFilename('2026-06_Acme_Payslip.pdf')).toEqual({
      payDate: '2026-06-01',
      employer: 'Acme',
    });
  });

  it('prefers a full date when the name carries one', () => {
    expect(parsePayslipFilename('2026-06-28_Acme_Payslip.pdf').payDate).toBe('2026-06-28');
  });

  it('keeps a multi-word employer together', () => {
    expect(parsePayslipFilename('2025-12_UCL_Payslip.pdf').employer).toBe('UCL');
    expect(parsePayslipFilename('2022-07_Northwind_Payslip.pdf').employer).toBe('Northwind');
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

describe('parsePayslipText — a payslip that never says "net"', () => {
  it('reads Total Amount Paid as net', () => {
    const parsed = parsePayslipText('Total Gross Pay 247.26\nTotal Amount Paid 247.26');
    expect(parsed.net).toBe(247.26);
    expect(parsed.gross).toBe(247.26);
  });

  it('reads a hyphenated month, which an earlier version missed', () => {
    // "31-Dec-2025" matched neither the numeric nor the spaced-name form, so
    // the payslip fell back to its filename and lost the day.
    expect(parsePayslipText('Payment Date 31-Dec-2025').payDate).toBe('2025-12-31');
    expect(parsePayslipText('Pay Day 28 August 2026').payDate).toBe('2026-08-28');
  });
});

/**
 * The vocabulary tests below cover a wider set of UK payslip label wording
 * than any one archive uses. Every figure is invented; what is being checked
 * is the wording and abbreviation UK payroll systems are seen to use, not a
 * real export.
 */

describe('parsePayslipText — National Insurance vocabulary', () => {
  it('reads a bare NI label', () => {
    expect(parsePayslipText('NI 245.00').nationalInsurance).toBe(245);
  });

  it('reads the employee abbreviations Ees and EE', () => {
    expect(parsePayslipText('Ees NI 245.00').nationalInsurance).toBe(245);
    expect(parsePayslipText('EE NI 245.00').nationalInsurance).toBe(245);
  });

  it('reads NI with "Employee" written after it', () => {
    expect(parsePayslipText('NI Employee 245.00').nationalInsurance).toBe(245);
  });
});

describe('parsePayslipText — employer National Insurance is recognised, never claimed as the employee\'s', () => {
  // Each line alone carries only the employer's figure, so the correct
  // result is nothing at all -- claiming it under `nationalInsurance` would
  // be silently handing the employee the employer's number.
  it.each([
    'Employer NI 300.00',
    'Ers NI 300.00',
    'Employer NIC 300.00',
    'ER NIC 300.00',
  ])('leaves %s unclaimed by any field', (line) => {
    expect(parsePayslipText(line)).toEqual({});
  });

  it('keeps the employer\'s figure out of the employee\'s field on a combined line', () => {
    // The dangerous shape: employer NI written first, on the same line as
    // the employee's -- a bare `\bni\b` fallback would otherwise walk
    // straight past "Employer" and claim the first figure it finds.
    const parsed = parsePayslipText('Ers NIC 210.00 Ees NI 180.00');
    expect(parsed.nationalInsurance).toBe(180);
  });
});

describe('parsePayslipText — an Ees/Ers abbreviated layout', () => {
  // Employer NIC deliberately precedes the employee's NI on one line, and
  // employer pension precedes employee pension on another -- the shape that
  // breaks a reader which claims the first NI/pension figure it meets.
  const EES_ERS_LAYOUT = `
Pay Day 15/07/2026
Basic Pay              2,800.00
PAYE Tax                 250.00
Ers NIC 210.00 Ees NI 180.00
Ers Pension 90.00 Ees Pension 140.00
Stud Loan 45.00
Gross Pay              2,800.00
Net Payable            2,185.00
`;
  const parsed = parsePayslipText(EES_ERS_LAYOUT);

  it('reads gross, tax and the pay date', () => {
    expect(parsed.gross).toBe(2800);
    expect(parsed.incomeTax).toBe(250);
    expect(parsed.payDate).toBe('2026-07-15');
  });

  it('gives the employee\'s NI to nationalInsurance, not the employer\'s 210', () => {
    expect(parsed.nationalInsurance).toBe(180);
  });

  it('keeps employer and employee pension apart under their Ers/Ees abbreviations', () => {
    expect(parsed.pensionEmployer).toBe(90);
    expect(parsed.pensionEmployee).toBe(140);
  });

  it('reads an abbreviated student loan line', () => {
    expect(parsed.studentLoan).toBe(45);
  });

  it('reads "Net Payable" as net', () => {
    // 2800 - 250 - 180 - 140 - 45 = 2185.
    expect(parsed.net).toBe(2185);
  });
});

describe('parsePayslipText — student loan vocabulary', () => {
  it('reads the abbreviated "Stud Loan"', () => {
    expect(parsePayslipText('Stud Loan 50.00').studentLoan).toBe(50);
  });

  it('reads a plan-numbered "SL Plan 2"', () => {
    expect(parsePayslipText('SL Plan 2 50.00').studentLoan).toBe(50);
  });

  it('reads the postgraduate abbreviation "PG Loan"', () => {
    expect(parsePayslipText('PG Loan 30.00').studentLoan).toBe(30);
  });

  it('does not claim a bare "SL" that names no plan, digit or bracket', () => {
    // "SL" followed by an ordinary word is too short a token to claim on its
    // own -- nothing else on the line matches either, so the whole line goes
    // unclaimed rather than guessed.
    expect(parsePayslipText('SL Payment 50.00')).toEqual({});
  });

  it('does not crash on a bare "SL" with nothing after it', () => {
    expect(parsePayslipText('SL').studentLoan).toBeUndefined();
  });
});

describe('parsePayslipText — a Total Pay gross and a Net Payable', () => {
  it('reads "Total Pay" as gross', () => {
    expect(parsePayslipText('Total Pay 3,000.00').gross).toBe(3000);
  });

  it('does not read "Total Payable" as gross', () => {
    // "Payable" fails the word boundary straight after "pay", by design --
    // the same boundary that lets "Net Payable" match "net pay" below.
    expect(parsePayslipText('Total Payable 3,000.00').gross).toBeUndefined();
  });

  it('reads "Net Payable" as net', () => {
    expect(parsePayslipText('Net Payable 2,000.00').net).toBe(2000);
  });
});

describe('parsePayslipText — employer and employee pension abbreviations', () => {
  it('reads Ers/ER as the employer\'s contribution', () => {
    expect(parsePayslipText('Ers Pension 90.00').pensionEmployer).toBe(90);
    expect(parsePayslipText('ER Pension 90.00').pensionEmployer).toBe(90);
  });

  it('reads Ees/EE as the employee\'s contribution', () => {
    expect(parsePayslipText('Ees Pension 150.00').pensionEmployee).toBe(150);
    expect(parsePayslipText('EE Pension 150.00').pensionEmployee).toBe(150);
  });
});

describe('parsePayslipText — salary sacrifice into a scheme other than pension', () => {
  it.each([
    'Cycle to Work Salary Sacrifice -100.00',
    'EV Salary Sacrifice -300.00',
  ])('leaves %s unclaimed rather than recording it as pension', (line) => {
    // There is no field in ParsedPayslip for a cycle-to-work or an EV
    // sacrifice, so the earlier bug here was not "wrong number" but "wrong
    // field": the same money landing in pensionEmployee, silently.
    expect(parsePayslipText(line).pensionEmployee).toBeUndefined();
  });

  it('still records a sacrifice that names pension, alongside another word', () => {
    expect(parsePayslipText('Pension Salary Sacrifice -200.00').pensionEmployee).toBe(200);
  });

  it('still records a bare sacrifice that names no scheme at all', () => {
    expect(parsePayslipText('Salary Sacrifice -200.00').pensionEmployee).toBe(200);
  });
});

// Invented figures. Other deductions are never derived: a gap between gross,
// net and the named deductions is left for checkPayslip to report, because
// the parser cannot tell a genuinely "other" deduction from a named one it
// failed to label (REHAUL_PLAN.md 7.P; see the note in payslip-parse.ts).
describe('parsePayslipText — no other-deductions plug', () => {
  const unlabelled = (label: string, amount: string) => `
Pay Day 10/03/2026
Gross Pay          3,000.00
PAYE Tax              500.00
National Insurance    200.00
${label}  ${amount}
Total Deductions      ${(700 + Number(amount)).toFixed(2)}
Net Pay              ${(2300 - Number(amount)).toFixed(2)}
`;

  it('leaves a student loan it cannot name unreconciled rather than calling it other', () => {
    const parsed = parsePayslipText(unlabelled('SLC Repayment', '100.00'));
    expect('otherDeductions' in parsed).toBe(false);
    expect(parsed.studentLoan).toBeUndefined();
  });

  it('leaves a pension scheme it cannot name unreconciled rather than calling it other', () => {
    const parsed = parsePayslipText(unlabelled('LGPS', '150.00'));
    expect('otherDeductions' in parsed).toBe(false);
    expect(parsed.pensionEmployee).toBeUndefined();
  });

  it('does not count a Total Deductions row as a recognised field', () => {
    expect(parsedFieldCount(parsePayslipText('Total Deductions 825.00'))).toBe(0);
  });
});

describe('parsePositionedPayslip — a pure column grid', () => {
  // Every label and figure sit on separate rows, paired only by x-position,
  // so the line-based pass alone finds nothing here. Invented figures.
  const grid: PositionedLine[] = [
    { y: 100, runs: [{ x: 0, text: 'Gross Pay' }, { x: 250, text: 'Total Deductions' }] },
    { y: 90, runs: [{ x: 0, text: '3,000.00' }, { x: 250, text: '825.00' }] },
    { y: 80, runs: [{ x: 0, text: 'PAYE Tax' }, { x: 120, text: 'National Insurance' }, { x: 260, text: 'Pension' }] },
    { y: 70, runs: [{ x: 0, text: '500.00' }, { x: 120, text: '200.00' }, { x: 260, text: '100.00' }] },
    { y: 60, runs: [{ x: 0, text: 'Net Pay' }] },
    { y: 50, runs: [{ x: 0, text: '2,175.00' }] },
  ];

  it('fills gross, tax, NI, pension and net from the grid', () => {
    const parsed = parsePositionedPayslip(grid);
    expect(parsed.gross).toBe(3000);
    expect(parsed.incomeTax).toBe(500);
    expect(parsed.nationalInsurance).toBe(200);
    expect(parsed.pensionEmployee).toBe(100);
    expect(parsed.net).toBe(2175);
  });

  it('derives no other deductions from the grid either', () => {
    const parsed = parsePositionedPayslip(grid) as Record<string, unknown>;
    expect(parsed.otherDeductions).toBeUndefined();
    expect(parsed.totalDeductions).toBeUndefined();
  });

  it('reads a sacrifice heading as a positive pension, and refuses a cycle scheme', () => {
    const sacrifice: PositionedLine[] = [
      { y: 100, runs: [{ x: 0, text: 'Taxable Pay' }, { x: 150, text: 'Salary Sacrifice' }] },
      { y: 90, runs: [{ x: 0, text: '2,800.00' }, { x: 150, text: '-200.00' }] },
    ];
    const parsed = parsePositionedPayslip(sacrifice);
    expect(parsed.pensionEmployee).toBe(200);
    expect(parsed.gross).toBe(3000);

    const cycle: PositionedLine[] = [
      { y: 100, runs: [{ x: 0, text: 'Cycle Salary Sacrifice' }] },
      { y: 90, runs: [{ x: 0, text: '-50.00' }] },
    ];
    expect(parsePositionedPayslip(cycle).pensionEmployee).toBeUndefined();
  });
});

// Invented figures. Each of these misread under the first version of the
// bare-NI and sacrifice rules; the multi-line cases put the wrong row first,
// since first-writer-wins is what turned a stray match into a wrong figure.
describe('parsePayslipText — "NI" that qualifies something else', () => {
  it.each([
    ['Earnings for NI 3,000.00\nNI 200.00'],
    ["NI'able Pay 3,000.00\nNI 200.00"],
    ['NI-able Pay 3,000.00\nNI 200.00'],
    ['Subject to NI 3,000.00\nNI 200.00'],
    ['NI Number AB123456C\nNI 200.00'],
    ['NI Category A\nNI 200.00'],
    ['NI Letter A\nNI 200.00'],
    ['NI Code A\nNI 200.00'],
    ['NI Table A\nNI 200.00'],
  ])('takes the real NI row, not %j', text => {
    expect(parsePayslipText(text).nationalInsurance).toBe(200);
  });

  it('reads past an NI number to the gross on the same line', () => {
    const parsed = parsePayslipText('NI No: AB123456C Gross Pay 3,000.00');
    expect(parsed.nationalInsurance).toBeUndefined();
    expect(parsed.gross).toBe(3000);
  });

  it('does not take "Earnings for NI" as gross', () => {
    expect(parsePayslipText('Earnings for NI 3,000.00\nGross Pay 3,200.00').gross).toBe(3200);
  });
});

describe('parsePayslipText — employer rows written suffix-first or possessive', () => {
  it.each([
    ['NI Employer 300.00\nNI Employee 200.00'],
    ["Employers' NI 300.00\nEmployee NI 200.00"],
    ['NI (ER) 300.00\nNI (EE) 200.00'],
    ['NI Ers 300.00\nNI Ees 200.00'],
    ["Er's NI 300.00\nEe's NI 200.00"],
  ])('keeps the employer NI out of the employee figure in %j', text => {
    expect(parsePayslipText(text).nationalInsurance).toBe(200);
  });

  it.each([
    ['Pension Employer 90.00'],
    ["Employers' Pension 90.00"],
    ['Pension (ER) 90.00'],
  ])('reads %j as the employer pension', text => {
    const parsed = parsePayslipText(text);
    expect(parsed.pensionEmployer).toBe(90);
    expect(parsed.pensionEmployee).toBeUndefined();
  });

  it('still reads "Pension Employee" as the employee pension', () => {
    expect(parsePayslipText('Pension Employee 150.00').pensionEmployee).toBe(150);
  });
});

describe('parsePayslipText — a sacrifice judged by its own label', () => {
  it.each([
    ['Holiday Pay 500.00 Salary Sacrifice -200.00'],
    ['Car Allowance 300.00 Salary Sacrifice -200.00'],
  ])('keeps the pension sacrifice beside another payment in %j', text => {
    expect(parsePayslipText(text).pensionEmployee).toBe(200);
  });

  it('still refuses a sacrifice whose own label names another scheme', () => {
    expect(parsePayslipText('Basic Pay 3,000.00 Cycle to Work Salary Sacrifice -100.00').pensionEmployee).toBeUndefined();
  });
});

describe('parsePayslipText — P45 running totals', () => {
  it.each([
    ['Total Pay This Employment 25,000.00\nTotal Pay 3,000.00'],
    ['Total Pay Previous Employment 25,000.00\nTotal Pay 3,000.00'],
  ])('reads the period gross, not the employment total, from %j', text => {
    expect(parsePayslipText(text).gross).toBe(3000);
  });
});

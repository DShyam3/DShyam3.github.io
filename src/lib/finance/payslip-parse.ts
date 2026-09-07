/**
 * Reading the figures off payslip text.
 *
 * A payslip from a payroll system is a digital PDF with a text layer already
 * in it, so this is parsing rather than recognition: `pdf.js` hands over the
 * text, and what is left is finding the labels. No model, no network, no OCR
 * (REHAUL_PLAN.md 7.P).
 *
 * Pure and line-oriented. Payslip layouts differ wildly in *arrangement* but
 * agree closely on *wording*, because the labels are largely dictated by what
 * HMRC requires a payslip to state.
 *
 * It fills in a form rather than saving anything. Whatever it cannot find is
 * left blank for a person to type, and whatever it finds is theirs to correct
 * — which is why every field is optional in the result.
 */

export interface ParsedPayslip {
  gross?: number;
  incomeTax?: number;
  nationalInsurance?: number;
  pensionEmployee?: number;
  pensionEmployer?: number;
  studentLoan?: number;
  net?: number;
  payDate?: string;
  employer?: string;
}

type Field = Exclude<keyof ParsedPayslip, 'payDate' | 'employer'>;

/**
 * Label patterns per field, and order is load-bearing.
 *
 * The employer's pension contribution must be tested before the employee's,
 * or "Employer Pension" is claimed by the bare "Pension" rule and the two are
 * swapped — which then makes net stop reconciling, silently, in the direction
 * that looks plausible.
 */
const RULES: { field: Field; pattern: RegExp }[] = [
  { field: 'pensionEmployer', pattern: /\b(?:employer|company)('?s)?\s+pension|pension\s*\(?\s*(?:er|employer)\s*\)?/i },
  { field: 'pensionEmployee', pattern: /\b(?:employee'?s?\s+)?pension\b|\bpension\s*\(?\s*(?:ee|employee)\s*\)?/i },
  { field: 'studentLoan', pattern: /\bstudent\s+loan|\bpost\s*grad(?:uate)?\s+loan/i },
  // `NI(category M)` is how at least one payroll system writes it, so the
  // bracketed form has to match mid-line rather than only at a word gap.
  { field: 'nationalInsurance', pattern: /\bnational\s+insurance\b|\bni\s*\(|\bni\s+contribution|\bemployee'?s?\s+ni\b|\bnic\b/i },
  // Likewise `Tax(code 1257L)`.
  { field: 'incomeTax', pattern: /\bpaye\b|\bincome\s+tax\b|\btax\s*\(|\btax\s+(?:deducted|paid|this\s+period)\b|^\s*tax\b/i },
  { field: 'net', pattern: /\bnet\s+pay\b|\btake[-\s]?home\b|\bnet\s+total\b|\bamount\s+payable\b/i },
  // "Total Earnings" is the period figure on layouts that reserve "Gross pay"
  // for the running total. It is listed first so it wins when both appear.
  { field: 'gross', pattern: /\btotal\s+(?:earnings|gross|payments?)\b|\bgross\s+(?:pay|earnings|total)\b|\bgross\b/i },
];

const AMOUNTS = /-?£?\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|-?£?\s?\d+(?:\.\d{1,2})?/g;

/**
 * The first money-looking figure after the label that matched.
 *
 * First, and measured from the label rather than from the start of the line,
 * because both of the layouts that break a naive reader put the wrong number
 * last. A two-column payslip runs payments down the left and deductions down
 * the right, so one physical line reads "Gross Pay 3,750.00 Total Deductions
 * 1,232.56" — the last figure belongs to a different label entirely. And a
 * this-period/year-to-date row puts the running total last, which would enter
 * a year's pay as a month's.
 *
 * The cost is a row shaped "label, rate, units, amount", where the first
 * figure after the label is a rate. That is the better failure: it produces an
 * obviously wrong small number that `checkPayslip` refuses to reconcile,
 * rather than a plausible large one that quietly poisons every total.
 */
const amountAfter = (line: string, from: number): number | null => {
  const tail = line.slice(from);
  const matches = tail.match(AMOUNTS);
  if (!matches) return null;
  for (const raw of matches) {
    const value = parseFloat(raw.replace(/[£,\s]/g, ''));
    // Money is written with a decimal or a thousands separator. A bare "2" is
    // far more likely a plan number or a column index than an amount.
    // Sign is kept. A payslip can show negative tax, and it means a refund --
    // taking the modulus turns £52 back into £52 owed and breaks the
    // arithmetic that would otherwise have caught the mistake.
    if (Number.isFinite(value) && /[.,]/.test(raw)) return value;
  }
  return null;
};

/**
 * Rows that report a running total rather than this payslip.
 *
 * These carry the same labels as the real rows and much larger numbers, so
 * mistaking one is not a small error — it is a year's pay entered as a month's.
 */
const CUMULATIVE = /year\s*to\s*date|\bytd\b|\bcumulative\b|\bto\s*date\b|\btaxable\s+pay\s+to\b/i;

/**
 * Note on running-totals blocks, which are the main hazard here.
 *
 * A payslip commonly repeats every label under a "Running Totals" heading with
 * the year's figures, and reading one of those as the month's is not a small
 * error — the row looks entirely plausible and the gross grows every month.
 *
 * Suppressing the block by its heading was tried and is wrong: the extracted
 * text interleaves columns, so a period figure such as net pay can appear
 * below the heading while still belonging to the month. What actually protects
 * against it is order — the period figures come first on every layout seen, so
 * first-writer-wins takes them and the running total is ignored as a repeat.
 * That is why the gross rule lists "Total Earnings" ahead of "Gross pay":
 * on those layouts the latter *is* the running total.
 */

const DATE_LABEL = /\bpay(?:ment)?\s*date\b|\bdate\s+paid\b|\bpay\s+period\s+end/i;

/** Handles 28/08/2026, 28-08-2026 and 28 August 2026; returns ISO. */
const parseDate = (line: string): string | undefined => {
  const numeric = line.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/);
  if (numeric) {
    const [, d, m, y] = numeric;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const named = line.match(
    /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/i,
  );
  if (named) {
    const [, d, mon, y] = named;
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const index = months.indexOf(mon.toLowerCase());
    if (index >= 0) return `${y}-${String(index + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return undefined;
};

export function parsePayslipText(text: string): ParsedPayslip {
  const result: ParsedPayslip = {};
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (!result.payDate && DATE_LABEL.test(line)) {
      const date = parseDate(line);
      if (date) result.payDate = date;
    }

    if (CUMULATIVE.test(line)) continue;

    for (const { field, pattern } of RULES) {
      // First writer wins: a payslip states each figure once in its deductions
      // block, and later mentions are summaries or footnotes.
      if (result[field] !== undefined) continue;
      const match = pattern.exec(line);
      pattern.lastIndex = 0;
      if (!match) continue;
      const amount = amountAfter(line, match.index + match[0].length);
      if (amount !== null) result[field] = amount;
      // One rule per line. Without this, "Pension" inside "Employer Pension"
      // would also fill the employee field from the same number.
      break;
    }
  }

  return result;
}

/**
 * How much of a payslip was recognised, for telling someone whether to check
 * everything or just glance.
 */
export const parsedFieldCount = (parsed: ParsedPayslip): number =>
  (['gross', 'incomeTax', 'nationalInsurance', 'pensionEmployee',
    'pensionEmployer', 'studentLoan', 'net'] as const)
    .filter(k => parsed[k] !== undefined).length;

/**
 * What a filename gives away.
 *
 * A folder of payslips is almost always named to be sortable —
 * `2026-06_Capgemini_Payslip.pdf` — and that convention carries two of the
 * fields the PDF text sometimes does not: which month it is, and who paid.
 *
 * Used only as a fallback. The document is the better authority when it
 * yields anything, and a filename is a label someone typed.
 */
export function parsePayslipFilename(name: string): Pick<ParsedPayslip, 'payDate' | 'employer'> {
  const out: Pick<ParsedPayslip, 'payDate' | 'employer'> = {};
  const stem = name.replace(/\.[a-z0-9]+$/i, '');

  // A full date wins over a bare month.
  const full = stem.match(/(20\d{2})[-_.](\d{1,2})[-_.](\d{1,2})/);
  const month = stem.match(/(20\d{2})[-_.](\d{1,2})(?![\d])/);
  if (full) {
    out.payDate = `${full[1]}-${full[2].padStart(2, '0')}-${full[3].padStart(2, '0')}`;
  } else if (month && Number(month[2]) >= 1 && Number(month[2]) <= 12) {
    // No day in the name, so the month is all that is known. The first is a
    // placeholder to be corrected, not a claim about when it was paid.
    out.payDate = `${month[1]}-${month[2].padStart(2, '0')}-01`;
  }

  // Words that are neither the date nor the kind of document.
  const words = stem
    .split(/[-_\s.]+/)
    .filter(w => w && !/^\d+$/.test(w) && !/^(payslip|payslips|earnings|statement|final|copy|\d+)$/i.test(w));
  if (words.length > 0) out.employer = words.join(' ');

  return out;
}

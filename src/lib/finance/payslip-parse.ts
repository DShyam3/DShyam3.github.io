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
  /**
   * Pay after any salary sacrifice, which is what tax is charged on. Not a
   * stored column — it is here because on a sacrifice payslip it is the only
   * stated total, and gross has to be worked back from it.
   */
  taxablePay?: number;
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
 * Fields that are magnitudes, whatever sign the payslip prints.
 *
 * A salary sacrifice appears in the payments column as a negative, because
 * that is where it is subtracted. As a pension contribution it is a positive
 * amount, and keeping the minus would have it added back by every total.
 * Tax is deliberately not in this list: a negative there is a refund.
 */
const MAGNITUDE_FIELDS = new Set<Field>(['pensionEmployee', 'pensionEmployer']);

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
  // "Pension Salary Sacrifice" is the employee's contribution under another
  // name, and it is tested before the gross rule so the word "salary" in it
  // cannot be mistaken for pay.
  { field: 'pensionEmployee', pattern: /\bsalary\s+sacr|\b(?:employee'?s?\s+)?pension\b|\bpension\s*\(?\s*(?:ee|employee)\s*\)?/i },
  { field: 'studentLoan', pattern: /\bstudent\s+loan|\bpost\s*grad(?:uate)?\s+loan/i },
  // `NI(category M)` is how at least one payroll system writes it, so the
  // bracketed form has to match mid-line rather than only at a word gap.
  { field: 'nationalInsurance', pattern: /\bnational\s+insurance\b|\bni\s*\(|\bni\s+contribution|\bemployee'?s?\s+ni\b|\bnic\b/i },
  // Likewise `Tax(code 1257L)`.
  // A bare "Tax" counts, since two-column layouts put it mid-line. It cannot
  // catch "Taxable", where the word boundary fails, and "Tax Code" is
  // harmless because the code that follows is not a money-shaped figure.
  { field: 'incomeTax', pattern: /\bpaye\b|\bincome\s+tax\b|\btax\s*\(|\btax\b/i },
  { field: 'net', pattern: /\bnet\s+pay\b|\btake[-\s]?home\b|\bnet\s+total\b|\bamount\s+payable\b/i },
  { field: 'taxablePay', pattern: /\btaxable\s+pay\b|\btaxable\s+gross\b/i },
  // "Total Earnings" is the period figure on layouts that reserve "Gross pay"
  // for the running total. It is listed first so it wins when both appear.
  // Tried and reverted: matching a bare "Salary" as gross. On a payslip that
  // also states an annual figure it read twelve times the month's pay, and a
  // wrong gross that large still charts as a plausible line. A payslip with no
  // row called gross is better left for a person to fill in.
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

/**
 * Date labels, most authoritative first.
 *
 * A payslip can carry more than one date and they need not agree: one states
 * "Pay Day 26/05/2023" and, elsewhere, that HMRC will show it as 28/05/2023.
 * The day you were paid is the one this records, so an explicit pay-day label
 * outranks a sentence about when it appears somewhere else.
 */
const DATE_LABELS: RegExp[] = [
  // The day you were paid.
  /\bpay\s*day\b|\bdate\s+paid\b/i,
  // A date labelled as the payment's, which on one layout is the day HMRC
  // will show it rather than the day it arrived -- two days later.
  /\bpay(?:ment)?\s*date\b|\bwill\s+show\s+as\b/i,
  /\bpay\s+period\s+end|\bperiod\s+end(?:ing)?\b/i,
];

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

  // Lower is better; nothing found yet is worse than any match.
  let dateRank = Number.POSITIVE_INFINITY;

  for (const line of lines) {
    for (let rank = 0; rank < DATE_LABELS.length && rank < dateRank; rank++) {
      if (!DATE_LABELS[rank].test(line)) continue;
      const date = parseDate(line);
      if (date) {
        result.payDate = date;
        dateRank = rank;
      }
      break;
    }

    if (CUMULATIVE.test(line)) continue;

    /* A line can carry more than one label. Two-column payslips run payments
       down the left and deductions down the right, so "Salary 4,000.00 Tax
       700.00" is two pairs on one line and stopping at the first would lose
       the tax every time.

       So the line is walked left to right, taking the earliest-matching label
       each pass and the first figure after it. Earliest rather than
       rule-order, or a later label could claim a figure belonging to one
       further left. First writer still wins across the document: a payslip
       states each figure once, and later mentions are totals or footnotes. */
    let cursor = 0;
    while (cursor < line.length) {
      let chosen: { field: Field; end: number; at: number } | null = null;
      for (const { field, pattern } of RULES) {
        if (result[field] !== undefined) continue;
        const match = pattern.exec(line.slice(cursor));
        pattern.lastIndex = 0;
        if (!match) continue;
        if (!chosen || match.index < chosen.at) {
          chosen = { field, at: match.index, end: match.index + match[0].length };
        }
      }
      if (!chosen) break;
      const amount = amountAfter(line.slice(cursor), chosen.end);
      if (amount !== null) {
        result[chosen.field] = MAGNITUDE_FIELDS.has(chosen.field) ? Math.abs(amount) : amount;
      }
      cursor += chosen.end;
    }
  }

  return withDerivedGross(result);
}

/**
 * Works gross back out of a salary-sacrifice payslip.
 *
 * Those state the sacrifice and the taxable pay that remains, but often have
 * no row called gross at all. Reading a bare "Salary" line instead was tried
 * and read an annual figure — twelve times the month's pay, and plausible
 * enough to chart. Adding the sacrifice back to taxable pay is arithmetic
 * rather than a guess, and it only runs when the payslip stated no gross.
 */
const withDerivedGross = (parsed: ParsedPayslip): ParsedPayslip => {
  if (parsed.gross !== undefined) return parsed;
  if (parsed.taxablePay === undefined) return parsed;
  const sacrifice = parsed.pensionEmployee ?? 0;
  return { ...parsed, gross: Math.round((parsed.taxablePay + sacrifice) * 100) / 100 };
};

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

/* -------------------------------------------------------------------------
 * Column-grid layouts
 *
 * Some payroll systems lay a payslip out as a table with the labels in one
 * row and the figures in the row beneath, aligned by column:
 *
 *     Taxable Pay   Tax    National Insurance   Ers Pension
 *     758.46        254.58 590.57               475.53
 *
 * Joining runs into lines loses that, because a label and its figure never
 * share a line. Pairing them needs the x each was drawn at, which is why this
 * takes positioned runs rather than text.
 * ---------------------------------------------------------------------- */

export interface PositionedRun {
  x: number;
  text: string;
}

export interface PositionedLine {
  /** Baseline. Larger is higher up the page, as PDF coordinates run upward. */
  y: number;
  runs: PositionedRun[];
}

const AMOUNT_ONLY = /^-?£?\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$|^-?£?\s?\d+\.\d{1,2}$/;

const toAmount = (text: string): number | null => {
  if (!AMOUNT_ONLY.test(text.trim())) return null;
  const value = parseFloat(text.replace(/[£,\s]/g, ''));
  return Number.isFinite(value) ? value : null;
};

/**
 * How far below a label its figure may sit.
 *
 * One row, not any row: a column heading governs the line under it, and
 * reaching further would pair a label with an unrelated total further down.
 */
const MAX_ROWS_BELOW = 1;

/**
 * How far sideways a figure may be and still belong to the label.
 *
 * Tuned against a real archive of 26 payslips: 60 pairs too little (a
 * right-aligned figure sits left of the label heading it), and 140 pairs
 * almost anything with anything -- that reads 3 of 26 correctly against 16 at
 * this value. The number is a measurement, not a preference.
 */
const MAX_X_DRIFT = 110;

/**
 * Fills in fields by pairing a label with the figure beneath it.
 *
 * Runs after the line-based pass and only fills what that left empty, so a
 * layout stating a figure beside its label keeps the more reliable reading.
 */
export function parsePositionedPayslip(lines: PositionedLine[]): ParsedPayslip {
  // Top-down first, and it matters for both passes. The line-based reading
  // depends on reaching the period figures before the running totals, so a
  // page fed in the order the runs happened to be drawn reads the year's
  // gross as the month's — which is the bug this file exists to avoid.
  const ordered = lines.slice().sort((a, b) => b.y - a.y);

  const asText = ordered
    .map(l => l.runs.slice().sort((a, b) => a.x - b.x).map(r => r.text).join(' ').replace(/\s+/g, ' ').trim())
    .join('\n');
  const result = parsePayslipText(asText);

  for (let i = 0; i < ordered.length; i++) {
    const labelLine = ordered[i];
    // A row carrying its own figures is a label-and-value row, already handled.
    if (labelLine.runs.some(r => toAmount(r.text) !== null)) continue;

    for (const run of labelLine.runs) {
      const rule = RULES.find(r => r.pattern.test(run.text));
      if (!rule || result[rule.field] !== undefined) continue;

      for (let j = i + 1; j <= i + MAX_ROWS_BELOW && j < ordered.length; j++) {
        let best: { drift: number; value: number } | null = null;
        for (const candidate of ordered[j].runs) {
          const value = toAmount(candidate.text);
          if (value === null) continue;
          const drift = Math.abs(candidate.x - run.x);
          if (drift > MAX_X_DRIFT) continue;
          if (!best || drift < best.drift) best = { drift, value };
        }
        if (best) {
          result[rule.field] = best.value;
          break;
        }
      }
    }
  }

  return result;
}

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
 *
 * `field: null` marks a rule that recognises a label without owning any
 * `ParsedPayslip` column, purely so the cursor walks past it — see the
 * employer's NI rule below, which exists to deny its figure to the
 * employee's.
 *
 * Order between two entries only matters when both would start matching at
 * the same index (a tie); otherwise the earliest match anywhere in the line
 * wins regardless of array position, which is what keeps "Employer NI" from
 * needing to out-rank "NI" here at all — "Employer" simply starts earlier.
 */
const RULES: { field: Field | null; pattern: RegExp }[] = [
  // Suffix and plural-possessive forms too -- "Pension Employer", "Pension
  // (ER)", "Employers' Pension" -- or the bare "pension" rule below takes them
  // as the employee's. A tie at the same index goes to this rule, being first.
  { field: 'pensionEmployer', pattern: /\b(?:employer|company|ers|er)(?:'?s|s')?\s+pension\b|\bpension\s*\(?\s*(?:ers?|employer'?s?)\b\s*\)?/i },
  // The bare "pension" fallback here also catches "Ees Pension" and "EE
  // Pension": neither prefix is recognised, so the optional group simply
  // fails to consume it and the match falls back to "Pension" on its own,
  // which is still the earliest-available label on that line once the
  // employer rule above has first refusal on "Ers"/"ER"/"Employer" prefixes.
  { field: 'pensionEmployee', pattern: /\b(?:employee'?s?\s+)?pension\b|\bpension\s*\(?\s*(?:ee|employee)\s*\)?/i },
  // `\bsalary\s+sacr` used to live in this same pattern, unconditionally. It
  // is now appended per line by `parsePayslipText`, and only when the line
  // does not name a non-pension sacrifice scheme — see
  // `namesOtherSacrificeScheme`. A bare "pension" already handles "Pension
  // Salary Sacrifice" without it, because "Pension" is the earlier label on
  // that line regardless.
  { field: 'studentLoan', pattern: /\bstudent\s+loan|\bstud\s+loan|\bpost\s*grad(?:uate)?\s+loan|\bpg\s+loan|\bsl\b\s*(?=plan\b|\(|\d)/i },
  // Bare "SL" is gated on what follows it -- a plan reference, a digit, or an
  // opening bracket -- because "SL" on its own is too short a token to claim
  // unconditionally; a plain word spelled the same way elsewhere on a payslip
  // would otherwise be read as a student loan deduction.
  //
  // Employer NI has no field of its own -- it is not owed by the employee --
  // so this rule's only job is to consume "Employer NI"/"Ers NI"/"ER NIC"
  // before the bare NI rule below can reach it. Tried without this: a bare
  // `\bni\b` addition (needed for "NI 245.00") also matched inside "Employer
  // NI 300.00", handing the employer's figure to the employee's field --
  // wrong by nature, not by a rounding error, since both numbers look
  // equally plausible on their own.
  // Suffix forms as well ("NI Employer", "NI (ER)", "NI Ers") and the plural
  // possessive "Employers' NI": the bare NI rule below matches those too, and
  // with the employer's row first on the page it took the employer's figure.
  { field: null, pattern: /\b(?:employer|ers|er)(?:'?s|s')?\s+nic?\b|\bnic?\s*\(?\s*(?:ers?|employer'?s?)\b\s*\)?/i },
  // `NI(category M)` is how at least one payroll system writes it, so the
  // bracketed form has to match mid-line rather than only at a word gap.
  // "N.I" with stops is common, and was being missed entirely. The bare
  // `\bni\b` at the end is a fallback for "NI 245.00", "Ees NI 245.00" and
  // "NI Employee 245.00" alike -- once the employer rule above has had first
  // refusal, any remaining "NI" on the line is the employee's by elimination.
  // Except where "NI" qualifies something else. "NI'able Pay 3,000.00",
  // "Earnings for NI" and "NI No: AB123456C" all put a pay figure or an
  // identifier after it, and first-writer-wins then locked the real NI row
  // out -- so the bare form refuses those neighbours on either side.
  { field: 'nationalInsurance', pattern: /\bnational\s+insurance\b|\bn\.\s?i\.?(?=\W|$)|\bni\s*\(|\bni\s+contribution|\bemployee'?s?\s+ni\b|\bnic\b|(?<!\b(?:for|to)\s+)\bni\b(?!\s*(?:no\b|number|letter|cat(?:egory)?\b|code|table|'?-?\s*able|earnings|pay\b|gross))/i },
  // Likewise `Tax(code 1257L)`.
  // A bare "Tax" counts, since two-column layouts put it mid-line. It cannot
  // catch "Taxable", where the word boundary fails, and "Tax Code" is
  // harmless because the code that follows is not a money-shaped figure.
  { field: 'incomeTax', pattern: /\bpaye\b|\bincome\s+tax\b|\btax\s*\(|\btax\b/i },
  // Tried and reverted: deriving `otherDeductions` as gross - net - the named
  // deductions, "confirmed" against a stated Total Deductions. The check
  // reduces to gross - net == total, which holds on almost any consistent
  // payslip and cannot tell a genuinely other deduction from a named one this
  // file failed to label: "SLC Repayment 100.00" became other deductions with
  // no student loan, "LGPS 150.00" the same with no pension, and both then
  // reconciled, so the warning that should have caught them went away. An
  // unreconciled payslip that asks a person is the better failure.
  // "Total Amount Paid" is net on layouts that never use the word net.
  // "Net Payable" needed the same optional suffix as "amount pay(able)"
  // below, for the same reason: "\bnet\s+pay\b" requires a word boundary
  // straight after "pay", which "Payable" never has.
  { field: 'net', pattern: /\bnet\s+pay(?:able|ment)?\b|\btake[-\s]?home\b|\bnet\s+total\b|\bamount\s+pay(?:able|ment)\b|\btotal\s+amount\s+paid\b/i },
  { field: 'taxablePay', pattern: /\btaxable\s+pay\b|\btaxable\s+gross\b/i },
  // "Total Earnings" is the period figure on layouts that reserve "Gross pay"
  // for the running total. It is listed first so it wins when both appear.
  // Tried and reverted: matching a bare "Salary" as gross. On a payslip that
  // also states an annual figure it read twelve times the month's pay, and a
  // wrong gross that large still charts as a plausible line. A payslip with no
  // row called gross is better left for a person to fill in.
  // Tried and reverted: a bare "TOTAL", for layouts that foot each column
  // with that word. It read "Total Hours 1.25" on a leaving payslip as a
  // gross of £1.25, and no lookahead that excluded hours, units and days
  // would have been anything but a list of the layouts already seen.
  // "Total Pay" needed its own alternative rather than folding into
  // "Total Payments?": the boundary after "pay" is what already keeps it off
  // "Total Payable", so there was nothing to gain by trying to squeeze both
  // into one alternative and something to lose in readability.
  { field: 'gross', pattern: /\btotal\s+(?:earnings|gross|payments?|pay)\b|\bgross\s+(?:pay|earnings|total)\b|\bgross\b|\bearnings\b(?!\s+for\b)/i },
];

/**
 * Words naming a salary-sacrifice scheme other than pension.
 *
 * A payslip that sacrifices into a bike, a car or a gym membership prints
 * the same "Salary Sacrifice" wording a pension contribution does. Claiming
 * every one of them as pension is the same class of mistake as swapping
 * employer and employee: net stops reconciling, plausibly, in a direction
 * nobody checks.
 */
const OTHER_SACRIFICE_SCHEME = /\b(?:cycle|bike|car|vehicle|ev|electric|childcare|nursery|tech(?:nology)?|gym|holiday)\b/i;

/**
 * A salary-sacrifice row is the employee's pension only when it names
 * pension, or names no scheme at all. When it names one of the schemes
 * above and never says "pension", the figure is left unclaimed rather than
 * guessed -- there is no field in `ParsedPayslip` for a cycle-to-work or an
 * EV sacrifice, and inventing one to store a mis-typed pension figure would
 * be the gap rule 4 exists to forbid.
 */
const namesOtherSacrificeScheme = (label: string): boolean =>
  OTHER_SACRIFICE_SCHEME.test(label) && !/\bpension\b/i.test(label);

/**
 * The label a sacrifice match belongs to: from the end of the last figure
 * before it, not from the start of the line. On a two-column line such as
 * "Holiday Pay 500.00 Salary Sacrifice -200.00", testing the whole line read
 * "Holiday" from the neighbouring payment and dropped a pension sacrifice.
 */
const labelBefore = (text: string): string =>
  text.replace(/^.*-?£?\s?\d[\d,]*\.\d{1,2}/, '');

/**
 * "Salary Sacrifice" as the employee's pension, kept apart from the
 * `pensionEmployee` rule above so a match can be refused when its label names
 * a different scheme -- see `namesOtherSacrificeScheme`. Last in the walk, so
 * "Pension Salary Sacrifice" is still claimed by the earlier "Pension".
 */
const SACRIFICE_RULE: { field: Field; pattern: RegExp } = { field: 'pensionEmployee', pattern: /\bsalary\s+sacr/i };

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
// "This employment" and "previous employment" are the P45 figures for the
// tax year so far; "Total Pay This Employment" otherwise reads as gross.
const CUMULATIVE = /year\s*to\s*date|\bytd\b|\bcumulative\b|\bto\s*date\b|\btd\b|\btaxable\s+pay\s+to\b|\b(?:this|previous)\s+employment\b/i;

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
  /\bpay\s*day\b|\bdate\s+paid\b|\bpayslip\s+date\b/i,
  // A date labelled as the payment's, which on one layout is the day HMRC
  // will show it rather than the day it arrived -- two days later.
  /\bpay(?:ment)?\s*date\b|\bwill\s+show\s+as\b/i,
  /\bpay\s+period\s+end|\bperiod\s+end(?:ing)?\b/i,
];

/** Handles 28/08/2026, 28-08-2026, 28 August 2026 and 31-Dec-2025; returns ISO. */
const parseDate = (line: string): string | undefined => {
  const numeric = line.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/);
  if (numeric) {
    const [, d, m, y] = numeric;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // The separator may be a space or a hyphen: "28 August 2026" and
  // "31-Dec-2025" are both in use, and only one of them was being read.
  const named = line.match(
    /\b(\d{1,2})[\s-]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s-]+(\d{4})\b/i,
  );
  if (named) {
    const [, d, mon, y] = named;
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const index = months.indexOf(mon.toLowerCase());
    if (index >= 0) return `${y}-${String(index + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return undefined;
};

const WALK_RULES = [...RULES, SACRIFICE_RULE];

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
      let chosen: { field: Field | null; end: number; at: number; sacrifice: boolean } | null = null;
      for (const rule of WALK_RULES) {
        const { field, pattern } = rule;
        if (field !== null && result[field] !== undefined) continue;
        const match = pattern.exec(line.slice(cursor));
        pattern.lastIndex = 0;
        if (!match) continue;
        if (!chosen || match.index < chosen.at) {
          chosen = { field, at: match.index, end: match.index + match[0].length, sacrifice: rule === SACRIFICE_RULE };
        }
      }
      if (!chosen) break;
      // A sacrifice whose own label names another scheme is walked past
      // unclaimed, like the employer's NI.
      const refused = chosen.sacrifice
        && namesOtherSacrificeScheme(labelBefore(line.slice(cursor, cursor + chosen.end)));
      // `field: null` (the employer's NI) is recognised only to be denied to
      // the employee's rule below it — nothing is ever stored for it.
      if (chosen.field !== null && !refused) {
        const amount = amountAfter(line.slice(cursor), chosen.end);
        if (amount !== null) {
          result[chosen.field] = MAGNITUDE_FIELDS.has(chosen.field) ? Math.abs(amount) : amount;
        }
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
 * `2026-06_Acme_Payslip.pdf` — and that convention carries two of the
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
 * A column heading naming the pay date.
 *
 * Anchored to the whole run, because a lone "Date" is only unambiguous when it
 * is the entire heading. Loose enough to catch it in running text and it would
 * claim a birth date or a period start; here the run is a heading and the
 * figure below it is the answer.
 */
const DATE_HEADING = /^\(?\s*£?\s*\)?\s*(?:pay\s*(?:ment)?\s*)?(?:date|day)\s*:?$/i;

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
      // The pay date can be a column heading too, with the date itself in the
      // row beneath. Without this it falls back to the filename, which carries
      // a month but no day.
      if (result.payDate === undefined && DATE_HEADING.test(run.text)) {
        for (let j = i + 1; j <= i + MAX_ROWS_BELOW && j < ordered.length; j++) {
          const candidates = ordered[j].runs
            .filter(c => Math.abs(c.x - run.x) <= MAX_X_DRIFT)
            .sort((a, b) => Math.abs(a.x - run.x) - Math.abs(b.x - run.x));
          const found = candidates.map(c => parseDate(c.text)).find(Boolean);
          if (found) { result.payDate = found; break; }
        }
      }

      // A `field: null` heading (the employer's NI) has nothing to fill --
      // it is recognised only so the employee's rule cannot claim it either.
      const rule = WALK_RULES.find(r => r.pattern.test(run.text));
      if (!rule || rule.field === null || result[rule.field] !== undefined) continue;
      if (rule === SACRIFICE_RULE && namesOtherSacrificeScheme(run.text)) continue;
      const field = rule.field;

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
          result[field] = MAGNITUDE_FIELDS.has(field) ? Math.abs(best.value) : best.value;
          break;
        }
      }
    }
  }

  return withDerivedGross(result);
}

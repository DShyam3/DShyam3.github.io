/**
 * Deterministic bank-statement parsing.
 *
 * A statement is personal financial data, so it is deliberately read in the
 * browser and turned into a small, reviewable projection before the finance
 * UI writes any rows. There is no provider call, upload, model, or inference
 * here. The import dialog decides what to persist; this module only parses.
 */

export type StatementFormat = 'csv' | 'ofx';
export type NumericDateOrder = 'day-first' | 'month-first';
export type AmountConvention = 'bank-signed' | 'outflow-positive';

export interface ParsedStatementTransaction {
  /** ISO date, never a locale-formatted display string. */
  date: string;
  /** The bank's description, trimmed and bounded for the ledger UI. */
  description: string;
  /** Positive is money out; negative is money in, matching the ledger. */
  amount: number;
  /** A provider identifier, used only to make a stable local import ID. */
  sourceId?: string;
  /** The one-based line or record number, for an actionable preview issue. */
  sourceRow: number;
}

export interface StatementImportIssue {
  sourceRow?: number;
  message: string;
}

export interface StatementParseResult {
  format: StatementFormat;
  transactions: ParsedStatementTransaction[];
  issues: StatementImportIssue[];
  /** Numeric dates such as 05/06/2025 need the user's date-order choice. */
  ambiguousDateCount: number;
}

export interface StatementParseOptions {
  numericDateOrder?: NumericDateOrder;
  /**
   * A signed Amount/Value column normally follows bank convention: a positive
   * value is money in. Some exports show positive spending instead; the UI
   * exposes this explicit choice rather than silently guessing.
   */
  amountConvention?: AmountConvention;
}

const DEFAULT_OPTIONS: Required<StatementParseOptions> = {
  numericDateOrder: 'day-first',
  amountConvention: 'bank-signed',
};

const MAX_DESCRIPTION_LENGTH = 240;

const normaliseHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const DATE_HEADERS = ['date', 'transactiondate', 'posteddate', 'bookingdate'];
const DESCRIPTION_HEADERS = [
  'description', 'details', 'narrative', 'merchant', 'payee', 'transactiondetails', 'transactiondescription', 'reference',
];
const AMOUNT_HEADERS = ['amount', 'value', 'transactionamount'];
const DEBIT_HEADERS = ['debit', 'debits', 'moneyout', 'withdrawal', 'withdrawals'];
const CREDIT_HEADERS = ['credit', 'credits', 'moneyin', 'deposit', 'deposits'];
const DIRECTION_HEADERS = ['type', 'transactiontype', 'direction'];
const SOURCE_ID_HEADERS = ['transactionid', 'id', 'fitid', 'referenceid'];

const findColumn = (headers: string[], names: string[]) => {
  const normalised = headers.map(normaliseHeader);
  return normalised.findIndex(header => names.includes(header));
};

const cellAt = (row: string[], index: number) => index >= 0 ? (row[index] ?? '').trim() : '';

const validIsoDate = (year: number, month: number, day: number): string | undefined => {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const monthNumber = (value: string): number | undefined => {
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const index = months.indexOf(value.slice(0, 3).toLowerCase());
  return index >= 0 ? index + 1 : undefined;
};

interface DateResult {
  date?: string;
  ambiguous: boolean;
}

/** Parse a date without letting JavaScript's locale-dependent Date parser guess. */
export const parseStatementDate = (
  value: string,
  order: NumericDateOrder = DEFAULT_OPTIONS.numericDateOrder,
): DateResult => {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (iso) return { date: validIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3])), ambiguous: false };

  const named = trimmed.match(/^(\d{1,2})[\s/-]+([a-z]{3,9})[\s,/-]+(\d{2,4})/i);
  if (named) {
    const year = named[3].length === 2 ? 2000 + Number(named[3]) : Number(named[3]);
    return { date: validIsoDate(year, monthNumber(named[2]) ?? 0, Number(named[1])), ambiguous: false };
  }

  const numeric = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (!numeric) return { ambiguous: false };
  const first = Number(numeric[1]);
  const second = Number(numeric[2]);
  const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
  const ambiguous = first <= 12 && second <= 12;
  const day = order === 'day-first' ? first : second;
  const month = order === 'day-first' ? second : first;
  return { date: validIsoDate(year, month, day), ambiguous };
};

/** Reads £1,234.50, (12.50), 1.000,50 and their ordinary signed variants. */
export const parseStatementAmount = (value: string): number | undefined => {
  let input = value.trim().replace(/[\u00a0\s£$€]/g, '');
  if (!input || input === '-' || input === '–') return undefined;
  const parenthesised = /^\(.*\)$/.test(input);
  if (parenthesised) input = input.slice(1, -1);
  // Keep only a leading sign and the two decimal/grouping punctuation marks.
  input = input.replace(/(?!^)[+-]/g, '').replace(/[^0-9,.-]/g, '');
  if (!/^-?[0-9.,]+$/.test(input)) return undefined;

  const lastDot = input.lastIndexOf('.');
  const lastComma = input.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // The final separator is the decimal separator in 1,234.50 and 1.234,50.
    input = lastDot > lastComma
      ? input.replace(/,/g, '')
      : input.replace(/\./g, '').replace(',', '.');
  } else if (lastComma >= 0) {
    // 1,234 is a thousands grouping; 12,50 is a decimal-comma amount.
    input = /^-?\d{1,3}(?:,\d{3})+$/.test(input)
      ? input.replace(/,/g, '')
      : input.replace(',', '.');
  }
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return undefined;
  return parenthesised ? -Math.abs(parsed) : parsed;
};

const cleanDescription = (value: string) => {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, MAX_DESCRIPTION_LENGTH) || 'Statement transaction';
};

/** RFC 4180-style rows, including quoted commas and newlines. */
export const parseDelimitedRows = (text: string, delimiter: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
};

const chooseDelimiter = (text: string) => {
  const candidates = [',', ';', '\t'];
  const sample = text.split(/\r?\n/).filter(line => line.trim()).slice(0, 10);
  return candidates.reduce((best, candidate) => {
    const hits = sample.reduce((total, line) => total + line.split(candidate).length - 1, 0);
    const bestHits = sample.reduce((total, line) => total + line.split(best).length - 1, 0);
    return hits > bestHits ? candidate : best;
  }, ',');
};

const directionFromCell = (value: string): 'outflow' | 'inflow' | undefined => {
  const normalised = normaliseHeader(value);
  if (/^(debit|payment|purchase|withdrawal|outgoing|moneyout)/.test(normalised)) return 'outflow';
  if (/^(credit|deposit|refund|interest|incoming|moneyin)/.test(normalised)) return 'inflow';
  return undefined;
};

/** Parse a CSV statement into the ledger's sign convention. */
export const parseCsvStatement = (text: string, options: StatementParseOptions = {}): StatementParseResult => {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const rows = parseDelimitedRows(text.replace(/^\uFEFF/, ''), chooseDelimiter(text));
  const issues: StatementImportIssue[] = [];
  let headerIndex = -1;
  let dateIndex = -1;
  let descriptionIndex = -1;
  let amountIndex = -1;
  let debitIndex = -1;
  let creditIndex = -1;
  let directionIndex = -1;
  let sourceIdIndex = -1;

  for (let index = 0; index < Math.min(rows.length, 12); index += 1) {
    const headers = rows[index];
    const possibleDate = findColumn(headers, DATE_HEADERS);
    const possibleDescription = findColumn(headers, DESCRIPTION_HEADERS);
    const possibleAmount = findColumn(headers, AMOUNT_HEADERS);
    const possibleDebit = findColumn(headers, DEBIT_HEADERS);
    const possibleCredit = findColumn(headers, CREDIT_HEADERS);
    if (possibleDate >= 0 && possibleDescription >= 0 && (possibleAmount >= 0 || possibleDebit >= 0 || possibleCredit >= 0)) {
      headerIndex = index;
      dateIndex = possibleDate;
      descriptionIndex = possibleDescription;
      amountIndex = possibleAmount;
      debitIndex = possibleDebit;
      creditIndex = possibleCredit;
      directionIndex = findColumn(headers, DIRECTION_HEADERS);
      sourceIdIndex = findColumn(headers, SOURCE_ID_HEADERS);
      break;
    }
  }

  if (headerIndex < 0) {
    return {
      format: 'csv', transactions: [], ambiguousDateCount: 0,
      issues: [{ message: 'Could not find Date, Description, and Amount (or Debit/Credit) columns in this CSV.' }],
    };
  }

  let ambiguousDateCount = 0;
  const transactions: ParsedStatementTransaction[] = [];
  rows.slice(headerIndex + 1).forEach((row, index) => {
    const sourceRow = headerIndex + index + 2;
    const parsedDate = parseStatementDate(cellAt(row, dateIndex), settings.numericDateOrder);
    if (parsedDate.ambiguous) ambiguousDateCount += 1;
    if (!parsedDate.date) {
      issues.push({ sourceRow, message: 'Skipped: date is missing or invalid.' });
      return;
    }

    const debit = parseStatementAmount(cellAt(row, debitIndex));
    const credit = parseStatementAmount(cellAt(row, creditIndex));
    const signed = parseStatementAmount(cellAt(row, amountIndex));
    let amount: number | undefined;
    if (debit !== undefined || credit !== undefined) {
      // Debit/Credit columns express the direction explicitly, so they always
      // outrank a general Amount column and need no sign-convention guess.
      amount = Math.abs(debit ?? 0) - Math.abs(credit ?? 0);
    } else if (signed !== undefined) {
      const direction = directionFromCell(cellAt(row, directionIndex));
      amount = direction === 'outflow'
        ? Math.abs(signed)
        : direction === 'inflow'
          ? -Math.abs(signed)
          : settings.amountConvention === 'bank-signed' ? -signed : signed;
    }
    if (amount === undefined || !Number.isFinite(amount)) {
      issues.push({ sourceRow, message: 'Skipped: amount is missing or invalid.' });
      return;
    }

    transactions.push({
      date: parsedDate.date,
      description: cleanDescription(cellAt(row, descriptionIndex)),
      amount: Math.round(amount * 100) / 100,
      sourceId: cellAt(row, sourceIdIndex) || undefined,
      sourceRow,
    });
  });

  return { format: 'csv', transactions, issues, ambiguousDateCount };
};

const ofxTag = (block: string, tag: string) => {
  const match = block.match(new RegExp(`<${tag}>([^<\r\n]*)`, 'i'));
  return match?.[1]?.trim() ?? '';
};

const parseOfxDate = (value: string): string | undefined => {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/);
  return match ? validIsoDate(Number(match[1]), Number(match[2]), Number(match[3])) : undefined;
};

/** Parse OFX 1.x SGML and OFX 2.x XML transaction lists. */
export const parseOfxStatement = (text: string): StatementParseResult => {
  const issues: StatementImportIssue[] = [];
  const transactions: ParsedStatementTransaction[] = [];
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi) ?? [];
  if (blocks.length === 0) {
    return { format: 'ofx', transactions, ambiguousDateCount: 0, issues: [{ message: 'No OFX transaction records were found.' }] };
  }

  blocks.forEach((block, index) => {
    const sourceRow = index + 1;
    const date = parseOfxDate(ofxTag(block, 'DTPOSTED'));
    const signed = parseStatementAmount(ofxTag(block, 'TRNAMT'));
    if (!date || signed === undefined) {
      issues.push({ sourceRow, message: 'Skipped: OFX record has no valid posted date or amount.' });
      return;
    }
    const name = ofxTag(block, 'NAME');
    const memo = ofxTag(block, 'MEMO');
    transactions.push({
      date,
      description: cleanDescription(name || memo),
      amount: Math.round(-signed * 100) / 100,
      sourceId: ofxTag(block, 'FITID') || undefined,
      sourceRow,
    });
  });
  return { format: 'ofx', transactions, issues, ambiguousDateCount: 0 };
};

/** Use the file contents as a fallback because some banks name OFX files .txt. */
export const detectStatementFormat = (fileName: string, text: string): StatementFormat | undefined => {
  if (/\.(ofx|qfx)$/i.test(fileName) || /<OFX>|<STMTTRN>/i.test(text.slice(0, 4096))) return 'ofx';
  if (/\.csv$/i.test(fileName)) return 'csv';
  return undefined;
};

export const parseStatement = (
  fileName: string,
  text: string,
  options: StatementParseOptions = {},
): StatementParseResult => {
  const format = detectStatementFormat(fileName, text);
  if (format === 'ofx') return parseOfxStatement(text);
  if (format === 'csv') return parseCsvStatement(text, options);
  return {
    format: 'csv', transactions: [], ambiguousDateCount: 0,
    issues: [{ message: 'Choose a CSV, OFX, or QFX statement file.' }],
  };
};

const canonicalText = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * A stable, account-scoped ID for imported rows.
 *
 * It is not a provider identifier and it deliberately contains no account
 * number, merchant name, or statement reference in the database. Two FNV-1a
 * passes make accidental collisions vanishingly unlikely at personal-ledger
 * scale while staying synchronous and browser-only.
 */
const fnv1a = (value: string, seed: number) => {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
};

export const statementTransactionKey = (accountId: string, transaction: ParsedStatementTransaction) => {
  const source = transaction.sourceId ? `source:${canonicalText(transaction.sourceId)}` : `row:${transaction.date}|${transaction.amount.toFixed(2)}|${canonicalText(transaction.description)}`;
  return `${accountId}|${source}`;
};

export const statementTransactionId = (accountId: string, transaction: ParsedStatementTransaction) => {
  const key = statementTransactionKey(accountId, transaction);
  return `statement_${fnv1a(key, 0x811c9dc5)}_${fnv1a(key, 0x9e3779b9)}`;
};

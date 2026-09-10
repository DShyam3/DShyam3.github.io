import { describe, expect, it } from 'vitest';
import {
  detectStatementFormat,
  parseCsvStatement,
  parseOfxStatement,
  parseStatementDate,
  statementTransactionId,
} from './statement-import';

describe('parseCsvStatement', () => {
  it('parses quoted descriptions and converts bank-signed amounts to ledger signs', () => {
    const parsed = parseCsvStatement(`Date,Description,Amount\n08/09/2026,"TESCO, High Street",-12.34\n09/09/2026,Salary,2500.00`);

    expect(parsed.issues).toEqual([]);
    expect(parsed.transactions).toEqual([
      { date: '2026-09-08', description: 'TESCO, High Street', amount: 12.34, sourceRow: 2, sourceId: undefined },
      { date: '2026-09-09', description: 'Salary', amount: -2500, sourceRow: 3, sourceId: undefined },
    ]);
    expect(parsed.ambiguousDateCount).toBe(2);
  });

  it('uses debit and credit columns over an ambiguous general amount convention', () => {
    const parsed = parseCsvStatement(`Date;Narrative;Debit;Credit\n13/09/2026;Card payment;42.50;\n14/09/2026;Refund;;10.00`);

    expect(parsed.transactions.map(transaction => transaction.amount)).toEqual([42.5, -10]);
  });

  it('lets a user choose month-first for an explicitly US-format export', () => {
    const parsed = parseCsvStatement('Date,Description,Amount\n05/06/2026,Shop,-1.00', { numericDateOrder: 'month-first' });

    expect(parsed.transactions[0].date).toBe('2026-05-06');
  });

  it('reports broken rows without discarding valid transactions', () => {
    const parsed = parseCsvStatement('Date,Description,Amount\ninvalid,No date,-1\n07/09/2026,Valid,-2');

    expect(parsed.transactions).toHaveLength(1);
    expect(parsed.issues).toEqual([{ sourceRow: 2, message: 'Skipped: date is missing or invalid.' }]);
  });
});

describe('parseOfxStatement', () => {
  it('handles classic OFX records without closing field tags', () => {
    const timezone = `${String.fromCharCode(91)}-4:GMT${String.fromCharCode(93)}`;
    const parsed = parseOfxStatement(`<OFX>\n<BANKTRANLIST>\n<STMTTRN>\n<TRNTYPE>DEBIT\n<DTPOSTED>20240812\n<TRNAMT>-7.25\n<FITID>abc-1\n<NAME>Coffee Shop\n<MEMO>Morning coffee\n<STMTTRN>\n<TRNTYPE>CREDIT\n<DTPOSTED>20240813${timezone}\n<TRNAMT>10.00\n<FITID>abc-2\n<MEMO>Refund\n</BANKTRANLIST>`);

    expect(parsed.issues).toEqual([]);
    expect(parsed.transactions).toEqual([
      { date: '2024-08-12', description: 'Coffee Shop', amount: 7.25, sourceId: 'abc-1', sourceRow: 1 },
      { date: '2024-08-13', description: 'Refund', amount: -10, sourceId: 'abc-2', sourceRow: 2 },
    ]);
  });
});

describe('statement import identity', () => {
  const transaction = { date: '2026-09-08', description: 'Tesco', amount: 12.5, sourceRow: 1 };

  it('is stable on a re-import, but scope protects two accounts from colliding', () => {
    expect(statementTransactionId('account-a', transaction)).toBe(statementTransactionId('account-a', transaction));
    expect(statementTransactionId('account-a', transaction)).not.toBe(statementTransactionId('account-b', transaction));
  });

  it('detects supported file formats and refuses opaque files', () => {
    expect(detectStatementFormat('history.QFX', '')).toBe('ofx');
    expect(detectStatementFormat('history.txt', '<OFX><STMTTRN>')).toBe('ofx');
    expect(detectStatementFormat('history.csv', '')).toBe('csv');
    expect(detectStatementFormat('history.pdf', '')).toBeUndefined();
  });

  it('does not let the platform date parser reinterpret numeric dates', () => {
    expect(parseStatementDate('31/02/2026')).toEqual({ date: undefined, ambiguous: false });
    expect(parseStatementDate('2026-09-08')).toEqual({ date: '2026-09-08', ambiguous: false });
  });
});

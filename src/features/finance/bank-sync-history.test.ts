import { describe, expect, it } from 'vitest';
import {
  buildBankSyncHistory,
  nextScheduledSync,
  parseBankResults,
  type BankSyncLogRow,
} from './bank-sync-history';

const row = (synced_at: string, overrides: Partial<BankSyncLogRow> = {}): BankSyncLogRow => ({
  id: synced_at,
  synced_at,
  trigger: 'scheduled',
  status: 'success',
  duration_ms: 900,
  connections_synced: 4,
  accounts_synced: 5,
  transactions_synced: 21,
  transactions_new: 3,
  banks: [],
  error_message: null,
  ...overrides,
});

describe('buildBankSyncHistory', () => {
  it('returns nothing before the first run is logged', () => {
    expect(buildBankSyncHistory([], new Date('2026-09-24T12:00:00Z'))).toEqual([]);
  });

  it('flags a night with no scheduled run between logged ones', () => {
    const history = buildBankSyncHistory(
      [row('2026-09-22T05:00:01Z'), row('2026-09-24T05:00:02Z')],
      new Date('2026-09-24T12:00:00Z'),
    );
    expect(history.map(entry => [entry.synced_at, entry.status])).toEqual([
      ['2026-09-24T05:00:02Z', 'success'],
      ['2026-09-23T05:00:00.000Z', 'missed'],
      ['2026-09-22T05:00:01Z', 'success'],
    ]);
  });

  it('does not count a manual run as the night\'s scheduled one', () => {
    const history = buildBankSyncHistory(
      [row('2026-09-23T05:00:01Z'), row('2026-09-24T07:39:00Z', { trigger: 'manual' })],
      new Date('2026-09-24T12:00:00Z'),
    );
    expect(history.find(entry => entry.status === 'missed')?.id).toBe('missed-2026-09-24');
  });

  it('keeps a failed scheduled run as failed, not missed', () => {
    const history = buildBankSyncHistory(
      [row('2026-09-24T05:00:03Z', { status: 'error', error_message: 'Could not write synced accounts' })],
      new Date('2026-09-25T04:00:00Z'),
    );
    expect(history.map(entry => entry.status)).toEqual(['error']);
  });

  it('waits out the grace period before calling today missed', () => {
    const rows = [row('2026-09-23T05:00:01Z')];
    expect(buildBankSyncHistory(rows, new Date('2026-09-24T05:10:00Z')).some(e => e.status === 'missed')).toBe(false);
    expect(buildBankSyncHistory(rows, new Date('2026-09-24T05:15:00Z')).some(e => e.status === 'missed')).toBe(true);
  });

  it('does not check slots from before the log existed', () => {
    // Logging began with a manual run after the 05:00 slot had passed.
    const history = buildBankSyncHistory(
      [row('2026-09-24T07:39:00Z', { trigger: 'manual' })],
      new Date('2026-09-24T23:00:00Z'),
    );
    expect(history).toHaveLength(1);
  });

  it('looks back no further than maxDaysBack', () => {
    const history = buildBankSyncHistory(
      [row('2026-08-01T05:00:01Z')],
      new Date('2026-09-24T12:00:00Z'),
      5,
      3,
    );
    expect(history.filter(entry => entry.status === 'missed').map(entry => entry.id)).toEqual([
      'missed-2026-09-24',
      'missed-2026-09-23',
      'missed-2026-09-22',
    ]);
  });
});

describe('nextScheduledSync', () => {
  it('is later today before the slot, tomorrow after it', () => {
    expect(nextScheduledSync(new Date('2026-09-24T04:59:00Z')).toISOString()).toBe('2026-09-24T05:00:00.000Z');
    expect(nextScheduledSync(new Date('2026-09-24T05:00:00Z')).toISOString()).toBe('2026-09-25T05:00:00.000Z');
  });
});

describe('parseBankResults', () => {
  it('keeps well-formed entries and drops the rest', () => {
    expect(parseBankResults([
      { name: 'HSBC', status: 'synced', transactions: 4 },
      { name: 'Amex', status: 'failed', transactions: 0, error: 'Bank access needs renewing; reconnect this bank' },
      { name: 'Broken', status: 'unknown' },
      null,
      'HSBC',
    ])).toEqual([
      { name: 'HSBC', status: 'synced', transactions: 4 },
      { name: 'Amex', status: 'failed', transactions: 0, error: 'Bank access needs renewing; reconnect this bank' },
    ]);
    expect(parseBankResults({ name: 'HSBC' })).toEqual([]);
  });
});

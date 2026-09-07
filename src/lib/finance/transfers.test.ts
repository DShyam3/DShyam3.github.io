import { describe, expect, it } from 'vitest';
import {
  netFlows,
  transferBalance,
  transferTransactionIds,
  type ProfileTransfer,
} from './transfers';

const transfer = (o: Partial<ProfileTransfer> = {}): ProfileTransfer => ({
  id: 't1', fromProfileId: 'me', toProfileId: 'mum', amount: 300, date: '2026-09-10', ...o,
});

describe('transferTransactionIds', () => {
  it('collects both sides when both are linked', () => {
    const ids = transferTransactionIds([
      transfer({ fromTransactionId: 'tx_out', toTransactionId: 'tx_in' }),
    ]);
    expect([...ids].sort()).toEqual(['tx_in', 'tx_out']);
  });

  it('collects whichever side is linked', () => {
    expect([...transferTransactionIds([transfer({ fromTransactionId: 'tx_out' })])]).toEqual(['tx_out']);
  });

  it('collects nothing from a transfer with no ledger entries linked', () => {
    expect(transferTransactionIds([transfer()]).size).toBe(0);
  });

  it('does not double-count an id linked by two transfers', () => {
    const ids = transferTransactionIds([
      transfer({ id: 'a', fromTransactionId: 'tx' }),
      transfer({ id: 'b', toTransactionId: 'tx' }),
    ]);
    expect(ids.size).toBe(1);
  });
});

describe('netFlows', () => {
  const txs = [
    { id: 'salary', amount: 3000, date: '2026-09-01' },
    { id: 'rent', amount: -1100, date: '2026-09-01' },
    { id: 'tx_out', amount: -300, date: '2026-09-10' },
  ];

  it('splits income from spend on sign', () => {
    const f = netFlows(txs, []);
    expect(f).toMatchObject({ income: 3000, spend: 1400, net: 1600 });
  });

  it('ignores a transaction that belongs to a transfer', () => {
    const f = netFlows(txs, [transfer({ fromTransactionId: 'tx_out' })]);
    expect(f).toMatchObject({ income: 3000, spend: 1100, net: 1900 });
  });

  it('reports what it excluded rather than quietly differing', () => {
    const f = netFlows(txs, [transfer({ fromTransactionId: 'tx_out' })]);
    expect(f.excludedCount).toBe(1);
    expect(f.excludedTotal).toBe(300);
  });

  it('excludes nothing when the transfer has no linked entries', () => {
    expect(netFlows(txs, [transfer()]).spend).toBe(1400);
  });

  it('counts a zero-amount transaction as income, not spend', () => {
    const f = netFlows([{ id: 'z', amount: 0, date: '2026-09-01' }], []);
    expect(f).toMatchObject({ income: 0, spend: 0, net: 0 });
  });

  it('handles an empty ledger', () => {
    expect(netFlows([], [])).toEqual({
      income: 0, spend: 0, net: 0, excludedCount: 0, excludedTotal: 0,
    });
  });
});

describe('transferBalance', () => {
  const transfers = [
    transfer({ id: 'a', fromProfileId: 'me', toProfileId: 'mum', amount: 300 }),
    transfer({ id: 'b', fromProfileId: 'mum', toProfileId: 'me', amount: 120 }),
    transfer({ id: 'c', fromProfileId: 'me', toProfileId: 'dad', amount: 50 }),
  ];

  it('nets what a profile sent against what it received', () => {
    expect(transferBalance(transfers, 'me')).toEqual({ sent: 350, received: 120, net: -230 });
  });

  it('sees the other side of the same movements', () => {
    expect(transferBalance(transfers, 'mum')).toEqual({ sent: 120, received: 300, net: 180 });
  });

  it('is zero for a profile not involved', () => {
    expect(transferBalance(transfers, 'nobody')).toEqual({ sent: 0, received: 0, net: 0 });
  });
});

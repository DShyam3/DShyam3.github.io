import { describe, expect, it } from 'vitest';
import {
  findTransferCycles,
  findTransferPairCandidates,
  TRANSFER_MATCH_WINDOW_DAYS,
  type TransferCandidateTransaction,
  type TransferPairCandidate,
} from './transfer-detection';

const tx = (overrides: Partial<TransferCandidateTransaction> = {}): TransferCandidateTransaction => ({
  id: 'out',
  date: '2026-01-01',
  name: 'PAYMENT',
  amount: 500,
  accountId: 'current',
  ...overrides,
});

describe('findTransferPairCandidates', () => {
  it('returns an empty array for empty input', () => {
    expect(findTransferPairCandidates([])).toEqual([]);
  });

  it('pairs an outflow on one account with a matching inflow on another', () => {
    const candidates = findTransferPairCandidates([
      tx({ id: 'out1', amount: 500, accountId: 'current' }),
      tx({ id: 'in1', amount: -500, accountId: 'savings' }),
    ]);

    expect(candidates).toEqual([
      expect.objectContaining({
        outflowId: 'out1', inflowId: 'in1', amount: 500, fromAccountId: 'current', toAccountId: 'savings', daysApart: 0,
      }),
    ]);
  });

  it('pairs when the inflow posts before the outflow', () => {
    const candidates = findTransferPairCandidates([
      tx({ id: 'out1', date: '2026-01-05', amount: 500, accountId: 'current' }),
      tx({ id: 'in1', date: '2026-01-03', amount: -500, accountId: 'savings' }),
    ]);

    expect(candidates).toEqual([
      expect.objectContaining({ outflowId: 'out1', inflowId: 'in1', daysApart: 2 }),
    ]);
  });

  it('includes a pair straddling the window boundary at exactly the window and excludes one day beyond', () => {
    const withinWindow = findTransferPairCandidates([
      tx({ id: 'out1', date: '2026-01-01', amount: 500, accountId: 'current' }),
      tx({ id: 'in1', date: '2026-01-04', amount: -500, accountId: 'savings' }), // 3 days
    ]);
    expect(withinWindow).toHaveLength(1);
    expect(withinWindow[0]?.daysApart).toBe(TRANSFER_MATCH_WINDOW_DAYS);

    const beyondWindow = findTransferPairCandidates([
      tx({ id: 'out2', date: '2026-01-01', amount: 500, accountId: 'current' }),
      tx({ id: 'in2', date: '2026-01-05', amount: -500, accountId: 'savings' }), // 4 days
    ]);
    expect(beyondWindow).toEqual([]);
  });

  it('respects a custom window when supplied', () => {
    const candidates = findTransferPairCandidates(
      [
        tx({ id: 'out1', date: '2026-01-01', amount: 500, accountId: 'current' }),
        tx({ id: 'in1', date: '2026-01-08', amount: -500, accountId: 'savings' }), // 7 days
      ],
      7,
    );
    expect(candidates).toHaveLength(1);
  });

  it('compares amounts as pence, so 0.1 + 0.2 still matches -0.3', () => {
    const candidates = findTransferPairCandidates([
      tx({ id: 'out1', amount: 0.1 + 0.2, accountId: 'current' }),
      tx({ id: 'in1', amount: -0.3, accountId: 'savings' }),
    ]);

    expect(candidates).toEqual([
      expect.objectContaining({ outflowId: 'out1', inflowId: 'in1', amount: 0.3 }),
    ]);
  });

  it('never pairs amounts a penny apart, same-account rows, null-account rows, or an unmatched salary credit', () => {
    const candidates = findTransferPairCandidates([
      // A penny apart.
      tx({ id: 'penny-out', amount: 500, accountId: 'current' }),
      tx({ id: 'penny-in', amount: -499.99, accountId: 'savings' }),
      // Same account on both legs.
      tx({ id: 'same-out', amount: 200, accountId: 'current' }),
      tx({ id: 'same-in', amount: -200, accountId: 'current' }),
      // No account attributed to either row.
      tx({ id: 'null-out', amount: 300, accountId: null }),
      tx({ id: 'null-in', amount: -300, accountId: null }),
      // A genuine salary credit with no outflow counterpart anywhere.
      tx({ id: 'salary', name: 'ACME PAYROLL', amount: -2300, accountId: 'current' }),
    ]);

    expect(candidates).toEqual([]);
  });

  it('never pairs a zero-amount row', () => {
    const candidates = findTransferPairCandidates([
      tx({ id: 'zero-out', amount: 0, accountId: 'current' }),
      tx({ id: 'zero-in', amount: 0, accountId: 'savings' }),
    ]);
    expect(candidates).toEqual([]);
  });

  it('skips rows with an unparseable date rather than throwing', () => {
    const candidates = findTransferPairCandidates([
      tx({ id: 'out1', date: '01/01/2026', amount: 500, accountId: 'current' }),
      tx({ id: 'in1', date: '2026-01-01', amount: -500, accountId: 'savings' }),
    ]);
    expect(candidates).toEqual([]);
  });

  it('resolves competing candidates deterministically, one-to-one', () => {
    const candidates = findTransferPairCandidates([
      tx({ id: 'out1', date: '2026-01-01', amount: 500, accountId: 'current' }),
      tx({ id: 'inA', date: '2026-01-01', amount: -500, accountId: 'savings-a' }),
      tx({ id: 'inB', date: '2026-01-01', amount: -500, accountId: 'savings-b' }),
    ]);

    // Both `inA` and `inB` are equally valid matches for `out1`; the
    // lexicographically smallest inflow id wins, and `inB` is left unpaired
    // rather than silently matched to something else.
    expect(candidates).toEqual([
      expect.objectContaining({ outflowId: 'out1', inflowId: 'inA' }),
    ]);
  });

  it('pairs two same-day, same-amount transfers between the same accounts one-to-one', () => {
    const candidates = findTransferPairCandidates([
      tx({ id: 'out1', date: '2026-01-01', amount: 500, accountId: 'current' }),
      tx({ id: 'out2', date: '2026-01-01', amount: 500, accountId: 'current' }),
      tx({ id: 'in1', date: '2026-01-01', amount: -500, accountId: 'savings' }),
      tx({ id: 'in2', date: '2026-01-01', amount: -500, accountId: 'savings' }),
    ]);

    expect(candidates).toHaveLength(2);
    expect(candidates.map(c => [c.outflowId, c.inflowId])).toEqual([
      ['out1', 'in1'],
      ['out2', 'in2'],
    ]);
  });

  it('emits and orders signals as specified', () => {
    const candidates = findTransferPairCandidates([
      tx({
        id: 'out1', date: '2026-01-01', name: 'Transfer to savings', amount: 500,
        accountId: 'current', providerCategory: 'transfer',
      }),
      tx({
        id: 'in1', date: '2026-01-01', name: 'FROM CURRENT', amount: -500,
        accountId: 'savings', category: 'Savings',
      }),
    ]);

    expect(candidates[0]?.signals).toEqual([
      'exact_amount',
      'same_day',
      'provider_says_transfer',
      'name_suggests_transfer',
      'savings_category',
    ]);
  });

  it('emits only exact_amount for a plain match with no other evidence', () => {
    const candidates = findTransferPairCandidates([
      tx({ id: 'out1', date: '2026-01-01', name: 'PAYMENT', amount: 500, accountId: 'current' }),
      tx({ id: 'in1', date: '2026-01-03', name: 'RECEIPT', amount: -500, accountId: 'savings' }),
    ]);

    expect(candidates[0]?.signals).toEqual(['exact_amount']);
  });
});

describe('findTransferCycles', () => {
  const pair = (overrides: Partial<TransferPairCandidate> = {}): TransferPairCandidate => ({
    outflowId: 'o',
    inflowId: 'i',
    amount: 100,
    fromAccountId: 'A',
    toAccountId: 'B',
    daysApart: 0,
    signals: ['exact_amount'],
    ...overrides,
  });

  it('returns an empty array for empty input', () => {
    expect(findTransferCycles([])).toEqual([]);
  });

  it('finds an A -> B -> A round trip as a single cycle', () => {
    const pairs = [
      pair({ outflowId: 'o1', inflowId: 'i1', fromAccountId: 'A', toAccountId: 'B', amount: 100 }),
      pair({ outflowId: 'o2', inflowId: 'i2', fromAccountId: 'B', toAccountId: 'A', amount: 100 }),
    ];

    const cycles = findTransferCycles(pairs);

    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.accountPath).toEqual(['A', 'B', 'A']);
    expect(cycles[0]?.pairs.map(p => p.outflowId)).toEqual(['o1', 'o2']);
    expect(cycles[0]?.totalMoved).toBe(200);
  });

  it('finds a three-account loop A -> B -> C -> A', () => {
    const pairs = [
      pair({ outflowId: 'o1', inflowId: 'i1', fromAccountId: 'A', toAccountId: 'B', amount: 50 }),
      pair({ outflowId: 'o2', inflowId: 'i2', fromAccountId: 'B', toAccountId: 'C', amount: 50 }),
      pair({ outflowId: 'o3', inflowId: 'i3', fromAccountId: 'C', toAccountId: 'A', amount: 50 }),
    ];

    const cycles = findTransferCycles(pairs);

    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.accountPath).toEqual(['A', 'B', 'C', 'A']);
    expect(cycles[0]?.totalMoved).toBe(150);
  });

  it('does not report a cycle for a chain of pairs with no path back to the start', () => {
    const pairs = [
      pair({ outflowId: 'o1', inflowId: 'i1', fromAccountId: 'A', toAccountId: 'B', amount: 50 }),
      pair({ outflowId: 'o2', inflowId: 'i2', fromAccountId: 'B', toAccountId: 'C', amount: 50 }),
    ];

    expect(findTransferCycles(pairs)).toEqual([]);
  });

  it('does not reuse a pair across two reported cycles', () => {
    // A <-> B round trip, plus a spare pair from B that goes nowhere back to A.
    const shared = pair({ outflowId: 'o1', inflowId: 'i1', fromAccountId: 'A', toAccountId: 'B', amount: 100 });
    const pairs = [
      shared,
      pair({ outflowId: 'o2', inflowId: 'i2', fromAccountId: 'B', toAccountId: 'A', amount: 100 }),
    ];

    const cycles = findTransferCycles(pairs);
    const usedIds = cycles.flatMap(c => c.pairs.map(p => p.outflowId));
    expect(new Set(usedIds).size).toBe(usedIds.length);
  });
});

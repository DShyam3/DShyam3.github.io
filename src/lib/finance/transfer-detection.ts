/**
 * Deterministic candidates for money moved between the owner's own accounts.
 *
 * Current -> savings -> back again, or a loop through three accounts, is not
 * income and not spending, but it arrives in the ledger looking exactly like
 * both: a positive row on the source account and a matching negative row on
 * the destination. Counted as-is, it inflates every gross figure the app
 * shows.
 *
 * This module only detects. It never links, tags or mutates a transaction --
 * a bank reference is not proof, so a person confirms every pair before it
 * is treated as a transfer (the same stance as `payslip-reconciliation.ts`).
 */

/** Ledger amounts are positive for money spent and negative for money received. */
export interface TransferCandidateTransaction {
  id: string;
  /** YYYY-MM-DD. */
  date: string;
  name: string;
  /** Positive = money out, negative = money in. */
  amount: number;
  /** Null when the row is not attributed to an account; such rows never pair. */
  accountId: string | null;
  /** The category the row currently carries, e.g. 'Savings', 'Wants'. */
  category?: string;
  /** The provider's own classification, lowercased, e.g. 'transfer'. */
  providerCategory?: string;
}

export type TransferSignal =
  | 'exact_amount'
  | 'same_day'
  | 'provider_says_transfer'
  | 'name_suggests_transfer'
  | 'savings_category';

export interface TransferPairCandidate {
  outflowId: string;
  inflowId: string;
  /** Absolute, in whole currency units, rounded to 2dp. */
  amount: number;
  fromAccountId: string;
  toAccountId: string;
  /** Absolute calendar days between the two postings. */
  daysApart: number;
  signals: TransferSignal[];
}

export interface TransferCycle {
  /** Pair candidates in order, forming a closed loop back to the first account. */
  pairs: TransferPairCandidate[];
  /** Accounts visited, starting and ending with the same id. */
  accountPath: string[];
  /** Total moved around the loop, 2dp. */
  totalMoved: number;
}

export const TRANSFER_MATCH_WINDOW_DAYS = 3;

/**
 * The graph-search budget for `findTransferCycles`. Simple-cycle counts can
 * grow combinatorially when several pairs share the same pair of accounts
 * (three round trips between the same two accounts, say), so the search
 * stops expanding once it has looked at this many edges rather than trying
 * to be exhaustive. A personal ledger's account graph is tiny -- a handful
 * of nodes -- so in practice this cap is never approached; it exists to keep
 * pathological or adversarial input from hanging the caller.
 */
const MAX_CYCLE_SEARCH_STEPS = 5_000;

const pence = (amount: number): number => Math.round(amount * 100);

const round2 = (n: number): number => Math.round(n * 100) / 100;

const dateAtMidnightUtc = (value: string): number | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== Number(year)
    || parsed.getUTCMonth() !== Number(month) - 1
    || parsed.getUTCDate() !== Number(day)
  ) return undefined;
  return timestamp;
};

/** Word-boundary, case-insensitive: transfer, xfer, "to savings", "from savings". */
const TRANSFER_NAME_PATTERN = /\b(transfer|xfer|to savings|from savings)\b/i;

const suggestsTransfer = (name: string): boolean => TRANSFER_NAME_PATTERN.test(name);

const signalsFor = (
  outflow: TransferCandidateTransaction,
  inflow: TransferCandidateTransaction,
  daysApart: number,
): TransferSignal[] => {
  const signals: TransferSignal[] = ['exact_amount'];
  if (daysApart === 0) signals.push('same_day');
  if (outflow.providerCategory === 'transfer' || inflow.providerCategory === 'transfer') {
    signals.push('provider_says_transfer');
  }
  if (suggestsTransfer(outflow.name) || suggestsTransfer(inflow.name)) {
    signals.push('name_suggests_transfer');
  }
  if (outflow.category === 'Savings' || inflow.category === 'Savings') {
    signals.push('savings_category');
  }
  return signals;
};

interface DatedTransaction extends TransferCandidateTransaction {
  accountId: string;
  timestamp: number;
}

/**
 * Finds pairs of rows that look like one leg of a transfer between two of
 * the owner's own accounts: an outflow on one account matched by an inflow
 * of the same amount, within a few days, on a different account.
 *
 * Amounts are compared as integer pence, never as floating point, so 0.1 and
 * 0.2 do not fail to equal 0.3. Each transaction id can appear in at most
 * one returned pair; when several candidates compete for the same row, the
 * closest dated match wins, with a fully deterministic tie-break so the same
 * input always produces the same output.
 */
export const findTransferPairCandidates = (
  transactions: readonly TransferCandidateTransaction[],
  windowDays: number = TRANSFER_MATCH_WINDOW_DAYS,
): TransferPairCandidate[] => {
  const dated: DatedTransaction[] = [];
  for (const transaction of transactions) {
    if (transaction.accountId === null) continue;
    const timestamp = dateAtMidnightUtc(transaction.date);
    if (timestamp === undefined) continue;
    dated.push({ ...transaction, accountId: transaction.accountId, timestamp });
  }

  const outflows = dated.filter(t => pence(t.amount) > 0);
  const inflows = dated.filter(t => pence(t.amount) < 0);

  interface Scored {
    pair: TransferPairCandidate;
    daysApart: number;
    earliestTimestamp: number;
  }

  const scored: Scored[] = [];
  for (const outflow of outflows) {
    const outflowPence = pence(outflow.amount);
    for (const inflow of inflows) {
      if (outflow.accountId === inflow.accountId) continue;
      if (pence(inflow.amount) !== -outflowPence) continue;
      const daysApart = Math.abs(outflow.timestamp - inflow.timestamp) / 86_400_000;
      if (daysApart > windowDays) continue;

      scored.push({
        pair: {
          outflowId: outflow.id,
          inflowId: inflow.id,
          amount: outflowPence / 100,
          fromAccountId: outflow.accountId,
          toAccountId: inflow.accountId,
          daysApart,
          signals: signalsFor(outflow, inflow, daysApart),
        },
        daysApart,
        earliestTimestamp: Math.min(outflow.timestamp, inflow.timestamp),
      });
    }
  }

  scored.sort((left, right) => (
    left.daysApart - right.daysApart
    || left.earliestTimestamp - right.earliestTimestamp
    || left.pair.outflowId.localeCompare(right.pair.outflowId)
    || left.pair.inflowId.localeCompare(right.pair.inflowId)
  ));

  const used = new Set<string>();
  const result: TransferPairCandidate[] = [];
  for (const { pair } of scored) {
    if (used.has(pair.outflowId) || used.has(pair.inflowId)) continue;
    used.add(pair.outflowId);
    used.add(pair.inflowId);
    result.push(pair);
  }

  return result;
};

interface Edge {
  pair: TransferPairCandidate;
  to: string;
}

interface RawCycle {
  pairs: TransferPairCandidate[];
  accountPath: string[];
}

/** Rotates a closed loop to start (and end) at its lexicographically smallest account. */
const normaliseCycle = (raw: RawCycle): RawCycle => {
  const loop = raw.accountPath.slice(0, -1); // drop the repeated closing account
  let smallestIndex = 0;
  for (let i = 1; i < loop.length; i += 1) {
    if (loop[i]!.localeCompare(loop[smallestIndex]!) < 0) smallestIndex = i;
  }
  if (smallestIndex === 0) return raw;

  const rotatedPairs = [...raw.pairs.slice(smallestIndex), ...raw.pairs.slice(0, smallestIndex)];
  const rotatedAccounts = [...loop.slice(smallestIndex), ...loop.slice(0, smallestIndex)];
  return { pairs: rotatedPairs, accountPath: [...rotatedAccounts, rotatedAccounts[0]!] };
};

const cycleKey = (cycle: RawCycle): string =>
  cycle.pairs.map(pair => `${pair.outflowId}>${pair.inflowId}`).join('|');

/**
 * Finds closed loops of transfer candidates -- A to B and back, or a chain
 * through several accounts that returns to where it started. A two-account
 * round trip is the common case; longer loops are found the same way.
 *
 * Each pair can belong to at most one reported cycle. Cycles are reported
 * longest first, then by their (normalised) starting account, so the output
 * is deterministic regardless of the order pairs were supplied in.
 */
export const findTransferCycles = (
  pairs: readonly TransferPairCandidate[],
): TransferCycle[] => {
  if (pairs.length === 0) return [];

  const edgesByAccount = new Map<string, Edge[]>();
  for (const pair of pairs) {
    if (pair.fromAccountId === pair.toAccountId) continue; // not a real move
    const edges = edgesByAccount.get(pair.fromAccountId) ?? [];
    edges.push({ pair, to: pair.toAccountId });
    edgesByAccount.set(pair.fromAccountId, edges);
  }

  const accounts = [...edgesByAccount.keys()].sort((a, b) => a.localeCompare(b));
  const rawCycles: RawCycle[] = [];
  const seenKeys = new Set<string>();
  let steps = 0;

  const dfs = (
    start: string,
    current: string,
    visited: Set<string>,
    pathPairs: TransferPairCandidate[],
    pathAccounts: string[],
  ): void => {
    const edges = edgesByAccount.get(current);
    if (!edges) return;
    for (const edge of edges) {
      if (steps >= MAX_CYCLE_SEARCH_STEPS) return;
      steps += 1;

      if (edge.to === start) {
        const raw = normaliseCycle({
          pairs: [...pathPairs, edge.pair],
          accountPath: [...pathAccounts, edge.to],
        });
        const key = cycleKey(raw);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          rawCycles.push(raw);
        }
        continue;
      }

      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      dfs(start, edge.to, visited, [...pathPairs, edge.pair], [...pathAccounts, edge.to]);
      visited.delete(edge.to);
    }
  };

  for (const start of accounts) {
    if (steps >= MAX_CYCLE_SEARCH_STEPS) break;
    dfs(start, start, new Set([start]), [], [start]);
  }

  rawCycles.sort((left, right) => (
    right.pairs.length - left.pairs.length
    || left.accountPath[0]!.localeCompare(right.accountPath[0]!)
  ));

  const usedPairs = new Set<TransferPairCandidate>();
  const cycles: TransferCycle[] = [];
  for (const raw of rawCycles) {
    if (raw.pairs.some(pair => usedPairs.has(pair))) continue;
    for (const pair of raw.pairs) usedPairs.add(pair);
    cycles.push({
      pairs: raw.pairs,
      accountPath: raw.accountPath,
      totalMoved: round2(raw.pairs.reduce((sum, pair) => sum + pair.amount, 0)),
    });
  }

  return cycles;
};

/**
 * A pair a person has confirmed really is one internal movement.
 *
 * Detection above proposes; this is the record of the answer. Only confirmed
 * links change a figure -- an amount and a date agreeing is a coincidence
 * often enough that acting on it unasked would reclassify real income as
 * internal movement, which is a worse error than the one it corrects.
 */
export interface ConfirmedTransferLink {
  outflowTransactionId: string;
  inflowTransactionId: string;
}

/**
 * Every transaction id that is one leg of a confirmed internal transfer.
 *
 * Income and spending totals exclude these. Both legs go: the money leaving
 * one account and arriving in another is a single movement between pockets
 * the owner already had, so counting either leg would overstate the month --
 * the outflow as spending it never did, the inflow as income it never earned.
 *
 * The balances themselves are untouched. Moving £500 to savings really does
 * leave the current account £500 lighter; what it does not do is mean £500
 * was spent.
 */
export const transferExcludedTransactionIds = (
  links: readonly ConfirmedTransferLink[],
): Set<string> => {
  const excluded = new Set<string>();
  for (const link of links) {
    excluded.add(link.outflowTransactionId);
    excluded.add(link.inflowTransactionId);
  }
  return excluded;
};

/** A confirmed link as stored: the pair, plus its identity and when. */
export interface StoredTransferLink extends ConfirmedTransferLink {
  id: string;
  confirmedAt: string;
}

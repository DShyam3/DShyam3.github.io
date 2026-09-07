/**
 * Money moved between the people you track.
 *
 * The point of recording these is not bookkeeping for its own sake. Sending
 * £300 to a profile you also track has not left the household, so counting it
 * as spending on one side and income on the other overstates both. A transfer
 * says "these two entries are the same movement", and the flow figures skip it.
 *
 * Pure: the caller supplies the transfers and the transactions, and gets back
 * which ids to ignore and what the flows are once they are.
 */

export interface ProfileTransfer {
  id: string;
  fromProfileId: string;
  toProfileId: string;
  /** Positive. Direction is carried by the two profile ids, not the sign. */
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  note?: string;
  /** The entry in the sending profile's ledger, when one has been linked. */
  fromTransactionId?: string | null;
  /** The entry in the receiving profile's ledger, when one has been linked. */
  toTransactionId?: string | null;
}

export interface FlowTransaction {
  id: string;
  amount: number;
  date: string;
}

export interface NetFlows {
  income: number;
  spend: number;
  net: number;
  /** What was excluded, so a caller can say so rather than quietly differing. */
  excludedCount: number;
  excludedTotal: number;
}

/**
 * Transaction ids that belong to a recorded transfer, in either direction.
 *
 * Only linked ids count. A transfer with nothing linked is still a record of a
 * movement, but there is no ledger entry to exclude, so excluding nothing is
 * the correct behaviour rather than a gap.
 */
export const transferTransactionIds = (transfers: ProfileTransfer[]): Set<string> => {
  const ids = new Set<string>();
  for (const t of transfers) {
    if (t.fromTransactionId) ids.add(t.fromTransactionId);
    if (t.toTransactionId) ids.add(t.toTransactionId);
  }
  return ids;
};

/**
 * Income, spend and net over a set of transactions, ignoring internal
 * transfers.
 *
 * Sign convention follows the ledger: positive is money in.
 */
export const netFlows = (
  transactions: FlowTransaction[],
  transfers: ProfileTransfer[],
): NetFlows => {
  const skip = transferTransactionIds(transfers);

  let income = 0;
  let spend = 0;
  let excludedCount = 0;
  let excludedTotal = 0;

  for (const tx of transactions) {
    if (skip.has(tx.id)) {
      excludedCount += 1;
      excludedTotal += Math.abs(tx.amount);
      continue;
    }
    if (tx.amount >= 0) income += tx.amount;
    else spend += Math.abs(tx.amount);
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    income: round2(income),
    spend: round2(spend),
    net: round2(income - spend),
    excludedCount,
    excludedTotal: round2(excludedTotal),
  };
};

/**
 * What a profile has sent and received, netted.
 *
 * Positive means the profile has received more than it sent — useful for
 * answering "who owes whom" once several transfers have gone each way.
 */
export const transferBalance = (
  transfers: ProfileTransfer[],
  profileId: string,
): { sent: number; received: number; net: number } => {
  let sent = 0;
  let received = 0;
  for (const t of transfers) {
    if (t.fromProfileId === profileId) sent += t.amount;
    if (t.toProfileId === profileId) received += t.amount;
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return { sent: round2(sent), received: round2(received), net: round2(received - sent) };
};

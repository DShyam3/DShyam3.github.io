/**
 * Bank sync history for display: what `finance_sync_log` recorded, plus a
 * placeholder for every nightly slot that has no scheduled run logged.
 *
 * The placeholders are the point. pg_cron reports "succeeded" once it has
 * queued the HTTP call, whatever the function then does, so the only proof
 * the nightly sync ran is a row the function wrote itself. A slot with no row
 * is a night it did not finish -- never fired, timed out, or crashed before
 * it could log.
 *
 * No Supabase, no React: rows in, rows out.
 */

/**
 * The nightly `truelayer-daily-sync` job's hour, in UTC. Set by
 * supabase/migrations/20260908200000_truelayer_cron_sync.sql -- change both.
 */
export const SCHEDULED_SYNC_HOUR_UTC = 5;

/**
 * How long after the slot a scheduled run may take to land before today's
 * slot counts as missed. The job's HTTP timeout is two minutes; this leaves
 * room for a slow bank.
 */
const SCHEDULED_SYNC_GRACE_MS = 15 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BankRunResult {
  name: string;
  status: 'synced' | 'failed';
  transactions: number;
  error?: string;
}

export interface BankSyncLogRow {
  id: string;
  synced_at: string;
  trigger: 'scheduled' | 'manual';
  status: 'success' | 'partial' | 'error';
  duration_ms: number;
  connections_synced: number;
  accounts_synced: number;
  transactions_synced: number;
  transactions_new: number;
  banks: BankRunResult[];
  error_message: string | null;
}

export type BankSyncHistoryEntry =
  | BankSyncLogRow
  | (Omit<BankSyncLogRow, 'status'> & { status: 'missed' });

/**
 * `banks` arrives as untyped JSON. Anything that is not a well-formed bank
 * result is dropped rather than guessed at.
 */
export function parseBankResults(value: unknown): BankRunResult[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): BankRunResult[] => {
    if (typeof item !== 'object' || item === null) return [];
    const { name, status, transactions, error } = item as Record<string, unknown>;
    if (typeof name !== 'string' || (status !== 'synced' && status !== 'failed')) return [];
    return [{
      name,
      status,
      transactions: typeof transactions === 'number' ? transactions : 0,
      ...(typeof error === 'string' ? { error } : {}),
    }];
  });
}

const utcDayKey = (date: Date) => date.toISOString().slice(0, 10);

/** The scheduled slot on the UTC day `date` falls in. */
const slotOn = (date: Date, hourUtc: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hourUtc));

/** The next time the nightly job is due, strictly after `now`. */
export function nextScheduledSync(now: Date, hourUtc = SCHEDULED_SYNC_HOUR_UTC): Date {
  const today = slotOn(now, hourUtc);
  return today.getTime() > now.getTime() ? today : new Date(today.getTime() + DAY_MS);
}

/**
 * Logged runs newest first, with a `missed` entry for each nightly slot since
 * logging began that has no scheduled run on its UTC day. Slots before the
 * oldest row are not checked: the log did not exist then, so silence there
 * says nothing. Today's slot is checked only once its grace period is over.
 */
export function buildBankSyncHistory(
  rows: BankSyncLogRow[],
  now: Date,
  hourUtc = SCHEDULED_SYNC_HOUR_UTC,
  maxDaysBack = 30,
): BankSyncHistoryEntry[] {
  if (rows.length === 0) return [];

  const scheduledDays = new Set(
    rows.filter(row => row.trigger === 'scheduled').map(row => utcDayKey(new Date(row.synced_at))),
  );
  const oldest = Math.min(...rows.map(row => new Date(row.synced_at).getTime()));
  const earliest = Math.max(oldest, now.getTime() - maxDaysBack * DAY_MS);

  const missed: BankSyncHistoryEntry[] = [];
  for (
    let slot = slotOn(new Date(earliest), hourUtc);
    slot.getTime() + SCHEDULED_SYNC_GRACE_MS <= now.getTime();
    slot = new Date(slot.getTime() + DAY_MS)
  ) {
    if (slot.getTime() < earliest) continue;
    const day = utcDayKey(slot);
    if (scheduledDays.has(day)) continue;
    missed.push({
      id: `missed-${day}`,
      synced_at: slot.toISOString(),
      trigger: 'scheduled',
      status: 'missed',
      duration_ms: 0,
      connections_synced: 0,
      accounts_synced: 0,
      transactions_synced: 0,
      transactions_new: 0,
      banks: [],
      error_message: null,
    });
  }

  return [...rows, ...missed].sort(
    (a, b) => new Date(b.synced_at).getTime() - new Date(a.synced_at).getTime(),
  );
}

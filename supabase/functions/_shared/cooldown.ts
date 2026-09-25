/**
 * A server-side cooldown for the admin-triggered syncs.
 *
 * A disabled button stops a double click, not a second tab, a reload or a
 * curl loop. Each of those would spend the same third-party calls again --
 * TMDB for the watchlist, the bank's Data API for TrueLayer -- so the gap
 * between runs is enforced here, where the calls are made.
 *
 * Sliding rather than the fixed window `check_rate_limit` uses: "one per ten
 * minutes" should mean ten minutes after the last run, not whenever the clock
 * next crosses a multiple of ten.
 *
 * State lives in `rate_limits`, the same service-role-only table the TMDB
 * proxy counts in, so this needs no schema of its own. Each claim is one row
 * keyed by the time it was made; `check_rate_limit`'s sweep clears rows over
 * an hour old, which outlives every cooldown here.
 */

// Pinned to the version every function in this directory imports; see
// require-admin.ts for why an unpinned `@2` breaks the call sites.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

/**
 * How long to tell a request that lost a race. Both racers refuse and remove
 * their rows, so the key is free again at once; quoting the full window would
 * lock the button for ten minutes over a claim nobody holds.
 */
const RACE_RETRY_SECONDS = 5

/**
 * Claims the cooldown named by `key`. Returns 0 when the caller may proceed,
 * or the whole seconds until the next claim will succeed.
 *
 * Insert first, then look for anyone else inside the window. Two requests
 * racing each see the other and both refuse, so a race costs a retry rather
 * than a second run. A refused claim removes its own row, so knocking on a
 * closed door does not push the door further away.
 *
 * Fails open on a database error, as the TMDB proxy's limiter does: the sync
 * that follows needs the same database, so an outage here stops it anyway,
 * and a cooldown that errors should not be what takes the button away.
 */
export async function claimCooldown(
  admin: SupabaseClient,
  key: string,
  seconds: number,
): Promise<number> {
  const now = new Date()
  const claimedAt = now.toISOString()

  const { error: insertError } = await admin
    .from('rate_limits')
    .insert({ key, window_start: claimedAt, count: 1 })
  if (insertError) {
    // Primary key is (key, window_start): another claim in the same
    // millisecond. That is a race, and a race refuses.
    if (insertError.code === '23505') return RACE_RETRY_SECONDS
    console.error('cooldown claim failed, allowing request:', insertError.message)
    return 0
  }

  const since = new Date(now.getTime() - seconds * 1000).toISOString()
  const { data: others, error: readError } = await admin
    .from('rate_limits')
    .select('window_start')
    .eq('key', key)
    .gt('window_start', since)
    .neq('window_start', claimedAt)
    .order('window_start', { ascending: true })
    .limit(1)
  if (readError) {
    console.error('cooldown check failed, allowing request:', readError.message)
    return 0
  }
  if (!others || others.length === 0) return 0

  const { error: deleteError } = await admin
    .from('rate_limits')
    .delete()
    .eq('key', key)
    .eq('window_start', claimedAt)
  if (deleteError) {
    // The refused row stays, and holds the cooldown for a full window from
    // now -- later than the answer below says. Rare, and it only errs long.
    console.error('cooldown refusal cleanup failed:', deleteError.message)
  }

  const earliest = new Date((others[0] as { window_start: string }).window_start).getTime()
  // A claim within the last few seconds is as likely a racer that also
  // refused as a run that started; the short answer is right either way,
  // since the retry gets the real one.
  if (earliest > now.getTime() - RACE_RETRY_SECONDS * 1000) return RACE_RETRY_SECONDS
  return Math.max(1, Math.ceil((earliest + seconds * 1000 - now.getTime()) / 1000))
}

/** Clears a cooldown, for an event that makes the next run worth having now. */
export async function releaseCooldown(admin: SupabaseClient, key: string): Promise<void> {
  const { error } = await admin.from('rate_limits').delete().eq('key', key)
  if (error) console.error('cooldown release failed:', error.message)
}

/** The 429 a refused claim answers with. */
export function cooldownResponse(
  retryAfterSeconds: number,
  what: string,
  headers: Record<string, string>,
): Response {
  const minutes = Math.ceil(retryAfterSeconds / 60)
  return new Response(
    JSON.stringify({
      error: `${what} ran recently. Try again in ${minutes} min.`,
      retry_after: retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    },
  )
}

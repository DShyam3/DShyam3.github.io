import { fetchPublic, type PublicFetchDeps, type PublicFetchError } from '../_shared/public-fetch.ts'

/**
 * One link's check: the final HTTP status once redirects are followed, or why
 * there was none. Kept apart from the handler so it runs under test with a
 * fake fetch and resolver.
 */

export { MAX_REDIRECTS } from '../_shared/public-fetch.ts'

/** Honest about what it is, so a site owner reading their logs can tell. */
export const USER_AGENT = 'DShyamLinkCheck/1.0 (+https://dshyam3.github.io/links)'

export type CheckError = PublicFetchError

export interface LinkCheck {
  /** Final HTTP status, or null when no response came back. */
  status: number | null
  error: CheckError | null
  /** The answer was a bot challenge, whatever its status: a person gets through. */
  challenged?: true
}

export type CheckDeps = PublicFetchDeps

/**
 * Statuses that say the site is there but will not serve a robot: a login
 * wall, a bot shield, a rate limit. The link still works for a person, so
 * these are not failures. Everything else outside 2xx is.
 */
const REFUSES_ROBOTS = new Set([401, 403, 429])

/**
 * Whether the check found the link working.
 *
 * The cost of reading 401/403/429 and bot challenges as working: a dead page
 * that a CDN answers with 403 (CloudFront in front of a deleted S3 object)
 * is never flagged. A bot wall that answers 503 without saying so (Amazon's
 * robot check) is flagged after three failed checks.
 */
export const isWorking = (check: LinkCheck): boolean =>
  check.challenged === true ||
  (check.status !== null &&
    ((check.status >= 200 && check.status < 300) || REFUSES_ROBOTS.has(check.status)))

async function request(deps: CheckDeps, url: URL, method: 'HEAD' | 'GET'): Promise<Response> {
  const response = await deps.fetch(url, {
    method,
    // Never followed on trust: every hop is checked against the address rules
    // before it is requested.
    redirect: 'manual',
    signal: deps.signal,
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
  })
  // Only the status is wanted; do not download the page.
  await response.body?.cancel()
  return response
}

/**
 * Checks `url`. HEAD first, since it fetches no page; a server that answers
 * HEAD with an error gets a GET as well, because enough of them mishandle HEAD
 * that its error alone is not evidence. Every hop passes the address rules
 * first (`fetchPublic`).
 */
export async function checkLink(url: string, deps: CheckDeps): Promise<LinkCheck> {
  const result = await fetchPublic(url, deps, async (target) => {
    const response = await request(deps, target, 'HEAD')
    return response.status >= 400 ? request(deps, target, 'GET') : response
  })
  if (!result.ok) return { status: null, error: result.error }
  // Cloudflare marks a challenge page; it often comes as 503 or 403.
  if (result.response.headers.get('cf-mitigated') === 'challenge') {
    return { status: result.response.status, error: null, challenged: true }
  }
  return { status: result.response.status, error: null }
}

/** A `link_checks` row, less its key. */
export interface CheckRow {
  /** The URL this result is for; a link whose URL has changed starts afresh. */
  url: string
  checked_at: string
  check_status: number | null
  check_error: CheckError | null
  check_failures: number
  failing_since: string | null
}

/**
 * The row after checking `url`, finished at `now`. A working link clears the
 * streak; a failing one extends it, keeping the date it began. A previous row
 * for a different URL counts for nothing.
 */
export function nextCheckRow(
  previous: Pick<CheckRow, 'url' | 'check_failures' | 'failing_since'> | null,
  url: string,
  check: LinkCheck,
  now: string,
): CheckRow {
  const streak = previous?.url === url ? previous : { check_failures: 0, failing_since: null }
  const working = isWorking(check)
  return {
    url,
    checked_at: now,
    check_status: check.status,
    check_error: check.error,
    // smallint column; a link failing daily for years stays in range.
    check_failures: working ? 0 : Math.min(streak.check_failures + 1, 10_000),
    failing_since: working ? null : (streak.failing_since ?? now),
  }
}

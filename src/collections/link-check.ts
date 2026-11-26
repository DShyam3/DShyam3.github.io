/**
 * What the daily link check found, in words. The check itself runs on the
 * server (`supabase/functions/links-check`) and writes one `link_checks` row
 * per link -- the final HTTP status or the reason there was none, and how
 * many checks in a row have failed. Only the owner can read those rows. This
 * decides when a link is worth their attention, and how to say why.
 */

export type LinkCheckError =
  | 'bad_url'
  | 'blocked_address'
  | 'dns'
  | 'timeout'
  | 'connection'
  | 'too_many_redirects';

export interface LinkCheck {
  link_id: string;
  /** The URL the result is for. A link edited since then has no result yet. */
  url: string;
  checked_at: string;
  check_status: number | null;
  check_error: string | null;
  check_failures: number;
  failing_since: string | null;
}

export interface CheckedLink {
  id: string;
  name: string;
  url: string;
  created_at: string;
}

/**
 * Failed checks in a row before a link is shown as failing. The check runs
 * daily, so one bad morning -- a deploy, an outage -- is not a dead link;
 * three in a row is.
 */
export const FAILING_AFTER = 3;

/**
 * How long a link may go unchecked before the owner is told the check has
 * stalled. It runs daily, so two days means at least one run missed it: the
 * function not deployed, the schedule's key rotated, a run killed, or runs
 * that keep running out of time before they reach it.
 */
export const STALE_AFTER_MS = 2 * 24 * 60 * 60 * 1000;

export const isFailing = (check: Pick<LinkCheck, 'check_failures'>): boolean =>
  check.check_failures >= FAILING_AFTER;

/** Each failing link with its check, in the links' order. Results for a URL since changed are ignored. */
export function failingLinks<L extends CheckedLink>(
  links: L[],
  checks: LinkCheck[],
): { link: L; check: LinkCheck }[] {
  const byLink = new Map(checks.map((check) => [check.link_id, check]));
  return links.flatMap((link) => {
    const check = byLink.get(link.id);
    return check && check.url === link.url && isFailing(check) ? [{ link, check }] : [];
  });
}

const ERROR_LABELS: Record<LinkCheckError, string> = {
  dns: 'Domain no longer resolves',
  timeout: 'No answer in time',
  connection: 'Could not connect',
  too_many_redirects: 'Too many redirects',
  bad_url: 'Not a web address the check can open',
  blocked_address: 'Points at a private network address',
};

/** Why the last check failed, for the owner. */
export function failureReason(check: Pick<LinkCheck, 'check_status' | 'check_error'>): string {
  if (check.check_error) {
    return ERROR_LABELS[check.check_error as LinkCheckError] ?? 'Could not be checked';
  }
  const status = check.check_status;
  if (status === null) return 'Could not be checked';
  if (status === 404) return 'Page not found (404)';
  if (status === 410) return 'Page removed (410)';
  if (status >= 500) return `Server error (${status})`;
  if (status >= 400) return `Refused (${status})`;
  if (status >= 300) return `Redirect with no destination (${status})`;
  return `Answered ${status}`;
}

/** The most recent check of any link, or null when none has run. */
export const lastChecked = (checks: Pick<LinkCheck, 'checked_at'>[]): string | null =>
  checks.reduce<string | null>(
    (latest, check) => (!latest || check.checked_at > latest ? check.checked_at : latest),
    null,
  );

/**
 * Links the check has not reached for `STALE_AFTER_MS`, judged at `now`. A
 * link never checked counts from when it was added, so a new one has the
 * same grace. Judged per link, not by the newest check, so runs that reach
 * only part of the list still show.
 */
export function overdueLinks<L extends CheckedLink>(
  links: L[],
  checks: Pick<LinkCheck, 'link_id' | 'checked_at'>[],
  now: number,
): L[] {
  const lastFor = new Map(checks.map((check) => [check.link_id, check.checked_at]));
  return links.filter(
    (link) => now - Date.parse(lastFor.get(link.id) ?? link.created_at) > STALE_AFTER_MS,
  );
}

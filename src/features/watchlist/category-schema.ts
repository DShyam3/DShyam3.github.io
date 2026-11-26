/** PostgREST errors during the short rollout before the facts migration lands. */
export function missingCategoryColumns(message: string): boolean {
  return /(?:genre_ids|original_language|origin_country)/.test(message) &&
    /(?:does not exist|could not find)/i.test(message);
}

/**
 * The same, for `last_activity_at` on movies and tv_shows
 * (20261120230000_watchlist_last_activity.sql) before it is applied: the
 * library then reads without it and Discover falls back to row-id order.
 */
export function missingActivityColumn(message: string): boolean {
  return /last_activity_at/.test(message) && /(?:does not exist|could not find)/i.test(message);
}

/** Additional franchise memberships may be absent during a staged rollout. */
export function missingAdditionalFranchisesColumn(message: string): boolean {
  return /additional_franchises/.test(message) && /(?:does not exist|could not find)/i.test(message);
}

/**
 * Query helpers for TrueLayer Data API v1 transaction endpoints.
 *
 * The v1 API accepts calendar dates, not ISO instants. Keeping this outside
 * the request handler makes it hard for one call path to quietly drift back to
 * a timestamp and lets the boundary behaviour be tested without a bank token.
 */
export function formatTrueLayerDate(value: Date): string {
  if (Number.isNaN(value.getTime())) throw new Error('Invalid TrueLayer transaction date')
  return value.toISOString().slice(0, 10)
}

/** Builds the documented, inclusive `from`/`to` range for a v1 request. */
export function buildTrueLayerTransactionQuery(from: Date, to: Date): string {
  const fromDate = formatTrueLayerDate(from)
  const toDate = formatTrueLayerDate(to)
  if (fromDate > toDate) throw new Error('TrueLayer transaction range starts after it ends')
  return new URLSearchParams({ from: fromDate, to: toDate }).toString()
}

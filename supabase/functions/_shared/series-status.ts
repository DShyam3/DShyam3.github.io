/** A manual choice survives repeated TMDB values; a new TMDB value takes over. */
export function syncedSeriesStatus(
  displayed: string | null,
  lastTmdb: string | null,
  incoming: string | null | undefined,
): { status: string | null; tmdbStatus: string | null; changed: boolean } {
  if (!incoming || incoming === lastTmdb) {
    return { status: displayed, tmdbStatus: lastTmdb, changed: false }
  }
  return { status: incoming, tmdbStatus: incoming, changed: true }
}

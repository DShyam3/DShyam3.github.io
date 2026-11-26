import { checkOutboundUrl, type OutboundRefusal, type Resolver } from './public-address.ts'

/**
 * Requests a URL that came from data rather than code, following redirects by
 * hand so that every hop -- the first included -- passes checkOutboundUrl
 * before it is requested. Shared by the functions that fetch an address the
 * owner saved or pasted (`links-check`, `links-metadata`), so there is one
 * redirect loop to get right.
 */

export type PublicFetchError = OutboundRefusal | 'timeout' | 'connection' | 'too_many_redirects'

export type PublicFetchResult =
  | { ok: true; response: Response; url: URL }
  | { ok: false; error: PublicFetchError }

export interface PublicFetchDeps {
  fetch: typeof fetch
  resolve: Resolver
  /** Aborts the whole request, every hop included, when the time is up. */
  signal: AbortSignal
}

export const MAX_REDIRECTS = 5

const REDIRECTS = new Set([301, 302, 303, 307, 308])

/**
 * Sends `url` with `send`, which must request with `redirect: 'manual'` and
 * `deps.signal`. A redirect's body is cancelled before the next hop; the final
 * response comes back with its body unread, for the caller to read or cancel.
 * A redirect whose Location cannot be parsed is the final response.
 */
export async function fetchPublic(
  url: string,
  deps: PublicFetchDeps,
  send: (url: URL) => Promise<Response>,
): Promise<PublicFetchResult> {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const allowed = await checkOutboundUrl(current, deps.resolve, deps.signal)
    if (!allowed.ok) {
      return { ok: false, error: deps.signal.aborted ? 'timeout' : allowed.reason }
    }

    let response: Response
    try {
      response = await send(allowed.url)
    } catch {
      return { ok: false, error: deps.signal.aborted ? 'timeout' : 'connection' }
    }

    const location = response.headers.get('location')
    if (!REDIRECTS.has(response.status) || !location) return { ok: true, response, url: allowed.url }
    let next: string
    try {
      next = new URL(location, allowed.url).href
    } catch {
      return { ok: true, response, url: allowed.url }
    }
    await response.body?.cancel().catch(() => {})
    current = next
  }
  return { ok: false, error: 'too_many_redirects' }
}

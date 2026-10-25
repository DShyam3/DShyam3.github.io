/**
 * The address of whoever sent a request, as far as the edge can tell.
 *
 * Supabase sits behind Cloudflare, which sets `cf-connecting-ip` to the
 * visitor's address and refuses a request that tries to supply it (a probe
 * sending one got a 403 at the edge, 2026-10-25). `x-forwarded-for` is no
 * substitute: its leading entries are whatever the caller sent, and its last
 * entry is a Supabase gateway node -- three probes from one machine within a
 * minute arrived as three different ones. A forwarded hop stays only as a
 * fallback, in case the header is ever absent.
 *
 * Shape-checked either way, so a header that somehow skipped the edge cannot
 * become an arbitrary string. Not an identity: nothing here authenticates.
 */
const ADDRESS_SHAPE = /^[0-9a-fA-F:.]{3,45}$/

/**
 * `fallback` picks the `x-forwarded-for` entry used when `cf-connecting-ip` is
 * missing. 'last' (the rate limiter) is a gateway node but cannot be chosen by
 * the caller; 'first' (TrueLayer's X-PSU-IP, admin-only) is the visitor unless
 * the caller sent the header themselves.
 */
export function clientAddress(req: Request, fallback: 'first' | 'last' = 'last'): string | null {
  const connecting = req.headers.get('cf-connecting-ip')?.trim() ?? ''
  if (ADDRESS_SHAPE.test(connecting)) return connecting
  const hops = (req.headers.get('x-forwarded-for') || '').split(',').map((value) => value.trim()).filter(Boolean)
  const hop = (fallback === 'first' ? hops[0] : hops[hops.length - 1]) ?? ''
  return ADDRESS_SHAPE.test(hop) ? hop : null
}

/**
 * The block an address belongs to, for rate limiting. An IPv4 address is its
 * own block. An IPv6 client is handed a whole /64 and can pick a fresh address
 * in it for every request, so it is limited by the /64: the first four groups.
 */
export function addressBlock(address: string): string {
  if (!address.includes(':')) return address
  // IPv4-mapped (::ffff:203.0.113.7): the client is the embedded IPv4.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address)
  if (mapped) return mapped[1]
  const [head, tail] = address.toLowerCase().split('::')
  const front = head ? head.split(':') : []
  const back = tail === undefined ? [] : tail ? tail.split(':') : []
  const groups = tail === undefined ? front : [...front, ...Array(Math.max(0, 8 - front.length - back.length)).fill('0'), ...back]
  return `${groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, '') || '0').join(':')}::/64`
}

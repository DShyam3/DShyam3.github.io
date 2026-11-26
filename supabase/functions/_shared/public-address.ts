/**
 * Whether a URL may be fetched from inside our infrastructure.
 *
 * Every function that requests a URL it did not write itself -- a stored link,
 * a redirect's Location -- asks this first. The URL must be http or https,
 * carry no credentials, and name a host whose every address is public: an
 * address on a private, loopback, link-local, shared or reserved range would
 * let a stored URL reach something only our network can see (the cloud
 * metadata service at 169.254.169.254 is the classic one).
 *
 * The answer is about the addresses DNS gives now. `fetch` resolves the name
 * again, so a host that changes its answer between the two lookups is not
 * caught here; see SECURITY.md for why that is acceptable where this is used.
 */

export type OutboundRefusal = 'bad_url' | 'blocked_address' | 'dns'

/** All A and AAAA addresses for a host name. Throws when it does not resolve. */
export type Resolver = (hostname: string, signal?: AbortSignal) => Promise<string[]>

export type OutboundCheck = { ok: true; url: URL } | { ok: false; reason: OutboundRefusal }

const parseIPv4 = (text: string): number | null => {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text)
  if (!match) return null
  const octets = match.slice(1).map(Number)
  if (octets.some(octet => octet > 255)) return null
  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0
}

/** Every IPv4 range that is not the public internet (RFC 6890 and friends). */
const IPV4_NOT_PUBLIC: [number, number][] = ([
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, and broadcast
] as const).map(([network, prefix]): [number, number] => [parseIPv4(network)!, prefix])

const isPublicIPv4 = (address: number): boolean =>
  !IPV4_NOT_PUBLIC.some(([network, prefix]) => ((address ^ network) >>> (32 - prefix)) === 0)

/** The eight 16-bit groups of an IPv6 address, or null when it is not one. */
const parseIPv6 = (text: string): number[] | null => {
  let body = text.replace(/^\[|\]$/g, '').replace(/%.*$/, '')
  // A trailing dotted quad (::ffff:1.2.3.4) is the last two groups.
  const dotted = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(body)
  if (dotted) {
    const v4 = parseIPv4(dotted[2])
    if (v4 === null) return null
    body = `${dotted[1]}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`
  }
  const halves = body.split('::')
  if (halves.length > 2) return null
  const groups = (half: string) => (half === '' ? [] : half.split(':'))
  const head = groups(halves[0])
  const tail = halves.length === 2 ? groups(halves[1]) : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null
  const all = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  if (!all.every(group => /^[0-9a-f]{1,4}$/i.test(group))) return null
  return all.map(group => parseInt(group, 16))
}

const embeddedIPv4 = (groups: number[]): number => ((groups[6] << 16) | groups[7]) >>> 0

/**
 * Allowlisted rather than blocklisted: only global unicast (2000::/3) counts,
 * less the parts of it that are not routed to a single host on the internet.
 * Two forms carry an IPv4 address and are judged by it.
 */
const isPublicIPv6 = (groups: number[]): boolean => {
  const zeroUpTo = (end: number) => groups.slice(0, end).every(group => group === 0)
  if (zeroUpTo(5) && groups[5] === 0xffff) return isPublicIPv4(embeddedIPv4(groups)) // ::ffff:a.b.c.d
  if (groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every(g => g === 0)) {
    return isPublicIPv4(embeddedIPv4(groups)) // NAT64, 64:ff9b::a.b.c.d
  }
  if ((groups[0] & 0xe000) !== 0x2000) return false
  if (groups[0] === 0x2001 && (groups[1] & 0xfe00) === 0) return false // 2001::/23, incl. Teredo
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return false // documentation
  if (groups[0] === 0x2002) return false // 6to4
  if (groups[0] === 0x3fff && (groups[1] & 0xf000) === 0) return false // documentation, 3fff::/20
  return true
}

/** Whether an IP address (v4, or v6 with or without brackets) is on the public internet. */
export function isPublicAddress(address: string): boolean {
  const v4 = parseIPv4(address)
  if (v4 !== null) return isPublicIPv4(v4)
  const v6 = parseIPv6(address)
  return v6 !== null && isPublicIPv6(v6)
}

/**
 * Whether `raw` may be fetched: a parsed URL, or why not. `bad_url` is a URL
 * that is not http(s), will not parse, or carries a user name or password;
 * `blocked_address` is a host that is, or resolves to, a non-public address;
 * `dns` is a name that does not resolve.
 */
export async function checkOutboundUrl(
  raw: string,
  resolve: Resolver,
  signal?: AbortSignal,
): Promise<OutboundCheck> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: 'bad_url' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'bad_url' }
  if (url.username || url.password) return { ok: false, reason: 'bad_url' }

  // The URL parser has already normalised the host: lower case, and an IPv4
  // address written in hex, octal or as one number turned into dotted quads.
  const host = url.hostname
  const literal = host.startsWith('[') || parseIPv4(host) !== null
  if (literal) {
    return isPublicAddress(host) ? { ok: true, url } : { ok: false, reason: 'blocked_address' }
  }
  const name = host.replace(/\.$/, '')
  if (!name.includes('.') || name === 'localhost' || name.endsWith('.localhost')) {
    return { ok: false, reason: 'blocked_address' }
  }

  // The host exactly as fetch will see it: a trailing dot makes the name
  // absolute, and dropping it could let a search domain change the answer.
  let addresses: string[]
  try {
    addresses = await resolve(host, signal)
  } catch {
    return { ok: false, reason: 'dns' }
  }
  if (addresses.length === 0) return { ok: false, reason: 'dns' }
  return addresses.every(isPublicAddress) ? { ok: true, url } : { ok: false, reason: 'blocked_address' }
}

/** The runtime's resolver: every A and AAAA record, failing only when neither lookup answers. */
export const resolveWithDns: Resolver = async (hostname, signal) => {
  const [v4, v6] = await Promise.allSettled([
    Deno.resolveDns(hostname, 'A', { signal }),
    Deno.resolveDns(hostname, 'AAAA', { signal }),
  ])
  if (v4.status === 'rejected' && v6.status === 'rejected') throw v4.reason
  return [
    ...(v4.status === 'fulfilled' ? v4.value : []),
    ...(v6.status === 'fulfilled' ? v6.value : []),
  ]
}

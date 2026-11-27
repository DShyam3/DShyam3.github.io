import { fetchPublic, type PublicFetchDeps, type PublicFetchError } from '../_shared/public-fetch.ts'

/**
 * The two reads behind cleaned card images, kept apart from the handler so
 * they run under test with a fake fetch and resolver:
 *
 *   - `readImage`: an image's bytes, so the owner's browser can remove its
 *     background on a canvas. A browser cannot read another site's pixels
 *     unless that site allows it (CORS), and about a quarter of the shops
 *     behind Inventory do not.
 *   - `findPageImages`: the pictures a product page (or a site, for its icon)
 *     says represent it, so a picture that has stopped loading can be
 *     replaced by the same product's current one.
 *
 * Every address here comes from data, so every hop goes through
 * `fetchPublic`'s address rules.
 */

/** Says what it is: fetching one image or page because the owner's card shows it. */
export const USER_AGENT = 'DShyamImageCache/1.0 (+https://dshyam3.github.io/inventory)'

/** Product shots run to a few hundred KB; anything past this is not a card image. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
/** Amazon puts its product image ~340 KB into a 2.5 MB page; most pages need far less. */
export const MAX_PAGE_BYTES = 1024 * 1024
export const MAX_CANDIDATES = 6

export type ImageKind = 'jpeg' | 'png' | 'gif' | 'webp' | 'avif' | 'ico' | 'bmp' | 'svg'

const ascii = (bytes: Uint8Array, start: number, end: number): string =>
  String.fromCharCode(...bytes.subarray(start, Math.min(end, bytes.length)))

const AVIF_BRANDS = new Set(['avif', 'avis', 'mif1', 'msf1'])
const SVG_START = /^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i

/** What the bytes are, read from their start; null when they are no image a browser can draw. */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (ascii(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') return 'png'
  if (ascii(bytes, 0, 4) === 'GIF8') return 'gif'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp'
  if (ascii(bytes, 4, 8) === 'ftyp' && AVIF_BRANDS.has(ascii(bytes, 8, 12))) return 'avif'
  if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return 'ico'
  if (ascii(bytes, 0, 2) === 'BM') return 'bmp'
  // SVG is text: an <svg> root, after at most an XML prolog, comments and an
  // SVG doctype. An HTML page with an inline <svg> in its first kilobyte is
  // not one.
  const start = new TextDecoder().decode(bytes.subarray(0, 1024)).replace(/^\uFEFF/, '').trimStart()
  return SVG_START.test(start) ? 'svg' : null
}

/**
 * The body, up to `max` bytes. `whole` says whether it all fit: an image cut
 * short is useless, a page cut short is still worth reading.
 */
export async function readCapped(response: Response, max: number): Promise<{ bytes: Uint8Array<ArrayBuffer>; whole: boolean }> {
  const reader = response.body?.getReader()
  if (!reader) return { bytes: new Uint8Array(), whole: true }
  const chunks: Uint8Array[] = []
  let total = 0
  let whole = true
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (total + value.length > max) {
        chunks.push(value.subarray(0, max - total))
        total = max
        whole = false
        break
      }
      chunks.push(value)
      total += value.length
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return { bytes, whole }
}

export type ImageError = PublicFetchError | 'http_error' | 'not_image' | 'too_large'
export type ImageRead = { ok: true; bytes: Uint8Array<ArrayBuffer>; kind: ImageKind } | { ok: false; reason: ImageError }

/** Fetches `url` (every hop through the address rules) and returns it only if it is an image. */
export async function readImage(url: string, deps: PublicFetchDeps): Promise<ImageRead> {
  const result = await fetchPublic(url, deps, (target) =>
    deps.fetch(target, {
      method: 'GET',
      redirect: 'manual',
      signal: deps.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.2',
      },
    }),
  )
  if (!result.ok) return { ok: false, reason: result.error }
  const { response } = result
  if (response.status < 200 || response.status >= 300) {
    await response.body?.cancel().catch(() => {})
    return { ok: false, reason: 'http_error' }
  }
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
    await response.body?.cancel().catch(() => {})
    return { ok: false, reason: 'too_large' }
  }
  let body: { bytes: Uint8Array<ArrayBuffer>; whole: boolean }
  try {
    body = await readCapped(response, MAX_IMAGE_BYTES)
  } catch {
    return { ok: false, reason: deps.signal.aborted ? 'timeout' : 'connection' }
  }
  if (!body.whole) return { ok: false, reason: 'too_large' }
  const kind = sniffImage(body.bytes)
  return kind ? { ok: true, bytes: body.bytes, kind } : { ok: false, reason: 'not_image' }
}

export type PageError = PublicFetchError | 'http_error' | 'not_html' | 'challenged'
export type Want = 'product' | 'icon'
export type PageImages = { ok: true; images: string[] } | { ok: false; reason: PageError }

const HTML_TYPES = new Set(['text/html', 'application/xhtml+xml'])

/** Fetches a page and lists the images it names for `want`, best first. */
export async function findPageImages(url: string, want: Want, deps: PublicFetchDeps): Promise<PageImages> {
  const result = await fetchPublic(url, deps, (target) =>
    deps.fetch(target, {
      method: 'GET',
      redirect: 'manual',
      signal: deps.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        'Accept-Language': 'en-GB,en;q=0.8',
      },
    }),
  )
  if (!result.ok) return { ok: false, reason: result.error }
  const { response } = result
  const refuse = async (reason: PageError): Promise<PageImages> => {
    await response.body?.cancel().catch(() => {})
    return { ok: false, reason }
  }
  if (response.headers.get('cf-mitigated') === 'challenge') return refuse('challenged')
  if (response.status < 200 || response.status >= 300) return refuse('http_error')
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
  if (type && !HTML_TYPES.has(type)) return refuse('not_html')

  let html: string
  try {
    html = new TextDecoder().decode((await readCapped(response, MAX_PAGE_BYTES)).bytes)
  } catch {
    return { ok: false, reason: deps.signal.aborted ? 'timeout' : 'connection' }
  }
  const images = want === 'icon' ? iconImages(html, result.url) : productImages(html, result.url)
  return { ok: true, images }
}

const ATTRIBUTE = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
/** Longest tag whose attributes are read. */
const MAX_TAG = 4_096

/** Every <meta> or <link> tag's attributes, in page order. */
function tags(html: string, name: 'meta' | 'link'): Map<string, string>[] {
  const out: Map<string, string>[] = []
  const opener = new RegExp(`<${name}\\b([^>]{0,${MAX_TAG}})>`, 'gi')
  for (const match of html.matchAll(opener)) {
    const attributes = new Map<string, string>()
    for (const attr of match[1].matchAll(ATTRIBUTE)) {
      const key = attr[1].toLowerCase()
      if (!attributes.has(key)) attributes.set(key, attr[2] ?? attr[3] ?? attr[4] ?? '')
    }
    out.push(attributes)
  }
  return out
}

/** The entities a URL in an attribute or JSON string actually uses. */
function unescapeUrl(value: string): string {
  return value
    .replace(/\\\//g, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/&amp;/gi, '&')
    .replace(/&#x2f;|&#47;/gi, '/')
    .replace(/&quot;/gi, '"')
    .trim()
}

/** Absolute http(s) URLs, resolved against the page, without repeats, at most MAX_CANDIDATES. */
function absolute(values: string[], base: URL): string[] {
  const out: string[] = []
  for (const value of values) {
    if (!value || value.startsWith('data:')) continue
    let url: URL
    try {
      url = new URL(unescapeUrl(value), base)
    } catch {
      continue
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue
    if (!out.includes(url.href)) out.push(url.href)
    if (out.length === MAX_CANDIDATES) break
  }
  return out
}

/** Image URLs a JSON-LD `image` value holds: a string, an ImageObject, or a list of either. */
function ldImages(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(ldImages)
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>
    const url = object.url ?? object.contentUrl
    return typeof url === 'string' ? [url] : []
  }
  return []
}

/** Images of every Product in a JSON-LD document, however deeply @graph or offers nest it. */
function productLd(node: unknown, depth = 0): string[] {
  if (depth > 6 || !node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap((item) => productLd(item, depth + 1))
  const object = node as Record<string, unknown>
  const types = ([] as unknown[]).concat(object['@type'] ?? [])
  const own = types.some((t) => t === 'Product' || t === 'ProductGroup') ? ldImages(object.image) : []
  const nested = Object.entries(object)
    .filter(([key]) => key !== 'image')
    .flatMap(([, value]) => productLd(value, depth + 1))
  return [...own, ...nested]
}

const LD_SCRIPT = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi

/**
 * A product page's own picture of the product, best first: its JSON-LD
 * Product image, Amazon's high-resolution landing image, then the page's
 * share image (og:image, twitter:image, image_src).
 */
export function productImages(html: string, base: URL): string[] {
  const found: string[] = []
  for (const match of html.matchAll(LD_SCRIPT)) {
    try {
      found.push(...productLd(JSON.parse(match[1])))
    } catch {
      // A malformed block says nothing.
    }
  }
  const hiRes = html.match(/"hiRes"\s*:\s*"(https?:[^"]+)"/)?.[1]
  if (hiRes) found.push(hiRes)
  const oldHires = html.match(/data-old-hires\s*=\s*"([^"]+)"/)?.[1]
  if (oldHires) found.push(oldHires)

  const meta = new Map<string, string>()
  for (const attributes of tags(html, 'meta')) {
    const key = (attributes.get('property') ?? attributes.get('name'))?.trim().toLowerCase()
    const content = attributes.get('content')
    if (key && content && !meta.has(key)) meta.set(key, content)
  }
  for (const key of ['og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']) {
    const value = meta.get(key)
    if (value) found.push(value)
  }
  for (const attributes of tags(html, 'link')) {
    if (attributes.get('rel')?.toLowerCase().split(/\s+/).includes('image_src')) found.push(attributes.get('href') ?? '')
  }
  return absolute(found, base)
}

/** How large an icon <link> says it is: its largest `sizes`, any SVG counted as large. */
function iconSize(attributes: Map<string, string>, apple: boolean): number {
  const href = attributes.get('href') ?? ''
  if (attributes.get('type')?.toLowerCase() === 'image/svg+xml' || /\.svg(\?|#|$)/i.test(href)) return 1024
  const sizes = attributes.get('sizes')?.toLowerCase() ?? ''
  if (sizes.includes('any')) return 1024
  let largest = 0
  for (const match of sizes.matchAll(/(\d+)x(\d+)/g)) largest = Math.max(largest, Number(match[1]), Number(match[2]))
  // Apple's icon is 180px unless it says otherwise; a bare rel=icon is usually a 16px favicon.
  return largest || (apple ? 180 : 16)
}

/** A site's own icon, largest first, then Apple's conventional address for one. */
export function iconImages(html: string, base: URL): string[] {
  const icons: { href: string; size: number }[] = []
  for (const attributes of tags(html, 'link')) {
    const rel = attributes.get('rel')?.toLowerCase().split(/\s+/) ?? []
    const href = attributes.get('href')
    if (!href) continue
    const apple = rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed')
    if (!apple && !rel.includes('icon')) continue
    icons.push({ href, size: iconSize(attributes, apple) })
  }
  icons.sort((a, b) => b.size - a.size)
  return absolute([...icons.map((icon) => icon.href), '/apple-touch-icon.png'], base)
}

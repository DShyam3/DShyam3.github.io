import { fetchPublic, type PublicFetchDeps, type PublicFetchError } from '../_shared/public-fetch.ts'

/**
 * What a pasted link's page says about itself -- a name and a description --
 * read from its <head>, so the Links add form can fill them in. Only those two
 * strings leave this module; the page itself is never stored or passed on.
 * Kept apart from the handler so it runs under test with a fake fetch and
 * resolver.
 */

/** Says what it is: reading one page because the owner pasted its address. */
export const USER_AGENT = 'DShyamLinkPreview/1.0 (+https://dshyam3.github.io/links)'

export type MetadataError = PublicFetchError | 'http_error' | 'not_html' | 'challenged'

export type LinkMetadata =
  | { ok: true; name: string | null; description: string | null }
  | { ok: false; reason: MetadataError }

/** Most heads end well inside this. A page that never closes its head is read this far and no further. */
export const MAX_HEAD_BYTES = 512 * 1024
export const MAX_NAME = 80
export const MAX_DESCRIPTION = 280

const HTML_TYPES = new Set(['text/html', 'application/xhtml+xml'])

/** Apple titles an app's page "Things 3 App - App Store"; the app is "Things 3". */
const APP_STORE_HOSTS = new Set(['apps.apple.com'])

/** Fetches `url` (every hop through the address rules) and reads its name and description. */
export async function readLinkMetadata(url: string, deps: PublicFetchDeps): Promise<LinkMetadata> {
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

  const refuse = async (reason: MetadataError): Promise<LinkMetadata> => {
    await response.body?.cancel().catch(() => {})
    return { ok: false, reason }
  }
  if (response.headers.get('cf-mitigated') === 'challenge') return refuse('challenged')
  if (response.status < 200 || response.status >= 300) return refuse('http_error')
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
  if (type && !HTML_TYPES.has(type)) return refuse('not_html')

  let html: string
  try {
    html = await readHead(response)
  } catch {
    return { ok: false, reason: deps.signal.aborted ? 'timeout' : 'connection' }
  }
  return { ok: true, ...parseMetadata(html, new URL(url), result.url) }
}

/**
 * The page's text up to the end of its <head>, or the first `maxBytes`,
 * decoded in the charset the response or the page declares. Stops downloading
 * as soon as the head has closed.
 */
export async function readHead(response: Response, maxBytes = MAX_HEAD_BYTES): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let total = 0
  // windows-1252 maps every byte to one character, so an ASCII tag is found
  // whatever the page's real charset.
  const scan = new TextDecoder('windows-1252')
  let carry = ''
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = value.subarray(0, maxBytes - total)
      chunks.push(chunk)
      total += chunk.length
      const text = carry + scan.decode(chunk)
      if (/<\/head\s*>|<body[\s>]/i.test(text)) break
      carry = text.slice(-8)
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
  return decode(bytes, charsetOf(response.headers.get('content-type'), bytes))
}

function charsetOf(contentType: string | null, bytes: Uint8Array): string {
  const declared = contentType?.match(/charset\s*=\s*["']?([\w.:-]+)/i)?.[1]
  if (declared) return declared
  const start = new TextDecoder('windows-1252').decode(bytes.subarray(0, 1024))
  return start.match(/<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i)?.[1] ?? 'utf-8'
}

function decode(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes)
  } catch {
    // A charset the runtime does not know.
    return new TextDecoder().decode(bytes)
  }
}

/**
 * The name and description a page declares. `pasted` is the URL the owner
 * gave and `final` where its redirects ended.
 *
 * The name is the site's own name (`og:site_name`, `application-name`) for a
 * home page -- "GitHub", not GitHub's tagline. For any other page it is the
 * page title with the site's name taken off and cut at the first separator:
 * "ghostty-org/ghostty" from "GitHub - ghostty-org/ghostty: Ghostty is...".
 */
export function parseMetadata(
  html: string,
  pasted: URL,
  final: URL = pasted,
): { name: string | null; description: string | null } {
  const { title: titleTag, meta } = scanHead(html)

  const siteName = firstText(meta.get('og:site_name'), meta.get('application-name'), meta.get('apple-mobile-web-app-title'))
  const title = firstText(meta.get('og:title'), meta.get('twitter:title'), titleTag)
  const description = firstText(meta.get('og:description'), meta.get('description'), meta.get('twitter:description'))

  const isHome = isRoot(pasted) || isRoot(final)
  return {
    name: nameFor(siteName, title, isHome, final.hostname),
    description: description === null ? null : truncate(description, MAX_DESCRIPTION),
  }
}

const isRoot = (url: URL) => url.pathname === '/' || url.pathname === ''

function nameFor(siteName: string | null, title: string | null, isHome: boolean, hostname: string): string | null {
  if (isHome && siteName) return truncate(siteName, MAX_NAME)
  if (!title) return siteName === null ? null : truncate(siteName, MAX_NAME)

  const rest = siteName ? withoutSiteName(title, siteName) : title
  const first = rest.split(SEPARATOR).map((part) => part.trim()).find(Boolean)
  // "Home - BBC News" names the page, not the site.
  let name = (first && !GENERIC_PAGE_NAMES.has(first.toLowerCase()) ? first : siteName) ?? first ?? title
  if (APP_STORE_HOSTS.has(hostname)) name = name.replace(/\s+App$/, '')
  return truncate(name, MAX_NAME)
}

/** Page titles that say which page, not what the site is. */
const GENERIC_PAGE_NAMES = new Set(['home', 'homepage', 'home page', 'welcome', 'index'])

/** " | ", " - ", " – ", " — ", " · ", " • " and ": ". A hyphen inside a word ("Wi-Fi") is not one. */
const SEPARATOR = /\s+[|\-–—·•]\s+|\s*:\s+/
/** The same, as the text cleanText leaves them: one space either side. */
const SEPARATORS = [' | ', ' - ', ' – ', ' — ', ' · ', ' • ', ': ']
const SUFFIX_JOINS = [...SEPARATORS, ' on the ', ' on ']

/**
 * Takes the site's name off either end of a title: "GitHub - repo",
 * "Docs | Notion", "Pixelmator Pro on the Mac App Store". Plain string
 * comparison, a few rounds at most -- the title and site name are page text.
 */
function withoutSiteName(title: string, siteName: string): string {
  if (siteName.length > 100) return title
  const site = siteName.toLowerCase()
  const startsWithSite = (text: string) => text.slice(0, siteName.length).toLowerCase() === site
  const endsWithSite = (text: string) => text.slice(text.length - siteName.length).toLowerCase() === site
  let current = title
  for (let round = 0; round < 3; round++) {
    let next = current
    if (startsWithSite(next)) {
      const sep = SEPARATORS.find((candidate) => next.startsWith(candidate, siteName.length))
      if (sep) next = next.slice(siteName.length + sep.length)
    }
    if (endsWithSite(next)) {
      const before = next.slice(0, next.length - siteName.length)
      const join = SUFFIX_JOINS.find((candidate) => before.toLowerCase().endsWith(candidate))
      if (join) next = before.slice(0, before.length - join.length)
    }
    next = next.trim()
    if (next === current || !next) return current
    current = next
  }
  return current
}

/** Longest title or meta value read; the name and description are cut far shorter. */
const MAX_VALUE = 1_000
/** Longest <meta> tag whose attributes are read. */
const MAX_TAG = 4_096

const OPENER = /<!--|<script\b|<style\b|<title\b|<meta\b|<\/head\s*>|<body[\s>]/gi
const CLOSERS: Record<string, RegExp> = { script: /<\/script/gi, style: /<\/style/gi, title: /<\/title/gi }

/**
 * The <title> and the <meta> tags of the head, in one forward pass: each
 * construct is found, read and stepped over, so no part of the page is
 * scanned twice. Comments, scripts and styles are skipped whole, so nothing
 * inside them is read as a tag. The pass stops at the end of the head, at
 * <body>, or at the first construct that never closes, since a browser would
 * read the rest of the page as inside it.
 */
function scanHead(html: string): { title: string | undefined; meta: Map<string, string> } {
  const meta = new Map<string, string>()
  let title: string | undefined
  const opener = new RegExp(OPENER.source, OPENER.flags)
  for (let match = opener.exec(html); match; match = opener.exec(html)) {
    const token = match[0].toLowerCase()
    const after = opener.lastIndex
    let next: number
    if (token.startsWith('</head') || token.startsWith('<body')) {
      break
    } else if (token === '<!--') {
      const close = html.indexOf('-->', after)
      if (close === -1) break
      next = close + 3
    } else if (token === '<meta') {
      const close = tagEnd(html, after)
      if (close === -1) break
      if (close - after <= MAX_TAG) {
        const attributes = attributesOf(html.slice(after, close))
        const key = (attributes.get('property') ?? attributes.get('name') ?? attributes.get('itemprop'))
          ?.trim()
          .toLowerCase()
        const content = attributes.get('content')
        if (key && content !== undefined && !meta.has(key)) meta.set(key, content.slice(0, MAX_VALUE))
      }
      next = close + 1
    } else {
      // <script>, <style> or <title>: read to the closing tag.
      const name = token.slice(1)
      const open = html.indexOf('>', after)
      if (open === -1) break
      const closer = CLOSERS[name]
      closer.lastIndex = open + 1
      const close = closer.exec(html)?.index ?? -1
      if (close === -1) break
      if (name === 'title' && title === undefined) title = html.slice(open + 1, Math.min(close, open + 1 + MAX_VALUE))
      const end = html.indexOf('>', close)
      if (end === -1) break
      next = end + 1
    }
    opener.lastIndex = next
  }
  return { title, meta }
}

/** The `>` that ends the tag whose attributes start at `from`, skipping any inside quotes; -1 when it never closes. */
function tagEnd(html: string, from: number): number {
  let quote = ''
  for (let i = from; i < html.length; i++) {
    const char = html[i]
    if (quote) {
      if (char === quote) quote = ''
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '>') {
      return i
    }
  }
  return -1
}

const ATTRIBUTE = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

function attributesOf(source: string): Map<string, string> {
  const attributes = new Map<string, string>()
  for (const match of source.matchAll(ATTRIBUTE)) {
    const name = match[1].toLowerCase()
    if (!attributes.has(name)) attributes.set(name, match[2] ?? match[3] ?? match[4] ?? '')
  }
  return attributes
}

/** The first value that still has text once cleaned. */
function firstText(...values: (string | undefined)[]): string | null {
  for (const value of values) {
    const text = value === undefined ? '' : cleanText(value)
    if (text) return text
  }
  return null
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', middot: '·', bull: '•',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  copy: '©', reg: '®', trade: '™',
}

/**
 * Entities decoded; direction marks, zero-width spaces and other invisible
 * characters dropped (the zero-width joiner stays: emoji need it); whitespace
 * collapsed.
 */
export function cleanText(value: string): string {
  return value
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
      if (body[0] !== '#') return NAMED_ENTITIES[body.toLowerCase()] ?? whole
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      const valid = code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
      return valid ? String.fromCodePoint(code) : whole
    })
    .replace(/[\u00ad\u200b\u200e\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g, '')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** At most `max` characters, cut at a word where there is one, marked with an ellipsis. */
export function truncate(text: string, max: number): string {
  const characters = Array.from(text)
  if (characters.length <= max) return text
  const cut = characters.slice(0, max - 1).join('')
  const space = cut.lastIndexOf(' ')
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}

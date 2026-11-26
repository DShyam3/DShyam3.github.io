import type { Resolver } from '../_shared/public-address.ts'
import { assertEquals, assertJsonEquals } from '../_shared/test-assert.ts'
import { cleanText, MAX_DESCRIPTION, MAX_HEAD_BYTES, parseMetadata, readHead, readLinkMetadata, truncate, USER_AGENT } from './metadata.ts'

const publicResolver: Resolver = (hostname) =>
  hostname === 'internal.example' ? Promise.resolve(['10.0.0.8']) : Promise.resolve(['93.184.215.14'])

/** A fetch that answers from `routes` by URL, recording what was asked. */
function fakeFetch(routes: Record<string, () => Response>) {
  const seen: { url: string; redirect?: string; agent: string | null }[] = []
  const impl = ((input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input)
    seen.push({ url, redirect: init?.redirect, agent: new Headers(init?.headers).get('User-Agent') })
    const route = routes[url]
    return route ? Promise.resolve(route()) : Promise.reject(new TypeError('connection refused'))
  }) as typeof fetch
  return { impl, seen }
}

const page = (html: string, headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8' }) =>
  () => new Response(html, { status: 200, headers })
const read = (url: string, fetchImpl: typeof fetch) =>
  readLinkMetadata(url, { fetch: fetchImpl, resolve: publicResolver, signal: new AbortController().signal })
const parse = (head: string, url = 'https://site.example/') =>
  parseMetadata(`<html><head>${head}</head><body><title>Not this</title></body></html>`, new URL(url))

Deno.test('a home page is named after the site, not its tagline', () => {
  // GitHub's own home page, trimmed.
  assertJsonEquals(
    parse(`<title>GitHub · Change is constant. GitHub keeps you ahead. · GitHub · GitHub</title>
      <meta property="og:site_name" content="GitHub">
      <meta property="og:description" content="Join the world&#39;s most widely adopted developer platform.">`),
    { name: 'GitHub', description: "Join the world's most widely adopted developer platform." },
  )
  // Linear names itself through application-name.
  assertEquals(parse('<title>Linear – The system for product development</title><meta name="application-name" content="Linear">').name, 'Linear')
})

Deno.test('with no site name, the title is cut at its first separator', () => {
  assertEquals(parse('<title>Visual Studio Code - Build what comes next</title>').name, 'Visual Studio Code')
  assertEquals(parse('<meta property="og:title" content="Figma: The collaborative canvas">').name, 'Figma')
  // og:title wins over <title>: this site's tab title differs from its own name for itself.
  assertEquals(
    parse('<title>The Life Calendar</title><meta property="og:title" content="Life Calendar - Visualize your life in weeks">').name,
    'Life Calendar',
  )
  // A hyphen inside a word is not a separator.
  assertEquals(parse('<title>Wi-Fi Explorer</title>').name, 'Wi-Fi Explorer')
})

Deno.test('a page deeper in a site is named from its title, without the site name', () => {
  assertEquals(
    parse(
      `<meta property="og:site_name" content="GitHub">
       <meta property="og:title" content="GitHub - ghostty-org/ghostty: 👻 Ghostty is a fast terminal emulator">`,
      'https://github.com/ghostty-org/ghostty',
    ).name,
    'ghostty-org/ghostty',
  )
  assertEquals(
    parse('<meta property="og:site_name" content="Notion"><title>Docs | Notion</title>', 'https://notion.so/docs').name,
    'Docs',
  )
  assertEquals(
    parse('<meta property="og:site_name" content="Ghostty"><title>Ghostty</title>', 'https://ghostty.org/docs').name,
    'Ghostty',
  )
  // A generic page title gives way to the site name.
  assertEquals(
    parse('<meta property="og:site_name" content="BBC News"><title>Home - BBC News</title>', 'https://www.bbc.co.uk/news').name,
    'BBC News',
  )
})

Deno.test("an App Store page is named after the app", () => {
  assertEquals(
    parse(
      `<title>\u200eThings 3 App - App Store</title><meta property="og:site_name" content="App Store">`,
      'https://apps.apple.com/gb/app/things-3/id904237743',
    ).name,
    'Things 3',
  )
  assertEquals(
    parse('<title>Pixelmator Pro on the Mac App Store</title><meta property="og:site_name" content="Mac App Store">', 'https://apps.apple.com/gb/app/x/id1').name,
    'Pixelmator Pro',
  )
})

Deno.test('the description prefers og:description, then description, and is capped', () => {
  assertEquals(parse('<meta name="description" content="Plain."><meta property="og:description" content="Open Graph.">').description, 'Open Graph.')
  assertEquals(parse('<meta name="description" content="  Plain,\n\n  spaced.  ">').description, 'Plain, spaced.')
  assertEquals(parse('<meta property="og:description" content="">  <meta name="description" content="Fallback">').description, 'Fallback')
  const long = parse(`<meta name="description" content="${'word '.repeat(100)}">`).description!
  assertEquals(Array.from(long).length <= MAX_DESCRIPTION, true)
  assertEquals(long.endsWith('word…'), true)
  assertJsonEquals(parse('<title></title>'), { name: null, description: null })
})

Deno.test('tags inside scripts, styles and comments are not read, nor anything after the head', () => {
  assertJsonEquals(
    parse(`<script>document.write('<meta name="description" content="from script">')</script>
      <style>/* <title>styled</title> */</style>
      <!-- <meta property="og:site_name" content="Commented"> -->
      <meta content='Single "quoted"' name=description>`),
    { name: null, description: 'Single "quoted"' },
  )
})

Deno.test('cleanText decodes entities and drops invisible characters, keeping emoji joins', () => {
  assertEquals(cleanText('Tom &amp; Jerry &mdash; &#x2019;&#8217; &unknown; &#0;'), 'Tom & Jerry — ’’ &unknown; &#0;')
  assertEquals(cleanText('\u200e\ufeffThings\u00a0 3\u200b'), 'Things 3')
  assertEquals(cleanText('👨\u200d💻 Dev'), '👨\u200d💻 Dev')
})

Deno.test('truncate cuts at a word and never splits a character', () => {
  assertEquals(truncate('short', 10), 'short')
  assertEquals(truncate('one two three four', 12), 'one two…')
  assertEquals(truncate('😀'.repeat(5), 3), '😀😀…')
})

Deno.test('readHead stops at the end of the head and decodes the declared charset', async () => {
  let pulled = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled++
      controller.enqueue(new TextEncoder().encode(pulled === 1 ? '<head><title>A</title></he' : 'ad><body>' + 'x'.repeat(1000)))
      if (pulled > 50) controller.close()
    },
  })
  const text = await readHead(new Response(stream, { headers: { 'content-type': 'text/html' } }))
  assertEquals(pulled, 2)
  assertEquals(text.startsWith('<head><title>A</title></head>'), true)

  // windows-1252 declared in the page itself: 0xE9 is é.
  const latin = new Uint8Array([...new TextEncoder().encode('<meta charset="windows-1252"><title>Caf'), 0xe9, ...new TextEncoder().encode('</title></head>')])
  assertEquals(parseMetadata(await readHead(new Response(latin)), new URL('https://site.example/x')).name, 'Café')

  // A head that never closes is read only as far as the cap.
  const endless = new ReadableStream<Uint8Array>({ pull: (c) => c.enqueue(new Uint8Array(4096).fill(0x61)) })
  assertEquals((await readHead(new Response(endless), 10_000)).length, 10_000)
})

Deno.test('readLinkMetadata follows a redirect and reads the page it ends on', async () => {
  const { impl, seen } = fakeFetch({
    'https://site.example/': () => new Response(null, { status: 301, headers: { location: 'https://www.site.example/uk/' } }),
    'https://www.site.example/uk/': page('<head><meta property="og:site_name" content="Site"><title>Site | Welcome</title></head>'),
  })
  // Pasted as the home page, so the site name, though it ended on /uk/.
  assertJsonEquals(await read('https://site.example/', impl), { ok: true, name: 'Site', description: null })
  assertJsonEquals(seen.map((s) => [s.redirect, s.agent]), [['manual', USER_AGENT], ['manual', USER_AGENT]])
})

Deno.test('readLinkMetadata refuses what it should not read', async () => {
  const { impl } = fakeFetch({
    'https://site.example/missing': () => new Response('gone', { status: 404, headers: { 'content-type': 'text/html' } }),
    'https://site.example/file.pdf': () => new Response('%PDF', { headers: { 'content-type': 'application/pdf' } }),
    'https://site.example/shield': () => new Response('', { status: 403, headers: { 'cf-mitigated': 'challenge' } }),
    'https://site.example/to-internal': () => new Response(null, { status: 302, headers: { location: 'https://internal.example/' } }),
  })
  assertJsonEquals(await read('https://site.example/missing', impl), { ok: false, reason: 'http_error' })
  assertJsonEquals(await read('https://site.example/file.pdf', impl), { ok: false, reason: 'not_html' })
  assertJsonEquals(await read('https://site.example/shield', impl), { ok: false, reason: 'challenged' })
  assertJsonEquals(await read('https://site.example/to-internal', impl), { ok: false, reason: 'blocked_address' })
  assertJsonEquals(await read('http://127.0.0.1/', impl), { ok: false, reason: 'blocked_address' })
  assertJsonEquals(await read('file:///etc/passwd', impl), { ok: false, reason: 'bad_url' })
  assertJsonEquals(await read('https://site.example/offline', impl), { ok: false, reason: 'connection' })
})

Deno.test('a hostile page cannot make the parse slow', () => {
  const big = (unit: string) => unit.repeat(Math.ceil(MAX_HEAD_BYTES / unit.length)).slice(0, MAX_HEAD_BYTES)
  const pages = [
    big('<!--'),
    big('<script'),
    big('<style>'),
    '<title>' + big('x'),
    big('<meta '),
    big('<meta content="'),
    big('<meta a="1" '),
    big('&amp'),
    `<meta property="og:site_name" content="x"><title>${big('x - ')}</title>`,
    `<meta property="og:site_name" content="${big('y')}"><title>${big('y | ')}</title>`,
  ]
  for (const html of pages) {
    const started = performance.now()
    parseMetadata(html, new URL('https://site.example/page'))
    const took = performance.now() - started
    if (took > 250) throw new Error(`took ${Math.round(took)} ms on ${html.slice(0, 20)}...`)
  }
})

Deno.test('a very long site name or title is cut, not compiled into anything', () => {
  const site = 'S'.repeat(70_000)
  const parsed = parseMetadata(`<meta property="og:site_name" content="${site}"><title>${site} - Page</title>`, new URL('https://site.example/page'))
  assertEquals(Array.from(parsed.name ?? '').length <= 80, true)
})

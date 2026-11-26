import type { Resolver } from '../_shared/public-address.ts'
import { assertEquals, assertJsonEquals } from '../_shared/test-assert.ts'
import { checkLink, isWorking, MAX_REDIRECTS, nextCheckRow, USER_AGENT, type LinkCheck } from './check.ts'

const PUBLIC = ['93.184.215.14']
const publicResolver: Resolver = (hostname) =>
  hostname === 'gone.example' ? Promise.reject(new Error('NXDOMAIN')) : Promise.resolve(PUBLIC)

interface Seen { method: string; url: string; redirect: string | undefined; agent: string | null }

/** A fetch that answers from `routes` ("METHOD url" or "url"), recording each request. */
function fakeFetch(routes: Record<string, () => Response | Promise<Response>>) {
  const seen: Seen[] = []
  const impl = ((input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    seen.push({ method, url, redirect: init?.redirect, agent: new Headers(init?.headers).get('User-Agent') })
    const route = routes[`${method} ${url}`] ?? routes[url]
    if (!route) return Promise.reject(new TypeError('connection refused'))
    return Promise.resolve(route())
  }) as typeof fetch
  return { impl, seen }
}

const status = (code: number, headers: Record<string, string> = {}) => () => new Response(null, { status: code, headers })
const run = (url: string, fetchImpl: typeof fetch, resolve: Resolver = publicResolver, signal = new AbortController().signal) =>
  checkLink(url, { fetch: fetchImpl, resolve, signal })

Deno.test('a page that answers HEAD with 200 works, and no GET is sent', async () => {
  const { impl, seen } = fakeFetch({ 'HEAD https://site.example/': status(200) })
  assertJsonEquals(await run('https://site.example/', impl), { status: 200, error: null })
  assertJsonEquals(seen.map(s => [s.method, s.redirect, s.agent]), [['HEAD', 'manual', USER_AGENT]])
})

Deno.test('an error on HEAD is retried with GET, which decides', async () => {
  const { impl, seen } = fakeFetch({
    'HEAD https://site.example/': status(405),
    'GET https://site.example/': status(200),
  })
  assertJsonEquals(await run('https://site.example/', impl), { status: 200, error: null })
  assertJsonEquals(seen.map(s => s.method), ['HEAD', 'GET'])

  const gone = fakeFetch({ 'https://site.example/old': status(404) })
  assertJsonEquals(await run('https://site.example/old', gone.impl), { status: 404, error: null })
})

Deno.test('redirects are followed, relative ones included, to the final status', async () => {
  const { impl, seen } = fakeFetch({
    'https://a.example/': status(301, { location: 'https://b.example/start' }),
    'https://b.example/start': status(302, { location: '/end' }),
    'https://b.example/end': status(200),
  })
  assertJsonEquals(await run('https://a.example/', impl), { status: 200, error: null })
  assertJsonEquals(seen.map(s => s.url), ['https://a.example/', 'https://b.example/start', 'https://b.example/end'])
})

Deno.test('a redirect to a private address is refused before it is requested', async () => {
  const { impl, seen } = fakeFetch({
    'https://a.example/': status(302, { location: 'http://169.254.169.254/latest/meta-data/' }),
  })
  assertJsonEquals(await run('https://a.example/', impl), { status: null, error: 'blocked_address' })
  assertEquals(seen.some(s => s.url.includes('169.254')), false)
})

Deno.test('a redirect to another scheme is a bad URL', async () => {
  const { impl } = fakeFetch({ 'https://a.example/': status(302, { location: 'file:///etc/passwd' }) })
  assertJsonEquals(await run('https://a.example/', impl), { status: null, error: 'bad_url' })
})

Deno.test('a redirect loop gives up after the limit', async () => {
  const { impl, seen } = fakeFetch({ 'https://loop.example/': status(302, { location: 'https://loop.example/' }) })
  assertJsonEquals(await run('https://loop.example/', impl), { status: null, error: 'too_many_redirects' })
  assertEquals(seen.length, MAX_REDIRECTS + 1)
})

Deno.test('a redirect with no Location is the final answer', async () => {
  const { impl } = fakeFetch({ 'https://a.example/': status(302) })
  assertJsonEquals(await run('https://a.example/', impl), { status: 302, error: null })
})

Deno.test('a name that does not resolve is a DNS failure, and nothing is fetched', async () => {
  const { impl, seen } = fakeFetch({})
  assertJsonEquals(await run('https://gone.example/', impl), { status: null, error: 'dns' })
  assertEquals(seen.length, 0)
})

Deno.test('a refused connection is a connection failure', async () => {
  const { impl } = fakeFetch({})
  assertJsonEquals(await run('https://down.example/', impl), { status: null, error: 'connection' })
})

Deno.test('running out of time is a timeout, whether fetching or resolving', async () => {
  const timedOut = AbortSignal.abort(new DOMException('timed out', 'TimeoutError'))
  const hang = fakeFetch({ 'https://slow.example/': () => Promise.reject(new DOMException('aborted', 'AbortError')) })
  assertJsonEquals(await run('https://slow.example/', hang.impl, publicResolver, timedOut), { status: null, error: 'timeout' })
  const slowDns: Resolver = () => Promise.reject(new DOMException('aborted', 'AbortError'))
  assertJsonEquals(await run('https://slow.example/', hang.impl, slowDns, timedOut), { status: null, error: 'timeout' })
})

Deno.test('2xx works; a robot refusal still counts as working; other statuses and errors do not', () => {
  const check = (s: number | null, error: LinkCheck['error'] = null): LinkCheck => ({ status: s, error })
  for (const s of [200, 204, 401, 403, 429]) assertEquals(isWorking(check(s)), true)
  for (const s of [301, 400, 404, 410, 500, 503]) assertEquals(isWorking(check(s)), false)
  assertEquals(isWorking(check(null, 'timeout')), false)
})

Deno.test('a Cloudflare challenge counts as working, whatever its status', async () => {
  const { impl } = fakeFetch({ 'https://shielded.example/': status(503, { 'cf-mitigated': 'challenge' }) })
  const check = await run('https://shielded.example/', impl)
  assertJsonEquals(check, { status: 503, error: null, challenged: true })
  assertEquals(isWorking(check), true)
})

Deno.test('a failure extends the streak and keeps its start; a success clears it', () => {
  const url = 'https://site.example/'
  const first = nextCheckRow(null, url, { status: 404, error: null }, '2026-11-25T04:40:00Z')
  assertJsonEquals(first, {
    url, checked_at: '2026-11-25T04:40:00Z', check_status: 404, check_error: null,
    check_failures: 1, failing_since: '2026-11-25T04:40:00Z',
  })
  const second = nextCheckRow(first, url, { status: null, error: 'timeout' }, '2026-11-26T04:40:00Z')
  assertEquals(second.check_failures, 2)
  assertEquals(second.failing_since, '2026-11-25T04:40:00Z')
  assertEquals(second.check_error, 'timeout')

  const recovered = nextCheckRow(second, url, { status: 200, error: null }, '2026-11-27T04:40:00Z')
  assertJsonEquals(
    [recovered.check_failures, recovered.failing_since, recovered.check_status],
    [0, null, 200],
  )
})

Deno.test('a streak for an old URL does not carry over to a new one', () => {
  const old = { url: 'https://old.example/', check_failures: 7, failing_since: '2026-11-01T04:40:00Z' }
  const row = nextCheckRow(old, 'https://new.example/', { status: 404, error: null }, '2026-11-25T04:40:00Z')
  assertJsonEquals(
    [row.url, row.check_failures, row.failing_since],
    ['https://new.example/', 1, '2026-11-25T04:40:00Z'],
  )
})

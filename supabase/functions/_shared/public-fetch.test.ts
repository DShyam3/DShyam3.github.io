import type { Resolver } from './public-address.ts'
import { assertEquals, assertJsonEquals } from './test-assert.ts'
import { fetchPublic, MAX_REDIRECTS } from './public-fetch.ts'

const resolve: Resolver = (hostname) =>
  Promise.resolve(hostname === 'internal.example' ? ['192.168.1.4'] : ['93.184.215.14'])
const deps = (fetchImpl: typeof fetch) => ({ fetch: fetchImpl, resolve, signal: new AbortController().signal })

/** A response whose body records whether it was cancelled. */
function tracked(status: number, headers: Record<string, string>, text = 'body') {
  const state = { cancelled: false }
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text))
      controller.close()
    },
    cancel() {
      state.cancelled = true
    },
  })
  return { response: new Response(body, { status, headers }), state }
}

Deno.test('a redirect body is cancelled; the final body is left for the caller', async () => {
  const hop = tracked(302, { location: '/next' })
  const final = tracked(200, { 'content-type': 'text/html' }, '<title>Here</title>')
  const asked: string[] = []
  const result = await fetchPublic('https://site.example/start', deps(fetch), (url) => {
    asked.push(String(url))
    return Promise.resolve(asked.length === 1 ? hop.response : final.response)
  })
  assertEquals(result.ok, true)
  if (!result.ok) return
  assertJsonEquals(asked, ['https://site.example/start', 'https://site.example/next'])
  assertEquals(String(result.url), 'https://site.example/next')
  assertEquals(hop.state.cancelled, true)
  assertEquals(final.state.cancelled, false)
  assertEquals(await result.response.text(), '<title>Here</title>')
})

Deno.test('every hop passes the address rules, and the loop is bounded', async () => {
  const toInternal = await fetchPublic('https://site.example/', deps(fetch), () =>
    Promise.resolve(new Response(null, { status: 307, headers: { location: 'https://internal.example/admin' } })))
  assertJsonEquals(toInternal, { ok: false, error: 'blocked_address' })

  let sent = 0
  const loop = await fetchPublic('https://site.example/', deps(fetch), () => {
    sent++
    return Promise.resolve(new Response(null, { status: 301, headers: { location: '/again' } }))
  })
  assertJsonEquals(loop, { ok: false, error: 'too_many_redirects' })
  assertEquals(sent, MAX_REDIRECTS + 1)
})

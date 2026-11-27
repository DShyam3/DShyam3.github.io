import type { Resolver } from '../_shared/public-address.ts'
import { assertEquals, assertJsonEquals } from '../_shared/test-assert.ts'
import { findPageImages, iconImages, MAX_IMAGE_BYTES, productImages, readImage, sniffImage, USER_AGENT } from './images.ts'

const publicResolver: Resolver = (hostname) =>
  hostname === 'internal.example' ? Promise.resolve(['10.0.0.8']) : Promise.resolve(['93.184.215.14'])

function fakeFetch(routes: Record<string, () => Response>) {
  const seen: { url: string; agent: string | null }[] = []
  const impl = ((input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input)
    seen.push({ url, agent: new Headers(init?.headers).get('User-Agent') })
    const route = routes[url]
    return route ? Promise.resolve(route()) : Promise.reject(new TypeError('connection refused'))
  }) as typeof fetch
  return { impl, seen }
}

const deps = (fetchImpl: typeof fetch) => ({ fetch: fetchImpl, resolve: publicResolver, signal: new AbortController().signal })
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16])
const bytes = (text: string) => new TextEncoder().encode(text)

Deno.test('sniffImage reads what the bytes are, not what they are called', () => {
  assertEquals(sniffImage(PNG), 'png')
  assertEquals(sniffImage(JPEG), 'jpeg')
  assertEquals(sniffImage(bytes('RIFF\0\0\0\0WEBPVP8 ')), 'webp')
  assertEquals(sniffImage(bytes('\0\0\0\x1cftypavif\0\0\0\0')), 'avif')
  assertEquals(sniffImage(new Uint8Array([0, 0, 1, 0, 1, 0])), 'ico')
  assertEquals(sniffImage(bytes('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>')), 'svg')
  assertEquals(sniffImage(bytes('<!-- logo -->\n<svg viewBox="0 0 1 1"></svg>')), 'svg')
  assertEquals(sniffImage(bytes('<!DOCTYPE html><html><body>Not found</body></html>')), null)
  // A page that opens with a comment and inlines an <svg> early is still a page.
  assertEquals(sniffImage(bytes('<!-- build 42 --><html><body><svg viewBox="0 0 1 1"></svg>')), null)
  assertEquals(sniffImage(bytes('{"error":"gone"}')), null)
})

Deno.test('readImage returns an image and says who asked', async () => {
  const { impl, seen } = fakeFetch({
    'https://cdn.example/a.png': () => new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } }),
  })
  const result = await readImage('https://cdn.example/a.png', deps(impl))
  assertEquals(result.ok && result.kind, 'png')
  assertEquals(seen[0].agent, USER_AGENT)
})

Deno.test('readImage refuses an error page, a page that is not an image and an oversized body', async () => {
  const { impl } = fakeFetch({
    'https://cdn.example/gone.jpg': () => new Response('gone', { status: 404 }),
    'https://cdn.example/page.jpg': () => new Response('<html>soft 404</html>', { status: 200, headers: { 'content-type': 'image/jpeg' } }),
    'https://cdn.example/huge.jpg': () =>
      new Response(JPEG, { status: 200, headers: { 'content-length': String(MAX_IMAGE_BYTES + 1) } }),
  })
  assertJsonEquals(await readImage('https://cdn.example/gone.jpg', deps(impl)), { ok: false, reason: 'http_error' })
  assertJsonEquals(await readImage('https://cdn.example/page.jpg', deps(impl)), { ok: false, reason: 'not_image' })
  assertJsonEquals(await readImage('https://cdn.example/huge.jpg', deps(impl)), { ok: false, reason: 'too_large' })
})

Deno.test('readImage never requests a private address, even through a redirect', async () => {
  const { impl, seen } = fakeFetch({
    'https://cdn.example/moved.png': () => new Response(null, { status: 302, headers: { location: 'https://internal.example/a.png' } }),
  })
  const result = await readImage('https://cdn.example/moved.png', deps(impl))
  assertEquals(result.ok, false)
  assertEquals(seen.length, 1)
})

Deno.test('productImages prefers the JSON-LD product, then Amazon, then the share image', () => {
  const html = `<html><head>
    <meta property="og:image" content="/share.jpg">
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},
      {"@type":"Product","name":"Pen","image":[{"@type":"ImageObject","url":"https://cdn.example/pen.jpg"}]}]}</script>
    </head><body><script>var data = {"hiRes":"https:\\/\\/m.media-amazon.com\\/images\\/I\\/pen._AC_SL1500_.jpg"};</script></body></html>`
  assertJsonEquals(productImages(html, new URL('https://shop.example/p/pen')), [
    'https://cdn.example/pen.jpg',
    'https://m.media-amazon.com/images/I/pen._AC_SL1500_.jpg',
    'https://shop.example/share.jpg',
  ])
})

Deno.test('productImages reads attributes in any order and decodes entities', () => {
  const html = `<meta content="https://cdn.example/a.jpg?w=800&amp;h=800" property="og:image"><link href="b.jpg" rel="image_src">`
  assertJsonEquals(productImages(html, new URL('https://shop.example/x/')), [
    'https://cdn.example/a.jpg?w=800&h=800',
    'https://shop.example/x/b.jpg',
  ])
})

Deno.test('productImages ignores malformed JSON-LD and non-http images', () => {
  const html = `<script type="application/ld+json">{not json</script><meta property="og:image" content="javascript:alert(1)">`
  assertJsonEquals(productImages(html, new URL('https://shop.example/')), [])
})

Deno.test('iconImages lists the largest icon first and falls back to Apple\'s address', () => {
  const html = `<link rel="icon" href="/favicon.ico"><link rel="icon" type="image/png" sizes="32x32" href="/32.png">
    <link rel="apple-touch-icon" href="/touch.png"><link rel="icon" href="/logo.svg">`
  assertJsonEquals(iconImages(html, new URL('https://site.example/docs')), [
    'https://site.example/logo.svg',
    'https://site.example/touch.png',
    'https://site.example/32.png',
    'https://site.example/favicon.ico',
    'https://site.example/apple-touch-icon.png',
  ])
})

Deno.test('findPageImages reads a product page and refuses a challenge', async () => {
  const { impl } = fakeFetch({
    'https://shop.example/p': () =>
      new Response('<meta property="og:image" content="https://cdn.example/p.jpg">', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    'https://shop.example/blocked': () =>
      new Response('challenge', { status: 403, headers: { 'cf-mitigated': 'challenge' } }),
  })
  assertJsonEquals(await findPageImages('https://shop.example/p', 'product', deps(impl)), {
    ok: true,
    images: ['https://cdn.example/p.jpg'],
  })
  assertJsonEquals(await findPageImages('https://shop.example/blocked', 'product', deps(impl)), {
    ok: false,
    reason: 'challenged',
  })
})

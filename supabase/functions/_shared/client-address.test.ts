import { addressBlock, clientAddress } from './client-address.ts'
import { assertEquals } from './test-assert.ts'

const request = (headers: Record<string, string>) => new Request('https://example.com/', { headers })

Deno.test('prefers the address Cloudflare sets', () => {
  assertEquals(clientAddress(request({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1, 10.0.0.2' })), '203.0.113.7')
  assertEquals(clientAddress(request({ 'cf-connecting-ip': ' 2001:db8::1 ' })), '2001:db8::1')
})

Deno.test('falls back to the last forwarded hop, ignoring caller-supplied leading entries', () => {
  assertEquals(clientAddress(request({ 'x-forwarded-for': '1.2.3.4, 198.51.100.1' })), '198.51.100.1')
  assertEquals(clientAddress(request({ 'cf-connecting-ip': '   ', 'x-forwarded-for': '198.51.100.1' })), '198.51.100.1')
})

Deno.test('refuses a header that is not shaped like an address', () => {
  assertEquals(clientAddress(request({ 'cf-connecting-ip': 'truelayer-sync:manual', 'x-forwarded-for': '198.51.100.1' })), '198.51.100.1')
  assertEquals(clientAddress(request({ 'x-forwarded-for': `1.2.3.4, ${'a'.repeat(60)}` })), null)
})

Deno.test('is null with neither header', () => {
  assertEquals(clientAddress(request({})), null)
  assertEquals(clientAddress(request({ 'x-forwarded-for': ' , ' })), null)
})

Deno.test('groups IPv6 by its /64 and leaves IPv4 alone', () => {
  assertEquals(addressBlock('203.0.113.7'), '203.0.113.7')
  assertEquals(addressBlock('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), '2001:db8:1:2::/64')
  assertEquals(addressBlock('2001:DB8:0001:0002::5'), '2001:db8:1:2::/64')
  assertEquals(addressBlock('2001:db8::1'), '2001:db8:0:0::/64')
  assertEquals(addressBlock('::1'), '0:0:0:0::/64')
  assertEquals(addressBlock('::ffff:203.0.113.7'), '203.0.113.7')
})

Deno.test('can fall back to the first forwarded hop instead of the last', () => {
  const req = request({ 'x-forwarded-for': '198.51.100.1, 10.0.0.2' })
  assertEquals(clientAddress(req, 'first'), '198.51.100.1')
  assertEquals(clientAddress(req), '10.0.0.2')
  assertEquals(clientAddress(request({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1' }), 'first'), '203.0.113.7')
})

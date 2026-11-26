import { checkOutboundUrl, isPublicAddress, type Resolver } from './public-address.ts'
import { assertEquals, assertJsonEquals } from './test-assert.ts'

Deno.test('public IPv4 addresses are allowed', () => {
  for (const address of ['8.8.8.8', '1.1.1.1', '151.101.1.69', '172.15.255.255', '172.32.0.1', '100.63.255.255', '100.128.0.0']) {
    assertEquals(isPublicAddress(address), true)
  }
})

Deno.test('private, loopback, link-local, shared and reserved IPv4 are refused', () => {
  for (const address of [
    '0.0.0.0', '10.1.2.3', '100.64.0.1', '100.127.255.255', '127.0.0.1', '127.255.255.254',
    '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.0.0.8', '192.0.2.1', '192.168.1.1',
    '198.18.0.1', '198.19.255.255', '198.51.100.7', '203.0.113.9', '224.0.0.1', '239.255.255.250',
    '240.0.0.1', '255.255.255.255',
  ]) {
    assertEquals(isPublicAddress(address), false)
  }
})

Deno.test('public IPv6 addresses are allowed, bracketed or not', () => {
  for (const address of ['2606:4700:4700::1111', '[2a00:1450:4009:81f::200e]', '2001:4860:4860::8888']) {
    assertEquals(isPublicAddress(address), true)
  }
})

Deno.test('IPv6 outside global unicast, or carrying a private IPv4, is refused', () => {
  for (const address of [
    '::', '::1', '[::1]', 'fe80::1', 'fe80::1%en0', 'fc00::1', 'fd12:3456::1', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:169.254.169.254', '64:ff9b::10.0.0.1',
    '2001:db8::1', '2001::1', '2002:7f00:1::1', '3fff::1', '::127.0.0.1',
  ]) {
    assertEquals(isPublicAddress(address), false)
  }
})

Deno.test('IPv6 carrying a public IPv4 is judged by it', () => {
  assertEquals(isPublicAddress('::ffff:8.8.8.8'), true)
  assertEquals(isPublicAddress('64:ff9b::8.8.8.8'), true)
})

Deno.test('text that is not an address is not public', () => {
  for (const address of ['', 'example.com', '256.1.1.1', '1.2.3', '1:2:3:4:5:6:7:8:9', '1::2::3', 'gggg::1']) {
    assertEquals(isPublicAddress(address), false)
  }
})

const resolver = (table: Record<string, string[]>): Resolver => (hostname) => {
  const found = table[hostname]
  return found ? Promise.resolve(found) : Promise.reject(new Error('NXDOMAIN'))
}
const reasonOf = async (raw: string, resolve: Resolver = resolver({})) => {
  const result = await checkOutboundUrl(raw, resolve)
  return result.ok ? `ok ${result.url.href}` : result.reason
}

Deno.test('a public host on http or https is allowed', async () => {
  const resolve = resolver({ 'example.com': ['93.184.215.14', '2606:2800:21f:cb07:6820:80da:af6b:8b2c'] })
  assertEquals(await reasonOf('https://example.com/a?b=1', resolve), 'ok https://example.com/a?b=1')
  assertEquals(await reasonOf('http://Example.COM.', resolver({ 'example.com.': ['93.184.215.14'] })), 'ok http://example.com./')
})

Deno.test('other schemes, credentials and unparsable text are bad URLs', async () => {
  for (const raw of ['ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'not a url', 'https://user:pass@example.com', 'https://user@example.com']) {
    assertEquals(await reasonOf(raw), 'bad_url')
  }
})

Deno.test('a host that resolves to any non-public address is blocked', async () => {
  const resolve = resolver({
    'internal.example.com': ['10.0.0.5'],
    'mixed.example.com': ['93.184.215.14', '127.0.0.1'],
    'v6.example.com': ['::1'],
  })
  assertEquals(await reasonOf('https://internal.example.com', resolve), 'blocked_address')
  assertEquals(await reasonOf('https://mixed.example.com', resolve), 'blocked_address')
  assertEquals(await reasonOf('https://v6.example.com', resolve), 'blocked_address')
})

Deno.test('address literals are judged without a lookup, in every spelling', async () => {
  for (const raw of [
    'http://127.0.0.1/', 'http://2130706433/', 'http://0x7f.1/', 'http://0177.0.0.1/',
    'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://169.254.169.254/latest/meta-data/',
  ]) {
    assertEquals(await reasonOf(raw), 'blocked_address')
  }
  assertEquals(await reasonOf('http://8.8.8.8/'), 'ok http://8.8.8.8/')
})

Deno.test('localhost and single-label names are blocked before any lookup', async () => {
  const resolve: Resolver = () => Promise.reject(new Error('should not be asked'))
  for (const raw of ['http://localhost:3000', 'http://app.localhost', 'http://metadata/computeMetadata', 'http://intranet./']) {
    assertEquals(await reasonOf(raw, resolve), 'blocked_address')
  }
})

Deno.test('a name that does not resolve, or resolves to nothing, is a DNS failure', async () => {
  assertEquals(await reasonOf('https://gone.example.com'), 'dns')
  assertEquals(await reasonOf('https://empty.example.com', resolver({ 'empty.example.com': [] })), 'dns')
})

Deno.test('the lookup is handed the caller signal', async () => {
  const seen: (AbortSignal | undefined)[] = []
  const signal = new AbortController().signal
  await checkOutboundUrl('https://example.com', (_host, s) => {
    seen.push(s)
    return Promise.resolve(['93.184.215.14'])
  }, signal)
  assertJsonEquals(seen.map(s => s === signal), [true])
})

import { buildOrigins } from './site-origins.ts'

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
  }
}

function requestWithOrigin(origin: string | null): Request {
  const headers = new Headers()
  if (origin !== null) headers.set('Origin', origin)
  return new Request('https://example.com/', { headers })
}

Deno.test('echoes an allowlisted origin back', () => {
  const { corsOriginHeader } = buildOrigins('https://dhyanshyam.com')
  assertEquals(
    corsOriginHeader(requestWithOrigin('https://dhyanshyam.com'))['Access-Control-Allow-Origin'],
    'https://dhyanshyam.com',
  )
  assertEquals(
    corsOriginHeader(requestWithOrigin('http://localhost:5173'))['Access-Control-Allow-Origin'],
    'http://localhost:5173',
  )
})

Deno.test('falls back to SITE_ORIGIN for a non-allowlisted origin when SITE_ORIGIN is set', () => {
  const { corsOriginHeader } = buildOrigins('https://dhyanshyam.com')
  assertEquals(
    corsOriginHeader(requestWithOrigin('https://evil.example'))['Access-Control-Allow-Origin'],
    'https://dhyanshyam.com',
  )
})

Deno.test('never echoes the literal Origin: null a sandboxed iframe sends', () => {
  const withSiteOrigin = buildOrigins('https://dhyanshyam.com')
  assertEquals(
    withSiteOrigin.corsOriginHeader(requestWithOrigin('null'))['Access-Control-Allow-Origin'],
    'https://dhyanshyam.com',
  )

  const withoutSiteOrigin = buildOrigins(undefined)
  assertEquals(
    'Access-Control-Allow-Origin' in withoutSiteOrigin.corsOriginHeader(requestWithOrigin('null')),
    false,
  )
})

Deno.test('omits Access-Control-Allow-Origin entirely when SITE_ORIGIN is unset and the origin is unknown', () => {
  const { corsOriginHeader } = buildOrigins(undefined)
  const headers = corsOriginHeader(requestWithOrigin('https://evil.example'))
  assertEquals(Object.keys(headers).length, 0)
})

Deno.test('omits Access-Control-Allow-Origin when there is no Origin header at all and SITE_ORIGIN is unset', () => {
  const { corsOriginHeader } = buildOrigins(undefined)
  const headers = corsOriginHeader(requestWithOrigin(null))
  assertEquals(Object.keys(headers).length, 0)
})

Deno.test('allowedRedirectUris matches exactly, not by prefix', () => {
  const { allowedRedirectUris } = buildOrigins('https://dhyanshyam.com')
  const uris = allowedRedirectUris('/finance')

  assertEquals(uris.has('https://dhyanshyam.com/finance'), true)
  assertEquals(uris.has('https://dhyanshyam.com/finance/extra'), false)
  assertEquals(uris.has('https://dhyanshyam.com/financex'), false)
  assertEquals(uris.has('https://evil.example/finance'), false)
})

Deno.test('flags a set but invalid SITE_ORIGIN as rejected, not merely unset', () => {
  assertEquals(buildOrigins('https://Uppercase-Host.example').rejectedSiteOriginEnv, 'https://Uppercase-Host.example')
  assertEquals(buildOrigins('https://dhyanshyam.com/finance').rejectedSiteOriginEnv, 'https://dhyanshyam.com/finance')
  assertEquals(buildOrigins('http://dhyanshyam.com').rejectedSiteOriginEnv, 'http://dhyanshyam.com')
  assertEquals(buildOrigins(undefined).rejectedSiteOriginEnv, null)
  assertEquals(buildOrigins('').rejectedSiteOriginEnv, null)
  assertEquals(buildOrigins('https://dhyanshyam.com').rejectedSiteOriginEnv, null)
})

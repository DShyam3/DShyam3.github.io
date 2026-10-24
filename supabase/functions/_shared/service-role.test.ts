import { isServiceRoleRequest } from './service-role.ts'

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
  }
}

Deno.test('accepts the service role key as a bearer token', () => {
  assertEquals(isServiceRoleRequest('Bearer secret-key', 'secret-key'), true)
})

Deno.test('rejects any other bearer token', () => {
  assertEquals(isServiceRoleRequest('Bearer someone-else', 'secret-key'), false)
  assertEquals(isServiceRoleRequest('secret-key', 'secret-key'), false)
})

Deno.test('rejects everything when the key is missing or empty', () => {
  assertEquals(isServiceRoleRequest('Bearer undefined', undefined), false)
  assertEquals(isServiceRoleRequest('Bearer ', ''), false)
  assertEquals(isServiceRoleRequest('Bearer ', undefined), false)
})

Deno.test('rejects a missing header', () => {
  assertEquals(isServiceRoleRequest(null, 'secret-key'), false)
  assertEquals(isServiceRoleRequest('', 'secret-key'), false)
})

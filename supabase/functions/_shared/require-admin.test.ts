import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { requireAdmin, requireAdminUser } from './require-admin.ts'
import { assertEquals, assertJsonEquals } from './test-assert.ts'

function fakeClient(opts: {
  user?: { id: string } | null
  userError?: { message: string } | null
  rpcData?: unknown
  rpcError?: { message: string } | null
}): SupabaseClient {
  return {
    auth: {
      getUser: () => Promise.resolve({
        data: { user: opts.user ?? null },
        error: opts.userError ?? null,
      }),
    },
    rpc: () => Promise.resolve({
      data: opts.rpcData ?? null,
      error: opts.rpcError ?? null,
    }),
  } as unknown as SupabaseClient
}

Deno.test('returns 401 when no user is present', async () => {
  const client = fakeClient({ user: null })
  assertJsonEquals(await requireAdmin(client), { status: 401, error: 'Unauthorized' })
  assertJsonEquals(await requireAdminUser(client), {
    ok: false,
    failure: { status: 401, error: 'Unauthorized' },
  })
})

Deno.test('returns 401 when auth.getUser errors', async () => {
  const client = fakeClient({ user: { id: 'u1' }, userError: { message: 'bad jwt' } })
  assertJsonEquals(await requireAdmin(client), { status: 401, error: 'Unauthorized' })
})

Deno.test('returns 403 when caller is not an admin', async () => {
  const client = fakeClient({ user: { id: 'u1' }, rpcData: false })
  assertJsonEquals(await requireAdmin(client), {
    status: 403,
    error: 'Forbidden: Access restricted to administrator',
  })
})

Deno.test('fails closed with 403 when is_admin RPC errors', async () => {
  const client = fakeClient({ user: { id: 'u1' }, rpcError: { message: 'db down' } })
  assertJsonEquals(await requireAdmin(client), {
    status: 403,
    error: 'Forbidden: Access restricted to administrator',
  })
})

Deno.test('allows an authenticated admin and returns their user', async () => {
  const client = fakeClient({ user: { id: 'admin-1' }, rpcData: true })
  assertEquals(await requireAdmin(client), null)
  assertJsonEquals(await requireAdminUser(client), { ok: true, user: { id: 'admin-1' } })
})

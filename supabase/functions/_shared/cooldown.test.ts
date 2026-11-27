import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { claimCooldown, releaseCooldown } from './cooldown.ts'
import { assertEquals, assertJsonEquals } from './test-assert.ts'

interface FakeDbOptions {
  insertError?: { code?: string; message: string } | null
  others?: { window_start: string }[]
  readError?: { message: string } | null
  deleteError?: { message: string } | null
}

function fakeAdmin(opts: FakeDbOptions = {}) {
  const deleted: Array<Record<string, unknown>> = []

  const client = {
    from: (_table: string) => ({
      insert: (_row: unknown) => Promise.resolve({ error: opts.insertError ?? null }),
      select: (_cols: string) => {
        const chain = {
          eq: () => chain,
          gt: () => chain,
          neq: () => chain,
          order: () => chain,
          limit: () => Promise.resolve({
            data: opts.others ?? [],
            error: opts.readError ?? null,
          }),
        }
        return chain
      },
      delete: () => {
        const filters: Record<string, unknown> = {}
        const chain = {
          eq: (col: string, val: unknown) => {
            filters[col] = val
            return chain
          },
          then: (resolve: (value: { error: { message: string } | null }) => void) => {
            deleted.push({ ...filters })
            resolve({ error: opts.deleteError ?? null })
          },
        }
        return chain
      },
    }),
  } as unknown as SupabaseClient

  return { client, deleted }
}

Deno.test('fresh claim returns 0 and deletes nothing', async () => {
  const { client, deleted } = fakeAdmin({ others: [] })
  assertEquals(await claimCooldown(client, 'sync:full', 600), 0)
  assertEquals(deleted.length, 0)
})

Deno.test('active cooldown deletes own claim and returns remaining seconds', async () => {
  const previous = new Date(Date.now() - 120_000).toISOString()
  const { client, deleted } = fakeAdmin({ others: [{ window_start: previous }] })
  const retry = await claimCooldown(client, 'sync:full', 600)
  assertEquals(retry >= 479 && retry <= 481, true)
  assertEquals(deleted.length, 1)
  assertEquals(deleted[0].key, 'sync:full')
})

Deno.test('23505 race returns short retry without querying', async () => {
  const { client, deleted } = fakeAdmin({ insertError: { code: '23505', message: 'duplicate key' } })
  assertEquals(await claimCooldown(client, 'sync:full', 600), 5)
  assertEquals(deleted.length, 0)
})

Deno.test('non-race insert error fails open', async () => {
  const { client } = fakeAdmin({ insertError: { code: '57P01', message: 'db unavailable' } })
  assertEquals(await claimCooldown(client, 'sync:full', 600), 0)
})

Deno.test('releaseCooldown deletes all rows for the key', async () => {
  const { client, deleted } = fakeAdmin()
  await releaseCooldown(client, 'sync:full')
  assertJsonEquals(deleted, [{ key: 'sync:full' }])
})

import { buildTrueLayerTransactionQuery, formatTrueLayerDate } from './truelayer-transaction-query.ts'
import { assertEquals } from './test-assert.ts'

Deno.test('formats Data API v1 transaction dates without a time component', () => {
  assertEquals(
    formatTrueLayerDate(new Date('2026-09-10T23:59:59.999Z')),
    '2026-09-10',
  )
})

Deno.test('builds the documented inclusive transaction range', () => {
  assertEquals(
    buildTrueLayerTransactionQuery(
      new Date('2026-06-12T00:00:00.000Z'),
      new Date('2026-09-10T23:59:59.999Z'),
    ),
    'from=2026-06-12&to=2026-09-10',
  )
})

Deno.test('rejects a backwards transaction range before it reaches the provider', () => {
  let message = ''
  try {
    buildTrueLayerTransactionQuery(
      new Date('2026-09-11T00:00:00.000Z'),
      new Date('2026-09-10T00:00:00.000Z'),
    )
  } catch (error) {
    message = error instanceof Error ? error.message : ''
  }
  assertEquals(message, 'TrueLayer transaction range starts after it ends')
})

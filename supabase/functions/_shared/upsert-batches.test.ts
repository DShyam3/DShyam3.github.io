import { groupRowsByColumns } from './upsert-batches.ts'
import { assertJsonEquals } from './test-assert.ts'

Deno.test('never batches a row with one that sends a column it omits', () => {
  const groups = groupRowsByColumns([
    { id: 'new', name: 'Card', credit_limit: 500 },
    { id: 'old', credit_limit: 800 },
    { id: 'old2' },
    { id: 'new2', credit_limit: 100, name: 'Other' },
  ])
  assertJsonEquals(groups.map(group => group.map(row => row.id)), [['new', 'new2'], ['old'], ['old2']])
  for (const group of groups) {
    const shape = Object.keys(group[0]).sort().join(',')
    for (const row of group) assertJsonEquals(Object.keys(row).sort().join(','), shape)
  }
})

Deno.test('returns no groups for no rows', () => {
  assertJsonEquals(groupRowsByColumns([]), [])
})

/**
 * Shaping rows for a PostgREST upsert without blanking columns.
 *
 * One upsert sends the union of its rows' columns, and a row that lacks one
 * of them writes NULL there -- over whatever the table held. A sync that
 * leaves a column out on purpose (because the owner edits it, or because the
 * bank did not return it this time) must therefore never share a batch with a
 * row that sends it.
 *
 * Leaving a column out is only safe where it is nullable or has a default:
 * an upsert is an INSERT first, and Postgres checks NOT NULL on the proposed
 * row before it looks for the conflict. A NOT NULL column with no default must
 * be sent on every row, existing or not.
 */

/**
 * Rows grouped so every row in a group carries exactly the same columns,
 * groups in the order their first row appeared. Upsert each group separately
 * and no batch names a column one of its rows omits.
 */
export function groupRowsByColumns<T extends Record<string, unknown>>(rows: readonly T[]): T[][] {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const columns = Object.keys(row).sort().join(',')
    const group = groups.get(columns)
    if (group) group.push(row)
    else groups.set(columns, [row])
  }
  return [...groups.values()]
}

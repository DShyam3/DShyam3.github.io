/**
 * Whether a request authenticates as the service role (pg_cron, or another
 * function), by its Authorization header.
 *
 * Refuses outright when the key is missing or empty. Comparing against a
 * template string would otherwise accept `Bearer undefined`, or a bare
 * `Bearer `, as the service role -- the platform always sets the variable, so
 * this is defence in depth rather than a live hole. The comparison takes the
 * same time wherever the strings first differ.
 */
export function isServiceRoleRequest(authHeader: string | null, serviceRoleKey: string | undefined): boolean {
  if (!serviceRoleKey || !authHeader) return false
  const encoder = new TextEncoder()
  const given = encoder.encode(authHeader)
  const expected = encoder.encode(`Bearer ${serviceRoleKey}`)
  if (given.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= given[i] ^ expected[i]
  return diff === 0
}

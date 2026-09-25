/**
 * The administrator check for an edge function.
 *
 * Both functions that need one used to carry their own copy:
 *
 *     const adminEmail = Deno.env.get('ADMIN_EMAIL') || '<owner email>'
 *     if (user.email !== adminEmail) { ...403... }
 *
 * which made three separate statements of who an administrator is -- this, the
 * other function's copy, and the database's own policies. Three copies of an
 * authorization rule is three chances for one to be updated and the others
 * missed, and the one that matters is the database's.
 *
 * So this asks the database. `is_admin()` is the same function every RLS policy
 * calls, invoked here through a client carrying the caller's own JWT, so the
 * answer is exactly the one the caller would get on any table.
 *
 * Fails closed: a network error, a malformed token or an unreadable response
 * all deny. An error resolving a permission is not a grant.
 */

// Pinned to the exact version both call sites import. An unpinned `@2` resolves
// to a newer client whose `SupabaseClient` type is structurally different, and
// the mismatch surfaces as a type error at the call site rather than here.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

export interface AdminCheckFailure {
  /** 401 when there is no valid session, 403 when there is one without rights. */
  status: 401 | 403
  error: string
}

/**
 * Returns null when the caller is an administrator, or the response body and
 * status to reject them with.
 *
 * `userClient` must be built with the caller's Authorization header, not the
 * service role -- the service role bypasses RLS and would report itself as
 * whatever the function asked.
 */
export async function requireAdmin(
  userClient: SupabaseClient,
): Promise<AdminCheckFailure | null> {
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) {
    return { status: 401, error: 'Unauthorized' }
  }

  const { data, error } = await userClient.rpc('is_admin')
  if (error) {
    console.warn('Admin check failed to resolve:', error.message)
    return { status: 403, error: 'Forbidden: Access restricted to administrator' }
  }

  if (data !== true) {
    return { status: 403, error: 'Forbidden: Access restricted to administrator' }
  }

  return null
}

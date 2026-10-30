import type { Session } from '@supabase/supabase-js';

// The `aal` claim of an access token: 'aal1' for a password-only sign-in,
// 'aal2' once a second factor has been verified. Null when the token cannot be
// read -- a caller treats that the same as aal1, the less trusted answer.
//
// The signature is not checked here and does not need to be: this only decides
// whether to ask for a code. What the session may do is decided by the
// database, which reads the same claim from a token it has verified.
export function accessTokenAal(token: string): string | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    // JWT segments are base64url, which atob does not accept: swap the
    // alphabet back and restore the padding the encoding drops.
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const claims: unknown = JSON.parse(atob(padded));
    const aal = (claims as { aal?: unknown } | null)?.aal;
    return typeof aal === 'string' ? aal : null;
  } catch {
    return null;
  }
}

// True when the session signed in with a password but the account has a
// verified second factor still to be presented.
//
// Pure and synchronous on purpose: supabase-js documents that calling another
// `supabase.auth` method inside an `onAuthStateChange` callback can deadlock,
// and `getAuthenticatorAssuranceLevel` is such a method. The token and the
// user's factor list are already on the session, so nothing needs asking.
export function mfaStepRequired(session: Session | null): boolean {
  if (!session) return false;
  const aal = accessTokenAal(session.access_token);
  if (aal === 'aal2') return false;
  return (session.user.factors ?? []).some((factor) => factor.status === 'verified');
}

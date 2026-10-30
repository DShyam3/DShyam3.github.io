import { describe, expect, it } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { accessTokenAal, mfaStepRequired } from './auth-aal';

// A token with the given claims. The header and signature are placeholders:
// only the middle segment is ever read.
function tokenWith(claims: unknown): string {
  const payload = btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `header.${payload}.signature`;
}

function sessionWith(token: string, factors?: { status: 'verified' | 'unverified' }[]): Session {
  return {
    access_token: token,
    user: {
      factors: factors?.map((f, i) => ({
        id: `factor-${i}`,
        factor_type: 'totp',
        status: f.status,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      })),
    },
  } as unknown as Session;
}

describe('accessTokenAal', () => {
  it('reads the aal claim', () => {
    expect(accessTokenAal(tokenWith({ aal: 'aal1' }))).toBe('aal1');
    expect(accessTokenAal(tokenWith({ aal: 'aal2' }))).toBe('aal2');
  });

  it('returns null when the claim is missing or not a string', () => {
    expect(accessTokenAal(tokenWith({ sub: 'someone' }))).toBeNull();
    expect(accessTokenAal(tokenWith({ aal: 2 }))).toBeNull();
    expect(accessTokenAal(tokenWith(null))).toBeNull();
  });

  it('returns null for a malformed token rather than throwing', () => {
    for (const bad of ['', 'not-a-jwt', 'a..c', 'a.!!!.c', `a.${btoa('not json')}.c`]) {
      expect(accessTokenAal(bad)).toBeNull();
    }
  });

  it('decodes base64url: the - and _ characters and dropped padding', () => {
    // Bytes chosen so the encoded payload contains '-' or '_' (asserted below),
    // which atob rejects until they are swapped back. The loop then varies the
    // payload length so each padding width is exercised.
    const claims = { note: '>>>???', aal: 'aal2' };
    const encoded = tokenWith(claims).split('.')[1];
    expect(encoded).toMatch(/[-_]/);
    expect(accessTokenAal(tokenWith(claims))).toBe('aal2');

    for (const note of ['a', 'ab', 'abc', 'abcd']) {
      const token = tokenWith({ note, aal: 'aal1' });
      expect(token.split('.')[1]).not.toContain('=');
      expect(accessTokenAal(token)).toBe('aal1');
    }
  });
});

describe('mfaStepRequired', () => {
  it('is false with no session', () => {
    expect(mfaStepRequired(null)).toBe(false);
  });

  it('is true for an aal1 session whose user has a verified factor', () => {
    expect(mfaStepRequired(sessionWith(tokenWith({ aal: 'aal1' }), [{ status: 'verified' }]))).toBe(true);
  });

  it('is false once the session is aal2', () => {
    expect(mfaStepRequired(sessionWith(tokenWith({ aal: 'aal2' }), [{ status: 'verified' }]))).toBe(false);
  });

  it('is false when the only factor is unverified', () => {
    expect(mfaStepRequired(sessionWith(tokenWith({ aal: 'aal1' }), [{ status: 'unverified' }]))).toBe(false);
  });

  it('is false when the user has no factors at all', () => {
    expect(mfaStepRequired(sessionWith(tokenWith({ aal: 'aal1' }), []))).toBe(false);
    expect(mfaStepRequired(sessionWith(tokenWith({ aal: 'aal1' })))).toBe(false);
  });

  it('treats a missing aal claim as aal1', () => {
    expect(mfaStepRequired(sessionWith(tokenWith({ sub: 'someone' }), [{ status: 'verified' }]))).toBe(true);
  });

  it('treats a malformed token as aal1', () => {
    expect(mfaStepRequired(sessionWith('garbage', [{ status: 'verified' }]))).toBe(true);
    expect(mfaStepRequired(sessionWith('garbage', [{ status: 'unverified' }]))).toBe(false);
  });
});

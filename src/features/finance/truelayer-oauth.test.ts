import { describe, expect, it } from 'vitest';
import { consumeTrueLayerOAuthState, rememberTrueLayerOAuthState } from './truelayer-oauth';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('TrueLayer OAuth callback state', () => {
  it('accepts the tab-bound state exactly once', () => {
    const storage = createStorage();
    rememberTrueLayerOAuthState(storage, 'expected-state');

    expect(consumeTrueLayerOAuthState(storage, 'expected-state')).toBe(true);
    expect(consumeTrueLayerOAuthState(storage, 'expected-state')).toBe(false);
  });

  it('clears a saved state after a missing or mismatched callback', () => {
    const storage = createStorage();
    rememberTrueLayerOAuthState(storage, 'expected-state');

    expect(consumeTrueLayerOAuthState(storage, 'other-state')).toBe(false);
    expect(consumeTrueLayerOAuthState(storage, null)).toBe(false);
  });
});

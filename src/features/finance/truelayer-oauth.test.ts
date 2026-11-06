import { describe, expect, it } from 'vitest';
import { consumeTrueLayerOAuthState, rememberTrueLayerOAuthState } from './truelayer-oauth';

function createStorage() {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

const T0 = Date.UTC(2026, 10, 6, 12, 0, 0);
const MINUTE = 60 * 1000;

describe('TrueLayer OAuth callback state', () => {
  it('accepts the saved state exactly once', () => {
    const storage = createStorage();
    rememberTrueLayerOAuthState(storage, 'expected-state', T0);

    expect(consumeTrueLayerOAuthState(storage, 'expected-state', T0 + MINUTE)).toBe(true);
    expect(consumeTrueLayerOAuthState(storage, 'expected-state', T0 + MINUTE)).toBe(false);
  });

  it('rejects a missing or unknown callback state', () => {
    const storage = createStorage();
    rememberTrueLayerOAuthState(storage, 'expected-state', T0);

    expect(consumeTrueLayerOAuthState(storage, 'other-state', T0)).toBe(false);
    expect(consumeTrueLayerOAuthState(storage, null, T0)).toBe(false);
  });

  it('leaves a pending state intact after a mismatched callback', () => {
    const storage = createStorage();
    rememberTrueLayerOAuthState(storage, 'expected-state', T0);

    expect(consumeTrueLayerOAuthState(storage, 'other-state', T0)).toBe(false);
    expect(consumeTrueLayerOAuthState(storage, 'expected-state', T0)).toBe(true);
  });

  it('accepts two pending states once each', () => {
    const storage = createStorage();
    rememberTrueLayerOAuthState(storage, 'first-state', T0);
    rememberTrueLayerOAuthState(storage, 'second-state', T0 + MINUTE);

    expect(consumeTrueLayerOAuthState(storage, 'first-state', T0 + 2 * MINUTE)).toBe(true);
    expect(consumeTrueLayerOAuthState(storage, 'second-state', T0 + 2 * MINUTE)).toBe(true);
    expect(consumeTrueLayerOAuthState(storage, 'first-state', T0 + 2 * MINUTE)).toBe(false);
  });

  it('rejects a state older than the server keeps it, at the boundary', () => {
    const storage = createStorage();
    rememberTrueLayerOAuthState(storage, 'on-time', T0);
    rememberTrueLayerOAuthState(storage, 'late', T0);

    expect(consumeTrueLayerOAuthState(storage, 'on-time', T0 + 10 * MINUTE)).toBe(true);
    expect(consumeTrueLayerOAuthState(storage, 'late', T0 + 10 * MINUTE + 1)).toBe(false);
  });

  it('forgets expired states when a new one is saved', () => {
    const storage = createStorage();
    rememberTrueLayerOAuthState(storage, 'abandoned', T0);
    rememberTrueLayerOAuthState(storage, 'fresh', T0 + 11 * MINUTE);

    expect(storage.length).toBe(1);
    expect(consumeTrueLayerOAuthState(storage, 'fresh', T0 + 11 * MINUTE)).toBe(true);
  });
});

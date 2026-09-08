const TRUE_LAYER_OAUTH_STATE_STORAGE_KEY = 'truelayer-oauth-state';

type SessionStorageLike = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

/** Save the raw state only for the current browser tab and OAuth round trip. */
export function rememberTrueLayerOAuthState(storage: SessionStorageLike, state: string): void {
  storage.setItem(TRUE_LAYER_OAUTH_STATE_STORAGE_KEY, state);
}

/**
 * Compare a returned callback state with the tab-bound value and always clear
 * the saved value. A callback URL cannot be replayed from this browser tab.
 */
export function consumeTrueLayerOAuthState(
  storage: SessionStorageLike,
  callbackState: string | null,
): boolean {
  const expectedState = storage.getItem(TRUE_LAYER_OAUTH_STATE_STORAGE_KEY);
  storage.removeItem(TRUE_LAYER_OAUTH_STATE_STORAGE_KEY);
  return expectedState !== null && callbackState !== null && expectedState === callbackState;
}

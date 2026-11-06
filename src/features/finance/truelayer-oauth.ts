const TRUE_LAYER_OAUTH_STATE_KEY_PREFIX = 'truelayer-oauth-state:';
/** Matches the server's `OAUTH_STATE_TTL_MS` in `truelayer-sync`. */
const TRUE_LAYER_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type StorageLike = Pick<Storage, 'getItem' | 'removeItem' | 'setItem' | 'key' | 'length'>;

function forgetExpiredStates(storage: StorageLike, now: number): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(TRUE_LAYER_OAUTH_STATE_KEY_PREFIX)) keys.push(key);
  }
  for (const key of keys) {
    const age = now - Number(storage.getItem(key));
    if (!(age >= 0 && age <= TRUE_LAYER_OAUTH_STATE_TTL_MS)) storage.removeItem(key);
  }
}

/**
 * Save the raw state for this browser until the provider returns.
 *
 * Browser-wide (localStorage), not tab-wide: on a phone the bank's app hands
 * the callback back to the browser, which opens it in a fresh tab, and a
 * tab-bound value was not there to match. The server's copy is what binds the
 * state to the signed-in profile, single-use and short-lived; this one only
 * ties the callback to the browser that started it.
 *
 * One key per state, so two links started in two tabs do not overwrite each
 * other, and a stray callback cannot clear a link still in progress.
 */
export function rememberTrueLayerOAuthState(storage: StorageLike, state: string, now = Date.now()): void {
  forgetExpiredStates(storage, now);
  storage.setItem(TRUE_LAYER_OAUTH_STATE_KEY_PREFIX + state, String(now));
}

/**
 * Whether a returned callback state was saved here, within the server's
 * lifetime. Its own entry is cleared either way, so a callback URL cannot be
 * replayed from this browser; any other link in progress is left alone.
 */
export function consumeTrueLayerOAuthState(
  storage: StorageLike,
  callbackState: string | null,
  now = Date.now(),
): boolean {
  if (callbackState === null) return false;
  const key = TRUE_LAYER_OAUTH_STATE_KEY_PREFIX + callbackState;
  const savedAt = storage.getItem(key);
  storage.removeItem(key);
  if (savedAt === null) return false;
  const age = now - Number(savedAt);
  return age >= 0 && age <= TRUE_LAYER_OAUTH_STATE_TTL_MS;
}

/**
 * A bank link can run in a tab of its own, which leaves the tab that started
 * it showing the connections as they were. The tab finishing the link says
 * `linked` once the code is exchanged and `synced` once the first sync is
 * done; every open tab refreshes its connections on either.
 */
const TRUE_LAYER_LINKED_CHANNEL = 'truelayer-linked';

export type TrueLayerLinkEvent = 'linked' | 'synced';

export function announceTrueLayerLink(event: TrueLayerLinkEvent): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(TRUE_LAYER_LINKED_CHANNEL);
  channel.postMessage(event);
  channel.close();
}

/** Returns the unsubscribe. */
export function onTrueLayerLink(listener: (event: TrueLayerLinkEvent) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const channel = new BroadcastChannel(TRUE_LAYER_LINKED_CHANNEL);
  channel.onmessage = ({ data }: MessageEvent<unknown>) => {
    if (data === 'linked' || data === 'synced') listener(data);
  };
  return () => channel.close();
}

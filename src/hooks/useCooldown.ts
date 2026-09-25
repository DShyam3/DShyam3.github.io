import { useCallback, useSyncExternalStore } from 'react';

/**
 * Server-enforced cooldowns, as the browser last heard of them.
 *
 * Module state rather than component state: several components can each
 * hold their own copy of the same hook (FinancePage, the Dashboard and Bank
 * Accounts surfaces all call useTrueLayer), and a cooldown one of them
 * learns has to disable every button that would hit it.
 */
const endsAt = new Map<string, number>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * When the cooldown named `key` ends, as a timestamp, or null when none is
 * known. The edge function is what enforces it; this only lets a button say
 * so before it is pressed rather than after. Clears itself when time is up.
 */
export function useCooldown(key: string) {
  const until = useSyncExternalStore(subscribe, () => endsAt.get(key) ?? null);

  /** Starts it from a response's `retry_after`; ignores a missing one. */
  const start = useCallback(
    (seconds: number | undefined) => {
      if (typeof seconds !== 'number' || seconds <= 0) return;
      clearTimeout(timers.get(key));
      endsAt.set(key, Date.now() + seconds * 1000);
      timers.set(
        key,
        setTimeout(() => {
          endsAt.delete(key);
          timers.delete(key);
          notify();
        }, seconds * 1000),
      );
      notify();
    },
    [key],
  );

  return { until, start };
}

/** "14:32" -- when a cooldown ends, for a button label. */
export function formatCooldownEnd(until: number): string {
  return new Date(until).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

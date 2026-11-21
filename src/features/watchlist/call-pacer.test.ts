import { describe, expect, it } from 'vitest';
import { createCallPacer } from './call-pacer';

/** A clock that only moves when the pacer sleeps. */
function fakeClock() {
  let time = 0;
  return {
    now: () => time,
    sleep: async (ms: number) => { time += ms; },
    advance: (ms: number) => { time += ms; },
  };
}

describe('createCallPacer', () => {
  it('lets calls through up to the limit, then waits for the oldest to age out', async () => {
    const clock = fakeClock();
    const slot = createCallPacer(2, 1000, clock.now, clock.sleep);
    const granted: number[] = [];
    for (let i = 0; i < 5; i++) {
      await slot();
      granted.push(clock.now());
    }
    expect(granted).toEqual([0, 0, 1000, 1000, 2000]);
  });

  it('never grants more than the limit inside any window', async () => {
    const clock = fakeClock();
    const slot = createCallPacer(3, 1000, clock.now, clock.sleep);
    const granted: number[] = [];
    for (let i = 0; i < 10; i++) {
      await slot();
      granted.push(clock.now());
      clock.advance(150);
    }
    for (const start of granted) {
      expect(granted.filter((t) => t >= start && t < start + 1000).length).toBeLessThanOrEqual(3);
    }
  });

  it('serves callers waiting at the same time one slot each', async () => {
    let time = 0;
    const sleepers: Array<() => void> = [];
    const slot = createCallPacer(1, 1000, () => time, (ms) => new Promise((resolve) => {
      sleepers.push(() => { time = Math.max(time, ms); resolve(); });
    }));
    await slot();
    const order: string[] = [];
    const a = slot().then(() => order.push(`a@${time}`));
    const b = slot().then(() => order.push(`b@${time}`));
    // Both are asleep; waking them together must still let only one through.
    sleepers.splice(0).forEach((wake) => wake());
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(['a@1000']);
    time = 2000;
    sleepers.splice(0).forEach((wake) => wake());
    await Promise.all([a, b]);
    expect(order).toEqual(['a@1000', 'b@2000']);
  });

  it('keeps room under a lower ceiling for callers that pass none', async () => {
    const clock = fakeClock();
    const slot = createCallPacer(4, 1000, clock.now, clock.sleep);
    await slot(2);
    await slot(2);
    // The background caller is at its ceiling, but others still get through.
    await slot();
    await slot();
    expect(clock.now()).toBe(0);
    // A third background call waits for the window to drop to one.
    await slot(2);
    expect(clock.now()).toBe(1000);
  });
});

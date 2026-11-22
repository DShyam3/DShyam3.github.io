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

  it('caps one kind of call without holding up the others', async () => {
    const clock = fakeClock();
    const slot = createCallPacer(4, 1000, clock.now, clock.sleep);
    await slot({ kind: 'page', limit: 2 });
    await slot({ kind: 'page', limit: 2 });
    // Pages are at their own limit, but other calls still get straight in.
    await slot();
    expect(clock.now()).toBe(0);
    // A third page waits for the first to leave the window.
    await slot({ kind: 'page', limit: 2 });
    expect(clock.now()).toBe(1000);
  });

  it('lets other calls take every place pages leave', async () => {
    const clock = fakeClock();
    const slot = createCallPacer(4, 1000, clock.now, clock.sleep);
    await slot({ kind: 'page', limit: 1 });
    for (let i = 0; i < 3; i++) await slot();
    expect(clock.now()).toBe(0);
    // The window is full: the next call of any kind waits.
    await slot();
    expect(clock.now()).toBe(1000);
  });
  it('waits for whichever limit frees last, in one sleep', async () => {
    let time = 0;
    const sleeps: number[] = [];
    const slot = createCallPacer(4, 1000, () => time, async (ms) => { sleeps.push(ms); time += ms; });
    const page = { kind: 'page', limit: 2 };
    await slot();
    time = 100; await slot(page);
    time = 200; await slot(page);
    time = 300; await slot();
    // Full overall (frees at 1000) and full of pages (frees at 1100): the
    // later one decides.
    await slot(page);
    expect(time).toBe(1100);
    expect(sleeps).toEqual([800]);
  });

  it('grants a page at once while the walk is at its own limit', async () => {
    const clock = fakeClock();
    const slot = createCallPacer(4, 1000, clock.now, clock.sleep);
    const walk = { kind: 'walk', limit: 3 };
    for (let i = 0; i < 3; i++) await slot(walk);
    await slot({ kind: 'page', limit: 2 });
    expect(clock.now()).toBe(0);
  });
});

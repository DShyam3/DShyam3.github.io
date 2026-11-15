import { describe, expect, it } from 'vitest';
import {
  compareTimeToFinish,
  timeToFinish,
  timeToFinishLabel,
  type FinishSeason,
} from './time-to-finish';

const today = new Date('2026-11-11T15:00:00');

const ep = (episode_number: number, runtime: number | null, release_date: string | null = '2026-01-01') => ({
  episode_number,
  runtime,
  release_date,
});

const season = (season_number: number, episodes: FinishSeason['episodes']): FinishSeason => ({
  season_number,
  episodes,
});

const watched = (keys: string[]) => {
  const set = new Set(keys);
  return (s: number, e: number) => set.has(`${s}x${e}`);
};
const none = () => false;

describe('timeToFinish', () => {
  it('sums aired, unwatched runtime across seasons', () => {
    const t = timeToFinish(
      [
        season(1, [ep(1, 50), ep(2, 50)]),
        season(2, [ep(1, 40), ep(2, 40), ep(3, 40)]),
      ],
      watched(['1x1']),
      today,
    );
    expect(t.episodesLeft).toBe(4);
    expect(t.minutesLeft).toBe(50 + 120);
    expect(t.estimated).toBe(false);
  });

  it('counts nothing for finished seasons', () => {
    const t = timeToFinish(
      [season(2, [ep(1, 30)]), season(1, [ep(1, 60), ep(2, 60)])],
      watched(['1x1', '1x2']),
      today,
    );
    expect(t.episodesLeft).toBe(1);
    expect(t.minutesLeft).toBe(30);
  });

  it('ignores specials and episodes that have not aired', () => {
    const t = timeToFinish(
      [
        season(0, [ep(1, 90)]),
        season(1, [ep(1, 45), ep(2, 45, '2026-11-11'), ep(3, 45, '2026-11-12'), ep(4, 45, null)]),
      ],
      none,
      today,
    );
    // Episode 2 airs today and counts; episode 3 airs tomorrow; 4 has no date.
    expect(t.episodesLeft).toBe(2);
    expect(t.minutesLeft).toBe(90);
  });

  it('fills a missing runtime with the show median and marks it estimated', () => {
    const t = timeToFinish(
      [season(1, [ep(1, 30), ep(2, 60), ep(3, 0)]), season(2, [ep(1, 40)])],
      watched(['1x1', '1x2']),
      today,
    );
    // Known runtimes 30, 40, 60 -> median 40. Episode 3 takes it.
    expect(t.minutesLeft).toBe(40 + 40);
    expect(t.estimated).toBe(true);
  });

  it('leaves specials out of the median', () => {
    const t = timeToFinish(
      [season(0, [ep(1, 300)]), season(1, [ep(1, 30), ep(2, null)])],
      watched(['1x1']),
      today,
    );
    // With the special counted, the median would be 165.
    expect(t.minutesLeft).toBe(30);
    expect(t.estimated).toBe(true);
  });

  it('uses the mean of the middle two for an even count', () => {
    const t = timeToFinish(
      [season(1, [ep(1, 20), ep(2, 30), ep(3, null)])],
      watched(['1x1', '1x2']),
      today,
    );
    expect(t.minutesLeft).toBe(25);
  });

  it('reports unknown minutes when no runtime is stored at all', () => {
    const t = timeToFinish([season(1, [ep(1, null), ep(2, null)])], none, today);
    expect(t.episodesLeft).toBe(2);
    expect(t.minutesLeft).toBeNull();
  });

  it('has nothing left for a watched or empty show', () => {
    expect(timeToFinish(undefined, none, today)).toEqual({
      episodesLeft: 0,
      minutesLeft: 0,
      estimated: false,
      airingSeason: null,
      airedEpisodes: 0,
    });
    const done = timeToFinish([season(1, [ep(1, 30)])], watched(['1x1']), today);
    expect(done.episodesLeft).toBe(0);
  });
});

describe('a season still airing', () => {
  // Episode 1 aired, episode 2 airs tomorrow.
  const airing = timeToFinish(
    [season(1, [ep(1, 40), ep(2, 40)]), season(2, [ep(1, 50), ep(2, 50, '2026-11-12')])],
    watched(['1x1', '1x2']),
    today,
  );
  const settled = timeToFinish([season(1, [ep(1, 60), ep(2, 60), ep(3, 60)])], none, today);
  const done = timeToFinish([season(1, [ep(1, 30)])], watched(['1x1']), today);

  it('is marked when a season has an episode out and another to come', () => {
    expect(airing.airingSeason).toBe(2);
    expect(settled.airingSeason).toBeNull();
  });

  it('ignores an episode with no date rather than holding the season open', () => {
    const t = timeToFinish([season(1, [ep(1, 30), ep(2, 30, null)])], none, today);
    expect(t.airingSeason).toBeNull();
    expect(t.episodesLeft).toBe(1);
  });

  it('ranks after known and unknown runtimes, but before nothing left', () => {
    const unknown = timeToFinish([season(1, [ep(1, null)])], none, today);
    const order = [done, airing, unknown, settled].sort(compareTimeToFinish);
    // The airing show's one 50m episode is quicker than settled's 3h, yet
    // the show cannot be finished, so it goes after both.
    expect(order).toEqual([settled, unknown, airing, done]);
  });

  it('reads up to date once every aired episode is watched', () => {
    const caughtUp = timeToFinish(
      [season(1, [ep(1, 40), ep(2, 40, '2026-11-20')])],
      watched(['1x1']),
      today,
    );
    expect(timeToFinishLabel(caughtUp)).toBe('Up to date');
    expect(compareTimeToFinish(caughtUp, airing)).toBeGreaterThan(0);
  });

  it('holds the show open even when the backlog is in an earlier season', () => {
    // Season 1 complete and unwatched; caught up on Season 2, still airing.
    const behind = timeToFinish(
      [season(1, [ep(1, 40)]), season(2, [ep(1, 50), ep(2, 50, '2026-11-12')])],
      watched(['2x1']),
      today,
    );
    expect(timeToFinishLabel(behind)).toBe('S2 still airing');
  });

  it('does not count a season that has not started as airing', () => {
    const premiere = timeToFinish(
      [season(1, [ep(1, 40)]), season(2, [ep(1, 50, '2027-03-01')])],
      none,
      today,
    );
    expect(premiere.airingSeason).toBeNull();
    expect(timeToFinishLabel(premiere)).toBe('1 ep · 40m');
  });

  it('says which season is still airing', () => {
    expect(timeToFinishLabel(airing)).toBe('S2 still airing');
  });
});

describe('compareTimeToFinish', () => {
  const short = timeToFinish([season(1, [ep(1, 30), ep(2, 30)])], none, today);
  const long = timeToFinish([season(1, [ep(1, 60)]), season(2, [ep(1, 60), ep(2, 60)])], none, today);
  const unknown = timeToFinish([season(1, [ep(1, null)])], none, today);
  const done = timeToFinish([season(1, [ep(1, 30)])], watched(['1x1']), today);

  const order = (...items: ReturnType<typeof timeToFinish>[]) => [...items].sort(compareTimeToFinish);

  it('puts known times first, then unknown, then nothing left', () => {
    expect(order(done, unknown, long, short)).toEqual([short, long, unknown, done]);
  });

  it('returns 0 for a tie so the caller can sort by title', () => {
    expect(compareTimeToFinish(short, { ...short })).toBe(0);
    expect(compareTimeToFinish(done, { ...done })).toBe(0);
  });
});

describe('timeToFinishLabel', () => {
  it('labels episodes and time left', () => {
    const t = timeToFinish(
      [season(1, [ep(1, 50)]), season(2, [ep(1, 45), ep(2, 45)])],
      watched(['1x1']),
      today,
    );
    expect(timeToFinishLabel(t)).toBe('2 eps · 1h 30m');
  });

  it('marks an estimate and omits unknown minutes', () => {
    const estimated = timeToFinish([season(1, [ep(1, 40), ep(2, null)])], watched(['1x1']), today);
    expect(timeToFinishLabel(estimated)).toBe('1 ep · ~40m');
    const unknown = timeToFinish([season(1, [ep(1, null)])], none, today);
    expect(timeToFinishLabel(unknown)).toBe('1 ep');
  });

  it('says up to date when nothing aired is left', () => {
    const done = timeToFinish([season(1, [ep(1, 30)])], watched(['1x1']), today);
    expect(timeToFinishLabel(done)).toBe('Up to date');
  });

  it('says not aired yet when nothing has aired', () => {
    const future = timeToFinish([season(1, [ep(1, 30, '2027-01-01')])], none, today);
    expect(timeToFinishLabel(future)).toBe('Not aired yet');
    expect(timeToFinishLabel(timeToFinish([season(1, [])], none, today))).toBe('Not aired yet');
  });
});

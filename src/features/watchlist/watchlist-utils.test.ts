import { describe, it, expect } from 'vitest';
import {
  buildUpdatesFeed,
  compactUpcomingStatus,
  computeFirstSeenAt,
  daysUntil,
  displayTitle,
  filterUpcomingByWindow,
  filterUpdatesByWindow,
  formatRuntime,
  getStatusColor,
  groupAnnouncementsByShow,
  groupRecentEpisodesByShow,
  isAnnouncement,
  isPremiereEpisode,
  isSeasonFinished,
  isSpecialsSeason,
  isUpcomingStatus,
  movieReleaseSentence,
  platformChangeSentence,
  relativeDay,
  releasedEpisodeSentence,
  seasonPremiereSentence,
  selectUpNextRail,
  statusChangeSentence,
  totalWatchedRuntime,
  type AnnouncementCandidate,
  type RecentEpisodeCandidate,
  type SeasonEpisodeCandidate,
  type SeasonFirstSeenCandidate,
  type UpdateEventCandidate,
  type UpdatesFeedRow,
  type UpNextRailCandidate,
} from './watchlist-utils';
import type { Episode, Season } from './WatchlistContext';

const episode = (overrides: Partial<Episode> = {}): Episode => ({
  episode_number: 1,
  title: 'An episode',
  ...overrides,
});

const season = (episodes: Episode[]): Season => ({
  season_number: 1,
  episodes,
});

describe('formatRuntime', () => {
  it('drops the hours segment under an hour', () => {
    expect(formatRuntime(45)).toBe('45m');
  });

  it('splits into hours and minutes above an hour', () => {
    expect(formatRuntime(154)).toBe('2h 34m');
  });

  it('keeps the zero-minute segment on a whole number of hours', () => {
    expect(formatRuntime(120)).toBe('2h 0m');
  });

  // A missing runtime renders nothing rather than "0m", so the card does not
  // claim a length TMDB never gave us.
  it('renders nothing when the runtime is missing or zero', () => {
    expect(formatRuntime(undefined)).toBe('');
    expect(formatRuntime(0)).toBe('');
  });
});

describe('isUpcomingStatus', () => {
  it('matches the generated countdown regardless of case', () => {
    expect(isUpcomingStatus('releases in 3 days')).toBe(true);
    expect(isUpcomingStatus('S2 Releases In 46 days')).toBe(true);
  });

  it('matches the literal Coming Soon status', () => {
    expect(isUpcomingStatus('Coming Soon')).toBe(true);
  });

  it('rejects settled statuses and absent ones', () => {
    expect(isUpcomingStatus('Watched')).toBe(false);
    expect(isUpcomingStatus('Released')).toBe(false);
    expect(isUpcomingStatus(undefined)).toBe(false);
  });
});

describe('displayTitle', () => {
  it('strips a trailing year that duplicates the one already shown', () => {
    expect(displayTitle("Hell's Paradise (2023)", 2023)).toBe("Hell's Paradise");
  });

  it('keeps a year that disagrees with the item year', () => {
    expect(displayTitle('Dune (1984)', 2021)).toBe('Dune (1984)');
  });

  it('leaves the title alone when there is no year to compare against', () => {
    expect(displayTitle('Dune (1984)')).toBe('Dune (1984)');
    expect(displayTitle('Dune (1984)', null)).toBe('Dune (1984)');
  });

  // Only a trailing year is a TMDB disambiguator; one mid-title is part of
  // the name.
  it('only strips the year at the end', () => {
    expect(displayTitle('(2023) Retrospective', 2023)).toBe('(2023) Retrospective');
  });
});

describe('compactUpcomingStatus', () => {
  it('shortens a countdown to fit one line', () => {
    expect(compactUpcomingStatus('S1 releases in 46 days')).toBe('S1 in 46d');
  });

  // A film has no season prefix, so the compacted form has to supply its own
  // subject -- "in 1d" alone says nothing outside the Upcoming tab.
  it('names the subject when there is no season prefix', () => {
    expect(compactUpcomingStatus('releases in 1 day')).toBe('Out in 1d');
    expect(compactUpcomingStatus('releases in 33 days')).toBe('Out in 33d');
  });

  it('leaves Coming Soon untouched', () => {
    expect(compactUpcomingStatus('Coming Soon')).toBe('Coming Soon');
  });
});

describe('getStatusColor', () => {
  // A dated countdown reads at full strength outside the Upcoming tab, where
  // it sits alone among filled label pills; an undated "Coming Soon" has
  // nothing to read, so it stays in the faint tier.
  it('gives a dated countdown the foreground, not the muted tier', () => {
    expect(getStatusColor('S2 releases in 136 days')).toContain(
      'text-foreground',
    );
    expect(getStatusColor('Coming Soon')).toContain('text-muted-foreground');
  });

  it('keeps every tier free of hue', () => {
    for (const status of [
      'Watching',
      'To Watch',
      'Watched',
      'Coming Soon',
      'releases in 3 days',
    ]) {
      expect(getStatusColor(status)).not.toMatch(
        /(red|orange|amber|green|blue|purple|pink)-/,
      );
    }
  });
});

describe('daysUntil', () => {
  const today = new Date('2026-09-12T15:00:00');

  it('returns a negative count for a date in the past', () => {
    expect(daysUntil('2026-09-05', today)).toBe(-7);
  });

  it('returns zero for today, regardless of the time of day', () => {
    expect(daysUntil('2026-09-12', today)).toBe(0);
  });

  it('returns a positive count for a date in the future', () => {
    expect(daysUntil('2026-09-19', today)).toBe(7);
  });

  it('returns null for a null or missing date', () => {
    expect(daysUntil(null, today)).toBeNull();
    expect(daysUntil(undefined, today)).toBeNull();
  });
});

describe('selectUpNextRail', () => {
  const today = new Date('2026-09-12T00:00:00');

  const row = (overrides: Partial<UpNextRailCandidate> = {}): UpNextRailCandidate => ({
    state: 'ready',
    release_date: '2026-09-12',
    season_in_progress: false,
    ...overrides,
  });

  it('includes a row exactly 14 days old', () => {
    const result = selectUpNextRail([row({ release_date: '2026-08-29' })], today);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('New');
  });

  it('excludes a row 15 days old', () => {
    const result = selectUpNextRail([row({ release_date: '2026-08-28' })], today);
    expect(result).toHaveLength(0);
  });

  it('excludes a ready row with no release date', () => {
    const result = selectUpNextRail([row({ release_date: null })], today);
    expect(result).toHaveLength(0);
  });

  it('excludes an upcoming row with a recent date -- it has not aired', () => {
    const result = selectUpNextRail(
      [row({ state: 'upcoming', release_date: '2026-09-10' })],
      today,
    );
    expect(result).toHaveLength(0);
  });

  it('includes a season-in-progress row with a two-year-old air date', () => {
    const result = selectUpNextRail(
      [row({ season_in_progress: true, release_date: '2024-01-01' })],
      today,
    );
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('Continue');
  });

  it('sorts continuing rows before just-dropped ones, and just-dropped rows newest first', () => {
    const result = selectUpNextRail(
      [
        row({ release_date: '2026-09-01' }), // New, older
        row({ season_in_progress: true, release_date: '2020-01-01' }), // Continue
        row({ release_date: '2026-09-10' }), // New, newer
      ],
      today,
    );
    expect(result.map((r) => r.reason)).toEqual(['Continue', 'New', 'New']);
    expect(result[1].release_date).toBe('2026-09-10');
    expect(result[2].release_date).toBe('2026-09-01');
  });
});

describe('totalWatchedRuntime', () => {
  it('sums runtime across watched episodes only', () => {
    const watchlist = [
      {
        seasons: [
          season([
            episode({ episode_number: 1, runtime: 45, watched: true }),
            episode({ episode_number: 2, runtime: 50, watched: false }),
          ]),
        ],
      },
    ];
    expect(totalWatchedRuntime(watchlist)).toBe(45);
  });

  it('sums across every season and every show', () => {
    const watchlist = [
      {
        seasons: [
          season([episode({ runtime: 30, watched: true })]),
          season([episode({ runtime: 40, watched: true })]),
        ],
      },
      {
        seasons: [season([episode({ runtime: 25, watched: true })])],
      },
    ];
    expect(totalWatchedRuntime(watchlist)).toBe(95);
  });

  // A watched episode with no stored runtime must contribute zero, not NaN.
  it('treats a missing runtime on a watched episode as zero', () => {
    const watchlist = [
      {
        seasons: [
          season([
            episode({ runtime: undefined, watched: true }),
            episode({ episode_number: 2, runtime: 20, watched: true }),
          ]),
        ],
      },
    ];
    expect(totalWatchedRuntime(watchlist)).toBe(20);
    expect(Number.isNaN(totalWatchedRuntime(watchlist))).toBe(false);
  });

  it('returns zero for items with no seasons at all, e.g. movies', () => {
    expect(totalWatchedRuntime([{ seasons: undefined }])).toBe(0);
  });

  it('returns zero for an empty watchlist', () => {
    expect(totalWatchedRuntime([])).toBe(0);
  });
});

describe('isSpecialsSeason', () => {
  it('treats season 0 as specials', () => {
    expect(isSpecialsSeason(0)).toBe(true);
  });

  it('treats any real season as not specials', () => {
    expect(isSpecialsSeason(1)).toBe(false);
    expect(isSpecialsSeason(4)).toBe(false);
  });
});

describe('isPremiereEpisode', () => {
  it('treats episode 1 of a real season as a premiere', () => {
    expect(isPremiereEpisode(1, 1)).toBe(true);
  });

  it('treats a mid-season episode as not a premiere', () => {
    expect(isPremiereEpisode(2, 1)).toBe(false);
    expect(isPremiereEpisode(7, 1)).toBe(false);
  });

  // TMDB files specials, extras and behind-the-scenes under season 0; episode
  // 1 there is not a real premiere.
  it('treats a season-0 episode 1 as not a premiere', () => {
    expect(isPremiereEpisode(1, 0)).toBe(false);
  });
});

describe('isSeasonFinished', () => {
  const today = new Date('2026-09-14T00:00:00');

  const aired = (overrides: Partial<SeasonEpisodeCandidate> = {}): SeasonEpisodeCandidate => ({
    release_date: '2026-09-01',
    watched: true,
    ...overrides,
  });

  it('is finished when every aired episode is watched', () => {
    expect(
      isSeasonFinished(
        [aired({ release_date: '2026-09-01' }), aired({ release_date: '2026-09-08' })],
        today,
      ),
    ).toBe(true);
  });

  it('is not finished when one aired episode is unwatched', () => {
    expect(
      isSeasonFinished(
        [aired({ release_date: '2026-09-01' }), aired({ release_date: '2026-09-08', watched: false })],
        today,
      ),
    ).toBe(false);
  });

  it('is not finished when nothing has aired yet', () => {
    expect(
      isSeasonFinished([aired({ release_date: '2026-09-20', watched: false })], today),
    ).toBe(false);
  });

  it('does not let a future unaired episode count against an otherwise finished season', () => {
    expect(
      isSeasonFinished(
        [
          aired({ release_date: '2026-09-01', watched: true }),
          aired({ release_date: '2026-09-20', watched: false }),
        ],
        today,
      ),
    ).toBe(true);
  });
});

describe('seasonPremiereSentence', () => {
  it('says today at the zero-day boundary', () => {
    expect(seasonPremiereSentence(5, 0)).toBe('Season 5 starts today');
  });

  it('says tomorrow at the one-day boundary', () => {
    expect(seasonPremiereSentence(5, 1)).toBe('Season 5 starts tomorrow');
  });

  it('counts the days beyond tomorrow', () => {
    expect(seasonPremiereSentence(5, 3)).toBe('Season 5 starts in 3 days');
  });
});

describe('movieReleaseSentence', () => {
  it('says today and tomorrow at their boundaries', () => {
    expect(movieReleaseSentence(0, '2026-09-13')).toBe('Releases today');
    expect(movieReleaseSentence(1, '2026-09-14')).toBe('Releases tomorrow');
  });

  it('counts the days within the relative window', () => {
    expect(movieReleaseSentence(13, '2026-09-26')).toBe('Releases in 13 days');
    expect(movieReleaseSentence(30, '2026-10-13')).toBe('Releases in 30 days');
  });

  it('falls back to the absolute date beyond the relative window', () => {
    expect(movieReleaseSentence(31, '2026-10-14')).toBe('Releases 14 October');
    expect(movieReleaseSentence(200, '2026-04-06')).toBe('Releases 6 April');
  });
});

describe('platformChangeSentence', () => {
  it('names both sides of a move as an arrow', () => {
    expect(platformChangeSentence('Netflix', 'Disney+')).toBe('Netflix → Disney+');
  });

  it('says only the new platform when there was none before', () => {
    expect(platformChangeSentence(null, 'Disney+')).toBe('Now on Disney+');
  });

  it('says only the old platform when there is no new one', () => {
    expect(platformChangeSentence('Netflix', null)).toBe('Left Netflix');
  });

  it('returns null when neither side is known', () => {
    expect(platformChangeSentence(null, null)).toBeNull();
  });
});

describe('statusChangeSentence', () => {
  it('returns just the mapped label when the destination is known', () => {
    expect(statusChangeSentence('Returning Series', 'Ended')).toBe('Ended');
  });

  it('ignores an unmapped source when the destination is known', () => {
    expect(statusChangeSentence('Planned', 'In Production')).toBe('In production');
  });

  it('normalises both Canceled and Cancelled spellings to the same label', () => {
    expect(statusChangeSentence('Returning Series', 'Canceled')).toBe('Cancelled');
    expect(statusChangeSentence('Returning Series', 'Cancelled')).toBe('Cancelled');
  });

  it('maps Returning Series to the short Returning label as a destination', () => {
    expect(statusChangeSentence('Ended', 'Returning Series')).toBe('Returning');
  });

  it('reads a null destination as Unknown, since null is never a known destination', () => {
    expect(statusChangeSentence('Returning Series', null)).toBe('Returning → Unknown');
  });

  it('falls back to the arrow form when the destination is unmapped', () => {
    expect(statusChangeSentence('Returning Series', 'Planned')).toBe('Returning → Planned');
  });

  it('ignores a missing source when the destination alone resolves the sentence', () => {
    expect(statusChangeSentence(null, 'Ended')).toBe('Ended');
  });
});

describe('groupRecentEpisodesByShow', () => {
  const ep = (overrides: Partial<RecentEpisodeCandidate> = {}): RecentEpisodeCandidate => ({
    tv_show_id: 1,
    title: 'Stranger Things',
    poster: '/poster.jpg',
    platform: 'Netflix',
    season_number: 1,
    episode_number: 1,
    episode_title: null,
    release_date: '2026-09-01',
    watched: false,
    ...overrides,
  });

  it('names the single episode, nothing else -- the date is a separate column', () => {
    const groups = groupRecentEpisodesByShow([
      ep({ season_number: 3, episode_number: 7, release_date: '2026-09-13' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].sentence).toBe('S3E7');
  });

  it('folds several episodes of the same show into one card naming only the latest', () => {
    const groups = groupRecentEpisodesByShow([
      ep({ episode_number: 3, release_date: '2026-09-01' }),
      ep({ episode_number: 5, release_date: '2026-09-12' }),
      ep({ episode_number: 4, release_date: '2026-09-05' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].sentence).toBe('S1E5');
    expect(groups[0].latest_release_date).toBe('2026-09-12');
  });

  it('keeps shows separate and orders groups by their newest episode', () => {
    const groups = groupRecentEpisodesByShow([
      ep({ tv_show_id: 1, release_date: '2026-09-01' }),
      ep({ tv_show_id: 2, title: 'The Bear', release_date: '2026-09-10' }),
    ]);
    expect(groups.map((g) => g.title)).toEqual(['The Bear', 'Stranger Things']);
  });

  it('carries the show platform through', () => {
    const groups = groupRecentEpisodesByShow([ep({ platform: 'Disney+' })]);
    expect(groups[0].platform).toBe('Disney+');
  });

  // Adults / Lioness: a show whose latest released episode is already
  // watched is caught up, not news.
  it('drops a show whose latest released episode is already watched', () => {
    const groups = groupRecentEpisodesByShow([
      ep({ episode_number: 3, release_date: '2026-09-01', watched: true }),
      ep({ episode_number: 5, release_date: '2026-09-12', watched: true }),
    ]);
    expect(groups).toHaveLength(0);
  });

  it('keeps a show whose latest episode is unwatched even if an earlier one is watched', () => {
    const groups = groupRecentEpisodesByShow([
      ep({ episode_number: 3, release_date: '2026-09-01', watched: true }),
      ep({ episode_number: 5, release_date: '2026-09-12', watched: false }),
    ]);
    expect(groups).toHaveLength(1);
  });
});

describe('releasedEpisodeSentence', () => {
  it('names the episode and its title when the title is a real one', () => {
    expect(
      releasedEpisodeSentence({ season_number: 1, episode_number: 6, episode_title: 'The Reunion' }),
    ).toBe('S1E6 · The Reunion');
  });

  it('drops a missing title', () => {
    expect(
      releasedEpisodeSentence({ season_number: 1, episode_number: 6, episode_title: null }),
    ).toBe('S1E6');
  });

  it('drops a generic "Episode N" title', () => {
    expect(
      releasedEpisodeSentence({ season_number: 1, episode_number: 6, episode_title: 'Episode 6' }),
    ).toBe('S1E6');
    expect(
      releasedEpisodeSentence({ season_number: 1, episode_number: 6, episode_title: 'episode 6' }),
    ).toBe('S1E6');
  });
});

describe('computeFirstSeenAt', () => {
  const s = (overrides: Partial<SeasonFirstSeenCandidate> = {}): SeasonFirstSeenCandidate => ({
    tv_show_id: 1,
    created_at: '2026-09-13T22:24:00Z',
    ...overrides,
  });

  it('takes the earliest created_at across a show\'s seasons', () => {
    const result = computeFirstSeenAt([
      s({ created_at: '2026-09-13T22:26:00Z' }),
      s({ created_at: '2026-09-13T22:24:00Z' }),
      s({ created_at: '2026-09-13T22:25:00Z' }),
    ]);
    expect(result.get(1)).toBe('2026-09-13T22:24:00Z');
  });

  it('treats any null-created season as the show predating tracking entirely', () => {
    const result = computeFirstSeenAt([
      s({ created_at: '2026-09-13T22:24:00Z' }),
      s({ created_at: null }),
    ]);
    expect(result.get(1)).toBeNull();
  });

  it('keeps shows separate', () => {
    const result = computeFirstSeenAt([
      s({ tv_show_id: 1, created_at: '2026-09-01T00:00:00Z' }),
      s({ tv_show_id: 2, created_at: null }),
    ]);
    expect(result.get(1)).toBe('2026-09-01T00:00:00Z');
    expect(result.get(2)).toBeNull();
  });
});

describe('isAnnouncement', () => {
  it('is not an announcement in the same batch as the show\'s first appearance', () => {
    expect(isAnnouncement('2026-09-13T22:26:00Z', '2026-09-13T22:24:00Z')).toBe(false);
  });

  it('is an announcement two hours after first-seen', () => {
    expect(isAnnouncement('2026-09-14T00:24:00Z', '2026-09-13T22:24:00Z')).toBe(true);
  });

  it('lets any non-null row count when the show predates tracking (null first-seen)', () => {
    expect(isAnnouncement('2026-09-13T22:24:00Z', null)).toBe(true);
  });

  // Exactly one hour is treated as still the same batch, not an
  // announcement -- the margin is closed on the near side.
  it('treats exactly one hour after first-seen as not yet an announcement', () => {
    expect(isAnnouncement('2026-09-13T23:24:00Z', '2026-09-13T22:24:00Z')).toBe(false);
  });
});

describe('groupAnnouncementsByShow', () => {
  const today = new Date('2026-09-14T00:00:00Z');

  const item = (overrides: Partial<AnnouncementCandidate> = {}): AnnouncementCandidate => ({
    kind: 'episode',
    tv_show_id: 1,
    title: 'Stranger Things',
    poster: '/poster.jpg',
    platform: 'Netflix',
    season_number: 1,
    episode_number: 1,
    episode_title: null,
    release_date: '2026-09-01',
    created_at: '2026-09-01T00:00:00Z',
    ...overrides,
  });

  // The Cleaning Lady case: a show's whole back catalogue lands in one
  // batch when it is added, and none of it is an announcement.
  it('produces no announcement for a show added in one batch', () => {
    const firstSeenByShow = new Map([[1, '2026-09-13T22:24:00Z']]);
    const groups = groupAnnouncementsByShow(
      [
        item({ kind: 'season', season_number: 1, episode_number: undefined, created_at: '2026-09-13T22:24:00Z' }),
        item({ kind: 'season', season_number: 2, episode_number: undefined, created_at: '2026-09-13T22:24:30Z' }),
        item({ episode_number: 3, created_at: '2026-09-13T22:25:00Z' }),
      ],
      firstSeenByShow,
      today,
    );
    expect(groups).toHaveLength(0);
  });

  it('names the highest season number in a season announcement', () => {
    const firstSeenByShow = new Map([[1, '2026-09-01T00:00:00Z']]);
    const groups = groupAnnouncementsByShow(
      [
        item({ kind: 'season', season_number: 2, episode_number: undefined, created_at: '2026-09-13T10:00:00Z' }),
        item({ kind: 'season', season_number: 3, episode_number: undefined, created_at: '2026-09-13T10:05:00Z' }),
      ],
      firstSeenByShow,
      today,
    );
    expect(groups[0].sentence).toBe('Season 3 announced');
  });

  it('names the latest episode as scheduled when its release date is still ahead', () => {
    const firstSeenByShow = new Map([[1, '2026-09-01T00:00:00Z']]);
    const groups = groupAnnouncementsByShow(
      [item({ season_number: 2, episode_number: 9, release_date: '2026-09-20', created_at: '2026-09-13T10:00:00Z' })],
      firstSeenByShow,
      today,
    );
    expect(groups[0].sentence).toBe('S2E9 scheduled for 20 Sep');
  });

  it('names the latest episode as added when its release date has already passed', () => {
    const firstSeenByShow = new Map([[1, '2026-09-01T00:00:00Z']]);
    const groups = groupAnnouncementsByShow(
      [item({ season_number: 2, episode_number: 9, release_date: '2026-09-01', created_at: '2026-09-13T10:00:00Z' })],
      firstSeenByShow,
      today,
    );
    expect(groups[0].sentence).toBe('S2E9 added');
  });

  // TMDB files specials, extras and behind-the-scenes under season 0 -- not
  // news, so a season-0 row never contributes to a show's announcement group.
  it('excludes season-0 rows from a show that also has real announcements', () => {
    const firstSeenByShow = new Map([[1, '2026-09-01T00:00:00Z']]);
    const groups = groupAnnouncementsByShow(
      [
        item({ season_number: 0, episode_number: 1, created_at: '2026-09-13T10:00:00Z' }),
        item({ season_number: 2, episode_number: 1, created_at: '2026-09-13T09:00:00Z' }),
      ],
      firstSeenByShow,
      today,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].sentence).toBe('S2E1 added');
  });

  it('produces no group at all for a show whose only announcements are season 0', () => {
    const firstSeenByShow = new Map([[1, '2026-09-01T00:00:00Z']]);
    const groups = groupAnnouncementsByShow(
      [
        item({ kind: 'season', season_number: 0, episode_number: undefined, created_at: '2026-09-13T10:00:00Z' }),
        item({ season_number: 0, episode_number: 1, created_at: '2026-09-13T10:00:00Z' }),
      ],
      firstSeenByShow,
      today,
    );
    expect(groups).toHaveLength(0);
  });

  it('sorts shows by their newest announcement, newest first', () => {
    const firstSeenByShow = new Map([
      [1, '2026-09-01T00:00:00Z'],
      [2, '2026-09-01T00:00:00Z'],
    ]);
    const groups = groupAnnouncementsByShow(
      [
        item({ tv_show_id: 1, created_at: '2026-09-10T10:00:00Z' }),
        item({ tv_show_id: 2, title: 'The Bear', created_at: '2026-09-13T10:00:00Z' }),
      ],
      firstSeenByShow,
      today,
    );
    expect(groups.map((g) => g.title)).toEqual(['The Bear', 'Stranger Things']);
  });
});

describe('relativeDay', () => {
  const today = new Date('2026-09-14T12:00:00');

  it('says today at the zero-day boundary', () => {
    expect(relativeDay('2026-09-14', today)).toBe('today');
  });

  it('says yesterday one day back', () => {
    expect(relativeDay('2026-09-13', today)).toBe('yesterday');
  });

  it('counts days back up to six', () => {
    expect(relativeDay('2026-09-12', today)).toBe('2d');
    expect(relativeDay('2026-09-08', today)).toBe('6d');
  });

  it('falls back to a short date seven or more days back', () => {
    expect(relativeDay('2026-09-07', today)).toBe('7 Sep');
  });

  it('falls back to a short date for any future date', () => {
    expect(relativeDay('2026-09-15', today)).toBe('15 Sep');
    expect(relativeDay('2026-10-01', today)).toBe('1 Oct');
  });

  it('reads only the calendar-day prefix of a full timestamp', () => {
    expect(relativeDay('2026-09-14T22:24:00Z', today)).toBe('today');
  });
});

describe('buildUpdatesFeed', () => {
  const today = new Date('2026-09-14T00:00:00Z');

  const releasedRow = (overrides: Partial<Parameters<typeof buildUpdatesFeed>[0][number]> = {}) => ({
    tv_show_id: 1,
    title: 'Stranger Things',
    poster: '/st.jpg',
    platform: 'Netflix',
    sentence: 'S3E7',
    latest_release_date: '2026-09-13',
    ...overrides,
  });

  const eventRow = (overrides: Partial<UpdateEventCandidate> = {}): UpdateEventCandidate => ({
    entity_type: 'movie',
    entity_id: 2,
    kind: 'platform_change',
    occurred_at: '2026-09-13T10:00:00Z',
    payload: { from: 'Netflix', to: 'Disney+' },
    title: '27 Dresses',
    poster: '/27.jpg',
    platform: 'Disney+',
    ...overrides,
  });

  const announcedRow = (overrides: Partial<Parameters<typeof buildUpdatesFeed>[2][number]> = {}) => ({
    tv_show_id: 3,
    title: 'Slow Horses',
    poster: '/sh.jpg',
    platform: 'Apple TV+',
    sentence: 'Season 6 announced',
    latest_created_at: '2026-09-12T09:00:00Z',
    ...overrides,
  });

  it('merges the three sources newest first', () => {
    const rows = buildUpdatesFeed(
      [releasedRow({ latest_release_date: '2026-09-13' })],
      [eventRow({ occurred_at: '2026-09-14T08:00:00Z' })],
      [announcedRow({ latest_created_at: '2026-09-12T09:00:00Z' })],
      today,
    );
    expect(rows.map((r) => r.kind)).toEqual(['platform', 'released', 'announced']);
  });

  it('builds a platform and a status row from the same event source, by kind', () => {
    const rows = buildUpdatesFeed(
      [],
      [
        eventRow({ kind: 'platform_change', payload: { from: 'Netflix', to: 'Disney+' } }),
        eventRow({
          entity_type: 'tv_show',
          entity_id: 9,
          kind: 'status_change',
          payload: { from: 'Returning Series', to: 'Ended' },
          title: 'Last Samurai',
        }),
      ],
      [],
      today,
    );
    expect(rows.map((r) => r.kind).sort()).toEqual(['platform', 'status']);
    expect(rows.find((r) => r.kind === 'status')?.sentence).toBe('Ended');
  });

  it('breaks a same-day tie by kind, then title', () => {
    const rows = buildUpdatesFeed(
      [releasedRow({ tv_show_id: 1, title: 'Four Hands', latest_release_date: '2026-09-13' })],
      [
        eventRow({
          entity_type: 'tv_show',
          entity_id: 1,
          occurred_at: '2026-09-13T00:00:00Z',
        }),
      ],
      [announcedRow({ tv_show_id: 1, latest_created_at: '2026-09-13T00:00:00Z' })],
      today,
    );
    expect(rows.map((r) => r.kind)).toEqual(['released', 'platform', 'announced']);
  });

  // TV and movie ids collide, so a key built from id and kind alone is not
  // enough -- entityType has to be in it too.
  it('keeps a TV show and a movie with the same id and kind as distinct rows', () => {
    const rows = buildUpdatesFeed(
      [],
      [
        eventRow({ entity_type: 'movie', entity_id: 5, title: 'Movie Five' }),
        eventRow({ entity_type: 'tv_show', entity_id: 5, title: 'Show Five' }),
      ],
      [],
      today,
    );
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });

  it('gives a show two rows when it is both released and announced', () => {
    const rows = buildUpdatesFeed(
      [releasedRow({ tv_show_id: 1 })],
      [],
      [announcedRow({ tv_show_id: 1 })],
      today,
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });

  it('drops an event whose sentence is null, e.g. a platform change with neither side known', () => {
    const rows = buildUpdatesFeed(
      [],
      [eventRow({ payload: { from: null, to: null } })],
      [],
      today,
    );
    expect(rows).toHaveLength(0);
  });

  it('returns an empty feed when every source is empty', () => {
    expect(buildUpdatesFeed([], [], [], today)).toEqual([]);
  });
});

describe('filterUpdatesByWindow', () => {
  const today = new Date('2026-09-14T00:00:00Z');

  const row = (overrides: Partial<UpdatesFeedRow> = {}): UpdatesFeedRow => ({
    key: 'released-tv_show-1',
    kind: 'released',
    entityType: 'tv_show',
    entityId: 1,
    title: 'Stranger Things',
    poster: null,
    platform: 'Netflix',
    sentence: 'S1E1',
    occurredAt: '2026-09-14',
    ...overrides,
  });

  it('keeps a row from today in either window', () => {
    expect(filterUpdatesByWindow([row({ occurredAt: '2026-09-14' })], 'week', today)).toHaveLength(1);
    expect(filterUpdatesByWindow([row({ occurredAt: '2026-09-14' })], 'month', today)).toHaveLength(1);
  });

  it('drops an 8-day-old row from "This week" but keeps it in "Past month"', () => {
    const rows = [row({ occurredAt: '2026-09-06' })];
    expect(filterUpdatesByWindow(rows, 'week', today)).toHaveLength(0);
    expect(filterUpdatesByWindow(rows, 'month', today)).toHaveLength(1);
  });

  it('drops a 31-day-old row from both windows', () => {
    const rows = [row({ occurredAt: '2026-08-14' })];
    expect(filterUpdatesByWindow(rows, 'week', today)).toHaveLength(0);
    expect(filterUpdatesByWindow(rows, 'month', today)).toHaveLength(0);
  });

  it('drops a future row', () => {
    expect(filterUpdatesByWindow([row({ occurredAt: '2026-09-15' })], 'month', today)).toHaveLength(0);
  });

  it('reads only the calendar-day prefix of a full timestamp', () => {
    expect(
      filterUpdatesByWindow([row({ occurredAt: '2026-09-14T22:00:00Z' })], 'week', today),
    ).toHaveLength(1);
  });
});

describe('filterUpcomingByWindow', () => {
  const today = new Date('2026-09-14T00:00:00Z');
  const row = (date: string | null) => ({ date });

  it('keeps a release today in either window', () => {
    expect(filterUpcomingByWindow([row('2026-09-14')], 'week', today)).toHaveLength(1);
    expect(filterUpcomingByWindow([row('2026-09-14')], 'month', today)).toHaveLength(1);
  });

  it('keeps the last day inside the week window and drops the first day outside it', () => {
    expect(filterUpcomingByWindow([row('2026-09-21')], 'week', today)).toHaveLength(1);
    expect(filterUpcomingByWindow([row('2026-09-22')], 'week', today)).toHaveLength(0);
  });

  it('keeps the last day inside the month window and drops the first day outside it', () => {
    expect(filterUpcomingByWindow([row('2026-10-14')], 'month', today)).toHaveLength(1);
    expect(filterUpcomingByWindow([row('2026-10-15')], 'month', today)).toHaveLength(0);
  });

  it('drops a past date', () => {
    expect(filterUpcomingByWindow([row('2026-09-13')], 'month', today)).toHaveLength(0);
  });

  it('drops a null date', () => {
    expect(filterUpcomingByWindow([row(null)], 'month', today)).toHaveLength(0);
  });

  it('keeps a 10-day-out release in "This month" but not "This week"', () => {
    const rows = [row('2026-09-24')];
    expect(filterUpcomingByWindow(rows, 'week', today)).toHaveLength(0);
    expect(filterUpcomingByWindow(rows, 'month', today)).toHaveLength(1);
  });
});

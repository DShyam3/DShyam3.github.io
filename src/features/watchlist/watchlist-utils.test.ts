import { describe, it, expect } from 'vitest';
import {
  compactUpcomingStatus,
  displayTitle,
  formatRuntime,
  getStatusColor,
  isUpcomingStatus,
} from './watchlist-utils';

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

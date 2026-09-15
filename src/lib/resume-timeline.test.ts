import { describe, it, expect } from 'vitest';
import { buildResumeTimeline, monthIndex } from './resume-timeline';

describe('monthIndex', () => {
  it('parses a full month name and year', () => {
    expect(monthIndex('May 2025')).toBe(2025 * 12 + 4);
    expect(monthIndex('September 2020')).toBe(2020 * 12 + 8);
  });

  it('parses a three-letter or dotted abbreviation, any case', () => {
    expect(monthIndex('sep 2024')).toBe(2024 * 12 + 8);
    expect(monthIndex('Sept. 2024')).toBe(2024 * 12 + 8);
    expect(monthIndex('JUN 2022')).toBe(2022 * 12 + 5);
  });

  it('counts a bare year as January', () => {
    expect(monthIndex('2019')).toBe(2019 * 12);
  });

  it('returns null for what it cannot place', () => {
    expect(monthIndex('Ma 2025')).toBeNull();
    expect(monthIndex('Present')).toBeNull();
    expect(monthIndex('Smarch 2025')).toBeNull();
    expect(monthIndex('')).toBeNull();
    expect(monthIndex(undefined)).toBeNull();
  });
});

describe('buildResumeTimeline', () => {
  const exp = (id: string, start_date: string) => ({ id, start_date });
  const edu = (id: string, start_date: string) => ({ id, start_date });
  const ids = (list: { item: { id: string } }[]) => list.map((e) => e.item.id);

  it('interleaves roles and degrees newest first', () => {
    const timeline = buildResumeTimeline(
      [
        exp('ocean', 'June 2026'),
        exp('airbus', 'November 2025'),
        exp('lodestar', 'May 2025'),
        exp('keysight', 'June 2022'),
      ],
      [edu('ucl', 'September 2024'), edu('plymouth', 'September 2020')],
    );
    expect(ids(timeline)).toEqual([
      'ocean',
      'airbus',
      'lodestar',
      'ucl',
      'keysight',
      'plymouth',
    ]);
    expect(timeline.map((e) => e.kind)).toEqual([
      'experience',
      'experience',
      'experience',
      'education',
      'experience',
      'education',
    ]);
  });

  it('puts experience ahead of education when both start the same month', () => {
    const timeline = buildResumeTimeline(
      [exp('job', 'September 2024')],
      [edu('degree', 'September 2024')],
    );
    expect(ids(timeline)).toEqual(['job', 'degree']);
  });

  it('sorts undated rows last, in stored order', () => {
    const timeline = buildResumeTimeline(
      [exp('typo', 'Ma 2025'), exp('dated', 'January 2020'), exp('blank', '')],
      [edu('recent', 'March 2023')],
    );
    expect(ids(timeline)).toEqual(['recent', 'dated', 'typo', 'blank']);
  });

  it('handles empty lists', () => {
    expect(buildResumeTimeline([], [])).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { takeTurns } from './discovery';
import {
  MIN_CREDIT_VOTES,
  PEOPLE_PER_ROLE,
  TITLES_PER_PERSON,
  historyPeople,
  matchPerson,
  personHistoryItems,
  type HistoryPerson,
  type PersonCreditEntry,
  type WatchedFilmCredits,
} from './history-sources';

const film = (directors: string[] | null, cast: string[] = []): WatchedFilmCredits => ({ directors, top_cast: cast });
const times = (n: number, make: () => WatchedFilmCredits) => Array.from({ length: n }, make);

describe('historyPeople', () => {
  it('counts each person once per watched film and keeps only real patterns', () => {
    const films = [
      ...times(3, () => film(['Christopher Nolan', ' Christopher  Nolan '], ['Michael Caine', 'Michael Caine'])),
      ...times(2, () => film(['Greta Gerwig'])),
      film([], ['Michael Caine']),
      film(null),
      // Three films is not yet a pattern for an actor.
      ...times(3, () => film([], ['Cillian Murphy'])),
    ];
    expect(historyPeople(films, 0)).toEqual([
      { name: 'Christopher Nolan', role: 'director', watched: 3 },
      { name: 'Michael Caine', role: 'actor', watched: 4 },
    ]);
  });

  it('rotates weekly through the most watched, breaking ties by name', () => {
    // Six directors; Ben and Ava tie on 8 films, so Ava leads.
    const counts: [string, number][] = [['Ben', 8], ['Ava', 8], ['Cat', 6], ['Dan', 5], ['Eve', 4], ['Fay', 3]];
    const films = counts.flatMap(([name, n]) => times(n, () => film([name])));
    const week = (n: number) => historyPeople(films, n).map((person) => person.name);
    expect(week(0)).toEqual(['Ava', 'Ben', 'Cat', 'Dan']);
    expect(week(1)).toEqual(['Eve', 'Fay', 'Ava', 'Ben']);
    expect(week(2)).toEqual(['Cat', 'Dan', 'Eve', 'Fay']);
    expect(week(0)).toHaveLength(PEOPLE_PER_ROLE);
  });

  it('rotates only through the twelve most watched', () => {
    const films = Array.from({ length: 13 }, (_, i) => times(30 - i, () => film([`Director ${String(i).padStart(2, '0')}`]))).flat();
    const seen = new Set(Array.from({ length: 12 }, (_, week) => historyPeople(films, week).map((person) => person.name)).flat());
    expect(seen.size).toBe(12);
    expect(seen.has('Director 12')).toBe(false);
  });
});

describe('matchPerson', () => {
  const nolan: HistoryPerson = { name: 'Christopher Nolan', role: 'director', watched: 5 };

  it('takes an exact name, preferring the stored department', () => {
    const results = [
      { id: 1, name: 'Christopher Nolan', known_for_department: 'Acting' },
      { id: 2, name: 'christopher nolan', known_for_department: 'Directing' },
    ];
    expect(matchPerson(results, nolan)?.id).toBe(2);
  });

  it('falls back to the first exact match when no department fits', () => {
    const results = [
      { id: 7, name: 'Christopher Nolan', known_for_department: 'Writing' },
      { id: 8, name: 'Christopher Nolan', known_for_department: 'Acting' },
    ];
    expect(matchPerson(results, nolan)?.id).toBe(7);
  });

  it('never settles for the nearest name', () => {
    expect(matchPerson([{ id: 3, name: 'Christopher Nolan Jr', known_for_department: 'Directing' }], nolan)).toBeNull();
  });
});

describe('personHistoryItems', () => {
  const today = '2026-11-22';
  const entry = (over: Partial<PersonCreditEntry>): PersonCreditEntry => ({
    id: 1, media_type: 'movie', title: 'A film', release_date: '2010-07-16', vote_count: MIN_CREDIT_VOTES, ...over,
  });

  it('keeps a director\'s well-known released films, most voted first', () => {
    const director: HistoryPerson = { name: 'Christopher Nolan', role: 'director', watched: 5 };
    const items = personHistoryItems(director, {
      crew: [
        entry({ id: 1, title: 'Inception', vote_count: 38000, job: 'Director' }),
        entry({ id: 1, title: 'Inception', vote_count: 38000, job: 'Writer' }),
        entry({ id: 2, title: 'Memento', vote_count: 15000, job: 'Director' }),
        entry({ id: 3, title: 'Produced only', vote_count: 20000, job: 'Producer' }),
        entry({ id: 4, title: 'Obscure', vote_count: MIN_CREDIT_VOTES - 1, job: 'Director' }),
        entry({ id: 5, title: 'Next year', release_date: '2027-07-17', job: 'Director' }),
        entry({ id: 6, title: 'A series', media_type: 'tv', vote_count: 30000, job: 'Director' }),
        entry({ id: 7, title: 'Out today', release_date: today, vote_count: 1200, job: 'Director' }),
        entry({ id: 8, title: 'Adult', adult: true, vote_count: 9000, job: 'Director' }),
        entry({ id: 9, title: undefined, vote_count: 9000, job: 'Director' }),
        entry({ id: 10, title: 'Undated', release_date: undefined, vote_count: 9000, job: 'Director' }),
      ],
    }, today);
    expect(items.map((item) => item.title)).toEqual(['Inception', 'Memento', 'Out today']);
    expect(items[0]).toMatchObject({
      media: 'movie',
      kind: 'recommendation',
      seedKey: 'person:director:Christopher Nolan',
      shortReason: 'By Christopher Nolan',
      reason: 'Directed by Christopher Nolan; you have watched 5 of their films',
    });
  });

  it('keeps an actor\'s leading roles only, and caps each person', () => {
    const actor: HistoryPerson = { name: 'Hugh Jackman', role: 'actor', watched: 10 };
    const cast = [
      entry({ id: 100, title: 'Cameo', character: 'Himself', order: 0, vote_count: 90000 }),
      entry({ id: 101, title: 'Bit part', character: 'Bartender', order: 12, vote_count: 80000 }),
      entry({ id: 102, title: 'Uncredited', character: 'Logan (uncredited)', order: 1, vote_count: 70000 }),
      entry({ id: 103, title: 'No billing', character: 'Logan', vote_count: 60000 }),
      ...Array.from({ length: TITLES_PER_PERSON + 2 }, (_, i) => entry({ id: i + 1, title: `Film ${i + 1}`, vote_count: 5000 - i, character: 'Logan', order: 0 })),
    ];
    const items = personHistoryItems(actor, { cast }, today);
    expect(items).toHaveLength(TITLES_PER_PERSON);
    expect(items.every((item) => item.id < 100)).toBe(true);
    expect(items[0].shortReason).toBe('With Hugh Jackman');
  });
});

describe('takeTurns', () => {
  it('takes one from each list in turn', () => {
    expect(takeTurns<number | string>([[1, 2, 3], ['a'], [10, 20]])).toEqual([1, 'a', 10, 2, 20, 3]);
    expect(takeTurns([])).toEqual([]);
  });
});

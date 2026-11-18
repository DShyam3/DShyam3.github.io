import { describe, expect, it } from 'vitest';
import { isSameTitle, isScheduleFor, isShowWithId, titleKey, type TitleRef } from './title-ref';

const film: TitleRef = { id: '7', category: 'Movies' };
const show: TitleRef = { id: '7', category: 'TV Shows' };

describe('title-ref', () => {
  it('does not treat a film and a show with the same id as the same title', () => {
    expect(isSameTitle(film, show)).toBe(false);
    expect(titleKey(film)).not.toBe(titleKey(show));
  });

  it('treats the same id and category as the same title', () => {
    expect(isSameTitle(film, { ...film })).toBe(true);
    expect(titleKey(film)).toBe(titleKey({ ...film }));
  });

  it('isShowWithId rejects a film with that id', () => {
    expect(isShowWithId(film, '7')).toBe(false);
    expect(isShowWithId(show, '7')).toBe(true);
    expect(isShowWithId(show, '8')).toBe(false);
  });

  it('matches a schedule entry to its own title only, not the other table\'s row with that id', () => {
    const filmEntry = { watchlistItemId: '7', category: 'Movies' as const };
    expect(isScheduleFor(filmEntry, film)).toBe(true);
    expect(isScheduleFor(filmEntry, show)).toBe(false);
  });
});

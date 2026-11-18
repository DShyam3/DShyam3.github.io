import type { WatchlistItem } from './WatchlistContext';

/** A film or show as the app identifies it: row ids repeat across the two tables, so the id alone is not enough. */
export type TitleRef = Pick<WatchlistItem, 'id' | 'category'>;

export const titleKey = (t: TitleRef) => `${t.category}:${t.id}`;

export const isSameTitle = (a: TitleRef, b: TitleRef) => a.id === b.id && a.category === b.category;

/** For the show-only paths (episodes, seasons), which are given a show's id. */
export const isShowWithId = (item: TitleRef, showId: string) =>
  item.category === 'TV Shows' && item.id === showId;

/** A schedule entry points at a title the same way: its id and its category. */
export const isScheduleFor = (
  entry: { watchlistItemId: string; category: TitleRef['category'] },
  ref: TitleRef,
) => entry.watchlistItemId === ref.id && entry.category === ref.category;

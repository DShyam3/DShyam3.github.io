/**
 * Grid shapes shared by every page that shows a wall of cards.
 *
 * Collections and the watchlist used to each declare their own column counts,
 * so a card was a different width on Books than on Inventory than on the
 * Watchlist, and the wall reflowed as you moved between tabs. One constant
 * means the same number of cards per row everywhere.
 *
 * Card *height* still varies, because the images genuinely do: a book or film
 * poster is 2:3 while an inventory photo is square. Same width, same columns,
 * different height -- which is the most consistency the source images allow.
 */
export const CARD_GRID =
  'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 md:gap-5 py-6';

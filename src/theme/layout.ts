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
/**
 * Columns come from the width actually available, not from a breakpoint. Fixed
 * column counts sized every card to the widest screen it might appear on, so a
 * laptop drew the same big cards a monitor did and only one row survived
 * inside the fixed shell. auto-fill packs as many minimum-width columns as fit,
 * so a narrower window gets narrower cards and more of them stay on screen.
 */
/**
 * The minimum grows with the screen. auto-fill on its own keeps the card the
 * same size and just adds columns, so a 2560px monitor drew thirteen tiny
 * cards where it used to draw eight readable ones. Raising the minimum at the
 * wide end holds the card count roughly steady and lets the cards themselves
 * get bigger, which is what a bigger screen is for.
 */
export const CARD_GRID = [
  'grid gap-4 md:gap-5 py-4 md:py-5',
  '[grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr))]',
  'sm:[grid-template-columns:repeat(auto-fill,minmax(10rem,1fr))]',
  'xl:[grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]',
  '2xl:[grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr))]',
  'min-[1920px]:[grid-template-columns:repeat(auto-fill,minmax(14rem,1fr))]',
  'min-[2400px]:[grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]',
].join(' ');

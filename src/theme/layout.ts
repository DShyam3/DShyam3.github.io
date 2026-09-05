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
 *
 * The rules themselves live in `.card-grid` in src/index.css, because they
 * are arithmetic over CSS custom properties -- a column width that satisfies
 * both the width available and the height the shell hands the grid -- and
 * Tailwind's arbitrary-value syntax cannot express a calc() over a variable
 * another component sets at runtime. See AppShell, which measures the height.
 */
export const CARD_GRID = 'card-grid';

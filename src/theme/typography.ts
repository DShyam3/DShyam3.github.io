/**
 * The type scale.
 *
 * Sizes are restricted to this ladder. Tailwind's default `text-*` classes
 * already land exactly on it, so the rule in practice is: use the named
 * classes, never an arbitrary `text-[11px]`.
 *
 *   text-xs    12   fine print: badges, counts, timestamps
 *   text-sm    14   secondary text: captions, card subtitles, form help
 *   text-base  16   body copy. The default.
 *   text-lg    18
 *   text-xl    20
 *   text-2xl   24
 *   text-3xl   30
 *   text-4xl   36
 *   text-5xl   48
 *   text-6xl   60
 *   text-7xl   72
 *
 * Nothing below 12px. Sub-12px text was being used for badges and counts and
 * is genuinely hard to read; 12px is the floor.
 *
 * Display sizes step down on mobile -- 48 to 36, 36 to 30 -- while body and
 * small sizes stay put, because shrinking already-small text hurts more than
 * it helps. `DISPLAY_RESPONSIVE` below spells those pairs out.
 *
 * Weights: two only. 400 or 500 for normal text, 600 or 700 for emphasis.
 * Nothing under 400 except display text at 60px and up, where a lighter
 * weight reads as deliberate rather than frail. In Tailwind terms that means
 * font-normal / font-medium and font-semibold / font-bold, and not
 * font-extrabold, font-black, font-light or font-thin.
 */

export const TYPE_SCALE = {
  xs: '0.75rem', //  12
  sm: '0.875rem', // 14
  base: '1rem', //   16
  lg: '1.125rem', // 18
  xl: '1.25rem', //  20
  '2xl': '1.5rem', //   24
  '3xl': '1.875rem', // 30
  '4xl': '2.25rem', //  36
  '5xl': '3rem', //     48
  '6xl': '3.75rem', //  60
  '7xl': '4.5rem', //   72
} as const;

/** Smallest permitted size, in px. Anything under this is a bug. */
export const MIN_FONT_SIZE_PX = 12;

/**
 * Display sizes and what they become on small screens. Body and small sizes
 * are absent on purpose -- they do not change.
 */
export const DISPLAY_RESPONSIVE: Record<string, string> = {
  'text-5xl': 'text-4xl', // 48 -> 36
  'text-4xl': 'text-3xl', // 36 -> 30
};

/** Weights the design system allows, by role. */
export const WEIGHTS = {
  normal: [400, 500],
  emphasis: [600, 700],
  /** Only permitted on display text 60px and above. */
  displayLight: [300],
} as const;

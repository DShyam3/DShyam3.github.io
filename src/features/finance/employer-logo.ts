/**
 * The mark for an employer, from the logos already in `public/org-logos/`.
 *
 * Those files are there for the experience section of the About page, so an
 * employer named on a payslip usually already has one. Matching is by slug, so
 * adding a logo is dropping a file in that directory — no edit here.
 *
 * Bundled and local: nothing is fetched, so a row draws its mark offline and
 * without a request that would tell anyone who employs this person.
 */

const KNOWN = [
  'airbus-defence-and-space',
  'keysight-technologies',
  'lodestar-space',
  'ocean-infinity',
  'university-college-london',
  'university-of-plymouth',
] as const;

const EXTENSIONS: Record<string, string> = {
  'airbus-defence-and-space': 'png',
  'keysight-technologies': 'svg',
  'lodestar-space': 'png',
  'ocean-infinity': 'svg',
  'university-college-london': 'png',
  'university-of-plymouth': 'png',
};

const slugify = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Names that will not slug their way to the right file.
 *
 * `capgemini` is here because those payslips are for an Airbus placement, and
 * it is a one-off for the imported history rather than a rule about the two
 * companies. Delete the line when those payslips no longer need it.
 */
const ALIASES: Record<string, string> = {
  capgemini: 'airbus-defence-and-space',
  airbus: 'airbus-defence-and-space',
  keysight: 'keysight-technologies',
  ucl: 'university-college-london',
  oceaninfinity: 'ocean-infinity',
  lodestar: 'lodestar-space',
  plymouth: 'university-of-plymouth',
};

/** The public path of the employer's mark, or null when there is not one. */
export function employerLogo(employer: string | undefined): string | null {
  if (!employer) return null;
  const slug = slugify(employer);
  const resolved = ALIASES[slug]
    ?? ALIASES[slug.replace(/-/g, '')]
    // A slug that merely starts with a known one still matches, so
    // "Keysight Technologies UK Ltd" finds keysight-technologies.
    ?? KNOWN.find(k => slug === k || slug.startsWith(k) || k.startsWith(slug));
  if (!resolved || !EXTENSIONS[resolved]) return null;
  return `/org-logos/${resolved}.${EXTENSIONS[resolved]}`;
}

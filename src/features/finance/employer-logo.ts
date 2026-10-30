/**
 * The mark for an employer, from the logos already on the experience and
 * education rows of this site.
 *
 * Nothing is fetched from a third party: an employer named on a payslip
 * draws its mark from the logos this person already uploaded for their own
 * About page, offline and without a request that would tell anyone who
 * employs them. Matching is by slug, so a row without a stored logo simply
 * shows none.
 */

const slugify = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const STOP_WORDS = new Set(['of', 'the', 'and', 'for', 'in', 'at', 'on', 'to']);

/** The logo of the employer with the closest-matching name, or null. */
export function employerLogo(
  employer: string | undefined,
  orgs: readonly { name: string; aliases?: readonly string[]; logoUrl?: string | null }[],
): string | null {
  if (!employer) return null;
  const slug = slugify(employer);
  if (!slug) return null;
  const compact = slug.replace(/-/g, '');

  // Empty slugs are dropped: a blank or non-Latin name slugs to '', and ''
  // is a prefix of everything, so one such row would lend its logo to every
  // payslip. A row missing its name (site content is loosely typed) is
  // skipped rather than allowed to throw.
  const slugged = orgs
    .flatMap(org => [org.name, ...(org.aliases ?? [])].map((candidate, index) => ({
      org,
      slug: slugify(candidate ?? ''),
      canonical: index === 0,
    })))
    .filter(({ slug: orgSlug }) => orgSlug !== '');

  // Prefixes are compared on whole slug words, so "Arm" never finds "Armagh
  // Council", and the longest match wins when several orgs qualify.
  const uniqueLogo = (matches: typeof slugged) => {
    const logos = new Set(matches.map(({ org }) => org.logoUrl ?? null));
    return logos.size === 1 ? [...logos][0] : null;
  };
  const longest = (matches: typeof slugged) => {
    const length = Math.max(...matches.map(match => match.slug.length));
    return uniqueLogo(matches.filter(match => match.slug.length === length));
  };

  const canonical = slugged.filter(match => match.canonical && match.slug === slug);
  if (canonical.length > 0) return uniqueLogo(canonical);
  const exact = slugged.filter(({ slug: orgSlug }) => orgSlug === slug);
  if (exact.length > 0) return uniqueLogo(exact);

  // A compound name written without spaces ("oceaninfinity") still matches
  // the spaced organisation ("Ocean Infinity").
  if (compact.length >= 4) {
    const compactMatch = slugged.filter(({ slug: orgSlug }) => orgSlug.replace(/-/g, '') === compact);
    if (compactMatch.length > 0) return uniqueLogo(compactMatch);
  }

  // A longer legal name still matches, so "Acme Robotics UK Ltd" finds
  // "Acme Robotics".
  const prefixOfEmployer = slugged.filter(({ slug: orgSlug }) => slug.startsWith(`${orgSlug}-`));
  if (prefixOfEmployer.length > 0) return longest(prefixOfEmployer);

  // The reverse only once the employer slug is long enough that a short one
  // is not matching half the organisations on the site.
  if (slug.length >= 4) {
    const prefixOfOrg = slugged.filter(({ slug: orgSlug }) => orgSlug.startsWith(`${slug}-`));
    if (prefixOfOrg.length > 0) return longest(prefixOfOrg);
  }

  // Initialisms of multi-word names ("UCL" -> "University College London").
  if (slug.length >= 3 && !slug.includes('-')) {
    const byInitials = slugged.filter(({ slug: orgSlug }) => {
      const words = orgSlug.split('-');
      if (words.length < 2) return false;
      const allInitials = words.map(w => w[0]).join('');
      const contentInitials = words.filter(w => !STOP_WORDS.has(w)).map(w => w[0]).join('');
      return allInitials === slug || contentInitials === slug;
    });
    if (byInitials.length > 0) return uniqueLogo(byInitials);
  }

  return null;
}

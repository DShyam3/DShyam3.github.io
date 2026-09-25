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
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The logo of the employer with the closest-matching name, or null. */
export function employerLogo(
  employer: string | undefined,
  orgs: readonly { name: string; logoUrl?: string | null }[],
): string | null {
  if (!employer) return null;
  const slug = slugify(employer);
  if (!slug) return null;

  // Empty slugs are dropped: a blank or non-Latin name slugs to '', and ''
  // is a prefix of everything, so one such row would lend its logo to every
  // payslip. A row missing its name (site content is loosely typed) is
  // skipped rather than allowed to throw.
  const slugged = orgs
    .map(org => ({ org, slug: slugify(org.name ?? '') }))
    .filter(({ slug: orgSlug }) => orgSlug !== '');

  // Prefixes are compared on whole slug words, so "Arm" never finds "Armagh
  // Council", and the longest match wins when several orgs qualify.
  const longest = (matches: typeof slugged) =>
    matches.sort((a, b) => b.slug.length - a.slug.length)[0]?.org.logoUrl ?? null;

  const exact = slugged.filter(({ slug: orgSlug }) => orgSlug === slug);
  if (exact.length > 0) return longest(exact);

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

  return null;
}

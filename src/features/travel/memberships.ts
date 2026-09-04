/**
 * Which countries belong to which international body, so "23 of 195" can also
 * be "18 of 211 FIFA" or "20 of 206 Olympic".
 *
 * This is a decision file as much as a data file. FIFA and the IOC do not
 * count countries the way ISO 3166 does, and every difference below is a
 * judgement call that is written down rather than buried:
 *
 *  - FIFA has no "United Kingdom". It has England, Scotland, Wales and
 *    Northern Ireland as four separate associations, so a UK visit resolves
 *    to a home nation via the cities recorded against it. London counts
 *    England, Edinburgh counts Scotland, and so on.
 *  - The IOC does have a single Great Britain NOC, so the UK is one there.
 *  - Both include places that are not sovereign states: Hong Kong, Puerto
 *    Rico, the Faroe Islands, Chinese Taipei and so on.
 *  - Kosovo is a member of both despite having no ISO-assigned code (it uses
 *    the user-assigned XK).
 *  - Some UN members belong to neither: the Vatican has no football
 *    association and no NOC, and several Pacific microstates have one but
 *    not the other.
 *
 * Each set is checked against the body's published total at module load --
 * see assertTotals. If an edit makes a list wrong, the count stops matching
 * and says so, rather than quietly reporting a plausible but false number.
 */

/** ISO-2 codes, plus the pseudo-codes FIFA needs for the UK home nations. */
export type MemberCode = string;

/**
 * UN members that field no FIFA association. The Vatican has no football
 * federation; the Pacific and Caribbean microstates below have never
 * affiliated. The UK is here because FIFA replaces it with four members.
 */
const NOT_IN_FIFA = new Set(['GB', 'MC', 'VA', 'MH', 'FM', 'PW', 'KI', 'TV', 'NR']);

/** FIFA's four UK associations. Not ISO codes -- FIFA's own divisions. */
export const UK_HOME_NATIONS = ['GB-ENG', 'GB-SCT', 'GB-WLS', 'GB-NIR'] as const;

/** Non-sovereign FIFA members. Each has its own association and league. */
const FIFA_TERRITORIES = new Set([
  'AS', 'AI', 'AW', 'BM', 'VG', 'KY', 'CK', 'CW', 'FO', 'GI',
  'GU', 'HK', 'MO', 'MS', 'NC', 'PR', 'TC', 'TW', 'VI', 'PF',
]);

/**
 * Non-sovereign or non-UN National Olympic Committees. Fewer than FIFA's,
 * because the IOC keeps one Great Britain NOC and recognises no French or
 * Dutch overseas territories separately.
 */
const IOC_EXTRA = new Set([
  'TW', 'HK', 'PS', 'XK', 'AW', 'BM', 'KY', 'PR', 'AS', 'GU', 'VI', 'VG', 'CK',
]);

/**
 * Which UK home nation a city sits in. Only needed to turn "visited the UK"
 * into a FIFA member, so it covers the cities likely to come up rather than
 * every settlement. Anything unmatched falls back to counting one
 * unidentified home nation, which is still true -- a UK visit means at least
 * one of the four.
 */
const UK_CITY_NATION: Record<string, (typeof UK_HOME_NATIONS)[number]> = {
  london: 'GB-ENG',
  manchester: 'GB-ENG',
  liverpool: 'GB-ENG',
  birmingham: 'GB-ENG',
  leeds: 'GB-ENG',
  bristol: 'GB-ENG',
  newcastle: 'GB-ENG',
  sheffield: 'GB-ENG',
  nottingham: 'GB-ENG',
  oxford: 'GB-ENG',
  cambridge: 'GB-ENG',
  brighton: 'GB-ENG',
  york: 'GB-ENG',
  bath: 'GB-ENG',
  edinburgh: 'GB-SCT',
  glasgow: 'GB-SCT',
  aberdeen: 'GB-SCT',
  dundee: 'GB-SCT',
  inverness: 'GB-SCT',
  cardiff: 'GB-WLS',
  swansea: 'GB-WLS',
  newport: 'GB-WLS',
  bangor: 'GB-WLS',
  belfast: 'GB-NIR',
  derry: 'GB-NIR',
  londonderry: 'GB-NIR',
};

export interface MembershipBody {
  key: string;
  label: string;
  /** The body's own published membership count. */
  total: number;
  /** Full membership, as codes. */
  members: Set<MemberCode>;
  /** One line explaining what makes this body's count differ from the others. */
  note: string;
}

/**
 * Build every body's membership from the country dataset.
 *
 * `sovereignCodes` is the UN set the travel page already computes: 193
 * members plus the Holy See and Palestine.
 */
export function buildMemberships(sovereignCodes: Set<string>): MembershipBody[] {
  const unAll = new Set(sovereignCodes);
  const unMembersOnly = new Set([...unAll].filter((c) => c !== 'VA' && c !== 'PS'));

  const fifa = new Set<MemberCode>([
    ...[...unAll].filter((c) => !NOT_IN_FIFA.has(c)),
    ...UK_HOME_NATIONS,
    ...FIFA_TERRITORIES,
    'XK',
  ]);

  const ioc = new Set<MemberCode>([...unMembersOnly, ...IOC_EXTRA]);

  return [
    {
      key: 'un',
      label: 'UN states',
      total: 195,
      members: unAll,
      note: '193 member states plus the Holy See and Palestine as observers.',
    },
    {
      key: 'fifa',
      label: 'FIFA',
      total: 211,
      members: fifa,
      note: 'England, Scotland, Wales and Northern Ireland count separately; the Vatican and several Pacific states have no association.',
    },
    {
      key: 'ioc',
      label: 'Olympic',
      total: 206,
      members: ioc,
      note: 'One Great Britain committee, plus Chinese Taipei, Hong Kong, Kosovo and several territories.',
    },
  ];
}

/**
 * How many of a body's members a set of visits covers.
 *
 * `citiesByCountry` only matters for the UK: without it a UK visit counts as
 * one unidentified home nation, and with it each recorded city adds the
 * nation it sits in.
 */
export function countMembers(
  body: MembershipBody,
  visitedCodes: string[],
  citiesByCountry: Record<string, { city_name: string }[]> = {},
): number {
  const visited = new Set(visitedCodes);
  let count = 0;

  for (const code of body.members) {
    if (code.startsWith('GB-')) continue; // handled below
    if (visited.has(code)) count += 1;
  }

  // FIFA only: resolve a UK visit into home nations.
  if (visited.has('GB') && body.members.has('GB-ENG')) {
    const nations = new Set<string>();
    for (const city of citiesByCountry.GB ?? []) {
      const nation = UK_CITY_NATION[city.city_name.trim().toLowerCase()];
      if (nation) nations.add(nation);
    }
    // A UK visit means at least one home nation even if no city says which.
    count += Math.max(1, nations.size);
  }

  return count;
}

/**
 * Guard against a bad edit. Each list is built to match the body's published
 * total, so a mismatch means the data is wrong and the resulting percentage
 * would be a confident lie.
 */
export function assertTotals(bodies: MembershipBody[]): string[] {
  return bodies
    .filter((b) => b.members.size !== b.total)
    .map((b) => `${b.label}: built ${b.members.size} members, expected ${b.total}`);
}

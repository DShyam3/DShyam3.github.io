/**
 * Known merchants: the aliases a bank might use, and the brand's own spelling.
 *
 * Two jobs, both cheap. It fixes the label -- `SAINSBURYS S/MKT` is
 * Sainsbury's, and a person should read the second one -- and it collapses
 * aliases onto one canonical slug, so every spelling of Amazon shares a
 * colour, a bundled mark and a cache entry.
 *
 * Route B of the logo work reads the canonical slug and nothing else: drop
 * `src/assets/merchant-logos/<slug>.svg` in and that merchant has a mark, with
 * no code change. A row with no file still earns its place -- the label and
 * the shared colour are worth having on their own.
 *
 * Keys are `merchantSlug()` output: lowercase, hyphenated, digits stripped.
 * Deliberately UK-weighted, because the ledger is.
 */

export interface MerchantDirectoryEntry {
  /** Canonical slug. Aliases point at the same one; the mark is named for it. */
  slug: string;
  /** The brand's own spelling, for the row label. */
  label: string;
}

/** `[canonicalSlug, label, ...aliasSlugs]`, expanded below. */
const ROWS: [string, string, ...string[]][] = [
  ['tesco', 'Tesco', 'tesco-stores', 'tesco-express', 'tesco-metro', 'tesco-superstore'],
  ['sainsburys', "Sainsbury's", 'sainsbury-s', 'sainsburys-s-mkt', 'sainsburys-local'],
  ['asda', 'Asda', 'asda-stores', 'asda-superstore'],
  ['morrisons', 'Morrisons', 'wm-morrisons', 'morrisons-daily'],
  ['aldi', 'Aldi', 'aldi-stores'],
  ['lidl', 'Lidl', 'lidl-gb'],
  ['waitrose', 'Waitrose', 'waitrose-partners'],
  ['co-op', 'Co-op', 'co-op-group', 'coop', 'the-co-operative', 'co-op-food'],
  ['marks-and-spencer', 'Marks & Spencer', 'm-s', 'marks-spencer', 'm-s-simply-food'],
  ['iceland', 'Iceland', 'iceland-foods'],

  ['amazon', 'Amazon', 'amazon-co-uk', 'amznmktplace', 'amazon-mktplace', 'amazon-marketplace', 'amzn-mktp'],
  ['ebay', 'eBay'],
  ['argos', 'Argos'],
  ['john-lewis', 'John Lewis', 'johnlewis'],
  ['ikea', 'IKEA'],
  ['boots', 'Boots', 'boots-uk'],
  ['screwfix', 'Screwfix'],
  ['b-q', 'B&Q', 'b-and-q'],
  ['currys', 'Currys', 'currys-pc-world'],
  ['zara', 'Zara'],
  ['h-m', 'H&M', 'h-and-m', 'hennes-mauritz'],
  ['uniqlo', 'Uniqlo'],
  ['apple', 'Apple', 'apple-store', 'apple-bill'],

  ['deliveroo', 'Deliveroo'],
  ['just-eat', 'Just Eat', 'justeat'],
  ['uber-eats', 'Uber Eats', 'ubereats'],
  ['uber', 'Uber', 'uber-trip', 'uber-bv'],
  ['bolt', 'Bolt', 'bolt-eu'],
  ['mcdonalds', "McDonald's", 'mcdonald-s', 'mc-donalds'],
  ['greggs', 'Greggs'],
  ['pret-a-manger', 'Pret A Manger', 'pret'],
  ['costa', 'Costa Coffee', 'costa-coffee'],
  ['starbucks', 'Starbucks', 'starbucks-coffee'],
  ['nandos', "Nando's", 'nando-s'],
  ['wagamama', 'Wagamama'],

  ['tfl', 'Transport for London', 'tfl-travel', 'tfl-travel-ch', 'transport-for-london'],
  ['trainline', 'Trainline', 'thetrainline'],
  ['national-rail', 'National Rail'],
  ['lner', 'LNER'],
  ['gwr', 'Great Western Railway', 'great-western-railway'],
  ['shell', 'Shell'],
  ['bp', 'BP'],
  ['esso', 'Esso'],
  ['ryanair', 'Ryanair'],
  ['easyjet', 'easyJet'],
  ['british-airways', 'British Airways', 'britishairways'],

  ['netflix', 'Netflix', 'netflix-com'],
  ['spotify', 'Spotify', 'spotify-uk'],
  ['disney-plus', 'Disney+', 'disneyplus', 'disney'],
  ['youtube', 'YouTube', 'google-youtube', 'youtube-premium'],
  ['steam', 'Steam', 'steam-games', 'valve'],
  ['playstation', 'PlayStation', 'playstation-network', 'sony-playstation'],
  ['nintendo', 'Nintendo'],
  ['audible', 'Audible'],

  ['vodafone', 'Vodafone'],
  ['ee', 'EE', 'ee-limited'],
  ['o2', 'O2', 'o2-uk', 'telefonica-o2'],
  ['three', 'Three', 'h3g-uk'],
  ['bt', 'BT', 'bt-group'],
  ['sky', 'Sky', 'sky-uk', 'sky-digital'],
  ['virgin-media', 'Virgin Media', 'virginmedia'],
  ['octopus-energy', 'Octopus Energy', 'octopus'],
  ['british-gas', 'British Gas', 'britishgas'],
  ['thames-water', 'Thames Water'],
  ['tv-licensing', 'TV Licensing', 'tv-licence'],

  ['puregym', 'PureGym', 'pure-gym'],
  ['thegym', 'The Gym Group', 'the-gym-group'],
  ['nhs', 'NHS', 'nhs-prescription'],
  ['royal-mail', 'Royal Mail', 'royalmail'],
];

export const MERCHANT_DIRECTORY: Record<string, MerchantDirectoryEntry> =
  Object.fromEntries(
    ROWS.flatMap(([slug, label, ...aliases]) =>
      [slug, ...aliases].map(key => [key, { slug, label }] as const),
    ),
  );

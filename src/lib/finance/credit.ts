/**
 * UK credit-bureau score bands and the cross-bureau standing.
 *
 * Pure; see REHAUL_PLAN.md 7.I. Note what is *not* here: colours. The bands
 * used to carry hex values, which is presentation leaking into domain data and
 * is exactly the debt Phase 7 exists to clear. A band now carries a `tier`,
 * and the UI maps tier to a design token.
 */

export type BureauKey = 'experian' | 'transunion' | 'equifax';

/** Where a band sits on the shared five-step ramp, worst to best. Bureaus do
 *  not all use five bands — TransUnion has four and skips tier 3. */
export type CreditTier = 1 | 2 | 3 | 4 | 5;

export interface BureauBand {
  name: string;
  min: number;
  max: number;
  tier: CreditTier;
  description: string;
}

export const BUREAU_BANDS: Record<BureauKey, BureauBand[]> = {
  experian: [
    { name: 'Low', min: 0, max: 640, tier: 1, description: 'Borrowing may be difficult and interest rates could be high. But our tools can help get your score moving in the right direction. Every small increase helps, and things should improve as you get closer to a Fair score.' },
    { name: 'Fair', min: 641, max: 860, tier: 2, description: 'You might get limited credit options, higher interest rates, and lower borrowing limits. But our tools can help improve your score. And as it grows, so will your choices.' },
    { name: 'Good', min: 861, max: 1000, tier: 3, description: 'You should see a wide range of credit cards, loans and mortgages (but you might have to pay a bit more interest).' },
    { name: 'Very Good', min: 1001, max: 1120, tier: 4, description: 'You should get most credit cards, loans and mortgages (but you might not get the very best deals).' },
    { name: 'Excellent', min: 1121, max: 1250, tier: 5, description: 'You should get the best credit cards, loans and mortgages (but there are no guarantees).' },
  ],
  transunion: [
    { name: 'Needs Work', min: 0, max: 565, tier: 1, description: 'Your credit history needs work. You may struggle to get credit, and if you do, interest rates will likely be high.' },
    { name: 'Fair', min: 566, max: 603, tier: 2, description: 'You have a fair credit history. You may find it harder to get credit or might have to pay higher interest rates.' },
    { name: 'Good', min: 604, max: 627, tier: 4, description: 'You have a good credit history and should be approved for most credit offers, though you may not get the lowest rates.' },
    { name: 'Excellent', min: 628, max: 710, tier: 5, description: 'You have a great credit history and are highly likely to be approved for credit and get the best interest rates.' },
  ],
  equifax: [
    { name: 'Start Climbing', min: 0, max: 409, tier: 1, description: 'Your score is low. You might find it difficult to get credit, or have to pay very high interest rates.' },
    { name: 'Moving On Up', min: 410, max: 519, tier: 2, description: "You're starting to build your score. Credit options may be limited and rates could be higher." },
    { name: 'On Good Ground', min: 520, max: 604, tier: 3, description: 'Your score is okay. You might get accepted for credit, but interest rates might be higher.' },
    { name: 'Looking Bright', min: 605, max: 724, tier: 4, description: "You're in a good position. You should be accepted for most credit, with decent interest rates." },
    { name: 'Soaring High', min: 725, max: 1000, tier: 5, description: "Lenders will see you as a very low risk. You're likely to get the best deals on loans, credit cards, and mortgages." },
  ],
};

/** The band a raw score falls in, or null if it is outside every band. */
export const getBandForScore = (bureau: BureauKey, score: number): BureauBand | null =>
  BUREAU_BANDS[bureau].find(band => score >= band.min && score <= band.max) ?? null;

export interface UniversalStanding {
  label: string;
  /** Mean of the per-bureau ratings, 1–5. Fractional by design. */
  rating: number;
  tier: CreditTier;
  desc: string;
}

/** Each bureau's newest score mapped onto a common 1–5 rating. The scales are
 *  not linearly comparable, so the steps are hand-set per bureau. */
const RATING_STEPS: Record<BureauKey, { min: number; rating: number }[]> = {
  experian: [
    { min: 1121, rating: 5 },
    { min: 1001, rating: 4.2 },
    { min: 861, rating: 3.5 },
    { min: 641, rating: 2.5 },
  ],
  transunion: [
    { min: 628, rating: 5 },
    { min: 604, rating: 3.8 },
    { min: 566, rating: 2.5 },
  ],
  equifax: [
    { min: 725, rating: 5 },
    { min: 605, rating: 4.2 },
    { min: 520, rating: 3.2 },
    { min: 410, rating: 2.2 },
  ],
};

const STANDINGS: { min: number; label: string; tier: CreditTier; desc: string }[] = [
  { min: 4.5, label: 'Excellent', tier: 5, desc: 'Lenders will view you as an extremely reliable borrower. You qualify for the best financial deals.' },
  { min: 3.5, label: 'Very Good', tier: 4, desc: 'Your credit standing is strong. You are likely to qualify for premium rates and high limits.' },
  { min: 2.8, label: 'Good', tier: 3, desc: 'You have a healthy credit history. You will see a wide choice of loans and credit cards.' },
  { min: 1.8, label: 'Fair', tier: 2, desc: 'Your credit score is acceptable, but you may face higher interest rates or lower borrowing limits.' },
  { min: -Infinity, label: 'Needs Work', tier: 1, desc: 'Borrowing options are limited. Focus on rebuilding your payment history to improve your rating.' },
];

const ratingFor = (bureau: BureauKey, score: number): number =>
  RATING_STEPS[bureau].find(step => score >= step.min)?.rating ?? 1;

/**
 * Averages the newest score from each bureau that has one into a single
 * standing. Returns null when no bureau has been recorded at all.
 */
export const getUniversalStanding = (
  creditScores: Partial<Record<BureauKey, { score: number }[]>>,
): UniversalStanding | null => {
  const bureaus: BureauKey[] = ['experian', 'transunion', 'equifax'];

  const ratings = bureaus.flatMap(bureau => {
    const entries = creditScores[bureau] ?? [];
    if (entries.length === 0) return [];
    return [ratingFor(bureau, entries[entries.length - 1].score)];
  });

  if (ratings.length === 0) return null;

  const rating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const standing = STANDINGS.find(s => rating >= s.min) ?? STANDINGS[STANDINGS.length - 1];

  return { label: standing.label, rating, tier: standing.tier, desc: standing.desc };
};

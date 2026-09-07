/**
 * What the pension is on course to be worth.
 *
 * Deliberately projected in **today's money**: the growth rate taken here is
 * real, meaning net of inflation, so £500,000 in forty years means £500,000 of
 * today's spending power rather than a nominal figure that sounds impressive
 * and buys a fraction of it. Nominal projections are the single most misleading
 * number in consumer pension tooling.
 *
 * Pure, like everything here — no clock, no rates fetched, every assumption an
 * argument the caller has to state and the UI can show.
 */

export interface PensionInputs {
  /** What the pot holds today. */
  currentPot: number;
  /** Everything going in each year: employee, employer and any salary sacrifice. */
  annualContribution: number;
  /** Years until the pot is drawn. */
  years: number;
  /**
   * Annual growth **after inflation**, as a percentage. 5 means 5% real.
   * A long-run global equity assumption is around 4-5% real; anything above
   * that is optimism rather than planning.
   */
  realGrowthPercent: number;
  /** Yearly increase in contributions, as a percentage. 0 keeps them flat. */
  contributionGrowthPercent?: number;
}

export interface PensionYear {
  /** Years from now: 0 is today. */
  year: number;
  /** Pot at the end of that year, in today's money. */
  pot: number;
  /** Everything paid in up to and including that year. */
  contributed: number;
  /** Pot less contributions: what growth added. */
  growth: number;
}

export interface PensionProjection {
  years: PensionYear[];
  finalPot: number;
  totalContributed: number;
  totalGrowth: number;
  /**
   * A common rule of thumb for what a pot sustains annually without running
   * out. Stated as an assumption, not a promise.
   */
  sustainableAnnualIncome: number;
}

/** The withdrawal rate the income figure uses, as a percentage. */
export const SAFE_WITHDRAWAL_PERCENT = 4;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Projects the pot year by year.
 *
 * Contributions are added at the end of each year and growth applied to the
 * opening balance, which is the conservative convention: assuming a full year
 * of growth on money paid in monthly would overstate the result.
 */
export const projectPension = (inputs: PensionInputs): PensionProjection => {
  const years = Math.max(0, Math.floor(inputs.years));
  const growth = inputs.realGrowthPercent / 100;
  const contributionGrowth = (inputs.contributionGrowthPercent ?? 0) / 100;

  const points: PensionYear[] = [];
  let pot = Math.max(0, inputs.currentPot);
  let contributed = 0;
  let yearlyContribution = Math.max(0, inputs.annualContribution);

  points.push({ year: 0, pot: round2(pot), contributed: 0, growth: 0 });

  for (let y = 1; y <= years; y++) {
    pot = pot * (1 + growth) + yearlyContribution;
    contributed += yearlyContribution;
    points.push({
      year: y,
      pot: round2(pot),
      contributed: round2(contributed),
      growth: round2(pot - inputs.currentPot - contributed),
    });
    yearlyContribution *= 1 + contributionGrowth;
  }

  const finalPot = points[points.length - 1].pot;
  return {
    years: points,
    finalPot,
    totalContributed: round2(contributed),
    totalGrowth: round2(finalPot - inputs.currentPot - contributed),
    sustainableAnnualIncome: round2((finalPot * SAFE_WITHDRAWAL_PERCENT) / 100),
  };
};

/** Employee plus employer contributions for a salary, as an annual figure. */
export const annualPensionContribution = (
  grossSalary: number,
  personalPercent: number,
  employerPercent: number,
): number => round2(grossSalary * ((personalPercent + employerPercent) / 100));

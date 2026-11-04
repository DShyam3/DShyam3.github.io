/**
 * The tax-free allowance a PAYE tax code gives, read from the code alone.
 *
 * Covers the codes that carry an allowance: a number with an L, M, N or T
 * suffix (0T is no allowance at all), optionally prefixed S for Scotland or C
 * for Wales, optionally followed by an emergency marker -- X, M1, W1 or
 * W1/M1 -- meaning each pay period is taxed on its own rather than against
 * the year so far. The marker changes when tax is collected, not how much
 * allowance there is, so it is reported beside the allowance rather than
 * folded into it.
 *
 * K codes, BR, D0, D1 and NT return undefined: each needs more than a number
 * to model, and a guessed allowance would quietly misstate take-home.
 */

export interface TaxCodeAllowance {
  /** The code's number times ten, e.g. 1257L is £12,570. */
  allowance: number;
  /** An X, M1 or W1 marker: taxed period by period, not cumulatively. */
  nonCumulative: boolean;
}

const ALLOWANCE_CODE = /^[SC]?(\d{1,5})[LMNT]\s*(X|M1|W1|W1\/M1)?$/;

export const allowanceFromTaxCode = (code: string): TaxCodeAllowance | undefined => {
  const match = code.trim().toUpperCase().match(ALLOWANCE_CODE);
  if (!match) return undefined;
  return { allowance: Number(match[1]) * 10, nonCumulative: match[2] !== undefined };
};

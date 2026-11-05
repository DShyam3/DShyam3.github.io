/**
 * An annual estimate of Dutch wage tax and national insurance contributions for
 * calendar year 2026.
 *
 * Scope: ONE employee below state pension (AOW) age, resident in the
 * Netherlands for all of 2026, box 1 employment income only. `income` is the
 * full annual gross INCLUDING the 8% holiday allowance (vakantiegeld). The
 * employer-paid Zvw levy is not an employee deduction and is not modelled.
 *
 * Excluded, and worth stating on any page that shows it: the 30% ruling,
 * occupational pension contributions, boxes 2 and 3, AOW-age rates, and
 * partner transfers of credits.
 *
 * Figures are returned **unrounded** (an annual estimate); the UI formats.
 *
 * The credit formulas use the official table bases as published. Those leave
 * cent-level steps at some segment boundaries (the segments do not join
 * exactly), which is kept rather than smoothed so the module matches the
 * Belastingdienst tables.
 *
 * Negative or non-finite income is treated as 0; callers validate first.
 *
 * Pure, like everything here: no clock, no network, no Supabase, no model
 * output anywhere near the arithmetic.
 */

/** Tax year these constants describe. */
export const NL_TAX_YEAR_LABEL = '2026';

/**
 * Source of the brackets: Belastingdienst "Rates for 2026", table 1.
 * https://www.belastingdienst.nl/wps/wcm/connect/bldcontenten/belastingdienst/business/payroll_taxes/you_are_not_established_in_the_netherlands_are_you_required_to_withhold_payroll_taxes/when_you_are_going_to_withhold_payroll_taxes/calculating_payroll_taxes/rates/rates-2026/table-1-brackets-wage-tax-national-insurance-contributions-2026
 *
 * Source of the credits: tables 2a/2b.
 * https://www.belastingdienst.nl/wps/wcm/connect/bldcontenten/belastingdienst/business/payroll_taxes/you_are_not_established_in_the_netherlands_are_you_required_to_withhold_payroll_taxes/when_you_are_going_to_withhold_payroll_taxes/calculating_payroll_taxes/rates/rates-2026/table-2a-2b-tax-credits-2026
 */

/** Top of the first bracket, EUR/yr (inclusive). */
export const NL_BRACKET_1_LIMIT = 38_883;
/** Top of the second bracket, EUR/yr (inclusive). */
export const NL_BRACKET_2_LIMIT = 78_426;

/** Combined wage tax + national insurance, first bracket. */
export const NL_BRACKET_1_RATE = 0.3575;
/** Combined rate, second bracket. */
export const NL_BRACKET_2_RATE = 0.3756;
/** Combined rate, top bracket. */
export const NL_BRACKET_3_RATE = 0.495;

/** AOW (old-age pension) premium within the first bracket. */
export const NL_AOW_RATE = 0.179;
/** Anw (surviving dependants) premium within the first bracket. */
export const NL_ANW_RATE = 0.001;
/** Wlz (long-term care) premium within the first bracket. */
export const NL_WLZ_RATE = 0.0965;
/** National insurance in the first bracket: AOW + Anw + Wlz = 27.65%. */
export const NL_NATIONAL_INSURANCE_RATE = 0.2765;
/** Wage tax share of the first bracket (8.10%). */
export const NL_WAGE_TAX_RATE_BRACKET_1 = 0.081;

/** General tax credit (algemene heffingskorting): maximum, EUR/yr. */
export const NL_GENERAL_CREDIT_MAX = 3_115;
/** General credit is at its maximum up to and including this income. */
export const NL_GENERAL_CREDIT_PHASEOUT_START = 29_736;
/** Phase-out rate of the general credit above the start. */
export const NL_GENERAL_CREDIT_PHASEOUT_RATE = 0.06398;

/** Labour tax credit (arbeidskorting) segment limits, EUR/yr (inclusive). */
export const NL_LABOUR_LIMIT_1 = 11_965;
export const NL_LABOUR_LIMIT_2 = 25_845;
export const NL_LABOUR_LIMIT_3 = 45_592;
export const NL_LABOUR_LIMIT_4 = 132_920;

const LABOUR_RATE_1 = 0.08324;
const LABOUR_BASE_2 = 996;
const LABOUR_RATE_2 = 0.31009;
const LABOUR_BASE_3 = 5_300;
const LABOUR_RATE_3 = 0.0195;
const LABOUR_BASE_4 = 5_685;
const LABOUR_RATE_4 = 0.0651;

export interface NlTaxInput {
  /** Annual gross employment pay in EUR, including the 8% holiday allowance. */
  income: number;
}

export interface NlTaxBreakdown {
  income: number;
  /** Wage tax plus national insurance, brackets applied, before credits. */
  taxBeforeCredits: number;
  /** 27.65% of the first bracket portion (part of `taxBeforeCredits`). */
  nationalInsuranceBeforeCredits: number;
  generalTaxCredit: number;
  labourTaxCredit: number;
  /** min(general + labour, taxBeforeCredits). */
  creditsApplied: number;
  /** taxBeforeCredits - creditsApplied. */
  taxAfterCredits: number;
  /** income - taxAfterCredits. */
  takeHome: number;
}

/** Negative or non-finite is 0. */
const clean = (income: number): number =>
  Number.isFinite(income) && income > 0 ? income : 0;

/** Wage tax and national insurance before credits, EUR/yr. */
export const nlTaxBeforeCredits = (income: number): number => {
  const x = clean(income);
  const b1 = Math.min(x, NL_BRACKET_1_LIMIT);
  const b2 = Math.max(0, Math.min(x, NL_BRACKET_2_LIMIT) - NL_BRACKET_1_LIMIT);
  const b3 = Math.max(0, x - NL_BRACKET_2_LIMIT);
  return b1 * NL_BRACKET_1_RATE + b2 * NL_BRACKET_2_RATE + b3 * NL_BRACKET_3_RATE;
};

/** General tax credit, EUR/yr: flat, then phased out to 0 (at 78,426). */
export const nlGeneralTaxCredit = (income: number): number => {
  const x = clean(income);
  if (x <= NL_GENERAL_CREDIT_PHASEOUT_START) return NL_GENERAL_CREDIT_MAX;
  return Math.max(
    0,
    NL_GENERAL_CREDIT_MAX -
      NL_GENERAL_CREDIT_PHASEOUT_RATE * (x - NL_GENERAL_CREDIT_PHASEOUT_START),
  );
};

/** Labour tax credit on employment income, EUR/yr. */
export const nlLabourTaxCredit = (income: number): number => {
  const x = clean(income);
  if (x <= NL_LABOUR_LIMIT_1) return LABOUR_RATE_1 * x;
  if (x <= NL_LABOUR_LIMIT_2) return LABOUR_BASE_2 + LABOUR_RATE_2 * (x - NL_LABOUR_LIMIT_1);
  if (x <= NL_LABOUR_LIMIT_3) return LABOUR_BASE_3 + LABOUR_RATE_3 * (x - NL_LABOUR_LIMIT_2);
  if (x <= NL_LABOUR_LIMIT_4) {
    return Math.max(0, LABOUR_BASE_4 - LABOUR_RATE_4 * (x - NL_LABOUR_LIMIT_3));
  }
  return 0;
};

export const calculateNlTax = (input: NlTaxInput): NlTaxBreakdown => {
  const income = clean(input.income);
  const taxBeforeCredits = nlTaxBeforeCredits(income);
  const nationalInsuranceBeforeCredits =
    Math.min(income, NL_BRACKET_1_LIMIT) * NL_NATIONAL_INSURANCE_RATE;
  const generalTaxCredit = nlGeneralTaxCredit(income);
  const labourTaxCredit = nlLabourTaxCredit(income);
  const creditsApplied = Math.min(generalTaxCredit + labourTaxCredit, taxBeforeCredits);
  const taxAfterCredits = taxBeforeCredits - creditsApplied;
  return {
    income,
    taxBeforeCredits,
    nationalInsuranceBeforeCredits,
    generalTaxCredit,
    labourTaxCredit,
    creditsApplied,
    taxAfterCredits,
    takeHome: income - taxAfterCredits,
  };
};

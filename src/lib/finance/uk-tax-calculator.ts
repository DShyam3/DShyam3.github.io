/**
 * Public facade for the UK income tax, National Insurance, student loan,
 * pension, and child-benefit calculator.
 *
 * Pure; see REHAUL_PLAN.md 7.I.
 */

export {
  UK_ALLOWANCE_TAPER_RATE,
  UK_ALLOWANCE_TAPER_START,
  UK_AUTO_ENROLMENT,
  UK_CHILD_BENEFIT_CHARGE_END,
  UK_CHILD_BENEFIT_CHARGE_START,
  UK_CHILD_BENEFIT_CHARGE_STEP,
  UK_CHILD_BENEFIT_WEEKS,
  UK_CHILDCARE_CUTOFF,
  UK_EMPLOYEE_NI,
  UK_STANDARD_TAX_INPUT,
  UK_STATUTORY_PERSONAL_ALLOWANCE,
  UK_TAX_YEAR_LABEL,
  calculateUkTax,
  ukBasePersonalAllowance,
  ukBenefitInKindTax,
  ukCashAfterTax,
  ukChildBenefitBand,
  ukMarginalRate,
  ukMarginalRates,
  ukNextPound,
  ukTaxCliffs,
  type UkCashAfterTax,
  type UkIncomeBand,
  type UkIncomeKind,
  type UkIncomeTaxBandName,
  type UkMarginalRates,
  type UkNextPound,
  type UkPensionBasis,
  type UkPensionMethod,
  type UkTaxBreakdown,
  type UkTaxCliff,
  type UkTaxInput,
  type UkTaxRegion,
  type UkUndergradPlan,
} from './uk-tax-core';

export * from './uk-tax-curves';

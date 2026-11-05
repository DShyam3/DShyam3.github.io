import { moneyHubJurisdiction, type MoneyHubCurrency, type MoneyHubJurisdictionId } from './money-hub-catalogue';
import { convertMoneyHubAmount, type MoneyHubFxSnapshot } from './money-hub-fx';
import { calculateMoneyHubPay, type MoneyHubPayrollOptions } from './money-hub-payroll';

/**
 * Money Hub: how far a salary goes in one city compared with another.
 *
 * Everything here is jurisdiction-neutral. Take-home pay comes either from a
 * payroll calculator (`money-hub-payroll.ts`) or from a net figure the user
 * supplies; the budget, surplus, comparison and equivalent-salary arithmetic is
 * the same either way. Amounts are monthly and in the city's own currency;
 * currency conversion happens only at comparison, through a dated snapshot.
 */

export const MONEY_HUB_COSTS = [
  { id: 'housing', label: 'Housing' },
  { id: 'utilities', label: 'Utilities & connectivity' },
  { id: 'groceries', label: 'Groceries & household goods' },
  { id: 'transport', label: 'Transport' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'leisure', label: 'Leisure' },
  { id: 'localCharges', label: 'Local taxes & household charges' },
  { id: 'commitments', label: 'Other commitments' },
] as const;

export type MoneyHubCostId = typeof MONEY_HUB_COSTS[number]['id'];
/** Monthly local currency, entered by the user; null is unknown, zero is explicitly no cost. */
export type MoneyHubBudget = Record<MoneyHubCostId, number | null>;

export interface MoneyHubMonthlyDeduction {
  id: string;
  label: string;
  amount: number;
}

export interface MoneyHubCityResult {
  monthlyTakeHome: number | null;
  /** Calculated payroll deductions per month; null when take-home is user-supplied or unknown. */
  monthlyDeductions: readonly MoneyHubMonthlyDeduction[] | null;
  monthlyCosts: number | null;
  monthlySurplus: number | null;
  housingShareOfTakeHome: number | null;
  largestCost: { id: MoneyHubCostId; label: string; amount: number } | null;
  missingCosts: MoneyHubCostId[];
  invalid: boolean;
  /** Why the payroll calculator withholds a take-home for this income, or null. */
  unsupported: string | null;
}

/** Solver bound in major units of the destination's currency; every calculated jurisdiction uses GBP or EUR. */
export const MONEY_HUB_MAX_EQUIVALENT_SALARY = 10_000_000;
export const MONEY_HUB_EQUIVALENT_SALARY_TOLERANCE = 0.005;

export type MoneyHubEquivalentSalaryStatus =
  | 'complete'
  | 'incomplete'
  | 'not-calculated'
  | 'unsupported'
  | 'unattainable-below-zero'
  | 'unattainable-above-bound'
  | 'unattainable';

export interface MoneyHubEquivalentSalary {
  status: MoneyHubEquivalentSalaryStatus;
  annualGross: number | null;
  targetMonthlyTakeHome: number | null;
  targetMonthlySurplus: number | null;
}

export const emptyMoneyHubBudget = (): MoneyHubBudget => ({
  housing: null,
  utilities: null,
  groceries: null,
  transport: null,
  healthcare: null,
  leisure: null,
  localCharges: null,
  commitments: null,
});

interface BudgetSummary {
  /** Null while any category is missing or invalid. */
  total: number | null;
  missingCosts: MoneyHubCostId[];
  invalid: boolean;
  largest: MoneyHubCityResult['largestCost'];
}

const summariseBudget = (budget: MoneyHubBudget): BudgetSummary => {
  const missingCosts: MoneyHubCostId[] = [];
  let total = 0;
  let invalid = false;
  let largest: MoneyHubCityResult['largestCost'] = null;
  for (const { id, label } of MONEY_HUB_COSTS) {
    const cost = budget[id];
    if (cost == null) missingCosts.push(id);
    else if (!Number.isFinite(cost) || cost < 0) invalid = true;
    else {
      total += cost;
      if (cost > 0 && (largest === null || cost > largest.amount)) largest = { id, label, amount: cost };
    }
  }
  invalid ||= !Number.isFinite(total);
  return { total: invalid || missingCosts.length > 0 ? null : total, missingCosts, invalid, largest };
};

/**
 * The budget side of a city, given a monthly take-home in its currency. Works
 * the same for a calculated and a user-supplied take-home: nothing about tax
 * is inferred here, and values stay unrounded until presentation. Every budget
 * category must be supplied before a total or surplus appears.
 */
export const evaluateMoneyHubBudget = (
  monthlyTakeHome: number | null,
  budget: MoneyHubBudget,
  monthlyDeductions: readonly MoneyHubMonthlyDeduction[] | null = null,
): MoneyHubCityResult => {
  const summary = summariseBudget(budget);
  const invalidTakeHome = monthlyTakeHome !== null && (!Number.isFinite(monthlyTakeHome) || monthlyTakeHome < 0);
  const result: MoneyHubCityResult = {
    monthlyTakeHome: null,
    monthlyDeductions: null,
    monthlyCosts: null,
    monthlySurplus: null,
    housingShareOfTakeHome: null,
    largestCost: null,
    missingCosts: summary.missingCosts,
    invalid: summary.invalid || invalidTakeHome,
    unsupported: null,
  };
  if (monthlyTakeHome === null || invalidTakeHome) return result;
  result.monthlyTakeHome = monthlyTakeHome;
  result.monthlyDeductions = monthlyDeductions;
  if (summary.total !== null) {
    result.monthlyCosts = summary.total;
    result.monthlySurplus = monthlyTakeHome - summary.total;
    if (monthlyTakeHome > 0 && budget.housing !== null) {
      const share = budget.housing / monthlyTakeHome;
      result.housingShareOfTakeHome = Number.isFinite(share) ? share : null;
    }
    result.largestCost = summary.largest;
  }
  return result;
};

/**
 * Annual gross in the jurisdiction's currency, through its payroll calculator.
 * Monthly values are annual estimates divided by 12, not a payslip simulation.
 * A jurisdiction without a calculator, or an income its calculator does not
 * cover, gets no take-home and says why in `unsupported`.
 */
export const calculateMoneyHubCity = (
  jurisdiction: MoneyHubJurisdictionId,
  annualGross: number | null,
  budget: MoneyHubBudget,
  options?: MoneyHubPayrollOptions,
): MoneyHubCityResult => {
  const invalidGross = annualGross !== null && (!Number.isFinite(annualGross) || annualGross < 0);
  if (annualGross === null || invalidGross) {
    const result = evaluateMoneyHubBudget(null, budget);
    result.invalid ||= invalidGross;
    return result;
  }
  const pay = calculateMoneyHubPay(jurisdiction, annualGross, options);
  if (pay.status !== 'calculated') {
    const result = evaluateMoneyHubBudget(null, budget);
    result.invalid ||= pay.status === 'invalid-options';
    result.unsupported = pay.status === 'not-calculated'
      ? `Payroll is not calculated for ${moneyHubJurisdiction(jurisdiction).name}; supply its net pay.`
      : null;
    return result;
  }
  if (pay.pay.unsupported !== null) {
    const result = evaluateMoneyHubBudget(null, budget);
    result.unsupported = pay.pay.unsupported;
    return result;
  }
  return evaluateMoneyHubBudget(
    pay.pay.annualTakeHome / 12,
    budget,
    pay.pay.deductions.map(({ id, label, annual }) => ({ id, label, amount: annual / 12 })),
  );
};

/**
 * Surplus difference from the baseline in `displayCurrency`; positive means
 * more left over than the baseline, and deficits keep their sign. A
 * cross-currency comparison needs both rates in the snapshot.
 */
export const compareMoneyHubCity = (
  result: MoneyHubCityResult,
  resultCurrency: MoneyHubCurrency,
  baseline: MoneyHubCityResult,
  baselineCurrency: MoneyHubCurrency,
  displayCurrency: MoneyHubCurrency,
  fx: MoneyHubFxSnapshot | null,
): number | null => {
  if (result.invalid || baseline.invalid || result.missingCosts.length || baseline.missingCosts.length) return null;
  const destination = convertMoneyHubAmount(result.monthlySurplus, resultCurrency, displayCurrency, fx);
  const origin = convertMoneyHubAmount(baseline.monthlySurplus, baselineCurrency, displayCurrency, fx);
  if (destination === null || origin === null) return null;
  const difference = destination - origin;
  return Number.isFinite(difference) ? difference : null;
};

const unsolved = (
  status: MoneyHubEquivalentSalaryStatus,
  targetMonthlyTakeHome: number | null = null,
  targetMonthlySurplus: number | null = null,
): MoneyHubEquivalentSalary => ({ status, annualGross: null, targetMonthlyTakeHome, targetMonthlySurplus });

/**
 * The annual gross, in the destination's currency, whose calculated take-home
 * covers the destination budget and leaves `targetMonthlySurplus` (already in
 * the destination's currency; null when the baseline is incomplete).
 * Bisection between 0 and the bound; the answer is re-run through the
 * calculator and rejected unless it reproduces the target within tolerance.
 */
export const solveMoneyHubEquivalentSalary = (
  jurisdiction: MoneyHubJurisdictionId,
  destinationBudget: MoneyHubBudget,
  targetMonthlySurplus: number | null,
  options?: MoneyHubPayrollOptions,
): MoneyHubEquivalentSalary => {
  const costs = summariseBudget(destinationBudget).total;
  if (costs === null || targetMonthlySurplus === null || !Number.isFinite(targetMonthlySurplus)) {
    return unsolved('incomplete');
  }
  if (calculateMoneyHubPay(jurisdiction, 0, options).status === 'not-calculated') return unsolved('not-calculated');
  const probe = calculateMoneyHubCity(jurisdiction, MONEY_HUB_MAX_EQUIVALENT_SALARY, destinationBudget, options);
  if (probe.invalid) return unsolved('incomplete');

  const targetMonthlyTakeHome = costs + targetMonthlySurplus;
  if (!Number.isFinite(targetMonthlyTakeHome)) return unsolved('incomplete');
  if (targetMonthlyTakeHome < -MONEY_HUB_EQUIVALENT_SALARY_TOLERANCE) {
    return unsolved('unattainable-below-zero', targetMonthlyTakeHome, targetMonthlySurplus);
  }

  const at = (gross: number) => calculateMoneyHubCity(jurisdiction, gross, destinationBudget, options);
  /** Verified, or why not: an unsupported income next to the answer means the calculator cannot reach it. */
  const settle = (gross: number, neighbour: number): MoneyHubEquivalentSalary => {
    const result = at(gross);
    const surplus = result.monthlySurplus;
    if (surplus !== null && Math.abs(surplus - targetMonthlySurplus) <= MONEY_HUB_EQUIVALENT_SALARY_TOLERANCE) {
      return { status: 'complete', annualGross: gross, targetMonthlyTakeHome, targetMonthlySurplus };
    }
    const status = result.unsupported !== null || at(neighbour).unsupported !== null ? 'unsupported' : 'unattainable';
    return unsolved(status, targetMonthlyTakeHome, targetMonthlySurplus);
  };

  if (Math.abs(targetMonthlyTakeHome) <= MONEY_HUB_EQUIVALENT_SALARY_TOLERANCE) return settle(0, 0);
  if (probe.monthlyTakeHome === null || targetMonthlyTakeHome > probe.monthlyTakeHome + MONEY_HUB_EQUIVALENT_SALARY_TOLERANCE) {
    return unsolved('unattainable-above-bound', targetMonthlyTakeHome, targetMonthlySurplus);
  }

  // An unsupported income has no take-home; it reads as too little, so the
  // search climbs out of a low unsupported band and `settle` reports it.
  let low = 0;
  let high = MONEY_HUB_MAX_EQUIVALENT_SALARY;
  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    const surplus = at(mid).monthlySurplus;
    if (surplus === null || surplus < targetMonthlySurplus) low = mid;
    else high = mid;
  }
  return settle((low + high) / 2, low);
};

export type MoneyHubProvisionKind =
  | 'employer-package'
  | 'public-services'
  | 'employment-protections';

export type MoneyHubEligibilityState =
  | 'included-in-estimate'
  | 'potentially-eligible'
  | 'not-eligible'
  | 'not-assessed';

export interface MoneyHubProvision {
  id: string;
  kind: MoneyHubProvisionKind;
  /** Where this provision, as written, applies. Anywhere else it is not assessed. */
  jurisdictions: readonly MoneyHubJurisdictionId[];
  title: string;
  eligibilityState: MoneyHubEligibilityState;
  statutoryEntitlement: string;
  employerPackageNote: string;
  separateChargesAndLimits: string;
  cityComparisonNote: string;
  sourceLabel: string;
  sourceUrl: string;
  reviewedDate: string;
}

export const MONEY_HUB_PROVISION_KINDS = [
  { id: 'employer-package', label: 'Employer package' },
  { id: 'public-services', label: 'Public benefits & services' },
  { id: 'employment-protections', label: 'Employment protections' },
] as const;

export const MONEY_HUB_ELIGIBILITY_LABELS: Record<MoneyHubEligibilityState, string> = {
  'included-in-estimate': 'Included in estimate',
  'potentially-eligible': 'Potentially eligible',
  'not-eligible': 'Not eligible under these assumptions',
  'not-assessed': 'Not assessed',
};

const UK_ALL: readonly MoneyHubJurisdictionId[] = ['GB-ENG', 'GB-SCT', 'GB-WLS', 'GB-NIR'];
const ENGLAND: readonly MoneyHubJurisdictionId[] = ['GB-ENG'];
const SCOTLAND: readonly MoneyHubJurisdictionId[] = ['GB-SCT'];
const ENGLAND_WALES: readonly MoneyHubJurisdictionId[] = ['GB-ENG', 'GB-WLS'];
const GREAT_BRITAIN: readonly MoneyHubJurisdictionId[] = ['GB-ENG', 'GB-SCT', 'GB-WLS'];
const NORTHERN_IRELAND: readonly MoneyHubJurisdictionId[] = ['GB-NIR'];
const GERMANY: readonly MoneyHubJurisdictionId[] = ['DE'];
const NETHERLANDS: readonly MoneyHubJurisdictionId[] = ['NL'];

/** Sourced provisions for calculated jurisdictions (UK, Germany, Netherlands); user-supplied jurisdictions are not yet assessed. */
export const MONEY_HUB_PROVISIONS: readonly MoneyHubProvision[] = [
  {
    id: 'workplace-pension',
    kind: 'employer-package',
    jurisdictions: UK_ALL,
    title: 'Workplace pension (auto-enrolment)',
    eligibilityState: 'not-assessed',
    statutoryEntitlement:
      'Eligible employees aged 22 to State Pension age earning over £10,000/year in a job are automatically enrolled with a minimum total contribution of 8% on qualifying earnings (£6,240 to £50,270 in 2026/27), including at least 3% from the employer.',
    employerPackageNote:
      'Employers may contribute above 3%, match higher employee contributions, calculate on full salary, or use salary sacrifice. Excluded from cash take-home above so pension saving stays distinct from spendable monthly pay.',
    separateChargesAndLimits:
      'Employee contributions reduce monthly take-home pay; pension pots are normally inaccessible until minimum pension age and subject to annual allowance tax rules.',
    cityComparisonNote:
      'Statutory auto-enrolment thresholds and minimums apply uniformly across England, Scotland, Wales and Northern Ireland.',
    sourceLabel: 'GOV.UK workplace pensions',
    sourceUrl: 'https://www.gov.uk/workplace-pensions',
    reviewedDate: '2026-11-04',
  },
  {
    id: 'nhs-healthcare',
    kind: 'public-services',
    jurisdictions: ENGLAND,
    title: 'NHS England healthcare',
    eligibilityState: 'potentially-eligible',
    statutoryEntitlement:
      'Ordinarily resident employees in England receive NHS GP and hospital treatment funded through general taxation and National Insurance, without mandatory private insurance premiums.',
    employerPackageNote:
      'Employers may provide taxable Private Medical Insurance or dental/optical cash plans as a benefit in kind; none are assumed in this scenario.',
    separateChargesAndLimits:
      'Standard England out-of-pocket charges apply unless exempt (NHS prescriptions, banded NHS dental treatment, routine sight tests and optical vouchers). Visa routes may require the Immigration Health Surcharge. Documented entitlement does not measure local GP or NHS dentist availability.',
    cityComparisonNote:
      'NHS England charging rules apply equally across London, Manchester, Exeter and Southampton; enter expected dental, optical, prescription or private cover costs in the Healthcare budget category.',
    sourceLabel: 'NHS England help with health costs',
    sourceUrl: 'https://www.nhs.uk/nhs-services/help-with-health-costs/',
    reviewedDate: '2026-11-04',
  },
  {
    id: 'nhs-scotland-healthcare',
    kind: 'public-services',
    jurisdictions: SCOTLAND,
    title: 'NHS Scotland healthcare',
    eligibilityState: 'potentially-eligible',
    statutoryEntitlement:
      'Ordinarily resident employees receive public GP and hospital care funded through general taxation and National Insurance, without mandatory private insurance premiums. Unlike England, NHS prescriptions are dispensed free of charge in Scotland.',
    employerPackageNote:
      'Employers may provide taxable Private Medical Insurance or dental/optical cash plans as a benefit in kind; none are assumed in this scenario.',
    separateChargesAndLimits:
      'Patient charges still apply for NHS dental treatment and optical appliances unless exempt (in Scotland, NHS eye examinations are funded, whereas vouchers/charges apply to glasses and contact lenses). Documented entitlement does not measure local GP or NHS dentist availability.',
    cityComparisonNote:
      'NHS Scotland charging rules apply equally in Edinburgh and Glasgow; enter expected dental, optical or private cover costs in the Healthcare budget category.',
    sourceLabel: 'NHS inform help with health costs',
    sourceUrl: 'https://www.nhsinform.scot/care-support-and-rights/health-rights/access/help-with-health-costs/',
    reviewedDate: '2026-11-05',
  },
  {
    id: 'state-pension',
    kind: 'public-services',
    jurisdictions: UK_ALL,
    title: 'UK State Pension qualifying years',
    eligibilityState: 'not-assessed',
    statutoryEntitlement:
      'Employee earnings at or above the National Insurance Lower Earnings Limit build qualifying years toward the new State Pension; between that limit and the primary threshold, contributions are treated as paid (normally at least 10 qualifying years for any payment and 35 for the full rate).',
    employerPackageNote: 'Separate from workplace and personal pension savings.',
    separateChargesAndLimits:
      'No personal retirement income is projected here because entitlement depends on your lifetime National Insurance record and State Pension age legislation.',
    cityComparisonNote:
      'National Insurance thresholds, rates and State Pension qualifying rules are identical across England, Scotland, Wales and Northern Ireland.',
    sourceLabel: 'GOV.UK new State Pension',
    sourceUrl: 'https://www.gov.uk/new-state-pension',
    reviewedDate: '2026-11-04',
  },
  {
    id: 'cash-benefits-universal-credit',
    kind: 'public-services',
    jurisdictions: UK_ALL,
    title: 'Universal Credit and working-age cash benefits',
    eligibilityState: 'not-assessed',
    statutoryEntitlement:
      'Universal Credit, Child Benefit and Tax-Free Childcare provide means-tested or household-tested support subject to income, savings, housing, children and residence rules.',
    employerPackageNote:
      'Separate from employer contractual allowances or workplace nursery schemes.',
    separateChargesAndLimits:
      'Eligibility is not assessed: a single adult on a low wage who rents can qualify, depending on income, savings and housing costs. No cash benefit is added to take-home, because unassessed benefits never silently add cash to the result.',
    cityComparisonNote:
      'Core Universal Credit and Child Benefit rules apply across the UK (with Scottish Child Payment and devolved administration adaptations in Scotland and Northern Ireland), and Local Housing Allowance caps vary by area.',
    sourceLabel: 'GOV.UK Universal Credit',
    sourceUrl: 'https://www.gov.uk/universal-credit',
    reviewedDate: '2026-11-04',
  },
  {
    id: 'local-council-services',
    kind: 'public-services',
    jurisdictions: ENGLAND_WALES,
    title: 'Council Tax and local authority services',
    eligibilityState: 'included-in-estimate',
    statutoryEntitlement:
      'Local councils fund waste collection, local roads, libraries, social care and policing precepts partly through Council Tax: bands A to H on 1991 property values in England, and A to I on 2003 values in Wales.',
    employerPackageNote:
      'Paid by the resident from net income rather than deducted through payroll.',
    separateChargesAndLimits:
      'A single adult living alone normally qualifies for a 25% single-person Council Tax discount; students and specific exemptions differ.',
    cityComparisonNote:
      'Each council in England and Wales sets its own charge per band, so enter the monthly amount for each city in the basket; the estimate includes exactly what you enter.',
    sourceLabel: 'GOV.UK Council Tax',
    sourceUrl: 'https://www.gov.uk/council-tax',
    reviewedDate: '2026-11-04',
  },
  {
    id: 'scotland-council-tax',
    kind: 'public-services',
    jurisdictions: SCOTLAND,
    title: 'Council Tax and local authority services (Scotland)',
    eligibilityState: 'included-in-estimate',
    statutoryEntitlement:
      'Scottish councils fund local services partly through Council Tax, with homes banded A to H on 1991 property values; water and sewerage charges are billed alongside it.',
    employerPackageNote:
      'Paid by the resident from net income rather than deducted through payroll.',
    separateChargesAndLimits:
      'A single adult living alone normally qualifies for a 25% single-person discount; students and specific exemptions differ.',
    cityComparisonNote:
      'Edinburgh and Glasgow set their own charges per band, so enter the monthly amount for each city in the basket; the estimate includes exactly what you enter.',
    sourceLabel: 'mygov.scot Council Tax',
    sourceUrl: 'https://www.mygov.scot/council-tax',
    reviewedDate: '2026-11-05',
  },
  {
    id: 'ni-domestic-rates',
    kind: 'public-services',
    jurisdictions: NORTHERN_IRELAND,
    title: 'Northern Ireland domestic rates and local services',
    eligibilityState: 'included-in-estimate',
    statutoryEntitlement:
      'Local council and regional public services in Northern Ireland (including domestic water and sewerage for unbilled households) are funded partly through domestic rates assessed on 2005 individual property capital values rather than Great Britain Council Tax bands.',
    employerPackageNote:
      'Paid by the resident from net income (or included in rent by arrangement) rather than deducted through payroll.',
    separateChargesAndLimits:
      'Rate poundages combine a district rate set by the local council (such as Belfast City Council) and a regional rate, with a maximum capital value cap and specific reliefs for eligible households.',
    cityComparisonNote:
      'Enter the monthly domestic rates bill for Belfast in the Local taxes & household charges category; the estimate includes exactly what you enter.',
    sourceLabel: 'nidirect domestic rating system',
    sourceUrl: 'https://www.nidirect.gov.uk/articles/Calculate-your-rates-bill',
    reviewedDate: '2026-11-05',
  },
  {
    id: 'paid-annual-leave',
    kind: 'employment-protections',
    jurisdictions: UK_ALL,
    title: 'Paid statutory annual leave',
    eligibilityState: 'not-assessed',
    statutoryEntitlement:
      'Full-time workers are entitled to at least 5.6 weeks (28 days for a five-day week) of paid statutory holiday per year, which an employer may include UK bank holidays within.',
    employerPackageNote:
      'Employers often offer contractual leave above 28 days (for example 25 days plus 8 bank holidays) or holiday buy/sell schemes.',
    separateChargesAndLimits:
      'Treated as a non-cash protection; leave days are not converted into extra cash in the monthly surplus.',
    cityComparisonNote:
      'The 5.6-week (28-day) statutory minimum applies across the UK; statutory bank holiday counts differ by nation (8 in England and Wales, 9 in Scotland, 10 in Northern Ireland).',
    sourceLabel: 'GOV.UK holiday entitlement',
    sourceUrl: 'https://www.gov.uk/holiday-entitlement-rights',
    reviewedDate: '2026-11-04',
  },
  {
    id: 'sick-and-parental-protections',
    kind: 'employment-protections',
    jurisdictions: GREAT_BRITAIN,
    title: 'Statutory sick and parental leave protections',
    eligibilityState: 'not-assessed',
    statutoryEntitlement:
      'Statutory Sick Pay (SSP) and statutory maternity, paternity, adoption and shared parental leave/pay set legal minimums across Great Britain, subject to earnings and qualifying rules.',
    employerPackageNote:
      'Contractual occupational sick pay and enhanced parental pay vary widely by employer and should be compared alongside gross salary offers.',
    separateChargesAndLimits:
      'Statutory weekly rates are capped and do not replace full salary; no sick or parental pay adjustment is added to the full-year salary calculation.',
    cityComparisonNote:
      'Statutory Sick Pay and statutory parental pay rules apply uniformly across England, Scotland and Wales. Northern Ireland legislates separately and is not assessed here.',
    sourceLabel: 'GOV.UK Statutory Sick Pay',
    sourceUrl: 'https://www.gov.uk/statutory-sick-pay',
    reviewedDate: '2026-11-04',
  },
  {
    id: 'de-occupational-pension',
    kind: 'employer-package',
    jurisdictions: GERMANY,
    title: 'Occupational pension (Betriebliche Altersversorgung)',
    eligibilityState: 'not-assessed',
    statutoryEntitlement:
      'Employees in Germany have a statutory right to convert part of their gross salary into an occupational pension (Entgeltumwandlung), with a mandatory 15% employer subsidy where the employer saves social security contributions.',
    employerPackageNote:
      'Employer-funded pension promises and matching contributions vary by collective agreement (Tarifvertrag) and employer; none are deducted from or added to the cash take-home figure above.',
    separateChargesAndLimits:
      'Salary conversion is tax-free up to 8% and free of social contributions up to 4% of the general pension insurance contribution ceiling (Beitragsbemessungsgrenze); benefits are taxed in retirement.',
    cityComparisonNote:
      'Federal occupational pension rules apply identically in Berlin, Munich, Hamburg and Frankfurt.',
    sourceLabel: 'BMAS betriebliche Altersvorsorge',
    sourceUrl: 'https://www.bmas.de/DE/Soziales/Rente-und-Altersvorsorge/Betriebliche-Altersvorsorge/betriebliche-altersvorsorge.html',
    reviewedDate: '2026-11-05',
  },
  {
    id: 'de-statutory-healthcare',
    kind: 'public-services',
    jurisdictions: GERMANY,
    title: 'Statutory health & care insurance (GKV & Pflegeversicherung)',
    eligibilityState: 'included-in-estimate',
    statutoryEntitlement:
      'Employees are covered by statutory health (Krankenversicherung) and long-term care insurance (Pflegeversicherung). The employee half of the 14.6% base rate plus the 2.9% average Zusatzbeitrag and care insurance (1.8% base, plus 0.6% if childless from age 23) is already deducted in calculated take-home above.',
    employerPackageNote:
      'The employer pays the matching half of statutory health and base care insurance on top of gross salary.',
    separateChargesAndLimits:
      'Statutory co-payments (Zuzahlungen, typically €5 to €10 for prescriptions and hospital days) are capped at 2% of gross household income (1% for chronic illness). Enter only out-of-pocket co-payments or supplementary cover in the Healthcare budget category.',
    cityComparisonNote:
      'Contribution ceilings and statutory coverage are uniform across Berlin, Munich, Hamburg and Frankfurt, though individual Krankenkassen set their own Zusatzbeitrag rate.',
    sourceLabel: 'BMG gesetzliche Krankenversicherung',
    sourceUrl: 'https://www.bundesgesundheitsministerium.de/gesetzlich-versicherte.html',
    reviewedDate: '2026-11-05',
  },
  {
    id: 'de-statutory-pension-unemployment',
    kind: 'public-services',
    jurisdictions: GERMANY,
    title: 'Statutory pension & unemployment insurance (DRV & Arbeitslosenversicherung)',
    eligibilityState: 'included-in-estimate',
    statutoryEntitlement:
      'Employee contributions of 9.3% for statutory pension insurance and 1.3% for unemployment insurance (up to the €101,400/year 2026 ceiling) are already deducted in calculated take-home above, building pension points (Entgeltpunkte) and unemployment benefit (Arbeitslosengeld I) entitlement.',
    employerPackageNote:
      'Matched equally by the employer up to the contribution ceiling.',
    separateChargesAndLimits:
      'A regular statutory old-age pension normally requires at least 5 qualifying years (allgemeine Wartezeit), and Arbeitslosengeld I normally requires 12 months of insured employment within 30 months; no retirement payout is projected here.',
    cityComparisonNote:
      'Since 2025/2026 a unified federal pension contribution ceiling and point value apply across Berlin, Munich, Hamburg and Frankfurt.',
    sourceLabel: 'Deutsche Rentenversicherung',
    sourceUrl: 'https://www.deutsche-rentenversicherung.de/',
    reviewedDate: '2026-11-05',
  },
  {
    id: 'de-leave-and-sick-pay',
    kind: 'employment-protections',
    jurisdictions: GERMANY,
    title: 'Statutory holiday (BUrlG) and continued sick pay (EFZG)',
    eligibilityState: 'not-assessed',
    statutoryEntitlement:
      'The Federal Holiday Act (Bundesurlaubsgesetz) sets a statutory minimum of 20 paid working days per year for a 5-day week (24 days for a 6-day week), in addition to public holidays. Under the Entgeltfortzahlungsgesetz, employers continue paying 100% of salary for up to 6 weeks of certified illness, followed by statutory Krankengeld from the health fund.',
    employerPackageNote:
      'Standard full-time contracts in Germany commonly grant 25 to 30 paid holiday days per year.',
    separateChargesAndLimits:
      'Leave days and sick-pay protections are non-cash comparisons and do not add cash to monthly take-home.',
    cityComparisonNote:
      'Statutory public holiday counts differ by federal state (Land): Bavaria (Munich) has more state public holidays than Berlin, Hamburg or Hesse (Frankfurt).',
    sourceLabel: 'BMAS Arbeitsrecht',
    sourceUrl: 'https://www.bmas.de/DE/Arbeit/Arbeitsrecht/arbeitsrecht.html',
    reviewedDate: '2026-11-05',
  },
  {
    id: 'nl-holiday-allowance',
    kind: 'employer-package',
    jurisdictions: NETHERLANDS,
    title: 'Statutory 8% holiday allowance (vakantiegeld)',
    eligibilityState: 'included-in-estimate',
    statutoryEntitlement:
      'Under the Wet minimumloon en minimumvakantiebijslag, employees are entitled to a statutory holiday allowance (vakantiegeld) of at least 8% of gross wage, usually paid in May or June. In Money Hub, the annual gross input for the Netherlands includes this 8% allowance and spreads it across the 12 monthly averages.',
    employerPackageNote:
      'Some collective agreements (CAO) pay more than 8% or add a 13th month; enter such an offer as its total annual gross.',
    separateChargesAndLimits:
      'Because the 8% holiday allowance is paid annually by most employers, ordinary monthly payslips outside the payout month are lower than one twelfth of total annual net pay.',
    cityComparisonNote:
      'Statutory vakantiegeld rules apply identically in Amsterdam, Rotterdam and Utrecht.',
    sourceLabel: 'Rijksoverheid vakantiedagen en vakantiegeld',
    sourceUrl: 'https://www.rijksoverheid.nl/onderwerpen/vakantiedagen-en-vakantiegeld',
    reviewedDate: '2026-11-05',
  },
  {
    id: 'nl-occupational-pension',
    kind: 'employer-package',
    jurisdictions: NETHERLANDS,
    title: 'Occupational pension (second pillar)',
    eligibilityState: 'not-assessed',
    statutoryEntitlement:
      'There is no general statutory right to an occupational pension; schemes are set by sector or company collective agreements (CAO) and employer pension schemes.',
    employerPackageNote:
      'Employer and employee contribution shares vary by scheme; compare them alongside the gross offer.',
    separateChargesAndLimits:
      'Employee pension contributions come out of gross pay before tax but are not deducted in the Dutch calculation here, so take-home is overstated for a scheme member; use your own net figure from a payslip instead.',
    cityComparisonNote:
      'Scheme membership depends on the employer and sector, not the city.',
    sourceLabel: 'Rijksoverheid pensioen',
    sourceUrl: 'https://www.rijksoverheid.nl/themas/werk/pensioen',
    reviewedDate: '2026-11-05',
  },
  {
    id: 'nl-zorgverzekering',
    kind: 'public-services',
    jurisdictions: NETHERLANDS,
    title: 'Mandatory basic health insurance (Zorgverzekeringswet)',
    eligibilityState: 'included-in-estimate',
    statutoryEntitlement:
      'Every resident working in the Netherlands must take out private basic health insurance (basisverzekering) under the Zorgverzekeringswet. Insurers must accept all applicants at a community-rated premium without health underwriting.',
    employerPackageNote:
      'Employers pay a separate income-related Zvw contribution (werkgeversheffing Zvw) outside employee net pay.',
    separateChargesAndLimits:
      'Unlike the UK or Germany, the monthly health insurance premium is paid directly by the resident from net income (not deducted from pay above), alongside a mandatory €385/year deductible (verplicht eigen risico, excluding GP visits). Low-income households may qualify for unassessed zorgtoeslag. Enter your monthly premium and expected deductible in the Healthcare budget category; the estimate includes exactly what you enter.',
    cityComparisonNote:
      'National Zvw rules and the €385 annual deductible apply equally across Amsterdam, Rotterdam and Utrecht.',
    sourceLabel: 'Rijksoverheid zorgverzekering',
    sourceUrl: 'https://www.rijksoverheid.nl/onderwerpen/zorgverzekering',
    reviewedDate: '2026-11-05',
  },
  {
    id: 'nl-aow-national-insurance',
    kind: 'public-services',
    jurisdictions: NETHERLANDS,
    title: 'AOW state pension & national insurance (volksverzekeringen)',
    eligibilityState: 'included-in-estimate',
    statutoryEntitlement:
      'First-bracket payroll deductions include 27.65% national insurance contributions (17.90% AOW state pension, 0.10% Anw survivor benefit and 9.65% Wlz long-term care) on income up to €38,883. Each year of residence/work in the Netherlands builds 2% toward a full AOW pension over the 50 years before AOW age (67 in 2026).',
    employerPackageNote:
      'Separate from second-pillar occupational pension accrual.',
    separateChargesAndLimits:
      'No personal retirement income is projected here because AOW entitlement depends on total years insured in the Netherlands.',
    cityComparisonNote:
      'National insurance rates and AOW accrual rules are identical across Amsterdam, Rotterdam and Utrecht.',
    sourceLabel: 'Sociale Verzekeringsbank (SVB) AOW',
    sourceUrl: 'https://www.svb.nl/nl/aow',
    reviewedDate: '2026-11-05',
  },
  {
    id: 'nl-leave-and-sick-pay',
    kind: 'employment-protections',
    jurisdictions: NETHERLANDS,
    title: 'Statutory annual leave and 104-week sick pay protection',
    eligibilityState: 'not-assessed',
    statutoryEntitlement:
      'Full-time employees are entitled to statutory paid leave of at least four times their weekly working hours (20 days for a 5-day week; statutory days expire 6 months after the calendar year unless unable to take them). During illness, employers must continue paying at least 70% of wages (subject to minimum and maximum daily wage rules) for up to 104 weeks.',
    employerPackageNote:
      'Many contracts and collective agreements (CAOs) add extra holiday days (bovenwettelijke vakantiedagen, often 25+ days total) and top up year-one sick pay to 100%.',
    separateChargesAndLimits:
      'Treated as non-cash protections; leave days and sick-pay protection do not add cash to monthly take-home.',
    cityComparisonNote:
      'Employment law, statutory leave and sick-pay protections apply uniformly across Amsterdam, Rotterdam and Utrecht.',
    sourceLabel: 'Rijksoverheid ziekteverzuim van het werk',
    sourceUrl: 'https://www.rijksoverheid.nl/onderwerpen/ziekteverzuim-van-het-werk',
    reviewedDate: '2026-11-05',
  },
];

export const moneyHubProvisionsFor = (jurisdiction: MoneyHubJurisdictionId): readonly MoneyHubProvision[] =>
  MONEY_HUB_PROVISIONS.filter(provision => provision.jurisdictions.includes(jurisdiction));

export interface MoneyHubSourceBudgetItem {
  name: string;
  budgeted: number;
}

export interface MoneyHubSourceBudgetCategory {
  name: string;
  group?: 'needs' | 'wants' | 'savings';
  budgeted?: number;
  items?: readonly MoneyHubSourceBudgetItem[];
}

export interface MoneyHubImportedBudget {
  budget: MoneyHubBudget;
  copiedCategories: MoneyHubCostId[];
  totalMonthlyCopied: number;
}

export const classifyPersonalBudgetEntry = (
  categoryName: string,
  itemName: string,
  group?: 'needs' | 'wants' | 'savings',
): MoneyHubCostId => {
  const text = `${categoryName} ${itemName}`.toLowerCase();
  const catLower = categoryName.toLowerCase();
  if (/\bcouncil\s*tax\b/.test(text)) return 'localCharges';
  if (
    /\b(energy|electric|electricity|gas|water|internet|broadband|wi-?fi|phone|mobile|utilities|tv\s*licen[cs]e)\b/.test(
      text,
    )
  ) {
    return 'utilities';
  }
  if (
    /\b(rent|mortgage|service\s*charge|ground\s*rent|home\s*insurance|contents\s*insurance|buildings\s*insurance|housing|accommodation)\b/.test(
      text,
    )
  ) {
    return 'housing';
  }
  // Repairs and maintenance are housing only for a home, never for a car.
  if (/\b(maintenance|repairs?)\b/.test(text) && /\b(home|house|flat|property|living|boiler)\b/.test(text)) {
    return 'housing';
  }
  if (/\b(grocer|groceries|supermarket|household|toiletries|cleaning)\b/.test(text)) {
    return 'groceries';
  }
  if (
    /\b(transport|transportation|public\s*transport|train|rail|tube|bus|commute|fuel|petrol|diesel|car\s*insurance|cars?|vehicle|parking|mot|road\s*tax)\b/.test(
      text,
    )
  ) {
    return 'transport';
  }
  if (
    /\b(health|healthcare|medical|dental|dentist|optician|optical|prescription|therapy|doctor|pharmacy)\b/.test(
      text,
    )
  ) {
    return 'healthcare';
  }
  if (
    /\b(restaurant|restaurants|dining|takeaway|coffee|bar|pub|entertainment|streaming|netflix|prime\s*video|disney|apple\s*tv|sky|now|paramount|discovery|youtube|crunchyroll|spotify|gym|fitness|self\s*care|personal\s*care|shopping|clothes|hobby|hobbies|leisure|holiday|vacation|trip|books|games|gaming)\b/.test(
      text,
    )
  ) {
    return 'leisure';
  }
  // A Home category's own unallocated amount is housing; an unmatched item in it
  // (childcare, pets) is not, or it would inflate the housing share.
  if (itemName.trim() === '' && /\b(home|house|living)\b/.test(catLower) && group !== 'wants') {
    return 'housing';
  }
  if (
    group === 'wants' &&
    !/\b(loan|debt|credit\s*card|repayment|finance|pcp|childcare|nursery|school|tuition|education|pets?|dogs?|cats?|vets?|donation|charity|gift|subscription)\b/.test(
      text,
    )
  ) {
    return 'leisure';
  }
  return 'commitments';
};

export const mapPersonalBudgetToMoneyHub = (
  categories: readonly MoneyHubSourceBudgetCategory[],
): MoneyHubImportedBudget => {
  const totals: Record<MoneyHubCostId, number> = {
    housing: 0,
    utilities: 0,
    groceries: 0,
    transport: 0,
    healthcare: 0,
    leisure: 0,
    localCharges: 0,
    commitments: 0,
  };

  // A category totals what the Budget screen shows for it: its own budgeted
  // amount when set, otherwise the sum of its items. Items split that total; an
  // over-allocated category's items are scaled down to it, and an
  // under-allocated category's remainder is classified by the category name.
  for (const cat of categories) {
    if (cat.group === 'savings' || /^\s*savings\s*$/i.test(cat.name)) continue;
    const items = (cat.items ?? []).filter(item => Number.isFinite(item.budgeted) && item.budgeted > 0);
    const itemsSum = items.reduce((sum, item) => sum + item.budgeted, 0);
    const ownBudget = cat.budgeted !== undefined && Number.isFinite(cat.budgeted) ? Math.max(0, cat.budgeted) : null;
    const categoryTotal = ownBudget ?? itemsSum;
    const scale = itemsSum > categoryTotal ? categoryTotal / itemsSum : 1;
    for (const item of items) {
      totals[classifyPersonalBudgetEntry(cat.name, item.name, cat.group)] += item.budgeted * scale;
    }
    if (categoryTotal > itemsSum) {
      totals[classifyPersonalBudgetEntry(cat.name, '', cat.group)] += categoryTotal - itemsSum;
    }
  }

  let totalMonthlyCopied = 0;
  for (const { id } of MONEY_HUB_COSTS) {
    totalMonthlyCopied += totals[id];
  }

  if (totalMonthlyCopied <= 0 || !Number.isFinite(totalMonthlyCopied)) {
    return {
      budget: emptyMoneyHubBudget(),
      copiedCategories: [],
      totalMonthlyCopied: 0,
    };
  }

  const budget: MoneyHubBudget = {
    housing: totals.housing,
    utilities: totals.utilities,
    groceries: totals.groceries,
    transport: totals.transport,
    healthcare: totals.healthcare,
    leisure: totals.leisure,
    localCharges: totals.localCharges,
    commitments: totals.commitments,
  };

  const copiedCategories = MONEY_HUB_COSTS.map(c => c.id).filter(id => totals[id] > 0);

  return {
    budget,
    copiedCategories,
    totalMonthlyCopied,
  };
};

export const MONEY_HUB_HOUSING_DELTAS = [-0.2, -0.1, 0, 0.1, 0.2] as const;

export interface MoneyHubHousingSensitivityPoint {
  /** Fractional change applied to housing cost, e.g. -0.2 for -20%. */
  delta: number;
  housingCost: number;
  monthlyCosts: number;
  monthlySurplus: number;
  housingShareOfTakeHome: number | null;
}

export interface MoneyHubHousingSensitivity {
  /** Maximum monthly housing cost before monthlySurplus turns negative; null if non-housing costs already exceed take-home. */
  breakEvenHousing: number | null;
  /** Monthly housing cost in this city that reproduces `targetMonthlySurplus` (in this city's currency); null if target is null or requires negative housing. */
  housingToMatchBaselineSurplus: number | null;
  points: readonly MoneyHubHousingSensitivityPoint[];
}

export const calculateMoneyHubHousingSensitivity = (
  result: MoneyHubCityResult,
  budget: MoneyHubBudget,
  targetMonthlySurplus: number | null = null,
): MoneyHubHousingSensitivity | null => {
  if (
    result.invalid ||
    result.missingCosts.length > 0 ||
    result.monthlyTakeHome === null ||
    result.monthlyCosts === null ||
    budget.housing === null ||
    !Number.isFinite(result.monthlyTakeHome) ||
    !Number.isFinite(result.monthlyCosts) ||
    !Number.isFinite(budget.housing) ||
    budget.housing < 0
  ) {
    return null;
  }

  const housing = budget.housing;
  const nonHousingCosts = result.monthlyCosts - housing;
  if (!Number.isFinite(nonHousingCosts)) return null;

  const rawBreakEven = result.monthlyTakeHome - nonHousingCosts;
  const breakEvenHousing = Number.isFinite(rawBreakEven) && rawBreakEven >= 0 ? rawBreakEven : null;

  let housingToMatchBaselineSurplus: number | null = null;
  if (targetMonthlySurplus !== null && Number.isFinite(targetMonthlySurplus)) {
    const rawTargetHousing = result.monthlyTakeHome - nonHousingCosts - targetMonthlySurplus;
    if (Number.isFinite(rawTargetHousing) && rawTargetHousing >= 0) {
      housingToMatchBaselineSurplus = rawTargetHousing;
    }
  }

  const points: MoneyHubHousingSensitivityPoint[] = [];
  for (const delta of MONEY_HUB_HOUSING_DELTAS) {
    const housingCost = housing * (1 + delta);
    const monthlyCosts = nonHousingCosts + housingCost;
    const monthlySurplus = result.monthlyTakeHome - monthlyCosts;
    if (!Number.isFinite(housingCost) || !Number.isFinite(monthlyCosts) || !Number.isFinite(monthlySurplus)) {
      return null;
    }
    const rawShare = result.monthlyTakeHome > 0 ? housingCost / result.monthlyTakeHome : null;
    const housingShareOfTakeHome = rawShare !== null && Number.isFinite(rawShare) ? rawShare : null;
    points.push({
      delta,
      housingCost,
      monthlyCosts,
      monthlySurplus,
      housingShareOfTakeHome,
    });
  }

  return {
    breakEvenHousing,
    housingToMatchBaselineSurplus,
    points,
  };
};

export const MONEY_HUB_RELOCATION_ITEMS = [
  { id: 'tenancyDeposit', label: 'Tenancy / security deposit', kind: 'deposit' },
  { id: 'otherDeposits', label: 'Utility & key deposits', kind: 'deposit' },
  { id: 'visaAndLegal', label: 'Visa, permits & legal fees', kind: 'consumed' },
  { id: 'travelAndShipping', label: 'Travel, removals & shipping', kind: 'consumed' },
  { id: 'agencyAndAdmin', label: 'Registration & agency fees', kind: 'consumed' },
  { id: 'setupAndFurnishing', label: 'Initial furnishing & setup', kind: 'consumed' },
] as const;

export type MoneyHubRelocationItemId = typeof MONEY_HUB_RELOCATION_ITEMS[number]['id'];
export type MoneyHubRelocationInputs = Record<MoneyHubRelocationItemId, number | null>;

export interface MoneyHubRelocationResult {
  /** Cash tied up in refundable deposits, in the city's currency; null until all 6 fields are supplied or if invalid. */
  depositsTiedUp: number | null;
  /** One-off consumed moving expenses, in the city's currency; null until all 6 fields are supplied or if invalid. */
  consumedExpenses: number | null;
  /** Total upfront cash required (`depositsTiedUp + consumedExpenses`); null until complete and valid. */
  totalUpfrontCash: number | null;
  /**
   * Months of this city's positive `monthlySurplus` needed to earn back `consumedExpenses`
   * (excluding refundable deposits). 0 when `consumedExpenses === 0`; null when
   * `monthlySurplus === null` or `monthlySurplus <= 0`.
   */
  monthsOfSurplusToRecoverConsumed: number | null;
  /**
   * Months of positive monthly surplus gain over the baseline (in this city's currency)
   * needed to earn back `consumedExpenses`. 0 when `consumedExpenses === 0`; null when
   * `monthlySurplusGainVsBaseline === null` or `monthlySurplusGainVsBaseline <= 0`.
   */
  monthsOfGainToRecoverConsumed: number | null;
  missingItems: MoneyHubRelocationItemId[];
  invalid: boolean;
}

export const emptyMoneyHubRelocation = (): MoneyHubRelocationInputs => ({
  tenancyDeposit: null,
  otherDeposits: null,
  visaAndLegal: null,
  travelAndShipping: null,
  agencyAndAdmin: null,
  setupAndFurnishing: null,
});

const monthsToRecoverConsumed = (consumed: number, monthlyFlow: number | null): number | null => {
  if (monthlyFlow === null || !Number.isFinite(monthlyFlow)) return null;
  if (consumed === 0) return 0;
  if (monthlyFlow <= 0) return null;
  const months = consumed / monthlyFlow;
  return Number.isFinite(months) ? months : null;
};

export const calculateMoneyHubRelocation = (
  inputs: MoneyHubRelocationInputs,
  monthlySurplus: number | null,
  monthlySurplusGainVsBaseline: number | null = null,
): MoneyHubRelocationResult => {
  const missingItems: MoneyHubRelocationItemId[] = [];
  let deposits = 0;
  let consumed = 0;
  let invalid = false;

  for (const { id, kind } of MONEY_HUB_RELOCATION_ITEMS) {
    const val = inputs[id];
    if (val == null) {
      missingItems.push(id);
    } else if (!Number.isFinite(val) || val < 0) {
      invalid = true;
    } else if (kind === 'deposit') {
      deposits += val;
    } else {
      consumed += val;
    }
  }

  const total = deposits + consumed;
  if (!Number.isFinite(deposits) || !Number.isFinite(consumed) || !Number.isFinite(total)) {
    invalid = true;
  }

  if (invalid || missingItems.length > 0) {
    return {
      depositsTiedUp: null,
      consumedExpenses: null,
      totalUpfrontCash: null,
      monthsOfSurplusToRecoverConsumed: null,
      monthsOfGainToRecoverConsumed: null,
      missingItems,
      invalid,
    };
  }

  return {
    depositsTiedUp: deposits,
    consumedExpenses: consumed,
    totalUpfrontCash: total,
    monthsOfSurplusToRecoverConsumed: monthsToRecoverConsumed(consumed, monthlySurplus),
    monthsOfGainToRecoverConsumed: monthsToRecoverConsumed(consumed, monthlySurplusGainVsBaseline),
    missingItems,
    invalid: false,
  };
};


import {
  calculateUkTax,
  UK_TAX_YEAR_LABEL,
  type UkPensionBasis,
  type UkPensionMethod,
  type UkTaxRegion,
  type UkUndergradPlan,
} from './uk-tax-calculator';
import { calculateDeTax, DE_AVERAGE_HEALTH_ADDITIONAL_RATE, DE_MIDIJOB_UPPER_MONTHLY, DE_TAX_YEAR_LABEL } from './de-tax-calculator';
import { calculateNlTax, NL_TAX_YEAR_LABEL } from './nl-tax-calculator';
import type { MoneyHubJurisdictionId } from './money-hub-catalogue';

/**
 * The payroll calculators behind Money Hub's `calculated` jurisdictions, each
 * mapped onto one common shape: annual take-home plus the deductions that
 * explain it. Each calculator keeps its own scope; a circumstance it does not
 * model is reported as `unsupported` so no confident figure is shown for it.
 */

export interface MoneyHubUkOptions {
  /** Employee gross pension percentage (0 to 100), e.g. 5 for 5%. Null or undefined is 0%. */
  pensionPercent?: number | null;
  pensionMethod?: UkPensionMethod;
  pensionBasis?: UkPensionBasis;
  undergradPlan?: UkUndergradPlan;
  postgradLoan?: boolean;
  /**
   * Base annual personal allowance (£/yr) before the £100,000 taper.
   * Null or undefined uses the statutory £12,570 allowance; 0 is a valid BR/0T code.
   */
  personalAllowance?: number | null;
}

export interface MoneyHubDeOptions {
  /**
   * Aged 23 or over. The hub's household has no children, so this alone decides
   * the childless care surcharge. Undefined is true.
   */
  aged23OrOver?: boolean;
  /** The health fund's total additional rate in percent (0 to 10), e.g. 2.9. Null or undefined is the 2026 average. */
  healthAdditionalPercent?: number | null;
}

export interface MoneyHubPayrollOptions {
  uk?: MoneyHubUkOptions;
  de?: MoneyHubDeOptions;
}

export interface MoneyHubDeduction {
  id: string;
  label: string;
  annual: number;
}

export interface MoneyHubAnnualPay {
  annualTakeHome: number;
  /** Every deduction the calculator makes, zeros included; they sum to gross less take-home. */
  deductions: readonly MoneyHubDeduction[];
  /** Why this income is outside the calculator's scope, or null when it is covered. */
  unsupported: string | null;
}

export type MoneyHubPayResult =
  | { status: 'calculated'; pay: MoneyHubAnnualPay }
  | { status: 'invalid-options' }
  | { status: 'not-calculated' };

export interface MoneyHubPayrollScope {
  /** Rule set and period, e.g. "UK 2026/27". */
  rules: string;
  /** Who the calculation covers. */
  covers: string;
  /** What it leaves out, so the page can say so. */
  excludes: string;
}

const UK_SCOPE: MoneyHubPayrollScope = {
  rules: `UK ${UK_TAX_YEAR_LABEL} income tax, employee National Insurance and student loans`,
  covers: 'One adult employee for the full tax year, with the UK payroll options.',
  excludes: 'Benefits in kind, child benefit and other income.',
};

export const MONEY_HUB_PAYROLL_SCOPES: Record<'GB-ENG' | 'GB-SCT' | 'GB-WLS' | 'GB-NIR' | 'DE' | 'NL', MoneyHubPayrollScope> = {
  'GB-ENG': UK_SCOPE,
  'GB-SCT': { ...UK_SCOPE, rules: `${UK_SCOPE.rules}, with Scottish income tax bands` },
  'GB-WLS': UK_SCOPE,
  'GB-NIR': UK_SCOPE,
  DE: {
    rules: `German ${DE_TAX_YEAR_LABEL} income tax assessment, solidarity surcharge and employee social insurance`,
    covers: `One single adult employee without children, resident all year with statutory health insurance, earning over €${DE_MIDIJOB_UPPER_MONTHLY.toLocaleString('en-GB')} a month.`,
    excludes: 'Children (child allowances, Kindergeld and care discounts), church tax, private health insurance, Saxony\'s care split and monthly Lohnsteuer withholding differences.',
  },
  NL: {
    rules: `Dutch ${NL_TAX_YEAR_LABEL} wage tax, national insurance and the general and labour tax credits`,
    covers: 'One resident employee below State Pension age for the full year; gross includes the 8% holiday allowance.',
    excludes: 'The 30% ruling, occupational pension contributions and other income.',
  },
};

const percentInRange = (value: number | null | undefined, max: number): boolean =>
  value === undefined || value === null || (Number.isFinite(value) && value >= 0 && value <= max);

const ukPay = (income: number, region: UkTaxRegion, options: MoneyHubUkOptions = {}): MoneyHubPayResult => {
  const allowance = options.personalAllowance;
  if (!percentInRange(options.pensionPercent, 100)) return { status: 'invalid-options' };
  if (allowance !== undefined && allowance !== null && (!Number.isFinite(allowance) || allowance < 0)) {
    return { status: 'invalid-options' };
  }
  const tax = calculateUkTax({
    income,
    kind: 'employed',
    region,
    benefitsInKind: 0,
    pensionContribution: 0,
    pensionShare: (options.pensionPercent ?? 0) / 100,
    pensionBasis: options.pensionBasis ?? 'salary',
    pensionMethod: options.pensionMethod ?? 'salary-sacrifice',
    undergradPlan: options.undergradPlan ?? 'none',
    postgradLoan: options.postgradLoan ?? false,
    children: 0,
    childcareSupport: 0,
    marriageAllowance: false,
    personalAllowance: allowance ?? undefined,
  });
  return {
    status: 'calculated',
    pay: {
      annualTakeHome: tax.takeHome,
      deductions: [
        { id: 'income-tax', label: 'Income tax', annual: tax.incomeTax },
        { id: 'national-insurance', label: 'National Insurance', annual: tax.nationalInsurance },
        { id: 'pension', label: 'Pension from pay', annual: tax.pensionFromPay },
        { id: 'student-loan', label: 'Student loan', annual: tax.studentLoan + tax.postgradLoan },
      ],
      unsupported: null,
    },
  };
};

const dePay = (income: number, options: MoneyHubDeOptions = {}): MoneyHubPayResult => {
  if (!percentInRange(options.healthAdditionalPercent, 10)) return { status: 'invalid-options' };
  const additional = options.healthAdditionalPercent;
  const tax = calculateDeTax({
    income,
    childless: options.aged23OrOver ?? true,
    healthAdditionalRate: additional === undefined || additional === null ? DE_AVERAGE_HEALTH_ADDITIONAL_RATE : additional / 100,
  });
  return {
    status: 'calculated',
    pay: {
      annualTakeHome: tax.takeHome,
      deductions: [
        { id: 'income-tax', label: 'Income tax', annual: tax.incomeTax },
        { id: 'solidarity-surcharge', label: 'Solidarity surcharge', annual: tax.solidaritySurcharge },
        { id: 'pension-insurance', label: 'Pension insurance', annual: tax.pensionInsurance },
        { id: 'unemployment-insurance', label: 'Unemployment insurance', annual: tax.unemploymentInsurance },
        { id: 'health-insurance', label: 'Health insurance', annual: tax.healthInsurance },
        { id: 'care-insurance', label: 'Long-term care insurance', annual: tax.careInsurance },
      ],
      unsupported: tax.supported
        ? null
        : `At or below €${DE_MIDIJOB_UPPER_MONTHLY.toLocaleString('en-GB')} a month, reduced Minijob and Midijob contributions apply, which are not modelled.`,
    },
  };
};

const nlPay = (income: number): MoneyHubPayResult => {
  const tax = calculateNlTax({ income });
  return {
    status: 'calculated',
    pay: {
      annualTakeHome: tax.takeHome,
      deductions: [
        { id: 'income-tax-and-national-insurance', label: 'Income tax & national insurance (after tax credits)', annual: tax.taxAfterCredits },
      ],
      unsupported: null,
    },
  };
};

/**
 * Annual pay for a valid (finite, non-negative) gross in the jurisdiction's
 * own currency. A `user-supplied` jurisdiction has no calculator and answers
 * `not-calculated`; callers then take a net figure from the user instead.
 */
export const calculateMoneyHubPay = (
  jurisdiction: MoneyHubJurisdictionId,
  annualGross: number,
  options: MoneyHubPayrollOptions = {},
): MoneyHubPayResult => {
  switch (jurisdiction) {
    case 'GB-ENG':
    case 'GB-WLS':
    case 'GB-NIR':
      return ukPay(annualGross, 'rUK', options.uk);
    case 'GB-SCT':
      return ukPay(annualGross, 'scotland', options.uk);
    case 'DE':
      return dePay(annualGross, options.de);
    case 'NL':
      return nlPay(annualGross);
    default:
      return { status: 'not-calculated' };
  }
};

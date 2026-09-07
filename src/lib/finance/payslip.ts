/**
 * What a captured payslip tells you.
 *
 * The figures come from the payslip itself rather than from a model of it,
 * which is the point: `calculateFinance` estimates deductions from salary and
 * tax bands, and `projectDebtBalance` estimates the student loan repayment a
 * second time from the same inputs. Neither reads what was actually taken.
 * These are the real numbers, so they win wherever they exist
 * (REHAUL_PLAN.md 7.N, 7.P).
 *
 * Pure, like the rest of this directory. No clock, no Supabase, no React.
 */

export interface Payslip {
  id: string;
  payDate: string;
  employer?: string;
  gross: number;
  incomeTax: number;
  nationalInsurance: number;
  /** The employee's contribution — the only one deducted from gross. */
  pensionEmployee: number;
  /** The employer's, which is neither paid by you nor subtracted from pay. */
  pensionEmployer: number;
  studentLoan: number;
  otherDeductions: number;
  net: number;
}

/**
 * Everything taken off gross.
 *
 * Deliberately excludes the employer's pension contribution. Including it is
 * the standard way to make net stop reconciling, because it never came out of
 * your pay in the first place.
 */
export const totalDeductions = (p: Payslip): number =>
  p.incomeTax + p.nationalInsurance + p.pensionEmployee + p.studentLoan + p.otherDeductions;

/**
 * Gross minus deductions, against the net the payslip states.
 *
 * A non-zero difference means something was miskeyed or a deduction is missing
 * a column — worth surfacing rather than absorbing, since every figure derived
 * from this row inherits the error.
 */
export interface PayslipCheck {
  expectedNet: number;
  statedNet: number;
  difference: number;
  /** True within a penny, so floating-point noise is not reported as a fault. */
  reconciles: boolean;
}

export const checkPayslip = (p: Payslip): PayslipCheck => {
  const expectedNet = p.gross - totalDeductions(p);
  const difference = round2(p.net - expectedNet);
  return {
    expectedNet: round2(expectedNet),
    statedNet: p.net,
    difference,
    reconciles: Math.abs(difference) < 0.01,
  };
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Deductions as a share of gross.
 *
 * Zero gross returns zero rather than NaN: a payslip with no pay is a data
 * entry problem, and a NaN would propagate into every chart it touched.
 */
export const deductionRate = (p: Payslip): number =>
  p.gross <= 0 ? 0 : (totalDeductions(p) / p.gross) * 100;

/** Income tax and NI only, which is what "tax rate" usually means. */
export const effectiveTaxRate = (p: Payslip): number =>
  p.gross <= 0 ? 0 : ((p.incomeTax + p.nationalInsurance) / p.gross) * 100;

export interface PayslipTotals {
  count: number;
  gross: number;
  incomeTax: number;
  nationalInsurance: number;
  pensionEmployee: number;
  pensionEmployer: number;
  studentLoan: number;
  otherDeductions: number;
  net: number;
}

const EMPTY: PayslipTotals = {
  count: 0, gross: 0, incomeTax: 0, nationalInsurance: 0,
  pensionEmployee: 0, pensionEmployer: 0, studentLoan: 0, otherDeductions: 0, net: 0,
};

export const sumPayslips = (slips: readonly Payslip[]): PayslipTotals =>
  slips.reduce<PayslipTotals>((acc, p) => ({
    count: acc.count + 1,
    gross: acc.gross + p.gross,
    incomeTax: acc.incomeTax + p.incomeTax,
    nationalInsurance: acc.nationalInsurance + p.nationalInsurance,
    pensionEmployee: acc.pensionEmployee + p.pensionEmployee,
    pensionEmployer: acc.pensionEmployer + p.pensionEmployer,
    studentLoan: acc.studentLoan + p.studentLoan,
    otherDeductions: acc.otherDeductions + p.otherDeductions,
    net: acc.net + p.net,
  }), EMPTY);

/**
 * The UK tax year containing `date`: 6 April to 5 April.
 *
 * Returned as the starting calendar year, so 2026 means 2026/27. Everything
 * HMRC does is bounded by this, and a payslip total for "this year" that used
 * January would be answering a different question.
 */
export const taxYearOf = (date: string): number => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  const beforeApril6 = month < 3 || (month === 3 && day < 6);
  return beforeApril6 ? year - 1 : year;
};

export const inTaxYear = (slips: readonly Payslip[], taxYear: number): Payslip[] =>
  slips.filter(p => taxYearOf(p.payDate) === taxYear);

/**
 * Student loan actually repaid in a tax year.
 *
 * This is the figure 7.N needs. Note what it is *not*: the amount the SLC
 * knows about. HMRC passes deductions on annually, after the year closes, so
 * the official balance lags this by up to about eighteen months. That gap is
 * the reason to hold these figures locally at all.
 */
export const studentLoanPaidInTaxYear = (slips: readonly Payslip[], taxYear: number): number =>
  inTaxYear(slips, taxYear).reduce((sum, p) => sum + p.studentLoan, 0);

/**
 * A captured figure against the modelled one.
 *
 * Positive `difference` means the payslip took more than the model expected.
 * `null` modelled means nothing to compare against, which is different from a
 * comparison that came out at zero.
 */
export interface ModelComparison {
  actual: number;
  modelled: number | null;
  difference: number | null;
  /** Share of the modelled figure, for judging whether a gap is worth chasing. */
  percentOff: number | null;
}

export const compareToModel = (actual: number, modelled: number | null): ModelComparison => {
  if (modelled === null) return { actual, modelled: null, difference: null, percentOff: null };
  const difference = round2(actual - modelled);
  return {
    actual,
    modelled,
    difference,
    percentOff: modelled === 0 ? null : round2((difference / modelled) * 100),
  };
};

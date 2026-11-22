/**
 * Public facade for the UK student loan simulator, assumptions, ledger, and
 * payslip deduction helpers.
 *
 * Pure; see REHAUL_PLAN.md 7.I.
 */

export {
  STUDENT_LOAN_DEFAULT_ASSUMPTIONS,
  assumptionsFor,
  exactTaxYearOf,
  incomeByTaxYear,
  normaliseRatePercent,
  rateRowInForce,
  studentLoanInterestRate,
  studentLoanMonthlyRepayment,
  type StudentLoanAssumptions,
  type StudentLoanMonth,
  type StudentLoanPhase,
  type StudentLoanRateRow,
  type StudentLoanSimResult,
  type TaxYearIncome,
} from './student-loan-assumptions';

export * from './student-loan-simulation';
export * from './student-loan-ledger';

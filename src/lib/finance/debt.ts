/**
 * Debt labels and balance projection. Pure; see REHAUL_PLAN.md 7.I and 7.N.
 *
 * `projectDebtBalance` used to read `new Date()` internally, which made it
 * untestable and its output dependent on when it ran. The current year is now
 * an argument with a sensible default.
 */

export type StudentLoanPlanKey = 'plan1' | 'plan2' | 'plan4' | 'plan5' | 'postgrad';

export type DebtType = 'mortgage' | 'student' | 'auto' | 'personal' | 'credit' | 'other';

export const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  mortgage: 'Mortgage',
  student: 'Student Loan',
  auto: 'Auto Loan',
  personal: 'Personal Loan',
  credit: 'Credit Card Debt',
  other: 'Other',
};

export const STUDENT_LOAN_PLAN_LABELS: Record<StudentLoanPlanKey, string> = {
  plan1: 'Plan 1',
  plan2: 'Plan 2',
  plan4: 'Plan 4 (Scotland)',
  plan5: 'Plan 5',
  postgrad: 'Postgraduate Loan',
};

/** Years until an unpaid balance is written off, by plan. */
export const STUDENT_LOAN_WRITE_OFF_YEARS: Record<StudentLoanPlanKey, number> = {
  plan1: 25,
  plan2: 30,
  plan4: 30,
  plan5: 40,
  postgrad: 30,
};

/**
 * A rate that takes effect on a date and holds until the next one.
 *
 * A single `interestRate` cannot describe a two-year fix reverting to a
 * standard variable rate, a tracker following base rate, or Plan 2's
 * income-linked scale (REHAUL_PLAN.md 7.N). A list of these can.
 */
export interface RatePeriod {
  /** ISO date the rate takes effect. */
  effectiveFrom: string;
  /** Annual, as a percentage — 5.5 means 5.5%. */
  rate: number;
}

/**
 * A real observed balance for a debt on a known date (REHAUL_PLAN.md 7.N).
 *
 * Each row is an anchor. Projection runs forward from the latest anchor
 * rather than from a floating, mutable `balance`.
 */
export interface DebtObservation {
  id: string;
  debtId: string;
  observedOn: string;
  balance: number;
  source: 'manual' | 'statement' | 'provider';
  /**
   * Statement date: crucial for SLC (Student Loans Company) where annual statements
   * reflect a balance as-of March/April, lagging portal checks by up to 18 months.
   * If not provided, defaults to `observedOn`.
   */
  statementDate?: string;
  note?: string;
  createdAt?: string;
}

export interface ProjectableDebt {
  balance: number;
  /** Annual, as a percentage — 5.5 means 5.5%. Used when no period applies. */
  interestRate: number;
  minPayment: number;
  repaymentType?: string;
  studentLoanPlan?: StudentLoanPlanKey;
  writeOffYears?: number;
  startDate?: string;
  /** Optional schedule; `interestRate` stands in wherever it does not reach. */
  ratePeriods?: RatePeriod[];
  /**
   * PCP only: the balloon, or guaranteed future value, left standing at the
   * end of the agreement. The monthly payments amortise down to this rather
   * than to zero, so the projection settles here instead of clearing.
   */
  finalPayment?: number;
  /**
   * Historical observations anchoring the balance. If present, projection
   * begins from the latest observation's date and balance.
   */
  observations?: DebtObservation[];
}

export interface DebtProjectionOptions {
  grossSalary: number;
  /** Percentage of income above the threshold, e.g. 9 for 9%. */
  repaymentRate: number;
  threshold: number;
  /** Defaults to the current year. Passed explicitly so results are stable. */
  currentYear?: number;
  /**
   * The date the projection starts from. Only consulted when the debt has
   * rate periods, since that is the only thing needing a real calendar rather
   * than a count of months. Defaults to the start of `currentYear`.
   */
  today?: Date;
}

export interface DebtProjectionPoint {
  year: number;
  balance: number;
  paid: number;
  interest: number;
  writtenOff: number;
}

/**
 * The rate in force on `on`.
 *
 * Periods need not be sorted. A period starting in the future does not apply
 * yet, so if none has begun the debt's own `interestRate` stands in — which is
 * also what happens when there are no periods at all.
 */
export const rateInForce = (
  periods: RatePeriod[] | undefined,
  fallback: number,
  on: Date,
): number => {
  if (!periods || periods.length === 0) return fallback;
  let best: RatePeriod | undefined;
  for (const period of periods) {
    const from = new Date(period.effectiveFrom);
    if (Number.isNaN(from.getTime()) || from > on) continue;
    if (!best || from > new Date(best.effectiveFrom)) best = period;
  }
  return best ? best.rate : fallback;
};

/** Stop projecting after this many months even if a balance remains. */
const MAX_MONTHS = 12 * 45;

/** A balance that never falls is only worth plotting for so long. */
const RUNAWAY_CUTOFF_MONTHS = 120;

/**
 * Projects a debt's balance forward month by month.
 *
 * - amortising: interest accrues monthly, then the fixed payment is applied.
 * - income_contingent: interest accrues monthly, repayments are a percentage
 *   of gross income above the plan threshold, and any remaining balance is
 *   written off once the plan's term elapses.
 * - pcp: amortises down to the balloon payment (`finalPayment`), rather than zero.
 *
 * When observations exist, projection begins from the latest anchor balance.
 * Returns one point per year so the chart stays readable over 40-year terms.
 */
export const projectDebtBalance = (
  debt: ProjectableDebt,
  opts: DebtProjectionOptions,
): DebtProjectionPoint[] => {
  // If the debt carries recorded observations, anchor the projection on the latest observation
  const latestObs = debt.observations && debt.observations.length > 0
    ? [...debt.observations].sort((a, b) =>
        (a.statementDate || a.observedOn).localeCompare(b.statementDate || b.observedOn)
      ).pop()
    : undefined;

  const currentYear = opts.currentYear ?? (
    latestObs
      ? new Date(latestObs.statementDate || latestObs.observedOn).getFullYear()
      : new Date().getFullYear()
  );

  // Resolved per month when the debt carries a schedule, once otherwise. The
  // calendar is only built in the scheduled case, so the common path is
  // unchanged.
  const hasSchedule = !!debt.ratePeriods && debt.ratePeriods.length > 0;
  const projectionStart = opts.today ?? new Date(currentYear, 0, 1);
  const monthlyRateAt = (month: number): number => {
    if (!hasSchedule) return debt.interestRate / 100 / 12;
    const on = new Date(projectionStart);
    on.setMonth(on.getMonth() + month);
    return rateInForce(debt.ratePeriods, debt.interestRate, on) / 100 / 12;
  };

  const startYear = debt.startDate ? new Date(debt.startDate).getFullYear() : currentYear;

  const isIncomeContingent = debt.repaymentType === 'income_contingent';
  const writeOffYears =
    debt.writeOffYears ??
    (debt.studentLoanPlan ? STUDENT_LOAN_WRITE_OFF_YEARS[debt.studentLoanPlan] : undefined);
  const writeOffMonth =
    writeOffYears !== undefined
      ? Math.max(Math.round((startYear + writeOffYears - currentYear) * 12), 0)
      : undefined;

  // PCP amortises to the balloon, not to zero: the monthly payments cover
  // depreciation and interest, and the guaranteed future value is still
  // standing at the end. Every other type floors at zero.
  const floor =
    debt.repaymentType === 'pcp' ? Math.max(debt.finalPayment ?? 0, 0) : 0;

  const annualRepayment = isIncomeContingent
    ? Math.max(opts.grossSalary - opts.threshold, 0) * (opts.repaymentRate / 100)
    : 0;
  const monthlyPayment = isIncomeContingent ? annualRepayment / 12 : debt.minPayment;

  const points: DebtProjectionPoint[] = [];
  let balance = latestObs ? latestObs.balance : debt.balance;
  let paid = 0;
  let interest = 0;
  let writtenOff = 0;

  points.push({ year: currentYear, balance, paid, interest, writtenOff });

  for (let month = 1; month <= MAX_MONTHS && balance > floor; month++) {
    if (writeOffMonth !== undefined && month > writeOffMonth) {
      writtenOff = balance;
      balance = 0;
      points.push({ year: currentYear + writeOffMonth / 12, balance, paid, interest, writtenOff });
      break;
    }

    const monthInterest = balance * monthlyRateAt(month - 1);
    balance += monthInterest;
    interest += monthInterest;

    // Never pay past the floor: on a PCP the balloon is not cleared by the
    // monthly payments, so `paid` must not pretend it was.
    const payment = Math.min(monthlyPayment, balance - floor);
    balance -= payment;
    paid += payment;

    // A payment that never covers the interest means the balance grows forever;
    // stop projecting rather than looping to the cap with a runaway line.
    if (
      monthlyPayment <= monthInterest &&
      writeOffMonth === undefined &&
      month >= RUNAWAY_CUTOFF_MONTHS
    ) {
      points.push({ year: currentYear + month / 12, balance, paid, interest, writtenOff });
      break;
    }

    if (month % 12 === 0 || balance <= floor) {
      points.push({
        year: currentYear + month / 12,
        balance: Math.max(balance, floor),
        paid,
        interest,
        writtenOff,
      });
    }
  }

  return points;
};

export interface DebtDriftParams {
  anchorBalance: number;
  anchorDate: string; // YYYY-MM-DD
  targetBalance: number;
  targetDate: string; // YYYY-MM-DD
  monthlyPayment: number;
  interestRate: number; // Annual % (e.g. 5.5 for 5.5%)
  ratePeriods?: RatePeriod[];
}

export interface DebtDriftResult {
  observedBalance: number;
  predictedBalance: number;
  drift: number;
  monthsElapsed: number;
  impliedAnnualRate: number | null;
}

/**
 * Calculates drift between a model's predicted balance and an actual observed figure.
 *
 * Given two consecutive anchors (or start date to observation), steps month by month
 * applying interest and payments to determine the expected balance on `targetDate`.
 *
 * Also calculates `impliedAnnualRate` — the effective rate that explains the observed
 * balance given the payments made.
 */
export const calculateDebtDrift = (params: DebtDriftParams): DebtDriftResult => {
  const {
    anchorBalance,
    anchorDate,
    targetBalance,
    targetDate,
    monthlyPayment,
    interestRate,
    ratePeriods,
  } = params;

  const d1 = new Date(anchorDate);
  const d2 = new Date(targetDate);

  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime()) || d2 <= d1) {
    return {
      observedBalance: targetBalance,
      predictedBalance: anchorBalance,
      drift: targetBalance - anchorBalance,
      monthsElapsed: 0,
      impliedAnnualRate: interestRate,
    };
  }

  const yearDiff = d2.getFullYear() - d1.getFullYear();
  const monthDiff = d2.getMonth() - d1.getMonth();
  const dayDiff = d2.getDate() - d1.getDate();
  const exactMonths = Math.max(yearDiff * 12 + monthDiff + dayDiff / 30.4375, 0);
  const wholeMonths = Math.max(Math.round(exactMonths), 1);

  // Step month by month to predict expected balance
  let predicted = anchorBalance;
  for (let m = 1; m <= wholeMonths; m++) {
    const stepDate = new Date(d1);
    stepDate.setMonth(stepDate.getMonth() + m);
    const rate = rateInForce(ratePeriods, interestRate, stepDate) / 100 / 12;
    const interest = predicted * rate;
    predicted += interest;
    const payment = Math.min(monthlyPayment, predicted);
    predicted -= payment;
    if (predicted <= 0) {
      predicted = 0;
      break;
    }
  }

  const drift = Math.round((targetBalance - predicted) * 100) / 100;

  // Compute implied rate via binary search / bisection
  let impliedRate: number | null = null;
  if (wholeMonths > 0 && anchorBalance > 0) {
    const simulateRate = (ratePct: number): number => {
      let b = anchorBalance;
      const mRate = ratePct / 100 / 12;
      for (let m = 1; m <= wholeMonths; m++) {
        b += b * mRate;
        b -= Math.min(monthlyPayment, b);
        if (b <= 0) return 0;
      }
      return b;
    };

    let low = -50;
    let high = 150;
    for (let iter = 0; iter < 35; iter++) {
      const mid = (low + high) / 2;
      const res = simulateRate(mid);
      if (res < targetBalance) {
        low = mid;
      } else {
        high = mid;
      }
    }
    impliedRate = Math.round(((low + high) / 2) * 100) / 100;
  }

  return {
    observedBalance: targetBalance,
    predictedBalance: Math.round(predicted * 100) / 100,
    drift,
    monthsElapsed: wholeMonths,
    impliedAnnualRate: impliedRate,
  };
};

export interface StudentLoanPayslipItem {
  payDate: string; // YYYY-MM-DD
  studentLoan: number;
}

export interface StudentLoanReconcileResult {
  statementBalance: number;
  statementDate: string;
  payslipDeductionsTotal: number;
  payslipsCount: number;
  adjustedBalance: number;
}

/**
 * Bridges the Student Loans Company (SLC) 12-18 month reporting lag (REHAUL_PLAN.md 7.N).
 *
 * HMRC collects student loan deductions monthly via PAYE, but transfers them to SLC
 * only once a year after the tax year ends. As a result, the balance on gov.uk is
 * stale by design.
 *
 * This function takes an SLC observation and applies captured payslip deductions
 * dated AFTER the observation's statementDate, giving a live, accurate figure.
 */
export const reconcileStudentLoanWithPayslips = (
  observation: DebtObservation,
  payslips: StudentLoanPayslipItem[],
  asOfDate?: string,
): StudentLoanReconcileResult => {
  const statementDate = observation.statementDate || observation.observedOn;
  const cutoff = asOfDate || new Date().toISOString().split('T')[0];

  const relevantPayslips = payslips.filter(p => {
    return p.payDate > statementDate && p.payDate <= cutoff && p.studentLoan > 0;
  });

  const totalDeductions = relevantPayslips.reduce((sum, p) => sum + p.studentLoan, 0);
  const adjustedBalance = Math.max(
    Math.round((observation.balance - totalDeductions) * 100) / 100,
    0,
  );

  return {
    statementBalance: observation.balance,
    statementDate,
    payslipDeductionsTotal: Math.round(totalDeductions * 100) / 100,
    payslipsCount: relevantPayslips.length,
    adjustedBalance,
  };
};

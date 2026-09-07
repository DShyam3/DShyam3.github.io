/**
 * Debt labels and balance projection. Pure; see REHAUL_PLAN.md 7.I.
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

/** Only the fields the projection reads, so this module owns no domain type. */
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
 *
 * Returns one point per year so the chart stays readable over 40-year terms.
 */
export const projectDebtBalance = (
  debt: ProjectableDebt,
  opts: DebtProjectionOptions,
): DebtProjectionPoint[] => {
  const currentYear = opts.currentYear ?? new Date().getFullYear();

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
  let balance = debt.balance;
  let paid = 0;
  let interest = 0;
  let writtenOff = 0;

  points.push({ year: currentYear, balance, paid, interest, writtenOff });

  for (let month = 1; month <= MAX_MONTHS && balance > floor; month++) {
    if (writeOffMonth !== undefined && month > writeOffMonth) {
      writtenOff = balance;
      balance = 0;
      // The write-off lands on the plan's actual anniversary. This used to be
      // `Math.ceil(month / 12)`, which rounded a 30-year Plan 2 loan started in
      // 2000 to 2031 rather than 2030, and put a visible kink at the end of the
      // chart because every other point uses the fractional convention below.
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

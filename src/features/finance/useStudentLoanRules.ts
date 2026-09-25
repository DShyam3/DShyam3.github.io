/**
 * The student loan rules in force for a plan, read from rows.
 *
 * Two sets of rows decide a student loan: the tax configuration (repayment
 * threshold and rate, versioned by tax year) and the published interest
 * parameters (RPI, cap, Plan 2's full-rate income, Bank Rate, versioned by the
 * date SLC applies them). This gathers both so the section and the form ask
 * the same question the same way. The arithmetic stays in `lib/finance`.
 */

import { useCallback } from 'react';
import {
  STUDENT_LOAN_DEFAULT_ASSUMPTIONS,
  assumptionsFor,
  firstRepaymentDue,
  normaliseRatePercent,
  rateRowInForce,
  studentLoanInterestRate,
  toISODate,
  type StudentLoanPhase,
  type StudentLoanPlanKey,
} from '@/lib/finance';
import { useFinanceData } from './FinanceDataContext';

export function useStudentLoanRules() {
  const { taxConfig, studentLoanRates } = useFinanceData();
  const today = toISODate(new Date());
  const rowNow = rateRowInForce(studentLoanRates, today);

  const planRules = useCallback((plan: StudentLoanPlanKey) => ({
    threshold: taxConfig.studentLoanThresholds[plan] ?? 0,
    repaymentRate: normaliseRatePercent(taxConfig.studentLoanRates[plan], plan === 'postgrad' ? 6 : 9),
    thresholdFrom: taxConfig.effectiveFrom || today,
  }), [taxConfig, today]);

  /**
   * The annual rate for today: which phase the loan is in follows from when
   * the course ended, and on Plan 2 the rate then follows the tax year's
   * income. `provisional` is what SLC charges until HMRC confirms that income
   * -- the rate at or below the threshold, i.e. RPI, capped.
   */
  const rateNow = useCallback((plan: StudentLoanPlanKey, courseEnd: string | undefined, income: number) => {
    const phase: StudentLoanPhase = !courseEnd || today <= courseEnd
      ? 'study'
      : today < firstRepaymentDue(courseEnd) ? 'pre_repayment' : 'repayment';
    const a = assumptionsFor(STUDENT_LOAN_DEFAULT_ASSUMPTIONS, rowNow);
    const threshold = plan === 'plan2' && rowNow?.plan2LowerThreshold != null
      ? rowNow.plan2LowerThreshold
      : planRules(plan).threshold;
    const rate = studentLoanInterestRate(plan, phase, income, threshold, a.upperInterestThreshold, a);
    const provisional = plan === 'plan2' && phase === 'repayment'
      ? studentLoanInterestRate(plan, phase, 0, threshold, a.upperInterestThreshold, a)
      : rate;
    return { rate, provisional, phase, assumptions: a };
  }, [today, rowNow, planRules]);

  return { today, rowNow, rows: studentLoanRates, planRules, rateNow };
}

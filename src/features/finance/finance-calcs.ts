/**
 * The two big derivations the finance views share: the pay breakdown, and when
 * the next payday actually lands.
 *
 * Both were closures inside FinancePage over `settings`, `taxConfig` and the
 * bank-holiday list, which is why Home and Income could not be pulled apart
 * (REHAUL_PLAN.md 7.2c-i). Taking their inputs as arguments makes them
 * ordinary functions any surface can call.
 *
 * They live beside the feature rather than in `lib/finance` because they read
 * the feature's own settings and tax-config shapes -- the same reason
 * finance-defaults.ts is here.
 */

import { epochDay, nextPayday, normalizeHolidays, toISODate } from '@/lib/finance';
import type { FinanceSettings, TaxConfig, UserHoliday } from '@/features/finance/finance-types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Picks the rate set that was in force on a given UK calendar date.
 *
 * Falling back to a future configuration would silently rewrite history, so a
 * caller must add the missing historical rates instead.
 */
export const selectTaxConfigForDate = (
  taxConfigs: readonly TaxConfig[],
  asOfDate: string,
): TaxConfig => {
  if (!ISO_DATE.test(asOfDate)) {
    throw new TypeError('Tax configuration selection requires a YYYY-MM-DD date.');
  }

  const config = taxConfigs
    .filter(candidate => ISO_DATE.test(candidate.effectiveFrom) && candidate.effectiveFrom <= asOfDate)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];

  if (!config) {
    throw new RangeError(`No tax configuration is available for ${asOfDate}.`);
  }

  return config;
};

export const calculateFinance = (
  settings: FinanceSettings,
  taxConfigs: readonly TaxConfig[],
  asOfDate: string,
) => {
  const taxConfig = selectTaxConfigForDate(taxConfigs, asOfDate);
  const {
    grossSalary,
    pensionType,
    personalPensionPercent,
    employerPensionPercent,
    studentLoanPlan,
    personalAllowance: rawPersonalAllowance,
    weekends,
    bankHolidays,
    workHolidays,
    workingHoursPerDay,
  } = settings;

  const personalPensionRate = grossSalary * (personalPensionPercent / 100);
  const employerPensionRate = grossSalary * (employerPensionPercent / 100);

  const packageBenefits = settings.packageBenefits || [];
  const totalBenefitsValue = packageBenefits.reduce((sum, b) => {
    const val = b.type === 'percentage' ? (grossSalary * ((b.amount || 0) / 100)) : (b.amount || 0);
    return sum + (val || 0);
  }, 0);

  const benefitTaxDeduction = packageBenefits.reduce((sum, b) => {
    const taxCost = Number(b.annualTaxCost) || 0;
    return sum + Math.max(0, taxCost);
  }, 0);

  const totalPackage = grossSalary + employerPensionRate + totalBenefitsValue;

  const incomeTaxGross = pensionType === 'net_pay' || pensionType === 'salary_sacrifice'
    ? Math.max(0, grossSalary - personalPensionRate)
    : grossSalary;

  const niGross = pensionType === 'salary_sacrifice'
    ? Math.max(0, grossSalary - personalPensionRate)
    : grossSalary;

  const studentLoanGross = pensionType === 'salary_sacrifice'
    ? Math.max(0, grossSalary - personalPensionRate)
    : grossSalary;

  let personalAllowance = rawPersonalAllowance;
  if (incomeTaxGross > 100000) {
    const excess = incomeTaxGross - 100000;
    personalAllowance = Math.max(0, personalAllowance - excess / 2);
  }

  let incomeTax = 0;
  if (incomeTaxGross > personalAllowance) {
    const taxableAmount = incomeTaxGross - personalAllowance;
    const { basicRateLimit, higherRateLimit, basicRatePercent, higherRatePercent, additionalRatePercent } = taxConfig.incomeTaxBands;

    if (incomeTaxGross <= higherRateLimit) {
      const basicRateAmount = Math.min(taxableAmount, basicRateLimit);
      const higherRateAmount = Math.max(0, taxableAmount - basicRateAmount);
      incomeTax = basicRateAmount * (basicRatePercent / 100) + higherRateAmount * (higherRatePercent / 100);
    } else {
      const basicRateAmount = basicRateLimit;
      const higherRateAmount = higherRateLimit - basicRateLimit;
      const additionalRateAmount = Math.max(0, incomeTaxGross - higherRateLimit);
      incomeTax = basicRateAmount * (basicRatePercent / 100) + higherRateAmount * (higherRatePercent / 100) + additionalRateAmount * (additionalRatePercent / 100);
    }
  }

  let nationalInsurance = 0;
  const { lowerThreshold, upperThreshold, mainRatePercent, upperRatePercent } = taxConfig.nationalInsuranceBands;
  if (niGross > lowerThreshold) {
    const mainBandAmount = Math.min(niGross, upperThreshold) - lowerThreshold;
    const upperBandAmount = Math.max(0, niGross - upperThreshold);
    nationalInsurance = mainBandAmount * (mainRatePercent / 100) + upperBandAmount * (upperRatePercent / 100);
  }

  let studentLoan = 0;
  if (studentLoanPlan !== 'none') {
    const threshold = taxConfig.studentLoanThresholds[studentLoanPlan];
    const rate = taxConfig.studentLoanRates[studentLoanPlan];
    if (studentLoanGross > threshold) {
      studentLoan = (studentLoanGross - threshold) * rate;
    }
  }

  const totalDeductions = incomeTax + nationalInsurance + studentLoan + personalPensionRate + benefitTaxDeduction;
  const netTakeHome = grossSalary - totalDeductions;
  const WEEKS_IN_YEAR_ACTUAL = 365 / 7; // 52.142857... (~52.1429) weeks
  const workingDaysStandard = WEEKS_IN_YEAR_ACTUAL * 5; // ~260.714 days
  const workingDaysIncludingLeave = Math.max(0, 365 - weekends - 1);
  const birthdayLeaveDays = settings.birthdayLeaveEnabled ? 1 : 0;
  const workingDaysExcludingLeave = Math.max(0, 365 - weekends - 1 - bankHolidays - workHolidays - birthdayLeaveDays);

  const getBreakdown = (annualAmount: number, daysInYear: number, weeksInYear = 52) => {
    const monthly = annualAmount / 12;
    const weekly = annualAmount / weeksInYear;
    const daily = annualAmount / (daysInYear || 1);
    const hourly = daily / workingHoursPerDay;
    return { annual: annualAmount, monthly, weekly, daily, hourly };
  };

  const buildBreakdown = (daysInYear: number, weeksInYear = 52) => ({
    totalPackage: getBreakdown(totalPackage, daysInYear, weeksInYear),
    preTax: getBreakdown(grossSalary, daysInYear, weeksInYear),
    employerPension: getBreakdown(employerPensionRate, daysInYear, weeksInYear),
    benefits: getBreakdown(totalBenefitsValue, daysInYear, weeksInYear),
    benefitTax: getBreakdown(benefitTaxDeduction, daysInYear, weeksInYear),
    tax: getBreakdown(incomeTax, daysInYear, weeksInYear),
    ni: getBreakdown(nationalInsurance, daysInYear, weeksInYear),
    pension: getBreakdown(personalPensionRate, daysInYear, weeksInYear),
    studentLoan: getBreakdown(studentLoan, daysInYear, weeksInYear),
    postTax: getBreakdown(netTakeHome, daysInYear, weeksInYear),
    deductions: getBreakdown(totalDeductions, daysInYear, weeksInYear),
  });

  return {
    personalPensionRate,
    employerPensionRate,
    totalBenefitsValue,
    benefitTaxDeduction,
    totalPackage,
    personalAllowance,
    incomeTax,
    nationalInsurance,
    studentLoan,
    totalDeductions,
    netTakeHome,
    workingDaysStandard,
    workingDaysExcludingLeave,
    workingDaysIncludingLeave,
    breakdown: {
      standard: buildBreakdown(workingDaysStandard, WEEKS_IN_YEAR_ACTUAL),
      excludingLeave: buildBreakdown(workingDaysExcludingLeave, 52),
      includingLeave: buildBreakdown(workingDaysIncludingLeave, 52),
    }
  };
};

/**
 * When the next payday actually lands, from today's local date. The dates
 * come from `nextPayday` in lib/finance/payday.ts, so this and the balance
 * forecast read one set of rules.
 *
 * Differences from the version that kept its own branch per schedule: a payday
 * that has already passed is never returned (a "the 1st" payday for a month
 * starting on a Sunday used to be reported the day after it); a biweekly cycle
 * runs backwards from its anchor, where the old code returned the anchor itself
 * for a date before it; and `adjustReason` names what the scheduled date was
 * ('weekend' if it fell on a Saturday or Sunday), not the last day stepped over.
 * If the settings cannot place a payday, today is returned unadjusted.
 */
export const getNextPaydayDetails = (
  settings: FinanceSettings,
  bankHolidaysList: string[],
) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const next = nextPayday(
    settings.paydaySchedule || 'monthly_date',
    {
      payDayOfMonth: settings.payDayOfMonth,
      weekday: settings.paydayWeekday,
      biweeklyAnchor: settings.paydayBiweeklyAnchor,
    },
    toISODate(today),
    bankHolidaysList,
  );

  // Local midnight of the payday. With nothing placeable, today stands in rather than breaking callers.
  const paydayDate = next
    ? new Date(Number(next.date.slice(0, 4)), Number(next.date.slice(5, 7)) - 1, Number(next.date.slice(8, 10)))
    : new Date(today);
  // Whole calendar days between the two dates. Elapsed milliseconds are not: a day is 23 or 25 hours long
  // when the clocks change, and rounding that up counted an extra day across the autumn change.
  const todayDay = epochDay(toISODate(today));
  const paydayDay = next ? epochDay(next.date) : todayDay;
  const daysRemaining = todayDay !== undefined && paydayDay !== undefined ? Math.max(0, paydayDay - todayDay) : 0;

  return {
    date: paydayDate,
    adjusted: next?.adjusted ?? false,
    adjustReason: next?.adjustReason ?? null,
    daysRemaining
  };
};

/** Adapts component state to `normalizeHolidays`, which takes the stored value
 *  and the tax year rather than the whole settings object. */
export const getNormalizedHolidays = (
  settings: FinanceSettings,
  holidayDefaults: Parameters<typeof normalizeHolidays>[0],
): UserHoliday[] =>
  normalizeHolidays(
    settings.holidaysByUser || holidayDefaults,
    settings.taxYear || new Date().getFullYear(),
  );

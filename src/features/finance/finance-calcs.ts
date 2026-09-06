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

import { calculateActualPayday, getDaysInMonth, normalizeHolidays, toISODate } from '@/lib/finance';
import type { FinanceSettings, TaxConfig, UserHoliday } from '@/features/finance/finance-types';

export const calculateFinance = (settings: FinanceSettings, taxConfig: TaxConfig) => {
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

  const totalDeductions = incomeTax + nationalInsurance + studentLoan + personalPensionRate;
  const netTakeHome = grossSalary - totalDeductions;
  const workingDaysIncludingLeave = Math.max(0, 365 - weekends - 1);
  const workingDaysExcludingLeave = Math.max(0, 365 - weekends - 1 - bankHolidays - workHolidays);

  const getBreakdown = (annualAmount: number, daysInYear: number) => {
    const monthly = annualAmount / 12;
    const weekly = annualAmount / 52;
    const daily = annualAmount / (daysInYear || 1);
    const hourly = daily / workingHoursPerDay;
    return { annual: annualAmount, monthly, weekly, daily, hourly };
  };

  const buildBreakdown = (daysInYear: number) => ({
    totalPackage: getBreakdown(totalPackage, daysInYear),
    preTax: getBreakdown(grossSalary, daysInYear),
    employerPension: getBreakdown(employerPensionRate, daysInYear),
    benefits: getBreakdown(totalBenefitsValue, daysInYear),
    tax: getBreakdown(incomeTax, daysInYear),
    ni: getBreakdown(nationalInsurance, daysInYear),
    pension: getBreakdown(personalPensionRate, daysInYear),
    studentLoan: getBreakdown(studentLoan, daysInYear),
    postTax: getBreakdown(netTakeHome, daysInYear),
    deductions: getBreakdown(totalDeductions, daysInYear),
  });

  return {
    personalPensionRate,
    employerPensionRate,
    totalBenefitsValue,
    totalPackage,
    personalAllowance,
    incomeTax,
    nationalInsurance,
    studentLoan,
    totalDeductions,
    netTakeHome,
    workingDaysExcludingLeave,
    workingDaysIncludingLeave,
    breakdown: {
      excludingLeave: buildBreakdown(workingDaysExcludingLeave),
      includingLeave: buildBreakdown(workingDaysIncludingLeave),
    }
  };
};

export const getNextPaydayDetails = (
  settings: FinanceSettings,
  bankHolidaysList: string[],
) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const schedule = settings.paydaySchedule || 'monthly_date';
  const scheduledPayday = settings.payDayOfMonth || 25;
  const weekday = settings.paydayWeekday !== undefined ? settings.paydayWeekday : 5; // default Friday
  const anchorStr = settings.paydayBiweeklyAnchor || '2026-01-02';

  let paydayDate = new Date();
  let adjusted = false;
  let adjustReason: 'weekend' | 'bank_holiday' | null = null;

  const adjustIfWeekendOrHoliday = (date: Date): { date: Date; adjusted: boolean; adjustReason: 'weekend' | 'bank_holiday' | null } => {
    let isAdj = false;
    let reason: 'weekend' | 'bank_holiday' | null = null;
    const d = new Date(date);
    while (true) {
      const dayOfWeek = d.getDay();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        isAdj = true;
        reason = 'weekend';
        d.setDate(d.getDate() - 1);
      } else if (bankHolidaysList.includes(dateStr)) {
        isAdj = true;
        reason = 'bank_holiday';
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return { date: d, adjusted: isAdj, adjustReason: reason };
  };

  if (schedule === 'monthly_date') {
    let targetYear = today.getFullYear();
    let targetMonthIdx = today.getMonth();

    let res = calculateActualPayday(targetYear, targetMonthIdx, scheduledPayday, bankHolidaysList);
    const resDate = new Date(res.date);
    resDate.setHours(0, 0, 0, 0);

    if (resDate.getTime() < today.getTime()) {
      targetMonthIdx += 1;
      if (targetMonthIdx > 11) {
        targetMonthIdx = 0;
        targetYear += 1;
      }
      res = calculateActualPayday(targetYear, targetMonthIdx, scheduledPayday, bankHolidaysList);
    }
    paydayDate = res.date;
    adjusted = res.adjusted;
    adjustReason = res.adjustReason;

  } else if (schedule === 'last_working_day') {
    let targetYear = today.getFullYear();
    let targetMonthIdx = today.getMonth();

    const targetDateOfLastDay = new Date(targetYear, targetMonthIdx + 1, 0);
    let res = adjustIfWeekendOrHoliday(targetDateOfLastDay);
    res.date.setHours(0, 0, 0, 0);

    if (res.date.getTime() < today.getTime()) {
      targetMonthIdx += 1;
      if (targetMonthIdx > 11) {
        targetMonthIdx = 0;
        targetYear += 1;
      }
      const nextMonthLastDay = new Date(targetYear, targetMonthIdx + 1, 0);
      res = adjustIfWeekendOrHoliday(nextMonthLastDay);
    }
    paydayDate = res.date;
    adjusted = res.adjusted;
    adjustReason = res.adjustReason;

  } else if (schedule === 'last_friday') {
    let targetYear = today.getFullYear();
    let targetMonthIdx = today.getMonth();

    const getLastFridayOfMonth = (year: number, monthIdx: number): Date => {
      const d = new Date(year, monthIdx + 1, 0);
      while (d.getDay() !== 5) {
        d.setDate(d.getDate() - 1);
      }
      return d;
    };

    const lastFri = getLastFridayOfMonth(targetYear, targetMonthIdx);
    let res = adjustIfWeekendOrHoliday(lastFri);
    res.date.setHours(0, 0, 0, 0);

    if (res.date.getTime() < today.getTime()) {
      targetMonthIdx += 1;
      if (targetMonthIdx > 11) {
        targetMonthIdx = 0;
        targetYear += 1;
      }
      const nextMonthLastFri = getLastFridayOfMonth(targetYear, targetMonthIdx);
      res = adjustIfWeekendOrHoliday(nextMonthLastFri);
    }
    paydayDate = res.date;
    adjusted = res.adjusted;
    adjustReason = res.adjustReason;

  } else if (schedule === 'biweekly') {
    const anchor = new Date(anchorStr);
    anchor.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - anchor.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let candidate = new Date(anchor);
    if (diffDays >= 0) {
      const biweeks = Math.floor(diffDays / 14);
      candidate.setDate(candidate.getDate() + (biweeks * 14));

      let res = adjustIfWeekendOrHoliday(candidate);
      res.date.setHours(0, 0, 0, 0);

      if (res.date.getTime() < today.getTime()) {
        candidate = new Date(candidate);
        candidate.setDate(candidate.getDate() + 14);
        res = adjustIfWeekendOrHoliday(candidate);
      }
      paydayDate = res.date;
      adjusted = res.adjusted;
      adjustReason = res.adjustReason;
    } else {
      const res = adjustIfWeekendOrHoliday(anchor);
      paydayDate = res.date;
      adjusted = res.adjusted;
      adjustReason = res.adjustReason;
    }

  } else if (schedule === 'weekly') {
    const daysToAdd = (weekday - today.getDay() + 7) % 7;
    let candidate = new Date(today);
    candidate.setDate(candidate.getDate() + daysToAdd);

    let res = adjustIfWeekendOrHoliday(candidate);
    res.date.setHours(0, 0, 0, 0);

    if (res.date.getTime() < today.getTime()) {
      candidate = new Date(candidate);
      candidate.setDate(candidate.getDate() + 7);
      res = adjustIfWeekendOrHoliday(candidate);
    }
    paydayDate = res.date;
    adjusted = res.adjusted;
    adjustReason = res.adjustReason;

  } else if (schedule === 'semimonthly') {
    let targetYear = today.getFullYear();
    let targetMonthIdx = today.getMonth();

    const getSemimonthlyDates = (year: number, monthIdx: number) => {
      const d15 = new Date(year, monthIdx, 15);
      const res15 = adjustIfWeekendOrHoliday(d15);
      res15.date.setHours(0, 0, 0, 0);

      const dLast = new Date(year, monthIdx + 1, 0);
      const resLast = adjustIfWeekendOrHoliday(dLast);
      resLast.date.setHours(0, 0, 0, 0);

      return [res15, resLast];
    };

    let candidates = getSemimonthlyDates(targetYear, targetMonthIdx);
    let found = candidates.find(c => c.date.getTime() >= today.getTime());

    if (!found) {
      targetMonthIdx += 1;
      if (targetMonthIdx > 11) {
        targetMonthIdx = 0;
        targetYear += 1;
      }
      candidates = getSemimonthlyDates(targetYear, targetMonthIdx);
      found = candidates[0];
    }

    paydayDate = found.date;
    adjusted = found.adjusted;
    adjustReason = found.adjustReason;
  }

  paydayDate.setHours(0, 0, 0, 0);
  const timeDiff = paydayDate.getTime() - today.getTime();
  const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));

  return {
    date: paydayDate,
    adjusted,
    adjustReason,
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

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
 * the feature's own settings shape -- the same reason finance-defaults.ts is
 * here.
 */

import {
  UK_STATUTORY_PERSONAL_ALLOWANCE,
  calculateUkTax,
  epochDay,
  nextPayday,
  normalizeHolidays,
  toISODate,
  ukBasePersonalAllowance,
  ukBenefitInKindTax,
  ukCashAfterTax,
  type UkPensionMethod,
  type UkTaxInput,
} from '@/lib/finance';
import type {
  CashBenefitAfterTax,
  FinanceSettings,
  PackageBenefit,
  TaxConfig,
  UserHoliday,
} from '@/features/finance/finance-types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Picks the rate set that was in force on a given UK calendar date.
 *
 * Falling back to a future configuration would silently rewrite history, so a
 * caller must add the missing historical rates instead.
 *
 * `calculateFinance` no longer reads the result: income tax, NI and student
 * loans come from the same engine as the Tax Calculator. The rows stay for the
 * admin rate editor and anything else that wants the timeline.
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

const PENSION_METHOD: Record<FinanceSettings['pensionType'], UkPensionMethod> = {
  net_pay: 'net-pay',
  salary_sacrifice: 'salary-sacrifice',
  relief_at_source: 'relief-at-source',
};

/** A package item's annual value in pounds: its amount, or its share of salary. */
export const benefitValueOf = (benefit: PackageBenefit, grossSalary: number): number => {
  const value = benefit.type === 'percentage' ? grossSalary * ((benefit.amount || 0) / 100) : benefit.amount || 0;
  return value || 0;
};

/**
 * Everything the Tax & Income page derives from the settings.
 *
 * Income tax, National Insurance and student loans come from
 * `calculateUkTax` in lib/finance/uk-tax-calculator.ts, the engine the Tax
 * Calculator runs, so the two pages agree for Scottish and relief-at-source
 * profiles. That engine describes one tax year (2026/27): `_taxConfigs` and
 * `_asOfDate` are accepted so callers need not change, but neither affects a
 * figure, and no tax configuration needs to exist.
 *
 * The pension percentage is the gross contribution. What leaves pay for it is
 * `personalPensionRate` (80% of it under relief at source), and
 * `personalAllowance` is the allowance after the £100,000 taper.
 *
 * Package items are 'cash' or 'benefit-in-kind' (anything else reads as the
 * latter). Cash items are paid through payroll, each reported after tax in
 * `cashBenefits` and kept out of take-home. Benefit-in-kind tax is derived from
 * the items' combined value: `benefitTax` is what the engine says it adds, and
 * `benefitTaxDeduction` is the part taken from take-home, which is nothing when
 * the tax code's allowance is already below the statutory one because HMRC
 * collects it through the code (`benefitTaxCollectedByCode`).
 */
/**
 * The engine input the settings describe, salary only. The Tax Calculator
 * seeds from this too, so the two pages read the settings the same way.
 */
export const ukTaxInputFromSettings = (settings: FinanceSettings): UkTaxInput => ({
  income: settings.grossSalary,
  kind: 'employed',
  region: settings.ukRegion === 'scotland' ? 'scotland' : 'rUK',
  benefitsInKind: 0,
  pensionContribution: settings.grossSalary * (settings.personalPensionPercent / 100),
  pensionMethod: PENSION_METHOD[settings.pensionType] ?? 'net-pay',
  undergradPlan: settings.studentLoanPlan === 'postgrad' ? 'none' : settings.studentLoanPlan,
  postgradLoan: settings.studentLoanPlan === 'postgrad',
  children: 0,
  childcareSupport: 0,
  marriageAllowance: false,
  personalAllowance: settings.personalAllowance,
});

export const calculateFinance = (
  settings: FinanceSettings,
  _taxConfigs: readonly TaxConfig[],
  _asOfDate: string,
) => {
  const {
    grossSalary,
    pensionType,
    personalPensionPercent,
    employerPensionPercent,
    studentLoanPlan,
    personalAllowance: statedPersonalAllowance,
    weekends,
    bankHolidays,
    workHolidays,
    workingHoursPerDay,
  } = settings;

  const employerPensionRate = grossSalary * (employerPensionPercent / 100);

  const packageBenefits = settings.packageBenefits || [];
  const totalBenefitsValue = packageBenefits.reduce((sum, b) => sum + benefitValueOf(b, grossSalary), 0);

  const totalPackage = grossSalary + employerPensionRate + totalBenefitsValue;

  // Benefits in kind are kept out of the salary figures: they are taxed, not
  // paid, and are added back through `ukBenefitInKindTax` below.
  const salaryInput = ukTaxInputFromSettings(settings);
  const tax = calculateUkTax(salaryInput);

  const incomeTax = tax.incomeTax;
  const nationalInsurance = tax.nationalInsurance;
  const studentLoan = tax.studentLoan + tax.postgradLoan;
  const personalPensionRate = tax.pensionFromPay;
  const personalAllowance = tax.personalAllowance;

  // Negative items are ignored here; they stay in `totalBenefitsValue` as before.
  const taxableValueOf = (b: PackageBenefit): number => Math.max(0, benefitValueOf(b, grossSalary));
  const benefitInKindValue = packageBenefits
    .filter(b => b.kind !== 'cash')
    .reduce((sum, b) => sum + taxableValueOf(b), 0);
  const benefitTaxCollectedByCode =
    benefitInKindValue > 0 && ukBasePersonalAllowance(statedPersonalAllowance) < UK_STATUTORY_PERSONAL_ALLOWANCE;
  const taxInput: UkTaxInput = {
    ...salaryInput,
    benefitsInKind: benefitTaxCollectedByCode ? 0 : benefitInKindValue,
  };
  const benefitTax = ukBenefitInKindTax(salaryInput, benefitInKindValue);
  const benefitTaxDeduction = benefitTaxCollectedByCode ? 0 : benefitTax;

  const cashBenefits: CashBenefitAfterTax[] = packageBenefits
    .filter(b => b.kind === 'cash')
    .map(b => {
      const { gross, incomeTax: cashTax, nationalInsurance: cashNi, studentLoan: cashLoan, net } = ukCashAfterTax(
        salaryInput,
        taxableValueOf(b),
      );
      return { id: b.id, name: b.name, gross, incomeTax: cashTax, nationalInsurance: cashNi, studentLoan: cashLoan, net };
    });

  // The engine's take-home already has the pension taken from pay (80% of it
  // under relief at source), so total deductions rebuilt from the same parts
  // keep gross - deductions = take-home.
  const totalDeductions = incomeTax + nationalInsurance + studentLoan + personalPensionRate + benefitTaxDeduction;
  const netTakeHome = tax.takeHome - benefitTaxDeduction;
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
    taxInput,
    personalPensionRate,
    employerPensionRate,
    totalBenefitsValue,
    benefitTaxDeduction,
    benefitTax,
    benefitTaxCollectedByCode,
    benefitInKindValue,
    cashBenefits,
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

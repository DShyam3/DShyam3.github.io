import { MONTH_NAMES } from '../finance-defaults';
import type { BreakdownRateMode } from '../FinanceDataContext';
import type { FinanceSettings, HalfDay, PackageBenefitKind, UserHoliday } from '@/features/finance/finance-types';
import { formatGBP } from '@/features/finance/utils/calculations';
import {
  calculateWorkingDaysInRange,
  calendarParts,
  isCountableLeaveRange,
  resolveBankHolidaysForRange,
  type OptimalHolidayBridge,
} from '@/lib/finance';

/** Past this many bridges the Maximiser lists only the recommended ones. */
export const MAX_INLINE_BRIDGES = 5;

export const HALF_DAY_LABEL: Record<HalfDay, string> = { am: 'morning', pm: 'afternoon' };
export const HALF_DAY_BUTTON: Record<HalfDay, string> = { am: 'Morning', pm: 'Afternoon' };

/** A stored day as a local-midnight `Date`, for the booking calendar. */
export const isoToLocalDate = (iso: string): Date | undefined => {
  const parts = calendarParts(iso);
  return parts ? new Date(parts.year, parts.month - 1, parts.day) : undefined;
};

/** `25 Dec`: a day the reader already knows the year of. */
export const shortUkDate = (iso: string): string => {
  const parts = calendarParts(iso);
  return parts ? `${parts.day} ${MONTH_NAMES[parts.month - 1].slice(0, 3)}` : iso;
};

export const countOf = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

// £-formatted with no pence: NI thresholds are round pounds, so the ".00"
// formatGBP always adds is only noise here.
export const formatGBPNoPence = (n: number) => formatGBP(n).replace(/\.00$/, '');

export type Period = 'annual' | 'monthly' | 'weekly' | 'daily' | 'hourly';

export const PERIODS: { key: Period; label: string }[] = [
  { key: 'annual', label: 'Annual' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'daily', label: 'Daily' },
  { key: 'hourly', label: 'Hourly' },
];

export const RATE_MODES: { key: BreakdownRateMode; label: string }[] = [
  { key: 'normal', label: 'Normal' },
  { key: 'including_leave', label: 'Incl. Paid Leave' },
  { key: 'excluding_leave', label: 'Excl. Paid Leave' },
];

export const PENSION_TYPE_LABEL: Record<FinanceSettings['pensionType'], string> = {
  net_pay: 'Net pay arrangement',
  salary_sacrifice: 'Salary sacrifice',
  relief_at_source: 'Relief at source',
};

export const BENEFIT_PRESETS = [
  { key: 'custom', label: '✨ Custom Benefit', name: '', amount: '', type: 'monetary' as const, emoji: '🎁', notes: '', kind: 'benefit-in-kind' as const },
  { key: 'annual_bonus', label: '🎯 Annual Bonus (default 10%)', name: 'Annual Bonus', amount: '10', type: 'percentage' as const, emoji: '🎯', notes: 'Performance / annual target bonus', kind: 'cash' as const },
  { key: 'private_medical', label: '🏥 Private Medical Insurance', name: 'Private Medical Insurance', amount: '1500', type: 'monetary' as const, emoji: '🏥', notes: 'Taxable Benefit in Kind (P11D)', kind: 'benefit-in-kind' as const },
  { key: 'dental', label: '🦷 Dental Cover', name: 'Dental Cover', amount: '400', type: 'monetary' as const, emoji: '🦷', notes: 'Taxable Benefit in Kind (P11D)', kind: 'benefit-in-kind' as const },
  { key: 'travel_insurance', label: '✈️ Travel Insurance', name: 'Travel Insurance', amount: '350', type: 'monetary' as const, emoji: '✈️', notes: 'Employer travel cover (P11D)', kind: 'benefit-in-kind' as const },
  { key: 'equity_rsus', label: '📈 Equity / RSUs', name: 'Equity / RSUs', amount: '5000', type: 'monetary' as const, emoji: '📈', notes: 'Annual stock / RSU grant', kind: 'cash' as const },
  { key: 'car_allowance', label: '🚗 Car Allowance', name: 'Car Allowance', amount: '3000', type: 'monetary' as const, emoji: '🚗', notes: 'Annual car allowance', kind: 'cash' as const },
  { key: 'gym_wellness', label: '🏋️ Gym & Wellness', name: 'Gym & Wellness', amount: '600', type: 'monetary' as const, emoji: '🏋️', notes: 'Wellness / gym subsidy', kind: 'benefit-in-kind' as const },
  { key: 'tech_wfh', label: '💻 Tech / WFH Allowance', name: 'Tech / WFH Allowance', amount: '1000', type: 'monetary' as const, emoji: '💻', notes: 'Equipment / home office stipend', kind: 'cash' as const },
] as const;

export const BENEFIT_KINDS = [
  { key: 'cash', label: 'Cash' },
  { key: 'benefit-in-kind', label: 'Benefit in kind' },
] as const satisfies readonly { key: PackageBenefitKind; label: string }[];

/** One line of the breakdown table. A `total` is ruled off above; the
 *  `result` is the take-home figure the table ends on. */
export interface BreakdownRow {
  key: string;
  label: string;
  note?: string;
  rates: Record<Period, number>;
  sign?: '+' | '-';
  tone?: string;
  kind?: 'total' | 'result';
}

export const bankHolidaysForLeave = (
  start: string,
  end: string,
  ukRegion: FinanceSettings['ukRegion'] | undefined,
  fetchedBankHolidays: string[],
): string[] | null =>
  isCountableLeaveRange(start, end)
    ? resolveBankHolidaysForRange(start, end, ukRegion || 'england-and-wales', fetchedBankHolidays)
    : null;

export const workingDaysIn = (
  start: string,
  end: string,
  ukRegion: FinanceSettings['ukRegion'] | undefined,
  fetchedBankHolidays: string[],
): number => {
  const bankHolidays = bankHolidaysForLeave(start, end, ukRegion, fetchedBankHolidays);
  return bankHolidays ? calculateWorkingDaysInRange(start, end, bankHolidays) : 0;
};

export const getBirthdayEntryInsideRange = (
  normalizedHolidaysAll: UserHoliday[],
  startDate: string,
  endDate: string,
): UserHoliday | undefined => {
  if (!startDate || !endDate) return undefined;
  return normalizedHolidaysAll.find(
    h => h.type === 'birthday' && h.startDate >= startDate && h.startDate <= endDate,
  );
};

export const countRemainingBankHolidays = (bankHolidaysList: string[]): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return bankHolidaysList.filter(dateStr => {
    const bhDate = new Date(dateStr);
    bhDate.setHours(0, 0, 0, 0);
    return bhDate.getTime() >= today.getTime();
  }).length;
};

export const buildHolidayEntriesForBridge = (
  bridge: OptimalHolidayBridge,
  countWorkingDays: (start: string, end: string) => number,
  seedOffset = 0,
): UserHoliday[] => {
  const entries: UserHoliday[] = [];
  const bdayIso = bridge.usesBirthdayDay && bridge.birthdayDayDate ? bridge.birthdayDayDate : null;
  if (bdayIso) {
    entries.push({
      id: `hol_bday_${Date.now()}_${seedOffset}`,
      startDate: bdayIso,
      endDate: bdayIso,
      occasion: 'Birthday Day Off',
      count: 1,
      type: 'birthday',
    });
  }

  const remainingWorkDays = bridge.datesToBook
    .filter(d => d !== bdayIso)
    .sort();

  if (remainingWorkDays.length > 0) {
    // Group into contiguous runs where no unbooked working day lies between two dates
    const runs: Array<{ start: string; end: string; count: number }> = [];
    let runStart = remainingWorkDays[0];
    let prevIso = remainingWorkDays[0];
    let runCount = 1;

    for (let i = 1; i < remainingWorkDays.length; i++) {
      const curIso = remainingWorkDays[i];
      const workDaysBetween = countWorkingDays(prevIso, curIso);
      if (workDaysBetween === 2) {
        prevIso = curIso;
        runCount++;
        continue;
      }
      runs.push({ start: runStart, end: prevIso, count: runCount });
      runStart = curIso;
      prevIso = curIso;
      runCount = 1;
    }
    runs.push({ start: runStart, end: prevIso, count: runCount });

    runs.forEach((run, runIdx) => {
      entries.push({
        id: `hol_opt_${Date.now()}_${seedOffset}_${runIdx}`,
        startDate: run.start,
        endDate: run.end,
        occasion: bridge.label,
        count: run.count,
        type: 'holiday',
      });
    });
  }

  return entries;
};

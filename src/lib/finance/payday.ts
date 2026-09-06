/**
 * When a monthly salary actually lands. Pure; see REHAUL_PLAN.md 7.I.
 *
 * UK employers pay on the last working day on or before the scheduled date, so
 * a payday falling on a weekend or bank holiday moves *backwards*.
 */

import { getDaysInMonth, isWeekend, toISODate } from './dates';

export interface PaydayResult {
  date: Date;
  /** True when the scheduled day was not a working day. */
  adjusted: boolean;
  adjustReason: 'weekend' | 'bank_holiday' | null;
}

/**
 * `scheduledDay` is the day of the month payroll targets, clamped to the
 * month's length so "the 31st" still works in February. `bankHolidays` is a
 * list of `YYYY-MM-DD` strings.
 */
export const calculateActualPayday = (
  year: number,
  monthIndex: number,
  scheduledDay: number,
  bankHolidays: string[],
): PaydayResult => {
  const targetDay = Math.min(scheduledDay, getDaysInMonth(year, monthIndex));
  const date = new Date(year, monthIndex, targetDay);

  let adjusted = false;
  let adjustReason: PaydayResult['adjustReason'] = null;

  for (;;) {
    if (isWeekend(date)) {
      adjusted = true;
      adjustReason = 'weekend';
    } else if (bankHolidays.includes(toISODate(date))) {
      adjusted = true;
      adjustReason = 'bank_holiday';
    } else {
      break;
    }
    date.setDate(date.getDate() - 1);
  }

  return { date, adjusted, adjustReason };
};

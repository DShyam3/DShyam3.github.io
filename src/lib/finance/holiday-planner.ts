/**
 * Optimal annual-leave bridge planner around UK bank holidays, weekends, and
 * birthday days off.
 *
 * Pure; see REHAUL_PLAN.md 7.I.
 */

import { calendarParts, isoOfEpochDay } from './dates';
import {
  computeUkBankHolidaysForYear,
  resolveBankHolidaysForYear,
  type UkHolidayRegion,
} from './holiday-bank';
import {
  calendarDays,
  formatHolidayDates,
  getBirthdayLeaveWindow,
  utcMidnight,
  type BirthdayDate,
  type BirthdayLeaveRule,
  type UserHoliday,
} from './holiday-core';

export type OptimalLeaveBias =
  | 'balanced'
  | 'long_christmas'
  | 'long_easter'
  | 'summer_focus';

export const OPTIMAL_LEAVE_BIASES: readonly OptimalLeaveBias[] = [
  'balanced',
  'long_christmas',
  'long_easter',
  'summer_focus',
];

export const OPTIMAL_LEAVE_BIAS_LABELS: Record<
  OptimalLeaveBias,
  { label: string; shortLabel: string; description: string }
> = {
  balanced: {
    label: 'Balanced (Max Efficiency)',
    shortLabel: 'Balanced',
    description: 'Maximises total days off per leave day spent across the whole year.',
  },
  long_christmas: {
    label: 'Long Christmas Shutdown',
    shortLabel: 'Long Christmas',
    description: 'Reserves leave first for the Ultimate 15–18 day Christmas & New Year shutdown, trading off lower-priority bridges if needed.',
  },
  long_easter: {
    label: 'Long Easter Mega-Break',
    shortLabel: 'Long Easter',
    description: 'Reserves leave first for the combined 16-day Easter shutdown across Good Friday and Easter Monday.',
  },
  summer_focus: {
    label: 'May & Summer Focus',
    shortLabel: 'Summer Focus',
    description: 'Prioritises May, Spring, and Late Summer bank-holiday bridges first.',
  },
};

/** Formats a single `YYYY-MM-DD` date in UK format (`4 Jan 27` or `Mon 4 Jan 27`). */
export const formatUkDate = (iso: string, includeWeekday = false): string => {
  if (!calendarParts(iso)) return '';
  return utcMidnight(iso)
    .toLocaleDateString('en-GB', {
      ...(includeWeekday ? { weekday: 'short' } : {}),
      day: 'numeric',
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    })
    .replace(/,\s*/g, ' ');
};

/** Collapses an array of `YYYY-MM-DD` dates to book into UK range segments
 *  (e.g. `21 Dec - 24 Dec 26 + 29 Dec - 31 Dec 26`). */
export const formatDatesToBookUk = (dates: string[]): string => {
  const valid = [...new Set(dates.filter(d => Boolean(calendarParts(d))))].sort();
  if (valid.length === 0) return '';

  const segments: Array<{ start: string; end: string }> = [];
  let segStart = valid[0];
  let prevIso = valid[0];
  let prevEpoch = calendarParts(valid[0])!.epoch;

  for (let i = 1; i < valid.length; i++) {
    const curIso = valid[i];
    const curParts = calendarParts(curIso);
    if (!curParts) continue;
    if (curParts.epoch === prevEpoch + 1) {
      prevIso = curIso;
      prevEpoch = curParts.epoch;
      continue;
    }
    segments.push({ start: segStart, end: prevIso });
    segStart = curIso;
    prevIso = curIso;
    prevEpoch = curParts.epoch;
  }
  segments.push({ start: segStart, end: prevIso });

  return segments.map(s => formatHolidayDates(s.start, s.end)).join(' + ');
};

export interface OptimalHolidayBridge {
  id: string;
  clusterId?: string;
  label: string;
  startDate: string;
  endDate: string;
  breakStartDate: string;
  breakEndDate: string;
  /** Exact working days (`YYYY-MM-DD`) that need to be booked as leave (including birthday day if used). */
  datesToBook: string[];
  /** First working day back at work after `breakEndDate` (`YYYY-MM-DD`). */
  returnToWorkDate: string;
  /** Optional tier (1 = Efficient 3-Day Bridge, 2 = Balanced 4-5 Day Stretch, 3 = Ultimate 7-8 Day Shutdown). */
  tier?: 1 | 2 | 3;
  /** Human-readable tier badge, e.g. "Tier 1 · Efficient Bridge". */
  tierLabel?: string;
  /** Standard annual leave days required (excludes the 1 birthday day when usesBirthdayDay is true). */
  leaveDaysRequired: number;
  /** Total working days in [startDate, endDate] (leaveDaysRequired + (usesBirthdayDay ? 1 : 0)). */
  workingDaysBooked: number;
  /** Total consecutive calendar days off from breakStartDate to breakEndDate inclusive. */
  totalDaysOff: number;
  /** Ratio of totalDaysOff to workingDaysBooked, rounded to 2 decimal places. */
  efficiency: number;
  usesBirthdayDay: boolean;
  birthdayDayDate?: string;
  bankHolidayNames: string[];
  recommended: boolean;
}

export interface PlanOptimalHolidaysOptions {
  year: number;
  region?: UkHolidayRegion;
  /** Annual leave allowance in days (e.g. 25). */
  annualAllowance: number;
  /** Optional explicit bank holiday dates for `year` (falls back to `computeUkBankHolidaysForYear`). */
  bankHolidays?: string[];
  /** Optional bank holiday title map for `year`. */
  bankHolidaysMap?: Record<string, string>;
  /** Existing booked holidays (used to exclude already-booked ranges and deduct already-used holiday allowance). */
  existingHolidays?: UserHoliday[];
  birthdayLeaveEnabled?: boolean;
  birthdayLeaveRule?: BirthdayLeaveRule;
  birthday?: BirthdayDate | null;
  bias?: OptimalLeaveBias;
  /** Optional reference date (`YYYY-MM-DD`) to plan only remaining bridges from `asOfDate` onwards. */
  asOfDate?: string;
}

export interface OptimalHolidayPlan {
  year: number;
  bias: OptimalLeaveBias;
  bridges: OptimalHolidayBridge[];
  recommendedLeaveDays: number;
  recommendedTotalDaysOff: number;
  recommendedUsesBirthday: boolean;
  remainingAllowanceAfterPlan: number;
}

/** Computes optimal annual-leave bridges around bank holidays, weekends, and
 *  an optional birthday day off for any calendar year. */
export function planOptimalHolidays(options: PlanOptimalHolidaysOptions): OptimalHolidayPlan {
  const { year } = options;
  const bias: OptimalLeaveBias = options.bias ?? 'balanced';
  const safeAllowance = Number.isFinite(options.annualAllowance) ? Math.max(0, options.annualAllowance) : 0;

  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    return {
      year,
      bias,
      bridges: [],
      recommendedLeaveDays: 0,
      recommendedTotalDaysOff: 0,
      recommendedUsesBirthday: false,
      remainingAllowanceAfterPlan: safeAllowance,
    };
  }

  const asOfParts = options.asOfDate ? calendarParts(options.asOfDate) : null;
  const activeAsOfIso = asOfParts && asOfParts.year === year ? options.asOfDate! : null;

  const region = options.region ?? 'england-and-wales';
  const currentYearBh = resolveBankHolidaysForYear(
    year,
    region,
    options.bankHolidays,
    options.bankHolidaysMap,
  );
  const prevYearBh = computeUkBankHolidaysForYear(year - 1, region);
  const nextYearBh = computeUkBankHolidaysForYear(year + 1, region);

  const allBhSet = new Set<string>([
    ...prevYearBh.map(e => e.date),
    ...currentYearBh.dates,
    ...nextYearBh.map(e => e.date),
  ]);
  const allBhMap: Record<string, string> = {};
  for (const e of prevYearBh) allBhMap[e.date] = e.title;
  for (const [k, v] of Object.entries(currentYearBh.map)) allBhMap[k] = v;
  for (const e of nextYearBh) allBhMap[e.date] = e.title;

  const existing = options.existingHolidays ?? [];
  const bookedDatesSet = new Set<string>();
  const sickDatesSet = new Set<string>();
  let usedHolidayDays = 0;
  let alreadyHasBirthdayInYear = false;

  for (const hol of existing) {
    const inYear = calendarParts(hol.startDate)?.year === year;
    if (hol.type === 'birthday' && inYear) {
      alreadyHasBirthdayInYear = true;
    } else if (inYear && hol.type !== 'sick') {
      usedHolidayDays += Number.isFinite(hol.count) ? hol.count : 0;
    }
    for (const day of calendarDays(hol.startDate, hol.endDate)) {
      if (!day.weekend && !allBhSet.has(day.iso)) {
        bookedDatesSet.add(day.iso);
        if (hol.type === 'sick') sickDatesSet.add(day.iso);
      }
    }
  }

  const availableAllowance = Math.max(0, safeAllowance - usedHolidayDays);
  const canUseBirthday = Boolean(options.birthdayLeaveEnabled) && !alreadyHasBirthdayInYear;
  const birthdayRule: BirthdayLeaveRule = options.birthdayLeaveRule ?? 'within_week';
  const birthdayWindow = canUseBirthday
    ? getBirthdayLeaveWindow(year, birthdayRule, options.birthday, currentYearBh.dates)
    : null;

  const isNonWorkingOrBooked = (iso: string, extraBooked?: Set<string>): boolean => {
    if (!calendarParts(iso) || sickDatesSet.has(iso)) return false;
    const wd = utcMidnight(iso).getUTCDay();
    if (wd === 0 || wd === 6) return true;
    if (allBhSet.has(iso) || bookedDatesSet.has(iso)) return true;
    return Boolean(extraBooked?.has(iso));
  };

  interface RawCandidate {
    customId?: string;
    clusterId?: string;
    startDate: string;
    endDate: string;
    workDays: string[];
    breakStartDate: string;
    breakEndDate: string;
    returnToWorkDate: string;
    totalDaysOff: number;
    bankHolidayNames: string[];
    label: string;
    tier?: 1 | 2 | 3;
    tierLabel?: string;
    usesBirthdayDay: boolean;
    birthdayDayDate?: string;
    leaveDaysRequired: number;
  }

  const candidateMap = new Map<string, RawCandidate>();

  const deriveBridgeLabel = (
    startDate: string,
    breakStartDate: string,
    breakEndDate: string,
    bhDatesInBreak: string[],
  ): string => {
    const titles = bhDatesInBreak.map(d => allBhMap[d]).filter(Boolean);
    const hasGoodFriday = titles.includes('Good Friday');
    const hasEasterMonday = titles.includes('Easter Monday');
    if (hasGoodFriday || hasEasterMonday) {
      const goodFridayIso = bhDatesInBreak.find(d => allBhMap[d] === 'Good Friday');
      if (goodFridayIso && startDate < goodFridayIso) {
        return 'Easter (Pre-Easter Week)';
      }
      return 'Easter (Post-Easter Week)';
    }
    if (
      titles.includes('Christmas Day') ||
      titles.includes('Boxing Day') ||
      (breakStartDate.startsWith(`${year}-12-`) && breakEndDate.startsWith(`${year + 1}-01-`))
    ) {
      return 'Christmas & New Year Break';
    }
    if (titles.length > 0) {
      return `${titles[0]} Bridge`;
    }
    return 'Holiday Bridge';
  };

  interface SpanMeta {
    customLabel?: string;
    tier?: 1 | 2 | 3;
    tierLabel?: string;
  }

  const addCandidateSpan = (rawStartIso: string, rawEndIso: string, meta?: SpanMeta) => {
    const workDays: string[] = [];
    for (const day of calendarDays(rawStartIso, rawEndIso)) {
      if (sickDatesSet.has(day.iso)) return;
      if (day.year !== year) continue;
      if (!day.weekend && !allBhSet.has(day.iso) && !bookedDatesSet.has(day.iso)) {
        workDays.push(day.iso);
      }
    }
    if (workDays.length === 0) return;

    const startDate = workDays[0];
    const endDate = workDays[workDays.length - 1];
    const key = `${startDate}:${endDate}`;
    const existingCand = candidateMap.get(key);
    if (existingCand) {
      if (meta?.customLabel) existingCand.label = meta.customLabel;
      if (meta?.tier) existingCand.tier = meta.tier;
      if (meta?.tierLabel) existingCand.tierLabel = meta.tierLabel;
      return;
    }

    const workSet = new Set(workDays);
    const startParts = calendarParts(startDate);
    const endParts = calendarParts(endDate);
    if (!startParts || !endParts) return;

    let breakStartEpoch = startParts.epoch;
    while (isNonWorkingOrBooked(isoOfEpochDay(breakStartEpoch - 1), workSet)) {
      breakStartEpoch--;
    }

    let breakEndEpoch = endParts.epoch;
    while (isNonWorkingOrBooked(isoOfEpochDay(breakEndEpoch + 1), workSet)) {
      breakEndEpoch++;
    }

    const breakStartDate = isoOfEpochDay(breakStartEpoch);
    const breakEndDate = isoOfEpochDay(breakEndEpoch);
    const returnToWorkDate = isoOfEpochDay(breakEndEpoch + 1);
    const totalDaysOff = breakEndEpoch - breakStartEpoch + 1;
    if (totalDaysOff <= workDays.length) return;

    const bhDatesInBreak: string[] = [];
    for (let ep = breakStartEpoch; ep <= breakEndEpoch; ep++) {
      const iso = isoOfEpochDay(ep);
      if (allBhSet.has(iso)) bhDatesInBreak.push(iso);
    }
    const bankHolidayNames = [...new Set(bhDatesInBreak.map(d => allBhMap[d] || 'Bank Holiday'))];
    const label = meta?.customLabel ?? deriveBridgeLabel(startDate, breakStartDate, breakEndDate, bhDatesInBreak);

    candidateMap.set(key, {
      startDate,
      endDate,
      workDays,
      breakStartDate,
      breakEndDate,
      returnToWorkDate,
      totalDaysOff,
      bankHolidayNames,
      label,
      ...(meta?.tier ? { tier: meta.tier } : {}),
      ...(meta?.tierLabel ? { tierLabel: meta.tierLabel } : {}),
      usesBirthdayDay: false,
      leaveDaysRequired: workDays.length,
    });
  };

  // Generate Monday-Friday week spans around every bank holiday in `year`
  for (const bhDate of currentYearBh.dates) {
    // Skip Dec 25/26/27/28 here so Christmas Tiers 1, 2, 3 are added cleanly below
    if (bhDate.startsWith(`${year}-12-2`)) continue;
    const parts = calendarParts(bhDate);
    if (!parts) continue;
    const wd = utcMidnight(bhDate).getUTCDay();
    const offsetToMon = (wd + 6) % 7;
    const monIso = isoOfEpochDay(parts.epoch - offsetToMon);
    const friIso = isoOfEpochDay(parts.epoch - offsetToMon + 4);
    const clampedStart = monIso < `${year}-01-01` ? `${year}-01-01` : monIso;
    const clampedEnd = friIso > `${year}-12-31` ? `${year}-12-31` : friIso;
    addCandidateSpan(clampedStart, clampedEnd);
  }

  // Easter Tiers (Tier 1 Pre-Easter, Tier 1 Post-Easter, Tier 3 16-Day Easter Mega-Break)
  const goodFridayIso = currentYearBh.dates.find(d => currentYearBh.map[d] === 'Good Friday');
  const easterMondayIso = currentYearBh.dates.find(d => currentYearBh.map[d] === 'Easter Monday');
  if (goodFridayIso) {
    const gfParts = calendarParts(goodFridayIso);
    if (gfParts) {
      const monBeforeGf = isoOfEpochDay(gfParts.epoch - 4);
      const thuBeforeGf = isoOfEpochDay(gfParts.epoch - 1);
      addCandidateSpan(monBeforeGf, thuBeforeGf, {
        customLabel: 'Easter (Pre-Easter Week)',
        tier: 1,
        tierLabel: 'Tier 1 · Pre-Easter 4-Day Bridge',
      });

      if (easterMondayIso) {
        const emParts = calendarParts(easterMondayIso);
        if (emParts) {
          const tueAfterEm = isoOfEpochDay(emParts.epoch + 1);
          const friAfterEm = isoOfEpochDay(emParts.epoch + 4);
          addCandidateSpan(tueAfterEm, friAfterEm, {
            customLabel: 'Easter (Post-Easter Week)',
            tier: 1,
            tierLabel: 'Tier 1 · Post-Easter 4-Day Bridge',
          });
          addCandidateSpan(monBeforeGf, friAfterEm, {
            customLabel: 'Easter (16-Day Mega-Break)',
            tier: 3,
            tierLabel: 'Tier 3 · 16-Day Easter Shutdown',
          });
        }
      }
    }
  }

  // Christmas Tiers (Tier 1: Efficient Bridge, Tier 2: Balanced Stretch, Tier 3: Ultimate Shutdown)
  const xmasParts = calendarParts(`${year}-12-25`);
  if (xmasParts) {
    const xmasWd = utcMidnight(`${year}-12-25`).getUTCDay();
    const offsetToMon = (xmasWd + 6) % 7;
    const xmasMonEpoch = xmasParts.epoch - offsetToMon;
    const xmasMonIso = isoOfEpochDay(xmasMonEpoch);
    const prevWeekMonIso = isoOfEpochDay(xmasMonEpoch - 7);

    // Count unbooked working days in xmasMonIso .. Dec 24
    const preXmasWorkDays: string[] = [];
    for (const day of calendarDays(xmasMonIso, `${year}-12-24`)) {
      if (!day.weekend && !allBhSet.has(day.iso) && !bookedDatesSet.has(day.iso)) {
        preXmasWorkDays.push(day.iso);
      }
    }

    // Tier 1: Twixmas working days only (between Christmas/Boxing Day and New Year)
    addCandidateSpan(`${year}-12-25`, `${year}-12-31`, {
      customLabel: 'Christmas & New Year (3-Day Bridge)',
      tier: 1,
      tierLabel: 'Tier 1 · Efficient Bridge',
    });

    if (preXmasWorkDays.length >= 3) {
      // Tier 2: last 2 pre-Christmas working days + Twixmas (5 working days -> 12 days off)
      addCandidateSpan(preXmasWorkDays[preXmasWorkDays.length - 2], `${year}-12-31`, {
        customLabel: 'Christmas & New Year (Balanced Stretch)',
        tier: 2,
        tierLabel: 'Tier 2 · Balanced Stretch',
      });
      // Tier 3: full Christmas week + Twixmas (7–8 working days -> 16 days off)
      addCandidateSpan(xmasMonIso, `${year}-12-31`, {
        customLabel: 'Christmas & New Year (Ultimate Shutdown)',
        tier: 3,
        tierLabel: 'Tier 3 · Ultimate Shutdown',
      });
    } else if (preXmasWorkDays.length >= 1) {
      // Tier 2: 1–2 pre-Christmas working days + Twixmas (4–5 working days -> 11–12 days off)
      addCandidateSpan(xmasMonIso, `${year}-12-31`, {
        customLabel: 'Christmas & New Year (Balanced Stretch)',
        tier: 2,
        tierLabel: 'Tier 2 · Balanced Stretch',
      });
      // Tier 3: preceding Monday + Christmas week + Twixmas
      addCandidateSpan(prevWeekMonIso, `${year}-12-31`, {
        customLabel: 'Christmas & New Year (Ultimate Shutdown)',
        tier: 3,
        tierLabel: 'Tier 3 · Ultimate Shutdown',
      });
    } else {
      // Dec 25 is Monday: Tier 2 takes Thu+Fri before Christmas + Twixmas; Tier 3 takes full prior week + Twixmas
      addCandidateSpan(isoOfEpochDay(xmasMonEpoch - 4), `${year}-12-31`, {
        customLabel: 'Christmas & New Year (Balanced Stretch)',
        tier: 2,
        tierLabel: 'Tier 2 · Balanced Stretch',
      });
      addCandidateSpan(prevWeekMonIso, `${year}-12-31`, {
        customLabel: 'Christmas & New Year (Ultimate Shutdown)',
        tier: 3,
        tierLabel: 'Tier 3 · Ultimate Shutdown',
      });
    }
  }

  // Filter out candidates in the past when `asOfDate` is in `year`
  if (activeAsOfIso) {
    for (const [key, cand] of candidateMap.entries()) {
      if (cand.endDate < activeAsOfIso || cand.workDays.some(d => d < activeAsOfIso)) {
        candidateMap.delete(key);
      }
    }
  }

  // Integrate birthday day off
  if (canUseBirthday && birthdayWindow && birthdayWindow.eligibleDates.length > 0) {
    const validEligibleDates = activeAsOfIso
      ? birthdayWindow.eligibleDates.filter(d => d >= activeAsOfIso)
      : birthdayWindow.eligibleDates;
    const eligibleSet = new Set(validEligibleDates);

    // Find candidate bridges that contain an eligible birthday working day
    const matchingCandidates = [...candidateMap.values()].filter(c =>
      c.workDays.some(d => eligibleSet.has(d)),
    );

    if (matchingCandidates.length > 0 && (birthdayRule !== 'anytime' || birthdayWindow.birthdayIso)) {
      matchingCandidates.sort((a, b) => {
        const aHasExact = birthdayWindow.birthdayIso && a.workDays.includes(birthdayWindow.birthdayIso) ? 1 : 0;
        const bHasExact = birthdayWindow.birthdayIso && b.workDays.includes(birthdayWindow.birthdayIso) ? 1 : 0;
        if (aHasExact !== bHasExact) return bHasExact - aHasExact;
        return b.totalDaysOff / b.workDays.length - a.totalDaysOff / a.workDays.length;
      });
      const primary = matchingCandidates[0];
      const matchDate =
        (birthdayWindow.birthdayIso && primary.workDays.includes(birthdayWindow.birthdayIso)
          ? birthdayWindow.birthdayIso
          : primary.workDays.find(d => eligibleSet.has(d))) ?? primary.workDays[0];
      for (const cand of matchingCandidates) {
        if (cand.workDays.includes(matchDate)) {
          cand.usesBirthdayDay = true;
          cand.birthdayDayDate = matchDate;
          cand.leaveDaysRequired = Math.max(0, cand.workDays.length - 1);
        }
      }
    } else if (birthdayRule === 'anytime' && !birthdayWindow.birthdayIso && validEligibleDates.length > 0) {
      // Floating 'anytime' rule with no specific birthday date set: apply to best Tier 1 bridge
      const allCandidates = [...candidateMap.values()]
        .filter(c => !c.tier || c.tier === 1)
        .sort((a, b) => b.totalDaysOff / b.workDays.length - a.totalDaysOff / a.workDays.length);
      if (allCandidates.length > 0) {
        const best = allCandidates[0];
        best.usesBirthdayDay = true;
        best.birthdayDayDate = best.workDays[0];
        best.leaveDaysRequired = Math.max(0, best.workDays.length - 1);
      }
    }
  }

  // When planning from mid-year (`asOfDate >= YYYY-02-01`) and spare allowance exceeds
  // the remaining bank-holiday bridges, emit up to 2 high-efficiency non-bank-holiday stretches
  if (activeAsOfIso && activeAsOfIso >= `${year}-02-01` && availableAllowance > 0) {
    const bhBreakDates = new Set<string>();
    for (const cand of candidateMap.values()) {
      for (const d of calendarDays(cand.breakStartDate, cand.breakEndDate)) {
        bhBreakDates.add(d.iso);
      }
    }

    const usedStretchDates = new Set<string>();
    const monthNameOf = (iso: string): string =>
      utcMidnight(iso).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });

    // 1. Long Weekend Bridge (Fri + Mon across a weekend -> 4 days off for 2 leave days, efficiency 2.0)
    for (const day of calendarDays(activeAsOfIso, `${year}-12-20`)) {
      const wd = utcMidnight(day.iso).getUTCDay();
      if (wd !== 5) continue; // look for Friday
      const friParts = calendarParts(day.iso);
      if (!friParts) continue;
      const satIso = isoOfEpochDay(friParts.epoch + 1);
      const sunIso = isoOfEpochDay(friParts.epoch + 2);
      const monIso = isoOfEpochDay(friParts.epoch + 3);
      if (monIso > `${year}-12-31`) break;

      const spanIsos = [day.iso, satIso, sunIso, monIso];
      if (
        spanIsos.some(d => allBhSet.has(d) || bookedDatesSet.has(d) || bhBreakDates.has(d))
      ) {
        continue;
      }

      const workDays = [day.iso, monIso];
      const workSet = new Set(workDays);
      let breakStartEpoch = friParts.epoch;
      while (isNonWorkingOrBooked(isoOfEpochDay(breakStartEpoch - 1), workSet)) {
        breakStartEpoch--;
      }
      let breakEndEpoch = friParts.epoch + 3;
      while (isNonWorkingOrBooked(isoOfEpochDay(breakEndEpoch + 1), workSet)) {
        breakEndEpoch++;
      }
      const breakStartDate = isoOfEpochDay(breakStartEpoch);
      const breakEndDate = isoOfEpochDay(breakEndEpoch);
      const returnToWorkDate = isoOfEpochDay(breakEndEpoch + 1);
      const totalDaysOff = breakEndEpoch - breakStartEpoch + 1;

      candidateMap.set(`${day.iso}:${monIso}`, {
        customId: `rem_long_weekend_${day.iso}`,
        clusterId: 'rem_long_weekend',
        startDate: day.iso,
        endDate: monIso,
        workDays,
        breakStartDate,
        breakEndDate,
        returnToWorkDate,
        totalDaysOff,
        bankHolidayNames: [],
        label: `${monthNameOf(day.iso)} Long Weekend`,
        tier: 1,
        tierLabel: '2-Day Weekend Bridge',
        usesBirthdayDay: false,
        leaveDaysRequired: 2,
      });
      for (const d of calendarDays(breakStartDate, breakEndDate)) {
        usedStretchDates.add(d.iso);
      }
      break;
    }

    // 2. Full Week Nine-Day Break (Mon..Fri between two weekends -> 9 days off for 5 leave days, efficiency 1.8)
    for (const day of calendarDays(activeAsOfIso, `${year}-12-18`)) {
      const wd = utcMidnight(day.iso).getUTCDay();
      if (wd !== 1) continue; // look for Monday
      const monParts = calendarParts(day.iso);
      if (!monParts) continue;
      const friIso = isoOfEpochDay(monParts.epoch + 4);
      if (friIso > `${year}-12-31`) break;

      const weekDays: string[] = [];
      let blocked = false;
      for (let offset = 0; offset <= 4; offset++) {
        const curIso = isoOfEpochDay(monParts.epoch + offset);
        if (
          allBhSet.has(curIso) ||
          bookedDatesSet.has(curIso) ||
          bhBreakDates.has(curIso) ||
          usedStretchDates.has(curIso)
        ) {
          blocked = true;
          break;
        }
        weekDays.push(curIso);
      }
      if (blocked || weekDays.length !== 5) continue;

      const workSet = new Set(weekDays);
      let breakStartEpoch = monParts.epoch;
      while (isNonWorkingOrBooked(isoOfEpochDay(breakStartEpoch - 1), workSet)) {
        breakStartEpoch--;
      }
      let breakEndEpoch = monParts.epoch + 4;
      while (isNonWorkingOrBooked(isoOfEpochDay(breakEndEpoch + 1), workSet)) {
        breakEndEpoch++;
      }
      const breakStartDate = isoOfEpochDay(breakStartEpoch);
      const breakEndDate = isoOfEpochDay(breakEndEpoch);
      const returnToWorkDate = isoOfEpochDay(breakEndEpoch + 1);
      const totalDaysOff = breakEndEpoch - breakStartEpoch + 1;

      candidateMap.set(`${day.iso}:${friIso}`, {
        customId: `rem_week_stretch_${day.iso}`,
        clusterId: 'rem_week_stretch',
        startDate: day.iso,
        endDate: friIso,
        workDays: weekDays,
        breakStartDate,
        breakEndDate,
        returnToWorkDate,
        totalDaysOff,
        bankHolidayNames: [],
        label: `${monthNameOf(day.iso)} 9-Day Week Break`,
        tier: 2,
        tierLabel: '5-Day Week Bridge',
        usesBirthdayDay: false,
        leaveDaysRequired: 5,
      });
      break;
    }
  }

  const getBiasPriority = (cand: RawCandidate): number => {
    if (cand.leaveDaysRequired === 0) return 200;

    if (bias === 'long_christmas') {
      if (cand.label.includes('Christmas')) {
        if (cand.tier === 3) return 150;
        if (cand.tier === 2) return 140;
        return 130;
      }
      if (cand.tier === 3) return 20;
      return 60;
    }

    if (bias === 'long_easter') {
      if (cand.label.includes('Easter')) {
        if (cand.tier === 3) return 150;
        return 130;
      }
      if (cand.tier === 3) return 20;
      return 60;
    }

    if (bias === 'summer_focus') {
      const month = parseInt(cand.startDate.slice(5, 7), 10);
      if (month >= 5 && month <= 8) return 150;
      if (!cand.tier || cand.tier === 1) return 60;
      return 20;
    }

    // 'balanced' default: favour high-efficiency Tier 1 bridges
    if (!cand.tier || cand.tier === 1) return 80;
    if (cand.tier === 2) return 30;
    return 20;
  };

  // Rank candidates to select recommended non-overlapping bridges within availableAllowance
  const ranked = [...candidateMap.values()].sort((a, b) => {
    const aPrio = getBiasPriority(a);
    const bPrio = getBiasPriority(b);
    if (aPrio !== bPrio) return bPrio - aPrio;
    const aEff = a.totalDaysOff / Math.max(1, a.leaveDaysRequired);
    const bEff = b.totalDaysOff / Math.max(1, b.leaveDaysRequired);
    if (bEff !== aEff) return bEff - aEff;
    if (b.totalDaysOff !== a.totalDaysOff) return b.totalDaysOff - a.totalDaysOff;
    return a.startDate.localeCompare(b.startDate);
  });

  const selectedKeys = new Set<string>();
  const usedWorkDays = new Set<string>();
  let recommendedLeaveDays = 0;
  let recommendedTotalDaysOff = 0;
  let recommendedUsesBirthday = false;

  for (const cand of ranked) {
    if (cand.usesBirthdayDay && recommendedUsesBirthday) continue;
    if (cand.workDays.some(d => usedWorkDays.has(d))) continue;
    if (recommendedLeaveDays + cand.leaveDaysRequired > availableAllowance) continue;

    selectedKeys.add(`${cand.startDate}:${cand.endDate}`);
    for (const d of cand.workDays) usedWorkDays.add(d);
    recommendedLeaveDays += cand.leaveDaysRequired;
    recommendedTotalDaysOff += cand.totalDaysOff;
    if (cand.usesBirthdayDay) recommendedUsesBirthday = true;
  }

  // The benefit is still usable when no affordable selected bridge used it.
  if (!recommendedUsesBirthday && birthdayWindow) {
    // Create a standalone 1-day Birthday Day Off Break
    const unbookedEligible = birthdayWindow.eligibleDates.filter(d => (!activeAsOfIso || d >= activeAsOfIso) && !bookedDatesSet.has(d) && !usedWorkDays.has(d));
    if (unbookedEligible.length > 0) {
      const isMonOrFri = (iso: string) => {
        const wd = utcMidnight(iso).getUTCDay();
        return wd === 1 || wd === 5;
      };
      const chosenDate =
        (birthdayWindow.birthdayIso &&
        unbookedEligible.includes(birthdayWindow.birthdayIso) &&
        isMonOrFri(birthdayWindow.birthdayIso)
          ? birthdayWindow.birthdayIso
          : unbookedEligible.find(isMonOrFri) ??
            (birthdayWindow.birthdayIso && unbookedEligible.includes(birthdayWindow.birthdayIso)
              ? birthdayWindow.birthdayIso
              : unbookedEligible[0]));

      const parts = calendarParts(chosenDate);
      if (parts) {
        const singleSet = new Set([chosenDate]);
        let breakStartEpoch = parts.epoch;
        while (isNonWorkingOrBooked(isoOfEpochDay(breakStartEpoch - 1), singleSet)) {
          breakStartEpoch--;
        }
        let breakEndEpoch = parts.epoch;
        while (isNonWorkingOrBooked(isoOfEpochDay(breakEndEpoch + 1), singleSet)) {
          breakEndEpoch++;
        }
        const breakStartDate = isoOfEpochDay(breakStartEpoch);
        const breakEndDate = isoOfEpochDay(breakEndEpoch);
        const returnToWorkDate = isoOfEpochDay(breakEndEpoch + 1);
        const totalDaysOff = breakEndEpoch - breakStartEpoch + 1;
        const bhDatesInBreak: string[] = [];
        for (let ep = breakStartEpoch; ep <= breakEndEpoch; ep++) {
          const iso = isoOfEpochDay(ep);
          if (allBhSet.has(iso)) bhDatesInBreak.push(iso);
        }
        const bankHolidayNames = [...new Set(bhDatesInBreak.map(d => allBhMap[d] || 'Bank Holiday'))];

        const key = `${chosenDate}:${chosenDate}`;
        selectedKeys.add(key);
        recommendedUsesBirthday = true;
        recommendedTotalDaysOff += totalDaysOff;
        candidateMap.set(key, {
          startDate: chosenDate,
          endDate: chosenDate,
          workDays: [chosenDate],
          breakStartDate,
          breakEndDate,
          returnToWorkDate,
          totalDaysOff,
          bankHolidayNames,
          label: 'Birthday Day Off Break',
          usesBirthdayDay: true,
          birthdayDayDate: chosenDate,
          leaveDaysRequired: 0,
        });
      }
    }
  }

  // Allowance no bridge can use goes on the working days that lengthen a break
  // already in the diary -- booked leave, a recommended bridge, or a bank
  // holiday -- so a spare day extends Christmas rather than floating. One day
  // at a time, each on the day that leaves the longest break; a break that is
  // only a weekend is not extended, so what cannot fit stays spare.
  let spareAllowance = availableAllowance - recommendedLeaveDays;
  if (spareAllowance > 0) {
    const planned = new Set<string>();
    const selectedBreakDates = new Set<string>();
    for (const key of selectedKeys) {
      const cand = candidateMap.get(key);
      if (!cand) continue;
      for (const d of cand.workDays) planned.add(d);
      for (const d of calendarDays(cand.breakStartDate, cand.breakEndDate)) selectedBreakDates.add(d.iso);
    }
    const isLeaveOrHoliday = (iso: string): boolean =>
      allBhSet.has(iso) || planned.has(iso) || (bookedDatesSet.has(iso) && !sickDatesSet.has(iso));
    const blockAround = (epoch: number): { start: number; end: number } => {
      let start = epoch;
      while (isNonWorkingOrBooked(isoOfEpochDay(start - 1), planned)) start--;
      let end = epoch;
      while (isNonWorkingOrBooked(isoOfEpochDay(end + 1), planned)) end++;
      return { start, end };
    };

    const extensionDays: string[] = [];
    const scanStart = activeAsOfIso ?? `${year}-01-01`;
    while (spareAllowance > 0) {
      let best: { iso: string; length: number } | null = null;
      for (const day of calendarDays(scanStart, `${year}-12-31`)) {
        if (day.weekend || allBhSet.has(day.iso) || bookedDatesSet.has(day.iso) || planned.has(day.iso)) continue;
        const parts = calendarParts(day.iso);
        if (!parts) continue;
        planned.add(day.iso);
        const { start, end } = blockAround(parts.epoch);
        planned.delete(day.iso);
        let anchored = false;
        for (let ep = start; ep <= end && !anchored; ep++) {
          if (ep !== parts.epoch && isLeaveOrHoliday(isoOfEpochDay(ep))) anchored = true;
        }
        const length = end - start + 1;
        if (anchored && (!best || length > best.length)) best = { iso: day.iso, length };
      }
      if (!best) break;
      extensionDays.push(best.iso);
      planned.add(best.iso);
      spareAllowance--;
    }

    // Days that ended up in the same break are booked as one extension.
    const groups = new Map<number, string[]>();
    for (const iso of extensionDays) {
      const parts = calendarParts(iso);
      if (!parts) continue;
      const { start } = blockAround(parts.epoch);
      groups.set(start, [...(groups.get(start) ?? []), iso]);
    }
    for (const days of groups.values()) {
      const workDays = [...days].sort();
      const startDate = workDays[0];
      const endDate = workDays[workDays.length - 1];
      const startParts = calendarParts(startDate);
      if (!startParts) continue;
      const { start, end } = blockAround(startParts.epoch);
      const breakStartDate = isoOfEpochDay(start);
      const breakEndDate = isoOfEpochDay(end);
      const bhDatesInBreak: string[] = [];
      for (let ep = start; ep <= end; ep++) {
        const iso = isoOfEpochDay(ep);
        if (allBhSet.has(iso)) bhDatesInBreak.push(iso);
      }
      const bankHolidayNames = [...new Set(bhDatesInBreak.map(d => allBhMap[d] || 'Bank Holiday'))];
      const baseLabel = deriveBridgeLabel(startDate, breakStartDate, breakEndDate, bhDatesInBreak);
      const label =
        baseLabel === 'Holiday Bridge'
          ? `Extend Break from ${formatUkDate(breakStartDate)}`
          : `Extend ${baseLabel.replace(/ Bridge$/, ' Break')}`;
      const totalDaysOff = end - start + 1;
      // A break around a recommended bridge is already in the total; only the
      // days this adds are new. A break around booked leave counts whole.
      const overlapsSelected = [...selectedBreakDates].some(d => d >= breakStartDate && d <= breakEndDate);

      const key = `${startDate}:${endDate}`;
      selectedKeys.add(key);
      recommendedLeaveDays += workDays.length;
      recommendedTotalDaysOff += overlapsSelected ? workDays.length : totalDaysOff;
      candidateMap.set(key, {
        customId: `extend_break_${startDate}`,
        startDate,
        endDate,
        workDays,
        breakStartDate,
        breakEndDate,
        returnToWorkDate: isoOfEpochDay(end + 1),
        totalDaysOff,
        bankHolidayNames,
        label,
        tierLabel: 'Spare Allowance Extension',
        usesBirthdayDay: false,
        leaveDaysRequired: workDays.length,
      });
    }
  }

  const bridges: OptimalHolidayBridge[] = [...candidateMap.values()]
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.workDays.length - b.workDays.length)
    .map((cand, idx) => {
      const workingDaysBooked = cand.workDays.length;
      const efficiency = Math.round((cand.totalDaysOff / workingDaysBooked) * 100) / 100;
      const recommended = selectedKeys.has(`${cand.startDate}:${cand.endDate}`);
      return {
        id: cand.customId ?? `bridge-${year}-${idx}-${cand.startDate}-${cand.endDate}`,
        ...(cand.clusterId ? { clusterId: cand.clusterId } : {}),
        label: cand.label,
        startDate: cand.startDate,
        endDate: cand.endDate,
        breakStartDate: cand.breakStartDate,
        breakEndDate: cand.breakEndDate,
        datesToBook: cand.workDays,
        returnToWorkDate: cand.returnToWorkDate,
        ...(cand.tier ? { tier: cand.tier } : {}),
        ...(cand.tierLabel ? { tierLabel: cand.tierLabel } : {}),
        leaveDaysRequired: cand.leaveDaysRequired,
        workingDaysBooked,
        totalDaysOff: cand.totalDaysOff,
        efficiency,
        usesBirthdayDay: cand.usesBirthdayDay,
        ...(cand.birthdayDayDate ? { birthdayDayDate: cand.birthdayDayDate } : {}),
        bankHolidayNames: cand.bankHolidayNames,
        recommended,
      };
    });

  return {
    year,
    bias,
    bridges,
    recommendedLeaveDays,
    recommendedTotalDaysOff,
    recommendedUsesBirthday,
    remainingAllowanceAfterPlan: Math.max(0, availableAllowance - recommendedLeaveDays),
  };
}

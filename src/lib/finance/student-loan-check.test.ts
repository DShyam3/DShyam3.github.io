import { describe, expect, it } from 'vitest';
import {
  checkStudentLoanRate,
  expectedChargedRate,
  expectedStudentLoanBalanceOn,
  impliedStudentLoanRate,
  MIN_RATE_CHECK_DAYS,
  replayStudentLoanBalance,
  studentLoanReadingCheck,
  type BalanceReading,
  type StudentLoanCheckMonth,
  type StudentLoanDatedAmount,
} from './student-loan-check';

// The hand-checked fixture: a real Plan 2 loan, read at 7 Sept and 31 Oct 2026.
const FROM: BalanceReading = { date: '2026-09-07', balance: 51052.24 };
const REFUND: StudentLoanDatedAmount[] = [{ date: '2026-09-23', amount: 137 }];
const SEPT_AND_OCT: StudentLoanDatedAmount[] = [
  { date: '2026-09-30', amount: 171 },
  { date: '2026-10-31', amount: 171 },
];
const TO: BalanceReading = { date: '2026-10-31', balance: 51156.1 };

const replayFixture = (over: Partial<Parameters<typeof replayStudentLoanBalance>[0]> = {}) =>
  replayStudentLoanBalance({
    from: FROM,
    toDate: '2026-10-31',
    annualRate: 4.1,
    payments: SEPT_AND_OCT,
    adjustments: REFUND,
    ...over,
  });

describe('replayStudentLoanBalance', () => {
  it('reproduces the hand-checked fixture: 51152.33 after September, 51156.10 after October', () => {
    expect(replayFixture({ toDate: '2026-09-30', payments: [SEPT_AND_OCT[0]] })).toBe(51152.33);
    expect(replayFixture()).toBe(51156.1);
  });

  it('charges the refund interest for the rest of its own month, and the payment none', () => {
    // 51189.24 (after the refund) * 4.1%/12 * 23/30 = 134.09, before the 171 comes off.
    const withRefund = replayFixture({ toDate: '2026-09-30', payments: [] });
    const withoutRefund = replayFixture({ toDate: '2026-09-30', payments: [], adjustments: [] });
    expect(withRefund).toBe(51323.33);
    expect(withoutRefund).toBe(51052.24 + 0 + Math.round(51052.24 * (0.041 / 12) * (23 / 30) * 100) / 100);
  });

  it('prorates a partial last month by the day, and leaves out a payment dated after toDate', () => {
    // October's 15 of 31 days; the payment dated 31 Oct is outside (from, toDate].
    expect(replayFixture({ toDate: '2026-10-15' })).toBe(51236.89);
  });

  it('prorates both ends when from and to share a month', () => {
    // 51052.24 * 4.1%/12 * 20/30 = 116.29
    expect(replayFixture({ toDate: '2026-09-27', payments: [], adjustments: [] })).toBe(51168.53);
  });

  it('is the from balance, to the penny, when toDate is the from date', () => {
    expect(replayFixture({ toDate: '2026-09-07', payments: [], adjustments: [] })).toBe(51052.24);
    // Nothing dated on the reading's own day counts: the balance already reflects it.
    expect(
      replayFixture({
        toDate: '2026-09-07',
        payments: [{ date: '2026-09-07', amount: 500 }],
        adjustments: [{ date: '2026-09-07', amount: 900 }],
      }),
    ).toBe(51052.24);
  });

  it('is undefined when toDate is before the from date', () => {
    expect(replayFixture({ toDate: '2026-09-06' })).toBeUndefined();
  });

  it('is undefined for a non-finite balance or rate, or a date that is not a real day', () => {
    expect(replayFixture({ from: { date: '2026-09-07', balance: NaN } })).toBeUndefined();
    expect(replayFixture({ from: { date: '2026-09-07', balance: Infinity } })).toBeUndefined();
    expect(replayFixture({ annualRate: NaN })).toBeUndefined();
    expect(replayFixture({ annualRate: Infinity })).toBeUndefined();
    expect(replayFixture({ toDate: '2026-02-30' })).toBeUndefined();
    expect(replayFixture({ from: { date: '', balance: 100 } })).toBeUndefined();
  });

  it('skips a payment or adjustment with a non-finite amount instead of reading it as 0 or as NaN', () => {
    const noisy = replayFixture({
      payments: [...SEPT_AND_OCT, { date: '2026-10-10', amount: NaN }, { date: '2026-10-11', amount: Infinity }],
      adjustments: [...REFUND, { date: '2026-10-12', amount: NaN }],
    });
    expect(noisy).toBe(51156.1);
  });

  it('skips an entry whose date is not a real day', () => {
    const noisy = replayFixture({
      payments: [...SEPT_AND_OCT, { date: '2026-10-40', amount: 9999 }, { date: 'soon', amount: 9999 }],
    });
    expect(noisy).toBe(51156.1);
  });

  it('counts only entries dated in (from, toDate]', () => {
    const outside = replayFixture({
      payments: [...SEPT_AND_OCT, { date: '2026-09-07', amount: 500 }, { date: '2026-09-01', amount: 500 }, { date: '2026-11-01', amount: 500 }],
      adjustments: [...REFUND, { date: '2026-09-07', amount: 900 }, { date: '2026-08-31', amount: 900 }, { date: '2026-11-15', amount: 900 }],
    });
    expect(outside).toBe(51156.1);
  });

  it('a negative adjustment (a voluntary payment) lowers the balance and its interest', () => {
    // Zero rate isolates the signs: 10000 - 500 (voluntary) - 200 (payroll).
    expect(
      replayStudentLoanBalance({
        from: { date: '2026-01-01', balance: 10000 },
        toDate: '2026-01-31',
        annualRate: 0,
        payments: [{ date: '2026-01-20', amount: 200 }],
        adjustments: [{ date: '2026-01-10', amount: -500 }],
      }),
    ).toBe(9300);
  });

  it('applies adjustments before interest and payments after it, within the month', () => {
    // Same month, 12%: the 1000 draw earns interest, the 1000 payment does not.
    const draw = { date: '2026-03-10', amount: 1000 };
    const base = { from: { date: '2026-03-01', balance: 0 }, toDate: '2026-03-31', annualRate: 12, payments: [], adjustments: [] };
    // (31-1)/31 of a month at 1%/month on 1000 = 9.68
    expect(replayStudentLoanBalance({ ...base, adjustments: [draw] })).toBe(1009.68);
    expect(replayStudentLoanBalance({ ...base, payments: [draw] })).toBe(-1000);
    expect(replayStudentLoanBalance({ ...base, adjustments: [draw], payments: [draw] })).toBe(9.68);
  });

  it('charges whole months in between, and nothing for a first-month remainder of zero days', () => {
    // 31 Jan -> 30 Apr: January has no days left, then Feb, Mar and Apr in full: 5000 * 1.01^3.
    expect(
      replayStudentLoanBalance({
        from: { date: '2026-01-31', balance: 5000 },
        toDate: '2026-04-30',
        annualRate: 12,
        payments: [],
        adjustments: [],
      }),
    ).toBe(5151.51);
  });

  it('uses the right month length across a leap February', () => {
    const base = { from: { date: '2028-02-10', balance: 10000 }, toDate: '2028-03-10', annualRate: 6, payments: [], adjustments: [] };
    expect(replayStudentLoanBalance(base)).toBe(10048.94); // Feb 19/29, Mar 10/31
    expect(
      replayStudentLoanBalance({ ...base, from: { date: '2027-02-10', balance: 10000 }, toDate: '2027-03-10' }),
    ).toBe(10048.32); // Feb 18/28, Mar 10/31
  });

  it('crosses a year boundary', () => {
    expect(
      replayStudentLoanBalance({
        from: { date: '2025-12-15', balance: 20000 },
        toDate: '2026-01-20',
        annualRate: 3.2,
        payments: [
          { date: '2025-12-31', amount: 100 },
          { date: '2026-01-20', amount: 100 },
        ],
        adjustments: [{ date: '2026-01-05', amount: 50 }],
      }),
    ).toBe(19911.9);
  });

  it('is unmoved by the clocks changing: an interval over the March 2026 UK change counts calendar days', () => {
    expect(
      replayStudentLoanBalance({
        from: { date: '2026-03-20', balance: 30000 },
        toDate: '2026-04-20',
        annualRate: 4.5,
        payments: [],
        adjustments: [],
      }),
    ).toBe(30115.02); // Mar 11/31, Apr 20/30
  });

  it('gives a negative rate a balance that falls', () => {
    const down = replayFixture({ annualRate: -2, payments: [], adjustments: [] });
    expect(down).toBeLessThan(51052.24);
  });

  it('takes empty input as pure interest', () => {
    expect(replayFixture({ payments: [], adjustments: [] })).toBeGreaterThan(51052.24);
  });
});

describe('impliedStudentLoanRate', () => {
  const implied = (over: Partial<Parameters<typeof impliedStudentLoanRate>[0]> = {}) =>
    impliedStudentLoanRate({ from: FROM, to: TO, payments: SEPT_AND_OCT, adjustments: REFUND, ...over });

  it('solves the hand-checked fixture to 4.1', () => {
    const result = implied();
    expect(result?.annualRate).toBeCloseTo(4.1, 3);
  });

  it('reports the interest the two readings imply: 51156.10 - 51052.24 - 137 + 342 = 308.86', () => {
    expect(implied()?.interest).toBe(308.86);
  });

  it('solves back to the rate it was replayed at, across rates, including zero and negative', () => {
    for (const rate of [-1.5, 0, 2.5, 4.1, 6, 12.34]) {
      const balance = replayFixture({ annualRate: rate })!;
      const result = implied({ to: { date: '2026-10-31', balance } });
      expect(result?.annualRate).toBeCloseTo(rate, 3);
    }
  });

  it('returns exactly zero (never -0) for a zero-interest reading', () => {
    const result = impliedStudentLoanRate({
      from: { date: '2026-01-01', balance: 10000 },
      to: { date: '2026-03-31', balance: 9400 },
      payments: [
        { date: '2026-01-31', amount: 200 },
        { date: '2026-02-28', amount: 200 },
        { date: '2026-03-31', amount: 200 },
      ],
      adjustments: [],
    });
    expect(Object.is(result?.annualRate, 0)).toBe(true);
    expect(result?.interest).toBe(0);
  });

  it('returns a negative rate when the balance fell more than the payments explain', () => {
    // 3 x 200 would leave 9400 at 0%; the reading is 9300.
    const payments = [
      { date: '2026-01-31', amount: 200 },
      { date: '2026-02-28', amount: 200 },
      { date: '2026-03-31', amount: 200 },
    ];
    const result = impliedStudentLoanRate({
      from: { date: '2026-01-01', balance: 10000 },
      to: { date: '2026-03-31', balance: 9300 },
      payments,
      adjustments: [],
    });
    expect(result!.annualRate).toBeLessThan(0);
    expect(result!.interest).toBe(-100);
    const replayed = replayStudentLoanBalance({
      from: { date: '2026-01-01', balance: 10000 },
      toDate: '2026-03-31',
      annualRate: result!.annualRate,
      payments,
      adjustments: [],
    });
    expect(Math.abs(replayed! - 9300)).toBeLessThan(0.01);
  });

  it('works from empty input: pure interest on a single reading pair', () => {
    const to = replayStudentLoanBalance({
      from: { date: '2026-01-15', balance: 20000 },
      toDate: '2026-04-15',
      annualRate: 5.5,
      payments: [],
      adjustments: [],
    })!;
    const result = impliedStudentLoanRate({
      from: { date: '2026-01-15', balance: 20000 },
      to: { date: '2026-04-15', balance: to },
      payments: [],
      adjustments: [],
    });
    expect(result?.annualRate).toBeCloseTo(5.5, 3);
    expect(result?.interest).toBe(Math.round((to - 20000) * 100) / 100);
  });

  it('is undefined for an interval under 28 days, and defined at exactly 28', () => {
    expect(implied({ to: { date: '2026-10-04', balance: 51200 }, payments: [], adjustments: [] })).toBeUndefined(); // 27 days
    expect(implied({ to: { date: '2026-10-05', balance: 51200 }, payments: [], adjustments: [] })).toBeDefined(); // 28 days
  });

  it('is undefined when the interval is backwards or empty', () => {
    expect(implied({ to: { date: '2026-09-01', balance: 51000 } })).toBeUndefined();
    expect(implied({ to: { date: FROM.date, balance: FROM.balance } })).toBeUndefined();
  });

  it('is undefined when the from balance is not positive', () => {
    expect(implied({ from: { date: '2026-09-07', balance: 0 } })).toBeUndefined();
    expect(implied({ from: { date: '2026-09-07', balance: -100 } })).toBeUndefined();
  });

  it('is undefined when no rate in [-20, 40] reaches the reading', () => {
    expect(implied({ to: { date: '2026-10-31', balance: 1_000_000 } })).toBeUndefined();
    expect(implied({ to: { date: '2026-10-31', balance: 0 }, payments: [], adjustments: [] })).toBeUndefined();
    expect(implied({ to: { date: '2026-10-31', balance: -500 } })).toBeUndefined();
  });

  it('is undefined for non-finite readings or dates that are not real days', () => {
    expect(implied({ from: { date: '2026-09-07', balance: NaN } })).toBeUndefined();
    expect(implied({ to: { date: '2026-10-31', balance: NaN } })).toBeUndefined();
    expect(implied({ to: { date: '2026-10-31', balance: Infinity } })).toBeUndefined();
    expect(implied({ to: { date: '2026-02-30', balance: 51156.1 } })).toBeUndefined();
  });

  it('skips non-finite and out-of-range entries, in the solve and in the interest figure alike', () => {
    const result = implied({
      payments: [...SEPT_AND_OCT, { date: '2026-10-10', amount: NaN }, { date: '2026-09-07', amount: 500 }, { date: '2026-11-30', amount: 500 }],
      adjustments: [...REFUND, { date: '2026-10-01', amount: NaN }, { date: '2026-09-07', amount: 900 }],
    });
    expect(result?.annualRate).toBeCloseTo(4.1, 3);
    expect(result?.interest).toBe(308.86);
  });

  it('solves a single-payment interval', () => {
    const to = replayStudentLoanBalance({
      from: FROM,
      toDate: '2026-10-15',
      annualRate: 4.1,
      payments: [SEPT_AND_OCT[0]],
      adjustments: [],
    })!;
    const result = impliedStudentLoanRate({
      from: FROM,
      to: { date: '2026-10-15', balance: to },
      payments: [SEPT_AND_OCT[0]],
      adjustments: [],
    });
    expect(result?.annualRate).toBeCloseTo(4.1, 3);
  });
});

describe('expectedChargedRate', () => {
  const months = [
    { date: '2026-08-01', chargedRate: 3.2 },
    { date: '2026-09-01', chargedRate: 4.1 },
  ];

  it('is the rate itself inside a single month', () => {
    expect(expectedChargedRate(months, '2026-09-07', '2026-09-27')).toBe(4.1);
  });

  it('weights by day across a rate change on 1 September', () => {
    // (15, Aug 31] = 16 days at 3.2; Sept 1-15 = 15 days at 4.1.
    expect(expectedChargedRate(months, '2026-08-15', '2026-09-15')).toBeCloseTo((3.2 * 16 + 4.1 * 15) / 31, 10);
    expect(expectedChargedRate(months, '2026-08-15', '2026-09-15')).toBeCloseTo(3.6355, 4);
  });

  it('counts the day after the from date and the to date itself', () => {
    // 2026-08-31 -> 2026-09-01 is one day, all of it September.
    expect(expectedChargedRate(months, '2026-08-31', '2026-09-01')).toBe(4.1);
    // 2026-08-30 -> 2026-09-01 is two days, 31 Aug and 1 Sep.
    expect(expectedChargedRate(months, '2026-08-30', '2026-09-01')).toBeCloseTo((3.2 + 4.1) / 2, 10);
  });

  it('does not need a month with no day in the interval', () => {
    // From 31 Aug leaves no August days, so a missing August does not matter.
    expect(expectedChargedRate([{ date: '2026-09-01', chargedRate: 4.1 }], '2026-08-31', '2026-09-15')).toBe(4.1);
  });

  it('spans whole months in between, whatever order the months arrive in', () => {
    const shuffled = [
      { date: '2026-10-01', chargedRate: 5 },
      { date: '2026-08-01', chargedRate: 3.2 },
      { date: '2026-09-01', chargedRate: 4.1 },
      { date: '2027-05-01', chargedRate: 9 },
    ];
    // (Aug 20, Oct 10]: Aug 11 days, Sep 30, Oct 10 = 51 days.
    expect(expectedChargedRate(shuffled, '2026-08-20', '2026-10-10')).toBeCloseTo((3.2 * 11 + 4.1 * 30 + 5 * 10) / 51, 10);
  });

  it('crosses a year boundary', () => {
    const winter = [
      { date: '2025-12-01', chargedRate: 4 },
      { date: '2026-01-01', chargedRate: 5 },
    ];
    // (Dec 21, Jan 10]: 10 days of Dec, 10 of Jan.
    expect(expectedChargedRate(winter, '2025-12-21', '2026-01-10')).toBeCloseTo(4.5, 10);
  });

  it('is undefined when a month the interval touches is missing', () => {
    expect(expectedChargedRate([months[0]], '2026-08-15', '2026-09-15')).toBeUndefined();
    expect(expectedChargedRate([], '2026-08-15', '2026-09-15')).toBeUndefined();
  });

  it('is undefined for an empty or backwards interval, or a date that is not a real day', () => {
    expect(expectedChargedRate(months, '2026-09-15', '2026-09-15')).toBeUndefined();
    expect(expectedChargedRate(months, '2026-09-15', '2026-09-01')).toBeUndefined();
    expect(expectedChargedRate(months, '2026-09-15', '2026-02-30')).toBeUndefined();
  });

  it('treats a non-finite rate, or an unreal month row, as missing rather than 0', () => {
    expect(expectedChargedRate([months[0], { date: '2026-09-01', chargedRate: NaN }], '2026-08-15', '2026-09-15')).toBeUndefined();
    expect(expectedChargedRate([months[0], { date: 'September', chargedRate: 4.1 }], '2026-08-15', '2026-09-15')).toBeUndefined();
  });

  it('treats a month listed twice with different rates as ambiguous, but accepts an identical repeat', () => {
    expect(expectedChargedRate([...months, { date: '2026-09-01', chargedRate: 4.5 }], '2026-08-15', '2026-09-15')).toBeUndefined();
    expect(expectedChargedRate([...months, { date: '2026-09-01', chargedRate: 4.1 }], '2026-09-07', '2026-09-27')).toBe(4.1);
  });

  it('allows a zero charged rate', () => {
    expect(expectedChargedRate([{ date: '2026-09-01', chargedRate: 0 }], '2026-09-07', '2026-09-27')).toBe(0);
  });
});

describe('checkStudentLoanRate', () => {
  const check = (over: Partial<Parameters<typeof checkStudentLoanRate>[0]> = {}) =>
    checkStudentLoanRate({ from: FROM, to: TO, payments: SEPT_AND_OCT, adjustments: REFUND, expectedRate: 4.1, ...over });

  it("matches when SLC's balance is the model's", () => {
    const result = check();
    expect(result?.verdict).toBe('matches');
    expect(result?.impliedRate).toBeCloseTo(4.1, 3);
    expect(result?.expectedRate).toBe(4.1);
    expect(result?.interest).toBe(308.86);
    expect(result).not.toHaveProperty('withoutLatest');
  });

  it('is higher, and blames the October deduction, when SLC has not received it yet', () => {
    const result = check({ to: { date: '2026-10-31', balance: 51327.1 } });
    expect(result?.verdict).toBe('higher');
    expect(result!.impliedRate).toBeGreaterThan(4.35);
    expect(result?.withoutLatest?.count).toBe(1);
    expect(result?.withoutLatest?.amount).toBe(171);
    expect(result?.withoutLatest?.impliedRate).toBeCloseTo(4.1, 3);
    // The interest is what the readings imply as given, not re-derived without the payment.
    expect(result?.interest).toBe(479.86);
  });

  it('drops two payments when one is not enough', () => {
    const payments = [...SEPT_AND_OCT, { date: '2026-11-30', amount: 171 }];
    // Only the September deduction has reached SLC.
    const received = replayFixture({ toDate: '2026-11-30', payments: [payments[0]] })!;
    expect(received).toBe(51502.47);
    const result = check({ to: { date: '2026-11-30', balance: received }, payments });
    expect(result?.verdict).toBe('higher');
    expect(result?.withoutLatest?.count).toBe(2);
    expect(result?.withoutLatest?.amount).toBe(342);
    expect(result?.withoutLatest?.impliedRate).toBeCloseTo(4.1, 3);
  });

  it('reports the fewest drops that land within tolerance', () => {
    // Neither deduction has reached SLC, but with a wide tolerance dropping one already lands inside it.
    const neither = { date: '2026-10-31', balance: replayFixture({ payments: [] })! };
    const result = check({ to: neither, tolerance: 3 });
    expect(result?.verdict).toBe('higher');
    expect(result?.withoutLatest?.count).toBe(1);
    expect(result?.withoutLatest?.amount).toBe(171);
    // With the default tolerance only both drops explain it.
    const strict = check({ to: neither });
    expect(strict?.withoutLatest?.count).toBe(2);
    expect(strict?.withoutLatest?.amount).toBe(342);
    expect(strict?.withoutLatest?.impliedRate).toBeCloseTo(4.1, 3);
  });

  it('picks the latest payments by date, whatever order they are passed in', () => {
    const payments = [
      { date: '2026-10-31', amount: 180 },
      { date: '2026-09-30', amount: 171 },
    ];
    const received = replayFixture({ payments: [payments[1]] })!;
    const result = check({ to: { date: '2026-10-31', balance: received }, payments });
    expect(result?.withoutLatest?.count).toBe(1);
    expect(result?.withoutLatest?.amount).toBe(180);
  });

  it('ignores payments outside the interval when choosing the latest', () => {
    const payments = [
      { date: '2026-09-01', amount: 90 },
      ...SEPT_AND_OCT,
      { date: '2026-11-30', amount: 777 },
    ];
    const received = replayFixture({ payments: [SEPT_AND_OCT[0]] })!;
    const result = check({ to: { date: '2026-10-31', balance: received }, payments });
    expect(result?.withoutLatest?.count).toBe(1);
    expect(result?.withoutLatest?.amount).toBe(171);
  });

  it('leaves withoutLatest unset when no one or two deductions explain the gap', () => {
    const result = check({ to: { date: '2026-10-31', balance: 52156.1 } });
    expect(result?.verdict).toBe('higher');
    expect(result).not.toHaveProperty('withoutLatest');
  });

  it('leaves withoutLatest unset when there is no payment to drop', () => {
    const to = replayStudentLoanBalance({
      from: { date: '2026-01-01', balance: 10000 },
      toDate: '2026-04-01',
      annualRate: 8,
      payments: [],
      adjustments: [],
    })!;
    const result = checkStudentLoanRate({
      from: { date: '2026-01-01', balance: 10000 },
      to: { date: '2026-04-01', balance: to },
      payments: [],
      adjustments: [],
      expectedRate: 4.1,
    });
    expect(result?.verdict).toBe('higher');
    expect(result).not.toHaveProperty('withoutLatest');
  });

  it('is lower when SLC charged less than the model, and never offers withoutLatest', () => {
    const result = check({ to: { date: '2026-10-31', balance: 51000 } });
    expect(result?.verdict).toBe('lower');
    expect(result!.impliedRate).toBeLessThan(3.85);
    expect(result).not.toHaveProperty('withoutLatest');
  });

  it('honours the tolerance, defaulting to 0.25 percentage points', () => {
    const at = (rate: number) => ({ date: '2026-10-31', balance: replayFixture({ annualRate: rate })! });
    expect(check({ to: at(4.3) })?.verdict).toBe('matches'); // 0.2 out
    expect(check({ to: at(4.5) })?.verdict).toBe('higher'); // 0.4 out
    expect(check({ to: at(3.7) })?.verdict).toBe('lower');
    expect(check({ to: at(4.5), tolerance: 0.5 })?.verdict).toBe('matches');
    expect(check({ to: at(4.3), tolerance: 0.1 })?.verdict).toBe('higher');
    expect(check({ to: at(4.1), tolerance: 0.001 })?.verdict).toBe('matches');
  });

  it('is undefined when the implied rate is', () => {
    expect(check({ to: { date: '2026-09-20', balance: 51100 } })).toBeUndefined(); // under 28 days
    expect(check({ from: { date: '2026-09-07', balance: 0 } })).toBeUndefined();
    expect(check({ to: { date: '2026-10-31', balance: 1_000_000 } })).toBeUndefined();
    expect(check({ to: { date: '2026-10-31', balance: NaN } })).toBeUndefined();
  });

  it('is undefined for a non-finite expected rate, or a non-finite or negative tolerance', () => {
    expect(check({ expectedRate: NaN })).toBeUndefined();
    expect(check({ expectedRate: Infinity })).toBeUndefined();
    expect(check({ tolerance: NaN })).toBeUndefined();
    expect(check({ tolerance: -0.1 })).toBeUndefined();
  });

  it('checks a negative expected rate like any other', () => {
    expect(check({ expectedRate: -1 })?.verdict).toBe('higher');
  });
});

// The same fixture as a simulation run anchored at FROM would report it: 4.1% charged
// in September, October and November 2026, and no top-up landing.
const MONTHS: StudentLoanCheckMonth[] = [
  { date: '2026-09-01', chargedRate: 4.1, topUpApplied: 0 },
  { date: '2026-10-01', chargedRate: 4.1, topUpApplied: 0 },
  { date: '2026-11-01', chargedRate: 4.1, topUpApplied: 0 },
];
/** The same months with a 900 income-linked top-up landing on 1 October. */
const MONTHS_WITH_TOP_UP = MONTHS.map(m => (m.date === '2026-10-01' ? { ...m, topUpApplied: 900 } : m));

describe('MIN_RATE_CHECK_DAYS', () => {
  it('is 28, the distance under which no rate is solved', () => {
    expect(MIN_RATE_CHECK_DAYS).toBe(28);
    const at = (date: string) => impliedStudentLoanRate({ from: FROM, to: { date, balance: 51100 }, payments: [], adjustments: [] });
    expect(at('2026-10-04')).toBeUndefined(); // 27 days
    expect(at('2026-10-05')).toBeDefined(); // 28 days
  });
});

describe('expectedStudentLoanBalanceOn', () => {
  const expected = (over: Partial<Parameters<typeof expectedStudentLoanBalanceOn>[0]> = {}) =>
    expectedStudentLoanBalanceOn({
      from: FROM,
      toDate: '2026-10-31',
      payments: SEPT_AND_OCT,
      adjustments: REFUND,
      months: MONTHS,
      ...over,
    });

  it('reproduces the hand-checked fixture at 4.1%: 51,156.10 on 31 October', () => {
    // 51,052.24 + 137 refund, 23 of 30 days of September at 4.1%: 134.09, less 171 = 51,152.33;
    // October on that: 174.77, less 171 = 51,156.10.
    expect(expected()).toBe(51156.1);
  });

  it('adds a top-up that lands in range as a lump on the first of its month: 51,152.33 + 900 = 52,052.33, then October', () => {
    // 52,052.33 x 4.1% / 12 = 177.84; 52,052.33 + 177.84 - 171 = 52,059.17.
    expect(expected({ months: MONTHS_WITH_TOP_UP })).toBe(52059.17);
  });

  it("leaves out a top-up in the reading's own month, which the reading already holds", () => {
    const september = MONTHS.map(m => (m.date === '2026-09-01' ? { ...m, topUpApplied: 900 } : m));
    expect(expected({ months: september })).toBe(51156.1);
  });

  it('includes a top-up on the first of the month toDate falls in, and leaves out one after it', () => {
    // To 1 October: one day of October's interest, on 51,152.33 (51,157.97) or on 51,152.33 + 900 (52,058.06).
    expect(expected({ toDate: '2026-10-01', payments: [SEPT_AND_OCT[0]] })).toBe(51157.97);
    expect(expected({ toDate: '2026-10-01', payments: [SEPT_AND_OCT[0]], months: MONTHS_WITH_TOP_UP })).toBe(52058.06);
    const november = MONTHS.map(m => (m.date === '2026-11-01' ? { ...m, topUpApplied: 900 } : m));
    expect(expected({ months: november })).toBe(51156.1);
  });

  it('counts a top-up only when it is positive and finite', () => {
    for (const topUpApplied of [0, -50, NaN, Infinity]) {
      const months = MONTHS.map(m => (m.date === '2026-10-01' ? { ...m, topUpApplied } : m));
      expect(expected({ months })).toBe(51156.1);
    }
  });

  it('counts a month listed twice once if the rows agree, and is undefined if they disagree', () => {
    expect(expected({ months: [...MONTHS_WITH_TOP_UP, { date: '2026-10-01', chargedRate: 4.1, topUpApplied: 900 }] })).toBe(52059.17);
    expect(expected({ months: [...MONTHS_WITH_TOP_UP, { date: '2026-10-01', chargedRate: 4.1, topUpApplied: 450 }] })).toBeUndefined();
    // A disagreement outside the interval does not matter.
    expect(expected({ months: [...MONTHS, { date: '2026-12-01', chargedRate: 4.1, topUpApplied: 1 }, { date: '2026-12-01', chargedRate: 4.1, topUpApplied: 2 }] })).toBe(51156.1);
  });

  it('replays at the day-weighted mean of the charged rates, across a change of rate', () => {
    const changing: StudentLoanCheckMonth[] = [
      { date: '2026-09-01', chargedRate: 3.2, topUpApplied: 0 },
      { date: '2026-10-01', chargedRate: 4.1, topUpApplied: 0 },
    ];
    const mean = expectedChargedRate(changing, FROM.date, '2026-10-31')!;
    // 23 days of September at 3.2%, 31 of October at 4.1%.
    expect(mean).toBeCloseTo((3.2 * 23 + 4.1 * 31) / 54, 10);
    expect(expected({ months: changing })).toBe(
      replayStudentLoanBalance({ from: FROM, toDate: '2026-10-31', annualRate: mean, payments: SEPT_AND_OCT, adjustments: REFUND }),
    );
  });

  it('keeps the adjustments it is given alongside the top-ups: a 500 voluntary payment lowers it', () => {
    const adjustments = [...REFUND, { date: '2026-10-12', amount: -500 }];
    // 51,152.33 - 500 = 50,652.33; interest 173.06; less 171 = 50,654.39.
    expect(expected({ adjustments })).toBe(50654.39);
    expect(expected({ adjustments, months: MONTHS_WITH_TOP_UP })).toBeGreaterThan(51500);
  });

  it('does not modify what it is given', () => {
    const adjustments = [...REFUND];
    const months = MONTHS_WITH_TOP_UP.map(m => ({ ...m }));
    expected({ adjustments, months });
    expect(adjustments).toEqual(REFUND);
    expect(months).toEqual(MONTHS_WITH_TOP_UP);
  });

  it('spans a year boundary: a January top-up lands between a December and a February reading', () => {
    const winter: StudentLoanCheckMonth[] = [
      { date: '2026-12-01', chargedRate: 4.1, topUpApplied: 0 },
      { date: '2027-01-01', chargedRate: 4.1, topUpApplied: 600 },
      { date: '2027-02-01', chargedRate: 4.1, topUpApplied: 0 },
    ];
    // 50,000 + 21/31 of December's 170.83 = 115.73; +600; January's 173.28; 10/28 of February's 173.87 = 62.10.
    expect(
      expectedStudentLoanBalanceOn({
        from: { date: '2026-12-10', balance: 50000 },
        toDate: '2027-02-10',
        payments: [],
        adjustments: [],
        months: winter,
      }),
    ).toBe(50951.1);
  });

  it('is undefined when the model has no rate for part of the interval', () => {
    expect(expected({ months: MONTHS.slice(0, 1) })).toBeUndefined(); // no October
    expect(expected({ months: [] })).toBeUndefined();
    expect(expected({ months: [MONTHS[0], { date: '2026-10-01', chargedRate: NaN, topUpApplied: 0 }] })).toBeUndefined();
  });

  it('is undefined for an empty or backwards interval, or a date that is not a real day', () => {
    expect(expected({ toDate: '2026-09-07' })).toBeUndefined();
    expect(expected({ toDate: '2026-09-01' })).toBeUndefined();
    expect(expected({ toDate: '2026-02-30' })).toBeUndefined();
    expect(expected({ from: { date: 'soon', balance: 51052.24 } })).toBeUndefined();
  });

  it('is undefined for a balance that is not finite', () => {
    expect(expected({ from: { date: '2026-09-07', balance: NaN } })).toBeUndefined();
  });
});

describe('studentLoanReadingCheck', () => {
  const reading = (over: Partial<Parameters<typeof studentLoanReadingCheck>[0]> = {}) =>
    studentLoanReadingCheck({
      from: FROM,
      to: TO,
      payments: SEPT_AND_OCT,
      adjustments: REFUND,
      months: MONTHS,
      ...over,
    });
  const to = (balance: number, date = '2026-10-31'): BalanceReading => ({ date, balance });

  describe('checked', () => {
    it("matches when SLC's balance is the model's: 51,156.10 against 51,156.10", () => {
      const result = reading();
      expect(result).toMatchObject({
        status: 'checked',
        verdict: 'matches',
        expectedRate: 4.1,
        interest: 308.86,
        expectedBalance: 51156.1,
        gap: 0,
        topUpAssumed: 0,
      });
      expect(result.status === 'checked' && result.impliedRate).toBeCloseTo(4.1, 3);
      expect(result).not.toHaveProperty('withoutLatest');
      expect(result).not.toHaveProperty('withoutTopUp');
    });

    it('is higher by the 171 SLC has not received: the October deduction', () => {
      // SLC still shows October's balance before the 31 October deduction came off: 51,156.10 + 171.
      const result = reading({ to: to(51327.1) });
      expect(result).toMatchObject({
        status: 'checked',
        verdict: 'higher',
        expectedRate: 4.1,
        interest: 479.86,
        expectedBalance: 51156.1,
        gap: 171,
        topUpAssumed: 0,
        withoutLatest: { count: 1, amount: 171 },
      });
      if (result.status !== 'checked') throw new Error('expected a checked result');
      expect(result.impliedRate).toBeGreaterThan(6.3);
      expect(result.withoutLatest!.impliedRate).toBeCloseTo(4.1, 3);
      expect(result).not.toHaveProperty('withoutTopUp');
    });

    it('is lower with a negative gap when SLC shows less than the model: 51,000 against 51,156.10', () => {
      const result = reading({ to: to(51000) });
      expect(result).toMatchObject({ status: 'checked', verdict: 'lower', expectedBalance: 51156.1, gap: -156.1, topUpAssumed: 0 });
      expect(result).not.toHaveProperty('withoutLatest');
      expect(result).not.toHaveProperty('withoutTopUp');
    });

    it('rounds the gap to the penny and never reports -0', () => {
      expect(reading({ to: to(51156.1004) })).toMatchObject({ status: 'checked', gap: 0 });
      const zero = reading({ to: to(51156.1004) });
      expect(Object.is(zero.status === 'checked' ? zero.gap : NaN, 0)).toBe(true);
      expect(reading({ to: to(51156.1049) })).toMatchObject({ gap: 0 });
      expect(reading({ to: to(51156.1051) })).toMatchObject({ gap: 0.01 });
    });

    it('honours the tolerance, defaulting to 0.25 percentage points', () => {
      const atRate = (rate: number) => to(replayStudentLoanBalance({ from: FROM, toDate: '2026-10-31', annualRate: rate, payments: SEPT_AND_OCT, adjustments: REFUND })!);
      expect(reading({ to: atRate(4.3) })).toMatchObject({ verdict: 'matches' });
      expect(reading({ to: atRate(4.5) })).toMatchObject({ verdict: 'higher' });
      expect(reading({ to: atRate(4.5), tolerance: 0.5 })).toMatchObject({ verdict: 'matches' });
      expect(reading({ to: atRate(4.3), tolerance: 0 })).toMatchObject({ verdict: 'higher' });
    });

    it('accepts readings that share a month, once they are 28 days apart', () => {
      // 1 Oct to 29 Oct is 28 days, all in October at 4.1%.
      const result = reading({
        from: { date: '2026-10-01', balance: 50000 },
        to: to(replayStudentLoanBalance({ from: { date: '2026-10-01', balance: 50000 }, toDate: '2026-10-29', annualRate: 4.1, payments: [], adjustments: [] })!, '2026-10-29'),
        payments: [],
        adjustments: [],
      });
      expect(result).toMatchObject({ status: 'checked', verdict: 'matches', expectedRate: 4.1, gap: 0 });
    });

    it('passes the given adjustments through: a refund the model was not told about reads as a gap', () => {
      const result = reading({ adjustments: [] });
      expect(result).toMatchObject({ status: 'checked', verdict: 'higher' });
      // Without the 137 refund the model expects 137 plus its interest (4.1% for 54 days) less.
      if (result.status !== 'checked') throw new Error('expected a checked result');
      expect(result.gap).toBeGreaterThan(137);
      expect(result.gap).toBeLessThan(140);
    });
  });

  describe('with a top-up the model landed', () => {
    it('counts it as an adjustment: a reading that includes the 900 matches', () => {
      // 51,152.33 + 900 = 52,052.33; October's 177.84; less 171 = 52,059.17.
      const result = reading({ to: to(52059.17), months: MONTHS_WITH_TOP_UP });
      expect(result).toMatchObject({
        status: 'checked',
        verdict: 'matches',
        expectedBalance: 52059.17,
        gap: 0,
        topUpAssumed: 900,
        interest: 311.93,
      });
      // Matching, so there is nothing for "SLC has not added it" to explain.
      expect(result).not.toHaveProperty('withoutTopUp');
    });

    it('names the top-up when the reading leaves it out and the rate then matches: lower by 903.07', () => {
      // SLC still shows 51,156.10, the balance without the top-up.
      const result = reading({ to: to(51156.1), months: MONTHS_WITH_TOP_UP });
      expect(result).toMatchObject({
        status: 'checked',
        verdict: 'lower',
        expectedBalance: 52059.17,
        gap: -903.07,
        topUpAssumed: 900,
        interest: -591.14,
      });
      if (result.status !== 'checked') throw new Error('expected a checked result');
      expect(result.impliedRate).toBeLessThan(0);
      expect(result.withoutTopUp).toBeDefined();
      expect(result.withoutTopUp!.impliedRate).toBeCloseTo(4.1, 3);
    });

    it('leaves withoutTopUp unset when the rate is still out without the top-up', () => {
      // 500 more than the top-up-free balance: 51,656.10. Without the 900 the implied rate is far above 4.1.
      const result = reading({ to: to(51656.1), months: MONTHS_WITH_TOP_UP });
      expect(result).toMatchObject({ status: 'checked', verdict: 'lower', topUpAssumed: 900 });
      expect(result).not.toHaveProperty('withoutTopUp');
    });

    it('can name a late payslip deduction with the top-up counted: 52,230.17 is 171 above', () => {
      const result = reading({ to: to(52230.17), months: MONTHS_WITH_TOP_UP });
      expect(result).toMatchObject({
        status: 'checked',
        verdict: 'higher',
        gap: 171,
        topUpAssumed: 900,
        withoutLatest: { count: 1, amount: 171 },
      });
      expect(result).not.toHaveProperty('withoutTopUp');
    });

    it('reports topUpAssumed as the sum of every top-up in the interval, to the penny', () => {
      const two = MONTHS.map(m => {
        if (m.date === '2026-09-01') return { ...m, topUpApplied: 123.456 }; // the reading's own month: not counted
        if (m.date === '2026-10-01') return { ...m, topUpApplied: 100.004 };
        return m;
      }).concat({ date: '2026-12-01', chargedRate: 4.1, topUpApplied: 77 }); // after the reading: not counted
      expect(reading({ months: two })).toMatchObject({ status: 'checked', topUpAssumed: 100 });
    });

    it('widening the tolerance can make the verdict match without a withoutTopUp', () => {
      const result = reading({ to: to(51156.1), months: MONTHS_WITH_TOP_UP, tolerance: 12 });
      expect(result).toMatchObject({ status: 'checked', verdict: 'matches', topUpAssumed: 900 });
      expect(result).not.toHaveProperty('withoutTopUp');
    });
  });

  describe('invalid', () => {
    const invalid = { status: 'invalid' };

    it('for a date that is not a real day', () => {
      expect(reading({ from: { date: '2026-13-40', balance: 51052.24 } })).toEqual(invalid);
      expect(reading({ to: to(51156.1, '2026-02-30') })).toEqual(invalid);
      expect(reading({ to: to(51156.1, '') })).toEqual(invalid);
      expect(reading({ from: { date: 'soon', balance: 51052.24 } })).toEqual(invalid);
    });

    it('for a balance that is not finite', () => {
      expect(reading({ from: { date: '2026-09-07', balance: NaN } })).toEqual(invalid);
      expect(reading({ to: to(Infinity) })).toEqual(invalid);
      expect(reading({ to: to(NaN) })).toEqual(invalid);
    });

    it('when the second reading is not after the first', () => {
      expect(reading({ to: to(51052.24, '2026-09-07') })).toEqual(invalid);
      expect(reading({ to: to(51000, '2026-09-01') })).toEqual(invalid);
    });

    it('for a tolerance that is not finite or is negative, but not for 0', () => {
      expect(reading({ tolerance: NaN })).toEqual(invalid);
      expect(reading({ tolerance: -0.1 })).toEqual(invalid);
      expect(reading({ tolerance: Infinity })).toEqual(invalid);
      expect(reading({ tolerance: 0 }).status).toBe('checked');
    });

    it('before any too_close, no_model or unsolvable', () => {
      expect(reading({ to: to(NaN, '2026-09-08'), months: [] })).toEqual(invalid);
    });
  });

  describe('too_close', () => {
    it('reports the days when the readings are under 28 apart: 27 days from 7 September to 4 October', () => {
      expect(reading({ to: to(51100, '2026-10-04') })).toEqual({ status: 'too_close', days: 27 });
    });

    it('is the next day', () => {
      expect(reading({ to: to(51100, '2026-09-08') })).toEqual({ status: 'too_close', days: 1 });
    });

    it('is checked from exactly 28 days: 7 September to 5 October', () => {
      expect(reading({ to: to(51100, '2026-10-05') }).status).toBe('checked');
    });

    it('does not consult the model, so it is too close even with no months', () => {
      expect(reading({ to: to(51100, '2026-09-20'), months: [] })).toEqual({ status: 'too_close', days: 13 });
    });

    it('counts days across a month and year boundary: 10 December to 6 January is 27', () => {
      expect(
        reading({ from: { date: '2026-12-10', balance: 50000 }, to: to(50100, '2027-01-06'), payments: [], adjustments: [], months: [] }),
      ).toEqual({ status: 'too_close', days: 27 });
    });
  });

  describe('no_model', () => {
    it('when a month of the interval has no charged rate', () => {
      expect(reading({ months: MONTHS.slice(0, 1) })).toEqual({ status: 'no_model' });
      expect(reading({ months: [] })).toEqual({ status: 'no_model' });
    });

    it('when a rate is not finite, or two rows for a month disagree', () => {
      expect(reading({ months: [MONTHS[0], { date: '2026-10-01', chargedRate: NaN, topUpApplied: 0 }] })).toEqual({ status: 'no_model' });
      expect(reading({ months: [...MONTHS, { date: '2026-10-01', chargedRate: 4.5, topUpApplied: 0 }] })).toEqual({ status: 'no_model' });
    });

    it('when a month in range has two different top-up amounts', () => {
      expect(reading({ months: [...MONTHS_WITH_TOP_UP, { date: '2026-10-01', chargedRate: 4.1, topUpApplied: 1 }] })).toEqual({ status: 'no_model' });
    });
  });

  describe('unsolvable', () => {
    it('when no rate in the bracket reaches the second reading', () => {
      expect(reading({ to: to(1_000_000) })).toEqual({ status: 'unsolvable' });
      expect(reading({ to: to(-1_000_000) })).toEqual({ status: 'unsolvable' });
    });

    it('when the balance fell further than any rate down to -20% explains', () => {
      expect(reading({ to: to(50000), months: MONTHS_WITH_TOP_UP })).toEqual({ status: 'unsolvable' });
    });

    it('when the first balance is not positive', () => {
      expect(reading({ from: { date: '2026-09-07', balance: 0 }, to: to(100), payments: [], adjustments: [] })).toEqual({ status: 'unsolvable' });
      expect(reading({ from: { date: '2026-09-07', balance: -5 }, to: to(100), payments: [], adjustments: [] })).toEqual({ status: 'unsolvable' });
    });
  });

  it('does not modify what it is given', () => {
    const payments = [...SEPT_AND_OCT];
    const adjustments = [...REFUND];
    const months = MONTHS_WITH_TOP_UP.map(m => ({ ...m }));
    reading({ to: to(51156.1), payments, adjustments, months });
    expect(payments).toEqual(SEPT_AND_OCT);
    expect(adjustments).toEqual(REFUND);
    expect(months).toEqual(MONTHS_WITH_TOP_UP);
  });
});

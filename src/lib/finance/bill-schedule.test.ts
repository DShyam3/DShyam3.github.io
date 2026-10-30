import { describe, expect, it } from 'vitest';
import type { RecurringBill } from '@/features/finance/finance-types';
import { billOccurrences, occurrenceTotals, scheduleBills, type BillOccurrence } from './bill-schedule';
import { epochDay, isoOfEpochDay } from './dates';

const bill = (overrides: Partial<RecurringBill> = {}): RecurringBill => ({
  id: 'bill', name: 'Example Plus', amount: 9.99, dueDate: 12, isPaid: false, frequency: 'monthly', ...overrides,
});
const evidenceOf = (...entries: [string, string][]): ReadonlyMap<string, string> => new Map(entries);
const statuses = (bills: RecurringBill[], from: string, to: string, today: string, evidence?: ReadonlyMap<string, string>) =>
  scheduleBills(bills, from, to, today, evidence).occurrences.map(({ date, status }) => `${date} ${status}`);

describe('billOccurrences', () => {
  it('clamps a monthly 31st to the month length through 30-day months and leap and non-leap February', () => {
    const due31 = bill({ dueDate: 31 });
    expect(billOccurrences(due31, '2026-01-01', '2026-05-31'))
      .toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
    expect(billOccurrences(due31, '2028-02-01', '2028-03-01')).toEqual(['2028-02-29']);
    expect(billOccurrences(due31, '2100-02-01', '2100-03-01')).toEqual(['2100-02-28']);
  });
  it('includes both ends of the range and leaves out the period due that falls before `from`', () => {
    const due5 = bill({ dueDate: 5 });
    expect(billOccurrences(due5, '2026-03-05', '2026-05-05')).toEqual(['2026-03-05', '2026-04-05', '2026-05-05']);
    expect(billOccurrences(due5, '2026-03-06', '2026-05-04')).toEqual(['2026-04-05']);
    expect(billOccurrences(due5, '2026-03-06', '2026-04-04')).toEqual([]);
  });
  it('returns a single date for a single-day range that is a due date, and none for the days either side', () => {
    expect(billOccurrences(bill(), '2026-10-12', '2026-10-12')).toEqual(['2026-10-12']);
    expect(billOccurrences(bill(), '2026-10-11', '2026-10-11')).toEqual([]);
    expect(billOccurrences(bill(), '2026-10-13', '2026-10-13')).toEqual([]);
  });
  it('crosses the year boundary and the UK tax-year boundary in order', () => {
    expect(billOccurrences(bill({ dueDate: 15 }), '2026-11-01', '2027-02-28'))
      .toEqual(['2026-11-15', '2026-12-15', '2027-01-15', '2027-02-15']);
    expect(billOccurrences(bill({ dueDate: 5 }), '2026-04-04', '2026-04-07')).toEqual(['2026-04-05']);
    expect(billOccurrences(bill({ dueDate: 6 }), '2026-04-04', '2026-04-07')).toEqual(['2026-04-06']);
  });
  it('anchors quarterly bills on dueMonth across the year boundary', () => {
    const quarterly = bill({ frequency: 'quarterly', dueMonth: 11, dueDate: 3 });
    expect(billOccurrences(quarterly, '2025-10-01', '2026-12-31'))
      .toEqual(['2025-11-03', '2026-02-03', '2026-05-03', '2026-08-03', '2026-11-03']);
    expect(billOccurrences(quarterly, '2026-01-20', '2026-02-02')).toEqual([]);
  });
  it('places annual bills once a year, clamping a 29 February due date outside leap years', () => {
    const annual = bill({ frequency: 'annually', dueMonth: 2, dueDate: 29 });
    expect(billOccurrences(annual, '2026-01-01', '2029-12-31'))
      .toEqual(['2026-02-28', '2027-02-28', '2028-02-29', '2029-02-28']);
    expect(billOccurrences(annual, '2026-03-01', '2027-02-27')).toEqual([]);
    expect(billOccurrences(bill({ frequency: 'annually', dueDate: 15 }), '2026-01-01', '2026-12-31')).toEqual(['2026-01-15']);
  });
  it('repeats a weekly bill every seven days from lastPaidDate, backwards as well as forwards', () => {
    const weekly = bill({ frequency: 'weekly', lastPaidDate: '2026-03-29' });
    expect(billOccurrences(weekly, '2026-03-02', '2026-03-31')).toEqual(['2026-03-08', '2026-03-15', '2026-03-22', '2026-03-29']);
    expect(billOccurrences(weekly, '2026-03-29', '2026-03-29')).toEqual(['2026-03-29']);
    expect(billOccurrences(weekly, '2026-03-30', '2026-04-12')).toEqual(['2026-04-05', '2026-04-12']);
    // The clocks went forward on the anchor date itself; the dates stay seven calendar days apart.
    expect(billOccurrences(weekly, '2026-03-20', '2026-04-05')).toEqual(['2026-03-22', '2026-03-29', '2026-04-05']);
  });
  it('places no weekly dates without a valid lastPaidDate', () => {
    expect(billOccurrences(bill({ frequency: 'weekly' }), '2026-03-01', '2026-03-31')).toEqual([]);
    expect(billOccurrences(bill({ frequency: 'weekly', lastPaidDate: '2026-02-30' }), '2026-03-01', '2026-03-31')).toEqual([]);
  });
  it('returns nothing for a reversed range, invalid dates and schedule fields that cannot place a date', () => {
    expect(billOccurrences(bill(), '2026-11-01', '2026-10-01')).toEqual([]);
    for (const bad of ['', 'bad', '2026-02-30', '2026-10-12T00:00:00Z']) {
      expect(billOccurrences(bill(), bad, '2026-12-31')).toEqual([]);
      expect(billOccurrences(bill(), '2026-01-01', bad)).toEqual([]);
    }
    for (const dueDate of [0, 32, 1.5, NaN]) expect(billOccurrences(bill({ dueDate }), '2026-01-01', '2026-12-31')).toEqual([]);
    for (const dueMonth of [0, 13, NaN]) {
      expect(billOccurrences(bill({ frequency: 'quarterly', dueMonth }), '2026-01-01', '2026-12-31')).toEqual([]);
    }
  });
  it('stays ascending and finite when the range runs to the last supported year', () => {
    const dates = billOccurrences(bill({ dueDate: 15 }), '9999-10-01', '9999-12-31');
    expect(dates).toEqual(['9999-10-15', '9999-11-15', '9999-12-15']);
  });
});

describe('scheduleBills', () => {
  it('returns nothing for no bills, and one entry for a single bill', () => {
    expect(scheduleBills([], '2026-10-01', '2026-12-31', '2026-10-09')).toEqual({ occurrences: [], unplaced: [] });
    const one = scheduleBills([bill()], '2026-10-01', '2026-10-31', '2026-10-09');
    expect(one.occurrences).toEqual([
      { billId: 'bill', name: 'Example Plus', amount: 9.99, date: '2026-10-12', status: 'due' },
    ]);
    expect(one.unplaced).toEqual([]);
  });
  it('returns nothing for invalid or reversed dates', () => {
    const empty = { occurrences: [], unplaced: [] };
    expect(scheduleBills([bill()], '2026-12-31', '2026-10-01', '2026-10-09')).toEqual(empty);
    expect(scheduleBills([bill()], 'bad', '2026-12-31', '2026-10-09')).toEqual(empty);
    expect(scheduleBills([bill()], '2026-10-01', '2026-12-31', '2026-02-30')).toEqual(empty);
    expect(scheduleBills([bill({ frequency: 'weekly' })], '2026-10-01', 'bad', '2026-10-09')).toEqual(empty);
  });
  it('carries the bill fields through, keeps the stored amount and sign, and omits fields the bill lacks', () => {
    const full = bill({ amount: -20, linkedAccountId: 'card', emoji: 'x', provider: 'Acme', category: 'Subscriptions' });
    const [occurrence] = scheduleBills([full], '2026-10-01', '2026-10-31', '2026-10-09').occurrences;
    expect(occurrence).toStrictEqual({
      billId: 'bill', name: 'Example Plus', amount: -20, date: '2026-10-12', status: 'due',
      linkedAccountId: 'card', emoji: 'x', provider: 'Acme', category: 'Subscriptions',
    });
    expect(Object.keys(scheduleBills([bill()], '2026-10-01', '2026-10-31', '2026-10-09').occurrences[0]).sort())
      .toEqual(['amount', 'billId', 'date', 'name', 'status']);
  });
  it('sorts by date, then name, then bill id, whatever order the bills arrive in', () => {
    const bills = [
      bill({ id: 'z', name: 'Beta', dueDate: 12 }), bill({ id: 'b', name: 'Alpha', dueDate: 12 }),
      bill({ id: 'a', name: 'Alpha', dueDate: 12 }), bill({ id: 'c', name: 'Gamma', dueDate: 3 }),
    ];
    const order = (list: RecurringBill[]) => scheduleBills(list, '2026-10-01', '2026-10-31', '2026-10-09')
      .occurrences.map(({ date, billId }) => `${date} ${billId}`);
    expect(order(bills)).toEqual(['2026-10-03 c', '2026-10-12 a', '2026-10-12 b', '2026-10-12 z']);
    expect(order([...bills].reverse())).toEqual(order(bills));
  });
  it('ignores inactive and dismissed bills entirely, including as unplaced', () => {
    const bills = [
      bill({ id: 'off', status: 'inactive' }), bill({ id: 'gone', status: 'dismissed', frequency: 'weekly' }),
      bill({ id: 'on', status: 'active' }),
    ];
    const result = scheduleBills(bills, '2026-10-01', '2026-10-31', '2026-10-09');
    expect(result.occurrences.map(o => o.billId)).toEqual(['on']);
    expect(result.unplaced).toEqual([]);
  });
  it('reports a bill that cannot be placed once, not once per period', () => {
    const noAnchor = bill({ id: 'weekly', frequency: 'weekly' });
    const badDay = bill({ id: 'bad', dueDate: 0 });
    const badMonth = bill({ id: 'quarter', frequency: 'quarterly', dueMonth: 13 });
    const result = scheduleBills([noAnchor, bill({ id: 'ok' }), badDay, badMonth], '2025-01-01', '2026-12-31', '2026-10-09');
    expect(result.unplaced).toEqual([noAnchor, badDay, badMonth]);
    expect(new Set(result.occurrences.map(o => o.billId))).toEqual(new Set(['ok']));
    expect(result.occurrences).toHaveLength(24);
  });

  describe('paid', () => {
    it('marks every date up to the confirmed coverage paid, and the next one due', () => {
      const confirmed = bill({ dueDate: 3, lastPaidDate: '2026-09-03', paidForDueDate: '2026-09-03' });
      expect(statuses([confirmed], '2026-08-01', '2026-11-30', '2026-10-09'))
        .toEqual(['2026-08-03 paid', '2026-09-03 paid', '2026-10-03 overdue', '2026-11-03 due']);
    });
    it('treats a payment made early for the next period as paying that period', () => {
      const early = bill({ dueDate: 3, lastPaidDate: '2026-09-28', paidForDueDate: '2026-10-03' });
      expect(statuses([early], '2026-09-01', '2026-11-30', '2026-10-09'))
        .toEqual(['2026-09-03 paid', '2026-10-03 paid', '2026-11-03 due']);
    });
    it('gives a row without paidForDueDate no early credit', () => {
      const legacy = bill({ dueDate: 3, lastPaidDate: '2026-09-28' });
      expect(statuses([legacy], '2026-09-01', '2026-11-30', '2026-10-09'))
        .toEqual(['2026-09-03 paid', '2026-10-03 overdue', '2026-11-03 due']);
    });
    it('counts a weekly bill paid up to and including lastPaidDate', () => {
      const weekly = bill({ frequency: 'weekly', lastPaidDate: '2026-10-02' });
      expect(statuses([weekly], '2026-09-18', '2026-10-23', '2026-10-09'))
        .toEqual(['2026-09-18 paid', '2026-09-25 paid', '2026-10-02 paid', '2026-10-09 due', '2026-10-16 due', '2026-10-23 due']);
    });
  });

  describe('overdue and due', () => {
    it('calls a date overdue when it is before today and due from today onwards', () => {
      const dates = (today: string) => statuses([bill({ dueDate: 12 })], '2026-10-11', '2026-10-13', today);
      expect(dates('2026-10-11')).toEqual(['2026-10-12 due']);
      expect(dates('2026-10-12')).toEqual(['2026-10-12 due']);
      expect(dates('2026-10-13')).toEqual(['2026-10-12 overdue']);
    });
    it('uses calendar days across the clocks changing', () => {
      const weekly = bill({ frequency: 'weekly', lastPaidDate: '2026-03-22' });
      expect(statuses([weekly], '2026-03-29', '2026-03-29', '2026-03-29')).toEqual(['2026-03-29 due']);
      expect(statuses([weekly], '2026-03-29', '2026-03-29', '2026-03-30')).toEqual(['2026-03-29 overdue']);
      // The clocks went back on 25 Oct; the date is still the day after the 24th.
      expect(statuses([weekly], '2026-10-25', '2026-10-25', '2026-10-24')).toEqual(['2026-10-25 due']);
      expect(statuses([weekly], '2026-10-25', '2026-10-25', '2026-10-26')).toEqual(['2026-10-25 overdue']);
    });
  });

  describe('seen', () => {
    // Due on the 12th, last confirmed paid for September, so October is the first unpaid date.
    const monthly = bill({ dueDate: 12, lastPaidDate: '2026-09-10' });
    const window = (evidence?: ReadonlyMap<string, string>) =>
      statuses([monthly], '2026-10-01', '2026-11-30', '2026-10-09', evidence);

    it('shows October due and November due with no bank evidence', () => {
      expect(window()).toEqual(['2026-10-12 due', '2026-11-12 due']);
    });
    it('settles the occurrence a payment three days early was for, and not the one after', () => {
      expect(window(evidenceOf(['bill', '2026-10-09']))).toEqual(['2026-10-12 seen', '2026-11-12 due']);
    });
    it('settles at exactly seven days early, but nothing at eight', () => {
      expect(window(evidenceOf(['bill', '2026-10-05']))).toEqual(['2026-10-12 seen', '2026-11-12 due']);
      expect(window(evidenceOf(['bill', '2026-10-04']))).toEqual(['2026-10-12 due', '2026-11-12 due']);
    });
    it('ignores a payment dated after today', () => {
      expect(window(evidenceOf(['bill', '2026-10-10']))).toEqual(['2026-10-12 due', '2026-11-12 due']);
    });
    it('ignores evidence for another bill, an invalid date and an empty map', () => {
      expect(window(evidenceOf(['other', '2026-10-09']))).toEqual(['2026-10-12 due', '2026-11-12 due']);
      expect(window(evidenceOf(['bill', '2026-02-30']))).toEqual(['2026-10-12 due', '2026-11-12 due']);
      expect(window(new Map())).toEqual(['2026-10-12 due', '2026-11-12 due']);
    });
    it('settles one date only: a second date inside the window stays due', () => {
      const weekly = bill({ id: 'w', frequency: 'weekly', lastPaidDate: '2026-10-02' });
      expect(statuses([weekly], '2026-10-09', '2026-10-30', '2026-10-09', evidenceOf(['w', '2026-10-09'])))
        .toEqual(['2026-10-09 seen', '2026-10-16 due', '2026-10-23 due', '2026-10-30 due']);
    });
    it('settles the overdue date a late payment was for, not the next one', () => {
      const missed = bill({ dueDate: 3, lastPaidDate: '2026-08-03' });
      // Paid on the 6th for the 3rd; September was never confirmed, so it is the earliest unpaid date in view.
      expect(statuses([missed], '2026-09-25', '2026-11-30', '2026-10-09', evidenceOf(['bill', '2026-10-06'])))
        .toEqual(['2026-10-03 seen', '2026-11-03 due']);
      // Looking only from today, the payment still does not reach into November.
      expect(statuses([missed], '2026-10-09', '2026-11-30', '2026-10-09', evidenceOf(['bill', '2026-10-06'])))
        .toEqual(['2026-11-03 due']);
    });
    it('looks back before `from` to find the date a payment settles', () => {
      // Confirmed 2 Oct; the 9 Oct date was paid on the 9th. From the 10th, only the 16th onwards is in view,
      // and the payment must settle the 9th, not the 16th that is seven days after it.
      const weekly = bill({ id: 'w', frequency: 'weekly', lastPaidDate: '2026-10-02' });
      expect(statuses([weekly], '2026-10-10', '2026-10-23', '2026-10-10', evidenceOf(['w', '2026-10-09'])))
        .toEqual(['2026-10-16 due', '2026-10-23 due']);
    });
    it('does not count the payment the owner confirmed as a second payment', () => {
      // A weekly bill confirmed on the 2nd, with that same bank payment as evidence.
      const weekly = bill({ id: 'w', frequency: 'weekly', lastPaidDate: '2026-10-02' });
      expect(statuses([weekly], '2026-10-02', '2026-10-16', '2026-10-10', evidenceOf(['w', '2026-10-02'])))
        .toEqual(['2026-10-02 paid', '2026-10-09 overdue', '2026-10-16 due']);
      // A late September payment, confirmed for September, does not also settle October.
      const late = bill({ dueDate: 3, lastPaidDate: '2026-09-28', paidForDueDate: '2026-09-03' });
      expect(statuses([late], '2026-09-01', '2026-11-30', '2026-10-01', evidenceOf(['bill', '2026-09-28'])))
        .toEqual(['2026-09-03 paid', '2026-10-03 due', '2026-11-03 due']);
    });
    it('does not settle a date the owner has already confirmed paid', () => {
      const paid = bill({ dueDate: 12, lastPaidDate: '2026-10-08', paidForDueDate: '2026-10-12' });
      expect(statuses([paid], '2026-10-01', '2026-11-30', '2026-10-09', evidenceOf(['bill', '2026-10-09'])))
        .toEqual(['2026-10-12 paid', '2026-11-12 due']);
    });
    it('settles the first date of a bill never confirmed paid, from a payment seven days early', () => {
      const never = bill({ dueDate: 12 });
      expect(statuses([never], '2026-10-01', '2026-11-30', '2026-10-09', evidenceOf(['bill', '2026-10-06'])))
        .toEqual(['2026-10-12 seen', '2026-11-12 due']);
    });
    it('settles through the year boundary for a January date paid in December', () => {
      const january = bill({ dueDate: 3, lastPaidDate: '2026-12-03' });
      expect(statuses([january], '2026-12-20', '2027-02-28', '2026-12-30', evidenceOf(['bill', '2026-12-30'])))
        .toEqual(['2027-01-03 seen', '2027-02-03 due']);
    });
    it('settles quarterly and annual dates by the same rule', () => {
      const quarterly = bill({ id: 'q', frequency: 'quarterly', dueMonth: 11, dueDate: 3, lastPaidDate: '2026-08-03' });
      expect(statuses([quarterly], '2026-10-01', '2027-02-28', '2026-11-01', evidenceOf(['q', '2026-10-31'])))
        .toEqual(['2026-11-03 seen', '2027-02-03 due']);
      const annual = bill({ id: 'a', frequency: 'annually', dueMonth: 3, dueDate: 10, lastPaidDate: '2025-03-10' });
      expect(statuses([annual], '2026-01-01', '2027-12-31', '2026-03-05', evidenceOf(['a', '2026-03-05'])))
        .toEqual(['2026-03-10 seen', '2027-03-10 due']);
    });
    it('does not let a very old payment settle a date inside the window', () => {
      const never = bill({ dueDate: 12 });
      expect(statuses([never], '2026-10-01', '2026-11-30', '2026-10-09', evidenceOf(['bill', '2025-01-05'])))
        .toEqual(['2026-10-12 due', '2026-11-12 due']);
    });
  });

  it('does not change the bills or the evidence it is given', () => {
    const bills = [bill({ lastPaidDate: '2026-09-10' })];
    const evidence = evidenceOf(['bill', '2026-10-09']);
    const before = JSON.stringify(bills);
    scheduleBills(bills, '2026-10-01', '2026-11-30', '2026-10-09', evidence);
    expect(JSON.stringify(bills)).toBe(before);
    expect([...evidence]).toEqual([['bill', '2026-10-09']]);
  });
});

describe('scheduleBills: the date a payment settles does not depend on the range', () => {
  // Rent of 800 due on the 1st, ticked for August only, debited on 1 October, today 1 October.
  const rent = bill({ id: 'rent', name: 'Rent', amount: 800, dueDate: 1, lastPaidDate: '2026-08-01', paidForDueDate: '2026-08-01' });
  const debit = evidenceOf(['rent', '2026-10-01']);

  it('settles 1 October for both a look-back of 31 days and a range that starts on the 1st', () => {
    expect(statuses([rent], '2026-08-31', '2026-12-31', '2026-10-01', debit))
      .toEqual(['2026-09-01 overdue', '2026-10-01 seen', '2026-11-01 due', '2026-12-01 due']);
    expect(statuses([rent], '2026-10-01', '2026-12-31', '2026-10-01', debit))
      .toEqual(['2026-10-01 seen', '2026-11-01 due', '2026-12-01 due']);
  });

  const scenarios: { name: string; bills: RecurringBill[]; evidence: ReadonlyMap<string, string>; today: string }[] = [
    { name: 'rent debited on the due date', bills: [rent], evidence: debit, today: '2026-10-01' },
    { name: 'rent debited a day early', bills: [rent], evidence: evidenceOf(['rent', '2026-09-30']), today: '2026-10-01' },
    { name: 'a payment seven days early', bills: [bill({ lastPaidDate: '2026-09-10' })], evidence: evidenceOf(['bill', '2026-10-05']), today: '2026-10-09' },
    { name: 'a late payment', bills: [bill({ dueDate: 3, lastPaidDate: '2026-08-03' })], evidence: evidenceOf(['bill', '2026-10-06']), today: '2026-10-09' },
    { name: 'a bill never ticked', bills: [bill({ dueDate: 31 })], evidence: evidenceOf(['bill', '2026-09-28']), today: '2026-10-09' },
    { name: 'a weekly bill debited on Mondays and ticked on a Wednesday', bills: [bill({ frequency: 'weekly', lastPaidDate: '2026-09-30' })], evidence: evidenceOf(['bill', '2026-10-05']), today: '2026-10-09' },
    { name: 'a quarterly bill', bills: [bill({ frequency: 'quarterly', dueMonth: 11, dueDate: 3, lastPaidDate: '2026-02-03' })], evidence: evidenceOf(['bill', '2026-10-31']), today: '2026-11-01' },
    { name: 'an annual bill', bills: [bill({ frequency: 'annually', dueMonth: 3, dueDate: 10, lastPaidDate: '2025-03-10' })], evidence: evidenceOf(['bill', '2026-03-05']), today: '2026-03-05' },
  ];
  for (const { name, bills, evidence, today } of scenarios) {
    it(`gives every date one status whatever day the range starts on: ${name}`, () => {
      const to = '2027-04-30';
      const widest = '2025-12-01';
      const baseline = new Map(scheduleBills(bills, widest, to, today, evidence).occurrences.map(o => [`${o.billId} ${o.date}`, o.status]));
      expect(baseline.size).toBeGreaterThan(0);
      for (let day = epochDay(widest)!; day <= epochDay(to)!; day += 1) {
        const from = isoOfEpochDay(day);
        for (const o of scheduleBills(bills, from, to, today, evidence).occurrences) {
          expect(o.status, `${o.date} from ${from}`).toBe(baseline.get(`${o.billId} ${o.date}`));
        }
      }
    });
  }

  it('settles exactly one date per payment', () => {
    for (const [, evidence] of [['rent', debit], ['early', evidenceOf(['rent', '2026-09-30'])]] as const) {
      const seen = scheduleBills([rent], '2026-01-01', '2027-04-30', '2026-10-01', evidence).occurrences.filter(o => o.status === 'seen');
      expect(seen).toHaveLength(1);
    }
  });
  it('belongs a payment to the date whose window holds it: from seven days before it to seven days before the next', () => {
    const due12 = bill({ dueDate: 12, lastPaidDate: '2026-09-10' });
    const at = (payment: string, today: string) => statuses([due12], '2026-10-01', '2026-11-30', today, evidenceOf(['bill', payment]));
    // Up to 4 November a payment is still the one for 12 October; from the 5th it is early for 12 November.
    expect(at('2026-11-04', '2026-11-05')).toEqual(['2026-10-12 seen', '2026-11-12 due']);
    expect(at('2026-11-05', '2026-11-05')).toEqual(['2026-10-12 overdue', '2026-11-12 seen']);
  });
  it('finds the date an annual payment belongs to even when it is most of a year earlier', () => {
    // Never ticked, due 10 March: a payment on 15 January 2026 falls in the window of 10 March 2025.
    const annual = bill({ frequency: 'annually', dueMonth: 3, dueDate: 10 });
    expect(statuses([annual], '2025-01-01', '2026-12-31', '2026-01-15', evidenceOf(['bill', '2026-01-15'])))
      .toEqual(['2025-03-10 seen', '2026-03-10 due']);
  });
  it('settles nothing when coverage already pays the date the payment belongs to', () => {
    expect(statuses([bill({ dueDate: 12, lastPaidDate: '2026-10-08', paidForDueDate: '2026-10-12' })], '2026-10-01', '2026-11-30', '2026-10-09', evidenceOf(['bill', '2026-10-09'])))
      .toEqual(['2026-10-12 paid', '2026-11-12 due']);
  });
});

describe('scheduleBills: weekly bills count from the bank payment', () => {
  // 5 October 2026 is a Monday and 7 October a Wednesday.
  const weekly = bill({ frequency: 'weekly', lastPaidDate: '2026-10-07' });

  it('schedules a bill debited on Mondays on Mondays once evidence exists, though it was ticked on a Wednesday', () => {
    expect(statuses([weekly], '2026-10-01', '2026-10-26', '2026-10-09'))
      .toEqual(['2026-10-07 paid', '2026-10-14 due', '2026-10-21 due']);
    expect(statuses([weekly], '2026-10-01', '2026-10-26', '2026-10-09', evidenceOf(['bill', '2026-10-05'])))
      .toEqual(['2026-10-05 paid', '2026-10-12 due', '2026-10-19 due', '2026-10-26 due']);
  });
  it('sees the Monday debit that follows a Wednesday tick, and leaves the next Monday due', () => {
    expect(statuses([weekly], '2026-10-01', '2026-10-26', '2026-10-12', evidenceOf(['bill', '2026-10-12'])))
      .toEqual(['2026-10-05 paid', '2026-10-12 seen', '2026-10-19 due', '2026-10-26 due']);
  });
  it('ignores a payment dated after today when choosing the weekday', () => {
    expect(statuses([weekly], '2026-10-01', '2026-10-21', '2026-10-09', evidenceOf(['bill', '2026-10-12'])))
      .toEqual(['2026-10-07 paid', '2026-10-14 due', '2026-10-21 due']);
    expect(statuses([weekly], '2026-10-01', '2026-10-21', '2026-10-09', evidenceOf(['bill', 'bad'])))
      .toEqual(['2026-10-07 paid', '2026-10-14 due', '2026-10-21 due']);
  });
  it('places a weekly bill that was never ticked on the weekday of its bank payment, instead of leaving it unplaced', () => {
    const never = bill({ frequency: 'weekly' });
    const result = scheduleBills([never], '2026-10-01', '2026-10-21', '2026-10-09', evidenceOf(['bill', '2026-10-05']));
    expect(result.unplaced).toEqual([]);
    expect(result.occurrences.map(o => `${o.date} ${o.status}`)).toEqual(['2026-10-05 seen', '2026-10-12 due', '2026-10-19 due']);
    expect(scheduleBills([never], '2026-10-01', '2026-10-21', '2026-10-09').unplaced).toEqual([never]);
  });
  it('lets billOccurrences take the anchor as an optional fourth argument, for weekly bills only', () => {
    expect(billOccurrences(weekly, '2026-10-01', '2026-10-21', '2026-10-05')).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
    expect(billOccurrences(weekly, '2026-10-01', '2026-10-21')).toEqual(['2026-10-07', '2026-10-14', '2026-10-21']);
    expect(billOccurrences(weekly, '2026-10-01', '2026-10-21', 'bad')).toEqual(['2026-10-07', '2026-10-14', '2026-10-21']);
    expect(billOccurrences(bill({ dueDate: 12 }), '2026-10-01', '2026-10-31', '2026-10-05')).toEqual(['2026-10-12']);
  });
});

describe('occurrenceTotals', () => {
  const occurrence = (amount: number, status: BillOccurrence['status']): BillOccurrence =>
    ({ billId: `b${amount}${status}`, name: 'Bill', amount, date: '2026-10-01', status });

  it('is zero for no occurrences', () => {
    expect(occurrenceTotals([])).toEqual({ scheduled: 0, outstanding: 0 });
  });
  it('counts every status as scheduled and only due and overdue as outstanding', () => {
    const totals = occurrenceTotals([
      occurrence(10, 'paid'), occurrence(20, 'seen'), occurrence(30, 'overdue'), occurrence(40, 'due'),
    ]);
    expect(totals).toEqual({ scheduled: 100, outstanding: 70 });
  });
  it('sums in pence, so tenths and fifths add up exactly', () => {
    expect(occurrenceTotals([occurrence(0.1, 'due'), occurrence(0.2, 'due')]))
      .toEqual({ scheduled: 0.3, outstanding: 0.3 });
  });
  it('returns zero rather than negative zero when everything is settled', () => {
    expect(Object.is(occurrenceTotals([occurrence(9.99, 'paid')]).outstanding, 0)).toBe(true);
  });
});

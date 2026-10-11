import { describe, expect, it } from 'vitest';
import type { BankAccount, MockTransaction, RecurringBill } from '@/features/finance/finance-types';
import { forecastBalance, payLandedBetween, type BalanceForecast, type BalanceForecastInput } from './balance-forecast';

const account = (overrides: Partial<BankAccount> = {}): BankAccount => ({
  id: 'cur', name: 'Current', type: 'checking', issuer: 'Example Bank', balance: 1000, annualFee: 0, ...overrides,
});
const card = account({ id: 'card', name: 'Card', type: 'credit', balance: -500 });
// Due on the 12th and confirmed paid for September, so October is the first date to pay.
const bill = (overrides: Partial<RecurringBill> = {}): RecurringBill => ({
  id: 'rent', name: 'Rent', amount: 100, dueDate: 12, isPaid: false, frequency: 'monthly',
  lastPaidDate: '2026-09-12', paidForDueDate: '2026-09-12', ...overrides,
});
const NO_PAY: BalanceForecastInput['payday'] = { schedule: 'monthly_date', opts: {}, bankHolidays: [], annualNetPay: 0 };
const monthlyPay = (annualNetPay: number, extra: Partial<BalanceForecastInput['payday']> = {}): BalanceForecastInput['payday'] =>
  ({ ...NO_PAY, annualNetPay, ...extra });
// An inflow in the current account follows the ledger's sign: negative is money in.
const credit = (date: string, amount: number, overrides: Partial<MockTransaction> = {}): MockTransaction => ({
  id: `credit-${date}-${amount}`, name: 'Employer', category: 'Income', amount: -amount, date, isReviewed: false,
  bankAccountId: 'cur', ...overrides,
});
// 2026-10-09 is a Friday.
const run = (overrides: Partial<BalanceForecastInput> = {}): BalanceForecast =>
  forecastBalance({ today: '2026-10-09', days: 30, accounts: [account()], bills: [], payday: NO_PAY, transactions: [], ...overrides });
const ready = (overrides: Partial<BalanceForecastInput> = {}) => {
  const forecast = run(overrides);
  if (forecast.available === false) throw new Error(`forecast unavailable: ${forecast.reason}`);
  return forecast;
};
const balanceOn = (forecast: BalanceForecast, date: string) => forecast.points.find(point => point.date === date)?.balance;

describe('forecastBalance availability', () => {
  it('is unavailable with no accounts at all, and with accounts but none a current account', () => {
    for (const accounts of [[], [card, account({ id: 'sav', type: 'savings', balance: 900 }), account({ id: 'inv', type: 'investment' })]]) {
      expect(run({ accounts })).toEqual({
        available: false, reason: 'no_cash_account', points: [], events: [], overdue: [], unplaced: [], excluded: [],
      });
    }
  });
  it('is unavailable when a current account balance is not a usable figure, rather than counting it as zero', () => {
    for (const balance of [NaN, Infinity, Number.MAX_VALUE]) {
      expect(run({ accounts: [account(), account({ id: 'b', balance })] })).toMatchObject({ available: false, reason: 'unknown_balance' });
    }
    // A card with no usable balance is not part of the cash figure.
    expect(run({ accounts: [account(), account({ id: 'x', type: 'credit', balance: NaN })] }).available).toBe(true);
  });
  it('is unavailable for an invalid start date or a window that is not a whole number of days from 1 to 3660', () => {
    expect(run({ today: 'bad' })).toMatchObject({ available: false, reason: 'invalid_window' });
    expect(run({ today: '2026-02-30' })).toMatchObject({ available: false, reason: 'invalid_window' });
    for (const days of [0, -1, 1.5, NaN, Infinity, 3661]) {
      expect(run({ days })).toMatchObject({ available: false, reason: 'invalid_window', points: [] });
    }
    expect(ready({ days: 3660 }).points).toHaveLength(3660);
  });
});

describe('forecastBalance points', () => {
  it('defaults to sixty days, one point each from today, flat when nothing moves', () => {
    const forecast = ready({ days: undefined });
    expect(forecast.points).toHaveLength(60);
    expect(forecast.points[0]).toEqual({ date: '2026-10-09', balance: 1000 });
    expect(forecast.points[59]).toEqual({ date: '2026-12-07', balance: 1000 });
    expect(forecast).toMatchObject({
      startBalance: 1000, endBalance: 1000, firstBelowZero: null, payModelled: false, payPerPayday: 0,
      events: [], overdue: [], unplaced: [], excluded: [],
    });
  });
  it('gives a single point for a one-day window and includes today\'s events in it', () => {
    const forecast = ready({ days: 1, bills: [bill({ dueDate: 9, lastPaidDate: '2026-09-09', paidForDueDate: '2026-09-09' })] });
    expect(forecast.points).toEqual([{ date: '2026-10-09', balance: 900 }]);
    expect(forecast.lowest).toEqual({ date: '2026-10-09', balance: 900 });
    expect(forecast.endBalance).toBe(900);
  });
  it('subtracts a bill from its due date onwards and adds pay from the payday onwards', () => {
    // 25 Oct 2026 is a Sunday, so 30000 a year lands as 2500 on Friday 23 October.
    const forecast = ready({ bills: [bill()], payday: monthlyPay(30000) });
    expect(balanceOn(forecast, '2026-10-11')).toBe(1000);
    expect(balanceOn(forecast, '2026-10-12')).toBe(900);
    expect(balanceOn(forecast, '2026-10-22')).toBe(900);
    expect(balanceOn(forecast, '2026-10-23')).toBe(3400);
    expect(forecast.endBalance).toBe(3400);
    expect(forecast.events).toEqual([
      { date: '2026-10-12', kind: 'bill', amount: 100, label: 'Rent', billId: 'rent' },
      { date: '2026-10-23', kind: 'pay', amount: 2500, label: 'Pay' },
    ]);
    expect(forecast).toMatchObject({ payModelled: true, payPerPayday: 2500 });
  });
  it('includes an event on the last day of the window and leaves out the day after', () => {
    expect(ready({ days: 3, bills: [bill({ dueDate: 11, lastPaidDate: '2026-09-11', paidForDueDate: '2026-09-11' })] }).endBalance).toBe(900);
    expect(ready({ days: 3, bills: [bill({ dueDate: 12 })] }).endBalance).toBe(1000);
    const pay = ready({ today: '2026-10-21', days: 3, payday: monthlyPay(30000) });
    expect(pay.points.map(point => point.balance)).toEqual([1000, 1000, 3500]);
  });
  it('crosses the year boundary and a leap day in order', () => {
    const newYear = ready({
      today: '2026-12-28', days: 10,
      bills: [bill({ dueDate: 1, lastPaidDate: '2026-12-01', paidForDueDate: '2026-12-01' })],
    });
    expect(newYear.points.map(point => point.date)).toEqual([
      '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04', '2027-01-05', '2027-01-06',
    ]);
    expect(balanceOn(newYear, '2026-12-31')).toBe(1000);
    expect(balanceOn(newYear, '2027-01-01')).toBe(900);
    expect(ready({ today: '2028-02-27', days: 4 }).points.map(point => point.date))
      .toEqual(['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01']);
  });
  it('lands pay on the last day of the UK tax year and a bill on the first', () => {
    // 5 Apr 2027 is a Monday; pay on the 5th, a bill due on the 6th.
    const forecast = ready({
      today: '2027-04-03', days: 6,
      bills: [bill({ dueDate: 6, lastPaidDate: '2027-03-06', paidForDueDate: '2027-03-06' })],
      payday: monthlyPay(12000, { opts: { payDayOfMonth: 5 } }),
    });
    expect(forecast.events.map(event => `${event.date} ${event.kind}`)).toEqual(['2027-04-05 pay', '2027-04-06 bill']);
    expect(forecast.points.map(point => point.balance)).toEqual([1000, 1000, 2000, 1900, 1900, 1900]);
  });
});

describe('forecastBalance money', () => {
  it('sums balances and bills in whole pence so 0.1 + 0.2 is exactly 0.3', () => {
    const sums = ready({ accounts: [account({ balance: 0.1 }), account({ id: 'b', balance: 0.2 })] });
    expect(sums.startBalance).toBe(0.3);
    expect(sums.points.every(point => point.balance === 0.3)).toBe(true);
    const bills = ready({
      bills: [bill({ id: 'a', name: 'A', amount: 0.1 }), bill({ id: 'b', name: 'B', amount: 0.2 })],
    });
    expect(balanceOn(bills, '2026-10-12')).toBe(999.7);
    expect(bills.events.map(event => event.amount)).toEqual([0.1, 0.2]);
  });
  it('adds up only current accounts, signed, and starts from an overdraft', () => {
    const forecast = ready({ accounts: [account({ balance: -250 }), account({ id: 'sav', type: 'savings', balance: 5000 }), card] });
    expect(forecast.startBalance).toBe(-250);
    expect(forecast.firstBelowZero).toBe('2026-10-09');
    expect(forecast.lowest).toEqual({ date: '2026-10-09', balance: -250 });
  });
  it('rounds each payday\'s share of annual pay to the penny', () => {
    const fortnightly = ready({ payday: monthlyPay(30000, { schedule: 'biweekly' }) });
    expect(fortnightly.payPerPayday).toBe(1153.85);
    const weekly = ready({ payday: monthlyPay(30000, { schedule: 'weekly' }) });
    expect(weekly.payPerPayday).toBe(576.92);
    // Fridays 9, 16, 23 and 30 October and 6 November; summed in pence, 1000 + 5 * 576.92 is exactly 3884.60.
    expect(weekly.events.map(event => event.amount)).toEqual([576.92, 576.92, 576.92, 576.92, 576.92]);
    expect(weekly.endBalance).toBe(3884.6);
  });
  it('keeps a balance of exactly zero as zero, not minus zero', () => {
    const forecast = ready({ accounts: [account({ balance: 100 })], bills: [bill()] });
    expect(balanceOn(forecast, '2026-10-12')).toBe(0);
    expect(forecast.lowest.balance).toBe(0);
    expect(forecast.firstBelowZero).toBeNull();
  });
});

describe('forecastBalance lowest point and first overdraft', () => {
  it('reports the earliest day when the lowest balance is reached more than once', () => {
    // Wednesday 7 Oct: 200 out on the 8th, 100 in on Friday the 9th, 100 out on the 10th.
    const forecast = ready({
      today: '2026-10-07', days: 14,
      bills: [
        bill({ id: 'a', name: 'A', amount: 200, dueDate: 8, lastPaidDate: '2026-09-08', paidForDueDate: '2026-09-08' }),
        bill({ id: 'b', name: 'B', amount: 100, dueDate: 10, lastPaidDate: '2026-09-10', paidForDueDate: '2026-09-10' }),
      ],
      payday: monthlyPay(5200, { schedule: 'weekly' }),
    });
    expect(balanceOn(forecast, '2026-10-08')).toBe(800);
    expect(balanceOn(forecast, '2026-10-10')).toBe(800);
    expect(forecast.lowest).toEqual({ date: '2026-10-08', balance: 800 });
    expect(forecast.firstBelowZero).toBeNull();
  });
  it('finds the first day below zero, even if pay brings the balance back', () => {
    const forecast = ready({ accounts: [account({ balance: 50 })], bills: [bill()], payday: monthlyPay(30000) });
    expect(forecast.firstBelowZero).toBe('2026-10-12');
    expect(forecast.lowest).toEqual({ date: '2026-10-12', balance: -50 });
    expect(forecast.endBalance).toBe(2450);
  });
});

describe('forecastBalance bills', () => {
  it('puts a bill due on the 31st on the last day of February and of a 30-day month', () => {
    const february = ready({
      today: '2026-02-20', days: 20,
      bills: [bill({ dueDate: 31, lastPaidDate: '2026-01-31', paidForDueDate: '2026-01-31' })],
    });
    expect(february.events.map(event => event.date)).toEqual(['2026-02-28']);
    const april = ready({
      today: '2026-04-25', days: 10,
      bills: [bill({ dueDate: 31, lastPaidDate: '2026-03-31', paidForDueDate: '2026-03-31' })],
    });
    expect(april.events.map(event => event.date)).toEqual(['2026-04-30']);
    const leap = ready({
      today: '2028-02-20', days: 20,
      bills: [bill({ dueDate: 31, lastPaidDate: '2028-01-31', paidForDueDate: '2028-01-31' })],
    });
    expect(leap.events.map(event => event.date)).toEqual(['2028-02-29']);
  });
  it('schedules quarterly bills from dueMonth and annual bills from their anniversary', () => {
    const forecast = ready({
      days: 60,
      bills: [
        bill({ id: 'q', name: 'Quarterly', amount: 50, frequency: 'quarterly', dueMonth: 11, dueDate: 3, lastPaidDate: '2026-08-03', paidForDueDate: '2026-08-03' }),
        bill({ id: 'a', name: 'Annual', amount: 240, frequency: 'annually', dueMonth: 11, dueDate: 20, lastPaidDate: '2025-11-20', paidForDueDate: '2025-11-20' }),
      ],
    });
    expect(forecast.events.map(event => `${event.date} ${event.label} ${event.amount}`))
      .toEqual(['2026-11-03 Quarterly 50', '2026-11-20 Annual 240']);
    expect(forecast.endBalance).toBe(710);
  });
  it('repeats a weekly bill every seven days from lastPaidDate, and reports one without it as unplaced', () => {
    const anchored = bill({ id: 'w', name: 'Weekly', amount: 10, frequency: 'weekly', lastPaidDate: '2026-10-06', paidForDueDate: undefined });
    const forecast = ready({ bills: [anchored] });
    expect(forecast.events.map(event => event.date)).toEqual(['2026-10-13', '2026-10-20', '2026-10-27', '2026-11-03']);
    expect(forecast.endBalance).toBe(960);
    const never = { ...anchored, lastPaidDate: undefined };
    const unanchored = ready({ bills: [never] });
    expect(unanchored.events).toEqual([]);
    expect(unanchored.unplaced).toEqual([never]);
    expect(unanchored.endBalance).toBe(1000);
  });
  it('does not subtract a period the owner paid early', () => {
    const early = bill({ lastPaidDate: '2026-10-08', paidForDueDate: '2026-10-12' });
    const forecast = ready({ bills: [early], days: 60 });
    expect(forecast.events.map(event => event.date)).toEqual(['2026-11-12']);
    expect(balanceOn(forecast, '2026-10-12')).toBe(1000);
  });
  it('skips the date a bank payment three days early settled, and not the one after', () => {
    const base = bill({ lastPaidDate: '2026-09-10', paidForDueDate: undefined });
    const forecast = ready({ bills: [base], days: 60, evidence: new Map([['rent', '2026-10-09']]) });
    expect(forecast.events.map(event => event.date)).toEqual(['2026-11-12']);
    expect(forecast.overdue).toEqual([]);
  });
  it('still subtracts a date when the payment was eight days early', () => {
    const base = bill({ lastPaidDate: '2026-09-10', paidForDueDate: undefined });
    const forecast = ready({ bills: [base], days: 60, evidence: new Map([['rent', '2026-10-04']]) });
    expect(forecast.events.map(event => event.date)).toEqual(['2026-10-12', '2026-11-12']);
  });
  it('lets one bank payment settle one date across the overdue look-back and the window together', () => {
    // Due on the 3rd, last confirmed for August. A payment on the 6th was the late October one.
    const late = bill({ dueDate: 3, lastPaidDate: '2026-08-03', paidForDueDate: '2026-08-03' });
    const without = ready({ bills: [late], days: 60 });
    expect(without.overdue.map(item => item.date)).toEqual(['2026-10-03']);
    expect(without.events.map(event => event.date)).toEqual(['2026-11-03', '2026-12-03']);
    const paid = ready({ bills: [late], days: 60, evidence: new Map([['rent', '2026-10-06']]) });
    expect(paid.overdue).toEqual([]);
    expect(paid.events.map(event => event.date)).toEqual(['2026-11-03', '2026-12-03']);
  });
  it('lists an overdue bill without subtracting it', () => {
    const missed = bill({ dueDate: 3, lastPaidDate: '2026-09-03', paidForDueDate: '2026-09-03' });
    const forecast = ready({ bills: [missed], days: 20 });
    expect(forecast.overdue).toEqual([
      { billId: 'rent', name: 'Rent', amount: 100, date: '2026-10-03', status: 'overdue' },
    ]);
    expect(forecast.events).toEqual([]);
    expect(forecast.endBalance).toBe(1000);
  });
  it('subtracts a bill due today and lists one due yesterday as overdue', () => {
    const today = bill({ id: 'today', name: 'Today', dueDate: 9, lastPaidDate: '2026-09-09', paidForDueDate: '2026-09-09' });
    const yesterday = bill({ id: 'yesterday', name: 'Yesterday', dueDate: 8, lastPaidDate: '2026-09-08', paidForDueDate: '2026-09-08' });
    const forecast = ready({ bills: [today, yesterday], days: 5 });
    expect(forecast.points[0].balance).toBe(900);
    expect(forecast.overdue.map(item => item.billId)).toEqual(['yesterday']);
  });
  it('does not settle the wrong date for rent ticked for August only and debited on 1 October', () => {
    const rent = bill({ id: 'rent', name: 'Rent', amount: 800, dueDate: 1, lastPaidDate: '2026-08-01', paidForDueDate: '2026-08-01' });
    const forecast = ready({ today: '2026-10-01', days: 60, bills: [rent], evidence: new Map([['rent', '2026-10-01']]) });
    // 1 October is the debit, so it is seen; only 1 November is still to pay, and September is listed as overdue.
    expect(forecast.events).toEqual([{ date: '2026-11-01', kind: 'bill', amount: 800, label: 'Rent', billId: 'rent' }]);
    expect(forecast.overdue.map(item => item.date)).toEqual(['2026-09-01']);
    expect(balanceOn(forecast, '2026-10-01')).toBe(1000);
    expect(forecast.lowest).toEqual({ date: '2026-11-01', balance: 200 });
    expect(forecast.firstBelowZero).toBeNull();
  });
  it('ignores inactive and dismissed bills completely', () => {
    const forecast = ready({
      bills: [
        bill({ id: 'off', status: 'inactive' }), bill({ id: 'gone', status: 'dismissed', frequency: 'weekly', lastPaidDate: undefined }),
      ],
    });
    expect(forecast).toMatchObject({ events: [], overdue: [], unplaced: [], excluded: [], endBalance: 1000 });
  });
  it('leaves out bills that cannot be placed or have no usable amount, and says so', () => {
    const noDay = bill({ id: 'noday', dueDate: 0 });
    const noAmount = bill({ id: 'noamount', amount: NaN });
    const forecast = ready({ bills: [noDay, noAmount, bill()] });
    expect(forecast.unplaced).toEqual([noDay, noAmount]);
    expect(forecast.events.map(event => event.billId)).toEqual(['rent']);
    expect(forecast.endBalance).toBe(900);
  });
  it('subtracts bills linked to a current account or to none, and excludes those linked elsewhere', () => {
    const accounts = [account(), card, account({ id: 'sav', type: 'savings', balance: 300 })];
    const forecast = ready({
      accounts,
      bills: [
        bill({ id: 'cash', name: 'Cash', linkedAccountId: 'cur' }),
        bill({ id: 'free', name: 'Free' }),
        bill({ id: 'card', name: 'Card', linkedAccountId: 'card' }),
        bill({ id: 'sav', name: 'Savings', linkedAccountId: 'sav' }),
        bill({ id: 'ghost', name: 'Ghost', linkedAccountId: 'deleted' }),
      ],
    });
    expect(forecast.events.map(event => event.billId)).toEqual(['cash', 'free']);
    expect(forecast.excluded.map(item => item.billId)).toEqual(['card', 'ghost', 'sav']);
    expect(forecast.excluded.every(item => item.status === 'due' && item.date === '2026-10-12')).toBe(true);
    expect(forecast.endBalance).toBe(800);
    expect(forecast.unplaced).toEqual([]);
  });
});

describe('forecastBalance pay', () => {
  it('keeps a payday when money moved in from savings shortly before it', () => {
    // Paid £24,000 a year on the 23rd; £1,200 moved in from savings on the 21st, labelled a transfer.
    const pay = monthlyPay(24000, { opts: { payDayOfMonth: 23 } });
    const topUp = credit('2026-10-21', 1200, { name: 'From savings', category: 'Transfer', providerCategory: 'transfer' });
    const forecast = ready({ today: '2026-10-21', days: 5, payday: pay, transactions: [topUp] });
    expect(forecast.events).toMatchObject([{ date: '2026-10-23', kind: 'pay', amount: 2000 }]);
    expect(balanceOn(forecast, '2026-10-23')).toBe(3000);
  });
  it('adds no pay, and says so, when annual net pay is zero, negative or not a number', () => {
    for (const annualNetPay of [0, -1200, NaN, Infinity, -Infinity]) {
      expect(ready({ payday: monthlyPay(annualNetPay) })).toMatchObject({ payModelled: false, payPerPayday: 0, events: [], endBalance: 1000 });
    }
  });
  it('says pay is not modelled when the schedule cannot place a payday', () => {
    const forecast = ready({ payday: monthlyPay(30000, { schedule: 'weekly', opts: { weekday: 9 } }) });
    expect(forecast).toMatchObject({ payModelled: false, events: [], endBalance: 1000 });
  });
  it('moves a payday back off a bank holiday', () => {
    // 25 Dec 2026 is a Friday and a bank holiday.
    const plain = ready({ today: '2026-12-01', days: 31, payday: monthlyPay(12000) });
    expect(plain.events.map(event => event.date)).toEqual(['2026-12-25']);
    const holiday = ready({ today: '2026-12-01', days: 31, payday: monthlyPay(12000, { bankHolidays: ['2026-12-25'] }) });
    expect(holiday.events.map(event => event.date)).toEqual(['2026-12-24']);
    expect(balanceOn(holiday, '2026-12-23')).toBe(1000);
    expect(balanceOn(holiday, '2026-12-24')).toBe(2000);
  });
  it('skips today\'s pay when a pay-sized credit has already landed today, and only that pay', () => {
    const weekly = monthlyPay(5200, { schedule: 'weekly' });
    const counted = ready({ days: 15, payday: weekly });
    expect(counted.events.map(event => event.date)).toEqual(['2026-10-09', '2026-10-16', '2026-10-23']);
    expect(counted.points[0].balance).toBe(1100);
    const landed = ready({ days: 15, payday: weekly, transactions: [credit('2026-10-09', 100)] });
    expect(landed.events.map(event => event.date)).toEqual(['2026-10-16', '2026-10-23']);
    expect(landed.points[0].balance).toBe(1000);
  });
  it('counts pay that has not landed: a credit below half, in another account, or dated after today', () => {
    const weekly = monthlyPay(5200, { schedule: 'weekly' });
    const dates = (transactions: MockTransaction[]) => ready({ days: 8, payday: weekly, transactions }).events.map(event => event.date);
    expect(dates([credit('2026-10-09', 49.99)])).toEqual(['2026-10-09', '2026-10-16']);
    expect(dates([credit('2026-10-09', 100, { bankAccountId: 'card' })])).toEqual(['2026-10-09', '2026-10-16']);
    expect(dates([credit('2026-10-10', 100)])).toEqual(['2026-10-09', '2026-10-16']);
    expect(dates([credit('2026-10-09', -100)])).toEqual(['2026-10-09', '2026-10-16']);
    expect(dates([credit('2026-10-09', 50)])).toEqual(['2026-10-16']);
  });
  it('does not count pay twice when it landed a day early', () => {
    // 25 Oct 2026 is a Sunday, so the payday is Friday 23rd; the employer paid on Thursday 22nd.
    const input = { today: '2026-10-22', days: 40, payday: monthlyPay(30000) };
    expect(ready(input).events.map(event => event.date)).toEqual(['2026-10-23', '2026-11-25']);
    const early = ready({ ...input, accounts: [account({ balance: 3500 })], transactions: [credit('2026-10-22', 2500)] });
    expect(early.events.map(event => event.date)).toEqual(['2026-11-25']);
    expect(balanceOn(early, '2026-10-23')).toBe(3500);
    expect(early.endBalance).toBe(6000);
  });
  it('looks back five days before the coming payday, no further', () => {
    const input = { today: '2026-10-22', days: 3, payday: monthlyPay(30000) };
    expect(ready({ ...input, transactions: [credit('2026-10-18', 2500)] }).events).toEqual([]);
    expect(ready({ ...input, transactions: [credit('2026-10-17', 2500)] }).events.map(event => event.date)).toEqual(['2026-10-23']);
  });
  it('does not let the last period\'s pay, arriving a day late, suppress the next payday', () => {
    // The 23rd October payday arrived on Saturday the 24th; the next is Wednesday 25 November.
    const forecast = ready({ today: '2026-10-24', days: 40, payday: monthlyPay(30000), transactions: [credit('2026-10-24', 2500)] });
    expect(forecast.events.map(event => event.date)).toEqual(['2026-11-25']);
    // A credit that long before the payday is not looked at.
    const earlier = ready({ today: '2026-11-19', days: 10, payday: monthlyPay(30000), transactions: [credit('2026-11-19', 2500)] });
    expect(earlier.events.map(event => event.date)).toEqual(['2026-11-25']);
  });
  it('handles weekly pay: Thursday\'s credit is Friday\'s pay, Saturday\'s is last Friday\'s', () => {
    const weekly = monthlyPay(5200, { schedule: 'weekly' });
    // Pay for Friday 16 October arrived on Thursday the 15th.
    const early = ready({ today: '2026-10-15', days: 10, payday: weekly, transactions: [credit('2026-10-15', 100)] });
    expect(early.events.map(event => event.date)).toEqual(['2026-10-23']);
    // Pay for Friday the 9th arrived a day late, on Saturday the 10th: the 16th is still to come.
    const late = ready({ today: '2026-10-10', days: 10, payday: weekly, transactions: [credit('2026-10-10', 100)] });
    expect(late.events.map(event => event.date)).toEqual(['2026-10-16']);
  });
  it('uses the pay share it adds as the amount to look for, and ignores the ledger when pay is not modelled', () => {
    const forecast = ready({ days: 15, payday: monthlyPay(5200, { schedule: 'weekly' }), transactions: [credit('2026-10-09', 100)] });
    expect(forecast.payPerPayday).toBe(100);
    expect(ready({ transactions: [credit('2026-10-09', 100)] })).toMatchObject({ payModelled: false, events: [] });
  });
  it('lists pay before bills on the same day, then bills by name', () => {
    const forecast = ready({
      days: 3, payday: monthlyPay(5200, { schedule: 'weekly' }),
      bills: [
        bill({ id: 'r', name: 'Rent', dueDate: 9, lastPaidDate: '2026-09-09', paidForDueDate: '2026-09-09' }),
        bill({ id: 'g', name: 'Gas', dueDate: 9, lastPaidDate: '2026-09-09', paidForDueDate: '2026-09-09' }),
      ],
    });
    expect(forecast.events.map(event => `${event.kind} ${event.label}`)).toEqual(['pay Pay', 'bill Gas', 'bill Rent']);
    expect(forecast.points[0].balance).toBe(1000 + 100 - 200);
  });
});

describe('forecastBalance inputs', () => {
  it('does not change the accounts, bills or evidence it is given', () => {
    const accounts = [account(), card];
    const bills = [bill({ lastPaidDate: '2026-09-10', paidForDueDate: undefined })];
    const evidence = new Map([['rent', '2026-10-09']]);
    const before = JSON.stringify({ accounts, bills, evidence: [...evidence] });
    ready({ accounts, bills, evidence, payday: monthlyPay(30000) });
    expect(JSON.stringify({ accounts, bills, evidence: [...evidence] })).toBe(before);
  });
  it('returns the same forecast for the same input', () => {
    const input = { bills: [bill()], payday: monthlyPay(30000) };
    expect(run(input)).toEqual(run(input));
  });
});

describe('payLandedBetween', () => {
  const cash = new Set(['cur', 'joint']);
  const row = (overrides: Partial<MockTransaction> = {}): MockTransaction => ({
    id: 'tx', name: 'Employer', category: 'Income', amount: -2500, date: '2026-10-23', isReviewed: false, bankAccountId: 'cur', ...overrides,
  });
  const landed = (rows: MockTransaction[], expectedPay = 2500, from = '2026-10-23', to = '2026-10-23', accounts: ReadonlySet<string> = cash) =>
    payLandedBetween(rows, accounts, from, to, expectedPay);

  it('is false with no rows, and true for a full payment in a cash account in the range', () => {
    expect(landed([])).toBe(false);
    expect(landed([row()])).toBe(true);
    expect(landed([row({ amount: -2600 })])).toBe(true);
  });
  it('ignores money the app or the bank calls a transfer, confirmed or not', () => {
    expect(landed([row({ name: 'From savings', category: 'Transfer' })])).toBe(false);
    expect(landed([row({ name: 'From savings', category: 'Uncategorised', providerCategory: 'transfer' })])).toBe(false);
    expect(landed([row({ category: 'Income', providerCategory: 'credit' })])).toBe(true);
  });
  it('ignores a row in an account that is not a cash account, and with no account at all', () => {
    expect(landed([row({ bankAccountId: 'card' })])).toBe(false);
    expect(landed([row({ bankAccountId: undefined, accountId: 'card' })])).toBe(false);
    expect(landed([row({ bankAccountId: undefined, accountId: undefined })])).toBe(false);
    expect(landed([row()], 2500, '2026-10-23', '2026-10-23', new Set())).toBe(false);
  });
  it('reads the bank account before the app account, and falls back to the app account', () => {
    expect(landed([row({ bankAccountId: 'cur', accountId: 'card' })])).toBe(true);
    expect(landed([row({ bankAccountId: 'card', accountId: 'cur' })])).toBe(false);
    expect(landed([row({ bankAccountId: undefined, accountId: 'joint' })])).toBe(true);
  });
  it('ignores money out, however large', () => {
    expect(landed([row({ amount: 2500 })])).toBe(false);
    expect(landed([row({ amount: 9000 }), row({ id: 'zero', amount: 0 })])).toBe(false);
  });
  it('needs an inflow of at least half the expected pay: below half is false, exactly half is true', () => {
    expect(landed([row({ amount: -1249.99 })])).toBe(false);
    expect(landed([row({ amount: -1250 })])).toBe(true);
    expect(landed([row({ amount: -1250.01 })])).toBe(true);
  });
  it('compares in whole pence, so an odd penny rounds up and 0.1 + 0.2 style figures are exact', () => {
    expect(landed([row({ amount: -5 })], 10.01)).toBe(false);
    expect(landed([row({ amount: -5.01 })], 10.01)).toBe(true);
    expect(landed([row({ amount: -0.15 })], 0.1 + 0.2)).toBe(true);
    expect(landed([row({ amount: -0.14 })], 0.1 + 0.2)).toBe(false);
  });
  it('needs one row to reach half; several small credits are not added together', () => {
    expect(landed([row({ id: 'a', amount: -600 }), row({ id: 'b', amount: -600 })])).toBe(false);
    expect(landed([row({ id: 'a', amount: -600 }), row({ id: 'b', amount: -1300 })])).toBe(true);
  });
  it('counts rows from the first to the last day of the range inclusive, and no others', () => {
    const range = (date: string) => landed([row({ date })], 2500, '2026-10-18', '2026-10-22');
    expect(range('2026-10-17')).toBe(false);
    expect(range('2026-10-18')).toBe(true);
    expect(range('2026-10-20')).toBe(true);
    expect(range('2026-10-22')).toBe(true);
    expect(range('2026-10-23')).toBe(false);
  });
  it('compares dates as calendar dates across month, year and clock-change boundaries', () => {
    expect(landed([row({ date: '2026-12-31' })], 2500, '2026-12-29', '2027-01-02')).toBe(true);
    expect(landed([row({ date: '2027-01-02' })], 2500, '2026-12-29', '2027-01-02')).toBe(true);
    expect(landed([row({ date: '2026-10-25' })], 2500, '2026-10-24', '2026-10-26')).toBe(true);
    expect(landed([row({ date: '2026-03-29' })], 2500, '2026-03-30', '2026-04-02')).toBe(false);
    expect(landed([row({ date: '2026-10-23T00:00:00Z' })])).toBe(false);
  });
  it('is false for a reversed range and for invalid dates', () => {
    expect(landed([row()], 2500, '2026-10-24', '2026-10-22')).toBe(false);
    for (const bad of ['', 'bad', '2026-02-30']) {
      expect(landed([row({ date: '2026-10-23' })], 2500, bad, '2026-10-23')).toBe(false);
      expect(landed([row({ date: '2026-10-23' })], 2500, '2026-10-23', bad)).toBe(false);
    }
    expect(landed([row({ date: 'bad' })], 2500, '2026-10-01', '2026-10-31')).toBe(false);
  });
  it('is false for an expected pay that is zero, negative or not finite', () => {
    for (const expectedPay of [0, -2500, NaN, Infinity, -Infinity]) {
      expect(landed([row({ amount: -2500 })], expectedPay)).toBe(false);
    }
  });
  it('skips a row whose amount is not a number and leaves the ledger alone', () => {
    const rows = [row({ id: 'bad', amount: NaN }), row({ id: 'ok', amount: -2500 })];
    const before = JSON.stringify(rows);
    expect(landed(rows)).toBe(true);
    expect(landed([rows[0]])).toBe(false);
    expect(JSON.stringify(rows)).toBe(before);
  });
});

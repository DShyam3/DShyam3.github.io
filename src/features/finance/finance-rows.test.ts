import { describe, expect, it } from 'vitest';
import {
  bankAccountFromRow,
  bankAccountRow,
  contributionFromRow,
  contributionRow,
  contributionsOf,
  creditScoreFromRow,
  creditScoreRow,
  debtFromRow,
  debtRow,
  goalFromRow,
  goalRow,
  membershipFromRow,
  membershipRow,
  holidayFromRow,
  holidayRow,
  scoresOf,
  transactionFromRow,
  transactionRow,
} from './finance-rows';
import { changedColumns } from './save-safety';
import type { Goal } from './finance-types';

const PROFILE = 'p1';

describe('a stored row compared as the page shows it', () => {
  const shownTx = transactionFromRow({
    id: 't1', name: 'TESCO', merchant: null, category: null, amount: -12.5, date: '2026-09-20',
    is_reviewed: false, account_id: 'acc', bank_account_id: 'acc', goal_id: null, notes: null, tags: null, is_recurring: false,
  });

  it('a synced transaction stored differently from the page\'s copy does not count as changed', () => {
    // The sync writes account_id only and leaves is_recurring and merchant empty.
    const synced = {
      id: 't1', name: 'TESCO', merchant: '', category: null, amount: -12.5, date: '2026-09-20',
      is_reviewed: false, account_id: 'acc', bank_account_id: null, goal_id: null, notes: null, tags: null, is_recurring: null,
    } as never;
    const asLoaded = transactionRow(transactionFromRow(synced), PROFILE);
    expect(changedColumns(asLoaded, transactionRow(shownTx, PROFILE))).toEqual({});
  });

  it('a transaction reviewed or categorised elsewhere counts', () => {
    const elsewhere = transactionRow({ ...shownTx, isReviewed: true, category: 'Groceries' }, PROFILE);
    expect(changedColumns(elsewhere, transactionRow(shownTx, PROFILE))).toEqual({ is_reviewed: false, category: null });
  });

  it('a bank account with no annual fee stored reads the same as the 0 the page shows', () => {
    const stored = {
      id: 'b1', name: 'Current', type: 'current', issuer: null, balance: 100, annual_fee: null,
      credit_limit: null, use_case: null, emoji: null, color: null,
    } as never;
    const shown = { ...bankAccountFromRow(stored), annualFee: 0 };
    expect(changedColumns(bankAccountRow(bankAccountFromRow(stored), PROFILE), bankAccountRow(shown, PROFILE))).toEqual({});
  });

  it('a holiday without a half day stored as NULL reads the same as a full day', () => {
    const stored = { id: 'h1', start_date: '2026-10-01', end_date: '2026-10-01', occasion: null, count: 1, type: 'holiday', half_day: null } as never;
    const shown = holidayFromRow(stored);
    expect(changedColumns(holidayRow(holidayFromRow(stored), PROFILE), holidayRow(shown, PROFILE))).toEqual({});
    expect(holidayRow({ ...shown, halfDay: 'am' }, PROFILE).half_day).toBe('am');
  });
});

describe('nested rows carry their parent', () => {
  it('each contribution is saved with the goal it belongs to', () => {
    const goals = [
      { id: 'g1', contributions: [{ id: 'c1', amount: 5, date: '2026-09-01' }] },
      { id: 'g2', contributions: [{ id: 'c2', amount: 7, date: '2026-09-02' }] },
    ] as Goal[];
    expect(contributionsOf(goals).map(c => [c.contribution.id, c.goalId])).toEqual([['c1', 'g1'], ['c2', 'g2']]);
  });

  it('each credit score is saved under its bureau', () => {
    const score = creditScoreFromRow({ id: 's1', date: '2026-09-01', score: 900, storage_path: null } as never);
    const rows = scoresOf({ experian: [score], transunion: [], equifax: [] }).map(s => creditScoreRow(s, PROFILE));
    expect(rows).toEqual([{ id: 's1', is_default: false, profile_id: PROFILE, bureau: 'experian', date: '2026-09-01', score: 900, storage_path: null }]);
  });
});

describe('round trip: a stored row read back through the load is the same row', () => {
  it('goals, contributions and memberships', () => {
    const goal = {
      id: 'g1', name: 'Rainy day', target_amount: 1000, current_amount: 250, target_date: null,
      is_emergency_fund: true, monthly_contribution: null, start_date: null, status: null, emoji: null,
    } as never;
    const once = goalRow(goalFromRow(goal, []), PROFILE);
    expect(goalRow(goalFromRow(once as never, []), PROFILE)).toEqual(once);

    const contribution = { id: 'c1', amount: 50, date: '2026-09-01', note: null, bank_account_id: null } as never;
    const saved = contributionRow({ contribution: contributionFromRow(contribution), goalId: 'g1' }, PROFILE);
    expect(contributionRow({ contribution: contributionFromRow(saved as never), goalId: 'g1' }, PROFILE)).toEqual(saved);

    const membership = { id: 'm1', name: 'Amex Plat', type: 'card', status: null, annual_fee: null, use_case: null } as never;
    const m = membershipRow(membershipFromRow(membership), PROFILE);
    expect(membershipRow(membershipFromRow(m as never), PROFILE)).toEqual(m);
  });

  it('debts, with empty draws and rate periods read as [] and a cleared course end date sent as null', () => {
    const debt = {
      id: 'd1', name: 'Plan 2', type: 'student_loan', lender: null, original_amount: 40000, balance: 42000,
      interest_rate: 7.3, min_payment: 0, start_date: null, course_end_date: '2021-06-30', payoff_date: null,
      repayment_type: null, student_loan_plan: 'plan2', write_off_years: 30, draws: null, rate_periods: null,
      final_payment: null, notes: null, emoji: null, color: null,
    } as never;
    const once = debtRow(debtFromRow(debt), PROFILE);
    expect(once.draws).toEqual([]);
    expect(once.rate_periods).toEqual([]);
    expect(debtRow(debtFromRow(once as never), PROFILE)).toEqual(once);
    // Clearing the date is a change a save sends.
    const cleared = debtRow({ ...debtFromRow(debt), courseEndDate: undefined }, PROFILE);
    expect(changedColumns(once, cleared)).toEqual({ course_end_date: null });
  });
});

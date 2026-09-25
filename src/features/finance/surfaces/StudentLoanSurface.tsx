/**
 * Student Loan: your real loan, and a simulator for any loan at all.
 *
 * A student loan is its own section because it is not repaid like a debt. It
 * is a share of pay above a threshold, it grows while you study, and whatever
 * is left is written off -- so the questions worth asking are "what will I
 * actually repay" and "does paying it off early make sense", not "when is it
 * cleared".
 *
 * Both views run the same engine, `simulateStudentLoan`, which is pure and
 * tested. "Your loan" starts from the latest verified statement and your
 * salary today. "Simulator" starts from nothing but what you type: borrowing
 * per year, course length, salary and its growth. The assumptions the engine
 * cannot know -- RPI, the interest cap, inflation -- are controls shared by
 * both, because a projection whose assumptions you cannot see is a guess.
 */

import { useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { Debt } from '@/features/finance/finance-types';
import { formatGBP } from '@/features/finance/utils/calculations';
import {
  STUDENT_LOAN_DEFAULT_ASSUMPTIONS,
  STUDENT_LOAN_PLAN_LABELS,
  STUDENT_LOAN_WRITE_OFF_YEARS,
  academicYearDraws,
  balanceOnMonth,
  firstRepaymentDue,
  incomeByTaxYear,
  inferCourseEnd,
  reconcileStudentLoanWithPayslips,
  simulateStudentLoan,
  studentLoanMonthlyRepayment,
  toISODate,
  type StudentLoanAssumptions,
  type StudentLoanPlanKey,
  type StudentLoanSimInput,
  type StudentLoanSimResult,
} from '@/lib/finance';
import { useFinanceData } from '../FinanceDataContext';
import { isBorrowing, isStudentLoanDebt, useDebtMutations } from '../useDebtMutations';
import { useStudentLoanRules } from '../useStudentLoanRules';
import { SurfaceHero } from '../components/SurfaceHero';
import { DebtFormDialog } from '../components/DebtFormDialog';
import { StudentLoanTimeline } from '../components/StudentLoanTimeline';
import { BalanceRecords } from '../components/BalanceRecords';
import { LoanMovements } from '../components/LoanMovements';
import { PublishedRates } from '../components/PublishedRates';

type Mode = 'mine' | 'sim';
interface YearRow { tuition: string; maintenance: string }

const PLANS = Object.keys(STUDENT_LOAN_PLAN_LABELS) as StudentLoanPlanKey[];
const DEFAULT_YEAR: YearRow = { tuition: '9535', maintenance: '6000' };

const n = (s: string, fallback = 0) => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : fallback;
};

const monthYear = (date: string) => {
  const [y, m] = date.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

const outcomeLine = (r: StudentLoanSimResult) =>
  r.outcome === 'written_off' ? `Written off ${monthYear(r.endDate)}`
    : r.outcome === 'cleared' ? `Cleared ${monthYear(r.endDate)}`
      : 'Still owed at the end of the projection';

/** An academic year runs August to July, named by the year it starts in. */
const academicYearOf = (date: string) => {
  const [y, m] = date.split('-').map(Number);
  return m >= 8 ? y : y - 1;
};

/**
 * Turns recorded borrowing into the simulator's one-row-per-year form. A
 * draw labelled as tuition or fees counts as tuition; everything else as
 * maintenance, which only changes when in the year it is paid out.
 */
const yearsFromDraws = (debt: Debt): { courseStart: string; rows: YearRow[] } | null => {
  const draws = debt.draws ?? [];
  if (draws.length === 0) return null;
  const years = draws.map(d => academicYearOf(d.date));
  const first = Math.min(...years);
  const count = Math.max(...years) - first + 1;
  const rows = Array.from({ length: count }, (_, k) => {
    const inYear = draws.filter(d => academicYearOf(d.date) === first + k);
    const tuition = inYear.filter(d => /tuition|fee/i.test(d.label ?? '')).reduce((s, d) => s + d.amount, 0);
    const other = inYear.reduce((s, d) => s + d.amount, 0) - tuition;
    return { tuition: String(Math.round(tuition * 100) / 100), maintenance: String(Math.round(other * 100) / 100) };
  });
  return { courseStart: `${first}-09-01`, rows };
};

export default function StudentLoanSurface() {
  const { debts, settings, payslips, hasLoaded } = useFinanceData();
  const { saveDebt } = useDebtMutations();
  const { rows: rateRows, rowNow, planRules, rateNow } = useStudentLoanRules();
  const today = toISODate(new Date());
  const thisYear = new Date().getFullYear();

  const loans = useMemo(() => debts.filter(isStudentLoanDebt), [debts]);
  const [loanId, setLoanId] = useState<string | null>(null);
  const loan = loans.find(l => l.id === loanId) ?? loans[0] ?? null;

  // Null until chosen, so the view follows the data as it loads: your loan
  // when there is one, the simulator when there is not.
  const [chosenMode, setChosenMode] = useState<Mode | null>(null);
  const mode: Mode = chosenMode ?? (loan ? 'mine' : 'sim');

  const [realTerms, setRealTerms] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);

  // Assumptions, shared by both views.
  const [a, setA] = useState<Record<keyof StudentLoanAssumptions, string>>(() => ({
    rpi: String(STUDENT_LOAN_DEFAULT_ASSUMPTIONS.rpi),
    rateCap: String(STUDENT_LOAN_DEFAULT_ASSUMPTIONS.rateCap),
    baseRate: String(STUDENT_LOAN_DEFAULT_ASSUMPTIONS.baseRate),
    upperInterestThreshold: String(STUDENT_LOAN_DEFAULT_ASSUMPTIONS.upperInterestThreshold),
    inflation: String(STUDENT_LOAN_DEFAULT_ASSUMPTIONS.inflation),
    thresholdGrowth: String(STUDENT_LOAN_DEFAULT_ASSUMPTIONS.thresholdGrowth),
  }));
  const [salaryGrowth, setSalaryGrowth] = useState('3');
  // How long after a tax year ends SLC adds its income-linked interest. It
  // waits on HMRC, so this is a guess: change it once you see yours land.
  const [confirmLag, setConfirmLag] = useState('6');
  const slcTiming = { confirmationLagMonths: Math.max(0, Math.round(n(confirmLag, 6))) };
  const assumptions: StudentLoanAssumptions = {
    rpi: n(a.rpi), rateCap: n(a.rateCap), baseRate: n(a.baseRate),
    upperInterestThreshold: n(a.upperInterestThreshold), inflation: n(a.inflation), thresholdGrowth: n(a.thresholdGrowth),
  };

  // Simulator inputs.
  const [simPlan, setSimPlan] = useState<StudentLoanPlanKey>('plan5');
  const [courseStart, setCourseStart] = useState(`${thisYear}-09-01`);
  const [rows, setRows] = useState<YearRow[]>([DEFAULT_YEAR, DEFAULT_YEAR, DEFAULT_YEAR]);
  const [simSalary, setSimSalary] = useState('');

  // --- Your loan -------------------------------------------------------------
  const salaryNow = settings.grossSalary || 0;
  // SLC sets a tax year's Plan 2 rate from that year's total income, so the
  // payslips say more than today's salary does: actual sums for past years,
  // this year's pay so far plus today's salary for the months left.
  const incomes = useMemo(
    () => incomeByTaxYear(payslips.map(p => ({ payDate: p.payDate, gross: p.gross })), salaryNow, today),
    [payslips, salaryNow, today],
  );
  const taxYearNow = today >= `${today.slice(0, 4)}-04-06` ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - 1;
  const incomeNow = incomes.find(i => i.taxYear === taxYearNow)?.income ?? salaryNow;
  const minePlan: StudentLoanPlanKey = loan?.studentLoanPlan
    ?? (settings.studentLoanPlan !== 'none' ? settings.studentLoanPlan : 'plan2');
  const latestObs = useMemo(
    () => [...(loan?.observations ?? [])].sort((x, y) =>
      (x.statementDate || x.observedOn).localeCompare(y.statementDate || y.observedOn)).pop(),
    [loan],
  );
  const live = latestObs ? reconcileStudentLoanWithPayslips(latestObs, payslips, today) : null;
  const borrowing = (loan?.draws ?? []).filter(isBorrowing);
  // Best evidence first: the date you saved, then the last borrowing, then a
  // three-year course from the start date. Which one was used is said on the
  // page, because repayment and write-off dates both hang off it.
  const inferred = inferCourseEnd(borrowing);
  const [mineCourseEnd, courseEndSource] = loan?.courseEndDate
    ? [loan.courseEndDate, 'saved'] as const
    : inferred
      ? [inferred, 'borrowing'] as const
      : loan?.startDate
        ? [`${Number(loan.startDate.slice(0, 4)) + 3}-06-30`, 'start'] as const
        : [today, 'unknown'] as const;

  const mineInput: StudentLoanSimInput | null = loan ? {
    plan: minePlan,
    draws: borrowing.map(d => ({ date: d.date, amount: d.amount, label: d.label })),
    // Refunds add back to the balance, payments outside payroll take from it.
    extraPayments: (loan.draws ?? []).filter(d => !isBorrowing(d))
      .map(d => ({ date: d.date, amount: d.kind === 'refund' ? -d.amount : d.amount })),
    rateSchedule: rateRows,
    incomeByTaxYear: Object.fromEntries(incomes.map(i => [i.taxYear, i.income])),
    slcTiming,
    courseEnd: mineCourseEnd,
    salary: settings.grossSalary || 0,
    salaryFrom: today,
    salaryGrowth: n(salaryGrowth),
    ...planRules(minePlan),
    writeOffYears: loan.writeOffYears ?? STUDENT_LOAN_WRITE_OFF_YEARS[minePlan],
    assumptions,
    anchor: latestObs
      ? { date: latestObs.statementDate || latestObs.observedOn, balance: latestObs.balance }
      : loan.balance > 0 ? { date: today, balance: loan.balance } : undefined,
    // What payroll actually took since the statement, in place of the model,
    // up to the latest payslip -- not today, or a month whose payslip has not
    // arrived yet would count as nothing deducted. SLC lags HMRC by a year, so
    // these are the freshest figures there are.
    knownPayments: payslips.filter(p => p.studentLoan > 0).map(p => ({ date: p.payDate, amount: p.studentLoan })),
    today,
  } : null;

  // --- Simulator -------------------------------------------------------------
  const simCourseEnd = `${Number(courseStart.slice(0, 4)) + rows.length}-06-30`;
  const simFirstDue = firstRepaymentDue(simCourseEnd);
  // The salary field means "now" once repayments have begun, and "starting
  // salary" before -- so a loan already in repayment is not charged against
  // today's pay back in its first year.
  const simSalaryFrom = simFirstDue > today ? simFirstDue : today;
  const simInput: StudentLoanSimInput = {
    plan: simPlan,
    draws: academicYearDraws(courseStart, rows.map(r => ({ tuition: n(r.tuition), maintenance: n(r.maintenance) }))),
    courseEnd: simCourseEnd,
    salary: n(simSalary, settings.grossSalary || 30000),
    salaryFrom: simSalaryFrom,
    salaryGrowth: n(salaryGrowth),
    ...planRules(simPlan),
    writeOffYears: STUDENT_LOAN_WRITE_OFF_YEARS[simPlan],
    assumptions,
    rateSchedule: rateRows,
    slcTiming,
    today,
  };

  const input = mode === 'mine' && mineInput ? mineInput : simInput;
  // Stringified so the memo follows the values, not the object rebuilt each render.
  const inputKey = JSON.stringify(input);
  const result = useMemo(() => simulateStudentLoan(JSON.parse(inputKey) as StudentLoanSimInput), [inputKey]);

  const seedFromMine = () => {
    if (!loan) return;
    const seeded = yearsFromDraws({ ...loan, draws: borrowing });
    setSimPlan(minePlan);
    if (seeded) { setCourseStart(seeded.courseStart); setRows(seeded.rows); }
    setSimSalary(String(settings.grossSalary || ''));
    setChosenMode('sim');
  };

  // Statement, plus interest since, less what payslips show was deducted --
  // read off the same run the chart draws, so the two cannot disagree.
  const todayRow = balanceOnMonth(result, today);

  const monthlyNow = studentLoanMonthlyRepayment(salaryNow, planRules(minePlan).threshold, planRules(minePlan).repaymentRate);
  const mineLoan = mode === 'mine' ? loan : null;

  // The rate the rules give today, against the rate stored on the loan.
  const mineRate = rateNow(minePlan, mineCourseEnd, incomeNow);
  const pendingNow = todayRow?.pendingTopUp ?? 0;
  const landsOn = monthYear(toISODate(new Date(taxYearNow + 1, 3 + slcTiming.confirmationLagMonths, 1)));
  const roundedRate = Math.round(mineRate.rate * 100) / 100;
  const storedRateStale = !!loan && Math.abs(loan.interestRate - roundedRate) >= 0.01;
  const mineFirstDue = firstRepaymentDue(mineCourseEnd);
  const mineWriteOffYears = loan?.writeOffYears ?? STUDENT_LOAN_WRITE_OFF_YEARS[minePlan];
  const rateExplanation = (() => {
    const { rpi, rateCap } = mineRate.assumptions;
    const capped = rateCap > 0 && Math.abs(mineRate.rate - rateCap) < 0.005;
    if (minePlan === 'plan2' && mineRate.phase === 'repayment') {
      // SLC charges RPI alone through the tax year and adds the income-linked
      // part once HMRC confirms the year's income, so its website runs below
      // this figure until then.
      const extra = capped
        ? `up to 3% for ${formatGBP(incomeNow)} of income this tax year, held at the ${rateCap}% cap`
        : `${(mineRate.rate - rpi).toFixed(2)}% for ${formatGBP(incomeNow)} of income this tax year`;
      return `RPI ${rpi}% plus ${extra}. SLC charges ${mineRate.provisional.toFixed(2)}% as it goes and adds the rest once HMRC confirms the year's income`;
    }
    if (minePlan === 'plan2') return `RPI ${rpi}% + 3% until the April after your course${capped ? `, held at the ${rateCap}% cap` : ''}`;
    if (minePlan === 'plan5') return `RPI ${rpi}%`;
    if (minePlan === 'postgrad') return `RPI ${rpi}% + 3%${capped ? `, held at the ${rateCap}% cap` : ''}`;
    return `The lower of RPI ${rpi}% and Bank Rate + 1%`;
  })();
  const courseEndNote = {
    saved: 'Course end as you saved it',
    borrowing: 'Course end taken from your last borrowing',
    start: 'Assumes a three-year course from your start date. Set the real end date in Edit',
    unknown: 'Course end not known. Set it in Edit',
  }[courseEndSource];

  const hero = mineLoan ? (
    <SurfaceHero
      loading={!hasLoaded}
      label="Student loan balance"
      value={formatGBP(mode === 'mine' && todayRow ? todayRow.balance : mineLoan.balance)}
      detail={live
        ? `What SLC should show at the end of ${monthYear(today)}: ${formatGBP(live.statementBalance)} on ${live.statementDate}, plus interest at the rate SLC charges during the year${live.payslipsCount > 0 ? `, less ${formatGBP(live.payslipDeductionsTotal)} from ${live.payslipsCount} payslips` : ''}.${pendingNow >= 1 ? ` About ${formatGBP(pendingNow)} more lands around ${landsOn}, once HMRC confirms this year's income.` : ''}`
        : 'As entered. Add the balance from your online account below to anchor it.'}
      aside={
        <>
          <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">On current pay</p>
          <p className="font-sans text-lg font-bold tabular-nums">{outcomeLine(result)}</p>
        </>
      }
    />
  ) : (
    <SurfaceHero
      loading={!hasLoaded}
      label="You would repay"
      value={formatGBP(realTerms ? result.totalPaidReal : result.totalPaid)}
      detail={`${formatGBP(result.totalDrawn)} borrowed over ${rows.length} ${rows.length === 1 ? 'year' : 'years'} on ${STUDENT_LOAN_PLAN_LABELS[simPlan]}${realTerms ? ' · in today\'s money' : ''}`}
      aside={
        <>
          <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Outcome</p>
          <p className="font-sans text-lg font-bold tabular-nums">{outcomeLine(result)}</p>
        </>
      }
    />
  );

  const readouts = [
    { label: 'Total repaid', value: realTerms ? result.totalPaidReal : result.totalPaid, note: `Over ${Math.round(result.monthsRepaying / 12)} years of deductions` },
    { label: 'Written off', value: realTerms ? result.writtenOffReal : result.writtenOff, note: result.writtenOff > 0 ? 'Cancelled when the term ends' : 'Nothing left to write off' },
    // These two stay in cash terms either way: a peak and a running interest
    // total are not payments, so there is no single date to deflate them to.
    { label: 'Peak balance', value: result.peakBalance, note: `${monthYear(result.peakDate)}${realTerms ? ', in cash terms' : ''}` },
    { label: 'Interest added', value: result.totalInterest, note: `On ${formatGBP(result.totalDrawn)} borrowed${realTerms ? ', in cash terms' : ''}` },
  ];

  const segment = (value: Mode, label: string, disabled = false) => (
    <button
      type="button"
      aria-pressed={mode === value}
      disabled={disabled}
      onClick={() => setChosenMode(value)}
      className={cn(
        'min-h-11 rounded-full px-4 text-sm transition-colors disabled:opacity-50',
        mode === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );

  const numberField = (id: string, label: string, value: string, set: (v: string) => void, suffix?: string, width = 'w-24') => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-baseline gap-1.5">
        <Input id={id} inputMode="decimal" value={value} onChange={e => set(e.target.value)} className={cn('h-10 tabular-nums', width)} />
        {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );

  const plan = mineLoan ? minePlan : simPlan;

  return (
    <>
      {hero}

      <div className="flex flex-col gap-6">
        {hasLoaded && !rowNow && (
          <p className="rounded-2xl bg-muted/50 px-4 py-3 text-sm">
            No published student loan rates cover today, so interest uses the assumptions below.
            {' '}Add this year&apos;s from gov.uk under Assumptions › Published rates.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="View" className="flex rounded-full border border-border/60 bg-card/60 p-1">
            {segment('mine', 'Your loan')}
            {segment('sim', 'Simulator')}
          </div>
          <div className="flex items-center gap-2">
            <Switch id="sl-real" checked={realTerms} onCheckedChange={setRealTerms} />
            <Label htmlFor="sl-real" className="text-sm">Today&apos;s money</Label>
          </div>
        </div>

        {mode === 'mine' && !loan ? (
          <section className="surface-card space-y-3 rounded-3xl border p-6">
            <p className="text-sm">No student loan recorded yet.</p>
            <p className="text-sm text-muted-foreground">
              Add what you borrowed and your latest statement balance, and this shows what you will actually repay on your salary.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>Add student loan</Button>
              <Button variant="outline" onClick={() => setChosenMode('sim')}>Open the simulator</Button>
            </div>
          </section>
        ) : (
          <section aria-label="Timeline" className="surface-card space-y-6 rounded-3xl border p-5 sm:p-6">
            {mineLoan && loans.length > 1 && (
              <div role="group" aria-label="Loan" className="flex flex-wrap gap-2">
                {loans.map(l => (
                  <Button key={l.id} size="sm" variant={l.id === mineLoan.id ? 'default' : 'outline'} aria-pressed={l.id === mineLoan.id} onClick={() => setLoanId(l.id)}>
                    {l.name}
                  </Button>
                ))}
              </div>
            )}
            <StudentLoanTimeline
              key={mineLoan ? `mine-${mineLoan.id}` : 'sim'}
              result={result}
              realTerms={realTerms}
              today={today}
              courseEnd={input.courseEnd}
            />
            <dl className="grid grid-cols-2 gap-4 border-t border-border/40 pt-5 lg:grid-cols-4">
              {readouts.map(r => (
                <div key={r.label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{r.label}</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">{formatGBP(r.value)}</dd>
                  <dd className="text-xs text-muted-foreground">{r.note}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {mode === 'sim' && (
          <section aria-label="Loan to simulate" className="surface-card space-y-5 rounded-3xl border p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">The loan</h3>
                <p className="text-sm text-muted-foreground">Any loan at all. Nothing here is saved.</p>
              </div>
              {loan && <Button variant="outline" onClick={seedFromMine}>Start from my loan</Button>}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sl-plan" className="text-xs text-muted-foreground">Plan</Label>
                <Select value={simPlan} onValueChange={v => setSimPlan(v as StudentLoanPlanKey)}>
                  <SelectTrigger id="sl-plan" className="h-10 w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLANS.map(p => <SelectItem key={p} value={p}>{STUDENT_LOAN_PLAN_LABELS[p]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sl-start" className="text-xs text-muted-foreground">Course starts</Label>
                <Input id="sl-start" type="date" value={courseStart} onChange={e => e.target.value && setCourseStart(e.target.value)} className="h-10 w-44" />
              </div>
              <div className="space-y-1.5">
                <span className="block text-xs text-muted-foreground" id="sl-years-label">Course length</span>
                <div className="flex items-center gap-2" role="group" aria-labelledby="sl-years-label">
                  <Button type="button" variant="outline" size="icon" aria-label="One year shorter" disabled={rows.length <= 1}
                    onClick={() => setRows(r => r.slice(0, -1))}>
                    <Minus className="h-4 w-4" aria-hidden />
                  </Button>
                  <span className="w-16 text-center text-sm tabular-nums">{rows.length} {rows.length === 1 ? 'year' : 'years'}</span>
                  <Button type="button" variant="outline" size="icon" aria-label="One year longer" disabled={rows.length >= 7}
                    onClick={() => setRows(r => [...r, r[r.length - 1] ?? DEFAULT_YEAR])}>
                    <Plus className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[22rem] text-sm">
                <caption className="sr-only">Borrowing per academic year</caption>
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th scope="col" className="pb-2 font-normal">Year</th>
                    <th scope="col" className="pb-2 font-normal">Tuition (£)</th>
                    <th scope="col" className="pb-2 font-normal">Maintenance (£)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, k) => {
                    const start = Number(courseStart.slice(0, 4)) + k;
                    const update = (patch: Partial<YearRow>) => setRows(all => all.map((x, j) => (j === k ? { ...x, ...patch } : x)));
                    return (
                      <tr key={k}>
                        <th scope="row" className="py-1 pr-3 text-left font-normal text-muted-foreground">
                          {k + 1} <span className="text-xs">({start}/{String(start + 1).slice(2)})</span>
                        </th>
                        <td className="py-1 pr-3">
                          <Input inputMode="decimal" aria-label={`Year ${k + 1} tuition`} value={r.tuition} onChange={e => update({ tuition: e.target.value })} className="h-10 w-32 tabular-nums" />
                        </td>
                        <td className="py-1">
                          <Input inputMode="decimal" aria-label={`Year ${k + 1} maintenance`} value={r.maintenance} onChange={e => update({ maintenance: e.target.value })} className="h-10 w-32 tabular-nums" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-4 border-t border-border/40 pt-5">
              {numberField('sl-salary', simFirstDue > today ? `Starting salary (${simFirstDue.slice(0, 4)})` : 'Salary now', simSalary || String(settings.grossSalary || 30000), setSimSalary, 'a year', 'w-32')}
              {numberField('sl-growth', 'Pay rises', salaryGrowth, setSalaryGrowth, '% a year')}
            </div>
            <p className="text-xs text-muted-foreground">
              Course ends {monthYear(simCourseEnd)}. Repayments start {monthYear(simFirstDue)} and anything left is written off {STUDENT_LOAN_WRITE_OFF_YEARS[simPlan]} years later.
            </p>
          </section>
        )}

        {mineLoan && (
          <section aria-label="Your loan" className="surface-card space-y-6 rounded-3xl border p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">{mineLoan.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {STUDENT_LOAN_PLAN_LABELS[minePlan]} · {formatGBP(monthlyNow)} a month from payroll on {formatGBP(salaryNow)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => { setEditing(mineLoan); setFormOpen(true); }}>Edit</Button>
                <Button variant="outline" onClick={seedFromMine}>Try changes in the simulator</Button>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Interest now</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">
                  {mineRate.provisional !== mineRate.rate
                    ? <>{mineRate.provisional.toFixed(2)}% <span className="text-muted-foreground">→</span> {mineRate.rate.toFixed(2)}%</>
                    : `${mineRate.rate.toFixed(2)}%`}
                </dd>
                <dd className="text-xs text-muted-foreground">
                  {rateExplanation}{rowNow ? '' : '. No published rate stored, so this uses the assumptions below'}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{mineFirstDue > today ? 'Repayments start' : 'Repayments started'}</dt>
                <dd className="mt-1 text-xl font-semibold">{monthYear(mineFirstDue)}</dd>
                <dd className="text-xs text-muted-foreground">{courseEndNote}: {monthYear(mineCourseEnd)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Written off</dt>
                <dd className="mt-1 text-xl font-semibold">April {Number(mineFirstDue.slice(0, 4)) + mineWriteOffYears}</dd>
                <dd className="text-xs text-muted-foreground">{mineWriteOffYears} years from the April repayments started, not from when you first borrowed</dd>
              </div>
            </dl>

            {incomes.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-sm font-semibold">Income by tax year</h4>
                <p className="text-xs text-muted-foreground">From your payslips. SLC sets each year&apos;s Plan 2 rate from it.</p>
                <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {incomes.slice(-4).map(i => (
                    <li key={i.taxYear}>
                      <span className="text-muted-foreground">{i.taxYear}-{String(i.taxYear + 1).slice(2)}</span>{' '}
                      <span className="tabular-nums">{formatGBP(i.income)}</span>
                      {i.basis !== 'actual' && <span className="text-xs text-muted-foreground"> {i.basis === 'projected' ? 'so far plus the rest of the year' : 'scaled to a full year'}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {storedRateStale && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-muted/40 px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  The loan has {mineLoan.interestRate.toFixed(2)}% saved; the rules give {roundedRate.toFixed(2)}% today.
                </span>
                <Button size="sm" variant="outline" onClick={() => saveDebt({ ...mineLoan, interestRate: roundedRate, minPayment: monthlyNow })}>
                  Save {roundedRate.toFixed(2)}%
                </Button>
              </p>
            )}

            <div className="grid gap-8 border-t border-border/40 pt-5 md:grid-cols-2">
              <BalanceRecords
                debt={mineLoan}
                expectedOn={date => balanceOnMonth(result, date)?.balance}
                hint="Your online account shows the balance and the date it is as of."
              />
              <LoanMovements loan={mineLoan} />
            </div>
          </section>
        )}

        <details className="surface-card group rounded-3xl border p-5 sm:p-6">
          <summary className="cursor-pointer select-none text-sm font-semibold">
            Assumptions <span className="font-normal text-muted-foreground">· RPI {a.rpi}%, capped at {a.rateCap}%, inflation {a.inflation}%{mode === 'mine' ? `, pay rises ${salaryGrowth}%` : ''}</span>
          </summary>
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap gap-x-6 gap-y-4">
              {numberField('sl-rpi', 'RPI', a.rpi, v => setA({ ...a, rpi: v }), '%')}
              {numberField('sl-cap', 'Interest cap', a.rateCap, v => setA({ ...a, rateCap: v }), '%')}
              {plan === 'plan2' && numberField('sl-upper', 'Full-rate income', a.upperInterestThreshold, v => setA({ ...a, upperInterestThreshold: v }), '£ a year', 'w-28')}
              {(plan === 'plan1' || plan === 'plan4') && numberField('sl-base', 'Bank Rate', a.baseRate, v => setA({ ...a, baseRate: v }), '%')}
              {numberField('sl-threshold-growth', 'Threshold rises', a.thresholdGrowth, v => setA({ ...a, thresholdGrowth: v }), '% a year')}
              {numberField('sl-inflation', 'Inflation', a.inflation, v => setA({ ...a, inflation: v }), '% a year')}
              {mode === 'mine' && numberField('sl-growth-mine', 'Pay rises', salaryGrowth, setSalaryGrowth, '% a year')}
              {numberField('sl-lag', 'Income-linked interest lands', confirmLag, setConfirmLag, 'months after April')}
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>
                Repayment threshold {formatGBP(planRules(plan).threshold)} at {planRules(plan).repaymentRate}%, from your tax settings.
              </li>
              <li>
                {plan === 'plan2' && `Plan 2 charges RPI + 3% while studying, then RPI at the threshold rising to RPI + 3% at ${formatGBP(n(a.upperInterestThreshold))}.`}
                {plan === 'plan5' && 'Plan 5 charges RPI only, at every stage.'}
                {(plan === 'plan1' || plan === 'plan4') && 'Plans 1 and 4 charge the lower of RPI and Bank Rate + 1%.'}
                {plan === 'postgrad' && 'Postgraduate loans charge RPI + 3% throughout.'}
                {' '}Every rate is held at the cap when it would go above it.
              </li>
              <li>
                {rowNow
                  ? `Until ${monthYear(`${Number(rowNow.effectiveFrom.slice(0, 4)) + 1}-${rowNow.effectiveFrom.slice(5)}`)} the published rates apply: RPI ${rowNow.rpi}%${rowNow.rateCap !== null ? `, capped at ${rowNow.rateCap}%` : ''}${rowNow.plan2UpperThreshold ? `, full rate from ${formatGBP(rowNow.plan2UpperThreshold)}` : ''}. The figures above are for the years after.`
                  : 'No published rates are stored, so the figures above apply throughout.'}
                {' '}Bank Rate, inflation, threshold rises and pay rises are planning guesses: change them.
              </li>
              {plan === 'plan2' && (
                <li>
                  SLC charges Plan 2 at the RPI rate through each tax year and adds the income-linked part once HMRC confirms that year&apos;s income,
                  so the balance steps up once a year. Here that lands {slcTiming.confirmationLagMonths} months after the April the tax year ends; the
                  waiting amount earns no interest until it lands, which slightly understates lifetime interest.
                </li>
              )}
              <li>Interest is added monthly on the balance; the Student Loans Company works it out daily, so real statements differ by a little.</li>
            </ul>
            <div className="border-t border-border/40 pt-5">
              <PublishedRates />
            </div>
          </div>
        </details>
      </div>

      <DebtFormDialog open={formOpen} onOpenChange={setFormOpen} kind="student" debt={editing} onSaved={d => { setLoanId(d.id); setChosenMode('mine'); }} />
    </>
  );
}

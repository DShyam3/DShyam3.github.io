/**
 * Debts: borrowing repaid on a schedule -- mortgages, car finance, cards and
 * personal loans.
 *
 * Student loans are not here. They are repaid as a share of income and
 * written off, so "paid off %", "debt-free by" and debt-to-income all read
 * wrongly against one, and adding a written-off balance to a mortgage that
 * must be cleared produced a total that described neither. They have their
 * own section.
 *
 * Every figure comes from `projectDebtBalance`, which is pure and tested. The
 * projection starts at the latest verified balance and runs forward; it does
 * not draw the years before, because the only way to fill them without
 * statements is to invent a curve.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { cn } from '@/lib/utils';
import type { Debt } from '@/features/finance/finance-types';
import { formatGBP } from '@/features/finance/utils/calculations';
import { DEBT_TYPE_LABELS, calculateDebtDrift, projectDebtBalance, type DebtProjectionPoint } from '@/lib/finance';
import { useFinanceData } from '../FinanceDataContext';
import { isStudentLoanDebt, useDebtMutations } from '../useDebtMutations';
import { pathForTab } from '../surfaces';
import { SurfaceHero } from '../components/SurfaceHero';
import { DebtFormDialog } from '../components/DebtFormDialog';
import { BalanceRecords } from '../components/BalanceRecords';

interface DebtOutlook {
  debt: Debt;
  points: DebtProjectionPoint[];
  /** Year the balance reaches its floor, or null if the payment never gets it there. */
  clearedYear: number | null;
  interestToGo: number;
  paidToGo: number;
  repaidShare: number;
}

const outlookFor = (debt: Debt, currentYear: number): DebtOutlook => {
  const points = projectDebtBalance(debt, { grossSalary: 0, repaymentRate: 0, threshold: 0, currentYear });
  const last = points[points.length - 1];
  const floor = debt.repaymentType === 'pcp' ? debt.finalPayment ?? 0 : 0;
  const cleared = !!last && last.balance <= floor + 0.005 && points.length > 1;
  const borrowed = Math.max(debt.originalAmount, debt.balance);
  return {
    debt,
    points,
    clearedYear: cleared ? Math.ceil(last.year) : debt.balance <= 0 ? currentYear : null,
    interestToGo: last?.interest ?? 0,
    paidToGo: last?.paid ?? 0,
    repaidShare: borrowed > 0 ? Math.max(0, Math.min(1, (borrowed - debt.balance) / borrowed)) : 0,
  };
};

const repaymentLine = (debt: Debt) =>
  debt.repaymentType === 'pcp'
    ? `${formatGBP(debt.minPayment)} a month at ${debt.interestRate.toFixed(2)}%, then a ${formatGBP(debt.finalPayment ?? 0)} balloon`
    : `${formatGBP(debt.minPayment)} a month at ${debt.interestRate.toFixed(2)}%`;

export default function DebtsSurface() {
  const { debts, hasLoaded } = useFinanceData();
  const { deleteDebt } = useDebtMutations();
  const { askDelete, deleteDialog } = useDeleteConfirm();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);

  const currentYear = new Date().getFullYear();
  const standard = useMemo(() => debts.filter(d => !isStudentLoanDebt(d)), [debts]);
  const studentTotal = debts.filter(isStudentLoanDebt).reduce((sum, d) => sum + d.balance, 0);

  const outlooks = useMemo(
    () => standard.map(d => outlookFor(d, currentYear)).sort((a, b) => b.debt.balance - a.debt.balance),
    [standard, currentYear],
  );

  const selected = outlooks.find(o => o.debt.id === selectedId) ?? outlooks[0] ?? null;
  const totalOwed = standard.reduce((sum, d) => sum + d.balance, 0);
  const totalMonthly = standard.reduce((sum, d) => sum + (d.balance > 0 ? d.minPayment : 0), 0);
  const debtFreeYear = outlooks.length > 0 && outlooks.every(o => o.clearedYear !== null)
    ? Math.max(...outlooks.map(o => o.clearedYear as number))
    : null;

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (debt: Debt) => { setEditing(debt); setFormOpen(true); };

  return (
    <>
      <SurfaceHero
        loading={!hasLoaded}
        label="Owed"
        value={formatGBP(totalOwed)}
        detail={
          standard.length > 0
            ? `${formatGBP(totalMonthly)} a month across ${standard.length} ${standard.length === 1 ? 'debt' : 'debts'}`
            : 'Nothing recorded'
        }
        aside={
          outlooks.length > 0 ? (
            <>
              <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Debt-free by</p>
              <p className="font-sans text-lg font-bold tabular-nums">{debtFreeYear ?? 'Not on current payments'}</p>
            </>
          ) : null
        }
      />

      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {studentTotal > 0 ? (
              <>
                Your {formatGBP(studentTotal)} student loan is under{' '}
                <Link to={pathForTab('student-loan')} className="font-semibold text-foreground underline underline-offset-4">Student Loan</Link>,
                since it is repaid from salary rather than on a schedule.
              </>
            ) : 'Mortgages, car finance, cards and personal loans.'}
          </p>
          <Button onClick={openAdd} className="gap-1.5">
            <Plus className="h-4 w-4" aria-hidden /> Add debt
          </Button>
        </div>

        {outlooks.length === 0 ? (
          <p className="surface-card rounded-3xl border p-6 text-sm text-muted-foreground">
            No debts recorded. Add one to see when it clears and what it costs in interest.
          </p>
        ) : (
          <>
            <ul className="surface-card divide-y divide-border/60 overflow-hidden rounded-3xl border" aria-label="Debts">
              {outlooks.map(o => {
                const isSelected = selected?.debt.id === o.debt.id;
                return (
                  <li key={o.debt.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedId(o.debt.id)}
                      className={cn(
                        'grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-4 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_8rem_7rem_10rem]',
                        isSelected ? 'bg-primary/10' : 'hover:bg-muted/40',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{o.debt.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[o.debt.lender, DEBT_TYPE_LABELS[o.debt.type]].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="text-right font-semibold tabular-nums">{formatGBP(o.debt.balance)}</span>
                      <span className="text-xs text-muted-foreground sm:text-right">
                        {o.clearedYear
                          ? `${o.debt.repaymentType === 'pcp' ? 'Balloon' : 'Clears'} ${o.clearedYear}`
                          : 'Not clearing'}
                      </span>
                      <span className="flex items-center gap-2 justify-self-end sm:justify-self-stretch">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:flex-1" aria-hidden>
                          <span className="block h-full rounded-full bg-positive" style={{ width: `${o.repaidShare * 100}%` }} />
                        </span>
                        <span className="whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground">{Math.round(o.repaidShare * 100)}% repaid</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {selected && (
              <DebtDetail
                outlook={selected}
                currentYear={currentYear}
                  onEdit={() => openEdit(selected.debt)}
                onDelete={() => askDelete({ name: selected.debt.name, onConfirm: () => deleteDebt(selected.debt.id) })}
              />
            )}
          </>
        )}

        <DebtFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          kind="standard"
          debt={editing}
          onSaved={d => setSelectedId(d.id)}
        />
        {deleteDialog}
      </div>
    </>
  );
}

function DebtDetail({ outlook, currentYear, onEdit, onDelete }: {
  outlook: DebtOutlook;
  currentYear: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { debt, points, clearedYear, interestToGo, paidToGo } = outlook;
  const observations = [...(debt.observations ?? [])].sort((a, b) =>
    (b.statementDate || b.observedOn).localeCompare(a.statementDate || a.observedOn),
  );
  const balloon = debt.repaymentType === 'pcp' ? debt.finalPayment ?? 0 : 0;
  const firstYear = Math.ceil(points[0]?.year ?? currentYear);
  const lastYear = Math.floor(points[points.length - 1]?.year ?? currentYear);
  const every = lastYear - firstYear > 20 ? 5 : lastYear - firstYear > 8 ? 2 : 1;
  const ticks: number[] = [];
  for (let y = Math.ceil(firstYear / every) * every; y <= lastYear; y += every) ticks.push(y);

  const readouts = [
    {
      label: balloon > 0 ? 'Balloon due' : 'Clears',
      value: clearedYear ? String(clearedYear) : 'Never',
      note: clearedYear
        ? `${Math.max(clearedYear - currentYear, 0)} years from now`
        : 'The payment does not cover the interest',
    },
    { label: 'Still to pay', value: formatGBP(paidToGo + balloon), note: balloon > 0 ? `Including the ${formatGBP(balloon)} balloon` : 'Every payment from here' },
    { label: 'Interest to come', value: formatGBP(interestToGo), note: 'What borrowing still costs' },
    { label: 'Monthly', value: formatGBP(debt.minPayment), note: `At ${debt.interestRate.toFixed(2)}% a year` },
  ];

  return (
    <section aria-label={`${debt.name} detail`} className="surface-card space-y-6 rounded-3xl border p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">{debt.name}</h3>
          <p className="text-sm text-muted-foreground">{repaymentLine(debt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onEdit}>Edit</Button>
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>Delete</Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {readouts.map(r => (
          <div key={r.label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{r.value}</dd>
            <dd className="text-xs text-muted-foreground">{r.note}</dd>
          </div>
        ))}
      </dl>

      {points.length > 1 ? (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="debt-balance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="debt-paid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--positive))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--positive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="year"
                type="number"
                domain={['dataMin', 'dataMax']}
                ticks={ticks}
                tickFormatter={(y: number) => String(Math.round(y))}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `£${Math.round(v / 1000)}k`}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: 12,
                }}
                labelFormatter={(y: number) => String(Math.round(y))}
                formatter={(v: number, name: string) => [formatGBP(v), name]}
              />
              <Area type="monotone" dataKey="balance" name="Owed" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#debt-balance)" />
              <Area type="monotone" dataKey="paid" name="Paid from now" stroke="hsl(var(--positive))" strokeWidth={2} fill="url(#debt-paid)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Add a monthly payment to see when this clears.</p>
      )}

      <div className="grid gap-6 border-t border-border/40 pt-5 md:grid-cols-2">
        <BalanceRecords
          debt={debt}
          expectedOn={date => {
            // What the fixed payment and rate predict from the last verified
            // balance; the gap is what a new statement tells you.
            const last = observations[0];
            if (!last) return undefined;
            return calculateDebtDrift({
              anchorBalance: last.balance,
              anchorDate: last.statementDate || last.observedOn,
              targetBalance: 0,
              targetDate: date,
              monthlyPayment: debt.minPayment,
              interestRate: debt.interestRate,
              ratePeriods: debt.ratePeriods,
            }).predictedBalance;
          }}
          hint="Use the figure on your latest statement or online account."
        />
        <section aria-label="Borrowing history" className="space-y-2">
          <h4 className="text-sm font-semibold">Borrowed</h4>
          <p className="text-sm tabular-nums">
            {formatGBP(Math.max(debt.originalAmount, debt.balance))}
            {debt.startDate ? <span className="text-muted-foreground"> · taken on {debt.startDate}</span> : null}
          </p>
          {debt.draws?.length ? (
            <ul className="divide-y divide-border/60 text-sm">
              {[...debt.draws].sort((a, b) => b.date.localeCompare(a.date)).map(d => (
                <li key={d.id} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-muted-foreground">{d.label || 'Advance'} · {d.date}</span>
                  <span className="shrink-0 tabular-nums">{formatGBP(d.amount)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {debt.notes ? <p className="whitespace-pre-wrap break-words text-sm">{debt.notes}</p> : null}
        </section>
      </div>
    </section>
  );
}

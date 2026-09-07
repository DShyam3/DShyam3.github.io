import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useFinanceData } from '../FinanceDataContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Debt, DebtDraw } from '@/features/finance/finance-types';
import { formatGBP } from '@/features/finance/utils/calculations';
import {
  DEBT_TYPE_LABELS,
  RatePeriod,
  STUDENT_LOAN_PLAN_LABELS,
  STUDENT_LOAN_WRITE_OFF_YEARS,
  StudentLoanPlanKey,
  projectDebtBalance,
} from '@/lib/finance';
import { cn } from '@/lib/utils';
import { CheckCircle2, Edit2, Landmark, Plus, Scale, Trash2, TrendingDown } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import DebtReconcileDialog from '../dialogs/DebtReconcileDialog';

/**
 * Editor for a debt's borrowing tranches — e.g. one row per academic year of
 * student loan. Shared by the add and edit debt dialogs.
 */
const DebtDrawsEditor = ({
  draws,
  newDraw,
  setNewDraw,
  onAdd,
  onRemove,
  idPrefix,
}: {
  draws: DebtDraw[];
  newDraw: { date: string; amount: number | ''; label: string };
  setNewDraw: (draw: { date: string; amount: number | ''; label: string }) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  idPrefix: string;
}) => {
  const total = draws.reduce((sum, d) => sum + d.amount, 0);
  return (
    <div className="space-y-2 border-t border-border/30 pt-4">
      <div className="flex items-center justify-between">
        <Label>Borrowing History</Label>
        {draws.length > 0 && (
          <span className="text-xs font-mono text-muted-foreground">Total {formatGBP(total)}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Add each amount as you borrowed it — one per academic year for a student loan. Leave empty for a single lump sum.
      </p>

      {draws.length > 0 && (
        <div className="space-y-1.5">
          {[...draws].sort((a, b) => a.date.localeCompare(b.date)).map(draw => (
            <div key={draw.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-muted/20 px-3 py-1.5 font-mono">
              <div className="min-w-0">
                <span className="text-xs font-mono font-semibold text-foreground">{formatGBP(draw.amount)}</span>
                <span className="block text-xs text-muted-foreground truncate">
                  {new Date(draw.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  {draw.label ? ` · ${draw.label}` : ''}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => onRemove(draw.id)}
                className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Input
          id={`${idPrefix}-draw-date`}
          type="date"
          aria-label="Borrowing date"
          value={newDraw.date}
          onChange={(e) => setNewDraw({ ...newDraw, date: e.target.value })}
          className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
        />
        <Input
          id={`${idPrefix}-draw-amount`}
          type="number"
          step="0.01"
          aria-label="Borrowing amount"
          placeholder="Amount (£)"
          value={newDraw.amount}
          onChange={(e) => setNewDraw({ ...newDraw, amount: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
          className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
        />
      </div>
      <div className="flex gap-2">
        <Input
          id={`${idPrefix}-draw-label`}
          aria-label="Borrowing label"
          placeholder="Label, e.g. Year 1 tuition"
          value={newDraw.label}
          onChange={(e) => setNewDraw({ ...newDraw, label: e.target.value })}
          className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
        />
        <Button type="button" onClick={onAdd} variant="outline" className="rounded-lg h-9 px-3 shrink-0 gap-1 text-xs font-mono">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
};

export default function DebtsSection({ totalLoanBalance }: { totalLoanBalance: number }) {
  const { toast } = useToast();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const {
    bankAccounts,
    creditScores,
    debts,
    memberships,
    saveDataToSupabase,
    setDebts,
    settings,
    taxConfig,
  } = useFinanceData();

  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [isEditDebtOpen, setIsEditDebtOpen] = useState(false);
  const [activeDebt, setActiveDebt] = useState<Debt | null>(null);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [reconcileDebt, setReconcileDebt] = useState<Debt | null>(null);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);

  const emptyDebtForm: Omit<Debt, 'id' | 'originalAmount' | 'balance' | 'interestRate' | 'minPayment' | 'finalPayment'> & {
    originalAmount: number | '';
    balance: number | '';
    interestRate: number | '';
    minPayment: number | '';
    finalPayment: number | '';
  } = {
    name: '',
    type: 'mortgage' as Debt['type'],
    lender: '',
    originalAmount: '' as number | '',
    balance: '' as number | '',
    interestRate: '' as number | '',
    minPayment: '' as number | '',
    finalPayment: '' as number | '',
    startDate: '',
    payoffDate: '',
    repaymentType: 'amortising' as Debt['repaymentType'],
    studentLoanPlan: undefined,
    writeOffYears: undefined,
    draws: [] as DebtDraw[],
    ratePeriods: [] as RatePeriod[],
    notes: '',
    emoji: '',
    color: 'hsl(var(--destructive))',
  };

  const [newDebt, setNewDebt] = useState<typeof emptyDebtForm>(emptyDebtForm);
  const [newDraw, setNewDraw] = useState<{ date: string; amount: number | ''; label: string }>({ date: '', amount: '', label: '' });

  const sumDraws = (draws: DebtDraw[]) => draws.reduce((sum, d) => sum + d.amount, 0);

  const handleAddDraw = () => {
    if (!newDraw.date || newDraw.amount === '') {
      toast({ title: 'Error', description: 'Enter a date and amount for the borrowing.', variant: 'destructive' });
      return;
    }
    const draw: DebtDraw = {
      id: 'dw_' + Date.now(),
      date: newDraw.date,
      amount: Math.abs(newDraw.amount),
      label: newDraw.label || undefined,
    };
    if (isEditDebtOpen && activeDebt) {
      setActiveDebt({ ...activeDebt, draws: [...activeDebt.draws, draw] });
    } else {
      setNewDebt({ ...newDebt, draws: [...newDebt.draws, draw] });
    }
    setNewDraw({ date: '', amount: '', label: '' });
  };

  const performRemoveDraw = (drawId: string) => {
    if (isEditDebtOpen && activeDebt) {
      setActiveDebt({ ...activeDebt, draws: activeDebt.draws.filter(d => d.id !== drawId) });
    } else {
      setNewDebt({ ...newDebt, draws: newDebt.draws.filter(d => d.id !== drawId) });
    }
  };

  const handleRemoveDraw = (drawId: string) =>
    askDelete({
      title: 'Remove borrowing',
      confirmLabel: 'Remove',
      description: 'Remove this borrowing from the debt? This action cannot be undone.',
      onConfirm: () => performRemoveDraw(drawId),
    });

  const handleAddDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDebt.name) {
      toast({ title: 'Error', description: 'Please enter a debt name.', variant: 'destructive' });
      return;
    }
    const balance = newDebt.balance === '' ? 0 : Math.abs(newDebt.balance);
    const drawTotal = sumDraws(newDebt.draws);
    const created: Debt = {
      ...newDebt,
      originalAmount: drawTotal > 0
        ? drawTotal
        : (newDebt.originalAmount === '' ? balance : Math.abs(newDebt.originalAmount)),
      balance,
      interestRate: newDebt.interestRate === '' ? 0 : newDebt.interestRate,
      minPayment: newDebt.minPayment === '' ? 0 : newDebt.minPayment,
      finalPayment: newDebt.finalPayment === '' ? 0 : Math.abs(newDebt.finalPayment),
      startDate: newDebt.startDate || newDebt.draws[0]?.date || undefined,
      payoffDate: newDebt.payoffDate || undefined,
      writeOffYears: newDebt.repaymentType === 'income_contingent'
        ? (newDebt.writeOffYears ?? (newDebt.studentLoanPlan ? STUDENT_LOAN_WRITE_OFF_YEARS[newDebt.studentLoanPlan] : undefined))
        : undefined,
      ratePeriods: newDebt.ratePeriods || [],
      notes: newDebt.notes || undefined,
      id: 'd_' + Date.now(),
    };
    const updated = [...debts, created];
    setDebts(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships, creditScores, debts: updated });
    setIsAddDebtOpen(false);
    setNewDebt(emptyDebtForm);
    setNewDraw({ date: '', amount: '', label: '' });
    setSelectedDebtId(created.id);
    toast({ title: 'Debt Added', description: `Added "${created.name}".` });
  };

  const handleEditDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDebt) return;
    const drawTotal = sumDraws(activeDebt.draws);
    const normalized: Debt = {
      ...activeDebt,
      balance: Math.abs(activeDebt.balance),
      originalAmount: drawTotal > 0 ? drawTotal : Math.abs(activeDebt.originalAmount),
      finalPayment: activeDebt.finalPayment ? Math.abs(activeDebt.finalPayment) : 0,
      ratePeriods: activeDebt.ratePeriods || [],
      startDate: activeDebt.startDate || activeDebt.draws[0]?.date || undefined,
    };
    const updated = debts.map(d => d.id === normalized.id ? normalized : d);
    setDebts(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships, creditScores, debts: updated });
    setIsEditDebtOpen(false);
    setActiveDebt(null);
    setNewDraw({ date: '', amount: '', label: '' });
    toast({ title: 'Debt Updated', description: 'Debt details saved.' });
  };

  const performDeleteDebt = (id: string) => {
    const updated = debts.filter(d => d.id !== id);
    setDebts(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships, creditScores, debts: updated });
    if (selectedDebtId === id) setSelectedDebtId(null);
    toast({ title: 'Debt Deleted', description: 'Debt removed.' });
  };

  const handleDeleteDebt = (id: string) =>
    askDelete({
      name: debts.find(d => d.id === id)?.name,
      onConfirm: () => performDeleteDebt(id),
    });

  const totalLoanOriginal = debts.reduce((sum, d) => sum + Math.max(d.originalAmount, d.balance), 0);
  const totalLoanPaid = Math.max(totalLoanOriginal - totalLoanBalance, 0);
  const loanPayoffPercent = totalLoanOriginal > 0 ? (totalLoanPaid / totalLoanOriginal) * 100 : 0;
  const totalMinPayments = debts.reduce((sum, d) => sum + d.minPayment, 0);
  const selectedDebt = debts.find(d => d.id === selectedDebtId) || debts[0] || null;
  const selectedDebtProjection = selectedDebt
    ? projectDebtBalance(selectedDebt, {
        grossSalary: settings.grossSalary,
        repaymentRate: selectedDebt.studentLoanPlan ? (taxConfig.studentLoanRates[selectedDebt.studentLoanPlan] || 0) : 0,
        threshold: selectedDebt.studentLoanPlan ? (taxConfig.studentLoanThresholds[selectedDebt.studentLoanPlan] || 0) : 0,
      })
    : [];
  const selectedDebtFinal = selectedDebtProjection[selectedDebtProjection.length - 1];
  const weightedInterestRate = totalLoanBalance > 0
    ? debts.reduce((sum, d) => sum + d.interestRate * d.balance, 0) / totalLoanBalance
    : 0;

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
          <div className="min-w-0">
            <h3 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary shrink-0" /> Debt
            </h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">Track mortgages, student loans and other borrowing against payoff progress</p>
          </div>
          <Button onClick={() => setIsAddDebtOpen(true)} className="rounded-lg gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8 px-3 shrink-0 self-start sm:self-auto font-mono">
            <Plus className="h-3.5 w-3.5" /> Add Debt
          </Button>
        </div>

        {debts.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Owed', value: formatGBP(totalLoanBalance), tone: 'text-destructive' },
              { label: 'Paid Off', value: `${loanPayoffPercent.toFixed(1)}%`, tone: 'text-positive' },
              { label: 'Monthly Payments', value: formatGBP(totalMinPayments), tone: 'text-foreground' },
              { label: 'Avg Rate', value: `${weightedInterestRate.toFixed(2)}%`, tone: 'text-foreground' },
            ].map(stat => (
              <div key={stat.label} className="bg-card/50 border border-border/40 rounded-xl p-3 sm:p-4 hover:border-border/80 transition-colors">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-mono font-semibold block">{stat.label}</span>
                <span className={cn("text-base sm:text-lg font-bold font-mono tabular-nums block truncate mt-1", stat.tone)}>{stat.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-auto max-h-[60vh] bg-card/50 border border-border/40 rounded-xl p-4 sm:p-5 hover:border-border/80 transition-colors">
          <table className="min-w-[820px] w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground uppercase tracking-wider font-semibold">
                <th className="py-3 px-3 whitespace-nowrap">Name</th>
                <th className="py-3 px-3 whitespace-nowrap">Type</th>
                <th className="py-3 px-3 whitespace-nowrap">Lender</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Balance</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Rate</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Monthly</th>
                <th className="py-3 px-3 whitespace-nowrap min-w-[140px]">Payoff Progress</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {debts.map(debt => {
                const original = Math.max(debt.originalAmount, debt.balance);
                const paidPercent = original > 0 ? ((original - debt.balance) / original) * 100 : 0;
                const isSelected = selectedDebt?.id === debt.id;
                return (
                  <tr
                    key={debt.id}
                    onClick={() => setSelectedDebtId(debt.id)}
                    className={cn("cursor-pointer transition-colors", isSelected ? "bg-primary/5" : "hover:bg-muted/10")}
                  >
                    <td className="py-3 px-3 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-1.5 h-6 rounded-full shrink-0"
                          style={{ backgroundColor: debt.color || 'hsl(var(--destructive))' }}
                        />
                        <span className="text-base shrink-0 leading-none">{debt.emoji || '🏦'}</span>
                        <span>{debt.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span>{DEBT_TYPE_LABELS[debt.type] || debt.type}</span>
                      {debt.studentLoanPlan && (
                        <span className="block text-xs text-muted-foreground">{STUDENT_LOAN_PLAN_LABELS[debt.studentLoanPlan]}</span>
                      )}
                    </td>
                    <td className="py-3 px-3">{debt.lender || '—'}</td>
                    <td className="py-3 px-3 text-right font-mono">
                      <div className="font-bold text-destructive">{formatGBP(debt.balance)}</div>
                      {debt.observations && debt.observations.length > 0 && (
                        <span className="text-[10px] text-muted-foreground block truncate">
                          as of {debt.observations[0].statementDate || debt.observations[0].observedOn}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">{debt.interestRate.toFixed(2)}%</td>
                    <td className="py-3 px-3 text-right font-mono">{formatGBP(debt.minPayment)}</td>
                    <td className="py-3 px-3">
                      <div className="space-y-1 min-w-[120px]">
                        <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-positive transition-all"
                            style={{ width: `${Math.min(Math.max(paidPercent, 0), 100)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                          <span>{paidPercent.toFixed(0)}% paid</span>
                          {debt.payoffDate && <span>{new Date(debt.payoffDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Reconcile & Record Balance"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReconcileDebt(debt);
                            setIsReconcileOpen(true);
                          }}
                          className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                        >
                          <Scale className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDebt({ ...debt, draws: debt.draws || [] });
                            setIsEditDebtOpen(true);
                          }}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); handleDeleteDebt(debt.id); }}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {debts.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-6 italic text-muted-foreground">No debts tracked.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Payoff projection for the selected debt */}
        {selectedDebt && (
          <div className="rounded-xl border border-border/40 bg-card/50 p-4 sm:p-5 hover:border-border/80 transition-colors space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h4 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-primary shrink-0" /> {selectedDebt.name} — Payoff Projection
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedDebt.repaymentType === 'income_contingent'
                    ? `${selectedDebt.studentLoanPlan ? STUDENT_LOAN_PLAN_LABELS[selectedDebt.studentLoanPlan] : 'Income-contingent'}: ${selectedDebt.studentLoanPlan ? (taxConfig.studentLoanRates[selectedDebt.studentLoanPlan] || 0) : 0}% of income above ${formatGBP(selectedDebt.studentLoanPlan ? (taxConfig.studentLoanThresholds[selectedDebt.studentLoanPlan] || 0) : 0)}, written off after ${selectedDebt.writeOffYears ?? '—'} years`
                    : selectedDebt.repaymentType === 'pcp'
                      ? `PCP: ${formatGBP(selectedDebt.minPayment)}/month amortising to ${formatGBP(selectedDebt.finalPayment || 0)} balloon`
                      : `Fixed repayment of ${formatGBP(selectedDebt.minPayment)}/month at ${selectedDebt.interestRate.toFixed(2)}%`}
                </p>
                {selectedDebt.observations && selectedDebt.observations.length > 0 && (
                  <p className="text-[11px] font-mono text-positive mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Anchored on {selectedDebt.observations[0].statementDate || selectedDebt.observations[0].observedOn} verified balance of {formatGBP(selectedDebt.observations[0].balance)}
                  </p>
                )}
              </div>
              {debts.length > 1 && (
                <Select value={selectedDebt.id} onValueChange={setSelectedDebtId}>
                  <SelectTrigger className="bg-background/50 border border-border/40 rounded-lg h-9 text-xs w-full sm:w-56 shrink-0 font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border border-border/40 bg-popover font-mono text-xs">
                    {debts.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedDebtFinal && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">Cleared By</span>
                  <span className="text-sm font-bold font-mono text-foreground">
                    {selectedDebtFinal.balance <= 0 ? Math.round(selectedDebtFinal.year) : 'Not on track'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">Total Repaid</span>
                  <span className="text-sm font-bold font-mono text-foreground">{formatGBP(selectedDebtFinal.paid)}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">Interest Paid</span>
                  <span className="text-sm font-bold font-mono text-chart-4">{formatGBP(selectedDebtFinal.interest)}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">Written Off</span>
                  <span className="text-sm font-bold font-mono text-positive">{formatGBP(selectedDebtFinal.writtenOff)}</span>
                </div>
              </div>
            )}

            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={selectedDebtProjection} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="debtBalanceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="debtPaidFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--positive))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--positive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tickFormatter={(v) => String(Math.round(v))}
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tickFormatter={(v) => `£${Math.round(v / 1000)}k`}
                    tick={{ fontSize: 10 }}
                    width={48}
                    className="text-muted-foreground"
                  />
                  <RechartsTooltip
                    formatter={(value: number, name: string) => [formatGBP(value), name]}
                    labelFormatter={(label) => `Year ${Math.round(Number(label))}`}
                    contentStyle={{ borderRadius: '0.75rem', fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    name="Outstanding"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    fill="url(#debtBalanceFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="paid"
                    name="Repaid"
                    stroke="hsl(var(--positive))"
                    strokeWidth={2}
                    fill="url(#debtPaidFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Borrowing tranches */}
            {(selectedDebt.draws?.length ?? 0) > 0 && (
              <div className="border-t border-border/30 pt-4 space-y-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">
                  Borrowing History — {formatGBP(sumDraws(selectedDebt.draws))} across {selectedDebt.draws.length} {selectedDebt.draws.length === 1 ? 'draw' : 'draws'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {[...selectedDebt.draws].sort((a, b) => a.date.localeCompare(b.date)).map(draw => (
                    <div key={draw.id} className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2 text-xs font-mono">
                      <span className="font-mono font-bold text-foreground block">{formatGBP(draw.amount)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(draw.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                        {draw.label ? ` · ${draw.label}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Debt Dialog */}
      <Dialog open={isAddDebtOpen} onOpenChange={setIsAddDebtOpen}>
        <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm max-h-[85vh] overflow-y-auto font-mono shadow-none">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Add Debt</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">Track a mortgage, student loan or other borrowing.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddDebt} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="debt-name" className="text-xs font-mono text-muted-foreground">Debt Name</Label>
              <Input
                id="debt-name"
                placeholder="e.g. Flat Mortgage"
                value={newDebt.name}
                onChange={(e) => setNewDebt({ ...newDebt, name: e.target.value })}
                className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="debt-type" className="text-xs font-mono text-muted-foreground">Debt Type</Label>
              <Select
                value={newDebt.type}
                onValueChange={(val) => setNewDebt({ ...newDebt, type: val as Debt['type'] })}
              >
                <SelectTrigger id="debt-type" className="bg-background/50 border border-border/40 rounded-lg h-9 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg border border-border/40 bg-popover text-xs font-mono">
                  {Object.entries(DEBT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="debt-repayment" className="text-xs font-mono text-muted-foreground">How It's Repaid</Label>
              <Select
                value={newDebt.repaymentType}
                onValueChange={(val) => setNewDebt({
                  ...newDebt,
                  repaymentType: val as Debt['repaymentType'],
                  studentLoanPlan: val === 'income_contingent' ? (newDebt.studentLoanPlan || 'plan2') : undefined,
                  writeOffYears: val === 'income_contingent'
                    ? (newDebt.writeOffYears ?? STUDENT_LOAN_WRITE_OFF_YEARS[newDebt.studentLoanPlan || 'plan2'])
                    : undefined,
                })}
              >
                <SelectTrigger id="debt-repayment" className="bg-background/50 border border-border/40 rounded-lg h-9 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg border border-border/40 bg-popover text-xs font-mono">
                  <SelectItem value="amortising">Fixed monthly payment</SelectItem>
                  <SelectItem value="income_contingent">% of income over threshold</SelectItem>
                  <SelectItem value="pcp">PCP (with balloon payment)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newDebt.repaymentType === 'pcp' && (
              <div className="space-y-1">
                <Label htmlFor="debt-balloon" className="text-xs font-mono text-muted-foreground">Balloon / Final Payment (£)</Label>
                <Input
                  id="debt-balloon"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 8000"
                  value={newDebt.finalPayment}
                  onChange={(e) => setNewDebt({ ...newDebt, finalPayment: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                />
              </div>
            )}
            {newDebt.repaymentType === 'income_contingent' && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="debt-plan" className="text-xs font-mono text-muted-foreground">Student Loan Plan</Label>
                  <Select
                    value={newDebt.studentLoanPlan || 'plan2'}
                    onValueChange={(val) => setNewDebt({
                      ...newDebt,
                      studentLoanPlan: val as StudentLoanPlanKey,
                      writeOffYears: STUDENT_LOAN_WRITE_OFF_YEARS[val as StudentLoanPlanKey],
                    })}
                  >
                    <SelectTrigger id="debt-plan" className="bg-background/50 border border-border/40 rounded-lg h-9 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border border-border/40 bg-popover text-xs font-mono">
                      {Object.entries(STUDENT_LOAN_PLAN_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs font-mono text-muted-foreground">
                    Repays {taxConfig.studentLoanRates[newDebt.studentLoanPlan || 'plan2'] || 0}% of income above {formatGBP(taxConfig.studentLoanThresholds[newDebt.studentLoanPlan || 'plan2'] || 0)}.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="debt-writeoff" className="text-xs font-mono text-muted-foreground">Written Off After (years)</Label>
                  <Input
                    id="debt-writeoff"
                    type="number"
                    value={newDebt.writeOffYears ?? ''}
                    onChange={(e) => setNewDebt({ ...newDebt, writeOffYears: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                    className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                  />
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label htmlFor="debt-lender" className="text-xs font-mono text-muted-foreground">Lender</Label>
              <Input
                id="debt-lender"
                placeholder="e.g. Nationwide"
                value={newDebt.lender}
                onChange={(e) => setNewDebt({ ...newDebt, lender: e.target.value })}
                className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="debt-original" className="text-xs font-mono text-muted-foreground">Original (£)</Label>
                <Input
                  id="debt-original"
                  type="number"
                  step="0.01"
                  placeholder="250000"
                  value={newDebt.draws.length > 0 ? sumDraws(newDebt.draws) : newDebt.originalAmount}
                  onChange={(e) => setNewDebt({ ...newDebt, originalAmount: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                  disabled={newDebt.draws.length > 0}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono disabled:opacity-70"
                />
                {newDebt.draws.length > 0 && (
                  <p className="text-xs font-mono text-muted-foreground">Summed from borrowing history</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="debt-balance" className="text-xs font-mono text-muted-foreground">Owed Now (£)</Label>
                <Input
                  id="debt-balance"
                  type="number"
                  step="0.01"
                  placeholder="198400"
                  value={newDebt.balance}
                  onChange={(e) => setNewDebt({ ...newDebt, balance: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="debt-rate" className="text-xs font-mono text-muted-foreground">Interest Rate (%)</Label>
                <Input
                  id="debt-rate"
                  type="number"
                  step="0.01"
                  placeholder="4.75"
                  value={newDebt.interestRate}
                  onChange={(e) => setNewDebt({ ...newDebt, interestRate: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="debt-payment" className="text-xs font-mono text-muted-foreground">Monthly (£)</Label>
                <Input
                  id="debt-payment"
                  type="number"
                  step="0.01"
                  placeholder="1150"
                  value={newDebt.minPayment}
                  onChange={(e) => setNewDebt({ ...newDebt, minPayment: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="debt-start" className="text-xs font-mono text-muted-foreground">Taken On</Label>
                <Input
                  id="debt-start"
                  type="date"
                  value={newDebt.startDate}
                  onChange={(e) => setNewDebt({ ...newDebt, startDate: e.target.value })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="debt-payoff" className="text-xs font-mono text-muted-foreground">Expected Payoff</Label>
                <Input
                  id="debt-payoff"
                  type="date"
                  value={newDebt.payoffDate}
                  onChange={(e) => setNewDebt({ ...newDebt, payoffDate: e.target.value })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                />
              </div>
            </div>

            <DebtDrawsEditor
              draws={newDebt.draws}
              newDraw={newDraw}
              setNewDraw={setNewDraw}
              onAdd={handleAddDraw}
              onRemove={handleRemoveDraw}
              idPrefix="add"
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="debt-emoji" className="text-xs font-mono text-muted-foreground">Emoji</Label>
                <Input
                  id="debt-emoji"
                  placeholder="🏠"
                  value={newDebt.emoji}
                  onChange={(e) => setNewDebt({ ...newDebt, emoji: e.target.value })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-center text-sm font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="debt-color" className="text-xs font-mono text-muted-foreground">Colour</Label>
                <Input
                  id="debt-color"
                  type="color"
                  value={newDebt.color}
                  onChange={(e) => setNewDebt({ ...newDebt, color: e.target.value })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 p-1 cursor-pointer"
                />
              </div>
            </div>
            <DialogFooter className="pt-4 gap-2 sm:gap-0">
              <Button variant="outline" type="button" onClick={() => setIsAddDebtOpen(false)} className="rounded-lg h-9 px-4 text-xs font-mono border-border/40">Cancel</Button>
              <Button type="submit" className="rounded-lg h-9 px-4 text-xs font-mono bg-primary text-primary-foreground">Save Debt</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Debt Dialog */}
      <Dialog open={isEditDebtOpen} onOpenChange={setIsEditDebtOpen}>
        <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm max-h-[85vh] overflow-y-auto font-mono shadow-none">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Edit Debt</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">Update balance, rate or payoff schedule.</DialogDescription>
          </DialogHeader>
          {activeDebt && (
            <form onSubmit={handleEditDebt} className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="edit-debt-name" className="text-xs font-mono text-muted-foreground">Debt Name</Label>
                <Input
                  id="edit-debt-name"
                  value={activeDebt.name}
                  onChange={(e) => setActiveDebt({ ...activeDebt, name: e.target.value })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-debt-type" className="text-xs font-mono text-muted-foreground">Debt Type</Label>
                <Select
                  value={activeDebt.type}
                  onValueChange={(val) => setActiveDebt({ ...activeDebt, type: val as Debt['type'] })}
                >
                  <SelectTrigger id="edit-debt-type" className="bg-background/50 border border-border/40 rounded-lg h-9 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border border-border/40 bg-popover text-xs font-mono">
                    {Object.entries(DEBT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-debt-repayment" className="text-xs font-mono text-muted-foreground">How It's Repaid</Label>
                <Select
                  value={activeDebt.repaymentType}
                  onValueChange={(val) => setActiveDebt({
                    ...activeDebt,
                    repaymentType: val as Debt['repaymentType'],
                    studentLoanPlan: val === 'income_contingent' ? (activeDebt.studentLoanPlan || 'plan2') : undefined,
                    writeOffYears: val === 'income_contingent'
                      ? (activeDebt.writeOffYears ?? STUDENT_LOAN_WRITE_OFF_YEARS[activeDebt.studentLoanPlan || 'plan2'])
                      : undefined,
                  })}
                >
                  <SelectTrigger id="edit-debt-repayment" className="bg-background/50 border border-border/40 rounded-lg h-9 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border border-border/40 bg-popover text-xs font-mono">
                    <SelectItem value="amortising">Fixed monthly payment</SelectItem>
                    <SelectItem value="income_contingent">% of income over threshold</SelectItem>
                    <SelectItem value="pcp">PCP (with balloon payment)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {activeDebt.repaymentType === 'pcp' && (
                <div className="space-y-1">
                  <Label htmlFor="edit-debt-balloon" className="text-xs font-mono text-muted-foreground">Balloon / Final Payment (£)</Label>
                  <Input
                    id="edit-debt-balloon"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 8000"
                    value={activeDebt.finalPayment ?? ''}
                    onChange={(e) => setActiveDebt({ ...activeDebt, finalPayment: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                  />
                </div>
              )}
              {activeDebt.repaymentType === 'income_contingent' && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="edit-debt-plan" className="text-xs font-mono text-muted-foreground">Student Loan Plan</Label>
                    <Select
                      value={activeDebt.studentLoanPlan || 'plan2'}
                      onValueChange={(val) => setActiveDebt({
                        ...activeDebt,
                        studentLoanPlan: val as StudentLoanPlanKey,
                        writeOffYears: STUDENT_LOAN_WRITE_OFF_YEARS[val as StudentLoanPlanKey],
                      })}
                    >
                      <SelectTrigger id="edit-debt-plan" className="bg-background/50 border border-border/40 rounded-lg h-9 text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border border-border/40 bg-popover text-xs font-mono">
                        {Object.entries(STUDENT_LOAN_PLAN_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs font-mono text-muted-foreground">
                      Repays {taxConfig.studentLoanRates[activeDebt.studentLoanPlan || 'plan2'] || 0}% of income above {formatGBP(taxConfig.studentLoanThresholds[activeDebt.studentLoanPlan || 'plan2'] || 0)}.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-debt-writeoff" className="text-xs font-mono text-muted-foreground">Written Off After (years)</Label>
                    <Input
                      id="edit-debt-writeoff"
                      type="number"
                      value={activeDebt.writeOffYears ?? ''}
                      onChange={(e) => setActiveDebt({ ...activeDebt, writeOffYears: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                      className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                    />
                  </div>
                </>
              )}
              <div className="space-y-1">
                <Label htmlFor="edit-debt-lender" className="text-xs font-mono text-muted-foreground">Lender</Label>
                <Input
                  id="edit-debt-lender"
                  value={activeDebt.lender}
                  onChange={(e) => setActiveDebt({ ...activeDebt, lender: e.target.value })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-debt-original" className="text-xs font-mono text-muted-foreground">Original (£)</Label>
                  <Input
                    id="edit-debt-original"
                    type="number"
                    step="0.01"
                    value={activeDebt.draws.length > 0 ? sumDraws(activeDebt.draws) : activeDebt.originalAmount}
                    onChange={(e) => setActiveDebt({ ...activeDebt, originalAmount: parseFloat(e.target.value) || 0 })}
                    disabled={activeDebt.draws.length > 0}
                    className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono disabled:opacity-70"
                  />
                  {activeDebt.draws.length > 0 && (
                    <p className="text-xs font-mono text-muted-foreground">Summed from borrowing history</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-debt-balance" className="text-xs font-mono text-muted-foreground">Owed Now (£)</Label>
                  <Input
                    id="edit-debt-balance"
                    type="number"
                    step="0.01"
                    value={activeDebt.balance}
                    onChange={(e) => setActiveDebt({ ...activeDebt, balance: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-debt-rate" className="text-xs font-mono text-muted-foreground">Interest Rate (%)</Label>
                  <Input
                    id="edit-debt-rate"
                    type="number"
                    step="0.01"
                    value={activeDebt.interestRate}
                    onChange={(e) => setActiveDebt({ ...activeDebt, interestRate: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-debt-payment" className="text-xs font-mono text-muted-foreground">Monthly (£)</Label>
                  <Input
                    id="edit-debt-payment"
                    type="number"
                    step="0.01"
                    value={activeDebt.minPayment}
                    onChange={(e) => setActiveDebt({ ...activeDebt, minPayment: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-debt-start" className="text-xs font-mono text-muted-foreground">Taken On</Label>
                  <Input
                    id="edit-debt-start"
                    type="date"
                    value={activeDebt.startDate || ''}
                    onChange={(e) => setActiveDebt({ ...activeDebt, startDate: e.target.value || undefined })}
                    className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-debt-payoff" className="text-xs font-mono text-muted-foreground">Expected Payoff</Label>
                  <Input
                    id="edit-debt-payoff"
                    type="date"
                    value={activeDebt.payoffDate || ''}
                    onChange={(e) => setActiveDebt({ ...activeDebt, payoffDate: e.target.value || undefined })}
                    className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                  />
                </div>
              </div>

              <DebtDrawsEditor
                draws={activeDebt.draws}
                newDraw={newDraw}
                setNewDraw={setNewDraw}
                onAdd={handleAddDraw}
                onRemove={handleRemoveDraw}
                idPrefix="edit"
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-debt-emoji" className="text-xs font-mono text-muted-foreground">Emoji</Label>
                  <Input
                    id="edit-debt-emoji"
                    value={activeDebt.emoji || ''}
                    onChange={(e) => setActiveDebt({ ...activeDebt, emoji: e.target.value })}
                    className="rounded-lg h-9 border border-border/40 bg-background/50 text-center text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-debt-color" className="text-xs font-mono text-muted-foreground">Colour</Label>
                  <Input
                    id="edit-debt-color"
                    type="color"
                    value={activeDebt.color || 'hsl(var(--destructive))'}
                    onChange={(e) => setActiveDebt({ ...activeDebt, color: e.target.value })}
                    className="rounded-lg h-9 border border-border/40 bg-background/50 p-1 cursor-pointer"
                  />
                </div>
              </div>
              <DialogFooter className="pt-4 gap-2 sm:gap-0">
                <Button variant="outline" type="button" onClick={() => setIsEditDebtOpen(false)} className="rounded-lg h-9 px-4 text-xs font-mono border-border/40">Cancel</Button>
                <Button type="submit" className="rounded-lg h-9 px-4 text-xs font-mono bg-primary text-primary-foreground">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <DebtReconcileDialog
        debt={reconcileDebt}
        open={isReconcileOpen}
        onOpenChange={setIsReconcileOpen}
      />
      {deleteDialog}
    </>
  );
}

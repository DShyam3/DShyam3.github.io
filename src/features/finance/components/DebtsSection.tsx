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
import { CheckCircle2, Edit2, Layers, Landmark, Plus, Scale, Sparkles, Trash2, TrendingDown } from 'lucide-react';
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
    <details className="group border-t border-border/30 pt-2 text-xs font-mono" open={draws.length > 0}>
      <summary className="cursor-pointer select-none flex items-center justify-between text-muted-foreground hover:text-foreground py-1">
        <span className="font-semibold text-xs flex items-center gap-2">
          <span>Borrowing History & Tranches (Optional)</span>
          {draws.length > 0 && (
            <span className="text-primary font-bold">({draws.length} tranches · {formatGBP(total)})</span>
          )}
        </span>
        <span className="text-xs group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="space-y-2 pt-2">
        <p className="text-[11px] text-muted-foreground">
          Record separate borrowing tranches (e.g. per academic year). Leave empty if you only track the lump sum.
        </p>

        {draws.length > 0 && (
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
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
    </details>
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
  const [showProjection, setShowProjection] = useState(false);
  const [forecastScope, setForecastScope] = useState<'single' | 'all'>('single');
  const [simulatedSalary, setSimulatedSalary] = useState<number>(() => settings.grossSalary || 30000);

  React.useEffect(() => {
    if (settings.grossSalary && simulatedSalary === 30000) {
      setSimulatedSalary(settings.grossSalary);
    }
  }, [settings.grossSalary, simulatedSalary]);

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

  const getPlanPercent = React.useCallback((plan: StudentLoanPlanKey = 'plan2') => {
    const raw = taxConfig.studentLoanRates[plan];
    if (raw === undefined || raw === null || raw === 0) return 9;
    return raw <= 1 ? Math.round(raw * 100) : raw;
  }, [taxConfig.studentLoanRates]);

  const calculateStudentMonthlyForSalary = (salary: number, plan: StudentLoanPlanKey = 'plan2') => {
    const threshold = taxConfig.studentLoanThresholds[plan] || 27295;
    const ratePercent = getPlanPercent(plan);
    if (!salary || salary <= threshold) return 0;
    return Math.round(((salary - threshold) * (ratePercent / 100)) / 12 * 100) / 100;
  };

  const calculateStudentMonthly = (plan: StudentLoanPlanKey = 'plan2') => {
    return calculateStudentMonthlyForSalary(settings.grossSalary || 0, plan);
  };

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
    const isStudent = newDebt.type === 'student' || newDebt.repaymentType === 'income_contingent';
    const computedStudentMonthly = isStudent
      ? calculateStudentMonthly(newDebt.studentLoanPlan || 'plan2')
      : 0;
    const minPayment = isStudent
      ? (newDebt.minPayment !== '' && newDebt.minPayment > 0 ? newDebt.minPayment : computedStudentMonthly)
      : (newDebt.minPayment === '' ? 0 : newDebt.minPayment);

    const studentPlan = isStudent
      ? (newDebt.studentLoanPlan || (settings.studentLoanPlan !== 'none' ? settings.studentLoanPlan as StudentLoanPlanKey : 'plan2'))
      : undefined;
    const writeOffYears = isStudent
      ? (newDebt.writeOffYears ?? STUDENT_LOAN_WRITE_OFF_YEARS[studentPlan || 'plan2'])
      : undefined;

    const created: Debt = {
      ...newDebt,
      repaymentType: isStudent ? 'income_contingent' : newDebt.repaymentType,
      studentLoanPlan: studentPlan,
      originalAmount: drawTotal > 0
        ? drawTotal
        : (newDebt.originalAmount === '' ? balance : Math.abs(newDebt.originalAmount)),
      balance,
      interestRate: newDebt.interestRate === '' ? 0 : newDebt.interestRate,
      minPayment,
      finalPayment: newDebt.finalPayment === '' ? 0 : Math.abs(newDebt.finalPayment),
      startDate: newDebt.startDate || newDebt.draws[0]?.date || undefined,
      payoffDate: newDebt.payoffDate || undefined,
      writeOffYears,
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
    const isStudent = activeDebt.type === 'student' || activeDebt.repaymentType === 'income_contingent';
    const studentPlan = isStudent
      ? (activeDebt.studentLoanPlan || (settings.studentLoanPlan !== 'none' ? settings.studentLoanPlan as StudentLoanPlanKey : 'plan2'))
      : undefined;
    const computedStudentMonthly = isStudent
      ? calculateStudentMonthly(studentPlan || 'plan2')
      : 0;
    const minPayment = isStudent
      ? computedStudentMonthly
      : (activeDebt.minPayment || 0);
    const writeOffYears = isStudent
      ? (activeDebt.writeOffYears ?? STUDENT_LOAN_WRITE_OFF_YEARS[studentPlan || 'plan2'])
      : undefined;

    const normalized: Debt = {
      ...activeDebt,
      repaymentType: isStudent ? 'income_contingent' : activeDebt.repaymentType,
      studentLoanPlan: studentPlan,
      writeOffYears,
      balance: Math.abs(activeDebt.balance),
      originalAmount: drawTotal > 0 ? drawTotal : Math.abs(activeDebt.originalAmount),
      minPayment,
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
  const totalMinPayments = debts.reduce((sum, d) => {
    const monthly = (d.type === 'student' || d.repaymentType === 'income_contingent')
      ? calculateStudentMonthly(d.studentLoanPlan || 'plan2')
      : d.minPayment;
    return sum + monthly;
  }, 0);
  const dtiPercent = settings.grossSalary > 0
    ? ((totalMinPayments * 12) / settings.grossSalary) * 100
    : 0;

  const selectedDebt = debts.find(d => d.id === selectedDebtId) || debts[0] || null;
  const selectedPlan = selectedDebt?.studentLoanPlan || (selectedDebt?.type === 'student' ? 'plan2' : undefined);
  const isSelectedStudent = selectedDebt?.type === 'student' || selectedDebt?.repaymentType === 'income_contingent';
  const selectedDebtEffective: Debt | null = selectedDebt
    ? {
        ...selectedDebt,
        studentLoanPlan: selectedPlan,
        repaymentType: selectedPlan ? 'income_contingent' : selectedDebt.repaymentType,
        writeOffYears: selectedDebt.writeOffYears ?? (selectedPlan ? STUDENT_LOAN_WRITE_OFF_YEARS[selectedPlan] : undefined),
      }
    : null;

  const simulatedStudentMonthly = isSelectedStudent && selectedPlan
    ? calculateStudentMonthlyForSalary(simulatedSalary, selectedPlan)
    : (selectedDebt?.minPayment || 0);

  const selectedDebtProjection = selectedDebtEffective
    ? projectDebtBalance(selectedDebtEffective, {
        grossSalary: simulatedSalary,
        repaymentRate: selectedPlan ? getPlanPercent(selectedPlan) : 0,
        threshold: selectedPlan ? (taxConfig.studentLoanThresholds[selectedPlan] || 27295) : 0,
        includeHistory: true,
      })
    : [];
  const selectedDebtFinal = selectedDebtProjection[selectedDebtProjection.length - 1];
  const isSelectedWrittenOff = (selectedDebtFinal?.writtenOff ?? 0) > 0;

  const collatedProjection = React.useMemo(() => {
    if (debts.length === 0) return [];
    const projections = debts.map(d => {
      const plan = d.studentLoanPlan || (d.type === 'student' ? 'plan2' : undefined);
      const effective: Debt = {
        ...d,
        studentLoanPlan: plan,
        repaymentType: plan ? 'income_contingent' : d.repaymentType,
        writeOffYears: d.writeOffYears ?? (plan ? STUDENT_LOAN_WRITE_OFF_YEARS[plan] : undefined),
      };
      return projectDebtBalance(effective, {
        grossSalary: simulatedSalary,
        repaymentRate: plan ? getPlanPercent(plan) : 0,
        threshold: plan ? (taxConfig.studentLoanThresholds[plan] || 27295) : 0,
        includeHistory: true,
      });
    });

    const allYears = Array.from(
      new Set(projections.flatMap(pts => pts.map(p => Math.round(p.year))))
    ).sort((a, b) => a - b);

    return allYears.map(yr => {
      let totalBalance = 0;
      let totalPaid = 0;
      let totalInterest = 0;
      let totalWrittenOff = 0;

      for (const pts of projections) {
        if (pts.length === 0) continue;
        const exact = pts.find(p => Math.round(p.year) === yr);
        if (exact) {
          totalBalance += exact.balance;
          totalPaid += exact.paid;
          totalInterest += exact.interest;
          totalWrittenOff += exact.writtenOff;
        } else {
          const pastPts = pts.filter(p => Math.round(p.year) <= yr);
          if (pastPts.length > 0) {
            const last = pastPts[pastPts.length - 1];
            totalBalance += last.balance;
            totalPaid += last.paid;
            totalInterest += last.interest;
            totalWrittenOff += last.writtenOff;
          }
        }
      }

      return {
        year: yr,
        balance: Math.round(totalBalance),
        paid: Math.round(totalPaid),
        interest: Math.round(totalInterest),
        writtenOff: Math.round(totalWrittenOff),
      };
    });
  }, [debts, simulatedSalary, taxConfig, getPlanPercent]);

  const collatedFinal = collatedProjection[collatedProjection.length - 1];

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
              {
                label: 'Debt / Income',
                value: settings.grossSalary > 0 ? `${dtiPercent.toFixed(1)}% DTI` : `${weightedInterestRate.toFixed(2)}% Avg`,
                tone: 'text-foreground',
              },
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
                      {(debt.studentLoanPlan || debt.type === 'student') && (
                        <span className="block text-xs text-muted-foreground">{STUDENT_LOAN_PLAN_LABELS[debt.studentLoanPlan || 'plan2']}</span>
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
                    <td className="py-3 px-3 text-right font-mono">
                      {formatGBP((debt.type === 'student' || debt.repaymentType === 'income_contingent')
                        ? calculateStudentMonthly(debt.studentLoanPlan || 'plan2')
                        : debt.minPayment)}
                    </td>
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

        {/* Payoff Forecast & Salary Simulator Toggle Card */}
        {debts.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card/50 border border-border/40 rounded-xl p-4 hover:border-border/80 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
                  <span>Payoff Forecast & Salary Simulator</span>
                </h4>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Simulate salary progression, test 30-year student loan write-offs, and inspect collated borrowing
                </p>
              </div>
            </div>
            <Button
              variant={showProjection ? 'secondary' : 'default'}
              onClick={() => setShowProjection(!showProjection)}
              className="w-full sm:w-auto rounded-lg text-xs font-mono h-8 px-4 gap-1.5 shrink-0"
            >
              {showProjection ? 'Hide Forecast ▴' : 'Explore Forecast & Simulator ▾'}
            </Button>
          </div>
        )}

        {/* Collapsible Payoff Projection & Simulator Panel */}
        {showProjection && debts.length > 0 && (
          <div className="rounded-xl border border-border/40 bg-card/50 p-4 sm:p-5 hover:border-border/80 transition-colors space-y-5">
            {/* View Scope Tabs & Selector */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/30 pb-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg border border-border/40 bg-muted/20 p-0.5 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setForecastScope('single')}
                    className={cn(
                      "px-3 py-1 rounded-md transition-colors",
                      forecastScope === 'single'
                        ? "bg-background text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Single Debt
                  </button>
                  <button
                    type="button"
                    onClick={() => setForecastScope('all')}
                    className={cn(
                      "px-3 py-1 rounded-md transition-colors flex items-center gap-1.5",
                      forecastScope === 'all'
                        ? "bg-background text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Layers className="h-3 w-3" />
                    All Debts Collated
                  </button>
                </div>
              </div>

              {forecastScope === 'single' && selectedDebt && debts.length > 1 && (
                <Select value={selectedDebt.id} onValueChange={setSelectedDebtId}>
                  <SelectTrigger className="bg-background/50 border border-border/40 rounded-lg h-8 text-xs w-full sm:w-56 shrink-0 font-mono">
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

            {/* Scope: Single Debt */}
            {forecastScope === 'single' && selectedDebt && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-primary shrink-0" /> {selectedDebt.name} — Payoff Projection
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {isSelectedStudent
                      ? `${STUDENT_LOAN_PLAN_LABELS[selectedPlan || 'plan2']}: ${getPlanPercent(selectedPlan || 'plan2')}% of income above ${formatGBP(selectedPlan ? (taxConfig.studentLoanThresholds[selectedPlan] || 27295) : 27295)}, written off after ${selectedDebtEffective?.writeOffYears ?? 30} years`
                      : selectedDebt.repaymentType === 'pcp'
                        ? `PCP: ${formatGBP(selectedDebt.minPayment)}/month amortising to ${formatGBP(selectedDebt.finalPayment || 0)} balloon`
                        : `Fixed repayment of ${formatGBP(selectedDebt.minPayment)}/month at ${selectedDebt.interestRate.toFixed(2)}%`}
                  </p>
                  {selectedDebt.observations && selectedDebt.observations.length > 0 && (
                    <div className="mt-2 rounded-lg border border-positive/30 bg-positive/5 p-2.5 text-xs font-mono text-positive flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground">
                          Anchored on {selectedDebt.observations[0].statementDate || selectedDebt.observations[0].observedOn} verified balance of {formatGBP(selectedDebt.observations[0].balance)}
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                          Between statements, monthly compound interest ({selectedDebt.interestRate}%/yr) accrues and PAYE deductions ({formatGBP(calculateStudentMonthly(selectedPlan || 'plan2'))}/mo) roll the balance forward. Use <strong className="text-foreground">Reconcile (⚖)</strong> whenever a new SLC statement arrives to reset the anchor and reconcile drift.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Salary Simulator for Student Loans */}
                {isSelectedStudent && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 sm:p-4 space-y-3 font-mono">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-xs uppercase tracking-wider font-semibold text-foreground">
                          Interactive Salary Simulator
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Simulated Salary:</span>
                        <span className="text-sm font-bold text-primary tabular-nums">{formatGBP(simulatedSalary)}/yr</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <input
                        type="range"
                        min={20000}
                        max={120000}
                        step={1000}
                        value={simulatedSalary}
                        onChange={(e) => setSimulatedSalary(Number(e.target.value))}
                        className="w-full h-1.5 bg-muted/60 rounded-lg appearance-none cursor-pointer accent-primary"
                        aria-label="Simulated Salary"
                      />
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                        <span>£20k (Below Threshold)</span>
                        <span>£45k</span>
                        <span>£70k</span>
                        <span>£95k</span>
                        <span>£120k</span>
                      </div>
                    </div>

                    {/* Quick preset chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[11px] text-muted-foreground mr-1">Presets:</span>
                      {[
                        { label: `Current (${formatGBP(settings.grossSalary || 0)})`, val: settings.grossSalary || 30000 },
                        { label: '£35k', val: 35000 },
                        { label: '£50k', val: 50000 },
                        { label: '£65k', val: 65000 },
                        { label: '£85k', val: 85000 },
                        { label: '£100k', val: 100000 },
                      ].map(preset => (
                        <Button
                          key={preset.label}
                          type="button"
                          size="sm"
                          variant={simulatedSalary === preset.val ? 'default' : 'outline'}
                          onClick={() => setSimulatedSalary(preset.val)}
                          className="h-6 px-2 text-[10px] rounded-md border-border/40 font-mono"
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>

                    {/* Dynamic Outcome Callout */}
                    <div className="text-xs text-muted-foreground bg-background/60 rounded-lg p-2.5 border border-border/30 leading-relaxed">
                      {simulatedSalary <= (taxConfig.studentLoanThresholds[selectedPlan || 'plan2'] || 27295) ? (
                        <span>
                          At <strong className="text-foreground">{formatGBP(simulatedSalary)}/yr</strong>, earnings are below the {formatGBP(taxConfig.studentLoanThresholds[selectedPlan || 'plan2'] || 27295)} threshold. Monthly PAYE deduction is <strong className="text-positive">£0.00/mo</strong>. The entire balance will be written off at year 30.
                        </span>
                      ) : isSelectedWrittenOff && selectedDebtFinal ? (
                        <span>
                          At <strong className="text-foreground">{formatGBP(simulatedSalary)}/yr</strong>, you repay <strong className="text-foreground">{formatGBP(simulatedStudentMonthly)}/mo</strong> ({getPlanPercent(selectedPlan || 'plan2')}% over threshold). Over 30 years, you repay <strong className="text-positive">{formatGBP(selectedDebtFinal.paid)}</strong> total. The remaining <strong className="text-primary">{formatGBP(selectedDebtFinal.writtenOff)}</strong> is written off tax-free in {Math.round(selectedDebtFinal.year)}.
                        </span>
                      ) : selectedDebtFinal ? (
                        <span>
                          At <strong className="text-foreground">{formatGBP(simulatedSalary)}/yr</strong>, you repay <strong className="text-foreground">{formatGBP(simulatedStudentMonthly)}/mo</strong>. At this pace, you will fully clear your student loan in <strong className="text-positive">{Math.round(selectedDebtFinal.year)}</strong> after repaying <strong className="text-foreground">{formatGBP(selectedDebtFinal.paid)}</strong> total!
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Single Debt Metric Cards */}
                {selectedDebtFinal && (
                  isSelectedStudent ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-background/40 border border-border/30 rounded-xl p-3">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">Repayment Outcome</span>
                        <span className="text-sm font-bold font-mono text-foreground block truncate mt-1">
                          {isSelectedWrittenOff
                            ? `Written off in ${Math.round(selectedDebtFinal.year)}`
                            : (selectedDebtFinal.balance <= 0 ? `Cleared in ${Math.round(selectedDebtFinal.year)}` : 'Active')}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono block">
                          {isSelectedWrittenOff ? `${selectedDebtEffective?.writeOffYears ?? 30}-year statutory write-off` : 'Fully paid off'}
                        </span>
                      </div>

                      <div className="bg-background/40 border border-border/30 rounded-xl p-3">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">Total You Repay</span>
                        <span className="text-sm font-bold font-mono text-positive block truncate mt-1">
                          {formatGBP(selectedDebtFinal.paid)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono block">
                          Actual PAYE deductions
                        </span>
                      </div>

                      <div className="bg-background/40 border border-border/30 rounded-xl p-3">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">Monthly Deduction</span>
                        <span className="text-sm font-bold font-mono text-foreground block truncate mt-1">
                          {formatGBP(simulatedStudentMonthly)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono block">
                          At {formatGBP(simulatedSalary)}/yr
                        </span>
                      </div>

                      <div className="bg-background/40 border border-border/30 rounded-xl p-3">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">Government Forgiven</span>
                        <span className="text-sm font-bold font-mono text-primary block truncate mt-1">
                          {formatGBP(selectedDebtFinal.writtenOff)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono block">
                          Cancelled debt & interest
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-background/40 border border-border/30 rounded-xl p-3">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">Cleared By</span>
                        <span className="text-sm font-bold font-mono text-foreground block truncate mt-1">
                          {selectedDebtFinal.balance <= 0 ? `Year ${Math.round(selectedDebtFinal.year)}` : 'Not on track'}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono block">Amortisation term</span>
                      </div>
                      <div className="bg-background/40 border border-border/30 rounded-xl p-3">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">Total Repaid</span>
                        <span className="text-sm font-bold font-mono text-foreground block truncate mt-1">
                          {formatGBP(selectedDebtFinal.paid)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono block">Principal + interest</span>
                      </div>
                      <div className="bg-background/40 border border-border/30 rounded-xl p-3">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">Interest Paid</span>
                        <span className="text-sm font-bold font-mono text-chart-4 block truncate mt-1">
                          {formatGBP(selectedDebtFinal.interest)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono block">Cost of borrowing</span>
                      </div>
                      <div className="bg-background/40 border border-border/30 rounded-xl p-3">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">Principal Cleared</span>
                        <span className="text-sm font-bold font-mono text-positive block truncate mt-1">
                          {formatGBP(selectedDebtEffective ? selectedDebtEffective.balance : 0)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono block">Remaining balance</span>
                      </div>
                    </div>
                  )
                )}

                {/* Single Debt Chart */}
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
                        name={isSelectedStudent ? "Paper Balance" : "Outstanding"}
                        stroke="hsl(var(--destructive))"
                        strokeWidth={2}
                        fill="url(#debtBalanceFill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="paid"
                        name={isSelectedStudent ? "Total You Repaid" : "Repaid"}
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

            {/* Scope: All Debts Collated */}
            {forecastScope === 'all' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary shrink-0" /> All Debts Collated — Aggregate Payoff Projection
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Combined trajectory across all {debts.length} active debts vs income and servicing capacity.
                  </p>
                </div>

                {/* Collated Metric Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-background/40 border border-border/30 rounded-xl p-3">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">Total Debt Owed</span>
                    <span className="text-sm font-bold font-mono text-destructive block truncate mt-1">
                      {formatGBP(totalLoanBalance)}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono block">
                      Across {debts.length} {debts.length === 1 ? 'account' : 'accounts'}
                    </span>
                  </div>

                  <div className="bg-background/40 border border-border/30 rounded-xl p-3">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">Total Repaid (Horizon)</span>
                    <span className="text-sm font-bold font-mono text-positive block truncate mt-1">
                      {formatGBP(collatedFinal?.paid || 0)}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono block">
                      Cumulative cash paid
                    </span>
                  </div>

                  <div className="bg-background/40 border border-border/30 rounded-xl p-3">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">Annual Debt Servicing</span>
                    <span className="text-sm font-bold font-mono text-foreground block truncate mt-1">
                      {formatGBP(totalMinPayments * 12)}/yr
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono block">
                      {formatGBP(totalMinPayments)}/month total
                    </span>
                  </div>

                  <div className="bg-background/40 border border-border/30 rounded-xl p-3">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">Debt / Income (DTI)</span>
                    <span className="text-sm font-bold font-mono text-foreground block truncate mt-1">
                      {dtiPercent.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono block">
                      {settings.grossSalary > 0 ? `Of £${Math.round(settings.grossSalary / 1000)}k gross salary` : 'No salary set'}
                    </span>
                  </div>
                </div>

                {/* Collated Chart */}
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={collatedProjection} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="collatedBalanceFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="collatedPaidFill" x1="0" y1="0" x2="0" y2="1">
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
                        name="Total Outstanding"
                        stroke="hsl(var(--destructive))"
                        strokeWidth={2}
                        fill="url(#collatedBalanceFill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="paid"
                        name="Total Cash Repaid"
                        stroke="hsl(var(--positive))"
                        strokeWidth={2}
                        fill="url(#collatedPaidFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Collated Debt Composition Breakdown */}
                <div className="border-t border-border/30 pt-4 space-y-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">
                    Debt Portfolio Composition
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {debts.map(d => {
                      const share = totalLoanBalance > 0 ? (d.balance / totalLoanBalance) * 100 : 0;
                      const monthly = (d.type === 'student' || d.repaymentType === 'income_contingent')
                        ? calculateStudentMonthly(d.studentLoanPlan || 'plan2')
                        : d.minPayment;
                      return (
                        <div key={d.id} className="rounded-lg border border-border/30 bg-muted/20 p-2.5 font-mono text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground truncate">{d.name}</span>
                            <span className="text-destructive font-bold">{formatGBP(d.balance)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{share.toFixed(1)}% of debt</span>
                            <span>{formatGBP(monthly)}/mo</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Debt Dialog */}
      <Dialog open={isAddDebtOpen} onOpenChange={setIsAddDebtOpen}>
        <DialogContent className="sm:rounded-xl border border-border/40 bg-card sm:max-w-xl font-mono shadow-none p-5 sm:p-6 gap-2">
          <DialogHeader className="space-y-0.5">
            <DialogTitle className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground">Add Debt</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">Track a mortgage, student loan or other borrowing.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddDebt} className="space-y-2 pt-0.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label htmlFor="debt-name" className="text-xs font-mono text-muted-foreground">Debt Name</Label>
                <Input
                  id="debt-name"
                  placeholder={newDebt.type === 'student' ? 'Student Loan' : 'e.g. Flat Mortgage'}
                  value={newDebt.name}
                  onChange={(e) => setNewDebt({ ...newDebt, name: e.target.value })}
                  className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="debt-type" className="text-xs font-mono text-muted-foreground">Debt Type</Label>
                <Select
                  value={newDebt.type}
                  onValueChange={(val) => {
                    const isStudent = val === 'student';
                    const defaultPlan = (settings.studentLoanPlan !== 'none' ? settings.studentLoanPlan as StudentLoanPlanKey : 'plan2');
                    setNewDebt({
                      ...newDebt,
                      type: val as Debt['type'],
                      repaymentType: isStudent ? 'income_contingent' : (newDebt.repaymentType === 'income_contingent' ? 'amortising' : newDebt.repaymentType),
                      name: isStudent ? (newDebt.name || 'Student Loan') : newDebt.name,
                      lender: isStudent ? (newDebt.lender || 'Student Loans Company') : newDebt.lender,
                      emoji: isStudent ? (newDebt.emoji || '🎓') : newDebt.emoji,
                      studentLoanPlan: isStudent ? (newDebt.studentLoanPlan || defaultPlan) : newDebt.studentLoanPlan,
                      writeOffYears: isStudent ? (newDebt.writeOffYears ?? STUDENT_LOAN_WRITE_OFF_YEARS[newDebt.studentLoanPlan || defaultPlan]) : newDebt.writeOffYears,
                      interestRate: isStudent && (newDebt.interestRate === '' || newDebt.interestRate === 0) ? 7.1 : newDebt.interestRate,
                    });
                  }}
                >
                  <SelectTrigger id="debt-type" className="bg-background/50 border border-border/40 rounded-lg h-8 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border border-border/40 bg-popover text-xs font-mono">
                    {Object.entries(DEBT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newDebt.type === 'student' ? (
              <div className="grid grid-cols-2 gap-2.5">
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
                    <SelectTrigger id="debt-plan" className="bg-background/50 border border-border/40 rounded-lg h-8 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border border-border/40 bg-popover text-xs font-mono">
                      {Object.entries(STUDENT_LOAN_PLAN_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="debt-lender" className="text-xs font-mono text-muted-foreground">Lender</Label>
                  <Input
                    id="debt-lender"
                    placeholder="Student Loans Company"
                    value={newDebt.lender}
                    onChange={(e) => setNewDebt({ ...newDebt, lender: e.target.value })}
                    className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
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
                    <SelectTrigger id="debt-repayment" className="bg-background/50 border border-border/40 rounded-lg h-8 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border border-border/40 bg-popover text-xs font-mono">
                      <SelectItem value="amortising">Fixed monthly payment</SelectItem>
                      <SelectItem value="income_contingent">% of income over threshold</SelectItem>
                      <SelectItem value="pcp">PCP (with balloon payment)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="debt-lender" className="text-xs font-mono text-muted-foreground">Lender</Label>
                  <Input
                    id="debt-lender"
                    placeholder="e.g. Nationwide"
                    value={newDebt.lender}
                    onChange={(e) => setNewDebt({ ...newDebt, lender: e.target.value })}
                    className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                  />
                </div>
              </div>
            )}

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
                  className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                />
              </div>
            )}

            {newDebt.type === 'student' && (
              <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5 text-xs font-mono flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                <span>Threshold: <span className="font-semibold text-foreground">{formatGBP(taxConfig.studentLoanThresholds[newDebt.studentLoanPlan || 'plan2'] || 0)}/yr</span> (9% above)</span>
                <span>Deduction: <span className="font-bold text-primary">{formatGBP(calculateStudentMonthly(newDebt.studentLoanPlan || 'plan2'))}/mo</span></span>
                <span className="text-[11px]">Write-off: <span className="text-foreground">{newDebt.writeOffYears ?? 30} yrs</span></span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label htmlFor="debt-original" className="text-xs font-mono text-muted-foreground">
                  {newDebt.type === 'student' ? 'Original Borrowed (£)' : 'Original (£)'}
                </Label>
                <Input
                  id="debt-original"
                  type="number"
                  step="0.01"
                  placeholder={newDebt.type === 'student' ? 'e.g. 40000' : '250000'}
                  value={newDebt.draws.length > 0 ? sumDraws(newDebt.draws) : newDebt.originalAmount}
                  onChange={(e) => setNewDebt({ ...newDebt, originalAmount: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                  disabled={newDebt.draws.length > 0}
                  className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono disabled:opacity-70"
                />
                {newDebt.draws.length > 0 && (
                  <p className="text-[11px] font-mono text-muted-foreground">Summed from tranches</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="debt-balance" className="text-xs font-mono text-muted-foreground">
                  {newDebt.type === 'student' ? 'Current Balance (£)' : 'Owed Now (£)'}
                </Label>
                <Input
                  id="debt-balance"
                  type="number"
                  step="0.01"
                  placeholder={newDebt.type === 'student' ? 'e.g. 51000' : '198400'}
                  value={newDebt.balance}
                  onChange={(e) => setNewDebt({ ...newDebt, balance: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                  className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label htmlFor="debt-rate" className="text-xs font-mono text-muted-foreground">Interest Rate (%)</Label>
                <Input
                  id="debt-rate"
                  type="number"
                  step="0.01"
                  placeholder="7.10"
                  value={newDebt.interestRate}
                  onChange={(e) => setNewDebt({ ...newDebt, interestRate: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                  className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                />
              </div>
              {newDebt.type === 'student' || newDebt.repaymentType === 'income_contingent' ? (
                <div className="space-y-1">
                  <Label htmlFor="debt-start" className="text-xs font-mono text-muted-foreground">Course Start Date (Optional)</Label>
                  <Input
                    id="debt-start"
                    type="date"
                    value={newDebt.startDate}
                    onChange={(e) => setNewDebt({ ...newDebt, startDate: e.target.value })}
                    className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="debt-payment" className="text-xs font-mono text-muted-foreground">Monthly (£)</Label>
                  <Input
                    id="debt-payment"
                    type="number"
                    step="0.01"
                    placeholder="1150"
                    value={newDebt.minPayment}
                    onChange={(e) => setNewDebt({ ...newDebt, minPayment: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                    className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                  />
                </div>
              )}
            </div>

            {newDebt.type !== 'student' && newDebt.repaymentType !== 'income_contingent' && (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="debt-start" className="text-xs font-mono text-muted-foreground">Taken On</Label>
                  <Input
                    id="debt-start"
                    type="date"
                    value={newDebt.startDate}
                    onChange={(e) => setNewDebt({ ...newDebt, startDate: e.target.value })}
                    className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="debt-payoff" className="text-xs font-mono text-muted-foreground">Expected Payoff</Label>
                  <Input
                    id="debt-payoff"
                    type="date"
                    value={newDebt.payoffDate}
                    onChange={(e) => setNewDebt({ ...newDebt, payoffDate: e.target.value })}
                    className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label htmlFor="debt-emoji" className="text-xs font-mono text-muted-foreground">Emoji</Label>
                <Input
                  id="debt-emoji"
                  placeholder={newDebt.type === 'student' ? '🎓' : '🏠'}
                  value={newDebt.emoji}
                  onChange={(e) => setNewDebt({ ...newDebt, emoji: e.target.value })}
                  className="rounded-lg h-8 border border-border/40 bg-background/50 text-center text-sm font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="debt-color" className="text-xs font-mono text-muted-foreground">Colour</Label>
                <Input
                  id="debt-color"
                  type="color"
                  value={newDebt.color}
                  onChange={(e) => setNewDebt({ ...newDebt, color: e.target.value })}
                  className="rounded-lg h-8 border border-border/40 bg-background/50 p-1 cursor-pointer"
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

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button variant="outline" type="button" onClick={() => setIsAddDebtOpen(false)} className="rounded-lg h-8 px-4 text-xs font-mono border-border/40">Cancel</Button>
              <Button type="submit" className="rounded-lg h-8 px-4 text-xs font-mono bg-primary text-primary-foreground">Save Debt</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Debt Dialog */}
      <Dialog open={isEditDebtOpen} onOpenChange={setIsEditDebtOpen}>
        <DialogContent className="sm:rounded-xl border border-border/40 bg-card sm:max-w-xl font-mono shadow-none p-5 sm:p-6 gap-2">
          <DialogHeader className="space-y-0.5">
            <DialogTitle className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground">Edit Debt</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">Update balance, rate or payoff schedule.</DialogDescription>
          </DialogHeader>
          {activeDebt && (
            <form onSubmit={handleEditDebt} className="space-y-2 pt-0.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="edit-debt-name" className="text-xs font-mono text-muted-foreground">Debt Name</Label>
                  <Input
                    id="edit-debt-name"
                    value={activeDebt.name}
                    onChange={(e) => setActiveDebt({ ...activeDebt, name: e.target.value })}
                    className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-debt-type" className="text-xs font-mono text-muted-foreground">Debt Type</Label>
                  <Select
                    value={activeDebt.type}
                    onValueChange={(val) => {
                      const isStudent = val === 'student';
                      const defaultPlan = (settings.studentLoanPlan !== 'none' ? settings.studentLoanPlan as StudentLoanPlanKey : 'plan2');
                      setActiveDebt({
                        ...activeDebt,
                        type: val as Debt['type'],
                        repaymentType: isStudent ? 'income_contingent' : (activeDebt.repaymentType === 'income_contingent' ? 'amortising' : activeDebt.repaymentType),
                        name: isStudent ? (activeDebt.name || 'Student Loan') : activeDebt.name,
                        lender: isStudent ? (activeDebt.lender || 'Student Loans Company') : activeDebt.lender,
                        emoji: isStudent ? (activeDebt.emoji || '🎓') : activeDebt.emoji,
                        studentLoanPlan: isStudent ? (activeDebt.studentLoanPlan || defaultPlan) : activeDebt.studentLoanPlan,
                        writeOffYears: isStudent ? (activeDebt.writeOffYears ?? STUDENT_LOAN_WRITE_OFF_YEARS[activeDebt.studentLoanPlan || defaultPlan]) : activeDebt.writeOffYears,
                        interestRate: isStudent && (!activeDebt.interestRate || activeDebt.interestRate === 0) ? 7.1 : activeDebt.interestRate,
                      });
                    }}
                  >
                    <SelectTrigger id="edit-debt-type" className="bg-background/50 border border-border/40 rounded-lg h-8 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border border-border/40 bg-popover text-xs font-mono">
                      {Object.entries(DEBT_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {activeDebt.type === 'student' ? (
                <div className="grid grid-cols-2 gap-2.5">
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
                      <SelectTrigger id="edit-debt-plan" className="bg-background/50 border border-border/40 rounded-lg h-8 text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border border-border/40 bg-popover text-xs font-mono">
                        {Object.entries(STUDENT_LOAN_PLAN_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-debt-lender" className="text-xs font-mono text-muted-foreground">Lender</Label>
                    <Input
                      id="edit-debt-lender"
                      placeholder="Student Loans Company"
                      value={activeDebt.lender}
                      onChange={(e) => setActiveDebt({ ...activeDebt, lender: e.target.value })}
                      className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
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
                      <SelectTrigger id="edit-debt-repayment" className="bg-background/50 border border-border/40 rounded-lg h-8 text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border border-border/40 bg-popover text-xs font-mono">
                        <SelectItem value="amortising">Fixed monthly payment</SelectItem>
                        <SelectItem value="income_contingent">% of income over threshold</SelectItem>
                        <SelectItem value="pcp">PCP (with balloon payment)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-debt-lender" className="text-xs font-mono text-muted-foreground">Lender</Label>
                    <Input
                      id="edit-debt-lender"
                      placeholder="e.g. Nationwide"
                      value={activeDebt.lender}
                      onChange={(e) => setActiveDebt({ ...activeDebt, lender: e.target.value })}
                      className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                    />
                  </div>
                </div>
              )}

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
                    className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                  />
                </div>
              )}

              {activeDebt.type === 'student' && (
                <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5 text-xs font-mono flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                  <span>Threshold: <span className="font-semibold text-foreground">{formatGBP(taxConfig.studentLoanThresholds[activeDebt.studentLoanPlan || 'plan2'] || 0)}/yr</span> (9% above)</span>
                  <span>Deduction: <span className="font-bold text-primary">{formatGBP(calculateStudentMonthly(activeDebt.studentLoanPlan || 'plan2'))}/mo</span></span>
                  <span className="text-[11px]">Write-off: <span className="text-foreground">{activeDebt.writeOffYears ?? 30} yrs</span></span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="edit-debt-original" className="text-xs font-mono text-muted-foreground">
                    {activeDebt.type === 'student' ? 'Original Borrowed (£)' : 'Original (£)'}
                  </Label>
                  <Input
                    id="edit-debt-original"
                    type="number"
                    step="0.01"
                    value={activeDebt.draws.length > 0 ? sumDraws(activeDebt.draws) : activeDebt.originalAmount}
                    onChange={(e) => setActiveDebt({ ...activeDebt, originalAmount: parseFloat(e.target.value) || 0 })}
                    disabled={activeDebt.draws.length > 0}
                    className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono disabled:opacity-70"
                  />
                  {activeDebt.draws.length > 0 && (
                    <p className="text-[11px] font-mono text-muted-foreground">Summed from tranches</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-debt-balance" className="text-xs font-mono text-muted-foreground">
                    {activeDebt.type === 'student' ? 'Current Balance (£)' : 'Owed Now (£)'}
                  </Label>
                  <Input
                    id="edit-debt-balance"
                    type="number"
                    step="0.01"
                    value={activeDebt.balance}
                    onChange={(e) => setActiveDebt({ ...activeDebt, balance: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="edit-debt-rate" className="text-xs font-mono text-muted-foreground">Interest Rate (%)</Label>
                  <Input
                    id="edit-debt-rate"
                    type="number"
                    step="0.01"
                    value={activeDebt.interestRate}
                    onChange={(e) => setActiveDebt({ ...activeDebt, interestRate: parseFloat(e.target.value) || 0 })}
                    className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                  />
                </div>
                {activeDebt.type === 'student' || activeDebt.repaymentType === 'income_contingent' ? (
                  <div className="space-y-1">
                    <Label htmlFor="edit-debt-start" className="text-xs font-mono text-muted-foreground">Course Start Date (Optional)</Label>
                    <Input
                      id="edit-debt-start"
                      type="date"
                      value={activeDebt.startDate || ''}
                      onChange={(e) => setActiveDebt({ ...activeDebt, startDate: e.target.value || undefined })}
                      className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label htmlFor="edit-debt-payment" className="text-xs font-mono text-muted-foreground">Monthly (£)</Label>
                    <Input
                      id="edit-debt-payment"
                      type="number"
                      step="0.01"
                      value={activeDebt.minPayment}
                      onChange={(e) => setActiveDebt({ ...activeDebt, minPayment: parseFloat(e.target.value) || 0 })}
                      className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                    />
                  </div>
                )}
              </div>

              {activeDebt.type !== 'student' && activeDebt.repaymentType !== 'income_contingent' && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="edit-debt-start" className="text-xs font-mono text-muted-foreground">Taken On</Label>
                    <Input
                      id="edit-debt-start"
                      type="date"
                      value={activeDebt.startDate || ''}
                      onChange={(e) => setActiveDebt({ ...activeDebt, startDate: e.target.value || undefined })}
                      className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-debt-payoff" className="text-xs font-mono text-muted-foreground">Expected Payoff</Label>
                    <Input
                      id="edit-debt-payoff"
                      type="date"
                      value={activeDebt.payoffDate || ''}
                      onChange={(e) => setActiveDebt({ ...activeDebt, payoffDate: e.target.value || undefined })}
                      className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="edit-debt-emoji" className="text-xs font-mono text-muted-foreground">Emoji</Label>
                  <Input
                    id="edit-debt-emoji"
                    placeholder={activeDebt.type === 'student' ? '🎓' : '🏠'}
                    value={activeDebt.emoji || ''}
                    onChange={(e) => setActiveDebt({ ...activeDebt, emoji: e.target.value })}
                    className="rounded-lg h-8 border border-border/40 bg-background/50 text-center text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-debt-color" className="text-xs font-mono text-muted-foreground">Colour</Label>
                  <Input
                    id="edit-debt-color"
                    type="color"
                    value={activeDebt.color || 'hsl(var(--destructive))'}
                    onChange={(e) => setActiveDebt({ ...activeDebt, color: e.target.value })}
                    className="rounded-lg h-8 border border-border/40 bg-background/50 p-1 cursor-pointer"
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

              <DialogFooter className="pt-2 gap-2 sm:gap-0">
                <Button variant="outline" type="button" onClick={() => setIsEditDebtOpen(false)} className="rounded-lg h-8 px-4 text-xs font-mono border-border/40">Cancel</Button>
                <Button type="submit" className="rounded-lg h-8 px-4 text-xs font-mono bg-primary text-primary-foreground">Save Changes</Button>
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

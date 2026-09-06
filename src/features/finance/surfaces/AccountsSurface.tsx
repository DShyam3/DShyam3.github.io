/**
 * Accounts — the Wealth surface (REHAUL_PLAN.md 7.C).
 *
 * Owns accounts, memberships, debts and credit scores, their seven dialogs and
 * its own confirm-delete step. TrueLayer comes from useTrueLayer, which Home
 * shares, so neither surface owns the connection (7.2c-i).
 */

import { useEffect, useMemo, useState } from 'react';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useToast } from '@/hooks/use-toast';
import { useFinanceData } from '../FinanceDataContext';
import { CreditTier } from '@/lib/finance';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BankAccount, CreditScoreEntry, Debt, DebtDraw, Membership } from '@/features/finance/finance-types';
import { formatGBP, getAccountDefaultColor, getAccountDefaultEmoji } from '@/features/finance/utils/calculations';
import { BUREAU_BANDS, BureauBand, DEBT_TYPE_LABELS, STUDENT_LOAN_PLAN_LABELS, STUDENT_LOAN_WRITE_OFF_YEARS, StudentLoanPlanKey, describeArc, polarToCartesian, projectDebtBalance } from '@/lib/finance';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ArrowDownRight, ArrowUpRight, Award, Clock, CreditCard, Edit2, Landmark, Loader2, Plus, RefreshCw, ShieldAlert, Trash2, TrendingDown } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { useTrueLayer } from '../useTrueLayer';

/**
 * Credit bands carry a `tier` rather than a colour -- presentation does not
 * belong in `lib/finance`. These are the existing hexes, unchanged, so this is
 * a lift not a restyle; Phase 7.C replaces them with design tokens.
 */
const CREDIT_TIER_COLORS: Record<CreditTier, string> = {
  1: 'hsl(var(--destructive))',
  2: 'hsl(var(--chart-4))',
  3: 'hsl(var(--positive))',
  4: 'hsl(var(--positive))',
  5: 'hsl(var(--positive))',
};

const CREDIT_TIER_CLASSES: Record<CreditTier, string> = {
  1: 'text-destructive',
  2: 'text-chart-4',
  3: 'text-positive',
  4: 'text-positive',
  5: 'text-positive',
};

const bandColor = (band?: BureauBand | null): string | undefined =>
  band ? CREDIT_TIER_COLORS[band.tier] : undefined;

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
  idPrefix
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
            <div key={draw.id} className="flex items-center justify-between gap-2 rounded-xl border border-primary/10 bg-background/40 px-3 py-1.5">
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
          className="rounded-xl h-9 border-primary/20 bg-background/50 text-xs"
        />
        <Input
          id={`${idPrefix}-draw-amount`}
          type="number"
          step="0.01"
          aria-label="Borrowing amount"
          placeholder="Amount (£)"
          value={newDraw.amount}
          onChange={(e) => setNewDraw({ ...newDraw, amount: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
          className="rounded-xl h-9 border-primary/20 bg-background/50 text-xs"
        />
      </div>
      <div className="flex gap-2">
        <Input
          id={`${idPrefix}-draw-label`}
          aria-label="Borrowing label"
          placeholder="Label, e.g. Year 1 tuition"
          value={newDraw.label}
          onChange={(e) => setNewDraw({ ...newDraw, label: e.target.value })}
          className="rounded-xl h-9 border-primary/20 bg-background/50 text-xs"
        />
        <Button type="button" onClick={onAdd} variant="outline" className="rounded-xl h-9 px-3 shrink-0 gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
};

export default function AccountsSurface({ totalLoanBalance }: { totalLoanBalance: number }) {
  const { toast } = useToast();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const {
    bankAccounts,
    creditBureaus,
    creditScores,
    debts,
    memberships,
    saveDataToSupabase,
    setBankAccounts,
    setCreditScores,
    setDebts,
    setMemberships,
    settings,
    taxConfig,
    fetchSupabaseData,
  } = useFinanceData();

  const {
    trueLayerStatus,
    isSyncingTrueLayer,
    isConnectingTrueLayer,
    connectTrueLayer,
    disconnectTrueLayer,
    syncTrueLayer,
  } = useTrueLayer(fetchSupabaseData);

  // Dialog / Edit States
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [isAddMembershipOpen, setIsAddMembershipOpen] = useState(false);
  const [isEditMembershipOpen, setIsEditMembershipOpen] = useState(false);
  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [isEditDebtOpen, setIsEditDebtOpen] = useState(false);

  const [isAddCreditScoreOpen, setIsAddCreditScoreOpen] = useState(false);
  const [hoveredBands, setHoveredBands] = useState<Record<'experian' | 'transunion' | 'equifax', BureauBand | null>>({
    experian: null,
    transunion: null,
    equifax: null
  });

  const [newCreditScore, setNewCreditScore] = useState<{ bureau: 'experian' | 'transunion' | 'equifax'; score: number | ''; date: string }>({ bureau: 'experian', score: '', date: new Date().toISOString().split('T')[0] });

  const [activeAccount, setActiveAccount] = useState<BankAccount | null>(null);
  const [newAccount, setNewAccount] = useState<Omit<BankAccount, 'id' | 'balance' | 'annualFee'> & { balance: number | ''; annualFee: number | ''; }>({ name: '', type: 'checking', issuer: '', balance: '', annualFee: '', useCase: '', emoji: '', color: 'hsl(var(--muted-foreground))' });

  const [activeMembership, setActiveMembership] = useState<Membership | null>(null);
  const [newMembership, setNewMembership] = useState<Omit<Membership, 'id' | 'annualFee'> & { annualFee: number | ''; }>({ name: '', type: 'points', status: 'Active', annualFee: '', useCase: '' });

  const [activeDebt, setActiveDebt] = useState<Debt | null>(null);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [newDebt, setNewDebt] = useState<Omit<Debt, 'id' | 'originalAmount' | 'balance' | 'interestRate' | 'minPayment'> & { originalAmount: number | ''; balance: number | ''; interestRate: number | ''; minPayment: number | ''; }>({
    name: '',
    type: 'mortgage',
    lender: '',
    originalAmount: '',
    balance: '',
    interestRate: '',
    minPayment: '',
    startDate: '',
    payoffDate: '',
    repaymentType: 'amortising',
    studentLoanPlan: undefined,
    writeOffYears: undefined,
    draws: [],
    notes: '',
    emoji: '',
    color: 'hsl(var(--destructive))'
  });
  const [newDraw, setNewDraw] = useState<{ date: string; amount: number | ''; label: string }>({ date: '', amount: '', label: '' });

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.name || !newAccount.issuer) {
      toast({ title: 'Error', description: 'Please fill in name and issuer.', variant: 'destructive' });
      return;
    }
    const created: BankAccount = {
      ...newAccount,
      balance: newAccount.balance === '' ? 0 : newAccount.balance,
      annualFee: newAccount.annualFee === '' ? 0 : newAccount.annualFee,
      emoji: newAccount.emoji || getAccountDefaultEmoji(newAccount.type, newAccount.name),
      color: newAccount.color || getAccountDefaultColor(newAccount.name),
      id: 'a_' + Date.now()
    };
    const updated = [...bankAccounts, created];
    setBankAccounts(updated);
    saveDataToSupabase('accounts', { bankAccounts: updated, memberships, creditScores });
    setIsAddAccountOpen(false);
    setNewAccount({ name: '', type: 'checking', issuer: '', balance: '', annualFee: '', useCase: '', emoji: '', color: 'hsl(var(--muted-foreground))' });
    toast({ title: 'Account Added', description: `Added ${created.name}.` });
  };

  const handleEditAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) return;
    const updated = bankAccounts.map(a => a.id === activeAccount.id ? activeAccount : a);
    setBankAccounts(updated);
    saveDataToSupabase('accounts', { bankAccounts: updated, memberships, creditScores });
    setIsEditAccountOpen(false);
    setActiveAccount(null);
    toast({ title: 'Account Updated', description: 'Successfully saved changes.' });
  };

  const performDeleteAccount = (id: string) => {
    const updated = bankAccounts.filter(a => a.id !== id);
    setBankAccounts(updated);
    saveDataToSupabase('accounts', { bankAccounts: updated, memberships, creditScores });
    toast({ title: 'Account Deleted', description: 'Bank account removed.' });
  };

  const handleDeleteAccount = (id: string) =>
    askDelete({
      name: bankAccounts.find(a => a.id === id)?.name,
      onConfirm: () => performDeleteAccount(id),
    });

  const handleAddMembership = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMembership.name) {
      toast({ title: 'Error', description: 'Please enter membership name.', variant: 'destructive' });
      return;
    }
    const created: Membership = {
      ...newMembership,
      annualFee: newMembership.annualFee === '' ? 0 : newMembership.annualFee,
      id: 'm_' + Date.now()
    };
    const updated = [...memberships, created];
    setMemberships(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships: updated, creditScores });
    setIsAddMembershipOpen(false);
    setNewMembership({ name: '', type: 'points', status: 'Active', annualFee: '', useCase: '' });
    toast({ title: 'Membership Added', description: `Added "${created.name}".` });
  };

  const handleEditMembership = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMembership) return;
    const updated = memberships.map(m => m.id === activeMembership.id ? activeMembership : m);
    setMemberships(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships: updated, creditScores });
    setIsEditMembershipOpen(false);
    setActiveMembership(null);
    toast({ title: 'Membership Updated', description: 'Membership details saved.' });
  };

  const performDeleteMembership = (id: string) => {
    const updated = memberships.filter(m => m.id !== id);
    setMemberships(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships: updated, creditScores });
    toast({ title: 'Membership Deleted', description: 'Membership removed.' });
  };

  const handleDeleteMembership = (id: string) =>
    askDelete({
      name: memberships.find(m => m.id === id)?.name,
      onConfirm: () => performDeleteMembership(id),
    });

  const emptyDebtForm: Omit<Debt, 'id' | 'originalAmount' | 'balance' | 'interestRate' | 'minPayment'> & {
    originalAmount: number | '';
    balance: number | '';
    interestRate: number | '';
    minPayment: number | '';
  } = {
    name: '',
    type: 'mortgage' as Debt['type'],
    lender: '',
    originalAmount: '' as number | '',
    balance: '' as number | '',
    interestRate: '' as number | '',
    minPayment: '' as number | '',
    startDate: '',
    payoffDate: '',
    repaymentType: 'amortising' as Debt['repaymentType'],
    studentLoanPlan: undefined,
    writeOffYears: undefined,
    draws: [] as DebtDraw[],
    notes: '',
    emoji: '',
    color: 'hsl(var(--destructive))'
  };

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
      label: newDraw.label || undefined
    };
    // Route to whichever debt form is currently open
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
      // Tranches are the source of truth when present; otherwise fall back to
      // the typed original, then to the current balance (0% paid off).
      originalAmount: drawTotal > 0
        ? drawTotal
        : (newDebt.originalAmount === '' ? balance : Math.abs(newDebt.originalAmount)),
      balance,
      interestRate: newDebt.interestRate === '' ? 0 : newDebt.interestRate,
      minPayment: newDebt.minPayment === '' ? 0 : newDebt.minPayment,
      startDate: newDebt.startDate || newDebt.draws[0]?.date || undefined,
      payoffDate: newDebt.payoffDate || undefined,
      writeOffYears: newDebt.repaymentType === 'income_contingent'
        ? (newDebt.writeOffYears ?? (newDebt.studentLoanPlan ? STUDENT_LOAN_WRITE_OFF_YEARS[newDebt.studentLoanPlan] : undefined))
        : undefined,
      notes: newDebt.notes || undefined,
      id: 'd_' + Date.now()
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
      startDate: activeDebt.startDate || activeDebt.draws[0]?.date || undefined
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

  const handleAddCreditScore = (e: React.FormEvent) => {
    e.preventDefault();
    const maxScore = creditBureaus.find(b => b.key === newCreditScore.bureau)?.maxScore ?? 1000;
    if (newCreditScore.score === '' || newCreditScore.score < 0 || newCreditScore.score > maxScore) {
      toast({ title: 'Invalid Score', description: `Score must be between 0 and ${maxScore}.`, variant: 'destructive' });
      return;
    }
    const entry: CreditScoreEntry = {
      id: 'cs_' + Date.now(),
      date: newCreditScore.date,
      score: newCreditScore.score
    };
    const updated = {
      ...creditScores,
      [newCreditScore.bureau]: [...creditScores[newCreditScore.bureau], entry].sort((a, b) => a.date.localeCompare(b.date))
    };
    setCreditScores(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships, creditScores: updated });
    setIsAddCreditScoreOpen(false);
    setNewCreditScore({ bureau: 'experian', score: '', date: new Date().toISOString().split('T')[0] });
    toast({ title: 'Credit Score Added', description: `Logged ${newCreditScore.bureau.charAt(0).toUpperCase() + newCreditScore.bureau.slice(1)} score of ${newCreditScore.score}.` });
  };

  const performDeleteCreditScore = (bureau: 'experian' | 'transunion' | 'equifax', entryId: string) => {
    const updated = {
      ...creditScores,
      [bureau]: creditScores[bureau].filter(e => e.id !== entryId)
    };
    setCreditScores(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships, creditScores: updated });
    toast({ title: 'Score Entry Deleted', description: 'Credit score entry removed.' });
  };

  const handleDeleteCreditScore = (
    bureau: 'experian' | 'transunion' | 'equifax',
    entryId: string,
  ) =>
    askDelete({
      title: 'Delete score entry',
      description: 'Delete this credit score entry? This action cannot be undone.',
      onConfirm: () => performDeleteCreditScore(bureau, entryId),
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
        threshold: selectedDebt.studentLoanPlan ? (taxConfig.studentLoanThresholds[selectedDebt.studentLoanPlan] || 0) : 0
      })
    : [];
  const selectedDebtFinal = selectedDebtProjection[selectedDebtProjection.length - 1];
  // Balance-weighted average rate — a plain mean would over-weight tiny debts
  const weightedInterestRate = totalLoanBalance > 0
    ? debts.reduce((sum, d) => sum + d.interestRate * d.balance, 0) / totalLoanBalance
    : 0;


  return (
    <>
<div className="space-y-8">

  {/* SECTION A: Bank Accounts */}
  <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
      <div className="min-w-0">
        <h3 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary shrink-0" /> Bank Accounts & Credit Cards
        </h3>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">Monitor current balances, card products, and credit accounts</p>
      </div>
      <Button onClick={() => setIsAddAccountOpen(true)} className="rounded-lg gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8 px-3 shrink-0 self-start sm:self-auto font-mono">
        <Plus className="h-3.5 w-3.5" /> Add Account
      </Button>
    </div>

    <div className="overflow-auto max-h-[60vh] bg-card/50 border border-border/40 rounded-xl p-4 sm:p-5 hover:border-border/80 transition-colors -mx-0">
      <table className="min-w-[720px] w-full text-xs text-left border-collapse">
        <thead>
          <tr className="border-b border-border/40 text-muted-foreground uppercase tracking-wider font-semibold">
            <th className="py-3 px-3 whitespace-nowrap">Name</th>
            <th className="py-3 px-3 whitespace-nowrap">Type</th>
            <th className="py-3 px-3 whitespace-nowrap">Issuer</th>
            <th className="py-3 px-3 text-right whitespace-nowrap">Balance</th>
            <th className="py-3 px-3 text-right whitespace-nowrap">Annual Fee</th>
            <th className="py-3 px-3 whitespace-nowrap">Use Case</th>
            <th className="py-3 px-3 text-center whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/20">
          {bankAccounts.map(account => (
            <tr key={account.id} className="hover:bg-muted/10 transition-colors">
              <td className="py-3 px-3 font-semibold text-foreground flex items-center gap-2">
                <span
                  className="w-1.5 h-6 rounded-full shrink-0"
                  style={{ backgroundColor: account.color || 'hsl(var(--muted-foreground))' }}
                />
                <span className="text-base shrink-0 leading-none">{account.emoji || '💰'}</span>
                <span>{account.name}</span>
              </td>
              <td className="py-3 px-3 capitalize">{account.type}</td>
              <td className="py-3 px-3">{account.issuer}</td>
              <td className={cn("py-3 px-3 text-right font-mono font-bold", account.balance >= 0 ? "text-positive" : "text-destructive")}>
                {formatGBP(account.balance)}
              </td>
              <td className="py-3 px-3 text-right font-mono">{formatGBP(account.annualFee)}</td>
              <td className="py-3 px-3 text-muted-foreground truncate max-w-[150px]">{account.useCase || '—'}</td>
              <td className="py-3 px-3 text-center">
                <div className="flex justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setActiveAccount(account);
                      setIsEditAccountOpen(true);
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteAccount(account.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {bankAccounts.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-6 italic text-muted-foreground">No bank accounts added.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>

  {/* TrueLayer Integration Card */}
  <div className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors space-y-5">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="space-y-1">
        <h4 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary shrink-0" /> TrueLayer Open Banking
        </h4>
        <p className="text-xs text-muted-foreground">
          Automatically sync card transactions and account balances in sandbox mode.
        </p>
      </div>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        {trueLayerStatus?.connected ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-positive/10 text-positive border border-positive/20">
            <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
            Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border/40">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            Not Connected
          </span>
        )}
      </div>
    </div>

    <div className="border-t border-border/30 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="text-xs space-y-1.5 max-w-xl">
        {trueLayerStatus?.connected ? (
          <>
            <p className="text-muted-foreground">
              Your bank is securely linked. Live synchronization is active and will pull account details and transaction history.
            </p>
            {trueLayerStatus.expires_at && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <Clock className="h-3 w-3" />
                <span>Consent expires on: {new Date(trueLayerStatus.expires_at).toLocaleString()}</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground leading-relaxed">
            Securely connect your UK/EU mock accounts to automatically fetch balances and recent card statements. No financial data is ever shared or exposed publicly.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 shrink-0">
        {trueLayerStatus?.connected ? (
          <>
            <Button
              onClick={syncTrueLayer}
              disabled={isSyncingTrueLayer}
              className="rounded-xl bg-primary text-primary-foreground gap-1.5 font-semibold text-xs h-9 px-4"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isSyncingTrueLayer && "animate-spin")} />
              {isSyncingTrueLayer ? "Syncing..." : "Sync Now"}
            </Button>
            <Button
              onClick={disconnectTrueLayer}
              variant="destructive"
              className="rounded-xl gap-1.5 font-semibold text-xs h-9 px-4 border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-white"
            >
              Disconnect
            </Button>
          </>
        ) : (
          <Button
            onClick={connectTrueLayer}
            disabled={isConnectingTrueLayer}
            className="rounded-xl bg-primary text-primary-foreground gap-1.5 font-semibold text-xs h-9 px-4"
          >
            {isConnectingTrueLayer ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                Connect Bank Account
                <ArrowUpRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  </div>

  {/* SECTION B: Debt */}
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
          { label: 'Avg Rate', value: `${weightedInterestRate.toFixed(2)}%`, tone: 'text-foreground' }
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
                <td className="py-3 px-3 text-right font-mono font-bold text-destructive">{formatGBP(debt.balance)}</td>
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
                : `Fixed repayment of ${formatGBP(selectedDebt.minPayment)}/month at ${selectedDebt.interestRate.toFixed(2)}%`}
            </p>
          </div>
          {debts.length > 1 && (
            <Select value={selectedDebt.id} onValueChange={setSelectedDebtId}>
              <SelectTrigger className="bg-background/50 border-primary/20 rounded-xl h-9 text-xs w-full sm:w-56 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-primary/10">
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
                <div key={draw.id} className="rounded-xl border border-primary/10 bg-background/40 px-3 py-2 text-xs">
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

  {/* SECTION C: Memberships & Rewards */}
  <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
      <div className="min-w-0">
        <h3 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
          <Award className="h-4 w-4 text-primary shrink-0" /> Memberships & Reward Programs
        </h3>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">Keep track of reward accounts, points programs, and loyalty systems</p>
      </div>
      <Button onClick={() => setIsAddMembershipOpen(true)} className="rounded-lg gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8 px-3 shrink-0 self-start sm:self-auto font-mono">
        <Plus className="h-3.5 w-3.5" /> Add Membership
      </Button>
    </div>

    <div className="overflow-auto max-h-[60vh] bg-card/50 border border-border/40 rounded-xl p-4 sm:p-5 hover:border-border/80 transition-colors">
      <table className="min-w-[640px] w-full text-xs text-left border-collapse">
        <thead>
          <tr className="border-b border-border/40 text-muted-foreground uppercase tracking-wider font-semibold">
            <th className="py-3 px-3 whitespace-nowrap">Name</th>
            <th className="py-3 px-3 whitespace-nowrap">Type</th>
            <th className="py-3 px-3 whitespace-nowrap">Status / Points</th>
            <th className="py-3 px-3 text-right whitespace-nowrap">Annual Fee</th>
            <th className="py-3 px-3 whitespace-nowrap">Use Case</th>
            <th className="py-3 px-3 text-center whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/20">
          {memberships.map(membership => (
            <tr key={membership.id} className="hover:bg-muted/10 transition-colors">
              <td className="py-3 px-3 font-semibold text-foreground">{membership.name}</td>
              <td className="py-3 px-3 capitalize">{membership.type}</td>
              <td className="py-3 px-3">{membership.status}</td>
              <td className="py-3 px-3 text-right font-mono">{formatGBP(membership.annualFee)}</td>
              <td className="py-3 px-3 text-muted-foreground truncate max-w-[200px]">{membership.useCase || '—'}</td>
              <td className="py-3 px-3 text-center">
                <div className="flex justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setActiveMembership(membership);
                      setIsEditMembershipOpen(true);
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteMembership(membership.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {memberships.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center py-6 italic text-muted-foreground">No reward memberships added.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>

  {/* SECTION C: Credit Reports */}
  <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
      <div className="min-w-0">
        <h3 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary shrink-0" /> Credit Reports
        </h3>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">Track your credit scores across all three bureaus over time</p>
      </div>
      <Button onClick={() => setIsAddCreditScoreOpen(true)} className="rounded-lg gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8 px-3 shrink-0 self-start sm:self-auto font-mono">
        <Plus className="h-3.5 w-3.5" /> Log Score
      </Button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Rest of the bureau cards */}
      {creditBureaus.map(bureau => {
        const entries = creditScores[bureau.key];
        const latest = entries.length > 0 ? entries[entries.length - 1] : null;
        const prev = entries.length > 1 ? entries[entries.length - 2] : null;
        const delta = latest && prev ? latest.score - prev.score : 0;

        const getRatingFromBands = (score: number, bureauKey: 'experian' | 'transunion' | 'equifax') => {
          const bands = BUREAU_BANDS[bureauKey];
          const found = bands.find(b => score >= b.min && score <= b.max);
          if (found) {
            return {
              text: found.name,
              cls: CREDIT_TIER_CLASSES[found.tier],
              color: CREDIT_TIER_COLORS[found.tier],
              band: found,
            };
          }
          return { text: 'Unknown', cls: 'text-muted-foreground', color: 'hsl(var(--muted-foreground))', band: null };
        };

        const rating = latest ? getRatingFromBands(latest.score, bureau.key) : null;
        const bands = BUREAU_BANDS[bureau.key];
        const gapAngle = 4;
        const totalSweep = 270;
        const N = bands.length;
        const totalGapAngle = (N - 1) * gapAngle;
        const remainingAngle = totalSweep - totalGapAngle;

        let currentStartAngle = 135;
        const computedSegments = bands.map((band, idx) => {
          const span = band.max - (idx === 0 ? 0 : bands[idx - 1].max);
          const weight = span / bureau.maxScore;
          const segmentAngle = weight * remainingAngle;
          const startAngle = currentStartAngle;
          const endAngle = currentStartAngle + segmentAngle;
          currentStartAngle = endAngle + gapAngle;
          return { band, startAngle, endAngle };
        });

        const scoreAngle = latest ? 135 + (latest.score / bureau.maxScore) * 270 : 135;
        const dotPos = polarToCartesian(72, 72, 54, scoreAngle);

        return (
          <Card key={bureau.key} className={cn("rounded-xl border border-border/40 bg-card/50 overflow-hidden flex flex-col justify-between hover:border-border/80 transition-colors", bureau.gradient)}>
            <CardContent className="pt-5 pb-0 px-5 flex flex-col items-center">
              {/* Bureau Label */}
              <span className="text-xs uppercase tracking-wider font-mono font-semibold text-muted-foreground mb-4">{bureau.label}</span>

              {/* Circular/Arch Gauge */}
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-36 h-36 overflow-visible" viewBox="0 0 144 144">
                  <defs>
                    <filter id={`shadow-${bureau.key}`} x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodOpacity="0.25"/>
                    </filter>
                  </defs>

                  {/* Outer background thin ring */}
                  <circle
                    cx="72"
                    cy="72"
                    r="64"
                    stroke="currentColor"
                    className="text-primary/10"
                    strokeWidth="1"
                    fill="transparent"
                  />

                  {/* Base background track */}
                  <path
                    d={describeArc(72, 72, 54, 135, 405)}
                    fill="transparent"
                    stroke="currentColor"
                    className="text-primary/10"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />

                  {/* Segmented Bands */}
                  {computedSegments.map(({ band, startAngle, endAngle }) => {
                    const isHovered = hoveredBands[bureau.key]?.name === band.name;
                    const hasHover = hoveredBands[bureau.key] !== null;

                    let opacity = 1;
                    let strokeWidth = 10;

                    if (hasHover) {
                      opacity = isHovered ? 1 : 0.25;
                      strokeWidth = isHovered ? 12 : 10;
                    } else if (latest) {
                      const isFutureBand = latest.score < band.min;
                      opacity = isFutureBand ? 0.25 : 1;
                    }

                    return (
                      <path
                        key={band.name}
                        d={describeArc(72, 72, 54, startAngle, endAngle)}
                        fill="transparent"
                        stroke={CREDIT_TIER_COLORS[band.tier]}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        style={{
                          opacity,
                          transition: 'all 0.3s ease',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={() => setHoveredBands(prev => ({ ...prev, [bureau.key]: band }))}
                        onMouseLeave={() => setHoveredBands(prev => ({ ...prev, [bureau.key]: null }))}
                      />
                    );
                  })}

                  {/* Score Indicator Dot */}
                  {latest && (
                    <circle
                      cx={dotPos.x}
                      cy={dotPos.y}
                      r="6"
                      fill="hsl(var(--background))"
                      stroke={rating?.color || bureau.color}
                      strokeWidth="2.5"
                      filter={`url(#shadow-${bureau.key})`}
                      style={{
                        transition: 'all 0.7s ease-out'
                      }}
                    />
                  )}

                  {/* Center Text content inside SVG */}
                  {hoveredBands[bureau.key] ? (
                    <g>
                      <text
                        x="72"
                        y="64"
                        textAnchor="middle"
                        className="font-bold text-xs uppercase tracking-wider"
                        fill={bandColor(hoveredBands[bureau.key])}
                      >
                        {hoveredBands[bureau.key]?.name}
                      </text>
                      <text
                        x="72"
                        y="82"
                        textAnchor="middle"
                        className="font-mono font-bold text-xs"
                        fill="currentColor"
                      >
                        {hoveredBands[bureau.key]?.min} - {hoveredBands[bureau.key]?.max}
                      </text>
                    </g>
                  ) : (
                    <g>
                      <text
                        x="72"
                        y="68"
                        textAnchor="middle"
                        className="font-mono font-bold text-3xl"
                        fill={bureau.color}
                      >
                        {latest ? latest.score : '—'}
                      </text>
                      <text
                        x="72"
                        y="84"
                        textAnchor="middle"
                        className="text-xs font-medium"
                        fill="currentColor"
                        opacity="0.6"
                      >
                        of {bureau.maxScore}
                      </text>
                      {rating && (
                        <text
                          x="72"
                          y="98"
                          textAnchor="middle"
                          className="font-bold text-xs uppercase tracking-wider"
                          fill={rating.color}
                        >
                          {rating.text}
                        </text>
                      )}
                    </g>
                  )}
                </svg>
              </div>

              {/* Delta + Date */}
              <div className="flex items-center gap-3 mt-3 mb-4">
                {delta !== 0 && (
                  <span className={cn("text-xs font-bold font-mono flex items-center gap-0.5", delta > 0 ? "text-positive" : "text-destructive")}>
                    {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {delta > 0 ? '+' : ''}{delta}
                  </span>
                )}
                {latest && (
                  <span className="text-xs text-muted-foreground">Last checked: {latest.date}</span>
                )}
              </div>
            </CardContent>

            {/* Interactive History / Hover Overlay Area */}
            <div className="px-6 pb-5 pt-2 border-t border-border/10 min-h-[145px] relative overflow-hidden">
              <AnimatePresence mode="wait">
                {hoveredBands[bureau.key] ? (
                  <motion.div
                    key="overlay"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 15 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-x-6 bottom-5 top-2 flex flex-col justify-center bg-background/95 dark:bg-card/95 backdrop-blur-sm z-10"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: bandColor(hoveredBands[bureau.key]) }}>
                        {hoveredBands[bureau.key]?.name}
                      </span>
                      <span className="text-xs font-bold font-mono text-muted-foreground bg-primary/5 px-2 py-0.5 rounded-md border border-border/40">
                        {hoveredBands[bureau.key]?.min} - {hoveredBands[bureau.key]?.max}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {hoveredBands[bureau.key]?.description}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="h-full flex flex-col"
                  >
                    <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">History</div>
                    {entries.length > 0 ? (
                      <div className="space-y-1 max-h-[100px] overflow-y-auto pr-1">
                        {[...entries].reverse().map(entry => (
                          <div key={entry.id} className="group flex items-center justify-between py-1 border-b border-border/10 last:border-b-0">
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground font-mono w-20">{entry.date}</span>
                              <span className="text-xs font-mono font-bold" style={{ color: bureau.color }}>{entry.score}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteCreditScore(bureau.key, entry.id)}
                              className="text-destructive hover:text-destructive p-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground/60 italic flex-1 flex items-center justify-center">
                        No credit history recorded.
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        );
      })}
    </div>
  </div>

</div>
<Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
  <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm">
    <DialogHeader>
      <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Add Bank Account</DialogTitle>
      <DialogDescription className="text-xs">Add a new personal bank account or credit card.</DialogDescription>
    </DialogHeader>
    <form onSubmit={handleAddAccount} className="space-y-4 py-2">
      <div className="space-y-1">
        <Label htmlFor="acc-name">Account Name</Label>
        <Input
          id="acc-name"
          placeholder="e.g. Chase Saver"
          value={newAccount.name}
          onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="acc-type">Account Type</Label>
        <Select
          value={newAccount.type}
          onValueChange={(val) => setNewAccount({ ...newAccount, type: val as BankAccount['type'] })}
        >
          <SelectTrigger id="acc-type" className="bg-background/50 border-primary/20 rounded-xl h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-primary/10">
            <SelectItem value="checking">Checking</SelectItem>
            <SelectItem value="savings">Savings</SelectItem>
            <SelectItem value="credit">Credit Card</SelectItem>
            <SelectItem value="investment">Investment</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="acc-issuer">Issuer / Bank</Label>
        <Input
          id="acc-issuer"
          placeholder="e.g. Chase Bank"
          value={newAccount.issuer}
          onChange={(e) => setNewAccount({ ...newAccount, issuer: e.target.value })}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="acc-balance">Balance (£)</Label>
        <Input
          id="acc-balance"
          type="number"
          step="0.01"
          placeholder="e.g. 5200 (Use negative for credit balance)"
          value={newAccount.balance}
          onChange={(e) => setNewAccount({ ...newAccount, balance: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="acc-fee">Annual Fee (£)</Label>
        <Input
          id="acc-fee"
          type="number"
          placeholder="e.g. 195"
          value={newAccount.annualFee}
          onChange={(e) => setNewAccount({ ...newAccount, annualFee: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="acc-use">Primary Use Case</Label>
        <Input
          id="acc-use"
          placeholder="e.g. Salary deposits, tech purchases"
          value={newAccount.useCase}
          onChange={(e) => setNewAccount({ ...newAccount, useCase: e.target.value })}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="acc-emoji">Emoji Icon</Label>
          <Input
            id="acc-emoji"
            placeholder="e.g. 🏦"
            value={newAccount.emoji || ''}
            onChange={(e) => setNewAccount({ ...newAccount, emoji: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50 text-center text-lg"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="acc-color">Accent Color</Label>
          <div className="flex gap-2">
            <Input
              id="acc-color"
              type="color"
              value={newAccount.color || 'hsl(var(--muted-foreground))'}
              onChange={(e) => setNewAccount({ ...newAccount, color: e.target.value })}
              className="rounded-xl h-10 w-12 border-primary/20 bg-background/50 p-1 cursor-pointer"
            />
            <Input
              type="text"
              value={newAccount.color || 'hsl(var(--muted-foreground))'}
              onChange={(e) => setNewAccount({ ...newAccount, color: e.target.value })}
              className="rounded-xl h-10 border-primary/20 bg-background/50 font-mono text-xs uppercase flex-1"
            />
          </div>
        </div>
      </div>
      <DialogFooter className="pt-4 gap-2 sm:gap-0">
        <Button variant="outline" type="button" onClick={() => setIsAddAccountOpen(false)} className="rounded-xl">Cancel</Button>
        <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Account</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
<Dialog open={isEditAccountOpen} onOpenChange={setIsEditAccountOpen}>
  <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm">
    <DialogHeader>
      <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Edit Account</DialogTitle>
      <DialogDescription className="text-xs">Update account metrics.</DialogDescription>
    </DialogHeader>
    {activeAccount && (
      <form onSubmit={handleEditAccount} className="space-y-4 py-2">
        <div className="space-y-1">
          <Label htmlFor="edit-acc-name">Account Name</Label>
          <Input
            id="edit-acc-name"
            value={activeAccount.name}
            onChange={(e) => setActiveAccount({ ...activeAccount, name: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-acc-balance">Balance (£)</Label>
          <Input
            id="edit-acc-balance"
            type="number"
            step="0.01"
            value={activeAccount.balance}
            onChange={(e) => setActiveAccount({ ...activeAccount, balance: parseFloat(e.target.value) || 0 })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-acc-fee">Annual Fee (£)</Label>
          <Input
            id="edit-acc-fee"
            type="number"
            value={activeAccount.annualFee}
            onChange={(e) => setActiveAccount({ ...activeAccount, annualFee: parseFloat(e.target.value) || 0 })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-acc-use">Primary Use Case</Label>
          <Input
            id="edit-acc-use"
            value={activeAccount.useCase || ''}
            onChange={(e) => setActiveAccount({ ...activeAccount, useCase: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="edit-acc-emoji">Emoji Icon</Label>
            <Input
              id="edit-acc-emoji"
              placeholder="e.g. 🏦"
              value={activeAccount.emoji || ''}
              onChange={(e) => setActiveAccount({ ...activeAccount, emoji: e.target.value })}
              className="rounded-xl h-10 border-primary/20 bg-background/50 text-center text-lg"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-acc-color">Accent Color</Label>
            <div className="flex gap-2">
              <Input
                id="edit-acc-color"
                type="color"
                value={activeAccount.color || 'hsl(var(--muted-foreground))'}
                onChange={(e) => setActiveAccount({ ...activeAccount, color: e.target.value })}
                className="rounded-xl h-10 w-12 border-primary/20 bg-background/50 p-1 cursor-pointer"
              />
              <Input
                type="text"
                value={activeAccount.color || 'hsl(var(--muted-foreground))'}
                onChange={(e) => setActiveAccount({ ...activeAccount, color: e.target.value })}
                className="rounded-xl h-10 border-primary/20 bg-background/50 font-mono text-xs uppercase flex-1"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="pt-4 gap-2 sm:gap-0">
          <Button variant="outline" type="button" onClick={() => setIsEditAccountOpen(false)} className="rounded-xl">Cancel</Button>
          <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Changes</Button>
        </DialogFooter>
      </form>
    )}
  </DialogContent>
</Dialog>
<Dialog open={isAddMembershipOpen} onOpenChange={setIsAddMembershipOpen}>
  <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm">
    <DialogHeader>
      <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Add Reward Membership</DialogTitle>
      <DialogDescription className="text-xs">Add a new point, loyalty or reward system.</DialogDescription>
    </DialogHeader>
    <form onSubmit={handleAddMembership} className="space-y-4 py-2">
      <div className="space-y-1">
        <Label htmlFor="mem-name">Membership Program</Label>
        <Input
          id="mem-name"
          placeholder="e.g. Tesco Clubcard"
          value={newMembership.name}
          onChange={(e) => setNewMembership({ ...newMembership, name: e.target.value })}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="mem-type">Program Type</Label>
        <Select
          value={newMembership.type}
          onValueChange={(val) => setNewMembership({ ...newMembership, type: val as Membership['type'] })}
        >
          <SelectTrigger id="mem-type" className="bg-background/50 border-primary/20 rounded-xl h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-primary/10">
            <SelectItem value="points">Points Program</SelectItem>
            <SelectItem value="cashback">Cashback Reward</SelectItem>
            <SelectItem value="miles">Airline Miles</SelectItem>
            <SelectItem value="perks">Exclusive Perks</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="mem-status">Status / Tier / Point Count</Label>
        <Input
          id="mem-status"
          placeholder="e.g. Silver Tier (1200 points)"
          value={newMembership.status}
          onChange={(e) => setNewMembership({ ...newMembership, status: e.target.value })}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="mem-fee">Annual Fee (£)</Label>
        <Input
          id="mem-fee"
          type="number"
          placeholder="e.g. 0"
          value={newMembership.annualFee}
          onChange={(e) => setNewMembership({ ...newMembership, annualFee: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="mem-use">Primary Use Case</Label>
        <Input
          id="mem-use"
          placeholder="e.g. Grocery cash savings"
          value={newMembership.useCase}
          onChange={(e) => setNewMembership({ ...newMembership, useCase: e.target.value })}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
        />
      </div>
      <DialogFooter className="pt-4 gap-2 sm:gap-0">
        <Button variant="outline" type="button" onClick={() => setIsAddMembershipOpen(false)} className="rounded-xl">Cancel</Button>
        <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Program</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
<Dialog open={isEditMembershipOpen} onOpenChange={setIsEditMembershipOpen}>
  <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm">
    <DialogHeader>
      <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Edit Reward Program</DialogTitle>
      <DialogDescription className="text-xs">Update loyalty account details.</DialogDescription>
    </DialogHeader>
    {activeMembership && (
      <form onSubmit={handleEditMembership} className="space-y-4 py-2">
        <div className="space-y-1">
          <Label htmlFor="edit-mem-name">Program Name</Label>
          <Input
            id="edit-mem-name"
            value={activeMembership.name}
            onChange={(e) => setActiveMembership({ ...activeMembership, name: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-mem-status">Status / Tier</Label>
          <Input
            id="edit-mem-status"
            value={activeMembership.status}
            onChange={(e) => setActiveMembership({ ...activeMembership, status: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-mem-fee">Annual Fee (£)</Label>
          <Input
            id="edit-mem-fee"
            type="number"
            value={activeMembership.annualFee}
            onChange={(e) => setActiveMembership({ ...activeMembership, annualFee: parseFloat(e.target.value) || 0 })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-mem-use">Primary Use Case</Label>
          <Input
            id="edit-mem-use"
            value={activeMembership.useCase || ''}
            onChange={(e) => setActiveMembership({ ...activeMembership, useCase: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
          />
        </div>
        <DialogFooter className="pt-4 gap-2 sm:gap-0">
          <Button variant="outline" type="button" onClick={() => setIsEditMembershipOpen(false)} className="rounded-xl">Cancel</Button>
          <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Changes</Button>
        </DialogFooter>
      </form>
    )}
  </DialogContent>
</Dialog>
<Dialog open={isAddDebtOpen} onOpenChange={setIsAddDebtOpen}>
  <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm max-h-[85vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Add Debt</DialogTitle>
      <DialogDescription className="text-xs">Track a mortgage, student loan or other borrowing.</DialogDescription>
    </DialogHeader>
    <form onSubmit={handleAddDebt} className="space-y-4 py-2">
      <div className="space-y-1">
        <Label htmlFor="debt-name">Debt Name</Label>
        <Input
          id="debt-name"
          placeholder="e.g. Flat Mortgage"
          value={newDebt.name}
          onChange={(e) => setNewDebt({ ...newDebt, name: e.target.value })}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="debt-type">Debt Type</Label>
        <Select
          value={newDebt.type}
          onValueChange={(val) => setNewDebt({ ...newDebt, type: val as Debt['type'] })}
        >
          <SelectTrigger id="debt-type" className="bg-background/50 border-primary/20 rounded-xl h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-primary/10">
            {Object.entries(DEBT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="debt-repayment">How It's Repaid</Label>
        <Select
          value={newDebt.repaymentType}
          onValueChange={(val) => setNewDebt({
            ...newDebt,
            repaymentType: val as Debt['repaymentType'],
            studentLoanPlan: val === 'income_contingent' ? (newDebt.studentLoanPlan || 'plan2') : undefined,
            writeOffYears: val === 'income_contingent'
              ? (newDebt.writeOffYears ?? STUDENT_LOAN_WRITE_OFF_YEARS[newDebt.studentLoanPlan || 'plan2'])
              : undefined
          })}
        >
          <SelectTrigger id="debt-repayment" className="bg-background/50 border-primary/20 rounded-xl h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-primary/10">
            <SelectItem value="amortising">Fixed monthly payment</SelectItem>
            <SelectItem value="income_contingent">% of income over threshold</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {newDebt.repaymentType === 'income_contingent' && (
        <>
          <div className="space-y-1">
            <Label htmlFor="debt-plan">Student Loan Plan</Label>
            <Select
              value={newDebt.studentLoanPlan || 'plan2'}
              onValueChange={(val) => setNewDebt({
                ...newDebt,
                studentLoanPlan: val as StudentLoanPlanKey,
                writeOffYears: STUDENT_LOAN_WRITE_OFF_YEARS[val as StudentLoanPlanKey]
              })}
            >
              <SelectTrigger id="debt-plan" className="bg-background/50 border-primary/20 rounded-xl h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-primary/10">
                {Object.entries(STUDENT_LOAN_PLAN_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Repays {taxConfig.studentLoanRates[newDebt.studentLoanPlan || 'plan2'] || 0}% of income above {formatGBP(taxConfig.studentLoanThresholds[newDebt.studentLoanPlan || 'plan2'] || 0)}.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="debt-writeoff">Written Off After (years)</Label>
            <Input
              id="debt-writeoff"
              type="number"
              value={newDebt.writeOffYears ?? ''}
              onChange={(e) => setNewDebt({ ...newDebt, writeOffYears: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
              className="rounded-xl h-10 border-primary/20 bg-background/50"
            />
          </div>
        </>
      )}
      <div className="space-y-1">
        <Label htmlFor="debt-lender">Lender</Label>
        <Input
          id="debt-lender"
          placeholder="e.g. Nationwide"
          value={newDebt.lender}
          onChange={(e) => setNewDebt({ ...newDebt, lender: e.target.value })}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="debt-original">Original (£)</Label>
          <Input
            id="debt-original"
            type="number"
            step="0.01"
            placeholder="250000"
            value={newDebt.draws.length > 0 ? sumDraws(newDebt.draws) : newDebt.originalAmount}
            onChange={(e) => setNewDebt({ ...newDebt, originalAmount: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
            disabled={newDebt.draws.length > 0}
            className="rounded-xl h-10 border-primary/20 bg-background/50 disabled:opacity-70"
          />
          {newDebt.draws.length > 0 && (
            <p className="text-xs text-muted-foreground">Summed from borrowing history</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="debt-balance">Owed Now (£)</Label>
          <Input
            id="debt-balance"
            type="number"
            step="0.01"
            placeholder="198400"
            value={newDebt.balance}
            onChange={(e) => setNewDebt({ ...newDebt, balance: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="debt-rate">Interest Rate (%)</Label>
          <Input
            id="debt-rate"
            type="number"
            step="0.01"
            placeholder="4.75"
            value={newDebt.interestRate}
            onChange={(e) => setNewDebt({ ...newDebt, interestRate: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="debt-payment">Monthly (£)</Label>
          <Input
            id="debt-payment"
            type="number"
            step="0.01"
            placeholder="1150"
            value={newDebt.minPayment}
            onChange={(e) => setNewDebt({ ...newDebt, minPayment: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="debt-start">Taken On</Label>
          <Input
            id="debt-start"
            type="date"
            value={newDebt.startDate}
            onChange={(e) => setNewDebt({ ...newDebt, startDate: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="debt-payoff">Expected Payoff</Label>
          <Input
            id="debt-payoff"
            type="date"
            value={newDebt.payoffDate}
            onChange={(e) => setNewDebt({ ...newDebt, payoffDate: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
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
          <Label htmlFor="debt-emoji">Emoji</Label>
          <Input
            id="debt-emoji"
            placeholder="🏠"
            value={newDebt.emoji}
            onChange={(e) => setNewDebt({ ...newDebt, emoji: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="debt-color">Colour</Label>
          <Input
            id="debt-color"
            type="color"
            value={newDebt.color}
            onChange={(e) => setNewDebt({ ...newDebt, color: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50 p-1"
          />
        </div>
      </div>
      <DialogFooter className="pt-4 gap-2 sm:gap-0">
        <Button variant="outline" type="button" onClick={() => setIsAddDebtOpen(false)} className="rounded-xl">Cancel</Button>
        <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Debt</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
<Dialog open={isEditDebtOpen} onOpenChange={setIsEditDebtOpen}>
  <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm max-h-[85vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Edit Debt</DialogTitle>
      <DialogDescription className="text-xs">Update balance, rate or payoff schedule.</DialogDescription>
    </DialogHeader>
    {activeDebt && (
      <form onSubmit={handleEditDebt} className="space-y-4 py-2">
        <div className="space-y-1">
          <Label htmlFor="edit-debt-name">Debt Name</Label>
          <Input
            id="edit-debt-name"
            value={activeDebt.name}
            onChange={(e) => setActiveDebt({ ...activeDebt, name: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-debt-type">Debt Type</Label>
          <Select
            value={activeDebt.type}
            onValueChange={(val) => setActiveDebt({ ...activeDebt, type: val as Debt['type'] })}
          >
            <SelectTrigger id="edit-debt-type" className="bg-background/50 border-primary/20 rounded-xl h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-primary/10">
              {Object.entries(DEBT_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-debt-repayment">How It's Repaid</Label>
          <Select
            value={activeDebt.repaymentType}
            onValueChange={(val) => setActiveDebt({
              ...activeDebt,
              repaymentType: val as Debt['repaymentType'],
              studentLoanPlan: val === 'income_contingent' ? (activeDebt.studentLoanPlan || 'plan2') : undefined,
              writeOffYears: val === 'income_contingent'
                ? (activeDebt.writeOffYears ?? STUDENT_LOAN_WRITE_OFF_YEARS[activeDebt.studentLoanPlan || 'plan2'])
                : undefined
            })}
          >
            <SelectTrigger id="edit-debt-repayment" className="bg-background/50 border-primary/20 rounded-xl h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-primary/10">
              <SelectItem value="amortising">Fixed monthly payment</SelectItem>
              <SelectItem value="income_contingent">% of income over threshold</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {activeDebt.repaymentType === 'income_contingent' && (
          <>
            <div className="space-y-1">
              <Label htmlFor="edit-debt-plan">Student Loan Plan</Label>
              <Select
                value={activeDebt.studentLoanPlan || 'plan2'}
                onValueChange={(val) => setActiveDebt({
                  ...activeDebt,
                  studentLoanPlan: val as StudentLoanPlanKey,
                  writeOffYears: STUDENT_LOAN_WRITE_OFF_YEARS[val as StudentLoanPlanKey]
                })}
              >
                <SelectTrigger id="edit-debt-plan" className="bg-background/50 border-primary/20 rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10">
                  {Object.entries(STUDENT_LOAN_PLAN_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Repays {taxConfig.studentLoanRates[activeDebt.studentLoanPlan || 'plan2'] || 0}% of income above {formatGBP(taxConfig.studentLoanThresholds[activeDebt.studentLoanPlan || 'plan2'] || 0)}.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-debt-writeoff">Written Off After (years)</Label>
              <Input
                id="edit-debt-writeoff"
                type="number"
                value={activeDebt.writeOffYears ?? ''}
                onChange={(e) => setActiveDebt({ ...activeDebt, writeOffYears: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                className="rounded-xl h-10 border-primary/20 bg-background/50"
              />
            </div>
          </>
        )}
        <div className="space-y-1">
          <Label htmlFor="edit-debt-lender">Lender</Label>
          <Input
            id="edit-debt-lender"
            value={activeDebt.lender}
            onChange={(e) => setActiveDebt({ ...activeDebt, lender: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="edit-debt-original">Original (£)</Label>
            <Input
              id="edit-debt-original"
              type="number"
              step="0.01"
              value={activeDebt.draws.length > 0 ? sumDraws(activeDebt.draws) : activeDebt.originalAmount}
              onChange={(e) => setActiveDebt({ ...activeDebt, originalAmount: parseFloat(e.target.value) || 0 })}
              disabled={activeDebt.draws.length > 0}
              className="rounded-xl h-10 border-primary/20 bg-background/50 disabled:opacity-70"
            />
            {activeDebt.draws.length > 0 && (
              <p className="text-xs text-muted-foreground">Summed from borrowing history</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-debt-balance">Owed Now (£)</Label>
            <Input
              id="edit-debt-balance"
              type="number"
              step="0.01"
              value={activeDebt.balance}
              onChange={(e) => setActiveDebt({ ...activeDebt, balance: parseFloat(e.target.value) || 0 })}
              className="rounded-xl h-10 border-primary/20 bg-background/50"
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="edit-debt-rate">Interest Rate (%)</Label>
            <Input
              id="edit-debt-rate"
              type="number"
              step="0.01"
              value={activeDebt.interestRate}
              onChange={(e) => setActiveDebt({ ...activeDebt, interestRate: parseFloat(e.target.value) || 0 })}
              className="rounded-xl h-10 border-primary/20 bg-background/50"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-debt-payment">Monthly (£)</Label>
            <Input
              id="edit-debt-payment"
              type="number"
              step="0.01"
              value={activeDebt.minPayment}
              onChange={(e) => setActiveDebt({ ...activeDebt, minPayment: parseFloat(e.target.value) || 0 })}
              className="rounded-xl h-10 border-primary/20 bg-background/50"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="edit-debt-start">Taken On</Label>
            <Input
              id="edit-debt-start"
              type="date"
              value={activeDebt.startDate || ''}
              onChange={(e) => setActiveDebt({ ...activeDebt, startDate: e.target.value || undefined })}
              className="rounded-xl h-10 border-primary/20 bg-background/50"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-debt-payoff">Expected Payoff</Label>
            <Input
              id="edit-debt-payoff"
              type="date"
              value={activeDebt.payoffDate || ''}
              onChange={(e) => setActiveDebt({ ...activeDebt, payoffDate: e.target.value || undefined })}
              className="rounded-xl h-10 border-primary/20 bg-background/50"
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
            <Label htmlFor="edit-debt-emoji">Emoji</Label>
            <Input
              id="edit-debt-emoji"
              value={activeDebt.emoji || ''}
              onChange={(e) => setActiveDebt({ ...activeDebt, emoji: e.target.value })}
              className="rounded-xl h-10 border-primary/20 bg-background/50"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-debt-color">Colour</Label>
            <Input
              id="edit-debt-color"
              type="color"
              value={activeDebt.color || 'hsl(var(--destructive))'}
              onChange={(e) => setActiveDebt({ ...activeDebt, color: e.target.value })}
              className="rounded-xl h-10 border-primary/20 bg-background/50 p-1"
            />
          </div>
        </div>
        <DialogFooter className="pt-4 gap-2 sm:gap-0">
          <Button variant="outline" type="button" onClick={() => setIsEditDebtOpen(false)} className="rounded-xl">Cancel</Button>
          <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Changes</Button>
        </DialogFooter>
      </form>
    )}
  </DialogContent>
</Dialog>
<Dialog open={isAddCreditScoreOpen} onOpenChange={setIsAddCreditScoreOpen}>
  <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm">
    <DialogHeader>
      <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Log Credit Score</DialogTitle>
      <DialogDescription className="text-xs">Manually log your latest credit score from any bureau.</DialogDescription>
    </DialogHeader>
    <form onSubmit={handleAddCreditScore} className="space-y-4 py-2">
      <div className="space-y-1">
        <Label htmlFor="cs-bureau" className="text-xs">Credit Bureau</Label>
        <Select
          value={newCreditScore.bureau}
          onValueChange={(val) => setNewCreditScore({ ...newCreditScore, bureau: val as 'experian' | 'transunion' | 'equifax' })}
        >
          <SelectTrigger id="cs-bureau" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs">
            <SelectValue placeholder="Select bureau..." />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-primary/10">
            {creditBureaus.map(b => (
              <SelectItem key={b.key} value={b.key} className="text-xs">
                {b.emoji} {b.label} (0–{b.maxScore})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="cs-score" className="text-xs">Score</Label>
        <Input
          id="cs-score"
          type="number"
          min="0"
          placeholder="e.g. 720"
          value={newCreditScore.score}
          onChange={(e) => setNewCreditScore({ ...newCreditScore, score: e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0 })}
          className="rounded-xl h-10 border-primary/20 bg-background/50 text-sm font-mono"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cs-date" className="text-xs">Date Checked</Label>
        <Input
          id="cs-date"
          type="date"
          value={newCreditScore.date}
          onChange={(e) => setNewCreditScore({ ...newCreditScore, date: e.target.value })}
          className="rounded-xl h-10 border-primary/20 bg-background/50 text-sm"
          required
        />
      </div>
      <DialogFooter className="pt-4 gap-2 sm:gap-0">
        <Button variant="outline" type="button" onClick={() => setIsAddCreditScoreOpen(false)} className="rounded-xl">Cancel</Button>
        <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Log Score</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
      {deleteDialog}
    </>
  );
}

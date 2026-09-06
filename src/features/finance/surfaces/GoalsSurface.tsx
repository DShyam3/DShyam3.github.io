/**
 * Goals — one of the two sections on the Plan surface (REHAUL_PLAN.md 7.C).
 *
 * Owns everything about goals: the view, its two dialogs, its CRUD handlers
 * and its own confirm-delete step. `useDeleteConfirm` is a hook, so a surface
 * can hold its own rather than borrowing the page's -- which is what let the
 * delete handlers move here at all (7.2c-i).
 */

import { useState } from 'react';
import { Plus, Trash2, Pencil, Archive, ArchiveRestore, ChevronRight, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatGBP } from '@/features/finance/utils/calculations';
import type { Goal } from '../finance-types';
import { useFinanceData } from '../FinanceDataContext';
import { DialogFooter } from '@/components/ui/dialog';
import { formatReadableDate } from '@/features/finance/utils/calculations';
import { ChevronDown, PiggyBank, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';

export default function GoalsSurface() {
  const { toast } = useToast();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const {
    bankAccounts,
    setBankAccounts,
    creditScores,
    memberships,
    goals,
    setGoals,
    saveDataToSupabase,
    selectedGoalId,
    setSelectedGoalId,
  } = useFinanceData();

  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);

  // Form Fields State
  const [newGoal, setNewGoal] = useState<{
    name: string;
    targetAmount: number | '';
    targetDate: string;
    startDate: string;
    emoji: string;
    status: 'active' | 'archived';
  }>({ name: '', targetAmount: '', targetDate: '', startDate: '', emoji: '', status: 'active' });

  const [newContribution, setNewContribution] = useState<{
    amount: number | '';
    note: string;
    date: string;
    bankAccountId: string;
  }>({ amount: '', note: '', date: new Date().toISOString().split('T')[0], bankAccountId: '' });

  const [collapsedGoalGroups, setCollapsedGoalGroups] = useState<{
    active: boolean;
    readyToSpend: boolean;
    archived: boolean;
  }>({ active: false, readyToSpend: false, archived: false });

  const [isEditGoalOpen, setIsEditGoalOpen] = useState(false);

  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.name || newGoal.targetAmount === '' || newGoal.targetAmount <= 0) {
      toast({ title: 'Invalid Goal', description: 'Please enter a valid name and target amount.', variant: 'destructive' });
      return;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const created: Goal = {
      id: 'g_' + Date.now(),
      name: newGoal.name,
      targetAmount: newGoal.targetAmount,
      currentAmount: 0,
      targetDate: newGoal.targetDate || todayStr,
      startDate: newGoal.startDate || todayStr,
      status: newGoal.status || 'active',
      emoji: newGoal.emoji || undefined,
      contributions: []
    };
    const updated = [...goals, created];
    setGoals(updated);
    saveDataToSupabase('goals', updated);
    setIsAddGoalOpen(false);
    setNewGoal({ name: '', targetAmount: '', targetDate: '', startDate: '', emoji: '', status: 'active' });
    setSelectedGoalId(created.id);
    toast({ title: 'Goal Added', description: `Successfully created goal "${created.name}".` });
  };

  const performDeleteGoal = (id: string) => {
    const updated = goals.filter(g => g.id !== id);
    setGoals(updated);
    saveDataToSupabase('goals', updated);
    if (selectedGoalId === id) {
      setSelectedGoalId(updated[0]?.id || null);
    }
    toast({ title: 'Goal Deleted', description: 'Savings goal removed.' });
  };

  const handleDeleteGoal = (id: string) =>
    askDelete({
      name: goals.find(g => g.id === id)?.name,
      description: 'Deleting this savings goal also removes its contribution history. This action cannot be undone.',
      onConfirm: () => performDeleteGoal(id),
    });

  const handleToggleArchiveGoal = (id: string) => {
    const targetGoal = goals.find(g => g.id === id);
    if (!targetGoal) return;
    const isCurrentlyArchived = targetGoal.status === 'archived';
    const nextStatus = isCurrentlyArchived ? 'active' : 'archived';

    const updated = goals.map(g => {
      if (g.id === id) {
        return { ...g, status: nextStatus as 'active' | 'archived' };
      }
      return g;
    });

    setGoals(updated);
    saveDataToSupabase('goals', updated);
    toast({
      title: isCurrentlyArchived ? 'Goal Restored' : 'Goal Archived',
      description: `Successfully ${isCurrentlyArchived ? 'restored' : 'archived'} goal "${targetGoal.name}".`
    });
  };

  const handleEditGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal || !editingGoal.name || editingGoal.targetAmount <= 0) {
      toast({ title: 'Invalid Goal', description: 'Please enter a valid name and target amount.', variant: 'destructive' });
      return;
    }

    const updated = goals.map(g => {
      if (g.id === editingGoal.id) {
        return {
          ...g,
          name: editingGoal.name,
          targetAmount: editingGoal.targetAmount,
          startDate: editingGoal.startDate,
          targetDate: editingGoal.targetDate,
          emoji: editingGoal.emoji || undefined,
          status: editingGoal.status || 'active'
        };
      }
      return g;
    });

    setGoals(updated);
    saveDataToSupabase('goals', updated);
    setIsEditGoalOpen(false);
    setEditingGoal(null);
    toast({ title: 'Goal Updated', description: `Successfully updated goal "${editingGoal.name}".` });
  };

  const handleAddContribution = (e: React.FormEvent, goalId: string) => {
    e.preventDefault();
    if (newContribution.amount === '' || newContribution.amount <= 0) {
      toast({ title: 'Invalid Amount', description: 'Contribution must be greater than £0.00.', variant: 'destructive' });
      return;
    }
    const contribAmount = newContribution.amount;

    let updatedAccounts = [...bankAccounts];
    if (newContribution.bankAccountId) {
      const accId = newContribution.bankAccountId;
      const selectedAcc = bankAccounts.find(a => a.id === accId);
      if (selectedAcc) {
        const isSavingsOrInvestment = selectedAcc.type === 'savings' || selectedAcc.type === 'investment';
        updatedAccounts = bankAccounts.map(acc => {
          if (acc.id === accId) {
            return {
              ...acc,
              balance: acc.balance + (isSavingsOrInvestment ? contribAmount : -contribAmount)
            };
          }
          return acc;
        });
        setBankAccounts(updatedAccounts);
        saveDataToSupabase('accounts', { bankAccounts: updatedAccounts, memberships, creditScores });
      }
    }

    const updated = goals.map(g => {
      if (g.id === goalId) {
        const contrib = {
          id: 'c_' + Date.now(),
          amount: contribAmount,
          date: newContribution.date || new Date().toISOString().split('T')[0],
          note: newContribution.note || undefined,
          bankAccountId: newContribution.bankAccountId || undefined
        };
        return {
          ...g,
          currentAmount: g.currentAmount + contrib.amount,
          contributions: [contrib, ...g.contributions]
        };
      }
      return g;
    });
    setGoals(updated);
    saveDataToSupabase('goals', updated);
    setNewContribution({ amount: '', note: '', date: new Date().toISOString().split('T')[0], bankAccountId: '' });
    toast({ title: 'Contribution Logged', description: `Added ${formatGBP(contribAmount)} and updated linked account.` });
  };

  const performDeleteContribution = (goalId: string, contribId: string) => {
    let updatedAccounts = [...bankAccounts];
    const updated = goals.map(g => {
      if (g.id === goalId) {
        const contrib = g.contributions.find(c => c.id === contribId);
        if (!contrib) return g;

        if (contrib.bankAccountId) {
          const accId = contrib.bankAccountId;
          const amt = contrib.amount;
          const selectedAcc = bankAccounts.find(a => a.id === accId);
          if (selectedAcc) {
            const isSavingsOrInvestment = selectedAcc.type === 'savings' || selectedAcc.type === 'investment';
            updatedAccounts = bankAccounts.map(acc => {
              if (acc.id === accId) {
                return {
                  ...acc,
                  balance: acc.balance - (isSavingsOrInvestment ? amt : -amt)
                };
              }
              return acc;
            });
            setBankAccounts(updatedAccounts);
            saveDataToSupabase('accounts', { bankAccounts: updatedAccounts, memberships, creditScores });
          }
        }

        return {
          ...g,
          currentAmount: Math.max(0, g.currentAmount - contrib.amount),
          contributions: g.contributions.filter(c => c.id !== contribId)
        };
      }
      return g;
    });
    setGoals(updated);
    saveDataToSupabase('goals', updated);
    toast({ title: 'Contribution Deleted', description: 'Contribution removed and account balance reverted.' });
  };

  const handleDeleteContribution = (goalId: string, contribId: string) =>
    askDelete({
      title: 'Delete contribution',
      description: 'Deleting this contribution reverts the linked account balance. This action cannot be undone.',
      onConfirm: () => performDeleteContribution(goalId, contribId),
    });

  return (
    <>
<div className="space-y-6">

  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
    <div className="min-w-0">
      <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
        <PiggyBank className="h-5 w-5 text-primary shrink-0" /> Savings Goals & Contributions
      </h3>
      <p className="text-xs text-muted-foreground mt-0.5">Manage financial milestones and track contribution deposits manually</p>
    </div>
    <Button onClick={() => setIsAddGoalOpen(true)} className="rounded-xl gap-1.5 bg-primary text-primary-foreground shrink-0 self-start sm:self-auto">
      <Plus className="h-4 w-4" /> Add Goal
    </Button>
  </div>

  {/* Sidebar list + Details layout */}
  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

    {/* Left side: Goal List sidebar */}
    {(() => {
      const renderGoalCard = (goal: Goal) => {
        const isActiveGoal = goal.id === selectedGoalId;
        const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
        return (
          <div
            key={goal.id}
            onClick={() => setSelectedGoalId(isActiveGoal ? null : goal.id)}
            className={cn(
              "p-4 rounded-3xl border cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-3",
              isActiveGoal
                ? "bg-primary/5 border-primary shadow-sm"
                : "bg-card/40 border-border/30 hover:bg-muted/30"
            )}
          >
            <div className="flex justify-between items-start gap-2 min-w-0">
              <span className="text-xs font-bold font-serif text-foreground truncate flex items-center gap-1.5">
                {goal.emoji && <span className="text-base font-normal shrink-0">{goal.emoji}</span>}
                <span>{goal.name}</span>
              </span>
              <span className="text-xs text-muted-foreground font-mono shrink-0">{formatReadableDate(goal.targetDate)}</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground">
                  <span className="font-bold text-foreground font-mono">{formatGBP(goal.currentAmount)}</span>
                  <span> of </span>
                  <span className="font-mono">{formatGBP(goal.targetAmount)}</span>
                </span>
                <span className="font-bold text-emerald-500 font-mono text-xs">{progress.toFixed(0)}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
              </div>
            </div>
          </div>
        );
      };

      const activeGoals = goals.filter(g => g.status !== 'archived' && g.currentAmount < g.targetAmount);
      const readyToSpendGoals = goals.filter(g => g.status !== 'archived' && g.currentAmount >= g.targetAmount);
      const archivedGoals = goals.filter(g => g.status === 'archived');

      return (
        <div className="md:col-span-5 space-y-5">
          {/* Active Goals Group */}
          <div className="space-y-2">
            <button
              onClick={() => setCollapsedGoalGroups(prev => ({ ...prev, active: !prev.active }))}
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors w-full text-left"
            >
              <ChevronDown className={cn("h-3 w-3 transition-transform duration-200 shrink-0", collapsedGoalGroups.active && "-rotate-90")} />
              <span>Active</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground font-normal">{activeGoals.length}</span>
            </button>
            {!collapsedGoalGroups.active && (
              <div className="space-y-3 pl-1">
                {activeGoals.map(renderGoalCard)}
                {activeGoals.length === 0 && (
                  <p className="text-xs text-muted-foreground italic pl-4 py-2">No active savings goals.</p>
                )}
              </div>
            )}
          </div>

          {/* Ready to spend Goals Group */}
          <div className="space-y-2">
            <button
              onClick={() => setCollapsedGoalGroups(prev => ({ ...prev, readyToSpend: !prev.readyToSpend }))}
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors w-full text-left"
            >
              <ChevronDown className={cn("h-3 w-3 transition-transform duration-200 shrink-0", collapsedGoalGroups.readyToSpend && "-rotate-90")} />
              <span>Ready to spend</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground font-normal">{readyToSpendGoals.length}</span>
            </button>
            {!collapsedGoalGroups.readyToSpend && (
              <div className="space-y-3 pl-1">
                {readyToSpendGoals.map(renderGoalCard)}
                {readyToSpendGoals.length === 0 && (
                  <p className="text-xs text-muted-foreground italic pl-4 py-2">No goals ready to spend.</p>
                )}
              </div>
            )}
          </div>

          {/* Archived Goals Group */}
          <div className="space-y-2">
            <button
              onClick={() => setCollapsedGoalGroups(prev => ({ ...prev, archived: !prev.archived }))}
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors w-full text-left"
            >
              <ChevronDown className={cn("h-3 w-3 transition-transform duration-200 shrink-0", collapsedGoalGroups.archived && "-rotate-90")} />
              <span>Archived</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground font-normal">{archivedGoals.length}</span>
            </button>
            {!collapsedGoalGroups.archived && (
              <div className="space-y-3 pl-1">
                {archivedGoals.map(renderGoalCard)}
                {archivedGoals.length === 0 && (
                  <p className="text-xs text-muted-foreground italic pl-4 py-2">No archived goals.</p>
                )}
              </div>
            )}
          </div>
        </div>
      );
    })()}

    {/* Right side: Selected Goal Details Panel */}
    <div className="md:col-span-7">
      {(() => {
        const goal = goals.find(g => g.id === selectedGoalId);
        if (!goal) return <p className="text-xs text-muted-foreground italic text-center py-8">Select a goal from the list to view its details.</p>;

        const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
        const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

        const sortedContributions = [...(goal.contributions || [])].sort((a, b) => a.date.localeCompare(b.date));
        const startD = goal.startDate || (sortedContributions[0] ? sortedContributions[0].date : new Date().toISOString().split('T')[0]);

        let currentTotal = 0;
        const chartData = [{
          date: startD,
          amount: 0,
          formattedDate: formatReadableDate(startD)
        }];

        sortedContributions.forEach(c => {
          currentTotal += c.amount;
          chartData.push({
            date: c.date,
            amount: currentTotal,
            formattedDate: formatReadableDate(c.date)
          });
        });

        const todayStr = new Date().toISOString().split('T')[0];
        if (chartData[chartData.length - 1].date < todayStr) {
          chartData.push({
            date: todayStr,
            amount: currentTotal,
            formattedDate: formatReadableDate(todayStr)
          });
        }

        return (
          <Card className="bg-card/40 border border-primary/10 rounded-3xl p-6 space-y-6">

            {/* Title Block */}
            <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start border-b border-border/30 pb-4">
              <div className="space-y-1 min-w-0">
                <span className="text-xl md:text-2xl font-bold font-serif text-foreground block break-words flex items-center gap-2">
                  {goal.emoji && <span className="text-2xl font-normal shrink-0">{goal.emoji}</span>}
                  <span>{goal.name}</span>
                </span>
                <span className="text-xs text-muted-foreground block">Timeline: {formatReadableDate(startD)} – {formatReadableDate(goal.targetDate)}</span>
              </div>
              <div className="flex items-start justify-between md:justify-end gap-4 shrink-0">
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block uppercase tracking-wider">Saved</span>
                  <span className="text-xl font-bold text-emerald-500 font-mono block">{formatGBP(goal.currentAmount)}</span>
                  <span className="text-xs text-emerald-500/80 font-medium block mt-0.5">
                    {progress >= 100 ? "Goal achieved!" : `${progress.toFixed(0)}% complete`}
                  </span>
                </div>
                <div className="flex gap-1.5 sm:gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingGoal(goal);
                      setIsEditGoalOpen(true);
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/10 rounded-xl"
                    title="Edit Goal"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleArchiveGoal(goal.id)}
                    className={cn(
                      "h-8 w-8 rounded-xl",
                      goal.status === 'archived'
                        ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                    )}
                    title={goal.status === 'archived' ? "Restore / Unarchive Goal" : "Archive Goal"}
                  >
                    {goal.status === 'archived' ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Chart: Progress Over Time */}
            <div className="h-44 w-full bg-muted/5 rounded-2xl border border-border/10 p-2 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="goalProgressGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="formattedDate"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 9 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `£${v}`}
                    tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 9 }}
                  />
                  <RechartsTooltip
                    formatter={(value: number) => [formatGBP(value), 'Saved']}
                    labelFormatter={(label) => `Date: ${label}`}
                    contentStyle={{
                      backgroundColor: 'rgba(30, 30, 46, 0.9)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '16px',
                      fontSize: '11px',
                      color: '#cdd6f4'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#goalProgressGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Summary Block */}
            <div className="pt-2">
              <span className="text-xs font-bold text-foreground block mb-3">Summary</span>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-border/20 pb-1.5">
                  <span className="text-muted-foreground">Goal amount</span>
                  <span className="font-bold font-mono text-foreground">{formatGBP(goal.targetAmount)}</span>
                </div>
                <div className="flex justify-between border-b border-border/20 pb-1.5">
                  <span className="text-muted-foreground">Start date</span>
                  <span className="font-medium text-foreground">{formatReadableDate(startD)}</span>
                </div>
                <div className="flex justify-between border-b border-border/20 pb-1.5">
                  <span className="text-muted-foreground">Target date</span>
                  <span className="font-medium text-foreground">{formatReadableDate(goal.targetDate)}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-muted-foreground">Saving mode</span>
                  <span className="font-medium text-foreground">Target date</span>
                </div>
              </div>
            </div>

            {/* Contribution Logging Form */}
            <form onSubmit={(e) => handleAddContribution(e, goal.id)} className="space-y-3 pt-2">
              <span className="text-xs font-bold text-foreground">Log New Contribution</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <Input
                  type="number"
                  placeholder="Amount (£)"
                  value={newContribution.amount}
                  onChange={(e) => setNewContribution({ ...newContribution, amount: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs"
                  required
                />
                <Input
                  type="text"
                  placeholder="Note / Source"
                  value={newContribution.note}
                  onChange={(e) => setNewContribution({ ...newContribution, note: e.target.value })}
                  className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs"
                />
                <select
                  value={newContribution.bankAccountId || ''}
                  onChange={(e) => setNewContribution({ ...newContribution, bankAccountId: e.target.value })}
                  className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
                >
                  <option value="">No linked account (Manual)</option>
                  {bankAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type} - {formatGBP(acc.balance)})
                    </option>
                  ))}
                </select>
                <Button type="submit" className="rounded-xl h-10 bg-primary text-primary-foreground font-medium text-xs">
                  Add Contribution
                </Button>
              </div>
            </form>

            {/* Contributions List */}
            <div className="space-y-3 pt-4 border-t border-border/30">
              <span className="text-xs font-bold text-foreground">Contribution Ledger</span>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {goal.contributions.map(c => {
                  const acc = c.bankAccountId ? bankAccounts.find(a => a.id === c.bankAccountId) : null;
                  return (
                    <div key={c.id} className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center p-3 rounded-2xl bg-muted/10 border border-border/20 text-xs">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold font-mono">{formatGBP(c.amount)}</span>
                          {acc && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-medium">
                              {acc.name}
                            </span>
                          )}
                        </div>
                        {c.note && <span className="text-xs text-muted-foreground block">"{c.note}"</span>}
                        <span className="text-xs text-muted-foreground/60 block font-mono">{c.date}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteContribution(goal.id, c.id)}
                        className="h-7 w-7 text-rose-500 hover:text-rose-600 shrink-0 self-end sm:self-center"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
                {goal.contributions.length === 0 && (
                  <p className="text-xs text-muted-foreground italic text-center py-4">No contributions logged yet.</p>
                )}
              </div>
            </div>

          </Card>
        );
      })()}
    </div>

  </div>

</div>
<Dialog open={isAddGoalOpen} onOpenChange={setIsAddGoalOpen}>
  <DialogContent className="rounded-3xl border-primary/10 max-w-sm">
    <DialogHeader>
      <DialogTitle className="font-serif">Add Savings Goal</DialogTitle>
      <DialogDescription className="text-xs">Create a new milestone target and timeline.</DialogDescription>
    </DialogHeader>
    <form onSubmit={handleAddGoal} className="space-y-4 py-2">
      <div className="space-y-1">
        <Label htmlFor="goal-name">Goal Name</Label>
        <Input
          id="goal-name"
          placeholder="e.g. New Macbook Pro"
          value={newGoal.name}
          onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="goal-target">Target Amount (£)</Label>
        <Input
          id="goal-target"
          type="number"
          placeholder="e.g. 2500"
          value={newGoal.targetAmount}
          onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="goal-start-date">Start Date</Label>
          <Input
            id="goal-start-date"
            type="date"
            value={newGoal.startDate}
            onChange={(e) => setNewGoal({ ...newGoal, startDate: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="goal-emoji">Emoji Icon</Label>
          <Input
            id="goal-emoji"
            placeholder="e.g. 🎯"
            value={newGoal.emoji || ''}
            onChange={(e) => setNewGoal({ ...newGoal, emoji: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50 text-center text-lg"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="goal-date">Target Date</Label>
        <Input
          id="goal-date"
          type="date"
          value={newGoal.targetDate}
          onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
        />
      </div>
      <DialogFooter className="pt-4 gap-2 sm:gap-0">
        <Button variant="outline" type="button" onClick={() => setIsAddGoalOpen(false)} className="rounded-xl">Cancel</Button>
        <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Goal</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
<Dialog open={isEditGoalOpen} onOpenChange={setIsEditGoalOpen}>
  <DialogContent className="rounded-3xl border-primary/10 max-w-sm">
    <DialogHeader>
      <DialogTitle className="font-serif">Edit Savings Goal</DialogTitle>
      <DialogDescription className="text-xs">Modify the details of your savings milestone.</DialogDescription>
    </DialogHeader>
    {editingGoal && (
      <form onSubmit={handleEditGoal} className="space-y-4 py-2">
        <div className="space-y-1">
          <Label htmlFor="edit-goal-name">Goal Name</Label>
          <Input
            id="edit-goal-name"
            placeholder="e.g. New Macbook Pro"
            value={editingGoal.name}
            onChange={(e) => setEditingGoal({ ...editingGoal, name: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-goal-target">Target Amount (£)</Label>
          <Input
            id="edit-goal-target"
            type="number"
            placeholder="e.g. 2500"
            value={editingGoal.targetAmount}
            onChange={(e) => setEditingGoal({ ...editingGoal, targetAmount: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="edit-goal-start-date">Start Date</Label>
            <Input
              id="edit-goal-start-date"
              type="date"
              value={editingGoal.startDate || ''}
              onChange={(e) => setEditingGoal({ ...editingGoal, startDate: e.target.value })}
              className="rounded-xl h-10 border-primary/20 bg-background/50"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-goal-emoji">Emoji Icon</Label>
            <Input
              id="edit-goal-emoji"
              placeholder="e.g. 🎯"
              value={editingGoal.emoji || ''}
              onChange={(e) => setEditingGoal({ ...editingGoal, emoji: e.target.value })}
              className="rounded-xl h-10 border-primary/20 bg-background/50 text-center text-lg"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-goal-date">Target Date</Label>
          <Input
            id="edit-goal-date"
            type="date"
            value={editingGoal.targetDate}
            onChange={(e) => setEditingGoal({ ...editingGoal, targetDate: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-goal-status">Status</Label>
          <Select
            value={editingGoal.status || 'active'}
            onValueChange={(val) => setEditingGoal({ ...editingGoal, status: val as 'active' | 'archived' })}
          >
            <SelectTrigger id="edit-goal-status" className="bg-background/50 border-primary/20 rounded-xl h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-primary/10">
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="pt-4 gap-2 sm:gap-0">
          <Button variant="outline" type="button" onClick={() => setIsEditGoalOpen(false)} className="rounded-xl">Cancel</Button>
          <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Changes</Button>
        </DialogFooter>
      </form>
    )}
  </DialogContent>
</Dialog>
      {deleteDialog}
    </>
  );
}

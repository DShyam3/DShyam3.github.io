import React from 'react';
import { Goal, BankAccount } from '@/types/finance';
import { PiggyBank, Plus, ChevronDown, Pencil, Archive, ArchiveRestore, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { formatGBP, formatReadableDate } from '@/components/finance/utils/calculations';

interface NewContribution {
  amount: number | '';
  note: string;
  date: string;
  bankAccountId: string;
}

interface CollapsedGoalGroups {
  active: boolean;
  readyToSpend: boolean;
  archived: boolean;
}

interface GoalsTabProps {
  goals: Goal[];
  bankAccounts: BankAccount[];
  selectedGoalId: string | null;
  onSelectGoal: (id: string | null) => void;
  collapsedGoalGroups: CollapsedGoalGroups;
  onToggleGroup: (group: keyof CollapsedGoalGroups) => void;
  onOpenAddGoal: () => void;
  onEditGoal: (goal: Goal) => void;
  onToggleArchiveGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  newContribution: NewContribution;
  onChangeNewContribution: (value: NewContribution) => void;
  onAddContribution: (e: React.FormEvent, goalId: string) => void;
  onDeleteContribution: (goalId: string, contribId: string) => void;
}

export const GoalsTab: React.FC<GoalsTabProps> = ({
  goals,
  bankAccounts,
  selectedGoalId,
  onSelectGoal,
  collapsedGoalGroups,
  onToggleGroup,
  onOpenAddGoal,
  onEditGoal,
  onToggleArchiveGoal,
  onDeleteGoal,
  newContribution,
  onChangeNewContribution,
  onAddContribution,
  onDeleteContribution,
}) => {
  const renderGoalCard = (goal: Goal) => {
    const isActiveGoal = goal.id === selectedGoalId;
    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
    return (
      <div
        key={goal.id}
        onClick={() => onSelectGoal(isActiveGoal ? null : goal.id)}
        className={cn(
          'p-4 rounded-3xl border cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-3',
          isActiveGoal
            ? 'bg-primary/5 border-primary shadow-sm'
            : 'bg-card/40 border-border/30 hover:bg-muted/30',
        )}
      >
        <div className="flex justify-between items-start gap-2 min-w-0">
          <span className="text-xs font-bold font-serif text-foreground truncate flex items-center gap-1.5">
            {goal.emoji && <span className="text-base font-normal shrink-0">{goal.emoji}</span>}
            <span>{goal.name}</span>
          </span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">{formatReadableDate(goal.targetDate)}</span>
        </div>
        <div className="space-y-1.5 text-[10px]">
          <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground">
              <span className="font-bold text-foreground font-mono">{formatGBP(goal.currentAmount)}</span>
              <span> of </span>
              <span className="font-mono">{formatGBP(goal.targetAmount)}</span>
            </span>
            <span className="font-bold text-fin-positive font-mono text-[11px]">{progress.toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-fin-positive rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        </div>
      </div>
    );
  };

  const activeGoals = goals.filter(g => g.status !== 'archived' && g.currentAmount < g.targetAmount);
  const readyToSpendGoals = goals.filter(g => g.status !== 'archived' && g.currentAmount >= g.targetAmount);
  const archivedGoals = goals.filter(g => g.status === 'archived');
  const selectedGoal = goals.find(g => g.id === selectedGoalId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
        <div className="min-w-0">
          <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-primary shrink-0" /> Savings Goals & Contributions
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Manage financial milestones and track contribution deposits manually</p>
        </div>
        <Button onClick={onOpenAddGoal} className="rounded-xl gap-1.5 bg-primary text-primary-foreground shrink-0 self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Add Goal
        </Button>
      </div>

      {/* Sidebar list + Details layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left side: Goal List sidebar */}
        <div className="md:col-span-5 space-y-5">
          {(
            [
              { key: 'active' as const, label: 'Active', list: activeGoals, empty: 'No active savings goals.' },
              { key: 'readyToSpend' as const, label: 'Ready to spend', list: readyToSpendGoals, empty: 'No goals ready to spend.' },
              { key: 'archived' as const, label: 'Archived', list: archivedGoals, empty: 'No archived goals.' },
            ]
          ).map(group => (
            <div key={group.key} className="space-y-2">
              <button
                onClick={() => onToggleGroup(group.key)}
                className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors w-full text-left"
              >
                <ChevronDown className={cn('h-3 w-3 transition-transform duration-200 shrink-0', collapsedGoalGroups[group.key] && '-rotate-90')} />
                <span>{group.label}</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground font-normal">{group.list.length}</span>
              </button>
              {!collapsedGoalGroups[group.key] && (
                <div className="space-y-3 pl-1">
                  {group.list.map(renderGoalCard)}
                  {group.list.length === 0 && (
                    <p className="text-[10px] text-muted-foreground italic pl-4 py-2">{group.empty}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right side: Selected Goal Details Panel */}
        <div className="md:col-span-7">
          {!selectedGoal ? (
            <p className="text-xs text-muted-foreground italic text-center py-8">Select a goal from the list to view its details.</p>
          ) : (
            <GoalDetailsPanel
              goal={selectedGoal}
              bankAccounts={bankAccounts}
              onEditGoal={onEditGoal}
              onToggleArchiveGoal={onToggleArchiveGoal}
              onDeleteGoal={onDeleteGoal}
              newContribution={newContribution}
              onChangeNewContribution={onChangeNewContribution}
              onAddContribution={onAddContribution}
              onDeleteContribution={onDeleteContribution}
            />
          )}
        </div>
      </div>
    </div>
  );
};

interface GoalDetailsPanelProps {
  goal: Goal;
  bankAccounts: BankAccount[];
  onEditGoal: (goal: Goal) => void;
  onToggleArchiveGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  newContribution: NewContribution;
  onChangeNewContribution: (value: NewContribution) => void;
  onAddContribution: (e: React.FormEvent, goalId: string) => void;
  onDeleteContribution: (goalId: string, contribId: string) => void;
}

const GoalDetailsPanel: React.FC<GoalDetailsPanelProps> = ({
  goal,
  bankAccounts,
  onEditGoal,
  onToggleArchiveGoal,
  onDeleteGoal,
  newContribution,
  onChangeNewContribution,
  onAddContribution,
  onDeleteContribution,
}) => {
  const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

  const sortedContributions = [...(goal.contributions || [])].sort((a, b) => a.date.localeCompare(b.date));
  const startD = goal.startDate || (sortedContributions[0] ? sortedContributions[0].date : new Date().toISOString().split('T')[0]);

  let currentTotal = 0;
  const chartData = [{ date: startD, amount: 0, formattedDate: formatReadableDate(startD) }];
  sortedContributions.forEach(c => {
    currentTotal += c.amount;
    chartData.push({ date: c.date, amount: currentTotal, formattedDate: formatReadableDate(c.date) });
  });

  const todayStr = new Date().toISOString().split('T')[0];
  if (chartData[chartData.length - 1].date < todayStr) {
    chartData.push({ date: todayStr, amount: currentTotal, formattedDate: formatReadableDate(todayStr) });
  }

  return (
    <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl shadow-sm p-6 space-y-6">
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
            <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Saved</span>
            <span className="text-xl font-bold text-fin-positive font-mono block">{formatGBP(goal.currentAmount)}</span>
            <span className="text-[10px] text-fin-positive/80 font-medium block mt-0.5">
              {progress >= 100 ? 'Goal achieved!' : `${progress.toFixed(0)}% complete`}
            </span>
          </div>
          <div className="flex gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEditGoal(goal)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/10 rounded-xl"
              title="Edit Goal"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleArchiveGoal(goal.id)}
              className={cn(
                'h-8 w-8 rounded-xl',
                goal.status === 'archived'
                  ? 'text-fin-positive hover:text-fin-positive hover:bg-fin-positive/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/10',
              )}
              title={goal.status === 'archived' ? 'Restore / Unarchive Goal' : 'Archive Goal'}
            >
              {goal.status === 'archived' ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDeleteGoal(goal.id)}
              className="h-8 w-8 text-fin-negative hover:text-fin-negative hover:bg-fin-negative/10 rounded-xl"
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
                <stop offset="5%" stopColor="#2f9e6e" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#2f9e6e" stopOpacity={0} />
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
                color: '#cdd6f4',
              }}
            />
            <Area type="monotone" dataKey="amount" stroke="#2f9e6e" strokeWidth={2} fillOpacity={1} fill="url(#goalProgressGrad)" />
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
      <form onSubmit={(e) => onAddContribution(e, goal.id)} className="space-y-3 pt-2">
        <span className="text-xs font-bold text-foreground">Log New Contribution</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <Input
            type="number"
            placeholder="Amount (£)"
            value={newContribution.amount}
            onChange={(e) => onChangeNewContribution({ ...newContribution, amount: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
            className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs"
            required
          />
          <Input
            type="text"
            placeholder="Note / Source"
            value={newContribution.note}
            onChange={(e) => onChangeNewContribution({ ...newContribution, note: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs"
          />
          <select
            value={newContribution.bankAccountId || ''}
            onChange={(e) => onChangeNewContribution({ ...newContribution, bankAccountId: e.target.value })}
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
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-medium">
                        {acc.name}
                      </span>
                    )}
                  </div>
                  {c.note && <span className="text-[10px] text-muted-foreground block">"{c.note}"</span>}
                  <span className="text-[9px] text-muted-foreground/60 block font-mono">{c.date}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDeleteContribution(goal.id, c.id)}
                  className="h-7 w-7 text-fin-negative hover:text-fin-negative shrink-0 self-end sm:self-center"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
          {goal.contributions.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic text-center py-4">No contributions logged yet.</p>
          )}
        </div>
      </div>
    </Card>
  );
};

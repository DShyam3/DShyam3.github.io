import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BankAccount, BudgetCategory, RecurringBill, Goal, MockTransaction, TrueLayerStatus } from '@/types/finance';
import { Activity, ArrowUpRight, CheckCircle2, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Line,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { formatGBP, getBudgetItemSpent, getCategoryDefaultEmoji } from '@/components/finance/utils/calculations';
import { DeltaPill, FinMeter, FinSegmentedControl } from '@/components/finance/ui/primitives';

type SpendRange = 'this_month' | 'last_3m' | 'ytd' | 'all_time';

interface DashboardTabProps {
  onNavigate: (tab: string) => void;

  // Spending progress hero card
  dashboardSpendRange: SpendRange;
  onChangeSpendRange: (range: SpendRange) => void;
  dashboardSpendSpentLabel: string;
  dashboardSpendBudgetLabel: string;
  dashboardSpendTotal: number;
  dashboardSpendBudget: number;
  dashboardSpendStatusText: string;
  isDashboardSpendOverBudget: boolean;
  dashboardSpendChartData: Array<Record<string, string | number>>;
  dashboardSpendXAxisKey: string;
  progressLineColor: string;
  progressGradientColor: string;

  // Net & budget card
  netCashFlow: number;
  comparison: { isPositive: boolean; pct: number };
  freeToSpend: number;
  dailyFreeToSpend: number;
  incomeFlowPercent: number;
  spendFlowPercent: number;
  monthlyIncome: number;
  totalSpent: number;
  totalBudget: number;
  spentPercent: number;
  billsPercent: number;
  freePercent: number;
  unpaidRecurrings: number;

  // Net worth + payday cards
  netWorth: number;
  totalAssets: number;
  totalDebt: number;
  nextPayday: { date: Date; daysRemaining: number };
  breakdownRates: { postTax: { monthly: number } };

  // Transactions review card
  bankAccounts: BankAccount[];
  selectedAccountFilter: string;
  onChangeAccountFilter: (id: string) => void;
  trueLayerStatus: TrueLayerStatus | null;
  isSyncingTrueLayer: boolean;
  onSyncTrueLayer: () => void;
  showAllTransactions: boolean;
  onToggleShowAllTransactions: () => void;
  accountTransactionsCount: number;
  displayedTransactions: MockTransaction[];
  onToggleTransactionReviewed: (id: string) => void;

  // Top spending categories card
  budgetCategories: BudgetCategory[];
  recurrings: RecurringBill[];
  getProgressColor: (spent: number, budgeted: number) => string;

  // Upcoming bills card
  currentMonth: number;
  isDueThisMonth: (bill: RecurringBill, currentMonth: number) => boolean;
  getDueDateText: (bill: RecurringBill, currentMonth: number) => string;
  onToggleRecurringPaid: (id: string) => void;

  // Goals card
  goals: Goal[];
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  onNavigate,
  dashboardSpendRange,
  onChangeSpendRange,
  dashboardSpendSpentLabel,
  dashboardSpendBudgetLabel,
  dashboardSpendTotal,
  dashboardSpendBudget,
  dashboardSpendStatusText,
  isDashboardSpendOverBudget,
  dashboardSpendChartData,
  dashboardSpendXAxisKey,
  progressLineColor,
  progressGradientColor,
  netCashFlow,
  comparison,
  freeToSpend,
  dailyFreeToSpend,
  incomeFlowPercent,
  spendFlowPercent,
  monthlyIncome,
  totalSpent,
  totalBudget,
  spentPercent,
  billsPercent,
  freePercent,
  unpaidRecurrings,
  netWorth,
  totalAssets,
  totalDebt,
  nextPayday,
  breakdownRates,
  bankAccounts,
  selectedAccountFilter,
  onChangeAccountFilter,
  trueLayerStatus,
  isSyncingTrueLayer,
  onSyncTrueLayer,
  showAllTransactions,
  onToggleShowAllTransactions,
  accountTransactionsCount,
  displayedTransactions,
  onToggleTransactionReviewed,
  budgetCategories,
  recurrings,
  getProgressColor,
  currentMonth,
  isDueThisMonth,
  getDueDateText,
  onToggleRecurringPaid,
  goals,
}) => {
  const statusBadge = (
    <span
      className={cn(
        'text-[10px] font-bold font-mono px-2 py-0.5 rounded-full inline-block',
        isDashboardSpendOverBudget ? 'bg-fin-negative/10 text-fin-negative' : 'bg-fin-positive/10 text-fin-positive',
      )}
    >
      {dashboardSpendStatusText}
    </span>
  );

  const budgetAllocation = (() => {
    const spentWidth = totalBudget > 0 ? Math.min(100, spentPercent) : 0;
    const billsWidth = totalBudget > 0 ? Math.min(100 - spentWidth, billsPercent) : 0;
    const freeWidth = totalBudget > 0 && freeToSpend > 0 ? Math.max(0, 100 - spentWidth - billsWidth) : 0;
    return { spentWidth, billsWidth, freeWidth };
  })();

  return (
    <div className="space-y-8">
      {/* PRIMARY COCKPIT: Spending Progress & Core Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2: Spending Progress cumulative chart */}
        <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl shadow-sm p-6 lg:col-span-2 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-serif font-semibold text-foreground flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-primary" /> Spending Progress
                </CardTitle>
                <CardDescription className="text-[10px] text-muted-foreground">
                  {dashboardSpendRange === 'this_month'
                    ? 'Cumulative monthly spent vs budget trajectory'
                    : `Monthly spent vs budget for the selected period (${dashboardSpendSpentLabel.toLowerCase()})`}
                </CardDescription>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-center">
                <FinSegmentedControl
                  options={[
                    { key: 'this_month', label: 'This Month' },
                    { key: 'last_3m', label: 'Last 3M' },
                    { key: 'ytd', label: 'YTD' },
                    { key: 'all_time', label: 'All Time' },
                  ]}
                  value={dashboardSpendRange}
                  onChange={onChangeSpendRange}
                />
                <div className="text-right hidden sm:block">{statusBadge}</div>
              </div>
            </div>

            <div className="block sm:hidden">{statusBadge}</div>

            <div className="flex gap-6 pt-1">
              <div>
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider block">{dashboardSpendSpentLabel}</span>
                <span className="text-2xl font-bold font-mono text-foreground">{formatGBP(dashboardSpendTotal)}</span>
              </div>
              <div className="border-l border-border/50 pl-6">
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider block">{dashboardSpendBudgetLabel}</span>
                <span className="text-2xl font-bold font-mono text-muted-foreground">{formatGBP(dashboardSpendBudget)}</span>
              </div>
            </div>
          </div>

          {/* Recharts Cumulative spending chart */}
          <div className="h-[200px] w-full mt-4 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboardSpendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="progressGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={progressGradientColor} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={progressGradientColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey={dashboardSpendXAxisKey}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 9 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `£${v}`}
                  tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 9 }}
                />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '1rem' }}
                  itemStyle={{ color: 'hsl(var(--foreground))', fontSize: '11px' }}
                  labelStyle={{ fontWeight: 'bold', fontSize: '11px' }}
                  formatter={(value) => [formatGBP(Number(value)), undefined]}
                />
                <Line
                  type="monotone"
                  dataKey="Ideal Limit"
                  stroke="#64748b"
                  strokeDasharray="4 4"
                  dot={false}
                  strokeWidth={1.5}
                  name={dashboardSpendRange === 'this_month' ? 'Ideal Limit' : 'Budget Limit'}
                />
                <Area
                  type="monotone"
                  dataKey="Actual Spent"
                  stroke={progressLineColor}
                  fill="url(#progressGrad)"
                  strokeWidth={2.5}
                  connectNulls={false}
                  dot={false}
                  name="Actual Spent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Column 3: Key Metrics Side-Panel */}
        <div className="space-y-6 flex flex-col justify-between">
          {/* Combined Net & Spendable Card */}
          <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl shadow-sm p-5 flex-1 flex flex-col justify-between space-y-4 text-left">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Net & Budget</span>
                <button
                  onClick={() => onNavigate('cash-flow')}
                  className="text-[9px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors uppercase font-sans"
                >
                  Cash Flow <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider block">Net this month</span>
                  <span className={cn('text-2xl font-extrabold font-mono block tracking-tight whitespace-nowrap', netCashFlow >= 0 ? 'text-fin-positive' : 'text-fin-negative')}>
                    {netCashFlow >= 0 ? '+' : ''}{formatGBP(netCashFlow)}
                  </span>
                  <div className="flex items-center gap-1 text-[8px] text-muted-foreground font-sans truncate">
                    <DeltaPill
                      value={comparison.isPositive ? comparison.pct : -comparison.pct}
                      formatter={(v) => `${comparison.isPositive ? '↗' : '↘'} ${Math.abs(v).toFixed(0)}%`}
                      showSign={false}
                      className="text-[8px] px-1 py-0.5"
                    />
                    <span>vs last month</span>
                  </div>
                </div>

                <div className="space-y-1 border-l-0 sm:border-l border-border/20 pl-0 sm:pl-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider block">Free to Spend</span>
                    <span className={cn('text-2xl font-extrabold font-mono block tracking-tight whitespace-nowrap', freeToSpend >= 0 ? 'text-fin-positive' : 'text-fin-negative')}>
                      {formatGBP(freeToSpend)}
                    </span>
                  </div>
                  {freeToSpend > 0 ? (
                    <p className="text-[9px] text-muted-foreground font-sans mt-0.5">
                      <span className="font-bold text-foreground font-mono">{formatGBP(dailyFreeToSpend)}</span>/day left
                    </p>
                  ) : (
                    <p className="text-[9px] text-fin-negative/80 font-sans font-medium mt-0.5">Over budget</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3.5 border-t border-border/20 pt-3.5">
              <div className="space-y-1">
                <div className="flex justify-between text-[8px] text-muted-foreground uppercase tracking-wider font-mono">
                  <span>Actual Cash Flow</span>
                </div>
                <FinMeter
                  segments={[
                    { key: 'in', percent: incomeFlowPercent, tone: 'positive' },
                    { key: 'out', percent: spendFlowPercent, tone: 'accent' },
                  ]}
                />
                <div className="flex items-center justify-between text-[8px] text-muted-foreground font-mono">
                  <span>In: <span className="text-fin-positive font-bold">{formatGBP(monthlyIncome)}</span></span>
                  <span>Out: <span className="text-foreground font-bold">{formatGBP(totalSpent)}</span></span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[8px] text-muted-foreground uppercase tracking-wider font-mono">
                  <span>Budget Allocation</span>
                </div>
                <FinMeter
                  trackClassName="h-2"
                  segments={[
                    { key: 'spent', percent: budgetAllocation.spentWidth, tone: 'accent' },
                    { key: 'bills', percent: budgetAllocation.billsWidth, tone: 'warn' },
                    { key: 'free', percent: budgetAllocation.freeWidth, tone: 'positive' },
                  ]}
                />
                <div className="flex flex-wrap items-center justify-between text-[8px] font-mono text-muted-foreground gap-y-1">
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-fin-accent" /> Spent ({spentPercent.toFixed(0)}%)</span>
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-fin-warn" /> Bills ({formatGBP(unpaidRecurrings)})</span>
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-fin-positive" /> Free ({freePercent.toFixed(0)}%)</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Net Worth + Payday: paired so the right column reads as one visual rhythm */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl shadow-sm p-4 space-y-1.5 text-left">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Net Worth</span>
              <span className="text-lg font-bold font-mono text-fin-positive block truncate">{formatGBP(netWorth)}</span>
              <div className="flex flex-col gap-0.5 text-[8px] text-muted-foreground border-t border-border/20 pt-1.5 font-mono">
                <span className="text-fin-positive/80">Assets {formatGBP(totalAssets)}</span>
                <span className="text-fin-negative/80">Debt {formatGBP(totalDebt)}</span>
              </div>
            </Card>

            <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl shadow-sm p-4 space-y-1.5 text-left">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Next Payday</span>
              <span className="text-lg font-extrabold text-foreground block truncate">
                {nextPayday.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
              <div className="flex items-center justify-between text-[8px] font-mono border-t border-border/20 pt-1.5">
                <span className="text-fin-positive">+{formatGBP(breakdownRates.postTax.monthly)}</span>
                <span className={cn('font-bold', nextPayday.daysRemaining === 0 ? 'text-fin-positive' : 'text-muted-foreground')}>
                  {nextPayday.daysRemaining === 0 ? 'Today!' : `${nextPayday.daysRemaining}d left`}
                </span>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* LOWER ROW: Interactive Reviews, Top Categories, Upcoming bills */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Unreviewed Transaction Checklist */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl shadow-sm p-6">
            <CardHeader className="p-0 pb-4 border-b border-border/30 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-serif font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <button
                    onClick={() => onNavigate('transactions')}
                    className="hover:text-primary transition-colors flex items-center gap-1 text-left"
                  >
                    Transactions <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </CardTitle>
                <CardDescription className="text-[11px] text-muted-foreground mt-0.5">Review recent aggregate card activity</CardDescription>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {bankAccounts.length > 0 && (
                  <Select value={selectedAccountFilter} onValueChange={onChangeAccountFilter}>
                    <SelectTrigger className="w-[140px] text-[10px] font-sans font-semibold h-8 rounded-xl border-primary/20 bg-background/50">
                      <SelectValue placeholder="All Accounts" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-primary/10">
                      <SelectItem value="all" className="text-[10px]">All Accounts</SelectItem>
                      {bankAccounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id} className="text-[10px]">
                          {acc.emoji} {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {trueLayerStatus?.connected && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSyncTrueLayer}
                    disabled={isSyncingTrueLayer}
                    className="text-[10px] rounded-xl hover:bg-muted font-sans font-semibold h-8 text-primary border-primary/20 gap-1"
                  >
                    <RefreshCw className={cn('h-3 w-3', isSyncingTrueLayer && 'animate-spin')} />
                    {isSyncingTrueLayer ? 'Syncing...' : 'Sync Bank'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleShowAllTransactions}
                  className="text-[10px] rounded-xl hover:bg-muted font-sans font-semibold h-8 text-muted-foreground hover:text-foreground"
                >
                  {showAllTransactions ? 'Show Pending Only' : `View All (${accountTransactionsCount})`}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 pt-4">
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                <AnimatePresence mode="popLayout">
                  {displayedTransactions.map(tx => (
                    <motion.div
                      key={tx.id}
                      layout
                      initial={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -80, scale: 0.95, transition: { duration: 0.2 } }}
                      className={cn(
                        'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 rounded-2xl border border-border/30 transition-all duration-200',
                        tx.isReviewed ? 'opacity-60 bg-muted/10' : 'bg-card/40 hover:bg-muted/30',
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-lg shrink-0 p-1.5 rounded-xl bg-muted/30">
                          {getCategoryDefaultEmoji(tx.category)}
                        </span>
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn('text-xs font-semibold block truncate text-foreground', tx.isReviewed && 'line-through text-muted-foreground')}>
                              {tx.name}
                            </span>
                            {(() => {
                              const linkedAccount = bankAccounts.find(acc => acc.id === tx.accountId);
                              if (!linkedAccount) return null;
                              return (
                                <span
                                  className="text-[9px] font-sans font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 select-none"
                                  style={{
                                    backgroundColor: `${linkedAccount.color || '#4f46e5'}15`,
                                    color: linkedAccount.color || '#4f46e5',
                                    borderColor: `${linkedAccount.color || '#4f46e5'}35`,
                                  }}
                                >
                                  <span>{linkedAccount.emoji || '💰'}</span>
                                  <span>{linkedAccount.name}</span>
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground font-mono">
                            <span>{tx.date}</span>
                            <span>•</span>
                            <span className="uppercase text-[9px] tracking-wider font-semibold text-primary/70">{tx.category}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span className={cn('text-xs font-bold font-mono', tx.amount < 0 ? 'text-fin-positive' : 'text-fin-negative')}>
                          {tx.amount < 0 ? '+' : '-'}{formatGBP(Math.abs(tx.amount))}
                        </span>
                        <Button
                          onClick={() => onToggleTransactionReviewed(tx.id)}
                          size="sm"
                          variant={tx.isReviewed ? 'ghost' : 'default'}
                          className={cn(
                            'h-8 rounded-xl text-[10px] gap-1 px-3 shrink-0 font-semibold',
                            tx.isReviewed
                              ? 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                              : 'bg-fin-positive hover:bg-fin-positive text-white',
                          )}
                        >
                          {tx.isReviewed ? <>Revert</> : <><Check className="h-3 w-3" /> Review</>}
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {displayedTransactions.length === 0 && !showAllTransactions && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-12 text-center space-y-3"
                  >
                    <div className="h-10 w-10 rounded-full bg-fin-positive/10 flex items-center justify-center text-fin-positive text-lg">✨</div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-foreground font-serif uppercase tracking-wider">All Caught Up!</h4>
                      <p className="text-[10px] text-muted-foreground max-w-[220px] mx-auto">No pending transactions left to review. Your budget and metrics are in perfect sync.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onToggleShowAllTransactions}
                      className="rounded-xl text-[10px] h-8 font-sans font-medium"
                    >
                      View Reviewed Ledger
                    </Button>
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Spending Categories gauge */}
          <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl shadow-sm p-6">
            <CardHeader className="p-0 pb-4 border-b border-border/30 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-serif font-semibold text-foreground">Top Spending Categories (For the month)</CardTitle>
                <CardDescription className="text-[11px] text-muted-foreground mt-0.5">Highest spend across your active budget groups</CardDescription>
              </div>
              <span className="text-lg">📊</span>
            </CardHeader>
            <CardContent className="p-0 pt-4 space-y-4">
              {budgetCategories
                .map(cat => {
                  const budget = cat.budgeted !== undefined ? cat.budgeted : cat.items.reduce((s, i) => s + i.budgeted, 0);
                  const spent = cat.items.reduce((s, i) => s + getBudgetItemSpent(i, bankAccounts, recurrings), 0);
                  return { name: cat.name, emoji: cat.emoji || '📂', budget, spent };
                })
                .sort((a, b) => b.spent - a.spent)
                .slice(0, 3)
                .map(cat => (
                  <div key={cat.name} className="space-y-1 text-xs">
                    <div className="flex justify-between gap-2 font-medium min-w-0 items-center">
                      <span className="truncate flex items-center gap-1.5 text-foreground font-semibold">
                        <span className="text-lg leading-none shrink-0">{cat.emoji}</span>
                        <span className="truncate">{cat.name}</span>
                      </span>
                      <span className="font-mono text-muted-foreground shrink-0 whitespace-nowrap text-[10px]">
                        {formatGBP(cat.spent)} / {formatGBP(cat.budget)}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-300', getProgressColor(cat.spent, cat.budget))}
                        style={{ width: `${Math.min(100, cat.budget > 0 ? (cat.spent / cat.budget) * 100 : 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Recurrings List & Active savings goals */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl shadow-sm p-6">
            <CardHeader className="p-0 pb-4 border-b border-border/30 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-serif font-semibold text-foreground">Upcoming Bills</CardTitle>
                <CardDescription className="text-[11px] text-muted-foreground mt-0.5">Bills due in the calendar cycle</CardDescription>
              </div>
              <button
                onClick={() => onNavigate('recurrings')}
                className="text-[9px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors uppercase font-sans"
              >
                Recurrings <ArrowUpRight className="h-3 w-3" />
              </button>
            </CardHeader>
            <CardContent className="p-0 pt-4 space-y-3">
              {recurrings
                .filter(r => isDueThisMonth(r, currentMonth) && !r.isPaid)
                .sort((a, b) => a.dueDate - b.dueDate)
                .slice(0, 3)
                .map(bill => (
                  <div key={bill.id} className="flex items-center justify-between text-xs p-2.5 rounded-2xl bg-muted/10 border border-border/20 gap-3">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground min-w-0">
                        {bill.emoji && <span className="shrink-0 text-sm">{bill.emoji}</span>}
                        <span className="truncate">{bill.name}</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground block font-mono uppercase tracking-wider">{getDueDateText(bill, currentMonth)}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold font-mono text-xs">{formatGBP(bill.amount)}</span>
                      <button
                        onClick={() => onToggleRecurringPaid(bill.id)}
                        className="h-5 w-5 rounded-lg flex items-center justify-center border border-border/40 hover:border-fin-positive/50 hover:bg-fin-positive/10 text-transparent hover:text-fin-positive/70 transition-all shrink-0"
                        title="Mark as Paid"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              {recurrings.filter(r => isDueThisMonth(r, currentMonth) && !r.isPaid).length === 0 && (
                <p className="text-[11px] text-muted-foreground italic text-center py-4">No upcoming bills left to pay!</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl shadow-sm p-6">
            <CardHeader className="p-0 pb-4 border-b border-border/30 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-serif font-semibold text-foreground">Goals</CardTitle>
                <CardDescription className="text-[11px] text-muted-foreground mt-0.5">Target goals and current saved values</CardDescription>
              </div>
              <button
                onClick={() => onNavigate('goals')}
                className="text-[9px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors uppercase font-sans"
              >
                Goals <ArrowUpRight className="h-3 w-3" />
              </button>
            </CardHeader>
            <CardContent className="p-0 pt-4 space-y-4">
              {goals.slice(0, 2).map(goal => {
                const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                return (
                  <div key={goal.id} className="space-y-1 text-xs">
                    <div className="flex justify-between gap-2 font-semibold min-w-0">
                      <span className="truncate text-foreground font-semibold">{goal.name}</span>
                      <span className="font-mono text-fin-positive font-bold">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                      <span>{formatGBP(goal.currentAmount)}</span>
                      <span>Target: {formatGBP(goal.targetAmount)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-fin-positive rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
                    </div>
                  </div>
                );
              })}
              {goals.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic text-center py-4">No active savings goals set up.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

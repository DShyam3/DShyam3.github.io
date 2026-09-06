/**
 * Dashboard — the Home surface (REHAUL_PLAN.md 7.C).
 *
 * The one screen that answers "where am I right now": safe-to-spend, net,
 * net worth, next payday, upcoming bills and the review queue. Every figure
 * comes from useFinanceTotals, so it takes almost nothing from the page.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useToast } from '@/hooks/use-toast';
import { useFinanceData } from '../FinanceDataContext';
import { MONTH_NAMES, getBudgetItemSpent, getDueDateText, isDueThisMonth } from '../finance-defaults';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatGBP, getCategoryDefaultEmoji } from '@/features/finance/utils/calculations';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ArrowUpRight, Check, CheckCircle2, PiggyBank, RefreshCw } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { useFinanceTotals } from '../useFinanceTotals';
import { useTrueLayer } from '../useTrueLayer';
import { pathForTab, type TabKey } from '../surfaces';

export default function DashboardSurface({ toggleRecurringPaid }: { toggleRecurringPaid: (id: string) => void }) {
  const { toast } = useToast();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const {
    bankAccounts,
    budgetCategories,
    goals,
    mockTransactions,
    recurrings,
    saveDataToSupabase,
    setMockTransactions,
    fetchSupabaseData,
  } = useFinanceData();

  const navigate = useNavigate();
  const { trueLayerStatus, isSyncingTrueLayer, syncTrueLayer } = useTrueLayer(fetchSupabaseData);
  const setActiveTab = (tab: TabKey) => navigate(pathForTab(tab));
  const {
    results, breakdownRates, nextPayday, currentMonth, daysInMonth, todayDateObj,
    totalBudget, totalSpent, totalLoanBalance, totalAssets, totalDebt, netWorth,
    monthlyIncome, netCashFlow, freeToSpend, unpaidRecurrings, dailyFreeToSpend,
    incomeFlowPercent, spendFlowPercent, daysRemainingInMonth, currentYear, currentMonthIdx,
  } = useFinanceTotals();

  const getSpendingProgressData = () => {
    const prefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}-`;
    const monthTx = mockTransactions.filter(tx => tx.date.startsWith(prefix));

    const dailyAmounts: Record<number, number> = {};
    monthTx.forEach(tx => {
      const day = parseInt(tx.date.split('-')[2], 10);
      if (!isNaN(day)) {
        dailyAmounts[day] = (dailyAmounts[day] || 0) + tx.amount;
      }
    });

    const data = [];
    let cumulativeSpent = 0;
    const todayDay = todayDateObj.getDate();
    const monthName = MONTH_NAMES[currentMonthIdx].slice(0, 3);

    for (let day = 1; day <= daysInMonth; day++) {
      const idealCumulative = totalBudget > 0 ? (day / daysInMonth) * totalBudget : 0;
      let actualCumulative: number | undefined = undefined;

      if (day <= todayDay) {
        cumulativeSpent += (dailyAmounts[day] || 0);
        actualCumulative = cumulativeSpent;
      }

      data.push({
        day,
        label: `${day} ${monthName}`,
        "Ideal Limit": parseFloat(idealCumulative.toFixed(2)),
        "Actual Spent": actualCumulative !== undefined ? parseFloat(actualCumulative.toFixed(2)) : undefined
      });
    }

    return data;
  };

  const todayDayNum = todayDateObj.getDate();

  // Dashboard spending progress period
  const [dashboardSpendRange, setDashboardSpendRange] = useState<'this_month' | 'last_3m' | 'ytd' | 'all_time'>('this_month');

  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('all');

  const [showAllTransactions, setShowAllTransactions] = useState(false);

  const toggleTransactionReviewed = (id: string) => {
    const updated = mockTransactions.map(t => t.id === id ? { ...t, isReviewed: !t.isReviewed } : t);
    setMockTransactions(updated);
    saveDataToSupabase('transactions', updated);
  };

  // Compare this month's net cash flow to last month's same period
  const getNetComparison = () => {
    const today = new Date();
    const todayDay = today.getDate();
    const thisMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-`;
    
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonthYear = lastMonthDate.getFullYear();
    const lastMonthIdx = lastMonthDate.getMonth();
    const lastMonthPrefix = `${lastMonthYear}-${String(lastMonthIdx + 1).padStart(2, '0')}-`;
    
    // Calculate last month's spend up to today's date
    const lastMonthTx = mockTransactions
      .filter(tx => {
        if (!tx.date.startsWith(lastMonthPrefix)) return false;
        const day = parseInt(tx.date.split('-')[2], 10);
        return !isNaN(day) && day <= todayDay;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);

    const lastMonthBills = recurrings
      .filter(r => {
        if (!isDueThisMonth(r, lastMonthIdx + 1)) return false;
        return r.dueDate <= todayDay;
      })
      .reduce((sum, r) => sum + r.amount, 0);

    const lastMonthSpend = lastMonthTx + lastMonthBills;
    const lastMonthNet = monthlyIncome - lastMonthSpend;

    const diff = netCashFlow - lastMonthNet;
    const pct = lastMonthNet !== 0 ? (diff / Math.abs(lastMonthNet)) * 100 : 0;
    
    const prevMonthName = MONTH_NAMES[lastMonthIdx].slice(0, 3);
    const rangeLabel = `${prevMonthName} 1 - ${prevMonthName} ${todayDay}, ${lastMonthYear}`;
    
    return {
      lastMonthNet,
      pct: Math.abs(pct),
      isPositive: diff >= 0,
      rangeLabel
    };
  };

  const comparison = getNetComparison();

  // Composition bar percentages
  const spentPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const billsPercent = totalBudget > 0 ? (unpaidRecurrings / totalBudget) * 100 : 0;
  const freePercent = totalBudget > 0 ? (Math.max(0, freeToSpend) / totalBudget) * 100 : 0;


  const displayedTransactions = (showAllTransactions
    ? mockTransactions
    : mockTransactions.filter(tx => !tx.isReviewed)
  ).filter(tx => selectedAccountFilter === 'all' || tx.accountId === selectedAccountFilter);

  const accountTransactionsCount = selectedAccountFilter === 'all'
    ? mockTransactions.length
    : mockTransactions.filter(tx => tx.accountId === selectedAccountFilter).length;

  // Spent progress color bar
  const getProgressColor = (spent: number, budgeted: number) => {
    if (budgeted <= 0) return spent > 0 ? 'bg-rose-500' : 'bg-[hsl(var(--positive))] dark:bg-[hsl(var(--positive))]';
    const percent = spent / budgeted;
    if (percent <= 0.75) return 'bg-[hsl(var(--positive))] dark:bg-[hsl(var(--positive))]';
    if (percent <= 1.0) return 'bg-orange-500';
    return 'bg-rose-500';
  };


  const getDashboardSpendData = () => {
    if (dashboardSpendRange === 'this_month') {
      const chartData = getSpendingProgressData();
      const todayProgress = chartData.find(d => d.day === todayDayNum);
      const isOverBudgetToday = todayProgress && todayProgress["Actual Spent"] !== undefined && todayProgress["Actual Spent"] > todayProgress["Ideal Limit"];
      
      let statusText = '';
      if (todayProgress) {
        const diff = Math.abs((todayProgress["Actual Spent"] || 0) - todayProgress["Ideal Limit"]);
        statusText = isOverBudgetToday 
          ? `Over pace by ${formatGBP(diff)}` 
          : `Under pace by ${formatGBP(diff)}`;
      }

      return {
        chartData,
        spent: totalSpent,
        budget: totalBudget,
        spentLabel: "Spent This Month",
        budgetLabel: "Budget Limit",
        statusText,
        isOverBudget: isOverBudgetToday,
        xAxisKey: "label",
      };
    }

    if (dashboardSpendRange === 'all_time') {
      let startYear = currentYear;
      if (mockTransactions.length > 0) {
        const years = mockTransactions
          .map(tx => parseInt(tx.date.split('-')[0], 10))
          .filter(y => !isNaN(y));
        if (years.length > 0) {
          startYear = Math.min(...years);
        }
      }
      if (startYear === currentYear) {
        startYear = currentYear - 1;
      }

      const chartData = [];
      let periodSpentTotal = 0;
      let periodBudgetTotal = 0;

      for (let yr = startYear; yr <= currentYear; yr++) {
        // Transactions in this year
        const yearSpend = mockTransactions
          .filter(tx => tx.date.startsWith(`${yr}-`))
          .reduce((sum, tx) => sum + tx.amount, 0);

        // Recurrings in this year (summed across 12 months)
        let yearRecurringSpend = 0;
        for (let m = 1; m <= 12; m++) {
          yearRecurringSpend += recurrings
            .filter(r => isDueThisMonth(r, m))
            .reduce((sum, r) => sum + r.amount, 0);
        }

        const totalSpentInYear = yearSpend + yearRecurringSpend;
        const budgetLimit = totalBudget * 12;

        periodSpentTotal += totalSpentInYear;
        periodBudgetTotal += budgetLimit;

        chartData.push({
          label: `${yr}`,
          "Ideal Limit": budgetLimit,
          "Actual Spent": parseFloat(totalSpentInYear.toFixed(2)),
        });
      }

      const isOverBudget = periodSpentTotal > periodBudgetTotal;
      const diff = Math.abs(periodSpentTotal - periodBudgetTotal);
      const statusText = isOverBudget
        ? `Over budget by ${formatGBP(diff)}`
        : `Under budget by ${formatGBP(diff)}`;

      return {
        chartData,
        spent: periodSpentTotal,
        budget: periodBudgetTotal,
        spentLabel: "Total Spent",
        budgetLabel: "Total Budget",
        statusText,
        isOverBudget,
        xAxisKey: "label",
      };
    }

    // For multi-month views: last_3m, ytd
    const startPeriod = new Date(currentYear, currentMonthIdx, 1);
    if (dashboardSpendRange === 'last_3m') {
      startPeriod.setMonth(startPeriod.getMonth() - 2);
    } else if (dashboardSpendRange === 'ytd') {
      startPeriod.setMonth(0); // January
    }

    const chartData = [];
    const cursor = new Date(startPeriod.getFullYear(), startPeriod.getMonth(), 1);
    const endPeriod = new Date(currentYear, currentMonthIdx, 1);

    let periodSpentTotal = 0;
    let periodBudgetTotal = 0;

    while (cursor <= endPeriod) {
      const yr = cursor.getFullYear();
      const mo = cursor.getMonth();
      const shortName = MONTH_NAMES[mo].slice(0, 3);
      
      const prefix = `${yr}-${String(mo + 1).padStart(2, '0')}-`;
      const monthSpend = mockTransactions
        .filter(tx => tx.date.startsWith(prefix))
        .reduce((sum, tx) => sum + tx.amount, 0);

      const monthRecurringSpend = recurrings
        .filter(r => isDueThisMonth(r, mo + 1))
        .reduce((sum, r) => sum + r.amount, 0);

      const totalSpentInMonth = monthSpend + monthRecurringSpend;
      const budgetLimit = totalBudget;

      periodSpentTotal += totalSpentInMonth;
      periodBudgetTotal += budgetLimit;

      chartData.push({
        label: `${shortName} '${String(yr).slice(2)}`,
        "Ideal Limit": budgetLimit,
        "Actual Spent": parseFloat(totalSpentInMonth.toFixed(2)),
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    const isOverBudget = periodSpentTotal > periodBudgetTotal;
    const diff = Math.abs(periodSpentTotal - periodBudgetTotal);
    const statusText = isOverBudget
      ? `Over budget by ${formatGBP(diff)}`
      : `Under budget by ${formatGBP(diff)}`;

    return {
      chartData,
      spent: periodSpentTotal,
      budget: periodBudgetTotal,
      spentLabel: "Total Spent",
      budgetLabel: "Total Budget",
      statusText,
      isOverBudget,
      xAxisKey: "label",
    };
  };

  const {
    chartData: dashboardSpendChartData,
    spent: dashboardSpendTotal,
    budget: dashboardSpendBudget,
    spentLabel: dashboardSpendSpentLabel,
    budgetLabel: dashboardSpendBudgetLabel,
    statusText: dashboardSpendStatusText,
    isOverBudget: isDashboardSpendOverBudget,
    xAxisKey: dashboardSpendXAxisKey,
  } = getDashboardSpendData();

  const progressLineColor = isDashboardSpendOverBudget ? 'hsl(var(--chart-4))' : 'hsl(var(--positive))'; // orange/amber vs emerald
  const progressGradientColor = isDashboardSpendOverBudget ? 'hsl(var(--chart-4))' : 'hsl(var(--positive))';

  return (
    <>
<div className="space-y-6">

  {/* PRIMARY COCKPIT: Spending Progress & Core Cards */}
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

    {/* Column 1 & 2: Spending Progress cumulative chart */}
    <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 lg:col-span-2 shadow-xl flex flex-col justify-between">
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-serif font-semibold text-foreground flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-primary" /> Spending Progress
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {dashboardSpendRange === 'this_month'
                ? "Cumulative monthly spent vs budget trajectory"
                : `Monthly spent vs budget for the selected period (${dashboardSpendSpentLabel.toLowerCase()})`}
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-3 self-start sm:self-center">
            <div className="flex bg-muted/30 border border-border/50 rounded-full p-0.5 gap-0.5">
              {[
                { key: 'this_month', label: 'This Month' },
                { key: 'last_3m', label: 'Last 3M' },
                { key: 'ytd', label: 'YTD' },
                { key: 'all_time', label: 'All Time' },
              ].map((opt) => {
                const isActive = dashboardSpendRange === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setDashboardSpendRange(opt.key as any)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold font-sans rounded-full transition-all whitespace-nowrap",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="text-right hidden sm:block">
              <span className={cn(
                "text-xs font-bold font-mono px-2 py-0.5 rounded-full inline-block",
                isDashboardSpendOverBudget ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
              )}>
                {dashboardSpendStatusText}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile-only status display */}
        <div className="block sm:hidden pt-1">
          <span className={cn(
            "text-xs font-bold font-mono px-2 py-0.5 rounded-full inline-block",
            isDashboardSpendOverBudget ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
          )}>
            {dashboardSpendStatusText}
          </span>
        </div>

        <div className="flex gap-4 pt-3 text-xs">
          <div>
            <span className="text-muted-foreground text-xs uppercase block">{dashboardSpendSpentLabel}</span>
            <span className="text-lg font-bold font-mono text-foreground">{formatGBP(dashboardSpendTotal)}</span>
          </div>
          <div className="border-l border-border/50 pl-4">
            <span className="text-muted-foreground text-xs uppercase block">{dashboardSpendBudgetLabel}</span>
            <span className="text-lg font-bold font-mono text-muted-foreground">{formatGBP(dashboardSpendBudget)}</span>
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
            {/* Ideal Curve (grey dashed line) */}
            <Line
              type="monotone"
              dataKey="Ideal Limit"
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              dot={false}
              strokeWidth={1.5}
              name={dashboardSpendRange === 'this_month' ? 'Ideal Limit' : 'Budget Limit'}
            />
            {/* Actual Curve (solid colored area) */}
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

    {/* Column 3: Copilot Key Metrics Side-Panel */}
    <div className="space-y-6 flex flex-col justify-between">

      {/* Combined Net & Spendable Card */}
      <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-xl p-4 sm:p-5 rounded-3xl flex-1 flex flex-col justify-between space-y-4 text-left">
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Net & Budget</span>
            <button
              onClick={() => setActiveTab('cash-flow')}
              className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors uppercase font-sans"
            >
              Cash Flow <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left column: Actual Net Cash Flow */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Net this month</span>
              <span className={cn("text-xl sm:text-2xl font-bold font-mono block tracking-tight whitespace-nowrap", netCashFlow >= 0 ? "text-emerald-500" : "text-rose-500")}>
                {netCashFlow >= 0 ? '+' : ''}{formatGBP(netCashFlow)}
              </span>
              {/* Trend comparison */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-sans truncate">
                <span className={cn(
                  "flex items-center px-1 py-0.5 rounded-full font-bold font-mono text-xs",
                  comparison.isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                )}>
                  {comparison.isPositive ? '↗' : '↘'} {comparison.pct.toFixed(0)}%
                </span>
                <span>vs last month</span>
              </div>
            </div>

            {/* Right column: Free to Spend */}
            <div className="space-y-1 border-l-0 sm:border-l border-border/20 pl-0 sm:pl-4 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <span>Free to Spend</span>
                  <PiggyBank className="h-3 w-3 text-emerald-500" />
                </span>
                <span className={cn("text-xl sm:text-2xl font-bold font-mono block tracking-tight whitespace-nowrap", freeToSpend >= 0 ? "text-emerald-500" : "text-rose-500")}>
                  {formatGBP(freeToSpend)}
                </span>
              </div>
              {freeToSpend > 0 ? (
                <p className="text-xs text-muted-foreground font-sans mt-0.5">
                  <span className="font-bold text-foreground font-mono">{formatGBP(dailyFreeToSpend)}</span>/day left
                </p>
              ) : (
                <p className="text-xs text-rose-500/80 font-sans font-medium mt-0.5">
                  Over budget
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Progress bars section */}
        <div className="space-y-3.5 border-t border-border/20 pt-3">
          {/* Cash Flow Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground uppercase tracking-wider font-mono">
              <span>Actual Cash Flow</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${incomeFlowPercent}%` }} />
              <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${spendFlowPercent}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span>In: <span className="text-emerald-500 font-bold">{formatGBP(monthlyIncome)}</span></span>
              <span>Out: <span className="text-foreground font-bold">{formatGBP(totalSpent)}</span></span>
            </div>
          </div>

          {/* Budget Proportional Segmented Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground uppercase tracking-wider font-mono">
              <span>Budget Allocation</span>
            </div>
            {(() => {
              const spentWidth = totalBudget > 0 ? Math.min(100, spentPercent) : 0;
              const billsWidth = totalBudget > 0 ? Math.min(100 - spentWidth, billsPercent) : 0;
              const freeWidth = totalBudget > 0 && freeToSpend > 0 ? Math.max(0, 100 - spentWidth - billsWidth) : 0;
              return (
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                  <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${spentWidth}%` }} title={`Spent: ${spentPercent.toFixed(0)}%`} />
                  <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${billsWidth}%` }} title={`Bills: ${billsPercent.toFixed(0)}%`} />
                  <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${freeWidth}%` }} title={`Free: ${freePercent.toFixed(0)}%`} />
                </div>
              );
            })()}
            <div className="flex flex-wrap items-center justify-between text-xs font-mono text-muted-foreground gap-y-1">
              <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Spent ({spentPercent.toFixed(0)}%)</span>
              <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Bills ({formatGBP(unpaidRecurrings)})</span>
              <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Free ({freePercent.toFixed(0)}%)</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Net Assets, Debt & Net Cash Flow block */}
      <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-lg p-3 sm:p-4 rounded-3xl space-y-1.5 text-left">
        <span className="text-xs font-semibold text-muted-foreground uppercase">Net Worth</span>
        <span className="text-base font-bold font-mono text-emerald-500 block truncate">{formatGBP(netWorth)}</span>
        <div className="flex justify-between text-xs text-muted-foreground border-t border-border/20 pt-1.5 font-mono">
          <span className="text-emerald-500/80">Assets: {formatGBP(totalAssets)}</span>
          <span className="text-rose-500/80">Debt: {formatGBP(totalDebt)}</span>
        </div>
      </Card>

      {/* Payday details card */}
      <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-lg p-4 sm:p-5 rounded-3xl space-y-4 text-left">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Next Payday</span>
          <button
            onClick={() => setActiveTab('tax-income')}
            className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors uppercase font-sans"
          >
            Tax & Income <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="font-bold text-2xl text-foreground block">
              {nextPayday.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
            <span className="text-xs text-emerald-500 font-mono font-semibold block">
              +{formatGBP(breakdownRates.postTax.monthly)} expected
            </span>
          </div>
          <span className={cn(
            "font-mono px-2.5 py-0.5 rounded-full font-bold text-xs select-none",
            nextPayday.daysRemaining === 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-muted/60 text-muted-foreground"
          )}>
            {nextPayday.daysRemaining === 0 ? "Paid today!" : `${nextPayday.daysRemaining} days left`}
          </span>
        </div>
      </Card>

    </div>

  </div>

  {/* LOWER ROW: Interactive Reviews, Top Categories, Upcoming bills */}
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

    {/* Left Side: Unreviewed Transaction Checklist (lg:col-span-8) */}
    <div className="lg:col-span-8 space-y-6">

      <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl">
        <CardHeader className="p-0 pb-4 border-b border-border/30 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-serif font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <button
                onClick={() => setActiveTab('transactions')}
                className="hover:text-primary transition-colors flex items-center gap-1 text-left"
              >
                Transactions <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">Review recent aggregate card activity</CardDescription>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {bankAccounts.length > 0 && (
              <Select
                value={selectedAccountFilter}
                onValueChange={setSelectedAccountFilter}
              >
                <SelectTrigger className="w-auto min-w-[140px] max-w-[220px] text-xs font-sans font-semibold h-8 rounded-xl border-primary/20 bg-background/50">
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10">
                  <SelectItem value="all" className="text-xs">All Accounts</SelectItem>
                  {bankAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id} className="text-xs">
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
                onClick={syncTrueLayer}
                disabled={isSyncingTrueLayer}
                className="text-xs rounded-xl hover:bg-muted font-sans font-semibold h-8 text-primary border-primary/20 gap-1"
              >
                <RefreshCw className={cn("h-3 w-3", isSyncingTrueLayer && "animate-spin")} />
                {isSyncingTrueLayer ? "Syncing..." : "Sync Bank"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllTransactions(!showAllTransactions)}
              className="text-xs rounded-xl hover:bg-muted font-sans font-semibold h-8 text-muted-foreground hover:text-foreground"
            >
              {showAllTransactions ? "Show Pending Only" : `View All (${accountTransactionsCount})`}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 pt-4">

          {/* Unreviewed list with Exit Animation */}
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            <AnimatePresence mode="popLayout">
              {displayedTransactions.map(tx => (
                <motion.div
                  key={tx.id}
                  layout
                  initial={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -80, scale: 0.95, transition: { duration: 0.2 } }}
                  className={cn(
                    "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 rounded-2xl border border-border/30 transition-all duration-200",
                    tx.isReviewed ? "opacity-60 bg-muted/10" : "bg-card/40 hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-lg shrink-0 p-1.5 rounded-xl bg-muted/30">
                      {getCategoryDefaultEmoji(tx.category)}
                    </span>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn("text-xs font-semibold block truncate text-foreground", tx.isReviewed && "line-through text-muted-foreground")}>
                          {tx.name}
                        </span>
                        {(() => {
                          const linkedAccount = bankAccounts.find(acc => acc.id === tx.accountId);
                          if (!linkedAccount) return null;
                          return (
                            <span 
                              className="text-xs font-sans font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 select-none"
                              style={{ 
                                backgroundColor: `${linkedAccount.color || 'hsl(var(--chart-5))'}15`, 
                                color: linkedAccount.color || 'hsl(var(--chart-5))',
                                borderColor: `${linkedAccount.color || 'hsl(var(--chart-5))'}35`
                              }}
                            >
                              <span>{linkedAccount.emoji || '💰'}</span>
                              <span>{linkedAccount.name}</span>
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground font-mono">
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span className="uppercase text-xs tracking-wider font-semibold text-primary/70">{tx.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span className={cn(
                      "text-xs font-bold font-mono",
                      tx.amount < 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
                    )}>
                      {tx.amount < 0 ? '+' : '-'}{formatGBP(Math.abs(tx.amount))}
                    </span>
                    <Button
                      onClick={() => toggleTransactionReviewed(tx.id)}
                      size="sm"
                      variant={tx.isReviewed ? "ghost" : "default"}
                      className={cn(
                        "h-8 rounded-xl text-xs gap-1 px-3 shrink-0 font-semibold",
                        tx.isReviewed
                          ? "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                          : "bg-emerald-500 hover:bg-emerald-600 text-white"
                      )}
                    >
                      {tx.isReviewed ? (
                        <>Revert</>
                      ) : (
                        <><Check className="h-3 w-3" /> Review</>
                      )}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Empty pending state */}
            {displayedTransactions.length === 0 && !showAllTransactions && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-12 text-center space-y-3"
              >
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-lg">
                  ✨
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-foreground font-serif uppercase tracking-wider">All Caught Up!</h4>
                  <p className="text-xs text-muted-foreground max-w-[220px] mx-auto">No pending transactions left to review. Your budget and metrics are in perfect sync.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllTransactions(true)}
                  className="rounded-xl text-xs h-8 font-sans font-medium"
                >
                  View Reviewed Ledger
                </Button>
              </motion.div>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Top Spending Categories gauge */}
      <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl">
        <CardHeader className="p-0 pb-4 border-b border-border/30 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-serif font-semibold text-foreground">Top Spending Categories (For the month)</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">Highest spend across your active budget groups</CardDescription>
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
                  <span className="font-mono text-muted-foreground shrink-0 whitespace-nowrap text-xs">
                    {formatGBP(cat.spent)} / {formatGBP(cat.budget)}
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-300", getProgressColor(cat.spent, cat.budget))}
                    style={{ width: `${Math.min(100, cat.budget > 0 ? (cat.spent / cat.budget) * 100 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

    </div>

    {/* Right Side: Recurrings List & Active savings goals (lg:col-span-4) */}
    <div className="lg:col-span-4 space-y-6">

      {/* Next two weeks recurrings card */}
      <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl">
        <CardHeader className="p-0 pb-4 border-b border-border/30 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-sm font-serif font-semibold text-foreground">Upcoming Bills</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">Bills due in the calendar cycle</CardDescription>
          </div>
          <button
            onClick={() => setActiveTab('recurrings')}
            className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors uppercase font-sans"
          >
            Recurrings <ArrowUpRight className="h-3 w-3" />
          </button>
        </CardHeader>
        {/* Matches the transactions card above: a long list scrolls inside its
            own card rather than growing the surface (REHAUL_PLAN.md 7.C). */}
        <CardContent className="p-0 pt-4 space-y-3 max-h-[300px] overflow-y-auto pr-1">
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
                  <span className="text-xs text-muted-foreground block font-mono uppercase tracking-wider">{getDueDateText(bill, currentMonth)}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold font-mono text-xs">{formatGBP(bill.amount)}</span>
                  <button
                    onClick={() => toggleRecurringPaid(bill.id)}
                    className="h-5 w-5 rounded-lg flex items-center justify-center border border-border/40 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-transparent hover:text-emerald-500/70 transition-all shrink-0"
                    title="Mark as Paid"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          {recurrings.filter(r => isDueThisMonth(r, currentMonth) && !r.isPaid).length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-4">No upcoming bills left to pay!</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl">
        <CardHeader className="p-0 pb-4 border-b border-border/30 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-sm font-serif font-semibold text-foreground">Goals</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">Target goals and current saved values</CardDescription>
          </div>
          <button
            onClick={() => setActiveTab('goals')}
            className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors uppercase font-sans"
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
                  <span className="font-mono text-emerald-500 font-bold">
                    {progress.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground font-mono">
                  <span>{formatGBP(goal.currentAmount)}</span>
                  <span>Target: {formatGBP(goal.targetAmount)}</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
                </div>
              </div>
            );
          })}
          {goals.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-4">No active savings goals set up.</p>
          )}
        </CardContent>
      </Card>

    </div>

  </div>

</div>

      {deleteDialog}
    </>
  );
}

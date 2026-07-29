import React from 'react';
import { BudgetCategory, BudgetItem, BankAccount, RecurringBill, MockTransaction } from '@/types/finance';
import { Activity, Plus, ChevronDown, ChevronRight, Pencil, Trash2, Edit2, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';
import { formatGBP, getBudgetItemSpent, FIN_CHART_PALETTE, FIN_HEX, isDueThisMonth } from '@/components/finance/utils/calculations';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface ActiveBudgetItem extends BudgetItem {
  categoryId: string;
}

interface BudgetTabProps {
  budgetCategories: BudgetCategory[];
  bankAccounts: BankAccount[];
  recurrings: RecurringBill[];
  mockTransactions: MockTransaction[];
  getCategoryBudget: (cat: BudgetCategory) => number;
  getCategorySpent: (cat: BudgetCategory) => number;
  isItemActive: (item: BudgetItem, cat: BudgetCategory) => boolean;
  isCategoryActive: (cat: BudgetCategory) => boolean;

  selectedBudgetCategoryFilter: string;
  onChangeCategoryFilter: (id: string) => void;
  expandedCategories: Record<string, boolean>;
  onToggleExpandedCategory: (categoryId: string, expanded: boolean) => void;

  onOpenAddCategory: () => void;
  onOpenAddItem: (categoryId: string) => void;
  onOpenEditCategory: (category: BudgetCategory) => void;
  onDeleteCategory: (categoryId: string) => void;
  onOpenEditItem: (item: ActiveBudgetItem) => void;
  onDeleteItem: (categoryId: string, itemId: string) => void;
}

export const BudgetTab: React.FC<BudgetTabProps> = ({
  budgetCategories,
  bankAccounts,
  recurrings,
  mockTransactions,
  getCategoryBudget,
  getCategorySpent,
  isItemActive,
  isCategoryActive,
  selectedBudgetCategoryFilter,
  onChangeCategoryFilter,
  expandedCategories,
  onToggleExpandedCategory,
  onOpenAddCategory,
  onOpenAddItem,
  onOpenEditCategory,
  onDeleteCategory,
  onOpenEditItem,
  onDeleteItem,
}) => {
  const activeFilterCategory = budgetCategories.find(c => c.id === selectedBudgetCategoryFilter);

  const isTxInCategory = (tx: MockTransaction, cat?: BudgetCategory) => {
    if (!cat) return true;
    const catNameLower = cat.name.toLowerCase();
    const txCatLower = (tx.category || '').toLowerCase();
    if (txCatLower === catNameLower) return true;
    return cat.items.some(item => {
      const itemNameLower = item.name.toLowerCase();
      return txCatLower === itemNameLower || txCatLower.includes(itemNameLower) || itemNameLower.includes(txCatLower);
    });
  };

  const isBillInCategory = (bill: RecurringBill, cat?: BudgetCategory) => {
    if (!cat) return true;
    if (bill.linkedBudgetItemId && cat.items.some(i => i.id === bill.linkedBudgetItemId)) return true;
    const catNameLower = cat.name.toLowerCase();
    const billCatLower = (bill.category || '').toLowerCase();
    return billCatLower === catNameLower;
  };

  const savingsCategories = budgetCategories.filter(cat => cat.group === 'savings');
  const savingsItems = savingsCategories.flatMap(cat =>
    cat.items.filter(item => isItemActive(item, cat)).map(item => ({
      name: item.name,
      value: getBudgetItemSpent(item, bankAccounts, recurrings) || item.budgeted || 0,
      emoji: item.emoji || '💰',
    })),
  );
  const totalSavings = savingsItems.reduce((sum, item) => sum + item.value, 0);

  const needsTotal = budgetCategories
    .filter(cat => cat.group === 'needs')
    .reduce((sum, cat) => sum + cat.items.reduce((s, i) => s + getBudgetItemSpent(i, bankAccounts, recurrings), 0), 0);

  const wantsTotal = budgetCategories
    .filter(cat => cat.group === 'wants')
    .reduce((sum, cat) => sum + cat.items.reduce((s, i) => s + getBudgetItemSpent(i, bankAccounts, recurrings), 0), 0);

  const totalBudgetLimit = budgetCategories.reduce((sum, cat) => sum + getCategoryBudget(cat), 0);
  const totalSpent = needsTotal + wantsTotal + totalSavings;
  const showWarning = totalBudgetLimit > 0 && totalSpent > totalBudgetLimit;

  const allocationData = [
    { name: 'Needs', value: needsTotal, color: FIN_CHART_PALETTE[4] },
    { name: 'Savings', value: totalSavings, color: FIN_HEX.positive },
    { name: 'Wants', value: wantsTotal, color: '#8892b0' },
  ].filter(d => d.value > 0);

  const currentMonthName = new Date().toLocaleDateString('en-GB', { month: 'short' });

  const currentYr = new Date().getFullYear();
  const currentMoIdx = new Date().getMonth();
  const allYears = Array.from(new Set([
    currentYr,
    currentYr - 1,
    ...mockTransactions.map(tx => parseInt(tx.date.split('-')[0], 10)).filter(y => !isNaN(y)),
  ])).sort((a, b) => b - a);

  const keyMetricsData = allYears.map(yr => {
    const isCurrentYear = yr === currentYr;
    const monthsElapsed = isCurrentYear ? (currentMoIdx + 1) : 12;

    const yearTxSpent = mockTransactions
      .filter(tx => tx.date.startsWith(`${yr}-`) && isTxInCategory(tx, activeFilterCategory))
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    let yearRecurringSpent = 0;
    for (let m = 1; m <= monthsElapsed; m++) {
      yearRecurringSpent += recurrings
        .filter(r => isBillInCategory(r, activeFilterCategory) && isDueThisMonth(r, m))
        .reduce((sum, r) => sum + r.amount, 0);
    }

    const totalSpentInYear = yearTxSpent + yearRecurringSpent;
    const avgMonthlySpend = monthsElapsed > 0 ? (totalSpentInYear / monthsElapsed) : 0;

    return { year: yr, spentPerYear: totalSpentInYear, avgMonthlySpend, monthsElapsed };
  });

  const targetCategoryBudget = activeFilterCategory ? getCategoryBudget(activeFilterCategory) : totalBudgetLimit;

  const multiMonthChartData: { monthLabel: string; tickLabel: string; spent: number; budget: number }[] = [];
  const startDate = new Date(currentYr, currentMoIdx, 1);
  startDate.setMonth(startDate.getMonth() - 23);
  const iterDate = new Date(startDate);
  const endDate = new Date(currentYr, currentMoIdx, 1);

  while (iterDate <= endDate) {
    const yr = iterDate.getFullYear();
    const mo = iterDate.getMonth();
    const monthPrefix = `${yr}-${String(mo + 1).padStart(2, '0')}-`;
    const monthNameShort = MONTH_NAMES[mo].slice(0, 3);
    const singleLetter = MONTH_NAMES[mo].slice(0, 1);

    const monthTxSpent = mockTransactions
      .filter(tx => tx.date.startsWith(monthPrefix) && isTxInCategory(tx, activeFilterCategory))
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const monthRecSpent = recurrings
      .filter(r => isBillInCategory(r, activeFilterCategory) && isDueThisMonth(r, mo + 1))
      .reduce((sum, r) => sum + r.amount, 0);

    const totalMonthSpent = monthTxSpent + monthRecSpent;

    multiMonthChartData.push({
      monthLabel: `${monthNameShort} ${yr}`,
      tickLabel: singleLetter,
      spent: parseFloat(totalMonthSpent.toFixed(2)),
      budget: targetCategoryBudget,
    });

    iterDate.setMonth(iterDate.getMonth() + 1);
  }

  const categoryData = budgetCategories
    .map((cat, idx) => {
      const spent = cat.items.reduce((s, i) => s + getBudgetItemSpent(i, bankAccounts, recurrings), 0);
      return { name: cat.name, value: spent, color: FIN_CHART_PALETTE[idx % FIN_CHART_PALETTE.length] };
    })
    .filter(d => d.value > 0);

  const donutData = categoryData.length > 0 ? categoryData : [{ name: 'Budget', value: 1, color: 'rgba(255,255,255,0.1)' }];

  const totalAlloc = needsTotal + wantsTotal + totalSavings;
  const needsPct = totalAlloc > 0 ? (needsTotal / totalAlloc) * 100 : 0;
  const savingsPct = totalAlloc > 0 ? (totalSavings / totalAlloc) * 100 : 0;
  const wantsPct = totalAlloc > 0 ? (wantsTotal / totalAlloc) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
        <div className="min-w-0">
          <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary shrink-0" /> Budget vs Spent Manager
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Customize your monthly budget target limits and record current spending progress</p>
        </div>
        <Button onClick={onOpenAddCategory} className="rounded-xl gap-1.5 bg-primary text-primary-foreground shrink-0 self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      </div>

      {/* Header Overview: Spent vs Total Budget gauge */}
      <div className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl shadow-sm p-6 flex flex-col md:flex-row items-center justify-around gap-6">
        <div className="text-center md:text-left space-y-1">
          <span className="text-3xl md:text-4xl font-bold font-mono text-foreground block">{formatGBP(totalSpent)}</span>
          <span className="text-xs text-muted-foreground block font-sans font-medium">spent in {currentMonthName}</span>
        </div>

        <div className="w-28 h-28 flex items-center justify-center relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={0} outerRadius={38} paddingAngle={0} dataKey="value" stroke="none">
                {donutData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(v: number) => formatGBP(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="text-center md:text-right space-y-1">
          <span className="text-3xl md:text-4xl font-bold font-mono text-foreground block">{formatGBP(totalBudgetLimit)}</span>
          <span className="text-xs text-muted-foreground block font-sans font-medium">total budget</span>
        </div>
      </div>

      {/* Money Allocation & Savings Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Savings Allocation */}
        <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h4 className="font-serif text-sm font-semibold text-foreground border-b border-border/30 pb-2 mb-4">Savings Allocation</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="overflow-hidden rounded-2xl border border-border/20 self-start">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/20 font-serif font-bold text-foreground">
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Value (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 font-mono text-[11px]">
                    {savingsItems.map((item, idx) => {
                      const pct = totalSavings > 0 ? (item.value / totalSavings) * 100 : 0;
                      return (
                        <tr key={idx} className="hover:bg-muted/10">
                          <td className="p-3 font-sans font-medium text-foreground">
                            <span className="mr-1.5">{item.emoji || '💰'}</span>
                            {item.name}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            {formatGBP(item.value)} <span className="text-[10px] text-muted-foreground">({pct.toFixed(1)}%)</span>
                          </td>
                        </tr>
                      );
                    })}
                    {savingsItems.length === 0 && (
                      <tr>
                        <td colSpan={2} className="p-3 text-center text-muted-foreground italic font-sans">No savings logged yet.</td>
                      </tr>
                    )}
                    <tr className="bg-muted/20 font-bold border-t border-border/20 text-foreground">
                      <td className="p-3 font-sans text-xs">Total</td>
                      <td className="p-3 text-right text-xs">{formatGBP(totalSavings)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col items-center justify-center space-y-4">
                {totalSavings > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie
                          data={savingsItems.map((item, idx) => ({ name: item.name, value: item.value, color: FIN_CHART_PALETTE[idx % FIN_CHART_PALETTE.length] }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={0}
                          outerRadius={55}
                          paddingAngle={0}
                          dataKey="value"
                          stroke="none"
                        >
                          {savingsItems.map((item, idx) => (
                            <Cell key={`cell-savings-${idx}`} fill={FIN_CHART_PALETTE[idx % FIN_CHART_PALETTE.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(v: number) => formatGBP(v)} />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[9px] text-muted-foreground font-mono">
                      {savingsItems.map((item, idx) => {
                        const pct = totalSavings > 0 ? (item.value / totalSavings) * 100 : 0;
                        const color = FIN_CHART_PALETTE[idx % FIN_CHART_PALETTE.length];
                        return (
                          <div key={idx} className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                            <span>{item.name}: {pct.toFixed(0)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground italic text-center py-6">No savings to plot.</div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Right Column: Money Allocation Summary & Pie Chart */}
        <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h4 className="font-serif text-sm font-semibold text-foreground border-b border-border/30 pb-2 mb-4">Money Allocation</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="overflow-hidden rounded-2xl border border-border/20 self-start">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/20 font-serif font-bold text-foreground">
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Value (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 font-mono text-[11px]">
                    <tr className="hover:bg-muted/10">
                      <td className="p-3 font-sans font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#4f8fdb] shrink-0" /> Needs
                        </div>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {formatGBP(needsTotal)} <span className="text-[10px] text-muted-foreground">({needsPct.toFixed(1)}%)</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-muted/10">
                      <td className="p-3 font-sans font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-fin-positive shrink-0" /> Savings
                        </div>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {formatGBP(totalSavings)} <span className="text-[10px] text-muted-foreground">({savingsPct.toFixed(1)}%)</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-muted/10">
                      <td className="p-3 font-sans font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#8892b0] shrink-0" /> Wants
                        </div>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {formatGBP(wantsTotal)} <span className="text-[10px] text-muted-foreground">({wantsPct.toFixed(1)}%)</span>
                      </td>
                    </tr>
                    <tr className="bg-muted/20 font-bold border-t border-border/20 text-foreground">
                      <td className="p-3 font-sans text-xs">Total</td>
                      <td className="p-3 text-right text-xs">{formatGBP(needsTotal + wantsTotal + totalSavings)}</td>
                    </tr>
                    <tr className="font-bold border-t border-border/20">
                      <td className="p-3 font-sans text-xs text-foreground">Spend Status</td>
                      <td className="p-3 text-right text-xs">
                        {showWarning ? (
                          <span className="inline-flex items-center text-fin-negative gap-1 font-sans" title="Spent exceeds budget limit!">⚠️ Over Limit</span>
                        ) : (
                          <span className="inline-flex items-center text-fin-positive gap-1 font-sans">✓ Within Budget</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col items-center justify-center space-y-4">
                {needsTotal + wantsTotal + totalSavings > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie data={allocationData} cx="50%" cy="50%" innerRadius={0} outerRadius={55} paddingAngle={0} dataKey="value" stroke="none">
                          {allocationData.map((entry, index) => (
                            <Cell key={`cell-allocation-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(v: number) => formatGBP(v)} />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="flex flex-wrap justify-center gap-3 text-[10px] text-muted-foreground font-mono">
                      {allocationData.map((entry, index) => {
                        const percent = (entry.value / (needsTotal + wantsTotal + totalSavings)) * 100;
                        return (
                          <div key={index} className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span>{entry.name}: {percent.toFixed(0)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground italic text-center py-6">No data to plot.</div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Category Pill Filters Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => onChangeCategoryFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all flex items-center gap-1.5 border',
            selectedBudgetCategoryFilter === 'all'
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-card/40 hover:bg-card/70 text-muted-foreground border-border/40',
          )}
        >
          <span>All Regular Categories</span>
          <span className="text-[10px] opacity-80 bg-background/20 px-1.5 py-0.5 rounded-full font-mono">
            {budgetCategories.filter(isCategoryActive).length}
          </span>
        </button>
        {budgetCategories.filter(isCategoryActive).map((cat, idx) => {
          const isSelected = selectedBudgetCategoryFilter === cat.id;
          const catColor = FIN_CHART_PALETTE[idx % FIN_CHART_PALETTE.length];
          return (
            <button
              key={cat.id}
              onClick={() => onChangeCategoryFilter(isSelected ? 'all' : cat.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all flex items-center gap-1.5 border',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm font-semibold'
                  : 'bg-card/40 hover:bg-card/70 text-muted-foreground border-border/40',
              )}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
              <span>{cat.emoji ? `${cat.emoji} ${cat.name}` : cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Key Metrics & Historical Monthly Trend */}
      <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl shadow-sm p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-border/10 pb-6">
          <div className="flex-1 space-y-3 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="font-serif text-sm font-semibold text-foreground flex items-center gap-2">
                {activeFilterCategory ? (
                  <span>{activeFilterCategory.emoji || '📂'} {activeFilterCategory.name} Historical Trend</span>
                ) : (
                  <span>All Regular Categories Trend</span>
                )}
              </h4>
              <span className="text-xs font-mono font-medium text-muted-foreground">
                Target: <strong className="text-foreground">{formatGBP(targetCategoryBudget)}</strong>/mo
              </span>
            </div>

            <div className="h-28 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={multiMonthChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="tickLabel"
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 9, fill: 'currentColor', className: 'text-muted-foreground font-mono' }}
                  />
                  <YAxis hide />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover/90 backdrop-blur-md border border-border/50 text-popover-foreground text-xs p-2.5 rounded-xl shadow-lg font-mono">
                            <p className="font-sans font-semibold border-b border-border/30 pb-1 mb-1">{data.monthLabel}</p>
                            <p>Spent: <span className="font-bold text-primary">{formatGBP(data.spent)}</span></p>
                            <p className="text-[10px] text-muted-foreground">Budget Limit: {formatGBP(data.budget)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={targetCategoryBudget} stroke="rgba(255, 255, 255, 0.3)" strokeDasharray="3 3" />
                  <Bar dataKey="spent" radius={[3, 3, 0, 0]}>
                    {multiMonthChartData.map((entry, index) => (
                      <Cell key={`cell-hist-${index}`} fill={entry.spent > entry.budget ? FIN_HEX.negative : FIN_HEX.positive} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:w-80 shrink-0 bg-muted/20 border border-border/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-serif font-semibold text-foreground border-b border-border/20 pb-2">
              <span className="flex items-center gap-1.5">
                Key metrics
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      <p>Historical total spent per year & average monthly spend.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
              {activeFilterCategory && (
                <span className="text-[10px] font-sans text-primary underline cursor-pointer" onClick={() => onChangeCategoryFilter('all')}>
                  Reset filter
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/10 pb-1">
              <span>Year</span>
              <span className="text-right">Spent / yr</span>
              <span className="text-right">Avg / mo</span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              {keyMetricsData.map(m => (
                <div key={m.year} className="grid grid-cols-3 items-center hover:bg-muted/10 p-1 rounded-lg transition-colors">
                  <span className="font-sans font-bold text-foreground">{m.year}</span>
                  <span className="text-right font-medium text-foreground">{formatGBP(m.spentPerYear)}</span>
                  <span className="text-right font-bold text-fin-positive">{formatGBP(m.avgMonthlySpend)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Budget list */}
      <Card className="bg-card/40 backdrop-blur-md border border-border/50 rounded-3xl shadow-sm p-6">
        <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-sans border-b border-border/20 pb-2 px-2">
          <span className="flex-1">Regular Categories</span>
          <div className="flex items-center gap-3 text-right">
            <span className="w-20 text-right">Spent</span>
            <span className="w-20 text-right">Budget</span>
            <span className="w-20 text-right">Left</span>
            <span className="w-32 md:w-48 hidden md:inline-block text-center">Progress</span>
          </div>
        </div>

        <div className="divide-y divide-border/10">
          {budgetCategories
            .filter(isCategoryActive)
            .filter(cat => selectedBudgetCategoryFilter === 'all' || cat.id === selectedBudgetCategoryFilter)
            .map((category, idx) => {
              const catBudget = getCategoryBudget(category);
              const catSpent = getCategorySpent(category);
              const catLeft = catBudget - catSpent;
              const isOver = catSpent > catBudget;
              const isExpanded = expandedCategories[category.id] !== false;
              const catColor = FIN_CHART_PALETTE[idx % FIN_CHART_PALETTE.length];

              return (
                <div key={category.id} className="py-2.5">
                  <div className="group flex items-center justify-between py-1.5 hover:bg-muted/5 rounded-xl px-2 transition-colors">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button
                        onClick={() => onToggleExpandedCategory(category.id, !isExpanded)}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 animate-in fade-in zoom-in duration-200" style={{ color: catColor }} />
                        ) : (
                          <ChevronRight className="h-4 w-4 animate-in fade-in zoom-in duration-200" style={{ color: catColor }} />
                        )}
                      </button>

                      <div
                        className="h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm"
                        style={{ backgroundColor: catColor }}
                      >
                        {category.items.filter(item => isItemActive(item, category)).length}
                      </div>

                      <span className="font-bold text-sm text-foreground truncate">{category.name}</span>

                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1.5">
                        <button onClick={() => onOpenAddItem(category.id)} className="text-muted-foreground hover:text-foreground p-0.5" title="Add item">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => onOpenEditCategory(category)} className="text-muted-foreground hover:text-foreground p-0.5" title="Edit Category">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => onDeleteCategory(category.id)} className="text-fin-negative hover:text-fin-negative p-0.5" title="Delete Category">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
                      <span className="font-bold text-foreground w-20 text-right">{formatGBP(catSpent)}</span>
                      <span className="font-medium text-muted-foreground/80 w-20 text-right">{formatGBP(catBudget)}</span>
                      <span className={cn('font-bold w-20 text-right', catLeft >= 0 ? 'text-fin-positive' : 'text-fin-negative')}>
                        {catLeft >= 0 ? formatGBP(catLeft) : `-${formatGBP(Math.abs(catLeft))}`}
                      </span>

                      <div className="w-32 md:w-48 h-1.5 bg-muted rounded-full overflow-hidden hidden md:inline-block">
                        <div
                          className={cn('h-full rounded-full transition-all duration-300', isOver ? 'bg-fin-negative' : 'bg-fin-positive')}
                          style={{ width: `${Math.min(100, catBudget > 0 ? (catSpent / catBudget) * 100 : 0)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-1.5 pl-7 mt-1.5 border-l-2 border-border/10 ml-4">
                      {category.items.filter(item => isItemActive(item, category)).map(item => {
                        const spentVal = getBudgetItemSpent(item, bankAccounts, recurrings);
                        const itemLeft = item.budgeted - spentVal;
                        const isItemOver = spentVal > item.budgeted;
                        return (
                          <div key={item.id} className="group flex items-center justify-between text-xs py-1 hover:bg-muted/5 rounded-lg px-2 transition-colors">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {item.emoji ? (
                                <span className="text-sm shrink-0">{item.emoji}</span>
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                              )}
                              <span className="font-medium text-foreground/90 truncate">{item.name}</span>

                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1.5">
                                <button
                                  onClick={() => onOpenEditItem({ ...item, categoryId: category.id })}
                                  className="text-muted-foreground hover:text-foreground p-0.5"
                                  title="Edit item"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                <button onClick={() => onDeleteItem(category.id, item.id)} className="text-fin-negative hover:text-fin-negative p-0.5" title="Delete item">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
                              <span className="font-semibold text-foreground/80 w-20 text-right">{formatGBP(spentVal)}</span>
                              <span className="text-muted-foreground/60 w-20 text-right">{formatGBP(item.budgeted)}</span>
                              <span className={cn('w-20 text-right font-medium', itemLeft >= 0 ? 'text-fin-positive/90' : 'text-fin-negative/90')}>
                                {itemLeft >= 0 ? formatGBP(itemLeft) : `-${formatGBP(Math.abs(itemLeft))}`}
                              </span>

                              <div className="w-32 md:w-48 h-1 bg-muted rounded-full overflow-hidden hidden md:inline-block">
                                <div
                                  className={cn('h-full rounded-full transition-all duration-300', isItemOver ? 'bg-fin-negative' : 'bg-fin-positive')}
                                  style={{ width: `${Math.min(100, item.budgeted > 0 ? (spentVal / item.budgeted) * 100 : 0)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {category.items.filter(item => isItemActive(item, category)).length === 0 && (
                        <p className="text-[10px] text-muted-foreground italic pl-2.5 py-1">No items under this category. Click '+' to add.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </Card>
    </div>
  );
};

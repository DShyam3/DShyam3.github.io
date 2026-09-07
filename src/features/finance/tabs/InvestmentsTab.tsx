import React, { useState, useMemo } from 'react';
import { InvestmentHolding, BankAccount } from '@/features/finance/finance-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Edit2,
  Trash2,
  PieChart as PieIcon,
  LineChart as LineIcon,
  Coins,
  DollarSign,
  ArrowUpRight,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from 'recharts';
import { cn } from '@/lib/utils';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';

interface InvestmentsTabProps {
  holdings: InvestmentHolding[];
  onAddHolding: (holding: Omit<InvestmentHolding, 'id'>) => void;
  onEditHolding: (holding: InvestmentHolding) => void;
  onDeleteHolding: (id: string) => void;
  formatGBP: (num: number) => string;
  bankAccounts: BankAccount[];
}

const HOLDING_CATEGORIES = [
  'Stock',
  'ETF',
  'Crypto',
  'Mutual Fund',
  'Real Estate',
  'Cash',
  'Other'
] as const;

type HoldingCategory = typeof HOLDING_CATEGORIES[number];

const CATEGORY_COLORS: Record<HoldingCategory, string> = {
  Stock: 'hsl(var(--chart-3))',       // Blue
  ETF: 'hsl(var(--positive))',         // Emerald
  Crypto: 'hsl(var(--chart-5))',      // Purple
  'Mutual Fund': 'hsl(var(--chart-2))', // Cyan
  'Real Estate': 'hsl(var(--chart-4))', // Amber
  Cash: 'hsl(var(--chart-5))',        // Pink
  Other: 'hsl(var(--muted-foreground))'        // Gray
};

export const InvestmentsTab: React.FC<InvestmentsTabProps> = ({
  holdings,
  onAddHolding,
  onEditHolding,
  onDeleteHolding,
  formatGBP,
  bankAccounts
}) => {
  // State for Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<InvestmentHolding | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formTicker, setFormTicker] = useState('');
  const [formCategory, setFormCategory] = useState<HoldingCategory>('Stock');
  const [formShares, setFormShares] = useState(0);
  const [formAvgPrice, setFormAvgPrice] = useState(0);
  const [formCurrentPrice, setFormCurrentPrice] = useState(0);

  // Future Value Projection Slider States
  const [calcInitial, setCalcInitial] = useState(10000);
  const [calcMonthly, setCalcMonthly] = useState(500);
  const [calcRate, setCalcRate] = useState(7);
  const [calcYears, setCalcYears] = useState(15);

  // 1. Calculate values
  const portfolioStats = useMemo(() => {
    let totalValue = 0;
    let totalCost = 0;

    holdings.forEach(h => {
      totalValue += h.shares * h.currentPrice;
      totalCost += h.shares * h.avgPrice;
    });

    // Also include cash balance from 'investment' accounts in bankAccounts
    const investmentAccountsCash = bankAccounts
      .filter(acc => acc.type === 'investment')
      .reduce((sum, acc) => sum + acc.balance, 0);

    const totalPortfolioValue = totalValue + investmentAccountsCash;
    const profitLoss = totalValue - totalCost;
    const totalReturnPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

    return {
      totalHoldingsValue: totalValue,
      investmentAccountsCash,
      totalPortfolioValue,
      totalCost,
      profitLoss,
      totalReturnPercent
    };
  }, [holdings, bankAccounts]);

  // 2. Category allocation data for chart
  const allocationData = useMemo(() => {
    const categoriesMap: Record<string, number> = {};

    holdings.forEach(h => {
      const val = h.shares * h.currentPrice;
      categoriesMap[h.category] = (categoriesMap[h.category] || 0) + val;
    });

    if (portfolioStats.investmentAccountsCash > 0) {
      categoriesMap['Cash'] = (categoriesMap['Cash'] || 0) + portfolioStats.investmentAccountsCash;
    }

    return Object.entries(categoriesMap)
      .map(([name, value]) => ({
        name,
        value,
        color: CATEGORY_COLORS[name as HoldingCategory] || 'hsl(var(--muted-foreground))'
      }))
      .filter(item => item.value > 0);
  }, [holdings, portfolioStats.investmentAccountsCash]);

  const totalAllocated = useMemo(() => {
    return allocationData.reduce((sum, item) => sum + item.value, 0);
  }, [allocationData]);

  const sortedAllocationData = useMemo(() => {
    return [...allocationData].sort((a, b) => b.value - a.value);
  }, [allocationData]);

  // 3. Compound Interest projection calculation
  const projectionData = useMemo(() => {
    const data = [];
    let balance = calcInitial;
    let totalContributions = calcInitial;
    const monthlyRate = calcRate / 100 / 12;

    data.push({
      year: 'Start',
      'Total Contributions': Math.round(totalContributions),
      'Future Value': Math.round(balance),
      'Interest Earned': 0
    });

    for (let year = 1; year <= calcYears; year++) {
      for (let month = 1; month <= 12; month++) {
        balance = balance * (1 + monthlyRate) + calcMonthly;
        totalContributions += calcMonthly;
      }
      data.push({
        year: `Yr ${year}`,
        'Total Contributions': Math.round(totalContributions),
        'Future Value': Math.round(balance),
        'Interest Earned': Math.max(0, Math.round(balance - totalContributions))
      });
    }

    return data;
  }, [calcInitial, calcMonthly, calcRate, calcYears]);

  // Modal Open Handlers
  const handleOpenAdd = () => {
    setEditingHolding(null);
    setFormName('');
    setFormTicker('');
    setFormCategory('Stock');
    setFormShares(0);
    setFormAvgPrice(0);
    setFormCurrentPrice(0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (holding: InvestmentHolding) => {
    setEditingHolding(holding);
    setFormName(holding.name);
    setFormTicker(holding.ticker || '');
    setFormCategory(holding.category);
    setFormShares(holding.shares);
    setFormAvgPrice(holding.avgPrice);
    setFormCurrentPrice(holding.currentPrice);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || formShares <= 0 || formAvgPrice <= 0 || formCurrentPrice <= 0) return;

    const data = {
      name: formName,
      ticker: formTicker.toUpperCase() || undefined,
      category: formCategory,
      shares: Number(formShares),
      avgPrice: Number(formAvgPrice),
      currentPrice: Number(formCurrentPrice)
    };

    if (editingHolding) {
      onEditHolding({ ...data, id: editingHolding.id });
    } else {
      onAddHolding(data);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. KEY PERFORMANCE METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors">
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
              Total Portfolio
            </span>
            <div className="text-2xl sm:text-3xl font-mono font-bold tabular-nums text-foreground tracking-tight">
              {formatGBP(portfolioStats.totalPortfolioValue)}
            </div>
            {portfolioStats.investmentAccountsCash > 0 ? (
              <span className="text-xs text-muted-foreground/80 block font-mono">
                Incl. {formatGBP(portfolioStats.investmentAccountsCash)} cash
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/80 block font-mono">
                Across {holdings.length} holdings
              </span>
            )}
          </div>
        </Card>

        <Card className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors">
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
              Net Invested
            </span>
            <div className="text-2xl sm:text-3xl font-mono font-bold tabular-nums text-foreground tracking-tight">
              {formatGBP(portfolioStats.totalCost)}
            </div>
            <span className="text-xs text-muted-foreground/80 block font-mono">
              Total principal cost basis
            </span>
          </div>
        </Card>

        <Card className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors">
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
              Total Gain / Loss
            </span>
            <div className={cn(
              "text-2xl sm:text-3xl font-mono font-bold tabular-nums tracking-tight",
              portfolioStats.profitLoss >= 0 ? "text-positive" : "text-destructive"
            )}>
              {portfolioStats.profitLoss >= 0 ? '+' : ''}{formatGBP(portfolioStats.profitLoss)}
            </div>
            <span className="text-xs text-muted-foreground/80 block font-mono">
              All-time unrealised return
            </span>
          </div>
        </Card>

        <Card className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors">
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
              Rate of Return
            </span>
            <div className={cn(
              "text-2xl sm:text-3xl font-mono font-bold tabular-nums tracking-tight",
              portfolioStats.totalReturnPercent >= 0 ? "text-positive" : "text-destructive"
            )}>
              {portfolioStats.totalReturnPercent >= 0 ? '+' : ''}{portfolioStats.totalReturnPercent.toFixed(2)}%
            </div>
            <span className="text-xs text-muted-foreground/80 block font-mono">
              ROI on active holdings
            </span>
          </div>
        </Card>
      </div>

      {/* 2. HOLDINGS LIST & PORTFOLIO ALLOCATION PIE CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Holdings table */}
        <Card className="rounded-xl border border-border/40 bg-card/50 p-5 lg:col-span-2 flex flex-col justify-between hover:border-border/80 transition-colors">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground">
                  Portfolio Holdings
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-mono">
                  {holdings.length} investment assets and return statistics
                </CardDescription>
              </div>
              <Button
                onClick={handleOpenAdd}
                size="sm"
                className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8 px-3.5 flex items-center gap-1.5 self-start sm:self-center font-mono"
              >
                <Plus className="h-3.5 w-3.5" /> Add Asset
              </Button>
            </div>

            {holdings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                <div className="bg-muted/20 p-4 rounded-xl border border-border/40">
                  <Coins className="h-8 w-8 text-muted-foreground/40 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-mono font-semibold text-foreground">No holdings added yet</p>
                  <p className="text-xs text-muted-foreground font-mono max-w-xs">
                    Start tracking your investment assets by clicking the Add Asset button above.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground uppercase font-mono tracking-wider">
                      <th className="pb-3 pt-1 font-semibold">Asset</th>
                      <th className="pb-3 pt-1 font-semibold">Category</th>
                      <th className="pb-3 pt-1 font-semibold text-right">Shares</th>
                      <th className="pb-3 pt-1 font-semibold text-right">Avg / Current</th>
                      <th className="pb-3 pt-1 font-semibold text-right">Value</th>
                      <th className="pb-3 pt-1 font-semibold text-right">Return</th>
                      <th className="pb-3 pt-1 text-center w-16">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {holdings.map(h => {
                      const value = h.shares * h.currentPrice;
                      const cost = h.shares * h.avgPrice;
                      const gainLoss = value - cost;
                      const returnPct = cost > 0 ? (gainLoss / cost) * 100 : 0;
                      return (
                        <tr key={h.id} className="group hover:bg-muted/10 transition-colors">
                          <td className="py-3 font-sans font-medium text-foreground">
                            <span className="block font-semibold">{h.name}</span>
                            {h.ticker && (
                              <span className="text-xs text-muted-foreground uppercase font-mono tracking-wider font-normal">
                                {h.ticker}
                              </span>
                            )}
                          </td>
                          <td className="py-3">
                            <span
                              className="px-2 py-0.5 rounded-md text-xs font-mono font-medium border"
                              style={{
                                color: CATEGORY_COLORS[h.category],
                                borderColor: `${CATEGORY_COLORS[h.category]}33`,
                                backgroundColor: `${CATEGORY_COLORS[h.category]}10`
                              }}
                            >
                              {h.category}
                            </span>
                          </td>
                          <td className="py-3 text-right font-mono tabular-nums text-foreground/90">
                            {h.shares}
                          </td>
                          <td className="py-3 text-right font-mono tabular-nums">
                            <span className="block text-muted-foreground">{formatGBP(h.avgPrice)}</span>
                            <span className="block font-semibold text-foreground">{formatGBP(h.currentPrice)}</span>
                          </td>
                          <td className="py-3 text-right font-mono tabular-nums font-semibold text-foreground">
                            {formatGBP(value)}
                          </td>
                          <td className={cn(
                            "py-3 text-right font-mono tabular-nums",
                            gainLoss >= 0 ? "text-positive font-semibold" : "text-destructive"
                          )}>
                            <span className="block">{gainLoss >= 0 ? '+' : ''}{formatGBP(gainLoss)}</span>
                            <span className="text-xs block">
                              {gainLoss >= 0 ? '+' : ''}{returnPct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                              <Button
                                onClick={() => handleOpenEdit(h)}
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                onClick={() => onDeleteHolding(h.id)}
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-lg"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        {/* Right Column: Asset Allocation (Option B: Treasury Donut) */}
        <Card className="rounded-xl border border-border/40 bg-card/50 p-5 flex flex-col justify-between hover:border-border/80 transition-colors">
          <div className="space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground">
                Asset Allocation
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground font-mono">
                {formatGBP(totalAllocated)} across {sortedAllocationData.length} classes
              </CardDescription>
            </div>

            {sortedAllocationData.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <PieIcon className="h-8 w-8 text-muted-foreground/30 mb-2 animate-pulse" />
                <span className="text-xs font-mono">Add holding assets or cash to view allocation</span>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center gap-4 py-2">
                <div className="h-[180px] w-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sortedAllocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={54}
                        outerRadius={74}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      >
                        {sortedAllocationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: number) => [formatGBP(val), 'Value']}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          borderColor: 'hsl(var(--border))',
                          color: 'hsl(var(--foreground))',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontFamily: 'monospace'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Clean total indicator inside donut with ZERO overflow */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
                      Total
                    </span>
                    <span className="text-xs font-mono font-bold tabular-nums text-foreground mt-0.5">
                      {formatGBP(totalAllocated)}
                    </span>
                  </div>
                </div>

                {/* Legend list: clean, vertical monospace rows */}
                <div className="w-full space-y-2 pt-1">
                  {sortedAllocationData.map((item, idx) => {
                    const pct = totalAllocated > 0 ? (item.value / totalAllocated) * 100 : 0;
                    return (
                      <div key={idx} className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-foreground truncate">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-muted-foreground tabular-nums">{formatGBP(item.value)}</span>
                          <span className="font-semibold text-foreground tabular-nums w-12 text-right">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 3. FUTURE VALUE PROJECTION CALCULATOR */}
      <Card className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors">
        <div className="space-y-6">
          <div className="space-y-1">
            <CardTitle className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground">
              Compound Wealth Projection
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-mono">
              Simulate investment growth trajectory based on compound interest
            </CardDescription>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sliders column */}
            <div className="space-y-5 lg:col-span-1 py-1">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground flex items-center gap-1">
                    Initial Investment
                  </span>
                  <span className="text-foreground font-semibold">{formatGBP(calcInitial)}</span>
                </div>
                <Slider
                  min={0}
                  max={250000}
                  step={1000}
                  value={[calcInitial]}
                  onValueChange={(val) => setCalcInitial(val[0])}
                  className="py-1 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Monthly Contribution</span>
                  <span className="text-foreground font-semibold">{formatGBP(calcMonthly)} /mo</span>
                </div>
                <Slider
                  min={0}
                  max={10000}
                  step={50}
                  value={[calcMonthly]}
                  onValueChange={(val) => setCalcMonthly(val[0])}
                  className="py-1 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Annual Return Rate</span>
                  <span className="text-foreground font-semibold text-positive font-bold">
                    {calcRate}%
                  </span>
                </div>
                <Slider
                  min={1}
                  max={20}
                  step={0.5}
                  value={[calcRate]}
                  onValueChange={(val) => setCalcRate(val[0])}
                  className="py-1 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Time Horizon</span>
                  <span className="text-foreground font-semibold">{calcYears} Years</span>
                </div>
                <Slider
                  min={1}
                  max={50}
                  step={1}
                  value={[calcYears]}
                  onValueChange={(val) => setCalcYears(val[0])}
                  className="py-1 cursor-pointer"
                />
              </div>

              {/* Calculator Summary Callout */}
              <div className="bg-muted/20 rounded-xl p-4 border border-border/30 mt-4 space-y-2.5 text-xs font-mono">
                <div className="flex items-center gap-1.5 uppercase font-semibold text-foreground text-xs tracking-wider">
                  <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                  Projection Summary
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  In <span className="font-semibold text-foreground">{calcYears} years</span>, your total contributions will equal{' '}
                  <span className="font-semibold text-foreground">
                    {formatGBP(projectionData[projectionData.length - 1]['Total Contributions'])}
                  </span>
                  .
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  With a compound return of <span className="font-semibold text-foreground">{calcRate}%</span>, your portfolio value is projected to reach{' '}
                  <span className="font-semibold text-positive font-bold">
                    {formatGBP(projectionData[projectionData.length - 1]['Future Value'])}
                  </span>
                  . That corresponds to{' '}
                  <span className="font-semibold text-foreground">
                    {formatGBP(projectionData[projectionData.length - 1]['Interest Earned'])}
                  </span>{' '}
                  in interest earned.
                </p>
              </div>
            </div>

            {/* Projection Chart column */}
            <div className="lg:col-span-2 h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={projectionData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorFV" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--positive))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--positive))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorTC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="year"
                    stroke="rgba(255,255,255,0.4)"
                    fontSize={10}
                    fontFamily="monospace"
                    dy={10}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.4)"
                    fontSize={9}
                    fontFamily="monospace"
                    tickFormatter={(val) => `£${(val / 1000).toFixed(0)}k`}
                    dx={-5}
                  />
                  <RechartsTooltip
                    formatter={(val: number) => [formatGBP(val)]}
                    contentStyle={{
                      backgroundColor: 'rgba(30, 41, 59, 0.95)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      borderRadius: '16px',
                      fontSize: '11px',
                      fontFamily: 'monospace'
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    iconSize={8}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }}
                  />
                  <Area
                    type="monotone"
                    name="Future Value"
                    dataKey="Future Value"
                    stroke="hsl(var(--positive))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorFV)"
                  />
                  <Area
                    type="monotone"
                    name="Total Contributions"
                    dataKey="Total Contributions"
                    stroke="hsl(var(--chart-3))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTC)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Card>

      {/* 4. ADD & EDIT HOLDING MODAL DIALOG */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:rounded-xl border border-border/40 bg-card p-6 max-w-md w-full">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">
                {editingHolding ? 'Edit Holding Asset' : 'Add Holding Asset'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-mono">
                Enter details for your investment asset to track it in your portfolio
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="holding-name" className="text-foreground">Asset Name</Label>
                <Input
                  id="holding-name"
                  placeholder="e.g. S&P 500 ETF, Apple Inc., Bitcoin"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="rounded-xl border-border/50 bg-background/50 text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="holding-ticker" className="text-foreground">Ticker Symbol (Optional)</Label>
                  <Input
                    id="holding-ticker"
                    placeholder="e.g. VOO, AAPL, BTC"
                    value={formTicker}
                    onChange={(e) => setFormTicker(e.target.value)}
                    className="rounded-xl border-border/50 bg-background/50 text-foreground uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="holding-category" className="text-foreground">Asset Class / Category</Label>
                  <Select
                    value={formCategory}
                    onValueChange={(val) => setFormCategory(val as HoldingCategory)}
                  >
                    <SelectTrigger className="rounded-xl border-border/50 bg-background/50 text-foreground">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl bg-card border border-border/60">
                      {HOLDING_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-xs focus:bg-muted">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="holding-shares" className="text-foreground">Shares / Quantity Owned</Label>
                <Input
                  id="holding-shares"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={formShares === 0 ? '' : formShares}
                  onChange={(e) => setFormShares(Number(e.target.value))}
                  required
                  className="rounded-xl border-border/50 bg-background/50 text-foreground font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="holding-avg-price" className="text-foreground">Average Buy Price per Share (£)</Label>
                  <Input
                    id="holding-avg-price"
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={formAvgPrice === 0 ? '' : formAvgPrice}
                    onChange={(e) => setFormAvgPrice(Number(e.target.value))}
                    required
                    className="rounded-xl border-border/50 bg-background/50 text-foreground font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="holding-curr-price" className="text-foreground">Current Price per Share (£)</Label>
                  <Input
                    id="holding-curr-price"
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={formCurrentPrice === 0 ? '' : formCurrentPrice}
                    onChange={(e) => setFormCurrentPrice(Number(e.target.value))}
                    required
                    className="rounded-xl border-border/50 bg-background/50 text-foreground font-mono"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl text-xs hover:bg-muted font-sans"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-sans"
              >
                {editingHolding ? 'Save Changes' : 'Add Asset'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

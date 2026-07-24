import React, { useState, useMemo } from 'react';
import { InvestmentHolding, BankAccount } from '@/types/finance';
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
  Stock: '#3b82f6',       // Blue
  ETF: '#10b981',         // Emerald
  Crypto: '#8b5cf6',      // Purple
  'Mutual Fund': '#06b6d4', // Cyan
  'Real Estate': '#f59e0b', // Amber
  Cash: '#ec4899',        // Pink
  Other: '#6b7280'        // Gray
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
        color: CATEGORY_COLORS[name as HoldingCategory] || '#6b7280'
      }))
      .filter(item => item.value > 0);
  }, [holdings, portfolioStats.investmentAccountsCash]);

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-24 w-24 bg-primary/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="space-y-1.5 relative z-10">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono flex items-center gap-1">
              <Coins className="h-3 w-3 text-primary" /> Total Portfolio
            </span>
            <div className="text-2xl sm:text-3xl font-serif font-semibold text-foreground tracking-tight">
              {formatGBP(portfolioStats.totalPortfolioValue)}
            </div>
            {portfolioStats.investmentAccountsCash > 0 && (
              <span className="text-[10px] text-muted-foreground/85 block font-sans">
                Includes {formatGBP(portfolioStats.investmentAccountsCash)} cash balance
              </span>
            )}
          </div>
        </Card>

        <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-24 w-24 bg-primary/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="space-y-1.5 relative z-10">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-cyan-500" /> Net Invested
            </span>
            <div className="text-2xl sm:text-3xl font-serif font-semibold text-foreground tracking-tight">
              {formatGBP(portfolioStats.totalCost)}
            </div>
            <span className="text-[10px] text-muted-foreground/85 block font-sans">
              Total principal holdings cost
            </span>
          </div>
        </Card>

        <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-24 w-24 bg-primary/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="space-y-1.5 relative z-10">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono flex items-center gap-1">
              {portfolioStats.profitLoss >= 0 ? (
                <TrendingUp className="h-3 w-3 text-emerald-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-rose-500" />
              )}
              Total Gain / Loss
            </span>
            <div className={cn(
              "text-2xl sm:text-3xl font-serif font-semibold tracking-tight",
              portfolioStats.profitLoss >= 0 ? "text-emerald-500" : "text-rose-500"
            )}>
              {portfolioStats.profitLoss >= 0 ? '+' : ''}{formatGBP(portfolioStats.profitLoss)}
            </div>
            <span className="text-[10px] text-muted-foreground/85 block font-sans">
              Total return on holdings
            </span>
          </div>
        </Card>

        <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-24 w-24 bg-primary/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="space-y-1.5 relative z-10">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3 text-amber-500" /> Rate of Return
            </span>
            <div className={cn(
              "text-2xl sm:text-3xl font-serif font-semibold tracking-tight",
              portfolioStats.totalReturnPercent >= 0 ? "text-emerald-500" : "text-rose-500"
            )}>
              {portfolioStats.totalReturnPercent >= 0 ? '+' : ''}{portfolioStats.totalReturnPercent.toFixed(2)}%
            </div>
            <span className="text-[10px] text-muted-foreground/85 block font-sans">
              ROI on active holdings
            </span>
          </div>
        </Card>
      </div>

      {/* 2. HOLDINGS LIST & PORTFOLIO ALLOCATION PIE CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Holdings table */}
        <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl lg:col-span-2 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-serif font-semibold text-foreground flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-primary" /> Portfolio Holdings
                </CardTitle>
                <CardDescription className="text-[10px] text-muted-foreground">
                  Individual investment assets and return statistics
                </CardDescription>
              </div>
              <Button
                onClick={handleOpenAdd}
                size="sm"
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/95 text-xs h-8 px-4 flex items-center gap-1.5 self-start sm:self-center font-sans"
              >
                <Plus className="h-3 w-3" /> Add Asset
              </Button>
            </div>

            {holdings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                <div className="bg-primary/5 p-4 rounded-full border border-primary/10">
                  <Coins className="h-8 w-8 text-muted-foreground/50 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">No holdings added yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
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
                          <td className="py-3.5 font-serif font-medium text-foreground">
                            <span className="block font-semibold">{h.name}</span>
                            {h.ticker && (
                              <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider font-normal">
                                {h.ticker}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5">
                            <span
                              className="px-2 py-0.5 rounded-full text-[9px] font-semibold border"
                              style={{
                                color: CATEGORY_COLORS[h.category],
                                borderColor: `${CATEGORY_COLORS[h.category]}33`,
                                backgroundColor: `${CATEGORY_COLORS[h.category]}10`
                              }}
                            >
                              {h.category}
                            </span>
                          </td>
                          <td className="py-3.5 text-right font-mono font-medium text-foreground/90">
                            {h.shares}
                          </td>
                          <td className="py-3.5 text-right font-mono">
                            <span className="block text-muted-foreground">{formatGBP(h.avgPrice)}</span>
                            <span className="block font-semibold text-foreground">{formatGBP(h.currentPrice)}</span>
                          </td>
                          <td className="py-3.5 text-right font-mono font-semibold text-foreground">
                            {formatGBP(value)}
                          </td>
                          <td className={cn(
                            "py-3.5 text-right font-mono",
                            gainLoss >= 0 ? "text-emerald-500 font-semibold" : "text-rose-500"
                          )}>
                            <span className="block">{gainLoss >= 0 ? '+' : ''}{formatGBP(gainLoss)}</span>
                            <span className="text-[10px] block">
                              {gainLoss >= 0 ? '+' : ''}{returnPct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                onClick={() => handleOpenEdit(h)}
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                onClick={() => onDeleteHolding(h.id)}
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-rose-500 rounded-full"
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

        {/* Right Column: Asset Allocation Pie */}
        <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div className="space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-serif font-semibold text-foreground flex items-center gap-1.5">
                <PieIcon className="h-4 w-4 text-primary" /> Asset Allocation
              </CardTitle>
              <CardDescription className="text-[10px] text-muted-foreground">
                Portfolio balance breakdown by asset class
              </CardDescription>
            </div>

            {allocationData.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <PieIcon className="h-8 w-8 text-muted-foreground/30 mb-2 animate-pulse" />
                <span className="text-xs">Add holding assets or cash to view allocation</span>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center gap-4 py-4 min-h-[220px]">
                <div className="h-[180px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {allocationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: number) => [formatGBP(val), 'Value']}
                        contentStyle={{
                          backgroundColor: 'rgba(30, 41, 59, 0.9)',
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                          color: '#fff',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontFamily: 'monospace'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Total indicator inside donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[9px] font-mono tracking-widest text-muted-foreground uppercase">
                      Total Portfolio
                    </span>
                    <span className="text-sm font-serif font-bold text-foreground mt-0.5">
                      {formatGBP(portfolioStats.totalPortfolioValue)}
                    </span>
                  </div>
                </div>

                {/* Legend list */}
                <div className="w-full grid grid-cols-2 gap-2 text-[10px] font-sans">
                  {allocationData.map((item, idx) => {
                    const pct = (item.value / portfolioStats.totalPortfolioValue) * 100;
                    return (
                      <div key={idx} className="flex items-center gap-1.5 py-0.5">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-muted-foreground truncate">{item.name}</span>
                        <span className="font-semibold text-foreground ml-auto font-mono">
                          {pct.toFixed(0)}%
                        </span>
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
      <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl">
        <div className="space-y-6">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-serif font-semibold text-foreground flex items-center gap-1.5">
              <LineIcon className="h-4 w-4 text-primary" /> Compound Wealth Projection
            </CardTitle>
            <CardDescription className="text-[10px] text-muted-foreground">
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
                  <span className="text-foreground font-semibold text-emerald-500 font-bold">
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
              <div className="bg-primary/5 rounded-2xl p-4 border border-primary/5 mt-4 space-y-3 font-sans text-xs">
                <div className="flex items-center gap-1.5 font-serif font-semibold text-foreground text-sm">
                  <Info className="h-4 w-4 text-primary shrink-0" />
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
                  <span className="font-semibold text-emerald-500 font-bold">
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
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorTC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorFV)"
                  />
                  <Area
                    type="monotone"
                    name="Total Contributions"
                    dataKey="Total Contributions"
                    stroke="#3b82f6"
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
        <DialogContent className="sm:rounded-3xl border border-primary/10 bg-card/95 backdrop-blur-md max-w-md w-full">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-serif font-semibold text-foreground flex items-center gap-1.5">
                <Coins className="h-5 w-5 text-primary" />
                {editingHolding ? 'Edit Holding Asset' : 'Add Holding Asset'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
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

/**
 * Cash Flow — one of the two sections on the Plan surface (REHAUL_PLAN.md 7.C).
 *
 * Extracted from FinancePage in 7.2c. Ledger data comes from the provider; the
 * period selector and its drawers are local, because nothing outside this view
 * reads them.
 */

import { useState } from 'react';
import { useFinanceData } from '../FinanceDataContext';
import { Figure } from '../components/Figure';
import { MONTH_NAMES, isDueThisMonth } from '../finance-defaults';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatGBP } from '@/features/finance/utils/calculations';
import { cn } from '@/lib/utils';
import { ArrowUpRight, Check, ChevronDown, Info, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface CashFlowSurfaceProps {
  /** Post-tax income rates, derived in the page from settings and tax config. */
  breakdownRates: { postTax: { monthly: number } };
  /** Today, passed in so the whole page agrees on one "now". */
  todayDateObj: Date;
}

export default function CashFlowSurface({ breakdownRates, todayDateObj }: CashFlowSurfaceProps) {
  const { bankAccounts, mockTransactions, recurrings, hasLoaded } = useFinanceData();

  const [cfPeriod, setCfPeriod] = useState<'ytd' | 'last_3m' | 'all_time' | 'custom'>('ytd');
  const [cfPeriodOpen, setCfPeriodOpen] = useState(false);
  const [cfDrawerOpen, setCfDrawerOpen] = useState<'net' | 'spend' | 'income' | null>(null);
  const [cfCustomStart, setCfCustomStart] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-01-01`;
  });
  const [cfCustomEnd, setCfCustomEnd] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

// ── Cash Flow Period Definitions ──
const cfMonthlyIncome = breakdownRates.postTax.monthly;
const cfCurrentMonthIdx = todayDateObj.getMonth();
const cfYear = todayDateObj.getFullYear();

// Compute period start/end dates based on selected period
const getPeriodRange = () => {
  const today = new Date(todayDateObj);
  today.setHours(0, 0, 0, 0);
  switch (cfPeriod) {
    case 'all_time': {
      let start = new Date(cfYear - 3, 0, 1);
      if (mockTransactions.length > 0) {
        const dates = mockTransactions.map(tx => new Date(tx.date).getTime()).filter(t => !isNaN(t));
        if (dates.length > 0) {
          start = new Date(Math.min(...dates));
          start.setDate(1);
        }
      }
      return { start, end: today };
    }
    case 'ytd':
      return { start: new Date(cfYear, 0, 1), end: today };
    case 'last_3m': {
      const s = new Date(today);
      s.setMonth(s.getMonth() - 2);
      s.setDate(1);
      return { start: s, end: today };
    }
    case 'custom': {
      const s = new Date(cfCustomStart);
      const e = new Date(cfCustomEnd);
      s.setHours(0, 0, 0, 0);
      e.setHours(23, 59, 59, 999);
      return {
        start: isNaN(s.getTime()) ? new Date(cfYear, 0, 1) : s,
        end: isNaN(e.getTime()) ? today : e
      };
    }
    default:
      return { start: new Date(cfYear, 0, 1), end: today };
  }
};

const { start: cfPeriodStart, end: cfPeriodEnd } = getPeriodRange();

const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
const periodStartLabel = fmtDate(cfPeriodStart);
const periodEndLabel = fmtDate(cfPeriodEnd);

const CF_PERIOD_OPTIONS = [
  { key: 'all_time' as const, label: 'All Time' },
  { key: 'ytd' as const, label: 'Year to Date' },
  { key: 'last_3m' as const, label: 'Last 3 Months' },
  { key: 'custom' as const, label: 'Custom Range' },
];

const activePeriodLabel = CF_PERIOD_OPTIONS.find(o => o.key === cfPeriod)?.label || 'Year to Date';

// Category Details & Color Resolver
const getCategoryDetails = (categoryName: string) => {
  const catLower = categoryName.toLowerCase();
  if (catLower.includes('rent') || catLower.includes('housing') || catLower.includes('home')) return { emoji: '🏠', color: 'hsl(var(--chart-3))' };
  if (catLower.includes('shopping') || catLower.includes('wardrobe') || catLower.includes('clothes')) return { emoji: '🛍️', color: 'hsl(var(--chart-5))' };
  if (catLower.includes('restaurants') || catLower.includes('food') || catLower.includes('dining')) return { emoji: '🍔', color: 'hsl(var(--chart-4))' };
  if (catLower.includes('groceries')) return { emoji: '🥑', color: 'hsl(var(--positive))' };
  if (catLower.includes('insurance')) return { emoji: '🚘', color: 'hsl(var(--chart-4))' };
  if (catLower.includes('gas') || catLower.includes('fuel')) return { emoji: '⛽', color: 'hsl(var(--destructive))' };
  if (catLower.includes('personal') || catLower.includes('health') || catLower.includes('care')) return { emoji: '💆', color: 'hsl(var(--chart-5))' };
  if (catLower.includes('phone') || catLower.includes('mobile')) return { emoji: '📱', color: 'hsl(var(--chart-2))' };
  if (catLower.includes('uber') || catLower.includes('taxi') || catLower.includes('ride')) return { emoji: '🚗', color: 'hsl(var(--chart-5))' };
  if (catLower.includes('transport') || catLower.includes('travel')) return { emoji: '🚗', color: 'hsl(var(--chart-4))' };
  if (catLower.includes('entertainment') || catLower.includes('movie') || catLower.includes('cinema')) return { emoji: '🎬', color: 'hsl(var(--destructive))' };
  if (catLower.includes('electric') || catLower.includes('power') || catLower.includes('utilities')) return { emoji: '⚡', color: 'hsl(var(--chart-3))' };
  if (catLower.includes('internet') || catLower.includes('wifi')) return { emoji: '🌐', color: 'hsl(var(--chart-3))' };
  if (catLower.includes('gym') || catLower.includes('fitness') || catLower.includes('sports')) return { emoji: '🏋️', color: 'hsl(var(--positive))' };
  if (catLower.includes('pet') || catLower.includes('vet')) return { emoji: '🐶', color: 'hsl(var(--chart-4))' };
  if (catLower.includes('gift') || catLower.includes('presents')) return { emoji: '🎁', color: 'hsl(var(--destructive))' };
  if (catLower.includes('donations') || catLower.includes('charity')) return { emoji: '🤝', color: 'hsl(var(--muted-foreground))' };
  if (catLower.includes('spotify') || catLower.includes('music')) return { emoji: '🎵', color: 'hsl(var(--positive))' };
  if (catLower.includes('netflix') || catLower.includes('hulu') || catLower.includes('tv')) return { emoji: '📺', color: 'hsl(var(--destructive))' };
  if (catLower.includes('audible') || catLower.includes('books')) return { emoji: '🎧', color: 'hsl(var(--chart-4))' };
  return { emoji: '📦', color: 'hsl(var(--muted-foreground))' };
};

// Build monthly data buckets covering the period
const buildMonthlyBuckets = () => {
  const buckets: {
    year: number;
    month: number;
    name: string;
    fullName: string;
    spend: number;
    income: number;
    net: number;
    isFuture: boolean;
    isCurrent: boolean;
    monthIdx: number;
    categoryBreakdown: { name: string; emoji: string; color: string; amount: number }[];
    incomeItems: { id: string; date: string; name: string; accountName: string; amount: number }[];
  }[] = [];

  const cursor = new Date(cfPeriodStart.getFullYear(), cfPeriodStart.getMonth(), 1);
  const endMonth = new Date(cfPeriodEnd.getFullYear(), cfPeriodEnd.getMonth(), 1);
  const now = new Date(todayDateObj.getFullYear(), todayDateObj.getMonth(), 1);

  while (cursor <= endMonth) {
    const yr = cursor.getFullYear();
    const mo = cursor.getMonth();
    const isFuture = cursor > now;
    const isCurrent = yr === now.getFullYear() && mo === now.getMonth();
    const shortName = MONTH_NAMES[mo].slice(0, 3);
    const prefix = `${yr}-${String(mo + 1).padStart(2, '0')}-`;

    // Calculate Category Spend Breakdown
    const catSums: Record<string, number> = {};
    let monthSpend = 0;

    if (!isFuture) {
      mockTransactions
        .filter(tx => tx.date.startsWith(prefix) && tx.amount > 0)
        .forEach(tx => {
          monthSpend += tx.amount;
          const cat = tx.category || 'Other';
          catSums[cat] = (catSums[cat] || 0) + tx.amount;
        });

      recurrings
        .filter(r => isDueThisMonth(r, mo + 1))
        .forEach(r => {
          monthSpend += r.amount;
          const cat = 'Bills & Subscriptions';
          catSums[cat] = (catSums[cat] || 0) + r.amount;
        });
    }

    const categoryBreakdown = Object.entries(catSums)
      .map(([name, amount]) => {
        const details = getCategoryDetails(name);
        return { name, emoji: details.emoji, color: details.color, amount };
      })
      .sort((a, b) => b.amount - a.amount);

    // Calculate Income Breakdown
    // TODO: Implement autotagging of income into categories (e.g., Salary, Interest, Dividends, Transfers) to start autotagging income into custom categories.
    const incomeItems: { id: string; date: string; name: string; accountName: string; amount: number }[] = [];
    let incomeSum = 0;

    if (!isFuture) {
      mockTransactions
        .filter(tx => tx.date.startsWith(prefix) && tx.amount < 0)
        .forEach(tx => {
          const amt = Math.abs(tx.amount);
          incomeSum += amt;
          const acc = bankAccounts.find(a => a.id === (tx.bankAccountId || tx.accountId));
          incomeItems.push({
            id: tx.id,
            date: tx.date,
            name: tx.name,
            accountName: acc ? `${acc.issuer || acc.name} ${acc.type === 'credit' ? '3860' : '8901'}` : 'Checking 8901',
            amount: amt
          });
        });

      if (incomeSum === 0 && cfMonthlyIncome > 0) {
        incomeSum = cfMonthlyIncome;
        incomeItems.push({
          id: `salary-${prefix}`,
          date: `${prefix}15`,
          name: 'Gusto Payroll',
          accountName: 'Total Checking 8901',
          amount: cfMonthlyIncome
        });
      }
    }

    const net = incomeSum - monthSpend;
    const label = cfPeriod === 'all_time' || cfPeriod === 'last_3m'
      ? `${shortName} '${String(yr).slice(2)}`
      : shortName;

    buckets.push({
      year: yr,
      month: mo,
      name: label,
      fullName: MONTH_NAMES[mo],
      spend: monthSpend,
      income: incomeSum,
      net,
      isFuture,
      isCurrent,
      monthIdx: mo,
      categoryBreakdown,
      incomeItems
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
};

const cfMonthlyData = buildMonthlyBuckets();

const activeData = cfMonthlyData.filter(m => !m.isFuture);
const elapsedMonths = activeData.length;
const ytdIncome = activeData.reduce((s, m) => s + m.income, 0);
const ytdSpend = activeData.reduce((s, m) => s + m.spend, 0);
const ytdNet = ytdIncome - ytdSpend;
const avgMonthlyNet = elapsedMonths > 0 ? ytdNet / elapsedMonths : 0;
const avgMonthlySpend = elapsedMonths > 0 ? ytdSpend / elapsedMonths : 0;
const avgMonthlyIncome = elapsedMonths > 0 ? ytdIncome / elapsedMonths : 0;
const savingsRate = ytdIncome > 0 ? ((ytdIncome - ytdSpend) / ytdIncome) * 100 : 0;
const totalMonthlyRecurrings = recurrings
  .filter(r => r.frequency === 'monthly')
  .reduce((sum, r) => sum + r.amount, 0);
const recurringBurnRate = cfMonthlyIncome > 0 ? (totalMonthlyRecurrings / cfMonthlyIncome) * 100 : 0;

// Compute overall category spend summary for drawer
const overallCategoryMap: Record<string, { emoji: string; color: string; amount: number }> = {};
activeData.forEach(m => {
  m.categoryBreakdown.forEach(cat => {
    if (!overallCategoryMap[cat.name]) {
      overallCategoryMap[cat.name] = { emoji: cat.emoji, color: cat.color, amount: 0 };
    }
    overallCategoryMap[cat.name].amount += cat.amount;
  });
});
const overallCategories = Object.entries(overallCategoryMap)
  .map(([name, val]) => ({ name, emoji: val.emoji, color: val.color, amount: val.amount }))
  .sort((a, b) => b.amount - a.amount);

// Yearly comparative metrics
const spend2026 = activeData.filter(m => m.year === 2026).reduce((s, m) => s + m.spend, 0);
const spend2025 = activeData.filter(m => m.year === 2025).reduce((s, m) => s + m.spend, 0);
const income2026 = activeData.filter(m => m.year === 2026).reduce((s, m) => s + m.income, 0);
const income2025 = activeData.filter(m => m.year === 2025).reduce((s, m) => s + m.income, 0);
const net2026 = income2026 - spend2026;
const net2025 = income2025 - spend2025;

// Custom bar shape that renders rounded-top bars
const RoundedBar = (props: { x?: number; y?: number; width?: number; height?: number; fill?: string; opacity?: number }) => {
  const { x = 0, y = 0, width = 0, height = 0, fill, opacity = 1 } = props;
  if (height <= 0) return null;
  const r = Math.min(4, width / 2, height);
  return (
    <path
      d={`M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`}
      fill={fill}
      opacity={opacity}
    />
  );
};

// Stacked category bar renderer for spend chart
const StackedCategoryBar = (props: any) => {
  const { x = 0, y = 0, width = 0, height = 0, index } = props;
  const bucket = cfMonthlyData[index];
  if (!bucket || height <= 0 || bucket.spend <= 0) return null;

  const breakdown = bucket.categoryBreakdown || [];
  if (breakdown.length === 0) {
    return (
      <RoundedBar
        x={x}
        y={y}
        width={width}
        height={height}
        fill="hsl(var(--destructive))"
        opacity={bucket.isFuture ? 0.15 : 0.85}
      />
    );
  }

  let currY = y + height;
  const radius = Math.min(4, width / 2);

  return (
    <g>
      {breakdown.map((cat: any, i: number) => {
        const segH = Math.max(1, (cat.amount / bucket.spend) * height);
        const segY = currY - segH;
        currY = segY;

        const isTop = i === 0;
        if (isTop && breakdown.length > 1) {
          return (
            <path
              key={cat.name + i}
              d={`M${x},${segY + segH} L${x},${segY + radius} Q${x},${segY} ${x + radius},${segY} L${x + width - radius},${segY} Q${x + width},${segY} ${x + width},${segY + radius} L${x + width},${segY + segH} Z`}
              fill={cat.color}
              opacity={bucket.isFuture ? 0.2 : 0.9}
            />
          );
        }

        return (
          <rect
            key={cat.name + i}
            x={x}
            y={segY}
            width={width}
            height={segH}
            fill={cat.color}
            opacity={bucket.isFuture ? 0.2 : 0.9}
            rx={breakdown.length === 1 ? radius : 0}
          />
        );
      })}
    </g>
  );
};

// Custom tick to render "Now" label on current bucket
const CashFlowXTick = (props: { x?: number; y?: number; payload?: { value: string; index: number } }) => {
  const { x = 0, y = 0, payload } = props;
  if (!payload) return null;
  const dataPoint = cfMonthlyData[payload.index];
  const isCurr = dataPoint?.isCurrent;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="currentColor" opacity={dataPoint?.isFuture ? 0.25 : 0.5} fontSize={9}>
        {payload.value}
      </text>
      {isCurr && (
        <g>
          <rect x={-14} y={18} width={28} height={14} rx={4} fill="hsl(var(--foreground))" opacity={0.9} />
          <text x={0} y={28} textAnchor="middle" fill="hsl(var(--background))" fontSize={8} fontWeight={700}>Now</text>
        </g>
      )}
    </g>
  );
};

// Rich Tooltip with Category Rundown
const CashFlowCategoryTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  if (!data) return null;

  return (
    <div className="bg-popover/95 backdrop-blur-md border border-border/80 rounded-2xl p-3.5 shadow-2xl min-w-[220px] max-w-[280px] z-50 text-foreground animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-2 mb-2.5">
        <span className="text-xs font-bold text-foreground font-serif">{data.fullName} {data.year}</span>
        <span className="text-xs font-bold font-mono text-foreground">{formatGBP(data.spend)}</span>
      </div>
      {data.categoryBreakdown && data.categoryBreakdown.length > 0 ? (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {data.categoryBreakdown.map((cat: any) => (
            <div key={cat.name} className="flex items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-xs shrink-0">{cat.emoji}</span>
                <span className="text-muted-foreground truncate">{cat.name}</span>
              </div>
              <span className="font-mono font-semibold text-foreground shrink-0">{formatGBP(cat.amount)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic">No category spend recorded</div>
      )}
    </div>
  );
};

const cfTooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  borderColor: 'hsl(var(--border))',
  borderRadius: '1rem',
  fontSize: '11px',
  padding: '8px 12px',
};

return (
  <div className="space-y-6">

    {/* Period Header Row */}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
      <div className="min-w-0">
        <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary shrink-0" /> Cash Flow
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Overview of income, spending, and net position</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* Period Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setCfPeriodOpen(!cfPeriodOpen)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono flex items-center gap-1.5 hover:bg-primary/20 transition-colors"
          >
            {activePeriodLabel}
            <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", cfPeriodOpen && "rotate-180")} />
          </button>
          {cfPeriodOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[240px] bg-popover border border-border rounded-2xl shadow-xl p-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
              {CF_PERIOD_OPTIONS.map(opt => {
                const isActive = cfPeriod === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => { setCfPeriod(opt.key); setCfPeriodOpen(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-3 transition-colors",
                      isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {isActive && <Check className="h-3 w-3 text-primary shrink-0" />}
                      <span className={cn("font-semibold", !isActive && "ml-5")}>{opt.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
          {periodStartLabel} – {periodEndLabel}
        </span>
      </div>
    </div>

    {/* ─── NET INCOME HERO CARD ─── */}
    <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Income</span>
          <p className="text-xs text-muted-foreground">{periodStartLabel} – {periodEndLabel}</p>
          <Figure loading={!hasLoaded} skeletonClassName="h-9 w-44" className={cn("block text-3xl font-bold font-mono", ytdNet >= 0 ? "text-positive" : "text-destructive")}>
            {formatGBP(ytdNet)}
          </Figure>
        </div>
        <button
          onClick={() => setCfDrawerOpen('net')}
          className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-mono tracking-wider uppercase bg-primary/5 hover:bg-primary/10 px-2.5 py-1 rounded-full border border-primary/15"
        >
          <span>VIEW MORE</span>
          <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>

      <div className="h-[220px] sm:h-[280px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={cfMonthlyData} margin={{ top: 10, right: 4, left: -16, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tick={(props) => <CashFlowXTick {...props} />}
              interval={0}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `£${v >= 0 ? '' : '-'}${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(1)}K` : Math.abs(v)}`}
              tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 9 }}
            />
            <RechartsTooltip
              cursor={false}
              contentStyle={cfTooltipStyle}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              labelStyle={{ fontWeight: 'bold' }}
              formatter={(value: number) => [formatGBP(value), 'Net Income']}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
            <Bar
              dataKey="net"
              shape={(props: Record<string, unknown>) => {
                const dataPoint = cfMonthlyData[(props as { index: number }).index];
                const val = (props as { value?: number }).value ?? (props as { net?: number }).net ?? 0;
                return (
                  <RoundedBar
                    {...props as { x: number; y: number; width: number; height: number }}
                    fill={val >= 0 ? 'hsl(var(--positive))' : 'hsl(var(--destructive))'}
                    opacity={dataPoint?.isFuture ? 0.15 : 1}
                  />
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>

    {/* ─── SPEND + INCOME SIDE-BY-SIDE ─── */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Spend Card */}
      <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Spend</span>
            <p className="text-xs text-muted-foreground">{periodStartLabel} – {periodEndLabel}</p>
            <Figure loading={!hasLoaded} skeletonClassName="h-8 w-36" className="block text-2xl font-bold font-mono text-destructive">{formatGBP(ytdSpend)}</Figure>
          </div>
          <button
            onClick={() => setCfDrawerOpen('spend')}
            className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-mono tracking-wider uppercase bg-primary/5 hover:bg-primary/10 px-2.5 py-1 rounded-full border border-primary/15"
          >
            <span>VIEW MORE</span>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        <div className="h-[180px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cfMonthlyData} margin={{ top: 5, right: 4, left: -20, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={(props) => <CashFlowXTick {...props} />}
                interval={0}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `£${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`}
                tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 9 }}
              />
              <RechartsTooltip cursor={false} content={<CashFlowCategoryTooltip />} />
              <Bar dataKey="spend" shape={(props) => <StackedCategoryBar {...props} />} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Income Card */}
      <Card className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Income</span>
            <p className="text-xs text-muted-foreground">{periodStartLabel} – {periodEndLabel}</p>
            <Figure loading={!hasLoaded} skeletonClassName="h-8 w-36" className="block text-2xl font-bold font-mono text-chart-3">{formatGBP(ytdIncome)}</Figure>
          </div>
          <button
            onClick={() => setCfDrawerOpen('income')}
            className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-mono tracking-wider uppercase bg-primary/5 hover:bg-primary/10 px-2.5 py-1 rounded-full border border-primary/15"
          >
            <span>VIEW MORE</span>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        <div className="h-[180px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cfMonthlyData} margin={{ top: 5, right: 4, left: -20, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={(props) => <CashFlowXTick {...props} />}
                interval={0}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `£${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`}
                tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 9 }}
              />
              <RechartsTooltip
                cursor={false}
                contentStyle={cfTooltipStyle}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => [formatGBP(value), 'Income']}
              />
              <Bar
                dataKey="income"
                shape={(props: Record<string, unknown>) => {
                  const dataPoint = cfMonthlyData[(props as { index: number }).index];
                  return (
                    <RoundedBar
                      {...props as { x: number; y: number; width: number; height: number }}
                      fill="hsl(var(--chart-2))"
                      opacity={dataPoint?.isFuture ? 0.15 : 0.85}
                    />
                  );
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

    </div>

    {/* ─── METRIC SUMMARY ROW ─── */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-lg p-4 sm:p-5 rounded-3xl space-y-1.5">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Monthly Net</span>
        <span className={cn("text-xl font-bold font-mono block", avgMonthlyNet >= 0 ? "text-positive" : "text-destructive")}>
          {formatGBP(avgMonthlyNet)}
        </span>
        <span className="text-xs text-muted-foreground">across {elapsedMonths} month{elapsedMonths !== 1 ? 's' : ''}</span>
      </Card>

      <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-lg p-4 sm:p-5 rounded-3xl space-y-1.5">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Savings Rate</span>
        <span className={cn("text-xl font-bold font-mono block", savingsRate >= 20 ? "text-positive" : savingsRate >= 0 ? "text-chart-4" : "text-destructive")}>
          {savingsRate.toFixed(1)}%
        </span>
        <span className="text-xs text-muted-foreground">of income retained YTD</span>
      </Card>

      <Card className="bg-card/45 backdrop-blur-md border border-primary/10 shadow-lg p-4 sm:p-5 rounded-3xl space-y-1.5">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recurring Burn</span>
        <span className={cn("text-xl font-bold font-mono block", recurringBurnRate <= 30 ? "text-positive" : recurringBurnRate <= 50 ? "text-chart-4" : "text-destructive")}>
          {recurringBurnRate.toFixed(1)}%
        </span>
        <span className="text-xs text-muted-foreground">{formatGBP(totalMonthlyRecurrings)} / {formatGBP(cfMonthlyIncome)} monthly</span>
      </Card>
    </div>

    {/* ─── SLIDE-OVER SHEET / DRAWERS FOR VIEW MORE ─── */}
    <Sheet open={!!cfDrawerOpen} onOpenChange={(open) => !open && setCfDrawerOpen(null)}>
      <SheetContent side="right" className="bg-card/95 backdrop-blur-2xl border-l border-primary/15 sm:max-w-md w-full p-6 text-foreground overflow-y-auto z-[70]">
        
        {/* NET INCOME DRAWER */}
        {cfDrawerOpen === 'net' && (
          <div className="space-y-6 pt-2">
            <SheetHeader className="text-left space-y-1">
              <SheetTitle className="text-xl font-bold font-serif text-foreground">Net income</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Monthly income minus spend
              </SheetDescription>
              <div className="pt-2">
                <span className={cn("text-3xl font-bold font-mono", ytdNet >= 0 ? "text-positive" : "text-destructive")}>
                  {formatGBP(ytdNet)}
                </span>
              </div>
            </SheetHeader>

            {/* Key Metrics Section */}
            <div className="border-t border-b border-border/40 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  Key metrics <Info className="h-3 w-3 opacity-60" />
                </span>
                <div className="text-right text-xs">
                  <span className="text-muted-foreground mr-6">Net income per year</span>
                  <span className="text-muted-foreground">Avg monthly net income</span>
                </div>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">2026</span>
                  <div className="flex gap-12">
                    <span className="text-positive font-bold">{formatGBP(net2026)}</span>
                    <span className="text-positive font-bold">{formatGBP(avgMonthlyNet)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">2025</span>
                  <div className="flex gap-12">
                    <span className="text-positive font-bold">{formatGBP(net2025 || 8754.61)}</span>
                    <span className="text-positive font-bold">{formatGBP(729.55)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Monthly Breakdown List */}
            <div className="space-y-4">
              {activeData.slice().reverse().map(m => (
                <div key={m.fullName + m.year} className="space-y-1.5 border-b border-border/20 pb-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>{m.fullName} {m.year}</span>
                    <span className={cn("font-mono", m.net >= 0 ? "text-positive" : "text-destructive")}>
                      {formatGBP(m.net)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground pl-2 font-mono">
                    <span>{m.name} Total income</span>
                    <span className="text-positive">+{formatGBP(m.income)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground pl-2 font-mono">
                    <span>{m.name} Total expenses</span>
                    <span className="text-muted-foreground">-{formatGBP(m.spend)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SPEND DRAWER */}
        {cfDrawerOpen === 'spend' && (
          <div className="space-y-6 pt-2">
            <SheetHeader className="text-left space-y-1">
              <SheetTitle className="text-xl font-bold font-serif text-foreground">Spend</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Monthly spend not including recurrings left to pay
              </SheetDescription>
              <div className="pt-2">
                <span className="text-3xl font-bold font-mono text-destructive">
                  {formatGBP(ytdSpend)}
                </span>
              </div>
            </SheetHeader>

            {/* Key Metrics Section */}
            <div className="border-t border-b border-border/40 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  Key metrics <Info className="h-3 w-3 opacity-60" />
                </span>
                <div className="text-right text-xs">
                  <span className="text-muted-foreground mr-6">Spend per year</span>
                  <span className="text-muted-foreground">Avg monthly spend</span>
                </div>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">2026</span>
                  <div className="flex gap-12">
                    <span className="text-foreground font-bold">{formatGBP(spend2026)}</span>
                    <span className="text-foreground font-bold">{formatGBP(avgMonthlySpend)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">2025</span>
                  <div className="flex gap-12">
                    <span className="text-foreground font-bold">{formatGBP(spend2025 || 24455.39)}</span>
                    <span className="text-foreground font-bold">{formatGBP(2037.95)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Categories List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Categories</h4>
              <div className="space-y-2">
                {overallCategories.map(cat => (
                  <div key={cat.name} className="flex items-center justify-between text-xs p-2 rounded-xl bg-background/30 hover:bg-background/60 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-base shrink-0">{cat.emoji}</span>
                      <span className="font-semibold text-foreground truncate">{cat.name}</span>
                    </div>
                    <span className="font-mono font-bold text-foreground shrink-0">{formatGBP(cat.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* INCOME DRAWER */}
        {cfDrawerOpen === 'income' && (
          <div className="space-y-6 pt-2">
            <SheetHeader className="text-left space-y-1">
              <SheetTitle className="text-xl font-bold font-serif text-foreground">Income</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Income this month
              </SheetDescription>
              <div className="pt-2">
                <span className="text-3xl font-bold font-mono text-positive">
                  {formatGBP(ytdIncome)}
                </span>
              </div>
            </SheetHeader>

            {/* Key Metrics Section */}
            <div className="border-t border-b border-border/40 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  Key metrics <Info className="h-3 w-3 opacity-60" />
                </span>
                <div className="text-right text-xs">
                  <span className="text-muted-foreground mr-6">Income per year</span>
                  <span className="text-muted-foreground">Avg monthly income</span>
                </div>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">2026</span>
                  <div className="flex gap-12">
                    <span className="text-positive font-bold">{formatGBP(income2026)}</span>
                    <span className="text-positive font-bold">{formatGBP(avgMonthlyIncome)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">2025</span>
                  <div className="flex gap-12">
                    <span className="text-positive font-bold">{formatGBP(income2025 || 33210.00)}</span>
                    <span className="text-positive font-bold">{formatGBP(2767.50)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Income Items List Grouped by Month */}
            <div className="space-y-4">
              {activeData.slice().reverse().map(m => (
                <div key={m.fullName + m.year} className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold border-b border-border/20 pb-1">
                    <span>{m.fullName} {m.year}</span>
                    <span className="font-mono text-positive">{formatGBP(m.income)}</span>
                  </div>
                  <div className="space-y-1.5 pl-1">
                    {m.incomeItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground font-mono shrink-0">{item.date}</span>
                          <span className="font-semibold text-foreground truncate">{item.name}</span>
                          <span className="text-xs text-muted-foreground truncate hidden sm:inline">{item.accountName}</span>
                        </div>
                        <span className="font-mono font-bold text-positive shrink-0">+{formatGBP(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </SheetContent>
    </Sheet>

  </div>
);
}

/**
 * Budget — the widest section on the Spending surface (REHAUL_PLAN.md 7.C).
 *
 * Owns the category and item dialogs, their preset selectors, the effect that
 * seeds them when the add-item dialog opens, and its own confirm-delete step.
 * The shared budget arithmetic comes from `makeBudgetMath` rather than closures
 * over the page (7.2c-i).
 *
 * `totalSpent` is the one genuine prop: the dashboard derives it too, so it
 * stays computed once in the page until 7.2d moves the totals to the provider.
 */

import { useEffect, useState } from 'react';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useToast } from '@/hooks/use-toast';
import { makeBudgetMath } from '../finance-defaults';
import { useFinanceData } from '../FinanceDataContext';
import { initialPresetSelection, presetGroupFor, resolveItemName } from '../budget-preset-groups';
import { BudgetPresetField } from '../components/BudgetPresetField';
import { DEFAULT_CATEGORY_PRESETS, DEFAULT_CATEGORY_TEMPLATES, MONTH_NAMES, asBudgetGroup, getBudgetItemSpent, isDueThisMonth } from '../finance-defaults';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BudgetCategory, BudgetItem, MockTransaction, RecurringBill } from '@/features/finance/finance-types';
import { formatGBP, getCategoryDefaultEmoji } from '@/features/finance/utils/calculations';
import { cn } from '@/lib/utils';
import { Activity, ChevronDown, ChevronRight, Edit2, Info, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';

export default function BudgetSurface({ totalSpent }: { totalSpent: number }) {
  const { toast } = useToast();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const {
    bankAccounts,
    budgetCategories,
    mockTransactions,
    recurrings,
    saveDataToSupabase,
    setBudgetCategories,
    settings,
  } = useFinanceData();

  const { isItemActive, getCategoryBudget, getCategorySpent } = makeBudgetMath(
    settings.activeSavingsTypes,
    bankAccounts,
    recurrings,
  );

  const isCategoryActive = (cat: BudgetCategory) => true;

  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [selectedBudgetCategoryFilter, setSelectedBudgetCategoryFilter] = useState<string>('all');
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryBudget, setNewCategoryBudget] = useState<number | ''>('');
  const [newCategoryGroup, setNewCategoryGroup] = useState<'needs' | 'wants' | 'savings'>('needs');
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('');

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [newBudgetItem, setNewBudgetItem] = useState<{
    name: string;
    budgeted: number;
    spent: number | '';
    linkedAccountId: string;
    emoji: string;
  }>({ name: '', budgeted: 0, spent: '', linkedAccountId: '', emoji: '' });
  /* One selection per open dialog, keyed by preset group, replacing fifteen
     near-identical useState pairs (one per category kind). Only one group is
     ever on screen, so `providerInput` likewise serves both the subscription
     and loan variants rather than keeping a field each. */
  const [selectedPresets, setSelectedPresets] = useState<Record<string, string>>({});
  const [providerInput, setProviderInput] = useState('');

  const [activeBudgetItem, setActiveBudgetItem] = useState<{ id: string, name: string, budgeted: number, spent: number, categoryId: string, linkedAccountId?: string, emoji?: string } | null>(null);

  // Seed the add-item dialog from whichever preset group claims the category.
  // Every group is reset on open, so a selection made under one category
  // cannot leak into the next one.
  useEffect(() => {
    if (!isAddItemOpen || !activeCategoryId) return;
    const cat = budgetCategories.find(c => c.id === activeCategoryId);
    const picked = initialPresetSelection(cat, settings);
    setProviderInput('');
    setSelectedPresets(picked ? { [picked.kind]: picked.selected } : {});
    setNewBudgetItem({
      name: picked?.name ?? '',
      budgeted: 0,
      spent: 0,
      linkedAccountId: '',
      emoji: picked?.emoji ?? '',
    });
  }, [isAddItemOpen, activeCategoryId, budgetCategories, settings]);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const normalizedName = newCategoryName.trim();
    const alreadyExists = budgetCategories.some(
      cat => cat.name.toLowerCase() === normalizedName.toLowerCase()
    );
    if (alreadyExists) {
      toast({ title: 'Category Exists', description: `"${normalizedName}" is already in your budget.`, variant: 'destructive' });
      return;
    }

    const preset = DEFAULT_CATEGORY_PRESETS.find(
      p => p.name.toLowerCase() === normalizedName.toLowerCase()
    );

    const created: BudgetCategory = {
      id: 'cat_' + Date.now(),
      name: normalizedName,
      budgeted: newCategoryBudget === '' ? 0 : newCategoryBudget,
      group: newCategoryGroup || asBudgetGroup(preset?.group),
      items: [],
      emoji: newCategoryEmoji.trim() || preset?.emoji || getCategoryDefaultEmoji(normalizedName)
    };
    const updated = [...budgetCategories, created];
    setBudgetCategories(updated);
    saveDataToSupabase('budget', updated);
    setIsAddCategoryOpen(false);
    setNewCategoryName('');
    setNewCategoryBudget('');
    setNewCategoryGroup('needs');
    setNewCategoryEmoji('');
    toast({ title: 'Category Created', description: `Created category "${created.name}".` });
  };

  const handleEditCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCategoryId || !newCategoryName.trim()) return;
    const updated = budgetCategories.map(cat => {
      if (cat.id === activeCategoryId) {
        return {
          ...cat,
          name: newCategoryName.trim(),
          budgeted: newCategoryBudget === '' ? 0 : newCategoryBudget,
          group: newCategoryGroup,
          emoji: newCategoryEmoji.trim() || cat.emoji || getCategoryDefaultEmoji(newCategoryName)
        };
      }
      return cat;
    });
    setBudgetCategories(updated);
    saveDataToSupabase('budget', updated);
    setIsEditCategoryOpen(false);
    setActiveCategoryId(null);
    setNewCategoryName('');
    setNewCategoryBudget('');
    setNewCategoryGroup('needs');
    setNewCategoryEmoji('');
    toast({ title: 'Category Updated', description: 'Updated category name and budget limit.' });
  };

  const performDeleteCategory = (catId: string) => {
    const updated = budgetCategories.filter(cat => cat.id !== catId);
    setBudgetCategories(updated);
    saveDataToSupabase('budget', updated);
    toast({ title: 'Category Deleted', description: 'Category and items removed.' });
  };

  const handleDeleteCategory = (catId: string) =>
    askDelete({
      name: budgetCategories.find(cat => cat.id === catId)?.name,
      description: 'Deleting this budget category also deletes every line item inside it. This action cannot be undone.',
      onConfirm: () => performDeleteCategory(catId),
    });

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const targetCat = budgetCategories.find(c => c.id === activeCategoryId);
    const targetGroup = presetGroupFor(targetCat);
    const finalName = resolveItemName(
      targetGroup,
      targetGroup ? selectedPresets[targetGroup.kind] ?? '' : '',
      providerInput,
      newBudgetItem.name,
    );
    if (!finalName) return;
    const item: BudgetItem = {
      id: 'item_' + Date.now(),
      name: finalName,
      budgeted: 0,
      spent: newBudgetItem.spent === '' ? 0 : newBudgetItem.spent,
      emoji: newBudgetItem.emoji
    };
    const updated = budgetCategories.map(cat => {
      if (cat.id === activeCategoryId) {
        return {
          ...cat,
          items: [...cat.items, item]
        };
      }
      return cat;
    });
    setBudgetCategories(updated);
    saveDataToSupabase('budget', updated);
    setIsAddItemOpen(false);
    setNewBudgetItem({ name: '', budgeted: 0, spent: '', linkedAccountId: '', emoji: '' });
    toast({ title: 'Item Added', description: `Added "${item.name}" to budget.` });
  };

  const handleEditItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBudgetItem) return;
    const updated = budgetCategories.map(cat => {
      if (cat.id === activeBudgetItem.categoryId) {
        return {
          ...cat,
          items: cat.items.map(item => item.id === activeBudgetItem.id ? {
            id: item.id,
            name: activeBudgetItem.name,
            budgeted: 0,
            spent: activeBudgetItem.spent,
            emoji: activeBudgetItem.emoji || item.emoji
          } : item)
        };
      }
      return cat;
    });
    setBudgetCategories(updated);
    saveDataToSupabase('budget', updated);
    setIsEditItemOpen(false);
    setActiveBudgetItem(null);
    toast({ title: 'Budget Updated', description: 'Successfully saved changes.' });
  };

  const performDeleteItem = (catId: string, itemId: string) => {
    const updated = budgetCategories.map(cat => {
      if (cat.id === catId) {
        return {
          ...cat,
          items: cat.items.filter(item => item.id !== itemId)
        };
      }
      return cat;
    });
    setBudgetCategories(updated);
    saveDataToSupabase('budget', updated);
    toast({ title: 'Item Deleted', description: 'Item removed.' });
  };

  const handleDeleteItem = (catId: string, itemId: string) =>
    askDelete({
      name: budgetCategories
        .find(cat => cat.id === catId)
        ?.items.find(item => item.id === itemId)?.name,
      onConfirm: () => performDeleteItem(catId, itemId),
    });

  const content = (() => {
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
    emoji: item.emoji || '💰'
  }))
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
/**
 * Three states, not two. With no budget set at all, "within budget" is as
 * false as "over budget" -- there is nothing to be within. Guarding only the
 * warning left the else branch claiming you were fine against a £0 limit.
 */
const budgetStatus: 'unset' | 'within' | 'over' =
  totalBudgetLimit <= 0 ? 'unset' : totalSpent > totalBudgetLimit ? 'over' : 'within';
const showWarning = budgetStatus === 'over';

const allocationData = [
  { name: 'Needs', value: needsTotal, color: 'hsl(var(--chart-3))' },
  { name: 'Savings', value: totalSavings, color: 'hsl(var(--positive))' },
  { name: 'Wants', value: wantsTotal, color: 'hsl(var(--muted-foreground))' }
].filter(d => d.value > 0);

const currentMonthName = new Date().toLocaleDateString('en-GB', { month: 'short' });

// Key Metrics Calculation per year
const currentYr = new Date().getFullYear();
const currentMoIdx = new Date().getMonth();
const allYears = Array.from(new Set([
  currentYr,
  currentYr - 1,
  ...mockTransactions.map(tx => parseInt(tx.date.split('-')[0], 10)).filter(y => !isNaN(y))
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

  return {
    year: yr,
    spentPerYear: totalSpentInYear,
    avgMonthlySpend: avgMonthlySpend,
    monthsElapsed
  };
});

// Multi-Month Historical Trend Chart Data (24 months)
const targetCategoryBudget = activeFilterCategory
  ? getCategoryBudget(activeFilterCategory)
  : totalBudgetLimit;

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
    budget: targetCategoryBudget
  });

  iterDate.setMonth(iterDate.getMonth() + 1);
}

const categoryData = budgetCategories
  .map((cat, idx) => {
    const spent = cat.items.reduce((s, i) => s + getBudgetItemSpent(i, bankAccounts, recurrings), 0);
    return {
      name: cat.name,
      value: spent,
      color: [
        'hsl(var(--chart-3))', // blue
        'hsl(var(--positive))', // emerald
        'hsl(var(--chart-4))', // amber
        'hsl(var(--destructive))', // red
        'hsl(var(--chart-5))', // violet
        'hsl(var(--chart-5))', // pink
        'hsl(var(--chart-2))', // teal
        'hsl(var(--chart-4))', // orange
      ][idx % 8]
    };
  })
  .filter(d => d.value > 0);

const donutData = categoryData.length > 0 ? categoryData : [{ name: 'Budget', value: 1, color: 'rgba(255,255,255,0.1)' }];

return (
  <div className="space-y-6">

    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
      <div className="min-w-0">
        <h3 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary shrink-0" /> Budget vs Spent Manager
        </h3>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">Customize your monthly budget target limits and record current spending progress</p>
      </div>
      <Button onClick={() => setIsAddCategoryOpen(true)} size="sm" className="rounded-lg gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-mono shrink-0 self-start sm:self-auto">
        <Plus className="h-3.5 w-3.5" /> Add Category
      </Button>
    </div>

    {/* Header Overview: Spent vs Total Budget gauge */}
    <div className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors flex flex-col md:flex-row items-center justify-around gap-6 font-mono">

      {/* Left: Total Spent */}
      <div className="text-center md:text-left space-y-1">
        <span className="text-3xl md:text-4xl font-bold font-mono text-foreground block">
          {formatGBP(totalSpent)}
        </span>
        <span className="text-xs text-muted-foreground block font-sans font-medium">
          spent in {currentMonthName}
        </span>
      </div>

      {/* Middle: Custom Donut Gauge */}
      <div className="w-28 h-28 flex items-center justify-center relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={donutData}
              cx="50%"
              cy="50%"
              innerRadius={0}
              outerRadius={38}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
            >
              {donutData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <RechartsTooltip formatter={(v: number) => formatGBP(v)} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Right: Total Budget Limit */}
      <div className="text-center md:text-right space-y-1">
        <span className="text-3xl md:text-4xl font-bold font-mono text-foreground block">
          {formatGBP(totalBudgetLimit)}
        </span>
        <span className="text-xs text-muted-foreground block font-sans font-medium">
          total budget
        </span>
      </div>

    </div>

    {/* Money Allocation & Savings Dashboard */}
    {(() => {
      const totalAlloc = needsTotal + wantsTotal + totalSavings;
      const needsPct = totalAlloc > 0 ? (needsTotal / totalAlloc) * 100 : 0;
      const savingsPct = totalAlloc > 0 ? (totalSavings / totalAlloc) * 100 : 0;
      const wantsPct = totalAlloc > 0 ? (wantsTotal / totalAlloc) * 100 : 0;

      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left Column: Savings Allocation */}
          <Card className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors flex flex-col justify-between font-mono">
            <div>
              <h4 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground border-b border-border/30 pb-2 mb-4">Savings Allocation</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Table */}
                <div className="overflow-hidden rounded-lg border border-border/30 self-start">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border/20 font-mono font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="p-3">Category</th>
                        <th className="p-3 text-right">Value (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/10 font-mono text-xs">
                      {savingsItems.map((item, idx) => {
                        const pct = totalSavings > 0 ? (item.value / totalSavings) * 100 : 0;
                        return (
                          <tr key={idx} className="hover:bg-muted/10">
                            <td className="p-3 font-sans font-medium text-foreground">
                              <span className="mr-1.5">{item.emoji || '💰'}</span>
                              {item.name}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              {formatGBP(item.value)} <span className="text-xs text-muted-foreground">({pct.toFixed(1)}%)</span>
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

                {/* Pie Chart */}
                <div className="flex flex-col items-center justify-center space-y-4">
                  {totalSavings > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie
                            data={savingsItems.map((item, idx) => ({
                              name: item.name,
                              value: item.value,
                              color: [
                                'hsl(var(--positive))', // emerald
                                'hsl(var(--chart-2))', // teal
                                'hsl(var(--chart-2))', // cyan
                                'hsl(var(--chart-3))', // blue
                                'hsl(var(--chart-5))', // indigo
                                'hsl(var(--chart-5))', // violet
                                'hsl(var(--chart-5))', // pink
                                'hsl(var(--chart-4))', // amber
                                'hsl(var(--destructive))', // red
                                'hsl(var(--chart-4))', // orange
                              ][idx % 10]
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={0}
                            outerRadius={55}
                            paddingAngle={0}
                            dataKey="value"
                            stroke="none"
                          >
                            {savingsItems.map((item, idx) => (
                              <Cell
                                key={`cell-savings-${idx}`}
                                fill={[
                                  'hsl(var(--positive))', // emerald
                                  'hsl(var(--chart-2))', // teal
                                  'hsl(var(--chart-2))', // cyan
                                  'hsl(var(--chart-3))', // blue
                                  'hsl(var(--chart-5))', // indigo
                                  'hsl(var(--chart-5))', // violet
                                  'hsl(var(--chart-5))', // pink
                                  'hsl(var(--chart-4))', // amber
                                  'hsl(var(--destructive))', // red
                                  'hsl(var(--chart-4))', // orange
                                ][idx % 10]}
                              />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(v: number) => formatGBP(v)} />
                        </PieChart>
                      </ResponsiveContainer>

                      {/* Legend */}
                      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-mono">
                        {savingsItems.map((item, idx) => {
                          const pct = totalSavings > 0 ? (item.value / totalSavings) * 100 : 0;
                          const color = [
                            'hsl(var(--positive))', // emerald
                            'hsl(var(--chart-2))', // teal
                            'hsl(var(--chart-2))', // cyan
                            'hsl(var(--chart-3))', // blue
                            'hsl(var(--chart-5))', // indigo
                            'hsl(var(--chart-5))', // violet
                            'hsl(var(--chart-5))', // pink
                            'hsl(var(--chart-4))', // amber
                            'hsl(var(--destructive))', // red
                            'hsl(var(--chart-4))', // orange
                          ][idx % 10];
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
          <Card className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors flex flex-col justify-between font-mono">
            <div>
              <h4 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground border-b border-border/30 pb-2 mb-4">Money Allocation</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Summary table */}
                <div className="overflow-hidden rounded-lg border border-border/30 self-start">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border/20 font-mono font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="p-3">Category</th>
                        <th className="p-3 text-right">Value (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/10 font-mono text-xs">
                      <tr className="hover:bg-muted/10">
                        <td className="p-3 font-sans font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--chart-3))] shrink-0" /> Needs
                          </div>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {formatGBP(needsTotal)} <span className="text-xs text-muted-foreground">({needsPct.toFixed(1)}%)</span>
                        </td>
                      </tr>
                      <tr className="hover:bg-muted/10">
                        <td className="p-3 font-sans font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--positive))] shrink-0" /> Savings
                          </div>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {formatGBP(totalSavings)} <span className="text-xs text-muted-foreground">({savingsPct.toFixed(1)}%)</span>
                        </td>
                      </tr>
                      <tr className="hover:bg-muted/10">
                        <td className="p-3 font-sans font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--muted-foreground))] shrink-0" /> Wants
                          </div>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {formatGBP(wantsTotal)} <span className="text-xs text-muted-foreground">({wantsPct.toFixed(1)}%)</span>
                        </td>
                      </tr>
                      <tr className="bg-muted/20 font-bold border-t border-border/20 text-foreground">
                        <td className="p-3 font-sans text-xs">Total</td>
                        <td className="p-3 text-right text-xs">{formatGBP(needsTotal + wantsTotal + totalSavings)}</td>
                      </tr>
                      <tr className="font-bold border-t border-border/20">
                        <td className="p-3 font-sans text-xs text-foreground">Spend Status</td>
                        <td className="p-3 text-right text-xs">
                          {budgetStatus === 'over' && (
                            <span className="inline-flex items-center text-destructive gap-1 font-sans" title="Spent exceeds budget limit!">
                              ⚠️ Over Limit
                            </span>
                          )}
                          {budgetStatus === 'within' && (
                            <span className="inline-flex items-center text-positive gap-1 font-sans">
                              ✓ Within Budget
                            </span>
                          )}
                          {budgetStatus === 'unset' && (
                            <span className="inline-flex items-center text-muted-foreground gap-1 font-sans" title="Set a budget limit on a category to track this.">
                              No budget set
                            </span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Recharts Pie Chart */}
                <div className="flex flex-col items-center justify-center space-y-4">
                  {needsTotal + wantsTotal + totalSavings > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie
                            data={allocationData}
                            cx="50%"
                            cy="50%"
                            innerRadius={0}
                            outerRadius={55}
                            paddingAngle={0}
                            dataKey="value"
                            stroke="none"
                          >
                            {allocationData.map((entry, index) => (
                              <Cell key={`cell-allocation-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(v: number) => formatGBP(v)} />
                        </PieChart>
                      </ResponsiveContainer>

                      {/* Legend / Percentages breakdown */}
                      <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground font-mono">
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
      );
    })()}

    {/* Category Pill Filters Bar */}
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      <button
        onClick={() => setSelectedBudgetCategoryFilter('all')}
        className={cn(
          "px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all flex items-center gap-1.5 border",
          selectedBudgetCategoryFilter === 'all'
            ? "bg-primary text-primary-foreground border-primary shadow-sm"
            : "bg-card/40 hover:bg-card/70 text-muted-foreground border-border/40"
        )}
      >
        <span>All Regular Categories</span>
        <span className="text-xs opacity-80 bg-background/20 px-1.5 py-0.5 rounded-full font-mono">
          {budgetCategories.filter(isCategoryActive).length}
        </span>
      </button>
      {budgetCategories.filter(isCategoryActive).map((cat, idx) => {
        const isSelected = selectedBudgetCategoryFilter === cat.id;
        const catColor = [
          'hsl(var(--chart-3))', 'hsl(var(--positive))', 'hsl(var(--chart-4))', 'hsl(var(--destructive))',
          'hsl(var(--chart-5))', 'hsl(var(--chart-5))', 'hsl(var(--chart-2))', 'hsl(var(--chart-4))'
        ][idx % 8];
        return (
          <button
            key={cat.id}
            onClick={() => setSelectedBudgetCategoryFilter(isSelected ? 'all' : cat.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all flex items-center gap-1.5 border",
              isSelected
                ? "bg-primary text-primary-foreground border-primary shadow-sm font-semibold"
                : "bg-card/40 hover:bg-card/70 text-muted-foreground border-border/40"
            )}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
            <span>{cat.emoji ? `${cat.emoji} ${cat.name}` : cat.name}</span>
          </button>
        );
      })}
    </div>

    {/* Copilot Money-style Key Metrics & Historical Monthly Trend */}
    <Card className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors space-y-6 font-mono">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-border/10 pb-6">

        {/* Left/Top: Title & Historical Bar Chart */}
        <div className="flex-1 space-y-3 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
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

          {/* Recharts Bar Chart over past 24 months */}
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
                          <p className="text-xs text-muted-foreground">Budget Limit: {formatGBP(data.budget)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={targetCategoryBudget} stroke="rgba(255, 255, 255, 0.3)" strokeDasharray="3 3" />
                <Bar dataKey="spent" radius={[3, 3, 0, 0]}>
                  {multiMonthChartData.map((entry, index) => (
                    <Cell
                      key={`cell-hist-${index}`}
                      fill={entry.spent > entry.budget ? 'hsl(var(--destructive))' : 'hsl(var(--positive))'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Key Metrics Table */}
        <div className="lg:w-80 shrink-0 bg-muted/20 border border-border/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono font-semibold text-foreground border-b border-border/20 pb-2">
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
              <span className="text-xs font-sans text-primary underline cursor-pointer" onClick={() => setSelectedBudgetCategoryFilter('all')}>
                Reset filter
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/10 pb-1">
            <span>Year</span>
            <span className="text-right">Spent / yr</span>
            <span className="text-right">Avg / mo</span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {keyMetricsData.map(m => (
              <div key={m.year} className="grid grid-cols-3 items-center hover:bg-muted/10 p-1 rounded-lg transition-colors">
                <span className="font-sans font-bold text-foreground">{m.year}</span>
                <span className="text-right font-medium text-foreground">{formatGBP(m.spentPerYear)}</span>
                <span className="text-right font-bold text-positive">{formatGBP(m.avgMonthlySpend)}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </Card>

    {/* Copilot-style Budget list */}
    <Card className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors font-mono">
      {/* Table Header */}
      <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono border-b border-border/20 pb-2 px-2">
        <span className="flex-1">Regular Categories</span>
        <div className="flex items-center gap-3 text-right">
          <span className="w-20 text-right">Spent</span>
          <span className="w-20 text-right">Budget</span>
          <span className="w-20 text-right">Left</span>
          <span className="w-32 md:w-48 hidden md:inline-block text-center">Progress</span>
        </div>
      </div>

      {/* List of Categories */}
      <div className="divide-y divide-border/10">
        {budgetCategories
          .filter(isCategoryActive)
          .filter(cat => selectedBudgetCategoryFilter === 'all' || cat.id === selectedBudgetCategoryFilter)
          .map((category, idx) => {
            const catBudget = getCategoryBudget(category);
            const catSpent = getCategorySpent(category);
            const catLeft = catBudget - catSpent;
            const isOver = catSpent > catBudget;
            const isExpanded = expandedCategories[category.id] !== false; // expanded by default!

            const catColor = [
              'hsl(var(--chart-3))', // blue
              'hsl(var(--positive))', // emerald
              'hsl(var(--chart-4))', // amber
              'hsl(var(--destructive))', // red
              'hsl(var(--chart-5))', // violet
              'hsl(var(--chart-5))', // pink
              'hsl(var(--chart-2))', // teal
              'hsl(var(--chart-4))', // orange
            ][idx % 8];

            return (
              <div key={category.id} className="py-2.5">
                {/* Category Row */}
                <div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-0 py-1.5 hover:bg-muted/5 rounded-xl px-2 transition-colors">
                  {/* Left: Collapse, badge count, name, hover actions */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      onClick={() => setExpandedCategories({
                        ...expandedCategories,
                        [category.id]: !isExpanded
                      })}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 animate-in fade-in zoom-in duration-200" style={{ color: catColor }} />
                      ) : (
                        <ChevronRight className="h-4 w-4 animate-in fade-in zoom-in duration-200" style={{ color: catColor }} />
                      )}
                    </button>

                    {/* Coloured badge with item count */}
                    <div
                      className="h-5 w-5 rounded flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm"
                      style={{ backgroundColor: catColor }}
                    >
                      {category.items.filter(item => isItemActive(item, category)).length}
                    </div>

                    <span className="font-bold text-sm text-foreground truncate">{category.name}</span>

                    {/* Hover actions */}
                    <div className="flex gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0 ml-1.5">
                      <button
                        onClick={() => {
                          setActiveCategoryId(category.id);
                          setIsAddItemOpen(true);
                        }}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                        title="Add item"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setActiveCategoryId(category.id);
                          setNewCategoryName(category.name);
                          setNewCategoryBudget(category.budgeted !== undefined ? category.budgeted : category.items.reduce((s, i) => s + i.budgeted, 0));
                          setNewCategoryEmoji(category.emoji || '');
                          setNewCategoryGroup(category.group || 'needs');
                          setIsEditCategoryOpen(true);
                        }}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                        title="Edit Category"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="text-destructive hover:text-destructive p-0.5"
                        title="Delete Category"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Right: Spent, Budget, Left, Progress bar */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 font-mono text-xs pl-7 sm:pl-0">
                    <span className="font-bold text-foreground w-20 text-right">{formatGBP(catSpent)}</span>
                    <span className="font-medium text-muted-foreground/80 w-20 text-right">{formatGBP(catBudget)}</span>
                    <span className={cn(
                      "font-bold w-20 text-right",
                      catLeft >= 0 ? "text-positive" : "text-destructive"
                    )}>
                      {catLeft >= 0 ? formatGBP(catLeft) : `-${formatGBP(Math.abs(catLeft))}`}
                    </span>

                    {/* Progress bar */}
                    <div className="w-32 md:w-48 h-1.5 bg-muted rounded-full overflow-hidden hidden md:inline-block">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          isOver ? "bg-[hsl(var(--destructive))]" : "bg-[hsl(var(--positive))]"
                        )}
                        style={{ width: `${Math.min(100, catBudget > 0 ? (catSpent / catBudget) * 100 : 0)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Category Sub-items */}
                {isExpanded && (
                  <div className="space-y-1.5 pl-7 mt-1.5 border-l-2 border-border/10 ml-4">
                    {category.items.filter(item => isItemActive(item, category)).map(item => {
                      const spentVal = getBudgetItemSpent(item, bankAccounts, recurrings);
                      const itemLeft = item.budgeted - spentVal;
                      const isItemOver = spentVal > item.budgeted;
                      return (
                        <div key={item.id} className="group flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 text-xs py-1 hover:bg-muted/5 rounded-lg px-2 transition-colors">
                          {/* Left: Bullet/Emoji, name, hover actions */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {item.emoji ? (
                              <span className="text-sm shrink-0">{item.emoji}</span>
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                            )}
                            <span className="font-medium text-foreground/90 truncate">{item.name}</span>

                            {/* Item hover actions */}
                            <div className="flex gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0 ml-1.5">
                              <button
                                onClick={() => {
                                  setActiveBudgetItem({ ...item, categoryId: category.id });
                                  setIsEditItemOpen(true);
                                }}
                                className="text-muted-foreground hover:text-foreground p-0.5"
                                title="Edit item"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(category.id, item.id)}
                                className="text-destructive hover:text-destructive p-0.5"
                                title="Delete item"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {/* Right: Spent, Budget, Left, progress */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 font-mono text-xs pl-5 sm:pl-0">
                            <span className="font-semibold text-foreground/80 w-20 text-right">{formatGBP(spentVal)}</span>
                            <span className="text-muted-foreground/60 w-20 text-right">{formatGBP(item.budgeted)}</span>
                            <span className={cn(
                              "w-20 text-right font-medium",
                              itemLeft >= 0 ? "text-positive/90" : "text-destructive/90"
                            )}>
                              {itemLeft >= 0 ? formatGBP(itemLeft) : `-${formatGBP(Math.abs(itemLeft))}`}
                            </span>

                            {/* Progress bar */}
                            <div className="w-32 md:w-48 h-1 bg-muted rounded-full overflow-hidden hidden md:inline-block">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-300",
                                  isItemOver ? "bg-[hsl(var(--destructive))]" : "bg-[hsl(var(--positive))]"
                                )}
                                style={{ width: `${Math.min(100, item.budgeted > 0 ? (spentVal / item.budgeted) * 100 : 0)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {category.items.filter(item => isItemActive(item, category)).length === 0 && (
                    <p className="text-xs text-muted-foreground italic pl-2.5 py-1">No items under this category. Click '+' to add.</p>
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
  })();

  return (
    <>
      {content}
<Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
  <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm p-6 font-mono">
    <DialogHeader>
      <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Add Budget Category</DialogTitle>
      <DialogDescription className="text-xs text-muted-foreground font-mono">Create a new container category with a monthly budget limit.</DialogDescription>
    </DialogHeader>
    <form onSubmit={handleAddCategory} className="space-y-4 py-2">
      <div className="space-y-1">
        <Label htmlFor="cat-template" className="text-xs">Select Template (Auto-fills details)</Label>
        <select
          id="cat-template"
          onChange={(e) => {
            const idx = parseInt(e.target.value, 10);
            if (!isNaN(idx) && DEFAULT_CATEGORY_TEMPLATES[idx]) {
              const preset = DEFAULT_CATEGORY_TEMPLATES[idx];
              setNewCategoryName(preset.name);
              setNewCategoryEmoji(preset.emoji || '');
              setNewCategoryGroup(preset.group || 'needs');
            } else {
              setNewCategoryName('');
              setNewCategoryEmoji('');
              setNewCategoryGroup('needs');
              setNewCategoryBudget('');
            }
          }}
          className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors"
          defaultValue=""
        >
          <option value="">Start a new one from scratch</option>
          {DEFAULT_CATEGORY_TEMPLATES.map((preset, idx) => (
            <option key={preset.id} value={idx}>
              {preset.emoji} {preset.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="cat-new-name">Category Name</Label>
        <Input
          id="cat-new-name"
          placeholder="e.g. Travel & Transport"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cat-new-budget">Budget Limit (£)</Label>
        <Input
          id="cat-new-budget"
          type="number"
          step="0.01"
          placeholder="e.g. 500"
          value={newCategoryBudget}
          onChange={(e) => setNewCategoryBudget(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cat-new-group">Allocation Group</Label>
        <select
          id="cat-new-group"
          value={newCategoryGroup}
          onChange={(e) => setNewCategoryGroup(e.target.value as 'needs' | 'wants' | 'savings')}
          className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="needs">Needs</option>
          <option value="wants">Wants</option>
          <option value="savings">Savings</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="cat-new-emoji">Category Emoji</Label>
        <Input
          id="cat-new-emoji"
          placeholder="e.g. 🍔 (Leave blank for default)"
          value={newCategoryEmoji}
          onChange={(e) => setNewCategoryEmoji(e.target.value)}
          className="rounded-xl h-10 border-primary/20 bg-background/50 text-center text-lg"
        />
      </div>
      <DialogFooter className="pt-4 gap-2 sm:gap-0">
        <Button variant="outline" type="button" onClick={() => setIsAddCategoryOpen(false)} className="rounded-xl">Cancel</Button>
        <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Category</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
<Dialog open={isEditCategoryOpen} onOpenChange={setIsEditCategoryOpen}>
  <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm p-6 font-mono">
    <DialogHeader>
      <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Edit Budget Category</DialogTitle>
      <DialogDescription className="text-xs text-muted-foreground font-mono">Modify the name or limit for this budget category.</DialogDescription>
    </DialogHeader>
    <form onSubmit={handleEditCategory} className="space-y-4 py-2">
      <div className="space-y-1">
        <Label htmlFor="cat-edit-name">Category Name</Label>
        <Input
          id="cat-edit-name"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cat-edit-budget">Budget Limit (£)</Label>
        <Input
          id="cat-edit-budget"
          type="number"
          step="0.01"
          value={newCategoryBudget}
          onChange={(e) => setNewCategoryBudget(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
          className="rounded-xl h-10 border-primary/20 bg-background/50"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="cat-edit-group">Allocation Group</Label>
        <select
          id="cat-edit-group"
          value={newCategoryGroup}
          onChange={(e) => setNewCategoryGroup(e.target.value as 'needs' | 'wants' | 'savings')}
          className="flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="needs">Needs</option>
          <option value="wants">Wants</option>
          <option value="savings">Savings</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="cat-edit-emoji">Category Emoji</Label>
        <Input
          id="cat-edit-emoji"
          placeholder="e.g. 🍔"
          value={newCategoryEmoji}
          onChange={(e) => setNewCategoryEmoji(e.target.value)}
          className="rounded-xl h-10 border-primary/20 bg-background/50 text-center text-lg"
        />
      </div>
      <DialogFooter className="pt-4 gap-2 sm:gap-0">
        <Button variant="outline" type="button" onClick={() => { setIsEditCategoryOpen(false); setActiveCategoryId(null); }} className="rounded-xl">Cancel</Button>
        <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Changes</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
<Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
  <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm p-6 font-mono">
    <DialogHeader>
      <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Add Budget Item</DialogTitle>
      <DialogDescription className="text-xs text-muted-foreground font-mono">Add a new specific item inside the selected category.</DialogDescription>
    </DialogHeader>
    {(() => {
      const targetCategory = budgetCategories.find(c => c.id === activeCategoryId);
      const targetGroup = presetGroupFor(targetCategory);

      return (
        <form onSubmit={handleAddItem} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="item-new-name">Item Name</Label>
            <BudgetPresetField
              group={targetGroup}
              options={targetGroup ? targetGroup.options(settings) : []}
              selected={targetGroup ? selectedPresets[targetGroup.kind] ?? '' : ''}
              onSelect={(val) => {
                if (!targetGroup) return;
                setSelectedPresets({ ...selectedPresets, [targetGroup.kind]: val });
                // The dropdown drives the item being built: picking a preset
                // adopts its name and emoji, picking custom clears the name
                // but keeps the group's emoji as a starting point.
                const preset = targetGroup.options(settings).find(p => p.name === val);
                setNewBudgetItem({
                  ...newBudgetItem,
                  name: val === 'custom' ? '' : val,
                  emoji: preset?.emoji || targetGroup.fallbackEmoji,
                });
              }}
              provider={providerInput}
              onProviderChange={setProviderInput}
              name={newBudgetItem.name}
              onNameChange={(val) => setNewBudgetItem({ ...newBudgetItem, name: val })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-new-spent">Currently Spent (£)</Label>
            <Input
              id="item-new-spent"
              type="number"
              step="0.01"
              placeholder="e.g. 45"
              value={newBudgetItem.spent}
              onChange={(e) => setNewBudgetItem({ ...newBudgetItem, spent: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
              className="rounded-xl h-10 border-primary/20 bg-background/50"
              required
            />
          </div>
          <DialogFooter className="pt-4 gap-2 sm:gap-0">
            <Button variant="outline" type="button" onClick={() => setIsAddItemOpen(false)} className="rounded-xl">Cancel</Button>
            <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Item</Button>
          </DialogFooter>
        </form>
      );
    })()}
  </DialogContent>
</Dialog>
<Dialog open={isEditItemOpen} onOpenChange={setIsEditItemOpen}>
  <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm p-6 font-mono">
    <DialogHeader>
      <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Edit Budget Item</DialogTitle>
      <DialogDescription className="text-xs text-muted-foreground font-mono">Modify values for this specific budget item.</DialogDescription>
    </DialogHeader>
    {activeBudgetItem && (
      <form onSubmit={handleEditItem} className="space-y-4 py-2">
        <div className="space-y-1">
          <Label htmlFor="edit-item-name">Item Name</Label>
          <Input
            id="edit-item-name"
            value={activeBudgetItem.name}
            onChange={(e) => setActiveBudgetItem({ ...activeBudgetItem, name: e.target.value })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-item-spent">Currently Spent (£)</Label>
          <Input
            id="edit-item-spent"
            type="number"
            step="0.01"
            value={activeBudgetItem.spent}
            onChange={(e) => setActiveBudgetItem({ ...activeBudgetItem, spent: parseFloat(e.target.value) || 0 })}
            className="rounded-xl h-10 border-primary/20 bg-background/50"
            required
          />
        </div>
        <DialogFooter className="pt-4 gap-2 sm:gap-0">
          <Button variant="outline" type="button" onClick={() => setIsEditItemOpen(false)} className="rounded-xl">Cancel</Button>
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

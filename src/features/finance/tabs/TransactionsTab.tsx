import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { MockTransaction, BankAccount, Goal, BudgetCategory } from '@/features/finance/finance-types';
import {
  Search,
  Filter,
  SlidersHorizontal,
  Download,
  Plus,
  Check,
  Split,
  RefreshCw,
  MoreHorizontal,
  ChevronDown,
  Trash2,
  Calendar as CalendarIcon,
  CreditCard,
  PlusCircle,
  Tag,
  FileText,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useReviewShortcuts } from '@/features/finance/useReviewShortcuts';

interface TransactionsTabProps {
  transactions: MockTransaction[];
  onUpdateTransactions: (updated: MockTransaction[]) => void;
  bankAccounts: BankAccount[];
  goals: Goal[];
  budgetCategories: BudgetCategory[];
  formatGBP: (num: number) => string;
}

export const TransactionsTab: React.FC<TransactionsTabProps> = ({
  transactions,
  onUpdateTransactions,
  bankAccounts,
  goals,
  budgetCategories,
  formatGBP,
}) => {
  // Navigation & UI States
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'reviewed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

  // Form states for manual transaction addition
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTxName, setNewTxName] = useState('');
  const [newTxAmount, setNewTxAmount] = useState('');
  const [newTxType, setNewTxType] = useState<'expense' | 'income'>('expense');
  const [newTxCategory, setNewTxCategory] = useState('');
  const [newTxAccount, setNewTxAccount] = useState('');
  const [newTxGoal, setNewTxGoal] = useState('');
  const [newTxDate, setNewTxDate] = useState<Date>(new Date());
  const [newTxNotes, setNewTxNotes] = useState('');
  const [newTxTags, setNewTxTags] = useState('');

  // Selected Transaction for Detail Panel
  const selectedTx = useMemo(() => {
    return transactions.find(t => t.id === selectedTxId) || null;
  }, [transactions, selectedTxId]);

  // If selected transaction gets deleted/disappears, reset selection
  useEffect(() => {
    if (selectedTxId && !transactions.some(t => t.id === selectedTxId)) {
      setSelectedTxId(null);
    }
  }, [transactions, selectedTxId]);

  // Dropdown list of categories including sub-items
  const allCategoryOptions = useMemo(() => {
    const options: { id: string; name: string; group?: string }[] = [];
    budgetCategories.forEach(cat => {
      cat.items.forEach(item => {
        options.push({
          id: item.name,
          name: item.name,
          group: cat.name,
        });
      });
    });
    return options;
  }, [budgetCategories]);

  // Color mapper for categories matching dashboard presets
  const getCategoryColor = (category: string) => {
    const catLower = category.toLowerCase();
    if (catLower.includes('restaurants') || catLower.includes('food') || catLower.includes('drink')) {
      return 'bg-chart-4/15 text-chart-4 border-chart-4/30';
    }
    if (catLower.includes('shopping') || catLower.includes('wardrobe') || catLower.includes('clothes')) {
      return 'bg-chart-5/15 text-chart-5 border-chart-5/30';
    }
    if (catLower.includes('gas') || catLower.includes('transport') || catLower.includes('car') || catLower.includes('travel')) {
      return 'bg-chart-4/15 text-chart-4 border-chart-4/30';
    }
    if (catLower.includes('internet') || catLower.includes('utilities') || catLower.includes('bills')) {
      return 'bg-chart-3/15 text-chart-3 border-chart-3/30';
    }
    if (catLower.includes('rent') || catLower.includes('housing') || catLower.includes('home')) {
      return 'bg-chart-5/15 text-chart-5 border-chart-5/30';
    }
    if (catLower.includes('savings') || catLower.includes('investment') || catLower.includes('interest')) {
      return 'bg-positive/15 text-positive border-positive/30';
    }
    if (catLower.includes('groceries')) {
      return 'bg-chart-2/15 text-chart-2 border-chart-2/30';
    }
    return 'bg-muted/15 text-muted-foreground border-border/30';
  };

  // Filtered & Sorted Transactions
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q)))
      );
    }

    // Status Filter
    if (statusFilter === 'pending') {
      result = result.filter(t => !t.isReviewed);
    } else if (statusFilter === 'reviewed') {
      result = result.filter(t => t.isReviewed);
    }

    // Category Filter
    if (categoryFilter !== 'all') {
      result = result.filter(t => t.category === categoryFilter);
    }

    // Account Filter
    if (accountFilter !== 'all') {
      result = result.filter(t => (t.bankAccountId === accountFilter || t.accountId === accountFilter));
    }

    // Sort order
    result.sort((a, b) => {
      if (sortOrder === 'date-desc') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (sortOrder === 'date-asc') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (sortOrder === 'amount-desc') {
        return Math.abs(b.amount) - Math.abs(a.amount);
      }
      if (sortOrder === 'amount-asc') {
        return Math.abs(a.amount) - Math.abs(b.amount);
      }
      return 0;
    });

    return result;
  }, [transactions, searchQuery, statusFilter, categoryFilter, accountFilter, sortOrder]);

  // Grouped transactions by date (only dates that are present after filtering)
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: MockTransaction[] } = {};
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    filteredTransactions.forEach(tx => {
      let groupKey = tx.date;
      const txDateObj = new Date(tx.date);

      if (tx.date === todayStr) {
        groupKey = 'TODAY';
      } else if (tx.date === yesterdayStr) {
        groupKey = 'YESTERDAY';
      } else {
        // Format as: "THU, JULY 16" or "SAT, JULY 18, 2026"
        const weekday = txDateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        const month = txDateObj.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
        const day = txDateObj.getDate();
        const year = txDateObj.getFullYear();
        const currentYear = new Date().getFullYear();

        if (year === currentYear) {
          groupKey = `${weekday}, ${month} ${day}`;
        } else {
          groupKey = `${weekday}, ${month} ${day}, ${year}`;
        }
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(tx);
    });

    return Object.entries(groups).map(([date, list]) => ({ date, list }));
  }, [filteredTransactions]);

  // Account details matching list
  const getAccountInfo = (accountId?: string) => {
    if (!accountId) return null;
    return bankAccounts.find(acc => acc.id === accountId) || null;
  };

  // Goal details matching list
  const getGoalInfo = (goalId?: string) => {
    if (!goalId) return null;
    return goals.find(g => g.id === goalId) || null;
  };

  // Statistics for similar transactions
  const similarTransactionsInfo = useMemo(() => {
    if (!selectedTx) return { list: [], monthlySum: 0, overallSum: 0, overallCount: 0 };

    const selectedNameLower = selectedTx.name.toLowerCase().trim();
    const matches = transactions.filter(t =>
      t.name.toLowerCase().trim() === selectedNameLower &&
      t.id !== selectedTx.id
    );

    matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate sum of matches in selected transaction's month
    const selectedDateObj = new Date(selectedTx.date);
    const selectedMonth = selectedDateObj.getMonth();
    const selectedYear = selectedDateObj.getFullYear();

    const monthlyMatches = matches.filter(m => {
      const d = new Date(m.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

    const monthlySum = monthlyMatches.reduce((s, m) => s + m.amount, 0) + selectedTx.amount;
    const overallSum = matches.reduce((s, m) => s + m.amount, 0) + selectedTx.amount;
    const overallCount = matches.length + 1;

    // Format current month and year label
    const monthLabel = selectedDateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return {
      list: matches.slice(0, 5), // show top 5 matches
      monthLabel,
      monthlySum,
      overallSum,
      overallCount
    };
  }, [selectedTx, transactions]);

  // Bulk / Selection Checkbox Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = filteredTransactions.map(tx => tx.id);
      setSelectedTxIds(new Set(allIds));
    } else {
      setSelectedTxIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const next = new Set(selectedTxIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedTxIds(next);
  };

  // Handlers for selected transaction details updates
  const updateSelectedField = <K extends keyof MockTransaction>(field: K, value: MockTransaction[K]) => {
    if (!selectedTxId) return;
    const updated = transactions.map(tx => {
      if (tx.id === selectedTxId) {
        return { ...tx, [field]: value };
      }
      return tx;
    });
    onUpdateTransactions(updated);
  };

  // Tag helper
  const handleAddTag = (tagStr: string) => {
    if (!selectedTx || !tagStr.trim()) return;
    const currentTags = selectedTx.tags || [];
    const newTag = tagStr.trim().toLowerCase();
    if (!currentTags.includes(newTag)) {
      updateSelectedField('tags', [...currentTags, newTag]);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!selectedTx || !selectedTx.tags) return;
    updateSelectedField('tags', selectedTx.tags.filter(t => t !== tagToRemove));
  };

  // Single Action Handlers
  const handleToggleReviewSingle = useCallback((id: string) => {
    const updated = transactions.map(tx =>
      tx.id === id ? { ...tx, isReviewed: !tx.isReviewed } : tx
    );
    onUpdateTransactions(updated);
  }, [transactions, onUpdateTransactions]);

  /* ---- Review loop ------------------------------------------------------
     Reviewing is the daily job and there are hundreds of rows, so it runs on
     the keyboard: j/k to move, r to mark and advance, x to tick, a to take the
     whole filtered set, Escape to drop back out (REHAUL_PLAN.md 7.C).

     The cursor IS the detail selection -- one highlighted row, not two
     competing ones -- so moving with the keyboard also loads the pane. */
  const orderedIds = useMemo(() => filteredTransactions.map(tx => tx.id), [filteredTransactions]);

  const listRef = useRef<HTMLDivElement | null>(null);

  const selectAllFiltered = useCallback(() => {
    setSelectedTxIds(new Set(filteredTransactions.map(tx => tx.id)));
  }, [filteredTransactions]);

  const clearReviewSelection = useCallback(() => {
    // Escape unwinds one level at a time: first the tick boxes, then the
    // cursor. Clearing both at once loses your place in the queue.
    if (selectedTxIds.size > 0) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxId(null);
    }
  }, [selectedTxIds]);

  const toggleSelectedById = useCallback((id: string) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useReviewShortcuts({
    orderedIds,
    focusedId: selectedTxId,
    setFocusedId: setSelectedTxId,
    toggleReviewed: handleToggleReviewSingle,
    toggleSelected: toggleSelectedById,
    selectAll: selectAllFiltered,
    clearSelection: clearReviewSelection,
  });

  // Keyboard movement can walk the cursor past either edge of the scroll pane,
  // where the highlight is real but invisible. 'nearest' is a no-op when the
  // row is already on screen, so mouse clicks are unaffected.
  useEffect(() => {
    if (!selectedTxId || !listRef.current) return;
    const row = listRef.current.querySelector(`[data-tx-row="${selectedTxId}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [selectedTxId]);

  const reviewProgress = useMemo(() => {
    const total = transactions.length;
    const reviewed = transactions.filter(tx => tx.isReviewed).length;
    return {
      total,
      reviewed,
      remaining: total - reviewed,
      percent: total === 0 ? 0 : (reviewed / total) * 100,
    };
  }, [transactions]);

  const performDeleteSingle = (id: string) => {
    const updated = transactions.filter(tx => tx.id !== id);
    onUpdateTransactions(updated);
    if (selectedTxId === id) {
      setSelectedTxId(null);
    }
  };

  const handleDeleteSingle = (id: string) =>
    askDelete({
      name: transactions.find(tx => tx.id === id)?.name,
      onConfirm: () => performDeleteSingle(id),
    });

  // Bulk Actions
  const handleBulkReview = (isReviewed: boolean) => {
    const updated = transactions.map(tx => {
      if (selectedTxIds.has(tx.id)) {
        return { ...tx, isReviewed };
      }
      return tx;
    });
    onUpdateTransactions(updated);
    setSelectedTxIds(new Set());
  };

  const handleBulkDelete = () =>
    askDelete({
      title: `Delete ${selectedTxIds.size} transaction${selectedTxIds.size === 1 ? '' : 's'}`,
      description: `Delete the ${selectedTxIds.size} selected transaction${selectedTxIds.size === 1 ? '' : 's'}? This action cannot be undone.`,
      onConfirm: () => {
        const updated = transactions.filter(tx => !selectedTxIds.has(tx.id));
        onUpdateTransactions(updated);
        setSelectedTxIds(new Set());
      },
    });

  const handleBulkCategory = (catName: string) => {
    const updated = transactions.map(tx => {
      if (selectedTxIds.has(tx.id)) {
        return { ...tx, category: catName };
      }
      return tx;
    });
    onUpdateTransactions(updated);
    setSelectedTxIds(new Set());
  };

  // Add Manual Transaction
  const handleAddTransaction = () => {
    if (!newTxName.trim() || !newTxAmount) return;

    const newTx: MockTransaction = {
      id: `manual-${Date.now()}`,
      name: newTxName.trim(),
      amount: parseFloat(newTxAmount),
      category: newTxCategory || 'Other',
      date: newTxDate.toISOString().split('T')[0],
      isReviewed: false,
      bankAccountId: newTxAccount || undefined,
      goalId: newTxGoal || undefined,
      notes: newTxNotes.trim() || undefined,
      tags: newTxTags.trim() ? newTxTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : undefined,
      isRecurring: false
    };

    onUpdateTransactions([newTx, ...transactions]);

    // Reset fields
    setNewTxName('');
    setNewTxAmount('');
    setNewTxCategory('');
    setNewTxAccount('');
    setNewTxGoal('');
    setNewTxDate(new Date());
    setNewTxNotes('');
    setNewTxTags('');
    setIsAddOpen(false);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Date', 'Name', 'Category', 'Amount', 'Reviewed', 'Account', 'Goal', 'Notes', 'Tags'];
    const rows = filteredTransactions.map(tx => [
      tx.id,
      tx.date,
      `"${tx.name.replace(/"/g, '""')}"`,
      tx.category || '',
      tx.amount.toFixed(2),
      tx.isReviewed ? 'Yes' : 'No',
      getAccountInfo(tx.bankAccountId)?.name || '',
      getGoalInfo(tx.goalId)?.name || '',
      `"${(tx.notes || '').replace(/"/g, '""')}"`,
      (tx.tags || []).join(', ')
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full">
      {/* LEFT SECTION: TRANSACTIONS LIST */}
      <div className="lg:col-span-2 flex flex-col space-y-4">
        {/* TOOLBAR: Search, Filter, Sort, Batch Actions */}
        <div className="bg-card/50 border border-border/40 rounded-xl p-4 space-y-3 hover:border-border/80 transition-colors">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search */}
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search description, category, tags..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-background/50 border-border/40 rounded-lg text-xs font-mono focus-visible:ring-primary/45"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 hover:text-foreground text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Toolbar Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              {/* Filter Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 border-border/40 rounded-lg text-xs flex items-center gap-1.5 bg-background/30 hover:bg-background/80 font-mono">
                    <Filter className="h-3.5 w-3.5" />
                    <span>Filter</span>
                    {(statusFilter !== 'all' || categoryFilter !== 'all' || accountFilter !== 'all') && (
                      <span className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 bg-card border border-border/60 rounded-xl p-4 shadow-xl space-y-4 z-50 font-mono">
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">Status</h4>
                    <Select value={statusFilter} onValueChange={(val: 'all' | 'pending' | 'reviewed') => setStatusFilter(val)}>
                      <SelectTrigger className="h-8 bg-background/50 border-border/40 rounded-lg text-xs font-mono">
                        <SelectValue placeholder="All status" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/40 z-[60] font-mono">
                        <SelectItem value="all" className="text-xs font-mono">All Review Status</SelectItem>
                        <SelectItem value="pending" className="text-xs font-mono">To Review (Pending)</SelectItem>
                        <SelectItem value="reviewed" className="text-xs font-mono">Reviewed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">Category</h4>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="h-8 bg-background/50 border-border/40 rounded-lg text-xs font-mono">
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/40 z-[60] font-mono">
                        <SelectItem value="all" className="text-xs font-mono">All Categories</SelectItem>
                        {Array.from(new Set(transactions.map(t => t.category))).filter(Boolean).map(cat => (
                          <SelectItem key={cat} value={cat} className="text-xs font-mono">{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">Account</h4>
                    <Select value={accountFilter} onValueChange={setAccountFilter}>
                      <SelectTrigger className="h-8 bg-background/50 border-border/40 rounded-lg text-xs font-mono">
                        <SelectValue placeholder="All accounts" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/40 z-[60] font-mono">
                        <SelectItem value="all" className="text-xs font-mono">All Accounts</SelectItem>
                        {bankAccounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id} className="text-xs font-mono">
                            {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStatusFilter('all');
                        setCategoryFilter('all');
                        setAccountFilter('all');
                      }}
                      className="text-xs h-7 text-muted-foreground hover:text-foreground"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Sort Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 border-border/40 rounded-lg text-xs flex items-center gap-1.5 bg-background/30 hover:bg-background/80 font-mono">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Sort</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border/60 rounded-xl z-50 font-mono">
                  <DropdownMenuItem className="text-xs cursor-pointer font-mono" onClick={() => setSortOrder('date-desc')}>
                    Newest Date
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs cursor-pointer font-mono" onClick={() => setSortOrder('date-asc')}>
                    Oldest Date
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs cursor-pointer font-mono" onClick={() => setSortOrder('amount-desc')}>
                    Highest Amount
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs cursor-pointer font-mono" onClick={() => setSortOrder('amount-asc')}>
                    Lowest Amount
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Add Single Transaction */}
              <Button
                size="sm"
                onClick={() => setIsAddOpen(true)}
                className="h-9 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs flex items-center gap-1.5 px-3 font-mono"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add</span>
              </Button>

              {/* Export CSV */}
              <Button variant="outline" size="sm" className="h-9 border-border/40 rounded-lg text-xs bg-background/30 hover:bg-background/80 p-2.5 font-mono" onClick={handleExportCSV}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Review progress. The alerts engine nags about unreviewed
              transactions on Home; this is where you can see the number move.
              Hidden once the queue is empty -- a full bar every day is noise. */}
          {reviewProgress.remaining > 0 && (
            <div className="flex items-center gap-3 font-mono">
              <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-positive rounded-full transition-[width] duration-300"
                  style={{ width: `${reviewProgress.percent}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                {reviewProgress.reviewed} of {reviewProgress.total} reviewed
              </span>
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
                className={cn(
                  "text-xs shrink-0 rounded-md border px-2 py-0.5 transition-colors",
                  statusFilter === 'pending'
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border/80"
                )}
              >
                {reviewProgress.remaining} left
              </button>
            </div>
          )}

          {/* Batch Actions Bar (Rendered when 1+ checkboxes selected) */}
          {selectedTxIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 bg-muted/20 border border-border/40 rounded-lg p-2.5 px-3 animate-in fade-in slide-in-from-top-2 duration-200 font-mono">
              <span className="text-xs text-muted-foreground font-semibold">
                {selectedTxIds.size} transaction{selectedTxIds.size > 1 ? 's' : ''} selected:
              </span>
              <div className="flex items-center gap-1.5 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkReview(true)}
                  className="h-7 rounded-lg text-xs border-primary/10 bg-background/30 text-foreground flex items-center gap-1"
                >
                  <Check className="h-3 w-3 text-positive" />
                  Mark Reviewed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkReview(false)}
                  className="h-7 rounded-lg text-xs border-primary/10 bg-background/30 text-foreground flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3 text-chart-4" />
                  Mark Pending
                </Button>

                {/* Bulk Category Assign */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-lg text-xs border-primary/10 bg-background/30 text-foreground flex items-center gap-1"
                    >
                      <span>Category</span>
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-56 overflow-y-auto bg-card border-primary/15 z-50">
                    {allCategoryOptions.map(opt => (
                      <DropdownMenuItem
                        key={opt.id}
                        className="text-xs cursor-pointer"
                        onClick={() => handleBulkCategory(opt.name)}
                      >
                        {opt.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkDelete}
                  className="h-7 rounded-lg text-xs border-destructive/20 bg-destructive/5 hover:bg-destructive/10 text-destructive flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* LIST RENDER: Grouped by date */}
        <div className="bg-card/50 border border-border/40 rounded-xl p-4 min-h-[400px] flex flex-col justify-start hover:border-border/80 transition-colors">
          {groupedTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 my-auto">
              <div className="p-3 bg-muted/20 rounded-xl border border-border/30">
                <AlertCircle className="h-7 w-7 text-muted-foreground/60" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">No transactions found</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  We couldn't find any transactions matching your current filters. Try relaxing filters or search.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-primary/15 rounded-lg text-xs"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setCategoryFilter('all');
                  setAccountFilter('all');
                }}
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            /* The list scrolls inside its own pane rather than growing the
               surface, so the detail panel beside it stays in view whatever
               the transaction count (REHAUL_PLAN.md 7.C). */
            <div ref={listRef} className="space-y-6 max-h-[calc(100vh-22rem)] overflow-y-auto pr-1">
              {/* Select All Bar */}
              <div className="flex items-center px-4 py-1.5 border-b border-border/20 text-xs text-muted-foreground font-semibold">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={
                      filteredTransactions.length > 0 &&
                      filteredTransactions.every(tx => selectedTxIds.has(tx.id))
                    }
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    className="h-3.5 w-3.5 rounded border-primary/30"
                  />
                  <span>SELECT ALL ON PAGE</span>
                  {/* The shortcuts are worthless if nobody knows they exist,
                      and a help dialog nobody opens is the same as no help. */}
                  <span className="hidden lg:flex items-center gap-1 font-normal normal-case tracking-normal">
                    {[
                      ['J', 'K'],
                      ['R'],
                      ['X'],
                    ].map((keys, i) => (
                      <span key={keys.join('')} className="flex items-center gap-1">
                        {i > 0 && <span className="text-border">·</span>}
                        {keys.map(k => (
                          <kbd
                            key={k}
                            className="rounded border border-border/50 bg-muted/40 px-1 text-xs leading-4 text-muted-foreground"
                          >
                            {k}
                          </kbd>
                        ))}
                        <span>{['move', 'review', 'select'][i]}</span>
                      </span>
                    ))}
                  </span>
                </div>
                <div className="ml-auto flex gap-4 pr-1">
                  <span>CATEGORY</span>
                  <span className="w-16 text-right">AMOUNT</span>
                </div>
              </div>

              {groupedTransactions.map(({ date, list }) => (
                <div key={date} className="space-y-2">
                  {/* Group Date Header */}
                  <h4 className="text-xs font-sans font-bold tracking-wider text-muted-foreground px-4 py-1">
                    {date}
                  </h4>

                  {/* Group List */}
                  <div className="space-y-1.5">
                    {list.map(tx => {
                      const isSelected = selectedTxId === tx.id;
                      const isChecked = selectedTxIds.has(tx.id);
                      const accInfo = getAccountInfo(tx.bankAccountId || tx.accountId);
                      const goalInfo = getGoalInfo(tx.goalId);
                      const isIncome = tx.amount < 0;

                      return (
                        <div
                          key={tx.id}
                          data-tx-row={tx.id}
                          className={cn(
                            "flex items-center p-2.5 rounded-lg border border-transparent transition-all cursor-pointer select-none font-mono",
                            isSelected
                              // The cursor doubles as the keyboard position, so
                              // it needs to be findable at a glance from
                              // anywhere in a long list -- hence the ring, not
                              // just a background shift.
                              ? "bg-card/90 border-border/70 shadow-sm ring-1 ring-primary/40"
                              : "bg-card/30 hover:bg-card/60 hover:border-border/40"
                          )}
                          onClick={() => setSelectedTxId(tx.id)}
                        >
                          {/* Left Elements */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div onClick={e => e.stopPropagation()} className="flex items-center">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => handleSelectRow(tx.id, !!checked)}
                                className="h-3.5 w-3.5 rounded border-primary/30"
                              />
                            </div>

                            <div className="w-1.5 flex justify-center shrink-0">
                              {!tx.isReviewed && (
                                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--chart-3))] animate-pulse" />
                              )}
                            </div>

                            <div className={cn(
                              "h-8 w-8 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs uppercase shadow-sm border",
                              isIncome
                                ? "bg-positive/10 text-positive border-positive/20"
                                : "bg-destructive/10 text-destructive border-destructive/20"
                            )}>
                              {tx.category ? tx.category.charAt(0) : 'T'}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs font-semibold text-foreground truncate block">
                                  {tx.name}
                                </span>
                                {accInfo && (
                                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/40 border border-border/40 px-2 py-0.5 rounded-md shrink-0 font-medium">
                                    <span>{accInfo.emoji || (accInfo.type === 'credit' ? '💳' : '🏦')}</span>
                                    <span className="truncate max-w-[110px]">{accInfo.name}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Elements */}
                          <div className="flex items-center gap-4 shrink-0">
                            {goalInfo && (
                              <div className="hidden md:flex items-center gap-1 text-xs bg-primary/5 text-primary border border-primary/15 px-2 py-0.5 rounded-full font-medium">
                                <span className="text-xs">{goalInfo.emoji || '🎯'}</span>
                                <span className="truncate max-w-[80px]">{goalInfo.name}</span>
                              </div>
                            )}

                            {tx.category && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs font-medium tracking-wide uppercase px-2 py-0.5 border rounded-full font-mono",
                                  getCategoryColor(tx.category)
                                )}
                              >
                                {tx.category}
                              </Badge>
                            )}

                            <div className={cn(
                              "text-xs font-mono font-semibold text-right min-w-[70px]",
                              isIncome ? "text-positive" : "text-destructive"
                            )}>
                              {isIncome ? '+' : '-'}{formatGBP(Math.abs(tx.amount))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SECTION: TRANSACTION DETAILS PANEL */}
      <div className="flex flex-col space-y-4">
        <div className="bg-card/50 border border-border/40 rounded-xl p-5 min-h-[500px] hover:border-border/80 transition-colors">
          {selectedTx ? (
            <div className="space-y-6">
              {/* Detail Panel Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border/20">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>REGULAR TRANSACTION</span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Review Button */}
                  <Button
                    size="sm"
                    variant={selectedTx.isReviewed ? "default" : "outline"}
                    onClick={() => handleToggleReviewSingle(selectedTx.id)}
                    className={cn(
                      "h-7 rounded-lg text-xs flex items-center gap-1 border font-medium",
                      selectedTx.isReviewed
                        ? "bg-positive/10 text-positive border-positive/20 hover:bg-positive/20"
                        : "border-primary/15 text-muted-foreground hover:bg-primary/5"
                    )}
                  >
                    <Check className="h-3 w-3" />
                    <span>{selectedTx.isReviewed ? 'Reviewed' : 'Mark Reviewed'}</span>
                  </Button>

                  {/* Delete Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteSingle(selectedTx.id)}
                    className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Title & Amount inline editor */}
              <div className="space-y-2">
                <Input
                  value={selectedTx.name}
                  onChange={e => updateSelectedField('name', e.target.value)}
                  className="text-lg font-bold bg-transparent border-transparent hover:border-border/40 focus:border-border/60 p-0 h-auto focus-visible:ring-0 text-foreground cursor-text"
                />

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-sm text-muted-foreground font-mono">£</span>
                  <Input
                    type="number"
                    value={Math.abs(selectedTx.amount).toString()}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      const multiplier = selectedTx.amount < 0 ? -1 : 1;
                      updateSelectedField('amount', val * multiplier);
                    }}
                    className="text-2xl font-mono font-semibold bg-transparent border-transparent hover:border-border/40 focus:border-border/60 p-0 h-auto w-32 focus-visible:ring-0 text-foreground cursor-text"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => updateSelectedField('amount', -selectedTx.amount)}
                    className={cn(
                      "h-7 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors font-mono",
                      selectedTx.amount < 0
                        ? "bg-positive/10 text-positive border-positive/30 hover:bg-positive/20"
                        : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                    )}
                  >
                    {selectedTx.amount < 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    <span>{selectedTx.amount < 0 ? '+ Income / Gain' : '- Spending / Expense'}</span>
                  </Button>
                </div>
              </div>

              {/* Details Form Grid */}
              <div className="space-y-4 pt-2 font-mono">
                {/* Category */}
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label className="text-xs text-muted-foreground font-mono">Category</Label>
                  <div className="col-span-2">
                    <Select
                      value={selectedTx.category}
                      onValueChange={(val) => updateSelectedField('category', val)}
                    >
                      <SelectTrigger className="h-9 bg-background/50 border-border/40 rounded-lg text-xs font-mono">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64 overflow-y-auto bg-card border-border/40 z-50 font-mono">
                        {allCategoryOptions.map(opt => (
                          <SelectItem key={opt.id} value={opt.name} className="text-xs font-mono">
                            <span className="text-xs text-muted-foreground mr-1.5">[{opt.group}]</span>
                            {opt.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="Other" className="text-xs font-mono">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Account */}
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label className="text-xs text-muted-foreground font-mono">Account</Label>
                  <div className="col-span-2">
                    <Select
                      value={selectedTx.bankAccountId || selectedTx.accountId || 'none'}
                      onValueChange={(val) => {
                        const targetId = val === 'none' ? undefined : val;
                        onUpdateTransactions(transactions.map(tx => {
                          if (tx.id === selectedTx.id) {
                            return { ...tx, bankAccountId: targetId, accountId: targetId };
                          }
                          return tx;
                        }));
                      }}
                    >
                      <SelectTrigger className="h-9 bg-background/50 border-border/40 rounded-lg text-xs font-mono">
                        <SelectValue placeholder="No account linked" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/40 z-50 font-mono">
                        <SelectItem value="none" className="text-xs font-mono">No account linked</SelectItem>
                        {bankAccounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id} className="text-xs font-mono">
                            <span className="mr-1">{acc.emoji || (acc.type === 'credit' ? '💳' : '🏦')}</span>
                            {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Goal */}
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label className="text-xs text-muted-foreground font-mono">Savings Goal</Label>
                  <div className="col-span-2">
                    <Select
                      value={selectedTx.goalId || 'none'}
                      onValueChange={(val) => updateSelectedField('goalId', val === 'none' ? undefined : val)}
                    >
                      <SelectTrigger className="h-9 bg-background/50 border-border/40 rounded-lg text-xs font-mono">
                        <SelectValue placeholder="Link to savings goal" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border/40 z-50 font-mono">
                        <SelectItem value="none" className="text-xs font-mono">No goal linked</SelectItem>
                        {goals.map(g => (
                          <SelectItem key={g.id} value={g.id} className="text-xs font-mono">
                            {/* The goal's own emoji, as the transaction row
                                shows it -- a hardcoded target made every goal
                                in the picker look identical. */}
                            {g.emoji || '🎯'} {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-mono">Notes</Label>
                  <Textarea
                    placeholder="Add notes about this transaction..."
                    value={selectedTx.notes || ''}
                    onChange={e => updateSelectedField('notes', e.target.value || undefined)}
                    className="min-h-[80px] bg-background/50 border-border/40 rounded-lg text-xs font-mono placeholder:text-muted-foreground/50 focus-visible:ring-primary/45"
                  />
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-mono">Tags</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedTx.tags || []).map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-xs bg-muted/30 text-foreground border border-border/30 px-2 py-0.5 rounded font-mono"
                      >
                        <Tag className="h-2 w-2 text-muted-foreground" />
                        <span>{tag}</span>
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-destructive font-bold ml-0.5"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <Input
                      placeholder="+ Add tag (Enter)"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleAddTag(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                      className="h-6 w-24 bg-background/30 border-border/40 rounded-lg text-xs font-mono px-2 py-0"
                    />
                  </div>
                </div>
              </div>

              {/* Similar Transactions */}
              <div className="pt-4 border-t border-border/20 space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                    Similar Transactions
                  </h4>
                  <span className="text-xs text-muted-foreground font-mono font-semibold">
                    {similarTransactionsInfo.monthLabel}: {formatGBP(similarTransactionsInfo.monthlySum)} ({similarTransactionsInfo.overallCount})
                  </span>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {similarTransactionsInfo.list.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-1 font-mono">
                      No previous transactions found for this merchant.
                    </p>
                  ) : (
                    similarTransactionsInfo.list.map(match => (
                      <div key={match.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/20">
                        <div className="space-y-0.5">
                          <span className="text-xs font-semibold text-foreground block">
                            {new Date(match.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            {getAccountInfo(match.bankAccountId)?.name || 'Credit Card'}
                            {match.category && (
                              <>
                                <span>·</span>
                                <span className="text-primary">{match.category}</span>
                              </>
                            )}
                          </span>
                        </div>
                        <span className={cn(
                          "text-xs font-mono font-semibold",
                          match.amount < 0 ? "text-positive" : "text-destructive"
                        )}>
                          {match.amount < 0 ? '+' : '-'}{formatGBP(Math.abs(match.amount))}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="p-3 bg-muted/20 rounded-xl border border-border/30">
                <FileText className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground font-mono">No transaction selected</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto font-mono">
                  Select any transaction from the list on the left to review details, change tags, link goals or view transaction history.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DIALOG: ADD TRANSACTION MANUALLY */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:rounded-xl border border-border/40 bg-card font-mono max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground font-mono">Add New Transaction</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">
              Manually create a transaction for your ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Transaction Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={newTxType === 'expense' ? 'default' : 'outline'}
                  onClick={() => setNewTxType('expense')}
                  className={cn(
                    "h-9 rounded-xl text-xs font-semibold gap-1.5 transition-colors",
                    newTxType === 'expense'
                      ? "bg-destructive hover:bg-destructive text-white"
                      : "border-primary/15 text-muted-foreground hover:bg-primary/5"
                  )}
                >
                  <TrendingDown className="h-3.5 w-3.5" />
                  <span>Spending (- Out)</span>
                </Button>
                <Button
                  type="button"
                  variant={newTxType === 'income' ? 'default' : 'outline'}
                  onClick={() => setNewTxType('income')}
                  className={cn(
                    "h-9 rounded-xl text-xs font-semibold gap-1.5 transition-colors",
                    newTxType === 'income'
                      ? "bg-positive hover:bg-positive text-white"
                      : "border-primary/15 text-muted-foreground hover:bg-primary/5"
                  )}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Income (+ In)</span>
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-mono text-muted-foreground">Merchant / Description</Label>
              <Input
                placeholder="e.g. Juice Press, Shell, Whole Foods"
                value={newTxName}
                onChange={e => setNewTxName(e.target.value)}
                className="bg-background/50 border-border/40 rounded-lg text-xs h-9 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-mono text-muted-foreground">Amount (£)</Label>
                <Input
                  type="number"
                  placeholder="10.00"
                  value={newTxAmount}
                  onChange={e => setNewTxAmount(e.target.value)}
                  className="bg-background/50 border-border/40 rounded-lg text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1 flex flex-col justify-start">
                <Label className="text-xs font-mono text-muted-foreground mb-1">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 justify-start text-left font-normal border-border/40 rounded-lg text-xs bg-background/50 hover:bg-background/80 w-full font-mono",
                        !newTxDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      {newTxDate ? newTxDate.toLocaleDateString('en-GB') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-card border-border/60 rounded-xl z-[60] font-mono" align="start">
                    <Calendar
                      mode="single"
                      selected={newTxDate}
                      onSelect={(day) => day && setNewTxDate(day)}
                      initialFocus
                      className="bg-card border-none text-xs font-mono"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-mono text-muted-foreground">Category</Label>
                <Select value={newTxCategory} onValueChange={setNewTxCategory}>
                  <SelectTrigger className="bg-background/50 border-border/40 rounded-lg text-xs h-9 font-mono">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/40 z-[60] max-h-48 overflow-y-auto font-mono">
                    {allCategoryOptions.map(opt => (
                      <SelectItem key={opt.id} value={opt.name} className="text-xs font-mono">
                        {opt.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="Other" className="text-xs font-mono">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-mono text-muted-foreground">Account</Label>
                <Select value={newTxAccount} onValueChange={setNewTxAccount}>
                  <SelectTrigger className="bg-background/50 border-border/40 rounded-lg text-xs h-9 font-mono">
                    <SelectValue placeholder="No account" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/40 z-[60] font-mono">
                    {bankAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id} className="text-xs font-mono">
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-mono text-muted-foreground">Savings Goal Link (Optional)</Label>
              <Select value={newTxGoal} onValueChange={setNewTxGoal}>
                <SelectTrigger className="bg-background/50 border-border/40 rounded-lg text-xs h-9 font-mono">
                  <SelectValue placeholder="Not linked to goal" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border/40 z-[60] font-mono">
                  {goals.map(g => (
                    <SelectItem key={g.id} value={g.id} className="text-xs font-mono">
                      {g.emoji || '🎯'} {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-mono text-muted-foreground">Notes</Label>
              <Textarea
                placeholder="Write notes here..."
                value={newTxNotes}
                onChange={e => setNewTxNotes(e.target.value)}
                className="bg-background/50 border-border/40 rounded-lg text-xs min-h-[60px] font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-mono text-muted-foreground">Tags (comma separated)</Label>
              <Input
                placeholder="e.g. food, holiday, subaru"
                value={newTxTags}
                onChange={e => setNewTxTags(e.target.value)}
                className="bg-background/50 border-border/40 rounded-lg text-xs h-9 font-mono"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAddOpen(false)}
              className="text-xs h-8 px-3 rounded-lg font-mono"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddTransaction}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 rounded-lg px-4 font-mono"
              disabled={!newTxName.trim() || !newTxAmount}
            >
              Add Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deleteDialog}
    </div>
  );
};

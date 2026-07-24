import React, { useState, useMemo, useEffect } from 'react';
import { MockTransaction, BankAccount, Goal, BudgetCategory } from '@/types/finance';
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
      return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    }
    if (catLower.includes('shopping') || catLower.includes('wardrobe') || catLower.includes('clothes')) {
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    }
    if (catLower.includes('gas') || catLower.includes('transport') || catLower.includes('car') || catLower.includes('travel')) {
      return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
    }
    if (catLower.includes('internet') || catLower.includes('utilities') || catLower.includes('bills')) {
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    }
    if (catLower.includes('rent') || catLower.includes('housing') || catLower.includes('home')) {
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    }
    if (catLower.includes('savings') || catLower.includes('investment') || catLower.includes('interest')) {
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
    if (catLower.includes('groceries')) {
      return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
    }
    return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
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
  const updateSelectedField = (field: keyof MockTransaction, value: any) => {
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
  const handleToggleReviewSingle = (id: string) => {
    const updated = transactions.map(tx =>
      tx.id === id ? { ...tx, isReviewed: !tx.isReviewed } : tx
    );
    onUpdateTransactions(updated);
  };

  const handleDeleteSingle = (id: string) => {
    const updated = transactions.filter(tx => tx.id !== id);
    onUpdateTransactions(updated);
    if (selectedTxId === id) {
      setSelectedTxId(null);
    }
  };

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

  const handleBulkDelete = () => {
    const updated = transactions.filter(tx => !selectedTxIds.has(tx.id));
    onUpdateTransactions(updated);
    setSelectedTxIds(new Set());
  };

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
        <div className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-2xl p-4 space-y-3 shadow-lg">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search */}
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search description, category, tags..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-background/50 border-primary/15 rounded-xl text-xs focus-visible:ring-primary/45"
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
                  <Button variant="outline" size="sm" className="h-9 border-primary/15 rounded-xl text-xs flex items-center gap-1.5 bg-background/30 hover:bg-background/80">
                    <Filter className="h-3.5 w-3.5" />
                    <span>Filter</span>
                    {(statusFilter !== 'all' || categoryFilter !== 'all' || accountFilter !== 'all') && (
                      <span className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 bg-card/95 backdrop-blur-md border border-primary/15 rounded-2xl p-4 shadow-xl space-y-4 z-50">
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Status</h4>
                    <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                      <SelectTrigger className="h-8 bg-background/50 border-primary/15 rounded-lg text-xs">
                        <SelectValue placeholder="All status" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-primary/15 z-[60]">
                        <SelectItem value="all" className="text-xs">All Review Status</SelectItem>
                        <SelectItem value="pending" className="text-xs">To Review (Pending)</SelectItem>
                        <SelectItem value="reviewed" className="text-xs">Reviewed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Category</h4>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="h-8 bg-background/50 border-primary/15 rounded-lg text-xs">
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-primary/15 z-[60]">
                        <SelectItem value="all" className="text-xs">All Categories</SelectItem>
                        {Array.from(new Set(transactions.map(t => t.category))).filter(Boolean).map(cat => (
                          <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Account</h4>
                    <Select value={accountFilter} onValueChange={setAccountFilter}>
                      <SelectTrigger className="h-8 bg-background/50 border-primary/15 rounded-lg text-xs">
                        <SelectValue placeholder="All accounts" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-primary/15 z-[60]">
                        <SelectItem value="all" className="text-xs">All Accounts</SelectItem>
                        {bankAccounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id} className="text-xs">
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
                      className="text-[10px] h-7 text-muted-foreground hover:text-foreground"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Sort Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 border-primary/15 rounded-xl text-xs flex items-center gap-1.5 bg-background/30 hover:bg-background/80">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Sort</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card/95 border-primary/15 rounded-xl z-50">
                  <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setSortOrder('date-desc')}>
                    Newest Date
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setSortOrder('date-asc')}>
                    Oldest Date
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setSortOrder('amount-desc')}>
                    Highest Amount
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setSortOrder('amount-asc')}>
                    Lowest Amount
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Add Transaction Button */}
              <Button size="sm" className="h-9 rounded-xl text-xs bg-primary hover:bg-primary/95 text-primary-foreground gap-1" onClick={() => setIsAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Transaction</span>
              </Button>

              {/* Export Button */}
              <Button variant="outline" size="sm" className="h-9 border-primary/15 rounded-xl text-xs bg-background/30 hover:bg-background/80 p-2.5" onClick={handleExportCSV}>
                <Download className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </Button>
            </div>
          </div>

          {/* Batch operations when checklist is selected */}
          {selectedTxIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl p-2.5 px-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <span className="text-[11px] text-muted-foreground font-semibold">
                {selectedTxIds.size} transaction{selectedTxIds.size > 1 ? 's' : ''} selected:
              </span>
              <div className="flex items-center gap-1.5 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkReview(true)}
                  className="h-7 rounded-lg text-[10px] border-primary/10 bg-background/30 text-foreground flex items-center gap-1"
                >
                  <Check className="h-3 w-3 text-emerald-400" />
                  Mark Reviewed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkReview(false)}
                  className="h-7 rounded-lg text-[10px] border-primary/10 bg-background/30 text-foreground flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3 text-amber-400" />
                  Mark Pending
                </Button>

                {/* Bulk Category Assign */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-lg text-[10px] border-primary/10 bg-background/30 text-foreground flex items-center gap-1"
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
                  className="h-7 rounded-lg text-[10px] border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* LIST RENDER: Grouped by date */}
        <div className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-4 shadow-xl min-h-[400px] flex flex-col justify-start">
          {groupedTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 my-auto">
              <div className="p-4 bg-primary/5 rounded-full border border-primary/10">
                <AlertCircle className="h-8 w-8 text-muted-foreground/60" />
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
            <div className="space-y-6">
              {/* Select All Bar */}
              <div className="flex items-center px-4 py-1.5 border-b border-border/20 text-[10px] text-muted-foreground font-semibold">
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
                </div>
                <div className="ml-auto flex gap-4 pr-1">
                  <span>CATEGORY</span>
                  <span className="w-16 text-right">AMOUNT</span>
                </div>
              </div>

              {groupedTransactions.map(({ date, list }) => (
                <div key={date} className="space-y-2">
                  {/* Group Date Header */}
                  <h4 className="text-[10px] font-sans font-bold tracking-wider text-muted-foreground px-4 py-1">
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
                          className={cn(
                            "flex items-center p-3 rounded-2xl border border-transparent transition-all cursor-pointer select-none",
                            isSelected
                              ? "bg-primary/10 border-primary/20 shadow-md"
                              : "bg-background/20 hover:bg-background/40 hover:border-primary/10"
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
                                <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
                              )}
                            </div>

                            <div className={cn(
                              "h-8 w-8 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs uppercase shadow-sm border",
                              isIncome
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20"
                            )}>
                              {tx.category ? tx.category.charAt(0) : 'T'}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs font-semibold text-foreground truncate block">
                                  {tx.name}
                                </span>
                                {accInfo && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/40 border border-border/40 px-2 py-0.5 rounded-md shrink-0 font-medium">
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
                              <div className="hidden md:flex items-center gap-1 text-[9px] bg-primary/5 text-primary border border-primary/15 px-2 py-0.5 rounded-full font-medium">
                                <span className="text-[10px]">{goalInfo.emoji || '🎯'}</span>
                                <span className="truncate max-w-[80px]">{goalInfo.name}</span>
                              </div>
                            )}

                            {tx.category && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[9px] font-medium tracking-wide uppercase px-2 py-0.5 border rounded-full font-mono",
                                  getCategoryColor(tx.category)
                                )}
                              >
                                {tx.category}
                              </Badge>
                            )}

                            <div className={cn(
                              "text-xs font-mono font-semibold text-right min-w-[70px]",
                              isIncome ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
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
        <div className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-3xl p-5 shadow-xl min-h-[500px]">
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
                      "h-7 rounded-lg text-[10px] flex items-center gap-1 border font-medium",
                      selectedTx.isReviewed
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
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
                    className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
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
                  className="text-lg font-bold bg-transparent border-transparent hover:border-primary/15 focus:border-primary/30 p-0 h-auto focus-visible:ring-0 text-foreground cursor-text"
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
                    className="text-2xl font-mono font-semibold bg-transparent border-transparent hover:border-primary/15 focus:border-primary/30 p-0 h-auto w-32 focus-visible:ring-0 text-foreground cursor-text"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => updateSelectedField('amount', -selectedTx.amount)}
                    className={cn(
                      "h-7 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 border transition-colors",
                      selectedTx.amount < 0
                        ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                        : "bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                    )}
                  >
                    {selectedTx.amount < 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    <span>{selectedTx.amount < 0 ? '+ Income / Gain' : '- Spending / Expense'}</span>
                  </Button>
                </div>
              </div>

              {/* Details Form Grid */}
              <div className="space-y-4 pt-2">
                {/* Category */}
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <div className="col-span-2">
                    <Select
                      value={selectedTx.category}
                      onValueChange={(val) => updateSelectedField('category', val)}
                    >
                      <SelectTrigger className="h-9 bg-background/50 border-primary/15 rounded-xl text-xs">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64 overflow-y-auto bg-card border-primary/15 z-50">
                        {allCategoryOptions.map(opt => (
                          <SelectItem key={opt.id} value={opt.name} className="text-xs">
                            <span className="text-[10px] text-muted-foreground mr-1.5">[{opt.group}]</span>
                            {opt.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="Other" className="text-xs">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Account */}
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label className="text-xs text-muted-foreground">Account</Label>
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
                      <SelectTrigger className="h-9 bg-background/50 border-primary/15 rounded-xl text-xs">
                        <SelectValue placeholder="No account linked" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-primary/15 z-50">
                        <SelectItem value="none" className="text-xs">No account linked</SelectItem>
                        {bankAccounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id} className="text-xs">
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
                  <Label className="text-xs text-muted-foreground">Savings Goal</Label>
                  <div className="col-span-2">
                    <Select
                      value={selectedTx.goalId || 'none'}
                      onValueChange={(val) => updateSelectedField('goalId', val === 'none' ? undefined : val)}
                    >
                      <SelectTrigger className="h-9 bg-background/50 border-primary/15 rounded-xl text-xs">
                        <SelectValue placeholder="Link to savings goal" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-primary/15 z-50">
                        <SelectItem value="none" className="text-xs">No goal linked</SelectItem>
                        {goals.map(g => (
                          <SelectItem key={g.id} value={g.id} className="text-xs">
                            🎯 {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <Textarea
                    placeholder="Add notes about this transaction..."
                    value={selectedTx.notes || ''}
                    onChange={e => updateSelectedField('notes', e.target.value || undefined)}
                    className="min-h-[80px] bg-background/50 border-primary/15 rounded-xl text-xs placeholder:text-muted-foreground/50 focus-visible:ring-primary/45"
                  />
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tags</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedTx.tags || []).map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-[9px] bg-primary/5 text-primary border border-primary/15 px-2 py-0.5 rounded-full font-medium"
                      >
                        <Tag className="h-2 w-2 text-primary/75" />
                        <span>{tag}</span>
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-rose-500 font-bold ml-0.5"
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
                      className="h-6 w-24 bg-background/30 border-primary/10 rounded-lg text-[9px] px-2 py-0"
                    />
                  </div>
                </div>
              </div>

              {/* Similar Transactions */}
              <div className="pt-4 border-t border-border/20 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Similar Transactions
                  </h4>
                  <span className="text-[10px] text-muted-foreground font-mono font-semibold">
                    {similarTransactionsInfo.monthLabel}: {formatGBP(similarTransactionsInfo.monthlySum)} ({similarTransactionsInfo.overallCount})
                  </span>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {similarTransactionsInfo.list.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground italic py-1">
                      No previous transactions found for this merchant.
                    </p>
                  ) : (
                    similarTransactionsInfo.list.map(match => (
                      <div key={match.id} className="flex items-center justify-between p-2 rounded-xl bg-background/25 border border-transparent hover:border-primary/5">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-semibold text-foreground block">
                            {new Date(match.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-[9px] text-muted-foreground flex items-center gap-1">
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
                          "text-[10px] font-mono font-semibold",
                          match.amount < 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"
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
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
              <div className="p-4 bg-primary/5 rounded-full border border-primary/10">
                <SlidersHorizontal className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">No transaction selected</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Select any transaction from the list on the left to review details, change tags, link goals or view transaction history.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DIALOG: ADD TRANSACTION MANUALLY */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-card border border-primary/15 rounded-3xl p-6 shadow-2xl z-50 max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Add New Transaction</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
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
                      ? "bg-rose-500 hover:bg-rose-600 text-white"
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
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                      : "border-primary/15 text-muted-foreground hover:bg-primary/5"
                  )}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Income (+ In)</span>
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Merchant / Description</Label>
              <Input
                placeholder="e.g. Juice Press, Shell, Whole Foods"
                value={newTxName}
                onChange={e => setNewTxName(e.target.value)}
                className="bg-background/50 border-primary/15 rounded-xl text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Amount (£)</Label>
                <Input
                  type="number"
                  placeholder="10.00"
                  value={newTxAmount}
                  onChange={e => setNewTxAmount(e.target.value)}
                  className="bg-background/50 border-primary/15 rounded-xl text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1.5 flex flex-col justify-start">
                <Label className="text-xs text-muted-foreground mb-1">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 justify-start text-left font-normal border-primary/15 rounded-xl text-xs bg-background/50 hover:bg-background/80 w-full",
                        !newTxDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      {newTxDate ? newTxDate.toLocaleDateString('en-GB') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-card border-primary/15 rounded-2xl z-[60]" align="start">
                    <Calendar
                      mode="single"
                      selected={newTxDate}
                      onSelect={(day) => day && setNewTxDate(day)}
                      initialFocus
                      className="bg-card border-none text-xs"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select value={newTxCategory} onValueChange={setNewTxCategory}>
                  <SelectTrigger className="bg-background/50 border-primary/15 rounded-xl text-xs h-9">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-primary/15 z-[60] max-h-48 overflow-y-auto">
                    {allCategoryOptions.map(opt => (
                      <SelectItem key={opt.id} value={opt.name} className="text-xs">
                        {opt.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="Other" className="text-xs">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Account</Label>
                <Select value={newTxAccount} onValueChange={setNewTxAccount}>
                  <SelectTrigger className="bg-background/50 border-primary/15 rounded-xl text-xs h-9">
                    <SelectValue placeholder="No account" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-primary/15 z-[60]">
                    {bankAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id} className="text-xs">
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Savings Goal Link (Optional)</Label>
              <Select value={newTxGoal} onValueChange={setNewTxGoal}>
                <SelectTrigger className="bg-background/50 border-primary/15 rounded-xl text-xs h-9">
                  <SelectValue placeholder="Not linked to goal" />
                </SelectTrigger>
                <SelectContent className="bg-card border-primary/15 z-[60]">
                  {goals.map(g => (
                    <SelectItem key={g.id} value={g.id} className="text-xs">
                      🎯 {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Textarea
                placeholder="Write notes here..."
                value={newTxNotes}
                onChange={e => setNewTxNotes(e.target.value)}
                className="bg-background/50 border-primary/15 rounded-xl text-xs min-h-[60px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tags (comma separated)</Label>
              <Input
                placeholder="e.g. food, holiday, subaru"
                value={newTxTags}
                onChange={e => setNewTxTags(e.target.value)}
                className="bg-background/50 border-primary/15 rounded-xl text-xs h-9"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAddOpen(false)}
              className="text-xs h-9 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddTransaction}
              className="bg-primary hover:bg-primary/95 text-primary-foreground text-xs h-9 rounded-xl px-4"
              disabled={!newTxName.trim() || !newTxAmount}
            >
              Add Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

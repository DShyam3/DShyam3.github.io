import React from 'react';
import { BankAccount, BudgetCategory, RecurringBill } from '@/features/finance/finance-types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EditRecurringDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeRecurring: RecurringBill | null;
  setActiveRecurring: React.Dispatch<React.SetStateAction<RecurringBill | null>>;
  budgetCategories: BudgetCategory[];
  allBudgetItems: { id: string; label: string }[];
  bankAccounts: BankAccount[];
  formatGBP: (num: number) => string;
  onSave: (e: React.FormEvent) => void;
}

export const EditRecurringDialog: React.FC<EditRecurringDialogProps> = ({
  isOpen,
  onOpenChange,
  activeRecurring,
  setActiveRecurring,
  budgetCategories,
  allBudgetItems,
  bankAccounts,
  formatGBP,
  onSave,
}) => {
  if (!activeRecurring) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:rounded-xl border border-border/40 bg-card font-mono w-[calc(100vw-1.5rem)] sm:w-full max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="font-mono text-lg font-bold">Edit Recurring Bill</DialogTitle>
          <DialogDescription className="text-xs font-mono text-muted-foreground">
            Modify payment amount, schedule, linked category or bank account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSave} className="space-y-3.5 pt-2 font-mono">
          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="edit-rec-name" className="text-xs font-mono text-muted-foreground">Name</Label>
            <Input
              id="edit-rec-name"
              placeholder="e.g. Spotify Premium"
              value={activeRecurring.name}
              onChange={(e) => setActiveRecurring({ ...activeRecurring, name: e.target.value })}
              className="rounded-lg h-9 border-border/40 bg-background/50 text-xs font-mono"
              required
            />
          </div>

          {/* Grid for Emoji and Tag */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1 col-span-1">
              <Label htmlFor="edit-rec-emoji" className="text-xs font-mono text-muted-foreground">Emoji</Label>
              <Input
                id="edit-rec-emoji"
                placeholder="e.g. 🎵"
                value={activeRecurring.emoji || ''}
                onChange={(e) => setActiveRecurring({ ...activeRecurring, emoji: e.target.value })}
                className="rounded-lg h-9 border-border/40 bg-background/50 text-center text-sm font-mono"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label htmlFor="edit-rec-tag" className="text-xs font-mono text-muted-foreground">Tag / Badge Code</Label>
              <Input
                id="edit-rec-tag"
                placeholder="e.g. SPOTIFY"
                value={activeRecurring.tag || ''}
                onChange={(e) => setActiveRecurring({ ...activeRecurring, tag: e.target.value.toUpperCase() })}
                className="rounded-lg h-9 border-border/40 bg-background/50 text-xs font-mono"
              />
            </div>
          </div>

          {/* Grid for Amount, Frequency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit-rec-amount" className="text-xs font-mono text-muted-foreground">Amount (£)</Label>
              <Input
                id="edit-rec-amount"
                type="number"
                step="0.01"
                placeholder="e.g. 10.99"
                value={activeRecurring.amount}
                onChange={(e) => setActiveRecurring({ ...activeRecurring, amount: parseFloat(e.target.value) || 0 })}
                className="rounded-lg h-9 border-border/40 bg-background/50 text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-rec-frequency" className="text-xs font-mono text-muted-foreground">Frequency</Label>
              <Select
                value={activeRecurring.frequency}
                onValueChange={(val) => setActiveRecurring({ ...activeRecurring, frequency: val as RecurringBill['frequency'] })}
              >
                <SelectTrigger id="edit-rec-frequency" className="rounded-lg h-9 border-border/40 bg-background/50 text-xs font-mono">
                  <SelectValue placeholder="Select frequency..." />
                </SelectTrigger>
                <SelectContent className="rounded-lg border-border/40 font-mono">
                  <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                  <SelectItem value="weekly" className="text-xs">Weekly</SelectItem>
                  <SelectItem value="quarterly" className="text-xs">Quarterly</SelectItem>
                  <SelectItem value="annually" className="text-xs">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Grid for Month & Day */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit-rec-day" className="text-xs font-mono text-muted-foreground">Due Day of Month (1-31)</Label>
              <Input
                id="edit-rec-day"
                type="number"
                min="1"
                max="31"
                placeholder="e.g. 15"
                value={activeRecurring.dueDate || ''}
                onChange={(e) => setActiveRecurring({ ...activeRecurring, dueDate: parseInt(e.target.value, 10) || 1 })}
                className="rounded-lg h-9 border-border/40 bg-background/50 text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-rec-month" className="text-xs font-mono text-muted-foreground">Due Month</Label>
              <Select
                value={String(activeRecurring.dueMonth || 1)}
                onValueChange={(val) => setActiveRecurring({ ...activeRecurring, dueMonth: parseInt(val, 10) })}
                disabled={activeRecurring.frequency === 'monthly' || activeRecurring.frequency === 'weekly'}
              >
                <SelectTrigger id="edit-rec-month" className="rounded-lg h-9 border-border/40 bg-background/50 text-xs font-mono disabled:opacity-50">
                  <SelectValue placeholder="Select month..." />
                </SelectTrigger>
                <SelectContent className="rounded-lg border-border/40 font-mono">
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => (
                    <SelectItem key={idx} value={String(idx + 1)} className="text-xs">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* DYNAMIC Category selection */}
          <div className="space-y-1">
            <Label htmlFor="edit-rec-category" className="text-xs font-mono text-muted-foreground">Dashboard Category</Label>
            <Select
              value={activeRecurring.category || 'none'}
              onValueChange={(val) => setActiveRecurring({ ...activeRecurring, category: val === 'none' ? '' : val })}
            >
              <SelectTrigger id="edit-rec-category" className="rounded-lg h-9 border-border/40 bg-background/50 text-xs font-mono">
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-border/40 font-mono max-h-56">
                <SelectItem value="none" className="text-xs">Select category...</SelectItem>
                {budgetCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.name} className="text-xs">
                    {cat.emoji || '📂'} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Symlink: Linked Budget Item */}
          <div className="space-y-1">
            <Label htmlFor="edit-rec-link-budget" className="text-xs font-mono text-muted-foreground">Link to Budget Item</Label>
            <Select
              value={activeRecurring.linkedBudgetItemId || 'none'}
              onValueChange={(val) => setActiveRecurring({ ...activeRecurring, linkedBudgetItemId: val === 'none' ? '' : val })}
            >
              <SelectTrigger id="edit-rec-link-budget" className="rounded-lg h-9 border-border/40 bg-background/50 text-xs font-mono">
                <SelectValue placeholder="No linked budget item" />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-border/40 font-mono">
                <SelectItem value="none" className="text-xs">No linked budget item</SelectItem>
                {allBudgetItems.map(item => (
                  <SelectItem key={item.id} value={item.id} className="text-xs">
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Symlink: Linked Bank Account */}
          <div className="space-y-1">
            <Label htmlFor="edit-rec-link-account" className="text-xs font-mono text-muted-foreground">Link to Bank Account (Source for payments)</Label>
            <Select
              value={activeRecurring.linkedAccountId || 'none'}
              onValueChange={(val) => setActiveRecurring({ ...activeRecurring, linkedAccountId: val === 'none' ? '' : val })}
            >
              <SelectTrigger id="edit-rec-link-account" className="rounded-lg h-9 border-border/40 bg-background/50 text-xs font-mono">
                <SelectValue placeholder="No linked account (Manual cash payment)" />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-border/40 font-mono">
                <SelectItem value="none" className="text-xs">No linked account (Manual cash payment)</SelectItem>
                {bankAccounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id} className="text-xs">
                    {acc.name} ({acc.type} - {formatGBP(acc.balance)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-3 gap-2 sm:gap-0">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)} className="rounded-lg h-8 px-3 text-xs font-mono">Cancel</Button>
            <Button type="submit" className="rounded-lg h-8 px-3 bg-primary text-primary-foreground text-xs font-mono">Update Bill</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

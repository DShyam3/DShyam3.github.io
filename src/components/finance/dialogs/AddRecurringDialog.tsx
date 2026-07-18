import React from 'react';
import { BankAccount, BudgetCategory, RecurringTemplate } from '@/types/finance';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AddRecurringDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  newRecurring: any;
  setNewRecurring: React.Dispatch<React.SetStateAction<any>>;
  addRecTemplate: string;
  setAddRecTemplate: (val: string) => void;
  recurringTemplates: RecurringTemplate[];
  budgetCategories: BudgetCategory[];
  allBudgetItems: { id: string; label: string }[];
  bankAccounts: BankAccount[];
  formatGBP: (num: number) => string;
  onSave: (e: React.FormEvent) => void;
}

export const AddRecurringDialog: React.FC<AddRecurringDialogProps> = ({
  isOpen,
  onOpenChange,
  newRecurring,
  setNewRecurring,
  addRecTemplate,
  setAddRecTemplate,
  recurringTemplates,
  budgetCategories,
  allBudgetItems,
  bankAccounts,
  formatGBP,
  onSave,
}) => {
  const handleTemplateSelect = (val: string) => {
    setAddRecTemplate(val);
    if (val !== 'scratch') {
      const template = recurringTemplates.find(t => t.name === val);
      if (template) {
        setNewRecurring({
          name: template.name,
          category: template.category,
          emoji: template.emoji,
          tag: template.tag,
          amount: template.defaultAmount,
          dueDate: 1,
          frequency: template.frequency,
          dueMonth: 1,
          linkedBudgetItemId: template.linkedBudgetItemId || '',
          linkedAccountId: ''
        });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-primary/10 w-[calc(100vw-1.5rem)] sm:w-full max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="font-serif text-xl">Add Recurring Bill</DialogTitle>
          <DialogDescription className="text-xs">
            Add a subscription, membership, or regular bill to your recurring schedule.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSave} className="space-y-4 pt-2">
          {/* Template Selector */}
          <div className="space-y-1">
            <Label htmlFor="rec-template" className="text-xs">Preset Template</Label>
            <Select value={addRecTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger id="rec-template" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs">
                <SelectValue placeholder="Custom (Start from scratch)" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-primary/10 max-h-56">
                <SelectItem value="scratch" className="text-xs font-semibold">Custom (Start from scratch)</SelectItem>
                {recurringTemplates.map(tmpl => (
                  <SelectItem key={tmpl.name} value={tmpl.name} className="text-xs">
                    {tmpl.emoji} {tmpl.name} ({tmpl.tag})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="rec-name" className="text-xs">Name</Label>
            <Input
              id="rec-name"
              placeholder="e.g. Spotify Premium"
              value={newRecurring.name}
              onChange={(e) => setNewRecurring({ ...newRecurring, name: e.target.value })}
              className="rounded-xl h-10 border-primary/20 bg-background/50 text-sm"
              required
            />
          </div>

          {/* Grid for Emoji and Tag */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1 col-span-1">
              <Label htmlFor="rec-emoji" className="text-xs">Emoji</Label>
              <Input
                id="rec-emoji"
                placeholder="e.g. 🎵"
                value={newRecurring.emoji || ''}
                onChange={(e) => setNewRecurring({ ...newRecurring, emoji: e.target.value })}
                className="rounded-xl h-10 border-primary/20 bg-background/50 text-center"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label htmlFor="rec-tag" className="text-xs">Tag / Badge Code</Label>
              <Input
                id="rec-tag"
                placeholder="e.g. SPOTIFY"
                value={newRecurring.tag || ''}
                onChange={(e) => setNewRecurring({ ...newRecurring, tag: e.target.value.toUpperCase() })}
                className="rounded-xl h-10 border-primary/20 bg-background/50 text-sm"
              />
            </div>
          </div>

          {/* Grid for Amount, Frequency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="rec-amount" className="text-xs">Amount (£)</Label>
              <Input
                id="rec-amount"
                type="number"
                step="0.01"
                placeholder="e.g. 10.99"
                value={newRecurring.amount}
                onChange={(e) => setNewRecurring({ ...newRecurring, amount: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                className="rounded-xl h-10 border-primary/20 bg-background/50 text-sm font-mono"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rec-frequency" className="text-xs">Frequency</Label>
              <Select
                value={newRecurring.frequency}
                onValueChange={(val) => setNewRecurring({ ...newRecurring, frequency: val as any })}
              >
                <SelectTrigger id="rec-frequency" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs">
                  <SelectValue placeholder="Select frequency..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10">
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
              <Label htmlFor="rec-day" className="text-xs">Due Day of Month (1-31)</Label>
              <Input
                id="rec-day"
                type="number"
                min="1"
                max="31"
                placeholder="e.g. 15"
                value={newRecurring.dueDate || ''}
                onChange={(e) => setNewRecurring({ ...newRecurring, dueDate: parseInt(e.target.value, 10) || 1 })}
                className="rounded-xl h-10 border-primary/20 bg-background/50 text-sm font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="rec-month" className="text-xs">Due Month</Label>
              <Select
                value={String(newRecurring.dueMonth || 1)}
                onValueChange={(val) => setNewRecurring({ ...newRecurring, dueMonth: parseInt(val, 10) })}
                disabled={newRecurring.frequency === 'monthly' || newRecurring.frequency === 'weekly'}
              >
                <SelectTrigger id="rec-month" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs disabled:opacity-50">
                  <SelectValue placeholder="Select month..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10">
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => (
                    <SelectItem key={idx} value={String(idx + 1)} className="text-xs">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* DYNAMIC Category selection */}
          <div className="space-y-1">
            <Label htmlFor="rec-category" className="text-xs">Dashboard Category</Label>
            <Select
              value={newRecurring.category || 'none'}
              onValueChange={(val) => setNewRecurring({ ...newRecurring, category: val === 'none' ? '' : val })}
            >
              <SelectTrigger id="rec-category" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs">
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-primary/10 max-h-56">
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
            <Label htmlFor="rec-link-budget" className="text-xs">Link to Budget Item</Label>
            <Select
              value={newRecurring.linkedBudgetItemId || 'none'}
              onValueChange={(val) => setNewRecurring({ ...newRecurring, linkedBudgetItemId: val === 'none' ? '' : val })}
            >
              <SelectTrigger id="rec-link-budget" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs">
                <SelectValue placeholder="No linked budget item (Create automatically on save)" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-primary/10">
                <SelectItem value="none" className="text-xs">No linked budget item (Create automatically on save)</SelectItem>
                <SelectItem value="create" className="text-xs">Force create new item</SelectItem>
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
            <Label htmlFor="rec-link-account" className="text-xs">Link to Bank Account (Source for payments)</Label>
            <Select
              value={newRecurring.linkedAccountId || 'none'}
              onValueChange={(val) => setNewRecurring({ ...newRecurring, linkedAccountId: val === 'none' ? '' : val })}
            >
              <SelectTrigger id="rec-link-account" className="rounded-xl h-10 border-primary/20 bg-background/50 text-xs">
                <SelectValue placeholder="No linked account (Manual cash payment)" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-primary/10">
                <SelectItem value="none" className="text-xs">No linked account (Manual cash payment)</SelectItem>
                {bankAccounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id} className="text-xs">
                    {acc.name} ({acc.type} - {formatGBP(acc.balance)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4 gap-2 sm:gap-0">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
            <Button type="submit" className="rounded-xl bg-primary text-primary-foreground">Save Bill</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, ArrowRight, Sparkles, Check, Edit2, X } from 'lucide-react';
import type { CategoryRule } from '@/lib/finance';
import { calculateRuleImpact } from '@/lib/finance';
import type { MockTransaction } from '../finance-types';

interface CategoryRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: CategoryRule[];
  onSaveRule: (
    rule: Omit<CategoryRule, 'id'> & { id?: string },
  ) => Promise<{ error: Error | null; countAffected: number }>;
  onDeleteRule: (id: string) => Promise<{ error: Error | null }>;
  transactions: MockTransaction[];
  allCategoryOptions: Array<{ id: string; name: string; group?: string }>;
  initialPattern?: string;
  initialCategory?: string;
}

export const CategoryRulesDialog: React.FC<CategoryRulesDialogProps> = ({
  open,
  onOpenChange,
  rules,
  onSaveRule,
  onDeleteRule,
  transactions,
  allCategoryOptions,
  initialPattern = '',
  initialCategory = '',
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pattern, setPattern] = useState(initialPattern);
  const [category, setCategory] = useState(initialCategory || (allCategoryOptions[0]?.name ?? 'General'));
  const [renameTo, setRenameTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sync initial props when opened with initial values
  React.useEffect(() => {
    if (open) {
      if (initialPattern) setPattern(initialPattern);
      if (initialCategory) setCategory(initialCategory);
    } else {
      setEditingId(null);
      setPattern('');
      setRenameTo('');
    }
  }, [open, initialPattern, initialCategory]);

  const liveImpact = useMemo(() => {
    if (!pattern.trim()) {
      return { matchingCount: 0, unmodifiedCount: 0, affectedTransactions: [] };
    }
    return calculateRuleImpact(transactions, {
      merchant_pattern: pattern.trim(),
      category: category.trim(),
      rename_to: renameTo.trim() || undefined,
    });
  }, [transactions, pattern, category, renameTo]);

  const handleStartEdit = (rule: CategoryRule) => {
    setEditingId(rule.id);
    setPattern(rule.merchant_pattern);
    setCategory(rule.category);
    setRenameTo(rule.rename_to || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setPattern('');
    setRenameTo('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim() || !category.trim()) return;

    setSaving(true);
    try {
      const res = await onSaveRule({
        id: editingId || undefined,
        merchant_pattern: pattern.trim(),
        category: category.trim(),
        rename_to: renameTo.trim() || null,
      });
      if (!res.error) {
        handleCancelEdit();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteRule(id);
      if (editingId === id) {
        handleCancelEdit();
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col font-mono text-xs">
        <DialogHeader className="space-y-1 pb-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <DialogTitle className="text-base font-semibold font-mono tracking-tight">
              Category rules
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground font-mono">
            Rules assign categories to transactions by merchant pattern at read time.
            Manually reviewed or edited categories are never overwritten.
          </DialogDescription>
        </DialogHeader>

        {/* Rule Editor Form */}
        <form onSubmit={handleSave} className="surface-card bg-muted/20 border border-border/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              {editingId ? <Edit2 className="h-3.5 w-3.5 text-primary" /> : <Plus className="h-3.5 w-3.5 text-primary" />}
              {editingId ? 'Edit category rule' : 'Create new category rule'}
            </span>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel edit
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rule-merchant-pattern" className="text-xs text-muted-foreground">
                Merchant pattern
              </Label>
              <Input
                id="rule-merchant-pattern"
                value={pattern}
                onChange={e => setPattern(e.target.value)}
                placeholder="e.g. Tesco, Uber, Pret"
                className="h-8 text-xs font-mono bg-background/50 border-border/50"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rule-target-category" className="text-xs text-muted-foreground">
                Assign category
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="rule-target-category" className="h-8 text-xs font-mono bg-background/50 border-border/50">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="max-h-56 font-mono text-xs z-[70]">
                  {allCategoryOptions.map(opt => (
                    <SelectItem key={opt.id} value={opt.name} className="text-xs font-mono">
                      {opt.group && <span className="text-muted-foreground mr-1">[{opt.group}]</span>}
                      {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rule-rename-target" className="text-xs text-muted-foreground">
                Rename to (optional)
              </Label>
              <Input
                id="rule-rename-target"
                value={renameTo}
                onChange={e => setRenameTo(e.target.value)}
                placeholder="e.g. Tesco Superstore"
                className="h-8 text-xs font-mono bg-background/50 border-border/50"
              />
            </div>
          </div>

          {/* Impact preview */}
          {pattern.trim().length > 0 && (
            <div className="flex items-center justify-between text-xs pt-1 text-muted-foreground border-t border-border/30">
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-positive" />
                Impact: <strong className="text-foreground tabular-nums">{liveImpact.unmodifiedCount}</strong> rows would update
                {liveImpact.matchingCount > liveImpact.unmodifiedCount && (
                  <span className="text-muted-foreground">
                    {' '}({liveImpact.matchingCount - liveImpact.unmodifiedCount} protected by hand edits)
                  </span>
                )}
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={saving || !pattern.trim() || !category.trim()}
                className="h-7 text-xs font-mono"
              >
                {saving ? 'Saving...' : editingId ? 'Update rule' : 'Add rule'}
              </Button>
            </div>
          )}
        </form>

        {/* Existing Rules List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold px-1 pb-1">
            <span>Active rules ({rules.length})</span>
            <span>Impact</span>
          </div>

          {rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground surface-card rounded-lg border border-border/30 bg-muted/5">
              <p>No category rules defined yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add a pattern above to automatically categorize matching bank transactions.
              </p>
            </div>
          ) : (
            rules.map(rule => {
              const ruleImpact = calculateRuleImpact(transactions, rule);
              return (
                <div
                  key={rule.id}
                  className="surface-card bg-card/40 border border-border/40 rounded-lg p-3 flex items-center justify-between gap-3 hover:border-border/80 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Badge variant="outline" className="font-mono text-xs border-border/60 bg-background/50">
                      "{rule.merchant_pattern}"
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <Badge variant="secondary" className="font-mono text-xs">
                      {rule.category}
                    </Badge>
                    {rule.rename_to && (
                      <span className="text-xs text-muted-foreground truncate">
                        (renames to <span className="text-foreground font-medium">"{rule.rename_to}"</span>)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {ruleImpact.matchingCount} matches
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(rule)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      aria-label={`Edit rule for ${rule.merchant_pattern}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={deletingId === rule.id}
                      onClick={() => handleDelete(rule.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label={`Delete rule for ${rule.merchant_pattern}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

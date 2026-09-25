import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { cn } from '@/lib/utils';
import { Search, Check, Plus, Minus, Package, Briefcase, Sparkles } from 'lucide-react';
import { EDC_SLOTS } from './types';
import type { InventoryRow } from '@/collections/inventory';
import { toast } from 'sonner';

interface EdcBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allItems: InventoryRow[];
  updateItem: (id: string, updates: Partial<InventoryRow>) => Promise<unknown>;
}

const CATEGORY_TABS = [
  { key: 'in-edc', label: 'In EDC' },
  { key: 'all', label: 'All Inventory' },
  { key: 'tech', label: 'Tech' },
  { key: 'wardrobe', label: 'Wardrobe' },
  { key: 'hygiene', label: 'Hygiene' },
  { key: 'homelab', label: 'HomeLab' },
  { key: 'sports-gear', label: 'Sports Gear' },
];

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);

export function EdcBuilderDialog({
  open,
  onOpenChange,
  allItems,
  updateItem,
}: EdcBuilderDialogProps) {
  const [activeTab, setActiveTab] = useState('in-edc');
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const edcItems = useMemo(
    () => allItems.filter((i) => Boolean(i.is_edc)),
    [allItems],
  );

  const totalValue = useMemo(
    () =>
      edcItems.reduce(
        (sum, item) => (item.is_wishlist ? sum : sum + Number(item.price ?? 0)),
        0,
      ),
    [edcItems],
  );

  const filteredItems = useMemo(() => {
    let list = allItems;
    if (activeTab === 'in-edc') {
      list = edcItems;
    } else if (activeTab !== 'all') {
      list = allItems.filter((i) => i.category === activeTab);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.brand && i.brand.toLowerCase().includes(q)),
      );
    }

    // Sort items: items in EDC first, then alphabetical
    return [...list].sort((a, b) => {
      if (Boolean(a.is_edc) !== Boolean(b.is_edc)) {
        return a.is_edc ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [allItems, edcItems, activeTab, search]);

  const toggleEdc = async (item: InventoryRow) => {
    setSavingId(item.id);
    const willBeInEdc = !item.is_edc;
    try {
      await updateItem(item.id, {
        is_edc: willBeInEdc,
        edc_slot: willBeInEdc ? (item.edc_slot ?? 'pockets') : null,
      });
      if (willBeInEdc) {
        toast.success(`Added ${item.name} to Everyday Carry`);
      } else {
        toast.info(`Removed ${item.name} from Everyday Carry`);
      }
    } catch {
      toast.error(`Failed to update ${item.name}`);
    } finally {
      setSavingId(null);
    }
  };

  const setItemSlot = async (item: InventoryRow, slotKey: string) => {
    setSavingId(item.id);
    try {
      await updateItem(item.id, { edc_slot: slotKey });
      toast.success(`Updated carry compartment for ${item.name}`);
    } catch {
      toast.error(`Failed to update compartment`);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border/80">
        <DialogHeader className="p-5 pb-4 pr-16 border-b border-border/60 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="w-4 h-4 text-primary" />
                <DotMatrixText text="CURATE EVERYDAY CARRY" size="xs" />
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Inherit gear from any inventory category into your daily carry setup.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-3 bg-muted/40 border border-border/60 rounded-md px-3 py-1.5 self-start sm:self-auto">
              <div className="text-right">
                <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
                  Carried Items
                </div>
                <div className="text-sm font-semibold font-mono">
                  {edcItems.length}
                </div>
              </div>
              <div className="h-6 w-px bg-border/80" />
              <div className="text-right">
                <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
                  Carry Value
                </div>
                <div className="text-sm font-semibold font-mono text-primary">
                  {formatCurrency(totalValue)}
                </div>
              </div>
            </div>
          </div>

          {/* Category Tabs & Search Bar */}
          <div className="space-y-3 mt-4">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORY_TABS.map((tab) => {
                const count =
                  tab.key === 'in-edc'
                    ? edcItems.length
                    : tab.key === 'all'
                      ? allItems.length
                      : allItems.filter((i) => i.category === tab.key).length;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap font-mono flex items-center gap-1.5 border',
                      activeTab === tab.key
                        ? 'bg-primary text-primary-foreground border-primary font-medium'
                        : 'bg-background hover:bg-muted text-muted-foreground border-border/60',
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        'text-[10px] px-1 rounded',
                        activeTab === tab.key
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search inventory items to carry..."
                className="pl-8 h-8 text-xs bg-muted/30"
              />
            </div>
          </div>
        </DialogHeader>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-border/40">
          {filteredItems.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-serif italic">No inventory items found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {activeTab === 'in-edc'
                  ? 'Switch to "All Inventory" or "Tech" to add items to your EDC.'
                  : 'Try adjusting your search query.'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const inEdc = Boolean(item.is_edc);
              const isSaving = savingId === item.id;
              const slot = item.edc_slot ?? 'pockets';

              return (
                <div
                  key={item.id}
                  className={cn(
                    'py-2.5 flex items-center justify-between gap-3 px-2 rounded-lg transition-colors',
                    inEdc ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/40',
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Image Thumbnail */}
                    <div className="w-10 h-10 rounded-md border border-border/60 bg-muted/30 overflow-hidden shrink-0 flex items-center justify-center p-1">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <Package className="w-4 h-4 text-muted-foreground/40" />
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-xs truncate">
                          {item.name}
                        </span>
                        {item.brand && (
                          <span className="text-[11px] text-muted-foreground">
                            · {item.brand}
                          </span>
                        )}
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/60">
                          {item.category.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground/80 mt-0.5 flex items-center gap-2">
                        {item.price != null && Number(item.price) > 0 && (
                          <span>{formatCurrency(Number(item.price))}</span>
                        )}
                        {item.subcategory && (
                          <span>· {item.subcategory}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {inEdc && (
                      <div className="hidden sm:flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground uppercase font-mono">
                          Slot:
                        </span>
                        <select
                          value={slot}
                          disabled={isSaving}
                          onChange={(e) => setItemSlot(item, e.target.value)}
                          className="h-7 text-xs rounded border border-border/80 bg-background px-2 py-0.5 text-foreground font-mono"
                        >
                          {EDC_SLOTS.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.shortLabel}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <Button
                      size="sm"
                      variant={inEdc ? 'default' : 'outline'}
                      disabled={isSaving}
                      onClick={() => toggleEdc(item)}
                      className={cn(
                        'h-7 px-2.5 text-xs font-mono gap-1.5 transition-all',
                        inEdc
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'border-border/80 hover:bg-muted',
                      )}
                    >
                      {inEdc ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>IN CARRY</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          <span>ADD</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 px-5 border-t border-border/60 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1 text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Changes save live to your Everyday Carry showcase</span>
          </div>
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 px-3 text-xs"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

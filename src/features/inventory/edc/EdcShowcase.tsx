import { useState, useMemo, useCallback } from 'react';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { CardGrid } from '@/components/shared/CardGrid';
import { EntityCard } from '@/collections/components/EntityCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Briefcase,
  Share2,
  Sparkles,
  LayoutGrid,
  Layers,
  Pocket,
  Watch,
  Key,
  Package,
  Search,
  Check,
  ArrowRight,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { EDC_SLOTS, getDefaultSlotForItem, getSlotDef } from './types';
import { EdcProductCard } from './EdcProductCard';
import { EdcBuilderDialog } from './EdcBuilderDialog';
import type { InventoryRow } from '@/collections/inventory';
import type { CollectionConfig } from '@/collections/types';

interface EdcShowcaseProps {
  items: InventoryRow[];
  allItems: InventoryRow[];
  config: CollectionConfig<InventoryRow>;
  isAdmin: boolean;
  updateItem: (id: string, updates: Partial<InventoryRow>) => Promise<unknown>;
  removeItem: (id: string) => Promise<unknown>;
  onOpenBuilder?: () => void;
  search?: string;
}

const SLOT_ICONS: Record<string, typeof Pocket> = {
  pockets: Pocket,
  wrist: Watch,
  bag: Briefcase,
  keychain: Key,
  pouches: Layers,
};

const formatPrice = (value: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

type MainViewMode = 'choose' | 'loadout';
type SortOption = 'edc-first' | 'name' | 'price-desc' | 'price-asc';

export function EdcShowcase({
  items,
  allItems,
  config,
  isAdmin,
  updateItem,
  removeItem,
  onOpenBuilder,
  search: initialSearch = '',
}: EdcShowcaseProps) {
  // Read initial view mode from URL search param if present, defaulting to 'choose' (All Inventory)
  const [mainView, setMainView] = useState<MainViewMode>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('edc_view');
      if (param === 'loadout') return 'loadout';
      if (param === 'choose') return 'choose';
    }
    return 'choose';
  });

  // Loadout display settings
  const [loadoutViewMode, setLoadoutViewMode] = useState<'compartments' | 'flatlay'>('compartments');
  const [activeSlotFilter, setActiveSlotFilter] = useState<string>('all');

  // Choose / Gear picker settings
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortBy, setSortBy] = useState<SortOption>('edc-first');
  const [savingId, setSavingId] = useState<string | null>(null);

  // Local optimistic overrides for instant responsiveness and guest preview mode
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, { is_edc: boolean; edc_slot?: string }>
  >({});

  // Resolve an item's EDC status with local overrides
  const getItemEdcStatus = useCallback(
    (item: InventoryRow) => {
      const override = localOverrides[item.id];
      const inEdc = override ? override.is_edc : Boolean(item.is_edc);
      const slot = override?.edc_slot ?? item.edc_slot ?? getDefaultSlotForItem(item);
      return { inEdc, slot };
    },
    [localOverrides],
  );

  // Filter items in EDC across allItems
  const edcItems = useMemo(() => {
    return allItems.filter((i) => getItemEdcStatus(i).inEdc);
  }, [allItems, getItemEdcStatus]);

  // Total carry value of items in EDC (ignoring wishlist)
  const totalValue = useMemo(
    () =>
      edcItems.reduce(
        (sum, item) => (item.is_wishlist ? sum : sum + Number(item.price ?? 0)),
        0,
      ),
    [edcItems],
  );

  // Count per slot
  const slotCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const slot of EDC_SLOTS) {
      counts[slot.key] = edcItems.filter(
        (i) => getItemEdcStatus(i).slot === slot.key,
      ).length;
    }
    return counts;
  }, [edcItems, getItemEdcStatus]);

  // Distinct category tabs derived from all inventory products
  const categoryTabs = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of allItems) {
      const cat = item.category ?? 'uncategorized';
      counts[cat] = (counts[cat] ?? 0) + 1;
    }

    const categories = Object.keys(counts).sort();
    return [
      { key: 'all', label: 'All Inventory', count: allItems.length },
      { key: 'in-edc', label: 'In Carry', count: edcItems.length },
      { key: 'not-in-edc', label: 'Not in Carry', count: allItems.length - edcItems.length },
      ...categories.map((cat) => ({
        key: cat,
        label: cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' '),
        count: counts[cat] ?? 0,
      })),
    ];
  }, [allItems, edcItems]);

  // Items to display in the "Choose from Inventory" view
  const filteredProducts = useMemo(() => {
    let list = allItems;

    // Filter by category tab
    if (activeCategoryTab === 'in-edc') {
      list = list.filter((i) => getItemEdcStatus(i).inEdc);
    } else if (activeCategoryTab === 'not-in-edc') {
      list = list.filter((i) => !getItemEdcStatus(i).inEdc);
    } else if (activeCategoryTab !== 'all') {
      list = list.filter((i) => i.category === activeCategoryTab);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((i) => {
        const nameMatch = i.name.toLowerCase().includes(q);
        const brandMatch = i.brand?.toLowerCase().includes(q) ?? false;
        const subMatch = i.subcategory?.toLowerCase().includes(q) ?? false;
        const specsMatch = i.specs?.toLowerCase().includes(q) ?? false;
        return nameMatch || brandMatch || subMatch || specsMatch;
      });
    }

    // Sort items
    return [...list].sort((a, b) => {
      const aInEdc = getItemEdcStatus(a).inEdc;
      const bInEdc = getItemEdcStatus(b).inEdc;

      if (sortBy === 'edc-first' && aInEdc !== bInEdc) {
        return aInEdc ? -1 : 1;
      }
      if (sortBy === 'price-desc') {
        return Number(b.price ?? 0) - Number(a.price ?? 0);
      }
      if (sortBy === 'price-asc') {
        return Number(a.price ?? 0) - Number(b.price ?? 0);
      }
      return a.name.localeCompare(b.name);
    });
  }, [allItems, activeCategoryTab, searchQuery, sortBy, getItemEdcStatus]);

  // Handlers for toggling and updating items
  const handleToggleEdc = async (item: InventoryRow) => {
    const { inEdc, slot } = getItemEdcStatus(item);
    const willBeInEdc = !inEdc;
    const chosenSlot = willBeInEdc ? (slot ?? getDefaultSlotForItem(item)) : null;

    setSavingId(item.id);
    setLocalOverrides((prev) => ({
      ...prev,
      [item.id]: { is_edc: willBeInEdc, edc_slot: chosenSlot ?? undefined },
    }));

    if (!isAdmin) {
      setSavingId(null);
      if (willBeInEdc) {
        toast.info(
          `Preview: Added ${item.name} to Everyday Carry (${getSlotDef(chosenSlot).shortLabel}). Sign in as admin to save.`,
        );
      } else {
        toast.info(`Preview: Removed ${item.name} from Everyday Carry.`);
      }
      return;
    }

    try {
      await updateItem(item.id, {
        is_edc: willBeInEdc,
        edc_slot: chosenSlot,
      });
      if (willBeInEdc) {
        toast.success(
          `Added ${item.name} to Everyday Carry (${getSlotDef(chosenSlot).shortLabel})`,
        );
      } else {
        toast.info(`Removed ${item.name} from Everyday Carry`);
      }
    } catch {
      toast.error(`Failed to update ${item.name}`);
      // Rollback local override
      setLocalOverrides((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleSetSlot = async (item: InventoryRow, slotKey: string) => {
    setSavingId(item.id);
    setLocalOverrides((prev) => ({
      ...prev,
      [item.id]: { is_edc: true, edc_slot: slotKey },
    }));

    const slotDef = getSlotDef(slotKey);

    if (!isAdmin) {
      setSavingId(null);
      toast.info(`Preview: Moved ${item.name} to ${slotDef.shortLabel}. Sign in as admin to save.`);
      return;
    }

    try {
      await updateItem(item.id, { edc_slot: slotKey });
      toast.success(`Moved ${item.name} to ${slotDef.shortLabel}`);
    } catch {
      toast.error(`Failed to update compartment`);
      setLocalOverrides((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } finally {
      setSavingId(null);
    }
  };

  // Share URL
  const shareEdc = async () => {
    const url = `${window.location.origin}/inventory?category=edc&edc_view=loadout`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast.success('Everyday Carry link copied to clipboard!');
      } else {
        toast.info(url);
      }
    } catch {
      toast.info(url);
    }
  };

  // Grouped by compartment for the Loadout showcase
  const compartmentGroups = useMemo(() => {
    return EDC_SLOTS.map((slot) => {
      const slotItems = edcItems.filter(
        (item) => getItemEdcStatus(item).slot === slot.key,
      );
      return {
        ...slot,
        items: slotItems,
      };
    }).filter((group) => group.items.length > 0);
  }, [edcItems, getItemEdcStatus]);

  // Displayed items in loadout mode
  const displayedLoadoutItems = useMemo(() => {
    if (activeSlotFilter === 'all') return edcItems;
    return edcItems.filter(
      (i) => getItemEdcStatus(i).slot === activeSlotFilter,
    );
  }, [edcItems, activeSlotFilter, getItemEdcStatus]);

  return (
    <div className="space-y-6 pb-12">
      {/* EDC Hero Banner */}
      <div className="relative overflow-hidden rounded-xl border border-border/80 bg-gradient-to-b from-card/90 via-card/50 to-card/20 p-5 md:p-7 backdrop-blur-xs shadow-xs">
        {/* Subtle grid pattern backdrop */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
            backgroundSize: '16px 16px',
          }}
        />

        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <Briefcase className="w-4 h-4" />
              <span className="text-[11px] font-mono tracking-widest uppercase text-muted-foreground">
                Inventory Curation · Pocket Dump
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              <DotMatrixText text="EVERYDAY CARRY" size="sm" />
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl">
              Select products from across your inventory to form your daily carry loadout,
              or view your active carry breakdown by compartment.
            </p>
          </div>

          {/* Metric Stats & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-4 bg-background/80 border border-border/70 rounded-lg px-4 py-2 shadow-xs">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Loadout Items
                </div>
                <div className="text-lg font-bold font-mono text-foreground">
                  {edcItems.length}
                </div>
              </div>
              <div className="h-8 w-px bg-border/70" />
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Carry Value
                </div>
                <div className="text-lg font-bold font-mono text-primary">
                  {formatPrice(totalValue)}
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={shareEdc}
              className="h-10 px-3 text-xs gap-1.5 font-mono"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>SHARE</span>
            </Button>
          </div>
        </div>

        {/* Top-Level Mode Switcher: Choose from Inventory vs Carry Loadout */}
        <div className="mt-6 pt-5 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-muted/40 border border-border/60 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMainView('choose')}
              className={cn(
                'px-3.5 py-1.5 text-xs font-mono rounded-md transition-all flex items-center gap-2',
                mainView === 'choose'
                  ? 'bg-foreground text-background shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              )}
            >
              <Package className="w-3.5 h-3.5" />
              <span>CHOOSE GEAR</span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                  mainView === 'choose'
                    ? 'bg-background/20 text-background'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {allItems.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMainView('loadout')}
              className={cn(
                'px-3.5 py-1.5 text-xs font-mono rounded-md transition-all flex items-center gap-2',
                mainView === 'loadout'
                  ? 'bg-foreground text-background shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              )}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>CARRY LOADOUT</span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                  mainView === 'loadout'
                    ? 'bg-background/20 text-background'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {edcItems.length}
              </span>
            </button>
          </div>

          {/* Loadout sub-controls if on loadout view */}
          {mainView === 'loadout' && edcItems.length > 0 && (
            <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/60 self-start sm:self-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLoadoutViewMode('compartments')}
                className={cn(
                  'h-7 px-2.5 text-xs font-mono gap-1.5',
                  loadoutViewMode === 'compartments' &&
                    'bg-background shadow-xs text-foreground',
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>COMPARTMENTS</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLoadoutViewMode('flatlay')}
                className={cn(
                  'h-7 px-2.5 text-xs font-mono gap-1.5',
                  loadoutViewMode === 'flatlay' &&
                    'bg-background shadow-xs text-foreground',
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>POCKET DUMP</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* VIEW 1: CHOOSE FROM INVENTORY */}
      {mainView === 'choose' && (
        <div className="space-y-6">
          {/* Active Carry Loadout Quick Dock */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 px-4 rounded-lg bg-card/60 border border-border/70 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 font-mono font-medium text-foreground">
                <Briefcase className="w-3.5 h-3.5 text-primary" />
                <span>CURRENT LOADOUT:</span>
                <span className="text-primary font-bold">{edcItems.length} items</span>
                <span className="text-muted-foreground">({formatPrice(totalValue)})</span>
              </div>
              <div className="hidden md:flex items-center gap-2 text-muted-foreground font-mono text-[11px]">
                {EDC_SLOTS.map((slot) => {
                  const count = slotCounts[slot.key] ?? 0;
                  if (count === 0) return null;
                  return (
                    <span key={slot.key} className="bg-muted/60 px-1.5 py-0.5 rounded border border-border/50">
                      {slot.shortLabel}: {count}
                    </span>
                  );
                })}
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setMainView('loadout')}
              className="h-7 text-xs font-mono gap-1.5 border-primary/50 text-primary hover:bg-primary/10 self-start sm:self-auto shrink-0"
            >
              <span>VIEW SHOWCASE</span>
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>

          {/* Filtering & Search Bar */}
          <div className="space-y-3">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categoryTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveCategoryTab(tab.key)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap font-mono flex items-center gap-1.5 border',
                    activeCategoryTab === tab.key
                      ? 'bg-primary text-primary-foreground border-primary font-medium shadow-xs'
                      : 'bg-background hover:bg-muted text-muted-foreground border-border/70',
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'text-[10px] px-1 rounded',
                      activeCategoryTab === tab.key
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search Input & Sort Options */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products to add to carry (name, brand, specs)..."
                  className="pl-8 pr-8 h-9 text-xs bg-muted/20 border-border/70"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono text-muted-foreground">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="h-9 text-xs rounded-md border border-border/70 bg-background px-2.5 py-1 text-foreground font-mono"
                >
                  <option value="edc-first">In Carry First</option>
                  <option value="name">A to Z</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="price-asc">Price: Low to High</option>
                </select>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-border/70 rounded-xl p-8 bg-card/20">
              <Package className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium">No inventory products found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery
                  ? `No items match "${searchQuery}". Try a different keyword.`
                  : 'Try selecting a different category filter.'}
              </p>
              {searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="mt-4 text-xs font-mono"
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <CardGrid>
              {filteredProducts.map((item) => {
                const { inEdc, slot } = getItemEdcStatus(item);
                return (
                  <EdcProductCard
                    key={item.id}
                    item={item}
                    config={config}
                    inEdc={inEdc}
                    slotKey={slot}
                    isSaving={savingId === item.id}
                    onToggleEdc={handleToggleEdc}
                    onSetSlot={handleSetSlot}
                  />
                );
              })}
            </CardGrid>
          )}
        </div>
      )}

      {/* VIEW 2: CARRY LOADOUT SHOWCASE */}
      {mainView === 'loadout' && (
        <div className="space-y-8">
          {/* Compartment Filter Pills */}
          {edcItems.length > 0 && (
            <div className="flex items-center justify-between gap-4 flex-wrap border-b border-border/50 pb-4">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveSlotFilter('all')}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md font-mono transition-colors border',
                    activeSlotFilter === 'all'
                      ? 'bg-foreground text-background border-foreground font-medium'
                      : 'bg-background/60 hover:bg-muted text-muted-foreground border-border/60',
                  )}
                >
                  ALL ({edcItems.length})
                </button>
                {EDC_SLOTS.map((slot) => {
                  const count = slotCounts[slot.key] ?? 0;
                  if (count === 0) return null;
                  const Icon = SLOT_ICONS[slot.key] ?? Package;
                  return (
                    <button
                      key={slot.key}
                      type="button"
                      onClick={() =>
                        setActiveSlotFilter(
                          activeSlotFilter === slot.key ? 'all' : slot.key,
                        )
                      }
                      className={cn(
                        'px-2.5 py-1 text-xs rounded-md font-mono transition-colors border flex items-center gap-1.5',
                        activeSlotFilter === slot.key
                          ? 'bg-foreground text-background border-foreground font-medium'
                          : 'bg-background/60 hover:bg-muted text-muted-foreground border-border/60',
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{slot.shortLabel.toUpperCase()}</span>
                      <span className="opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setMainView('choose')}
                className="h-8 text-xs font-mono gap-1.5"
              >
                <Package className="w-3.5 h-3.5" />
                <span>CHOOSE MORE GEAR</span>
              </Button>
            </div>
          )}

          {/* Empty state if no items in EDC */}
          {edcItems.length === 0 ? (
            <div className="py-24 text-center border border-dashed border-border/70 rounded-xl p-8 bg-card/20 space-y-3">
              <Briefcase className="w-10 h-10 mx-auto text-muted-foreground/40" />
              <h3 className="text-lg font-medium tracking-wide">
                <DotMatrixText text="NO ITEMS IN EVERYDAY CARRY YET" size="xs" />
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Everyday Carry items are inherited from your inventory. Add your watch from
                Wardrobe, charger and phone from Tech, or lip balm from Hygiene.
              </p>
              <Button
                onClick={() => setMainView('choose')}
                className="mt-4 font-mono text-xs gap-2 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>CHOOSE ITEMS FROM INVENTORY ({allItems.length})</span>
              </Button>
            </div>
          ) : activeSlotFilter !== 'all' || loadoutViewMode === 'flatlay' ? (
            /* Flat-lay / Filtered Grid */
            <CardGrid>
              {displayedLoadoutItems.map((item, index) => (
                <EntityCard
                  key={item.id}
                  item={item}
                  config={config}
                  index={index}
                  onUpdate={isAdmin ? (id, updates) => updateItem(id, updates) : undefined}
                  onRemove={isAdmin ? (id) => removeItem(id) : undefined}
                />
              ))}
            </CardGrid>
          ) : (
            /* Compartments Layout */
            <div className="space-y-10">
              {compartmentGroups.map((group) => {
                const Icon = SLOT_ICONS[group.key] ?? Package;
                const slotValuation = group.items.reduce(
                  (sum, item) => (item.is_wishlist ? sum : sum + Number(item.price ?? 0)),
                  0,
                );

                return (
                  <section key={group.key} className="space-y-4">
                    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center border border-border/60 text-primary">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
                            <DotMatrixText text={group.label.toUpperCase()} size="xs" />
                            <span className="text-xs text-muted-foreground font-mono font-normal">
                              ({group.items.length})
                            </span>
                          </h3>
                          <p className="text-[11px] text-muted-foreground">
                            {group.description}
                          </p>
                        </div>
                      </div>

                      <div className="text-right font-mono text-xs text-muted-foreground hidden sm:block">
                        {formatPrice(slotValuation)}
                      </div>
                    </div>

                    <CardGrid>
                      {group.items.map((item, index) => (
                        <EntityCard
                          key={item.id}
                          item={item}
                          config={config}
                          index={index}
                          onUpdate={isAdmin ? (id, updates) => updateItem(id, updates) : undefined}
                          onRemove={isAdmin ? (id) => removeItem(id) : undefined}
                        />
                      ))}
                    </CardGrid>
                  </section>
                );
              })}

              {/* Bottom CTA to add more items */}
              <div className="pt-6 border-t border-border/50 text-center">
                <Button
                  variant="outline"
                  onClick={() => setMainView('choose')}
                  className="font-mono text-xs gap-2"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>CHOOSE MORE GEAR FROM INVENTORY ({allItems.length})</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EdcToolbarButton({
  allItems,
  updateItem,
}: {
  allItems: InventoryRow[];
  updateItem: (id: string, updates: Partial<InventoryRow>) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 px-3 text-xs whitespace-nowrap gap-1.5 font-mono shadow-xs"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <DotMatrixText text="CURATE EDC" size="xs" />
      </Button>
      <EdcBuilderDialog
        open={open}
        onOpenChange={setOpen}
        allItems={allItems}
        updateItem={updateItem}
      />
    </>
  );
}

export function EdcShowcaseContainer({
  items,
  allItems,
  config,
  isAdmin,
  updateItem,
  removeItem,
  search,
}: {
  items: InventoryRow[];
  allItems: InventoryRow[];
  config: CollectionConfig<InventoryRow>;
  isAdmin: boolean;
  updateItem: (id: string, updates: Partial<InventoryRow>) => Promise<unknown>;
  removeItem: (id: string) => Promise<unknown>;
  search?: string;
}) {
  const [builderOpen, setBuilderOpen] = useState(false);

  return (
    <>
      <EdcShowcase
        items={items}
        allItems={allItems}
        config={config}
        isAdmin={isAdmin}
        updateItem={updateItem}
        removeItem={removeItem}
        onOpenBuilder={() => setBuilderOpen(true)}
        search={search}
      />
      {isAdmin && (
        <EdcBuilderDialog
          open={builderOpen}
          onOpenChange={setBuilderOpen}
          allItems={allItems}
          updateItem={updateItem}
        />
      )}
    </>
  );
}

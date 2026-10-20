import type { CSSProperties } from 'react';
import { Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Library, Plus } from 'lucide-react';
import { ActionButton } from '@/components/shared/ActionButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { CardGrid } from '@/components/shared/CardGrid';
import { CountLabel } from '@/components/shared/CountLabel';
import { useAuth } from '@/contexts/AuthContext';
import { useCollection } from '../useCollection';
import { FilterBar } from './FilterBar';
import { EntityCard, CARD_LAYOUT } from './EntityCard';
import { EntityFormDialog } from './EntityFormDialog';
import type { CollectionConfig, CollectionRow } from '../types';

interface CollectionPageProps<T extends CollectionRow, R> {
  config: CollectionConfig<T, R>;
}

/**
 * The whole page for any collection: header, filter bar, count, add button,
 * grid, footer. Pages in src/pages/ become a one-line render of this.
 */
export function CollectionPage<T extends CollectionRow, R>({
  config,
}: CollectionPageProps<T, R>) {
  const { isAdmin } = useAuth();
  const {
    items,
    groups,
    all,
    sortKey,
    setSortKey,
    sortOptions,
    loading,
    filters,
    setFilter,
    search,
    setSearch,
    countFor,
    addItem,
    updateItem,
    removeItem,
  } = useCollection(config);

  const layout = CARD_LAYOUT[config.card.variant];
  const CollectionIcon = config.card.fallbackIcon ?? Library;

  const activeSort = sortOptions.find((o) => o.key === sortKey);
  const showSortToggle =
    sortOptions.length > 1 && !activeSort?.hiddenWhen?.(filters);

  const cardsFor = (list: typeof items, offset = 0) =>
    list.map((item, index) => (
      <EntityCard
        key={item.id}
        item={item}
        config={config}
        index={offset + index}
        onUpdate={isAdmin ? updateItem : undefined}
        onRemove={isAdmin ? removeItem : undefined}
      />
    ));

  // Beliefs is private. Hooks run first so this stays a valid hook order.
  if (config.adminOnly && !isAdmin) return <Navigate to="/" replace />;

  const count = items.length;
  const noun = count === 1 ? config.noun.singular : config.noun.plural;

  const customViewContent = config.customView?.({
    items,
    allItems: all,
    loading,
    filters,
    setFilter,
    isAdmin,
    updateItem,
    removeItem,
    addItem,
    search,
  });

  const customToolbarContent = config.customToolbarActions?.({
    items,
    allItems: all,
    filters,
    isAdmin,
    updateItem,
    addItem,
  });

  return (
    <AppShell
      title={config.title}
      subtitle={config.subtitle}
      toolbar={
        <div className="collection-toolbar space-y-2 py-2">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <h2 className="inline-flex min-h-11 items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground">
                <CollectionIcon className="h-4 w-4 shrink-0" />
                {config.title}
              </h2>
              <CountLabel
                count={loading ? undefined : count}
                noun={noun.toLowerCase()}
              />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {config.summary?.(items, isAdmin)}
              {customToolbarContent !== undefined ? (
                customToolbarContent
              ) : (
                isAdmin && (
                  <EntityFormDialog
                    mode="add"
                    config={config}
                    onSubmit={(values) => addItem(values)}
                    trigger={<ActionButton icon={Plus} label="Add" aria-label={`Add ${config.noun.singular}`} />}
                  />
                )
              )}
            </div>
          </div>
          <FilterBar
            config={config}
            filters={filters}
            setFilter={setFilter}
            countFor={countFor}
            search={search}
            setSearch={setSearch}
            sortControl={showSortToggle && !customViewContent ? (
              <Select value={sortKey} onValueChange={setSortKey}>
                <SelectTrigger aria-label={`Sort ${config.noun.plural.toLowerCase()}`} className="h-11 w-[168px] max-w-full shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.filter((option) => !option.hiddenWhen?.(filters)).map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      <span className="flex items-center gap-2">
                        {option.icon && <option.icon className="h-4 w-4" />}
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : undefined}
          />
        </div>
      }
    >
      {customViewContent ?? (
        <div
          className="collection-cards px-4 md:px-0"
          data-presentation={config.card.variant === 'text' ? 'reading' : config.card.imageIsContent || config.path === '/inspiration' ? 'gallery' : 'grid'}
          style={
            {
              '--card-aspect': config.card.aspect ?? '2 / 3',
            } as CSSProperties
          }
        >
          {loading ? (
            <CardGrid>
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className={layout.skeleton} />
              ))}
            </CardGrid>
          ) : count === 0 ? (
            <div className="py-20 text-center">
              <p className="text-muted-foreground font-serif text-lg italic">
                No {config.noun.plural.toLowerCase()} found
              </p>
              <p className="text-sm text-muted-foreground/70 mt-2">
                Try adjusting your search or add new {config.noun.plural.toLowerCase()}
              </p>
            </div>
          ) : groups ? (
            <div className="space-y-8 pb-4">
              {groups.map((group) => (
                <section key={group.key}>
                  <div className="flex items-center gap-4 mb-5">
                    <h3 className="text-lg font-semibold tracking-wide whitespace-nowrap">
                      <DotMatrixText text={group.label.toUpperCase()} size="xs" />
                    </h3>
                    <div className="h-px bg-border flex-1" />
                    <CountLabel count={group.items.length} />
                  </div>
                  <CardGrid>{cardsFor(group.items)}</CardGrid>
                </section>
              ))}
            </div>
          ) : (
            <CardGrid>{cardsFor(items)}</CardGrid>
          )}
        </div>
      )}
    </AppShell>
  );
}

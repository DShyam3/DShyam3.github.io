import { Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
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

  return (
    <AppShell
      title={config.title}
      subtitle={config.subtitle}
      toolbar={
        <>
          <FilterBar
            config={config}
            filters={filters}
            setFilter={setFilter}
            countFor={countFor}
            search={search}
            setSearch={setSearch}
          />

          <div className="flex items-center justify-between px-4 md:px-0 py-3">
            <div className="flex items-center gap-4">
              <CountLabel
                count={loading ? undefined : count}
                noun={noun.toLowerCase()}
              />
              {showSortToggle && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const next =
                      sortOptions[
                        (sortOptions.findIndex((o) => o.key === sortKey) + 1) %
                          sortOptions.length
                      ];
                    setSortKey(next.key);
                  }}
                  className="h-8 px-2.5 text-xs whitespace-nowrap gap-1.5"
                >
                  {activeSort?.icon && <activeSort.icon className="h-3.5 w-3.5" />}
                  <DotMatrixText text={(activeSort?.label ?? '').toUpperCase()} size="xs" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-4">
              {config.summary?.(items, isAdmin)}
              {isAdmin && (
                <EntityFormDialog
                  mode="add"
                  config={config}
                  onSubmit={(values) => addItem(values)}
                />
              )}
            </div>
          </div>
        </>
      }
    >
      <div className="px-4 md:px-0">
        {loading ? (
          <div className={layout.grid}>
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className={layout.skeleton} />
            ))}
          </div>
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
                <div className={layout.grid}>{cardsFor(group.items)}</div>
              </section>
            ))}
          </div>
        ) : (
          <div className={layout.grid}>{cardsFor(items)}</div>
        )}
      </div>
    </AppShell>
  );
}

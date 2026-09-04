import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useCollection } from '@/hooks/useCollection';
import { FilterBar } from './FilterBar';
import { EntityCard } from './EntityCard';
import { EntityFormDialog } from './EntityFormDialog';
import type { CollectionConfig, CollectionRow } from '@/lib/collections/types';

interface CollectionPageProps<T extends CollectionRow> {
  config: CollectionConfig<T>;
}

/**
 * The whole page for any collection: header, filter bar, count, add button,
 * grid, footer. Pages in src/pages/ become a one-line render of this.
 */
export function CollectionPage<T extends CollectionRow>({
  config,
}: CollectionPageProps<T>) {
  const { isAdmin } = useAuth();
  const {
    items,
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

  const count = items.length;
  const noun = count === 1 ? config.noun.singular : config.noun.plural;

  return (
    <div className="min-h-screen bg-background">
      <div className="wide-container">
        <Header title={config.title} subtitle={config.subtitle} />

        <FilterBar
          config={config}
          filters={filters}
          setFilter={setFilter}
          countFor={countFor}
          search={search}
          setSearch={setSearch}
        />

        <div className="flex items-center justify-between px-4 md:px-0 pt-6">
          <p className="text-sm text-muted-foreground">
            {loading ? '...' : `${count} ${noun.toLowerCase()}`}
          </p>
          {isAdmin && (
            <EntityFormDialog
              mode="add"
              config={config}
              onSubmit={(values) => addItem(values)}
            />
          )}
        </div>

        <div className="px-4 md:px-0">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-8">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-8">
              {items.map((item, index) => (
                <EntityCard
                  key={item.id}
                  item={item}
                  config={config}
                  index={index}
                  onUpdate={isAdmin ? updateItem : undefined}
                  onRemove={isAdmin ? removeItem : undefined}
                />
              ))}
            </div>
          )}
        </div>

        <Footer />
      </div>
    </div>
  );
}

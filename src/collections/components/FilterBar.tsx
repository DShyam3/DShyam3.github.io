import { cn } from '@/lib/utils';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { SearchBar } from '@/components/shared/SearchBar';
import { ALL } from '../useCollection';
import type { CollectionConfig, CollectionRow } from '../types';

interface FilterBarProps<T extends CollectionRow> {
  config: CollectionConfig<T>;
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  countFor: (facetKey: string, optionKey: string) => number;
  search: string;
  setSearch: (value: string) => void;
}

/**
 * Category nav plus, when the config declares searchFields, a search box.
 *
 * The search box being here is a fix as much as a refactor: Links.tsx passed
 * searchQuery/onSearchChange to <Header>, which accepts neither, so the props
 * were silently dropped and the page's search state drove nothing.
 */
export function FilterBar<T extends CollectionRow>({
  config,
  filters,
  setFilter,
  countFor,
  search,
  setSearch,
}: FilterBarProps<T>) {
  const showSearch = Boolean(config.searchFields?.length);

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border/50 px-4 md:px-0 gap-4">
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {config.facets.map((facet) => {
          const options = [{ key: ALL, label: 'All' }, ...facet.options];
          const active = filters[facet.key] ?? ALL;

          return (
            <nav
              key={facet.key}
              className="flex flex-nowrap items-center gap-2 md:gap-4 py-4 overflow-x-auto scrollbar-hide"
            >
              {options.map((option, index) => (
                <div key={option.key} className="flex items-center gap-2 md:gap-4 shrink-0">
                  <button
                    onClick={() => setFilter(facet.key, option.key)}
                    className={cn(
                      'nav-link relative py-1 shrink-0',
                      active === option.key && 'nav-link-active',
                    )}
                  >
                    <DotMatrixText
                      text={option.label.toUpperCase()}
                      size="xs"
                      wrap={false}
                    />
                    <span className="ml-1.5 text-xs text-muted-foreground/60 whitespace-nowrap">
                      ({countFor(facet.key, option.key)})
                    </span>
                  </button>
                  {index < options.length - 1 && (
                    <span className="text-muted-foreground/30 hidden md:inline">·</span>
                  )}
                </div>
              ))}
            </nav>
          );
        })}
      </div>

      {showSearch && (
        <div className="w-full md:w-[200px] lg:w-[260px] pb-4 md:pb-0">
          <SearchBar
            query={search}
            onChange={setSearch}
            placeholder={`Search ${config.noun.plural}...`}
          />
        </div>
      )}
    </div>
  );
}

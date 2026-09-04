import { cn } from '@/lib/utils';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { SearchBar } from '@/components/shared/SearchBar';
import { ALL } from '../useCollection';
import type { CollectionConfig, CollectionRow } from '../types';

interface FilterBarProps<T extends CollectionRow, R> {
  config: CollectionConfig<T, R>;
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
export function FilterBar<T extends CollectionRow, R>({
  config,
  filters,
  setFilter,
  countFor,
  search,
  setSearch,
}: FilterBarProps<T, R>) {
  const showSearch = Boolean(config.searchFields?.length);

  // Photos and beliefs have neither facets nor search; render nothing rather
  // than an empty bordered strip.
  if (!config.facets.length && !showSearch) return null;

  return (
    // items-start, not items-center: the search box lines up with the *first*
    // facet row rather than floating between two of them, which is what left
    // the gap between "Tech + EDC" and "All" looking like dead space.
    <div className="flex flex-col md:flex-row md:items-start justify-between border-b border-border/50 px-4 md:px-0 gap-4 md:gap-6 py-3 md:py-2">
      <div className="flex flex-col flex-1 min-w-0">
        {config.facets.map((facet) => {
          const options =
            facet.includeAll === false
              ? facet.options
              : [{ key: ALL, label: 'All' }, ...facet.options];
          const active = filters[facet.key] ?? ALL;

          return (
            <nav
              key={facet.key}
              className="flex flex-nowrap items-center gap-2 md:gap-4 py-1.5 overflow-x-auto scrollbar-hide"
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
                    <DotMatrixText
                      text={`(${countFor(facet.key, option.key)})`}
                      size="xs"
                      wrap={false}
                      className="ml-1.5"
                    />
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
        <div className="w-full md:w-[200px] lg:w-[260px] shrink-0">
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

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
    //
    // Each facet row wraps rather than scrolling. The old `overflow-x-auto
    // scrollbar-hide` hid options off the right edge with no scrollbar, no
    // fade and no arrows, so on a narrow viewport a scrolled row silently
    // dropped "Tech + EDC" with nothing to say it was still there. The
    // interpuncts went with it: a wrapped row leaves one dangling at the end
    // of a line, so spacing carries the separation instead.
    <div className="flex flex-col md:flex-row md:items-start justify-between border-b border-border/50 px-4 md:px-0 gap-4 md:gap-6 py-3 md:py-2">
      <div className="flex flex-col flex-1 min-w-0">
        {config.facets.map((facet) => {
          const all = { key: ALL, label: 'All' };
          const options =
            facet.includeAll === false
              ? facet.options
              : facet.allLast
                ? [...facet.options, all]
                : [all, ...facet.options];
          const active = filters[facet.key] ?? ALL;

          return (
            <nav
              key={facet.key}
              aria-label={`${facet.key} filter`}
              className="flex flex-wrap items-center gap-x-4 md:gap-x-5 gap-y-1 py-1.5"
            >
              {options.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setFilter(facet.key, option.key)}
                  aria-pressed={active === option.key}
                  className={cn(
                    'nav-link relative py-1',
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

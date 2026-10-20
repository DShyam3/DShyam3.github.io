import type { ReactNode } from 'react';
import { Filter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL } from '../useCollection';
import type { CollectionConfig, CollectionRow, FacetDef } from '../types';

interface FilterBarProps<T extends CollectionRow, R> {
  config: CollectionConfig<T, R>;
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  countFor: (facetKey: string, optionKey: string) => number;
  search: string;
  setSearch: (value: string) => void;
  sortControl?: ReactNode;
}

/** Collection controls use the same compact rows as the watchlist library. */
export function FilterBar<T extends CollectionRow, R>({
  config,
  filters,
  setFilter,
  countFor,
  search,
  setSearch,
  sortControl,
}: FilterBarProps<T, R>) {
  const showSearch = Boolean(config.searchFields?.length);
  const [primaryFacet, ...extraFacets] = config.facets.filter((facet) => !facet.hiddenWhen?.(filters));
  const activeFilterCount = extraFacets.filter(
    (facet) => (filters[facet.key] ?? ALL) !== (facet.defaultValue ?? ALL),
  ).length;

  if (!primaryFacet && !showSearch && !sortControl) return null;

  const facetSelect = (facet: FacetDef<T>, primary = false) => {
    const all = { key: ALL, label: 'All' };
    const options = facet.includeAll === false
      ? facet.options
      : facet.allLast ? [...facet.options, all] : [all, ...facet.options];
    const label = facet.label ?? facet.key.replace(/[_-]/g, ' ').replace(/^./, (letter) => letter.toUpperCase());

    return (
      <div key={facet.key} className={primary ? 'w-[210px] max-w-full shrink-0' : 'space-y-2'}>
        {!primary && <p className="text-sm font-medium">{label}</p>}
        <Select value={filters[facet.key] ?? ALL} onValueChange={(value) => setFilter(facet.key, value)}>
          <SelectTrigger aria-label={`${label} filter`} className="h-11 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label} ({countFor(facet.key, option.key)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {primaryFacet && facetSelect(primaryFacet, true)}
      {showSearch && (
        <div className="relative min-w-[150px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={`Search ${config.noun.plural.toLowerCase()}`}
            placeholder={`Search ${config.noun.plural.toLowerCase()}…`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full pl-9 pr-10"
          />
          {search && (
            <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-11 w-11" aria-label="Clear search" onClick={() => setSearch('')}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
      {extraFacets.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-11 gap-2">
              <Filter className="h-4 w-4" />Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            collisionPadding={12}
            className="w-80 max-w-[calc(100vw-24px)] overflow-y-auto overscroll-contain space-y-3"
            style={{ maxHeight: 'min(480px, var(--radix-popover-content-available-height))' }}
            aria-label={`${config.noun.plural} filters`}
          >
            <h3 className="font-medium">Filter {config.noun.plural.toLowerCase()}</h3>
            {extraFacets.map((facet) => facetSelect(facet))}
          </PopoverContent>
        </Popover>
      )}
      {sortControl}
    </div>
  );
}

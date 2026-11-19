import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Film, Sparkles, Tv } from 'lucide-react';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import type { LanguageGroup } from '@/features/watchlist/language-groups';

interface LanguageGroupedSectionsProps<T> {
  groups: LanguageGroup<T>[];
  renderGrid: (items: T[]) => React.ReactNode;
  forceExpand?: boolean;
}

/**
 * Renders language-grouped sections with collapsible headers and automatic
 * Movies / TV Shows / Cartoons sub-sections (skipping the sub-header when a
 * language only has one type).
 */
export function LanguageGroupedSections<T>({
  groups,
  renderGrid,
  forceExpand = false,
}: LanguageGroupedSectionsProps<T>) {
  const [toggles, setToggles] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string, currentCollapsed: boolean) => {
    setToggles((prev) => ({ ...prev, [key]: !currentCollapsed }));
  };

  return (
    <div className="space-y-8">
      {groups.map((group) => {
        const isCollapsed = forceExpand
          ? false
          : (toggles[group.key] ?? group.defaultCollapsed);

        const subSections = [
          {
            key: 'movies',
            label: 'Movies',
            icon: <Film className="h-3.5 w-3.5" />,
            items: group.movies,
          },
          {
            key: 'tv',
            label: 'TV Shows',
            icon: <Tv className="h-3.5 w-3.5" />,
            items: group.tvShows,
          },
          {
            key: 'cartoons',
            label: 'Cartoons',
            icon: <Sparkles className="h-3.5 w-3.5" />,
            items: group.cartoons,
          },
        ].filter((sub) => sub.items.length > 0);

        return (
          <section
            key={group.key}
            className="space-y-4 border-b border-border/40 pb-6 last:border-b-0"
          >
            <button
              type="button"
              aria-expanded={!isCollapsed}
              onClick={() => toggleGroup(group.key, isCollapsed)}
              className="flex items-center gap-2 text-left group/header focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover/header:text-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-colors group-hover/header:text-foreground" />
              )}
              <DotMatrixText text={group.label.toUpperCase()} size="xs" />
              <DotMatrixText text={`(${group.items.length})`} size="xs" />
            </button>

            {!isCollapsed &&
              (subSections.length === 1 ? (
                renderGrid(subSections[0].items)
              ) : (
                <div className="space-y-4">
                  {subSections.map((sub, idx) => (
                    <div key={sub.key} className={idx > 0 ? 'space-y-2 pt-2' : 'space-y-2'}>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 font-medium pl-1">
                        {sub.icon}
                        <span>
                          {sub.label} ({sub.items.length})
                        </span>
                      </div>
                      {renderGrid(sub.items)}
                    </div>
                  ))}
                </div>
              ))}
          </section>
        );
      })}
    </div>
  );
}

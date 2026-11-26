import * as React from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import { SFCompassDrawing, type SFSymbolComponent } from './sf-symbols';
import { ALL_APP_MANIFESTS } from '@/apps/useActiveApp';
import { cn } from '@/lib/utils';

export type AnyIconComponent = SFSymbolComponent | LucideIcon;

export interface AppIconProps extends Omit<LucideProps, 'ref'> {
  icon: AnyIconComponent;
  /** Whether the parent control/tab/item is currently active/selected. */
  active?: boolean;
  /**
   * For Lucide outline icons, fill the interior when active.
   * Apple SF Symbols (`SF*`) are already hierarchical/dualtone filled glyphs.
   */
  filledWhenActive?: boolean;
}

function isSFSymbol(icon: AnyIconComponent): icon is SFSymbolComponent {
  return Boolean(icon.displayName?.startsWith('SF'));
}

/**
 * Centralized Apple icon primitive.
 *
 * - Renders genuine Apple SF Symbols 7.3 dualtone/hierarchical SVG components (`SF*`)
 *   with crisp currentColor fills.
 * - Also accepts any `lucide-react` icon with a 1.75px Apple optical stroke weight.
 */
export const AppIcon = React.forwardRef<SVGSVGElement, AppIconProps>(
  ({ icon: Icon, active = false, filledWhenActive = false, strokeWidth, className, ...props }, ref) => {
    if (isSFSymbol(Icon)) {
      return (
        <Icon
          ref={ref}
          className={cn(
            'shrink-0 transition-[transform,color,opacity] duration-150 ease-out',
            className,
          )}
          {...props}
        />
      );
    }

    const LucideComp = Icon as LucideIcon;
    const isFilled = active && filledWhenActive;
    const resolvedStroke = strokeWidth ?? (isFilled ? 2 : 1.75);

    return (
      <LucideComp
        ref={ref}
        strokeWidth={resolvedStroke}
        aria-hidden="true"
        className={cn(
          'shrink-0 transition-[transform,color,fill] duration-150 ease-out',
          isFilled && 'fill-current',
          className,
        )}
        {...props}
      />
    );
  },
);
AppIcon.displayName = 'AppIcon';

/**
 * Canonical Apple SF Symbol map derived from `ALL_APP_MANIFESTS` so adding an
 * app to the registry automatically wires its icon everywhere.
 */
export const SECTION_ICONS: Record<string, SFSymbolComponent> = Object.fromEntries(
  ALL_APP_MANIFESTS.map((app) => [app.basePath, app.icon]),
);

export function getSectionIcon(path: string): SFSymbolComponent {
  return SECTION_ICONS[path] ?? SFCompassDrawing;
}

import { forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { cn } from '@/lib/utils';

interface ActionButtonProps extends React.ComponentPropsWithoutRef<typeof Button> {
  /** Sits left of the label, e.g. Plus for an add button. */
  icon?: LucideIcon;
  /** Set in the dot-matrix face and upper-cased, like the nav. */
  label: string;
  /** e.g. animate-spin while a upload is in flight. */
  iconClassName?: string;
  /** e.g. hidden lg:inline-flex where the row is tight and the icon says enough. */
  labelClassName?: string;
}

/**
 * A labelled action button -- "Add Item", "Download CV" -- in the site's own
 * dot-matrix face.
 *
 * The Watchlist's add button already looked like this and every other one did
 * not, because each page built its own <Button> with a plain text label. One
 * component means they cannot drift again, and a new page gets the right
 * button by using it rather than by remembering the recipe.
 *
 * forwardRef because Radix's DialogTrigger with `asChild` hands its trigger
 * props and a ref to whatever it wraps.
 */
export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      icon: Icon,
      label,
      iconClassName,
      labelClassName,
      className,
      variant = 'ghost',
      size = 'sm',
      ...props
    },
    ref,
  ) => (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn('gap-1.5 h-8 sm:h-9', className)}
      {...props}
    >
      {Icon && <Icon className={cn('h-4 w-4 shrink-0', iconClassName)} />}
      <DotMatrixText
        text={label.toUpperCase()}
        size="xs"
        wrap={false}
        className={labelClassName}
      />
    </Button>
  ),
);

ActionButton.displayName = 'ActionButton';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Classes for the positioning wrapper, which is the element a layout sees. */
  wrapperClassName?: string;
}

/**
 * A native `<select>` with the browser's arrow hidden and a ChevronDown drawn in
 * the theme's muted colour instead: the site sets no `color-scheme`, so the
 * browser's own arrow is not themed. 44px tall unless the caller overrides it.
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, wrapperClassName, children, ...props }, ref) => (
    <div className={cn('relative', wrapperClassName)}>
      <select
        ref={ref}
        className={cn(
          'block h-11 w-full min-w-0 cursor-pointer appearance-none bg-none [-webkit-appearance:none] [-moz-appearance:none] pl-3 pr-10',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  ),
);
NativeSelect.displayName = 'NativeSelect';

export { NativeSelect };

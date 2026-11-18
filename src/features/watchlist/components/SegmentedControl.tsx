import { cn } from '@/lib/utils';

interface SegmentedControlProps<T extends string> {
  /** Names the group for assistive technology. */
  label: string;
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (value: NoInfer<T>) => void;
  className?: string;
}

/**
 * The Watchlist's one pill switch: News views, the week/month window and the
 * films/series filter all use it, so they read as the same kind of control.
 * The selected option is a filled --primary pill; a weight or tint change
 * alone was not visible enough in light mode. 44px tall for touch.
 */
export function SegmentedControl<T extends string>({ label, options, value, onChange, className }: SegmentedControlProps<T>) {
  return (
    // One choice of several: radio semantics, not toggle buttons.
    <div role="radiogroup" aria-label={label} className={cn('inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border/70 bg-card/60 p-0.5', className)}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.key)}
            className={cn(
              'h-11 whitespace-nowrap rounded-full px-3 text-sm transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              selected ? 'bg-primary text-primary-foreground' : 'text-foreground/75 hover:bg-muted hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

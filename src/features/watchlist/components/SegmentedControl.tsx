import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { SPRING_PILL } from '@/theme/motion';
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
 * The selected option is a filled --primary pill that glides across options
 * via a shared-layout pill indicator (`transitions.dev` tabs-sliding).
 * 44px tall for touch.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const pillId = useId();
  const prefersReducedMotion = useReducedMotion();

  return (
    // One choice of several: radio semantics, not toggle buttons.
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border/70 bg-card/60 p-0.5',
        className,
      )}
    >
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
              't-press relative isolate h-11 whitespace-nowrap rounded-full px-3 text-sm transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              selected
                ? 'text-primary-foreground'
                : 'text-foreground/75 hover:bg-muted/70 hover:text-foreground',
            )}
          >
            {selected ? (
              prefersReducedMotion ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-full bg-primary"
                />
              ) : (
                <motion.span
                  layoutId={`${pillId}-pill`}
                  transition={SPRING_PILL}
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-full bg-primary"
                />
              )
            ) : null}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

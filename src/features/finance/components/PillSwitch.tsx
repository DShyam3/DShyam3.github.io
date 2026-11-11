import { cn } from '@/lib/utils';

/**
 * A segmented control: one pressed button out of a few. Full width on a phone,
 * shrink-wrapped from `sm` up; buttons size to their labels and wrap onto a
 * new row, which stretches to fill, when they do not fit on one.
 */
export function PillSwitch<T extends string>({ label, options, value, onChange, className }: {
  label: string;
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (value: NoInfer<T>) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex flex-wrap w-full sm:w-fit max-w-full bg-muted/20 border border-border/30 rounded-lg p-0.5 gap-0.5 font-mono', className)}>
      {options.map(opt => {
        const isActive = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(opt.key)}
            className={cn(
              'flex-auto px-2.5 py-1 text-xs leading-tight font-mono rounded-md transition-all whitespace-nowrap text-center',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

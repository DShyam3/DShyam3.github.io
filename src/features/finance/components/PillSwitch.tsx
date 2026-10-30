import { cn } from '@/lib/utils';

/**
 * A segmented control: one pressed button out of a few. Full width and evenly
 * split on a phone, shrink-wrapped from `sm` up.
 */
export function PillSwitch<T extends string>({ label, options, value, onChange, className }: {
  label: string;
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (value: NoInfer<T>) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('grid w-full grid-flow-col auto-cols-fr sm:flex sm:w-fit bg-muted/20 border border-border/30 rounded-lg p-0.5 gap-0.5 font-mono', className)}>
      {options.map(opt => {
        const isActive = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(opt.key)}
            className={cn(
              'px-1.5 sm:px-2.5 py-1 text-xs leading-tight font-mono rounded-md transition-all sm:whitespace-nowrap',
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

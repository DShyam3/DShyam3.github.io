import { cn } from '@/lib/utils';
import type { ShowTracking } from '@/features/watchlist/useWatchlist';

interface TrackingControlProps {
  value: ShowTracking;
  editable: boolean;
  onChange: (tracking: ShowTracking) => void;
}

const OPTIONS: { key: ShowTracking; label: string }[] = [
  { key: 'active', label: 'Watching' },
  { key: 'paused', label: 'Paused' },
  { key: 'dropped', label: 'Dropped' },
];

const EXPLANATION: Record<ShowTracking, string> = {
  active: 'In Watch Next and Your Week.',
  paused: 'Left out of Watch Next and Your Week until you resume it.',
  dropped: 'Left out of Watch Next, Your Week and News.',
};

export function TrackingControl({ value, editable, onChange }: TrackingControlProps) {
  if (!editable) {
    if (value === 'active') return null;
    return (
      <span className="inline-flex rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground">
        {value === 'paused' ? 'Paused' : 'Dropped'}
      </span>
    );
  }

  return (
    <div className="space-y-1.5">
      <div
        role="group"
        aria-label="Tracking"
        className="inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-card/60 p-0.5"
      >
        {OPTIONS.map((option) => {
          const selected = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              aria-pressed={selected}
              className={cn(
                'min-h-10 rounded-full px-3 text-xs font-medium transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                selected
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground/75 hover:bg-muted hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{EXPLANATION[value]}</p>
    </div>
  );
}

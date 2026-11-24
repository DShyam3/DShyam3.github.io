import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { PERSONAL_RATING_SCORES } from '../library-state';

interface PersonalRatingProps {
  label: string;
  value?: number | null;
  onChange?: (value: number | null) => Promise<void>;
  /** Shown in place of the label as a highlighted, easy-to-skip line. */
  prompt?: string;
  onSkip?: () => void;
  /** Moves focus to Rate when it appears, for a prompt that replaced what had focus. */
  autoFocus?: boolean;
  /** False where the prompt or label is already shown beside it, as on a Discover tile. */
  showLabel?: boolean;
}


/** A personal score. Empty is unrated, never zero. */
export function PersonalRating({ label, value, onChange, prompt, onSkip, autoFocus, showLabel = true }: PersonalRatingProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!onChange) {
    if (value == null) return null;
    return (
      <span
        className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums text-muted-foreground"
        aria-label={`${label}: ${value}/10`}
      >
        {value}/10
      </span>
    );
  }

  const pick = async (next: number | null) => {
    setOpen(false);
    setSaving(true);
    setFailed(false);
    try { await onChange(next); } catch { setFailed(true); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-1" onClick={(event) => event.stopPropagation()}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {showLabel && (
          <span className={cn('text-xs', prompt ? 'font-medium text-primary' : 'text-muted-foreground')}>
            {prompt ?? label}
          </span>
        )}
        <div className="flex items-center gap-1">
          {prompt && onSkip && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 text-xs"
              onClick={onSkip}
              aria-label={showLabel ? undefined : `Skip: ${label}`}
            >
              Skip
            </Button>
          )}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={saving}
                autoFocus={autoFocus}
                aria-label={value == null ? `${label}: Rate` : `${label}: ${value}/10`}
                className="inline-flex h-9 min-h-9 min-w-9 items-center justify-center rounded-full border border-border bg-background px-2.5 text-xs text-foreground disabled:opacity-50"
              >
                {value == null ? 'Rate' : (
                  <span className="tabular-nums">
                    {value}<span className="text-muted-foreground">/10</span>
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" collisionPadding={12} className="w-72 max-w-[calc(100vw-24px)] space-y-2 p-2">
              <div className="grid grid-cols-5 gap-1">
                {PERSONAL_RATING_SCORES.map((score) => (
                  <button
                    key={score}
                    type="button"
                    aria-pressed={value === score}
                    aria-label={`${score} out of 10`}
                    onClick={() => void pick(score)}
                    className={cn(
                      'min-h-11 rounded-md text-sm tabular-nums',
                      value === score ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary',
                    )}
                  >
                    {score}
                  </button>
                ))}
              </div>
              {value != null && (
                <Button type="button" variant="ghost" className="min-h-11 w-full" onClick={() => void pick(null)}>
                  Clear rating
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {saving && <p role="status" className="text-xs text-muted-foreground">Saving…</p>}
      {failed && <p role="alert" className="text-xs text-destructive">Could not save your rating. Please try again.</p>}
    </div>
  );
}

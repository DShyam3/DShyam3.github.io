import { useState, type ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  isCalendarDate,
  isOnOrBefore,
  todayLocal,
  type WatchedWhen,
} from '@/features/watchlist/watched-when';

interface WatchedWhenMenuProps {
  onPick: (when: WatchedWhen) => void;
  releaseDate?: string;
  disabled?: boolean;
  /** Replaces "On release date (…)": a series dates each episode by its own air date. */
  releaseText?: string;
  /** The trigger label. */
  children: ReactNode;
  className?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  /** For an icon-only trigger. */
  label?: string;
}

/** Marks something watched, asking when: now, on release, unknown, or a picked day. */
export function WatchedWhenMenu({
  onPick,
  releaseDate,
  releaseText,
  disabled,
  children,
  className,
  variant,
  size = 'sm',
  label,
}: WatchedWhenMenuProps) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState('');
  const today = todayLocal();
  const valid = isCalendarDate(date) && isOnOrBefore(date, today);

  const pick = (when: WatchedWhen) => {
    setOpen(false);
    onPick(when);
  };

  const notOutYet = !!releaseDate && !isOnOrBefore(releaseDate.slice(0, 10), today);

  const releaseLabel = releaseDate
    ? new Date(releaseDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setPicking(false);
          setDate('');
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          disabled={disabled}
          aria-label={label}
          title={label}
          className={cn('min-h-10 gap-2 text-xs', className)}
        >
          {children}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        {picking ? (
          <form
            className="space-y-2 p-2"
            // Keys typed in the date field must not reach the menu's typeahead.
            onKeyDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              if (valid) pick({ mode: 'at', date });
            }}
          >
            <label className="block space-y-1 text-xs text-muted-foreground">
              <span>Date watched</span>
              <Input
                type="date"
                value={date}
                max={today}
                onChange={(event) => setDate(event.target.value)}
                className="min-h-10"
              />
            </label>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={!valid} className="min-h-10 flex-1 text-xs">
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPicking(false)}
                className="min-h-10 text-xs"
              >
                Back
              </Button>
            </div>
          </form>
        ) : (
          <>
            <DropdownMenuItem className="min-h-10" onSelect={() => pick({ mode: 'now' })}>
              Just now
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-10"
              disabled={!releaseDate || notOutYet}
              onSelect={() => pick({ mode: 'release' })}
            >
              {releaseText ?? `On release date${releaseLabel ? ` (${releaseLabel}${notOutYet ? ', not out yet' : ''})` : ''}`}
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-10" onSelect={() => pick({ mode: 'unknown' })}>
              Date unknown
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-10"
              onSelect={(event) => {
                event.preventDefault();
                setPicking(true);
              }}
            >
              Pick a date…
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

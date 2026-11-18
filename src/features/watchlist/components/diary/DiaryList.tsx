import { useState } from 'react';
import { Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { localNoonIso, todayLocal } from '@/features/watchlist/watched-when';
import type { Diary, DiaryRow } from '@/features/watchlist/diary';
import { formatDayHeading, formatMinutes, formatTotal } from './format';

const DAYS_PER_PAGE = 60;

type SetDate = (row: DiaryRow, watchedAt: string | null) => Promise<void>;

function EditDate({ row, onSave }: { row: DiaryRow; onSave: SetDate }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = async (watchedAt: string | null) => {
    setBusy(true);
    setFailed(false);
    try {
      await onSave(row, watchedAt);
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="min-h-11 shrink-0 text-xs" aria-label={`Edit date for ${row.title}`}>Edit date</Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3">
        <label className="block space-y-1 text-sm">
          <span>Watched on</span>
          <input
            type="date"
            value={date}
            max={todayLocal()}
            onChange={(event) => setDate(event.target.value)}
            className="h-11 w-full rounded-lg border bg-background px-3 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="min-h-11" disabled={busy || !date} onClick={() => void save(localNoonIso(date))}>Save</Button>
          <Button size="sm" variant="outline" className="min-h-11" disabled={busy} onClick={() => void save(null)}>Date unknown</Button>
        </div>
        {failed && <p role="alert" className="text-xs text-muted-foreground">Could not save the date</p>}
      </PopoverContent>
    </Popover>
  );
}

function Row({ row, onSetDate }: { row: DiaryRow; onSetDate?: SetDate }) {
  const [broken, setBroken] = useState(false);
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="aspect-[2/3] w-9 shrink-0 overflow-hidden rounded bg-muted">
        {row.poster && !broken ? (
          <img src={row.poster} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-contain" />
        ) : (
          <span className="flex h-full items-center justify-center"><Tv className="h-3.5 w-3.5" /></span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif text-sm font-medium sm:text-base">{row.title}</span>
        <span className="block text-xs text-muted-foreground">{row.kind === 'movie' ? 'Film' : row.label}</span>
      </span>
      <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:text-sm">
        {row.minutes > 0 || row.unknownRuntime === 0 ? formatMinutes(row.minutes) : 'Unknown length'}
      </span>
      {onSetDate && <EditDate row={row} onSave={onSetDate} />}
    </li>
  );
}

/** The diary's day groups, newest first, 60 days at a time. */
export function DiaryList({ diary, onSetDate }: { diary: Diary; onSetDate?: SetDate }) {
  const [shown, setShown] = useState(DAYS_PER_PAGE);

  if (diary.days.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Nothing in the diary yet. Marking episodes and films watched adds them here.</p>
        {diary.undated > 0 && <p className="text-xs text-muted-foreground">{diary.undated} watched with no date — not shown here</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {diary.days.slice(0, shown).map((day) => (
        <section key={day.day} aria-label={formatDayHeading(day.day)} className="space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-border/60 pb-1">
            <h2 className="font-serif text-base font-semibold">{formatDayHeading(day.day)}</h2>
            <span className="text-xs tabular-nums text-muted-foreground">{formatTotal(day.minutes, day.unknownRuntime)}</span>
          </div>
          <ul className="divide-y divide-border/50">
            {day.rows.map((row) => <Row key={row.key} row={row} onSetDate={onSetDate} />)}
          </ul>
        </section>
      ))}
      {shown < diary.days.length && (
        <Button variant="outline" className="min-h-11" onClick={() => setShown((count) => count + DAYS_PER_PAGE)}>Show more</Button>
      )}
      {diary.undated > 0 && <p className="text-xs text-muted-foreground">{diary.undated} watched with no date — not shown here</p>}
    </div>
  );
}

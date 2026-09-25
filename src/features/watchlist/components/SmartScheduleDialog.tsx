import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { WatchlistItem } from '@/features/watchlist/useWatchlist';
import type { ScheduleItem } from '@/features/watchlist/useSchedule';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function validDate(value?: string): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()) && localDate(new Date(`${value}T12:00:00`)) === value;
}

export function scheduleReleaseDate(item: WatchlistItem) {
  const today = localDate(new Date());
  const episodes = (item.seasons ?? []).flatMap((season) => season.episodes.map((episode) => episode.release_date)).filter(validDate).sort();
  const seasons = (item.seasons ?? []).map((season) => season.release_date).filter(validDate).sort();
  return episodes.find((date) => date >= today) ?? episodes.at(-1) ?? seasons.at(-1) ?? item.release_date;
}

interface SmartScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  releaseDate?: string;
  defaultMode: 'weekly' | 'date';
  onAdd: (day: ScheduleItem['day'], date: string, mode: 'weekly' | 'date') => void;
}

export function SmartScheduleDialog(props: SmartScheduleDialogProps) {
  // Unmount the choices on close so each opening uses the latest release data.
  return props.open ? <ScheduleChoices {...props} /> : null;
}

function ScheduleChoices({ open, onOpenChange, title, releaseDate, defaultMode, onAdd }: SmartScheduleDialogProps) {
  const knownReleaseDate = validDate(releaseDate) ? releaseDate : undefined;
  const [mode, setMode] = useState(defaultMode);
  const [day, setDay] = useState<ScheduleItem['day'] | undefined>(knownReleaseDate ? DAYS[new Date(`${knownReleaseDate}T12:00:00`).getDay()] : undefined);
  const [date, setDate] = useState(knownReleaseDate ?? localDate(new Date()));
  const canAdd = mode === 'weekly' ? !!day : validDate(date);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Smart scheduling</DialogTitle>
          <DialogDescription>
            {title}. {mode === 'weekly'
              ? knownReleaseDate ? `Release weekday selected from ${knownReleaseDate}. Keep this title on your weekly schedule.` : 'No release date is available. Choose a day for your weekly schedule.'
              : 'Add this title once on the selected date.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={mode === 'weekly' ? 'default' : 'outline'} aria-pressed={mode === 'weekly'} onClick={() => setMode('weekly')}>Weekly release day</Button>
          <Button type="button" variant={mode === 'date' ? 'default' : 'outline'} aria-pressed={mode === 'date'} onClick={() => setMode('date')}>One-off date</Button>
        </div>
        {mode === 'weekly' ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Day of the week">
            {[...DAYS.slice(1), DAYS[0]].map((weekday) => (
              <Button key={weekday} type="button" aria-label={weekday} aria-pressed={day === weekday} variant={day === weekday ? 'default' : 'outline'} onClick={() => setDay(weekday)}>{weekday.slice(0, 3)}</Button>
            ))}
          </div>
        ) : (
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Date</span>
            <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="h-11 rounded-md border bg-background px-3" />
          </label>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" className="flex-1" disabled={!canAdd} onClick={() => {
            if (!canAdd) return;
            const selectedDay = mode === 'date' ? DAYS[new Date(`${date}T12:00:00`).getDay()] : day;
            if (!selectedDay) return;
            onAdd(selectedDay, date, mode);
            onOpenChange(false);
          }}>{mode === 'weekly' ? 'Add weekly schedule' : 'Add date to schedule'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, type ComponentProps } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import type { ScheduleItem as ScheduleEntry } from '@/features/watchlist/useSchedule';
import type { WatchlistItem } from '@/features/watchlist/useWatchlist';
import { buildCalendarEvents, calendarDateKey, calendarWeekStart, type CalendarEvent } from '@/features/watchlist/calendar';
import { ScheduleItem } from './ScheduleItem';
import { SmartScheduleDialog } from './SmartScheduleDialog';
import { WatchlistDetailDialog } from './WatchlistDetailDialog';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { cn } from '@/lib/utils';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
type ScheduleActions = Pick<ComponentProps<typeof ScheduleItem>, 'removeFromSchedule' | 'updateScheduleDay' | 'toggleEpisodeWatched' | 'isEpisodeWatched' | 'isSeasonWatched' | 'getAutoStatus' | 'addToSchedule' | 'isInSchedule'>;

interface YourWeekProps extends ScheduleActions {
  schedule: ScheduleEntry[];
  watchlist: WatchlistItem[];
  loading: boolean;
}

export function YourWeek({ schedule, watchlist, loading, ...actions }: YourWeekProps) {
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<'week' | 'month'>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [scheduleEvent, setScheduleEvent] = useState<CalendarEvent | null>(null);
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const today = new Date();
  const todayKey = calendarDateKey(today);
  const events = buildCalendarEvents(schedule, watchlist, actions.isEpisodeWatched, today);
  const selectedItem = selectedEvent && (watchlist.find((item) => item.id === selectedEvent.item.id && item.category === selectedEvent.item.category) ?? selectedEvent.item);

  const datesFrom = (start: Date, count: number) => Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return date;
  });
  const weekDates = datesFrom(calendarWeekStart(anchor), 7);
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const monthGridStart = calendarWeekStart(monthStart);
  const monthGridEnd = calendarWeekStart(monthEnd);
  monthGridEnd.setDate(monthGridEnd.getDate() + 6);
  const monthDates: Date[] = [];
  for (const date = new Date(monthGridStart); date <= monthGridEnd; date.setDate(date.getDate() + 1)) monthDates.push(new Date(date));
  const inMonth = (date: Date) => date.getMonth() === anchor.getMonth() && date.getFullYear() === anchor.getFullYear();
  const monthHasEvents = events.some((event) => event.date >= calendarDateKey(monthStart) && event.date <= calendarDateKey(monthEnd));
  const releaseCaption = (event: CalendarEvent) => event.releaseDate
    ? `${event.unreleased ? 'Releases' : 'Released'} ${new Date(`${event.releaseDate}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : 'Release date unknown';

  const renderEvent = (event: CalendarEvent) => (
    <div key={event.id} className={cn('min-w-0 space-y-1', event.unreleased && 'opacity-60')}>
      {event.kind === 'plan' && event.schedule ? (
        <ScheduleItem {...actions} item={event.item} scheduleItem={event.schedule} updateScheduleDay={event.schedule.mode === 'date' ? undefined : actions.updateScheduleDay} />
      ) : (
        <div className="rounded-md border border-dashed border-border p-2">
          <p className="text-xs text-muted-foreground">Suggested release</p>
          <Button variant="ghost" className="h-auto w-full justify-start whitespace-normal px-0 py-1 text-left text-xs" onClick={() => setSelectedEvent(event)}>{event.item.title}</Button>
          {actions.addToSchedule && <Button variant="link" size="sm" className="h-auto whitespace-normal px-0 py-1 text-xs" onClick={() => setScheduleEvent(event)}>Add to schedule</Button>}
        </div>
      )}
      <p className="px-1.5 text-xs text-muted-foreground">{event.kind === 'plan' ? 'Planned · ' : ''}{event.label}</p>
      <p className="px-1.5 text-xs text-muted-foreground">{releaseCaption(event)}</p>
    </div>
  );

  const emptyMessage = (period: string) => (
    <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
      <p>No plans or suggested releases {period}. Add a title from News or Library.</p>
      <Button asChild variant="link" className="mt-1 h-auto px-0"><Link to="/watchlist/library">Browse your library</Link></Button>
    </div>
  );

  const renderAgenda = (dates: Date[], compact = false, month = false) => {
    if (!dates.some((date) => events.some((event) => event.date === calendarDateKey(date)))) return emptyMessage(month ? 'this month' : 'this week');
    return (
      <div className={cn('grid grid-cols-1 gap-2', !month && 'xl:grid-cols-7 xl:gap-3')}>
        {dates.map((date) => {
          const key = calendarDateKey(date);
          const dayEvents = events.filter((event) => event.date === key);
          const isToday = key === todayKey;
          if ((compact && !isToday || month) && dayEvents.length === 0) return null;
          return (
            <div key={key} className={cn('grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] gap-2 rounded-xl border p-3', !month && 'xl:block', isToday ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-card/40')}>
              <div className={cn('flex flex-col gap-1 text-sm', !month && 'xl:mb-2 xl:flex-row xl:flex-wrap xl:items-baseline xl:justify-between')}>
                <span className="font-medium">{date.toLocaleDateString('en-GB', { weekday: 'short' })} {isToday && <span className="text-xs text-primary">Today</span>}</span>
                <span className="text-xs text-muted-foreground">{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </div>
              <div className="min-w-0 space-y-2">
                {dayEvents.length === 0 && <p className="text-xs text-muted-foreground">No plans</p>}
                {dayEvents.map(renderEvent)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const navigate = (direction: number) => setAnchor((current) => view === 'month'
    ? new Date(current.getFullYear(), current.getMonth() + direction, 1)
    : new Date(current.getFullYear(), current.getMonth(), current.getDate() + direction * 7));

  return (
    <section id="your-week" className="col-span-full min-w-0 scroll-mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DotMatrixText text="YOUR WEEK" size="xs" />
        <Button variant="outline" size="sm" onClick={() => { setAnchor(new Date()); setView('week'); setExpanded(true); }}><CalendarDays className="h-4 w-4" />Expand calendar</Button>
      </div>
      <p className="text-xs text-muted-foreground">Your watching plans and suggested releases. Future weekly entries plan one episode per week and adjust with watched progress. Unknown release dates are not guessed.</p>
      {loading ? <p role="status" className="text-sm text-muted-foreground">Loading your schedule…</p> : renderAgenda(datesFrom(calendarWeekStart(today), 7), true)}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-[min(96vw,100rem)]">
          <DialogHeader className="shrink-0">
            <DialogTitle>Your calendar</DialogTitle>
            <DialogDescription>Future weekly entries plan one episode per week and adjust with watched progress. Suggestions are not scheduled until you add them. Unknown release dates are not guessed.</DialogDescription>
          </DialogHeader>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1" role="group" aria-label="Calendar view">
              <Button variant={view === 'week' ? 'default' : 'outline'} size="sm" aria-pressed={view === 'week'} onClick={() => setView('week')}>Week</Button>
              <Button variant={view === 'month' ? 'default' : 'outline'} size="sm" aria-pressed={view === 'month'} onClick={() => setView('month')}>Month</Button>
            </div>
            <p className="text-sm font-medium" aria-live="polite">{view === 'week' ? `Week of ${weekDates[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : anchor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" aria-label={`Previous ${view}`} onClick={() => navigate(-1)}><ChevronLeft /></Button>
              <Button variant="outline" onClick={() => setAnchor(new Date())}>{view === 'week' ? 'This week' : 'This month'}</Button>
              <Button variant="outline" size="icon" aria-label={`Next ${view}`} onClick={() => navigate(1)}><ChevronRight /></Button>
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto" role="region" aria-label={`${view === 'week' ? 'Week' : 'Month'} calendar`} tabIndex={0}>
            {loading ? <p role="status" className="text-sm text-muted-foreground">Loading your schedule…</p> : view === 'week' ? renderAgenda(weekDates) : (
              <>
                <div className="md:hidden">{renderAgenda(monthDates.filter(inMonth), false, true)}</div>
                <div className="hidden space-y-3 md:block">
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS.map((day) => <p key={day} className="px-2 text-xs font-medium text-muted-foreground">{day.slice(0, 3)}</p>)}
                    {monthDates.map((date) => {
                      const key = calendarDateKey(date);
                      return (
                        <div key={key} className={cn('min-h-24 min-w-0 space-y-1 rounded-lg border p-2', key === todayKey ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-card/40', !inMonth(date) && 'bg-muted/30')}>
                          <p className={cn('text-xs', !inMonth(date) && 'text-muted-foreground')}><time dateTime={key}>{date.getDate()}</time>{key === todayKey && <span className="ml-1 text-primary">Today</span>}</p>
                          {events.filter((event) => event.date === key).map((event) => (
                            <Button key={event.id} variant="ghost" className={cn('h-auto w-full flex-col items-start gap-1 rounded-md px-1 py-2 text-left whitespace-normal', event.kind === 'suggestion' && 'border border-dashed border-border', event.unreleased && 'opacity-60')} aria-label={`${event.item.title}, ${event.kind === 'plan' ? 'planned' : 'suggested release'}, ${event.label}, ${key}`} onClick={() => setSelectedEvent(event)}>
                              <span className="line-clamp-2 w-full break-words text-xs font-medium" title={event.item.title}>{event.item.title}</span>
                              <span className="line-clamp-2 text-xs text-muted-foreground" title={event.label}>{event.kind === 'plan' ? 'Planned' : 'Suggested'} · {event.label}</span>
                            </Button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  {!monthHasEvents && emptyMessage('this month')}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {selectedEvent && selectedItem && <WatchlistDetailDialog
        open
        onOpenChange={(open) => { if (!open) setSelectedEvent(null); }}
        item={selectedItem}
        status={actions.getAutoStatus(selectedItem)}
        isScheduled={actions.isInSchedule(selectedItem.id)}
        onSchedule={actions.addToSchedule ? () => setScheduleEvent(selectedEvent) : undefined}
        onRemoveFromSchedule={selectedEvent.schedule && actions.removeFromSchedule ? () => askDelete({
          name: selectedItem.title,
          title: 'Remove from schedule',
          confirmLabel: 'Remove',
          description: `Remove "${selectedItem.title}" from your schedule? The title stays on your watchlist.`,
          onConfirm: () => { actions.removeFromSchedule?.(selectedEvent.schedule!.id); setSelectedEvent(null); },
        }) : undefined}
        toggleEpisodeWatched={actions.toggleEpisodeWatched}
        isEpisodeWatched={actions.isEpisodeWatched}
        isSeasonWatched={actions.isSeasonWatched}
      />}
      {scheduleEvent && <SmartScheduleDialog
        open
        onOpenChange={(open) => { if (!open) setScheduleEvent(null); }}
        title={scheduleEvent.item.title}
        releaseDate={scheduleEvent.releaseDate}
        defaultMode={scheduleEvent.item.category === 'TV Shows' ? 'weekly' : 'date'}
        onAdd={(day, date, mode) => {
          actions.addToSchedule?.({ watchlistItemId: scheduleEvent.item.id, title: scheduleEvent.item.title, category: scheduleEvent.item.category, image_url: scheduleEvent.item.image_url, day, mode, scheduledDate: mode === 'date' ? date : undefined });
          setScheduleEvent(null);
          setSelectedEvent(null);
        }}
      />}
      {deleteDialog}
    </section>
  );
}

import { useId, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { summarisePlan } from '../../import-match';
import { ImportReview } from './ImportReview';
import { useWatchHistoryImport, type ImportSource } from './useWatchHistoryImport';

const HOW_TO: Record<ImportSource, string> = {
  letterboxd: 'Letterboxd: Settings → Data → Export your data, unzip, then choose diary.csv, watched.csv and ratings.csv.',
  trakt: 'Trakt: export your history and ratings as JSON, then choose the files.',
};

function ProgressBar({ label, done, total }: { label: string; done: number; total: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <p className="text-sm [overflow-wrap:anywhere]">{label}</p>
      <div role="progressbar" aria-label="Import progress" aria-valuetext={`${done} of ${total}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{done} of {total}</p>
    </div>
  );
}

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const id = useId();
  const [source, setSource] = useState<ImportSource>('letterboxd');
  const run = useWatchHistoryImport();
  const { stage, parsed, parseError, plan, progress, outcome, failure } = run;
  const busy = stage === 'matching' || stage === 'applying';
  const summary = plan ? summarisePlan(plan) : null;

  const close = (next: boolean) => {
    if (stage === 'applying') return;
    if (!next) run.reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl" onEscapeKeyDown={event => { if (stage === 'applying') event.preventDefault(); }} onPointerDownOutside={event => { if (stage === 'applying') event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Import watch history</DialogTitle>
          <DialogDescription>One-time import from Letterboxd or Trakt. You review everything before anything is saved.</DialogDescription>
        </DialogHeader>

        {stage === 'pick' && (
          <div className="space-y-4 min-w-0">
            <fieldset className="flex flex-wrap gap-4">
              <legend className="sr-only">Source</legend>
              {(['letterboxd', 'trakt'] as const).map(value => (
                <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="radio" name={`${id}-source`} checked={source === value} onChange={() => { setSource(value); run.parseFiles(value, []); }} />
                  {value === 'letterboxd' ? 'Letterboxd (films, CSV)' : 'Trakt (films and shows, JSON)'}
                </label>
              ))}
            </fieldset>
            <p className="text-sm text-muted-foreground">{HOW_TO[source]}</p>
            <div className="space-y-2">
              <Label htmlFor={`${id}-files`}>{source === 'letterboxd' ? 'CSV files' : 'JSON files'}</Label>
              <Input
                key={source}
                id={`${id}-files`}
                type="file"
                multiple
                accept={source === 'letterboxd' ? '.csv,text/csv' : '.json,application/json'}
                onChange={event => { void run.parseFiles(source, Array.from(event.target.files ?? [])); }}
              />
            </div>
            {parseError && <p role="alert" className="text-sm text-destructive">{parseError}</p>}
            {parsed && (
              <div className="space-y-2 text-sm" aria-live="polite">
                <p>{parsed.films.length} film{parsed.films.length === 1 ? '' : 's'}{parsed.shows.length > 0 ? `, ${parsed.shows.length} show${parsed.shows.length === 1 ? '' : 's'}, ${parsed.episodes.length} episodes` : ''} found.</p>
                <ul className="space-y-1 text-xs text-muted-foreground">{parsed.notes.map(note => <li key={note} className="[overflow-wrap:anywhere]">{note}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        {stage === 'matching' && progress && <ProgressBar {...progress} />}

        {(stage === 'review' || stage === 'applying') && plan && summary && (
          <div className="space-y-4 min-w-0">
            {failure && (
              <div role="alert" className="space-y-1 rounded-xl border border-destructive p-3 text-sm">
                <p className="font-medium text-destructive">Failed at: {failure.step}</p>
                <p className="[overflow-wrap:anywhere]">{failure.message}</p>
                <p>Saved before it stopped: {failure.saved}. Nothing is rolled back; importing again skips titles already added.</p>
              </div>
            )}
            <p className="text-sm" aria-live="polite">
              {summary.films} film{summary.films === 1 ? '' : 's'} to mark watched ({summary.dated} dated{summary.ratedOnly > 0 ? `, ${summary.ratedOnly} rated on Trakt with no watch logged` : ''}), {summary.episodes} episode{summary.episodes === 1 ? '' : 's'} to mark watched, {summary.ratings} rating{summary.ratings === 1 ? '' : 's'} to set, {summary.adds} title{summary.adds === 1 ? '' : 's'} to add.
            </p>
            {stage === 'applying' && progress && <ProgressBar {...progress} />}
            <ImportReview plan={plan} onChange={run.setPlan} disabled={busy} />
          </div>
        )}

        {stage === 'done' && outcome && (
          <div className="space-y-2 text-sm" aria-live="polite">
            <p className="font-medium">Import finished.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>{outcome.marked.movies_marked} films marked watched</li>
              <li>{outcome.marked.movies_dated} films dated</li>
              <li>{outcome.marked.episodes_marked} episodes marked watched</li>
              <li>{outcome.marked.episodes_dated} episodes dated</li>
              <li>{outcome.marked.ratings_set} ratings set</li>
              <li>{outcome.added} titles added to your library</li>
              {outcome.failedAdds.length > 0 && <li>Could not add: {outcome.failedAdds.join(', ')}</li>}
              {outcome.notFound.films > 0 && <li>{outcome.notFound.films} films not found in your library</li>}
              {outcome.notFound.episodes > 0 && <li>{outcome.notFound.episodes} episodes not in your library (only aired episodes are stored)</li>}
              {outcome.notFound.ratings > 0 && <li>{outcome.notFound.ratings} season ratings had no matching season</li>}
            </ul>
          </div>
        )}

        <DialogFooter className="sticky bottom-0 bg-background pt-2">
          {stage === 'done'
            ? <Button onClick={() => close(false)}>Close</Button>
            : <>
              <Button variant="outline" disabled={stage === 'applying'} onClick={() => { if (stage === 'matching') run.cancelMatching(); else close(false); }}>Cancel</Button>
              {stage === 'pick' && <Button disabled={!parsed || (parsed.films.length + parsed.shows.length === 0)} onClick={() => { void run.startMatching(); }}>Match titles</Button>}
              {(stage === 'review' || stage === 'applying') && <Button disabled={stage === 'applying' || !summary || (summary.films + summary.episodes + summary.ratings === 0)} onClick={() => { void run.apply(); }}>
                {stage === 'applying' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {stage === 'applying' ? 'Importing…' : 'Import'}
              </Button>}
            </>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WatchHistoryImport() {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  if (!isAdmin) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>Import history</Button>
      {open && <ImportDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}

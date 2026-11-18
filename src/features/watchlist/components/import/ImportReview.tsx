import { Button } from '@/components/ui/button';
import type { ImportPlan, Resolution } from '../../import-match';

interface Entry {
  kind: 'film' | 'show';
  index: number;
  label: string;
  year: number | null;
  resolution: Resolution;
  ratedOnly?: boolean;
}

interface ImportReviewProps {
  plan: ImportPlan;
  onChange: (plan: ImportPlan) => void;
  disabled?: boolean;
}

function Poster({ url }: { url: string | null }) {
  return url
    ? <img src={url} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded object-cover" />
    : <div aria-hidden="true" className="h-14 w-10 shrink-0 rounded bg-muted" />;
}

const yearText = (year: number | null) => year ? ` (${year})` : '';

export function ImportReview({ plan, onChange, disabled }: ImportReviewProps) {
  const entries: Entry[] = [
    ...plan.films.map((p, index): Entry => ({ kind: 'film', index, label: p.film.name, year: p.film.year, resolution: p.resolution, ratedOnly: p.film.ratedOnly })),
    ...plan.shows.map((p, index): Entry => ({ kind: 'show', index, label: p.ref.title, year: p.ref.year, resolution: p.resolution })),
  ];
  const keepable = (e: Entry) => e.resolution.status === 'library' || e.resolution.status === 'new';
  const rated = entries.filter(e => keepable(e) && e.ratedOnly);
  const library = entries.filter(e => e.resolution.status === 'library' && !e.ratedOnly);
  const fresh = entries.filter(e => e.resolution.status === 'new' && !e.ratedOnly);
  const unsure = entries.filter(e => e.resolution.status === 'unsure');
  const missing = entries.filter(e => e.resolution.status === 'missing' || e.resolution.status === 'failed');

  const update = (entry: Entry, resolution: Resolution) => {
    if (entry.kind === 'film') onChange({ ...plan, films: plan.films.map((p, i) => i === entry.index ? { ...p, resolution } : p) });
    else onChange({ ...plan, shows: plan.shows.map((p, i) => i === entry.index ? { ...p, resolution } : p) });
  };
  const setInclude = (entry: Entry, include: boolean) => {
    if (entry.resolution.status === 'library' || entry.resolution.status === 'new') update(entry, { ...entry.resolution, include });
  };
  const setAll = (group: Entry[], include: boolean) => {
    const picked = (kind: Entry['kind']) => new Set(group.filter(e => e.kind === kind).map(e => e.index));
    const films = picked('film');
    const shows = picked('show');
    const set = (res: Resolution): Resolution => res.status === 'library' || res.status === 'new' ? { ...res, include } : res;
    onChange({
      ...plan,
      films: plan.films.map((p, i) => films.has(i) ? { ...p, resolution: set(p.resolution) } : p),
      shows: plan.shows.map((p, i) => shows.has(i) ? { ...p, resolution: set(p.resolution) } : p),
    });
  };

  const checkRow = (entry: Entry, poster: string | null) => {
    const res = entry.resolution;
    const include = res.status === 'library' || res.status === 'new' ? res.include : false;
    const title = res.status === 'new' ? res.title : entry.label;
    const year = res.status === 'new' ? res.year : entry.year;
    return (
      <li key={`${entry.kind}-${entry.index}`}>
        <label className="flex min-h-11 items-center gap-3 py-1">
          <input type="checkbox" className="h-4 w-4 shrink-0" checked={include} disabled={disabled} onChange={event => setInclude(entry, event.target.checked)} />
          <Poster url={poster} />
          <span className="min-w-0 text-sm [overflow-wrap:anywhere]">
            {title}{yearText(year)}{entry.kind === 'show' ? ' · TV' : ''}
            {res.status === 'library' && res.libraryTitle && <span className="block text-xs text-muted-foreground">Matched to library: {res.libraryTitle}</span>}
          </span>
        </label>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      {rated.length > 0 && (
        <section aria-labelledby="import-rated" className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="import-rated" className="text-sm font-semibold">Rated on Trakt, no watch logged — {rated.length}</h3>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={disabled} onClick={() => setAll(rated, true)}>Select all</Button>
              <Button type="button" variant="outline" disabled={disabled} onClick={() => setAll(rated, false)}>Select none</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Not ticked by default. Ticked films are marked watched with no date, and keep their rating.</p>
          <ul>{rated.map(entry => checkRow(entry, entry.resolution.status === 'new' ? entry.resolution.poster : null))}</ul>
        </section>
      )}
      {library.length > 0 && (
        <section aria-labelledby="import-library" className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="import-library" className="text-sm font-semibold">Already in your library — {library.length}</h3>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={disabled} onClick={() => setAll(library, true)}>Select all</Button>
              <Button type="button" variant="outline" disabled={disabled} onClick={() => setAll(library, false)}>Select none</Button>
            </div>
          </div>
          <ul>{library.map(entry => checkRow(entry, null))}</ul>
        </section>
      )}
      {fresh.length > 0 && (
        <section aria-labelledby="import-new" className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="import-new" className="text-sm font-semibold">New to your library — {fresh.length}</h3>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={disabled} onClick={() => setAll(fresh, true)}>Select all</Button>
              <Button type="button" variant="outline" disabled={disabled} onClick={() => setAll(fresh, false)}>Select none</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Ticked titles are added to your library, then marked watched.</p>
          <ul>{fresh.map(entry => checkRow(entry, entry.resolution.status === 'new' ? entry.resolution.poster : null))}</ul>
        </section>
      )}
      {unsure.length > 0 && (
        <section aria-labelledby="import-unsure" className="space-y-3">
          <h3 id="import-unsure" className="text-sm font-semibold">Check these — {unsure.length}</h3>
          {unsure.map(entry => {
            const res = entry.resolution;
            if (res.status !== 'unsure') return null;
            const name = `unsure-${entry.kind}-${entry.index}`;
            return (
              <fieldset key={name} className="space-y-1 rounded-xl border border-border p-3" disabled={disabled}>
                <legend className="px-1 text-sm [overflow-wrap:anywhere]">{entry.label}{yearText(entry.year)}</legend>
                {res.candidates.map(candidate => (
                  <label key={candidate.id} className="flex min-h-11 items-center gap-3">
                    <input type="radio" name={name} className="h-4 w-4 shrink-0" checked={res.chosen === candidate.id} onChange={() => update(entry, { ...res, chosen: candidate.id })} />
                    <Poster url={candidate.poster} />
                    <span className="min-w-0 text-sm [overflow-wrap:anywhere]">{candidate.title}{yearText(candidate.year)}{candidate.libraryId && <span className="text-xs text-muted-foreground"> · in your library</span>}</span>
                  </label>
                ))}
                <label className="flex min-h-11 items-center gap-3">
                  <input type="radio" name={name} className="h-4 w-4 shrink-0" checked={res.chosen === null} onChange={() => update(entry, { ...res, chosen: null })} />
                  <span className="text-sm">Skip</span>
                </label>
              </fieldset>
            );
          })}
        </section>
      )}
      {missing.length > 0 && (
        <section aria-labelledby="import-missing" className="space-y-1">
          <h3 id="import-missing" className="text-sm font-semibold">Not found — {missing.length}</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {missing.map(entry => <li key={`${entry.kind}-${entry.index}`} className="[overflow-wrap:anywhere]">{entry.label}{yearText(entry.year)}{entry.resolution.status === 'failed' ? ' — lookup failed, try again later' : ''}</li>)}
          </ul>
        </section>
      )}
      {entries.length === 0 && <p className="text-sm text-muted-foreground">Nothing to review.</p>}
    </div>
  );
}

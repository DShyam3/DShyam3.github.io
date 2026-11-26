import { useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildOrderView,
  type LibraryLookup,
  type OrderEntryView,
  type TvFranchiseSummary,
} from '@/features/watchlist/franchise';
import type { WatchedWhen } from '@/features/watchlist/watched-when';
import { EntryList } from './EntryList';
import { FranchiseCard } from './FranchiseCard';

/** A TV series universe & spin-offs group discovered from Wikidata. */
export function TvFranchiseCard({
  franchise,
  kindLabel = 'TV & Spin-offs',
  lookup,
  open: controlledOpen,
  onToggle: controlledToggle,
  onOpen,
  onAddToLibrary,
  onSeenIt,
  isAdding,
  onSave,
}: {
  franchise: TvFranchiseSummary;
  kindLabel?: string;
  lookup: LibraryLookup;
  open?: boolean;
  onToggle?: () => void;
  onOpen: (entry: OrderEntryView) => void;
  onAddToLibrary?: (entry: OrderEntryView) => void;
  onSeenIt?: (entry: OrderEntryView, when: WatchedWhen) => void;
  isAdding?: (key: string) => boolean;
  onSave?: (franchise: TvFranchiseSummary, view: ReturnType<typeof buildOrderView>) => Promise<void>;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const handleToggle = controlledToggle ?? (() => setLocalOpen((value) => !value));
  const [saving, setSaving] = useState(false);
  const view = useMemo(() => buildOrderView(franchise.entries, lookup), [franchise.entries, lookup]);

  return (
    <FranchiseCard
      name={franchise.name}
      kindLabel={kindLabel}
      summary={`${view.watched} of ${view.total} watched · ${view.inLibrary} in library`}
      watchedCount={view.watched}
      totalCount={view.total}
      nextUp={view.nextUp?.title}
      nextUpYear={view.nextUp?.releaseDate?.slice(0, 4) ?? null}
      strip={view.entries.map((e) => ({
        key: e.key,
        title: e.title,
        poster: e.poster,
        mediaType: e.mediaType,
        watched: e.state === 'watched',
        inProgress: e.state === 'in-progress',
      }))}
      open={open}
      onToggle={handleToggle}
    >
      {onSave && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={saving || view.total === 0}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(franchise, view);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          Save as viewing order
        </Button>
      )}
      <EntryList
        view={view}
        onOpen={onOpen}
        onAddToLibrary={onAddToLibrary}
        onSeenIt={onSeenIt}
        isAdding={isAdding}
      />
    </FranchiseCard>
  );
}

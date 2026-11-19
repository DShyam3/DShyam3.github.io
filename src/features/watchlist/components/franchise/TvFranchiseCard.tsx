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
  lookup,
  onOpen,
  onAddToLibrary,
  onSeenIt,
  isAdding,
  onSave,
}: {
  franchise: TvFranchiseSummary;
  lookup: LibraryLookup;
  onOpen: (entry: OrderEntryView) => void;
  onAddToLibrary?: (entry: OrderEntryView) => void;
  onSeenIt?: (entry: OrderEntryView, when: WatchedWhen) => void;
  isAdding?: (key: string) => boolean;
  onSave?: (franchise: TvFranchiseSummary, view: ReturnType<typeof buildOrderView>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const view = useMemo(() => buildOrderView(franchise.entries, lookup), [franchise.entries, lookup]);

  return (
    <FranchiseCard
      name={franchise.name}
      summary={`${view.watched} of ${view.total} watched · ${view.inLibrary} in library`}
      nextUp={view.nextUp?.title}
      strip={view.entries.map((e) => ({
        key: e.key,
        poster: e.poster,
        mediaType: e.mediaType,
        watched: e.state === 'watched',
      }))}
      open={open}
      onToggle={() => setOpen((value) => !value)}
    >
      {onSave && (
        <Button
          type="button"
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

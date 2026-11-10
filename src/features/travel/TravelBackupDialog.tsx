import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { buildTravelBackup, TRAVEL_BACKUP_MAX_RECORDS } from './journal-import';
import { buildTravelArchive, parseTravelArchive, prepareArchiveRestore, MAX_ARCHIVE_BYTES, type TravelArchive } from './journal-archive';
import { TRAVEL_PHOTO_BUCKET } from './journal-media';
import type { JournalController } from './useTravelJournal';

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TravelBackupDialog({ open, onOpenChange, journal }: { open: boolean; onOpenChange: (value: boolean) => void; journal: JournalController }) {
  const { session, isAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [archive, setArchive] = useState<TravelArchive | null>(null);
  const ownerId = session?.user.id;
  const own = { trips: journal.data.trips.filter(row => row.owner_id === ownerId), visits: journal.data.visits.filter(row => row.owner_id === ownerId),
    memories: journal.data.memories.filter(row => row.owner_id === ownerId), itinerary: journal.data.itinerary.filter(row => row.owner_id === ownerId) };

  async function exportArchive() {
    setBusy(true); setError(''); setMessage('Downloading saved photos…');
    try {
      const text = await buildTravelArchive(own, async path => {
        const { data, error: failure } = await supabase.storage.from(TRAVEL_PHOTO_BUCKET).download(path);
        if (failure || !data) throw new Error('A photo could not be downloaded. Nothing was exported.');
        return new Uint8Array(await data.arrayBuffer());
      });
      download(text, 'travel-archive.json'); setMessage('Archive downloaded with journal records and saved photo derivatives.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not create the archive.'); setMessage(''); }
    finally { setBusy(false); }
  }

  async function restore() {
    if (!archive || !ownerId) return;
    setBusy(true); setError(''); setMessage('');
    try {
      // Check again immediately before uploading. SQL also refuses collisions atomically.
      const ids = new Set([...own.trips, ...own.visits, ...own.memories, ...own.itinerary].map(row => row.id));
      if ([...archive.journal.trips, ...archive.journal.visits, ...archive.journal.memories, ...archive.journal.itinerary].some(row => ids.has(row.id))) throw new Error('These records already exist. Restore is insert-only and will not overwrite your journal.');
      const restored = await prepareArchiveRestore(archive, ownerId, async bytes => {
        const { data, error: failure } = await supabase.functions.invoke('travel-photo', { body: new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), headers: { 'Content-Type': 'image/jpeg' } });
        if (failure || typeof data?.path !== 'string') throw new Error('Could not restore a photo. No journal records were restored.');
        return data.path;
      });
      await journal.restore(restored);
      setArchive(null); setMessage('Journal restored, including relationships and publication settings.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not restore the archive.'); }
    finally { setBusy(false); }
  }

  if (!isAdmin) return null;
  return <Dialog open={open} onOpenChange={value => { if (!busy) { setError(''); setMessage(''); setArchive(null); onOpenChange(value); } }}>
    <DialogContent><DialogHeader><DialogTitle>Travel backup & restore</DialogTitle><DialogDescription>Save your journal, relationships and photographs. Archives contain private travel history—keep them somewhere you trust.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2"><Button disabled={busy || journal.loading || !!journal.error} onClick={() => { void exportArchive(); }}>Download complete archive</Button><Button variant="outline" disabled={busy || journal.loading || !!journal.error} onClick={() => download(buildTravelBackup(own), 'travel-metadata.json')}>Metadata only</Button></div>
        <p className="text-xs text-muted-foreground">Complete archives include the resized photos stored by Travel, not camera originals. Limit: 60 MB and {TRAVEL_BACKUP_MAX_RECORDS.toLocaleString('en-GB')} records. Metadata exports list photo paths but do not include image files.</p>
        <label className="block space-y-2 text-sm">Choose a complete archive to restore<input type="file" accept=".json,application/json" disabled={busy} className="block w-full text-xs" onChange={async event => {
          const file = event.target.files?.[0]; setArchive(null); setError(''); setMessage('');
          if (!file) return;
          setBusy(true);
          try { if (file.size > MAX_ARCHIVE_BYTES) throw new Error('Choose an archive smaller than 60 MB.'); setArchive(parseTravelArchive(await file.text())); }
          catch (failure) { setError(failure instanceof Error ? failure.message : 'Invalid archive.'); }
          finally { setBusy(false); }
        }} /></label>
        {archive && <div className="space-y-2 rounded-xl border border-border p-3 text-sm"><p>{archive.journal.trips.length} trips · {archive.journal.visits.length} visits · {archive.journal.memories.length} memories · {archive.journal.itinerary.length} itinerary items · {Object.keys(archive.photos).length} photos</p><p className="text-xs text-muted-foreground">Restore preserves publication settings. Published memories become visible immediately. Existing IDs are refused; nothing is overwritten. Failed photo transfers can leave unlinked private copies for later cleanup.</p><Button disabled={busy || journal.busy} onClick={() => { void restore(); }}>Restore these records</Button></div>}
        {message && <p role="status" className="text-sm">{message}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </DialogContent>
  </Dialog>;
}

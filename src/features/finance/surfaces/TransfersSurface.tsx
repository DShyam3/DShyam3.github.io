/**
 * Money moved between the people you track (REHAUL_PLAN.md 7.13).
 *
 * Sending £300 to a profile you also track has not left the household, so
 * counting it as spending on one side and income on the other overstates both.
 * Recording it here says "these are the same movement", and the cash-flow
 * figures skip whichever ledger entries are linked to it.
 */

import { useMemo, useState } from 'react';
import { ArrowRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { formatGBP } from '@/features/finance/utils/calculations';
import { transferBalance } from '@/lib/finance';
import { useFinanceData } from '../FinanceDataContext';
import { ProfileAvatar } from '../components/ProfileAvatar';

export default function TransfersSurface() {
  const { profiles, profileId, transfers, saveTransfer, deleteTransfer } = useFinanceData();
  const { askDelete, deleteDialog } = useDeleteConfirm();

  const others = profiles.filter(p => p.id !== profileId);
  const today = new Date().toISOString().slice(0, 10);

  const [toProfile, setToProfile] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');

  const balance = useMemo(
    () => transferBalance(transfers, profileId ?? ''),
    [transfers, profileId],
  );

  const nameOf = (id: string) => profiles.find(p => p.id === id)?.name ?? 'Unknown';

  const canSubmit = toProfile !== '' && Number(amount) > 0 && date !== '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !profileId) return;
    await saveTransfer({
      fromProfileId: profileId,
      toProfileId: toProfile,
      amount: Number(amount),
      date,
      note: note.trim() || undefined,
    });
    setAmount('');
    setNote('');
  };

  // Only one profile exists, so there is nobody to move money to. Saying that
  // is more useful than an empty form that cannot be submitted.
  if (others.length === 0) {
    return (
      <p className="font-sans text-sm text-muted-foreground">
        Transfers move money between profiles you track. Add a second profile to use them.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Net position</p>
        <p className="font-sans text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
          {balance.net >= 0 ? '+' : ''}{formatGBP(balance.net)}
        </p>
        <p className="font-sans text-xs text-muted-foreground">
          {formatGBP(balance.sent)} sent · {formatGBP(balance.received)} received
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="tr-to" className="font-sans text-xs text-muted-foreground">To</Label>
          <Select value={toProfile} onValueChange={setToProfile}>
            <SelectTrigger id="tr-to" className="h-9 w-44 font-sans text-sm">
              <SelectValue placeholder="Choose a profile" />
            </SelectTrigger>
            <SelectContent>
              {others.map(p => (
                <SelectItem key={p.id} value={p.id} className="font-sans text-sm">
                  <span className="flex items-center gap-2">
                    <ProfileAvatar profile={p} />
                    {p.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="tr-amount" className="font-sans text-xs text-muted-foreground">Amount</Label>
          <Input
            id="tr-amount"
            inputMode="decimal"
            placeholder="300"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="h-9 w-28 font-sans text-sm tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tr-date" className="font-sans text-xs text-muted-foreground">Date</Label>
          <Input
            id="tr-date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="h-9 w-40 font-sans text-sm"
          />
        </div>
        <div className="space-y-1 min-w-40 flex-1">
          <Label htmlFor="tr-note" className="font-sans text-xs text-muted-foreground">Note</Label>
          <Input
            id="tr-note"
            placeholder="What it was for"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="h-9 font-sans text-sm"
          />
        </div>
        <Button type="submit" disabled={!canSubmit} className="h-9">Record</Button>
      </form>

      {transfers.length === 0 ? (
        <p className="font-sans text-sm text-muted-foreground">No transfers recorded.</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {transfers.map(t => {
            const outgoing = t.fromProfileId === profileId;
            return (
              <li key={t.id} className="flex items-center gap-4 py-3">
                <span className="flex min-w-0 flex-1 items-center gap-2 font-sans text-sm text-foreground">
                  {nameOf(t.fromProfileId)}
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                  {nameOf(t.toProfileId)}
                  {t.note ? <span className="truncate text-muted-foreground">· {t.note}</span> : null}
                </span>
                <span className="shrink-0 font-sans text-xs text-muted-foreground">{t.date}</span>
                <span className="shrink-0 font-sans text-sm font-bold tabular-nums">
                  {outgoing ? '−' : '+'}{formatGBP(t.amount)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label={`Delete transfer to ${nameOf(t.toProfileId)}`}
                  onClick={() =>
                    askDelete({
                      title: 'Delete transfer',
                      description: 'This removes the record of the movement. The transactions on either side are left alone.',
                      onConfirm: () => deleteTransfer(t.id),
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {deleteDialog}
    </div>
  );
}

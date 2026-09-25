/**
 * Verified balances for a debt, and the form that adds one, in place.
 *
 * This used to be a separate reconcile dialog with two dates, a drift panel
 * and its own history list. Recording a balance is one figure and the date it
 * was true on, so it sits inline under the balances it adds to.
 *
 * `expectedOn` lets the caller say what the model thought the balance would
 * be on a date, so a new figure can be read against it before it is saved.
 * The comparison is the caller's arithmetic; this only shows it.
 */

import { useId, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import type { Debt, DebtObservation } from '@/features/finance/finance-types';
import { formatGBP } from '@/features/finance/utils/calculations';
import { toISODate } from '@/lib/finance';
import { useFinanceData } from '../FinanceDataContext';

const SOURCE_LABEL: Record<DebtObservation['source'], string> = {
  provider: 'Online account',
  statement: 'Statement',
  manual: 'Other',
};

const shortDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export function BalanceRecords({
  debt,
  expectedOn,
  hint,
}: {
  debt: Debt;
  /** What the model expected on a date, if it can say. */
  expectedOn?: (date: string) => number | undefined;
  /** One line under the form, e.g. where to find the figure. */
  hint?: string;
}) {
  const id = useId();
  const { addDebtObservation, deleteDebtObservation } = useFinanceData();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const today = toISODate(new Date());

  const [balance, setBalance] = useState('');
  const [asOf, setAsOf] = useState(today);
  const [source, setSource] = useState<DebtObservation['source']>('provider');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const records = [...(debt.observations ?? [])].sort((a, b) =>
    (b.statementDate || b.observedOn).localeCompare(a.statementDate || a.observedOn));

  const entered = parseFloat(balance);
  const expected = Number.isFinite(entered) && asOf ? expectedOn?.(asOf) : undefined;
  const gap = expected !== undefined ? entered - expected : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(entered) || !asOf) return;
    setSaving(true);
    try {
      await addDebtObservation({
        debtId: debt.id,
        balance: Math.abs(entered),
        // Checked today, true as of the date the lender shows.
        observedOn: today,
        statementDate: asOf,
        source,
        note: note.trim() || undefined,
      });
      setBalance('');
      setNote('');
      setAsOf(today);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="Verified balances" className="space-y-3">
      <h4 className="text-sm font-semibold">Verified balances</h4>

      {records.length ? (
        <ul className="divide-y divide-border/60 text-sm">
          {records.map(r => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block">{shortDate(r.statementDate || r.observedOn)}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {SOURCE_LABEL[r.source]}{r.note ? ` · ${r.note}` : ''}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="tabular-nums">{formatGBP(r.balance)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete the ${formatGBP(r.balance)} balance from ${shortDate(r.statementDate || r.observedOn)}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => askDelete({
                    title: 'Delete this balance?',
                    description: 'Projections will start from the next most recent balance instead.',
                    confirmLabel: 'Delete',
                    onConfirm: () => deleteDebtObservation(r.id, debt.id),
                  })}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">None yet. Add the balance your lender shows so projections start from a real figure.</p>
      )}

      <form onSubmit={submit} className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/40 p-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-balance`} className="text-xs text-muted-foreground">Balance (£)</Label>
          <Input id={`${id}-balance`} inputMode="decimal" required value={balance} onChange={e => setBalance(e.target.value)} className="h-10 tabular-nums" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-asof`} className="text-xs text-muted-foreground">As of</Label>
          <Input id={`${id}-asof`} type="date" required max={today} value={asOf} onChange={e => setAsOf(e.target.value)} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-source`} className="text-xs text-muted-foreground">From</Label>
          <Select value={source} onValueChange={v => setSource(v as DebtObservation['source'])}>
            <SelectTrigger id={`${id}-source`} className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(SOURCE_LABEL) as DebtObservation['source'][]).map(s => (
                <SelectItem key={s} value={s}>{SOURCE_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-note`} className="text-xs text-muted-foreground">Note</Label>
          <Input id={`${id}-note`} value={note} onChange={e => setNote(e.target.value)} className="h-10" />
        </div>
        {gap !== undefined && expected !== undefined && (
          <p className="col-span-2 text-xs text-muted-foreground" aria-live="polite">
            Expected about <span className="tabular-nums text-foreground">{formatGBP(expected)}</span> on that date
            {Math.abs(gap) < 1
              ? ', so this matches.'
              : <>, so this is <span className="tabular-nums text-foreground">{formatGBP(Math.abs(gap))}</span> {gap > 0 ? 'higher' : 'lower'}. A refund, a payment or interest timing usually explains it.</>}
          </p>
        )}
        <div className="col-span-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{hint}</p>
          <Button type="submit" disabled={saving}>Record balance</Button>
        </div>
      </form>
      {deleteDialog}
    </section>
  );
}

/**
 * Money that moved on a student loan outside payroll: refunds SLC paid back to
 * you, and payments you made yourself. Plus the borrowing, read-only.
 *
 * A refund is easy to misread. It is money returned to you, so it goes back
 * onto the balance -- the loan is larger after one, not smaller. Recording it
 * lets the projection and the balance check account for it rather than
 * leaving an unexplained gap.
 *
 * Stored in the debt's `draws` list with a `kind`, so no schema change was
 * needed; `isBorrowing` keeps them out of borrowing totals and course dates.
 */

import { useId, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Debt, DebtDraw } from '@/features/finance/finance-types';
import { formatGBP } from '@/features/finance/utils/calculations';
import { toISODate } from '@/lib/finance';
import { isBorrowing, useDebtMutations } from '../useDebtMutations';

type Movement = 'refund' | 'payment';

const KIND_LABEL: Record<Movement, string> = {
  refund: 'Refund to you',
  payment: 'Payment you made',
};

const shortDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export function LoanMovements({ loan }: { loan: Debt }) {
  const id = useId();
  const { toast } = useToast();
  const { saveDebt } = useDebtMutations();
  const today = toISODate(new Date());

  const [kind, setKind] = useState<Movement>('refund');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);

  const draws = loan.draws ?? [];
  const movements = draws.filter(d => !isBorrowing(d)).sort((a, b) => b.date.localeCompare(a.date));
  const borrowing = draws.filter(isBorrowing).sort((a, b) => a.date.localeCompare(b.date));

  const save = (next: DebtDraw[]) => saveDebt({ ...loan, draws: next });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Math.abs(parseFloat(amount));
    if (!Number.isFinite(value) || value <= 0 || !date) {
      toast({ title: 'Needs an amount and a date', variant: 'destructive' });
      return;
    }
    save([...draws, { id: `dw_${Date.now()}`, date, amount: value, kind, label: KIND_LABEL[kind] }]);
    setAmount('');
  };

  return (
    <section aria-label="Refunds and payments" className="space-y-3">
      <h4 className="text-sm font-semibold">Refunds and payments</h4>
      {movements.length ? (
        <ul className="divide-y divide-border/60 text-sm">
          {movements.map(m => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block">{shortDate(m.date)}</span>
                <span className="block text-xs text-muted-foreground">
                  {m.kind === 'refund' ? 'Refund to you, added back to the balance' : 'Payment you made'}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="tabular-nums">{m.kind === 'refund' ? '+' : '−'}{formatGBP(m.amount)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove the ${formatGBP(m.amount)} ${m.kind} from ${shortDate(m.date)}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => save(draws.filter(d => d.id !== m.id))}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">None recorded. Payroll deductions come from your payslips and are not needed here.</p>
      )}

      <form onSubmit={add} className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/40 p-4">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor={`${id}-kind`} className="text-xs text-muted-foreground">What happened</Label>
          <Select value={kind} onValueChange={v => setKind(v as Movement)}>
            <SelectTrigger id={`${id}-kind`} className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(KIND_LABEL) as Movement[]).map(k => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-amount`} className="text-xs text-muted-foreground">Amount (£)</Label>
          <Input id={`${id}-amount`} inputMode="decimal" required value={amount} onChange={e => setAmount(e.target.value)} className="h-10 tabular-nums" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-date`} className="text-xs text-muted-foreground">Date</Label>
          <Input id={`${id}-date`} type="date" required max={today} value={date} onChange={e => setDate(e.target.value)} className="h-10" />
        </div>
        <div className="col-span-2 flex justify-end">
          <Button type="submit">Add</Button>
        </div>
      </form>

      <div className="space-y-2 pt-2">
        <h4 className="text-sm font-semibold">Borrowed</h4>
        {borrowing.length ? (
          <ul className="divide-y divide-border/60 text-sm">
            {borrowing.map(d => (
              <li key={d.id} className="flex justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-muted-foreground">{d.label || 'Borrowing'} · {shortDate(d.date)}</span>
                <span className="shrink-0 tabular-nums">{formatGBP(d.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No borrowing recorded. Add it in Edit to draw the years while you studied.</p>
        )}
      </div>
    </section>
  );
}

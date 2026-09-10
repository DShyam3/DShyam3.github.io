import { RecordInspector } from '@/components/shared/RecordInspector';
import { DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MetricProgress } from '@/components/ui/metric-progress';
import { formatGBP } from '../utils/calculations';
import type { Debt } from '../finance-types';

export function DebtInspector({ debt, monthlyPayment, onInspect, onReconcile, onEdit, onDelete }: {
  debt: Debt;
  monthlyPayment: number;
  onInspect: () => void;
  onReconcile: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <RecordInspector title={debt.name} subtitle={`${debt.lender || 'Lender not specified'} · ${debt.type}`} value={formatGBP(debt.balance)} palette="lavender" onInspect={onInspect}>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-xs text-muted-foreground">Monthly repayment</dt><dd className="mt-1 tabular-nums">{formatGBP(monthlyPayment)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Annual interest</dt><dd className="mt-1 tabular-nums">{debt.interestRate.toFixed(2)}%</dd></div>
        <div><dt className="text-xs text-muted-foreground">Started</dt><dd className="mt-1">{debt.startDate || 'Not recorded'}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Expected payoff</dt><dd className="mt-1">{debt.payoffDate || 'See payoff projection'}</dd></div>
      </dl>
      <MetricProgress label="Balance remaining" value={debt.balance} target={Math.max(debt.originalAmount, debt.balance)} valueText={`${formatGBP(debt.balance)} of ${formatGBP(debt.originalAmount)} borrowed`} intent="repayment" />
      <section className="space-y-3" aria-label="Verified balances">
        <h3 className="text-sm font-semibold">Verified balances</h3>
        {debt.observations?.length ? <ul className="divide-y divide-border">{[...debt.observations].sort((a, b) => b.observedOn.localeCompare(a.observedOn)).map((record, i) => <li key={`${record.observedOn}-${i}`} className="py-3 flex justify-between gap-3 text-xs"><span>{record.statementDate || record.observedOn}</span><span className="tabular-nums">{formatGBP(record.balance)}</span></li>)}</ul> : <p className="text-xs text-muted-foreground">No balance records yet. Reconcile a statement to establish a verified balance.</p>}
      </section>
      <section className="space-y-3" aria-label="Borrowing history">
        <h3 className="text-sm font-semibold">Borrowing history</h3>
        {debt.draws?.length ? <ul className="divide-y divide-border">{[...debt.draws].sort((a, b) => b.date.localeCompare(a.date)).map(draw => <li key={draw.id} className="py-3 flex justify-between gap-3 text-xs"><span className="break-words">{draw.label || 'Draw'}<span className="block text-muted-foreground mt-1">{draw.date}</span></span><span className="tabular-nums shrink-0">{formatGBP(draw.amount)}</span></li>)}</ul> : <p className="text-xs text-muted-foreground">No individual draws recorded.</p>}
      </section>
      {debt.notes && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{debt.notes}</p>}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <DialogClose asChild><Button onClick={onReconcile}>Reconcile balance</Button></DialogClose>
        <DialogClose asChild><Button variant="outline" onClick={onEdit}>Edit debt</Button></DialogClose>
        <Button variant="ghost" className="text-destructive" onClick={onDelete}>Delete debt</Button>
      </div>
    </RecordInspector>
  );
}

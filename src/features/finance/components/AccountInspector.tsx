import { RecordInspector } from '@/components/shared/RecordInspector';
import { DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatGBP } from '../utils/calculations';
import type { BankAccount, MockTransaction, RecurringBill } from '../finance-types';

export function AccountInspector({ account, transactions, bills, onEdit, onDelete }: {
  account: BankAccount;
  transactions: MockTransaction[];
  bills: RecurringBill[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const records = transactions.filter(tx => (tx.bankAccountId || tx.accountId) === account.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const scheduled = bills.filter(bill => bill.linkedAccountId === account.id);
  return (
    <RecordInspector title={account.name} subtitle={`${account.issuer} · ${account.type}`} value={formatGBP(account.balance)} palette={account.type === 'credit' ? 'peach' : account.type === 'savings' ? 'sage' : 'sky'}>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-xs text-muted-foreground">Annual fee</dt><dd className="mt-1 tabular-nums">{formatGBP(account.annualFee)}</dd></div>
        {account.type === 'credit' && (
          <div><dt className="text-xs text-muted-foreground">Credit limit</dt><dd className="mt-1 tabular-nums">{account.creditLimit == null ? 'Not known' : formatGBP(account.creditLimit)}</dd></div>
        )}
        <div><dt className="text-xs text-muted-foreground">Used for</dt><dd className="mt-1 break-words">{account.useCase || 'Not specified'}</dd></div>
      </dl>
      <section aria-label="Scheduled bills" className="space-y-3">
        <h3 className="text-sm font-semibold">Scheduled bills</h3>
        {scheduled.length ? <ul className="divide-y divide-border">{scheduled.map(bill => <li key={bill.id} className="py-3 flex justify-between gap-3 text-xs"><span className="min-w-0 break-words">{bill.name}<span className="block text-muted-foreground mt-1">{bill.frequency} · Due day {bill.dueDate} · {bill.isPaid ? 'Paid' : 'Unpaid'}</span></span><span className="tabular-nums shrink-0">{formatGBP(bill.amount)}</span></li>)}</ul> : <p className="text-xs text-muted-foreground">No bills linked to this account.</p>}
      </section>
      <section aria-label="Recent transactions" className="space-y-3">
        <h3 className="text-sm font-semibold">Recent transactions</h3>
        {records.length ? <ul className="divide-y divide-border">{records.map(tx => <li key={tx.id} className="py-3 flex justify-between gap-3 text-xs"><span className="min-w-0 break-words">{tx.name}<span className="block text-muted-foreground mt-1">{tx.date} · {tx.isReviewed ? 'Reviewed' : 'Needs review'}</span></span><span className="tabular-nums shrink-0">{tx.amount < 0 ? '+' : '−'}{formatGBP(Math.abs(tx.amount))}</span></li>)}</ul> : <p className="text-xs text-muted-foreground">No transactions linked to this account.</p>}
      </section>
      <div className="flex flex-wrap gap-3 border-t pt-4">
        <DialogClose asChild><Button onClick={onEdit}>Edit account</Button></DialogClose>
        <Button variant="ghost" className="text-destructive" onClick={onDelete}>Delete account</Button>
      </div>
    </RecordInspector>
  );
}

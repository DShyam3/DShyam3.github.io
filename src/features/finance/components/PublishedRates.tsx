/**
 * The Student Loans Company's published interest parameters, as stored rows.
 *
 * SLC sets RPI each September and has changed the Plan 2 cap several times a
 * year when market rates moved; the Plan 2 thresholds move each April. Each
 * change is a row from the date it applies, like a tax rate set, so the yearly
 * update is adding a row here rather than changing code. The section says
 * when no row covers today, which is the prompt to add one.
 */

import { useId, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { formatGBP } from '@/features/finance/utils/calculations';
import { useFinanceData } from '../FinanceDataContext';

const GOV_UK = 'https://www.gov.uk/repaying-your-student-loan/what-you-pay';

const shortDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const optional = (s: string): number | null => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
};

export function PublishedRates() {
  const id = useId();
  const { studentLoanRates, saveStudentLoanRate, deleteStudentLoanRate } = useFinanceData();
  const { askDelete, deleteDialog } = useDeleteConfirm();

  const [from, setFrom] = useState('');
  const [rpi, setRpi] = useState('');
  const [cap, setCap] = useState('');
  const [lower, setLower] = useState('');
  const [upper, setUpper] = useState('');
  const [bank, setBank] = useState('');
  const [saving, setSaving] = useState(false);

  const rows = [...studentLoanRates].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rpiValue = optional(rpi);
    if (!from || rpiValue === null) return;
    setSaving(true);
    try {
      await saveStudentLoanRate({
        effectiveFrom: from,
        rpi: rpiValue,
        rateCap: optional(cap),
        plan2LowerThreshold: optional(lower),
        plan2UpperThreshold: optional(upper),
        bankRate: optional(bank),
        source: GOV_UK,
      });
      setFrom(''); setRpi(''); setCap(''); setLower(''); setUpper(''); setBank('');
    } finally {
      setSaving(false);
    }
  };

  const field = (key: string, label: string, value: string, set: (v: string) => void, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-${key}`} className="text-xs text-muted-foreground">{label}</Label>
      <Input id={`${id}-${key}`} inputMode="decimal" value={value} onChange={e => set(e.target.value)} className="h-10 tabular-nums" {...props} />
    </div>
  );

  return (
    <section aria-label="Published rates" className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold">Published rates</h4>
        <p className="text-xs text-muted-foreground">
          One row for each change, from the date it applies. Each lasts a year unless a later row replaces it.
          {' '}Figures are on <a href={GOV_UK} target="_blank" rel="noreferrer" className="underline underline-offset-4">gov.uk</a>.
        </p>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">Published student loan interest rates</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="pb-2 font-normal">From</th>
                <th scope="col" className="pb-2 font-normal text-right">RPI</th>
                <th scope="col" className="pb-2 font-normal text-right">Cap</th>
                <th scope="col" className="pb-2 font-normal text-right">Plan 2 threshold</th>
                <th scope="col" className="pb-2 font-normal text-right">Plan 2 full rate from</th>
                <th scope="col" className="pb-2 font-normal text-right">Bank Rate</th>
                <th scope="col" className="pb-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map(r => (
                <tr key={r.id}>
                  <th scope="row" className="py-2 pr-3 text-left font-normal">{shortDate(r.effectiveFrom)}</th>
                  <td className="py-2 text-right tabular-nums">{r.rpi}%</td>
                  <td className="py-2 text-right tabular-nums">{r.rateCap === null ? 'None' : `${r.rateCap}%`}</td>
                  <td className="py-2 text-right tabular-nums">{r.plan2LowerThreshold == null ? '—' : formatGBP(r.plan2LowerThreshold)}</td>
                  <td className="py-2 text-right tabular-nums">{r.plan2UpperThreshold === null ? '—' : formatGBP(r.plan2UpperThreshold)}</td>
                  <td className="py-2 text-right tabular-nums">{r.bankRate === null ? '—' : `${r.bankRate}%`}</td>
                  <td className="py-2 pl-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete the rates from ${shortDate(r.effectiveFrom)}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => askDelete({
                        title: 'Delete these rates?',
                        description: 'Months they covered fall back to the assumptions above.',
                        confirmLabel: 'Delete',
                        onConfirm: () => deleteStudentLoanRate(r.id),
                      })}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">None stored, so every month uses the assumptions above.</p>
      )}

      <form onSubmit={submit} className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/40 p-4 sm:grid-cols-3">
        {field('from', 'From', from, setFrom, { type: 'date', inputMode: undefined, required: true })}
        {field('rpi', 'RPI (%)', rpi, setRpi, { required: true })}
        {field('cap', 'Cap (%)', cap, setCap, { placeholder: 'None' })}
        {field('lower', 'Plan 2 threshold (£)', lower, setLower)}
        {field('upper', 'Plan 2 full rate from (£)', upper, setUpper)}
        {field('bank', 'Bank Rate (%)', bank, setBank)}
        <div className="col-span-2 flex justify-end sm:col-span-3">
          <Button type="submit" disabled={saving}>Add rates</Button>
        </div>
      </form>
      {deleteDialog}
    </section>
  );
}

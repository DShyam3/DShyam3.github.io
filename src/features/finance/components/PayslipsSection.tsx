/**
 * Payslips on the Income surface: capture, list, and what they say.
 *
 * The figures are typed in, not extracted (REHAUL_PLAN.md 7.P). Six numbers
 * once a month, and in return the deduction trends and the student loan
 * reconciliation stop being estimates. A PDF can be archived alongside, but
 * the record here stands without one.
 */

import { useMemo, useState } from 'react';
import { useFinanceData } from '../FinanceDataContext';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatGBP } from '@/features/finance/utils/calculations';
import {
  checkPayslip, compareToModel, deductionRate, effectiveTaxRate,
  studentLoanPaidInTaxYear, sumPayslips, taxYearOf, totalDeductions, type Payslip,
} from '@/lib/finance';
import { cn } from '@/lib/utils';
import { AlertTriangle, Check, FileText, Paperclip, Pencil, Plus, Trash2, X } from 'lucide-react';
import { deleteFinanceDocument, signedDocumentUrl, uploadFinanceDocument } from '../finance-storage';
import { extractPayslipFromPdf } from '../payslip-pdf';
import { parsedFieldCount, type ParsedPayslip } from '@/lib/finance';
import { useToast } from '@/hooks/use-toast';

/** Every money field, as strings, because a half-typed number is not a number. */
type Draft = Record<
  'payDate' | 'employer' | 'gross' | 'incomeTax' | 'nationalInsurance'
  | 'pensionEmployee' | 'pensionEmployer' | 'studentLoan' | 'otherDeductions' | 'net',
  string
>;

const EMPTY_DRAFT: Draft = {
  payDate: new Date().toISOString().split('T')[0],
  employer: '', gross: '', incomeTax: '', nationalInsurance: '',
  pensionEmployee: '', pensionEmployer: '', studentLoan: '', otherDeductions: '', net: '',
};

/** Fills a blank field from the parser, leaving anything typed untouched. */
const fill = (current: string, parsed: number | undefined): string =>
  current.trim() !== '' || parsed === undefined ? current : String(parsed);

const num = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const draftFrom = (p: Payslip): Draft => ({
  payDate: p.payDate,
  employer: p.employer ?? '',
  gross: String(p.gross),
  incomeTax: String(p.incomeTax),
  nationalInsurance: String(p.nationalInsurance),
  pensionEmployee: String(p.pensionEmployee),
  pensionEmployer: String(p.pensionEmployer),
  studentLoan: String(p.studentLoan),
  otherDeductions: String(p.otherDeductions),
  net: String(p.net),
});

const MONEY_FIELDS: { key: keyof Draft; label: string }[] = [
  { key: 'gross', label: 'Gross' },
  { key: 'incomeTax', label: 'Income tax' },
  { key: 'nationalInsurance', label: 'National Insurance' },
  { key: 'pensionEmployee', label: 'Pension (yours)' },
  { key: 'pensionEmployer', label: 'Pension (employer)' },
  { key: 'studentLoan', label: 'Student loan' },
  { key: 'otherDeductions', label: 'Other deductions' },
  { key: 'net', label: 'Net' },
];

/** Pure, so the live reconciliation can memoise on the draft alone. */
const asPayslip = (d: Draft, id: string, storagePath?: string): Payslip => ({
  id,
  payDate: d.payDate,
  employer: d.employer.trim() || undefined,
  gross: num(d.gross),
  incomeTax: num(d.incomeTax),
  nationalInsurance: num(d.nationalInsurance),
  pensionEmployee: num(d.pensionEmployee),
  pensionEmployer: num(d.pensionEmployer),
  studentLoan: num(d.studentLoan),
  otherDeductions: num(d.otherDeductions),
  net: num(d.net),
  storagePath,
});

export function PayslipsSection({ modelledStudentLoanMonthly }: { modelledStudentLoanMonthly?: number }) {
  const { payslips, savePayslip, deletePayslip, profileId } = useFinanceData();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  // The path already stored, and a file chosen but not yet uploaded. Upload
  // happens on save, so cancelling the dialog leaves no orphan in the bucket.
  const [storagePath, setStoragePath] = useState<string | undefined>();
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [readCount, setReadCount] = useState<number | null>(null);

  // Shown live in the dialog rather than after saving: a payslip that does not
  // reconcile is almost always a typo, and the moment to catch it is while the
  // paper is still in front of you.
  const draftCheck = useMemo(() => checkPayslip(asPayslip(draft, 'draft')), [draft]);
  // Zero against zero balances, arithmetically and uselessly. An untouched
  // form has nothing to reconcile, and saying "matches net" over blank fields
  // is a pass claimed from absent data.
  const hasFigures = num(draft.gross) > 0 || num(draft.net) > 0;

  const currentTaxYear = useMemo(
    () => (payslips.length > 0 ? taxYearOf(payslips[0].payDate) : taxYearOf(new Date().toISOString())),
    [payslips],
  );
  const thisYear = useMemo(
    () => payslips.filter(p => taxYearOf(p.payDate) === currentTaxYear),
    [payslips, currentTaxYear],
  );
  const totals = useMemo(() => sumPayslips(thisYear), [thisYear]);

  const loanComparison = useMemo(() => {
    const actual = studentLoanPaidInTaxYear(payslips, currentTaxYear);
    if (thisYear.length === 0 || modelledStudentLoanMonthly === undefined) {
      return compareToModel(actual, null);
    }
    // Compared over the months actually captured, not twelve -- otherwise a
    // part-captured year always looks like a shortfall.
    return compareToModel(actual, modelledStudentLoanMonthly * thisYear.length);
  }, [payslips, currentTaxYear, modelledStudentLoanMonthly, thisYear.length]);

  const openNew = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setStoragePath(undefined);
    setPendingFile(null);
    setIsOpen(true);
  };

  const openEdit = (p: Payslip) => {
    setEditingId(p.id);
    setDraft(draftFrom(p));
    setStoragePath(p.storagePath);
    setPendingFile(null);
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!draft.payDate || isSaving) return;
    setIsSaving(true);
    try {
      let path = storagePath;
      if (pendingFile && profileId) {
        // Uploaded here rather than on selection, so a cancelled dialog leaves
        // nothing behind in the bucket.
        const uploaded = await uploadFinanceDocument(pendingFile, profileId);
        path = uploaded.path;
      }
      await savePayslip(asPayslip(draft, editingId ?? `payslip_${Date.now()}`, path));
      setIsOpen(false);
    } catch (err) {
      toast({
        title: 'Could not attach the file',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Reads the figures out of the chosen PDF and fills the blanks.
   *
   * Only the blanks: anything already typed is the person's, and a parser
   * should not overwrite a correction someone made because it disagreed.
   */
  const handleFile = async (file: File | null) => {
    setPendingFile(file);
    setReadCount(null);
    if (!file || file.type !== 'application/pdf') return;
    setIsReading(true);
    try {
      const parsed = await extractPayslipFromPdf(file);
      setReadCount(parsedFieldCount(parsed));
      setDraft(d => ({
        ...d,
        payDate: d.payDate === EMPTY_DRAFT.payDate && parsed.payDate ? parsed.payDate : d.payDate,
        gross: fill(d.gross, parsed.gross),
        incomeTax: fill(d.incomeTax, parsed.incomeTax),
        nationalInsurance: fill(d.nationalInsurance, parsed.nationalInsurance),
        pensionEmployee: fill(d.pensionEmployee, parsed.pensionEmployee),
        pensionEmployer: fill(d.pensionEmployer, parsed.pensionEmployer),
        studentLoan: fill(d.studentLoan, parsed.studentLoan),
        net: fill(d.net, parsed.net),
      }));
    } catch (err) {
      // A PDF that cannot be read is not a failure worth blocking on: the
      // fields are still there to type into, and the file still archives.
      toast({
        title: 'Could not read that PDF',
        description: err instanceof Error ? err.message : 'Type the figures in instead.',
      });
    } finally {
      setIsReading(false);
    }
  };

  const openDocument = async (path: string) => {
    const url = await signedDocumentUrl(path);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else toast({ title: 'Could not open the document', variant: 'destructive' });
  };

  const removePayslip = (p: Payslip) =>
    askDelete({
      name: `payslip for ${p.payDate}`,
      onConfirm: async () => {
        await deletePayslip(p.id);
        // After the row, so a storage failure cannot strand the record.
        if (p.storagePath) await deleteFinanceDocument(p.storagePath);
      },
    });

  const set = (key: keyof Draft) => (value: string) => setDraft(d => ({ ...d, [key]: value }));

  return (
    <div className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">Payslips</h3>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {payslips.length === 0
              ? 'Capture the figures; the PDF is only an archive.'
              : `${thisYear.length} in ${currentTaxYear}/${String(currentTaxYear + 1).slice(2)}`}
          </p>
        </div>
        <Button size="sm" onClick={openNew} className="h-8 rounded-lg bg-primary text-primary-foreground text-xs font-mono gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {thisYear.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Gross', formatGBP(totals.gross)],
            ['Take-home', formatGBP(totals.net)],
            ['Deducted', `${deductionRate(sumAsSlip(totals)).toFixed(1)}%`],
            ['Tax + NI', `${effectiveTaxRate(sumAsSlip(totals)).toFixed(1)}%`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border/40 bg-card/40 px-3 py-2">
              <div className="text-xs text-muted-foreground font-mono">{label}</div>
              <div className="text-sm font-semibold text-foreground font-mono tabular-nums">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* The concrete payoff: what was actually deducted, against what the tax
          model predicted. Hidden until there is something to compare. */}
      {loanComparison.modelled !== null && loanComparison.difference !== null && (
        <div className="rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-xs font-mono">
          <span className="text-muted-foreground">Student loan, {currentTaxYear}/{String(currentTaxYear + 1).slice(2)}: </span>
          <span className="font-semibold text-foreground tabular-nums">{formatGBP(loanComparison.actual)}</span>
          <span className="text-muted-foreground"> deducted, against {formatGBP(loanComparison.modelled)} modelled</span>
          {Math.abs(loanComparison.difference) >= 1 && (
            <span className={cn('ml-1 font-semibold', loanComparison.difference > 0 ? 'text-chart-4' : 'text-positive')}>
              ({loanComparison.difference > 0 ? '+' : ''}{formatGBP(loanComparison.difference)})
            </span>
          )}
        </div>
      )}

      {payslips.length > 0 && (
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {payslips.map(p => {
            const check = checkPayslip(p);
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/40 px-3 py-2 hover:bg-card/60 transition-colors">
                {check.reconciles
                  ? <Check className="h-3.5 w-3.5 shrink-0 text-positive" aria-label="Reconciles" />
                  : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Does not reconcile" />}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-foreground font-mono">{p.payDate}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    {p.employer ? `${p.employer} · ` : ''}
                    {formatGBP(totalDeductions(p))} deducted
                    {!check.reconciles && ` · off by ${formatGBP(check.difference)}`}
                  </div>
                </div>
                {p.storagePath && (
                  <button
                    type="button"
                    onClick={() => void openDocument(p.storagePath!)}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    aria-label={`Open the archived document for ${p.payDate}`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </button>
                )}
                <div className="text-xs font-semibold text-foreground font-mono tabular-nums shrink-0">{formatGBP(p.net)}</div>
                <button type="button" onClick={() => openEdit(p)} className="text-muted-foreground hover:text-foreground shrink-0" aria-label={`Edit payslip for ${p.payDate}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removePayslip(p)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  aria-label={`Delete payslip for ${p.payDate}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-md p-6 font-mono">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-wider font-semibold text-foreground">
              {editingId ? 'Edit payslip' : 'Add payslip'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Attach a payslip and its figures are read here, in this tab.
              Nothing is sent anywhere.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="payslip-date" className="text-xs">Pay date</Label>
                <Input id="payslip-date" type="date" value={draft.payDate} onChange={e => set('payDate')(e.target.value)} className="rounded-lg h-9 border-primary/20 bg-background/50 text-xs" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="payslip-employer" className="text-xs">Employer</Label>
                <Input id="payslip-employer" value={draft.employer} onChange={e => set('employer')(e.target.value)} placeholder="Optional" className="rounded-lg h-9 border-primary/20 bg-background/50 text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {MONEY_FIELDS.map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`payslip-${key}`} className="text-xs">{label}</Label>
                  <Input
                    id={`payslip-${key}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft[key]}
                    onChange={e => set(key)(e.target.value)}
                    className="rounded-lg h-9 border-primary/20 bg-background/50 text-xs tabular-nums"
                  />
                </div>
              ))}
            </div>

            {/* The archive. Optional by design: the figures above are the
                record, and this is only the paper they came from (7.P). */}
            <div className="space-y-1">
              <Label htmlFor="payslip-file" className="text-xs">Archive the PDF (optional)</Label>
              {storagePath && !pendingFile ? (
                <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-xs">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => void openDocument(storagePath)}
                    className="min-w-0 flex-1 truncate text-left text-foreground hover:underline"
                  >
                    Document attached
                  </button>
                  {/* Detaches the row from the file; the object itself is only
                      removed when the payslip is deleted, so a mis-click here
                      cannot destroy an archive. */}
                  <button
                    type="button"
                    onClick={() => setStoragePath(undefined)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="Detach the document"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    id="payslip-file"
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    onChange={e => void handleFile(e.target.files?.[0] ?? null)}
                    className="rounded-lg h-9 border-primary/20 bg-background/50 text-xs file:text-xs file:mr-2"
                  />
                  {pendingFile && (
                    <button
                      type="button"
                      onClick={() => setPendingFile(null)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Clear the selected file"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
              {pendingFile && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Paperclip className="h-3 w-3 shrink-0" />
                  {isReading
                    ? 'Reading the figures…'
                    : readCount !== null
                      ? `Read ${readCount} of 7 figures — check them, then save.`
                      : `${pendingFile.name} — uploaded when you save`}
                </p>
              )}
            </div>

            <div className={cn(
              'rounded-lg border px-3 py-2 text-xs',
              !hasFigures
                ? 'border-border/40 bg-card/40 text-muted-foreground'
                : draftCheck.reconciles
                  ? 'border-border/40 bg-card/40 text-muted-foreground'
                  : 'border-destructive/30 bg-destructive/10 text-destructive',
            )}>
              {!hasFigures
                ? <>Attach a payslip to read the figures from it, or type them in.</>
                : draftCheck.reconciles
                  ? <>Gross minus deductions is {formatGBP(draftCheck.expectedNet)}, which matches net.</>
                  : <>Gross minus deductions is {formatGBP(draftCheck.expectedNet)}, but net says {formatGBP(draftCheck.statedNet)} — off by {formatGBP(draftCheck.difference)}.</>}
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2 sm:gap-0">
            <Button variant="outline" type="button" onClick={() => setIsOpen(false)} className="rounded-lg text-xs h-8">Cancel</Button>
            {/* Saveable even when it does not reconcile: it is your payslip, and
                a real one that disagrees with the arithmetic is exactly the
                thing worth recording. */}
            <Button type="button" disabled={isSaving} onClick={() => void handleSave()} className="rounded-lg bg-primary text-primary-foreground text-xs h-8">
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deleteDialog}
    </div>
  );
}

/** Year totals share the per-slip rate helpers by wearing the same shape. */
const sumAsSlip = (t: ReturnType<typeof sumPayslips>): Payslip => ({
  id: 'totals',
  payDate: '',
  gross: t.gross,
  incomeTax: t.incomeTax,
  nationalInsurance: t.nationalInsurance,
  pensionEmployee: t.pensionEmployee,
  pensionEmployer: t.pensionEmployer,
  studentLoan: t.studentLoan,
  otherDeductions: t.otherDeductions,
  net: t.net,
});

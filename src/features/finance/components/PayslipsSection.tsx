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
  checkPayslip, compareToModel, studentLoanPaidInTaxYear, sumPayslips,
  taxYearOf, type Payslip,
} from '@/lib/finance';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format-date';
import { AlertTriangle, ChevronDown, ChevronRight, FileText, Paperclip, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { deleteFinanceDocument, signedDocumentUrl, uploadFinanceDocument } from '../finance-storage';
import { extractPayslipFromPdf } from '../payslip-pdf';
import { PayslipImportDialog } from './PayslipImportDialog';
import { PayslipDetailDialog } from './PayslipDetailDialog';
import { employerLogo } from '../employer-logo';
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
  const [isImportOpen, setIsImportOpen] = useState(false);
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
  const allTime = useMemo(() => sumPayslips(payslips), [payslips]);

  // Tax year first: it is the question every other figure on this surface is
  // bounded by, so grouping any other way by default invites comparing two
  // things measured over different periods.
  const [groupBy, setGroupBy] = useState<'employer' | 'year'>('year');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<Payslip | null>(null);

  /* Two ways of asking the same question. By employer answers "what did that
     job pay me"; by tax year answers "what did I earn that year", which is
     the one HMRC asks. Both keep payslips newest first within a group. */
  const groups = useMemo(() => {
    const buckets = new Map<string, Payslip[]>();
    for (const p of payslips) {
      const key = groupBy === 'employer' ? (p.employer || 'Unattributed') : String(taxYearOf(p.payDate));
      const bucket = buckets.get(key);
      if (bucket) bucket.push(p);
      else buckets.set(key, [p]);
    }

    return [...buckets.entries()]
      .map(([key, slips]) => {
        const totals = sumPayslips(slips);
        const newest = slips[0].payDate;
        const oldest = slips[slips.length - 1].payDate;
        return {
          key,
          slips,
          totals,
          logo: groupBy === 'employer' ? employerLogo(key) : null,
          title: groupBy === 'employer' ? key : `${key}/${String(Number(key) + 1).slice(2)}`,
          subtitle: groupBy === 'employer'
            // A date range says how long the job lasted, which the count does not.
            ? `${slips.length} payslip${slips.length === 1 ? '' : 's'} · ${formatDate(oldest)} – ${formatDate(newest)}`
            : `${slips.length} payslip${slips.length === 1 ? '' : 's'} · ${formatGBP(totals.gross)} earned`,
          sortKey: newest,
        };
      })
      // Newest first either way, so the current job and the current year lead.
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [payslips, groupBy]);

  const loanComparison = useMemo(() => {
    const actual = studentLoanPaidInTaxYear(payslips, currentTaxYear);
    if (thisYear.length === 0 || modelledStudentLoanMonthly === undefined) {
      return compareToModel(actual, null);
    }
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
      name: `payslip for ${formatDate(p.payDate)}`,
      onConfirm: async () => {
        await deletePayslip(p.id);
        // After the row, so a storage failure cannot strand the record.
        if (p.storagePath) await deleteFinanceDocument(p.storagePath);
      },
    });

  const set = (key: keyof Draft) => (value: string) => setDraft(d => ({ ...d, [key]: value }));

  return (
    <div className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">Payslips</h3>
          {payslips.length > 0 && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {payslips.length} from {formatDate(payslips[payslips.length - 1].payDate)} to {formatDate(payslips[0].payDate)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setIsImportOpen(true)} className="h-8 rounded-lg text-xs font-mono gap-1.5 border-border/40 bg-background/30">
            <Upload className="h-3.5 w-3.5" />
            Import
          </Button>
          <Button size="sm" onClick={openNew} className="h-8 rounded-lg bg-primary text-primary-foreground text-xs font-mono gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </div>

      {payslips.length === 0 ? (
        <p className="text-xs text-muted-foreground font-mono">
          Import a folder of payslips, or add one by hand. The figures are read here in
          your browser; the PDF is only ever stored.
        </p>
      ) : (
        <>
          {/* Lifetime, not this year: the point of holding four years of
              payslips is being able to see across them. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Earned', formatGBP(allTime.gross)],
              ['Take-home', formatGBP(allTime.net)],
              ['Tax + NI', formatGBP(allTime.incomeTax + allTime.nationalInsurance)],
              ['Into pension', formatGBP(allTime.pensionEmployee + allTime.pensionEmployer)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border/40 bg-card/40 px-3 py-2">
                <div className="text-xs text-muted-foreground font-mono">{label}</div>
                <div className="text-sm font-semibold text-foreground font-mono tabular-nums">{value}</div>
              </div>
            ))}
          </div>

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

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-muted-foreground">Group by</span>
            {(['year', 'employer'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setGroupBy(mode)}
                className={cn(
                  'rounded-md border px-2 py-0.5 transition-colors',
                  groupBy === mode
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border/40 text-muted-foreground hover:text-foreground hover:border-border/80',
                )}
              >
                {mode === 'employer' ? 'Employer' : 'Tax year'}
              </button>
            ))}
          </div>

          <div className="space-y-3 max-h-[30rem] overflow-y-auto pr-1">
            {groups.map(group => (
              <div key={group.key} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setCollapsed(c => ({ ...c, [group.key]: !c[group.key] }))}
                  className="flex w-full items-center gap-3 rounded-lg border border-border/40 bg-card/40 px-3 py-2 hover:bg-card/60 transition-colors text-left"
                >
                  {collapsed[group.key]
                    ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  {group.logo && (
                    <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md bg-white ring-1 ring-black/10 p-1.5">
                      <img src={group.logo} alt="" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-foreground font-mono truncate">{group.title}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{group.subtitle}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold text-foreground font-mono tabular-nums">
                      {formatGBP(group.totals.net)}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">take-home</div>
                  </div>
                </button>

                {!collapsed[group.key] && (
                  <div className="grid gap-1.5 sm:grid-cols-2 pl-2">
                    {group.slips.map(p => {
                      const check = checkPayslip(p);
                      const captured = p.gross > 0 || p.net > 0;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setDetail(p)}
                          className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/40 px-3 py-2 hover:bg-card/60 hover:border-border/80 transition-colors text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-foreground font-mono">{formatDate(p.payDate)}</div>
                            <div className="text-xs text-muted-foreground font-mono truncate">
                              {groupBy === 'employer'
                                ? (captured ? `${formatGBP(p.gross)} gross` : 'figures not captured yet')
                                : (p.employer || (captured ? `${formatGBP(p.gross)} gross` : 'no employer'))}
                            </div>
                          </div>
                          {captured && !check.reconciles && (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Does not reconcile" />
                          )}
                          {p.storagePath && <FileText className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="PDF archived" />}
                          <div className="text-xs font-semibold text-foreground font-mono tabular-nums shrink-0">
                            {captured ? formatGBP(p.net) : '—'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
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

      <PayslipDetailDialog
        payslip={detail}
        onOpenChange={open => { if (!open) setDetail(null); }}
        onEdit={p => { setDetail(null); openEdit(p); }}
        onOpenPdf={path => void openDocument(path)}
      />

      <PayslipImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />

      {deleteDialog}
    </div>
  );
}

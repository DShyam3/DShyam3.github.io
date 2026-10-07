/**
 * Payslips on the Income surface: capture, list, and what they say.
 *
 * The figures are typed in, not extracted (REHAUL_PLAN.md 7.P). Six numbers
 * once a month, and in return the deduction trends and the student loan
 * reconciliation stop being estimates. A PDF can be archived alongside, but
 * the record here stands without one.
 */

import { useMemo, useRef, useState } from 'react';
import { useFinanceData } from '../FinanceDataContext';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useEducation, useExperience } from '@/hooks/useResume';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatGBP } from '@/features/finance/utils/calculations';
import {
  checkPayslip, compareToModel, findPayslipTransactionCandidates, studentLoanPaidInTaxYear, unambiguousPayslipMatches,
  sumPayslips, taxYearOf, type Payslip,
} from '@/lib/finance';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format-date';
import { toISODate } from '@/lib/finance/dates';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileText, Link2, Paperclip, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { deleteFinanceDocument, signedDocumentUrl, uploadFinanceDocument } from '../finance-storage';
import { extractPayslipFromPdf } from '../payslip-pdf';
import { PayslipImportDialog } from './PayslipImportDialog';
import { PayslipDetailDialog } from './PayslipDetailDialog';
import { employerLogo } from '../employer-logo';
import { parsedFieldCount, parsePayslipFilename, type ParsedPayslip } from '@/lib/finance';
import { useToast } from '@/hooks/use-toast';

/** Every money field, as strings, because a half-typed number is not a number. */
type Draft = Record<
  'payDate' | 'employer' | 'gross' | 'incomeTax' | 'nationalInsurance'
  | 'pensionEmployee' | 'pensionEmployer' | 'studentLoan' | 'otherDeductions' | 'net',
  string
>;

/** A function rather than a constant, so a tab left open overnight defaults to today. */
const emptyDraft = (): Draft => ({
  payDate: toISODate(new Date()),
  employer: '', gross: '', incomeTax: '', nationalInsurance: '',
  pensionEmployee: '', pensionEmployer: '', studentLoan: '', otherDeductions: '', net: '',
});

const num = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Fills a field from the parser, leaving anything typed untouched.
 *
 * Zero counts as untyped: a payslip archived before its figures were read is
 * stored as zeroes, and reading its PDF afterwards has to be able to fill them.
 */
const fill = (current: string, parsed: number | undefined): string =>
  parsed === undefined || num(current) !== 0 ? current : String(parsed);

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
  const {
    payslips,
    payslipReconciliations,
    mockTransactions,
    savePayslip,
    deletePayslip,
    savePayslipReconciliation,
    savePayslipReconciliations,
    deletePayslipReconciliation,
    profileId,
  } = useFinanceData();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const { toast } = useToast();
  const { experience } = useExperience();
  const { education } = useEducation();
  // The same logos as the About page's experience and education rows --
  // nothing fetched, so an employer's mark is only ever one already on this site.
  const orgs = useMemo(
    () => [
      ...experience.map(e => ({ name: e.company, logoUrl: e.logo_url })),
      ...education.map(e => ({ name: e.school, logoUrl: e.logo_url })),
    ],
    [experience, education],
  );
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Payslip | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  // The path already stored, and a file chosen but not yet uploaded. Upload
  // happens on save, so cancelling the dialog leaves no orphan in the bucket.
  const [storagePath, setStoragePath] = useState<string | undefined>();
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [readCount, setReadCount] = useState<number | null>(null);
  // The file whose read is in flight. A read that finishes after another file
  // was chosen, or after the dialog closed, is dropped rather than applied.
  const readingFile = useRef<File | null>(null);
  // Whether the pay date is still a stand-in the document may replace: today's
  // date on a new payslip, or the date on a row with no figures captured. Once
  // someone types a date it is theirs.
  const datePlaceholder = useRef(true);

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

  const reconciliationsByPayslip = useMemo(
    () => new Map(payslipReconciliations.map(reconciliation => [reconciliation.payslipId, reconciliation])),
    [payslipReconciliations],
  );
  const linkedTransactionIds = useMemo(
    () => new Set(payslipReconciliations.map(reconciliation => reconciliation.transactionId)),
    [payslipReconciliations],
  );
  const candidatesByPayslip = useMemo(() => {
    const availableTransactions = mockTransactions.filter(transaction => !linkedTransactionIds.has(transaction.id));
    return new Map(payslips.map(payslip => [
      payslip.id,
      findPayslipTransactionCandidates(payslip, availableTransactions),
    ]));
  }, [linkedTransactionIds, mockTransactions, payslips]);
  const clearMatches = useMemo(
    () => unambiguousPayslipMatches(candidatesByPayslip, new Set(reconciliationsByPayslip.keys())),
    [candidatesByPayslip, reconciliationsByPayslip],
  );
  const [isConfirmingMatches, setIsConfirmingMatches] = useState(false);
  const confirmClearMatches = async () => {
    setIsConfirmingMatches(true);
    try {
      await savePayslipReconciliations(clearMatches);
    } finally {
      setIsConfirmingMatches(false);
    }
  };

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
          logo: groupBy === 'employer' ? employerLogo(key, orgs) : null,
          title: groupBy === 'employer' ? key : `${key}/${String(Number(key) + 1).slice(2)}`,
          subtitle:
            oldest === newest
              ? `${slips.length} payslip · ${formatDate(newest)}`
              : `${slips.length} payslip${slips.length === 1 ? '' : 's'} · ${formatDate(oldest)} – ${formatDate(newest)}`,
          sortKey: newest,
        };
      })
      // Newest first either way, so the current job and the current year lead.
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [payslips, groupBy, orgs]);

  /* The headline figures answer whichever question the grouping is asking.
     Grouped by tax year, a lifetime total sits above per-year groups and
     invites reading one as the other; grouped by employer, the span is every
     job, so all time is the honest scope. The label says which, because two
     figures differing by four years of pay must not look interchangeable. */
  const summary = useMemo(
    () => (groupBy === 'year' ? sumPayslips(thisYear) : allTime),
    [groupBy, thisYear, allTime],
  );
  const summaryScope = groupBy === 'year'
    ? `${currentTaxYear}/${String(currentTaxYear + 1).slice(2)}`
    : 'all time';

  const loanComparison = useMemo(() => {
    const actual = studentLoanPaidInTaxYear(payslips, currentTaxYear);
    if (thisYear.length === 0 || modelledStudentLoanMonthly === undefined) {
      return compareToModel(actual, null);
    }
    return compareToModel(actual, modelledStudentLoanMonthly * thisYear.length);
  }, [payslips, currentTaxYear, modelledStudentLoanMonthly, thisYear.length]);

  const openNew = () => {
    setEditing(null);
    setDraft(emptyDraft());
    setStoragePath(undefined);
    void handleFile(null);
    datePlaceholder.current = true;
    setIsOpen(true);
  };

  const openEdit = (p: Payslip) => {
    setEditing(p);
    setDraft(draftFrom(p));
    setStoragePath(p.storagePath);
    void handleFile(null);
    datePlaceholder.current = p.gross === 0 && p.net === 0;
    setIsOpen(true);
  };

  const handleSave = async () => {
    // Not while the PDF is still being read: saving then stores the blank form,
    // and the figures the read finds a moment later land in a closed dialog.
    if (!draft.payDate || isSaving || isReading) return;
    setIsSaving(true);
    let uploadedPath: string | undefined;
    try {
      if (pendingFile && profileId) {
        // Uploaded here rather than on selection, so a cancelled dialog leaves
        // nothing behind in the bucket.
        uploadedPath = (await uploadFinanceDocument(pendingFile, profileId)).path;
      }
      const outcome = await savePayslip({
        ...asPayslip(draft, editing?.id ?? `payslip_${Date.now()}`, uploadedPath ?? storagePath),
        // Not on this form, so carried over rather than blanked. The line items
        // describe the document they were read from, so a new one drops them.
        notes: editing?.notes,
        lines: uploadedPath ? undefined : editing?.lines,
      });
      if (outcome !== 'saved') {
        // The failure has its own toast; the dialog stays open to retry. A
        // file the row cannot point at is not left behind -- but a save that
        // timed out may still commit, and a row pointing at a deleted file
        // loses the document, where an orphaned file only costs storage.
        if (uploadedPath && outcome === 'failed') await deleteFinanceDocument(uploadedPath);
        return;
      }
      // Only once the row points at the new file, as the import does.
      if (uploadedPath && editing?.storagePath && editing.storagePath !== uploadedPath) {
        await deleteFinanceDocument(editing.storagePath);
      }
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
    readingFile.current = file;
    setPendingFile(file);
    setReadCount(null);
    setIsReading(false);
    if (!file || file.type !== 'application/pdf') return;
    setIsReading(true);
    try {
      const parsed = await extractPayslipFromPdf(file);
      if (readingFile.current !== file) return;
      // The document outranks the filename wherever it produced something,
      // as in the import.
      const fromName = parsePayslipFilename(file.name);
      const payDate = parsed.payDate ?? fromName.payDate;
      const employer = parsed.employer ?? fromName.employer;
      setReadCount(parsedFieldCount(parsed));
      setDraft(d => ({
        ...d,
        payDate: datePlaceholder.current && payDate ? payDate : d.payDate,
        employer: d.employer.trim() === '' && employer ? employer : d.employer,
        gross: fill(d.gross, parsed.gross),
        incomeTax: fill(d.incomeTax, parsed.incomeTax),
        nationalInsurance: fill(d.nationalInsurance, parsed.nationalInsurance),
        pensionEmployee: fill(d.pensionEmployee, parsed.pensionEmployee),
        pensionEmployer: fill(d.pensionEmployer, parsed.pensionEmployer),
        studentLoan: fill(d.studentLoan, parsed.studentLoan),
        net: fill(d.net, parsed.net),
      }));
    } catch (err) {
      if (readingFile.current !== file) return;
      // A PDF that cannot be read is not a failure worth blocking on: the
      // fields are still there to type into, and the file still archives.
      toast({
        title: 'Could not read that PDF',
        description: err instanceof Error ? err.message : 'Type the figures in instead.',
      });
    } finally {
      if (readingFile.current === file) setIsReading(false);
    }
  };

  const openDocument = async (path: string) => {
    const url = await signedDocumentUrl(path);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else toast({ title: 'Could not open the document', variant: 'destructive' });
  };

  /* Asked from the detail or edit dialog, which closes first: the
     confirmation is its own dialog, and one modal over another traps focus. */
  const removePayslip = (p: Payslip) => {
    setDetail(null);
    setIsOpen(false);
    askDelete({
      name: `payslip for ${formatDate(p.payDate)}`,
      onConfirm: async () => {
        // The file only once the row is gone, so a failed delete leaves the
        // payslip with its document rather than pointing at nothing.
        if (await deletePayslip(p.id) && p.storagePath) await deleteFinanceDocument(p.storagePath);
      },
    });
  };

  const set = (key: keyof Draft) => (value: string) => setDraft(d => ({ ...d, [key]: value }));

  return (
    <div className="surface-card rounded-lg border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors space-y-4">
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
          {clearMatches.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-card/40 px-3 py-2">
              <p className="flex min-w-0 flex-1 basis-48 items-start gap-1.5 text-xs text-muted-foreground font-mono">
                <Link2 className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                {clearMatches.length === 1
                  ? '1 payslip has exactly one bank payment for its take-home, on the pay date itself.'
                  : `${clearMatches.length} payslips each have exactly one bank payment for their take-home, on the pay date itself.`}
              </p>
              <Button
                type="button"
                size="sm"
                disabled={isConfirmingMatches}
                onClick={() => void confirmClearMatches()}
                className="h-8 shrink-0 rounded-lg text-xs font-mono"
              >
                {clearMatches.length === 1 ? 'Confirm it' : `Confirm all ${clearMatches.length}`}
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Earned', formatGBP(summary.gross)],
              ['Take-home', formatGBP(summary.net)],
              ['Tax + NI', formatGBP(summary.incomeTax + summary.nationalInsurance)],
              ['Into pension', formatGBP(summary.pensionEmployee + summary.pensionEmployer)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border/40 bg-card/40 px-3 py-2">
                <div className="text-xs text-muted-foreground font-mono">
                  {label} <span className="text-muted-foreground/60">· {summaryScope}</span>
                </div>
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

          <div className="space-y-3">
            {groups.map(group => (
              <div key={group.key} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setCollapsed(c => ({ ...c, [group.key]: !c[group.key] }))}
                  className="flex w-full min-w-0 flex-wrap items-center gap-3 rounded-lg border border-border/40 bg-card/40 px-3 py-2 hover:bg-card/60 transition-colors text-left"
                >
                  {collapsed[group.key]
                    ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  {group.logo && (
                    <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md bg-white ring-1 ring-black/10 p-1.5">
                      <img src={group.logo} alt="" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 basis-32">
                    <div className="text-xs font-semibold text-foreground font-mono [overflow-wrap:anywhere]">{group.title}</div>
                    <div className="text-xs text-muted-foreground font-mono [overflow-wrap:anywhere]">{group.subtitle}</div>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-5 text-right font-mono">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-foreground tabular-nums">
                        {formatGBP(group.totals.gross)}
                      </div>
                      <div className="text-xs text-muted-foreground">gross</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-foreground tabular-nums">
                        {formatGBP(group.totals.net)}
                      </div>
                      <div className="text-xs text-muted-foreground">take-home</div>
                    </div>
                  </div>
                </button>

                {!collapsed[group.key] && (
                  <div className="grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 pl-2">
                    {group.slips.map(p => {
                      const check = checkPayslip(p);
                      const captured = p.gross > 0 || p.net > 0;
                      const reconciliation = reconciliationsByPayslip.get(p.id);
                      const candidateCount = candidatesByPayslip.get(p.id)?.length ?? 0;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setDetail(p)}
                          className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-border/40 bg-card/40 px-3 py-2 hover:bg-card/60 hover:border-border/80 transition-colors text-left"
                        >
                          <div className="min-w-0 flex-1 basis-32">
                            <div className="text-xs font-semibold text-foreground font-mono">{formatDate(p.payDate)}</div>
                            <div className="text-xs text-muted-foreground font-mono [overflow-wrap:anywhere]">
                              {groupBy === 'employer'
                                ? (captured ? `${formatGBP(p.gross)} gross` : 'figures not captured yet')
                                : (
                                    p.employer
                                      ? (captured ? `${p.employer} · ${formatGBP(p.gross)} gross` : `${p.employer} · figures not captured yet`)
                                      : (captured ? `${formatGBP(p.gross)} gross` : 'no employer')
                                  )}
                            </div>
                          </div>
                          {captured && !check.reconciles && (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Does not reconcile" />
                          )}
                          {reconciliation ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-positive" aria-label="Bank payment linked" />
                          ) : candidateCount > 0 ? (
                            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Potential bank payment available" />
                          ) : null}
                          {p.storagePath && <FileText className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="PDF archived" />}
                          <div className="text-right shrink-0">
                            <div className="text-xs font-semibold text-foreground font-mono tabular-nums">
                              {captured ? formatGBP(p.net) : '—'}
                            </div>
                            {captured && <div className="text-xs text-muted-foreground font-mono">take-home</div>}
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
        <DialogContent className="sm:rounded-lg border border-border/40 bg-card max-w-md p-6 font-mono">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-wider font-semibold text-foreground">
              {editing ? 'Edit payslip' : 'Add payslip'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Attach a payslip and its figures are read here, in this tab.
              Nothing is sent anywhere.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
              <div className="space-y-1">
                <Label htmlFor="payslip-date" className="text-xs">Pay date</Label>
                <Input id="payslip-date" type="date" value={draft.payDate} onChange={e => { datePlaceholder.current = false; set('payDate')(e.target.value); }} className="rounded-lg h-9 border-primary/20 bg-background/50 text-xs" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="payslip-employer" className="text-xs">Employer</Label>
                <Input id="payslip-employer" value={draft.employer} onChange={e => set('employer')(e.target.value)} placeholder="Optional" className="rounded-lg h-9 border-primary/20 bg-background/50 text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
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
                      onClick={() => void handleFile(null)}
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
                    : readCount === 0
                      ? 'No figures found in this PDF — type them in, then save.'
                      : readCount !== null
                        ? `Read ${readCount} of 7 figures — check them, then save.`
                        : pendingFile.type === 'application/pdf'
                          ? `${pendingFile.name} — uploaded when you save`
                          : `${pendingFile.name} — images are archived, not read. Type the figures in.`}
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
            {editing && (
              <Button
                variant="ghost"
                type="button"
                disabled={isSaving}
                onClick={() => removePayslip(editing)}
                className="rounded-lg text-xs h-8 gap-1.5 text-muted-foreground hover:text-destructive sm:mr-auto"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
            <Button variant="outline" type="button" onClick={() => setIsOpen(false)} className="rounded-lg text-xs h-8">Cancel</Button>
            {/* Saveable even when it does not reconcile: it is your payslip, and
                a real one that disagrees with the arithmetic is exactly the
                thing worth recording. */}
            <Button type="button" disabled={isSaving || isReading} onClick={() => void handleSave()} className="rounded-lg bg-primary text-primary-foreground text-xs h-8">
              {isSaving ? 'Saving…' : isReading ? 'Reading…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PayslipDetailDialog
        payslip={detail}
        logo={detail ? employerLogo(detail.employer, orgs) : null}
        reconciliation={detail ? reconciliationsByPayslip.get(detail.id) : undefined}
        transaction={detail ? mockTransactions.find(transaction => transaction.id === reconciliationsByPayslip.get(detail.id)?.transactionId) : undefined}
        candidates={detail ? candidatesByPayslip.get(detail.id) : []}
        onOpenChange={open => { if (!open) setDetail(null); }}
        onEdit={p => { setDetail(null); openEdit(p); }}
        onDelete={removePayslip}
        onOpenPdf={path => void openDocument(path)}
        onConfirmTransaction={transactionId => detail
          ? savePayslipReconciliation(detail.id, transactionId)
          : Promise.resolve(false)}
        onRemoveTransaction={() => detail
          ? deletePayslipReconciliation(detail.id)
          : Promise.resolve(false)}
      />

      <PayslipImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />

      {deleteDialog}
    </div>
  );
}

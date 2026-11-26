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
import { useStudentLoanRules } from '../useStudentLoanRules';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useEducation, useExperience } from '@/hooks/useResume';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatGBP } from '@/features/finance/utils/calculations';
import {
  checkPayslip, compareToModel, findDuplicatePayslip, findPayslipReimbursementCandidates, findPayslipTransactionCandidates, isReimbursementLine, studentLoanExpectedInTaxYear, studentLoanPaidInTaxYear,
  unambiguousPayslipMatches,
  calendarYearOf, inCalendarYear, inTaxYear, sumPayslips, taxYearOf, type Payslip, type PayslipLine,
} from '@/lib/finance';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format-date';
import { toISODate } from '@/lib/finance/dates';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Eye, EyeOff, FileText, Link2, Paperclip, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { deleteFinanceDocument, signedDocumentUrl, uploadFinanceDocument } from '../finance-storage';
import { extractPayslipFromPdf } from '../payslip-pdf';
import { useGlobalFiguresHidden } from '../useHiddenFigures';
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

export function PayslipsSection() {
  const {
    payslips,
    payslipReconciliations,
    payslipReimbursementLinks,
    payslipReimbursementsAvailable,
    mockTransactions,
    savePayslip,
    deletePayslip,
    savePayslipReconciliation,
    savePayslipReconciliations,
    deletePayslipReconciliation,
    savePayslipReimbursementLink,
    deletePayslipReimbursementLink,
    profileId,
    settings,
  } = useFinanceData();
  const { planRules, repaymentThreshold } = useStudentLoanRules();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const { toast } = useToast();
  const { experience } = useExperience();
  const { education } = useEducation();
  // The same logos as the About page's experience and education rows --
  // nothing fetched, so an employer's mark is only ever one already on this site.
  const orgs = useMemo(
    () => [
      ...experience.map(e => ({ name: e.company, aliases: e.aliases, logoUrl: e.logo_url })),
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
  const [parsedLines, setParsedLines] = useState<PayslipLine[] | undefined>();
  const [revealFigures, setRevealFigures] = useState(false);
  const globalFiguresHidden = useGlobalFiguresHidden();
  // The file whose read is in flight. A read that finishes after another file
  // was chosen, or after the dialog closed, is dropped rather than applied.
  const readingFile = useRef<File | null>(null);
  // Whether the pay date is still a stand-in the document may replace: today's
  // date on a new payslip, or the date on a row with no figures captured. Once
  // someone types a date it is theirs.
  const datePlaceholder = useRef(true);

  const duplicatePayslip = useMemo(
    () => findDuplicatePayslip(payslips, { payDate: draft.payDate, employer: draft.employer, excludeId: editing?.id }),
    [payslips, draft.payDate, draft.employer, editing?.id],
  );

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
    () => inTaxYear(payslips, currentTaxYear),
    [payslips, currentTaxYear],
  );
  // The calendar year of the newest payslip, as the tax year above is: the
  // year the headline figures cover when grouped by calendar year.
  const currentCalendarYear = useMemo(
    () => calendarYearOf(payslips.length > 0 ? payslips[0].payDate : new Date().toISOString()),
    [payslips],
  );
  const thisCalendarYear = useMemo(
    () => inCalendarYear(payslips, currentCalendarYear),
    [payslips, currentCalendarYear],
  );
  const allTime = useMemo(() => sumPayslips(payslips), [payslips]);


  // Tax year first: it is the question every other figure on this surface is
  // bounded by, so grouping any other way by default invites comparing two
  // things measured over different periods.
  const [groupBy, setGroupBy] = useState<'year' | 'calendar' | 'employer'>('year');
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
  const [updatingReimbursement, setUpdatingReimbursement] = useState<string | null>(null);
  const [newReimbursementPayslip, setNewReimbursementPayslip] = useState('');
  const [newReimbursementLabel, setNewReimbursementLabel] = useState('Expense reimbursement');
  const [newReimbursementAmount, setNewReimbursementAmount] = useState('');
  const [isSavingReimbursementLine, setIsSavingReimbursementLine] = useState(false);
  const reimbursementRows = useMemo(() => {
    const usedTransactionIds = new Set(payslipReimbursementLinks.map(link => link.transactionId));
    const availableSpending = mockTransactions.filter(transaction =>
      !usedTransactionIds.has(transaction.id)
      && transaction.providerCategory !== 'transfer'
      && transaction.category.toLowerCase() !== 'transfer');
    return payslips.flatMap(payslip => {
      const candidates = findPayslipReimbursementCandidates(payslip, availableSpending);
      const eligibleRows = (payslip.lines ?? []).flatMap((line, lineIndex) => {
        if (line.kind !== 'payment' || !isReimbursementLine(line.label) || line.amount <= 0) return [];
        const link = payslipReimbursementLinks.find(item => item.payslipId === payslip.id && item.lineIndex === lineIndex);
        const transaction = link && mockTransactions.find(item => item.id === link.transactionId);
        const current = Boolean(link && transaction && line.label === link.lineLabel
          && Math.round(line.amount * 100) === Math.round(link.lineAmount * 100)
          && findPayslipReimbursementCandidates(payslip, [transaction])
            .some(candidate => candidate.lineIndex === lineIndex && candidate.transactionId === transaction.id));
        return [{ payslip, line, lineIndex, link, transaction, current,
          candidates: candidates.filter(candidate => candidate.lineIndex === lineIndex) }];
      });
      const eligibleIndexes = new Set(eligibleRows.map(row => row.lineIndex));
      const staleRows = payslipReimbursementLinks
        .filter(link => link.payslipId === payslip.id && !eligibleIndexes.has(link.lineIndex))
        .map(link => ({
          payslip,
          line: { label: link.lineLabel, amount: link.lineAmount, kind: 'payment' as const },
          lineIndex: link.lineIndex,
          link,
          transaction: mockTransactions.find(item => item.id === link.transactionId),
          current: false,
          candidates: [],
        }));
      return [...eligibleRows, ...staleRows];
    });
  }, [mockTransactions, payslipReimbursementLinks, payslips]);
  const confirmReimbursement = async (payslipId: string, lineIndex: number, transactionId: string) => {
    setUpdatingReimbursement(`${payslipId}:${lineIndex}`);
    try {
      await savePayslipReimbursementLink(payslipId, lineIndex, transactionId);
    } finally {
      setUpdatingReimbursement(null);
    }
  };
  const unlinkReimbursement = async (id: string) => {
    setUpdatingReimbursement(id);
    try {
      await deletePayslipReimbursementLink(id);
    } finally {
      setUpdatingReimbursement(null);
    }
  };
  const addReimbursementLine = async () => {
    const payslip = payslips.find(item => item.id === newReimbursementPayslip);
    const amount = Number(newReimbursementAmount);
    const label = newReimbursementLabel.trim();
    if (!payslip || !isReimbursementLine(label) || !Number.isFinite(amount) || amount <= 0) return;
    setIsSavingReimbursementLine(true);
    try {
      const outcome = await savePayslip({
        ...payslip,
        lines: [...(payslip.lines ?? []), { kind: 'payment', label, amount }],
      });
      if (outcome === 'saved') {
        setNewReimbursementAmount('');
        setNewReimbursementLabel('Expense reimbursement');
      }
    } finally {
      setIsSavingReimbursementLine(false);
    }
  };
  const removeReimbursementLine = async (payslip: Payslip, lineIndex: number) => {
    setUpdatingReimbursement(`${payslip.id}:${lineIndex}`);
    try {
      await savePayslip({ ...payslip, lines: (payslip.lines ?? []).filter((_, index) => index !== lineIndex) });
    } finally {
      setUpdatingReimbursement(null);
    }
  };
  const confirmClearMatches = async () => {
    setIsConfirmingMatches(true);
    try {
      await savePayslipReconciliations(clearMatches);
    } finally {
      setIsConfirmingMatches(false);
    }
  };

  /* Three ways of asking the same question. By employer answers "what did
     that job pay me"; by tax year answers "what did I earn that year", which
     is the one HMRC asks; by calendar year answers it January to December,
     which is what a lender or a year-on-year comparison asks. All keep
     payslips newest first within a group. */
  const groups = useMemo(() => {
    const buckets = new Map<string, Payslip[]>();
    for (const p of payslips) {
      const key = groupBy === 'employer'
        ? (p.employer || 'Unattributed')
        : String(groupBy === 'calendar' ? calendarYearOf(p.payDate) : taxYearOf(p.payDate));
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
          // Tax year 2025 and calendar year 2025 share the key "2025" but not
          // their payslips, so a group folded in one mode stays its own.
          collapseKey: `${groupBy}:${key}`,
          slips,
          totals,
          logo: groupBy === 'employer' ? employerLogo(key, orgs) : null,
          title: groupBy === 'year' ? `${key}/${String(Number(key) + 1).slice(2)}` : key,
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
     Grouped by either kind of year, a lifetime total sits above per-year
     groups and invites reading one as the other, so the headline is the
     newest year of that kind; grouped by employer, the span is every job, so
     all time is the honest scope. The label says which, because two figures
     differing by four years of pay must not look interchangeable. */
  const summary = useMemo(
    () => (groupBy === 'year'
      ? sumPayslips(thisYear)
      : groupBy === 'calendar' ? sumPayslips(thisCalendarYear) : allTime),
    [groupBy, thisYear, thisCalendarYear, allTime],
  );
  const summaryScope = groupBy === 'year'
    ? `${currentTaxYear}/${String(currentTaxYear + 1).slice(2)}`
    : groupBy === 'calendar' ? String(currentCalendarYear) : 'all time';

  // Each payslip against what its own pay owes, not today's salary times the
  // count: an earlier, lower-paid job and a month paid by two employers both
  // owe less than that, and payroll got them right.
  const loanComparison = useMemo(() => {
    const actual = studentLoanPaidInTaxYear(payslips, currentTaxYear);
    const plan = settings.studentLoanPlan;
    if (thisYear.length === 0 || plan === 'none') return compareToModel(actual, null);
    const expected = studentLoanExpectedInTaxYear(payslips, currentTaxYear, {
      annualThreshold: repaymentThreshold(plan),
      ratePercent: planRules(plan).repaymentRate,
      pensionType: settings.pensionType,
    });
    return compareToModel(actual, expected ?? null);
  }, [payslips, currentTaxYear, thisYear.length, settings.studentLoanPlan, settings.pensionType, planRules, repaymentThreshold]);

  const openNew = () => {
    setEditing(null);
    setDraft(emptyDraft());
    setStoragePath(undefined);
    setParsedLines(undefined);
    setRevealFigures(false);
    void handleFile(null);
    datePlaceholder.current = true;
    setIsOpen(true);
  };

  const openEdit = (p: Payslip) => {
    setEditing(p);
    setDraft(draftFrom(p));
    setStoragePath(p.storagePath);
    setParsedLines(undefined);
    setRevealFigures(false);
    void handleFile(null);
    datePlaceholder.current = p.gross === 0 && p.net === 0;
    setIsOpen(true);
  };

  const handleSave = async () => {
    // Not while the PDF is still being read: saving then stores the blank form,
    // and the figures the read finds a moment later land in a closed dialog.
    if (!draft.payDate || isSaving || isReading || duplicatePayslip) return;
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
        lines: parsedLines ?? (uploadedPath ? undefined : editing?.lines),
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
    setParsedLines(undefined);
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
      setParsedLines(parsed.lines);
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
        otherDeductions: fill(d.otherDeductions, parsed.otherDeductions),
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
    <div className="surface-card space-y-6 rounded-2xl border border-border/40 bg-card/50 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">Payslips</h3>
          {payslips.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {payslips.length} payslips · {formatDate(payslips[payslips.length - 1].payDate)} – {formatDate(payslips[0].payDate)}
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

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {[
              ['Take-home', formatGBP(summary.net)],
              ['Earned', formatGBP(summary.gross)],
              ['Tax + NI', formatGBP(summary.incomeTax + summary.nationalInsurance)],
              ['Into pension', formatGBP(summary.pensionEmployee + summary.pensionEmployer)],
            ].map(([label, value], index) => (
              <div key={label} className={cn('min-w-0 rounded-xl border px-3 py-3 sm:px-4 sm:py-4', index === 0 ? 'border-primary/25 bg-primary/10' : 'border-border/40 bg-card/60')}>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
                <div className="mt-1 font-mono text-base font-semibold tabular-nums tracking-tight text-foreground sm:text-lg [overflow-wrap:anywhere]">{value}</div>
              </div>
            ))}
          </div>
          <p className="-mt-4 text-xs text-muted-foreground">Totals for {groupBy === 'employer' ? 'all payslips' : groupBy === 'year' ? `tax year ${summaryScope}` : `calendar year ${summaryScope}`}</p>

          {loanComparison.modelled !== null && loanComparison.difference !== null && (
            <div className="rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-xs font-mono">
              <span className="text-muted-foreground">Student loan, {currentTaxYear}/{String(currentTaxYear + 1).slice(2)}: </span>
              <span className="font-semibold text-foreground tabular-nums">{formatGBP(loanComparison.actual)}</span>
              <span className="text-muted-foreground"> deducted, against {formatGBP(loanComparison.modelled)} due on each payslip&apos;s pay</span>
              {Math.abs(loanComparison.difference) >= 1 && (
                <span className={cn('ml-1 font-semibold', loanComparison.difference > 0 ? 'text-chart-4' : 'text-positive')}>
                  ({loanComparison.difference > 0 ? '+' : ''}{formatGBP(loanComparison.difference)})
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-5 text-xs">
            <span className="mr-1 whitespace-nowrap font-medium text-muted-foreground">Group by</span>
            {(['year', 'calendar', 'employer'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setGroupBy(mode)}
                className={cn(
                  'whitespace-nowrap rounded-full border px-3 py-1.5 transition-colors',
                  groupBy === mode
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border/40 text-muted-foreground hover:text-foreground hover:border-border/80',
                )}
              >
                {mode === 'employer' ? 'Employer' : mode === 'calendar' ? 'Calendar year' : 'Tax year'}
              </button>
            ))}
          </div>

          <div className="space-y-5">
            {groups.map(group => (
              <section key={group.collapseKey} className="overflow-hidden rounded-2xl border border-border/50 bg-card/70">
                <button
                  type="button"
                  aria-expanded={!collapsed[group.collapseKey]}
                  onClick={() => setCollapsed(c => ({ ...c, [group.collapseKey]: !c[group.collapseKey] }))}
                  className="flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-3 bg-primary/5 px-4 py-4 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
                >
                  {group.logo && (
                    <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md bg-white ring-1 ring-black/10 p-1.5">
                      <img src={group.logo} alt="" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="text-base font-semibold text-foreground [overflow-wrap:anywhere]">{group.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{group.subtitle}</div>
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-x-5 gap-y-2 font-mono sm:ml-auto sm:text-right">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Earned</div>
                      <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{formatGBP(group.totals.gross)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Take-home</div>
                      <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{formatGBP(group.totals.net)}</div>
                    </div>
                  </div>
                  {collapsed[group.collapseKey]
                    ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>

                {!collapsed[group.collapseKey] && (
                  <div className="divide-y divide-border/35 border-t border-border/40">
                    {group.slips.map(p => {
                      const check = checkPayslip(p);
                      const captured = p.gross > 0 || p.net > 0;
                      const reconciliation = reconciliationsByPayslip.get(p.id);
                      const candidateCount = candidatesByPayslip.get(p.id)?.length ?? 0;
                      const logo = groupBy === 'employer' ? null : employerLogo(p.employer, orgs);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setDetail(p)}
                          className="group grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[8.5rem_minmax(0,1fr)_auto] sm:px-5"
                        >
                          <span className="font-mono text-xs font-semibold tabular-nums text-foreground">{formatDate(p.payDate)}</span>
                          <div className="col-start-1 row-start-2 flex min-w-0 items-center gap-3 sm:col-start-2 sm:row-start-1">
                            {logo && (
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white p-1.5 ring-1 ring-black/10">
                                <img src={logo} alt="" className="h-full w-full object-contain" />
                              </span>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-foreground [overflow-wrap:anywhere]">
                                {groupBy === 'employer' ? (captured ? 'Payslip' : 'Figures not captured yet') : p.employer || 'No employer'}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                {captured && <span className="font-mono tabular-nums">{formatGBP(p.gross)} gross</span>}
                                {!captured && groupBy !== 'employer' && <span>Figures not captured yet</span>}
                                {captured && !check.reconciles && <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Does not add up</span>}
                                {reconciliation ? (
                                  <span className="inline-flex items-center gap-1 text-positive"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Bank matched</span>
                                ) : candidateCount > 0 ? (
                                  <span className="inline-flex items-center gap-1"><Link2 className="h-3.5 w-3.5" aria-hidden="true" /> Bank match available</span>
                                ) : null}
                                {p.storagePath && <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" aria-hidden="true" /> PDF</span>}
                              </div>
                            </div>
                          </div>
                          <div className="col-start-2 row-span-2 text-right sm:col-start-3 sm:row-span-1">
                            <div className="font-mono text-sm font-semibold tabular-nums text-foreground sm:text-base">
                              {captured ? formatGBP(p.net) : '—'}
                            </div>
                            {captured && <div className="text-xs text-muted-foreground">take-home</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>

          {payslipReimbursementsAvailable && <section className="space-y-3 border-t border-border/40 pt-5" aria-labelledby="payslip-reimbursements-heading">
              <div>
                <h4 id="payslip-reimbursements-heading" className="text-sm font-semibold text-foreground">Expenses paid back through payroll</h4>
                <p className="mt-1 text-xs text-muted-foreground">Exact amount matches from spending in the 120 days before each payslip. Confirm the expense yourself.</p>
              </div>
              <div className="grid gap-2 rounded-xl border border-border/40 bg-card/50 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_auto] sm:items-end">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="reimbursement-payslip" className="text-xs">Payslip</Label>
                  <select id="reimbursement-payslip" value={newReimbursementPayslip} onChange={event => setNewReimbursementPayslip(event.target.value)} className="h-9 w-full min-w-0 rounded-lg border border-border/50 bg-background px-2 text-xs text-foreground">
                    <option value="">Choose payslip</option>
                    {payslips.map(payslip => <option key={payslip.id} value={payslip.id}>{formatDate(payslip.payDate)} · {payslip.employer || 'Payslip'}</option>)}
                  </select>
                </div>
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="reimbursement-label" className="text-xs">Payslip line</Label>
                  <Input id="reimbursement-label" value={newReimbursementLabel} onChange={event => setNewReimbursementLabel(event.target.value)} className="h-9 text-xs" />
                </div>
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="reimbursement-amount" className="text-xs">Amount paid back</Label>
                  <Input id="reimbursement-amount" type="number" min="0.01" step="0.01" value={newReimbursementAmount} onChange={event => setNewReimbursementAmount(event.target.value)} className="h-9 text-xs" />
                </div>
                <Button type="button" size="sm" variant="outline" className="h-9 text-xs" disabled={isSavingReimbursementLine || !newReimbursementPayslip || !isReimbursementLine(newReimbursementLabel) || !(Number(newReimbursementAmount) > 0)} onClick={() => void addReimbursementLine()}>
                  Add line
                </Button>
              </div>
              {reimbursementRows.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {reimbursementRows.map(({ payslip, line, lineIndex, link, transaction, current, candidates }) => (
                  <div key={`${payslip.id}:${lineIndex}`} className="min-w-0 rounded-xl border border-border/40 bg-card/60 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground [overflow-wrap:anywhere]">{line.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(payslip.payDate)} · {payslip.employer || 'Payslip'}</p>
                      </div>
                      <span className="font-mono text-xs font-semibold tabular-nums text-foreground">{formatGBP(line.amount)}</span>
                    </div>
                    {!link && !payslipReimbursementLinks.some(item => item.payslipId === payslip.id && item.lineIndex > lineIndex) && (
                      <Button size="sm" variant="ghost" className="mt-1 h-7 px-1 text-xs text-muted-foreground" disabled={updatingReimbursement !== null} onClick={() => void removeReimbursementLine(payslip, lineIndex)}>Remove line</Button>
                    )}
                    {link ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/30 pt-2">
                        <p className={cn('min-w-0 text-xs', current ? 'text-positive' : 'text-destructive')}>
                          {current ? 'Confirmed' : 'Needs review'} · {transaction ? `${transaction.name} · ${formatDate(transaction.date)}` : 'Expense unavailable'}
                        </p>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={updatingReimbursement !== null} onClick={() => void unlinkReimbursement(link.id)}>Unlink</Button>
                      </div>
                    ) : candidates.length > 0 ? (
                      <div className="mt-3 space-y-2 border-t border-border/30 pt-2">
                        {candidates.map(candidate => (
                          <div key={candidate.transactionId} className="flex min-w-0 items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-xs text-muted-foreground" title={candidate.name}>{candidate.name} · {formatDate(candidate.date)}</p>
                            <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" disabled={updatingReimbursement !== null} onClick={() => void confirmReimbursement(payslip.id, lineIndex, candidate.transactionId)}>Confirm</Button>
                          </div>
                        ))}
                      </div>
                    ) : <p className="mt-3 border-t border-border/30 pt-2 text-xs text-muted-foreground">No exact expense match found</p>}
                  </div>
                ))}
              </div>
              )}
            </section>}
        </>
      )}

      <Dialog open={isOpen} onOpenChange={open => { setIsOpen(open); if (!open) setRevealFigures(false); }}>
        <DialogContent
          data-reveal-figures={revealFigures ? 'true' : undefined}
          className="sm:rounded-lg border border-border/40 bg-card max-w-md p-6 font-mono"
        >
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-8">
              <DialogTitle className="text-sm uppercase tracking-wider font-semibold text-foreground">
                {editing ? 'Edit payslip' : 'Add payslip'}
              </DialogTitle>
              {globalFiguresHidden && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRevealFigures(v => !v)}
                  className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
                >
                  {revealFigures ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                  {revealFigures ? 'Hide figures' : 'Show figures'}
                </Button>
              )}
            </div>
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
                        ? `Read ${readCount} of 7 figures${parsedLines?.length ? ` + ${parsedLines.length} benefit${parsedLines.length === 1 ? '' : 's'}` : ''} — check them, then save.`
                        : pendingFile.type === 'application/pdf'
                          ? `${pendingFile.name} — uploaded when you save`
                          : `${pendingFile.name} — images are archived, not read. Type the figures in.`}
                </p>
              )}
            </div>

            {duplicatePayslip && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <span className="flex items-center gap-1.5 min-w-0">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Already added for {formatDate(duplicatePayslip.payDate)}
                    {duplicatePayslip.employer ? ` (${duplicatePayslip.employer})` : ''}.
                  </span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(duplicatePayslip)}
                  className="h-7 px-2 text-xs border-destructive/40 text-destructive hover:bg-destructive/15"
                >
                  Edit existing
                </Button>
              </div>
            )}

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
            <Button type="button" disabled={isSaving || isReading || Boolean(duplicatePayslip)} onClick={() => void handleSave()} className="rounded-lg bg-primary text-primary-foreground text-xs h-8">
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

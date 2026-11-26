/**
 * Re-scan archived payslip PDFs in the browser using the latest parser.
 *
 * Downloads each stored PDF via a short-lived signed URL, parses it locally
 * with pdf.js, and shows any improved or newly-found figures for review before
 * saving back to Supabase.
 */

import { useEffect, useState } from 'react';
import { useFinanceData } from '../FinanceDataContext';
import { signedDocumentUrl } from '../finance-storage';
import { extractPayslipFromPdf } from '../payslip-pdf';
import { useGlobalFiguresHidden } from '../useHiddenFigures';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatGBP } from '@/features/finance/utils/calculations';
import { checkPayslip, type Payslip } from '@/lib/finance';
import { formatDate } from '@/lib/format-date';
import { Check, Eye, EyeOff, RefreshCw } from 'lucide-react';

interface RescanRow {
  existing: Payslip;
  proposed: Payslip;
  changes: string[];
  include: boolean;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

const buildRescanRow = (existing: Payslip, parsed: Awaited<ReturnType<typeof extractPayslipFromPdf>>): RescanRow | null => {
  const existingReconciles = checkPayslip(existing).reconciles;
  const candidate: Payslip = {
    ...existing,
    gross: existing.gross === 0 && parsed.gross !== undefined ? parsed.gross : existing.gross,
    incomeTax: existing.incomeTax === 0 && parsed.incomeTax !== undefined ? parsed.incomeTax : existing.incomeTax,
    nationalInsurance: existing.nationalInsurance === 0 && parsed.nationalInsurance !== undefined ? parsed.nationalInsurance : existing.nationalInsurance,
    pensionEmployee: existing.pensionEmployee === 0 && parsed.pensionEmployee !== undefined ? parsed.pensionEmployee : existing.pensionEmployee,
    pensionEmployer: existing.pensionEmployer === 0 && parsed.pensionEmployer !== undefined ? parsed.pensionEmployer : existing.pensionEmployer,
    studentLoan: existing.studentLoan === 0 && parsed.studentLoan !== undefined ? parsed.studentLoan : existing.studentLoan,
    otherDeductions: existing.otherDeductions === 0 && parsed.otherDeductions !== undefined ? parsed.otherDeductions : existing.otherDeductions,
    net: existing.net === 0 && parsed.net !== undefined ? parsed.net : existing.net,
    lines: existing.lines?.length ? existing.lines : parsed.lines,
  };

  // If the stored row doesn't reconcile (e.g. payrolled BIKs inflated gross or
  // otherDeductions) and the updated parse does reconcile, prefer the parsed values.
  if (!existingReconciles && parsed.gross !== undefined && parsed.net !== undefined) {
    const parsedCheck = checkPayslip({
      ...candidate,
      gross: parsed.gross,
      otherDeductions: parsed.otherDeductions ?? 0,
    });
    if (parsedCheck.reconciles) {
      candidate.gross = parsed.gross;
      candidate.otherDeductions = parsed.otherDeductions ?? 0;
    }
  }

  const changes: string[] = [];
  const track = (label: string, before: number, after: number) => {
    if (Math.abs(round2(before) - round2(after)) >= 0.01) {
      changes.push(`${label}: ${formatGBP(before)} → ${formatGBP(after)}`);
    }
  };
  track('Gross', existing.gross, candidate.gross);
  track('Income tax', existing.incomeTax, candidate.incomeTax);
  track('NI', existing.nationalInsurance, candidate.nationalInsurance);
  track('Pension (yours)', existing.pensionEmployee, candidate.pensionEmployee);
  track('Pension (employer)', existing.pensionEmployer, candidate.pensionEmployer);
  track('Student loan', existing.studentLoan, candidate.studentLoan);
  track('Other deductions', existing.otherDeductions, candidate.otherDeductions);
  track('Net', existing.net, candidate.net);

  if (changes.length === 0) return null;
  return { existing, proposed: candidate, changes, include: true };
};

export function PayslipRescanDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { payslips, savePayslip } = useFinanceData();
  const [rows, setRows] = useState<RescanRow[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasScanned, setHasScanned] = useState(false);
  const [revealFigures, setRevealFigures] = useState(false);
  const globalFiguresHidden = useGlobalFiguresHidden();

  useEffect(() => {
    if (!open) {
      setRevealFigures(false);
      setHasScanned(false);
      setRows([]);
      return;
    }
    let cancelled = false;
    const pdfSlips = payslips.filter(p => p.storagePath?.toLowerCase().endsWith('.pdf'));
    setTotalCount(pdfSlips.length);
    setScannedCount(0);
    setIsScanning(true);
    setHasScanned(false);
    setRows([]);

    void (async () => {
      const updates: RescanRow[] = [];
      for (let i = 0; i < pdfSlips.length; i++) {
        if (cancelled) return;
        const slip = pdfSlips[i];
        try {
          const url = slip.storagePath ? await signedDocumentUrl(slip.storagePath) : null;
          if (url) {
            const response = await fetch(url);
            if (response.ok) {
              const blob = await response.blob();
              const file = new File([blob], 'payslip.pdf', { type: 'application/pdf' });
              const parsed = await extractPayslipFromPdf(file);
              const row = buildRescanRow(slip, parsed);
              if (row) updates.push(row);
            }
          }
        } catch {
          // Skip unreadable PDFs rather than aborting the batch.
        }
        if (!cancelled) setScannedCount(i + 1);
      }
      if (!cancelled) {
        setRows(updates);
        setIsScanning(false);
        setHasScanned(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, payslips]);

  const selected = rows.filter(r => r.include);

  const handleApply = async () => {
    if (selected.length === 0 || isSaving) return;
    setIsSaving(true);
    for (const row of selected) {
      await savePayslip(row.proposed);
    }
    setIsSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-reveal-figures={revealFigures ? 'true' : undefined}
        className="sm:rounded-lg border border-border/40 bg-card max-w-2xl p-6 font-mono"
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="text-sm uppercase tracking-wider font-semibold text-foreground">
              Re-scan stored PDFs
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
            Reads your archived payslip PDFs in this tab and lists any newly found or corrected figures.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {isScanning && (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
              Scanning {scannedCount} of {totalCount} stored PDFs…
            </p>
          )}

          {hasScanned && rows.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Scanned {totalCount} stored PDF{totalCount === 1 ? '' : 's'} — everything is already up to date.
            </p>
          )}

          {rows.length > 0 && (
            <div className="space-y-1.5 max-h-[45dvh] overflow-y-auto pr-1">
              {rows.map((row, index) => (
                <div key={row.existing.id} className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/40 px-3 py-2">
                  <Checkbox
                    checked={row.include}
                    onCheckedChange={() => setRows(rs => rs.map((r, i) => (i === index ? { ...r, include: !r.include } : r)))}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-primary/30 shrink-0"
                    aria-label={`Update payslip for ${formatDate(row.existing.payDate)}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-foreground">
                      {formatDate(row.existing.payDate)}
                      {row.existing.employer ? ` · ${row.existing.employer}` : ''}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground space-y-0.5">
                      {row.changes.map(change => (
                        <div key={change}>{change}</div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 gap-2 sm:gap-0">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} className="rounded-lg text-xs h-8">
            Close
          </Button>
          {rows.length > 0 && (
            <Button
              type="button"
              disabled={selected.length === 0 || isScanning || isSaving}
              onClick={() => void handleApply()}
              className="rounded-lg bg-primary text-primary-foreground text-xs h-8 gap-1.5"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {isSaving ? 'Updating…' : `Apply ${selected.length} update${selected.length === 1 ? '' : 's'}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

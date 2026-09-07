/**
 * Import a folder of payslips at once.
 *
 * Every file is read in this tab: parsed by pdf.js, checked, and shown before
 * anything is written (REHAUL_PLAN.md 7.P). Nothing is sent to a model, and
 * the PDFs are uploaded only as archives, only when you press import.
 *
 * The review step is the point. A parser that quietly wrote twenty rows would
 * be worse than typing them, because a wrong figure would arrive looking
 * exactly like a right one.
 */

import { useState } from 'react';
import { useFinanceData } from '../FinanceDataContext';
import { extractPayslipFromPdf } from '../payslip-pdf';
import { uploadFinanceDocument } from '../finance-storage';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatGBP } from '@/features/finance/utils/calculations';
import { checkPayslip, parsePayslipFilename, parsedFieldCount, type Payslip } from '@/lib/finance';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format-date';
import { AlertTriangle, Ban, Check, Upload } from 'lucide-react';

interface Row {
  file: File;
  slip: Payslip;
  /** Money fields the PDF yielded, out of seven. */
  found: number;
  /** True when the pay date came from the filename rather than the document. */
  dateFromName: boolean;
  include: boolean;
  error?: string;
}

const rowFrom = async (file: File): Promise<Row> => {
  const fromName = parsePayslipFilename(file.name);
  const base: Payslip = {
    id: `payslip_import_${crypto.randomUUID()}`,
    payDate: fromName.payDate ?? '',
    employer: fromName.employer,
    gross: 0, incomeTax: 0, nationalInsurance: 0, pensionEmployee: 0,
    pensionEmployer: 0, studentLoan: 0, otherDeductions: 0, net: 0,
  };

  try {
    const parsed = await extractPayslipFromPdf(file);
    const slip: Payslip = {
      ...base,
      // The document outranks the filename wherever it produced something.
      payDate: parsed.payDate ?? base.payDate,
      employer: parsed.employer ?? base.employer,
      gross: parsed.gross ?? 0,
      incomeTax: parsed.incomeTax ?? 0,
      nationalInsurance: parsed.nationalInsurance ?? 0,
      pensionEmployee: parsed.pensionEmployee ?? 0,
      pensionEmployer: parsed.pensionEmployer ?? 0,
      studentLoan: parsed.studentLoan ?? 0,
      net: parsed.net ?? 0,
    };
    return {
      file,
      slip,
      found: parsedFieldCount(parsed),
      dateFromName: !parsed.payDate && !!fromName.payDate,
      // Nothing readable is not worth importing as a row of zeroes.
      include: parsedFieldCount(parsed) > 0 && !!slip.payDate,
    };
  } catch (err) {
    return {
      file, slip: base, found: 0, dateFromName: !!fromName.payDate, include: false,
      error: err instanceof Error ? err.message : 'Could not read this file',
    };
  }
};

export function PayslipImportDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { savePayslip, profileId } = useFinanceData();
  const [rows, setRows] = useState<Row[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsReading(true);
    setRows([]);
    const list = Array.from(files);
    setProgress({ done: 0, total: list.length });
    const parsed: Row[] = [];
    // Sequential, not Promise.all: pdf.js spins up a worker per document and
    // twenty at once makes the tab unresponsive on the machine doing the work.
    for (const file of list) {
      parsed.push(await rowFrom(file));
      setProgress({ done: parsed.length, total: list.length });
    }
    setRows(parsed.sort((a, b) => a.slip.payDate.localeCompare(b.slip.payDate)));
    setIsReading(false);
    setProgress(null);
  };

  const chosen = rows.filter(r => r.include);
  const unreadable = rows.filter(r => r.found === 0).length;
  const mismatched = rows.filter(r => r.found > 0 && !checkPayslip(r.slip).reconciles).length;

  const handleImport = async () => {
    if (!profileId || chosen.length === 0) return;
    setIsImporting(true);
    setProgress({ done: 0, total: chosen.length });
    let done = 0;
    for (const row of chosen) {
      try {
        const uploaded = await uploadFinanceDocument(row.file, profileId);
        await savePayslip({ ...row.slip, storagePath: uploaded.path });
      } catch {
        // The figures matter more than the archive. If the upload fails the
        // row still goes in, without a file attached.
        await savePayslip(row.slip);
      }
      done += 1;
      setProgress({ done, total: chosen.length });
    }
    setIsImporting(false);
    setProgress(null);
    setRows([]);
    onOpenChange(false);
  };

  const toggle = (index: number) =>
    setRows(rs => rs.map((r, i) => (i === index ? { ...r, include: !r.include } : r)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-2xl p-6 font-mono">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-wider font-semibold text-foreground">Import payslips</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Every file is read here, in this tab. Check what it found before importing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="payslip-import-files" className="text-xs">Choose PDFs</Label>
            <Input
              id="payslip-import-files"
              type="file"
              accept="application/pdf"
              multiple
              disabled={isReading || isImporting}
              onChange={e => void handleFiles(e.target.files)}
              className="rounded-lg h-9 border-primary/20 bg-background/50 text-xs file:text-xs file:mr-2"
            />
          </div>

          {progress && (
            <p className="text-xs text-muted-foreground">
              {isImporting ? 'Importing' : 'Reading'} {progress.done} of {progress.total}…
            </p>
          )}

          {rows.length > 0 && (
            <div className="space-y-1 max-h-[45vh] overflow-y-auto pr-1">
              {rows.map((row, i) => {
                const check = checkPayslip(row.slip);
                // A file that yielded nothing is not a file that balances.
                // Zero minus zero reconciles arithmetically and means nothing,
                // and a tick against £0.00 is a pass claimed from no data.
                const readAnything = row.found > 0;
                // A scan with no text layer still deserves storing. Its
                // figures get typed in later; losing the document because a
                // parser could not read it would be the worse outcome.
                const usable = !row.error && !!row.slip.payDate;
                return (
                  <div
                    key={row.file.name}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-2',
                      usable ? 'border-border/40 bg-card/40' : 'border-destructive/30 bg-destructive/10',
                    )}
                  >
                    <Checkbox
                      checked={row.include}
                      disabled={!usable}
                      onCheckedChange={() => toggle(i)}
                      className="h-3.5 w-3.5 rounded border-primary/30 shrink-0"
                      aria-label={`Import ${row.file.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-foreground truncate">
                        {formatDate(row.slip.payDate) || 'No date found'}
                        {row.slip.employer ? ` · ${row.slip.employer}` : ''}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {row.error
                          ? row.error
                          : !readAnything
                            ? 'No text layer — archive it and type the figures in'
                            : `${row.found}/7 read${row.dateFromName ? ', date from filename' : ''}${
                                check.reconciles ? '' : ` · off by ${formatGBP(check.difference)}`}`}
                      </div>
                    </div>
                    <div className="text-xs text-foreground tabular-nums shrink-0">
                      {readAnything ? formatGBP(row.slip.net) : '—'}
                    </div>
                    {readAnything
                      ? (check.reconciles
                          ? <Check className="h-3.5 w-3.5 shrink-0 text-positive" aria-label="Reconciles" />
                          : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-chart-4" aria-label="Does not reconcile" />)
                      : <Ban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Nothing read" />}
                  </div>
                );
              })}
            </div>
          )}

          {rows.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {chosen.length} of {rows.length} selected
              {unreadable > 0 && `, ${unreadable} with no figures`}
              {mismatched > 0 && `, ${mismatched} not balancing`}
              . Unreadable files are unticked but can be imported as an archive — the
              PDF is stored and the figures typed in afterwards. A payslip already held
              for the same date is replaced, so importing twice is safe.
            </p>
          )}
        </div>

        <DialogFooter className="pt-3 gap-2 sm:gap-0">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} className="rounded-lg text-xs h-8">Cancel</Button>
          <Button
            type="button"
            disabled={chosen.length === 0 || isReading || isImporting}
            onClick={() => void handleImport()}
            className="rounded-lg bg-primary text-primary-foreground text-xs h-8 gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            {isImporting ? 'Importing…' : `Import ${chosen.length || ''}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

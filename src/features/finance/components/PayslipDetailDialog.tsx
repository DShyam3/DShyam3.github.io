/**
 * One payslip, as the payslip states it.
 *
 * The summary columns are what the app computes from; this shows the line
 * items behind them, which is the difference between "£167.93 of other
 * deductions" and "a gym membership and the arrears for it".
 *
 * Where a payslip was captured by hand there are no lines, so the columns are
 * shown instead — the same figures, less detail, rather than an empty panel.
 */

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatGBP } from '@/features/finance/utils/calculations';
import { formatDate } from '@/lib/format-date';
import { checkPayslip, groupPayslipLines, totalDeductions, type Payslip } from '@/lib/finance';
import { employerLogo } from '../employer-logo';
import { cn } from '@/lib/utils';
import { AlertTriangle, Download, Pencil } from 'lucide-react';

const Row = ({ label, value, tone }: { label: string; value: string; tone?: 'muted' | 'negative' }) => (
  <div className="flex items-baseline justify-between gap-4 py-1.5">
    <span className={cn('text-xs', tone === 'muted' ? 'text-muted-foreground' : 'text-foreground')}>{label}</span>
    <span className={cn('text-xs tabular-nums', tone === 'negative' ? 'text-destructive' : 'text-foreground')}>{value}</span>
  </div>
);

export function PayslipDetailDialog({ payslip, onOpenChange, onEdit, onOpenPdf }: {
  payslip: Payslip | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (p: Payslip) => void;
  onOpenPdf: (path: string) => void;
}) {
  if (!payslip) return null;
  const check = checkPayslip(payslip);
  const { payments, benefits, deductions } = groupPayslipLines(payslip.lines);
  const hasLines = payments.length + benefits.length + deductions.length > 0;
  const logo = employerLogo(payslip.employer);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-md p-6 font-mono">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {logo && (
              <div className="h-11 w-11 shrink-0 flex items-center justify-center rounded-lg bg-white ring-1 ring-black/10 p-1.5">
                <img src={logo} alt="" className="w-full h-full object-contain" />
              </div>
            )}
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold text-foreground">
                {payslip.employer || 'Payslip'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Paid {formatDate(payslip.payDate)}
              </DialogDescription>
            </div>
            <div className="ml-auto text-right shrink-0">
              <div className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">Take-home</div>
              <div className="text-base font-semibold text-foreground tabular-nums">{formatGBP(payslip.net)}</div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          {hasLines ? (
            <>
              {payments.length > 0 && (
                <section>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Payments</h4>
                  <div className="divide-y divide-border/30">
                    {payments.map(l => <Row key={l.label} label={l.label} value={formatGBP(l.amount)} />)}
                  </div>
                </section>
              )}

              {benefits.length > 0 && (
                <section>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Benefits and sacrifices
                  </h4>
                  {/* Named separately because they are taken from pay rather
                      than listed as deductions -- they reduce what is taxed,
                      which is why the tax on this payslip is lower than the
                      headline salary would suggest. */}
                  <div className="divide-y divide-border/30">
                    {benefits.map(l => <Row key={l.label} label={l.label} value={`−${formatGBP(l.amount)}`} tone="negative" />)}
                  </div>
                </section>
              )}

              {deductions.length > 0 && (
                <section>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Deductions</h4>
                  <div className="divide-y divide-border/30">
                    {deductions.map(l => <Row key={l.label} label={l.label} value={`−${formatGBP(l.amount)}`} tone="negative" />)}
                  </div>
                </section>
              )}
            </>
          ) : (
            <section>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Summary</h4>
              <div className="divide-y divide-border/30">
                <Row label="Gross" value={formatGBP(payslip.gross)} />
                {payslip.incomeTax !== 0 && <Row label="Income tax" value={`−${formatGBP(payslip.incomeTax)}`} tone="negative" />}
                {payslip.nationalInsurance !== 0 && <Row label="National Insurance" value={`−${formatGBP(payslip.nationalInsurance)}`} tone="negative" />}
                {payslip.pensionEmployee !== 0 && <Row label="Pension" value={`−${formatGBP(payslip.pensionEmployee)}`} tone="negative" />}
                {payslip.studentLoan !== 0 && <Row label="Student loan" value={`−${formatGBP(payslip.studentLoan)}`} tone="negative" />}
                {payslip.otherDeductions !== 0 && <Row label="Other" value={`−${formatGBP(payslip.otherDeductions)}`} tone="negative" />}
              </div>
            </section>
          )}

          <section className="rounded-lg border border-border/40 bg-card/40 px-3 py-2">
            <Row label="Gross" value={formatGBP(payslip.gross)} tone="muted" />
            <Row label="Taken off" value={`−${formatGBP(totalDeductions(payslip))}`} tone="muted" />
            <div className="border-t border-border/40 mt-1 pt-1">
              <Row label="Take-home" value={formatGBP(payslip.net)} />
            </div>
            {!check.reconciles && (
              <p className="flex items-start gap-1.5 text-xs text-destructive pt-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Gross minus what came off is {formatGBP(check.expectedNet)}, but the payslip
                states {formatGBP(check.statedNet)}.
              </p>
            )}
          </section>

          {payslip.pensionEmployer > 0 && (
            <p className="text-xs text-muted-foreground">
              Your employer also paid {formatGBP(payslip.pensionEmployer)} into your pension.
              It is not deducted from your pay, so it is not in the figures above.
            </p>
          )}
          {payslip.notes && <p className="text-xs text-muted-foreground">{payslip.notes}</p>}
        </div>

        <DialogFooter className="pt-3 gap-2 sm:gap-0">
          {payslip.storagePath && (
            <Button variant="outline" type="button" onClick={() => onOpenPdf(payslip.storagePath!)}
              className="rounded-lg text-xs h-8 gap-1.5 mr-auto">
              <Download className="h-3.5 w-3.5" /> Open PDF
            </Button>
          )}
          <Button variant="outline" type="button" onClick={() => onEdit(payslip)} className="rounded-lg text-xs h-8 gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

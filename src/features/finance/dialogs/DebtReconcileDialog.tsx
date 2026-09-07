import React, { useMemo, useState } from 'react';
import { useFinanceData } from '../FinanceDataContext';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Debt, DebtObservation } from '@/features/finance/finance-types';
import { formatGBP } from '@/features/finance/utils/calculations';
import {
  calculateDebtDrift,
  reconcileStudentLoanWithPayslips,
} from '@/lib/finance';
import { cn } from '@/lib/utils';
import { AlertCircle, Calendar, CheckCircle2, History, Scale, Trash2, TrendingDown, TrendingUp } from 'lucide-react';

interface DebtReconcileDialogProps {
  debt: Debt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DebtReconcileDialog({ debt, open, onOpenChange }: DebtReconcileDialogProps) {
  const { addDebtObservation, deleteDebtObservation, payslips } = useFinanceData();
  const { askDelete, deleteDialog } = useDeleteConfirm();

  const todayStr = new Date().toISOString().split('T')[0];

  const [observedBalance, setObservedBalance] = useState<number | ''>('');
  const [observedOn, setObservedOn] = useState<string>(todayStr);
  const [statementDate, setStatementDate] = useState<string>('');
  const [source, setSource] = useState<DebtObservation['source']>('manual');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sort observations latest-first
  const observations = useMemo(() => {
    if (!debt?.observations) return [];
    return [...debt.observations].sort((a, b) =>
      (b.statementDate || b.observedOn).localeCompare(a.statementDate || a.observedOn)
    );
  }, [debt?.observations]);

  // The latest anchor to measure drift against
  const previousAnchor = observations[0] ?? null;

  // Calculate live drift preview as user types observedBalance
  const driftResult = useMemo(() => {
    if (!debt || observedBalance === '') return null;

    const anchorBal = previousAnchor ? previousAnchor.balance : debt.originalAmount;
    const anchorDt = previousAnchor ? (previousAnchor.statementDate || previousAnchor.observedOn) : (debt.startDate || todayStr);
    const targetDt = statementDate || observedOn || todayStr;

    return calculateDebtDrift({
      anchorBalance: anchorBal,
      anchorDate: anchorDt,
      targetBalance: Number(observedBalance),
      targetDate: targetDt,
      monthlyPayment: debt.minPayment,
      interestRate: debt.interestRate,
      ratePeriods: debt.ratePeriods,
    });
  }, [debt, observedBalance, previousAnchor, statementDate, observedOn, todayStr]);

  // For Student Loans: preview payslip reconciliation if statementDate is given
  const studentLoanReconcile = useMemo(() => {
    if (!debt || debt.repaymentType !== 'income_contingent' || observedBalance === '') return null;
    const mockObs: DebtObservation = {
      id: 'preview',
      debtId: debt.id,
      observedOn,
      statementDate: statementDate || observedOn,
      balance: Number(observedBalance),
      source,
    };
    return reconcileStudentLoanWithPayslips(mockObs, payslips, todayStr);
  }, [debt, observedBalance, observedOn, statementDate, source, payslips, todayStr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debt || observedBalance === '') return;
    setIsSubmitting(true);
    try {
      await addDebtObservation({
        debtId: debt.id,
        balance: Math.abs(Number(observedBalance)),
        observedOn,
        statementDate: statementDate || undefined,
        source,
        note: note || undefined,
      });
      // Reset form
      setObservedBalance('');
      setNote('');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteObs = (id: string) => {
    if (!debt) return;
    askDelete({
      title: 'Delete Observation',
      description: 'Remove this recorded balance? Future balance projections will anchor to the next latest observation.',
      confirmLabel: 'Delete',
      onConfirm: () => deleteDebtObservation(id, debt.id),
    });
  };

  if (!debt) return null;

  const isStudentLoan = debt.repaymentType === 'income_contingent';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-md max-h-[90vh] overflow-y-auto font-mono shadow-none">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary shrink-0" />
              Reconcile & Record Balance
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">
              Anchor {debt.name} to a verified balance and measure model drift.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="rounded-lg border border-border/30 bg-muted/20 p-3 space-y-1">
              <span className="text-xs font-semibold text-foreground block">
                Current Anchor: {previousAnchor ? formatGBP(previousAnchor.balance) : formatGBP(debt.balance)}
              </span>
              <p className="text-xs text-muted-foreground">
                {previousAnchor
                  ? `As of ${previousAnchor.statementDate || previousAnchor.observedOn} (${previousAnchor.source})`
                  : `Starting from loan original amount of ${formatGBP(debt.originalAmount)}`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="obs-balance" className="text-xs font-mono text-muted-foreground">
                  Observed Balance (£)
                </Label>
                <Input
                  id="obs-balance"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 18500"
                  value={observedBalance}
                  onChange={(e) => setObservedBalance(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono tabular-nums"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="obs-source" className="text-xs font-mono text-muted-foreground">
                  Source
                </Label>
                <Select value={source} onValueChange={(val) => setSource(val as DebtObservation['source'])}>
                  <SelectTrigger id="obs-source" className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border border-border/40 bg-popover text-xs font-mono">
                    <SelectItem value="statement">Official Statement</SelectItem>
                    <SelectItem value="manual">Online Portal (Gov.uk / Bank)</SelectItem>
                    <SelectItem value="provider">Open Banking API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="obs-date" className="text-xs font-mono text-muted-foreground">
                  Checked Date
                </Label>
                <Input
                  id="obs-date"
                  type="date"
                  value={observedOn}
                  onChange={(e) => setObservedOn(e.target.value)}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="statement-date" className="text-xs font-mono text-muted-foreground">
                  Statement Date {isStudentLoan ? '(SLC Date)' : '(Optional)'}
                </Label>
                <Input
                  id="statement-date"
                  type="date"
                  value={statementDate}
                  onChange={(e) => setStatementDate(e.target.value)}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                />
              </div>
            </div>

            {isStudentLoan && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs font-mono text-muted-foreground flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p>
                  <strong>Student Loan Lag:</strong> SLC only updates balances annually after tax-year close. If checking gov.uk, set the statement date to the date SLC last updated it. The app will bridge the gap with captured payslips!
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="obs-note" className="text-xs font-mono text-muted-foreground">
                Notes
              </Label>
              <Input
                id="obs-note"
                placeholder="e.g. Checked after annual P60 / tax year close"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
              />
            </div>

            {/* Live Drift Analysis Preview */}
            {driftResult && (
              <div className="rounded-lg border border-border/40 bg-card/60 p-3 space-y-2">
                <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5 text-primary" /> Model Reconciliation Analysis
                </span>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Predicted Balance</span>
                    <span className="font-bold text-foreground font-mono">{formatGBP(driftResult.predictedBalance)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Observed Balance</span>
                    <span className="font-bold text-foreground font-mono">{formatGBP(driftResult.observedBalance)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Model Drift</span>
                    <span className={cn(
                      "font-bold font-mono flex items-center gap-1",
                      driftResult.drift > 0 ? "text-destructive" : driftResult.drift < 0 ? "text-positive" : "text-foreground"
                    )}>
                      {driftResult.drift > 0 ? <TrendingUp className="h-3 w-3" /> : driftResult.drift < 0 ? <TrendingDown className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                      {driftResult.drift > 0 ? `+${formatGBP(driftResult.drift)}` : formatGBP(driftResult.drift)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Implied Interest Rate</span>
                    <span className="font-bold font-mono text-foreground">
                      {driftResult.impliedAnnualRate !== null ? `${driftResult.impliedAnnualRate.toFixed(2)}%` : '—'}
                      <span className="text-muted-foreground font-normal text-xs ml-1">(rec: {debt.interestRate.toFixed(2)}%)</span>
                    </span>
                  </div>
                </div>

                {studentLoanReconcile && studentLoanReconcile.payslipsCount > 0 && (
                  <div className="border-t border-border/20 pt-2 text-xs font-mono text-muted-foreground space-y-1">
                    <p className="text-positive font-semibold">
                      ✓ Applied {studentLoanReconcile.payslipsCount} captured payslip deductions (-{formatGBP(studentLoanReconcile.payslipDeductionsTotal)})
                    </p>
                    <p>
                      Estimated Live Balance: <strong>{formatGBP(studentLoanReconcile.adjustedBalance)}</strong>
                    </p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)} className="rounded-lg h-9 px-4 text-xs font-mono border-border/40">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || observedBalance === ''} className="rounded-lg h-9 px-4 text-xs font-mono bg-primary text-primary-foreground">
                {isSubmitting ? 'Saving...' : 'Record Observation'}
              </Button>
            </DialogFooter>
          </form>

          {/* Observation History */}
          {observations.length > 0 && (
            <div className="border-t border-border/30 pt-4 space-y-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" /> Past Observations ({observations.length})
              </span>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                {observations.map((obs) => (
                  <div
                    key={obs.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-muted/20 px-3 py-2 text-xs font-mono"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{formatGBP(obs.balance)}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground capitalize">
                          {obs.source}
                        </span>
                      </div>
                      <span className="block text-xs text-muted-foreground truncate">
                        <Calendar className="h-2.5 w-2.5 inline mr-1" />
                        {obs.observedOn}
                        {obs.statementDate && obs.statementDate !== obs.observedOn && ` (Statement: ${obs.statementDate})`}
                        {obs.note && ` · ${obs.note}`}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      onClick={() => handleDeleteObs(obs.id)}
                      className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {deleteDialog}
    </>
  );
}

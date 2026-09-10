/**
 * Review-and-import UI for bank statement CSV/OFX files.
 *
 * The statement never leaves this browser as a file. `parseStatement` turns
 * it into rows here; only the rows the person selects travel through the
 * normal, authenticated finance save path.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, FileUp, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/format-date';
import {
  parseStatement,
  statementTransactionId,
  statementTransactionKey,
  type AmountConvention,
  type NumericDateOrder,
  type ParsedStatementTransaction,
  type StatementParseResult,
} from '@/lib/finance';
import type { BankAccount, MockTransaction } from '@/features/finance/finance-types';
import { cn } from '@/lib/utils';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface PreviewRow {
  transaction: ParsedStatementTransaction;
  id: string;
  key: string;
  duplicate: 'existing' | 'file' | undefined;
}

interface StatementImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: MockTransaction[];
  bankAccounts: BankAccount[];
  formatGBP: (value: number) => string;
  onImport: (transactions: MockTransaction[], imported: number) => void;
}

export function StatementImportDialog({
  open,
  onOpenChange,
  transactions,
  bankAccounts,
  formatGBP,
  onImport,
}: StatementImportDialogProps) {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [numericDateOrder, setNumericDateOrder] = useState<NumericDateOrder>('day-first');
  const [amountConvention, setAmountConvention] = useState<AmountConvention>('bank-signed');
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [sourceText, setSourceText] = useState('');
  const [parsed, setParsed] = useState<StatementParseResult | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [isReading, setIsReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  const reset = () => {
    setSelectedAccountId('');
    setNumericDateOrder('day-first');
    setAmountConvention('bank-signed');
    setActiveFile(null);
    setSourceText('');
    setParsed(null);
    setOverrides({});
    setReadError(null);
  };

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const parseActiveFile = (
    nextDateOrder = numericDateOrder,
    nextAmountConvention = amountConvention,
  ) => {
    if (!activeFile) return;
    setParsed(parseStatement(activeFile.name, sourceText, {
      numericDateOrder: nextDateOrder,
      amountConvention: nextAmountConvention,
    }));
    setOverrides({});
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setReadError(null);
    setParsed(null);
    setOverrides({});
    if (file.size > MAX_FILE_BYTES) {
      setActiveFile(null);
      setSourceText('');
      setReadError('Choose a statement smaller than 10 MB.');
      return;
    }
    setIsReading(true);
    try {
      const text = await file.text();
      setActiveFile(file);
      setSourceText(text);
      setParsed(parseStatement(file.name, text, { numericDateOrder, amountConvention }));
    } catch {
      setActiveFile(null);
      setSourceText('');
      setReadError('This statement could not be read in the browser.');
    } finally {
      setIsReading(false);
    }
  };

  const previewRows = useMemo<PreviewRow[]>(() => {
    if (!parsed || !selectedAccountId) return [];
    const existingIds = new Set(transactions.map(transaction => transaction.id));
    const existingFallbackKeys = new Set(transactions
      .filter(transaction => (transaction.accountId || transaction.bankAccountId) === selectedAccountId)
      .map(transaction => statementTransactionKey(selectedAccountId, {
        date: transaction.date,
        description: transaction.name,
        amount: transaction.amount,
        sourceRow: 0,
      })));
    const seen = new Set<string>();

    return parsed.transactions.map(transaction => {
      const id = statementTransactionId(selectedAccountId, transaction);
      const key = `${id}:${transaction.sourceRow}`;
      const fallbackKey = statementTransactionKey(selectedAccountId, { ...transaction, sourceId: undefined });
      const duplicate = existingIds.has(id) || existingFallbackKeys.has(fallbackKey)
        ? 'existing'
        : seen.has(id) ? 'file' : undefined;
      seen.add(id);
      return { transaction, id, key, duplicate };
    });
  }, [parsed, selectedAccountId, transactions]);

  const selectedRows = previewRows.filter(row => overrides[row.key] ?? !row.duplicate);
  const skippedDuplicates = previewRows.filter(row => row.duplicate && !(overrides[row.key] ?? !row.duplicate)).length;

  const toggleRow = (row: PreviewRow) => {
    const currentlyIncluded = overrides[row.key] ?? !row.duplicate;
    setOverrides(current => ({ ...current, [row.key]: !currentlyIncluded }));
  };

  const choose = (include: boolean) => {
    setOverrides(Object.fromEntries(previewRows.map(row => [row.key, include])));
  };

  const handleImport = () => {
    if (!selectedAccountId || selectedRows.length === 0) return;
    const existingIds = new Set(transactions.map(transaction => transaction.id));
    const added: MockTransaction[] = [];
    for (const row of selectedRows) {
      // A stable ID makes a literal re-import a no-op. More importantly, do
      // not overwrite the category, note, or reviewed decision already made
      // for that row — import is acquisition, not a destructive refresh.
      if (existingIds.has(row.id)) continue;
      existingIds.add(row.id);
      added.push({
        id: row.id,
        name: row.transaction.description,
        merchant: row.transaction.description,
        category: 'Uncategorised',
        amount: row.transaction.amount,
        date: row.transaction.date,
        isReviewed: false,
        accountId: selectedAccountId,
        bankAccountId: selectedAccountId,
        tags: ['statement-import'],
        isRecurring: false,
      });
    }
    onImport([...added, ...transactions], added.length);
    changeOpen(false);
  };

  const parsedRows = parsed?.transactions.length ?? 0;
  const issuePreview = parsed?.issues.slice(0, 3) ?? [];

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-3xl p-6 font-mono">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-wider font-semibold text-foreground flex items-center gap-2">
            <FileUp className="h-4 w-4 text-primary" /> Import bank statement
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            CSV, OFX, and QFX files are parsed in this browser. Only the checked ledger rows are saved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr]">
            <div className="space-y-1">
              <Label htmlFor="statement-import-file" className="text-xs">Statement file</Label>
              <Input
                id="statement-import-file"
                type="file"
                accept=".csv,text/csv,.ofx,.qfx,application/x-ofx,text/plain"
                disabled={isReading}
                onChange={event => void handleFile(event.target.files?.[0])}
                className="rounded-lg h-9 border-primary/20 bg-background/50 text-xs file:text-xs file:mr-2"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Import into</Label>
              <Select value={selectedAccountId || '__choose_account'} onValueChange={value => {
                setSelectedAccountId(value === '__choose_account' ? '' : value);
                setOverrides({});
              }}>
                <SelectTrigger className="h-9 rounded-lg bg-background/50 border-primary/20 text-xs">
                  <SelectValue placeholder="Choose an account" />
                </SelectTrigger>
                <SelectContent className="font-mono">
                  <SelectItem value="__choose_account" className="text-xs">Choose an account</SelectItem>
                  {bankAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id} className="text-xs">
                      {account.name} · {account.issuer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {parsed?.format === 'csv' && (
            <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-border/30 bg-muted/10 p-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Numeric dates</Label>
                <Select value={numericDateOrder} onValueChange={(value: NumericDateOrder) => {
                  setNumericDateOrder(value);
                  parseActiveFile(value, amountConvention);
                }}>
                  <SelectTrigger className="h-8 rounded-lg bg-background/50 border-border/40 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="font-mono">
                    <SelectItem value="day-first" className="text-xs">Day first · 31/12/2026</SelectItem>
                    <SelectItem value="month-first" className="text-xs">Month first · 12/31/2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Signed Amount / Value column</Label>
                <Select value={amountConvention} onValueChange={(value: AmountConvention) => {
                  setAmountConvention(value);
                  parseActiveFile(numericDateOrder, value);
                }}>
                  <SelectTrigger className="h-8 rounded-lg bg-background/50 border-border/40 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="font-mono">
                    <SelectItem value="bank-signed" className="text-xs">Positive = money in</SelectItem>
                    <SelectItem value="outflow-positive" className="text-xs">Positive = money out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Debit/Credit columns override this choice. Positive ledger rows are spending; negative rows are money in.
              </p>
            </div>
          )}

          {isReading && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading statement…</p>
          )}
          {readError && <p className="text-xs text-destructive">{readError}</p>}

          {parsed && (
            <div className="space-y-3">
              {parsed.ambiguousDateCount > 0 && (
                <div className="flex gap-2 rounded-lg border border-chart-4/30 bg-chart-4/10 px-3 py-2 text-xs text-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-chart-4 mt-0.5" />
                  <span>{parsed.ambiguousDateCount} numeric date{parsed.ambiguousDateCount === 1 ? '' : 's'} can mean two days. Confirm the date order above before importing.</span>
                </div>
              )}

              {issuePreview.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-foreground space-y-1">
                  {issuePreview.map((issue, index) => <p key={`${issue.sourceRow ?? 'file'}-${index}`}>{issue.sourceRow ? `Row ${issue.sourceRow}: ` : ''}{issue.message}</p>)}
                  {(parsed.issues.length > issuePreview.length) && <p>…and {parsed.issues.length - issuePreview.length} more skipped row{parsed.issues.length - issuePreview.length === 1 ? '' : 's'}.</p>}
                </div>
              )}

              {parsedRows > 0 && !selectedAccountId && (
                <p className="text-xs text-muted-foreground">Choose the account this statement belongs to to review duplicates and enable import.</p>
              )}

              {previewRows.length > 0 && (
                <>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Select</span>
                    <button type="button" onClick={() => choose(true)} className="rounded-md border border-border/40 px-2 py-0.5 text-muted-foreground hover:text-foreground hover:border-border/80">All</button>
                    <button type="button" onClick={() => choose(false)} className="rounded-md border border-border/40 px-2 py-0.5 text-muted-foreground hover:text-foreground hover:border-border/80">None</button>
                    {skippedDuplicates > 0 && <span className="ml-auto text-muted-foreground">{skippedDuplicates} duplicate{skippedDuplicates === 1 ? '' : 's'} unticked</span>}
                  </div>
                  <div className="max-h-[36vh] overflow-y-auto space-y-1 pr-1">
                    {previewRows.map(row => {
                      const included = overrides[row.key] ?? !row.duplicate;
                      const isIncome = row.transaction.amount < 0;
                      return (
                        <div key={row.key} className={cn(
                          'flex items-center gap-3 rounded-lg border px-3 py-2',
                          row.duplicate ? 'border-chart-4/30 bg-chart-4/5' : 'border-border/30 bg-background/30',
                        )}>
                          <Checkbox checked={included} onCheckedChange={() => toggleRow(row)} className="h-3.5 w-3.5 rounded border-primary/30 shrink-0" aria-label={`Import ${row.transaction.description}`} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-foreground">{row.transaction.description}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(row.transaction.date)}{row.duplicate ? ` · ${row.duplicate === 'existing' ? 'already in ledger' : 'repeated in this file'}` : ''}</p>
                          </div>
                          <span className={cn('text-xs font-semibold tabular-nums shrink-0', isIncome ? 'text-positive' : 'text-destructive')}>
                            {isIncome ? '+' : '-'}{formatGBP(Math.abs(row.transaction.amount))}
                          </span>
                          {!row.duplicate && <Check className="h-3.5 w-3.5 shrink-0 text-positive" aria-label="Ready to import" />}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <p className="text-xs text-muted-foreground">
                {parsedRows} row{parsedRows === 1 ? '' : 's'} parsed{selectedAccountId ? ` · ${selectedRows.length} selected` : ''}. Re-importing the same statement keeps the existing rows and any review or category decisions you made.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 gap-2 sm:gap-0">
          <Button variant="outline" type="button" onClick={() => changeOpen(false)} className="rounded-lg text-xs h-8">Cancel</Button>
          <Button type="button" disabled={!selectedAccountId || selectedRows.length === 0 || isReading} onClick={handleImport} className="rounded-lg text-xs h-8 gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Import {selectedRows.length || ''} row{selectedRows.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

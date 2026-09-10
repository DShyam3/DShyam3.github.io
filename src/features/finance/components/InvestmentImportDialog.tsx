/**
 * Review-only import for broker/exchange CSV exports.
 *
 * The selected file is read with File.text() and is discarded on close. It is
 * never uploaded; only the user-confirmed current holdings use the normal
 * authenticated save path.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, FileUp, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BankAccount } from '@/features/finance/finance-types';
import {
  parseInvestmentCsv,
  type ImportedInvestmentActivity,
  type ImportedInvestmentHolding,
  type InvestmentImportProvider,
  type InvestmentImportResult,
} from '@/lib/finance';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const CHOOSE_ACCOUNT = '__choose_investment_account__';

interface InvestmentImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankAccounts: BankAccount[];
  formatGBP: (value: number) => string;
  onImport: (
    holdings: ImportedInvestmentHolding[],
    activities: ImportedInvestmentActivity[],
    accountId: string,
    provider: InvestmentImportProvider,
  ) => Promise<boolean> | boolean;
}

export function InvestmentImportDialog({
  open,
  onOpenChange,
  bankAccounts,
  formatGBP,
  onImport,
}: InvestmentImportDialogProps) {
  const [provider, setProvider] = useState<InvestmentImportProvider>('trading212');
  const [accountId, setAccountId] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [parsed, setParsed] = useState<InvestmentImportResult | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  const investmentAccounts = useMemo(
    () => bankAccounts.filter(account => account.type === 'investment'),
    [bankAccounts],
  );

  const reset = () => {
    setProvider('trading212');
    setAccountId('');
    setSourceText('');
    setParsed(null);
    setSelected({});
    setIsReading(false);
    setIsImporting(false);
    setReadError(null);
  };

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen && !isImporting) reset();
    onOpenChange(nextOpen);
  };

  const keyFor = (holding: ImportedInvestmentHolding, index: number) =>
    `${holding.ticker ?? holding.name}:${holding.category}:${index}`;

  const selectAll = (result: InvestmentImportResult) => {
    setSelected(Object.fromEntries(result.holdings.map((holding, index) => [keyFor(holding, index), true])));
  };

  const parseCurrentFile = (nextProvider: InvestmentImportProvider, text: string) => {
    const result = parseInvestmentCsv(nextProvider, text);
    setParsed(result);
    selectAll(result);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setReadError(null);
    setParsed(null);
    setSelected({});
    if (file.size > MAX_FILE_BYTES) {
      setSourceText('');
      setReadError('Choose a CSV smaller than 5 MB.');
      return;
    }
    setIsReading(true);
    try {
      const text = await file.text();
      // This import accepts text CSV only. A binary spreadsheet is not parsed
      // as text and can never be mistaken for a position ledger.
      if (text.includes('\u0000')) throw new Error('not text');
      setSourceText(text);
      parseCurrentFile(provider, text);
    } catch {
      setSourceText('');
      setReadError('This CSV could not be read safely in the browser.');
    } finally {
      setIsReading(false);
    }
  };

  const selectedHoldings = parsed?.holdings.filter((holding, index) => selected[keyFor(holding, index)]) ?? [];
  // History is a separate, additive ledger. Keep completed positions too: a
  // closed asset has no current holding row to select, but its buys and sells
  // are still useful history and must not disappear from a full export.
  const selectedActivities = parsed?.activities ?? [];
  const unresolvedPriceCount = selectedHoldings.filter(holding => !holding.currentPriceKnown || !holding.costBasisKnown).length;
  const issuePreview = parsed?.issues.slice(0, 4) ?? [];
  const canImport = Boolean(accountId && (selectedHoldings.length > 0 || selectedActivities.length > 0) && !isImporting);

  const handleImport = async () => {
    if (!canImport) return;
    setIsImporting(true);
    try {
      const saved = await onImport(selectedHoldings, selectedActivities, accountId, provider);
      if (saved) changeOpen(false);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border border-border/40 bg-card p-6 font-mono sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground">
            <FileUp className="h-4 w-4 text-primary" /> Import investment CSV
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Parsed locally in this browser. No broker credentials or CSV file are uploaded; confirmed positions and buy/sell activity are saved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="investment-import-provider" className="text-xs">CSV provider</Label>
              <Select value={provider} onValueChange={(value: InvestmentImportProvider) => {
                setProvider(value);
                if (sourceText) parseCurrentFile(value, sourceText);
              }}>
                <SelectTrigger id="investment-import-provider" className="h-9 rounded-lg border-primary/20 bg-background/50 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="font-mono">
                  <SelectItem value="trading212" className="text-xs">Trading 212 · activity or holdings</SelectItem>
                  <SelectItem value="kraken" className="text-xs">Kraken · Trades or Balances</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="investment-import-account" className="text-xs">Import into</Label>
              <Select value={accountId || CHOOSE_ACCOUNT} onValueChange={value => setAccountId(value === CHOOSE_ACCOUNT ? '' : value)}>
                <SelectTrigger id="investment-import-account" className="h-9 rounded-lg border-primary/20 bg-background/50 text-xs"><SelectValue placeholder="Choose broker or exchange" /></SelectTrigger>
                <SelectContent className="font-mono">
                  <SelectItem value={CHOOSE_ACCOUNT} className="text-xs">Choose an investment account</SelectItem>
                  {investmentAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id} className="text-xs">
                      {account.name}{account.issuer ? ` · ${account.issuer}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {investmentAccounts.length === 0 && (
            <div className="flex gap-2 rounded-lg border border-chart-4/30 bg-chart-4/10 px-3 py-2 text-xs text-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-chart-4" />
              <span>Add Trading 212 or Kraken as an <strong>Investment</strong> account in Accounts first, then import its positions here.</span>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="investment-import-file" className="text-xs">Export file</Label>
            <Input
              id="investment-import-file"
              type="file"
              accept=".csv,text/csv,text/plain"
              disabled={isReading || isImporting}
              onChange={event => void handleFile(event.target.files?.[0])}
              className="h-9 rounded-lg border-primary/20 bg-background/50 text-xs file:mr-2 file:text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Use a full Trading 212 buy/sell export or a Kraken Trades/Balances CSV. Activity rebuilds quantities from the file; it is not a live-price feed.
            </p>
          </div>

          {isReading && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading CSV locally…</p>}
          {readError && <p className="text-xs text-destructive">{readError}</p>}

          {parsed && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {parsed.mode === 'activity' ? 'Activity export' : parsed.mode === 'snapshot' ? 'Holdings snapshot' : 'Unrecognised file'} · {parsed.holdings.length} recognised position{parsed.holdings.length === 1 ? '' : 's'}
                </span>
                {parsed.holdings.length > 0 && (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => selectAll(parsed)} className="h-7 px-2 text-xs">Select all</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setSelected({})} className="h-7 px-2 text-xs">Clear</Button>
                  </div>
                )}
              </div>

              {parsed.mode === 'activity' && (
                <div className="flex gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>Use the account’s full history for a meaningful cost basis. The CSV has no live market quotes, so current prices remain unknown until you review them.</span>
                </div>
              )}

              {issuePreview.length > 0 && (
                <div className="rounded-lg border border-chart-4/30 bg-chart-4/10 px-3 py-2 text-xs text-foreground">
                  <p className="mb-1 flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5 text-chart-4" /> Import notes</p>
                  <ul className="space-y-1 text-muted-foreground">
                    {issuePreview.map((issue, index) => <li key={`${issue.sourceRow ?? 'summary'}-${index}`}>{issue.sourceRow ? `Row ${issue.sourceRow}: ` : ''}{issue.message}</li>)}
                    {parsed.issues.length > issuePreview.length && <li>…and {parsed.issues.length - issuePreview.length} more note{parsed.issues.length - issuePreview.length === 1 ? '' : 's'}.</li>}
                  </ul>
                </div>
              )}

              {parsed.holdings.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border/35">
                  <table className="w-full min-w-[650px] text-left text-xs">
                    <thead className="border-b border-border/35 bg-muted/15 uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="w-10 px-3 py-2" aria-label="Include position" />
                        <th className="px-3 py-2 font-semibold">Position</th>
                        <th className="px-3 py-2 text-right font-semibold">Quantity</th>
                        <th className="px-3 py-2 text-right font-semibold">Cost / unit</th>
                        <th className="px-3 py-2 text-right font-semibold">Current / unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {parsed.holdings.slice(0, 30).map((holding, index) => {
                        const key = keyFor(holding, index);
                        return (
                          <tr key={key} className="hover:bg-muted/10">
                            <td className="px-3 py-2"><Checkbox aria-label={`Import ${holding.name}`} checked={selected[key] ?? false} onCheckedChange={checked => setSelected(current => ({ ...current, [key]: checked === true }))} /></td>
                            <td className="px-3 py-2 text-foreground"><span className="font-semibold">{holding.name}</span>{holding.ticker && <span className="ml-2 text-muted-foreground">{holding.ticker}</span>}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-foreground">{holding.shares}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{holding.costBasisKnown ? formatGBP(holding.avgPrice) : <span className="text-chart-4">Review</span>}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{holding.currentPriceKnown ? formatGBP(holding.currentPrice) : <span className="text-chart-4">No quote</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {parsed.holdings.length > 30 && <p className="border-t border-border/20 px-3 py-2 text-xs text-muted-foreground">Showing the first 30 positions; all {parsed.holdings.length} selected positions will be imported.</p>}
                </div>
              )}

              {unresolvedPriceCount > 0 && (
                <p className="text-xs text-muted-foreground">{unresolvedPriceCount} selected position{unresolvedPriceCount === 1 ? '' : 's'} has an unknown price fact. It will display as “needs review”, not as £0.00.</p>
              )}
              {selectedActivities.length > 0 && <p className="text-xs text-muted-foreground">All {selectedActivities.length} valid buy/sell row{selectedActivities.length === 1 ? '' : 's'} in this file will be retained in activity history, including closed positions. Re-importing an overlapping period is safe.</p>}
              {selectedHoldings.length > 0 && <p className="text-xs text-muted-foreground">Matching name/ticker positions in this broker account are updated; positions not represented in this import stay untouched.</p>}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => changeOpen(false)} disabled={isImporting} className="text-xs">Cancel</Button>
          <Button type="button" onClick={() => void handleImport()} disabled={!canImport} className="gap-1.5 text-xs">
            {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {isImporting ? 'Saving…' : `Import ${selectedHoldings.length ? `${selectedHoldings.length} position${selectedHoldings.length === 1 ? '' : 's'}` : ''}${selectedHoldings.length && selectedActivities.length ? ' + ' : ''}${selectedActivities.length ? `${selectedActivities.length} activity row${selectedActivities.length === 1 ? '' : 's'}` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

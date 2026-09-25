import { AccountInspector } from './AccountInspector';
import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useFinanceData } from '../FinanceDataContext';
import { useTrueLayer } from '../useTrueLayer';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BankAccount } from '@/features/finance/finance-types';
import { formatGBP, getAccountDefaultColor, getAccountDefaultEmoji } from '@/features/finance/utils/calculations';
import { cn } from '@/lib/utils';
import { formatCooldownEnd } from '@/hooks/useCooldown';
import { BankSyncStatus } from './BankSyncStatus';
import { Activity, ArrowUpRight, Clock, CreditCard, Edit2, Landmark, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';

type ProviderLogoSize = 'account' | 'connection';

function providerKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * TrueLayer's `provider_name` is either already a display name (has a space
 * or an uppercase letter) or a bare provider id like `uk-ob-barclays`, which
 * shows up until the next sync fills in the real display name.
 */
function providerDisplayName(name: string) {
  if (/[A-Z ]/.test(name)) return name;
  const stripped = name.replace(/^(uk-ob-|uk-oauth-|ob-|oauth-)/, '');
  return stripped
    .split(/[-_]/)
    .filter(Boolean)
    .map(word => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function ProviderFallback({ name, size }: { name: string; size: ProviderLogoSize }) {
  const shell = size === 'connection' ? 'h-10 w-10' : 'h-7 w-7';
  return (
    <div className={`${shell} rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0`} aria-label={`${name} bank`}>
      <Landmark className={size === 'connection' ? 'w-5 h-5 text-primary' : 'w-3.5 h-3.5 text-primary'} aria-hidden="true" />
    </div>
  );
}

function ProviderLogo({ name, uri, size = 'connection' }: { name: string; uri: string | null; size?: ProviderLogoSize }) {
  const [failed, setFailed] = useState(false);
  const displayName = providerDisplayName(name);
  const shell = size === 'connection' ? 'h-10 w-10' : 'h-7 w-7';

  if (uri && !failed) {
    return (
      <img
        src={uri}
        alt={`${displayName} logo`}
        className={`${shell} rounded-lg object-contain bg-card border border-border/40 p-1 shrink-0`}
        onError={() => setFailed(true)}
      />
    );
  }

  return <ProviderFallback name={displayName} size={size} />;
}

function isTrueLayerAccount(account: BankAccount) {
  return account.id.startsWith('tl_acc_') || account.id.startsWith('tl_card_');
}

export default function BankAccountsSection() {
  const { toast } = useToast();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const {
    bankAccounts,
    mockTransactions,
    recurrings,
    creditScores,
    memberships,
    saveDataToSupabase,
    setBankAccounts,
    fetchSupabaseData,
  } = useFinanceData();

  const {
    trueLayerStatus,
    isSyncingTrueLayer,
    syncAvailableAt,
    isConnectingTrueLayer,
    connectTrueLayer,
    disconnectTrueLayer,
    syncTrueLayer,
  } = useTrueLayer(fetchSupabaseData);

  const providerLogoUris = new Map(
    (trueLayerStatus?.connections ?? [])
      .filter(connection => Boolean(connection.provider_logo_uri))
      .map(connection => [providerKey(connection.provider_name), connection.provider_logo_uri]),
  );

  /* Blank means the limit is unknown, which is not the same as £0: an unknown
     limit leaves the card out of utilisation instead of counting it as maxed. */
  const parseCreditLimit = (value: string): number | null => {
    if (value.trim() === '') return null;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
  };

  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [activeAccount, setActiveAccount] = useState<BankAccount | null>(null);
  const [newAccount, setNewAccount] = useState<Omit<BankAccount, 'id' | 'balance' | 'annualFee'> & { balance: number | ''; annualFee: number | ''; }>({
    name: '',
    type: 'checking',
    issuer: '',
    balance: '',
    annualFee: '',
    useCase: '',
    emoji: '',
    color: 'hsl(var(--muted-foreground))'
  });

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.name || !newAccount.issuer) {
      toast({ title: 'Error', description: 'Please fill in name and issuer.', variant: 'destructive' });
      return;
    }
    const created: BankAccount = {
      ...newAccount,
      balance: newAccount.balance === '' ? 0 : newAccount.balance,
      annualFee: newAccount.annualFee === '' ? 0 : newAccount.annualFee,
      emoji: newAccount.emoji || getAccountDefaultEmoji(newAccount.type, newAccount.name),
      color: newAccount.color || getAccountDefaultColor(newAccount.name),
      id: 'a_' + Date.now()
    };
    const updated = [...bankAccounts, created];
    setBankAccounts(updated);
    saveDataToSupabase('accounts', { bankAccounts: updated, memberships, creditScores });
    setIsAddAccountOpen(false);
    setNewAccount({ name: '', type: 'checking', issuer: '', balance: '', annualFee: '', useCase: '', emoji: '', color: 'hsl(var(--muted-foreground))' });
    toast({ title: 'Account Added', description: `Added ${created.name}.` });
  };

  const handleEditAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) return;
    const updated = bankAccounts.map(a => a.id === activeAccount.id ? activeAccount : a);
    setBankAccounts(updated);
    saveDataToSupabase('accounts', { bankAccounts: updated, memberships, creditScores });
    setIsEditAccountOpen(false);
    setActiveAccount(null);
    toast({ title: 'Account Updated', description: 'Successfully saved changes.' });
  };

  const performDeleteAccount = (id: string) => {
    const updated = bankAccounts.filter(a => a.id !== id);
    setBankAccounts(updated);
    saveDataToSupabase('accounts', { bankAccounts: updated, memberships, creditScores });
    toast({ title: 'Account Deleted', description: 'Bank account removed.' });
  };

  const handleDeleteAccount = (id: string) =>
    askDelete({
      name: bankAccounts.find(a => a.id === id)?.name,
      onConfirm: () => performDeleteAccount(id),
    });

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
          <div className="min-w-0">
            <h3 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary shrink-0" /> Bank Accounts & Credit Cards
            </h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">Monitor current balances, card products, and credit accounts</p>
          </div>
          <Button onClick={() => setIsAddAccountOpen(true)} className="rounded-lg gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8 px-3 shrink-0 self-start sm:self-auto font-mono">
            <Plus className="h-3.5 w-3.5" /> Add Account
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {bankAccounts.map(account => <AccountInspector key={account.id} account={account} transactions={mockTransactions} bills={recurrings}
            onEdit={() => { setActiveAccount(account); setIsEditAccountOpen(true); }}
            onDelete={() => handleDeleteAccount(account.id)} />)}
          {bankAccounts.length === 0 && <p className="surface-card rounded-3xl border p-6 text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">No accounts yet. Add an account to track balances and linked activity.</p>}
        </div>
      </div>

      {/* TrueLayer Integration Card */}
      {(() => {
        const connections = trueLayerStatus?.connections ?? [];
        const hasConnections = trueLayerStatus?.connected && connections.length > 0;

        return (
          <div className="surface-card rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-0.5">
                <h4 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary shrink-0" /> TrueLayer Open Banking
                </h4>
                <p className="text-xs text-muted-foreground font-mono">
                  Link multiple UK bank accounts &amp; credit cards to automatically sync balances and transactions.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                {hasConnections ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-positive/10 text-positive border border-positive/20 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
                    {connections.length} {connections.length === 1 ? 'Bank' : 'Banks'} Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border/40 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                    Not Connected
                  </span>
                )}
              </div>
            </div>

            {hasConnections ? (
              <div className="space-y-3 pt-1">
                <div className="divide-y divide-border/20 rounded-lg border border-border/40 bg-background/50 overflow-hidden">
                  {connections.map(conn => {
                    const providerName = providerDisplayName(conn.provider_name);
                    const expiry = conn.consent_expires_at || (conn.created_at ? new Date(new Date(conn.created_at).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString() : null);
                    const daysLeft = expiry
                      ? Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
                      : null;
                    const isExpiringSoon = daysLeft !== null && daysLeft <= 14 && daysLeft > 0;

                    return (
                      <div key={conn.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-3 hover:bg-muted/10 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <ProviderLogo name={providerName} uri={conn.provider_logo_uri} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-xs text-foreground truncate">{providerName}</span>
                              {conn.backfill_complete && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-positive/10 text-positive border border-positive/20 font-mono">
                                  Backfilled
                                </span>
                              )}
                              {!conn.backfill_complete && conn.last_synced_at && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-mono">
                                  {conn.backfilled_from
                                    ? `Backfilling to ${new Date(conn.backfilled_from).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
                                    : 'Backfilling history'}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground font-mono mt-0.5">
                              {conn.last_synced_at ? (
                                <span>Synced: {new Date(conn.last_synced_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                              ) : (
                                <span>Awaiting sync</span>
                              )}
                              {daysLeft !== null && (
                                <span className={cn("inline-flex items-center gap-1", isExpiringSoon ? "text-amber-500 font-semibold" : "text-muted-foreground")}>
                                  <Clock className="w-3 h-3" />
                                  {daysLeft === 0 ? "Consent expired" : `Consent: ${daysLeft}d left`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => askDelete({
                              name: conn.provider_name,
                              onConfirm: () => disconnectTrueLayer(conn.id),
                            })}
                            className="h-7 px-2 text-xs font-mono text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-border/30 pt-3 flex flex-wrap items-center justify-between gap-3">
                  <Button
                    onClick={connectTrueLayer}
                    disabled={isConnectingTrueLayer}
                    variant="outline"
                    className="rounded-lg gap-1.5 text-xs h-8 px-3 font-mono border-border/60 hover:border-border"
                  >
                    {isConnectingTrueLayer ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Connect Another Bank
                  </Button>

                  <div className="flex flex-wrap items-center gap-2">
                  <BankSyncStatus
                    status={trueLayerStatus}
                    isSyncing={isSyncingTrueLayer}
                    syncAvailableAt={syncAvailableAt}
                    onSync={syncTrueLayer}
                    className="h-8"
                  />
                  <Button
                    onClick={syncTrueLayer}
                    disabled={isSyncingTrueLayer || syncAvailableAt !== null}
                    className="rounded-lg bg-primary text-primary-foreground gap-1.5 font-semibold text-xs h-8 px-4 font-mono"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isSyncingTrueLayer && "animate-spin")} />
                    {isSyncingTrueLayer
                      ? "Syncing..."
                      : syncAvailableAt !== null
                        ? `Next sync ${formatCooldownEnd(syncAvailableAt)}`
                        : "Sync All Banks"}
                  </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-t border-border/30 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground font-mono max-w-xl leading-relaxed">
                  Securely link your UK banks (e.g. Barclays, Monzo, Lloyds, Revolut) to automatically fetch balances and statements. You can link multiple banks side-by-side.
                </p>
                <div className="flex items-center gap-3 shrink-0">
                  <Button
                    onClick={connectTrueLayer}
                    disabled={isConnectingTrueLayer}
                    className="rounded-lg bg-primary text-primary-foreground gap-1.5 font-semibold text-xs h-8 px-4 font-mono"
                  >
                    {isConnectingTrueLayer ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        Connect Bank Account
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* DIALOG: Add Account */}
      <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
        <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm font-mono shadow-none">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Add Bank Account</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">Add a new personal bank account or credit card.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddAccount} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="acc-name" className="text-xs font-mono text-muted-foreground">Account Name</Label>
              <Input
                id="acc-name"
                placeholder="e.g. Chase Saver"
                value={newAccount.name}
                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="acc-type" className="text-xs font-mono text-muted-foreground">Account Type</Label>
              <Select
                value={newAccount.type}
                onValueChange={(val) => setNewAccount({ ...newAccount, type: val as BankAccount['type'] })}
              >
                <SelectTrigger id="acc-type" className="bg-background/50 border border-border/40 rounded-lg h-9 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg border border-border/40 bg-popover text-xs font-mono">
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="credit">Credit Card</SelectItem>
                  <SelectItem value="investment">Investment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="acc-issuer" className="text-xs font-mono text-muted-foreground">Issuer / Bank</Label>
              <Input
                id="acc-issuer"
                placeholder="e.g. Chase Bank"
                value={newAccount.issuer}
                onChange={(e) => setNewAccount({ ...newAccount, issuer: e.target.value })}
                className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="acc-balance" className="text-xs font-mono text-muted-foreground">
                {newAccount.type === 'investment' ? 'Uninvested Cash Balance (£)' : 'Balance (£)'}
              </Label>
              <Input
                id="acc-balance"
                type="number"
                step="0.01"
                placeholder={newAccount.type === 'investment' ? 'e.g. 250.00 cash not invested' : 'e.g. 5200 (Use negative for credit balance)'}
                value={newAccount.balance}
                onChange={(e) => setNewAccount({ ...newAccount, balance: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                required
              />
              {newAccount.type === 'investment' && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Positions are recorded in Investments. Enter cash only here so your portfolio is not counted twice.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="acc-fee" className="text-xs font-mono text-muted-foreground">Annual Fee (£)</Label>
              <Input
                id="acc-fee"
                type="number"
                placeholder="e.g. 195"
                value={newAccount.annualFee}
                onChange={(e) => setNewAccount({ ...newAccount, annualFee: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
              />
            </div>
            {newAccount.type === 'credit' && (
              <div className="space-y-1">
                <Label htmlFor="acc-limit" className="text-xs font-mono text-muted-foreground">Credit Limit (£)</Label>
                <Input
                  id="acc-limit"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Leave blank if unknown"
                  value={newAccount.creditLimit ?? ''}
                  onChange={(e) => setNewAccount({ ...newAccount, creditLimit: parseCreditLimit(e.target.value) })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="acc-use" className="text-xs font-mono text-muted-foreground">Primary Use Case</Label>
              <Input
                id="acc-use"
                placeholder="e.g. Salary deposits, tech purchases"
                value={newAccount.useCase}
                onChange={(e) => setNewAccount({ ...newAccount, useCase: e.target.value })}
                className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="acc-emoji" className="text-xs font-mono text-muted-foreground">Emoji Icon</Label>
                <Input
                  id="acc-emoji"
                  placeholder="e.g. 🏦"
                  value={newAccount.emoji || ''}
                  onChange={(e) => setNewAccount({ ...newAccount, emoji: e.target.value })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-center text-sm font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="acc-color" className="text-xs font-mono text-muted-foreground">Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="acc-color"
                    type="color"
                    value={newAccount.color || 'hsl(var(--muted-foreground))'}
                    onChange={(e) => setNewAccount({ ...newAccount, color: e.target.value })}
                    className="rounded-lg h-9 w-12 border border-border/40 bg-background/50 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={newAccount.color || 'hsl(var(--muted-foreground))'}
                    onChange={(e) => setNewAccount({ ...newAccount, color: e.target.value })}
                    className="rounded-lg h-9 border border-border/40 bg-background/50 font-mono text-xs uppercase flex-1"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="pt-4 gap-2 sm:gap-0">
              <Button variant="outline" type="button" onClick={() => setIsAddAccountOpen(false)} className="rounded-lg h-9 px-4 text-xs font-mono border-border/40">Cancel</Button>
              <Button type="submit" className="rounded-lg h-9 px-4 text-xs font-mono bg-primary text-primary-foreground">Save Account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Edit Account */}
      <Dialog open={isEditAccountOpen} onOpenChange={setIsEditAccountOpen}>
        <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm font-mono shadow-none">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Edit Account</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">Update account metrics.</DialogDescription>
          </DialogHeader>
          {activeAccount && (
            <form onSubmit={handleEditAccount} className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="edit-acc-name" className="text-xs font-mono text-muted-foreground">Account Name</Label>
                <Input
                  id="edit-acc-name"
                  value={activeAccount.name}
                  onChange={(e) => setActiveAccount({ ...activeAccount, name: e.target.value })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-acc-balance" className="text-xs font-mono text-muted-foreground">
                  {activeAccount.type === 'investment' ? 'Uninvested Cash Balance (£)' : 'Balance (£)'}
                </Label>
                <Input
                  id="edit-acc-balance"
                  type="number"
                  step="0.01"
                  value={activeAccount.balance}
                  onChange={(e) => setActiveAccount({ ...activeAccount, balance: parseFloat(e.target.value) || 0 })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                  required
                />
                {activeAccount.type === 'investment' && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Positions are recorded in Investments. Enter cash only here so your portfolio is not counted twice.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-acc-fee" className="text-xs font-mono text-muted-foreground">Annual Fee (£)</Label>
                <Input
                  id="edit-acc-fee"
                  type="number"
                  value={activeAccount.annualFee}
                  onChange={(e) => setActiveAccount({ ...activeAccount, annualFee: parseFloat(e.target.value) || 0 })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                />
              </div>
              {activeAccount.type === 'credit' && (
                <div className="space-y-1">
                  <Label htmlFor="edit-acc-limit" className="text-xs font-mono text-muted-foreground">Credit Limit (£)</Label>
                  <Input
                    id="edit-acc-limit"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Leave blank if unknown"
                    value={activeAccount.creditLimit ?? ''}
                    onChange={(e) => setActiveAccount({ ...activeAccount, creditLimit: parseCreditLimit(e.target.value) })}
                    className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="edit-acc-use" className="text-xs font-mono text-muted-foreground">Primary Use Case</Label>
                <Input
                  id="edit-acc-use"
                  value={activeAccount.useCase || ''}
                  onChange={(e) => setActiveAccount({ ...activeAccount, useCase: e.target.value })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="edit-acc-emoji" className="text-xs font-mono text-muted-foreground">Emoji Icon</Label>
                  <Input
                    id="edit-acc-emoji"
                    placeholder="e.g. 🏦"
                    value={activeAccount.emoji || ''}
                    onChange={(e) => setActiveAccount({ ...activeAccount, emoji: e.target.value })}
                    className="rounded-lg h-9 border border-border/40 bg-background/50 text-center text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-acc-color" className="text-xs font-mono text-muted-foreground">Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="edit-acc-color"
                      type="color"
                      value={activeAccount.color || 'hsl(var(--muted-foreground))'}
                      onChange={(e) => setActiveAccount({ ...activeAccount, color: e.target.value })}
                      className="rounded-lg h-9 w-12 border border-border/40 bg-background/50 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={activeAccount.color || 'hsl(var(--muted-foreground))'}
                      onChange={(e) => setActiveAccount({ ...activeAccount, color: e.target.value })}
                      className="rounded-lg h-9 border border-border/40 bg-background/50 font-mono text-xs uppercase flex-1"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="pt-4 gap-2 sm:gap-0">
                <Button variant="outline" type="button" onClick={() => setIsEditAccountOpen(false)} className="rounded-lg h-9 px-4 text-xs font-mono border-border/40">Cancel</Button>
                <Button type="submit" className="rounded-lg h-9 px-4 text-xs font-mono bg-primary text-primary-foreground">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {deleteDialog}
    </>
  );
}

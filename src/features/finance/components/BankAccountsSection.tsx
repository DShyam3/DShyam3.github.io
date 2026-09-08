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
import { Activity, ArrowUpRight, Building2, Clock, CreditCard, Edit2, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';

export default function BankAccountsSection() {
  const { toast } = useToast();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const {
    bankAccounts,
    creditScores,
    memberships,
    saveDataToSupabase,
    setBankAccounts,
    fetchSupabaseData,
  } = useFinanceData();

  const {
    trueLayerStatus,
    isSyncingTrueLayer,
    isConnectingTrueLayer,
    connectTrueLayer,
    disconnectTrueLayer,
    syncTrueLayer,
  } = useTrueLayer(fetchSupabaseData);

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

        <div className="overflow-auto max-h-[60vh] bg-card/50 border border-border/40 rounded-xl p-4 sm:p-5 hover:border-border/80 transition-colors -mx-0">
          <table className="min-w-[720px] w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground uppercase tracking-wider font-semibold">
                <th className="py-3 px-3 whitespace-nowrap">Name</th>
                <th className="py-3 px-3 whitespace-nowrap">Type</th>
                <th className="py-3 px-3 whitespace-nowrap">Issuer</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Balance</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Annual Fee</th>
                <th className="py-3 px-3 whitespace-nowrap">Use Case</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {bankAccounts.map(account => (
                <tr key={account.id} className="hover:bg-muted/10 transition-colors">
                  <td className="py-3 px-3 font-semibold text-foreground flex items-center gap-2">
                    <span
                      className="w-1.5 h-6 rounded-full shrink-0"
                      style={{ backgroundColor: account.color || 'hsl(var(--muted-foreground))' }}
                    />
                    <span className="text-base shrink-0 leading-none">{account.emoji || '💰'}</span>
                    <span>{account.name}</span>
                  </td>
                  <td className="py-3 px-3 capitalize">{account.type}</td>
                  <td className="py-3 px-3">{account.issuer}</td>
                  <td className={cn("py-3 px-3 text-right font-mono font-bold", account.balance >= 0 ? "text-positive" : "text-destructive")}>
                    {formatGBP(account.balance)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">{formatGBP(account.annualFee)}</td>
                  <td className="py-3 px-3 text-muted-foreground truncate max-w-[150px]">{account.useCase || '—'}</td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setActiveAccount(account);
                          setIsEditAccountOpen(true);
                        }}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAccount(account.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {bankAccounts.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6 italic text-muted-foreground">No bank accounts added.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TrueLayer Integration Card */}
      {(() => {
        const connections = trueLayerStatus?.connections ?? [];
        const hasConnections = trueLayerStatus?.connected && connections.length > 0;

        return (
          <div className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors space-y-4">
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
                    const expiry = conn.consent_expires_at || conn.expires_at;
                    const daysLeft = expiry
                      ? Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
                      : null;
                    const isExpiringSoon = daysLeft !== null && daysLeft <= 14;

                    return (
                      <div key={conn.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-3 hover:bg-muted/10 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          {conn.provider_logo_uri ? (
                            <img
                              src={conn.provider_logo_uri}
                              alt={conn.provider_name}
                              className="w-8 h-8 rounded-lg object-contain bg-card border border-border/40 p-1 shrink-0"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                              <Building2 className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-xs text-foreground truncate">{conn.provider_name}</span>
                              {conn.backfill_complete && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-positive/10 text-positive border border-positive/20 font-mono">
                                  Backfilled
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

                  <Button
                    onClick={syncTrueLayer}
                    disabled={isSyncingTrueLayer}
                    className="rounded-lg bg-primary text-primary-foreground gap-1.5 font-semibold text-xs h-8 px-4 font-mono"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isSyncingTrueLayer && "animate-spin")} />
                    {isSyncingTrueLayer ? "Syncing..." : "Sync All Banks"}
                  </Button>
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
              <Label htmlFor="acc-balance" className="text-xs font-mono text-muted-foreground">Balance (£)</Label>
              <Input
                id="acc-balance"
                type="number"
                step="0.01"
                placeholder="e.g. 5200 (Use negative for credit balance)"
                value={newAccount.balance}
                onChange={(e) => setNewAccount({ ...newAccount, balance: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                required
              />
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
                <Label htmlFor="edit-acc-balance" className="text-xs font-mono text-muted-foreground">Balance (£)</Label>
                <Input
                  id="edit-acc-balance"
                  type="number"
                  step="0.01"
                  value={activeAccount.balance}
                  onChange={(e) => setActiveAccount({ ...activeAccount, balance: parseFloat(e.target.value) || 0 })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                  required
                />
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

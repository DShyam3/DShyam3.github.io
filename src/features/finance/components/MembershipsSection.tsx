import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useFinanceData } from '../FinanceDataContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Membership } from '@/features/finance/finance-types';
import { formatGBP } from '@/features/finance/utils/calculations';
import { Award, Edit2, Plus, Trash2 } from 'lucide-react';

export default function MembershipsSection() {
  const { toast } = useToast();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const {
    bankAccounts,
    creditScores,
    memberships,
    saveDataToSupabase,
    setMemberships,
  } = useFinanceData();

  const [isAddMembershipOpen, setIsAddMembershipOpen] = useState(false);
  const [isEditMembershipOpen, setIsEditMembershipOpen] = useState(false);
  const [activeMembership, setActiveMembership] = useState<Membership | null>(null);
  const [newMembership, setNewMembership] = useState<Omit<Membership, 'id' | 'annualFee'> & { annualFee: number | ''; }>({
    name: '',
    type: 'points',
    status: 'Active',
    annualFee: '',
    useCase: '',
  });

  const handleAddMembership = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMembership.name) {
      toast({ title: 'Error', description: 'Please enter membership name.', variant: 'destructive' });
      return;
    }
    const created: Membership = {
      ...newMembership,
      annualFee: newMembership.annualFee === '' ? 0 : newMembership.annualFee,
      id: 'm_' + Date.now(),
    };
    const updated = [...memberships, created];
    setMemberships(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships: updated, creditScores });
    setIsAddMembershipOpen(false);
    setNewMembership({ name: '', type: 'points', status: 'Active', annualFee: '', useCase: '' });
    toast({ title: 'Membership Added', description: `Added "${created.name}".` });
  };

  const handleEditMembership = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMembership) return;
    const updated = memberships.map(m => m.id === activeMembership.id ? activeMembership : m);
    setMemberships(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships: updated, creditScores });
    setIsEditMembershipOpen(false);
    setActiveMembership(null);
    toast({ title: 'Membership Updated', description: 'Membership details saved.' });
  };

  const performDeleteMembership = (id: string) => {
    const updated = memberships.filter(m => m.id !== id);
    setMemberships(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships: updated, creditScores });
    toast({ title: 'Membership Deleted', description: 'Membership removed.' });
  };

  const handleDeleteMembership = (id: string) =>
    askDelete({
      name: memberships.find(m => m.id === id)?.name,
      onConfirm: () => performDeleteMembership(id),
    });

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
          <div className="min-w-0">
            <h3 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
              <Award className="h-4 w-4 text-primary shrink-0" /> Memberships & Reward Programs
            </h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">Keep track of reward accounts, points programs, and loyalty systems</p>
          </div>
          <Button onClick={() => setIsAddMembershipOpen(true)} className="rounded-lg gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8 px-3 shrink-0 self-start sm:self-auto font-mono">
            <Plus className="h-3.5 w-3.5" /> Add Membership
          </Button>
        </div>

        <div className="overflow-auto max-h-[60vh] bg-card/50 border border-border/40 rounded-xl p-4 sm:p-5 hover:border-border/80 transition-colors">
          <table className="min-w-[640px] w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground uppercase tracking-wider font-semibold">
                <th className="py-3 px-3 whitespace-nowrap">Name</th>
                <th className="py-3 px-3 whitespace-nowrap">Type</th>
                <th className="py-3 px-3 whitespace-nowrap">Status / Points</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Annual Fee</th>
                <th className="py-3 px-3 whitespace-nowrap">Use Case</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {memberships.map(membership => (
                <tr key={membership.id} className="hover:bg-muted/10 transition-colors">
                  <td className="py-3 px-3 font-semibold text-foreground">{membership.name}</td>
                  <td className="py-3 px-3 capitalize">{membership.type}</td>
                  <td className="py-3 px-3">{membership.status}</td>
                  <td className="py-3 px-3 text-right font-mono">{formatGBP(membership.annualFee)}</td>
                  <td className="py-3 px-3 text-muted-foreground truncate max-w-[200px]">{membership.useCase || '—'}</td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setActiveMembership(membership);
                          setIsEditMembershipOpen(true);
                        }}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteMembership(membership.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {memberships.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-6 italic text-muted-foreground">No reward memberships added.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Membership Dialog */}
      <Dialog open={isAddMembershipOpen} onOpenChange={setIsAddMembershipOpen}>
        <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm font-mono shadow-none">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Add Reward Membership</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">Add a new point, loyalty or reward system.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMembership} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="mem-name" className="text-xs font-mono text-muted-foreground">Membership Program</Label>
              <Input
                id="mem-name"
                placeholder="e.g. Tesco Clubcard"
                value={newMembership.name}
                onChange={(e) => setNewMembership({ ...newMembership, name: e.target.value })}
                className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mem-type" className="text-xs font-mono text-muted-foreground">Program Type</Label>
              <Select
                value={newMembership.type}
                onValueChange={(val) => setNewMembership({ ...newMembership, type: val as Membership['type'] })}
              >
                <SelectTrigger id="mem-type" className="bg-background/50 border border-border/40 rounded-lg h-9 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg border border-border/40 bg-popover text-xs font-mono">
                  <SelectItem value="points">Points Program</SelectItem>
                  <SelectItem value="cashback">Cashback Reward</SelectItem>
                  <SelectItem value="miles">Airline Miles</SelectItem>
                  <SelectItem value="perks">Exclusive Perks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="mem-status" className="text-xs font-mono text-muted-foreground">Status / Tier / Point Count</Label>
              <Input
                id="mem-status"
                placeholder="e.g. Silver Tier (1200 points)"
                value={newMembership.status}
                onChange={(e) => setNewMembership({ ...newMembership, status: e.target.value })}
                className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mem-fee" className="text-xs font-mono text-muted-foreground">Annual Fee (£)</Label>
              <Input
                id="mem-fee"
                type="number"
                placeholder="e.g. 0"
                value={newMembership.annualFee}
                onChange={(e) => setNewMembership({ ...newMembership, annualFee: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mem-use" className="text-xs font-mono text-muted-foreground">Primary Use Case</Label>
              <Input
                id="mem-use"
                placeholder="e.g. Grocery cash savings"
                value={newMembership.useCase}
                onChange={(e) => setNewMembership({ ...newMembership, useCase: e.target.value })}
                className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
              />
            </div>
            <DialogFooter className="pt-4 gap-2 sm:gap-0">
              <Button variant="outline" type="button" onClick={() => setIsAddMembershipOpen(false)} className="rounded-lg h-9 px-4 text-xs font-mono border-border/40">Cancel</Button>
              <Button type="submit" className="rounded-lg h-9 px-4 text-xs font-mono bg-primary text-primary-foreground">Save Program</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Membership Dialog */}
      <Dialog open={isEditMembershipOpen} onOpenChange={setIsEditMembershipOpen}>
        <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm font-mono shadow-none">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Edit Reward Program</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">Update loyalty account details.</DialogDescription>
          </DialogHeader>
          {activeMembership && (
            <form onSubmit={handleEditMembership} className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="edit-mem-name" className="text-xs font-mono text-muted-foreground">Program Name</Label>
                <Input
                  id="edit-mem-name"
                  value={activeMembership.name}
                  onChange={(e) => setActiveMembership({ ...activeMembership, name: e.target.value })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-mem-status" className="text-xs font-mono text-muted-foreground">Status / Tier</Label>
                <Input
                  id="edit-mem-status"
                  value={activeMembership.status}
                  onChange={(e) => setActiveMembership({ ...activeMembership, status: e.target.value })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-mem-fee" className="text-xs font-mono text-muted-foreground">Annual Fee (£)</Label>
                <Input
                  id="edit-mem-fee"
                  type="number"
                  value={activeMembership.annualFee}
                  onChange={(e) => setActiveMembership({ ...activeMembership, annualFee: parseFloat(e.target.value) || 0 })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-mem-use" className="text-xs font-mono text-muted-foreground">Primary Use Case</Label>
                <Input
                  id="edit-mem-use"
                  value={activeMembership.useCase || ''}
                  onChange={(e) => setActiveMembership({ ...activeMembership, useCase: e.target.value })}
                  className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                />
              </div>
              <DialogFooter className="pt-4 gap-2 sm:gap-0">
                <Button variant="outline" type="button" onClick={() => setIsEditMembershipOpen(false)} className="rounded-lg h-9 px-4 text-xs font-mono border-border/40">Cancel</Button>
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

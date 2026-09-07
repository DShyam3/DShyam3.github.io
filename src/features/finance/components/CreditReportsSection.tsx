import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useFinanceData } from '../FinanceDataContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditScoreEntry } from '@/features/finance/finance-types';
import { BUREAU_BANDS, BureauBand, CreditTier, describeArc, polarToCartesian } from '@/lib/finance';
import { cn } from '@/lib/utils';
import { Plus, ShieldAlert, Trash2 } from 'lucide-react';

const CREDIT_TIER_COLORS: Record<CreditTier, string> = {
  1: 'hsl(var(--destructive))',
  2: 'hsl(38 92% 50%)',
  3: 'hsl(84 81% 44%)',
  4: 'hsl(160 84% 39%)',
  5: 'hsl(var(--positive))',
};

const CREDIT_TIER_CLASSES: Record<CreditTier, string> = {
  1: 'text-rose-500 dark:text-rose-400',
  2: 'text-amber-500 dark:text-amber-400',
  3: 'text-lime-500 dark:text-lime-400',
  4: 'text-emerald-500 dark:text-emerald-400',
  5: 'text-teal-500 dark:text-teal-400',
};

export default function CreditReportsSection() {
  const { toast } = useToast();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const {
    bankAccounts,
    creditBureaus,
    creditScores,
    memberships,
    saveDataToSupabase,
    setCreditScores,
  } = useFinanceData();

  const [isAddCreditScoreOpen, setIsAddCreditScoreOpen] = useState(false);
  const [hoveredBands, setHoveredBands] = useState<Record<'experian' | 'transunion' | 'equifax', BureauBand | null>>({
    experian: null,
    transunion: null,
    equifax: null,
  });

  const [newCreditScore, setNewCreditScore] = useState<{ bureau: 'experian' | 'transunion' | 'equifax'; score: number | ''; date: string }>({
    bureau: 'experian',
    score: '',
    date: new Date().toISOString().split('T')[0],
  });

  const handleAddCreditScore = (e: React.FormEvent) => {
    e.preventDefault();
    const maxScore = creditBureaus.find(b => b.key === newCreditScore.bureau)?.maxScore ?? 1000;
    if (newCreditScore.score === '' || newCreditScore.score < 0 || newCreditScore.score > maxScore) {
      toast({ title: 'Invalid Score', description: `Score must be between 0 and ${maxScore}.`, variant: 'destructive' });
      return;
    }
    const entry: CreditScoreEntry = {
      id: 'cs_' + Date.now(),
      date: newCreditScore.date,
      score: newCreditScore.score,
    };
    const updated = {
      ...creditScores,
      [newCreditScore.bureau]: [...creditScores[newCreditScore.bureau], entry].sort((a, b) => a.date.localeCompare(b.date)),
    };
    setCreditScores(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships, creditScores: updated });
    setIsAddCreditScoreOpen(false);
    setNewCreditScore({ bureau: 'experian', score: '', date: new Date().toISOString().split('T')[0] });
    toast({ title: 'Credit Score Added', description: `Logged ${newCreditScore.bureau.charAt(0).toUpperCase() + newCreditScore.bureau.slice(1)} score of ${newCreditScore.score}.` });
  };

  const performDeleteCreditScore = (bureau: 'experian' | 'transunion' | 'equifax', entryId: string) => {
    const updated = {
      ...creditScores,
      [bureau]: creditScores[bureau].filter(e => e.id !== entryId),
    };
    setCreditScores(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships, creditScores: updated });
    toast({ title: 'Score Entry Deleted', description: 'Credit score entry removed.' });
  };

  const handleDeleteCreditScore = (
    bureau: 'experian' | 'transunion' | 'equifax',
    entryId: string,
  ) =>
    askDelete({
      title: 'Delete score entry',
      description: 'Delete this credit score entry? This action cannot be undone.',
      onConfirm: () => performDeleteCreditScore(bureau, entryId),
    });

  const getRatingFromBands = (score: number, bureauKey: 'experian' | 'transunion' | 'equifax') => {
    const bands = BUREAU_BANDS[bureauKey];
    const found = bands.find(b => score >= b.min && score <= b.max);
    if (found) {
      return {
        text: found.name,
        cls: CREDIT_TIER_CLASSES[found.tier],
        color: CREDIT_TIER_COLORS[found.tier],
        band: found,
      };
    }
    return { text: 'Unknown', cls: 'text-muted-foreground', color: 'hsl(var(--muted-foreground))', band: null };
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
          <div className="min-w-0">
            <h3 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary shrink-0" /> Credit Reports
            </h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">Track your credit scores across all three bureaus over time</p>
          </div>
          <Button onClick={() => setIsAddCreditScoreOpen(true)} className="rounded-lg gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8 px-3 shrink-0 self-start sm:self-auto font-mono">
            <Plus className="h-3.5 w-3.5" /> Log Score
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {creditBureaus.map(bureau => {
            const entries = creditScores[bureau.key] || [];
            const latest = entries.length > 0 ? entries[entries.length - 1] : null;
            const prev = entries.length > 1 ? entries[entries.length - 2] : null;
            const delta = latest && prev ? latest.score - prev.score : 0;

            const rating = latest ? getRatingFromBands(latest.score, bureau.key) : null;
            const bands = BUREAU_BANDS[bureau.key];
            const scoreAngle = latest ? 140 + (Math.min(latest.score, bureau.maxScore) / bureau.maxScore) * 260 : 140;
            const dotPos = polarToCartesian(80, 75, 54, scoreAngle);

            return (
              <Card key={bureau.key} className="rounded-xl border border-border/40 bg-card/50 hover:border-border/80 transition-colors p-5 flex flex-col justify-between space-y-4 shadow-none">
                {/* Bureau Card Header */}
                <div className="flex items-center justify-between border-b border-border/30 pb-3">
                  <div className="space-y-0.5">
                    <span className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground">
                      {bureau.label}
                    </span>
                    <p className="text-xs font-mono text-muted-foreground">
                      Scale 0–{bureau.maxScore}
                    </p>
                  </div>
                  {rating && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-mono font-semibold border"
                      style={{
                        color: rating.color,
                        borderColor: `${rating.color}40`,
                        backgroundColor: `${rating.color}15`,
                      }}
                    >
                      {rating.text}
                    </span>
                  )}
                </div>

                {/* Minimal SVG Arch Gauge */}
                <div className="flex flex-col items-center justify-center py-1">
                  <svg className="w-48 h-32 overflow-visible mx-auto" viewBox="0 15 160 105">
                    {/* Background Track Arc */}
                    <path
                      d={describeArc(80, 75, 54, 140, 400)}
                      fill="none"
                      stroke="currentColor"
                      className="text-muted/20"
                      strokeWidth="7"
                      strokeLinecap="round"
                    />

                    {/* Progress Arc */}
                    {latest && latest.score > 0 && (
                      <path
                        d={describeArc(80, 75, 54, 140, scoreAngle)}
                        fill="none"
                        stroke={rating ? rating.color : bureau.color}
                        strokeWidth="7"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Indicator Dot */}
                    {latest && latest.score > 0 && (
                      <circle
                        cx={dotPos.x}
                        cy={dotPos.y}
                        r="4.5"
                        fill={rating ? rating.color : bureau.color}
                        stroke="hsl(var(--card))"
                        strokeWidth="2"
                      />
                    )}

                    {/* Centered Score Figure inside SVG */}
                    <text
                      x="80"
                      y="68"
                      textAnchor="middle"
                      className="font-mono text-3xl font-bold tracking-tight"
                      style={{ fill: rating ? rating.color : bureau.color }}
                    >
                      {latest ? latest.score : '—'}
                    </text>
                    <text
                      x="80"
                      y="84"
                      textAnchor="middle"
                      className="font-mono text-xs fill-muted-foreground"
                    >
                      of {bureau.maxScore}
                    </text>
                    {delta !== 0 && (
                      <text
                        x="80"
                        y="98"
                        textAnchor="middle"
                        className={cn(
                          "font-mono text-xs font-semibold",
                          delta > 0 ? "fill-positive" : delta < 0 ? "fill-destructive" : "fill-muted-foreground"
                        )}
                      >
                        {delta > 0 ? '+' : ''}{delta} pts
                      </text>
                    )}
                  </svg>
                </div>

                {/* Tier Range Segment Bar */}
                <div className="space-y-1.5 w-full pt-1">
                  <div className="flex items-center gap-1 w-full h-1.5 rounded-full overflow-hidden bg-muted/20">
                    {bands.map(b => {
                      const isCurrent = latest && latest.score >= b.min && latest.score <= b.max;
                      const isHovered = hoveredBands[bureau.key]?.name === b.name;
                      const widthPct = ((b.max - b.min) / bureau.maxScore) * 100;
                      return (
                        <div
                          key={b.name}
                          style={{
                            width: `${widthPct}%`,
                            backgroundColor: CREDIT_TIER_COLORS[b.tier],
                          }}
                          className={cn(
                            "h-full transition-all cursor-pointer rounded-sm",
                            isCurrent || isHovered
                              ? "opacity-100 ring-1 ring-foreground/40 shadow-sm"
                              : "opacity-35 hover:opacity-75"
                          )}
                          title={`${b.name}: ${b.min}–${b.max}`}
                          onMouseEnter={() => setHoveredBands(prev => ({ ...prev, [bureau.key]: b }))}
                          onMouseLeave={() => setHoveredBands(prev => ({ ...prev, [bureau.key]: null }))}
                        />
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono min-h-[18px]">
                    <span
                      className="font-medium"
                      style={{
                        color: hoveredBands[bureau.key]
                          ? CREDIT_TIER_COLORS[hoveredBands[bureau.key]!.tier]
                          : rating
                            ? rating.color
                            : undefined,
                      }}
                    >
                      {hoveredBands[bureau.key]?.name ?? (rating?.text || 'Unrated')}
                    </span>
                    <span className="text-muted-foreground/60 tabular-nums">
                      {hoveredBands[bureau.key]
                        ? `${hoveredBands[bureau.key]?.min}–${hoveredBands[bureau.key]?.max}`
                        : rating?.band
                          ? `${rating.band.min}–${rating.band.max}`
                          : `0–${bureau.maxScore}`}
                    </span>
                  </div>
                </div>

                {/* Score History Section */}
                <div className="border-t border-border/30 pt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono font-semibold text-muted-foreground">
                    <span className="uppercase tracking-wider">Score History</span>
                    {latest && (
                      <span className="font-normal text-muted-foreground/70">
                        Last: {latest.date}
                      </span>
                    )}
                  </div>

                  {entries.length > 0 ? (
                    <div className="space-y-1 max-h-[100px] overflow-y-auto pr-1 scrollbar-thin">
                      {[...entries].reverse().map(entry => {
                        const entryRating = getRatingFromBands(entry.score, bureau.key);
                        return (
                          <div
                            key={entry.id}
                            className="group flex items-center justify-between py-1 px-2 rounded-sm hover:bg-muted/20 transition-colors text-xs font-mono"
                          >
                            <span className="text-muted-foreground text-xs">{entry.date}</span>
                            <div className="flex items-center gap-2">
                              <span
                                className="font-bold tabular-nums text-xs"
                                style={{ color: entryRating.color }}
                              >
                                {entry.score}
                              </span>
                              <button
                                onClick={() => handleDeleteCreditScore(bureau.key, entry.id)}
                                className="text-muted-foreground hover:text-destructive p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete entry"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground/60 italic py-3 text-center font-mono">
                      No score history logged.
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Log Credit Score Dialog */}
      <Dialog open={isAddCreditScoreOpen} onOpenChange={setIsAddCreditScoreOpen}>
        <DialogContent className="sm:rounded-xl border border-border/40 bg-card max-w-sm font-mono shadow-none">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground">Log Credit Score</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">Manually log your latest credit score from any bureau.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCreditScore} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="cs-bureau" className="text-xs font-mono text-muted-foreground">Credit Bureau</Label>
              <Select
                value={newCreditScore.bureau}
                onValueChange={(val) => setNewCreditScore({ ...newCreditScore, bureau: val as 'experian' | 'transunion' | 'equifax' })}
              >
                <SelectTrigger id="cs-bureau" className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono">
                  <SelectValue placeholder="Select bureau..." />
                </SelectTrigger>
                <SelectContent className="rounded-lg border border-border/40 bg-popover text-xs font-mono">
                  {creditBureaus.map(b => (
                    <SelectItem key={b.key} value={b.key} className="text-xs font-mono">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                        {b.label} (0–{b.maxScore})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cs-score" className="text-xs font-mono text-muted-foreground">Score</Label>
              <Input
                id="cs-score"
                type="number"
                min="0"
                placeholder="e.g. 720"
                value={newCreditScore.score}
                onChange={(e) => setNewCreditScore({ ...newCreditScore, score: e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0 })}
                className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono tabular-nums"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cs-date" className="text-xs font-mono text-muted-foreground">Date Checked</Label>
              <Input
                id="cs-date"
                type="date"
                value={newCreditScore.date}
                onChange={(e) => setNewCreditScore({ ...newCreditScore, date: e.target.value })}
                className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono"
                required
              />
            </div>
            <DialogFooter className="pt-4 gap-2 sm:gap-0">
              <Button variant="outline" type="button" onClick={() => setIsAddCreditScoreOpen(false)} className="rounded-lg h-9 px-4 text-xs font-mono border-border/40">Cancel</Button>
              <Button type="submit" className="rounded-lg h-9 px-4 text-xs font-mono bg-primary text-primary-foreground">Log Score</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {deleteDialog}
    </>
  );
}

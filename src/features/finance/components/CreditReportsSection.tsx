import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useFinanceData } from '../FinanceDataContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditScoreEntry } from '@/features/finance/finance-types';
import { BUREAU_BANDS, BureauBand, CreditTier, describeArc, polarToCartesian } from '@/lib/finance';
import { cn } from '@/lib/utils';
import { Plus, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';

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

  interface BureauScoreDraft {
    included: boolean;
    score: number | '';
    originalScore: number | null;
  }

  const [logDate, setLogDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bureauDrafts, setBureauDrafts] = useState<Record<'experian' | 'transunion' | 'equifax', BureauScoreDraft>>({
    experian: { included: true, score: '', originalScore: null },
    transunion: { included: true, score: '', originalScore: null },
    equifax: { included: true, score: '', originalScore: null },
  });

  const openLogDialog = React.useCallback(() => {
    const drafts: Record<'experian' | 'transunion' | 'equifax', BureauScoreDraft> = {
      experian: { included: true, score: '', originalScore: null },
      transunion: { included: true, score: '', originalScore: null },
      equifax: { included: true, score: '', originalScore: null },
    };

    creditBureaus.forEach(bureau => {
      const key = bureau.key as 'experian' | 'transunion' | 'equifax';
      const entries = creditScores[key] || [];
      const latest = entries.length > 0 ? entries[entries.length - 1] : null;
      drafts[key] = {
        included: true,
        score: latest ? latest.score : '',
        originalScore: latest ? latest.score : null,
      };
    });

    setBureauDrafts(drafts);
    setLogDate(new Date().toISOString().split('T')[0]);
    setIsAddCreditScoreOpen(true);
  }, [creditBureaus, creditScores]);

  const setAllInclusion = (included: boolean) => {
    setBureauDrafts(prev => {
      const next = { ...prev };
      (Object.keys(next) as Array<'experian' | 'transunion' | 'equifax'>).forEach(k => {
        next[k] = { ...next[k], included };
      });
      return next;
    });
  };

  const handleAddCreditScores = (e: React.FormEvent) => {
    e.preventDefault();
    const bureausToUpdate = creditBureaus.filter(b => bureauDrafts[b.key as 'experian' | 'transunion' | 'equifax']?.included);

    if (bureausToUpdate.length === 0) {
      toast({
        title: 'No bureaus selected',
        description: 'Please select at least one credit bureau to log.',
        variant: 'destructive',
      });
      return;
    }

    // Validate scores for all included bureaus
    for (const bureau of bureausToUpdate) {
      const key = bureau.key as 'experian' | 'transunion' | 'equifax';
      const draft = bureauDrafts[key];
      if (draft.score === '' || typeof draft.score !== 'number' || draft.score < 0 || draft.score > bureau.maxScore) {
        toast({
          title: 'Invalid Score',
          description: `Please enter a valid score between 0 and ${bureau.maxScore} for ${bureau.label}.`,
          variant: 'destructive',
        });
        return;
      }
    }

    const updated = { ...creditScores };
    const summaries: string[] = [];

    for (const bureau of bureausToUpdate) {
      const key = bureau.key as 'experian' | 'transunion' | 'equifax';
      const draft = bureauDrafts[key];
      const scoreNum = Number(draft.score);
      const existingEntries = updated[key] || [];

      // Check if an entry already exists for logDate
      const existingIdx = existingEntries.findIndex(e => e.date === logDate);
      if (existingIdx >= 0) {
        const copy = [...existingEntries];
        copy[existingIdx] = { ...copy[existingIdx], score: scoreNum };
        updated[key] = copy;
      } else {
        const newEntry: CreditScoreEntry = {
          id: 'cs_' + Date.now() + '_' + key,
          date: logDate,
          score: scoreNum,
        };
        updated[key] = [...existingEntries, newEntry].sort((a, b) => a.date.localeCompare(b.date));
      }

      if (draft.originalScore !== null) {
        const delta = scoreNum - draft.originalScore;
        if (delta === 0) {
          summaries.push(`${bureau.label}: ${scoreNum} (unchanged)`);
        } else {
          summaries.push(`${bureau.label}: ${scoreNum} (${delta > 0 ? `+${delta}` : delta} pts)`);
        }
      } else {
        summaries.push(`${bureau.label}: ${scoreNum}`);
      }
    }

    setCreditScores(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships, creditScores: updated });
    setIsAddCreditScoreOpen(false);
    toast({
      title: `Credit Scores Logged (${bureausToUpdate.length})`,
      description: summaries.join(' · '),
    });
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
          <Button onClick={openLogDialog} className="rounded-lg gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8 px-3 shrink-0 self-start sm:self-auto font-mono">
            <Plus className="h-3.5 w-3.5" /> Log Scores
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

      {/* Log Credit Scores Dialog */}
      <Dialog open={isAddCreditScoreOpen} onOpenChange={setIsAddCreditScoreOpen}>
        <DialogContent className="sm:rounded-xl border border-border/40 bg-card sm:max-w-lg font-mono shadow-none p-5 sm:p-6 gap-3">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center justify-between">
              <span>Log Credit Scores</span>
              <span className="text-[11px] font-normal text-muted-foreground">All 3 Bureaus</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">
              Current scores are pre-filled. Update any scores that changed, or submit to confirm unadjusted scores for this check date.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddCreditScores} className="space-y-3.5 pt-1">
            {/* Date Checked & Selection Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Label htmlFor="cs-date" className="text-xs font-mono text-muted-foreground shrink-0">
                  Date Checked:
                </Label>
                <Input
                  id="cs-date"
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono w-36 sm:w-40"
                  required
                />
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <span className="text-[10px] text-muted-foreground mr-1">Include:</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAllInclusion(true)}
                  className="h-6 px-2 text-[10px] rounded-md border-border/40 font-mono"
                >
                  All (3)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAllInclusion(false)}
                  className="h-6 px-2 text-[10px] rounded-md border-border/40 font-mono"
                >
                  None
                </Button>
              </div>
            </div>

            {/* Bureau Cards */}
            <div className="space-y-2.5">
              {creditBureaus.map(bureau => {
                const key = bureau.key as 'experian' | 'transunion' | 'equifax';
                const draft = bureauDrafts[key] || { included: true, score: '', originalScore: null };
                const numScore = typeof draft.score === 'number' ? draft.score : null;
                const delta = numScore !== null && draft.originalScore !== null ? numScore - draft.originalScore : null;
                const rating = numScore !== null ? getRatingFromBands(numScore, key) : null;

                return (
                  <div
                    key={bureau.key}
                    className={cn(
                      "rounded-xl border transition-colors p-3 space-y-2 font-mono text-xs",
                      draft.included
                        ? "border-border/60 bg-muted/15"
                        : "border-border/20 bg-muted/5 opacity-55"
                    )}
                  >
                    {/* Header: Checkbox + Bureau Name + Status Pill */}
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={draft.included}
                          onChange={(e) => {
                            setBureauDrafts(prev => ({
                              ...prev,
                              [key]: { ...prev[key], included: e.target.checked },
                            }));
                          }}
                          className="rounded border-border/60 text-primary accent-primary h-3.5 w-3.5 cursor-pointer"
                        />
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: bureau.color }} />
                        <span className="font-semibold text-foreground">{bureau.label}</span>
                        <span className="text-[10px] text-muted-foreground">0–{bureau.maxScore}</span>
                      </label>

                      {/* Live Status Pill */}
                      <div>
                        {!draft.included ? (
                          <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md font-mono">
                            Excluded
                          </span>
                        ) : draft.score === '' ? (
                          <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md font-mono">
                            Empty
                          </span>
                        ) : draft.originalScore !== null && delta === 0 ? (
                          <span className="text-[10px] text-muted-foreground bg-muted/50 border border-border/40 px-2 py-0.5 rounded-md font-mono font-medium">
                            Unchanged
                          </span>
                        ) : draft.originalScore !== null && delta !== null && delta > 0 ? (
                          <span className="text-[10px] text-positive bg-positive/10 border border-positive/30 px-2 py-0.5 rounded-md font-mono font-bold">
                            +{delta} pts ▴
                          </span>
                        ) : draft.originalScore !== null && delta !== null && delta < 0 ? (
                          <span className="text-[10px] text-destructive bg-destructive/10 border border-destructive/30 px-2 py-0.5 rounded-md font-mono font-bold">
                            {delta} pts ▾
                          </span>
                        ) : (
                          <span className="text-[10px] text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded-md font-mono">
                            First score
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score Input + Tier Indicator */}
                    {draft.included && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center pt-0.5">
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            max={bureau.maxScore}
                            placeholder={draft.originalScore !== null ? String(draft.originalScore) : `0–${bureau.maxScore}`}
                            value={draft.score}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBureauDrafts(prev => ({
                                ...prev,
                                [key]: {
                                  ...prev[key],
                                  score: val === '' ? '' : parseInt(val, 10) || 0,
                                },
                              }));
                            }}
                            className="rounded-lg h-8 border border-border/40 bg-background/50 text-xs font-mono tabular-nums pr-7"
                            required={draft.included}
                          />
                          {draft.originalScore !== null && draft.score !== draft.originalScore && (
                            <button
                              type="button"
                              title="Revert to current score"
                              onClick={() => {
                                setBureauDrafts(prev => ({
                                  ...prev,
                                  [key]: { ...prev[key], score: draft.originalScore! },
                                }));
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between sm:justify-start gap-2">
                          {rating ? (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold border"
                              style={{
                                color: rating.color,
                                borderColor: `${rating.color}40`,
                                backgroundColor: `${rating.color}15`,
                              }}
                            >
                              {rating.text}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">Enter score</span>
                          )}
                          {draft.originalScore !== null && (
                            <span className="text-[10px] text-muted-foreground">
                              (Current: {draft.originalScore})
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <DialogFooter className="pt-3 gap-2 sm:gap-0">
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsAddCreditScoreOpen(false)}
                className="rounded-lg h-9 px-4 text-xs font-mono border-border/40"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creditBureaus.filter(b => bureauDrafts[b.key as 'experian' | 'transunion' | 'equifax']?.included).length === 0}
                className="rounded-lg h-9 px-4 text-xs font-mono bg-primary text-primary-foreground"
              >
                {(() => {
                  const count = creditBureaus.filter(b => bureauDrafts[b.key as 'experian' | 'transunion' | 'equifax']?.included).length;
                  if (count === 0) return 'Select at least 1 bureau';
                  return `Log ${count} ${count === 1 ? 'Score' : 'Scores'}`;
                })()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {deleteDialog}
    </>
  );
}

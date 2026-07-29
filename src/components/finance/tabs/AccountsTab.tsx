import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BankAccount, Membership, CreditScores, CreditBureauConfig, BureauBand, TrueLayerStatus } from '@/types/finance';
import {
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  Activity,
  Clock,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Award,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatGBP, BUREAU_BANDS, polarToCartesian, describeArc } from '@/components/finance/utils/calculations';

interface AccountsTabProps {
  bankAccounts: BankAccount[];
  onOpenAddAccount: () => void;
  onEditAccount: (account: BankAccount) => void;
  onDeleteAccount: (id: string) => void;

  trueLayerStatus: TrueLayerStatus | null;
  isSyncingTrueLayer: boolean;
  isConnectingTrueLayer: boolean;
  onSyncTrueLayer: () => void;
  onDisconnectTrueLayer: () => void;
  onConnectTrueLayer: () => void;

  memberships: Membership[];
  onOpenAddMembership: () => void;
  onEditMembership: (membership: Membership) => void;
  onDeleteMembership: (id: string) => void;

  creditBureaus: CreditBureauConfig[];
  creditScores: CreditScores;
  onOpenAddCreditScore: () => void;
  onDeleteCreditScore: (bureau: 'experian' | 'transunion' | 'equifax', entryId: string) => void;
  hoveredBands: Record<'experian' | 'transunion' | 'equifax', BureauBand | null>;
  onHoverBand: (bureau: 'experian' | 'transunion' | 'equifax', band: BureauBand | null) => void;
}

export const AccountsTab: React.FC<AccountsTabProps> = ({
  bankAccounts,
  onOpenAddAccount,
  onEditAccount,
  onDeleteAccount,
  trueLayerStatus,
  isSyncingTrueLayer,
  isConnectingTrueLayer,
  onSyncTrueLayer,
  onDisconnectTrueLayer,
  onConnectTrueLayer,
  memberships,
  onOpenAddMembership,
  onEditMembership,
  onDeleteMembership,
  creditBureaus,
  creditScores,
  onOpenAddCreditScore,
  onDeleteCreditScore,
  hoveredBands,
  onHoverBand,
}) => {
  return (
    <div className="space-y-8">
      {/* SECTION A: Bank Accounts */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
          <div className="min-w-0">
            <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary shrink-0" /> Bank Accounts & Credit Cards
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Monitor current balances, card products, and credit accounts</p>
          </div>
          <Button onClick={onOpenAddAccount} className="rounded-xl gap-1.5 bg-primary text-primary-foreground shrink-0 self-start sm:self-auto">
            <Plus className="h-4 w-4" /> Add Account
          </Button>
        </div>

        <div className="overflow-x-auto bg-card/40 border border-primary/10 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-sm -mx-0">
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
                    <span className="w-1.5 h-6 rounded-full shrink-0" style={{ backgroundColor: account.color || '#475569' }} />
                    <span className="text-base shrink-0 leading-none">{account.emoji || '💰'}</span>
                    <span>{account.name}</span>
                  </td>
                  <td className="py-3 px-3 capitalize">{account.type}</td>
                  <td className="py-3 px-3">{account.issuer}</td>
                  <td className={cn('py-3 px-3 text-right font-mono font-bold', account.balance >= 0 ? 'text-fin-positive' : 'text-fin-negative')}>
                    {formatGBP(account.balance)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">{formatGBP(account.annualFee)}</td>
                  <td className="py-3 px-3 text-muted-foreground truncate max-w-[150px]">{account.useCase || '—'}</td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEditAccount(account)}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteAccount(account.id)}
                        className="h-8 w-8 text-fin-negative hover:text-fin-negative"
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
      <div className="bg-card/45 backdrop-blur-md border border-primary/10 rounded-[2rem] p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-serif text-base font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary shrink-0" /> TrueLayer Open Banking
            </h4>
            <p className="text-xs text-muted-foreground">
              Automatically sync card transactions and account balances in sandbox mode.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {trueLayerStatus?.connected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold bg-fin-positive/10 text-fin-positive border border-fin-positive/20">
                <span className="w-1.5 h-1.5 rounded-full bg-fin-positive animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border/40">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                Not Connected
              </span>
            )}
          </div>
        </div>

        <div className="border-t border-border/30 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-xs space-y-1.5 max-w-xl">
            {trueLayerStatus?.connected ? (
              <>
                <p className="text-muted-foreground">
                  Your bank is securely linked. Live synchronization is active and will pull account details and transaction history.
                </p>
                {trueLayerStatus.expires_at && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                    <Clock className="h-3 w-3" />
                    <span>Consent expires on: {new Date(trueLayerStatus.expires_at).toLocaleString()}</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground leading-relaxed">
                Securely connect your UK/EU mock accounts to automatically fetch balances and recent card statements. No financial data is ever shared or exposed publicly.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {trueLayerStatus?.connected ? (
              <>
                <Button
                  onClick={onSyncTrueLayer}
                  disabled={isSyncingTrueLayer}
                  className="rounded-xl bg-primary text-primary-foreground gap-1.5 font-semibold text-xs h-9 px-4"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', isSyncingTrueLayer && 'animate-spin')} />
                  {isSyncingTrueLayer ? 'Syncing...' : 'Sync Now'}
                </Button>
                <Button
                  onClick={onDisconnectTrueLayer}
                  variant="destructive"
                  className="rounded-xl gap-1.5 font-semibold text-xs h-9 px-4 border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-white"
                >
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                onClick={onConnectTrueLayer}
                disabled={isConnectingTrueLayer}
                className="rounded-xl bg-primary text-primary-foreground gap-1.5 font-semibold text-xs h-9 px-4"
              >
                {isConnectingTrueLayer ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Connect Bank Account
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* SECTION B: Memberships & Rewards */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
          <div className="min-w-0">
            <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
              <Award className="h-5 w-5 text-primary shrink-0" /> Memberships & Reward Programs
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Keep track of reward accounts, points programs, and loyalty systems</p>
          </div>
          <Button onClick={onOpenAddMembership} className="rounded-xl gap-1.5 bg-primary text-primary-foreground shrink-0 self-start sm:self-auto">
            <Plus className="h-4 w-4" /> Add Membership
          </Button>
        </div>

        <div className="overflow-x-auto bg-card/40 border border-primary/10 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-sm">
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
                        onClick={() => onEditMembership(membership)}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteMembership(membership.id)}
                        className="h-8 w-8 text-fin-negative hover:text-fin-negative"
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

      {/* SECTION C: Credit Reports */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
          <div className="min-w-0">
            <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary shrink-0" /> Credit Reports
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Track your credit scores across all three bureaus over time</p>
          </div>
          <Button onClick={onOpenAddCreditScore} className="rounded-xl gap-1.5 bg-primary text-primary-foreground shrink-0 self-start sm:self-auto">
            <Plus className="h-4 w-4" /> Log Score
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {creditBureaus.map(bureau => {
            const entries = creditScores[bureau.key];
            const latest = entries.length > 0 ? entries[entries.length - 1] : null;
            const prev = entries.length > 1 ? entries[entries.length - 2] : null;
            const delta = latest && prev ? latest.score - prev.score : 0;

            const getRatingFromBands = (score: number, bureauKey: 'experian' | 'transunion' | 'equifax') => {
              const bands = BUREAU_BANDS[bureauKey];
              const found = bands.find(b => score >= b.min && score <= b.max);
              if (found) {
                let cls = 'text-muted-foreground';
                if (found.color === '#2f9e6e') cls = 'text-fin-positive';
                else if (found.color === '#d99a3d') cls = 'text-fin-warn';
                else if (found.color === '#d1495b') cls = 'text-fin-negative';

                return { text: found.name, cls, color: found.color, band: found };
              }
              return { text: 'Unknown', cls: 'text-muted-foreground', color: '#6b7280', band: null };
            };

            const rating = latest ? getRatingFromBands(latest.score, bureau.key) : null;
            const bands = BUREAU_BANDS[bureau.key];
            const gapAngle = 4;
            const totalSweep = 270;
            const N = bands.length;
            const totalGapAngle = (N - 1) * gapAngle;
            const remainingAngle = totalSweep - totalGapAngle;

            let currentStartAngle = 135;
            const computedSegments = bands.map((band, idx) => {
              const span = band.max - (idx === 0 ? 0 : bands[idx - 1].max);
              const weight = span / bureau.maxScore;
              const segmentAngle = weight * remainingAngle;
              const startAngle = currentStartAngle;
              const endAngle = currentStartAngle + segmentAngle;
              currentStartAngle = endAngle + gapAngle;
              return { band, startAngle, endAngle };
            });

            const scoreAngle = latest ? 135 + (latest.score / bureau.maxScore) * 270 : 135;
            const dotPos = polarToCartesian(72, 72, 54, scoreAngle);

            return (
              <Card key={bureau.key} className={cn('bg-gradient-to-br border border-primary/10 rounded-[2rem] overflow-hidden flex flex-col justify-between shadow-sm', bureau.gradient)}>
                <CardContent className="pt-6 pb-0 px-6 flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-4">{bureau.label}</span>

                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg className="w-36 h-36 overflow-visible" viewBox="0 0 144 144">
                      <defs>
                        <filter id={`shadow-${bureau.key}`} x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodOpacity="0.25" />
                        </filter>
                      </defs>

                      <circle cx="72" cy="72" r="64" stroke="currentColor" className="text-primary/10" strokeWidth="1" fill="transparent" />

                      <path
                        d={describeArc(72, 72, 54, 135, 405)}
                        fill="transparent"
                        stroke="currentColor"
                        className="text-primary/10"
                        strokeWidth="10"
                        strokeLinecap="round"
                      />

                      {computedSegments.map(({ band, startAngle, endAngle }) => {
                        const isHovered = hoveredBands[bureau.key]?.name === band.name;
                        const hasHover = hoveredBands[bureau.key] !== null;

                        let opacity = 1;
                        let strokeWidth = 10;

                        if (hasHover) {
                          opacity = isHovered ? 1 : 0.25;
                          strokeWidth = isHovered ? 12 : 10;
                        } else if (latest) {
                          const isFutureBand = latest.score < band.min;
                          opacity = isFutureBand ? 0.25 : 1;
                        }

                        return (
                          <path
                            key={band.name}
                            d={describeArc(72, 72, 54, startAngle, endAngle)}
                            fill="transparent"
                            stroke={band.color}
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            style={{ opacity, transition: 'all 0.3s ease', cursor: 'pointer' }}
                            onMouseEnter={() => onHoverBand(bureau.key, band)}
                            onMouseLeave={() => onHoverBand(bureau.key, null)}
                          />
                        );
                      })}

                      {latest && (
                        <circle
                          cx={dotPos.x}
                          cy={dotPos.y}
                          r="6"
                          fill="#ffffff"
                          stroke={rating?.color || bureau.color}
                          strokeWidth="2.5"
                          filter={`url(#shadow-${bureau.key})`}
                          style={{ transition: 'all 0.7s ease-out' }}
                        />
                      )}

                      {hoveredBands[bureau.key] ? (
                        <g>
                          <text x="72" y="64" textAnchor="middle" className="font-extrabold text-[12px] uppercase tracking-wider" fill={hoveredBands[bureau.key]?.color}>
                            {hoveredBands[bureau.key]?.name}
                          </text>
                          <text x="72" y="82" textAnchor="middle" className="font-mono font-bold text-[11px]" fill="currentColor">
                            {hoveredBands[bureau.key]?.min} - {hoveredBands[bureau.key]?.max}
                          </text>
                        </g>
                      ) : (
                        <g>
                          <text x="72" y="68" textAnchor="middle" className="font-mono font-extrabold text-3xl" fill={bureau.color}>
                            {latest ? latest.score : '—'}
                          </text>
                          <text x="72" y="84" textAnchor="middle" className="text-[9px] font-medium" fill="currentColor" opacity="0.6">
                            of {bureau.maxScore}
                          </text>
                          {rating && (
                            <text x="72" y="98" textAnchor="middle" className="font-extrabold text-[10px] uppercase tracking-wider" fill={rating.color}>
                              {rating.text}
                            </text>
                          )}
                        </g>
                      )}
                    </svg>
                  </div>

                  <div className="flex items-center gap-3 mt-3 mb-4">
                    {delta !== 0 && (
                      <span className={cn('text-xs font-bold font-mono flex items-center gap-0.5', delta > 0 ? 'text-fin-positive' : 'text-fin-negative')}>
                        {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {delta > 0 ? '+' : ''}{delta}
                      </span>
                    )}
                    {latest && <span className="text-[10px] text-muted-foreground">Last checked: {latest.date}</span>}
                  </div>
                </CardContent>

                <div className="px-6 pb-5 pt-2 border-t border-border/10 min-h-[145px] relative overflow-hidden">
                  <AnimatePresence mode="wait">
                    {hoveredBands[bureau.key] ? (
                      <motion.div
                        key="overlay"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 15 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-x-6 bottom-5 top-2 flex flex-col justify-center bg-background/95 dark:bg-card/95 backdrop-blur-sm z-10"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: hoveredBands[bureau.key]?.color }}>
                            {hoveredBands[bureau.key]?.name}
                          </span>
                          <span className="text-[9px] font-bold font-mono text-muted-foreground bg-primary/5 px-2 py-0.5 rounded-md border border-border/40">
                            {hoveredBands[bureau.key]?.min} - {hoveredBands[bureau.key]?.max}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                          {hoveredBands[bureau.key]?.description}
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="history"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="h-full flex flex-col"
                      >
                        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">History</div>
                        {entries.length > 0 ? (
                          <div className="space-y-1 max-h-[100px] overflow-y-auto pr-1">
                            {[...entries].reverse().map(entry => (
                              <div key={entry.id} className="group flex items-center justify-between py-1 border-b border-border/10 last:border-b-0">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-muted-foreground font-mono w-20">{entry.date}</span>
                                  <span className="text-xs font-mono font-bold" style={{ color: bureau.color }}>{entry.score}</span>
                                </div>
                                <button
                                  onClick={() => onDeleteCreditScore(bureau.key, entry.id)}
                                  className="text-fin-negative hover:text-fin-negative p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground/60 italic flex-1 flex items-center justify-center">
                            No credit history recorded.
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

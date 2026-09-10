import { cn } from '@/lib/utils';

/** A visual meter only: amounts and financial calculations belong to callers. */
export function MetricProgress({ label, value, target, valueText, intent = 'goal', className }: {
  label: string;
  value: number;
  target: number;
  valueText: string;
  intent?: 'goal' | 'budget' | 'repayment';
  className?: string;
}) {
  const hasTarget = Number.isFinite(target) && target > 0;
  const safeValue = Number.isFinite(value) ? value : 0;
  const percent = hasTarget ? Math.max(0, Math.min(100, safeValue / target * 100)) : 0;
  const over = intent === 'budget' && safeValue > Math.max(0, target);
  const complete = (intent === 'goal' && hasTarget && safeValue >= target) || (intent === 'repayment' && safeValue <= 0);
  const state = intent === 'repayment' ? (complete ? 'Repaid' : 'Outstanding balance') : over ? 'Over budget' : !hasTarget ? 'No target set' : complete ? 'Completed' : safeValue <= 0 ? 'Not started' : intent === 'budget' ? 'Within budget' : 'In progress';
  return (
    <div className={cn('metric-progress space-y-2 min-w-0', className)} data-state={state}>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground">{valueText}</span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${valueText}. ${state}`} className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', over ? 'bg-destructive' : complete ? 'bg-positive' : 'bg-primary')} style={{ width: `${percent}%` }} />
      </div>
      <p className={cn('text-xs', over ? 'text-destructive' : complete ? 'text-positive' : 'text-muted-foreground')}>{state}</p>
    </div>
  );
}

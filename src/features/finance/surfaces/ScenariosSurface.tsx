/**
 * "What happens if I do X?" — the question the product is organised around.
 *
 * The arithmetic is `runSpendScenario` in lib/finance: pure, deterministic and
 * tested. Nothing is computed here. This shows the result, the assumptions it
 * rests on, and what could be done instead — which is the shape the spec asks
 * of any recommendation (REHAUL_PLAN.md 7.D, 7.5).
 */

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatGBP } from '@/features/finance/utils/calculations';
import { executeTool, type Verdict } from '@/lib/finance';
import { useScenarioState } from '../useScenarioState';
import { useFinanceToolContext } from '../useFinanceToolContext';

const VERDICT: Record<Verdict, { title: string; tone: string; blurb: string }> = {
  comfortable: {
    title: 'Comfortably affordable',
    tone: 'text-positive',
    blurb: 'This fits inside what is left of the month.',
  },
  tight: {
    title: 'Affordable, but tight',
    tone: 'text-chart-4',
    blurb: 'It fits, with little room before payday.',
  },
  over_budget: {
    title: 'Puts the month over',
    tone: 'text-chart-4',
    blurb: 'The cash is there, but this takes the month past what was left.',
  },
  breaks_emergency_fund: {
    title: 'Eats into the emergency fund',
    tone: 'text-destructive',
    blurb: 'Affordable only by dipping below what the emergency fund is meant to hold.',
  },
  unaffordable: {
    title: 'Not affordable now',
    tone: 'text-destructive',
    blurb: 'More than the cash currently available.',
  },
};

export default function ScenariosSurface() {
  const [raw, setRaw] = useState('');
  const { assumptions } = useScenarioState();
  const toolContext = useFinanceToolContext();

  const amount = Number.parseFloat(raw.replace(/[^0-9.]/g, ''));
  const hasAmount = Number.isFinite(amount) && amount > 0;

  // Deliberately routed through executeTool rather than calling the engine
  // directly. The assistant in 7.6 will call the same tool with the same
  // context, so the path it takes is the one this screen exercises every time
  // it is used -- rather than a second, quieter path that only a model walks.
  const result = useMemo(() => {
    if (!hasAmount) return null;
    const r = executeTool('run_spend_scenario', { amount }, toolContext);
    return r.tool === 'run_spend_scenario' && 'data' in r ? r.data : null;
  }, [hasAmount, amount, toolContext]);

  const delayed = result?.goalImpacts.filter(g => g.monthsDelayed && g.monthsDelayed > 0) ?? [];

  return (
    <div className="flex flex-col gap-8">
      {/* The whole block is the label, so clicking the caption or the £ focuses
          the field rather than only the thin strip of input beside them. The
          rule lives on the wrapper: putting `border-0 border-b` on the Input
          fought the component's own `border`, and which won depended on
          stylesheet order -- an underline when idle, a full box when focused. */}
      <label htmlFor="scenario-amount" className="block max-w-md cursor-text space-y-2">
        <span className="block font-sans text-xs text-muted-foreground">
          What happens if I spend
        </span>
        <span className="flex items-baseline gap-2 border-b border-border/60 transition-colors focus-within:border-foreground">
          <span aria-hidden className="font-sans text-2xl text-muted-foreground">£</span>
          <Input
            id="scenario-amount"
            inputMode="decimal"
            placeholder="800"
            value={raw}
            onChange={e => setRaw(e.target.value)}
            aria-label="Amount to spend in pounds"
            className="h-12 flex-1 rounded-none border-0 bg-transparent px-0 font-sans text-3xl font-bold tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </span>
      </label>

      {!result ? (
        <p className="font-sans text-sm text-muted-foreground">
          Enter an amount to see what it does to this month, your reserves and your goals.
        </p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          <section className="space-y-2 lg:col-span-2">
            <p className={cn('font-sans text-2xl font-bold', VERDICT[result.verdict].tone)}>
              {VERDICT[result.verdict].title}
            </p>
            <p className="font-sans text-sm text-muted-foreground">{VERDICT[result.verdict].blurb}</p>

            <dl className="grid gap-x-8 gap-y-4 pt-4 sm:grid-cols-2">
              <div>
                <dt className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Left this month after</dt>
                <dd className={cn('font-sans text-xl font-bold tabular-nums',
                  result.freeToSpendAfter < 0 ? 'text-destructive' : 'text-foreground')}>
                  {formatGBP(result.freeToSpendAfter)}
                </dd>
                <p className="font-sans text-xs text-muted-foreground">
                  {formatGBP(result.dailyAllowanceAfter)} a day for the rest of the month
                </p>
              </div>
              <div>
                <dt className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Cash after</dt>
                <dd className="font-sans text-xl font-bold tabular-nums text-foreground">
                  {formatGBP(result.liquidAfter)}
                </dd>
                {result.emergencyShortfall > 0 ? (
                  <p className="font-sans text-xs text-destructive">
                    {formatGBP(result.emergencyShortfall)} below the emergency fund target
                  </p>
                ) : null}
              </div>
            </dl>

            {delayed.length > 0 ? (
              <div className="pt-4">
                <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Goals pushed back</p>
                <ul className="pt-1">
                  {delayed.map(g => (
                    <li key={g.id} className="font-sans text-sm text-foreground">
                      {g.name} — {g.monthsDelayed} {g.monthsDelayed === 1 ? 'month' : 'months'}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="pt-4">
              <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Instead</p>
              <ul className="pt-1 font-sans text-sm text-foreground">
                {result.maxComfortable > 0 && result.verdict !== 'comfortable' ? (
                  <li>{formatGBP(result.maxComfortable)} would stay comfortable.</li>
                ) : null}
                {result.monthsToSaveInstead === null ? (
                  <li>There is no monthly surplus to save this from at the moment.</li>
                ) : result.monthsToSaveInstead > 0 ? (
                  <li>
                    Saving instead would cover it in {result.monthsToSaveInstead}{' '}
                    {result.monthsToSaveInstead === 1 ? 'month' : 'months'}.
                  </li>
                ) : (
                  <li>The cash for this is already available.</li>
                )}
              </ul>
            </div>
          </section>

          {/* Every figure above rests on these, and two of them are inferred
              rather than set, so they are stated rather than hidden. */}
          <section className="space-y-3 border-t border-border/40 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <p className="font-sans text-xs uppercase tracking-wider text-muted-foreground">Assumptions</p>
            {assumptions.map(a => (
              <div key={a.label}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-sans text-sm text-muted-foreground">{a.label}</span>
                  <span className="font-sans text-sm font-bold tabular-nums text-foreground">{a.value}</span>
                </div>
                {a.note ? <p className="font-sans text-xs text-muted-foreground">{a.note}</p> : null}
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}

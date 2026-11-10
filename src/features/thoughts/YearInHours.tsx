import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Clock } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import {
  DEFAULT_YEAR_HOURS_INPUT,
  HOURS_IN_YEAR,
  yearHours,
  type YearActivityKey,
  type YearHoursInput,
} from '@/lib/year-hours';

/** Whole hours with a thousands separator: 8,760. */
const wholeHours = (hours: number) => Math.round(hours).toLocaleString('en-GB');

const ACTIVITY: Record<YearActivityKey, { label: string; color: string; emoji: string }> = {
  sleep: { label: 'Sleep', color: 'hsl(var(--chart-3))', emoji: '😴' },
  work: { label: 'Work', color: 'hsl(var(--chart-2))', emoji: '💼' },
  free: { label: 'Free time', color: 'hsl(var(--chart-1))', emoji: '🌴' },
  friends: { label: 'Socialising', color: 'hsl(var(--chart-5))', emoji: '🥳' },
  gettingReady: { label: 'Getting ready', color: 'hsl(var(--muted-foreground))', emoji: '🧼' },
  gym: { label: 'Gym', color: 'hsl(var(--positive))', emoji: '🏋️' },
  commute: { label: 'Commute', color: 'hsl(var(--secondary-foreground))', emoji: '🚗' },
  learning: { label: 'Learning', color: 'hsl(var(--chart-4))', emoji: '📚' },
};

const TABLE_ORDER: YearActivityKey[] = [
  'sleep',
  'work',
  'commute',
  'gettingReady',
  'gym',
  'learning',
  'friends',
  'free',
];
const OPTIONAL_ROWS: YearActivityKey[] = ['commute', 'gym', 'learning', 'friends'];

interface SliderRowProps {
  label: string;
  emoji?: string;
  display: string;
  value: number;
  min: number;
  max: number;
  step: number;
  nested?: boolean;
  onChange: (value: number) => void;
}

function SliderRow({ label, emoji, display, value, min, max, step, nested, onChange }: SliderRowProps) {
  return (
    <div className={nested ? 'space-y-2 pl-3 border-l-2 border-border/40' : 'space-y-2'}>
      <div className="flex justify-between items-center text-xs font-mono">
        <span className="text-muted-foreground flex items-center gap-1.5">
          {emoji && <span>{emoji}</span>} <span className="text-foreground font-medium">{label}</span>
        </span>
        <span className="text-foreground font-semibold tabular-nums">{display}</span>
      </div>
      <Slider
        aria-label={label}
        value={[value]}
        onValueChange={(val) => onChange(val[0])}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}

export function YearInHours() {
  const [input, setInput] = useState<YearHoursInput>(DEFAULT_YEAR_HOURS_INPUT);
  const result = useMemo(() => yearHours(input), [input]);

  const set = (key: keyof YearHoursInput) => (value: number) =>
    setInput((prev) => {
      const next = { ...prev, [key]: value };
      // The hours sliders appear only once there are days to spend them on,
      // and start at half an hour. Give them a value to match, or the thumb
      // would sit at 0.5 while the sums used 0.
      if (key === 'commuteDaysPerWeek' && value > 0 && prev.commuteHoursPerDay === 0) {
        next.commuteHoursPerDay = 1;
      }
      if (key === 'gymDaysPerWeek' && value > 0 && prev.gymHoursPerSession === 0) {
        next.gymHoursPerSession = 1;
      }
      return next;
    });

  const byKey = (key: YearActivityKey) => {
    const found = result.activities.find((a) => a.key === key);
    if (!found) throw new Error(`Missing activity ${key}`);
    return found;
  };
  const free = byKey('free');
  const sleep = byKey('sleep');
  const work = byKey('work');
  const other = result.activities.filter((a) => a.key !== 'free' && a.key !== 'sleep' && a.key !== 'work');
  const otherHours = other.reduce((sum, a) => sum + a.hoursPerYear, 0);
  const otherShare = other.reduce((sum, a) => sum + a.share, 0);

  const timeData = result.activities
    .filter((a) => a.hoursPerYear > 0)
    .map((a) => ({
      name: ACTIVITY[a.key].label,
      value: a.hoursPerYear,
      pct: a.share * 100,
      color: ACTIVITY[a.key].color,
      emoji: ACTIVITY[a.key].emoji,
    }));

  const dailyBreakdown = result.activities.filter((a) => a.hoursPerDay > 0);
  const totalDailyHours = dailyBreakdown.reduce((sum, a) => sum + a.hoursPerDay, 0);

  const tableRows = TABLE_ORDER.map((key) => byKey(key)).filter(
    (a) => !OPTIONAL_ROWS.includes(a.key) || a.hoursPerYear > 0,
  );
  const totalYearly = tableRows.reduce((sum, a) => sum + a.hoursPerYear, 0);
  const totalShare = tableRows.reduce((sum, a) => sum + a.share, 0);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
        <div className="min-w-0">
          <h3 className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary shrink-0" /> A year in hours
          </h3>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            A year has {wholeHours(HOURS_IN_YEAR)} hours. Move the sliders to see where yours go.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setInput(DEFAULT_YEAR_HOURS_INPUT)}
          className="rounded-lg h-8 px-3 gap-1.5 shrink-0 self-start sm:self-auto text-xs font-mono border-border/40"
        >
          Reset
        </Button>
      </div>

      {result.overAllocatedHours > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 text-xs font-mono flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>
            You have entered {wholeHours(result.allocatedHours)} hours, {wholeHours(result.overAllocatedHours)} more than a
            year holds. Lower something.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Sliders */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <Card className="bg-card/50 border border-border/40 rounded-lg hover:border-border/80 transition-colors shadow-none">
            <CardHeader className="pb-4">
              <CardTitle className="text-xs font-mono uppercase tracking-wider font-semibold">Your routine</CardTitle>
              <CardDescription className="text-xs font-mono text-muted-foreground">
                Drag sliders to describe your typical daily and weekly routine.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <SliderRow
                label="Sleep"
                emoji="😴"
                display={`${input.sleepHoursPerDay} hrs / day`}
                value={input.sleepHoursPerDay}
                min={0}
                max={24}
                step={0.5}
                onChange={set('sleepHoursPerDay')}
              />
              <SliderRow
                label="Getting ready"
                emoji="🧼"
                display={`${input.gettingReadyHoursPerDay} hrs / day`}
                value={input.gettingReadyHoursPerDay}
                min={0}
                max={12}
                step={0.5}
                onChange={set('gettingReadyHoursPerDay')}
              />

              <div className="h-px bg-border/40" />

              <SliderRow
                label="Commute days"
                emoji="🚗"
                display={`${input.commuteDaysPerWeek} days / week`}
                value={input.commuteDaysPerWeek}
                min={0}
                max={7}
                step={1}
                onChange={set('commuteDaysPerWeek')}
              />
              {input.commuteDaysPerWeek > 0 && (
                <SliderRow
                  nested
                  label="Round trip"
                  display={`${input.commuteHoursPerDay} hrs / active day`}
                  value={input.commuteHoursPerDay}
                  min={0.5}
                  max={12}
                  step={0.5}
                  onChange={set('commuteHoursPerDay')}
                />
              )}

              <div className="h-px bg-border/40" />

              <SliderRow
                label="Gym days"
                emoji="🏋️"
                display={`${input.gymDaysPerWeek} days / week`}
                value={input.gymDaysPerWeek}
                min={0}
                max={7}
                step={1}
                onChange={set('gymDaysPerWeek')}
              />
              {input.gymDaysPerWeek > 0 && (
                <SliderRow
                  nested
                  label="Session length"
                  display={`${input.gymHoursPerSession} hrs / session`}
                  value={input.gymHoursPerSession}
                  min={0.5}
                  max={6}
                  step={0.5}
                  onChange={set('gymHoursPerSession')}
                />
              )}

              <div className="h-px bg-border/40" />

              <SliderRow
                label="Learning"
                emoji="📚"
                display={`${input.learningHoursPerWeek} hrs / week`}
                value={input.learningHoursPerWeek}
                min={0}
                max={80}
                step={1}
                onChange={set('learningHoursPerWeek')}
              />
              <SliderRow
                label="Friends"
                emoji="🥳"
                display={`${input.friendsHoursPerWeek} hrs / week`}
                value={input.friendsHoursPerWeek}
                min={0}
                max={80}
                step={1}
                onChange={set('friendsHoursPerWeek')}
              />
            </CardContent>
          </Card>

          <Card className="bg-card/50 border border-border/40 rounded-lg hover:border-border/80 transition-colors shadow-none">
            <CardHeader className="pb-4">
              <CardTitle className="text-xs font-mono uppercase tracking-wider font-semibold">Working year</CardTitle>
              <CardDescription className="text-xs font-mono text-muted-foreground">
                Set the days you do not work and how long a working day lasts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <SliderRow
                label="Weekend days a year"
                display={`${input.weekendDays} days`}
                value={input.weekendDays}
                min={0}
                max={156}
                step={1}
                onChange={set('weekendDays')}
              />
              <SliderRow
                label="Bank holidays"
                display={`${input.bankHolidays} days`}
                value={input.bankHolidays}
                min={0}
                max={20}
                step={1}
                onChange={set('bankHolidays')}
              />
              <SliderRow
                label="Leave days"
                display={`${input.leaveDays} days`}
                value={input.leaveDays}
                min={0}
                max={60}
                step={1}
                onChange={set('leaveDays')}
              />
              <SliderRow
                label="Working hours a day"
                display={`${input.workingHoursPerDay} hrs / day`}
                value={input.workingHoursPerDay}
                min={0}
                max={14}
                step={0.5}
                onChange={set('workingHoursPerDay')}
              />
              <p className="text-xs font-mono text-muted-foreground tabular-nums">
                {result.workDays} working days a year
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Visualization & Table */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <Card className="bg-card/50 border border-border/40 rounded-lg p-4 sm:p-6 space-y-6 hover:border-border/80 transition-colors shadow-none">
            <div className="flex flex-col md:flex-row items-center justify-around gap-6">
              {/* Donut Chart */}
              <div className="w-44 h-44 flex items-center justify-center relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={timeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={68}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="hsl(var(--card))"
                      strokeWidth={1.5}
                    >
                      {timeData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover text-popover-foreground border border-border/40 rounded-lg p-2.5 shadow-md font-mono text-xs space-y-1">
                              <div className="font-bold flex items-center gap-1.5">
                                <span>{data.emoji}</span>
                                <span>{data.name}</span>
                              </div>
                              <div className="text-muted-foreground">
                                <span className="text-foreground font-semibold tabular-nums">{Number(data.value).toFixed(0)} hrs</span> ({Number(data.pct).toFixed(1)}%)
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  <span className="font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {wholeHours(result.overAllocatedHours > 0 ? result.allocatedHours : HOURS_IN_YEAR)}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono font-semibold">{result.overAllocatedHours > 0 ? 'hours entered' : 'hours in a year'}</span>
                </div>
              </div>

              {/* Top Highlights */}
              <div className="flex-1 space-y-4 w-full">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-card/40 border border-border/40 rounded-lg p-3.5 text-center space-y-1">
                    <span className="text-xs font-mono text-muted-foreground flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--chart-1))]" /> Free time
                    </span>
                    <span className="font-mono text-xl font-bold tracking-tight text-foreground block tabular-nums">
                      {free.hoursPerYear.toFixed(0)} hrs
                    </span>
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">{(free.share * 100).toFixed(1)}% of year</span>
                  </div>
                  <div className="bg-card/40 border border-border/40 rounded-lg p-3.5 text-center space-y-1">
                    <span className="text-xs font-mono text-muted-foreground flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--chart-3))]" /> Sleep
                    </span>
                    <span className="font-mono text-xl font-bold tracking-tight text-foreground block tabular-nums">
                      {sleep.hoursPerYear.toFixed(0)} hrs
                    </span>
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">{(sleep.share * 100).toFixed(1)}% of year</span>
                  </div>
                  <div className="bg-card/40 border border-border/40 rounded-lg p-3.5 text-center space-y-1">
                    <span className="text-xs font-mono text-muted-foreground flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--chart-2))]" /> Work
                    </span>
                    <span className="font-mono text-xl font-bold tracking-tight text-foreground block tabular-nums">
                      {work.hoursPerYear.toFixed(0)} hrs
                    </span>
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">{(work.share * 100).toFixed(1)}% of year</span>
                  </div>
                  <div className="bg-card/40 border border-border/40 rounded-lg p-3.5 text-center space-y-1">
                    <span className="text-xs font-mono text-muted-foreground flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /> Everything else
                    </span>
                    <span className="font-mono text-xl font-bold tracking-tight text-foreground block tabular-nums">
                      {otherHours.toFixed(0)} hrs
                    </span>
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">
                      {(otherShare * 100).toFixed(1)}% of year
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 24h Day Timeline Bar */}
            <div className="border-t border-border/40 pt-5 space-y-3">
              <div className="flex justify-between items-center text-xs font-mono font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5 text-primary" /> An average day
                </span>
                <span className="tabular-nums">{totalDailyHours.toFixed(1)} hrs accounted for</span>
              </div>

              <div className="w-full h-3 rounded-full overflow-hidden flex bg-muted/20 border border-border/30 gap-0.5 p-0.5">
                {dailyBreakdown.map((item) => {
                  const pct = (item.hoursPerDay / totalDailyHours) * 100;
                  const meta = ACTIVITY[item.key];
                  return (
                    <TooltipProvider key={item.key}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            style={{ width: `${pct}%`, backgroundColor: meta.color }}
                            className="h-full rounded-full transition-all hover:opacity-80 cursor-pointer"
                          />
                        </TooltipTrigger>
                        <TooltipContent className="bg-popover text-popover-foreground border border-border/40 rounded-lg p-2.5 shadow-md font-mono text-xs">
                          <div className="font-bold flex items-center gap-1.5 mb-1">
                            <span>{meta.emoji}</span>
                            <span>{meta.label}</span>
                          </div>
                          <div className="space-y-0.5 text-muted-foreground text-xs">
                            <p>Daily: <span className="text-foreground font-semibold tabular-nums">{item.hoursPerDay.toFixed(1)} hrs</span></p>
                            <p>Weekly: <span className="text-foreground font-semibold tabular-nums">{(item.hoursPerDay * 7).toFixed(1)} hrs</span></p>
                            <p>Yearly: <span className="text-foreground font-semibold tabular-nums">{item.hoursPerYear.toFixed(0)} hrs</span></p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                {dailyBreakdown.map((item) => (
                  <div key={item.key} className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ACTIVITY[item.key].color }} />
                    <span className="text-foreground font-medium">{ACTIVITY[item.key].label}</span>
                    <span className="text-muted-foreground/70 tabular-nums">({item.hoursPerDay.toFixed(1)}h)</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Detailed Statistics Table */}
          <Card className="bg-card/50 border border-border/40 rounded-lg p-4 sm:p-6 hover:border-border/80 transition-colors shadow-none font-mono">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-foreground mb-4 flex items-center gap-1.5">
              The full breakdown
            </h4>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-xs text-left border-collapse font-mono">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground font-semibold text-xs">
                    <th className="py-2.5 px-3">Activity</th>
                    <th className="py-2.5 px-3 text-right">A day</th>
                    <th className="py-2.5 px-3 text-right">A week</th>
                    <th className="py-2.5 px-3 text-right">A year</th>
                    <th className="py-2.5 px-3 text-right">% of Year</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20 text-foreground font-medium">
                  {tableRows.map((row) => {
                    const meta = ACTIVITY[row.key];
                    return (
                      <tr key={row.key} className="hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 px-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                          <span>{meta.emoji} {meta.label}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{row.hoursPerDay.toFixed(1)} hrs</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{(row.hoursPerDay * 7).toFixed(1)} hrs</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{row.hoursPerYear.toFixed(0)} hrs</td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{(row.share * 100).toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                  <tr className="font-bold border-t border-border/60 bg-muted/15 font-mono">
                    <td className="py-3 px-3">Total</td>
                    <td className="py-3 px-3 text-right tabular-nums">{totalDailyHours.toFixed(1)} hrs/d</td>
                    <td className="py-3 px-3 text-right tabular-nums">{(totalDailyHours * 7).toFixed(1)} hrs/w</td>
                    <td className="py-3 px-3 text-right tabular-nums">{totalYearly.toFixed(0)} hrs</td>
                    <td className="py-3 px-3 text-right tabular-nums">{(totalShare * 100).toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

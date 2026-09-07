import React from 'react';
import { FinanceSettings, TimeSpentInputs } from '@/features/finance/finance-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Clock, Settings } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';

interface TimeSpentTabProps {
  settings: FinanceSettings;
  timeSpentInputs: TimeSpentInputs;
  setTimeSpentInputs: React.Dispatch<React.SetStateAction<TimeSpentInputs>>;
  onOpenSettings: () => void;
}

export const TimeSpentTab: React.FC<TimeSpentTabProps> = ({
  settings,
  timeSpentInputs,
  setTimeSpentInputs,
  onOpenSettings,
}) => {
  const DAYS_IN_YEAR = 365;
  const HOURS_IN_DAY = 24;
  const TOTAL_HOURS_YEAR = DAYS_IN_YEAR * HOURS_IN_DAY;

  // Work calculations from settings
  const days_of_work_nominal = 365 - settings.weekends;
  const holidays_and_bank_holidays = settings.bankHolidays + settings.workHolidays;
  const days_of_work_actual = days_of_work_nominal - holidays_and_bank_holidays;
  const hours_of_work_per_day = settings.workingHoursPerDay;
  const hours_work_actual_year = days_of_work_actual * hours_of_work_per_day;

  // Inputs
  const {
    sleepHoursPerDay,
    commuteDaysPerWeek,
    commuteHoursPerDay,
    gettingReadyHoursPerDay,
    gymDaysPerWeek,
    gymHoursPerSession,
    learningHoursPerWeek,
    friendsHoursPerWeek,
  } = timeSpentInputs;

  // Sleep
  const hours_sleep_year = sleepHoursPerDay * DAYS_IN_YEAR;

  // Commute
  const weeks_per_year = DAYS_IN_YEAR / 7;
  const hours_commute_year = commuteDaysPerWeek * commuteHoursPerDay * weeks_per_year;

  // Getting Ready
  const hours_ready_year = gettingReadyHoursPerDay * DAYS_IN_YEAR;

  // Wellness / Gym
  const hours_gym_year = gymDaysPerWeek * gymHoursPerSession * weeks_per_year;

  // Learning & Friends
  const hours_learning_year = learningHoursPerWeek * weeks_per_year;
  const hours_friends_year = friendsHoursPerWeek * weeks_per_year;

  // Relaxing / Free time (Remainder)
  const tracked_hours = (
    hours_work_actual_year +
    hours_sleep_year +
    hours_commute_year +
    hours_ready_year +
    hours_gym_year +
    hours_learning_year +
    hours_friends_year
  );
  const hours_relaxing_year = Math.max(0.0, TOTAL_HOURS_YEAR - tracked_hours);
  const trackedExceedsTotal = tracked_hours > TOTAL_HOURS_YEAR;

  // Percentages
  const pct_hours_work = (hours_work_actual_year / TOTAL_HOURS_YEAR) * 100;
  const pct_sleep = (hours_sleep_year / TOTAL_HOURS_YEAR) * 100;
  const pct_commute = (hours_commute_year / TOTAL_HOURS_YEAR) * 100;
  const pct_ready = (hours_ready_year / TOTAL_HOURS_YEAR) * 100;
  const pct_gym = (hours_gym_year / TOTAL_HOURS_YEAR) * 100;
  const pct_learning = (hours_learning_year / TOTAL_HOURS_YEAR) * 100;
  const pct_friends = (hours_friends_year / TOTAL_HOURS_YEAR) * 100;
  const pct_relaxing = (hours_relaxing_year / TOTAL_HOURS_YEAR) * 100;

  const timeData = [
    { name: 'Sleep', value: hours_sleep_year, pct: pct_sleep, color: 'hsl(var(--chart-3))', emoji: '😴' },
    { name: 'Work', value: hours_work_actual_year, pct: pct_hours_work, color: 'hsl(var(--chart-2))', emoji: '💼' },
    { name: 'Relaxing / Free', value: hours_relaxing_year, pct: pct_relaxing, color: 'hsl(var(--chart-1))', emoji: '🌴' },
    { name: 'Socializing', value: hours_friends_year, pct: pct_friends, color: 'hsl(var(--chart-5))', emoji: '🥳' },
    { name: 'Getting Ready', value: hours_ready_year, pct: pct_ready, color: 'hsl(var(--muted-foreground))', emoji: '🧼' },
    { name: 'Wellness / Gym', value: hours_gym_year, pct: pct_gym, color: 'hsl(var(--positive))', emoji: '🏋️' },
    { name: 'Commute', value: hours_commute_year, pct: pct_commute, color: 'hsl(var(--secondary-foreground))', emoji: '🚗' },
    { name: 'Learning', value: hours_learning_year, pct: pct_learning, color: 'hsl(var(--chart-4))', emoji: '📚' },
  ].filter(d => d.value > 0);

  const dailyBreakdown = [
    { name: 'Sleep', hours: sleepHoursPerDay, color: 'hsl(var(--chart-3))', emoji: '😴' },
    { name: 'Work', hours: hours_work_actual_year / 365, color: 'hsl(var(--chart-2))', emoji: '💼' },
    { name: 'Commute', hours: hours_commute_year / 365, color: 'hsl(var(--secondary-foreground))', emoji: '🚗' },
    { name: 'Getting Ready', hours: gettingReadyHoursPerDay, color: 'hsl(var(--muted-foreground))', emoji: '🧼' },
    { name: 'Wellness / Gym', hours: hours_gym_year / 365, color: 'hsl(var(--positive))', emoji: '🏋️' },
    { name: 'Learning', hours: hours_learning_year / 365, color: 'hsl(var(--chart-4))', emoji: '📚' },
    { name: 'Socializing', hours: hours_friends_year / 365, color: 'hsl(var(--chart-5))', emoji: '🥳' },
    { name: 'Relaxing', hours: hours_relaxing_year / 365, color: 'hsl(var(--chart-1))', emoji: '🌴' },
  ].filter(d => d.hours > 0);

  const totalDailyHours = dailyBreakdown.reduce((sum, d) => sum + d.hours, 0);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
        <div className="min-w-0">
          <h3 className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary shrink-0" /> Time Management & Life Calendar
          </h3>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            Analyze how your 8,760 yearly hours are allocated across routine, work, and free time
          </p>
        </div>
        <Button
          variant="outline"
          onClick={onOpenSettings}
          className="rounded-lg h-8 px-3 gap-1.5 shrink-0 self-start sm:self-auto text-xs font-mono border-border/40"
        >
          <Settings className="h-3.5 w-3.5" /> Work Settings
        </Button>
      </div>

      {trackedExceedsTotal && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 text-xs font-mono flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold mb-0.5">Over-allocated Schedule</p>
            <p>
              Your total allocated time ({tracked_hours.toFixed(0)} hrs) exceeds the total available hours in a year (8,760 hrs) by {(tracked_hours - TOTAL_HOURS_YEAR).toFixed(0)} hours.
              Consider reducing some values to make your schedule realistic.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Sliders */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <Card className="bg-card/50 border border-border/40 rounded-xl hover:border-border/80 transition-colors shadow-none">
            <CardHeader className="pb-4">
              <CardTitle className="text-xs font-mono uppercase tracking-wider font-semibold">Lifestyle Parameters</CardTitle>
              <CardDescription className="text-xs font-mono text-muted-foreground">
                Drag sliders to customize your typical daily/weekly time spending patterns.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Sleep Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span>😴</span> <span className="text-foreground font-medium">Sleep</span>
                  </span>
                  <span className="text-foreground font-semibold tabular-nums">{sleepHoursPerDay} hrs / day</span>
                </div>
                <Slider
                  value={[sleepHoursPerDay]}
                  onValueChange={(val) => setTimeSpentInputs(prev => ({ ...prev, sleepHoursPerDay: val[0] }))}
                  min={0}
                  max={24}
                  step={0.5}
                />
              </div>

              {/* Getting Ready / Routine */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span>🧼</span> <span className="text-foreground font-medium">Getting Ready / Routine</span>
                  </span>
                  <span className="text-foreground font-semibold tabular-nums">{gettingReadyHoursPerDay} hrs / day</span>
                </div>
                <Slider
                  value={[gettingReadyHoursPerDay]}
                  onValueChange={(val) => setTimeSpentInputs(prev => ({ ...prev, gettingReadyHoursPerDay: val[0] }))}
                  min={0}
                  max={12}
                  step={0.5}
                />
              </div>

              <div className="h-px bg-border/40" />

              {/* Commute Days */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span>🚗</span> <span className="text-foreground font-medium">Commute Frequency</span>
                  </span>
                  <span className="text-foreground font-semibold tabular-nums">{commuteDaysPerWeek} days / week</span>
                </div>
                <Slider
                  value={[commuteDaysPerWeek]}
                  onValueChange={(val) => setTimeSpentInputs(prev => ({ ...prev, commuteDaysPerWeek: val[0] }))}
                  min={0}
                  max={7}
                  step={1}
                />
              </div>

              {/* Commute Hours */}
              {commuteDaysPerWeek > 0 && (
                <div className="space-y-2 pl-3 border-l-2 border-border/40">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-muted-foreground">Round Trip Commute</span>
                    <span className="text-foreground font-semibold tabular-nums">{commuteHoursPerDay} hrs / active day</span>
                  </div>
                  <Slider
                    value={[commuteHoursPerDay]}
                    onValueChange={(val) => setTimeSpentInputs(prev => ({ ...prev, commuteHoursPerDay: val[0] }))}
                    min={0.5}
                    max={12}
                    step={0.5}
                  />
                </div>
              )}

              <div className="h-px bg-border/40" />

              {/* Gym Days */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span>🏋️</span> <span className="text-foreground font-medium">Wellness / Gym Frequency</span>
                  </span>
                  <span className="text-foreground font-semibold tabular-nums">{gymDaysPerWeek} days / week</span>
                </div>
                <Slider
                  value={[gymDaysPerWeek]}
                  onValueChange={(val) => setTimeSpentInputs(prev => ({ ...prev, gymDaysPerWeek: val[0] }))}
                  min={0}
                  max={7}
                  step={1}
                />
              </div>

              {/* Gym Hours */}
              {gymDaysPerWeek > 0 && (
                <div className="space-y-2 pl-3 border-l-2 border-border/40">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-muted-foreground">Session Duration</span>
                    <span className="text-foreground font-semibold tabular-nums">{gymHoursPerSession} hrs / session</span>
                  </div>
                  <Slider
                    value={[gymHoursPerSession]}
                    onValueChange={(val) => setTimeSpentInputs(prev => ({ ...prev, gymHoursPerSession: val[0] }))}
                    min={0.5}
                    max={6}
                    step={0.5}
                  />
                </div>
              )}

              <div className="h-px bg-border/40" />

              {/* Learning Hours */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span>📚</span> <span className="text-foreground font-medium">Learning / Upskilling</span>
                  </span>
                  <span className="text-foreground font-semibold tabular-nums">{learningHoursPerWeek} hrs / week</span>
                </div>
                <Slider
                  value={[learningHoursPerWeek]}
                  onValueChange={(val) => setTimeSpentInputs(prev => ({ ...prev, learningHoursPerWeek: val[0] }))}
                  min={0}
                  max={80}
                  step={1}
                />
              </div>

              {/* Friends Hours */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span>🥳</span> <span className="text-foreground font-medium">Friends & Socializing</span>
                  </span>
                  <span className="text-foreground font-semibold tabular-nums">{friendsHoursPerWeek} hrs / week</span>
                </div>
                <Slider
                  value={[friendsHoursPerWeek]}
                  onValueChange={(val) => setTimeSpentInputs(prev => ({ ...prev, friendsHoursPerWeek: val[0] }))}
                  min={0}
                  max={80}
                  step={1}
                />
              </div>
            </CardContent>
          </Card>

          {/* Linked settings card */}
          <Card className="bg-card/40 border border-border/40 rounded-xl p-4 text-xs font-mono space-y-2.5 shadow-none">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <span>💼</span> Inherited Work Profile
            </div>
            <p className="text-muted-foreground leading-relaxed text-[11px]">
              Work days and hours are synced from your Tax & Income configuration:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-muted/15 rounded-lg p-2.5 border border-border/30">
              <div>Working Hours: <span className="text-foreground font-bold tabular-nums">{hours_of_work_per_day}h/day</span></div>
              <div>Work Days: <span className="text-foreground font-bold tabular-nums">{days_of_work_actual} days/yr</span></div>
              <div className="col-span-2 pt-1.5 border-t border-border/30 mt-0.5">
                Nominal Work Days: <span className="text-foreground font-bold tabular-nums">{days_of_work_nominal} days/yr</span>
              </div>
              <div className="col-span-2">
                Holidays & Public: <span className="text-foreground font-bold tabular-nums">{holidays_and_bank_holidays} days/yr</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Adjust these parameters in <strong>Work Settings</strong> (top right).
            </p>
          </Card>
        </div>

        {/* Right Column: Visualization & Table */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Visual Charts Card */}
          <Card className="bg-card/50 border border-border/40 rounded-xl p-4 sm:p-6 space-y-6 hover:border-border/80 transition-colors shadow-none">
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
                      {timeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
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
                {/* Inner Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  <span className="font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums">8,760</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">total hours</span>
                </div>
              </div>

              {/* Top Highlights */}
              <div className="flex-1 space-y-4 w-full">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-card/40 border border-border/40 rounded-xl p-3.5 text-center space-y-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--chart-1))]" /> Free Time
                    </span>
                    <span className="font-mono text-xl font-bold tracking-tight text-foreground block tabular-nums">
                      {hours_relaxing_year.toFixed(0)} hrs
                    </span>
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">{pct_relaxing.toFixed(1)}% of year</span>
                  </div>
                  <div className="bg-card/40 border border-border/40 rounded-xl p-3.5 text-center space-y-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--chart-3))]" /> Sleep
                    </span>
                    <span className="font-mono text-xl font-bold tracking-tight text-foreground block tabular-nums">
                      {hours_sleep_year.toFixed(0)} hrs
                    </span>
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">{pct_sleep.toFixed(1)}% of year</span>
                  </div>
                  <div className="bg-card/40 border border-border/40 rounded-xl p-3.5 text-center space-y-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--chart-2))]" /> Work
                    </span>
                    <span className="font-mono text-xl font-bold tracking-tight text-foreground block tabular-nums">
                      {hours_work_actual_year.toFixed(0)} hrs
                    </span>
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">{pct_hours_work.toFixed(1)}% of year</span>
                  </div>
                  <div className="bg-card/40 border border-border/40 rounded-xl p-3.5 text-center space-y-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /> Other Activities
                    </span>
                    <span className="font-mono text-xl font-bold tracking-tight text-foreground block tabular-nums">
                      {(TOTAL_HOURS_YEAR - hours_relaxing_year - hours_sleep_year - hours_work_actual_year).toFixed(0)} hrs
                    </span>
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">
                      {(100 - pct_relaxing - pct_sleep - pct_hours_work).toFixed(1)}% of year
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 24h Day Timeline Bar */}
            <div className="border-t border-border/40 pt-5 space-y-3">
              <div className="flex justify-between items-center text-xs font-mono font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Typical Day Allocation (24h Average)
                </span>
                <span className="tabular-nums">{totalDailyHours.toFixed(1)} hrs accounted for</span>
              </div>
              
              {/* Modern Sleek Progress Strip */}
              <div className="w-full h-3 rounded-full overflow-hidden flex bg-muted/20 border border-border/30 gap-0.5 p-0.5">
                {dailyBreakdown.map((item, idx) => {
                  const pct = (item.hours / totalDailyHours) * 100;
                  return (
                    <TooltipProvider key={idx}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            style={{ width: `${pct}%`, backgroundColor: item.color }}
                            className="h-full rounded-full transition-all hover:opacity-80 cursor-pointer"
                          />
                        </TooltipTrigger>
                        <TooltipContent className="bg-popover text-popover-foreground border border-border/40 rounded-lg p-2.5 shadow-md font-mono text-xs">
                          <div className="font-bold flex items-center gap-1.5 mb-1">
                            <span>{item.emoji}</span>
                            <span>{item.name}</span>
                          </div>
                          <div className="space-y-0.5 text-muted-foreground text-[11px]">
                            <p>Daily: <span className="text-foreground font-semibold tabular-nums">{item.hours.toFixed(1)} hrs</span></p>
                            <p>Weekly: <span className="text-foreground font-semibold tabular-nums">{(item.hours * 7).toFixed(1)} hrs</span></p>
                            <p>Yearly: <span className="text-foreground font-semibold tabular-nums">{(item.hours * 365).toFixed(0)} hrs</span></p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>

              {/* Timeline Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                {dailyBreakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-foreground font-medium">{item.name}</span>
                    <span className="text-muted-foreground/70 tabular-nums">({item.hours.toFixed(1)}h)</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Detailed Statistics Table */}
          <Card className="bg-card/50 border border-border/40 rounded-xl p-4 sm:p-6 hover:border-border/80 transition-colors shadow-none font-mono">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-foreground mb-4 flex items-center gap-1.5">
              Complete Time Metrics Breakdown
            </h4>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-xs text-left border-collapse font-mono">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Daily Avg</th>
                    <th className="py-2.5 px-3 text-right">Weekly Avg</th>
                    <th className="py-2.5 px-3 text-right">Yearly Total</th>
                    <th className="py-2.5 px-3 text-right">% of Year</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20 text-foreground font-medium">
                  {/* Sleep Row */}
                  <tr className="hover:bg-muted/10 transition-colors">
                    <td className="py-2.5 px-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'hsl(var(--chart-3))' }} />
                      <span>😴 Sleep</span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{sleepHoursPerDay.toFixed(1)} hrs</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{(sleepHoursPerDay * 7).toFixed(1)} hrs</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{hours_sleep_year.toFixed(0)} hrs</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{pct_sleep.toFixed(1)}%</td>
                  </tr>
                  {/* Work Row */}
                  <tr className="hover:bg-muted/10 transition-colors">
                    <td className="py-2.5 px-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
                      <span>💼 Actual Work</span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{(hours_work_actual_year / 365).toFixed(1)} hrs</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{(hours_work_actual_year / weeks_per_year).toFixed(1)} hrs</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{hours_work_actual_year.toFixed(0)} hrs</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{pct_hours_work.toFixed(1)}%</td>
                  </tr>
                  {/* Commute Row */}
                  {hours_commute_year > 0 && (
                    <tr className="hover:bg-muted/10 transition-colors">
                      <td className="py-2.5 px-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'hsl(var(--secondary-foreground))' }} />
                        <span>🚗 Commute</span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{(hours_commute_year / 365).toFixed(1)} hrs</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{(commuteDaysPerWeek * commuteHoursPerDay).toFixed(1)} hrs</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{hours_commute_year.toFixed(0)} hrs</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{pct_commute.toFixed(1)}%</td>
                    </tr>
                  )}
                  {/* Getting Ready Row */}
                  <tr className="hover:bg-muted/10 transition-colors">
                    <td className="py-2.5 px-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'hsl(var(--muted-foreground))' }} />
                      <span>🧼 Getting Ready</span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{gettingReadyHoursPerDay.toFixed(1)} hrs</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{(gettingReadyHoursPerDay * 7).toFixed(1)} hrs</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{hours_ready_year.toFixed(0)} hrs</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{pct_ready.toFixed(1)}%</td>
                  </tr>
                  {/* Gym Row */}
                  {hours_gym_year > 0 && (
                    <tr className="hover:bg-muted/10 transition-colors">
                      <td className="py-2.5 px-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'hsl(var(--positive))' }} />
                        <span>🏋️ Wellness / Gym</span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{(hours_gym_year / 365).toFixed(1)} hrs</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{(gymDaysPerWeek * gymHoursPerSession).toFixed(1)} hrs</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{hours_gym_year.toFixed(0)} hrs</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{pct_gym.toFixed(1)}%</td>
                    </tr>
                  )}
                  {/* Learning Row */}
                  {hours_learning_year > 0 && (
                    <tr className="hover:bg-muted/10 transition-colors">
                      <td className="py-2.5 px-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'hsl(var(--chart-4))' }} />
                        <span>📚 Learning</span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{(hours_learning_year / 365).toFixed(1)} hrs</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{learningHoursPerWeek.toFixed(1)} hrs</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{hours_learning_year.toFixed(0)} hrs</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{pct_learning.toFixed(1)}%</td>
                    </tr>
                  )}
                  {/* Friends Row */}
                  {hours_friends_year > 0 && (
                    <tr className="hover:bg-muted/10 transition-colors">
                      <td className="py-2.5 px-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'hsl(var(--chart-5))' }} />
                        <span>🥳 Socializing</span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{(hours_friends_year / 365).toFixed(1)} hrs</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{friendsHoursPerWeek.toFixed(1)} hrs</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{hours_friends_year.toFixed(0)} hrs</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{pct_friends.toFixed(1)}%</td>
                    </tr>
                  )}
                  {/* Relaxing Row */}
                  <tr className="hover:bg-muted/10 transition-colors">
                    <td className="py-2.5 px-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'hsl(var(--chart-1))' }} />
                      <span>🌴 Relaxing / Free Time</span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{(hours_relaxing_year / 365).toFixed(1)} hrs</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{(hours_relaxing_year / weeks_per_year).toFixed(1)} hrs</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{hours_relaxing_year.toFixed(0)} hrs</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{pct_relaxing.toFixed(1)}%</td>
                  </tr>
                  {/* Total Row */}
                  <tr className="font-bold border-t border-border/60 bg-muted/15 font-mono">
                    <td className="py-3 px-3">Total Year Accounted</td>
                    <td className="py-3 px-3 text-right tabular-nums">{totalDailyHours.toFixed(1)} hrs/d</td>
                    <td className="py-3 px-3 text-right tabular-nums">{(totalDailyHours * 7).toFixed(1)} hrs/w</td>
                    <td className="py-3 px-3 text-right tabular-nums">{Math.min(TOTAL_HOURS_YEAR, tracked_hours).toFixed(0)} hrs</td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {Math.min(100.0, (tracked_hours / TOTAL_HOURS_YEAR) * 100).toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

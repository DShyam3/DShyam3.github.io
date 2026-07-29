import React from 'react';
import { FinanceSettings, TimeSpentInputs } from '@/types/finance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Settings } from 'lucide-react';
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
    { name: 'Sleep', value: hours_sleep_year, pct: pct_sleep, color: '#6c63d1', emoji: '😴' },
    { name: 'Work', value: hours_work_actual_year, pct: pct_hours_work, color: '#2f9e6e', emoji: '💼' },
    { name: 'Relaxing / Free', value: hours_relaxing_year, pct: pct_relaxing, color: '#d99a3d', emoji: '🌴' },
    { name: 'Socializing', value: hours_friends_year, pct: pct_friends, color: '#c77dc9', emoji: '🥳' },
    { name: 'Getting Ready', value: hours_ready_year, pct: pct_ready, color: '#6c63d1', emoji: '🧼' },
    { name: 'Wellness / Gym', value: hours_gym_year, pct: pct_gym, color: '#3fb5ab', emoji: '🏋️' },
    { name: 'Commute', value: hours_commute_year, pct: pct_commute, color: '#6b7280', emoji: '🚗' },
    { name: 'Learning', value: hours_learning_year, pct: pct_learning, color: '#4f8fdb', emoji: '📚' },
  ].filter(d => d.value > 0);

  const dailyBreakdown = [
    { name: 'Sleep', hours: sleepHoursPerDay, color: '#6c63d1', emoji: '😴' },
    { name: 'Work', hours: hours_work_actual_year / 365, color: '#2f9e6e', emoji: '💼' },
    { name: 'Commute', hours: hours_commute_year / 365, color: '#6b7280', emoji: '🚗' },
    { name: 'Getting Ready', hours: gettingReadyHoursPerDay, color: '#6c63d1', emoji: '🧼' },
    { name: 'Wellness / Gym', hours: hours_gym_year / 365, color: '#3fb5ab', emoji: '🏋️' },
    { name: 'Learning', hours: hours_learning_year / 365, color: '#4f8fdb', emoji: '📚' },
    { name: 'Socializing', hours: hours_friends_year / 365, color: '#c77dc9', emoji: '🥳' },
    { name: 'Relaxing', hours: hours_relaxing_year / 365, color: '#d99a3d', emoji: '🌴' },
  ].filter(d => d.hours > 0);

  const totalDailyHours = dailyBreakdown.reduce((sum, d) => sum + d.hours, 0);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
        <div className="min-w-0">
          <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary shrink-0" /> Time Management & Life Calendar
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Analyze how your 8,760 yearly hours are allocated across routine, work, and free time
          </p>
        </div>
        <Button
          variant="outline"
          onClick={onOpenSettings}
          className="rounded-xl gap-1.5 shrink-0 self-start sm:self-auto text-xs"
        >
          <Settings className="h-3.5 w-3.5" /> Work Settings
        </Button>
      </div>

      {trackedExceedsTotal && (
        <div className="bg-fin-negative/10 border border-fin-negative/20 text-fin-negative rounded-2xl p-4 text-xs font-sans flex items-start gap-2.5">
          <span className="text-base leading-none">⚠️</span>
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
          <Card className="bg-card/40 backdrop-blur-sm border-primary/10 shadow-sm rounded-2xl sm:rounded-[2rem]">
            <CardHeader className="pb-4">
              <CardTitle className="font-serif text-base font-semibold">Lifestyle Parameters</CardTitle>
              <CardDescription className="text-xs">
                Drag sliders to customize your typical daily/weekly time spending patterns.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sleep Slider */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <span>😴</span> Sleep
                  </span>
                  <span className="font-mono text-primary font-bold">{sleepHoursPerDay} hrs / day</span>
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
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <span>🧼</span> Getting Ready / Routine
                  </span>
                  <span className="font-mono text-primary font-bold">{gettingReadyHoursPerDay} hrs / day</span>
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
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <span>🚗</span> Commute Frequency
                  </span>
                  <span className="font-mono text-primary font-bold">{commuteDaysPerWeek} days / week</span>
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
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-foreground flex items-center gap-1.5 pl-4 border-l border-border">
                      Round Trip Commute
                    </span>
                    <span className="font-mono text-primary font-bold">{commuteHoursPerDay} hrs / active day</span>
                  </div>
                  <div className="pl-4">
                    <Slider
                      value={[commuteHoursPerDay]}
                      onValueChange={(val) => setTimeSpentInputs(prev => ({ ...prev, commuteHoursPerDay: val[0] }))}
                      min={0.5}
                      max={12}
                      step={0.5}
                    />
                  </div>
                </div>
              )}

              <div className="h-px bg-border/40" />

              {/* Gym Days */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <span>🏋️</span> Wellness / Gym Frequency
                  </span>
                  <span className="font-mono text-primary font-bold">{gymDaysPerWeek} days / week</span>
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
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-foreground flex items-center gap-1.5 pl-4 border-l border-border">
                      Session Duration
                    </span>
                    <span className="font-mono text-primary font-bold">{gymHoursPerSession} hrs / session</span>
                  </div>
                  <div className="pl-4">
                    <Slider
                      value={[gymHoursPerSession]}
                      onValueChange={(val) => setTimeSpentInputs(prev => ({ ...prev, gymHoursPerSession: val[0] }))}
                      min={0.5}
                      max={6}
                      step={0.5}
                    />
                  </div>
                </div>
              )}

              <div className="h-px bg-border/40" />

              {/* Learning Hours */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <span>📚</span> Learning / Upskilling
                  </span>
                  <span className="font-mono text-primary font-bold">{learningHoursPerWeek} hrs / week</span>
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
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <span>🥳</span> Friends & Socializing
                  </span>
                  <span className="font-mono text-primary font-bold">{friendsHoursPerWeek} hrs / week</span>
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
          <Card className="bg-card/20 backdrop-blur-sm border-dashed border-primary/10 rounded-2xl p-4 text-xs font-sans space-y-2">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <span>💼</span> Inherited Work Profile
            </div>
            <p className="text-muted-foreground leading-normal">
              Work days and times are linked to your profile parameters:
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-muted/20 rounded-xl p-2.5 border border-border/30">
              <div>Working Hours: <span className="text-foreground font-bold">{hours_of_work_per_day}h/day</span></div>
              <div>Work Days: <span className="text-foreground font-bold">{days_of_work_actual} days/yr</span></div>
              <div className="col-span-2 pt-1 border-t border-border/30 mt-1">
                Nominal Work Days: <span className="text-foreground font-bold">{days_of_work_nominal} days/yr</span>
              </div>
              <div className="col-span-2">
                Holidays & Public: <span className="text-foreground font-bold">{holidays_and_bank_holidays} days/yr</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground leading-normal">
              You can adjust these parameters by editing the <strong>Tax & Income</strong> settings using the top-right button.
            </p>
          </Card>
        </div>

        {/* Right Column: Visualization & Table */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Visual Charts Card */}
          <Card className="bg-card/40 backdrop-blur-sm border-primary/10 shadow-sm rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-around gap-6">
              {/* Donut Chart */}
              <div className="w-48 h-48 flex items-center justify-center relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={timeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={68}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {timeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(v: number) => [`${v.toFixed(0)} hrs`, 'Yearly Time']} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Inner Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  <span className="font-mono text-2xl font-bold text-foreground">8,760</span>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">total hours</span>
                </div>
              </div>

              {/* Top Highlights */}
              <div className="flex-1 space-y-4 w-full">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/15 border border-border/30 rounded-xl p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">Free Time</span>
                    <span className="font-mono text-lg font-bold text-fin-warn block">{hours_relaxing_year.toFixed(0)} hrs</span>
                    <span className="text-[10px] text-muted-foreground/80 font-semibold">{pct_relaxing.toFixed(1)}% of year</span>
                  </div>
                  <div className="bg-muted/15 border border-border/30 rounded-xl p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">Sleep</span>
                    <span className="font-mono text-lg font-bold text-fin-accent block">{hours_sleep_year.toFixed(0)} hrs</span>
                    <span className="text-[10px] text-muted-foreground/80 font-semibold">{pct_sleep.toFixed(1)}% of year</span>
                  </div>
                  <div className="bg-muted/15 border border-border/30 rounded-xl p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">Work</span>
                    <span className="font-mono text-lg font-bold text-fin-positive block">{hours_work_actual_year.toFixed(0)} hrs</span>
                    <span className="text-[10px] text-muted-foreground/80 font-semibold">{pct_hours_work.toFixed(1)}% of year</span>
                  </div>
                  <div className="bg-muted/15 border border-border/30 rounded-xl p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">Other Activities</span>
                    <span className="font-mono text-lg font-bold text-primary block">
                      {(TOTAL_HOURS_YEAR - hours_relaxing_year - hours_sleep_year - hours_work_actual_year).toFixed(0)} hrs
                    </span>
                    <span className="text-[10px] text-muted-foreground/80 font-semibold">
                      {(100 - pct_relaxing - pct_sleep - pct_hours_work).toFixed(1)}% of year
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 24h Day Timeline Bar */}
            <div className="border-t border-border/40 pt-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1">⏰ Typical Day Allocation (24h Average)</span>
                  <span className="font-mono">{totalDailyHours.toFixed(1)} hrs accounted for</span>
                </div>
                <div className="w-full h-7 rounded-full overflow-hidden flex border border-primary/10 shadow-inner bg-muted/10">
                  {dailyBreakdown.map((item, idx) => {
                    const pct = (item.hours / totalDailyHours) * 100;
                    return (
                      <TooltipProvider key={idx}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              style={{ width: `${pct}%`, backgroundColor: item.color }}
                              className="h-full hover:brightness-105 transition-all cursor-pointer flex items-center justify-center text-[10px] text-white font-bold select-none overflow-hidden"
                            >
                              {pct > 5 && <span>{item.emoji}</span>}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-popover text-popover-foreground border border-border rounded-xl p-3 shadow-md font-sans text-xs">
                            <div className="font-bold flex items-center gap-1.5 mb-1 text-sm">
                              <span>{item.emoji}</span>
                              <span>{item.name}</span>
                            </div>
                            <div className="space-y-1 font-mono text-[11px] text-muted-foreground">
                              <p>Daily Avg: <span className="text-foreground font-semibold">{item.hours.toFixed(1)} hrs</span></p>
                              <p>Weekly Avg: <span className="text-foreground font-semibold">{(item.hours * 7).toFixed(1)} hrs</span></p>
                              <p>Yearly Total: <span className="text-foreground font-semibold">{(item.hours * 365).toFixed(0)} hrs</span></p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
                {/* Timeline Legend */}
                <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 pt-1">
                  {dailyBreakdown.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-[11px] text-muted-foreground font-sans">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span>
                        {item.emoji} <span className="font-medium text-foreground/80">{item.name}</span> ({item.hours.toFixed(1)}h)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Detailed Statistics Table */}
          <Card className="bg-card/40 backdrop-blur-sm border-primary/10 shadow-sm rounded-2xl sm:rounded-[2rem] p-4 sm:p-6">
            <h4 className="font-serif text-sm font-semibold text-foreground mb-4 flex items-center gap-1.5">
              📊 Complete Time Metrics Breakdown
            </h4>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-xs text-left border-collapse font-sans">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground font-semibold">
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Daily Avg</th>
                    <th className="py-2.5 px-3 text-right">Weekly Avg</th>
                    <th className="py-2.5 px-3 text-right">Yearly Total</th>
                    <th className="py-2.5 px-3 text-right">% of Year</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20 text-foreground font-medium">
                  {/* Sleep Row */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="py-2.5 px-3 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#6c63d1' }} />
                      <span>😴 Sleep</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{sleepHoursPerDay.toFixed(1)} hrs</td>
                    <td className="py-2.5 px-3 text-right font-mono">{(sleepHoursPerDay * 7).toFixed(1)} hrs</td>
                    <td className="py-2.5 px-3 text-right font-mono">{hours_sleep_year.toFixed(0)} hrs</td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{pct_sleep.toFixed(1)}%</td>
                  </tr>
                  {/* Work Row */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="py-2.5 px-3 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#2f9e6e' }} />
                      <span>💼 Actual Work</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{(hours_work_actual_year / 365).toFixed(1)} hrs</td>
                    <td className="py-2.5 px-3 text-right font-mono">{(hours_work_actual_year / weeks_per_year).toFixed(1)} hrs</td>
                    <td className="py-2.5 px-3 text-right font-mono">{hours_work_actual_year.toFixed(0)} hrs</td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{pct_hours_work.toFixed(1)}%</td>
                  </tr>
                  {/* Commute Row */}
                  {hours_commute_year > 0 && (
                    <tr className="hover:bg-muted/5 transition-colors">
                      <td className="py-2.5 px-3 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#6b7280' }} />
                        <span>🚗 Commute</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{(hours_commute_year / 365).toFixed(1)} hrs</td>
                      <td className="py-2.5 px-3 text-right font-mono">{(commuteDaysPerWeek * commuteHoursPerDay).toFixed(1)} hrs</td>
                      <td className="py-2.5 px-3 text-right font-mono">{hours_commute_year.toFixed(0)} hrs</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{pct_commute.toFixed(1)}%</td>
                    </tr>
                  )}
                  {/* Getting Ready Row */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="py-2.5 px-3 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#6c63d1' }} />
                      <span>🧼 Getting Ready</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{gettingReadyHoursPerDay.toFixed(1)} hrs</td>
                    <td className="py-2.5 px-3 text-right font-mono">{(gettingReadyHoursPerDay * 7).toFixed(1)} hrs</td>
                    <td className="py-2.5 px-3 text-right font-mono">{hours_ready_year.toFixed(0)} hrs</td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{pct_ready.toFixed(1)}%</td>
                  </tr>
                  {/* Gym Row */}
                  {hours_gym_year > 0 && (
                    <tr className="hover:bg-muted/5 transition-colors">
                      <td className="py-2.5 px-3 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#3fb5ab' }} />
                        <span>🏋️ Wellness / Gym</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{(hours_gym_year / 365).toFixed(1)} hrs</td>
                      <td className="py-2.5 px-3 text-right font-mono">{(gymDaysPerWeek * gymHoursPerSession).toFixed(1)} hrs</td>
                      <td className="py-2.5 px-3 text-right font-mono">{hours_gym_year.toFixed(0)} hrs</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{pct_gym.toFixed(1)}%</td>
                    </tr>
                  )}
                  {/* Learning Row */}
                  {hours_learning_year > 0 && (
                    <tr className="hover:bg-muted/5 transition-colors">
                      <td className="py-2.5 px-3 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#4f8fdb' }} />
                        <span>📚 Learning</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{(hours_learning_year / 365).toFixed(1)} hrs</td>
                      <td className="py-2.5 px-3 text-right font-mono">{learningHoursPerWeek.toFixed(1)} hrs</td>
                      <td className="py-2.5 px-3 text-right font-mono">{hours_learning_year.toFixed(0)} hrs</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{pct_learning.toFixed(1)}%</td>
                    </tr>
                  )}
                  {/* Friends Row */}
                  {hours_friends_year > 0 && (
                    <tr className="hover:bg-muted/5 transition-colors">
                      <td className="py-2.5 px-3 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#c77dc9' }} />
                        <span>🥳 Socializing</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{(hours_friends_year / 365).toFixed(1)} hrs</td>
                      <td className="py-2.5 px-3 text-right font-mono">{friendsHoursPerWeek.toFixed(1)} hrs</td>
                      <td className="py-2.5 px-3 text-right font-mono">{hours_friends_year.toFixed(0)} hrs</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{pct_friends.toFixed(1)}%</td>
                    </tr>
                  )}
                  {/* Relaxing Row */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="py-2.5 px-3 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#d99a3d' }} />
                      <span>🌴 Relaxing / Free Time</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{(hours_relaxing_year / 365).toFixed(1)} hrs</td>
                    <td className="py-2.5 px-3 text-right font-mono">{(hours_relaxing_year / weeks_per_year).toFixed(1)} hrs</td>
                    <td className="py-2.5 px-3 text-right font-mono">{hours_relaxing_year.toFixed(0)} hrs</td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{pct_relaxing.toFixed(1)}%</td>
                  </tr>
                  {/* Total Row */}
                  <tr className="font-bold border-t border-border/60 bg-muted/10 font-mono">
                    <td className="py-3 px-3 font-sans">Total Year Accounted</td>
                    <td className="py-3 px-3 text-right">{totalDailyHours.toFixed(1)} hrs/d</td>
                    <td className="py-3 px-3 text-right">{(totalDailyHours * 7).toFixed(1)} hrs/w</td>
                    <td className="py-3 px-3 text-right">{Math.min(TOTAL_HOURS_YEAR, tracked_hours).toFixed(0)} hrs</td>
                    <td className="py-3 px-3 text-right">
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

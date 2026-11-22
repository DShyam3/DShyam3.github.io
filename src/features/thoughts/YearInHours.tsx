import { useId, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SPRING_PILL } from '@/theme/motion';
import { AlertTriangle, ChevronDown, Clock } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { cn } from '@/lib/utils';
import {
  AVERAGE_YEAR_HOURS_INPUT,
  DHYAN_YEAR_HOURS_INPUT,
  HOURS_IN_YEAR,
  hoursIn,
  matchesYearHoursInput,
  YEAR_SLICES,
  yearHours,
  yearTotal,
  type YearActivity,
  type YearActivityKey,
  type YearHoursInput,
  type YearSliceKey,
  type YearTimeUnit,
  type YearTotal,
} from '@/lib/year-hours';

/** Whole hours with a thousands separator: 8,760. */
const wholeHours = (hours: number) => Math.round(hours).toLocaleString('en-GB');

const ACTIVITY: Record<YearActivityKey, { label: string; emoji: string }> = {
  sleep: { label: 'Sleep / time in bed', emoji: '😴' },
  work: { label: 'Work', emoji: '💼' },
  commute: { label: 'Commute', emoji: '🚗' },
  gettingReady: { label: 'Personal care', emoji: '🧼' },
  eating: { label: 'Eating', emoji: '🍽️' },
  housework: { label: 'Housework and errands', emoji: '🧺' },
  caring: { label: 'Caring for others', emoji: '🤲' },
  exercise: { label: 'Exercise', emoji: '🏃' },
  learning: { label: 'Learning', emoji: '📚' },
  friends: { label: 'Socialising', emoji: '🥳' },
  free: { label: 'Still free', emoji: '🌴' },
};

/**
 * The chart draws five slices rather than eleven activities: past five the
 * colours stop being told apart, so the smaller needs fold into one neutral
 * slice and the chosen activities into one. The table keeps every activity.
 * `YEAR_SLICES` orders them to keep Sleep and Work, whose colours are close, apart.
 */
const SLICE_STYLE: Record<YearSliceKey, { label: string; color: string }> = {
  sleep: { label: 'Sleep', color: 'hsl(var(--chart-3))' },
  otherNeeds: { label: 'Other needs', color: 'hsl(var(--muted-foreground) / 0.6)' },
  work: { label: 'Work', color: 'hsl(var(--chart-2))' },
  fitted: { label: 'Fitted in', color: 'hsl(var(--chart-4))' },
  free: { label: 'Still free', color: 'hsl(var(--chart-1))' },
};

/** The colour of the slice an activity is drawn in. */
const colorOf = (key: YearActivityKey) => {
  const slice = YEAR_SLICES.find((s) => (s.members as readonly YearActivityKey[]).includes(key));
  if (!slice) throw new Error(`No slice for ${key}`);
  return SLICE_STYLE[slice.key].color;
};

/** Shown in the table only when above zero. */
const OPTIONAL_ROWS: YearActivityKey[] = ['commute', 'caring', 'exercise', 'learning', 'friends'];

const PRESETS: { label: string; input: YearHoursInput }[] = [
  { label: "Dhyan's", input: DHYAN_YEAR_HOURS_INPUT },
  { label: 'UK starting point', input: AVERAGE_YEAR_HOURS_INPUT },
];

const UNITS: { unit: YearTimeUnit; label: string }[] = [
  { unit: 'seconds', label: 'Seconds' },
  { unit: 'minutes', label: 'Minutes' },
  { unit: 'hours', label: 'Hours' },
  { unit: 'days', label: 'Days' },
  { unit: 'weeks', label: 'Weeks' },
];

/** The NHS minimum for adults aged 19 to 64: 150 minutes of moderate activity a week. */
const NHS_WEEKLY_EXERCISE_MINUTES = 150;

/** A whole count and its unit, singular for one: "1 day", "26 days". */
const count = (value: number, unit: string) => `${value} ${unit}${value === 1 ? '' : 's'}`;

/** At most one decimal place, none when whole: 40, 37.5. */
const upToOnePlace = (value: number) => Number(value.toFixed(1)).toLocaleString('en-GB');

/** Minutes as hours and minutes: "45 mins", "1 hr", "1 hr 30 mins". */
const minutesAndHours = (minutes: number) => {
  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  const parts = [hours > 0 ? `${hours} hr${hours === 1 ? '' : 's'}` : '', rest > 0 ? `${rest} mins` : ''];
  return parts.filter(Boolean).join(' ') || '0 mins';
};

/** A slider's hours a day, read out: "7 hrs 30 mins / day". */
const perDay = (hours: number) => `${minutesAndHours(hours * 60)} / day`;

/**
 * A figure at a precision that suits its size: 2,920 and 31,536,000 whole,
 * 56.0 to one place, and below one to two significant figures, so that 0.0038
 * weeks is not shown as 0.00.
 */
const amount = (value: number) => {
  if (value > 0 && value < 1) return value.toLocaleString('en-GB', { maximumSignificantDigits: 2 });
  const digits = value === 0 || value >= 100 ? 0 : 1;
  return value.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const amountFormat = (value: number) => {
  if (value > 0 && value < 1) return { maximumSignificantDigits: 2 } as const;
  const digits = value === 0 || value >= 100 ? 0 : 1;
  return { minimumFractionDigits: digits, maximumFractionDigits: digits } as const;
};

const percent = (share: number) => `${(share * 100).toFixed(1)}%`;

interface PillGroupProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  isSelected: (value: T) => boolean;
  onSelect: (value: T) => void;
  className?: string;
}

function PillGroup<T extends string>({ label, options, isSelected, onSelect, className }: PillGroupProps<T>) {
  const pillId = useId();
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex flex-wrap items-center gap-1 p-0.5 bg-background/80 rounded-lg border border-border/40 w-fit max-w-full',
        className,
      )}
    >
      {options.map((option) => {
        const selected = isSelected(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(option.value)}
            className={cn(
              't-press relative isolate px-2.5 py-1 rounded text-xs font-mono font-medium whitespace-nowrap transition-colors border',
              selected
                ? 'text-primary border-transparent font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {selected ? (
              prefersReducedMotion ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded bg-primary/20 border border-primary/40 shadow-xs"
                />
              ) : (
                <motion.span
                  layoutId={`${pillId}-pill`}
                  transition={SPRING_PILL}
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded bg-primary/20 border border-primary/40 shadow-xs"
                />
              )
            ) : null}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

interface SliderRowProps {
  label: string;
  emoji?: string;
  /** A line under the label saying what counts. */
  hint?: string;
  display: string;
  value: number;
  min: number;
  max: number;
  step: number;
  nested?: boolean;
  disabled?: boolean;
  onChange: (value: number) => void;
}

function SliderRow({ label, emoji, hint, display, value, min, max, step, nested, disabled, onChange }: SliderRowProps) {
  return (
    <div className={nested ? 'space-y-2 pl-3 border-l-2 border-border/40' : 'space-y-2'}>
      <div className="space-y-0.5">
        <div className="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 text-xs font-mono">
          <span className="text-muted-foreground flex items-center gap-1.5">
            {emoji && <span aria-hidden="true">{emoji}</span>} <span className="text-foreground font-medium">{label}</span>
          </span>
          <span className="text-foreground font-semibold tabular-nums">{display}</span>
        </div>
        {hint && <p className="text-xs font-mono text-muted-foreground">{hint}</p>}
      </div>
      <Slider
        aria-label={label}
        aria-valuetext={display}
        disabled={disabled}
        value={[value]}
        onValueChange={(val) => onChange(val[0])}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}

const CARD = 'bg-card/50 border border-border/40 rounded-lg hover:border-border/80 transition-colors shadow-none';

export function YearInHours() {
  const prefersReducedMotion = useReducedMotion();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const sourcesPanelId = useId();
  const [input, setInput] = useState<YearHoursInput>(DHYAN_YEAR_HOURS_INPUT);
  const [unit, setUnit] = useState<YearTimeUnit>('hours');
  const result = useMemo(() => yearHours(input), [input]);
  /** Hours as a figure in the chosen unit, unit named in full: "2,920 hours". */
  const inUnit = (hours: number) => `${amount(hoursIn(hours, unit))} ${unit}`;

  const set = (key: keyof YearHoursInput) => (value: number) =>
    setInput((prev) => {
      const next = { ...prev, [key]: value };
      next.commuteDaysPerWeek = Math.min(next.commuteDaysPerWeek, next.workingDaysPerWeek);
      // The time sliders appear only once there are days to spend them on,
      // and start above zero. Give them a value to match, or the thumb would
      // sit at its minimum while the sums used 0.
      if (key === 'commuteDaysPerWeek' && value > 0 && prev.commuteHoursPerDay === 0) {
        next.commuteHoursPerDay = 1;
      }
      if (key === 'exerciseDaysPerWeek' && value > 0 && prev.exerciseMinutesPerDay === 0) {
        next.exerciseMinutesPerDay = 60;
      }
      return next;
    });

  const byKey = (key: YearActivityKey) => {
    const found = result.activities.find((a) => a.key === key);
    if (!found) throw new Error(`Missing activity ${key}`);
    return found;
  };
  const work = byKey('work');
  const stillFree = byKey('free');
  const needs = result.activities.filter((a) => a.group === 'needs');
  const freeTime = result.activities.filter((a) => a.group === 'freeTime');
  const shown = (a: YearActivity) => !OPTIONAL_ROWS.includes(a.key) || a.hoursPerYear > 0;

  const slices = result.slices.map((slice) => ({ ...slice, ...SLICE_STYLE[slice.key] }));
  const drawnSlices = slices.filter((s) => s.hoursPerYear > 0);
  const total = yearTotal(result.totalHours);
  const centreFigure = amount(hoursIn(result.totalHours, unit));
  const freeTimePerDay = yearTotal(result.freeTimeHours).hoursPerDay;
  /** Bars in the free-time list share one scale, wide enough for an overfilled year. */
  const freeTimeScale = Math.max(result.freeTimeHours, result.fittedAndStillFreeHours);

  const tiles = [
    { label: 'Needs', hours: result.needsHours, caption: `${percent(yearTotal(result.needsHours).share)} of the year` },
    {
      label: 'Free time',
      hours: result.freeTimeHours,
      caption: `${percent(yearTotal(result.freeTimeHours).share)} of the year`,
    },
    {
      label: 'Fitted in',
      hours: result.fittedHours,
      caption: result.freeTimeHours > 0 ? `${percent(result.fittedShareOfFreeTime)} of free time` : 'no free time',
    },
    {
      label: 'Still free',
      hours: stillFree.hoursPerYear,
      caption: result.freeTimeHours > 0 ? `${percent(stillFree.shareOfFreeTime)} of free time` : 'no free time',
    },
  ];

  const row = (a: YearActivity) => (
    <tr key={a.key} className="hover:bg-muted/10 transition-colors">
      <th scope="row" className="py-2.5 px-3 text-left font-medium">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorOf(a.key) }} />
          <span>
            <span aria-hidden="true">{ACTIVITY[a.key].emoji}</span> {ACTIVITY[a.key].label}
          </span>
        </span>
      </th>
      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{inUnit(a.hoursPerDay)}</td>
      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{inUnit(a.hoursPerWeek)}</td>
      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{inUnit(a.hoursPerYear)}</td>
      <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{percent(a.share)}</td>
    </tr>
  );

  const subtotal = (label: string, sum: YearTotal) => (
    <tr className="font-semibold bg-muted/10">
      <th scope="row" className="py-2.5 px-3 text-left font-semibold">
        {label}
      </th>
      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{inUnit(sum.hoursPerDay)}</td>
      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{inUnit(sum.hoursPerWeek)}</td>
      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{inUnit(sum.hoursPerYear)}</td>
      <td className="py-2.5 px-3 text-right tabular-nums">{percent(sum.share)}</td>
    </tr>
  );

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
        <div className="min-w-0">
          <h3 className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary shrink-0" /> A year in hours
          </h3>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            A year has {wholeHours(HOURS_IN_YEAR)} hours. The needs come first; what they leave is your free time. It
            opens on mine; move the sliders to see where yours go.
          </p>
        </div>
        <PillGroup
          label="Start from"
          className="shrink-0 self-start sm:self-auto"
          options={PRESETS.map((preset) => ({ value: preset.label, label: preset.label }))}
          isSelected={(label) => {
            const preset = PRESETS.find((p) => p.label === label);
            return preset !== undefined && matchesYearHoursInput(input, preset.input);
          }}
          onSelect={(label) => {
            const preset = PRESETS.find((p) => p.label === label);
            if (preset) setInput(preset.input);
          }}
        />
      </div>

      <div className="space-y-2 text-xs font-mono text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">About the UK starting point: </span>
          Defaults combine published UK or Great Britain statistics with rounded planning assumptions.
          Sources cover different years and groups; these are starting estimates, not personal targets.
          Adjust them to match your routine.
        </p>
        <div className="rounded-lg border border-border/40 bg-card/50 p-3">
          <button
            type="button"
            aria-expanded={sourcesOpen}
            aria-controls={sourcesPanelId}
            onClick={() => setSourcesOpen((prev) => !prev)}
            className="flex w-full items-center justify-between gap-2 text-left font-medium text-foreground transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span>Sources and assumptions</span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                sourcesOpen && 'rotate-180',
              )}
            />
          </button>
          <AnimatePresence initial={false}>
            {sourcesOpen && (
              <motion.div
                id={sourcesPanelId}
                initial={prefersReducedMotion ? { opacity: 1 } : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                className="overflow-hidden"
              >
                <ul className="mt-3 space-y-3 list-disc pl-4 leading-relaxed [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:break-words">
            <li>
              <span className="font-semibold text-foreground">Sleep / time in bed:</span>{' '}
              <a href="https://www.dreams.co.uk/sleep-matters-club/the-2026-uk-sleep-survey" target="_blank" rel="noopener noreferrer">Dreams, January 2026</a>{' '}
              surveyed 2,000 UK adults: 6h 24m asleep and 7h 12m in bed. This is a commercial,
              self-reported survey. The preset uses 7.5 hours in bed as a rounded planning assumption,
              not a sleep target.
            </li>
            <li>
              <span className="font-semibold text-foreground">Personal care and socialising:</span>{' '}
              <a href="https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/incomeandwealth/bulletins/timeuseintheuk/23septemberto1october2023" target="_blank" rel="noopener noreferrer">ONS, September 2023</a>{' '}
              measured 53 minutes a day washing, dressing, using the bathroom and grooming,
              rounded here to 1 hour. Socialising was 32 minutes a day, rounded to 4 hours a week;
              this includes people generally, not just friends.
            </li>
            <li>
              <span className="font-semibold text-foreground">Eating, housework and caring:</span>{' '}
              the same ONS survey measured 1 hour 7 minutes a day eating, rounded to 1 hour, and, in its{' '}
              <a href="https://www.ons.gov.uk/peoplepopulationandcommunity/personalandhouseholdfinances/incomeandwealth/datasets/timeuseintheuk" target="_blank" rel="noopener noreferrer">dataset</a>,
              2 hours 24 minutes of unpaid household work: cooking, cleaning, laundry, shopping, pets,
              repairs, errands and household admin, rounded to 2.5 hours. Both are averages over all adults.
              The eating figure includes meals at work, which time at work already counts, so the starting
              point counts its 30-minute lunch twice on working days, about 114 hours a year: lower Eating
              if your lunch is at work.
              Unpaid childcare averaged 24 minutes over all adults but 2 hours 13 minutes among those who
              did any, so caring starts at zero: add your own.
            </li>
            <li>
              <span className="font-semibold text-foreground">Commuting:</span>{' '}
              <a href="https://www.gov.uk/government/statistics/transport-statistics-great-britain-2025/transport-statistics-great-britain-2024-domestic-travel" target="_blank" rel="noopener noreferrer">DfT, Great Britain 2024</a>{' '}
              reports 28 minutes each way, rounded here to a 1-hour return journey. On-site (every
              working day), hybrid (3) and remote (0) are example assumptions, not national averages.
              Commute time excludes leave and bank holidays, pro-rated by the commute days in the working week.
            </li>
            <li>
              <span className="font-semibold text-foreground">Exercise and learning:</span>{' '}
              zero means no time allocated in the starting point, not a national average. The{' '}
              <a href="https://www.nhs.uk/live-well/exercise/physical-activity-guidelines-for-adults-aged-19-to-64/" target="_blank" rel="noopener noreferrer">NHS</a>{' '}
              asks adults aged 19 to 64 for at least 150 minutes of moderate activity a week, spread over
              4 to 5 days or every day; the 5 × 30 minutes example meets it. The 3-day gym example is an
              assumption. Its 1-hour duration is rounded from{' '}
              <a href="https://www.puregym.com/blog/uk-fitness-report-gym-statistics/" target="_blank" rel="noopener noreferrer">PureGym’s 2025/26 report</a>{' '}
              of 68 minutes per visit among its own members; it does not represent all exercise or all UK adults.
              Add exercise travel separately to the time you allocate.
            </li>
            <li>
              <span className="font-semibold text-foreground">Working year:</span>{' '}
              time at work counts lunch and breaks, paid or not. The starting point’s 8 hours are 37.5
              scheduled hours over five days plus a 30-minute unpaid lunch, both planning assumptions. The{' '}
              <a href="https://www.tuc.org.uk/guidance/how-do-i-work-out-my-holiday-entitlement" target="_blank" rel="noopener noreferrer">TUC</a>{' '}
              reports 25 days’ annual leave plus eight bank holidays for the average full-time worker
              in Great Britain. The preset’s eight bank holidays match{' '}
              <a href="https://www.gov.uk/bank-holidays" target="_blank" rel="noopener noreferrer">England and Wales in 2026</a>.
              Leave excludes bank holidays. This is a fixed 365-day model of 52 whole weeks, so a
              five-day week has 104 days off, whichever days they fall on; it is not a calendar calculation
              for a selected year. Dhyan’s preset is the site owner’s own routine.
            </li>
          </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {result.overAllocatedHours > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 text-xs font-mono flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>
            You have entered {wholeHours(result.allocatedHours)} hours, {wholeHours(result.overAllocatedHours)} more than a
            year holds.{' '}
            {result.freeTimeHours === 0 ? 'The needs alone fill the year. Lower one of them.' : 'Lower something.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Sliders */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <Card className={CARD}>
            <CardHeader className="pb-4">
              <CardTitle className="text-xs font-mono uppercase tracking-wider font-semibold">Needs</CardTitle>
              <CardDescription className="text-xs font-mono text-muted-foreground">
                What every day asks of you before you choose anything. Work and the commute are needs too;
                they are set below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <SliderRow
                label="Sleep / time in bed"
                emoji="😴"
                display={perDay(input.sleepHoursPerDay)}
                value={input.sleepHoursPerDay}
                min={0}
                max={24}
                step={0.5}
                onChange={set('sleepHoursPerDay')}
              />
              <SliderRow
                label="Personal care"
                emoji="🧼"
                hint="Washing, dressing, the bathroom"
                display={perDay(input.gettingReadyHoursPerDay)}
                value={input.gettingReadyHoursPerDay}
                min={0}
                max={6}
                step={0.25}
                onChange={set('gettingReadyHoursPerDay')}
              />
              <SliderRow
                label="Eating"
                emoji="🍽️"
                hint="Meals outside work hours"
                display={perDay(input.eatingHoursPerDay)}
                value={input.eatingHoursPerDay}
                min={0}
                max={6}
                step={0.25}
                onChange={set('eatingHoursPerDay')}
              />
              <SliderRow
                label="Housework and errands"
                emoji="🧺"
                hint="Cooking, cleaning, laundry, shopping, bills"
                display={perDay(input.houseworkHoursPerDay)}
                value={input.houseworkHoursPerDay}
                min={0}
                max={8}
                step={0.25}
                onChange={set('houseworkHoursPerDay')}
              />
              <SliderRow
                label="Caring for others"
                emoji="🤲"
                hint="Children, or adults who depend on you"
                display={perDay(input.caringHoursPerDay)}
                value={input.caringHoursPerDay}
                min={0}
                max={16}
                step={0.25}
                onChange={set('caringHoursPerDay')}
              />
            </CardContent>
          </Card>

          <Card className={CARD}>
            <CardHeader className="pb-4">
              <CardTitle className="text-xs font-mono uppercase tracking-wider font-semibold">Working year</CardTitle>
              <CardDescription className="text-xs font-mono text-muted-foreground">
                A 365-day year of 52 whole weeks. Set the days you work, weekends included, your holidays and
                your time at work.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <SliderRow
                label="Working days a week"
                hint="Any days of the week, weekends included"
                display={`${count(input.workingDaysPerWeek, 'day')} / week`}
                value={input.workingDaysPerWeek}
                min={0}
                max={7}
                step={1}
                onChange={set('workingDaysPerWeek')}
              />
              <div className="space-y-0.5 text-xs font-mono">
                <div className="flex flex-wrap justify-between items-center gap-x-3 gap-y-1">
                  <span className="text-foreground font-medium">Days off a year</span>
                  <span className="text-foreground font-semibold tabular-nums">{count(result.daysOff, 'day')}</span>
                </div>
                <p className="text-muted-foreground">Whichever days of the week they fall on</p>
              </div>
              <SliderRow
                label="Bank holidays"
                hint="0 if you work them"
                display={count(input.bankHolidays, 'day')}
                value={input.bankHolidays}
                min={0}
                max={20}
                step={1}
                onChange={set('bankHolidays')}
              />
              <SliderRow
                label="Leave days"
                display={count(input.leaveDays, 'day')}
                value={input.leaveDays}
                min={0}
                max={60}
                step={1}
                onChange={set('leaveDays')}
              />
              <SliderRow
                label="Time at work a day"
                hint="Arriving to leaving: lunch and breaks count, paid or not"
                display={perDay(input.workingHoursPerDay)}
                value={input.workingHoursPerDay}
                min={0}
                max={14}
                step={0.5}
                onChange={set('workingHoursPerDay')}
              />
              <p className="text-xs font-mono text-muted-foreground tabular-nums">
                {result.workDays} working days a year · {upToOnePlace(result.workingWeekHours)} hours a working week
              </p>

              <div className="h-px bg-border/40" />

              <SliderRow
                label="Commute days"
                emoji="🚗"
                display={`${count(input.commuteDaysPerWeek, 'day')} / working week`}
                value={input.commuteDaysPerWeek}
                min={0}
                max={Math.max(1, input.workingDaysPerWeek)}
                disabled={input.workingDaysPerWeek === 0}
                step={1}
                onChange={set('commuteDaysPerWeek')}
              />
              {input.workingDaysPerWeek > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-mono text-muted-foreground">Example commute patterns (assumptions)</p>
                  <PillGroup
                    label="Example commute patterns"
                    options={[
                      {
                        value: String(input.workingDaysPerWeek),
                        label: `On-site · ${count(input.workingDaysPerWeek, 'day')}`,
                      },
                      ...(input.workingDaysPerWeek > 3 ? [{ value: '3', label: 'Hybrid · 3 days' }] : []),
                      { value: '0', label: 'Remote · 0 days' },
                    ].filter((option, index, all) => all.findIndex((o) => o.value === option.value) === index)}
                    isSelected={(value) => input.commuteDaysPerWeek === Number(value)}
                    onSelect={(value) => set('commuteDaysPerWeek')(Number(value))}
                  />
                </div>
              )}
              {input.commuteDaysPerWeek > 0 && (
                <SliderRow
                  nested
                  label="Round trip"
                  display={`${minutesAndHours(input.commuteHoursPerDay * 60)} / commute day`}
                  value={input.commuteHoursPerDay}
                  min={0.5}
                  max={12}
                  step={0.5}
                  onChange={set('commuteHoursPerDay')}
                />
              )}
            </CardContent>
          </Card>

          <Card className={CARD}>
            <CardHeader className="pb-4">
              <CardTitle className="text-xs font-mono uppercase tracking-wider font-semibold">Free time</CardTitle>
              <CardDescription className="text-xs font-mono text-muted-foreground tabular-nums">
                {result.freeTimeHours > 0
                  ? `The needs leave ${wholeHours(result.freeTimeHours)} hours a year, about ${upToOnePlace(freeTimePerDay)} hours a day. Choose what goes in them; the rest stays free.`
                  : 'The needs fill the whole year, so nothing is left to choose.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <SliderRow
                label="Exercise days"
                emoji="🏃"
                hint={`NHS minimum: ${NHS_WEEKLY_EXERCISE_MINUTES} minutes a week · yours ${count(result.exerciseMinutesPerWeek, 'minute')}`}
                display={`${count(input.exerciseDaysPerWeek, 'day')} / week`}
                value={input.exerciseDaysPerWeek}
                min={0}
                max={7}
                step={1}
                onChange={set('exerciseDaysPerWeek')}
              />
              <div className="space-y-2">
                <p className="text-xs font-mono text-muted-foreground">Examples, not averages</p>
                <PillGroup
                  label="Example exercise routines"
                  options={[
                    { value: '5x30', label: 'NHS minimum · 5 × 30 mins' },
                    { value: '3x60', label: 'Gym · 3 × 1 hour' },
                  ]}
                  isSelected={(value) => {
                    const [days, minutes] = value.split('x').map(Number);
                    return input.exerciseDaysPerWeek === days && input.exerciseMinutesPerDay === minutes;
                  }}
                  onSelect={(value) => {
                    const [days, minutes] = value.split('x').map(Number);
                    setInput((prev) => ({ ...prev, exerciseDaysPerWeek: days, exerciseMinutesPerDay: minutes }));
                  }}
                />
              </div>
              {input.exerciseDaysPerWeek > 0 && (
                <SliderRow
                  nested
                  label="Time each day"
                  display={`${minutesAndHours(input.exerciseMinutesPerDay)} / day`}
                  value={input.exerciseMinutesPerDay}
                  min={15}
                  max={240}
                  step={15}
                  onChange={set('exerciseMinutesPerDay')}
                />
              )}

              <div className="h-px bg-border/40" />

              <SliderRow
                label="Learning"
                emoji="📚"
                hint="Courses, study, practising a skill"
                display={`${count(input.learningHoursPerWeek, 'hr')} / week`}
                value={input.learningHoursPerWeek}
                min={0}
                max={80}
                step={1}
                onChange={set('learningHoursPerWeek')}
              />
              <SliderRow
                label="Socialising"
                emoji="🥳"
                hint="Friends and family, going out"
                display={`${count(input.friendsHoursPerWeek, 'hr')} / week`}
                value={input.friendsHoursPerWeek}
                min={0}
                max={80}
                step={1}
                onChange={set('friendsHoursPerWeek')}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Visualization & Table */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs font-mono text-muted-foreground">Show in</span>
            <PillGroup<YearTimeUnit>
              label="Show figures in"
              options={UNITS.map((u) => ({ value: u.unit, label: u.label }))}
              isSelected={(value) => value === unit}
              onSelect={setUnit}
            />
          </div>
          <Card className={cn(CARD, 'p-4 sm:p-6 space-y-6')}>
            <div className="flex flex-col md:flex-row lg:flex-col xl:flex-row items-center justify-around gap-6">
              {/* Donut Chart */}
              <div className="w-52 h-52 flex items-center justify-center relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={drawnSlices}
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={88}
                      paddingAngle={3}
                      dataKey="hoursPerYear"
                      stroke="hsl(var(--card))"
                      strokeWidth={1.5}
                    >
                      {drawnSlices.map((slice) => (
                        <Cell key={slice.key} fill={slice.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const slice = payload[0].payload as (typeof slices)[number];
                          return (
                            <div className="bg-popover text-popover-foreground border border-border/40 rounded-lg p-2.5 shadow-md font-mono text-xs space-y-1 max-w-56">
                              <div className="font-bold">{slice.label}</div>
                              <div className="text-muted-foreground">
                                <span className="text-foreground font-semibold tabular-nums">{inUnit(slice.hoursPerYear)}</span>{' '}
                                ({percent(slice.share)})
                              </div>
                              {slice.members.length > 1 && (
                                <div className="text-muted-foreground">
                                  {slice.members.map((key) => ACTIVITY[key].label).join(', ')}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  <span
                    className={cn(
                      'font-mono font-bold tracking-tight text-foreground tabular-nums',
                      // 31,536,000 seconds would not fit the ring at full size.
                      centreFigure.length > 7 ? 'text-lg' : 'text-2xl',
                    )}
                  >
                    <AnimatedNumber
                      value={hoursIn(result.totalHours, unit)}
                      format={amountFormat(hoursIn(result.totalHours, unit))}
                    />
                  </span>
                  <span className="text-xs text-muted-foreground font-mono font-semibold">
                    {unit} {result.overAllocatedHours > 0 ? 'entered' : 'in a year'}
                  </span>
                </div>
              </div>

              {/* Top Highlights */}
              <div className="flex-1 w-full grid grid-cols-2 gap-3">
                {tiles.map((tile) => {
                  const tileValue = hoursIn(tile.hours, unit);
                  return (
                    <div key={tile.label} className="bg-card/40 border border-border/40 rounded-lg p-3.5 text-center space-y-1">
                      <span className="text-xs font-mono text-muted-foreground block">{tile.label}</span>
                      <span className="font-mono text-xl font-bold tracking-tight text-foreground block tabular-nums">
                        <AnimatedNumber value={tileValue} format={amountFormat(tileValue)} />{' '}
                        <span className="text-sm font-semibold text-muted-foreground">{unit}</span>
                      </span>
                      <span className="text-xs font-mono text-muted-foreground tabular-nums">{tile.caption}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 24h Day Timeline Bar */}
            <div className="border-t border-border/40 pt-5 space-y-3">
              <div className="flex justify-between items-center text-xs font-mono font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5 text-primary" /> An average day
                </span>
                <span className="tabular-nums">{total.hoursPerDay.toFixed(1)} hrs accounted for</span>
              </div>

              <div className="w-full h-3 rounded-full overflow-hidden flex bg-muted/20 border border-border/30 gap-0.5 p-0.5">
                {drawnSlices.map((slice) => (
                  <TooltipProvider key={slice.key}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          style={{ width: `${(slice.hoursPerYear / result.totalHours) * 100}%`, backgroundColor: slice.color }}
                          className="h-full rounded-full transition-[width,opacity] duration-200 ease-out hover:opacity-80 cursor-pointer"
                        />
                      </TooltipTrigger>
                      <TooltipContent className="bg-popover text-popover-foreground border border-border/40 rounded-lg p-2.5 shadow-md font-mono text-xs max-w-56">
                        <div className="font-bold mb-1">{slice.label}</div>
                        <div className="space-y-0.5 text-muted-foreground text-xs">
                          <p>Daily: <span className="text-foreground font-semibold tabular-nums">{slice.hoursPerDay.toFixed(1)} hrs</span></p>
                          <p>Weekly: <span className="text-foreground font-semibold tabular-nums">{slice.hoursPerWeek.toFixed(1)} hrs</span></p>
                          <p>Yearly: <span className="text-foreground font-semibold tabular-nums">{slice.hoursPerYear.toFixed(0)} hrs</span></p>
                          {slice.members.length > 1 && <p>{slice.members.map((key) => ACTIVITY[key].label).join(', ')}</p>}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                {slices.map((slice) => (
                  <div key={slice.key} className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                    <span className="text-foreground font-medium">{slice.label}</span>
                    <span className="text-muted-foreground/70 tabular-nums">({slice.hoursPerDay.toFixed(1)}h)</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Free time, and what fills it */}
          <Card className={cn(CARD, 'p-4 sm:p-6 space-y-4 font-mono')}>
            <div className="space-y-1">
              <h4 className="text-xs uppercase tracking-wider font-semibold text-foreground">Your free time</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {result.freeTimeHours > 0 ? (
                  <>
                    After the needs, <span className="text-foreground font-semibold tabular-nums">{inUnit(result.freeTimeHours)}</span>{' '}
                    are yours to choose, {upToOnePlace(freeTimePerDay)} hours on an average day.{' '}
                    {result.fittedHours > 0
                      ? `Exercise, learning and socialising take ${percent(result.fittedShareOfFreeTime)} of it.`
                      : 'Nothing is fitted into it yet.'}
                  </>
                ) : (
                  'The needs fill the whole year, so there is no free time to fit anything into.'
                )}
              </p>
            </div>
            <ul className="space-y-3">
              {freeTime.map((a) => (
                <li key={a.key} className="space-y-1.5">
                  <div className="flex flex-wrap justify-between gap-x-3 text-xs">
                    <span className="text-foreground font-medium">
                      <span aria-hidden="true">{ACTIVITY[a.key].emoji}</span> {ACTIVITY[a.key].label}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      <span className="text-foreground font-semibold">{inUnit(a.hoursPerYear)}</span>
                      {result.freeTimeHours > 0 && ` · ${percent(a.shareOfFreeTime)}`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/20 border border-border/30 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: freeTimeScale > 0 ? `${(a.hoursPerYear / freeTimeScale) * 100}%` : '0%',
                        backgroundColor: colorOf(a.key),
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* Detailed Statistics Table */}
          <Card className={cn(CARD, 'p-4 sm:p-6 font-mono')}>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-foreground mb-4 flex items-center gap-1.5">
              The full breakdown
            </h4>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-xs text-left border-collapse font-mono">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground font-semibold text-xs">
                    <th className="py-2.5 px-3">Activity</th>
                    <th className="py-2.5 px-3 text-right">Average day</th>
                    <th className="py-2.5 px-3 text-right">Average week</th>
                    <th className="py-2.5 px-3 text-right">A year</th>
                    <th className="py-2.5 px-3 text-right">% of Year</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20 text-foreground font-medium">
                  {needs.filter(shown).map(row)}
                  {subtotal('Needs', yearTotal(result.needsHours))}
                  {freeTime.filter(shown).map(row)}
                  {subtotal('Free time', yearTotal(result.fittedAndStillFreeHours))}
                  <tr className="font-bold border-t border-border/60 bg-muted/15 font-mono">
                    <th scope="row" className="py-3 px-3 text-left font-bold">
                      Total
                    </th>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{inUnit(total.hoursPerDay)}</td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{inUnit(total.hoursPerWeek)}</td>
                    <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">{inUnit(total.hoursPerYear)}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{percent(total.share)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs font-mono text-muted-foreground leading-relaxed">
              {result.overAllocatedHours > 0
                ? 'The entered activities exceed the available time, so the average day and week exceed 24 and 168 hours.'
                : 'The average day and week spread the whole year evenly, days off and holidays included, so they add up to 24 and 168 hours.'}
              {work.hoursPerYear > 0 && result.holidayDays > 0 && (
                <>
                  {' '}
                  Work averages {amount(work.hoursPerWeek)} hours a week against a{' '}
                  {upToOnePlace(result.workingWeekHours)}-hour working week because of the{' '}
                  {count(result.holidayDays, 'day')} of bank holidays and leave.
                </>
              )}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

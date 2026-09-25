/**
 * Tax & Income — the Income surface (REHAUL_PLAN.md 7.C).
 *
 * Owns the payroll breakdown, the holiday tracker and the package-benefits
 * dialog. The pay maths comes from useFinanceTotals, shared with Home.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useToast } from '@/hooks/use-toast';
import { useFinanceData, type BreakdownRateMode } from '../FinanceDataContext';
import { MONTH_NAMES, getPlanName } from '../finance-defaults';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FinanceSettings, HalfDay, LeaveType, PackageBenefit, UserHoliday } from '@/features/finance/finance-types';
import { formatGBP } from '@/features/finance/utils/calculations';
import { HALF_DAY, calculateWorkingDaysInRange, formatHolidayDates, getBookedDaysForMonth, getDaysInMonth, getStartDayOfWeek, isHalfDay } from '@/lib/finance';
import { cn } from '@/lib/utils';
import { Calendar, ChevronRight, Gift, Pencil, Plus, PoundSterling, Settings, Trash2 } from 'lucide-react';
import { useFinanceTotals } from '../useFinanceTotals';
import { PayslipsSection } from '../components/PayslipsSection';
import { getNormalizedHolidays } from '../finance-calcs';

interface TaxIncomeSurfaceProps {
  /** Both dialogs still live in the page: Settings is opened from Time Spent
   *  too, and its "Manage Perks" button opens the benefits one. */
  setIsSettingsOpen: (open: boolean) => void;
  isBenefitsDialogOpen: boolean;
  setIsBenefitsDialogOpen: (open: boolean) => void;
}

const HALF_DAY_LABEL: Record<HalfDay, string> = { am: 'morning', pm: 'afternoon' };
const HALF_DAY_BUTTON: Record<HalfDay, string> = { am: 'Morning', pm: 'Afternoon' };

type Period = 'annual' | 'monthly' | 'weekly' | 'daily' | 'hourly';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'annual', label: 'Annual' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'daily', label: 'Daily' },
  { key: 'hourly', label: 'Hourly' },
];

const RATE_MODES: { key: BreakdownRateMode; label: string }[] = [
  { key: 'normal', label: 'Normal' },
  { key: 'including_leave', label: 'Incl. Paid Leave' },
  { key: 'excluding_leave', label: 'Excl. Paid Leave' },
];

const PENSION_TYPE_LABEL: Record<FinanceSettings['pensionType'], string> = {
  net_pay: 'Net pay arrangement',
  salary_sacrifice: 'Salary sacrifice',
  relief_at_source: 'Relief at source',
};

/** One line of the breakdown table. A `total` is ruled off above; the
 *  `result` is the take-home figure the table ends on. */
interface BreakdownRow {
  key: string;
  label: string;
  note?: string;
  rates: Record<Period, number>;
  sign?: '+' | '-';
  tone?: string;
  kind?: 'total' | 'result';
}

function PillSwitch<T extends string>({ label, options, value, onChange, className }: {
  label: string;
  options: { key: T; label: string }[];
  value: T;
  onChange: (value: NoInfer<T>) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('grid w-full grid-flow-col auto-cols-fr sm:flex sm:w-fit bg-muted/20 border border-border/30 rounded-lg p-0.5 gap-0.5 font-mono', className)}>
      {options.map(opt => {
        const isActive = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(opt.key)}
            className={cn(
              'px-1.5 sm:px-2.5 py-1 text-xs leading-tight font-mono rounded-md transition-all sm:whitespace-nowrap',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function TaxIncomeSurface({
  setIsSettingsOpen,
  isBenefitsDialogOpen,
  setIsBenefitsDialogOpen,
}: TaxIncomeSurfaceProps) {
  const { toast } = useToast();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const {
    holidayDefaults,
    paydaySchedule,
    paydayWeekday,
    saveDataToSupabase,
    setSettings,
    settings,
    taxConfig,
    bankHolidaysList,
    bankHolidaysMap,
    breakdownRateMode,
    setBreakdownRateMode,
  } = useFinanceData();

  const {
    results, breakdownRates, breakdownWorkingDays, daysInMonth,
    currentYear, todayDateObj,
  } = useFinanceTotals();

  // Only read when the card is too narrow for all five period columns.
  const [period, setPeriod] = useState<Period>('monthly');

  // £-formatted with no pence: NI thresholds are round pounds, so the ".00"
  // formatGBP always adds is only noise here.
  const formatGBPNoPence = (n: number) => formatGBP(n).replace(/\.00$/, '');

  const { lowerThreshold, upperThreshold, mainRatePercent, upperRatePercent } = taxConfig.nationalInsuranceBands;
  const nationalInsuranceNote = lowerThreshold > 0 && upperThreshold > 0
    ? `${mainRatePercent}% (${formatGBPNoPence(lowerThreshold)}–${formatGBPNoPence(upperThreshold)}), ${upperRatePercent}% above`
    : undefined;

  // Package, then what comes off the salary, then what lands. Take-home is
  // base salary less deductions; employer pension and perks never pass
  // through pay, so the package total is not what the deductions come from.
  const breakdownGroups: BreakdownRow[][] = [
    [
      { key: 'salary', label: 'Base salary', rates: breakdownRates.preTax },
      ...(results.employerPensionRate > 0 ? [{
        key: 'employer-pension', label: `Employer pension (${settings.employerPensionPercent}%)`,
        rates: breakdownRates.employerPension, sign: '+' as const, tone: 'text-positive',
      }] : []),
      ...(results.totalBenefitsValue > 0 ? [{
        key: 'benefits', label: `Benefits & perks (${settings.packageBenefits?.length || 0})`,
        note: (settings.packageBenefits || []).map(b => `${b.emoji || '🎁'} ${b.name}`).join(', '),
        rates: breakdownRates.benefits, sign: '+' as const, tone: 'text-positive',
      }] : []),
      { key: 'package', label: 'Total package', rates: breakdownRates.totalPackage, kind: 'total' },
    ],
    [
      ...(results.personalPensionRate > 0 ? [{
        key: 'pension', label: `Personal pension (${settings.personalPensionPercent}%)`,
        note: PENSION_TYPE_LABEL[settings.pensionType], rates: breakdownRates.pension, sign: '-' as const,
      }] : []),
      ...(results.incomeTax > 0 ? [{ key: 'tax', label: 'Income tax', rates: breakdownRates.tax, sign: '-' as const }] : []),
      ...(results.nationalInsurance > 0 ? [{
        key: 'ni', label: 'National Insurance', note: nationalInsuranceNote,
        rates: breakdownRates.ni, sign: '-' as const,
      }] : []),
      ...(results.studentLoan > 0 ? [{
        key: 'student-loan', label: `Student loan (${getPlanName(settings.studentLoanPlan)})`,
        rates: breakdownRates.studentLoan, sign: '-' as const,
      }] : []),
      {
        key: 'deductions', label: 'Total deductions', rates: breakdownRates.deductions,
        sign: '-', tone: 'text-destructive', kind: 'total',
      },
    ],
    [
      {
        key: 'take-home', label: 'Take-home pay', note: 'Base salary less deductions',
        rates: breakdownRates.postTax, tone: 'text-positive', kind: 'result',
      },
    ],
  ];

  // Benefits & Perks Manager Dialog State
  const [newBenefitName, setNewBenefitName] = useState('');
  const [newBenefitAmount, setNewBenefitAmount] = useState('');
  const [newBenefitType, setNewBenefitType] = useState<'monetary' | 'percentage'>('monetary');
  const [newBenefitEmoji, setNewBenefitEmoji] = useState('🎁');
  const [newBenefitNotes, setNewBenefitNotes] = useState('');

  const handleAddBenefit = () => {
    const amount = parseFloat(newBenefitAmount);
    if (!newBenefitName.trim()) {
      toast({ title: 'Invalid Name', description: 'Please enter a name for the benefit.', variant: 'destructive' });
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter a valid positive amount or percentage.', variant: 'destructive' });
      return;
    }

    const newBenefit: PackageBenefit = {
      id: 'benefit_' + Date.now(),
      name: newBenefitName.trim(),
      amount,
      type: newBenefitType,
      emoji: newBenefitEmoji.trim() || '🎁',
      notes: newBenefitNotes.trim() || undefined
    };

    const updatedBenefits = [...(settings.packageBenefits || []), newBenefit];
    setSettings(prev => ({ ...prev, packageBenefits: updatedBenefits }));

    setNewBenefitName('');
    setNewBenefitAmount('');
    setNewBenefitNotes('');
    toast({ title: 'Benefit Added', description: `${newBenefit.name} added to package.` });
  };

  const performDeleteBenefit = (id: string) => {
    const updatedBenefits = (settings.packageBenefits || []).filter(b => b.id !== id);
    setSettings(prev => ({ ...prev, packageBenefits: updatedBenefits }));
    toast({ title: 'Benefit Removed', description: 'Benefit removed from package.' });
  };

  const handleDeleteBenefit = (id: string) =>
    askDelete({
      name: (settings.packageBenefits || []).find(b => b.id === id)?.name,
      onConfirm: () => performDeleteBenefit(id),
    });

  const handleAddPresetBenefit = (preset: { name: string; amount: number; type: 'monetary' | 'percentage'; emoji: string }) => {
    const newBenefit: PackageBenefit = {
      id: 'benefit_' + Date.now(),
      name: preset.name,
      amount: preset.amount,
      type: preset.type,
      emoji: preset.emoji
    };
    const updatedBenefits = [...(settings.packageBenefits || []), newBenefit];
    setSettings(prev => ({ ...prev, packageBenefits: updatedBenefits }));
    toast({ title: 'Preset Added', description: `${preset.name} added to package.` });
  };

  // Holiday Tracker State (Tax & Income tab)
  const [expandedMonthIdx, setExpandedMonthIdx] = useState<number | null>(null);
  const [inlineBookMonthIdx, setInlineBookMonthIdx] = useState<number | null>(null);
  const [inlineType, setInlineType] = useState<LeaveType>('holiday');
  const [inlineOccasion, setInlineOccasion] = useState('');
  const [inlineStartDate, setInlineStartDate] = useState('');
  const [inlineEndDate, setInlineEndDate] = useState('');
  const [inlineCount, setInlineCount] = useState('1');
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [inlineHalfDay, setInlineHalfDay] = useState<HalfDay | null>(null);

  const inlineIsSingleDay = !!inlineStartDate && inlineStartDate === inlineEndDate;
  const inlineDayIsWorking = inlineIsSingleDay && calculateWorkingDaysInRange(inlineStartDate, inlineStartDate, bankHolidaysList) === 1;

  // A half day survives a date change only while the booking is still one
  // working day; otherwise it becomes a count of whole working days.
  const recountInline = (start: string, end: string) => {
    const workingDays = calculateWorkingDaysInRange(start, end, bankHolidaysList);
    const keepHalf = !!inlineHalfDay && start === end && workingDays === 1;
    if (!keepHalf) setInlineHalfDay(null);
    setInlineCount(String(keepHalf ? HALF_DAY : workingDays));
  };

  const chooseInlineLength = (half: HalfDay | null) => {
    setInlineHalfDay(half);
    setInlineCount(String(half ? HALF_DAY : inlineDayIsWorking ? 1 : 0));
  };

  // Calculate remaining bank holidays
  const getBankHolidaysLeft = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return bankHolidaysList.filter(dateStr => {
      const bhDate = new Date(dateStr);
      bhDate.setHours(0, 0, 0, 0);
      return bhDate.getTime() >= today.getTime();
    }).length;
  };

  const bankHolidaysLeft = getBankHolidaysLeft();
  const currentTaxYear = settings.taxYear || new Date().getFullYear();

  const getHolidaysUsedCount = () => {
    const normalizedHolidays = getNormalizedHolidays(settings, holidayDefaults);
    return normalizedHolidays
      .filter(h => h.type !== 'sick' && new Date(h.startDate).getFullYear() === currentTaxYear)
      .reduce((sum, h) => sum + (h.count || 0), 0);
  };

  const getSickDaysUsedCount = () => {
    const normalizedHolidays = getNormalizedHolidays(settings, holidayDefaults);
    return normalizedHolidays
      .filter(h => h.type === 'sick' && new Date(h.startDate).getFullYear() === currentTaxYear)
      .reduce((sum, h) => sum + (h.count || 0), 0);
  };

  const resetInlineHolidayForm = () => {
    setInlineBookMonthIdx(null);
    setEditingHolidayId(null);
    setInlineType('holiday');
    setInlineOccasion('');
    setInlineStartDate('');
    setInlineEndDate('');
    setInlineCount('1');
    setInlineHalfDay(null);
  };

  const handleStartEditHoliday = (holiday: UserHoliday, monthIdx: number) => {
    setExpandedMonthIdx(monthIdx);
    setInlineBookMonthIdx(monthIdx);
    setEditingHolidayId(holiday.id);
    setInlineType(holiday.type || 'holiday');
    setInlineOccasion(holiday.occasion);
    setInlineStartDate(holiday.startDate);
    setInlineEndDate(holiday.endDate);
    setInlineCount(holiday.count.toString());
    setInlineHalfDay(isHalfDay(holiday) ? holiday.halfDay ?? null : null);
  };

  const handleStartNewHoliday = (monthIdx: number, type: LeaveType = 'holiday') => {
    setInlineBookMonthIdx(monthIdx);
    setEditingHolidayId(null);
    setInlineType(type);
    setInlineOccasion('');
    const year = settings.taxYear || new Date().getFullYear();
    const pad = (n: number) => n.toString().padStart(2, '0');
    setInlineStartDate(`${year}-${pad(monthIdx + 1)}-01`);
    setInlineEndDate(`${year}-${pad(monthIdx + 1)}-01`);
    setInlineCount('1');
    setInlineHalfDay(null);
  };

  const handleSaveInlineHoliday = (monthIdx: number) => {
    const countVal = parseFloat(inlineCount);
    if (!inlineStartDate || !inlineEndDate) {
      toast({ title: 'Missing Dates', description: 'Start and end dates are required.', variant: 'destructive' });
      return;
    }
    if (isNaN(countVal) || countVal < 0) {
      toast({ title: 'Invalid Days Count', description: 'Leave days count must be a non-negative number.', variant: 'destructive' });
      return;
    }

    const normalizedHolidays = getNormalizedHolidays(settings, holidayDefaults);
    const halfDay = inlineIsSingleDay && inlineHalfDay ? inlineHalfDay : undefined;

    const savedHoliday: UserHoliday = {
      id: editingHolidayId || 'hol_' + Date.now(),
      startDate: inlineStartDate,
      endDate: inlineEndDate,
      occasion: inlineOccasion.trim() || (inlineType === 'sick' ? 'Sick Leave' : 'Leave'),
      count: halfDay ? HALF_DAY : countVal,
      type: inlineType,
      ...(halfDay ? { halfDay } : {})
    };

    const updatedHolidaysList = editingHolidayId
      ? normalizedHolidays.map(holiday => holiday.id === editingHolidayId ? savedHoliday : holiday)
      : [...normalizedHolidays, savedHoliday];

    const updatedSettings = {
      ...settings,
      holidaysByUser: updatedHolidaysList
    };

    setSettings(updatedSettings);
    saveDataToSupabase('settings', updatedSettings);

    resetInlineHolidayForm();
    const isSick = inlineType === 'sick';
    toast({
      title: editingHolidayId ? (isSick ? 'Sick leave updated' : 'Leave updated') : (isSick ? 'Sick day recorded' : 'Leave booked'),
      description: `${editingHolidayId ? 'Updated' : 'Successfully recorded'} "${savedHoliday.occasion}".`
    });
  };

  const performDeleteHoliday = (holidayId: string) => {
    const normalizedHolidays = getNormalizedHolidays(settings, holidayDefaults);
    const updatedHolidaysList = normalizedHolidays.filter(h => h.id !== holidayId);

    const updatedSettings = {
      ...settings,
      holidaysByUser: updatedHolidaysList
    };

    setSettings(updatedSettings);
    saveDataToSupabase('settings', updatedSettings);
    if (editingHolidayId === holidayId) {
      resetInlineHolidayForm();
    }
    toast({ title: 'Record deleted', description: 'Leave record has been successfully removed.' });
  };

  const handleDeleteHoliday = (holidayId: string) =>
    askDelete({
      title: 'Delete leave record',
      description: 'Delete this leave entry? This action cannot be undone.',
      onConfirm: () => performDeleteHoliday(holidayId),
    });


  return (
    <>
<div>

  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

    {/* Left Side: Payroll breakdown rate tables */}
    <div className="lg:col-span-8 flex flex-col gap-4">

      {/* Total Compensation Summary Card */}
      <div className="surface-card rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/30 pb-4">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider font-mono font-semibold text-muted-foreground">
              Total Compensation Package
            </span>
            <h2 className="text-2xl sm:text-3xl font-mono font-bold tabular-nums text-foreground tracking-tight">
              {formatGBP(results.totalPackage)}
              <span className="text-xs font-mono font-normal text-muted-foreground ml-2">/ year</span>
            </h2>
            <p className="text-xs text-muted-foreground font-mono">
              Base Salary + Employer Pension ({settings.employerPensionPercent}%) + Benefits & Perks
              {' · '}
              {settings.ukRegion === 'england-and-wales' ? 'England & Wales' : settings.ukRegion === 'scotland' ? 'Scotland' : 'Northern Ireland'} tax rules
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            <Button onClick={() => setIsBenefitsDialogOpen(true)} variant="outline" size="sm" className="h-8 rounded-lg gap-1.5 border-border/40 text-xs font-mono">
              <Gift className="h-3.5 w-3.5 text-primary" /> Benefits ({settings.packageBenefits?.length || 0})
            </Button>
            <Button onClick={() => setIsSettingsOpen(true)} size="sm" className="h-8 rounded-lg gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-mono">
              <Settings className="h-3.5 w-3.5" /> Settings
            </Button>
          </div>
        </div>

        {/* Breakdown Pill Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-muted/20 rounded-lg p-3 border border-border/30">
            <span className="block text-xs font-mono text-muted-foreground uppercase">Base Gross Salary</span>
            <span className="mt-1 block font-mono text-sm font-bold tabular-nums text-foreground">{formatGBP(settings.grossSalary)}</span>
          </div>
          <div className="bg-muted/20 rounded-lg p-3 border border-border/30">
            <span className="block text-xs font-mono text-muted-foreground uppercase">Employer Pension ({settings.employerPensionPercent}%)</span>
            <span className="mt-1 block font-mono text-sm font-bold tabular-nums text-positive">+{formatGBP(results.employerPensionRate)}</span>
          </div>
          <div className="bg-muted/20 rounded-lg p-3 border border-border/30">
            <span className="block text-xs font-mono text-muted-foreground uppercase">Benefits & Perks</span>
            <span className={cn(
              "mt-1 block font-mono text-sm font-bold tabular-nums",
              results.totalBenefitsValue > 0 ? "text-positive" : "text-muted-foreground"
            )}>+{formatGBP(results.totalBenefitsValue)}</span>
          </div>
          <div className="bg-muted/20 rounded-lg p-3 border border-border/30">
            <span className="block text-xs font-mono text-muted-foreground uppercase">Net Take-Home</span>
            <span className="mt-1 block font-mono text-sm font-bold tabular-nums text-positive">{formatGBP(results.netTakeHome)}</span>
          </div>
        </div>
      </div>

      {/* Standard Rates Breakdown */}
      <div className="surface-card rounded-xl border border-border/40 bg-card/50 p-5 sm:p-6 hover:border-border/80 transition-colors">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1 text-left min-w-0">
            <h3 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
              <PoundSterling className="w-4 h-4 text-primary shrink-0" /> Breakdown Rates
            </h3>
            <p className="text-xs text-muted-foreground">
              {settings.ukRegion === 'england-and-wales' ? 'England' : settings.ukRegion} rules, weekends excluded.{' '}
              {breakdownRateMode === 'normal' &&
                `${typeof breakdownWorkingDays === 'number' ? breakdownWorkingDays.toFixed(1) : breakdownWorkingDays} days a year: 52.14 weeks of 5 days, ${settings.workingHoursPerDay} hours each.`}
              {breakdownRateMode === 'including_leave' &&
                `${breakdownWorkingDays} paid days a year, bank holidays and ${settings.workHolidays} days of leave included.`}
              {breakdownRateMode === 'excluding_leave' &&
                `${breakdownWorkingDays} working days a year, bank holidays and ${settings.workHolidays} days of leave excluded.`}
            </p>
          </div>
          <PillSwitch
            label="Days counted"
            options={RATE_MODES}
            value={breakdownRateMode}
            onChange={setBreakdownRateMode}
            className="shrink-0 self-start"
          />
        </div>

        <div className="pay-breakdown mt-6">
          <PillSwitch
            label="Period shown"
            options={PERIODS}
            value={period}
            onChange={setPeriod}
            className="pay-breakdown-periods mb-4"
          />
          <table className="w-full text-sm">
            <caption className="sr-only">Pay by period</caption>
            <thead>
              <tr className="border-b border-border/50 text-xs text-muted-foreground">
                <th scope="col" className="pb-2.5 pr-4 text-left font-normal"><span className="sr-only">Item</span></th>
                {PERIODS.map(p => (
                  <th
                    key={p.key}
                    scope="col"
                    data-period
                    data-active={p.key === period || undefined}
                    className="pb-2.5 pl-4 text-right font-normal whitespace-nowrap"
                  >
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            {breakdownGroups.map((group, groupIdx) => (
              <tbody key={groupIdx}>
                {group.map((row, rowIdx) => {
                  const cell = cn(
                    'py-2 align-top',
                    groupIdx === 0 && rowIdx === 0 && 'pt-3',
                    row.kind === 'total' && 'pt-3',
                    row.kind === 'result' && 'pt-4 text-base',
                    rowIdx === group.length - 1 && groupIdx < breakdownGroups.length - 1 && 'pb-6',
                  );
                  return (
                    <tr
                      key={row.key}
                      className={cn(
                        row.kind === 'total' && 'border-t border-border/40',
                        row.kind === 'result' && 'border-t border-border/70',
                      )}
                    >
                      <th scope="row" className={cn(cell, 'pr-4 text-left text-foreground', row.kind ? 'font-semibold' : 'font-normal')}>
                        {row.label}
                        {row.note && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{row.note}</span>}
                      </th>
                      {PERIODS.map(p => (
                        <td
                          key={p.key}
                          data-period
                          data-active={p.key === period || undefined}
                          className={cn(
                            cell,
                            'pl-4 text-right font-mono tabular-nums whitespace-nowrap',
                            row.tone ?? 'text-foreground',
                            row.kind && 'font-semibold',
                          )}
                        >
                          {row.sign}{formatGBP(row.rates[p.key])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      </div>

      {/* Captured payslips: the figures the deductions above are modelled
          from, as they actually landed (7.7). */}
      <PayslipsSection modelledStudentLoanMonthly={breakdownRates.studentLoan.monthly} />

    </div>

    {/* Right Side: Combined leave balances and holiday tracker */}
    <div className="lg:col-span-4 flex flex-col gap-6">

      <div className="surface-card rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border/30 pb-3">
          <div className="min-w-0">
            <h3 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary shrink-0" /> Holiday Tracker
            </h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">Click a month card to expand details. Book leave inline or remove booked events easily.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-border/30 pb-4">
          <div className="rounded-lg bg-muted/20 border border-border/30 px-3 py-2 text-left font-mono">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Allowance</span>
            <span className="mt-1 block text-sm font-bold text-foreground tabular-nums">
              {settings.workHolidays}
              <span className="ml-1 text-xs font-normal text-muted-foreground">d</span>
            </span>
          </div>
          <div className="rounded-lg bg-muted/20 border border-border/30 px-3 py-2 text-left font-mono">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Left</span>
            <span className="mt-1 block text-sm font-bold text-positive tabular-nums">
              {settings.workHolidays - getHolidaysUsedCount()}
              <span className="ml-1 text-xs font-normal text-muted-foreground">d</span>
            </span>
          </div>
          <div className="rounded-lg bg-muted/20 border border-border/30 px-3 py-2 text-left font-mono">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bank</span>
            <span className="mt-1 block text-sm font-bold text-chart-5 tabular-nums">
              {bankHolidaysLeft}/{settings.bankHolidays}
            </span>
          </div>
          <div className="rounded-lg bg-muted/20 border border-border/30 px-3 py-2 text-left font-mono">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sick</span>
            <span className="mt-1 block text-sm font-bold text-chart-4 tabular-nums">
              {getSickDaysUsedCount()}
              <span className="ml-1 text-xs font-normal text-muted-foreground">d</span>
            </span>
          </div>
        </div>

        {/* Holiday Calendar Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted-foreground px-0.5 border-b border-border/30 pb-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-chart-5/25 border border-chart-5/50" />
            <span className="text-chart-5 font-semibold">Bank Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-positive/25 border border-positive/50" />
            <span className="text-positive font-semibold">Booked Leave</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-chart-4/25 border border-chart-4/50" />
            <span className="text-chart-4 font-semibold">Sick Day</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm border border-dashed border-muted-foreground/60 bg-[linear-gradient(90deg,hsl(var(--muted-foreground)/0.4)_50%,transparent_50%)]" />
            <span>Half Day (AM left, PM right)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-muted/40 border border-border/30" />
            <span>Working Day</span>
          </div>
        </div>

        <TooltipProvider delayDuration={150}>
          <div id="holiday-months-container" className="holiday-scrollbar space-y-4 lg:max-h-[315px] lg:overflow-y-auto lg:pr-3">
            {MONTH_NAMES.map((month, monthIdx) => {
              const daysInMonth = getDaysInMonth(settings.taxYear, monthIdx);
              const startDayOfWeek = getStartDayOfWeek(settings.taxYear, monthIdx);

              const normalizedHolidays = getNormalizedHolidays(settings, holidayDefaults);
              const bookedDaysForMonth = getBookedDaysForMonth(normalizedHolidays, settings.taxYear, monthIdx, bankHolidaysList);

              const monthHolidaysBooked = bookedDaysForMonth.filter(b => b.type !== 'sick').reduce((sum, b) => sum + b.fraction, 0);
              const monthSickDaysBooked = bookedDaysForMonth.filter(b => b.type === 'sick').reduce((sum, b) => sum + b.fraction, 0);

              const isExpanded = expandedMonthIdx === monthIdx;

              // Get overlapping holidays for this month
              const overlappingHolidays = normalizedHolidays.filter(hol => {
                const start = new Date(hol.startDate);
                const end = new Date(hol.endDate);
                if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;

                const startVal = start.getFullYear() * 12 + start.getMonth();
                const endVal = end.getFullYear() * 12 + end.getMonth();
                const currentVal = settings.taxYear * 12 + monthIdx;

                return currentVal >= startVal && currentVal <= endVal;
              });

              return (
                <div
                  key={month}
                  id={`holiday-month-${monthIdx}`}
                  onClick={() => setExpandedMonthIdx(isExpanded ? null : monthIdx)}
                  className={cn(
                    "p-3 rounded-lg bg-muted/20 border border-border/30 flex flex-col transition-all cursor-pointer hover:border-border/60",
                    isExpanded && "border-border/70 bg-muted/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-semibold text-foreground">{month}</span>
                    <div className="flex items-center gap-1.5 text-xs">
                      {monthHolidaysBooked > 0 && (
                        <span className="bg-positive/20 text-positive font-mono text-xs px-1.5 py-0.5 rounded-sm border border-positive/40 font-semibold">
                          {monthHolidaysBooked}d booked
                        </span>
                      )}
                      {monthSickDaysBooked > 0 && (
                        <span className="bg-chart-4/20 text-chart-4 font-mono text-xs px-1.5 py-0.5 rounded-sm border border-chart-4/40 font-semibold">
                          {monthSickDaysBooked}d sick
                        </span>
                      )}
                      <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", isExpanded && "rotate-90")} />
                    </div>
                  </div>

                  {/* Week headers */}
                  <div className="grid grid-cols-7 gap-1 mb-1 text-xs font-mono font-semibold text-muted-foreground text-center">
                    <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
                  </div>

                  {/* Days Grid */}
                  <div className="grid grid-cols-7 gap-x-1 gap-y-1 text-center justify-items-center">
                    {Array.from({ length: startDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className="w-7 h-7 sm:w-6 sm:h-6" />
                    ))}

                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const dayNum = i + 1;
                      const pad = (n: number) => n.toString().padStart(2, '0');
                      const dateStr = `${settings.taxYear}-${pad(monthIdx + 1)}-${pad(dayNum)}`;

                      const isBankHoliday = bankHolidaysList.includes(dateStr);

                      const bookedDay = bookedDaysForMonth.find(b => b.day === dayNum);
                      const isBookedSick = bookedDay?.type === 'sick';
                      const isBookedHoliday = !!bookedDay && !isBookedSick;
                      const bookedHalf = bookedDay?.halfDay;
                      const bookedOccasion = bookedDay?.occasion || (isBookedSick ? 'Sick Leave' : 'Leave');

                      const dateObj = new Date(settings.taxYear, monthIdx, dayNum);
                      const dayOfWeek = dateObj.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                      let cellClass = "w-7 h-7 sm:w-6 sm:h-6 text-xs font-mono flex items-center justify-center rounded-sm font-medium transition-colors ";

                      // A half day fills the half it takes: the left for a morning,
                      // the right for an afternoon.
                      if (isBookedSick) {
                        cellClass += bookedHalf === 'am'
                          ? "text-chart-4 font-bold border border-dashed border-chart-4/60 bg-[linear-gradient(90deg,hsl(var(--chart-4)/0.3)_50%,transparent_50%)]"
                          : bookedHalf === 'pm'
                            ? "text-chart-4 font-bold border border-dashed border-chart-4/60 bg-[linear-gradient(270deg,hsl(var(--chart-4)/0.3)_50%,transparent_50%)]"
                            : "text-chart-4 font-bold bg-chart-4/20 border border-chart-4/50";
                      } else if (isBookedHoliday) {
                        cellClass += bookedHalf === 'am'
                          ? "text-positive font-bold border border-dashed border-positive/60 bg-[linear-gradient(90deg,hsl(var(--positive)/0.3)_50%,transparent_50%)]"
                          : bookedHalf === 'pm'
                            ? "text-positive font-bold border border-dashed border-positive/60 bg-[linear-gradient(270deg,hsl(var(--positive)/0.3)_50%,transparent_50%)]"
                            : "text-positive font-bold bg-positive/20 border border-positive/50";
                      } else if (isBankHoliday) {
                        cellClass += "text-chart-5 font-bold bg-chart-5/20 border border-chart-5/50";
                      } else if (isWeekend) {
                        cellClass += "text-muted-foreground/30";
                      } else {
                        cellClass += "text-foreground hover:bg-muted/40";
                      }

                      const getTooltipDetails = () => {
                        const list = [];
                        if (isBankHoliday) {
                          list.push(`Bank Holiday: ${bankHolidaysMap[dateStr] || 'Public Holiday'}`);
                        }
                        const halfNote = bookedHalf ? ` (${HALF_DAY_LABEL[bookedHalf]})` : '';
                        if (isBookedSick) {
                          list.push(`Sick Day${halfNote}: ${bookedOccasion}`);
                        } else if (isBookedHoliday) {
                          list.push(`Booked Leave${halfNote}: ${bookedOccasion}`);
                        }
                        if (isWeekend) {
                          list.push('Weekend');
                        }
                        if (list.length === 0) {
                          list.push('Working Day');
                        }
                        return list;
                      };

                      return (
                        <Tooltip key={dayNum}>
                          <TooltipTrigger asChild>
                            <div className={cellClass}>
                              {dayNum}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs p-2.5 rounded-lg bg-popover border border-border/60 shadow-md font-mono">
                            <p className="font-bold text-foreground mb-1">{dayNum} {month} {settings.taxYear}</p>
                            <div className="space-y-1 text-muted-foreground font-mono text-xs">
                              {getTooltipDetails().map((detail, idx) => {
                                let colorClass = "text-foreground/80";
                                if (detail.startsWith('Bank Holiday')) {
                                  colorClass = "text-chart-5 font-semibold";
                                } else if (detail.startsWith('Sick Day')) {
                                  colorClass = "text-chart-4 font-semibold";
                                } else if (detail.startsWith('Booked Leave')) {
                                  colorClass = "text-positive font-semibold";
                                } else if (detail === 'Weekend') {
                                  colorClass = "text-muted-foreground/50";
                                }
                                return (
                                  <p key={idx} className={colorClass}>{detail}</p>
                                );
                              })}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>

                  {/* Expanded details section */}
                  {isExpanded && (
                    <div className="border-t border-border/20 mt-3 pt-3 space-y-3">
                      {/* Overlapping Holidays List */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider block">Booked Leave &amp; Sick Days</span>
                        {overlappingHolidays.length > 0 ? (
                          <div className="space-y-1.5">
                            {overlappingHolidays.map(hol => {
                              const isSick = hol.type === 'sick';
                              return (
                                <div
                                  key={hol.id}
                                  onClick={(e) => e.stopPropagation()}
                                  className="border rounded-lg p-2.5 flex items-center justify-between text-xs bg-muted/30 border-border/30"
                                >
                                  <div className="space-y-0.5 min-w-0 pr-2 text-left">
                                    <div className="flex items-center gap-1.5">
                                      <span className={cn(
                                        "text-[10px] uppercase font-mono font-semibold px-1 py-0.5 rounded border",
                                        isSick ? "bg-chart-4/15 text-chart-4 border-chart-4/30" : "bg-positive/15 text-positive border-positive/30"
                                      )}>
                                        {isSick ? '🤒 Sick Day' : '🌴 Holiday'}
                                      </span>
                                      <span className="font-semibold font-mono text-foreground truncate">{hol.occasion}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground block font-mono">
                                      {formatHolidayDates(hol.startDate, hol.endDate)} ({isHalfDay(hol) && hol.halfDay ? `half day, ${HALF_DAY_LABEL[hol.halfDay]}` : `${hol.count} ${hol.count === 1 ? 'day' : 'days'}`})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartEditHoliday(hol, monthIdx);
                                      }}
                                      className="h-7 w-7 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                                      title={isSick ? "Edit sick day" : "Edit holiday"}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteHoliday(hol.id);
                                      }}
                                      className="h-7 w-7 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                      title={isSick ? "Delete entry" : "Delete holiday"}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground font-mono italic text-center py-1">
                            No leave or sick days recorded for this month.
                          </div>
                        )}
                      </div>

                      {/* Add Holiday Button or Form */}
                      {inlineBookMonthIdx === monthIdx ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="bg-muted/30 border border-border/40 rounded-lg p-3 space-y-3 text-left font-mono"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs font-semibold uppercase tracking-wider block text-foreground">
                              {editingHolidayId ? (inlineType === 'sick' ? 'Edit Sick Day' : 'Edit Leave') : (inlineType === 'sick' ? 'Record Sick Day' : 'Book New Leave')}
                            </span>
                            {/* Type selector toggle */}
                            <div className="flex items-center gap-1 p-0.5 bg-background/80 rounded-lg border border-border/40">
                              <button
                                type="button"
                                onClick={() => setInlineType('holiday')}
                                className={cn(
                                  "px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors border",
                                  inlineType === 'holiday'
                                    ? "bg-positive/20 text-positive border-positive/40 font-semibold shadow-xs"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                              >
                                🌴 Holiday
                              </button>
                              <button
                                type="button"
                                onClick={() => setInlineType('sick')}
                                className={cn(
                                  "px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors border",
                                  inlineType === 'sick'
                                    ? "bg-chart-4/20 text-chart-4 border-chart-4/40 font-semibold shadow-xs"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                              >
                                🤒 Sick Day
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="space-y-0.5">
                              <Label className="text-xs text-muted-foreground font-mono">
                                {inlineType === 'sick' ? 'Reason / Notes' : 'Occasion'}
                              </Label>
                              <Input
                                placeholder={inlineType === 'sick' ? 'e.g. Cold / Flu, Migraine, Doctor visit' : 'e.g. Skiing, Paris Trip'}
                                value={inlineOccasion}
                                onChange={(e) => setInlineOccasion(e.target.value)}
                                className="h-8 rounded-lg text-xs border-border/40 bg-background/50 font-mono"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-0.5">
                                <Label className="text-xs text-muted-foreground font-mono">Start Date</Label>
                                <Input
                                  type="date"
                                  value={inlineStartDate}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setInlineStartDate(val);
                                    if (inlineEndDate) recountInline(val, inlineEndDate);
                                  }}
                                  className="h-8 rounded-lg text-xs border-border/40 bg-background/50 font-mono"
                                />
                              </div>
                              <div className="space-y-0.5">
                                <Label className="text-xs text-muted-foreground font-mono">End Date</Label>
                                <Input
                                  type="date"
                                  value={inlineEndDate}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setInlineEndDate(val);
                                    if (inlineStartDate) recountInline(inlineStartDate, val);
                                  }}
                                  className="h-8 rounded-lg text-xs border-border/40 bg-background/50 font-mono"
                                />
                              </div>
                            </div>
                            {inlineIsSingleDay && (
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <Label className="text-xs text-muted-foreground font-mono">Length</Label>
                                <div className="flex items-center gap-1 p-0.5 bg-background/80 rounded-lg border border-border/40">
                                  {([null, 'am', 'pm'] as const).map(half => {
                                    const selected = inlineHalfDay === half;
                                    return (
                                      <button
                                        key={half ?? 'full'}
                                        type="button"
                                        aria-pressed={selected}
                                        disabled={half !== null && !inlineDayIsWorking}
                                        title={half !== null && !inlineDayIsWorking ? 'Not a working day' : undefined}
                                        onClick={() => chooseInlineLength(half)}
                                        className={cn(
                                          "px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors border disabled:opacity-40 disabled:pointer-events-none",
                                          selected
                                            ? "bg-primary/15 text-foreground border-primary/40 font-semibold shadow-xs"
                                            : "border-transparent text-muted-foreground hover:text-foreground"
                                        )}
                                      >
                                        {half ? HALF_DAY_BUTTON[half] : 'Full day'}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            <div className="space-y-0.5">
                              <Label className="text-xs text-muted-foreground font-mono">Days count (working days)</Label>
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                value={inlineCount}
                                disabled={!!inlineHalfDay}
                                onChange={(e) => setInlineCount(e.target.value)}
                                className="h-8 rounded-lg text-xs border-border/40 bg-background/50 font-mono"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-1.5 pt-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={resetInlineHolidayForm}
                              className="h-7 px-2.5 rounded-lg text-xs font-mono"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSaveInlineHoliday(monthIdx)}
                              className="h-7 px-2.5 rounded-lg text-xs bg-primary text-primary-foreground font-mono"
                            >
                              {editingHolidayId ? 'Update' : 'Save'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartNewHoliday(monthIdx, 'holiday');
                            }}
                            className="w-full h-8 rounded-lg text-xs gap-1 border-dashed border-border/40 hover:bg-muted/50 font-mono"
                          >
                            <Plus className="h-3 w-3" /> Book Leave
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartNewHoliday(monthIdx, 'sick');
                            }}
                            className="w-full h-8 rounded-lg text-xs gap-1 border-dashed border-border/40 hover:bg-muted/50 font-mono"
                          >
                            <Plus className="h-3 w-3" /> Record Sick Day
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TooltipProvider>

      </div>

    </div>

  </div>

</div>
<Dialog open={isBenefitsDialogOpen} onOpenChange={setIsBenefitsDialogOpen}>
  <DialogContent className="sm:rounded-xl border border-border/40 bg-card p-6 max-w-lg w-full">
    <DialogHeader>
      <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
        <Gift className="w-4 h-4 text-primary" /> Manage Package Benefits & Perks
      </DialogTitle>
      <DialogDescription className="text-xs text-muted-foreground font-mono">
        Add non-cash benefits, bonuses, allowances, or equity options provided by your employer to track your total compensation package.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-6 pt-2">

      {/* Total Summary */}
      <div className="rounded-lg border border-border/30 bg-muted/20 p-4 flex items-center justify-between font-mono">
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Total Active Benefits</span>
          <span className="font-mono text-xl font-bold text-foreground">
            {formatGBP((settings.packageBenefits || []).reduce((sum, b) => {
              const val = b.type === 'percentage' ? (settings.grossSalary * ((b.amount || 0) / 100)) : (b.amount || 0);
              return sum + (val || 0);
            }, 0))}
            <span className="text-xs font-normal text-muted-foreground ml-1.5">/ year</span>
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-semibold text-primary">{settings.packageBenefits?.length || 0} items added</span>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Quick Presets</Label>
        <div className="flex flex-wrap gap-2">
          {[
            { name: 'Private Medical / Dental', amount: 1500, type: 'monetary' as const, emoji: '🏥' },
            { name: 'Annual Bonus', amount: 10, type: 'percentage' as const, emoji: '🎯' },
            { name: 'Equity / RSUs', amount: 5000, type: 'monetary' as const, emoji: '📈' },
            { name: 'Car Allowance', amount: 3000, type: 'monetary' as const, emoji: '🚗' },
            { name: 'Gym & Wellness', amount: 600, type: 'monetary' as const, emoji: '🏋️' },
            { name: 'Tech / Work Allowance', amount: 1000, type: 'monetary' as const, emoji: '💻' }
          ].map((preset, idx) => (
            <Button
              key={idx}
              type="button"
              variant="outline"
              onClick={() => handleAddPresetBenefit(preset)}
              className="h-8 rounded-lg text-xs gap-1.5 border-border/40 bg-muted/20 hover:bg-muted/40 font-mono"
            >
              <span>{preset.emoji}</span>
              <span>{preset.name}</span>
              <span className="text-xs font-mono text-muted-foreground">
                ({preset.type === 'percentage' ? `${preset.amount}%` : `+£${preset.amount}`})
              </span>
            </Button>
          ))}
        </div>
      </div>

      {/* Add Custom Benefit Form */}
      <div className="rounded-xl border border-border/30 bg-muted/10 p-4 space-y-3 font-mono">
        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-primary" /> Add Benefit or Addition
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground font-mono">Emoji</Label>
            <Input
              value={newBenefitEmoji}
              onChange={(e) => setNewBenefitEmoji(e.target.value)}
              className="h-9 rounded-lg text-center font-emoji border-border/40"
              placeholder="🎁"
            />
          </div>
          <div className="sm:col-span-6 space-y-1">
            <Label className="text-xs text-muted-foreground font-mono">Benefit Name</Label>
            <Input
              value={newBenefitName}
              onChange={(e) => setNewBenefitName(e.target.value)}
              className="h-9 rounded-lg font-mono text-xs border-border/40"
              placeholder="e.g. Health Insurance, Stock Grant"
            />
          </div>
          <div className="sm:col-span-4 space-y-1">
            <Label className="text-xs text-muted-foreground font-mono">Type</Label>
            <Select value={newBenefitType} onValueChange={(val: 'monetary' | 'percentage') => setNewBenefitType(val)}>
              <SelectTrigger className="h-9 rounded-lg font-mono text-xs border-border/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="font-mono text-xs">
                <SelectItem value="monetary">Fixed (£)</SelectItem>
                <SelectItem value="percentage">% of Base Salary</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          <div className="sm:col-span-8 space-y-1">
            <Label className="text-xs text-muted-foreground font-mono">Amount / Value ({newBenefitType === 'percentage' ? '%' : '£ / year'})</Label>
            <Input
              type="number"
              inputMode="decimal"
              step={newBenefitType === 'percentage' ? '0.1' : '1'}
              value={newBenefitAmount}
              onChange={(e) => setNewBenefitAmount(e.target.value)}
              className="h-9 rounded-lg font-mono text-xs border-border/40"
              placeholder={newBenefitType === 'percentage' ? '10' : '2000'}
            />
          </div>
          <div className="sm:col-span-4 flex items-end">
            <Button onClick={handleAddBenefit} className="w-full h-9 rounded-lg gap-1.5 bg-primary text-primary-foreground font-semibold text-xs font-mono">
              <Plus className="w-3.5 h-3.5" /> Add Benefit
            </Button>
          </div>
        </div>
      </div>

      {/* Active Benefits List */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground font-mono">Configured Package Additions</Label>
        <div className="space-y-2">
          {(settings.packageBenefits || []).map((benefit) => {
            const annualVal = benefit.type === 'percentage'
              ? (settings.grossSalary * ((benefit.amount || 0) / 100))
              : (benefit.amount || 0);
            return (
              <div key={benefit.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/40 hover:bg-card/60 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg shrink-0">{benefit.emoji || '🎁'}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold font-mono text-foreground truncate">{benefit.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {benefit.type === 'percentage' ? `${benefit.amount}% of base salary` : 'Fixed annual amount'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="block font-mono text-xs font-bold text-foreground tabular-nums">+{formatGBP(annualVal)}</span>
                    <span className="block font-mono text-xs text-muted-foreground tabular-nums">+{formatGBP(annualVal / 12)}/mo</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteBenefit(benefit.id)}
                    className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          {(!settings.packageBenefits || settings.packageBenefits.length === 0) && (
            <div className="text-center py-6 border border-dashed border-border/40 rounded-lg font-mono">
              <Gift className="w-8 h-8 text-muted-foreground/40 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-muted-foreground">No extra benefits added yet.</p>
              <p className="text-xs text-muted-foreground/80 mt-0.5">Click a quick preset above or enter custom additions to build your total package.</p>
            </div>
          )}
        </div>
      </div>

    </div>

    <DialogFooter className="pt-4 border-t border-border/40">
      <Button onClick={() => setIsBenefitsDialogOpen(false)} className="rounded-lg bg-primary text-primary-foreground font-semibold font-mono text-xs h-8 px-4">
        Done
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
      {deleteDialog}
    </>
  );
}

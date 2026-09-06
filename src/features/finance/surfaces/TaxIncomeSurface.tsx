/**
 * Tax & Income — the Income surface (REHAUL_PLAN.md 7.C).
 *
 * Owns the payroll breakdown, the holiday tracker and the package-benefits
 * dialog. The pay maths comes from useFinanceTotals, shared with Home.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useToast } from '@/hooks/use-toast';
import { useFinanceData } from '../FinanceDataContext';
import { MONTH_NAMES, getPlanName } from '../finance-defaults';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PackageBenefit, UserHoliday } from '@/features/finance/finance-types';
import { formatGBP } from '@/features/finance/utils/calculations';
import { calculateWorkingDaysInRange, formatHolidayDates, getBookedDaysForMonth, getDaysInMonth, getStartDayOfWeek } from '@/lib/finance';
import { cn } from '@/lib/utils';
import { Calendar, ChevronRight, DollarSign, Gift, Info, Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import { useFinanceTotals } from '../useFinanceTotals';
import { getNormalizedHolidays } from '../finance-calcs';

interface TaxIncomeSurfaceProps {
  /** Both dialogs still live in the page: Settings is opened from Time Spent
   *  too, and its "Manage Perks" button opens the benefits one. */
  setIsSettingsOpen: (open: boolean) => void;
  isBenefitsDialogOpen: boolean;
  setIsBenefitsDialogOpen: (open: boolean) => void;
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
    bankHolidaysList,
    bankHolidaysMap,
    includeWorkLeaveInActual,
    setIncludeWorkLeaveInActual,
  } = useFinanceData();

  const {
    results, breakdownRates, breakdownWorkingDays, nextPayday, daysInMonth,
    currentYear, todayDateObj,
  } = useFinanceTotals();

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
  const [inlineOccasion, setInlineOccasion] = useState('');
  const [inlineStartDate, setInlineStartDate] = useState('');
  const [inlineEndDate, setInlineEndDate] = useState('');
  const [inlineCount, setInlineCount] = useState('1');
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);

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

  const getHolidaysUsedCount = () => {
    const normalizedHolidays = getNormalizedHolidays(settings, holidayDefaults);
    return normalizedHolidays.reduce((sum, h) => sum + (h.count || 0), 0);
  };

  const resetInlineHolidayForm = () => {
    setInlineBookMonthIdx(null);
    setEditingHolidayId(null);
    setInlineOccasion('');
    setInlineStartDate('');
    setInlineEndDate('');
    setInlineCount('1');
  };

  const handleStartEditHoliday = (holiday: UserHoliday, monthIdx: number) => {
    setExpandedMonthIdx(monthIdx);
    setInlineBookMonthIdx(monthIdx);
    setEditingHolidayId(holiday.id);
    setInlineOccasion(holiday.occasion);
    setInlineStartDate(holiday.startDate);
    setInlineEndDate(holiday.endDate);
    setInlineCount(holiday.count.toString());
  };

  const handleStartNewHoliday = (monthIdx: number) => {
    setInlineBookMonthIdx(monthIdx);
    setEditingHolidayId(null);
    setInlineOccasion('');
    const year = settings.taxYear || new Date().getFullYear();
    const pad = (n: number) => n.toString().padStart(2, '0');
    setInlineStartDate(`${year}-${pad(monthIdx + 1)}-01`);
    setInlineEndDate(`${year}-${pad(monthIdx + 1)}-01`);
    setInlineCount('1');
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

    const savedHoliday: UserHoliday = {
      id: editingHolidayId || 'hol_' + Date.now(),
      startDate: inlineStartDate,
      endDate: inlineEndDate,
      occasion: inlineOccasion.trim() || 'Leave',
      count: countVal
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
    toast({
      title: editingHolidayId ? 'Leave updated' : 'Leave booked',
      description: `${editingHolidayId ? 'Updated' : 'Successfully booked'} "${savedHoliday.occasion}".`
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
    toast({ title: 'Holiday deleted', description: 'Booked leave has been successfully removed.' });
  };

  const handleDeleteHoliday = (holidayId: string) =>
    askDelete({
      title: 'Delete holiday',
      description: 'Delete this holiday? This action cannot be undone.',
      onConfirm: () => performDeleteHoliday(holidayId),
    });


  return (
    <>
<div>

  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

    {/* Left Side: Payroll breakdown rate tables */}
    <div className="lg:col-span-8 flex flex-col gap-4">

      {/* Total Compensation Summary Card */}
      <div className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors space-y-4">
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
            </p>
          </div>
          <Button
            onClick={() => setIsBenefitsDialogOpen(true)}
            size="sm"
            className="rounded-lg gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8 px-3 font-mono shrink-0 self-start sm:self-center"
          >
            <Gift className="w-3.5 h-3.5" /> Manage Benefits ({settings.packageBenefits?.length || 0})
          </Button>
        </div>

        {/* Breakdown Pill Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-muted/20 rounded-lg p-3 border border-border/30">
            <span className="block text-[11px] font-mono text-muted-foreground uppercase">Base Gross Salary</span>
            <span className="mt-1 block font-mono text-sm font-bold tabular-nums text-foreground">{formatGBP(settings.grossSalary)}</span>
          </div>
          <div className="bg-muted/20 rounded-lg p-3 border border-border/30">
            <span className="block text-[11px] font-mono text-muted-foreground uppercase">Employer Pension ({settings.employerPensionPercent}%)</span>
            <span className="mt-1 block font-mono text-sm font-bold tabular-nums text-foreground">+{formatGBP(results.employerPensionRate)}</span>
          </div>
          <div className="bg-muted/20 rounded-lg p-3 border border-border/30">
            <span className="block text-[11px] font-mono text-muted-foreground uppercase">Benefits & Perks</span>
            <span className="mt-1 block font-mono text-sm font-bold tabular-nums text-foreground">+{formatGBP(results.totalBenefitsValue)}</span>
          </div>
          <div className="bg-muted/20 rounded-lg p-3 border border-border/30">
            <span className="block text-[11px] font-mono text-muted-foreground uppercase">Net Take-Home</span>
            <span className="mt-1 block font-mono text-sm font-bold tabular-nums text-foreground">{formatGBP(results.netTakeHome)}</span>
          </div>
        </div>
      </div>

      {/* Standard Rates Breakdown */}
      <div className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors">
        <div className="flex flex-col gap-3 mb-4 border-b border-border/50 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-0.5 text-left min-w-0">
              <h3 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary shrink-0" /> Breakdown Rates
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                Rules applied ({settings.ukRegion === 'england-and-wales' ? 'England' : settings.ukRegion}, weekends excluded)
              </p>
              <p className="text-xs text-muted-foreground font-mono pt-1">
                {includeWorkLeaveInActual
                  ? `${breakdownWorkingDays} paid days per year — bank holidays and ${settings.workHolidays} days paid leave included.`
                  : `${breakdownWorkingDays} working days per year — bank holidays and ${settings.workHolidays} days paid leave excluded.`}
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5 self-start">
              <Label htmlFor="include-work-leave" className="text-xs font-mono text-muted-foreground cursor-pointer">
                {includeWorkLeaveInActual ? 'Including paid leave' : 'Excluding paid leave'}
              </Label>
              <Switch
                id="include-work-leave"
                checked={includeWorkLeaveInActual}
                onCheckedChange={setIncludeWorkLeaveInActual}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto -mx-1 px-1 scrollbar-thin">
          <table className="min-w-[640px] w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground text-xs uppercase tracking-wider font-mono font-semibold">
                <th className="py-3 pr-4 w-full whitespace-nowrap sticky left-0 z-10 bg-background border-r border-border/40">Category</th>
                <th className="py-3 px-3 text-right w-px whitespace-nowrap">Annual</th>
                <th className="py-3 px-3 text-right w-px whitespace-nowrap">Monthly</th>
                <th className="py-3 px-3 text-right w-px whitespace-nowrap">Weekly</th>
                <th className="py-3 px-3 text-right w-px whitespace-nowrap">Daily</th>
                <th className="py-3 px-3 text-right w-px whitespace-nowrap">Hourly</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20 font-mono text-xs text-foreground">

              {/* Total Package Header Row */}
              <tr className="hover:bg-muted/20 transition-colors font-mono font-bold border-b border-border/40 text-foreground">
                <td className="py-3 pr-4 w-full font-bold text-sm whitespace-nowrap flex items-center gap-1.5 sticky left-0 z-10 bg-background border-r border-border/40">
                  <Gift className="w-4 h-4 text-primary shrink-0" /> Total Compensation Package
                </td>
                <td className="py-3 px-3 text-right w-px font-mono font-bold text-sm tabular-nums whitespace-nowrap">{formatGBP(breakdownRates.totalPackage.annual)}</td>
                <td className="py-3 px-3 text-right w-px font-mono font-bold text-sm tabular-nums whitespace-nowrap">{formatGBP(breakdownRates.totalPackage.monthly)}</td>
                <td className="py-3 px-3 text-right w-px font-mono font-bold text-sm tabular-nums whitespace-nowrap">{formatGBP(breakdownRates.totalPackage.weekly)}</td>
                <td className="py-3 px-3 text-right w-px font-mono font-bold text-sm tabular-nums whitespace-nowrap">{formatGBP(breakdownRates.totalPackage.daily)}</td>
                <td className="py-3 px-3 text-right w-px font-mono font-bold text-sm tabular-nums whitespace-nowrap">{formatGBP(breakdownRates.totalPackage.hourly)}</td>
              </tr>

              {/* Gross Salary */}
              <tr className="hover:bg-muted/10 transition-colors font-medium">
                <td className="py-3 pr-4 w-full font-semibold font-sans text-foreground whitespace-nowrap sticky left-0 z-10 bg-background border-r border-border/40">Gross Base Salary</td>
                <td className="py-3 px-3 text-right w-px font-mono tabular-nums whitespace-nowrap">{formatGBP(breakdownRates.preTax.annual)}</td>
                <td className="py-3 px-3 text-right w-px font-mono tabular-nums whitespace-nowrap">{formatGBP(breakdownRates.preTax.monthly)}</td>
                <td className="py-3 px-3 text-right w-px font-mono tabular-nums whitespace-nowrap">{formatGBP(breakdownRates.preTax.weekly)}</td>
                <td className="py-3 px-3 text-right w-px font-mono tabular-nums whitespace-nowrap">{formatGBP(breakdownRates.preTax.daily)}</td>
                <td className="py-3 px-3 text-right w-px font-mono tabular-nums whitespace-nowrap">{formatGBP(breakdownRates.preTax.hourly)}</td>
              </tr>

              {/* Employer Pension Addition */}
              {results.employerPensionRate > 0 && (
                <tr className="hover:bg-muted/10 transition-colors">
                  <td className="py-3 pr-4 w-full font-sans text-left sticky left-0 z-10 bg-background border-r border-border/40">
                    <div className="flex flex-col justify-center min-w-[120px]">
                      <span className="font-semibold text-foreground">
                        Employer Pension ({settings.employerPensionPercent}%)
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono leading-normal mt-0.5">
                        Employer contribution to pension
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right w-px font-mono text-foreground tabular-nums whitespace-nowrap">+{formatGBP(breakdownRates.employerPension.annual)}</td>
                  <td className="py-3 px-3 text-right w-px font-mono text-foreground tabular-nums whitespace-nowrap">+{formatGBP(breakdownRates.employerPension.monthly)}</td>
                  <td className="py-3 px-3 text-right w-px font-mono text-foreground tabular-nums whitespace-nowrap">+{formatGBP(breakdownRates.employerPension.weekly)}</td>
                  <td className="py-3 px-3 text-right w-px font-mono text-foreground tabular-nums whitespace-nowrap">+{formatGBP(breakdownRates.employerPension.daily)}</td>
                  <td className="py-3 px-3 text-right w-px font-mono text-foreground tabular-nums whitespace-nowrap">+{formatGBP(breakdownRates.employerPension.hourly)}</td>
                </tr>
              )}

              {/* Employer Benefits & Perks Addition */}
              {results.totalBenefitsValue > 0 && (
                <tr className="hover:bg-muted/10 transition-colors">
                  <td className="py-3 pr-4 w-full font-sans text-left sticky left-0 z-10 bg-background border-r border-border/40">
                    <div className="flex flex-col justify-center min-w-[120px]">
                      <span className="font-semibold flex items-center gap-1.5 text-foreground">
                        <Gift className="w-3.5 h-3.5 shrink-0 text-primary" /> Benefits & Perks ({settings.packageBenefits?.length || 0})
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono leading-normal mt-0.5">
                        {(settings.packageBenefits || []).map(b => `${b.emoji || '🎁'} ${b.name}`).join(', ')}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right w-px font-mono tabular-nums whitespace-nowrap">+{formatGBP(breakdownRates.benefits.annual)}</td>
                  <td className="py-3 px-3 text-right w-px font-mono tabular-nums whitespace-nowrap">+{formatGBP(breakdownRates.benefits.monthly)}</td>
                  <td className="py-3 px-3 text-right w-px font-mono tabular-nums whitespace-nowrap">+{formatGBP(breakdownRates.benefits.weekly)}</td>
                  <td className="py-3 px-3 text-right w-px font-mono tabular-nums whitespace-nowrap">+{formatGBP(breakdownRates.benefits.daily)}</td>
                  <td className="py-3 px-3 text-right w-px font-mono tabular-nums whitespace-nowrap">+{formatGBP(breakdownRates.benefits.hourly)}</td>
                </tr>
              )}

              {/* Pension Contributions */}
              {results.personalPensionRate > 0 && (
                <tr className="hover:bg-muted/10 transition-colors text-foreground">
                  <td className="py-3 pr-4 w-full font-sans text-left sticky left-0 z-10 bg-background border-r border-border/40">
                    <div className="flex flex-col justify-center min-w-[120px]">
                      <span className="font-bold text-foreground">Personal Pension ({settings.personalPensionPercent}%)</span>
                      <span className="text-xs text-muted-foreground/90 font-medium leading-normal mt-0.5">
                        {settings.pensionType === 'net_pay' ? 'Net Pay' :
                          settings.pensionType === 'salary_sacrifice' ? 'Salary Sacrifice' :
                            'Relief at Source'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right w-px font-mono tabular-nums text-muted-foreground whitespace-nowrap">-{formatGBP(breakdownRates.pension.annual)}</td>
                  <td className="py-3 px-3 text-right w-px font-mono tabular-nums text-muted-foreground whitespace-nowrap">-{formatGBP(breakdownRates.pension.monthly)}</td>
                  <td className="py-3 px-3 text-right w-px font-mono tabular-nums text-muted-foreground whitespace-nowrap">-{formatGBP(breakdownRates.pension.weekly)}</td>
                  <td className="py-3 px-3 text-right w-px font-mono tabular-nums text-muted-foreground whitespace-nowrap">-{formatGBP(breakdownRates.pension.daily)}</td>
                  <td className="py-3 px-3 text-right w-px font-mono tabular-nums text-muted-foreground whitespace-nowrap">-{formatGBP(breakdownRates.pension.hourly)}</td>
                </tr>
              )}

              {/* Income Tax */}
              {results.incomeTax > 0 && (
                <tr className="hover:bg-muted/10 transition-colors text-foreground">
                  <td className="py-3 pr-4 w-full font-sans font-bold text-foreground whitespace-nowrap sticky left-0 z-10 bg-background border-r border-border/40">Income Tax</td>
                  <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono tabular-nums text-muted-foreground">-{formatGBP(breakdownRates.tax.annual)}</td>
                  <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono tabular-nums text-muted-foreground">-{formatGBP(breakdownRates.tax.monthly)}</td>
                  <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono tabular-nums text-muted-foreground">-{formatGBP(breakdownRates.tax.weekly)}</td>
                  <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono tabular-nums text-muted-foreground">-{formatGBP(breakdownRates.tax.daily)}</td>
                  <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono tabular-nums text-muted-foreground">-{formatGBP(breakdownRates.tax.hourly)}</td>
                </tr>
              )}

              {/* National Insurance */}
              {results.nationalInsurance > 0 && (
                <tr className="hover:bg-muted/10 transition-colors text-foreground">
                  <td className="py-3 pr-4 w-full font-sans text-left sticky left-0 z-10 bg-background border-r border-border/40">
                    <div className="flex flex-col justify-center min-w-[120px]">
                      <span className="font-bold text-foreground">National Insurance</span>
                      <span className="text-xs text-muted-foreground/90 font-medium leading-normal mt-0.5">
                        8% (£12,570-£50,270), 2% above
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono tabular-nums text-muted-foreground">-{formatGBP(breakdownRates.ni.annual)}</td>
                  <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono tabular-nums text-muted-foreground">-{formatGBP(breakdownRates.ni.monthly)}</td>
                  <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono tabular-nums text-muted-foreground">-{formatGBP(breakdownRates.ni.weekly)}</td>
                  <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono tabular-nums text-muted-foreground">-{formatGBP(breakdownRates.ni.daily)}</td>
                  <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono tabular-nums text-muted-foreground">-{formatGBP(breakdownRates.ni.hourly)}</td>
                </tr>
              )}

              {/* Student Loan */}
              {results.studentLoan > 0 && (
                <tr className="hover:bg-muted/10 transition-colors text-foreground">
                  <td className="py-3 pr-4 w-full font-sans font-bold text-foreground whitespace-nowrap sticky left-0 z-10 bg-background border-r border-border/40">Student Loan ({getPlanName(settings.studentLoanPlan)})</td>
                  <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono tabular-nums text-muted-foreground">-{formatGBP(breakdownRates.studentLoan.annual)}</td>
                  <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono tabular-nums text-muted-foreground">-{formatGBP(breakdownRates.studentLoan.monthly)}</td>
                  <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono tabular-nums text-muted-foreground">-{formatGBP(breakdownRates.studentLoan.weekly)}</td>
                  <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono tabular-nums text-muted-foreground">-{formatGBP(breakdownRates.studentLoan.daily)}</td>
                  <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono tabular-nums text-muted-foreground">-{formatGBP(breakdownRates.studentLoan.hourly)}</td>
                </tr>
              )}

              {/* Total Deductions */}
              <tr className="hover:bg-muted/10 transition-colors font-mono text-muted-foreground">
                <td className="py-3 pr-4 w-full font-bold whitespace-nowrap sticky left-0 z-10 bg-background border-r border-border/40">Total Deductions</td>
                <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono font-bold tabular-nums">-{formatGBP(breakdownRates.deductions.annual)}</td>
                <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono font-bold tabular-nums">-{formatGBP(breakdownRates.deductions.monthly)}</td>
                <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono font-bold tabular-nums">-{formatGBP(breakdownRates.deductions.weekly)}</td>
                <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono font-bold tabular-nums">-{formatGBP(breakdownRates.deductions.daily)}</td>
                <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono font-bold tabular-nums">-{formatGBP(breakdownRates.deductions.hourly)}</td>
              </tr>

              {/* Take Home Pay */}
              <tr className="hover:bg-muted/20 transition-colors border-t border-border/40 font-mono font-bold text-foreground">
                <td className="py-3 pr-4 w-full font-bold text-sm whitespace-nowrap sticky left-0 z-10 bg-background border-r border-border/40">Take-Home Pay</td>
                <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono font-bold text-sm tabular-nums text-foreground">{formatGBP(breakdownRates.postTax.annual)}</td>
                <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono font-bold text-sm tabular-nums text-foreground">{formatGBP(breakdownRates.postTax.monthly)}</td>
                <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono font-bold text-sm tabular-nums text-foreground">{formatGBP(breakdownRates.postTax.weekly)}</td>
                <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono font-bold text-sm tabular-nums text-foreground">{formatGBP(breakdownRates.postTax.daily)}</td>
                <td className="py-3 px-3 text-right w-px whitespace-nowrap font-mono font-bold text-sm tabular-nums text-foreground">{formatGBP(breakdownRates.postTax.hourly)}</td>
              </tr>

            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-card/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between hover:border-border/80 transition-colors">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground">Settings & Package Options</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {settings.ukRegion === 'england-and-wales' ? 'England & Wales' : settings.ukRegion === 'scotland' ? 'Scotland' : 'Northern Ireland'} tax rules, employer pension ({settings.employerPensionPercent}%), and package benefits.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <Button onClick={() => setIsBenefitsDialogOpen(true)} variant="outline" size="sm" className="h-8 rounded-lg gap-1.5 border-border/40 text-xs font-mono">
            <Gift className="h-3.5 w-3.5 text-primary" /> Benefits ({settings.packageBenefits?.length || 0})
          </Button>
          <Button onClick={() => setIsSettingsOpen(true)} size="sm" className="h-8 rounded-lg gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-mono shrink-0">
            <Settings className="h-3.5 w-3.5" /> Settings
          </Button>
        </div>
      </div>

    </div>

    {/* Right Side: Combined leave balances and holiday tracker */}
    <div className="lg:col-span-4 flex flex-col gap-6">

      <div className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border/30 pb-3">
          <div className="min-w-0">
            <h3 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary shrink-0" /> Holiday Tracker
            </h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">Click a month card to expand details. Book leave inline or remove booked events easily.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 border-b border-border/30 pb-4">
          <div className="rounded-lg bg-muted/20 border border-border/30 px-3 py-2 text-left font-mono">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Allowance</span>
            <span className="mt-1 block text-sm font-bold text-foreground tabular-nums">
              {settings.workHolidays}
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">d</span>
            </span>
          </div>
          <div className="rounded-lg bg-muted/20 border border-border/30 px-3 py-2 text-left font-mono">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Left</span>
            <span className="mt-1 block text-sm font-bold text-foreground tabular-nums">
              {settings.workHolidays - getHolidaysUsedCount()}
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">d</span>
            </span>
          </div>
          <div className="rounded-lg bg-muted/20 border border-border/30 px-3 py-2 text-left font-mono">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bank</span>
            <span className="mt-1 block text-sm font-bold text-foreground tabular-nums">
              {bankHolidaysLeft}/{settings.bankHolidays}
            </span>
          </div>
        </div>

        <TooltipProvider delayDuration={150}>
          <div id="holiday-months-container" className="holiday-scrollbar space-y-4 max-h-[330px] overflow-y-auto pr-3 lg:max-h-[315px]">
            {MONTH_NAMES.map((month, monthIdx) => {
              const daysInMonth = getDaysInMonth(settings.taxYear, monthIdx);
              const startDayOfWeek = getStartDayOfWeek(settings.taxYear, monthIdx);

              const normalizedHolidays = getNormalizedHolidays(settings, holidayDefaults);
              const bookedDaysForMonth = getBookedDaysForMonth(normalizedHolidays, settings.taxYear, monthIdx, bankHolidaysList);

              // Sum up the working days (excl. weekends & bank holidays) booked in this specific month
              const monthWorkingDaysBooked = bookedDaysForMonth.length;

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
                      {monthWorkingDaysBooked > 0 && (
                        <span className="bg-muted/40 text-foreground font-mono text-[11px] px-1.5 py-0.5 rounded border border-border/30">
                          {monthWorkingDaysBooked}d booked
                        </span>
                      )}
                      <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-200", isExpanded && "rotate-90")} />
                    </div>
                  </div>

                  {/* Week headers */}
                  <div className="grid grid-cols-7 gap-1 mb-1 text-[11px] font-mono font-semibold text-muted-foreground text-center">
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

                      const isBookedHoliday = bookedDaysForMonth.some(b => b.day === dayNum);
                      const bookedOccasion = bookedDaysForMonth.find(b => b.day === dayNum)?.occasion || 'Leave';

                      const dateObj = new Date(settings.taxYear, monthIdx, dayNum);
                      const dayOfWeek = dateObj.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                      let cellClass = "w-7 h-7 sm:w-6 sm:h-6 text-xs font-mono flex items-center justify-center rounded font-medium ";

                      if (isBookedHoliday) {
                        cellClass += "text-foreground font-bold bg-primary/25 border border-primary/40";
                      } else if (isBankHoliday) {
                        cellClass += "text-foreground font-semibold bg-muted/60";
                      } else if (isWeekend) {
                        cellClass += "text-muted-foreground/30";
                      } else {
                        cellClass += "text-foreground";
                      }

                      const getTooltipDetails = () => {
                        const list = [];
                        if (isBankHoliday) {
                          list.push(`Bank Holiday: ${bankHolidaysMap[dateStr] || 'Public Holiday'}`);
                        }
                        if (isBookedHoliday) {
                          list.push(`Booked Leave: ${bookedOccasion}`);
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
                            <div className="space-y-1 text-muted-foreground font-mono text-[11px]">
                              {getTooltipDetails().map((detail, idx) => {
                                let colorClass = "text-foreground/80";
                                if (detail.startsWith('Bank Holiday') || detail.startsWith('Booked Leave')) {
                                  colorClass = "text-foreground font-semibold";
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
                        <span className="text-[11px] font-mono font-semibold text-muted-foreground uppercase tracking-wider block">Booked Leave</span>
                        {overlappingHolidays.length > 0 ? (
                          <div className="space-y-1.5">
                            {overlappingHolidays.map(hol => (
                              <div
                                key={hol.id}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-muted/30 border border-border/30 rounded-lg p-2.5 flex items-center justify-between text-xs"
                              >
                                <div className="space-y-0.5 min-w-0 pr-2 text-left">
                                  <span className="font-semibold font-mono text-foreground block truncate">{hol.occasion}</span>
                                  <span className="text-[11px] text-muted-foreground block font-mono">
                                    {formatHolidayDates(hol.startDate, hol.endDate)} ({hol.count} {hol.count === 1 ? 'day' : 'days'})
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
                                    title="Edit holiday"
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
                                    title="Delete holiday"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground font-mono italic text-center py-1">
                            No leave booked for this month.
                          </div>
                        )}
                      </div>

                      {/* Add Holiday Button or Form */}
                      {inlineBookMonthIdx === monthIdx ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="bg-muted/30 border border-border/40 rounded-lg p-3 space-y-3 text-left font-mono"
                        >
                          <span className="text-xs font-semibold uppercase tracking-wider block text-foreground">
                            {editingHolidayId ? 'Edit Leave' : 'Book New Leave'}
                          </span>
                          <div className="space-y-2">
                            <div className="space-y-0.5">
                              <Label className="text-xs text-muted-foreground font-mono">Occasion</Label>
                              <Input
                                placeholder="e.g. Skiing, Paris Trip"
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
                                    if (inlineEndDate) {
                                      const workingDays = calculateWorkingDaysInRange(val, inlineEndDate, bankHolidaysList);
                                      setInlineCount(workingDays.toString());
                                    }
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
                                    if (inlineStartDate) {
                                      const workingDays = calculateWorkingDaysInRange(inlineStartDate, val, bankHolidaysList);
                                      setInlineCount(workingDays.toString());
                                    }
                                  }}
                                  className="h-8 rounded-lg text-xs border-border/40 bg-background/50 font-mono"
                                />
                              </div>
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-xs text-muted-foreground font-mono">Days count (working days)</Label>
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                value={inlineCount}
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartNewHoliday(monthIdx);
                          }}
                          className="w-full h-8 rounded-lg text-xs gap-1 border-dashed border-border/40 hover:bg-muted/50 font-mono"
                        >
                          <Plus className="h-3 w-3" /> Book Leave
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TooltipProvider>

      </div>

      {/* Card 2: Payday Details */}
      <div className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border/30 pb-3">
          <div className="min-w-0">
            <h3 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary shrink-0" /> Payday Details
            </h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">Your configured payday schedule and next expected pay date.</p>
          </div>
        </div>

        <div className="space-y-3.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-medium">Schedule Type</span>
            <span className="font-semibold text-foreground capitalize">
              {settings.paydaySchedule === 'monthly_date' && `Monthly (${settings.payDayOfMonth || 25}th)`}
              {settings.paydaySchedule === 'last_working_day' && 'Last Working Day'}
              {settings.paydaySchedule === 'last_friday' && 'Last Friday of Month'}
              {settings.paydaySchedule === 'biweekly' && 'Bi-weekly (Every 2 weeks)'}
              {settings.paydaySchedule === 'weekly' && `Weekly (${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][settings.paydayWeekday ?? 5]}s)`}
              {settings.paydaySchedule === 'semimonthly' && 'Semi-monthly (15th & Last working day)'}
              {!settings.paydaySchedule && `Monthly (${settings.payDayOfMonth || 25}th)`}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-medium">Next Payday</span>
            <span className="font-semibold text-foreground">
              {nextPayday.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-medium">Status</span>
            <span className={cn(
              "font-mono px-2 py-0.5 rounded-lg font-bold text-xs",
              nextPayday.daysRemaining === 0 ? "bg-positive/10 text-positive" : "bg-muted/60 text-muted-foreground"
            )}>
              {nextPayday.daysRemaining === 0 ? "Paid today!" : `${nextPayday.daysRemaining} days left`}
            </span>
          </div>

          {nextPayday.adjusted && (
            <div className="rounded-lg bg-muted/30 border border-border/30 p-2.5 text-xs text-muted-foreground flex items-start gap-1.5 leading-normal font-mono">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
              <span>
                Adjusted to working day before due to {nextPayday.adjustReason === 'weekend' ? 'a weekend' : 'a bank holiday'}.
              </span>
            </div>
          )}
        </div>
      </div>

    </div>

  </div>

</div>
<Dialog open={isBenefitsDialogOpen} onOpenChange={setIsBenefitsDialogOpen}>
  <DialogContent className="sm:rounded-xl border border-border/40 bg-card p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
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
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {(settings.packageBenefits || []).map((benefit) => {
            const annualVal = benefit.type === 'percentage'
              ? (settings.grossSalary * ((benefit.amount || 0) / 100))
              : (benefit.amount || 0);
            return (
              <div key={benefit.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/40 hover:bg-card/80 transition-colors">
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

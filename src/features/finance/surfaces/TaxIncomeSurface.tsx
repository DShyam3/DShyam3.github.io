/**
 * Tax & Income — the Income surface (REHAUL_PLAN.md 7.C).
 *
 * Owns the payroll breakdown, the holiday tracker and the package-benefits
 * dialog. The pay maths comes from useFinanceTotals, shared with Home.
 */

import { useEffect, useMemo, useState } from 'react';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useToast } from '@/hooks/use-toast';
import { useFinanceData, type BreakdownRateMode } from '../FinanceDataContext';
import { MONTH_NAMES, getPlanName } from '../finance-defaults';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FinanceSettings, HalfDay, LeaveType, PackageBenefit, PackageBenefitKind, UserHoliday } from '@/features/finance/finance-types';
import { formatGBP } from '@/features/finance/utils/calculations';
import {
  BIRTHDAY_LEAVE_RULES,
  BIRTHDAY_LEAVE_RULE_LABELS,
  HALF_DAY,
  OPTIMAL_LEAVE_BIASES,
  OPTIMAL_LEAVE_BIAS_LABELS,
  UK_EMPLOYEE_NI,
  UK_STATUTORY_PERSONAL_ALLOWANCE,
  adjustHolidayCountForBirthday,
  hasBirthdaySickOverlap,
  calculateWorkingDaysInRange,
  calendarParts,
  findBirthdayDayForHolidayRange,
  findHolidayCoveringDate,
  formatDatesToBookUk,
  formatHolidayDates,
  formatUkDate,
  getBirthdayLeaveWindow,
  getBookedDaysForMonth,
  getDaysInMonth,
  getStartDayOfWeek,
  isHalfDay,
  planOptimalHolidays,
  removeHolidayWithBirthdayRestoration,
  resolveBankHolidaysForYear,
  toISODate,
  validateBirthdayLeaveBooking,
  type BirthdayLeaveRule,
  type OptimalHolidayBridge,
  type OptimalLeaveBias,
} from '@/lib/finance';
import { cn } from '@/lib/utils';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Gift, Pencil, Plus, PoundSterling, Settings, Sparkles, Trash2 } from 'lucide-react';
import { useFinanceTotals } from '../useFinanceTotals';
import { PayslipsSection } from '../components/PayslipsSection';
import { PillSwitch } from '../components/PillSwitch';
import { TakeHomeSlices } from '../components/TakeHomeSlices';
import { benefitValueOf, getNormalizedHolidays } from '../finance-calcs';

interface TaxIncomeSurfaceProps {
  /** Both dialogs still live in the page: Settings is opened from Time Spent
   *  too, and its "Manage Perks" button opens the benefits one. */
  setIsSettingsOpen: (open: boolean) => void;
  isBenefitsDialogOpen: boolean;
  setIsBenefitsDialogOpen: (open: boolean) => void;
}

/** Past this many bridges the Maximiser lists only the recommended ones. */
const MAX_INLINE_BRIDGES = 5;

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

const BENEFIT_PRESETS = [
  { key: 'custom', label: '✨ Custom Benefit', name: '', amount: '', type: 'monetary' as const, emoji: '🎁', notes: '', kind: 'benefit-in-kind' as const },
  { key: 'annual_bonus', label: '🎯 Annual Bonus (default 10%)', name: 'Annual Bonus', amount: '10', type: 'percentage' as const, emoji: '🎯', notes: 'Performance / annual target bonus', kind: 'cash' as const },
  { key: 'private_medical', label: '🏥 Private Medical Insurance', name: 'Private Medical Insurance', amount: '1500', type: 'monetary' as const, emoji: '🏥', notes: 'Taxable Benefit in Kind (P11D)', kind: 'benefit-in-kind' as const },
  { key: 'dental', label: '🦷 Dental Cover', name: 'Dental Cover', amount: '400', type: 'monetary' as const, emoji: '🦷', notes: 'Taxable Benefit in Kind (P11D)', kind: 'benefit-in-kind' as const },
  { key: 'travel_insurance', label: '✈️ Travel Insurance', name: 'Travel Insurance', amount: '350', type: 'monetary' as const, emoji: '✈️', notes: 'Employer travel cover (P11D)', kind: 'benefit-in-kind' as const },
  { key: 'equity_rsus', label: '📈 Equity / RSUs', name: 'Equity / RSUs', amount: '5000', type: 'monetary' as const, emoji: '📈', notes: 'Annual stock / RSU grant', kind: 'cash' as const },
  { key: 'car_allowance', label: '🚗 Car Allowance', name: 'Car Allowance', amount: '3000', type: 'monetary' as const, emoji: '🚗', notes: 'Annual car allowance', kind: 'cash' as const },
  { key: 'gym_wellness', label: '🏋️ Gym & Wellness', name: 'Gym & Wellness', amount: '600', type: 'monetary' as const, emoji: '🏋️', notes: 'Wellness / gym subsidy', kind: 'benefit-in-kind' as const },
  { key: 'tech_wfh', label: '💻 Tech / WFH Allowance', name: 'Tech / WFH Allowance', amount: '1000', type: 'monetary' as const, emoji: '💻', notes: 'Equipment / home office stipend', kind: 'cash' as const },
] as const;

const BENEFIT_KINDS = [
  { key: 'cash', label: 'Cash' },
  { key: 'benefit-in-kind', label: 'Benefit in kind' },
] as const satisfies readonly { key: PackageBenefitKind; label: string }[];

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

export default function TaxIncomeSurface({
  setIsSettingsOpen,
  isBenefitsDialogOpen,
  setIsBenefitsDialogOpen,
}: TaxIncomeSurfaceProps) {
  const { toast } = useToast();
  const { askDelete, deleteDialog } = useDeleteConfirm();
  const {
    holidayDefaults,
    saveDataToSupabase,
    setSettings,
    settings,
    bankHolidaysList: settingsYearBankHolidays,
    bankHolidaysMap: settingsYearBankHolidaysMap,
    profileId,
    breakdownRateMode,
    setBreakdownRateMode,
  } = useFinanceData();

  const {
    results, breakdownRates, breakdownWorkingDays,
  } = useFinanceTotals();

  // Only read when the card is too narrow for all five period columns.
  const [period, setPeriod] = useState<Period>('monthly');

  // £-formatted with no pence: NI thresholds are round pounds, so the ".00"
  // formatGBP always adds is only noise here.
  const formatGBPNoPence = (n: number) => formatGBP(n).replace(/\.00$/, '');

  // From the engine's own rates, which are what the figure uses.
  const nationalInsuranceNote =
    `${UK_EMPLOYEE_NI.mainRate * 100}% (${formatGBPNoPence(UK_EMPLOYEE_NI.lowerThreshold)}–${formatGBPNoPence(UK_EMPLOYEE_NI.upperThreshold)}), ${UK_EMPLOYEE_NI.upperRate * 100}% above`;

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
      ...(results.benefitTaxDeduction > 0 ? [{
        key: 'benefit-tax',
        label: 'Benefit-in-kind tax',
        note: (settings.packageBenefits || [])
          .filter(b => b.kind !== 'cash')
          .map(b => `${b.emoji || '🎁'} ${b.name}`)
          .join(', '),
        rates: breakdownRates.benefitTax,
        sign: '-' as const,
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
  const [selectedBenefitPreset, setSelectedBenefitPreset] = useState<string>('custom');
  const [editingBenefitId, setEditingBenefitId] = useState<string | null>(null);
  const [newBenefitName, setNewBenefitName] = useState('');
  const [newBenefitAmount, setNewBenefitAmount] = useState('');
  const [newBenefitType, setNewBenefitType] = useState<'monetary' | 'percentage'>('monetary');
  const [newBenefitEmoji, setNewBenefitEmoji] = useState('🎁');
  const [newBenefitNotes, setNewBenefitNotes] = useState('');
  const [newBenefitKind, setNewBenefitKind] = useState<PackageBenefitKind>('benefit-in-kind');

  const resetBenefitForm = () => {
    setSelectedBenefitPreset('custom');
    setEditingBenefitId(null);
    setNewBenefitName('');
    setNewBenefitAmount('');
    setNewBenefitType('monetary');
    setNewBenefitEmoji('🎁');
    setNewBenefitNotes('');
    setNewBenefitKind('benefit-in-kind');
  };

  const handleSelectBenefitPreset = (presetKey: string) => {
    setSelectedBenefitPreset(presetKey);
    const preset = BENEFIT_PRESETS.find(p => p.key === presetKey);
    if (!preset) return;
    setNewBenefitEmoji(preset.emoji);
    setNewBenefitName(preset.name);
    setNewBenefitType(preset.type);
    setNewBenefitAmount(preset.amount);
    setNewBenefitNotes(preset.notes);
    setNewBenefitKind(preset.kind);
  };

  const handleStartEditBenefit = (benefit: PackageBenefit) => {
    setEditingBenefitId(benefit.id);
    setSelectedBenefitPreset('custom');
    setNewBenefitName(benefit.name);
    setNewBenefitAmount(String(benefit.amount));
    setNewBenefitType(benefit.type);
    setNewBenefitEmoji(benefit.emoji || '🎁');
    setNewBenefitNotes(benefit.notes || '');
    setNewBenefitKind(benefit.kind ?? 'benefit-in-kind');
  };

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

    const savedBenefit: PackageBenefit = {
      id: editingBenefitId || 'benefit_' + Date.now(),
      name: newBenefitName.trim(),
      amount,
      type: newBenefitType,
      emoji: newBenefitEmoji.trim() || '🎁',
      notes: newBenefitNotes.trim() || undefined,
      // The tax is worked out from the kind, so a typed figure is not kept.
      kind: newBenefitKind,
    };

    const existingList = settings.packageBenefits || [];
    const updatedBenefits = editingBenefitId
      ? existingList.map(b => (b.id === editingBenefitId ? savedBenefit : b))
      : [...existingList, savedBenefit];
    const updatedSettings: FinanceSettings = { ...settings, packageBenefits: updatedBenefits };
    setSettings(updatedSettings);
    void saveDataToSupabase('settings', updatedSettings);

    const wasEditing = Boolean(editingBenefitId);
    resetBenefitForm();
    toast({
      title: wasEditing ? 'Benefit Updated' : 'Benefit Added',
      description: `${savedBenefit.name} ${wasEditing ? 'updated in' : 'added to'} package.`,
    });
  };

  const performDeleteBenefit = (id: string) => {
    const updatedBenefits = (settings.packageBenefits || []).filter(b => b.id !== id);
    const updatedSettings: FinanceSettings = { ...settings, packageBenefits: updatedBenefits };
    setSettings(updatedSettings);
    void saveDataToSupabase('settings', updatedSettings);
    if (editingBenefitId === id) {
      resetBenefitForm();
    }
    toast({ title: 'Benefit Removed', description: 'Benefit removed from package.' });
  };

  const handleDeleteBenefit = (id: string) =>
    askDelete({
      name: (settings.packageBenefits || []).find(b => b.id === id)?.name,
      onConfirm: () => performDeleteBenefit(id),
    });

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
  const [inlineUseBirthdayDay, setInlineUseBirthdayDay] = useState<boolean>(false);

  // The leave year the tracker is showing. Browsing is local: settings.taxYear
  // also sets the bank-holiday and weekend counts behind the pay rates, so only
  // the Settings dialog writes it. The pick lapses when the profile or that
  // setting changes, which sends the tracker back to the saved year.
  const settingsYear = settings.taxYear || new Date().getFullYear();
  const yearAnchor = `${profileId ?? ''}:${settingsYear}`;
  const [browsedYear, setBrowsedYear] = useState<{ anchor: string; year: number } | null>(null);
  const currentTaxYear = browsedYear?.anchor === yearAnchor ? browsedYear.year : settingsYear;
  // gov.uk's dates for the saved year when they have landed; every other year,
  // and the moment before they land, is the computed list for the user's region.
  const { dates: bankHolidaysList, map: bankHolidaysMap } = useMemo(
    () =>
      resolveBankHolidaysForYear(
        currentTaxYear,
        settings.ukRegion || 'england-and-wales',
        settingsYearBankHolidays,
        settingsYearBankHolidaysMap,
      ),
    [currentTaxYear, settings.ukRegion, settingsYearBankHolidays, settingsYearBankHolidaysMap],
  );
  const todayIso = toISODate(new Date());
  const realCurrentYear = new Date().getFullYear();
  const realCurrentMonth = new Date().getMonth();

  const inlineIsSingleDay = !!inlineStartDate && inlineStartDate === inlineEndDate;
  const inlineDayIsWorking = inlineIsSingleDay && calculateWorkingDaysInRange(inlineStartDate, inlineStartDate, bankHolidaysList) === 1;
  const inlineWorkingDays =
    inlineStartDate && inlineEndDate
      ? calculateWorkingDaysInRange(inlineStartDate, inlineEndDate, bankHolidaysList)
      : 0;
  const inlineEligibleBdayDate =
    settings.birthdayLeaveEnabled && inlineWorkingDays > 1 && inlineStartDate && inlineEndDate
      ? findBirthdayDayForHolidayRange(
          inlineStartDate,
          inlineEndDate,
          currentTaxYear,
          settings.birthdayLeaveRule || 'within_week',
          settings.birthdayMonth && settings.birthdayDay
            ? { month: settings.birthdayMonth, day: settings.birthdayDay }
            : null,
          bankHolidaysList,
        )
      : null;

  // A half day survives a date change only while the booking is still one
  // working day; otherwise it becomes a count of whole working days.
  const recountInline = (start: string, end: string) => {
    const workingDays = calculateWorkingDaysInRange(start, end, bankHolidaysList);
    const keepHalf = !!inlineHalfDay && start === end && workingDays === 1;
    if (!keepHalf) setInlineHalfDay(null);
    const eligibleBday =
      settings.birthdayLeaveEnabled && workingDays > 1
        ? findBirthdayDayForHolidayRange(
            start,
            end,
            currentTaxYear,
            settings.birthdayLeaveRule || 'within_week',
            settings.birthdayMonth && settings.birthdayDay
              ? { month: settings.birthdayMonth, day: settings.birthdayDay }
              : null,
            bankHolidaysList,
          )
        : null;
    const keepBday = inlineUseBirthdayDay && Boolean(eligibleBday) && workingDays > 1;
    if (!keepBday && inlineUseBirthdayDay) {
      setInlineUseBirthdayDay(false);
    }
    setInlineCount(String(keepHalf ? HALF_DAY : keepBday ? Math.max(0, workingDays - inlineBirthdayCount) : workingDays));
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

  // Inline Birthday Benefit Configurator State
  const [isBirthdayConfigOpen, setIsBirthdayConfigOpen] = useState(false);
  const [bdayConfigEnabled, setBdayConfigEnabled] = useState<boolean>(Boolean(settings.birthdayLeaveEnabled));
  const [bdayConfigRule, setBdayConfigRule] = useState<BirthdayLeaveRule>(settings.birthdayLeaveRule || 'within_week');
  const [bdayConfigDay, setBdayConfigDay] = useState<string>(settings.birthdayDay ? String(settings.birthdayDay) : '');
  const [bdayConfigMonth, setBdayConfigMonth] = useState<string>(settings.birthdayMonth ? String(settings.birthdayMonth) : 'none');

  useEffect(() => {
    setBdayConfigEnabled(Boolean(settings.birthdayLeaveEnabled));
    setBdayConfigRule(settings.birthdayLeaveRule || 'within_week');
    setBdayConfigDay(settings.birthdayDay ? String(settings.birthdayDay) : '');
    setBdayConfigMonth(settings.birthdayMonth ? String(settings.birthdayMonth) : 'none');
  }, [settings.birthdayLeaveEnabled, settings.birthdayLeaveRule, settings.birthdayDay, settings.birthdayMonth]);

  // Optimal Leave Maximiser State
  const [isMaximiserOpen, setIsMaximiserOpen] = useState(() => new Date().getMonth() === 0);
  const [maximiserBias, setMaximiserBias] = useState<OptimalLeaveBias>('balanced');
  // Keyed to the plan it was opened on, so a new year, bias or scope starts
  // collapsed again.
  const [otherBridgesOpenFor, setOtherBridgesOpenFor] = useState<string | null>(null);
  const [maximiserScope, setMaximiserScope] = useState<'remaining' | 'full_year'>(() =>
    currentTaxYear === realCurrentYear && realCurrentMonth > 0 ? 'remaining' : 'full_year',
  );

  const normalizedHolidaysAll = useMemo(
    () => getNormalizedHolidays(settings, holidayDefaults),
    [settings, holidayDefaults],
  );

  const getBirthdayEntryInsideRange = (startDate: string, endDate: string): UserHoliday | undefined => {
    if (!startDate || !endDate) return undefined;
    return normalizedHolidaysAll.find(
      h => h.type === 'birthday' && h.startDate >= startDate && h.startDate <= endDate,
    );
  };

  const inlineOriginalHoliday = normalizedHolidaysAll.find(h => h.id === editingHolidayId);
  const inlineAttachedBirthday = inlineOriginalHoliday && (inlineOriginalHoliday.type || 'holiday') === 'holiday'
    ? getBirthdayEntryInsideRange(inlineOriginalHoliday.startDate, inlineOriginalHoliday.endDate)
    : undefined;
  const inlineBirthdayCount = inlineAttachedBirthday?.count ?? 1;

  const birthdayWindow = useMemo(
    () =>
      getBirthdayLeaveWindow(
        currentTaxYear,
        settings.birthdayLeaveRule || 'within_week',
        settings.birthdayMonth && settings.birthdayDay
          ? { month: settings.birthdayMonth, day: settings.birthdayDay }
          : null,
        bankHolidaysList,
      ),
    [currentTaxYear, settings.birthdayLeaveRule, settings.birthdayMonth, settings.birthdayDay, bankHolidaysList],
  );

  const optimalPlan = useMemo(
    () =>
      planOptimalHolidays({
        year: currentTaxYear,
        region: settings.ukRegion,
        annualAllowance: settings.workHolidays,
        bankHolidays: bankHolidaysList,
        bankHolidaysMap,
        existingHolidays: normalizedHolidaysAll,
        birthdayLeaveEnabled: settings.birthdayLeaveEnabled,
        birthdayLeaveRule: settings.birthdayLeaveRule,
        birthday:
          settings.birthdayMonth && settings.birthdayDay
            ? { month: settings.birthdayMonth, day: settings.birthdayDay }
            : null,
        bias: maximiserBias,
        asOfDate:
          currentTaxYear === realCurrentYear && maximiserScope === 'remaining' && realCurrentMonth > 0
            ? todayIso
            : undefined,
      }),
    [
      currentTaxYear,
      settings.ukRegion,
      settings.workHolidays,
      bankHolidaysList,
      bankHolidaysMap,
      normalizedHolidaysAll,
      settings.birthdayLeaveEnabled,
      settings.birthdayLeaveRule,
      settings.birthdayMonth,
      settings.birthdayDay,
      maximiserBias,
      maximiserScope,
      realCurrentYear,
      realCurrentMonth,
      todayIso,
    ],
  );

  // Recommended bridges are always listed; once the list is long the rest sit
  // behind a disclosure rather than a scroller inside the tracker's own.
  const bridgePlanKey = `${currentTaxYear}:${maximiserBias}:${maximiserScope}`;
  const showOtherBridges = otherBridgesOpenFor === bridgePlanKey;
  // Collapsing needs something to show: with nothing recommended (allowance
  // used up) the full list stays open.
  const collapseOtherBridges =
    optimalPlan.bridges.length > MAX_INLINE_BRIDGES && optimalPlan.bridges.some(b => b.recommended);
  const shownBridges =
    collapseOtherBridges && !showOtherBridges
      ? optimalPlan.bridges.filter(b => b.recommended)
      : optimalPlan.bridges;
  const hiddenBridgeCount = collapseOtherBridges
    ? optimalPlan.bridges.filter(b => !b.recommended).length
    : 0;

  const getHolidaysUsedCount = () => {
    return normalizedHolidaysAll
      .filter(h => h.type !== 'sick' && h.type !== 'birthday' && calendarParts(h.startDate)?.year === currentTaxYear)
      .reduce((sum, h) => sum + (h.count || 0), 0);
  };

  const getSickDaysUsedCount = () => {
    return normalizedHolidaysAll
      .filter(h => h.type === 'sick' && calendarParts(h.startDate)?.year === currentTaxYear)
      .reduce((sum, h) => sum + (h.count || 0), 0);
  };

  const getBirthdayLeaveUsedEntry = (): UserHoliday | undefined => {
    return normalizedHolidaysAll.find(
      h => h.type === 'birthday' && calendarParts(h.startDate)?.year === currentTaxYear,
    );
  };

  const getBirthdayLeaveUsedCount = (): number => {
    return normalizedHolidaysAll
      .filter(h => h.type === 'birthday' && calendarParts(h.startDate)?.year === currentTaxYear)
      .reduce((sum, h) => sum + (h.count || 0), 0);
  };

  const handleBrowseYear = (nextYear: number) => {
    if (nextYear < 2000 || nextYear > 2100) return;
    setBrowsedYear({ anchor: yearAnchor, year: nextYear });
  };

  const handleSaveBirthdayConfig = () => {
    const parsedDay = bdayConfigDay.trim() ? parseInt(bdayConfigDay.trim(), 10) : null;
    const parsedMonth = bdayConfigMonth !== 'none' ? parseInt(bdayConfigMonth, 10) : null;

    if ((parsedDay !== null && parsedMonth === null) || (parsedDay === null && parsedMonth !== null)) {
      toast({
        title: 'Incomplete Birthday Date',
        description: 'Please enter both day (DD) and month (MM) in UK format, or leave both blank.',
        variant: 'destructive',
      });
      return;
    }

    if (parsedDay !== null && parsedMonth !== null) {
      const maxDays = getDaysInMonth(2024, parsedMonth - 1);
      if (isNaN(parsedDay) || parsedDay < 1 || parsedDay > maxDays) {
        toast({
          title: 'Invalid Birthday Day',
          description: `Day must be between 1 and ${maxDays} for ${MONTH_NAMES[parsedMonth - 1]}.`,
          variant: 'destructive',
        });
        return;
      }
    }

    const updatedSettings: FinanceSettings = {
      ...settings,
      birthdayLeaveEnabled: bdayConfigEnabled,
      birthdayLeaveRule: bdayConfigRule,
      birthdayDay: parsedDay,
      birthdayMonth: parsedMonth,
    };
    setSettings(updatedSettings);
    void saveDataToSupabase('settings', updatedSettings);
    setIsBirthdayConfigOpen(false);
    toast({
      title: 'Birthday Benefit Updated',
      description: bdayConfigEnabled
        ? `Birthday Day Off enabled (${BIRTHDAY_LEAVE_RULE_LABELS[bdayConfigRule].shortLabel}).`
        : 'Birthday Day Off benefit disabled.',
    });
  };

  const buildHolidayEntriesForBridge = (
    bridge: OptimalHolidayBridge,
    seedOffset = 0,
  ): UserHoliday[] => {
    const entries: UserHoliday[] = [];
    const bdayIso = bridge.usesBirthdayDay && bridge.birthdayDayDate ? bridge.birthdayDayDate : null;
    if (bdayIso) {
      entries.push({
        id: `hol_bday_${Date.now()}_${seedOffset}`,
        startDate: bdayIso,
        endDate: bdayIso,
        occasion: 'Birthday Day Off',
        count: 1,
        type: 'birthday',
      });
    }

    const remainingWorkDays = bridge.datesToBook
      .filter(d => d !== bdayIso)
      .sort();

    if (remainingWorkDays.length > 0) {
      // Group into contiguous runs where no unbooked working day lies between two dates
      const runs: Array<{ start: string; end: string; count: number }> = [];
      let runStart = remainingWorkDays[0];
      let prevIso = remainingWorkDays[0];
      let runCount = 1;

      for (let i = 1; i < remainingWorkDays.length; i++) {
        const curIso = remainingWorkDays[i];
        const workDaysBetween = calculateWorkingDaysInRange(prevIso, curIso, bankHolidaysList);
        if (workDaysBetween === 2) {
          prevIso = curIso;
          runCount++;
          continue;
        }
        runs.push({ start: runStart, end: prevIso, count: runCount });
        runStart = curIso;
        prevIso = curIso;
        runCount = 1;
      }
      runs.push({ start: runStart, end: prevIso, count: runCount });

      runs.forEach((run, runIdx) => {
        entries.push({
          id: `hol_opt_${Date.now()}_${seedOffset}_${runIdx}`,
          startDate: run.start,
          endDate: run.end,
          occasion: bridge.label,
          count: run.count,
          type: 'holiday',
        });
      });
    }

    return entries;
  };

  const handleBookBridge = (bridge: OptimalHolidayBridge) => {
    const newEntries = buildHolidayEntriesForBridge(bridge, 0);
    if (newEntries.length === 0) return;
    const updatedHolidaysList = [...normalizedHolidaysAll, ...newEntries];
    const updatedSettings: FinanceSettings = {
      ...settings,
      holidaysByUser: updatedHolidaysList,
    };
    setSettings(updatedSettings);
    void saveDataToSupabase('settings', updatedSettings);
    toast({
      title: 'Bridge Booked',
      description: `Booked "${bridge.label}" (${bridge.totalDaysOff} consecutive days off).`,
    });
  };

  const handleBookAllRecommended = () => {
    const recommendedBridges = optimalPlan.bridges.filter(b => b.recommended);
    if (recommendedBridges.length === 0) return;
    const newEntries = recommendedBridges.flatMap((bridge, idx) =>
      buildHolidayEntriesForBridge(bridge, idx + 1),
    );
    if (newEntries.length === 0) return;
    const updatedHolidaysList = [...normalizedHolidaysAll, ...newEntries];
    const updatedSettings: FinanceSettings = {
      ...settings,
      holidaysByUser: updatedHolidaysList,
    };
    setSettings(updatedSettings);
    void saveDataToSupabase('settings', updatedSettings);
    toast({
      title: 'Recommended Plan Booked',
      description: `Booked ${recommendedBridges.length} optimal ${recommendedBridges.length === 1 ? 'bridge' : 'bridges'} (${optimalPlan.recommendedTotalDaysOff} total days off).`,
    });
  };

  const handleApplyBirthdayToHoliday = (hol: UserHoliday, bdayIso: string) => {
    const count = adjustHolidayCountForBirthday(hol.count, 1, true);
    if (count === null) {
      toast({ title: 'Check the leave count', description: 'At least one day of annual leave is needed to attach a birthday day off.', variant: 'destructive' });
      return;
    }
    const updatedHoliday: UserHoliday = { ...hol, count };
    const bdayEntry: UserHoliday = {
      id: `hol_bday_${Date.now()}`,
      startDate: bdayIso,
      endDate: bdayIso,
      occasion: `${hol.occasion} (Birthday Day Off)`,
      count: 1,
      type: 'birthday',
    };
    if (hasBirthdaySickOverlap(normalizedHolidaysAll, bdayEntry)) {
      toast({ title: 'Day already recorded as sick leave', description: 'Choose another birthday date or edit the sick entry first.', variant: 'destructive' });
      return;
    }
    const updatedHolidaysList = [
      ...normalizedHolidaysAll.map(h => (h.id === hol.id ? updatedHoliday : h)),
      bdayEntry,
    ];
    const updatedSettings: FinanceSettings = {
      ...settings,
      holidaysByUser: updatedHolidaysList,
    };
    setSettings(updatedSettings);
    void saveDataToSupabase('settings', updatedSettings);
    toast({
      title: 'Birthday Day Off Applied',
      description: `Applied 1d Birthday Day Off on ${formatUkDate(bdayIso)} — "${hol.occasion}" now uses ${updatedHoliday.count}d annual leave.`,
    });
  };

  const handleRemoveBirthdayFromHoliday = (hol: UserHoliday, attachedBday: UserHoliday) => {
    const count = adjustHolidayCountForBirthday(hol.count, attachedBday.count, false);
    if (count === null) {
      toast({ title: 'Check the leave count', description: 'The holiday or birthday leave count is invalid.', variant: 'destructive' });
      return;
    }
    const updatedHoliday: UserHoliday = { ...hol, count };
    const updatedHolidaysList = normalizedHolidaysAll
      .filter(h => h.id !== attachedBday.id)
      .map(h => (h.id === hol.id ? updatedHoliday : h));
    const updatedSettings: FinanceSettings = {
      ...settings,
      holidaysByUser: updatedHolidaysList,
    };
    setSettings(updatedSettings);
    void saveDataToSupabase('settings', updatedSettings);
    toast({
      title: 'Birthday Day Off Removed',
      description: `Removed Birthday Day Off from "${hol.occasion}" — restored to ${updatedHoliday.count}d annual leave.`,
    });
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
    setInlineUseBirthdayDay(false);
  };

  const handleStartEditHoliday = (holiday: UserHoliday, monthIdx: number) => {
    setExpandedMonthIdx(monthIdx);
    setInlineBookMonthIdx(monthIdx);
    setEditingHolidayId(holiday.id);
    const holType = holiday.type || 'holiday';
    setInlineType(holType);
    setInlineOccasion(holiday.occasion);
    setInlineStartDate(holiday.startDate);
    setInlineEndDate(holiday.endDate);
    setInlineCount(holiday.count.toString());
    setInlineHalfDay(isHalfDay(holiday) ? holiday.halfDay ?? null : null);
    setInlineUseBirthdayDay(
      holType === 'holiday' ? Boolean(getBirthdayEntryInsideRange(holiday.startDate, holiday.endDate)) : false,
    );
  };

  const handleStartNewHoliday = (monthIdx: number, type: LeaveType = 'holiday') => {
    setInlineBookMonthIdx(monthIdx);
    setEditingHolidayId(null);
    setInlineType(type);
    setInlineOccasion(type === 'birthday' ? 'Birthday Day Off' : '');
    const pad = (n: number) => n.toString().padStart(2, '0');
    const monthPrefix = `${currentTaxYear}-${pad(monthIdx + 1)}-`;
    const defaultDate =
      type === 'birthday' && birthdayWindow
        ? birthdayWindow.eligibleDates.find(d => d.startsWith(monthPrefix)) ||
          (birthdayWindow.birthdayIso?.startsWith(monthPrefix) ? birthdayWindow.birthdayIso : `${monthPrefix}01`)
        : `${monthPrefix}01`;
    setInlineStartDate(defaultDate);
    setInlineEndDate(defaultDate);
    setInlineCount('1');
    setInlineHalfDay(null);
    setInlineUseBirthdayDay(false);
  };

  const handleSaveInlineHoliday = (monthIdx: number) => {
    void monthIdx;
    const countVal = inlineCount.trim() === '' ? NaN : Number(inlineCount);
    if (!inlineStartDate || !inlineEndDate) {
      toast({ title: 'Missing Dates', description: 'Start and end dates are required.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(countVal) || countVal < 0) {
      toast({ title: 'Invalid Days Count', description: 'Leave days count must be a non-negative number.', variant: 'destructive' });
      return;
    }

    const normalizedHolidays = getNormalizedHolidays(settings, holidayDefaults);

    if (inlineType === 'birthday') {
      const existingBirthday = normalizedHolidays.find(
        h =>
          h.type === 'birthday' &&
          h.id !== editingHolidayId &&
          calendarParts(h.startDate)?.year === currentTaxYear,
      );
      if (existingBirthday) {
        toast({
          title: 'Birthday Day Off Already Booked',
          description: `You already have a Birthday Day Off booked on ${formatUkDate(existingBirthday.startDate)} for ${currentTaxYear}.`,
          variant: 'destructive',
        });
        return;
      }

      const validation = validateBirthdayLeaveBooking(
        inlineStartDate,
        inlineEndDate,
        currentTaxYear,
        settings.birthdayLeaveRule || 'within_week',
        settings.birthdayMonth && settings.birthdayDay
          ? { month: settings.birthdayMonth, day: settings.birthdayDay }
          : null,
        bankHolidaysList,
      );
      if (!validation.valid) {
        toast({
          title: 'Outside Birthday Window',
          description: validation.reason || 'Choose an eligible working day for your Birthday Day Off.',
          variant: 'destructive',
        });
        return;
      }
    }

    const halfDay = inlineIsSingleDay && inlineHalfDay ? inlineHalfDay : undefined;

    const originalHoliday = editingHolidayId
      ? normalizedHolidays.find(h => h.id === editingHolidayId)
      : undefined;
    // Only a regular holiday owns a birthday, and never the entry being saved:
    // a birthday or sick entry switched to Holiday has attached nothing.
    const existingAttachedBday =
      originalHoliday && (originalHoliday.type || 'holiday') === 'holiday'
        ? normalizedHolidays.find(
            h =>
              h.type === 'birthday' &&
              h.id !== originalHoliday.id &&
              h.startDate >= originalHoliday.startDate &&
              h.startDate <= originalHoliday.endDate,
          )
        : undefined;
    // A birthday inside the saved range that this holiday did not attach. It is
    // kept, and the holiday is charged as if it had attached it.
    const coveredBday =
      inlineType === 'holiday'
        ? normalizedHolidays.find(
            h =>
              h.type === 'birthday' &&
              h.id !== editingHolidayId &&
              h.id !== existingAttachedBday?.id &&
              h.startDate >= inlineStartDate &&
              h.startDate <= inlineEndDate,
          )
        : undefined;
    // A single working day cannot give a day up (and a half day must stay 0.5),
    // so a holiday that short cannot share its day with the birthday.
    if (coveredBday && inlineWorkingDays < 2) {
      toast({
        title: 'Birthday Day Off Already Booked',
        description: `${formatUkDate(coveredBday.startDate)} is already your Birthday Day Off. Choose a range of at least two working days, or remove the birthday first.`,
        variant: 'destructive',
      });
      return;
    }

    // A birthday booked inside a holiday is attached to it, as
    // handleApplyBirthdayToHoliday does, so that day is not also charged as
    // annual leave. Re-saving a birthday on the day it already sits on changes nothing.
    const coveringHoliday =
      inlineType === 'birthday'
        ? findHolidayCoveringDate(normalizedHolidays, inlineStartDate, editingHolidayId ?? undefined)
        : undefined;
    const previousCoveringHoliday =
      originalHoliday?.type === 'birthday'
        ? findHolidayCoveringDate(normalizedHolidays, originalHoliday.startDate)
        : undefined;
    const birthdayHost =
      coveringHoliday && coveringHoliday.id !== previousCoveringHoliday?.id ? coveringHoliday : undefined;
    if (
      birthdayHost &&
      calculateWorkingDaysInRange(birthdayHost.startDate, birthdayHost.endDate, bankHolidaysList) < 2
    ) {
      toast({
        title: 'Day Already Booked as Leave',
        description: `"${birthdayHost.occasion}" is a single day of annual leave on that date. Edit or remove it before booking your Birthday Day Off there.`,
        variant: 'destructive',
      });
      return;
    }

    const savedHoliday: UserHoliday = {
      id: editingHolidayId || 'hol_' + Date.now(),
      startDate: inlineStartDate,
      endDate: inlineEndDate,
      occasion:
        inlineOccasion.trim() ||
        (inlineType === 'sick'
          ? 'Sick Leave'
          : inlineType === 'birthday'
            ? 'Birthday Day Off'
            : 'Leave'),
      // The toggle has already taken the birthday's day off `inlineCount`.
      count: halfDay
        ? HALF_DAY
        : inlineType === 'birthday'
          ? 1
          : coveredBday && !inlineUseBirthdayDay
            ? Math.max(0, countVal - coveredBday.count)
            : countVal,
      type: inlineType,
      ...(halfDay ? { halfDay } : {})
    };

    const attachedBirthday: UserHoliday | undefined =
      inlineType === 'holiday' && inlineUseBirthdayDay && inlineEligibleBdayDate && !halfDay && !coveredBday
        ? {
            id: existingAttachedBday?.id || `hol_bday_${Date.now()}_1`,
            startDate: inlineEligibleBdayDate,
            endDate: inlineEligibleBdayDate,
            occasion: `${savedHoliday.occasion} (Birthday Day Off)`,
            count: existingAttachedBday?.count ?? 1,
            type: 'birthday',
            ...(existingAttachedBday?.halfDay ? { halfDay: existingAttachedBday.halfDay } : {}),
          }
        : undefined;

    if (hasBirthdaySickOverlap(normalizedHolidays, savedHoliday, editingHolidayId ?? undefined)) {
      toast({ title: 'Birthday and sick leave overlap', description: 'Choose a different day or half day, or edit the existing entry first.', variant: 'destructive' });
      return;
    }
    if (attachedBirthday && hasBirthdaySickOverlap(normalizedHolidays, attachedBirthday)) {
      toast({ title: 'Day already recorded as sick leave', description: 'Turn off the birthday option or edit the sick entry first.', variant: 'destructive' });
      return;
    }

    let updatedHolidaysList = editingHolidayId
      ? normalizedHolidays.map(holiday => holiday.id === editingHolidayId ? savedHoliday : holiday)
      : [...normalizedHolidays, savedHoliday];
    let leaveNote = '';

    // A birthday moved out of the holiday it was attached to gives that
    // holiday its day back. One switched to another type is charged as itself,
    // so the old holiday stays as it was.
    if (
      inlineType === 'birthday' &&
      originalHoliday &&
      previousCoveringHoliday &&
      previousCoveringHoliday.id !== coveringHoliday?.id
    ) {
      const restoredCount = adjustHolidayCountForBirthday(previousCoveringHoliday.count, originalHoliday.count, false);
      if (restoredCount === null) {
        toast({ title: 'Check the leave count', description: 'The previous holiday or birthday leave count is invalid.', variant: 'destructive' });
        return;
      }
      updatedHolidaysList = updatedHolidaysList.map(h =>
        h.id === previousCoveringHoliday.id ? { ...h, count: restoredCount } : h,
      );
    }

    // Editing a birthday from full to half (or back) adjusts only the difference.
    if (inlineType === 'birthday' && originalHoliday?.type === 'birthday' &&
      coveringHoliday && coveringHoliday.id === previousCoveringHoliday?.id) {
      const restoredCount = adjustHolidayCountForBirthday(coveringHoliday.count, originalHoliday.count, false);
      const updatedCount = restoredCount === null ? null : adjustHolidayCountForBirthday(restoredCount, savedHoliday.count, true);
      if (updatedCount === null) {
        toast({ title: 'Check the leave count', description: 'The holiday does not have enough valid annual leave to cover this birthday change.', variant: 'destructive' });
        return;
      }
      updatedHolidaysList = updatedHolidaysList.map(h => h.id === coveringHoliday.id
        ? { ...h, count: updatedCount }
        : h);
    }

    if (birthdayHost) {
      // A half-day birthday takes half a day off its holiday, not a whole one.
      const hostCount = adjustHolidayCountForBirthday(birthdayHost.count, savedHoliday.count, true);
      if (hostCount === null) {
        toast({ title: 'Check the leave count', description: 'The holiday does not have enough valid annual leave to attach this birthday.', variant: 'destructive' });
        return;
      }
      updatedHolidaysList = updatedHolidaysList.map(h =>
        h.id === birthdayHost.id ? { ...h, count: hostCount } : h,
      );
      leaveNote = ` Attached to "${birthdayHost.occasion}", which now uses ${hostCount}d annual leave.`;
    }

    if (inlineType === 'holiday') {
      if (coveredBday) {
        leaveNote = ` Kept your Birthday Day Off on ${formatUkDate(coveredBday.startDate)}; this leave uses ${savedHoliday.count}d annual leave.`;
      }
      if (attachedBirthday) {
        if (existingAttachedBday) {
          updatedHolidaysList = updatedHolidaysList.map(h =>
            h.id === existingAttachedBday.id ? attachedBirthday : h,
          );
        } else {
          updatedHolidaysList = [...updatedHolidaysList, attachedBirthday];
        }
      } else if (!inlineUseBirthdayDay && existingAttachedBday) {
        // Changing the dates can turn the toggle off on its own, so say so.
        updatedHolidaysList = updatedHolidaysList.filter(h => h.id !== existingAttachedBday.id);
        leaveNote += ` Your Birthday Day Off on ${formatUkDate(existingAttachedBday.startDate)} was removed from this leave.`;
      }
    }

    const updatedSettings = {
      ...settings,
      holidaysByUser: updatedHolidaysList
    };

    setSettings(updatedSettings);
    void saveDataToSupabase('settings', updatedSettings);

    resetInlineHolidayForm();
    const isSick = inlineType === 'sick';
    const isBirthday = inlineType === 'birthday';
    toast({
      title: editingHolidayId
        ? isSick
          ? 'Sick leave updated'
          : isBirthday
            ? 'Birthday day off updated'
            : 'Leave updated'
        : isSick
          ? 'Sick day recorded'
          : isBirthday
            ? 'Birthday day off booked'
            : 'Leave booked',
      description: `${editingHolidayId ? 'Updated' : 'Successfully recorded'} "${savedHoliday.occasion}".${leaveNote}`
    });
  };

  const performDeleteHoliday = (holidayId: string) => {
    const normalizedHolidays = getNormalizedHolidays(settings, holidayDefaults);
    const updatedHolidaysList = removeHolidayWithBirthdayRestoration(normalizedHolidays, holidayId);

    const updatedSettings = {
      ...settings,
      holidaysByUser: updatedHolidaysList
    };

    setSettings(updatedSettings);
    void saveDataToSupabase('settings', updatedSettings);
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
      <div className="surface-card rounded-lg border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors space-y-4">
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
      <div className="surface-card rounded-lg border border-border/40 bg-card/50 p-5 sm:p-6 hover:border-border/80 transition-colors">
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
                `${breakdownWorkingDays} paid days a year, bank holidays and ${settings.workHolidays} days of leave${settings.birthdayLeaveEnabled ? ' + 1 birthday day' : ''} included.`}
              {breakdownRateMode === 'excluding_leave' &&
                `${breakdownWorkingDays} working days a year, bank holidays and ${settings.workHolidays} days of leave${settings.birthdayLeaveEnabled ? ' + 1 birthday day' : ''} excluded.`}
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

      <TakeHomeSlices
        input={results.taxInput}
        benefitTaxCollectedByCode={results.benefitTaxCollectedByCode}
        codedBenefitsInKind={results.benefitInKindValue}
      />

      {/* Captured payslips: the figures the deductions above are modelled
          from, as they actually landed (7.7). */}
      <PayslipsSection modelledStudentLoanMonthly={breakdownRates.studentLoan.monthly} />

    </div>

    {/* Right Side: Combined leave balances and holiday tracker */}
    <div className="lg:col-span-4 flex flex-col gap-6">

      <div className="surface-card rounded-lg border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border/30 pb-3">
          <div className="min-w-0">
            <h3 className="text-xs uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary shrink-0" /> Holiday Tracker
            </h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">Click a month card to expand details. Book leave inline or remove booked events easily.</p>
          </div>
          <div className="flex items-center gap-1 shrink-0 self-start bg-muted/20 border border-border/40 rounded-lg p-0.5 font-mono">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleBrowseYear(currentTaxYear - 1)}
              className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
              title="Previous leave year"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 text-xs font-mono font-bold tabular-nums text-foreground">
              {currentTaxYear}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleBrowseYear(currentTaxYear + 1)}
              className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
              title="Next leave year"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
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
              {bankHolidaysLeft}/{bankHolidaysList.length}
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

        {/* Birthday Day Off Benefit Bar */}
        <div className="rounded-lg border border-border/30 bg-muted/20 p-3 space-y-2.5 font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                <span>🎂</span> Birthday Day Off
              </span>
              {settings.birthdayLeaveEnabled ? (
                <>
                  {(() => {
                    const bookedBday = getBirthdayLeaveUsedEntry();
                    return bookedBday ? (
                      <span className="bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded-sm border border-primary/40 font-semibold">
                        Booked · {formatUkDate(bookedBday.startDate)}
                      </span>
                    ) : (
                      <span className="bg-positive/20 text-positive text-xs px-1.5 py-0.5 rounded-sm border border-positive/40 font-semibold">
                        1d Available
                      </span>
                    );
                  })()}
                  <span className="bg-muted/40 text-muted-foreground text-xs px-1.5 py-0.5 rounded-sm border border-border/40">
                    {BIRTHDAY_LEAVE_RULE_LABELS[settings.birthdayLeaveRule || 'within_week'].shortLabel}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Not enabled</span>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsBirthdayConfigOpen(prev => !prev)}
              className="h-7 px-2.5 rounded-lg text-xs border-border/40 bg-background/50 hover:bg-muted/40 font-mono shrink-0"
            >
              {isBirthdayConfigOpen ? 'Close' : 'Configure'}
            </Button>
          </div>

          {settings.birthdayLeaveEnabled && birthdayWindow && birthdayWindow.birthdayIso && (
            <p className="text-xs text-muted-foreground">
              Birthday: <span className="text-foreground font-semibold">{formatUkDate(birthdayWindow.birthdayIso)}</span>
              {settings.birthdayLeaveRule !== 'anytime' && (
                <>
                  {' · '}Window:{' '}
                  <span className="text-foreground font-semibold">
                    {formatHolidayDates(birthdayWindow.startIso, birthdayWindow.endIso)}
                  </span>
                </>
              )}
            </p>
          )}

          {isBirthdayConfigOpen && (
            <div className="border-t border-border/30 pt-2.5 space-y-2.5 text-left">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="tracker-bday-enabled" className="text-xs font-normal text-muted-foreground">
                  Birthday Day Off (+1 paid day)
                </Label>
                <Switch id="tracker-bday-enabled" checked={bdayConfigEnabled} onCheckedChange={setBdayConfigEnabled} />
              </div>
              {bdayConfigEnabled && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="tracker-bday-rule" className="text-xs text-muted-foreground">Usage Window Rule</Label>
                    <Select
                      value={bdayConfigRule}
                      onValueChange={(val) => setBdayConfigRule(val as BirthdayLeaveRule)}
                    >
                      <SelectTrigger id="tracker-bday-rule" className="h-8 rounded-lg border-border/40 bg-background/60 text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border-border/40 bg-popover font-mono text-xs">
                        {BIRTHDAY_LEAVE_RULES.map(rule => (
                          <SelectItem key={rule} value={rule}>
                            {BIRTHDAY_LEAVE_RULE_LABELS[rule].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div role="group" aria-labelledby="tracker-bday-date-label" className="space-y-1">
                    <p id="tracker-bday-date-label" className="text-xs font-medium leading-snug text-muted-foreground">
                      Birthday (UK Day / Month)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Label htmlFor="tracker-bday-day" className="sr-only">Birthday day (DD)</Label>
                      <Input
                        id="tracker-bday-day"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="31"
                        placeholder="Day (DD)"
                        value={bdayConfigDay}
                        onChange={(e) => setBdayConfigDay(e.target.value)}
                        className="h-8 rounded-lg border-border/40 bg-background/60 text-xs font-mono"
                      />
                      <Label htmlFor="tracker-bday-month" className="sr-only">Birthday month</Label>
                      <Select value={bdayConfigMonth} onValueChange={setBdayConfigMonth}>
                        <SelectTrigger id="tracker-bday-month" className="h-8 rounded-lg border-border/40 bg-background/60 text-xs font-mono">
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border-border/40 bg-popover font-mono text-xs">
                          <SelectItem value="none">Not set</SelectItem>
                          {MONTH_NAMES.map((mName, idx) => {
                            const mNum = idx + 1;
                            return (
                              <SelectItem key={mNum} value={String(mNum)}>
                                {String(mNum).padStart(2, '0')} — {mName.slice(0, 3)}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
              <div className="flex justify-end gap-1.5 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsBirthdayConfigOpen(false)}
                  className="h-7 px-2.5 rounded-lg text-xs font-mono"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveBirthdayConfig}
                  className="h-7 px-2.5 rounded-lg text-xs bg-primary text-primary-foreground font-mono"
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Optimal Leave Maximiser Panel */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden font-mono">
          <button
            type="button"
            onClick={() => setIsMaximiserOpen(prev => !prev)}
            aria-expanded={isMaximiserOpen}
            aria-controls="holiday-maximiser-panel"
            className="w-full p-3 flex items-center justify-between gap-2 text-left hover:bg-primary/10 transition-colors"
          >
            <div className="min-w-0">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>Optimal Leave Maximiser ({currentTaxYear})</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Turn {optimalPlan.recommendedLeaveDays}d leave
                {optimalPlan.recommendedUsesBirthday ? ' + 1d 🎂' : ''} into{' '}
                <span className="text-positive font-semibold">{optimalPlan.recommendedTotalDaysOff}d off</span>
              </p>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200',
                isMaximiserOpen && 'rotate-180',
              )}
            />
          </button>

          {isMaximiserOpen && (
            <div id="holiday-maximiser-panel" className="border-t border-primary/20 p-3 space-y-3 bg-card/60">
              {realCurrentMonth === 0 && currentTaxYear === realCurrentYear && (
                <div className="rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs text-primary font-semibold">
                  🗓️ January Annual Leave Planner — Lock in your {currentTaxYear} dates early
                </div>
              )}

              {currentTaxYear === realCurrentYear && realCurrentMonth > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <PillSwitch
                    label="Planning window scope"
                    options={[
                      { key: 'remaining', label: `Remaining ${currentTaxYear}` },
                      { key: 'full_year', label: `Full ${currentTaxYear}` },
                    ]}
                    value={maximiserScope}
                    onChange={setMaximiserScope}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleBrowseYear(realCurrentYear + 1);
                      setIsMaximiserOpen(true);
                    }}
                    className="h-7 px-2.5 rounded-lg text-xs border-border/40 bg-background/60 hover:bg-muted/40 font-mono"
                  >
                    Plan {realCurrentYear + 1} Full Year →
                  </Button>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    Strategy Bias
                  </span>
                </div>
                <PillSwitch
                  label="Optimal leave strategy bias"
                  options={OPTIMAL_LEAVE_BIASES.map(b => ({
                    key: b,
                    label: OPTIMAL_LEAVE_BIAS_LABELS[b].shortLabel,
                  }))}
                  value={maximiserBias}
                  onChange={setMaximiserBias}
                  className="w-full sm:w-full"
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {OPTIMAL_LEAVE_BIAS_LABELS[maximiserBias].description}
                </p>
              </div>

              <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs">
                  <span className="text-muted-foreground">Recommended plan: </span>
                  <span className="font-semibold text-foreground">
                    {optimalPlan.recommendedLeaveDays}d leave
                    {optimalPlan.recommendedUsesBirthday ? ' + 1d 🎂' : ''} → {optimalPlan.recommendedTotalDaysOff}d total off
                  </span>
                  <span className="text-muted-foreground"> ({optimalPlan.remainingAllowanceAfterPlan}d left)</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={optimalPlan.bridges.filter(b => b.recommended).length === 0}
                  onClick={handleBookAllRecommended}
                  className="h-7 px-2.5 rounded-lg text-xs bg-primary text-primary-foreground font-mono shrink-0"
                >
                  Book Recommended
                </Button>
              </div>

              <div id="holiday-maximiser-bridges" className="space-y-2">
                {optimalPlan.bridges.length > 0 ? (
                  shownBridges.map(bridge => (
                    <div
                      key={bridge.id}
                      className={cn(
                        'rounded-lg border p-2.5 space-y-1.5 text-left transition-colors',
                        bridge.recommended
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border/30 bg-muted/15',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-bold text-foreground">{bridge.label}</span>
                            {bridge.recommended && (
                              <span className="bg-primary/20 text-primary border border-primary/40 rounded-sm px-1.5 py-0.5 text-xs font-semibold">
                                Recommended
                              </span>
                            )}
                            {bridge.tierLabel && (
                              <span className="bg-muted/40 text-muted-foreground border border-border/40 rounded-sm px-1.5 py-0.5 text-xs">
                                {bridge.tierLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="bg-positive/20 text-positive border border-positive/40 rounded-sm px-1.5 py-0.5 font-semibold tabular-nums">
                              {bridge.leaveDaysRequired}d{bridge.usesBirthdayDay ? ' + 1🎂' : ''} → {bridge.totalDaysOff}d off · {bridge.efficiency}x
                            </span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant={bridge.recommended ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleBookBridge(bridge)}
                          className="h-7 px-2.5 rounded-lg text-xs font-mono shrink-0"
                        >
                          Book
                        </Button>
                      </div>

                      <div className="space-y-0.5 text-xs text-muted-foreground pt-0.5">
                        <p>
                          <span className="text-foreground font-semibold">Off:</span>{' '}
                          {formatUkDate(bridge.breakStartDate, true)} – {formatUkDate(bridge.breakEndDate, true)}
                        </p>
                        <p>
                          <span className="text-foreground font-semibold">Book:</span>{' '}
                          {formatDatesToBookUk(bridge.datesToBook)}{' '}
                          <span className="text-muted-foreground">
                            (
                            {bridge.usesBirthdayDay && bridge.birthdayDayDate
                              ? `includes 🎂 Birthday on ${formatUkDate(bridge.birthdayDayDate)}`
                              : `${bridge.leaveDaysRequired} working ${bridge.leaveDaysRequired === 1 ? 'day' : 'days'}`}
                            )
                          </span>
                        </p>
                        <p>
                          <span className="text-foreground font-semibold">Return:</span>{' '}
                          {formatUkDate(bridge.returnToWorkDate, true)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    All bank-holiday bridges for {currentTaxYear} are already booked.
                  </p>
                )}
                {hiddenBridgeCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setOtherBridgesOpenFor(showOtherBridges ? null : bridgePlanKey)}
                    aria-expanded={showOtherBridges}
                    aria-controls="holiday-maximiser-bridges"
                    className="text-xs font-mono text-muted-foreground hover:text-foreground"
                  >
                    {showOtherBridges ? 'Show recommended only' : `Show ${hiddenBridgeCount} other ${hiddenBridgeCount === 1 ? 'bridge' : 'bridges'}`}
                  </button>
                )}
              </div>
            </div>
          )}
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
          {(settings.birthdayLeaveEnabled || getBirthdayLeaveUsedCount() > 0) && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary/25 border border-primary/50" />
              <span className="text-primary font-semibold">🎂 Birthday Day Off</span>
            </div>
          )}
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
              const daysInMonth = getDaysInMonth(currentTaxYear, monthIdx);
              const startDayOfWeek = getStartDayOfWeek(currentTaxYear, monthIdx);

              const normalizedHolidays = getNormalizedHolidays(settings, holidayDefaults);
              const bookedDaysForMonth = getBookedDaysForMonth(normalizedHolidays, currentTaxYear, monthIdx, bankHolidaysList);

              const monthHolidaysBooked = bookedDaysForMonth.filter(b => b.type === 'holiday').reduce((sum, b) => sum + b.fraction, 0);
              const monthBirthdayBooked = bookedDaysForMonth.filter(b => b.type === 'birthday').reduce((sum, b) => sum + b.fraction, 0);
              const monthSickDaysBooked = bookedDaysForMonth.filter(b => b.type === 'sick').reduce((sum, b) => sum + b.fraction, 0);

              const isExpanded = expandedMonthIdx === monthIdx;

              // Get overlapping holidays for this month
              const overlappingHolidays = normalizedHolidays.filter(hol => {
                // From the stored days' own parts: `new Date()` would read
                // them as UTC midnight, the day before west of UTC.
                const start = calendarParts(hol.startDate);
                const end = calendarParts(hol.endDate);
                if (!start || !end) return false;

                const startVal = start.year * 12 + start.month - 1;
                const endVal = end.year * 12 + end.month - 1;
                const currentVal = currentTaxYear * 12 + monthIdx;

                return currentVal >= startVal && currentVal <= endVal;
              });

              const yearBdayEntry = getBirthdayLeaveUsedEntry();

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
                      {monthBirthdayBooked > 0 && (
                        <span className="bg-primary/20 text-primary font-mono text-xs px-1.5 py-0.5 rounded-sm border border-primary/40 font-semibold">
                          🎂 {monthBirthdayBooked}d bday
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
                      const dateStr = `${currentTaxYear}-${pad(monthIdx + 1)}-${pad(dayNum)}`;

                      const isBankHoliday = bankHolidaysList.includes(dateStr);

                      const bookedDay = bookedDaysForMonth.find(b => b.day === dayNum);
                      const isBookedSick = bookedDay?.type === 'sick';
                      const isBookedBirthday = bookedDay?.type === 'birthday';
                      const isBookedHoliday = !!bookedDay && !isBookedSick && !isBookedBirthday;
                      const bookedHalf = bookedDay?.halfDay;
                      const bookedOccasion =
                        bookedDay?.occasion ||
                        (isBookedSick ? 'Sick Leave' : isBookedBirthday ? 'Birthday Day Off' : 'Leave');

                      const isActualBirthday = birthdayWindow?.birthdayIso === dateStr;
                      const isInBirthdayWindow = Boolean(
                        settings.birthdayLeaveEnabled &&
                          birthdayWindow &&
                          settings.birthdayLeaveRule !== 'anytime' &&
                          birthdayWindow.eligibleDates.includes(dateStr),
                      );

                      const dateObj = new Date(currentTaxYear, monthIdx, dayNum);
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
                      } else if (isBookedBirthday) {
                        cellClass += bookedHalf === 'am'
                          ? "text-primary font-bold border border-dashed border-primary/60 bg-[linear-gradient(90deg,hsl(var(--primary)/0.3)_50%,transparent_50%)]"
                          : bookedHalf === 'pm'
                            ? "text-primary font-bold border border-dashed border-primary/60 bg-[linear-gradient(270deg,hsl(var(--primary)/0.3)_50%,transparent_50%)]"
                            : "text-primary font-bold bg-primary/20 border border-primary/50";
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
                      } else if (isInBirthdayWindow) {
                        cellClass += "text-foreground border border-dashed border-primary/35 hover:bg-muted/40";
                      } else {
                        cellClass += "text-foreground hover:bg-muted/40";
                      }

                      if (isActualBirthday && !bookedDay) {
                        cellClass += " ring-1 ring-primary/60";
                      }

                      const getTooltipDetails = () => {
                        const list = [];
                        if (isActualBirthday) {
                          list.push('🎂 Birthday');
                        }
                        if (isBankHoliday) {
                          list.push(`Bank Holiday: ${bankHolidaysMap[dateStr] || 'Public Holiday'}`);
                        }
                        const halfNote = bookedHalf ? ` (${HALF_DAY_LABEL[bookedHalf]})` : '';
                        if (isBookedSick) {
                          list.push(`Sick Day${halfNote}: ${bookedOccasion}`);
                        } else if (isBookedBirthday) {
                          list.push(`Birthday Leave${halfNote}: ${bookedOccasion}`);
                        } else if (isBookedHoliday) {
                          list.push(`Booked Leave${halfNote}: ${bookedOccasion}`);
                        } else if (isInBirthdayWindow && !isBankHoliday && !isWeekend) {
                          list.push(`Eligible Birthday Window (${BIRTHDAY_LEAVE_RULE_LABELS[settings.birthdayLeaveRule || 'within_week'].shortLabel})`);
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
                            <p className="font-bold text-foreground mb-1">{dayNum} {month} {currentTaxYear}</p>
                            <div className="space-y-1 text-muted-foreground font-mono text-xs">
                              {getTooltipDetails().map((detail, idx) => {
                                let colorClass = "text-foreground/80";
                                if (detail.startsWith('Bank Holiday')) {
                                  colorClass = "text-chart-5 font-semibold";
                                } else if (detail.startsWith('Sick Day')) {
                                  colorClass = "text-chart-4 font-semibold";
                                } else if (detail.startsWith('Birthday Leave') || detail.startsWith('🎂 Birthday') || detail.startsWith('Eligible Birthday Window')) {
                                  colorClass = "text-primary font-semibold";
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
                              const isBirthday = hol.type === 'birthday';
                              const isRegularHoliday = !isSick && !isBirthday;
                              const totalWorkingDays = isRegularHoliday
                                ? calculateWorkingDaysInRange(hol.startDate, hol.endDate, bankHolidaysList)
                                : 0;
                              const attachedBday = isRegularHoliday && totalWorkingDays > 1
                                ? getBirthdayEntryInsideRange(hol.startDate, hol.endDate)
                                : undefined;
                              const eligibleBdayDate =
                                isRegularHoliday && settings.birthdayLeaveEnabled && totalWorkingDays > 1
                                  ? findBirthdayDayForHolidayRange(
                                      hol.startDate,
                                      hol.endDate,
                                      currentTaxYear,
                                      settings.birthdayLeaveRule || 'within_week',
                                      settings.birthdayMonth && settings.birthdayDay
                                        ? { month: settings.birthdayMonth, day: settings.birthdayDay }
                                        : null,
                                      bankHolidaysList,
                                    )
                                  : null;

                              return (
                                <div
                                  key={hol.id}
                                  onClick={(e) => e.stopPropagation()}
                                  className="border rounded-lg p-2.5 flex items-center justify-between text-xs bg-muted/30 border-border/30"
                                >
                                  <div className="space-y-1 min-w-0 pr-2 text-left">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className={cn(
                                        "text-xs uppercase font-mono font-semibold px-1 py-0.5 rounded border",
                                        isSick
                                          ? "bg-chart-4/15 text-chart-4 border-chart-4/30"
                                          : isBirthday
                                            ? "bg-primary/15 text-primary border-primary/30"
                                            : "bg-positive/15 text-positive border-positive/30"
                                      )}>
                                        {isSick ? '🤒 Sick Day' : isBirthday ? '🎂 Birthday' : '🌴 Holiday'}
                                      </span>
                                      <span className="font-semibold font-mono text-foreground truncate">{hol.occasion}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground block font-mono">
                                      {formatHolidayDates(hol.startDate, hol.endDate)} ({isHalfDay(hol) && hol.halfDay ? `half day, ${HALF_DAY_LABEL[hol.halfDay]}` : `${hol.count} ${hol.count === 1 ? 'day' : 'days'}`})
                                    </span>
                                    {isRegularHoliday && attachedBday && (
                                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                        <span className="bg-primary/20 text-primary border border-primary/40 rounded-sm px-1.5 py-0.5 text-xs font-mono font-semibold">
                                          + {attachedBday.count}d 🎂 ({formatUkDate(attachedBday.startDate)})
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveBirthdayFromHoliday(hol, attachedBday);
                                          }}
                                          aria-label="Remove Birthday Day Off from this leave"
                                          className="text-xs font-mono text-muted-foreground hover:text-destructive underline"
                                        >
                                          Remove 🎂
                                        </button>
                                      </div>
                                    )}
                                    {isRegularHoliday && !attachedBday && settings.birthdayLeaveEnabled && eligibleBdayDate && !yearBdayEntry && (
                                      <div className="pt-0.5">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleApplyBirthdayToHoliday(hol, eligibleBdayDate);
                                          }}
                                          aria-label="Use Birthday Day Off on this leave (saves one day)"
                                          className="bg-primary/15 hover:bg-primary/25 text-primary border border-primary/40 rounded-md px-2 py-0.5 text-xs font-mono font-semibold transition-colors"
                                        >
                                          🎂 Use Birthday Day (-1d)
                                        </button>
                                      </div>
                                    )}
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
                                      title={isSick ? "Edit sick day" : isBirthday ? "Edit birthday leave" : "Edit holiday"}
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
                              {editingHolidayId
                                ? inlineType === 'sick'
                                  ? 'Edit Sick Day'
                                  : inlineType === 'birthday'
                                    ? 'Edit Birthday Day Off'
                                    : 'Edit Leave'
                                : inlineType === 'sick'
                                  ? 'Record Sick Day'
                                  : inlineType === 'birthday'
                                    ? 'Book Birthday Day Off'
                                    : 'Book New Leave'}
                            </span>
                            {/* Type selector toggle */}
                            <div className="flex items-center gap-1 p-0.5 bg-background/80 rounded-lg border border-border/40">
                              <button
                                type="button"
                                onClick={() => setInlineType('holiday')}
                                className={cn(
                                  "px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors border",
                                  inlineType === 'holiday'
                                    ? "bg-positive/20 text-positive border-positive/40 font-semibold shadow-xs"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                              >
                                🌴 Holiday
                              </button>
                              {(settings.birthdayLeaveEnabled || inlineType === 'birthday') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInlineType('birthday');
                                    setInlineUseBirthdayDay(false);
                                    if (!inlineOccasion.trim()) {
                                      setInlineOccasion('Birthday Day Off');
                                    }
                                    const pad = (n: number) => n.toString().padStart(2, '0');
                                    const monthPrefix = `${currentTaxYear}-${pad(monthIdx + 1)}-`;
                                    const eligibleInMonth = birthdayWindow?.eligibleDates.find(d => d.startsWith(monthPrefix));
                                    if (eligibleInMonth) {
                                      setInlineStartDate(eligibleInMonth);
                                      setInlineEndDate(eligibleInMonth);
                                      setInlineCount('1');
                                      setInlineHalfDay(null);
                                    }
                                  }}
                                  className={cn(
                                    "px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors border",
                                    inlineType === 'birthday'
                                      ? "bg-primary/20 text-primary border-primary/40 font-semibold shadow-xs"
                                      : "border-transparent text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  🎂 Birthday
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setInlineType('sick');
                                  setInlineUseBirthdayDay(false);
                                }}
                                className={cn(
                                  "px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors border",
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
                              <Label htmlFor="holiday-inline-occasion" className="text-xs text-muted-foreground font-mono">
                                {inlineType === 'sick' ? 'Reason / Notes' : 'Occasion'}
                              </Label>
                              <Input
                                id="holiday-inline-occasion"
                                placeholder={inlineType === 'sick' ? 'e.g. Cold / Flu, Migraine, Doctor visit' : 'e.g. Skiing, Paris Trip'}
                                value={inlineOccasion}
                                onChange={(e) => setInlineOccasion(e.target.value)}
                                className="h-8 rounded-lg text-xs border-border/40 bg-background/50 font-mono"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-0.5">
                                <Label htmlFor="holiday-inline-start" className="text-xs text-muted-foreground font-mono">Start Date</Label>
                                <Input
                                  id="holiday-inline-start"
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
                                <Label htmlFor="holiday-inline-end" className="text-xs text-muted-foreground font-mono">End Date</Label>
                                <Input
                                  id="holiday-inline-end"
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
                                <span id="holiday-inline-length-label" className="text-xs font-medium leading-snug text-muted-foreground font-mono">Length</span>
                                <div role="group" aria-labelledby="holiday-inline-length-label" className="flex items-center gap-1 p-0.5 bg-background/80 rounded-lg border border-border/40">
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
                                          "px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors border disabled:opacity-40 disabled:pointer-events-none",
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
                            {inlineType === 'holiday' &&
                              !inlineIsSingleDay &&
                              inlineEligibleBdayDate &&
                              (!yearBdayEntry ||
                                (editingHolidayId &&
                                  getBirthdayEntryInsideRange(inlineStartDate, inlineEndDate)?.id === yearBdayEntry.id)) && (
                                <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 flex items-center justify-between gap-2">
                                  <span className="text-xs text-foreground">
                                    🎂 Use Birthday Day Off on <span className="font-semibold">{formatUkDate(inlineEligibleBdayDate)}</span> (saves {inlineBirthdayCount}d annual leave)
                                  </span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={inlineUseBirthdayDay ? 'default' : 'outline'}
                                    aria-pressed={inlineUseBirthdayDay}
                                    onClick={() => {
                                      const nextVal = !inlineUseBirthdayDay;
                                      const count = inlineCount.trim() === '' ? null : adjustHolidayCountForBirthday(Number(inlineCount), inlineBirthdayCount, nextVal);
                                      if (count === null) {
                                        toast({ title: 'Check the leave count', description: 'Enter a valid annual leave count with at least one day available to attach birthday leave.', variant: 'destructive' });
                                        return;
                                      }
                                      setInlineUseBirthdayDay(nextVal);
                                      setInlineCount(String(count));
                                    }}
                                    className="h-7 px-2.5 rounded-lg text-xs font-mono shrink-0"
                                  >
                                    {inlineUseBirthdayDay ? `Included (-${inlineBirthdayCount}d)` : `Use +${inlineBirthdayCount}d 🎂`}
                                  </Button>
                                </div>
                              )}
                            <div className="space-y-0.5">
                              <Label htmlFor="holiday-inline-count" className="text-xs text-muted-foreground font-mono">Days count (working days)</Label>
                              <Input
                                id="holiday-inline-count"
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
  <DialogContent className="sm:rounded-lg border border-border/40 bg-card p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="text-sm uppercase tracking-wider font-mono font-semibold text-foreground flex items-center gap-2">
        <Gift className="w-4 h-4 text-primary" /> Manage Package Benefits & Perks
      </DialogTitle>
      <DialogDescription className="text-xs text-muted-foreground font-mono">
        Add bonuses, allowances, equity and non-cash benefits from your employer. Cash is taxed through payroll and shown after tax; a benefit in kind is taxed on its value, worked out from your salary, region and tax code.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-5 pt-2">

      {/* Total Summary */}
      <div className="rounded-lg border border-border/30 bg-muted/20 p-4 flex items-center justify-between font-mono">
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Total Active Benefits</span>
          <span className="font-mono text-xl font-bold text-foreground">
            {formatGBP(results.totalBenefitsValue)}
            <span className="text-xs font-normal text-muted-foreground ml-1.5">/ year</span>
          </span>
          {results.benefitTaxDeduction > 0 && (
            <span className="block text-xs font-mono text-destructive mt-0.5">
              -{formatGBP(results.benefitTaxDeduction)}/yr benefit-in-kind tax (-{formatGBP(results.benefitTaxDeduction / 12)}/mo)
            </span>
          )}
          {results.benefitTaxCollectedByCode && (
            <span className="block text-xs font-mono text-muted-foreground mt-0.5">
              About {formatGBP(results.benefitTax)}/yr benefit-in-kind tax is collected through your tax code (allowance
              below {formatGBPNoPence(UK_STATUTORY_PERSONAL_ALLOWANCE)}), so it is not taken again here.
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-xs font-semibold text-primary">{settings.packageBenefits?.length || 0} items added</span>
        </div>
      </div>

      {/* Add / Edit Benefit Form */}
      <div className="rounded-lg border border-border/30 bg-muted/10 p-4 space-y-3 font-mono">
        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
          {editingBenefitId ? (
            <>
              <Pencil className="w-3.5 h-3.5 text-primary" /> Edit Benefit
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5 text-primary" /> Add Benefit or Addition
            </>
          )}
        </h4>

        <div className="space-y-1">
          <Label htmlFor="benefit-preset" className="text-xs text-muted-foreground font-mono">Benefit Preset</Label>
          <Select value={selectedBenefitPreset} onValueChange={handleSelectBenefitPreset}>
            <SelectTrigger id="benefit-preset" className="h-9 rounded-lg font-mono text-xs border-border/40 bg-background/60">
              <SelectValue placeholder="Choose a benefit preset or custom..." />
            </SelectTrigger>
            <SelectContent className="font-mono text-xs">
              {BENEFIT_PRESETS.map(preset => (
                <SelectItem key={preset.key} value={preset.key}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <Label htmlFor="benefit-emoji" className="text-xs text-muted-foreground font-mono">Emoji</Label>
            <Input
              id="benefit-emoji"
              value={newBenefitEmoji}
              onChange={(e) => setNewBenefitEmoji(e.target.value)}
              className="h-9 rounded-lg text-center font-emoji border-border/40"
              placeholder="🎁"
            />
          </div>
          <div className="sm:col-span-6 space-y-1">
            <Label htmlFor="benefit-name" className="text-xs text-muted-foreground font-mono">Benefit Name</Label>
            <Input
              id="benefit-name"
              value={newBenefitName}
              onChange={(e) => setNewBenefitName(e.target.value)}
              className="h-9 rounded-lg font-mono text-xs border-border/40"
              placeholder="e.g. Private Medical Insurance"
            />
          </div>
          <div className="sm:col-span-4 space-y-1">
            <Label htmlFor="benefit-type" className="text-xs text-muted-foreground font-mono">Type</Label>
            <Select value={newBenefitType} onValueChange={(val: 'monetary' | 'percentage') => setNewBenefitType(val)}>
              <SelectTrigger id="benefit-type" className="h-9 rounded-lg font-mono text-xs border-border/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="font-mono text-xs">
                <SelectItem value="monetary">Fixed (£)</SelectItem>
                <SelectItem value="percentage">% of Base Salary</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 space-y-1">
            <Label htmlFor="benefit-amount" className="text-xs text-muted-foreground font-mono">Amount / Value ({newBenefitType === 'percentage' ? '%' : '£ / year'})</Label>
            <Input
              id="benefit-amount"
              type="number"
              inputMode="decimal"
              step={newBenefitType === 'percentage' ? '0.1' : '1'}
              value={newBenefitAmount}
              onChange={(e) => setNewBenefitAmount(e.target.value)}
              className="h-9 rounded-lg font-mono text-xs border-border/40"
              placeholder={newBenefitType === 'percentage' ? '10' : '1500'}
            />
          </div>
          <div className="sm:col-span-6 space-y-1">
            <Label htmlFor="benefit-notes" className="text-xs text-muted-foreground font-mono">Notes (optional)</Label>
            <Input
              id="benefit-notes"
              value={newBenefitNotes}
              onChange={(e) => setNewBenefitNotes(e.target.value)}
              className="h-9 rounded-lg font-mono text-xs border-border/40"
              placeholder="e.g. Taxable Benefit in Kind (P11D)"
            />
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <span id="benefit-kind-label" className="block text-xs text-muted-foreground font-mono">Taxed as</span>
          <PillSwitch
            label="Taxed as"
            options={BENEFIT_KINDS}
            value={newBenefitKind}
            onChange={setNewBenefitKind}
          />
          <p className="text-xs text-muted-foreground font-mono">
            {newBenefitKind === 'cash'
              ? 'Paid through payroll: income tax, National Insurance and student loan come off it. Kept out of salary take-home.'
              : 'Not paid to you: income tax is due on its value. Taken from take-home unless your tax code already collects it.'}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          {editingBenefitId && (
            <Button
              type="button"
              variant="ghost"
              onClick={resetBenefitForm}
              className="h-9 rounded-lg text-xs font-mono"
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            onClick={handleAddBenefit}
            className="h-9 rounded-lg gap-1.5 bg-primary text-primary-foreground font-semibold text-xs font-mono px-4"
          >
            {editingBenefitId ? (
              <>
                <Pencil className="w-3.5 h-3.5" /> Update Benefit
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" /> Add Benefit
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Active Benefits List */}
      <div role="group" aria-labelledby="benefit-list-label" className="space-y-2">
        <p id="benefit-list-label" className="text-xs font-medium leading-snug text-muted-foreground font-mono">Configured Package Additions</p>
        <div className="space-y-2">
          {(settings.packageBenefits || []).map((benefit) => {
            const annualVal = benefitValueOf(benefit, settings.grossSalary);
            return (
              <div key={benefit.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/40 hover:bg-card/60 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg shrink-0">{benefit.emoji || '🎁'}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold font-mono text-foreground truncate">{benefit.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {benefit.type === 'percentage' ? `${benefit.amount}% of base salary` : 'Fixed annual amount'}
                      {benefit.notes ? ` · ${benefit.notes}` : ''}
                    </p>
                    {benefit.kind === 'cash' ? (
                      <p className="text-xs text-muted-foreground font-mono">
                        Cash · about {formatGBP(results.cashBenefits.find(c => c.id === benefit.id)?.net ?? 0)}/yr after tax
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground font-mono">Benefit in kind</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="text-right pr-1">
                    <span className="block font-mono text-xs font-bold text-foreground tabular-nums">+{formatGBP(annualVal)}</span>
                    <span className="block font-mono text-xs text-muted-foreground tabular-nums">+{formatGBP(annualVal / 12)}/mo</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleStartEditBenefit(benefit)}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    title="Edit benefit"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteBenefit(benefit.id)}
                    className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Delete benefit"
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
              <p className="text-xs text-muted-foreground/80 mt-0.5">Select a preset above or enter custom additions to build your total package.</p>
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

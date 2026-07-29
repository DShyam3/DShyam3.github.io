import React from 'react';
import { FinanceSettings, UserHoliday } from '@/types/finance';
import { Gift, DollarSign, Settings, Calendar, ChevronRight, Pencil, Trash2, Plus, Info, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  formatGBP,
  getPlanName,
  getDaysInMonth,
  getStartDayOfWeek,
  getNormalizedHolidays,
  getBookedDaysForMonth,
  calculateWorkingDaysInRange,
  formatHolidayDates,
} from '@/components/finance/utils/calculations';

interface RateBreakdown {
  annual: number;
  monthly: number;
  weekly: number;
  daily: number;
  hourly: number;
}

interface BreakdownRates {
  totalPackage: RateBreakdown;
  preTax: RateBreakdown;
  employerPension: RateBreakdown;
  benefits: RateBreakdown;
  pension: RateBreakdown;
  tax: RateBreakdown;
  ni: RateBreakdown;
  studentLoan: RateBreakdown;
  deductions: RateBreakdown;
  postTax: RateBreakdown;
}

interface CalcResults {
  totalPackage: number;
  employerPensionRate: number;
  totalBenefitsValue: number;
  netTakeHome: number;
  personalPensionRate: number;
  incomeTax: number;
  nationalInsurance: number;
  studentLoan: number;
}

interface NextPayday {
  date: Date;
  daysRemaining: number;
  adjusted?: boolean;
  adjustReason?: 'weekend' | 'bank_holiday' | null;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface TaxIncomeTabProps {
  settings: FinanceSettings;
  results: CalcResults;
  breakdownRates: BreakdownRates;
  breakdownWorkingDays: number;
  includeWorkLeaveInActual: boolean;
  onChangeIncludeWorkLeave: (value: boolean) => void;
  onOpenBenefitsDialog: () => void;
  onOpenSettingsDialog: () => void;

  bankHolidaysList: string[];
  bankHolidaysMap: Record<string, string>;
  bankHolidaysLeft: number;
  holidayDefaults: Record<number, { count: number; dates: string; occasion: string }>;
  getHolidaysUsedCount: () => number;

  expandedMonthIdx: number | null;
  onToggleExpandedMonth: (monthIdx: number | null) => void;
  inlineBookMonthIdx: number | null;
  inlineOccasion: string;
  onChangeInlineOccasion: (value: string) => void;
  inlineStartDate: string;
  onChangeInlineStartDate: (value: string) => void;
  inlineEndDate: string;
  onChangeInlineEndDate: (value: string) => void;
  inlineCount: string;
  onChangeInlineCount: (value: string) => void;
  editingHolidayId: string | null;
  onStartEditHoliday: (holiday: UserHoliday, monthIdx: number) => void;
  onStartNewHoliday: (monthIdx: number) => void;
  onSaveInlineHoliday: (monthIdx: number) => void;
  onDeleteHoliday: (holidayId: string) => void;
  onResetInlineHolidayForm: () => void;

  nextPayday: NextPayday;
}

export const TaxIncomeTab: React.FC<TaxIncomeTabProps> = ({
  settings,
  results,
  breakdownRates,
  breakdownWorkingDays,
  includeWorkLeaveInActual,
  onChangeIncludeWorkLeave,
  onOpenBenefitsDialog,
  onOpenSettingsDialog,
  bankHolidaysList,
  bankHolidaysMap,
  bankHolidaysLeft,
  holidayDefaults,
  getHolidaysUsedCount,
  expandedMonthIdx,
  onToggleExpandedMonth,
  inlineBookMonthIdx,
  inlineOccasion,
  onChangeInlineOccasion,
  inlineStartDate,
  onChangeInlineStartDate,
  inlineEndDate,
  onChangeInlineEndDate,
  inlineCount,
  onChangeInlineCount,
  editingHolidayId,
  onStartEditHoliday,
  onStartNewHoliday,
  onSaveInlineHoliday,
  onDeleteHoliday,
  onResetInlineHolidayForm,
  nextPayday,
}) => {
  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Payroll breakdown rate tables */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Total Compensation Summary Card */}
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent backdrop-blur-sm rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 border border-primary/20 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-primary/10 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary mb-1.5">
                  <Gift className="w-3 h-3" /> Total Compensation Package
                </span>
                <h2 className="text-2xl sm:text-3xl font-mono font-extrabold text-foreground">
                  {formatGBP(results.totalPackage)}
                  <span className="text-xs font-sans font-normal text-muted-foreground ml-2">/ year</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Includes Base Salary + Employer Pension Contribution + Benefits & Perks
                </p>
              </div>
              <Button
                onClick={onOpenBenefitsDialog}
                className="h-9 rounded-xl gap-2 bg-primary/90 hover:bg-primary text-primary-foreground text-xs font-semibold shrink-0 self-start sm:self-center"
              >
                <Gift className="w-4 h-4" /> Manage Benefits & Perks ({settings.packageBenefits?.length || 0})
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
              <div className="bg-card/60 backdrop-blur-sm rounded-xl p-3 border border-border/40">
                <span className="block text-[10px] font-medium text-muted-foreground uppercase">Base Gross Salary</span>
                <span className="mt-1 block font-mono text-sm font-bold text-foreground">{formatGBP(settings.grossSalary)}</span>
              </div>
              <div className="bg-card/60 backdrop-blur-sm rounded-xl p-3 border border-border/40">
                <span className="block text-[10px] font-medium text-muted-foreground uppercase">Employer Pension ({settings.employerPensionPercent}%)</span>
                <span className="mt-1 block font-mono text-sm font-bold text-fin-positive">+{formatGBP(results.employerPensionRate)}</span>
              </div>
              <div className="bg-card/60 backdrop-blur-sm rounded-xl p-3 border border-border/40">
                <span className="block text-[10px] font-medium text-muted-foreground uppercase">Benefits & Perks</span>
                <span className="mt-1 block font-mono text-sm font-bold text-fin-positive">+{formatGBP(results.totalBenefitsValue)}</span>
              </div>
              <div className="bg-card/60 backdrop-blur-sm rounded-xl p-3 border border-border/40">
                <span className="block text-[10px] font-medium text-muted-foreground uppercase">Net Take-Home</span>
                <span className="mt-1 block font-mono text-sm font-bold text-primary">{formatGBP(results.netTakeHome)}</span>
              </div>
            </div>
          </div>

          {/* Standard Rates Breakdown */}
          <div className="bg-card/40 backdrop-blur-sm rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 border border-primary/10 shadow-sm">
            <div className="flex flex-col gap-3 mb-4 border-b border-border/50 pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-0.5 text-left min-w-0">
                  <h3 className="font-serif text-base sm:text-lg text-foreground flex items-center gap-2 font-semibold">
                    <DollarSign className="w-5 h-5 text-primary shrink-0" /> Breakdown Rates
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-sans">
                    Rules applied ({settings.ukRegion === 'england-and-wales' ? 'England' : settings.ukRegion}, weekends excluded)
                  </p>
                  <p className="text-xs text-muted-foreground pt-1">
                    {includeWorkLeaveInActual
                      ? `${breakdownWorkingDays} paid days per year — bank holidays and ${settings.workHolidays} days paid leave included.`
                      : `${breakdownWorkingDays} working days per year — bank holidays and ${settings.workHolidays} days paid leave excluded.`}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 rounded-xl border border-border/40 bg-muted/20 px-3 py-2 self-start">
                  <Label htmlFor="include-work-leave" className="text-[11px] font-medium text-muted-foreground cursor-pointer">
                    {includeWorkLeaveInActual ? 'Including paid leave' : 'Excluding paid leave'}
                  </Label>
                  <Switch id="include-work-leave" checked={includeWorkLeaveInActual} onCheckedChange={onChangeIncludeWorkLeave} />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto -mx-1 px-1 scrollbar-thin">
              <table className="min-w-[640px] w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-foreground text-xs uppercase tracking-wider font-bold">
                    <th className="py-3 pr-4 whitespace-nowrap">Category</th>
                    <th className="py-3 px-2 text-right whitespace-nowrap">Annual</th>
                    <th className="py-3 px-2 text-right whitespace-nowrap">Monthly</th>
                    <th className="py-3 px-2 text-right whitespace-nowrap">Weekly</th>
                    <th className="py-3 px-2 text-right whitespace-nowrap">Daily</th>
                    <th className="py-3 pl-2 text-right whitespace-nowrap">Hourly</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30 font-mono text-xs text-foreground">
                  <tr className="hover:bg-primary/10 transition-colors bg-primary/5 dark:bg-primary/15 font-sans font-bold border-b border-primary/20 text-primary">
                    <td className="py-3 pr-4 font-bold text-sm whitespace-nowrap flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-primary shrink-0" /> Total Compensation Package
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-bold text-sm whitespace-nowrap">{formatGBP(breakdownRates.totalPackage.annual)}</td>
                    <td className="py-3 px-2 text-right font-mono font-bold text-sm whitespace-nowrap">{formatGBP(breakdownRates.totalPackage.monthly)}</td>
                    <td className="py-3 px-2 text-right font-mono font-bold text-sm whitespace-nowrap">{formatGBP(breakdownRates.totalPackage.weekly)}</td>
                    <td className="py-3 px-2 text-right font-mono font-bold text-sm whitespace-nowrap">{formatGBP(breakdownRates.totalPackage.daily)}</td>
                    <td className="py-3 pl-2 text-right font-mono font-bold text-sm whitespace-nowrap">{formatGBP(breakdownRates.totalPackage.hourly)}</td>
                  </tr>

                  <tr className="hover:bg-muted/10 transition-colors font-medium">
                    <td className="py-3 pr-4 font-bold font-sans text-foreground whitespace-nowrap">Gross Base Salary</td>
                    <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.annual)}</td>
                    <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.monthly)}</td>
                    <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.weekly)}</td>
                    <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.daily)}</td>
                    <td className="py-3 pl-2 text-right font-semibold whitespace-nowrap">{formatGBP(breakdownRates.preTax.hourly)}</td>
                  </tr>

                  {results.employerPensionRate > 0 && (
                    <tr className="hover:bg-fin-positive/10 transition-colors bg-fin-positive/5 dark:bg-fin-positive/10 text-fin-positive">
                      <td className="py-3 pr-4 font-sans text-left">
                        <div className="flex flex-col justify-center min-w-[120px]">
                          <span className="font-bold flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 shrink-0 text-fin-positive" /> Employer Pension ({settings.employerPensionPercent}%)
                          </span>
                          <span className="text-[10px] opacity-80 font-medium leading-normal mt-0.5">Employer contribution to pension</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.employerPension.annual)}</td>
                      <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.employerPension.monthly)}</td>
                      <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.employerPension.weekly)}</td>
                      <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.employerPension.daily)}</td>
                      <td className="py-3 pl-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.employerPension.hourly)}</td>
                    </tr>
                  )}

                  {results.totalBenefitsValue > 0 && (
                    <tr className="hover:bg-fin-positive/10 transition-colors bg-fin-positive/5 dark:bg-fin-positive/10 text-fin-positive">
                      <td className="py-3 pr-4 font-sans text-left">
                        <div className="flex flex-col justify-center min-w-[120px]">
                          <span className="font-bold flex items-center gap-1.5">
                            <Gift className="w-3.5 h-3.5 shrink-0 text-fin-positive" /> Benefits & Perks ({settings.packageBenefits?.length || 0})
                          </span>
                          <span className="text-[10px] opacity-80 font-medium leading-normal mt-0.5">
                            {(settings.packageBenefits || []).map(b => `${b.emoji || '🎁'} ${b.name}`).join(', ')}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.benefits.annual)}</td>
                      <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.benefits.monthly)}</td>
                      <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.benefits.weekly)}</td>
                      <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.benefits.daily)}</td>
                      <td className="py-3 pl-2 text-right font-semibold whitespace-nowrap">+{formatGBP(breakdownRates.benefits.hourly)}</td>
                    </tr>
                  )}

                  {results.personalPensionRate > 0 && (
                    <tr className="hover:bg-muted/10 transition-colors text-foreground">
                      <td className="py-3 pr-4 font-sans text-left">
                        <div className="flex flex-col justify-center min-w-[120px]">
                          <span className="font-bold text-foreground">Personal Pension ({settings.personalPensionPercent}%)</span>
                          <span className="text-[10px] text-muted-foreground/90 font-medium leading-normal mt-0.5">
                            {settings.pensionType === 'net_pay' ? 'Net Pay' : settings.pensionType === 'salary_sacrifice' ? 'Salary Sacrifice' : 'Relief at Source'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right text-fin-negative font-semibold whitespace-nowrap">-{formatGBP(breakdownRates.pension.annual)}</td>
                      <td className="py-3 px-2 text-right text-fin-negative font-semibold whitespace-nowrap">-{formatGBP(breakdownRates.pension.monthly)}</td>
                      <td className="py-3 px-2 text-right text-fin-negative font-semibold whitespace-nowrap">-{formatGBP(breakdownRates.pension.weekly)}</td>
                      <td className="py-3 px-2 text-right text-fin-negative font-semibold whitespace-nowrap">-{formatGBP(breakdownRates.pension.daily)}</td>
                      <td className="py-3 pl-2 text-right text-fin-negative font-semibold whitespace-nowrap">-{formatGBP(breakdownRates.pension.hourly)}</td>
                    </tr>
                  )}

                  {results.incomeTax > 0 && (
                    <tr className="hover:bg-muted/10 transition-colors text-foreground">
                      <td className="py-3 font-sans font-bold text-foreground">Income Tax</td>
                      <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.tax.annual)}</td>
                      <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.tax.monthly)}</td>
                      <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.tax.weekly)}</td>
                      <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.tax.daily)}</td>
                      <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.tax.hourly)}</td>
                    </tr>
                  )}

                  {results.nationalInsurance > 0 && (
                    <tr className="hover:bg-muted/10 transition-colors text-foreground">
                      <td className="py-3 pr-4 font-sans text-left">
                        <div className="flex flex-col justify-center min-w-[120px]">
                          <span className="font-bold text-foreground">National Insurance</span>
                          <span className="text-[10px] text-muted-foreground/90 font-medium leading-normal mt-0.5">8% (£12,570-£50,270), 2% above</span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.ni.annual)}</td>
                      <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.ni.monthly)}</td>
                      <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.ni.weekly)}</td>
                      <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.ni.daily)}</td>
                      <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.ni.hourly)}</td>
                    </tr>
                  )}

                  {results.studentLoan > 0 && (
                    <tr className="hover:bg-muted/10 transition-colors text-foreground">
                      <td className="py-3 font-sans font-bold text-foreground">Student Loan ({getPlanName(settings.studentLoanPlan)})</td>
                      <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.studentLoan.annual)}</td>
                      <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.studentLoan.monthly)}</td>
                      <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.studentLoan.weekly)}</td>
                      <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.studentLoan.daily)}</td>
                      <td className="py-3 text-right text-fin-negative font-semibold">-{formatGBP(breakdownRates.studentLoan.hourly)}</td>
                    </tr>
                  )}

                  <tr className="hover:bg-fin-negative/10 transition-colors text-fin-negative bg-fin-negative/5 dark:bg-fin-negative/10 font-sans">
                    <td className="py-3 font-bold">Total Deductions</td>
                    <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.annual)}</td>
                    <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.monthly)}</td>
                    <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.weekly)}</td>
                    <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.daily)}</td>
                    <td className="py-3 text-right font-mono font-bold">-{formatGBP(breakdownRates.deductions.hourly)}</td>
                  </tr>

                  <tr className="hover:bg-fin-positive/10 transition-colors text-fin-positive bg-fin-positive/5 dark:bg-fin-positive/10 font-sans">
                    <td className="py-3 font-bold text-sm">Take-Home Pay</td>
                    <td className="py-3 text-right font-mono font-bold text-sm">{formatGBP(breakdownRates.postTax.annual)}</td>
                    <td className="py-3 text-right font-mono font-bold text-sm">{formatGBP(breakdownRates.postTax.monthly)}</td>
                    <td className="py-3 text-right font-mono font-bold text-sm">{formatGBP(breakdownRates.postTax.weekly)}</td>
                    <td className="py-3 text-right font-mono font-bold text-sm">{formatGBP(breakdownRates.postTax.daily)}</td>
                    <td className="py-3 text-right font-mono font-bold text-sm">{formatGBP(breakdownRates.postTax.hourly)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-primary/10 bg-muted/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-serif text-sm font-semibold text-foreground">Settings & Package Options</p>
              <p className="text-[11px] text-muted-foreground">
                {settings.ukRegion === 'england-and-wales' ? 'England & Wales' : settings.ukRegion === 'scotland' ? 'Scotland' : 'Northern Ireland'} tax rules, employer pension ({settings.employerPensionPercent}%), and package benefits.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              <Button onClick={onOpenBenefitsDialog} variant="outline" className="h-9 rounded-xl gap-1.5 border-primary/20 text-xs">
                <Gift className="h-4 w-4 text-primary" /> Benefits ({settings.packageBenefits?.length || 0})
              </Button>
              <Button onClick={onOpenSettingsDialog} className="h-9 rounded-xl gap-1.5 bg-primary text-primary-foreground text-xs shrink-0">
                <Settings className="h-4 w-4" /> Settings
              </Button>
            </div>
          </div>
        </div>

        {/* Right Side: Combined leave balances and holiday tracker */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-card/40 backdrop-blur-sm rounded-[2rem] p-6 border border-primary/10 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border/30 pb-3">
              <div className="min-w-0">
                <h3 className="font-serif text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-primary shrink-0" /> Holiday Tracker
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Click a month card to expand details. Book leave inline or remove booked events easily.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-b border-border/30 pb-4">
              <div className="rounded-xl bg-muted/20 px-2.5 py-2 text-left">
                <span className="block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Allowance</span>
                <span className="mt-1 block font-mono text-sm font-bold text-foreground">
                  {settings.workHolidays}
                  <span className="ml-1 text-[9px] font-normal text-muted-foreground">days</span>
                </span>
              </div>
              <div className="rounded-xl bg-fin-positive/10 px-2.5 py-2 text-left">
                <span className="block text-[9px] font-semibold uppercase tracking-wider text-fin-positive">Left</span>
                <span className="mt-1 block font-mono text-sm font-bold text-fin-positive">
                  {settings.workHolidays - getHolidaysUsedCount()}
                  <span className="ml-1 text-[9px] font-normal">days</span>
                </span>
              </div>
              <div className="rounded-xl bg-fin-accent/10 px-2.5 py-2 text-left">
                <span className="block text-[9px] font-semibold uppercase tracking-wider text-fin-accent">Bank</span>
                <span className="mt-1 block font-mono text-sm font-bold text-fin-accent">
                  {bankHolidaysLeft}/{settings.bankHolidays}
                  <span className="ml-1 text-[9px] font-normal">left</span>
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
                  const monthWorkingDaysBooked = bookedDaysForMonth.length;
                  const isExpanded = expandedMonthIdx === monthIdx;

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
                      onClick={() => onToggleExpandedMonth(isExpanded ? null : monthIdx)}
                      className={cn(
                        'p-3 rounded-2xl bg-muted/10 border border-border/20 flex flex-col transition-all cursor-pointer hover:border-primary/20',
                        isExpanded && 'border-primary/30 ring-1 ring-primary/10 shadow-sm animate-in fade-in zoom-in-95 duration-200',
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-foreground">{month}</span>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          {monthWorkingDaysBooked > 0 && (
                            <span className="bg-fin-positive/10 text-fin-positive font-semibold px-1.5 py-0.5 rounded font-sans">
                              🏝️ {monthWorkingDaysBooked} {monthWorkingDaysBooked === 1 ? 'day' : 'days'}
                            </span>
                          )}
                          <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-200', isExpanded && 'rotate-90')} />
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-1 mb-1 text-[9px] font-semibold text-muted-foreground text-center">
                        <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
                      </div>

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

                          let cellClass = 'w-7 h-7 sm:w-6 sm:h-6 text-[10px] font-mono flex items-center justify-center rounded-full font-medium ';
                          if (isBookedHoliday) cellClass += 'text-fin-positive font-bold';
                          else if (isBankHoliday) cellClass += 'text-fin-accent font-bold';
                          else if (isWeekend) cellClass += 'text-muted-foreground/30';
                          else cellClass += 'text-foreground';

                          const getTooltipDetails = () => {
                            const list: string[] = [];
                            if (isBankHoliday) list.push(`Bank Holiday: ${bankHolidaysMap[dateStr] || 'Public Holiday'}`);
                            if (isBookedHoliday) list.push(`Booked Leave: ${bookedOccasion}`);
                            if (isWeekend) list.push('Weekend');
                            if (list.length === 0) list.push('Working Day');
                            return list;
                          };

                          return (
                            <Tooltip key={dayNum}>
                              <TooltipTrigger asChild>
                                <div className={cellClass}>{dayNum}</div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs p-2.5 rounded-2xl bg-popover border border-border/80 shadow-md">
                                <p className="font-bold text-foreground mb-1">{dayNum} {month} {settings.taxYear}</p>
                                <div className="space-y-1 text-muted-foreground font-sans">
                                  {getTooltipDetails().map((detail, idx) => {
                                    let colorClass = 'text-foreground/80';
                                    if (detail.startsWith('Bank Holiday')) colorClass = 'text-fin-accent font-semibold';
                                    else if (detail.startsWith('Booked Leave')) colorClass = 'text-fin-positive font-semibold';
                                    else if (detail === 'Weekend') colorClass = 'text-muted-foreground/50';
                                    return <p key={idx} className={colorClass}>{detail}</p>;
                                  })}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border/20 mt-3 pt-3 space-y-3">
                          <div className="space-y-1.5">
                            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider block">Booked Leave</span>
                            {overlappingHolidays.length > 0 ? (
                              <div className="space-y-1.5">
                                {overlappingHolidays.map(hol => (
                                  <div
                                    key={hol.id}
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-muted/35 border border-border/15 rounded-xl p-2.5 flex items-center justify-between text-xs"
                                  >
                                    <div className="space-y-0.5 min-w-0 pr-2 text-left">
                                      <span className="font-semibold text-foreground block truncate">{hol.occasion}</span>
                                      <span className="text-[10px] text-muted-foreground block font-mono">
                                        {formatHolidayDates(hol.startDate, hol.endDate)} ({hol.count} {hol.count === 1 ? 'day' : 'days'})
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onStartEditHoliday(hol, monthIdx);
                                        }}
                                        className="h-7 w-7 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-foreground"
                                        title="Edit holiday"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onDeleteHoliday(hol.id);
                                        }}
                                        className="h-7 w-7 rounded-lg hover:bg-fin-negative/10 text-muted-foreground hover:text-fin-negative"
                                        title="Delete holiday"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[10px] text-muted-foreground italic text-center py-1">No leave booked for this month.</div>
                            )}
                          </div>

                          {inlineBookMonthIdx === monthIdx ? (
                            <div onClick={(e) => e.stopPropagation()} className="bg-muted/40 border border-primary/10 rounded-xl p-3 space-y-3 text-left">
                              <span className="text-[10px] font-semibold uppercase tracking-wider block text-primary">
                                {editingHolidayId ? 'Edit Leave' : 'Book New Leave'}
                              </span>
                              <div className="space-y-2">
                                <div className="space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground">Occasion</Label>
                                  <Input
                                    placeholder="e.g. Skiing, Paris Trip"
                                    value={inlineOccasion}
                                    onChange={(e) => onChangeInlineOccasion(e.target.value)}
                                    className="h-8 rounded-lg text-xs border-primary/20 bg-background/50"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-0.5">
                                    <Label className="text-[10px] text-muted-foreground">Start Date</Label>
                                    <Input
                                      type="date"
                                      value={inlineStartDate}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        onChangeInlineStartDate(val);
                                        if (inlineEndDate) {
                                          const workingDays = calculateWorkingDaysInRange(val, inlineEndDate, bankHolidaysList);
                                          onChangeInlineCount(workingDays.toString());
                                        }
                                      }}
                                      className="h-8 rounded-lg text-[10px] border-primary/20 bg-background/50 font-mono"
                                    />
                                  </div>
                                  <div className="space-y-0.5">
                                    <Label className="text-[10px] text-muted-foreground">End Date</Label>
                                    <Input
                                      type="date"
                                      value={inlineEndDate}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        onChangeInlineEndDate(val);
                                        if (inlineStartDate) {
                                          const workingDays = calculateWorkingDaysInRange(inlineStartDate, val, bankHolidaysList);
                                          onChangeInlineCount(workingDays.toString());
                                        }
                                      }}
                                      className="h-8 rounded-lg text-[10px] border-primary/20 bg-background/50 font-mono"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground">Days count (working days)</Label>
                                  <Input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    value={inlineCount}
                                    onChange={(e) => onChangeInlineCount(e.target.value)}
                                    className="h-8 rounded-lg text-xs border-primary/20 bg-background/50 font-mono"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-1.5 pt-1">
                                <Button variant="ghost" size="sm" onClick={onResetInlineHolidayForm} className="h-7 px-2.5 rounded-lg text-[10px]">
                                  Cancel
                                </Button>
                                <Button size="sm" onClick={() => onSaveInlineHoliday(monthIdx)} className="h-7 px-2.5 rounded-lg text-[10px] bg-primary text-primary-foreground">
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
                                onStartNewHoliday(monthIdx);
                              }}
                              className="w-full h-8 rounded-xl text-xs gap-1 border-dashed hover:bg-muted/50"
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
          <div className="bg-card/40 backdrop-blur-sm rounded-[2rem] p-6 border border-primary/10 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border/30 pb-3">
              <div className="min-w-0">
                <h3 className="font-serif text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-primary shrink-0" /> Payday Details
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Your configured payday schedule and next expected pay date.</p>
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
                <span className={cn('font-mono px-2 py-0.5 rounded-lg font-bold text-[10px]', nextPayday.daysRemaining === 0 ? 'bg-fin-positive/10 text-fin-positive' : 'bg-muted/60 text-muted-foreground')}>
                  {nextPayday.daysRemaining === 0 ? 'Paid today!' : `${nextPayday.daysRemaining} days left`}
                </span>
              </div>

              {nextPayday.adjusted && (
                <div className="rounded-xl bg-fin-warn/10 p-2.5 text-[10px] text-fin-warn flex items-start gap-1.5 leading-normal">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Adjusted to working day before due to {nextPayday.adjustReason === 'weekend' ? 'a weekend' : 'a bank holiday'}.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

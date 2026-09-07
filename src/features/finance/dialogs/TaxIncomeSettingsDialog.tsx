import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DollarSign,
  Calendar,
  Sliders,
  ChevronDown,
  Trash2,
  Plus,
  ShieldAlert,
  Briefcase,
  Undo2,
  Loader2,
  Check,
  Gift,
  Clock
} from 'lucide-react';
import { useFinanceData } from '../FinanceDataContext';
import { useFinanceTotals } from '../useFinanceTotals';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  formatNumberInput,
  parseFormattedFloat,
  parseFormattedInt,
  formatGBP
} from '@/features/finance/utils/calculations';
import {
  ALL_SAVINGS_IDS,
  DEFAULT_RECURRING_TEMPLATES,
  DEFAULT_CATEGORY_TEMPLATES,
  SAVINGS_PRESETS
} from '../finance-defaults';
import type { FinanceSettings, TaxConfig, RecurringTemplate, CreditBureauConfig } from '../finance-types';
import { supabase } from '@/integrations/supabase/client';

interface TaxIncomeSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenBenefits?: () => void;
}

export function TaxIncomeSettingsDialog({
  isOpen,
  onOpenChange,
  onOpenBenefits
}: TaxIncomeSettingsDialogProps) {
  const {
    settings,
    setSettings,
    taxConfig,
    setTaxConfig,
    recurringTemplates,
    setRecurringTemplates,
    creditBureaus,
    setCreditBureaus,
    databaseDefaults,
    setDefaultBudgetCategories,
    saveDataToSupabase,
    savingDb,
    setSavingDb,
    fetchingHolidays
  } = useFinanceData();
  const { results } = useFinanceTotals();
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  // Form Draft States for Configuration Editor
  const [draftTaxConfig, setDraftTaxConfig] = useState<TaxConfig>(taxConfig);
  const [draftRecurringTemplates, setDraftRecurringTemplates] = useState<RecurringTemplate[]>(recurringTemplates);
  const [draftCreditBureaus, setDraftCreditBureaus] = useState<CreditBureauConfig[]>(creditBureaus);
  const [draftActiveSavingsTypes, setDraftActiveSavingsTypes] = useState<string[]>([]);
  const [expandedSection, setExpandedSection] = useState<'none' | 'tax' | 'recurring' | 'bureaus' | 'savings'>('none');

  // Config settings form inputs
  const [grossInput, setGrossInput] = useState(formatNumberInput(settings.grossSalary));
  const [personalPensionInput, setPersonalPensionInput] = useState(settings.personalPensionPercent.toString());
  const [employerPensionInput, setEmployerPensionInput] = useState(settings.employerPensionPercent.toString());
  const [taxCodeInput, setTaxCodeInput] = useState(settings.taxCode);
  const [allowanceInput, setAllowanceInput] = useState(formatNumberInput(settings.personalAllowance));
  const [weekendsInput, setWeekendsInput] = useState(settings.weekends.toString());
  const [bankHolsInput, setBankHolsInput] = useState(settings.bankHolidays.toString());
  const [workHolsInput, setWorkHolsInput] = useState(settings.workHolidays.toString());
  const [hoursInput, setHoursInput] = useState(settings.workingHoursPerDay.toString());
  const [payDayInput, setPayDayInput] = useState((settings.payDayOfMonth || 25).toString());
  const [paydaySchedule, setPaydaySchedule] = useState<FinanceSettings['paydaySchedule']>(settings.paydaySchedule || 'monthly_date');
  const [paydayWeekday, setPaydayWeekday] = useState<number>(settings.paydayWeekday !== undefined ? settings.paydayWeekday : 5);
  const [paydayBiweeklyAnchor, setPaydayBiweeklyAnchor] = useState<string>(settings.paydayBiweeklyAnchor || '2026-01-02');

  useEffect(() => {
    if (isOpen) {
      setDraftTaxConfig(taxConfig);
      setDraftRecurringTemplates(recurringTemplates);
      setDraftCreditBureaus(creditBureaus);
      setDraftActiveSavingsTypes(settings.activeSavingsTypes || ALL_SAVINGS_IDS);
      setExpandedSection('none');
      setGrossInput(formatNumberInput(settings.grossSalary));
      setPersonalPensionInput(settings.personalPensionPercent.toString());
      setEmployerPensionInput(settings.employerPensionPercent.toString());
      setTaxCodeInput(settings.taxCode);
      setAllowanceInput(formatNumberInput(settings.personalAllowance));
      setWeekendsInput(settings.weekends.toString());
      setBankHolsInput(settings.bankHolidays.toString());
      setWorkHolsInput(settings.workHolidays.toString());
      setHoursInput(settings.workingHoursPerDay.toString());
      setPayDayInput((settings.payDayOfMonth || 25).toString());
      setPaydaySchedule(settings.paydaySchedule || 'monthly_date');
      setPaydayWeekday(settings.paydayWeekday !== undefined ? settings.paydayWeekday : 5);
      setPaydayBiweeklyAnchor(settings.paydayBiweeklyAnchor || '2026-01-02');
    }
  }, [isOpen, taxConfig, recurringTemplates, creditBureaus, settings]);

  const handleTaxCodeChange = (code: string) => {
    setTaxCodeInput(code);
    const cleaned = code.trim().toUpperCase();
    const match = cleaned.match(/^(\d+)L$/);
    if (match) {
      const numVal = parseInt(match[1], 10) * 10;
      setAllowanceInput(formatNumberInput(numVal));
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    const newGross = parseFormattedFloat(grossInput);
    const newPersonalPension = parseFloat(personalPensionInput);
    const newEmployerPension = parseFloat(employerPensionInput);
    const newAllowance = parseFormattedFloat(allowanceInput);
    const newWeekends = parseInt(weekendsInput, 10);
    const newBankHols = parseInt(bankHolsInput, 10);
    const newWorkHols = parseInt(workHolsInput, 10);
    const newHours = parseFloat(hoursInput);

    if (isNaN(newGross) || newGross < 0) {
      toast({ title: 'Invalid Salary', description: 'Please enter a valid gross salary.', variant: 'destructive' });
      return;
    }
    if (isNaN(newPersonalPension) || newPersonalPension < 0 || newPersonalPension > 100) {
      toast({ title: 'Invalid Pension', description: 'Personal pension contribution must be 0% - 100%.', variant: 'destructive' });
      return;
    }
    if (isNaN(newEmployerPension) || newEmployerPension < 0 || newEmployerPension > 100) {
      toast({ title: 'Invalid Pension', description: 'Employer pension contribution must be 0% - 100%.', variant: 'destructive' });
      return;
    }
    if (isNaN(newAllowance) || newAllowance < 0) {
      toast({ title: 'Invalid Allowance', description: 'Personal allowance must be a positive number.', variant: 'destructive' });
      return;
    }
    if (isNaN(newWeekends) || newWeekends < 0 || newWeekends > 365) {
      toast({ title: 'Invalid Days', description: 'Weekends must be 0 - 365 days.', variant: 'destructive' });
      return;
    }
    if (isNaN(newHours) || newHours <= 0 || newHours > 24) {
      toast({ title: 'Invalid Hours', description: 'Working hours must be 0.1 - 24 hours/day.', variant: 'destructive' });
      return;
    }

    let newPayDay = parseInt(payDayInput, 10);
    if (paydaySchedule === 'monthly_date') {
      if (isNaN(newPayDay) || newPayDay < 1 || newPayDay > 31) {
        toast({ title: 'Invalid Payday', description: 'Pay day of month must be between 1 and 31.', variant: 'destructive' });
        return;
      }
    } else {
      if (isNaN(newPayDay) || newPayDay < 1 || newPayDay > 31) {
        newPayDay = 25; // default fallback
      }
    }

    // Additional biweekly anchor validation
    if (paydaySchedule === 'biweekly' && !paydayBiweeklyAnchor) {
      toast({ title: 'Invalid Anchor Date', description: 'Please select a reference anchor date for the bi-weekly schedule.', variant: 'destructive' });
      return;
    }

    const updatedSettings: FinanceSettings = {
      ...settings,
      grossSalary: newGross,
      personalPensionPercent: newPersonalPension,
      employerPensionPercent: newEmployerPension,
      taxCode: taxCodeInput.trim() || '1257L',
      personalAllowance: newAllowance,
      weekends: newWeekends,
      bankHolidays: newBankHols,
      workHolidays: newWorkHols,
      workingHoursPerDay: newHours,
      payDayOfMonth: newPayDay,
      paydaySchedule,
      paydayWeekday,
      paydayBiweeklyAnchor,
      activeSavingsTypes: draftActiveSavingsTypes,
    };

    setSettings(updatedSettings);
    setTaxConfig(draftTaxConfig);
    setRecurringTemplates(draftRecurringTemplates);
    setCreditBureaus(draftCreditBureaus);

    setSavingDb(true);
    try {
      await Promise.all([
        saveDataToSupabase('settings', updatedSettings),
        saveDataToSupabase('tax_config', draftTaxConfig),
        saveDataToSupabase('recurring_templates', draftRecurringTemplates),
        saveDataToSupabase('credit_bureaus', draftCreditBureaus)
      ]);
      toast({ title: 'Settings Saved', description: 'Configurations synchronized with Supabase.' });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({ title: 'Local Save Only', description: 'Failed to sync with Supabase, saved to browser cache.', variant: 'destructive' });
      onOpenChange(false);
    } finally {
      setSavingDb(false);
    }
  };

  const handleResetDefaults = async () => {
    const defaultSettings: FinanceSettings = databaseDefaults.settings || {
      grossSalary: 0,
      pensionType: 'net_pay',
      personalPensionPercent: 0,
      employerPensionPercent: 0,
      studentLoanPlan: 'none',
      taxCode: '1257L',
      personalAllowance: 12570,
      weekends: 104,
      bankHolidays: 8,
      workHolidays: 25,
      workingHoursPerDay: 7.5,
      taxYear: 2026,
      ukRegion: 'england-and-wales',
      holidaysByUser: {},
      activeSavingsTypes: ALL_SAVINGS_IDS
    };
    const defaultTaxConfig: TaxConfig = databaseDefaults.tax_config || {
      studentLoanThresholds: { none: Infinity, plan1: 0, plan2: 0, plan4: 0, plan5: 0, postgrad: 0 },
      studentLoanRates: { none: 0, plan1: 0, plan2: 0, plan4: 0, plan5: 0, postgrad: 0 },
      incomeTaxBands: { basicRateLimit: 0, higherRateLimit: 0, basicRatePercent: 0, higherRatePercent: 0, additionalRatePercent: 0 },
      nationalInsuranceBands: { lowerThreshold: 0, upperThreshold: 0, mainRatePercent: 0, upperRatePercent: 0 }
    };
    const defaultRecurringTemplates = databaseDefaults.recurring_templates?.length
      ? databaseDefaults.recurring_templates
      : DEFAULT_RECURRING_TEMPLATES;
    const defaultCreditBureaus = databaseDefaults.credit_bureaus || [];
    const defaultCategoryTemplates = databaseDefaults.default_budget_categories?.length
      ? databaseDefaults.default_budget_categories
      : DEFAULT_CATEGORY_TEMPLATES;

    setSettings(defaultSettings);
    setDraftTaxConfig(defaultTaxConfig);
    setDraftRecurringTemplates(defaultRecurringTemplates);
    setDraftCreditBureaus(defaultCreditBureaus);
    setDraftActiveSavingsTypes(defaultSettings.activeSavingsTypes || ALL_SAVINGS_IDS);
    setDefaultBudgetCategories(defaultCategoryTemplates);

    setGrossInput(formatNumberInput(defaultSettings.grossSalary));
    setPersonalPensionInput(defaultSettings.personalPensionPercent.toString());
    setEmployerPensionInput(defaultSettings.employerPensionPercent.toString());
    setTaxCodeInput(defaultSettings.taxCode);
    setAllowanceInput(formatNumberInput(defaultSettings.personalAllowance));
    setWeekendsInput(defaultSettings.weekends.toString());
    setBankHolsInput(defaultSettings.bankHolidays.toString());
    setWorkHolsInput(defaultSettings.workHolidays.toString());
    setHoursInput(defaultSettings.workingHoursPerDay.toString());
    setPayDayInput((defaultSettings.payDayOfMonth || 25).toString());
    setPaydaySchedule(defaultSettings.paydaySchedule || 'monthly_date');
    setPaydayWeekday(defaultSettings.paydayWeekday !== undefined ? defaultSettings.paydayWeekday : 5);
    setPaydayBiweeklyAnchor(defaultSettings.paydayBiweeklyAnchor || '2026-01-02');

    if (isAdmin) {
      try {
        const deleteTables = [
          'finance_settings', 'finance_user_holidays', 'finance_goals', 'finance_goal_contributions',
          'finance_bank_accounts', 'finance_memberships', 'finance_debts', 'finance_credit_scores',
          'finance_budget_categories', 'finance_budget_items', 'finance_recurring_bills',
          'finance_transactions', 'finance_tax_configs', 'finance_recurring_templates',
          'finance_credit_bureaus', 'finance_holiday_defaults', 'finance_budget_presets'
        ];
        await Promise.all(deleteTables.map(t => supabase.from(t as 'finance_settings').delete().eq('is_default', false)));
        toast({ title: 'Reset successful', description: 'Database and local configurations reverted to defaults.' });
      } catch (err) {
        console.error('Failed to reset custom database records:', err);
        toast({ title: 'Local Reset successful', description: 'Returned configurations to default values. Failed to clear database.', variant: 'destructive' });
      }
    } else {
      toast({ title: 'Reset successful', description: 'Returned configurations to default values.' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="!flex !flex-col sm:rounded-xl border border-border/40 bg-card font-mono w-[calc(100vw-1.5rem)] sm:w-full max-w-2xl lg:max-w-3xl max-h-[90dvh] gap-0 p-0 overflow-hidden shadow-none">
        <DialogHeader className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-border/40 text-left shrink-0">
          <DialogTitle className="font-mono text-base font-bold tracking-tight text-foreground">Tax & Income Settings</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-mono">
            Salary, pension, tax code, and working day parameters.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSaveSettings} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6">
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/20 border border-border/30">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Salary & Pension</h3>
                  <p className="text-xs text-muted-foreground">Core income and contribution settings</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="grossSalary" className="text-xs font-medium text-muted-foreground">Annual gross salary</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
                    <Input
                      id="grossSalary"
                      type="text"
                      inputMode="decimal"
                      value={grossInput}
                      onChange={(e) => setGrossInput(formatNumberInput(e.target.value))}
                      className="rounded-lg h-9 pl-7 border border-border/40 bg-background/50 font-mono text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="paydaySchedule" className="text-xs font-medium text-muted-foreground">Payday Schedule</Label>
                  <Select
                    value={paydaySchedule}
                    onValueChange={(val) => setPaydaySchedule(val as FinanceSettings['paydaySchedule'])}
                  >
                    <SelectTrigger id="paydaySchedule" className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono">
                      <SelectValue placeholder="Select schedule..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border border-border/40 bg-popover font-mono text-xs">
                      <SelectItem value="monthly_date">Monthly on specific date</SelectItem>
                      <SelectItem value="last_working_day">Last working day of month</SelectItem>
                      <SelectItem value="last_friday">Last Friday of month</SelectItem>
                      <SelectItem value="biweekly">Every 2 weeks (Bi-weekly)</SelectItem>
                      <SelectItem value="weekly">Every week (Weekly)</SelectItem>
                      <SelectItem value="semimonthly">Semi-monthly (15th & Last working day)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paydaySchedule === 'monthly_date' && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Label htmlFor="payDay" className="text-xs font-medium text-muted-foreground">Scheduled Payday (Day of Month)</Label>
                    <Input
                      id="payDay"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="31"
                      value={payDayInput}
                      onChange={(e) => setPayDayInput(e.target.value)}
                      className="rounded-lg h-9 border border-border/40 bg-background/50 font-mono text-xs"
                      required
                    />
                  </div>
                )}

                {paydaySchedule === 'weekly' && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Label htmlFor="paydayWeekday" className="text-xs font-medium text-muted-foreground">Weekly Payday</Label>
                    <Select
                      value={paydayWeekday.toString()}
                      onValueChange={(val) => setPaydayWeekday(parseInt(val, 10))}
                    >
                      <SelectTrigger id="paydayWeekday" className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono">
                        <SelectValue placeholder="Select day..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border border-border/40 bg-popover font-mono text-xs">
                        <SelectItem value="1">Monday</SelectItem>
                        <SelectItem value="2">Tuesday</SelectItem>
                        <SelectItem value="3">Wednesday</SelectItem>
                        <SelectItem value="4">Thursday</SelectItem>
                        <SelectItem value="5">Friday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {paydaySchedule === 'biweekly' && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Label htmlFor="biweeklyAnchor" className="text-xs font-medium text-muted-foreground">Reference Anchor Payday</Label>
                    <Input
                      id="biweeklyAnchor"
                      type="date"
                      value={paydayBiweeklyAnchor}
                      onChange={(e) => setPaydayBiweeklyAnchor(e.target.value)}
                      className="rounded-lg h-9 border border-border/40 bg-background/50 font-mono text-xs"
                      required
                    />
                    <p className="text-xs text-muted-foreground">A known past or future payday to establish the 14-day cycle cadence.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Pension arrangement</Label>
                    <Select
                      value={settings.pensionType}
                      onValueChange={(val) => setSettings({ ...settings, pensionType: val as FinanceSettings['pensionType'] })}
                    >
                      <SelectTrigger className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono">
                        <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border border-border/40 bg-popover font-mono text-xs">
                        <SelectItem value="net_pay">Net pay (pre-tax deduction)</SelectItem>
                        <SelectItem value="salary_sacrifice">Salary sacrifice</SelectItem>
                        <SelectItem value="relief_at_source">Relief at source (post-tax)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Student loan plan</Label>
                    <Select
                      value={settings.studentLoanPlan}
                      onValueChange={(val) => setSettings({ ...settings, studentLoanPlan: val as FinanceSettings['studentLoanPlan'] })}
                    >
                      <SelectTrigger className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono">
                        <SelectValue placeholder="Select plan..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border border-border/40 bg-popover font-mono text-xs">
                        <SelectItem value="none">No student loan</SelectItem>
                        <SelectItem value="plan1">Plan 1 (pre-2012)</SelectItem>
                        <SelectItem value="plan2">Plan 2 (post-2012)</SelectItem>
                        <SelectItem value="plan4">Plan 4 (Scotland)</SelectItem>
                        <SelectItem value="plan5">Plan 5 (post-2023)</SelectItem>
                        <SelectItem value="postgrad">Postgraduate loan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="personalPension" className="text-xs font-medium text-muted-foreground">Personal contribution</Label>
                    <div className="relative">
                      <Input
                        id="personalPension"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        step="0.1"
                        value={personalPensionInput}
                        onChange={(e) => setPersonalPensionInput(e.target.value)}
                        className="rounded-lg h-9 pr-7 border border-border/40 bg-background/50 font-mono text-xs"
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="employerPension" className="text-xs font-medium text-muted-foreground">Employer contribution</Label>
                    <div className="relative">
                      <Input
                        id="employerPension"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        step="0.1"
                        value={employerPensionInput}
                        onChange={(e) => setEmployerPensionInput(e.target.value)}
                        className="rounded-lg h-9 pr-7 border border-border/40 bg-background/50 font-mono text-xs"
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-muted/20 border border-border/30 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-primary" /> Benefits & Package Perks
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {settings.packageBenefits?.length ? `${settings.packageBenefits.length} active additions (${formatGBP(results.totalBenefitsValue)}/yr)` : 'No custom benefits added yet'}
                    </p>
                  </div>
                  {onOpenBenefits && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onOpenBenefits}
                      className="h-7 rounded-lg text-xs gap-1.5 border border-border/40 bg-background/60 hover:bg-muted/30 font-mono"
                    >
                      <Gift className="w-3 h-3 text-primary" /> Manage Perks
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="taxCode" className="text-xs font-medium text-muted-foreground">Tax code</Label>
                    <Input
                      id="taxCode"
                      type="text"
                      value={taxCodeInput}
                      onChange={(e) => handleTaxCodeChange(e.target.value)}
                      className="rounded-lg h-9 border border-border/40 bg-background/50 uppercase font-mono text-xs"
                      placeholder="1257L"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="allowance" className="text-xs font-medium text-muted-foreground">Personal allowance override</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
                      <Input
                        id="allowance"
                        type="text"
                        inputMode="numeric"
                        value={allowanceInput}
                        onChange={(e) => setAllowanceInput(formatNumberInput(e.target.value))}
                        className="rounded-lg h-9 pl-7 border border-border/40 bg-background/50 font-mono text-xs"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4 pt-2 border-t border-border/40">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/20 border border-border/30">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Working days</h3>
                  <p className="text-xs text-muted-foreground">Region, tax year, leave, and hours</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">UK region</Label>
                    <Select
                      value={settings.ukRegion}
                      onValueChange={(val) => setSettings({ ...settings, ukRegion: val as FinanceSettings['ukRegion'] })}
                    >
                      <SelectTrigger className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono">
                        <SelectValue placeholder="Select region..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border border-border/40 bg-popover font-mono text-xs">
                        <SelectItem value="england-and-wales">England & Wales</SelectItem>
                        <SelectItem value="scotland">Scotland</SelectItem>
                        <SelectItem value="northern-ireland">Northern Ireland</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Tax year</Label>
                    <Select
                      value={settings.taxYear.toString()}
                      onValueChange={(val) => setSettings({ ...settings, taxYear: parseInt(val, 10) })}
                    >
                      <SelectTrigger className="rounded-lg h-9 border border-border/40 bg-background/50 text-xs font-mono">
                        <SelectValue placeholder="Select year..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border border-border/40 bg-popover font-mono text-xs">
                        <SelectItem value="2025">2025</SelectItem>
                        <SelectItem value="2026">2026</SelectItem>
                        <SelectItem value="2027">2027</SelectItem>
                        <SelectItem value="2028">2028</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Weekends</p>
                    <p className="mt-0.5 text-xs font-mono font-semibold text-foreground">
                      {settings.weekends}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">days</span>
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      Bank holidays
                      {fetchingHolidays && <Loader2 className="h-3 w-3 animate-spin" />}
                    </p>
                    <p className="mt-0.5 text-xs font-mono font-semibold text-foreground">
                      {settings.bankHolidays}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">days</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="workHolidays" className="text-xs font-medium text-muted-foreground">Annual work leave</Label>
                    <Input
                      id="workHolidays"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="365"
                      value={workHolsInput}
                      onChange={(e) => setWorkHolsInput(e.target.value)}
                      className="rounded-lg h-9 border border-border/40 bg-background/50 font-mono text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hours" className="text-xs font-medium text-muted-foreground">Hours per day</Label>
                    <Input
                      id="hours"
                      type="number"
                      inputMode="decimal"
                      min="0.1"
                      max="24"
                      step="0.1"
                      value={hoursInput}
                      onChange={(e) => setHoursInput(e.target.value)}
                      className="rounded-lg h-9 border border-border/40 bg-background/50 font-mono text-xs"
                      required
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION: Advanced Database Configurations */}
            <section className="space-y-4 pt-4 border-t border-border/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/20 border border-border/30">
                    <Sliders className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Advanced Configurations</h3>
                    <p className="text-xs text-muted-foreground">Customize tax bands, recurring templates, and credit bureaus</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {/* Item 1: Tax Bands */}
                <div className="rounded-lg border border-border/30 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedSection(expandedSection === 'tax' ? 'none' : 'tax')}
                    className="w-full flex items-center justify-between p-2.5 bg-muted/10 text-xs font-semibold hover:bg-muted/20 transition-colors text-left font-mono"
                  >
                    <span className="flex items-center gap-2"><DollarSign className="w-3.5 h-3.5 text-primary" /> Income Tax & NI Bands</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedSection === 'tax' ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedSection === 'tax' && (
                    <div className="p-4 bg-background/30 border-t border-border/20 space-y-4 text-xs">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider font-mono">Income Tax Bands (£)</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Basic Rate Limit</Label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={formatNumberInput(draftTaxConfig.incomeTaxBands.basicRateLimit)}
                              onChange={(e) => setDraftTaxConfig({
                                ...draftTaxConfig,
                                incomeTaxBands: {
                                  ...draftTaxConfig.incomeTaxBands,
                                  basicRateLimit: parseFormattedFloat(e.target.value) || 0
                                }
                              })}
                              className="h-9 rounded-lg font-mono text-xs border-border/40"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Higher Rate Limit</Label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={formatNumberInput(draftTaxConfig.incomeTaxBands.higherRateLimit)}
                              onChange={(e) => setDraftTaxConfig({
                                ...draftTaxConfig,
                                incomeTaxBands: {
                                  ...draftTaxConfig.incomeTaxBands,
                                  higherRateLimit: parseFormattedFloat(e.target.value) || 0
                                }
                              })}
                              className="h-9 rounded-lg font-mono text-xs border-border/40"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Basic Rate %</Label>
                            <Input
                              type="number"
                              value={draftTaxConfig.incomeTaxBands.basicRatePercent}
                              onChange={(e) => setDraftTaxConfig({
                                ...draftTaxConfig,
                                incomeTaxBands: {
                                  ...draftTaxConfig.incomeTaxBands,
                                  basicRatePercent: parseFloat(e.target.value) || 0
                                }
                              })}
                              className="h-9 rounded-lg font-mono text-xs border-border/40"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Higher Rate %</Label>
                            <Input
                              type="number"
                              value={draftTaxConfig.incomeTaxBands.higherRatePercent}
                              onChange={(e) => setDraftTaxConfig({
                                ...draftTaxConfig,
                                incomeTaxBands: {
                                  ...draftTaxConfig.incomeTaxBands,
                                  higherRatePercent: parseFloat(e.target.value) || 0
                                }
                              })}
                              className="h-9 rounded-lg font-mono text-xs border-border/40"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Additional Rate %</Label>
                            <Input
                              type="number"
                              value={draftTaxConfig.incomeTaxBands.additionalRatePercent}
                              onChange={(e) => setDraftTaxConfig({
                                ...draftTaxConfig,
                                incomeTaxBands: {
                                  ...draftTaxConfig.incomeTaxBands,
                                  additionalRatePercent: parseFloat(e.target.value) || 0
                                }
                              })}
                              className="h-9 rounded-lg font-mono text-xs border-border/40"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 pt-3 border-t border-border/20">
                        <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider font-mono">National Insurance Bands (£)</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Lower Threshold</Label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={formatNumberInput(draftTaxConfig.nationalInsuranceBands.lowerThreshold)}
                              onChange={(e) => setDraftTaxConfig({
                                ...draftTaxConfig,
                                nationalInsuranceBands: {
                                  ...draftTaxConfig.nationalInsuranceBands,
                                  lowerThreshold: parseFormattedFloat(e.target.value) || 0
                                }
                              })}
                              className="h-9 rounded-lg font-mono text-xs border-border/40"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Upper Threshold</Label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={formatNumberInput(draftTaxConfig.nationalInsuranceBands.upperThreshold)}
                              onChange={(e) => setDraftTaxConfig({
                                ...draftTaxConfig,
                                nationalInsuranceBands: {
                                  ...draftTaxConfig.nationalInsuranceBands,
                                  upperThreshold: parseFormattedFloat(e.target.value) || 0
                                }
                              })}
                              className="h-9 rounded-lg font-mono text-xs border-border/40"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Main Rate %</Label>
                            <Input
                              type="number"
                              value={draftTaxConfig.nationalInsuranceBands.mainRatePercent}
                              onChange={(e) => setDraftTaxConfig({
                                ...draftTaxConfig,
                                nationalInsuranceBands: {
                                  ...draftTaxConfig.nationalInsuranceBands,
                                  mainRatePercent: parseFloat(e.target.value) || 0
                                }
                              })}
                              className="h-9 rounded-lg font-mono text-xs border-border/40"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Upper Rate %</Label>
                            <Input
                              type="number"
                              value={draftTaxConfig.nationalInsuranceBands.upperRatePercent}
                              onChange={(e) => setDraftTaxConfig({
                                ...draftTaxConfig,
                                nationalInsuranceBands: {
                                  ...draftTaxConfig.nationalInsuranceBands,
                                  upperRatePercent: parseFloat(e.target.value) || 0
                                }
                              })}
                              className="h-9 rounded-lg font-mono text-xs border-border/40"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 pt-3 border-t border-border/20">
                        <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider font-mono">Student Loan Thresholds (£)</h4>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                          {(Object.keys(draftTaxConfig.studentLoanThresholds) as Array<keyof typeof draftTaxConfig.studentLoanThresholds>).map((plan) => {
                            if (plan === 'none') return null;
                            return (
                              <div key={String(plan)} className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase">{String(plan)}</Label>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={formatNumberInput(draftTaxConfig.studentLoanThresholds[plan])}
                                  onChange={(e) => setDraftTaxConfig({
                                    ...draftTaxConfig,
                                    studentLoanThresholds: {
                                      ...draftTaxConfig.studentLoanThresholds,
                                      [plan]: parseFormattedFloat(e.target.value) || 0
                                    }
                                  })}
                                  className="h-9 rounded-lg font-mono text-xs border-border/40"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Item 2: Recurring Bill Templates */}
                <div className="rounded-lg border border-border/30 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedSection(expandedSection === 'recurring' ? 'none' : 'recurring')}
                    className="w-full flex items-center justify-between p-2.5 bg-muted/10 text-xs font-semibold hover:bg-muted/20 transition-colors text-left font-mono"
                  >
                    <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-primary" /> Recurring Bill Templates</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedSection === 'recurring' ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedSection === 'recurring' && (
                    <div className="p-4 bg-background/30 border-t border-border/20 space-y-4 text-xs">
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {draftRecurringTemplates.map((template, idx) => (
                          <div key={idx} className="flex flex-col gap-2 p-2.5 rounded-lg border border-border/30 bg-card/50 relative group">
                            <button
                              type="button"
                              onClick={() => setDraftRecurringTemplates(draftRecurringTemplates.filter((_, i) => i !== idx))}
                              className="absolute top-2 right-2 text-destructive hover:text-destructive opacity-60 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <div className="grid grid-cols-12 gap-2 pr-6">
                              <div className="col-span-2 space-y-1">
                                <Label className="text-xs text-muted-foreground">Emoji</Label>
                                <Input
                                  value={template.emoji}
                                  onChange={(e) => {
                                    const updated = [...draftRecurringTemplates];
                                    updated[idx] = { ...template, emoji: e.target.value };
                                    setDraftRecurringTemplates(updated);
                                  }}
                                  className="h-8 text-center rounded-lg text-xs p-1 border-border/40"
                                />
                              </div>
                              <div className="col-span-5 space-y-1">
                                <Label className="text-xs text-muted-foreground">Name</Label>
                                <Input
                                  value={template.name}
                                  onChange={(e) => {
                                    const updated = [...draftRecurringTemplates];
                                    updated[idx] = { ...template, name: e.target.value };
                                    setDraftRecurringTemplates(updated);
                                  }}
                                  className="h-8 rounded-lg text-xs border-border/40"
                                />
                              </div>
                              <div className="col-span-5 space-y-1">
                                <Label className="text-xs text-muted-foreground">Category</Label>
                                <Input
                                  value={template.category}
                                  onChange={(e) => {
                                    const updated = [...draftRecurringTemplates];
                                    updated[idx] = { ...template, category: e.target.value };
                                    setDraftRecurringTemplates(updated);
                                  }}
                                  className="h-8 rounded-lg text-xs border-border/40"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Amount (£)</Label>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={formatNumberInput(template.defaultAmount)}
                                  onChange={(e) => {
                                    const updated = [...draftRecurringTemplates];
                                    updated[idx] = { ...template, defaultAmount: parseFormattedFloat(e.target.value) || 0 };
                                    setDraftRecurringTemplates(updated);
                                  }}
                                  className="h-8 rounded-lg text-xs font-mono border-border/40"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Tag</Label>
                                <Input
                                  value={template.tag}
                                  onChange={(e) => {
                                    const updated = [...draftRecurringTemplates];
                                    updated[idx] = { ...template, tag: e.target.value.toUpperCase() };
                                    setDraftRecurringTemplates(updated);
                                  }}
                                  className="h-8 rounded-lg text-xs font-mono uppercase border-border/40"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Frequency</Label>
                                <select
                                  value={template.frequency}
                                  onChange={(e) => {
                                    const updated = [...draftRecurringTemplates];
                                    updated[idx] = { ...template, frequency: e.target.value as RecurringTemplate['frequency'] };
                                    setDraftRecurringTemplates(updated);
                                  }}
                                  className="flex w-full rounded-lg border border-border/40 bg-background/50 h-8 px-2 text-xs text-foreground focus:outline-none font-mono"
                                >
                                  <option value="weekly">Weekly</option>
                                  <option value="monthly">Monthly</option>
                                  <option value="quarterly">Quarterly</option>
                                  <option value="annually">Annually</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDraftRecurringTemplates([
                          ...draftRecurringTemplates,
                          { name: 'New Bill', category: 'General', emoji: '💸', tag: 'NEW_BILL', defaultAmount: 10, frequency: 'monthly', linkedBudgetItemId: '' }
                        ])}
                        className="w-full h-8 text-xs rounded-lg border-dashed border-border/40 font-mono"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Custom Template
                      </Button>
                    </div>
                  )}
                </div>

                {/* Item 3: Credit Bureaus */}
                <div className="rounded-lg border border-border/30 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedSection(expandedSection === 'bureaus' ? 'none' : 'bureaus')}
                    className="w-full flex items-center justify-between p-2.5 bg-muted/10 text-xs font-semibold hover:bg-muted/20 transition-colors text-left font-mono"
                  >
                    <span className="flex items-center gap-2"><ShieldAlert className="w-3.5 h-3.5 text-primary" /> Credit Bureau Gauges</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedSection === 'bureaus' ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedSection === 'bureaus' && (
                    <div className="p-4 bg-background/30 border-t border-border/20 space-y-4 text-xs">
                      <div className="space-y-3">
                        {draftCreditBureaus.map((bureau, idx) => (
                          <div key={bureau.key} className="flex flex-col gap-2 p-2.5 rounded-lg border border-border/30 bg-card/50">
                            <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
                              {bureau.emoji} {bureau.label} Config
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Label</Label>
                                <Input
                                  value={bureau.label}
                                  onChange={(e) => {
                                    const updated = [...draftCreditBureaus];
                                    updated[idx] = { ...bureau, label: e.target.value };
                                    setDraftCreditBureaus(updated);
                                  }}
                                  className="h-8 rounded-lg text-xs border-border/40"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Max Score</Label>
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  value={formatNumberInput(bureau.maxScore)}
                                  onChange={(e) => {
                                    const updated = [...draftCreditBureaus];
                                    updated[idx] = { ...bureau, maxScore: parseFormattedInt(e.target.value) || 1000 };
                                    setDraftCreditBureaus(updated);
                                  }}
                                  className="h-8 rounded-lg text-xs font-mono border-border/40"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Emoji</Label>
                                <Input
                                  value={bureau.emoji}
                                  onChange={(e) => {
                                    const updated = [...draftCreditBureaus];
                                    updated[idx] = { ...bureau, emoji: e.target.value };
                                    setDraftCreditBureaus(updated);
                                  }}
                                  className="h-8 rounded-lg text-xs text-center border-border/40"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Item 4: Active Savings Types */}
                <div className="rounded-lg border border-border/30 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedSection(expandedSection === 'savings' ? 'none' : 'savings')}
                    className="w-full flex items-center justify-between p-2.5 bg-muted/10 text-xs font-semibold hover:bg-muted/20 transition-colors text-left font-mono"
                  >
                    <span className="flex items-center gap-2"><Briefcase className="w-3.5 h-3.5 text-primary" /> Active Savings Types</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedSection === 'savings' ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedSection === 'savings' && (
                    <div className="p-4 bg-background/30 border-t border-border/20 space-y-3 text-xs">
                      <p className="text-xs text-muted-foreground mb-2">Enable or disable specific savings vehicles inside your budget and wealth trackers.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                        {SAVINGS_PRESETS.map((preset) => {
                          const key = preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                          const isChecked = draftActiveSavingsTypes.includes(key);
                          return (
                            <label key={key} className="flex items-center gap-2 p-2 rounded-lg border border-border/30 bg-card/40 hover:bg-muted/10 cursor-pointer select-none text-xs font-mono">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setDraftActiveSavingsTypes([...draftActiveSavingsTypes, key]);
                                  } else {
                                    setDraftActiveSavingsTypes(draftActiveSavingsTypes.filter(t => t !== key));
                                  }
                                }}
                                className="h-3.5 w-3.5 rounded-sm border-border/40 text-primary focus:ring-primary/30 cursor-pointer"
                              />
                              <span className="text-base leading-none shrink-0">{preset.emoji}</span>
                              <span className="font-medium text-foreground">{preset.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="shrink-0 gap-2 sm:gap-3 px-4 sm:px-6 py-3 border-t border-border/40 bg-background/95">
            <Button
              type="button"
              variant="outline"
              onClick={handleResetDefaults}
              className="w-full sm:w-auto rounded-lg h-9 gap-1.5 border-border/40 text-xs font-mono"
              disabled={savingDb}
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="sm:hidden">Reset</span>
              <span className="hidden sm:inline">Reset to defaults</span>
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto rounded-lg h-9 gap-1.5 px-5 bg-primary text-primary-foreground text-xs font-mono"
              disabled={savingDb}
            >
              {savingDb ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save settings
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

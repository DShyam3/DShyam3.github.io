/**
 * Add or edit a debt. One form for both, because the two used to be separate
 * copies of the same 500 lines and had already started to disagree.
 *
 * `kind` splits the fields rather than the component. A student loan is not
 * repaid on a schedule -- it is a share of income above a threshold -- so it
 * has no monthly payment, payoff date or balloon to ask for, and a mortgage
 * has no plan or course dates.
 */

import { useEffect, useId, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Debt, DebtDraw } from '@/features/finance/finance-types';
import { formatGBP } from '@/features/finance/utils/calculations';
import {
  DEBT_TYPE_LABELS,
  STUDENT_LOAN_PLAN_LABELS,
  STUDENT_LOAN_WRITE_OFF_YEARS,
  studentLoanMonthlyRepayment,
  type StudentLoanPlanKey,
} from '@/lib/finance';
import { useFinanceData } from '../FinanceDataContext';
import { isBorrowing, useDebtMutations } from '../useDebtMutations';
import { useStudentLoanRules } from '../useStudentLoanRules';

export type DebtFormKind = 'standard' | 'student';

type StandardType = Exclude<Debt['type'], 'student'>;
const STANDARD_TYPES = (Object.keys(DEBT_TYPE_LABELS) as Debt['type'][])
  .filter((t): t is StandardType => t !== 'student');

interface FormState {
  name: string;
  type: StandardType;
  lender: string;
  repaymentType: 'amortising' | 'pcp';
  plan: StudentLoanPlanKey;
  balance: string;
  originalAmount: string;
  interestRate: string;
  minPayment: string;
  finalPayment: string;
  startDate: string;
  courseEndDate: string;
  payoffDate: string;
  notes: string;
  draws: DebtDraw[];
}

const str = (n: number | undefined) => (n === undefined || n === 0 ? '' : String(n));
const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.abs(n) : 0;
};

const toForm = (kind: DebtFormKind, debt: Debt | null | undefined, defaultPlan: StudentLoanPlanKey): FormState => ({
  name: debt?.name ?? (kind === 'student' ? 'Student loan' : ''),
  type: debt && debt.type !== 'student' ? debt.type : 'mortgage',
  lender: debt?.lender ?? (kind === 'student' ? 'Student Loans Company' : ''),
  repaymentType: debt?.repaymentType === 'pcp' ? 'pcp' : 'amortising',
  plan: debt?.studentLoanPlan ?? defaultPlan,
  balance: str(debt?.balance),
  originalAmount: str(debt?.originalAmount),
  interestRate: str(debt?.interestRate),
  minPayment: str(debt?.minPayment),
  finalPayment: str(debt?.finalPayment),
  startDate: debt?.startDate ?? '',
  courseEndDate: debt?.courseEndDate ?? '',
  payoffDate: debt?.payoffDate ?? '',
  notes: debt?.notes ?? '',
  // Only borrowing is edited here; refunds and payments on a student loan are
  // recorded from its section and carried through untouched.
  draws: (debt?.draws ?? []).filter(isBorrowing),
});

export function DebtFormDialog({
  open,
  onOpenChange,
  kind,
  debt,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: DebtFormKind;
  /** Present when editing. */
  debt?: Debt | null;
  onSaved?: (debt: Debt) => void;
}) {
  const id = useId();
  const { toast } = useToast();
  const { settings } = useFinanceData();
  const { saveDebt } = useDebtMutations();
  const { planRules, rateNow } = useStudentLoanRules();

  const defaultPlan: StudentLoanPlanKey =
    settings.studentLoanPlan && settings.studentLoanPlan !== 'none' ? settings.studentLoanPlan : 'plan2';

  const [form, setForm] = useState<FormState>(() => toForm(kind, debt, defaultPlan));
  const [draw, setDraw] = useState({ date: '', amount: '', label: '' });

  // Re-seed on every open, so a cancelled edit does not leak into the next one.
  useEffect(() => {
    if (open) {
      setForm(toForm(kind, debt, defaultPlan));
      setDraw({ date: '', amount: '', label: '' });
    }
  }, [open, kind, debt, defaultPlan]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const drawTotal = form.draws.reduce((sum, d) => sum + d.amount, 0);
  const { threshold, repaymentRate: ratePercent } = planRules(form.plan);
  const studentMonthly = studentLoanMonthlyRepayment(settings.grossSalary || 0, threshold, ratePercent);
  // A student loan's rate is not a term of the loan: it follows from the plan,
  // the published RPI and cap, and on Plan 2 your salary. Worked out, not typed.
  const studentRate = rateNow(form.plan, form.courseEndDate || undefined, settings.grossSalary || 0);

  const addDraw = () => {
    const amount = num(draw.amount);
    if (!draw.date || amount <= 0) {
      toast({ title: 'Borrowing needs a date and an amount', variant: 'destructive' });
      return;
    }
    set('draws', [...form.draws, { id: `dw_${Date.now()}`, date: draw.date, amount, label: draw.label || undefined }]);
    setDraw({ date: '', amount: '', label: '' });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: 'Give the debt a name', variant: 'destructive' });
      return;
    }
    const balance = num(form.balance);
    const original = drawTotal > 0 ? drawTotal : (form.originalAmount ? num(form.originalAmount) : balance);
    const isStudent = kind === 'student';

    const saved: Debt = {
      // Spread first so fields this form does not show (observations, rate
      // periods, emoji, colour) survive an edit.
      ...(debt ?? { id: `d_${Date.now()}`, color: 'hsl(var(--destructive))' }),
      name: form.name.trim(),
      type: isStudent ? 'student' : form.type,
      lender: form.lender.trim(),
      repaymentType: isStudent ? 'income_contingent' : form.repaymentType,
      studentLoanPlan: isStudent ? form.plan : undefined,
      writeOffYears: isStudent ? STUDENT_LOAN_WRITE_OFF_YEARS[form.plan] : undefined,
      balance,
      originalAmount: original,
      interestRate: isStudent
        ? Math.round(studentRate.rate * 100) / 100
        : (form.interestRate ? parseFloat(form.interestRate) || 0 : 0),
      // A student loan's payment is whatever payroll takes, so it is derived
      // from salary rather than typed; stored so the column stays meaningful.
      minPayment: isStudent ? studentMonthly : num(form.minPayment),
      finalPayment: !isStudent && form.repaymentType === 'pcp' ? num(form.finalPayment) : 0,
      startDate: form.startDate || [...form.draws].sort((a, b) => a.date.localeCompare(b.date))[0]?.date || undefined,
      courseEndDate: isStudent ? form.courseEndDate || undefined : undefined,
      payoffDate: isStudent ? undefined : form.payoffDate || undefined,
      draws: [...form.draws, ...(debt?.draws ?? []).filter(d => !isBorrowing(d))],
      ratePeriods: debt?.ratePeriods ?? [],
      notes: form.notes.trim() || undefined,
    };
    saveDebt(saved);
    onOpenChange(false);
    onSaved?.(saved);
    toast({ title: debt ? 'Debt updated' : 'Debt added', description: saved.name });
  };

  const field = (key: keyof FormState, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-${key}`} className="text-xs text-muted-foreground">{label}</Label>
      <Input
        id={`${id}-${key}`}
        value={form[key] as string}
        onChange={e => set(key, e.target.value as never)}
        className="h-10 tabular-nums"
        {...props}
      />
    </div>
  );

  const money = { inputMode: 'decimal' as const, placeholder: '0.00' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{debt ? 'Edit' : 'Add'} {kind === 'student' ? 'student loan' : 'debt'}</DialogTitle>
          <DialogDescription>
            {kind === 'student'
              ? 'Record what you borrowed and your latest balance. Repayments follow your salary.'
              : 'A mortgage, car finance, card or personal loan.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field('name', 'Name', { required: true, placeholder: kind === 'student' ? 'Student loan' : 'e.g. Flat mortgage' })}
            {field('lender', 'Lender', { placeholder: kind === 'student' ? 'Student Loans Company' : 'e.g. Nationwide' })}

            {kind === 'standard' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-type`} className="text-xs text-muted-foreground">Type</Label>
                  <Select value={form.type} onValueChange={v => set('type', v as StandardType)}>
                    <SelectTrigger id={`${id}-type`} className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STANDARD_TYPES.map(t => <SelectItem key={t} value={t}>{DEBT_TYPE_LABELS[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-repayment`} className="text-xs text-muted-foreground">Repaid by</Label>
                  <Select value={form.repaymentType} onValueChange={v => set('repaymentType', v as FormState['repaymentType'])}>
                    <SelectTrigger id={`${id}-repayment`} className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amortising">Fixed monthly payment</SelectItem>
                      <SelectItem value="pcp">PCP, ending in a balloon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-plan`} className="text-xs text-muted-foreground">Plan</Label>
                <Select value={form.plan} onValueChange={v => set('plan', v as StudentLoanPlanKey)}>
                  <SelectTrigger id={`${id}-plan`} className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STUDENT_LOAN_PLAN_LABELS) as StudentLoanPlanKey[]).map(p => (
                      <SelectItem key={p} value={p}>{STUDENT_LOAN_PLAN_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {field('balance', kind === 'student' ? 'Latest balance (£)' : 'Owed now (£)', { ...money, required: true })}
            {field('originalAmount', 'Borrowed (£)', {
              ...money,
              disabled: drawTotal > 0,
              value: drawTotal > 0 ? String(drawTotal) : form.originalAmount,
            })}
            {kind === 'standard' && field('interestRate', 'Interest rate (% a year)', { inputMode: 'decimal', placeholder: '4.5' })}

            {kind === 'standard' ? (
              <>
                {field('minPayment', 'Monthly payment (£)', money)}
                {form.repaymentType === 'pcp' && field('finalPayment', 'Balloon payment (£)', money)}
                {field('startDate', 'Taken on', { type: 'date' })}
                {field('payoffDate', 'Final payment due', { type: 'date' })}
              </>
            ) : (
              <>
                {field('startDate', 'Course started', { type: 'date' })}
                {field('courseEndDate', 'Course ended', { type: 'date' })}
              </>
            )}
          </div>

          {kind === 'student' && (
            <p className="rounded-2xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
              {STUDENT_LOAN_PLAN_LABELS[form.plan]}: {ratePercent}% of pay above {formatGBP(threshold)} a year.
              {' '}On your salary that is <span className="font-semibold text-foreground tabular-nums">{formatGBP(studentMonthly)}</span> a month,
              {' '}and interest is <span className="font-semibold text-foreground tabular-nums">{studentRate.rate.toFixed(2)}%</span> a year.
              {' '}Written off {STUDENT_LOAN_WRITE_OFF_YEARS[form.plan]} years after the April you are first due to repay.
            </p>
          )}

          <fieldset className="space-y-3 border-t border-border/40 pt-4">
            <legend className="text-sm font-semibold">
              Borrowing history <span className="font-normal text-muted-foreground">(optional)</span>
            </legend>
            <p className="text-xs text-muted-foreground">
              {kind === 'student'
                ? 'One row per payment or academic year. The last one sets when your course ended, and so when repayments start.'
                : 'Separate advances, such as a further advance on a mortgage.'}
            </p>
            {form.draws.length > 0 && (
              <ul className="divide-y divide-border/60 rounded-2xl border border-border/40">
                {[...form.draws].sort((a, b) => a.date.localeCompare(b.date)).map(d => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="tabular-nums font-semibold">{formatGBP(d.amount)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {new Date(d.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}{d.label ? ` · ${d.label}` : ''}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${formatGBP(d.amount)} borrowed ${d.date}`}
                      onClick={() => set('draws', form.draws.filter(x => x.id !== d.id))}
                      className="shrink-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
              <Input type="date" aria-label="Borrowing date" value={draw.date} onChange={e => setDraw({ ...draw, date: e.target.value })} className="h-10" />
              <Input inputMode="decimal" aria-label="Borrowing amount" placeholder="Amount (£)" value={draw.amount} onChange={e => setDraw({ ...draw, amount: e.target.value })} className="h-10 tabular-nums" />
              <Input aria-label="Borrowing label" placeholder={kind === 'student' ? 'e.g. Year 1 tuition' : 'Label'} value={draw.label} onChange={e => setDraw({ ...draw, label: e.target.value })} className="col-span-2 h-10 sm:col-span-1" />
              <Button type="button" variant="outline" onClick={addDraw} className="col-span-2 h-10 sm:col-span-1">Add</Button>
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor={`${id}-notes`} className="text-xs text-muted-foreground">Notes</Label>
            <Textarea id={`${id}-notes`} value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{debt ? 'Save changes' : 'Add'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

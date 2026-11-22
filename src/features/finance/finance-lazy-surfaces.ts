import { lazy } from 'react';
import { sectionChunks, warmFinanceSections } from './section-chunks';
import {
  pathForSurface,
  SURFACES,
  TAB_LABELS,
  tabFromPath,
  surfaceForTab,
  pathForTab,
  showsSurfaceHero,
  type TabKey,
} from './surfaces';
import {
  assignPaidPeriod,
  isRecurringPaidForPeriod,
  type RecurringCandidate,
} from '@/lib/finance/recurring-detection';
import {
  investmentActivityId,
  type ImportedInvestmentActivity,
  type ImportedInvestmentHolding,
  type InvestmentImportProvider,
} from '@/lib/finance';
import type {
  BudgetCategory,
  BudgetItem,
  InvestmentActivity,
  InvestmentHolding,
  RecurringBill,
  RecurringTemplate,
} from '@/features/finance/finance-types';

export {
  pathForSurface,
  SURFACES,
  TAB_LABELS,
  tabFromPath,
  surfaceForTab,
  pathForTab,
  showsSurfaceHero,
  sectionChunks,
  warmFinanceSections,
  type TabKey,
};

export const CashFlowSurface = lazy(sectionChunks['cash-flow']);
export const ForecastSurface = lazy(sectionChunks.forecast);
export const GoalsSurface = lazy(sectionChunks.goals);
export const ScenariosSurface = lazy(sectionChunks.scenarios);
export const RetirementSurface = lazy(sectionChunks.retirement);
export const TransfersSurface = lazy(sectionChunks.transfers);
export const BudgetSurface = lazy(sectionChunks.budget);
export const AccountsSurface = lazy(sectionChunks.accounts);
export const DebtsSurface = lazy(sectionChunks.debts);
export const StudentLoanSurface = lazy(sectionChunks['student-loan']);
export const TaxIncomeSurface = lazy(sectionChunks['tax-income']);
export const TaxCalculatorSurface = lazy(sectionChunks['tax-calculator']);
export const MoneyHubSurface = lazy(sectionChunks['money-hub']);
export const DashboardSurface = lazy(sectionChunks.dashboard);
export const RecurringsTab = lazy(() => sectionChunks.recurrings().then(m => ({ default: m.RecurringsTab })));
export const TransactionsTab = lazy(() => sectionChunks.transactions().then(m => ({ default: m.TransactionsTab })));
export const InvestmentsTab = lazy(() => sectionChunks.investments().then(m => ({ default: m.InvestmentsTab })));

export const INITIAL_NEW_RECURRING: Omit<RecurringBill, 'id' | 'amount'> & { amount: number | '' } = {
  name: '',
  amount: '',
  dueDate: 15,
  isPaid: false,
  frequency: 'monthly',
  dueMonth: new Date().getMonth() + 1,
  emoji: '',
  category: '',
  tag: '',
  linkedBudgetItemId: '',
  linkedAccountId: '',
};

export const autoCategorizeRecurring = (name: string, recurringTemplates: RecurringTemplate[]) => {
  const cleanName = name.trim().toLowerCase();
  const match = recurringTemplates.find(t =>
    cleanName.includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(cleanName)
  );
  return match || null;
};

export const draftFromCandidate = (candidate: RecurringCandidate): Omit<RecurringBill, 'id'> => ({
  name: candidate.name,
  amount: candidate.amount,
  frequency: candidate.frequency,
  dueDate: Number(candidate.lastPaidDate.slice(8, 10)),
  dueMonth: Number(candidate.lastPaidDate.slice(5, 7)),
  linkedAccountId: candidate.accountId,
  detectionKey: candidate.key,
  lastPaidDate: candidate.lastPaidDate,
  status: 'active',
  isPaid: false,
});

export const holdingKey = (holding: Pick<InvestmentHolding, 'accountId' | 'name' | 'ticker' | 'category'>) => {
  const asset = (holding.ticker || holding.name).trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '');
  return `${holding.accountId ?? ''}:${asset}:${holding.category}`;
};

export function mergeImportedHoldingsAndActivities(
  investmentHoldings: InvestmentHolding[],
  investmentActivities: InvestmentActivity[],
  imported: ImportedInvestmentHolding[],
  importedActivities: ImportedInvestmentActivity[],
  accountId: string,
  provider: InvestmentImportProvider,
) {
  const positionsByKey = new Map(investmentHoldings.map(holding => [holdingKey(holding), holding]));
  const updated = [...investmentHoldings];
  let created = 0;
  let refreshed = 0;

  imported.forEach(({ sourceRows: _sourceRows, ...holding }, index) => {
    const nextHolding = { ...holding, accountId };
    const existing = positionsByKey.get(holdingKey(nextHolding));
    if (existing) {
      const replacement: InvestmentHolding = { ...existing, ...nextHolding };
      updated[updated.findIndex(current => current.id === existing.id)] = replacement;
      positionsByKey.set(holdingKey(replacement), replacement);
      refreshed += 1;
    } else {
      const id = `h_import_${Date.now()}_${index}`;
      const createdHolding: InvestmentHolding = { ...nextHolding, id };
      updated.push(createdHolding);
      positionsByKey.set(holdingKey(createdHolding), createdHolding);
      created += 1;
    }
  });

  const importedHistory: InvestmentActivity[] = importedActivities.map(activity => ({
    id: investmentActivityId(provider, accountId, activity),
    accountId,
    provider,
    activityType: activity.activityType,
    occurredOn: activity.occurredOn,
    name: activity.name,
    ticker: activity.ticker,
    quantity: activity.quantity,
    unitPriceGbp: activity.unitPriceGbp,
    sourceReference: activity.sourceReference,
  }));
  const nextActivitiesById = new Map(investmentActivities.map(activity => [activity.id, activity]));
  importedHistory.forEach(activity => nextActivitiesById.set(activity.id, activity));
  const nextActivities = [...nextActivitiesById.values()].sort((left, right) => right.occurredOn.localeCompare(left.occurredOn));

  return { updated, importedHistory, nextActivities, created, refreshed };
}

export function buildAddedRecurringBill(
  newRecurring: Omit<RecurringBill, 'id' | 'amount'> & { amount: number },
  budgetCategories: BudgetCategory[],
  recurringTemplates: RecurringTemplate[],
  todayISO: string,
): { created: RecurringBill; updatedBudget: BudgetCategory[]; budgetChanged: boolean } {
  let updatedBudget = [...budgetCategories];
  let budgetChanged = false;
  let finalLinkedBudgetItemId = newRecurring.linkedBudgetItemId;

  const template = autoCategorizeRecurring(newRecurring.name, recurringTemplates);
  const resolvedEmoji = newRecurring.emoji || template?.emoji || '💸';
  const resolvedCategory = newRecurring.category || template?.category || 'Subscriptions';
  const resolvedTag = newRecurring.tag || template?.tag || newRecurring.name.toUpperCase().replace(/[^A-Z0-9]/g, '');

  if ((!newRecurring.status || newRecurring.status === 'active') && (finalLinkedBudgetItemId === 'create' || (!finalLinkedBudgetItemId && newRecurring.name))) {
    const targetCatName = template?.budgetCategoryName || template?.category || 'Subscriptions';
    const targetCatId = targetCatName.toLowerCase();
    const targetCat = updatedBudget.find(
      c => c.id === targetCatId || c.name.toLowerCase() === targetCatId,
    );
    if (targetCat) {
      const existingItem = targetCat.items.find(i => i.name.toLowerCase() === newRecurring.name.toLowerCase());
      if (existingItem) {
        finalLinkedBudgetItemId = existingItem.id;
      } else {
        const newItemId = 'item_' + Date.now();
        const newBudgetItem: BudgetItem = {
          id: newItemId,
          name: newRecurring.name,
          budgeted: 0,
          spent: 0,
          provider: newRecurring.provider?.trim() || undefined,
        };
        updatedBudget = updatedBudget.map(c =>
          c.id === targetCat.id ? { ...c, items: [...c.items, newBudgetItem] } : c,
        );
        finalLinkedBudgetItemId = newItemId;
        budgetChanged = true;
      }
    }
  }

  const schedule = { ...newRecurring, amount: newRecurring.amount, dueMonth: newRecurring.dueMonth || 1, id: '' } as RecurringBill;
  const paidForDueDate = newRecurring.lastPaidDate ? assignPaidPeriod(schedule, newRecurring.lastPaidDate) : undefined;
  const created: RecurringBill = {
    ...newRecurring,
    amount: newRecurring.amount,
    dueMonth: newRecurring.dueMonth || 1,
    paidForDueDate,
    isPaid: isRecurringPaidForPeriod({ ...schedule, paidForDueDate }, todayISO),
    id: crypto.randomUUID(),
    emoji: resolvedEmoji,
    category: resolvedCategory,
    tag: resolvedTag,
    linkedBudgetItemId: finalLinkedBudgetItemId || undefined,
    linkedAccountId: newRecurring.linkedAccountId || undefined,
    provider: newRecurring.provider?.trim() || undefined,
  } as RecurringBill;

  return { created, updatedBudget, budgetChanged };
}

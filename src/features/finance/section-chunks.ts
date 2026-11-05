import { warmChunk } from '@/lib/idle';
import type { TabKey } from './surfaces';

/**
 * Every finance section's chunk, keyed by the tab that shows it.
 *
 * Each section is split out so Home does not download the charting and dialog
 * code the others need -- but split and never warmed meant the first visit to
 * every section waited on its own round trip. The page's lazy() calls and the
 * idle warm-up both read this map, so a new section cannot be added to one and
 * forgotten in the other; `satisfies` fails the build if a tab has no chunk.
 */
export const sectionChunks = {
  dashboard: () => import('./surfaces/DashboardSurface'),
  transactions: () => import('./tabs/TransactionsTab'),
  budget: () => import('./surfaces/BudgetSurface'),
  recurrings: () => import('./tabs/RecurringsTab'),
  transfers: () => import('./surfaces/TransfersSurface'),
  'cash-flow': () => import('./surfaces/CashFlowSurface'),
  forecast: () => import('./surfaces/ForecastSurface'),
  goals: () => import('./surfaces/GoalsSurface'),
  scenarios: () => import('./surfaces/ScenariosSurface'),
  accounts: () => import('./surfaces/AccountsSurface'),
  debts: () => import('./surfaces/DebtsSurface'),
  'student-loan': () => import('./surfaces/StudentLoanSurface'),
  investments: () => import('./tabs/InvestmentsTab'),
  retirement: () => import('./surfaces/RetirementSurface'),
  'tax-income': () => import('./surfaces/TaxIncomeSurface'),
  'time-spent': () => import('./tabs/TimeSpentTab'),
  'tax-calculator': () => import('./surfaces/TaxCalculatorSurface'),
  'money-hub': () => import('./surfaces/MoneyHubSurface'),
} satisfies Record<TabKey, () => Promise<unknown>>;

/** Fetches every section's chunk in the background. Already-loaded ones cost nothing. */
export const warmFinanceSections = (): void => {
  Object.values(sectionChunks).forEach(warmChunk);
};

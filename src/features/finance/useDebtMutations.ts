/**
 * Writes to the debt table, shared by the Debts and Student Loan sections.
 *
 * Debts are saved through the `accounts` key alongside bank accounts,
 * memberships and credit scores, so every write has to pass those through
 * unchanged. Keeping that here means neither section has to know it.
 */

import { useFinanceData } from './FinanceDataContext';
import type { Debt, DebtDraw } from './finance-types';

/**
 * A student loan is income-contingent whatever its type says: older rows set
 * only the repayment type, so the type alone would drop them from both lists.
 */
export const isStudentLoanDebt = (debt: Pick<Debt, 'type' | 'repaymentType'>): boolean =>
  debt.type === 'student' || debt.repaymentType === 'income_contingent';

/** Borrowing, as opposed to a refund or a payment recorded in the same list. */
export const isBorrowing = (draw: DebtDraw): boolean => !draw.kind || draw.kind === 'borrowing';

export function useDebtMutations() {
  const { bankAccounts, creditScores, debts, memberships, saveDataToSupabase, setDebts } = useFinanceData();

  const write = (updated: Debt[]) => {
    setDebts(updated);
    saveDataToSupabase('accounts', { bankAccounts, memberships, creditScores, debts: updated });
  };

  /** Inserts when the id is new, replaces when it exists. */
  const saveDebt = (debt: Debt) => {
    const exists = debts.some(d => d.id === debt.id);
    write(exists ? debts.map(d => (d.id === debt.id ? debt : d)) : [...debts, debt]);
  };

  const deleteDebt = (id: string) => write(debts.filter(d => d.id !== id));

  return { saveDebt, deleteDebt };
}

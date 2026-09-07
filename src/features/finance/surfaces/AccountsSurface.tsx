/**
 * Accounts — the Wealth surface (REHAUL_PLAN.md 7.C).
 *
 * Coordinates bank accounts, debts, reward memberships, and credit reports.
 * Decomposed into focused section components under `src/features/finance/components/`.
 */

import BankAccountsSection from '../components/BankAccountsSection';
import DebtsSection from '../components/DebtsSection';
import MembershipsSection from '../components/MembershipsSection';
import CreditReportsSection from '../components/CreditReportsSection';

export default function AccountsSurface({ totalLoanBalance }: { totalLoanBalance: number }) {
  return (
    <div className="space-y-8">
      <BankAccountsSection />
      <DebtsSection totalLoanBalance={totalLoanBalance} />
      <MembershipsSection />
      <CreditReportsSection />
    </div>
  );
}

/**
 * Accounts — the Wealth surface (REHAUL_PLAN.md 7.C).
 *
 * Coordinates bank accounts, reward memberships and credit reports. Debts and
 * the student loan have their own sections.
 */

import BankAccountsSection from '../components/BankAccountsSection';
import MembershipsSection from '../components/MembershipsSection';
import CreditReportsSection from '../components/CreditReportsSection';

export default function AccountsSurface() {
  return (
    <div className="space-y-8">
      <BankAccountsSection />
      <MembershipsSection />
      <CreditReportsSection />
    </div>
  );
}

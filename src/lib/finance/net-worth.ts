/** Current worth from profile-scoped rows. Investment account balances are cash only. */
export function calculateNetWorth(
  accounts: readonly { balance: number }[],
  debts: readonly { balance: number }[],
  holdings: readonly { shares: number; currentPrice: number; currentPriceKnown?: boolean }[],
) {
  const round = (amount: number) => Math.round(amount * 100) / 100;
  const holdingValue = holdings.reduce(
    (sum, holding) => sum + (holding.currentPriceKnown === false ? 0 : holding.shares * holding.currentPrice),
    0,
  );
  const totalAssets = round(accounts.reduce((sum, account) => sum + Math.max(0, account.balance), 0) + holdingValue);
  const totalLoanBalance = round(debts.reduce((sum, debt) => sum + debt.balance, 0));
  const totalDebt = round(accounts.reduce((sum, account) => sum + Math.max(0, -account.balance), 0) + totalLoanBalance);
  return { totalAssets, totalLoanBalance, totalDebt, netWorth: round(totalAssets - totalDebt) };
}

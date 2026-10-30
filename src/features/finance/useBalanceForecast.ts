/**
 * The inputs `forecastBalance` needs, gathered from the finance providers.
 *
 * The arithmetic is in lib/finance/balance-forecast.ts; this only reads state
 * and hands it over. Bank evidence comes from useRecurringEvidence, the same
 * source the Recurrings tab uses, so the two agree on which bills are seen.
 */

import { useMemo } from 'react';
import { format } from 'date-fns';
import { forecastBalance } from '@/lib/finance/balance-forecast';
import { useFinanceData } from './FinanceDataContext';
import { useFinanceTotals } from './useFinanceTotals';
import { useRecurringEvidence } from './useRecurringEvidence';
import { useSpendingLedger } from './useSpendingLedger';

const FORECAST_DAYS = 60;

export function useBalanceForecast() {
  const { bankAccounts, allRecurrings, settings, bankHolidaysList, recurringDataReady } = useFinanceData();
  const { results } = useFinanceTotals();
  const { ledger, exclusionsUnreliable } = useSpendingLedger();

  const today = format(new Date(), 'yyyy-MM-dd');
  const annualNetPay = results.netTakeHome;

  const payments = useRecurringEvidence(true);
  const evidence = useMemo(
    () => new Map([...payments].map(([billId, payment]) => [billId, payment.date] as const)),
    [payments],
  );

  const forecast = useMemo(() => {
    return forecastBalance({
      today,
      days: FORECAST_DAYS,
      accounts: bankAccounts,
      bills: allRecurrings,
      evidence,
      transactions: ledger,
      payday: {
        schedule: settings.paydaySchedule,
        opts: {
          payDayOfMonth: settings.payDayOfMonth,
          weekday: settings.paydayWeekday,
          biweeklyAnchor: settings.paydayBiweeklyAnchor,
        },
        bankHolidays: bankHolidaysList,
        annualNetPay,
      },
    });
  }, [
    today,
    bankAccounts,
    allRecurrings,
    evidence,
    ledger,
    annualNetPay,
    settings.paydaySchedule,
    settings.payDayOfMonth,
    settings.paydayWeekday,
    settings.paydayBiweeklyAnchor,
    bankHolidaysList,
  ]);

  return useMemo(
    () => ({ forecast, ready: recurringDataReady, exclusionsUnreliable }),
    [forecast, recurringDataReady, exclusionsUnreliable],
  );
}

import type { MoneyHubCurrency } from './money-hub-catalogue';

/**
 * One dated set of user-supplied exchange rates, all quoted against a single
 * anchor currency: `perAnchor.EUR = 1.17` reads "1 anchor = 1.17 EUR". Any pair
 * converts through the anchor, so a comparison needs one rate per currency it
 * touches rather than one per pair. There is no default rate and no network
 * source: a missing rate leaves a conversion unknown, never guessed.
 */
export interface MoneyHubFxSnapshot {
  /** YYYY-MM-DD, as the user's source quoted it. */
  date: string;
  anchor: MoneyHubCurrency;
  /** Units of each currency per one anchor unit; positive and finite only. */
  perAnchor: Partial<Record<MoneyHubCurrency, number>>;
}

/** Strict calendar date for the caller's FX evidence, independent of clock and timezone. */
export const validMoneyHubRateDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/**
 * A snapshot from raw inputs, or null without a valid date. Non-positive or
 * non-finite rates are dropped, so they read as missing rather than as zero.
 */
export const moneyHubFxSnapshot = (
  date: string,
  anchor: MoneyHubCurrency,
  rates: Partial<Record<MoneyHubCurrency, number | null>>,
): MoneyHubFxSnapshot | null => {
  if (!validMoneyHubRateDate(date)) return null;
  const perAnchor: Partial<Record<MoneyHubCurrency, number>> = {};
  for (const [currency, rate] of Object.entries(rates) as [MoneyHubCurrency, number | null][]) {
    if (currency !== anchor && rate !== null && Number.isFinite(rate) && rate > 0) perAnchor[currency] = rate;
  }
  return { date, anchor, perAnchor };
};

const unitsPerAnchor = (currency: MoneyHubCurrency, fx: MoneyHubFxSnapshot): number | null =>
  currency === fx.anchor ? 1 : fx.perAnchor[currency] ?? null;

/** Same-currency amounts pass through without a snapshot; anything else needs both rates. */
export const convertMoneyHubAmount = (
  amount: number | null,
  from: MoneyHubCurrency,
  to: MoneyHubCurrency,
  fx: MoneyHubFxSnapshot | null,
): number | null => {
  if (amount === null || !Number.isFinite(amount)) return null;
  if (from === to) return amount;
  if (fx === null) return null;
  const fromRate = unitsPerAnchor(from, fx);
  const toRate = unitsPerAnchor(to, fx);
  if (fromRate === null || toRate === null) return null;
  const converted = (amount / fromRate) * toRate;
  return Number.isFinite(converted) ? converted : null;
};

import { describe, expect, it } from 'vitest';
import { convertMoneyHubAmount, moneyHubFxSnapshot, validMoneyHubRateDate } from './money-hub-fx';

const gbpAnchored = moneyHubFxSnapshot('2026-11-05', 'GBP', { EUR: 1.25, USD: 1.5, JPY: 200 })!;

describe('validMoneyHubRateDate', () => {
  it.each(['2024-02-29', '2000-02-29', '2026-12-31', '2027-01-01', '2026-03-29', '2026-10-25'])(
    'accepts real dates across leap, year and UK timezone boundaries: %s',
    date => expect(validMoneyHubRateDate(date)).toBe(true),
  );

  it.each(['', '2026-02-29', '1900-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00', '2026-1-01', '2026-01-1', '2026-01-01T00:00:00Z', ' 2026-01-01'])(
    'rejects invalid or noncanonical dates: %s',
    date => expect(validMoneyHubRateDate(date)).toBe(false),
  );
});

describe('moneyHubFxSnapshot', () => {
  it('needs a valid date', () => {
    expect(moneyHubFxSnapshot('', 'GBP', { EUR: 1.2 })).toBeNull();
    expect(moneyHubFxSnapshot('2026-02-30', 'GBP', { EUR: 1.2 })).toBeNull();
  });

  it('keeps only positive finite rates and never quotes the anchor against itself', () => {
    expect(moneyHubFxSnapshot('2026-11-05', 'EUR', { GBP: 0.85, USD: 0, JPY: -1, CHF: NaN, SEK: Infinity, NOK: null, EUR: 2 }))
      .toEqual({ date: '2026-11-05', anchor: 'EUR', perAnchor: { GBP: 0.85 } });
  });
});

describe('convertMoneyHubAmount', () => {
  it('converts to and from the anchor and preserves negative amounts and zero', () => {
    expect(convertMoneyHubAmount(100, 'GBP', 'EUR', gbpAnchored)).toBe(125);
    expect(convertMoneyHubAmount(125, 'EUR', 'GBP', gbpAnchored)).toBe(100);
    expect(convertMoneyHubAmount(-100, 'GBP', 'EUR', gbpAnchored)).toBe(-125);
    expect(convertMoneyHubAmount(0, 'EUR', 'GBP', gbpAnchored)).toBe(0);
  });

  it('crosses two non-anchor currencies through the anchor', () => {
    expect(convertMoneyHubAmount(125, 'EUR', 'USD', gbpAnchored)).toBeCloseTo(150, 10);
    expect(convertMoneyHubAmount(150, 'USD', 'JPY', gbpAnchored)).toBeCloseTo(20_000, 8);
    expect(convertMoneyHubAmount(20_000, 'JPY', 'EUR', gbpAnchored)).toBeCloseTo(125, 10);
  });

  it('passes same-currency amounts through without a snapshot', () => {
    expect(convertMoneyHubAmount(-100, 'GBP', 'GBP', null)).toBe(-100);
    expect(convertMoneyHubAmount(42, 'CHF', 'CHF', gbpAnchored)).toBe(42);
  });

  it('withholds a conversion when the snapshot or either rate is missing', () => {
    expect(convertMoneyHubAmount(100, 'GBP', 'EUR', null)).toBeNull();
    expect(convertMoneyHubAmount(100, 'GBP', 'CHF', gbpAnchored)).toBeNull();
    expect(convertMoneyHubAmount(100, 'CHF', 'EUR', gbpAnchored)).toBeNull();
  });

  it.each([null, NaN, Infinity, -Infinity])('keeps unknown or invalid amounts unknown: %s', amount => {
    expect(convertMoneyHubAmount(amount, 'GBP', 'EUR', gbpAnchored)).toBeNull();
    expect(convertMoneyHubAmount(amount, 'EUR', 'EUR', null)).toBeNull();
  });

  it('rejects overflow', () => {
    const wide = moneyHubFxSnapshot('2026-11-05', 'GBP', { EUR: 2, USD: 0.5 })!;
    expect(convertMoneyHubAmount(Number.MAX_VALUE, 'GBP', 'EUR', wide)).toBeNull();
    expect(convertMoneyHubAmount(Number.MAX_VALUE, 'USD', 'GBP', wide)).toBeNull();
  });
});

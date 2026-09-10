import { describe, expect, it } from 'vitest';
import { investmentActivityId, parseInvestmentCsv } from './investment-import';

describe('Trading 212 CSV adapter', () => {
  it('reconstructs a remaining GBP position from chronological buys and sells', () => {
    const result = parseInvestmentCsv('trading212', [
      'Action,Time,Ticker,Name,No. of shares,Price / share,Currency (Price / share)',
      'Market buy,2026-01-03 09:00:00,AAPL,Apple Inc,10,100,GBP',
      'Market buy,2026-01-04 09:00:00,AAPL,Apple Inc,5,120,GBP',
      'Market sell,2026-01-05 09:00:00,AAPL,Apple Inc,3,130,GBP',
      'Dividend,2026-01-06 09:00:00,AAPL,Apple Inc,0,0,GBP',
    ].join('\n'));

    expect(result.mode).toBe('activity');
    expect(result.holdings).toEqual([expect.objectContaining({
      name: 'Apple Inc', ticker: 'AAPL', shares: 12, avgPrice: 106.66666666666667,
      costBasisKnown: true, currentPrice: 0, currentPriceKnown: false, category: 'Stock',
    })]);
    expect(result.issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('Ignored 1 Trading 212 row') }));
    expect(result.activities).toEqual(expect.arrayContaining([
      expect.objectContaining({ activityType: 'buy', occurredOn: '2026-01-03', ticker: 'AAPL', unitPriceGbp: 100 }),
      expect.objectContaining({ activityType: 'sell', occurredOn: '2026-01-05', ticker: 'AAPL', unitPriceGbp: 130 }),
    ]));
  });

  it('does not silently turn a foreign-currency price into GBP', () => {
    const result = parseInvestmentCsv('trading212', 'Action,Ticker,Name,Shares,Price,Currency (Price / share)\nMarket buy,MSFT,Microsoft,2,400,USD');

    expect(result.holdings[0]).toEqual(expect.objectContaining({ shares: 2, avgPrice: 0, costBasisKnown: false, currentPriceKnown: false }));
  });
});

describe('Kraken CSV adapter', () => {
  it('uses the base asset and only treats GBP pairs as GBP cost data', () => {
    const result = parseInvestmentCsv('kraken', [
      'txid,ordertxid,pair,time,type,order-type,price,cost,fee,vol',
      'a,b,XXBTZGBP,2026-01-03 09:00:00,buy,market,25000,250,1,0.01',
      'c,d,XETHZEUR,2026-01-04 09:00:00,buy,market,2000,200,1,0.1',
    ].join('\n'));

    expect(result.holdings).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'BTC', ticker: 'BTC', shares: 0.01, avgPrice: 25000, costBasisKnown: true, category: 'Crypto' }),
      expect.objectContaining({ name: 'ETH', ticker: 'ETH', shares: 0.1, avgPrice: 0, costBasisKnown: false, category: 'Crypto' }),
    ]));
    expect(result.holdings.every(holding => !holding.currentPriceKnown)).toBe(true);
  });

  it('recognises a balances snapshot and preserves absent cost basis as unknown', () => {
    const result = parseInvestmentCsv('kraken', 'Currency/Symbol,Wallet,Quantity,Price (GBP),Total Value (GBP)\nBTC,Spot,0.2,60000,12000');

    expect(result.mode).toBe('snapshot');
    expect(result.holdings).toEqual([expect.objectContaining({
      ticker: 'BTC', shares: 0.2, avgPrice: 0, costBasisKnown: false,
      currentPrice: 60000, currentPriceKnown: true,
    })]);
  });
});

describe('investment CSV guardrails', () => {
  it('refuses an arbitrary CSV rather than guessing columns', () => {
    const result = parseInvestmentCsv('kraken', 'Date,Description,Amount\n2026-01-01,Coffee,-3');
    expect(result.mode).toBe('unrecognised');
    expect(result.holdings).toEqual([]);
  });

  it('gives one execution a stable identity while scoping it to its broker account', () => {
    const activity = { sourceReference: 'trade-123' };
    expect(investmentActivityId('kraken', 'kraken-main', activity)).toBe(investmentActivityId('kraken', 'kraken-main', activity));
    expect(investmentActivityId('kraken', 'kraken-main', activity)).not.toBe(investmentActivityId('kraken', 'kraken-isa', activity));
  });
});

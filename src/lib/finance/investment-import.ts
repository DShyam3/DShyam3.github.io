/**
 * Deterministic, browser-local adapters for investment CSV exports.
 *
 * A broker export can establish a quantity and sometimes a GBP price, but it
 * cannot be treated as a live quote feed. This module therefore carries two
 * explicit price facts alongside every row. Consumers must show an unknown
 * cost basis or valuation as unknown rather than manufacturing a return.
 */

import { parseDelimitedRows, parseStatementAmount } from './statement-import';

export type InvestmentImportProvider = 'trading212' | 'kraken';
export type ImportedInvestmentCategory = 'Stock' | 'ETF' | 'Crypto' | 'Mutual Fund' | 'Real Estate' | 'Cash' | 'Other';

export interface ImportedInvestmentHolding {
  name: string;
  ticker?: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  /** True only when the import contained a GBP cost basis. */
  costBasisKnown: boolean;
  /** True only when the import contained a GBP valuation price. */
  currentPriceKnown: boolean;
  category: ImportedInvestmentCategory;
  sourceRows: number[];
}

/** A normalised historical execution; no raw CSV row is retained. */
export interface ImportedInvestmentActivity {
  provider: InvestmentImportProvider;
  activityType: 'buy' | 'sell';
  occurredOn: string;
  name: string;
  ticker?: string;
  quantity: number;
  unitPriceGbp?: number;
  sourceReference: string;
  sourceRow: number;
}

export interface InvestmentImportIssue {
  sourceRow?: number;
  message: string;
}

export interface InvestmentImportResult {
  provider: InvestmentImportProvider;
  mode: 'activity' | 'snapshot' | 'unrecognised';
  holdings: ImportedInvestmentHolding[];
  activities: ImportedInvestmentActivity[];
  issues: InvestmentImportIssue[];
  processedRows: number;
}

interface CsvTable {
  headers: string[];
  rows: string[][];
  headerRow: number;
}

interface ActivityRow {
  sourceRow: number;
  sortKey: string;
  action: 'buy' | 'sell';
  name: string;
  ticker?: string;
  shares: number;
  price?: number;
  occurredOn?: string;
  sourceReference: string;
  category: ImportedInvestmentCategory;
}

const MAX_ASSET_NAME_LENGTH = 160;
const EPSILON = 1e-10;

const normaliseHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const cleanCell = (value: string) => Array.from(value, character => character.charCodeAt(0) < 32 ? ' ' : character).join('').replace(/\s+/g, ' ').trim();
const cleanName = (value: string) => cleanCell(value).slice(0, MAX_ASSET_NAME_LENGTH);
const cellAt = (row: string[], index: number) => index >= 0 ? cleanCell(row[index] ?? '') : '';

const findColumn = (headers: string[], names: string[]) => {
  const normalised = headers.map(normaliseHeader);
  return normalised.findIndex(header => names.includes(header));
};

const findColumnContaining = (headers: string[], matcher: (header: string) => boolean) =>
  headers.map(normaliseHeader).findIndex(matcher);

const chooseDelimiter = (text: string) => {
  const candidates = [',', ';', '\t'];
  const sample = text.split(/\r?\n/).filter(line => line.trim()).slice(0, 10);
  return candidates.reduce((best, candidate) => {
    const count = (delimiter: string) => sample.reduce((total, line) => total + line.split(delimiter).length - 1, 0);
    return count(candidate) > count(best) ? candidate : best;
  }, ',');
};

const parseCsvTable = (text: string): CsvTable | undefined => {
  const rows = parseDelimitedRows(text.replace(/^\uFEFF/, ''), chooseDelimiter(text));
  const headerRow = rows.findIndex(row => row.filter(value => value.trim()).length >= 2);
  if (headerRow < 0) return undefined;
  return { headers: rows[headerRow], rows: rows.slice(headerRow + 1), headerRow };
};

const parseNonNegative = (value: string): number | undefined => {
  const parsed = parseStatementAmount(value);
  return parsed === undefined || !Number.isFinite(parsed) ? undefined : Math.abs(parsed);
};

const headerCurrency = (header: string) => {
  const normalized = normaliseHeader(header);
  const match = normalized.match(/(gbp|usd|eur|cad|aud|jpy)$/);
  return match?.[1]?.toUpperCase();
};

const isGbpPrice = (headers: string[], currencyIndex: number, priceIndex: number, row: string[]) => {
  // `Currency/Symbol` in a balances export identifies BTC, not the unit of
  // `Price (GBP)`, so an explicit unit in the price header takes precedence.
  const currency = headerCurrency(headers[priceIndex] ?? '') || cellAt(row, currencyIndex).toUpperCase();
  return !currency || currency === 'GBP';
};

const dateSortKey = (value: string, fallback: number) => {
  const match = cleanCell(value).match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})(.*)$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}${match[4]}` : `~${String(fallback).padStart(8, '0')}`;
};

const activityDate = (value: string) => {
  const match = cleanCell(value).match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
};

const normalizeTicker = (value: string) => {
  const ticker = cleanCell(value).toUpperCase();
  return ticker.replace(/[^A-Z0-9.-]/g, '').slice(0, 32) || undefined;
};

const classifyTrading212Asset = (name: string, ticker?: string): ImportedInvestmentCategory => {
  const value = `${name} ${ticker ?? ''}`.toLowerCase();
  if (/\b(bitcoin|ethereum|solana|cardano|crypto|btc|eth|sol)\b/.test(value)) return 'Crypto';
  if (/\b(etf|ucits|vanguard|ishares|index fund)\b/.test(value)) return 'ETF';
  return 'Stock';
};

const KRAKEN_ASSET_NAMES: Record<string, string> = {
  XXBT: 'BTC', XBT: 'BTC', BTC: 'BTC',
  XETH: 'ETH', ETH: 'ETH',
  ZGBP: 'GBP', GBP: 'GBP',
  ZUSD: 'USD', USD: 'USD',
  ZEUR: 'EUR', EUR: 'EUR',
  USDT: 'USDT', USDC: 'USDC',
};

const normaliseKrakenAsset = (value: string) => {
  const compact = cleanCell(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (KRAKEN_ASSET_NAMES[compact]) return KRAKEN_ASSET_NAMES[compact];
  if (/^X[A-Z0-9]{3,}$/.test(compact)) return compact.slice(1);
  if (/^Z[A-Z0-9]{3,}$/.test(compact)) return compact.slice(1);
  return compact || 'Unknown asset';
};

const splitKrakenPair = (value: string) => {
  const pair = cleanCell(value).toUpperCase().replace(/\s/g, '');
  const separated = pair.split(/[/_-]/).filter(Boolean);
  if (separated.length >= 2) return { base: separated[0], quote: separated[1] };

  const quotes = ['ZUSDT', 'USDT', 'ZUSDC', 'USDC', 'ZUSD', 'USD', 'ZGBP', 'GBP', 'ZEUR', 'EUR', 'ZAUD', 'AUD', 'ZCAD', 'CAD', 'ZJPY', 'JPY'];
  const quote = quotes.find(candidate => pair.endsWith(candidate));
  return quote && pair.length > quote.length
    ? { base: pair.slice(0, -quote.length), quote }
    : { base: pair, quote: undefined };
};

const addActivityIssue = (issues: InvestmentImportIssue[], count: number, provider: string) => {
  if (count > 0) issues.push({ message: `Ignored ${count} ${provider} row${count === 1 ? '' : 's'} that was not a completed buy or sell.` });
};

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

/** Stable client identity makes importing overlapping export periods safe. */
export const investmentActivityId = (
  provider: InvestmentImportProvider,
  accountId: string,
  activity: Pick<ImportedInvestmentActivity, 'sourceReference'>,
) => `ia_${stableHash(`${provider}|${accountId}|${activity.sourceReference}`)}`;

const activityHistory = (
  provider: InvestmentImportProvider,
  activities: ActivityRow[],
  issues: InvestmentImportIssue[],
) => {
  const history: ImportedInvestmentActivity[] = [];
  let undated = 0;
  activities.forEach(activity => {
    if (!activity.occurredOn) {
      undated += 1;
      return;
    }
    history.push({
      provider,
      activityType: activity.action,
      occurredOn: activity.occurredOn,
      name: activity.name,
      ticker: activity.ticker,
      quantity: activity.shares,
      unitPriceGbp: activity.price,
      sourceReference: activity.sourceReference,
      sourceRow: activity.sourceRow,
    });
  });
  if (undated > 0) issues.push({ message: `${undated} trade row${undated === 1 ? '' : 's'} had no ISO-like date, so it was used for the position but not retained in activity history.` });
  return history;
};

const aggregateActivity = (
  activities: ActivityRow[],
  provider: InvestmentImportProvider,
  issues: InvestmentImportIssue[],
): ImportedInvestmentHolding[] => {
  const positions = new Map<string, {
    name: string;
    ticker?: string;
    category: ImportedInvestmentCategory;
    shares: number;
    cost: number;
    costBasisKnown: boolean;
    sourceRows: number[];
  }>();

  [...activities]
    .sort((left, right) => left.sortKey.localeCompare(right.sortKey) || left.sourceRow - right.sourceRow)
    .forEach(activity => {
      const key = `${activity.ticker ?? activity.name.toLowerCase()}|${activity.category}`;
      const existing = positions.get(key) ?? {
        name: activity.name,
        ticker: activity.ticker,
        category: activity.category,
        shares: 0,
        cost: 0,
        costBasisKnown: true,
        sourceRows: [],
      };
      existing.sourceRows.push(activity.sourceRow);

      if (activity.action === 'buy') {
        existing.shares += activity.shares;
        if (activity.price === undefined) {
          existing.costBasisKnown = false;
        } else {
          existing.cost += activity.shares * activity.price;
        }
      } else if (existing.shares + EPSILON < activity.shares) {
        // A partial export cannot establish the cost of an inherited position.
        existing.costBasisKnown = false;
        existing.shares = 0;
        existing.cost = 0;
        issues.push({ sourceRow: activity.sourceRow, message: `Sell exceeds the position reconstructed from this ${provider === 'kraken' ? 'Kraken' : 'Trading 212'} CSV; cost basis needs review.` });
      } else {
        const averageCost = existing.shares > EPSILON ? existing.cost / existing.shares : 0;
        existing.shares = Math.max(0, existing.shares - activity.shares);
        existing.cost = Math.max(0, existing.cost - averageCost * activity.shares);
      }
      positions.set(key, existing);
    });

  return [...positions.values()]
    .filter(position => position.shares > EPSILON)
    .map(position => ({
      name: position.name,
      ticker: position.ticker,
      shares: position.shares,
      avgPrice: position.costBasisKnown ? position.cost / position.shares : 0,
      // Activity exports are historical activity, not live market data.
      currentPrice: 0,
      costBasisKnown: position.costBasisKnown,
      currentPriceKnown: false,
      category: position.category,
      sourceRows: position.sourceRows,
    }));
};

const parseTrading212Activity = (table: CsvTable, issues: InvestmentImportIssue[]): InvestmentImportResult => {
  const actionIndex = findColumn(table.headers, ['action', 'type', 'transactiontype']);
  const nameIndex = findColumn(table.headers, ['name', 'instrument', 'instrumentname']);
  const tickerIndex = findColumn(table.headers, ['ticker', 'symbol', 'epic', 'isin']);
  const sharesIndex = findColumn(table.headers, ['noofshares', 'shares', 'quantity', 'units']);
  const priceIndex = findColumn(table.headers, ['pricepershare', 'priceshare', 'price', 'averageprice', 'averagebuyprice']);
  const priceCurrencyIndex = findColumnContaining(table.headers, header => header.includes('currency') && (header.includes('price') || header.includes('share')));
  const timeIndex = findColumn(table.headers, ['time', 'date', 'datetime', 'transactiondate']);
  const sourceIdIndex = findColumn(table.headers, ['id', 'transactionid', 'reference', 'referenceid']);
  const activities: ActivityRow[] = [];
  let ignored = 0;

  table.rows.forEach((row, index) => {
    const sourceRow = table.headerRow + index + 2;
    const action = cellAt(row, actionIndex).toLowerCase();
    const isBuy = /\bbuy\b/.test(action) && !/(cancel|reject|fail)/.test(action);
    const isSell = /\bsell\b/.test(action) && !/(cancel|reject|fail)/.test(action);
    if (!isBuy && !isSell) {
      if (row.some(value => value.trim())) ignored += 1;
      return;
    }
    const shares = parseNonNegative(cellAt(row, sharesIndex));
    const ticker = normalizeTicker(cellAt(row, tickerIndex));
    const name = cleanName(cellAt(row, nameIndex) || ticker || 'Trading 212 position');
    if (!shares || !name) {
      issues.push({ sourceRow, message: 'Skipped: buy/sell row has no usable instrument or quantity.' });
      return;
    }
    const rawPrice = parseNonNegative(cellAt(row, priceIndex));
    const price = rawPrice !== undefined && isGbpPrice(table.headers, priceCurrencyIndex, priceIndex, row) ? rawPrice : undefined;
    const time = cellAt(row, timeIndex);
    activities.push({
      sourceRow,
      sortKey: dateSortKey(time, sourceRow),
      action: isBuy ? 'buy' : 'sell',
      name,
      ticker,
      shares,
      price,
      occurredOn: activityDate(time),
      sourceReference: cellAt(row, sourceIdIndex) || `${isBuy ? 'buy' : 'sell'}|${time}|${ticker ?? name}|${shares}|${rawPrice ?? ''}`,
      category: classifyTrading212Asset(name, ticker),
    });
  });
  addActivityIssue(issues, ignored, 'Trading 212');
  if (activities.some(activity => activity.price === undefined)) {
    issues.push({ message: 'A non-GBP or missing price was not converted. Those positions are imported with an unknown cost basis.' });
  }
  const holdings = aggregateActivity(activities, 'trading212', issues);
  return {
    provider: 'trading212',
    mode: 'activity',
    holdings,
    activities: activityHistory('trading212', activities, issues),
    issues,
    processedRows: activities.length,
  };
};

const parseKrakenTrades = (table: CsvTable, issues: InvestmentImportIssue[]): InvestmentImportResult => {
  const pairIndex = findColumn(table.headers, ['pair']);
  const typeIndex = findColumn(table.headers, ['type', 'side']);
  const volumeIndex = findColumn(table.headers, ['vol', 'volume', 'quantity']);
  const priceIndex = findColumn(table.headers, ['price']);
  const timeIndex = findColumn(table.headers, ['time', 'date', 'datetime']);
  const sourceIdIndex = findColumn(table.headers, ['txid', 'id', 'transactionid']);
  const activities: ActivityRow[] = [];
  let ignored = 0;

  table.rows.forEach((row, index) => {
    const sourceRow = table.headerRow + index + 2;
    const type = cellAt(row, typeIndex).toLowerCase();
    if (type !== 'buy' && type !== 'sell') {
      if (row.some(value => value.trim())) ignored += 1;
      return;
    }
    const shares = parseNonNegative(cellAt(row, volumeIndex));
    const pair = splitKrakenPair(cellAt(row, pairIndex));
    const ticker = normaliseKrakenAsset(pair.base);
    if (!shares || ticker === 'Unknown asset') {
      issues.push({ sourceRow, message: 'Skipped: trade has no usable pair or volume.' });
      return;
    }
    const rawPrice = parseNonNegative(cellAt(row, priceIndex));
    const price = pair.quote && normaliseKrakenAsset(pair.quote) === 'GBP' ? rawPrice : undefined;
    const time = cellAt(row, timeIndex);
    activities.push({
      sourceRow,
      sortKey: dateSortKey(time, sourceRow),
      action: type,
      name: ticker,
      ticker,
      shares,
      price,
      occurredOn: activityDate(time),
      sourceReference: cellAt(row, sourceIdIndex) || `${type}|${time}|${cellAt(row, pairIndex)}|${shares}|${rawPrice ?? ''}`,
      category: ticker === 'GBP' ? 'Cash' : 'Crypto',
    });
  });
  addActivityIssue(issues, ignored, 'Kraken');
  if (activities.some(activity => activity.price === undefined)) {
    issues.push({ message: 'Only GBP trading pairs can establish a GBP cost basis. Other positions need a reviewed cost price.' });
  }
  const holdings = aggregateActivity(activities, 'kraken', issues);
  return {
    provider: 'kraken',
    mode: 'activity',
    holdings,
    activities: activityHistory('kraken', activities, issues),
    issues,
    processedRows: activities.length,
  };
};

const parseSnapshot = (provider: InvestmentImportProvider, table: CsvTable, issues: InvestmentImportIssue[]): InvestmentImportResult => {
  const nameIndex = findColumn(table.headers, ['name', 'instrument', 'instrumentname', 'asset', 'currencysymbol', 'currency', 'symbol', 'ticker']);
  const tickerIndex = findColumn(table.headers, ['ticker', 'symbol', 'asset', 'currencysymbol', 'currency']);
  const sharesIndex = findColumn(table.headers, ['quantity', 'shares', 'units', 'balance', 'vol', 'volume']);
  const averageIndex = findColumn(table.headers, ['averageprice', 'averagebuyprice', 'costbasis', 'avgprice']);
  const currentIndex = findColumn(table.headers, ['currentprice', 'marketprice', 'lastprice', 'price', 'pricegbp', 'priceusd']);
  const priceCurrencyIndex = findColumn(table.headers, ['currency', 'pricecurrency', 'currencyprice', 'currencypriceshare']);
  const holdings: ImportedInvestmentHolding[] = [];

  table.rows.forEach((row, index) => {
    const sourceRow = table.headerRow + index + 2;
    const rawTicker = provider === 'kraken'
      ? normaliseKrakenAsset(cellAt(row, tickerIndex))
      : normalizeTicker(cellAt(row, tickerIndex));
    const name = cleanName(cellAt(row, nameIndex) || rawTicker || `${provider === 'kraken' ? 'Kraken' : 'Trading 212'} position`);
    const shares = parseNonNegative(cellAt(row, sharesIndex));
    if (!shares || !name) {
      if (row.some(value => value.trim())) issues.push({ sourceRow, message: 'Skipped: snapshot row has no usable asset or quantity.' });
      return;
    }
    const usesGbp = isGbpPrice(table.headers, priceCurrencyIndex, currentIndex, row);
    const average = parseNonNegative(cellAt(row, averageIndex));
    const current = parseNonNegative(cellAt(row, currentIndex));
    const ticker = rawTicker && rawTicker !== 'Unknown asset' ? rawTicker : undefined;
    holdings.push({
      name,
      ticker,
      shares,
      avgPrice: usesGbp && average !== undefined ? average : 0,
      currentPrice: usesGbp && current !== undefined ? current : 0,
      costBasisKnown: usesGbp && average !== undefined,
      currentPriceKnown: usesGbp && current !== undefined,
      category: provider === 'kraken'
        ? ticker === 'GBP' ? 'Cash' : 'Crypto'
        : classifyTrading212Asset(name, ticker),
      sourceRows: [sourceRow],
    });
  });
  if (holdings.some(holding => !holding.currentPriceKnown || !holding.costBasisKnown)) {
    issues.push({ message: 'A snapshot only fills prices expressed in GBP. Missing or non-GBP values stay unknown for review.' });
  }
  return { provider, mode: 'snapshot', holdings, activities: [], issues, processedRows: holdings.length };
};

/** Parses a Trading 212 or Kraken CSV without uploading it anywhere. */
export const parseInvestmentCsv = (provider: InvestmentImportProvider, text: string): InvestmentImportResult => {
  const issues: InvestmentImportIssue[] = [];
  const table = parseCsvTable(text);
  if (!table) {
    return { provider, mode: 'unrecognised', holdings: [], activities: [], processedRows: 0, issues: [{ message: 'The file does not contain a CSV header row.' }] };
  }

  const actionIndex = findColumn(table.headers, ['action', 'transactiontype']);
  const quantityIndex = findColumn(table.headers, ['noofshares', 'shares', 'quantity', 'units']);
  const krakenTrade = findColumn(table.headers, ['pair']) >= 0
    && findColumn(table.headers, ['type', 'side']) >= 0
    && findColumn(table.headers, ['vol', 'volume', 'quantity']) >= 0;
  const trading212Activity = actionIndex >= 0 && quantityIndex >= 0;
  const snapshot = findColumn(table.headers, ['quantity', 'shares', 'units', 'balance', 'vol', 'volume']) >= 0
    && findColumn(table.headers, ['name', 'instrument', 'asset', 'currencysymbol', 'currency', 'symbol', 'ticker']) >= 0;

  if (provider === 'kraken' && krakenTrade) return parseKrakenTrades(table, issues);
  if (provider === 'trading212' && trading212Activity) return parseTrading212Activity(table, issues);
  if (snapshot) return parseSnapshot(provider, table, issues);
  return {
    provider,
    mode: 'unrecognised',
    holdings: [],
    activities: [],
    processedRows: 0,
    issues: [{ message: `This does not look like a supported ${provider === 'kraken' ? 'Kraken Trades/Balances' : 'Trading 212 activity/holdings'} CSV.` }],
  };
};

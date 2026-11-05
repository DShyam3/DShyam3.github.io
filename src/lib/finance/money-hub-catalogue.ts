/**
 * Money Hub reference catalogue: currencies, tax jurisdictions and cities.
 *
 * A city belongs to exactly one jurisdiction, the level whose payroll rules
 * decide its take-home pay (a UK nation, a country, a US state, a Swiss
 * canton). A jurisdiction is `calculated` only when a deterministic payroll
 * calculator in `money-hub-payroll.ts` covers it; everywhere else take-home is
 * a net figure the user supplies. Coverage is data, so widening the hub is a
 * row here plus, for a calculated jurisdiction, a calculator and its tests.
 *
 * No prices, rates or salaries live here: costs are user inputs, exchange rates
 * are dated user inputs, and payroll arithmetic lives in the calculators.
 */

export const MONEY_HUB_CURRENCIES = [
  'GBP', 'EUR', 'CHF', 'SEK', 'DKK', 'NOK', 'PLN',
  'USD', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'JPY', 'AED',
] as const;

export type MoneyHubCurrency = typeof MONEY_HUB_CURRENCIES[number];

export interface MoneyHubReference {
  label: string;
  url: string;
}

export type MoneyHubPayrollCoverage = 'calculated' | 'user-supplied';

export interface MoneyHubJurisdictionInfo {
  id: string;
  /** ISO 3166-1 alpha-2. */
  countryCode: string;
  countryName: string;
  /** The tax region, e.g. "England", "Germany", "New York State". */
  name: string;
  currency: MoneyHubCurrency;
  /** The period a take-home figure should cover, in the jurisdiction's own terms. */
  taxPeriod: string;
  payroll: MoneyHubPayrollCoverage;
  /** What the "local charges" budget category means here. */
  localChargesLabel: string;
  /** How healthcare is paid for, so it is counted once in pay or in the budget. */
  healthcareNote: string;
  /** Official tax authority pages; starting points for a net quote, not verified calculations. */
  references: readonly MoneyHubReference[];
}

const LOCAL_CHARGES = 'Local taxes & household charges';
const HEALTHCARE_ONCE =
  'Count healthcare once: include premiums or charges here only if they are not already taken out of the net pay above.';
const CALENDAR_2026 = 'Calendar year 2026';
const UK_2026_27 = '2026/27 UK tax year (6 April 2026 to 5 April 2027)';
const UK_HEALTHCARE =
  'NHS care is funded through tax and National Insurance; enter dental, optical, prescription or private cover costs here.';
const UK_DEVOLVED_HEALTHCARE =
  'NHS care is funded through tax and National Insurance; enter any dental, optical or private cover costs here.';
const HMRC: MoneyHubReference = {
  label: 'GOV.UK rates and thresholds 2026 to 2027',
  url: 'https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027',
};
const IRS: MoneyHubReference = { label: 'Internal Revenue Service', url: 'https://www.irs.gov/' };
const CRA: MoneyHubReference = { label: 'Canada Revenue Agency', url: 'https://www.canada.ca/en/revenue-agency.html' };
const ESTV: MoneyHubReference = {
  label: 'Swiss Federal Tax Administration tax calculator',
  url: 'https://swisstaxcalculator.estv.admin.ch/',
};
const AGENCIA_TRIBUTARIA: MoneyHubReference = {
  label: 'Agencia Tributaria',
  url: 'https://sede.agenciatributaria.gob.es/',
};
const US_HEALTHCARE =
  'Employer health plan premiums are often taken from pay before tax; if your net quote already excludes them, enter only deductibles and other out-of-pocket costs here.';

export const MONEY_HUB_JURISDICTIONS = [
  {
    id: 'GB-ENG', countryCode: 'GB', countryName: 'United Kingdom', name: 'England', currency: 'GBP',
    taxPeriod: UK_2026_27, payroll: 'calculated', localChargesLabel: 'Council Tax',
    healthcareNote: UK_HEALTHCARE, references: [HMRC],
  },
  {
    id: 'GB-SCT', countryCode: 'GB', countryName: 'United Kingdom', name: 'Scotland', currency: 'GBP',
    taxPeriod: UK_2026_27, payroll: 'calculated', localChargesLabel: 'Council Tax',
    healthcareNote: UK_DEVOLVED_HEALTHCARE, references: [HMRC],
  },
  {
    id: 'GB-WLS', countryCode: 'GB', countryName: 'United Kingdom', name: 'Wales', currency: 'GBP',
    taxPeriod: UK_2026_27, payroll: 'calculated', localChargesLabel: 'Council Tax',
    healthcareNote: UK_DEVOLVED_HEALTHCARE, references: [HMRC],
  },
  {
    id: 'GB-NIR', countryCode: 'GB', countryName: 'United Kingdom', name: 'Northern Ireland', currency: 'GBP',
    taxPeriod: UK_2026_27, payroll: 'calculated', localChargesLabel: 'Domestic rates',
    healthcareNote: UK_DEVOLVED_HEALTHCARE, references: [HMRC],
  },
  {
    id: 'DE', countryCode: 'DE', countryName: 'Germany', name: 'Germany', currency: 'EUR',
    taxPeriod: CALENDAR_2026, payroll: 'calculated', localChargesLabel: LOCAL_CHARGES,
    healthcareNote:
      'Statutory health and long-term care insurance are already deducted from pay above; enter only extra costs such as co-payments or supplementary cover.',
    references: [{ label: 'Federal Ministry of Finance tax calculator', url: 'https://www.bmf-steuerrechner.de/' }],
  },
  {
    id: 'NL', countryCode: 'NL', countryName: 'Netherlands', name: 'Netherlands', currency: 'EUR',
    taxPeriod: CALENDAR_2026, payroll: 'calculated', localChargesLabel: LOCAL_CHARGES,
    healthcareNote:
      'Basic health insurance is bought privately and is not deducted from pay above; enter the monthly premium and expected deductible here.',
    references: [{
      label: 'Belastingdienst rates for 2026',
      url: 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontenten/belastingdienst/business/payroll_taxes/you_are_not_established_in_the_netherlands_are_you_required_to_withhold_payroll_taxes/when_you_are_going_to_withhold_payroll_taxes/calculating_payroll_taxes/rates/rates-2026/',
    }],
  },
  {
    id: 'IE', countryCode: 'IE', countryName: 'Ireland', name: 'Ireland', currency: 'EUR',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: HEALTHCARE_ONCE, references: [{ label: 'Revenue', url: 'https://www.revenue.ie/' }],
  },
  {
    id: 'FR', countryCode: 'FR', countryName: 'France', name: 'France', currency: 'EUR',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: HEALTHCARE_ONCE, references: [{ label: 'impots.gouv.fr', url: 'https://www.impots.gouv.fr/' }],
  },
  {
    id: 'ES-MD', countryCode: 'ES', countryName: 'Spain', name: 'Community of Madrid', currency: 'EUR',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: HEALTHCARE_ONCE, references: [AGENCIA_TRIBUTARIA],
  },
  {
    id: 'ES-CT', countryCode: 'ES', countryName: 'Spain', name: 'Catalonia', currency: 'EUR',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: HEALTHCARE_ONCE, references: [AGENCIA_TRIBUTARIA],
  },
  {
    id: 'PT', countryCode: 'PT', countryName: 'Portugal', name: 'Portugal', currency: 'EUR',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: HEALTHCARE_ONCE,
    references: [{ label: 'Portal das Finanças', url: 'https://www.portaldasfinancas.gov.pt/' }],
  },
  {
    id: 'BE', countryCode: 'BE', countryName: 'Belgium', name: 'Belgium', currency: 'EUR',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: HEALTHCARE_ONCE, references: [{ label: 'FPS Finance', url: 'https://finance.belgium.be/' }],
  },
  {
    id: 'IT', countryCode: 'IT', countryName: 'Italy', name: 'Italy', currency: 'EUR',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: HEALTHCARE_ONCE,
    references: [{ label: 'Agenzia delle Entrate', url: 'https://www.agenziaentrate.gov.it/' }],
  },
  {
    id: 'CH-ZH', countryCode: 'CH', countryName: 'Switzerland', name: 'Canton of Zurich', currency: 'CHF',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote:
      'Basic health insurance is normally bought privately rather than deducted from pay; enter the premium and expected deductible here unless your net quote already covers it.',
    references: [ESTV],
  },
  {
    id: 'CH-GE', countryCode: 'CH', countryName: 'Switzerland', name: 'Canton of Geneva', currency: 'CHF',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote:
      'Basic health insurance is normally bought privately rather than deducted from pay; enter the premium and expected deductible here unless your net quote already covers it.',
    references: [ESTV],
  },
  {
    id: 'SE', countryCode: 'SE', countryName: 'Sweden', name: 'Sweden', currency: 'SEK',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: HEALTHCARE_ONCE, references: [{ label: 'Skatteverket', url: 'https://www.skatteverket.se/' }],
  },
  {
    id: 'DK', countryCode: 'DK', countryName: 'Denmark', name: 'Denmark', currency: 'DKK',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: HEALTHCARE_ONCE, references: [{ label: 'Skattestyrelsen', url: 'https://skat.dk/' }],
  },
  {
    id: 'NO', countryCode: 'NO', countryName: 'Norway', name: 'Norway', currency: 'NOK',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: HEALTHCARE_ONCE, references: [{ label: 'Skatteetaten', url: 'https://www.skatteetaten.no/' }],
  },
  {
    id: 'PL', countryCode: 'PL', countryName: 'Poland', name: 'Poland', currency: 'PLN',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: HEALTHCARE_ONCE, references: [{ label: 'podatki.gov.pl', url: 'https://www.podatki.gov.pl/' }],
  },
  {
    id: 'US-NY', countryCode: 'US', countryName: 'United States', name: 'New York State', currency: 'USD',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: US_HEALTHCARE,
    references: [IRS, { label: 'New York State Department of Taxation and Finance', url: 'https://www.tax.ny.gov/' }],
  },
  {
    id: 'US-CA', countryCode: 'US', countryName: 'United States', name: 'California', currency: 'USD',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: US_HEALTHCARE,
    references: [IRS, { label: 'California Franchise Tax Board', url: 'https://www.ftb.ca.gov/' }],
  },
  {
    id: 'US-TX', countryCode: 'US', countryName: 'United States', name: 'Texas', currency: 'USD',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: US_HEALTHCARE,
    references: [IRS, { label: 'Texas Comptroller', url: 'https://comptroller.texas.gov/' }],
  },
  {
    id: 'US-WA', countryCode: 'US', countryName: 'United States', name: 'Washington State', currency: 'USD',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: US_HEALTHCARE,
    references: [IRS, { label: 'Washington State Department of Revenue', url: 'https://dor.wa.gov/' }],
  },
  {
    id: 'CA-ON', countryCode: 'CA', countryName: 'Canada', name: 'Ontario', currency: 'CAD',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: HEALTHCARE_ONCE, references: [CRA],
  },
  {
    id: 'CA-BC', countryCode: 'CA', countryName: 'Canada', name: 'British Columbia', currency: 'CAD',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: HEALTHCARE_ONCE, references: [CRA],
  },
  {
    id: 'AU', countryCode: 'AU', countryName: 'Australia', name: 'Australia', currency: 'AUD',
    taxPeriod: '2026–27 income year (1 July 2026 to 30 June 2027)', payroll: 'user-supplied',
    localChargesLabel: LOCAL_CHARGES, healthcareNote: HEALTHCARE_ONCE,
    references: [{ label: 'Australian Taxation Office', url: 'https://www.ato.gov.au/' }],
  },
  {
    id: 'NZ', countryCode: 'NZ', countryName: 'New Zealand', name: 'New Zealand', currency: 'NZD',
    taxPeriod: '2026–27 tax year (1 April 2026 to 31 March 2027)', payroll: 'user-supplied',
    localChargesLabel: LOCAL_CHARGES, healthcareNote: HEALTHCARE_ONCE,
    references: [{ label: 'Inland Revenue', url: 'https://www.ird.govt.nz/' }],
  },
  {
    id: 'SG', countryCode: 'SG', countryName: 'Singapore', name: 'Singapore', currency: 'SGD',
    taxPeriod: 'Calendar year 2026 income (Year of Assessment 2027)', payroll: 'user-supplied',
    localChargesLabel: LOCAL_CHARGES, healthcareNote: HEALTHCARE_ONCE,
    references: [{ label: 'Inland Revenue Authority of Singapore', url: 'https://www.iras.gov.sg/' }],
  },
  {
    id: 'HK', countryCode: 'HK', countryName: 'Hong Kong', name: 'Hong Kong', currency: 'HKD',
    taxPeriod: '2026/27 year of assessment (1 April 2026 to 31 March 2027)', payroll: 'user-supplied',
    localChargesLabel: LOCAL_CHARGES, healthcareNote: HEALTHCARE_ONCE,
    references: [{ label: 'Inland Revenue Department', url: 'https://www.ird.gov.hk/' }],
  },
  {
    id: 'JP', countryCode: 'JP', countryName: 'Japan', name: 'Japan', currency: 'JPY',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: HEALTHCARE_ONCE,
    references: [{ label: 'National Tax Agency', url: 'https://www.nta.go.jp/english/' }],
  },
  {
    id: 'AE', countryCode: 'AE', countryName: 'United Arab Emirates', name: 'United Arab Emirates', currency: 'AED',
    taxPeriod: CALENDAR_2026, payroll: 'user-supplied', localChargesLabel: LOCAL_CHARGES,
    healthcareNote: HEALTHCARE_ONCE, references: [{ label: 'Federal Tax Authority', url: 'https://tax.gov.ae/' }],
  },
] as const satisfies readonly MoneyHubJurisdictionInfo[];

export type MoneyHubJurisdictionId = typeof MONEY_HUB_JURISDICTIONS[number]['id'];
export type MoneyHubJurisdiction = MoneyHubJurisdictionInfo & { id: MoneyHubJurisdictionId };

export const MONEY_HUB_CITIES = [
  { id: 'london', name: 'London', jurisdiction: 'GB-ENG' },
  { id: 'manchester', name: 'Manchester', jurisdiction: 'GB-ENG' },
  { id: 'exeter', name: 'Exeter', jurisdiction: 'GB-ENG' },
  { id: 'southampton', name: 'Southampton', jurisdiction: 'GB-ENG' },
  { id: 'edinburgh', name: 'Edinburgh', jurisdiction: 'GB-SCT' },
  { id: 'glasgow', name: 'Glasgow', jurisdiction: 'GB-SCT' },
  { id: 'cardiff', name: 'Cardiff', jurisdiction: 'GB-WLS' },
  { id: 'belfast', name: 'Belfast', jurisdiction: 'GB-NIR' },
  { id: 'berlin', name: 'Berlin', jurisdiction: 'DE' },
  { id: 'munich', name: 'Munich', jurisdiction: 'DE' },
  { id: 'hamburg', name: 'Hamburg', jurisdiction: 'DE' },
  { id: 'frankfurt', name: 'Frankfurt', jurisdiction: 'DE' },
  { id: 'amsterdam', name: 'Amsterdam', jurisdiction: 'NL' },
  { id: 'rotterdam', name: 'Rotterdam', jurisdiction: 'NL' },
  { id: 'utrecht', name: 'Utrecht', jurisdiction: 'NL' },
  { id: 'dublin', name: 'Dublin', jurisdiction: 'IE' },
  { id: 'paris', name: 'Paris', jurisdiction: 'FR' },
  { id: 'madrid', name: 'Madrid', jurisdiction: 'ES-MD' },
  { id: 'barcelona', name: 'Barcelona', jurisdiction: 'ES-CT' },
  { id: 'lisbon', name: 'Lisbon', jurisdiction: 'PT' },
  { id: 'brussels', name: 'Brussels', jurisdiction: 'BE' },
  { id: 'milan', name: 'Milan', jurisdiction: 'IT' },
  { id: 'zurich', name: 'Zurich', jurisdiction: 'CH-ZH' },
  { id: 'geneva', name: 'Geneva', jurisdiction: 'CH-GE' },
  { id: 'stockholm', name: 'Stockholm', jurisdiction: 'SE' },
  { id: 'copenhagen', name: 'Copenhagen', jurisdiction: 'DK' },
  { id: 'oslo', name: 'Oslo', jurisdiction: 'NO' },
  { id: 'warsaw', name: 'Warsaw', jurisdiction: 'PL' },
  { id: 'new-york', name: 'New York City', jurisdiction: 'US-NY' },
  { id: 'san-francisco', name: 'San Francisco', jurisdiction: 'US-CA' },
  { id: 'austin', name: 'Austin', jurisdiction: 'US-TX' },
  { id: 'seattle', name: 'Seattle', jurisdiction: 'US-WA' },
  { id: 'toronto', name: 'Toronto', jurisdiction: 'CA-ON' },
  { id: 'vancouver', name: 'Vancouver', jurisdiction: 'CA-BC' },
  { id: 'sydney', name: 'Sydney', jurisdiction: 'AU' },
  { id: 'melbourne', name: 'Melbourne', jurisdiction: 'AU' },
  { id: 'auckland', name: 'Auckland', jurisdiction: 'NZ' },
  { id: 'singapore', name: 'Singapore', jurisdiction: 'SG' },
  { id: 'hong-kong', name: 'Hong Kong', jurisdiction: 'HK' },
  { id: 'tokyo', name: 'Tokyo', jurisdiction: 'JP' },
  { id: 'dubai', name: 'Dubai', jurisdiction: 'AE' },
] as const satisfies readonly { id: string; name: string; jurisdiction: MoneyHubJurisdictionId }[];

export type MoneyHubCityId = typeof MONEY_HUB_CITIES[number]['id'];
export type MoneyHubCity = typeof MONEY_HUB_CITIES[number];

const JURISDICTIONS_BY_ID = new Map<string, MoneyHubJurisdiction>(
  MONEY_HUB_JURISDICTIONS.map(jurisdiction => [jurisdiction.id, jurisdiction]),
);

export const moneyHubJurisdiction = (id: MoneyHubJurisdictionId): MoneyHubJurisdiction =>
  JURISDICTIONS_BY_ID.get(id)!;

/** Countries in catalogue order, each with its cities, for grouped pickers and the coverage list. */
export const MONEY_HUB_COUNTRIES: readonly {
  countryCode: string;
  countryName: string;
  cities: readonly MoneyHubCity[];
}[] = MONEY_HUB_JURISDICTIONS.reduce<{ countryCode: string; countryName: string; cities: MoneyHubCity[] }[]>(
  (countries, jurisdiction) => {
    let country = countries.find(entry => entry.countryCode === jurisdiction.countryCode);
    if (!country) {
      country = { countryCode: jurisdiction.countryCode, countryName: jurisdiction.countryName, cities: [] };
      countries.push(country);
    }
    country.cities.push(...MONEY_HUB_CITIES.filter(city => city.jurisdiction === jurisdiction.id));
    return countries;
  },
  [],
);

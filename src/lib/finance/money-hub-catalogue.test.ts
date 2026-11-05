import { describe, expect, it } from 'vitest';
import {
  MONEY_HUB_CITIES,
  MONEY_HUB_COUNTRIES,
  MONEY_HUB_CURRENCIES,
  MONEY_HUB_JURISDICTIONS,
  moneyHubJurisdiction,
} from './money-hub-catalogue';
import { calculateMoneyHubPay, MONEY_HUB_PAYROLL_SCOPES } from './money-hub-payroll';

describe('Money Hub catalogue', () => {
  it('has unique jurisdiction and city ids', () => {
    expect(new Set(MONEY_HUB_JURISDICTIONS.map(j => j.id)).size).toBe(MONEY_HUB_JURISDICTIONS.length);
    expect(new Set(MONEY_HUB_CITIES.map(c => c.id)).size).toBe(MONEY_HUB_CITIES.length);
  });

  it('places every city in a catalogued jurisdiction and every jurisdiction has a city', () => {
    for (const city of MONEY_HUB_CITIES) expect(moneyHubJurisdiction(city.jurisdiction).id).toBe(city.jurisdiction);
    for (const jurisdiction of MONEY_HUB_JURISDICTIONS) {
      expect(MONEY_HUB_CITIES.some(city => city.jurisdiction === jurisdiction.id)).toBe(true);
    }
  });

  it('reaches beyond the UK: several continents and currencies', () => {
    expect(new Set(MONEY_HUB_JURISDICTIONS.map(j => j.countryCode)).size).toBeGreaterThanOrEqual(20);
    expect(new Set(MONEY_HUB_JURISDICTIONS.map(j => j.currency))).toEqual(new Set(MONEY_HUB_CURRENCIES));
  });

  it('marks a jurisdiction calculated exactly when a payroll calculator covers it', () => {
    for (const jurisdiction of MONEY_HUB_JURISDICTIONS) {
      const status = calculateMoneyHubPay(jurisdiction.id, 50_000).status;
      expect(status === 'calculated').toBe(jurisdiction.payroll === 'calculated');
      expect(jurisdiction.id in MONEY_HUB_PAYROLL_SCOPES).toBe(jurisdiction.payroll === 'calculated');
    }
  });

  it('keeps UK jurisdictions in GBP and the euro area in EUR', () => {
    for (const jurisdiction of MONEY_HUB_JURISDICTIONS) {
      if (jurisdiction.countryCode === 'GB') expect(jurisdiction.currency).toBe('GBP');
      if (['DE', 'NL', 'IE', 'FR', 'ES', 'PT', 'BE', 'IT'].includes(jurisdiction.countryCode)) {
        expect(jurisdiction.currency).toBe('EUR');
      }
    }
  });

  it('gives every jurisdiction a period, labels and an https official reference', () => {
    for (const jurisdiction of MONEY_HUB_JURISDICTIONS) {
      expect(jurisdiction.taxPeriod.length).toBeGreaterThan(0);
      expect(jurisdiction.localChargesLabel.length).toBeGreaterThan(0);
      expect(jurisdiction.healthcareNote.length).toBeGreaterThan(0);
      expect(jurisdiction.references.length).toBeGreaterThan(0);
      for (const reference of jurisdiction.references) expect(reference.url).toMatch(/^https:\/\//);
    }
  });

  it('groups every city under exactly one country', () => {
    const grouped = MONEY_HUB_COUNTRIES.flatMap(country => country.cities.map(city => city.id));
    expect(grouped.sort()).toEqual(MONEY_HUB_CITIES.map(city => city.id).sort());
    expect(new Set(MONEY_HUB_COUNTRIES.map(c => c.countryCode)).size).toBe(MONEY_HUB_COUNTRIES.length);
    expect(MONEY_HUB_COUNTRIES.find(c => c.countryCode === 'GB')!.cities.map(c => c.id)).toEqual([
      'london', 'manchester', 'exeter', 'southampton', 'edinburgh', 'glasgow', 'cardiff', 'belfast',
    ]);
  });
});

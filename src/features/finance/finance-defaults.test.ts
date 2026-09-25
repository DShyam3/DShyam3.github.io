import { describe, expect, it } from 'vitest';
import { createEmptyTaxConfig, currentTaxYear, isPetsCategory } from './finance-defaults';
import type { BudgetCategory } from './finance-types';

const cat = (name: string): BudgetCategory => ({
  id: 'c1',
  name,
  group: 'needs',
  budgeted: 0,
  items: [],
});

describe('isPetsCategory', () => {
  it('does not match whole words that merely contain "cat" as a substring', () => {
    expect(isPetsCategory(cat('Education'))).toBe(false);
    expect(isPetsCategory(cat('Vacation'))).toBe(false);
    expect(isPetsCategory(cat('Communication'))).toBe(false);
  });

  it('matches pet-related categories, singular and plural', () => {
    expect(isPetsCategory(cat('Pet'))).toBe(true);
    expect(isPetsCategory(cat('Pets'))).toBe(true);
    expect(isPetsCategory(cat('Dog walking'))).toBe(true);
    expect(isPetsCategory(cat('Cat food'))).toBe(true);
    expect(isPetsCategory(cat('Vet bills'))).toBe(true);
  });
});

// Local-time constructors on purpose: an ISO string parses as UTC midnight,
// which is the previous day west of Greenwich and hid a boundary bug in CI.
describe('currentTaxYear', () => {
  it('is the year before 6 April', () => {
    expect(currentTaxYear(new Date(2027, 3, 5))).toBe(2026);
  });

  it('is the year itself from 6 April', () => {
    expect(currentTaxYear(new Date(2027, 3, 6))).toBe(2027);
  });
});

describe('createEmptyTaxConfig', () => {
  it('is effective from that tax year\'s 6 April', () => {
    expect(createEmptyTaxConfig(new Date(2027, 3, 5)).effectiveFrom).toBe('2026-04-06');
    expect(createEmptyTaxConfig(new Date(2027, 3, 6)).effectiveFrom).toBe('2027-04-06');
  });
});

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TAB,
  pathForSurface,
  pathForTab,
  SURFACES,
  TAB_LABELS,
  surfaceForTab,
  tabFromPath,
  type TabKey,
} from './surfaces';

const allTabs = SURFACES.flatMap(s => s.tabs) as TabKey[];

describe('SURFACES', () => {
  it('covers all ten original tabs exactly once', () => {
    expect(allTabs).toHaveLength(10);
    expect(new Set(allTabs).size).toBe(10);
  });

  it('labels every section', () => {
    for (const tab of allTabs) expect(TAB_LABELS[tab]).toBeTruthy();
  });

  it('keeps Home as the only single-section surface', () => {
    const single = SURFACES.filter(s => s.tabs.length === 1);
    expect(single.map(s => s.key)).toEqual(['home']);
  });
});

describe('pathForTab', () => {
  it('gives Home the bare route, with no section segment', () => {
    expect(pathForTab('dashboard')).toBe('/finance');
  });

  it('includes the section for a multi-section surface', () => {
    expect(pathForTab('budget')).toBe('/finance/spending/budget');
    expect(pathForTab('goals')).toBe('/finance/plan/goals');
    expect(pathForTab('time-spent')).toBe('/finance/income/time-spent');
  });
});

describe('pathForSurface', () => {
  it('lands on a surface without naming a section', () => {
    expect(pathForSurface('home')).toBe('/finance');
    expect(pathForSurface('wealth')).toBe('/finance/wealth');
  });
});

describe('tabFromPath', () => {
  it('round-trips every tab through its own URL', () => {
    for (const tab of allTabs) {
      const [, , surfaceSeg, sectionSeg] = pathForTab(tab).split('/');
      expect(tabFromPath(surfaceSeg, sectionSeg)).toBe(tab);
    }
  });

  it('falls back to a surface’s first section when none is named', () => {
    expect(tabFromPath('spending', undefined)).toBe('transactions');
    expect(tabFromPath('wealth', undefined)).toBe('accounts');
  });

  it('falls back to the first section when the section is unknown', () => {
    expect(tabFromPath('plan', 'nonsense')).toBe('cash-flow');
  });

  it('falls back to the default tab for an unknown surface', () => {
    expect(tabFromPath('nonsense', 'budget')).toBe(DEFAULT_TAB);
    expect(tabFromPath(undefined, undefined)).toBe(DEFAULT_TAB);
  });

  it('does not let a section from another surface leak through', () => {
    // /finance/plan/budget is not a real view; budget belongs to Spending.
    expect(tabFromPath('plan', 'budget')).toBe('cash-flow');
  });
});

describe('surfaceForTab', () => {
  it('maps a section back to its surface', () => {
    expect(surfaceForTab('budget')).toBe('spending');
    expect(surfaceForTab('investments')).toBe('wealth');
    expect(surfaceForTab('dashboard')).toBe('home');
  });
});

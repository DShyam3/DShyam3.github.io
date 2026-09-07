import { describe, expect, it } from 'vitest';
import { employerLogo } from './employer-logo';

describe('employerLogo', () => {
  it('matches a full name straight to its file', () => {
    expect(employerLogo('Keysight Technologies')).toBe('/org-logos/keysight-technologies.svg');
    expect(employerLogo('Ocean Infinity')).toBe('/org-logos/ocean-infinity.svg');
  });

  it('matches a short name through an alias', () => {
    expect(employerLogo('Keysight')).toBe('/org-logos/keysight-technologies.svg');
    expect(employerLogo('UCL')).toBe('/org-logos/university-college-london.png');
  });

  it('maps Capgemini to Airbus, which is a one-off for imported payslips', () => {
    expect(employerLogo('Capgemini')).toBe('/org-logos/airbus-defence-and-space.png');
  });

  it('tolerates a longer legal name', () => {
    expect(employerLogo('Keysight Technologies UK Ltd')).toBe('/org-logos/keysight-technologies.svg');
  });

  it('returns null rather than guessing', () => {
    expect(employerLogo('Some Company Nobody Has')).toBeNull();
    expect(employerLogo(undefined)).toBeNull();
    expect(employerLogo('')).toBeNull();
  });
});

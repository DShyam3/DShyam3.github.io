import { describe, expect, it } from 'vitest';
import { employerLogo } from './employer-logo';

const orgs = [
  { name: 'Acme Robotics', logoUrl: '/org-logos/acme-robotics.svg' },
  { name: 'Northwind Traders', logoUrl: '/org-logos/northwind-traders.png' },
  { name: 'Riverbend University', logoUrl: undefined },
];

describe('employerLogo', () => {
  it('matches a full name straight to its logo', () => {
    expect(employerLogo('Acme Robotics', orgs)).toBe('/org-logos/acme-robotics.svg');
    expect(employerLogo('Northwind Traders', orgs)).toBe('/org-logos/northwind-traders.png');
  });

  it('tolerates a longer legal name', () => {
    expect(employerLogo('Acme Robotics UK Ltd', orgs)).toBe('/org-logos/acme-robotics.svg');
  });

  it('matches a short name against a longer org name once it is long enough', () => {
    expect(employerLogo('Northwind', orgs)).toBe('/org-logos/northwind-traders.png');
  });

  it('does not match a short name that is too short to be confident', () => {
    expect(employerLogo('Nor', orgs)).toBeNull();
  });

  it('returns null when the org has no logo', () => {
    expect(employerLogo('Riverbend University', orgs)).toBeNull();
  });

  it('returns null rather than guessing', () => {
    expect(employerLogo('Some Company Nobody Has', orgs)).toBeNull();
    expect(employerLogo(undefined, orgs)).toBeNull();
    expect(employerLogo('', orgs)).toBeNull();
  });
  it('ignores an org whose name slugs to nothing, instead of matching everyone', () => {
    const withBlank = [{ name: '', logoUrl: '/blank.png' }, { name: '日本', logoUrl: '/kanji.png' }, ...orgs];
    expect(employerLogo('Some Company Nobody Has', withBlank)).toBeNull();
    expect(employerLogo('Acme Robotics', withBlank)).toBe('/org-logos/acme-robotics.svg');
  });

  it('compares prefixes on whole words', () => {
    expect(employerLogo('Armagh Council', [{ name: 'Arm', logoUrl: '/arm.svg' }])).toBeNull();
    expect(employerLogo('Arm Holdings', [{ name: 'Arm', logoUrl: '/arm.svg' }])).toBe('/arm.svg');
  });

  it('prefers the longest matching org', () => {
    const nested = [{ name: 'Acme', logoUrl: '/acme.svg' }, { name: 'Acme Robotics', logoUrl: '/acme-robotics.svg' }];
    expect(employerLogo('Acme Robotics UK Ltd', nested)).toBe('/acme-robotics.svg');
  });

  it('does not throw on a row missing its name', () => {
    const loose = [{ name: undefined as unknown as string, logoUrl: '/x.svg' }, ...orgs];
    expect(employerLogo('Acme Robotics', loose)).toBe('/org-logos/acme-robotics.svg');
  });

  it('matches camelCase and unspaced compound names against a spaced org name', () => {
    expect(employerLogo('AcmeRobotics', orgs)).toBe('/org-logos/acme-robotics.svg');
    expect(employerLogo('acmerobotics', orgs)).toBe('/org-logos/acme-robotics.svg');
  });

  it('matches an initialism of three or more letters against a multi-word org name', () => {
    const schools = [
      { name: 'University College London', logoUrl: '/org-logos/ucl.png' },
      { name: 'Royal College of Art', logoUrl: '/org-logos/rca.png' },
    ];
    expect(employerLogo('UCL', schools)).toBe('/org-logos/ucl.png');
    expect(employerLogo('RCA', schools)).toBe('/org-logos/rca.png');
  });

  it('matches an org via its configured aliases', () => {
    const withAliases = [
      { name: 'Apex Aerospace', aliases: ['Beacon Staffing'], logoUrl: '/org-logos/apex.png' },
    ];
    expect(employerLogo('Beacon Staffing', withAliases)).toBe('/org-logos/apex.png');
    expect(employerLogo('Beacon', withAliases)).toBe('/org-logos/apex.png');
  });

  it('prefers an employer name over another role sharing that name as an alias', () => {
    const rows = [
      { name: 'Apex Aerospace', aliases: ['Beacon Staffing'], logoUrl: '/apex.png' },
      { name: 'Beacon Staffing', logoUrl: '/beacon.png' },
    ];
    expect(employerLogo('Beacon Staffing', rows)).toBe('/beacon.png');
  });

  it('does not assign a shared payroll agency to an arbitrary employer', () => {
    const rows = [
      { name: 'Apex Aerospace', aliases: ['Beacon Staffing'], logoUrl: '/apex.png' },
      { name: 'Acme Robotics', aliases: ['Beacon Staffing'], logoUrl: '/acme.png' },
    ];
    expect(employerLogo('Beacon Staffing', rows)).toBeNull();
    expect(employerLogo('BeaconStaffing', [...rows].reverse())).toBeNull();
    expect(employerLogo('Beacon Staffing UK Ltd', rows)).toBeNull();
  });

  it('leaves ambiguous initials unmatched regardless of expansion length', () => {
    const rows = [
      { name: 'University College London', logoUrl: '/ucl.png' },
      { name: 'United Construction Limited', logoUrl: '/construction.png' },
    ];
    expect(employerLogo('UCL', rows)).toBeNull();
    expect(employerLogo('UCL', [...rows].reverse())).toBeNull();
  });

  it('accepts repeated roles with the same logo', () => {
    expect(employerLogo('UCL', [
      { name: 'University College London', logoUrl: '/ucl.png' },
      { name: 'University College London', logoUrl: '/ucl.png' },
    ])).toBe('/ucl.png');
  });
});

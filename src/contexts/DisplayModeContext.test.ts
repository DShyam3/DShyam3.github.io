import { describe, it, expect } from 'vitest';
import { parseStandaloneParam } from './DisplayModeContext';

describe('parseStandaloneParam', () => {
  it('parses truthy standalone query params', () => {
    expect(parseStandaloneParam('?standalone=1')).toBe(true);
    expect(parseStandaloneParam('?standalone=true')).toBe(true);
    expect(parseStandaloneParam('?standalone=')).toBe(true);
    expect(parseStandaloneParam('?foo=bar&standalone=1')).toBe(true);
  });

  it('parses falsy standalone query params', () => {
    expect(parseStandaloneParam('?standalone=0')).toBe(false);
    expect(parseStandaloneParam('?standalone=false')).toBe(false);
  });

  it('returns null when absent or unrecognised', () => {
    expect(parseStandaloneParam('')).toBeNull();
    expect(parseStandaloneParam('?tab=library')).toBeNull();
    expect(parseStandaloneParam('?standalone=maybe')).toBeNull();
  });
});

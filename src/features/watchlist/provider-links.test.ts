import { describe, it, expect } from 'vitest';
import { providerSearchUrl } from './provider-links';

describe('providerSearchUrl', () => {
  it('builds the Netflix search URL', () => {
    expect(providerSearchUrl('Netflix', 'Stranger Things')).toBe(
      'https://www.netflix.com/search?q=Stranger%20Things',
    );
  });

  it('builds the Prime Video search URL', () => {
    expect(providerSearchUrl('Prime Video', 'The Boys')).toBe(
      'https://www.amazon.co.uk/s?k=The%20Boys&i=instant-video',
    );
  });

  it('builds the Disney+ search URL', () => {
    expect(providerSearchUrl('Disney+', 'Loki')).toBe(
      'https://www.disneyplus.com/search?q=Loki',
    );
  });

  it('builds the Apple TV+ search URL', () => {
    expect(providerSearchUrl('Apple TV+', 'Severance')).toBe(
      'https://tv.apple.com/search?term=Severance',
    );
  });

  it('builds the BBC iPlayer search URL', () => {
    expect(providerSearchUrl('BBC iPlayer', 'Doctor Who')).toBe(
      'https://www.bbc.co.uk/iplayer/search?q=Doctor%20Who',
    );
  });

  it('builds the ITVX search URL', () => {
    expect(providerSearchUrl('ITVX', 'Endeavour')).toBe(
      'https://www.itv.com/search?query=Endeavour',
    );
  });

  it('returns null for a platform with no known search URL', () => {
    expect(providerSearchUrl('Hulu', 'Some Show')).toBe(null);
  });

  it('returns null for Online, which is not a real provider', () => {
    expect(providerSearchUrl('Online', 'Some Show')).toBe(null);
  });

  it('returns null when no platform is given', () => {
    expect(providerSearchUrl(undefined, 'Some Show')).toBe(null);
    expect(providerSearchUrl(null, 'Some Show')).toBe(null);
  });

  it('percent-encodes spaces, ampersands and colons in the title', () => {
    expect(providerSearchUrl('Netflix', 'Law & Order: SVU')).toBe(
      'https://www.netflix.com/search?q=Law%20%26%20Order%3A%20SVU',
    );
  });
});

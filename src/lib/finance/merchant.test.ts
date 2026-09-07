import { describe, expect, it } from 'vitest';
import {
  merchantHue,
  merchantInitials,
  merchantSlug,
  normaliseMerchant,
  resolveMerchant,
} from './merchant';

describe('normaliseMerchant', () => {
  it('drops store and till numbers, so branches share a key', () => {
    expect(normaliseMerchant('TESCO STORES 2891')).toBe('tesco stores');
    expect(normaliseMerchant('Tesco Stores')).toBe('tesco stores');
  });

  it('drops a payment-processor prefix', () => {
    expect(normaliseMerchant('PAYPAL *SPOTIFY')).toBe('spotify');
    expect(normaliseMerchant('SumUp *THE COFFEE HUT')).toBe('the coffee hut');
  });

  it('keeps a domain’s first label and drops the suffix', () => {
    expect(normaliseMerchant('Booking.com')).toBe('booking');
    expect(normaliseMerchant('APPLE.COM/BILL')).toBe('apple bill');
  });

  it('keeps digits that are part of a name', () => {
    expect(normaliseMerchant('O2 UK')).toBe('o2 uk');
  });

  it('keeps a possessive with its word', () => {
    expect(normaliseMerchant("McDonald's")).toBe('mcdonalds');
    expect(normaliseMerchant('Nando\u2019s')).toBe('nandos');
  });

  it('collapses punctuation and case', () => {
    expect(normaliseMerchant("  SAINSBURY'S   S/MKT ")).toBe('sainsburys s mkt');
  });
});

describe('merchantSlug', () => {
  it('hyphenates the normalised name', () => {
    expect(merchantSlug('TESCO STORES 2891')).toBe('tesco-stores');
  });
});

describe('merchantInitials', () => {
  it('gives one letter to a one-word name', () => {
    expect(merchantInitials('Tesco')).toBe('T');
  });

  it('gives two letters to a multi-word name', () => {
    expect(merchantInitials('John Lewis')).toBe('JL');
  });

  it('skips words that carry no identity', () => {
    expect(merchantInitials('Marks & Spencer')).toBe('MS');
    expect(merchantInitials('The Gym Group')).toBe('GG');
  });

  it('falls back to the raw words when everything is noise', () => {
    expect(merchantInitials('The Co Ltd')).toBe('TC');
  });

  it('answers for an empty name rather than throwing', () => {
    expect(merchantInitials('   ')).toBe('?');
  });
});

describe('merchantHue', () => {
  it('is stable for the same merchant', () => {
    expect(merchantHue('Tesco')).toBe(merchantHue('Tesco'));
  });

  it('ignores the noise the key strips', () => {
    expect(merchantHue('TESCO STORES 2891')).toBe(merchantHue('Tesco Stores'));
  });

  it('stays inside the colour wheel', () => {
    for (const name of ['a', 'Tesco', 'John Lewis', 'x'.repeat(200), '']) {
      const hue = merchantHue(name);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it('separates names a character sum would collide', () => {
    // Anagrams and one-letter neighbours are the cases a naive sum ruins.
    expect(merchantHue('ab')).not.toBe(merchantHue('ba'));
    expect(merchantHue('Costa')).not.toBe(merchantHue('Casto'));
  });
});

describe('resolveMerchant', () => {
  it('collapses aliases onto one slug, colour and label', () => {
    const a = resolveMerchant('AMZNMktplace');
    const b = resolveMerchant('AMAZON.CO.UK');
    expect(a.slug).toBe('amazon');
    expect(b.slug).toBe('amazon');
    expect(a.hue).toBe(b.hue);
    expect(a.label).toBe('Amazon');
  });

  it('prefers the brand’s own spelling for the label and initials', () => {
    const m = resolveMerchant('SAINSBURYS S/MKT');
    expect(m.label).toBe("Sainsbury's");
    expect(m.initials).toBe('S');
    expect(m.known).toBe(true);
  });

  it('still resolves a merchant nobody has catalogued', () => {
    const m = resolveMerchant('The Coffee Hut 44');
    expect(m.slug).toBe('the-coffee-hut');
    expect(m.label).toBe('The Coffee Hut 44');
    expect(m.initials).toBe('CH');
    expect(m.known).toBe(false);
  });
});

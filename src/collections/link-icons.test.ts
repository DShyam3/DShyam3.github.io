import { describe, expect, it } from 'vitest';
import { buildHighDpiFaviconUrl, isAppleHost, resolveLinkIcon } from './link-icons';

describe('link-icons', () => {
  it('recognizes Apple ecosystem hosts', () => {
    expect(isAppleHost('apps.apple.com')).toBe(true);
    expect(isAppleHost('developer.apple.com')).toBe(true);
    expect(isAppleHost('icloud.com')).toBe(true);
    expect(isAppleHost('figma.com')).toBe(false);
  });

  it('upgrades low-res Google S2 favicons to 256px Retina size', () => {
    const resolved = resolveLinkIcon(
      'https://www.google.com/s2/favicons?domain=figma.com&sz=64',
      'https://figma.com',
    );
    expect(resolved).toBe('https://www.google.com/s2/favicons?domain=figma.com&sz=256');
  });

  it('uses the crisp vector Apple mark for generic Apple domains', () => {
    const resolved = resolveLinkIcon(
      'https://www.google.com/s2/favicons?domain=apps.apple.com&sz=64',
      'https://apps.apple.com/gb/app/things-3/id904237743',
    );
    expect(resolved?.startsWith('data:image/svg+xml;utf8,')).toBe(true);
  });

  it('preserves custom uploaded or explicit app-artwork URLs untouched', () => {
    const custom = 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/icon-512x512bb.png';
    expect(resolveLinkIcon(custom, 'https://apps.apple.com/gb/app/id123')).toBe(custom);
  });

  it('derives a high-DPI icon when icon is null', () => {
    expect(resolveLinkIcon(null, 'https://raycast.com')).toBe(
      buildHighDpiFaviconUrl('raycast.com'),
    );
  });
});

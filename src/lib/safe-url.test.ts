import { describe, expect, it } from 'vitest';
import { safeHref } from './safe-url';

describe('safeHref', () => {
  it('keeps an absolute http, https or mailto link', () => {
    expect(safeHref('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeHref('http://example.com')).toBe('http://example.com/');
    expect(safeHref('mailto:someone@example.com')).toBe('mailto:someone@example.com');
    expect(safeHref('  https://example.com  ')).toBe('https://example.com/');
  });

  it('drops a script or data scheme, however it is cased or padded', () => {
    for (const bad of ['javascript:alert(1)', 'JavaScript:alert(1)', ' javascript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x']) {
      expect(safeHref(bad)).toBeUndefined();
    }
  });

  it('drops anything that is not an absolute URL', () => {
    for (const bad of [undefined, null, '', '   ', 'www.example.com', '/relative/path', 'not a url']) {
      expect(safeHref(bad)).toBeUndefined();
    }
  });
});

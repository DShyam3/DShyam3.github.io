import { describe, expect, it } from 'vitest';
import {
  FAILING_AFTER,
  STALE_AFTER_MS,
  failingLinks,
  failureReason,
  isFailing,
  overdueLinks,
  lastChecked,
  type LinkCheck,
} from './link-check';

const check = (fields: Partial<LinkCheck> = {}): LinkCheck => ({
  link_id: 'a',
  url: 'https://a.example',
  checked_at: '2026-11-25T04:40:00Z',
  check_status: 200,
  check_error: null,
  check_failures: 0,
  failing_since: null,
  ...fields,
});

describe('isFailing', () => {
  it('waits for three failed checks in a row', () => {
    expect(FAILING_AFTER).toBe(3);
    expect(isFailing(check({ check_failures: 0 }))).toBe(false);
    expect(isFailing(check({ check_failures: 2 }))).toBe(false);
    expect(isFailing(check({ check_failures: 3 }))).toBe(true);
    expect(isFailing(check({ check_failures: 40 }))).toBe(true);
  });
});

describe('failingLinks', () => {
  const added = '2026-11-01T00:00:00Z';
  const links = [
    { id: 'a', name: 'A', url: 'https://a.example', created_at: added },
    { id: 'b', name: 'B', url: 'https://b.example/new', created_at: added },
    { id: 'c', name: 'C', url: 'https://c.example', created_at: added },
    { id: 'd', name: 'D', url: 'https://d.example', created_at: added },
  ];

  it('pairs each failing link with its check, in the links order', () => {
    const checks = [
      check({ link_id: 'c', url: 'https://c.example', check_failures: 3, check_status: 404 }),
      check({ link_id: 'a', url: 'https://a.example', check_failures: 5, check_status: 503 }),
      check({ link_id: 'd', url: 'https://d.example', check_failures: 2 }),
    ];
    expect(failingLinks(links, checks).map(({ link, check: c }) => [link.id, c.check_status])).toEqual([
      ['a', 503],
      ['c', 404],
    ]);
  });

  it('ignores a result for a URL the link no longer has', () => {
    const checks = [check({ link_id: 'b', url: 'https://b.example/old', check_failures: 9 })];
    expect(failingLinks(links, checks)).toEqual([]);
  });

  it('ignores a result whose link is gone', () => {
    expect(failingLinks(links, [check({ link_id: 'z', check_failures: 9 })])).toEqual([]);
  });
});

describe('failureReason', () => {
  it('names the error when no response came back', () => {
    expect(failureReason(check({ check_error: 'dns' }))).toBe('Domain no longer resolves');
    expect(failureReason(check({ check_error: 'timeout' }))).toBe('No answer in time');
    expect(failureReason(check({ check_error: 'connection' }))).toBe('Could not connect');
    expect(failureReason(check({ check_error: 'too_many_redirects' }))).toBe('Too many redirects');
    expect(failureReason(check({ check_error: 'bad_url' }))).toBe('Not a web address the check can open');
    expect(failureReason(check({ check_error: 'blocked_address' }))).toBe('Points at a private network address');
  });

  it('falls back for an error it does not know, or no status', () => {
    expect(failureReason(check({ check_error: 'something_new' }))).toBe('Could not be checked');
    expect(failureReason(check({ check_status: null }))).toBe('Could not be checked');
  });

  it('describes the status otherwise', () => {
    expect(failureReason(check({ check_status: 404 }))).toBe('Page not found (404)');
    expect(failureReason(check({ check_status: 410 }))).toBe('Page removed (410)');
    expect(failureReason(check({ check_status: 503 }))).toBe('Server error (503)');
    expect(failureReason(check({ check_status: 400 }))).toBe('Refused (400)');
    expect(failureReason(check({ check_status: 302 }))).toBe('Redirect with no destination (302)');
  });
});

describe('lastChecked and overdueLinks', () => {
  const now = Date.parse('2026-11-25T12:00:00Z');
  const link = (id: string, created_at = '2026-11-01T00:00:00Z') => ({
    id, name: id.toUpperCase(), url: `https://${id}.example`, created_at,
  });

  it('lastChecked is the latest check', () => {
    expect(lastChecked([])).toBeNull();
    expect(
      lastChecked([
        check({ checked_at: '2026-11-24T04:40:02Z' }),
        check({ checked_at: '2026-11-25T04:40:09Z' }),
        check({ checked_at: '2026-11-25T04:40:01Z' }),
      ]),
    ).toBe('2026-11-25T04:40:09Z');
  });

  it('a link is overdue once two days pass without a check', () => {
    expect(STALE_AFTER_MS).toBe(2 * 24 * 60 * 60 * 1000);
    const links = [link('a'), link('b'), link('c')];
    const checks = [
      check({ link_id: 'a', checked_at: '2026-11-25T04:40:00Z' }),
      check({ link_id: 'b', checked_at: '2026-11-23T11:59:59Z' }),
      check({ link_id: 'c', checked_at: '2026-11-23T12:00:01Z' }),
    ];
    expect(overdueLinks(links, checks, now).map((l) => l.id)).toEqual(['b']);
  });

  it('a run that reaches only part of the list still shows the rest', () => {
    const links = [link('a'), link('b')];
    const checks = [check({ link_id: 'a', checked_at: '2026-11-25T04:40:00Z' })];
    expect(overdueLinks(links, checks, now).map((l) => l.id)).toEqual(['b']);
  });

  it('a link never checked counts from when it was added', () => {
    expect(overdueLinks([link('new', '2026-11-24T09:00:00Z')], [], now)).toEqual([]);
    expect(overdueLinks([link('old', '2026-11-20T09:00:00Z')], [], now).map((l) => l.id)).toEqual(['old']);
  });

  it('a link edited since its check still counts that check', () => {
    const edited = { ...link('a'), url: 'https://a.example/moved' };
    const checks = [check({ link_id: 'a', url: 'https://a.example', checked_at: '2026-11-25T04:40:00Z' })];
    expect(overdueLinks([edited], checks, now)).toEqual([]);
  });
});

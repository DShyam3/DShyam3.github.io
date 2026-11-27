import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const { CUTOUT_VERSION, MAX_SOURCE_LENGTH, RETRY_AFTER_MS, pendingJobs, plateProps, shownImageClass } = await import(
  './image-cache'
);
type Row = Parameters<typeof pendingJobs>[1] extends Map<string, infer R> ? R : never;

const NOW = Date.parse('2026-11-27T12:00:00Z');
const HASH = 'a'.repeat(64);

const row = (source: string, overrides: Partial<Row> = {}): Row => ({
  source_hash: HASH,
  source_url: source,
  storage_path: `${HASH}-${CUTOUT_VERSION}.webp`,
  transparent: true,
  tone: 'color',
  backdrop: '#ffffff',
  keep_background: false,
  failure: null,
  processed_at: new Date(NOW).toISOString(),
  ...overrides,
});

const job = (source: string) => ({ source, want: 'product' as const });
const index = (...rows: Row[]) => new Map(rows.map((r) => [r.source_url, r]));
const sources = (groups: { source: string }[][]) => groups.map((group) => group[0].source);

describe('pendingJobs', () => {
  it('queues a source with no copy, and not one with a current copy', () => {
    const groups = pendingJobs([job('https://a/1.jpg'), job('https://a/2.jpg')], index(row('https://a/2.jpg')), new Set(), NOW);
    expect(sources(groups)).toEqual(['https://a/1.jpg']);
  });

  it('redoes a copy made by an older cutout', () => {
    const old = row('https://a/1.jpg', { storage_path: `${HASH}-v0.webp` });
    expect(sources(pendingJobs([job('https://a/1.jpg')], index(old), new Set(), NOW))).toEqual(['https://a/1.jpg']);
  });

  it('leaves a recorded failure alone until it is a week old', () => {
    const failed = (age: number) =>
      row('https://a/1.jpg', { storage_path: null, failure: 'unreachable', processed_at: new Date(NOW - age).toISOString() });
    expect(pendingJobs([job('https://a/1.jpg')], index(failed(RETRY_AFTER_MS - 1)), new Set(), NOW)).toEqual([]);
    expect(pendingJobs([job('https://a/1.jpg')], index(failed(RETRY_AFTER_MS)), new Set(), NOW)).toHaveLength(1);
  });

  it('groups every record that shows the same picture, so a replacement reaches them all', () => {
    const groups = pendingJobs([job('https://a/1.jpg'), job('https://a/2.jpg'), job('https://a/1.jpg')], new Map(), new Set(), NOW);
    expect(groups.map((group) => group.length)).toEqual([2, 1]);
  });

  it('skips what was tried this visit and what the index cannot hold', () => {
    const long = `data:image/png;base64,${'A'.repeat(MAX_SOURCE_LENGTH)}`;
    const groups = pendingJobs([job('https://a/1.jpg'), job(long), job('https://a/2.jpg')], new Map(), new Set(['https://a/1.jpg']), NOW);
    expect(sources(groups)).toEqual(['https://a/2.jpg']);
  });
});

describe('how a copy sits on the card', () => {
  const shown = { tone: 'color' as const, transparent: true, stored: true, backdrop: '#ffffff' };

  it('gives a cut-out product a shadow and a one-colour logo the inverting class', () => {
    expect(shownImageClass(shown, false)).toContain('media-cutout');
    expect(shownImageClass({ ...shown, tone: 'dark' }, true)).toContain('logo-tone-dark');
  });

  it('rounds a logo that is its own square of colour, and leaves a kept product to its plate', () => {
    const square = { ...shown, transparent: false, backdrop: null };
    expect(shownImageClass(square, true)).toContain('rounded');
    expect(shownImageClass({ ...shown, transparent: false }, false)).toBeUndefined();
  });

  it('puts only a copy kept whole on a plate of its backdrop colour', () => {
    expect(plateProps({ transparent: false, backdrop: '#f5f5f7' })?.style).toEqual({ '--plate': '#f5f5f7' });
    expect(plateProps({ transparent: true, backdrop: '#ffffff' })).toBeUndefined();
    expect(plateProps({ transparent: false, backdrop: null })).toBeUndefined();
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const { metadataValues } = await import('./link-metadata');

describe('metadataValues', () => {
  it('takes the name and description of a page that was read', () => {
    expect(metadataValues({ ok: true, name: ' Figma ', description: 'Design tool' })).toEqual({
      name: 'Figma',
      description: 'Design tool',
    });
  });

  it('leaves out what the page did not declare', () => {
    expect(metadataValues({ ok: true, name: 'Hypertext', description: null })).toEqual({ name: 'Hypertext' });
    expect(metadataValues({ ok: true, name: '  ', description: 42 })).toEqual({});
  });

  it('is null when the page could not be read, or the answer is not one', () => {
    expect(metadataValues({ ok: false, reason: 'dns' })).toBeNull();
    expect(metadataValues(null)).toBeNull();
    expect(metadataValues('ok')).toBeNull();
  });

  it('carries nothing beyond the two fields', () => {
    expect(metadataValues({ ok: true, name: 'A', icon: 'https://evil.example/x.svg', category: 'x' })).toEqual({ name: 'A' });
  });
});

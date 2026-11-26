import { describe, expect, it } from 'vitest';
import { mergeFill } from './form-fill';

const URL_A = 'https://a.example';

describe('mergeFill', () => {
  it('fills empty fields', () => {
    const current = { url: URL_A, name: '', description: '  ' };
    expect(mergeFill(current, { name: 'A', description: 'About A' }, {}, 'url', URL_A).values).toEqual({
      url: URL_A,
      name: 'A',
      description: 'About A',
    });
  });

  it('never overwrites what the owner typed', () => {
    const current = { url: URL_A, name: 'My name', description: '' };
    const { values: next, owned } = mergeFill(current, { name: 'A', description: 'About A' }, {}, 'url', URL_A);
    expect(next.name).toBe('My name');
    expect(next.description).toBe('About A');
    // The owner's name is not the fill's, even later.
    expect(owned).toEqual({ description: 'About A' });
  });

  it("replaces an earlier fill's value, since the owner never chose it", () => {
    const current = { url: 'https://b.example', name: 'A', description: 'About A' };
    const earlier = { name: 'A', description: 'About A' };
    expect(
      mergeFill(current, { name: 'B', description: 'About B' }, earlier, 'url', 'https://b.example').values,
    ).toEqual({ url: 'https://b.example', name: 'B', description: 'About B' });
  });

  it("clears an earlier fill's value that the new page does not give, or when the read failed", () => {
    const current = { url: 'https://b.example', name: 'A', description: 'About A' };
    const earlier = { name: 'A', description: 'About A' };
    expect(mergeFill(current, { name: 'B' }, earlier, 'url', 'https://b.example').values).toEqual({
      url: 'https://b.example',
      name: 'B',
      description: '',
    });
    expect(mergeFill(current, {}, earlier, 'url', 'https://b.example').values).toEqual({
      url: 'https://b.example',
      name: '',
      description: '',
    });
  });

  it("does not count the owner's value as the fill's when the page agrees with it", () => {
    const current = { url: URL_A, name: 'Figma' };
    expect(mergeFill(current, { name: 'Figma' }, {}, 'url', URL_A).owned).toEqual({});
  });

  it('keeps an earlier fill the owner has since edited', () => {
    const current = { url: 'https://b.example', name: 'A, edited', description: '' };
    expect(mergeFill(current, { name: 'B' }, { name: 'A' }, 'url', 'https://b.example').values.name).toBe('A, edited');
  });

  it('drops an answer for a URL the form no longer holds', () => {
    const current = { url: 'https://changed.example', name: '' };
    expect(mergeFill(current, { name: 'A' }, {}, 'url', URL_A).values).toBe(current);
  });

  it('ignores empty values and the source field itself, and returns the same object when nothing changes', () => {
    const current = { url: `  ${URL_A} `, name: '' };
    expect(mergeFill(current, { name: '', url: 'https://other.example' }, {}, 'url', URL_A).values).toBe(current);
  });
});

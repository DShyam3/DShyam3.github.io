import { describe, expect, it } from 'vitest';
import { looksLikeSpecs, parseSpecPrice, parseSpecs, specsPriceTotal } from './inventory-specs';

const BUILD = [
  '- CPU: [AMD Ryzen 7 9800X3D](https://example.com/cpu) (£449.99)',
  '- GPU: [MSI GeForce RTX 5080](https://example.com/gpu) (£1,179.90)',
  '- Case: Fractal North',
].join('\n');

describe('parseSpecs', () => {
  it('splits label, linked part and trailing price', () => {
    const [cpu, gpu, pcCase] = parseSpecs(BUILD);
    expect(cpu).toEqual({
      label: 'CPU',
      value: [{ text: 'AMD Ryzen 7 9800X3D', href: 'https://example.com/cpu' }],
      price: '£449.99',
    });
    expect(gpu.price).toBe('£1,179.90');
    expect(pcCase).toEqual({ label: 'Case', value: [{ text: 'Fractal North' }], price: null });
  });

  it('does not mistake the colon inside a link for a label', () => {
    const [line] = parseSpecs('[Keyboard](https://example.com/kb)');
    expect(line.label).toBeNull();
    expect(line.value).toEqual([{ text: 'Keyboard', href: 'https://example.com/kb' }]);
  });
});

describe('looksLikeSpecs', () => {
  it('recognises a build list and leaves a paragraph alone', () => {
    expect(looksLikeSpecs(BUILD)).toBe(true);
    expect(looksLikeSpecs('A lovely jacket I bought in Kyoto.')).toBe(false);
  });
});

describe('prices', () => {
  it('reads a price with thousands separators', () => {
    expect(parseSpecPrice('£1,179.90')).toEqual({ symbol: '£', pence: 117990 });
  });

  it('adds the priced lines in pence, so the total does not drift', () => {
    expect(specsPriceTotal(parseSpecs(BUILD))).toEqual({ symbol: '£', amount: 1629.89 });
    const tenths = parseSpecs(['A: x (£0.10)', 'B: y (£0.20)'].join('\n'));
    expect(specsPriceTotal(tenths)).toEqual({ symbol: '£', amount: 0.3 });
  });

  it('gives no total across currencies, rather than adding pounds to dollars', () => {
    expect(specsPriceTotal(parseSpecs('A: x (£10.00)\nB: y ($5)'))).toBeNull();
  });

  it('is null when no line carries a price', () => {
    expect(specsPriceTotal(parseSpecs('Colour: Black\nSize: M'))).toBeNull();
  });
});

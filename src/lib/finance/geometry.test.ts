import { describe, expect, it } from 'vitest';
import { describeArc, polarToCartesian } from './geometry';

describe('polarToCartesian', () => {
  it('places 0 degrees due right of centre', () => {
    const { x, y } = polarToCartesian(0, 0, 10, 0);
    expect(x).toBeCloseTo(10);
    expect(y).toBeCloseTo(0);
  });

  it('places 90 degrees below centre, as SVG measures it', () => {
    const { x, y } = polarToCartesian(0, 0, 10, 90);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(10);
  });

  it('offsets by the centre point', () => {
    const { x, y } = polarToCartesian(72, 72, 54, 180);
    expect(x).toBeCloseTo(18);
    expect(y).toBeCloseTo(72);
  });
});

describe('describeArc', () => {
  it('clears the large-arc flag at or below 180 degrees', () => {
    expect(describeArc(0, 0, 10, 0, 180)).toContain('A 10 10 0 0 1');
  });

  it('sets the large-arc flag above 180 degrees', () => {
    expect(describeArc(0, 0, 10, 0, 200)).toContain('A 10 10 0 1 1');
  });

  it('starts with a move to the arc start', () => {
    expect(describeArc(0, 0, 10, 0, 90).startsWith('M 10 0')).toBe(true);
  });
});

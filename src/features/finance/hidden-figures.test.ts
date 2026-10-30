import { describe, expect, it } from 'vitest';
import { figureSpans } from './hidden-figures';

const figures = (text: string) => figureSpans(text).map(([start, end]) => text.slice(start, end));

describe('figureSpans', () => {
  it('finds a formatted figure and nothing around it', () => {
    expect(figureSpans('Income £4,231.18 this month')).toEqual([[7, 16]]);
  });

  it('takes a touching sign with the figure, either side of the pound sign', () => {
    expect(figures('Spent −£1,204.00')).toEqual(['−£1,204.00']);
    expect(figures('+£300 a month')).toEqual(['+£300']);
    expect(figures('£-500')).toEqual(['£-500']);
  });

  it('covers the compact axis forms', () => {
    expect(figures('£500k £1.2K £3m £2bn')).toEqual(['£500k', '£1.2K', '£3m', '£2bn']);
  });

  it('stops at punctuation that is not a thousands group', () => {
    expect(figures('Spent £1,204, 12% more')).toEqual(['£1,204']);
    expect(figures('£1,000–£2,000')).toEqual(['£1,000', '£2,000']);
  });

  it('leaves text without a pound figure alone', () => {
    expect(figureSpans('Amount (£)')).toEqual([]);
    expect(figureSpans('12% in 2026')).toEqual([]);
    expect(figureSpans('Rent - pay £ later')).toEqual([]);
  });
});

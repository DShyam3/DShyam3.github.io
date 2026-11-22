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

  /* An animated figure's shadow root spells each digit as a column of all ten
     numerals behind the pound sign; useHiddenFigures relies on that still
     reading as a figure. */
  it('reads an animated figure, digit columns and all', () => {
    expect(figureSpans('£0123456789,012345678901234567890123456789.01234567890123456789')).not.toEqual([]);
    expect(figureSpans('£-0123456789.01234567890123456789')).not.toEqual([]);
    expect(figureSpans('01234567890123456789%')).toEqual([]);
  });

  it('leaves text without a pound figure alone', () => {
    expect(figureSpans('Amount (£)')).toEqual([]);
    expect(figureSpans('12% in 2026')).toEqual([]);
    expect(figureSpans('Rent - pay £ later')).toEqual([]);
  });
});

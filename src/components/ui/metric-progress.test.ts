import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MetricProgress } from './metric-progress';

const render = (value: number, target: number, intent: 'goal' | 'budget' | 'repayment' = 'goal') =>
  renderToStaticMarkup(createElement(MetricProgress, { label: 'Test amount', value, target, valueText: `£${value} of £${target}`, intent }));

describe('accessible progress states', () => {
  it('preserves overspending in text while keeping the meter in range', () => {
    const markup = render(120, 100, 'budget');
    expect(markup).toContain('aria-valuenow="100"');
    expect(markup).toContain('£120 of £100. Over budget');
  });
  it('distinguishes a missing target from a completed goal', () => {
    expect(render(0, 0)).toContain('No target set');
    expect(render(100, 100)).toContain('Completed');
  });
  it('announces spending without any budget as over budget', () => {
    expect(render(25, 0, 'budget')).toContain('Over budget');
  });
  it('marks zero debt repaid rather than not started', () => {
    expect(render(0, 100, 'repayment')).toContain('Repaid');
    expect(render(20, 100, 'repayment')).toContain('Outstanding balance');
  });
  it('keeps invalid or negative values out of the meter range', () => {
    expect(render(-20, 100)).toContain('aria-valuenow="0"');
    expect(render(Number.NaN, 100)).toContain('aria-valuenow="0"');
    expect(render(10, Number.POSITIVE_INFINITY)).toContain('No target set');
  });
});

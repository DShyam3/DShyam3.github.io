import * as React from 'react';
import NumberFlow, { type Format } from '@number-flow/react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface AnimatedNumberProps {
  value: number;
  format?: Format;
  locales?: Intl.LocalesArgument;
  prefix?: string;
  suffix?: string;
  className?: string;
  /**
   * Optional trend direction:
   *  1 = always roll up, -1 = always roll down, 0 = each digit independent.
   */
  trend?: 1 | 0 | -1;
}

/**
 * Value-driven animated figure powered by `@number-flow/react`.
 *
 * Follows `DESIGN_SYSTEM.md`:
 * - Enforces `tabular-nums` so surrounding layout never jitters as digits spin.
 * - Honours `prefers-reduced-motion` (falls back to an instant tabular update).
 * - Only animates when `value` actually changes (no idling telemetry).
 */
export function AnimatedNumber({
  value,
  format,
  locales = 'en-GB',
  prefix,
  suffix,
  className,
  trend,
}: AnimatedNumberProps) {
  const prefersReducedMotion = useReducedMotion();

  if (!Number.isFinite(value)) {
    return (
      <span className={cn('tabular-nums', className)}>
        {prefix}—{suffix}
      </span>
    );
  }

  return (
    <NumberFlow
      value={value}
      locales={locales}
      format={format}
      prefix={prefix}
      suffix={suffix}
      trend={trend}
      animated={!prefersReducedMotion}
      respectMotionPreference
      className={cn('tabular-nums', className)}
    />
  );
}

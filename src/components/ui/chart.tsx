import * as React from 'react';
import * as RechartsPrimitive from 'recharts';
import { cn } from '@/lib/utils';

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
    /** CSS color token, e.g. `hsl(var(--chart-1))` or `hsl(var(--positive))`. */
    color?: string;
  }
>;

interface ChartContextValue {
  config: ChartConfig;
}

const ChartContext = React.createContext<ChartContextValue | null>(null);

export function useChart(): ChartContextValue {
  const ctx = React.useContext(ChartContext);
  if (!ctx) {
    throw new Error('useChart must be used within a <ChartContainer />');
  }
  return ctx;
}

/**
 * Sovereign Folio chart wrapper (shadcn/ui Charts pattern).
 *
 * Injects `--color-<key>` CSS variables from `config`, enforces Space Mono
 * tabular axis labels and muted hairline gridlines, and wraps Recharts
 * `ResponsiveContainer`.
 */
export const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'];
  }
>(({ id, className, children, config, style, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`;

  const colorVars = React.useMemo(() => {
    const vars: Record<string, string> = {};
    for (const [key, entry] of Object.entries(config)) {
      if (entry.color) {
        vars[`--color-${key}`] = entry.color;
      }
    }
    return vars;
  }, [config]);

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={ref}
        data-chart={chartId}
        style={{ ...colorVars, ...style } as React.CSSProperties}
        className={cn(
          'flex aspect-video w-full justify-center font-mono text-xs tabular-nums',
          '[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground',
          '[&_.recharts-cartesian-grid_line]:stroke-border/50',
          '[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border',
          '[&_.recharts-dot[stroke="#fff"]]:stroke-transparent',
          '[&_.recharts-layer]:outline-none',
          '[&_.recharts-polar-grid_[stroke="#ccc"]]:stroke-border/50',
          '[&_.recharts-radial-bar-background-sector]:fill-muted/40',
          '[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/35',
          '[&_.recharts-reference-line_[stroke="#ccc"]]:stroke-border',
          '[&_.recharts-sector[stroke="#fff"]]:stroke-transparent',
          '[&_.recharts-sector]:outline-none',
          '[&_.recharts-surface]:outline-none',
          className,
        )}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = 'ChartContainer';

export const ChartTooltip = RechartsPrimitive.Tooltip;

export interface ChartTooltipPayloadItem {
  name?: string | number;
  dataKey?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipContentProps extends React.ComponentProps<'div'> {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: React.ReactNode;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: 'dot' | 'line' | 'dashed';
  labelFormatter?: (label: React.ReactNode, payload: ChartTooltipPayloadItem[]) => React.ReactNode;
  valueFormatter?: (value: number | string, name: string, item: ChartTooltipPayloadItem) => React.ReactNode;
}

/**
 * Sovereign Folio frosted Recharts tooltip with Space Mono tabular numerals.
 */
export const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  (
    {
      active,
      payload,
      className,
      indicator = 'dot',
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      valueFormatter,
      ...props
    },
    ref,
  ) => {
    const { config } = useChart();

    if (!active || !payload?.length) {
      return null;
    }

    const formattedLabel = labelFormatter ? labelFormatter(label, payload) : label;

    return (
      <div
        ref={ref}
        className={cn(
          'grid min-w-[9rem] items-start gap-1.5 rounded-lg border border-border/75 bg-popover/95 px-3 py-2 font-mono text-xs text-popover-foreground shadow-lg tabular-nums',
          className,
        )}
        {...props}
      >
        {!hideLabel && formattedLabel != null && (
          <div className="border-b border-border/50 pb-1 font-semibold text-foreground">
            {formattedLabel}
          </div>
        )}
        <div className="grid gap-1">
          {payload.map((item, idx) => {
            const key = String(item.dataKey ?? item.name ?? idx);
            const itemConfig = config[key] ?? config[String(item.name ?? '')];
            const displayLabel = itemConfig?.label ?? item.name ?? key;
            const indicatorColor =
              itemConfig?.color ??
              item.color ??
              (typeof item.payload?.fill === 'string' ? item.payload.fill : 'hsl(var(--primary))');
            const displayValue =
              item.value === undefined
                ? '—'
                : valueFormatter
                  ? valueFormatter(item.value, String(displayLabel), item)
                  : typeof item.value === 'number'
                    ? item.value.toLocaleString('en-GB')
                    : item.value;

            return (
              <div key={`${key}-${idx}`} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  {!hideIndicator && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'shrink-0',
                        indicator === 'dot' && 'h-2 w-2 rounded-full',
                        indicator === 'line' && 'h-2.5 w-1 rounded-full',
                        indicator === 'dashed' && 'h-0 w-3 border-t-2 border-dashed',
                      )}
                      style={
                        indicator === 'dashed'
                          ? { borderColor: indicatorColor }
                          : { backgroundColor: indicatorColor }
                      }
                    />
                  )}
                  <span className="truncate">{displayLabel}</span>
                </div>
                <span className="font-semibold text-foreground tabular-nums">{displayValue}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
ChartTooltipContent.displayName = 'ChartTooltipContent';

export const ChartLegend = RechartsPrimitive.Legend;

export interface ChartLegendContentProps extends React.ComponentProps<'div'> {
  payload?: Array<{
    value?: string;
    dataKey?: string | number;
    color?: string;
  }>;
  hideIcon?: boolean;
}

export const ChartLegendContent = React.forwardRef<HTMLDivElement, ChartLegendContentProps>(
  ({ className, payload, hideIcon = false, ...props }, ref) => {
    const { config } = useChart();

    if (!payload?.length) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-2 font-mono text-xs text-muted-foreground',
          className,
        )}
        {...props}
      >
        {payload.map((item, idx) => {
          const key = String(item.dataKey ?? item.value ?? idx);
          const itemConfig = config[key] ?? config[String(item.value ?? '')];
          const color = itemConfig?.color ?? item.color ?? 'hsl(var(--primary))';

          return (
            <div key={`${key}-${idx}`} className="flex items-center gap-1.5">
              {!hideIcon && (
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
              )}
              <span>{itemConfig?.label ?? item.value}</span>
            </div>
          );
        })}
      </div>
    );
  },
);
ChartLegendContent.displayName = 'ChartLegendContent';

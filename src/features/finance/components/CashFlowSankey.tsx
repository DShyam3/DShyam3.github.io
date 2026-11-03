/**
 * Where the period's money went: income sources into spending categories.
 *
 * Draws the graph `cashFlowSankey` builds and nothing more -- every node and
 * link value comes from lib/finance/cash-flow, which reads the same months as
 * the Cash Flow headline, so the diagram and the totals above it always agree.
 *
 * Identity never rests on colour. Every node carries its name and amount
 * directly, money in sits on the left and money out on the right, and "From
 * balances" is hatched as well as red, because red against green alone does
 * not separate for a deuteranope. The same figures are in the table view,
 * which is the whole view below tablet width.
 */

import { useId } from 'react';
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts';
import { Card } from '@/components/ui/card';
import { formatGBP } from '@/features/finance/utils/calculations';
import type { CashFlowSankey as CashFlowSankeyGraph, CashFlowSankeyNode, CashFlowSankeyNodeKind } from '@/lib/finance/cash-flow';

const TONE: Record<CashFlowSankeyNodeKind, string> = {
  source: 'hsl(var(--positive))',
  kept: 'hsl(var(--positive))',
  drawn: 'hsl(var(--destructive))',
  hub: 'hsl(var(--foreground))',
  category: 'hsl(var(--muted-foreground))',
};

const LABEL_MAX = 22;
const ROW_HEIGHT = 48;

const shorten = (label: string) => (label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX - 1)}…` : label);

/* Recharts hands the renderers its own layout objects; these are the fields
   read from them. `payload` on a node is the node passed in, plus layout. */
interface LaidOutNode extends CashFlowSankeyNode { name: string }

interface NodeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: LaidOutNode;
}

interface LinkProps {
  sourceX: number;
  sourceY: number;
  sourceControlX: number;
  targetX: number;
  targetY: number;
  targetControlX: number;
  linkWidth: number;
  payload: { source: LaidOutNode; target: LaidOutNode; value: number };
}

/** The side of the flow a link belongs to decides its tone. */
const linkKind = (link: LinkProps['payload']): CashFlowSankeyNodeKind =>
  link.source.kind === 'hub' ? link.target.kind : link.source.kind;

type GradientStop = { color: string; opacity: number };

/** Each solid link fades from the tone it leaves to the tone it reaches. "From balances" is hatched instead. */
const LINK_GRADIENT: Record<Exclude<CashFlowSankeyNodeKind, 'drawn'>, [GradientStop, GradientStop]> = {
  source: [{ color: TONE.source, opacity: 0.38 }, { color: TONE.hub, opacity: 0.22 }],
  kept: [{ color: TONE.hub, opacity: 0.25 }, { color: TONE.kept, opacity: 0.38 }],
  category: [{ color: TONE.hub, opacity: 0.2 }, { color: TONE.category, opacity: 0.12 }],
  // `linkKind` takes the far end of a hub link, so no link resolves to the
  // hub itself; the entry is there because the type allows it.
  hub: [{ color: TONE.hub, opacity: 0.2 }, { color: TONE.hub, opacity: 0.12 }],
};

function FlowTable({ graph }: { graph: CashFlowSankeyGraph }) {
  const into = graph.nodes.filter(n => n.kind === 'source' || n.kind === 'drawn');
  const out = graph.nodes.filter(n => n.kind === 'category' || n.kind === 'kept');
  const rows = (nodes: CashFlowSankeyNode[]) => nodes.map(node => (
    <tr key={node.id} className="border-t border-border/20">
      <td className="py-1.5 pr-3 text-foreground break-words">{node.label}</td>
      <td className="py-1.5 text-right tabular-nums text-foreground">{formatGBP(node.amount)}</td>
    </tr>
  ));
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <table className="w-full text-xs font-mono">
        <caption className="pb-1 text-left text-muted-foreground">Money in · {formatGBP(Math.max(graph.income, graph.spend))}</caption>
        <tbody>{rows(into)}</tbody>
      </table>
      <table className="w-full text-xs font-mono">
        <caption className="pb-1 text-left text-muted-foreground">Money out · {formatGBP(Math.max(graph.income, graph.spend))}</caption>
        <tbody>{rows(out)}</tbody>
      </table>
    </div>
  );
}

export function CashFlowSankey({ sankey, loading }: { sankey: CashFlowSankeyGraph | null; loading?: boolean }) {
  const instanceId = useId().replace(/:/g, '');
  const hatchId = `cf-hatch-${instanceId}`;
  const gradPrefix = `cf-grad-${instanceId}`;

  const fillFor = (kind: CashFlowSankeyNodeKind) => (kind === 'drawn' ? `url(#${hatchId})` : TONE[kind]);

  const renderNode = ({ x, y, width, height, payload }: NodeProps) => {
    const onLeft = payload.kind === 'source' || payload.kind === 'drawn';
    const isHub = payload.kind === 'hub';
    const minHeight = 8;
    const nodeHeight = Math.max(height, minHeight);
    const adjustedY = height < minHeight ? y - (minHeight - height) / 2 : y;

    const labelX = isHub ? x + width / 2 : onLeft ? x - 10 : x + width + 10;
    const labelY = isHub ? y - 10 : y + height / 2;

    return (
      <g>
        {/* Recharts renders no children but its Tooltip, so the hatch is
            defined beside the one node that uses it. The link finds it by id. */}
        {payload.kind === 'drawn' && (
          <defs>
            <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={TONE.drawn} fillOpacity={0.35} />
              <line x1="0" y1="0" x2="0" y2="6" stroke={TONE.drawn} strokeWidth="3" />
            </pattern>
          </defs>
        )}
        <rect
          x={x}
          y={adjustedY}
          width={width}
          height={nodeHeight}
          rx={3}
          fill={fillFor(payload.kind)}
          stroke={payload.kind === 'drawn' ? TONE.drawn : undefined}
          className="transition-opacity hover:opacity-80"
        />
        <text
          x={labelX}
          y={labelY}
          textAnchor={isHub ? 'middle' : onLeft ? 'end' : 'start'}
          className="font-mono select-none"
        >
          <title>{`${payload.label}: ${formatGBP(payload.amount)}`}</title>
          {/* Name above amount, both at the 12px floor: the amount is a
              value, so it never drops below the label naming it. */}
          <tspan
            x={labelX}
            dy={isHub ? '-0.9em' : '-0.3em'}
            fill={isHub ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))'}
            fontSize={12}
            fontWeight={isHub ? 600 : 500}
          >
            {isHub ? payload.label : shorten(payload.label)}
          </tspan>
          <tspan
            x={labelX}
            dy="1.35em"
            fill={isHub ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'}
            fontSize={12}
            fontWeight={isHub ? 700 : undefined}
            className="tabular-nums"
          >
            {formatGBP(payload.amount)}
          </tspan>
        </text>
      </g>
    );
  };

  const renderLink = ({ sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX, linkWidth, payload }: LinkProps) => {
    const kind = linkKind(payload);
    const d = `M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;
    const strokeWidth = Math.max(linkWidth, 2);

    // "From balances" keeps the hatch: a gradient would leave it told apart
    // by red alone, which a deuteranope cannot separate from green.
    if (kind === 'drawn') {
      return (
        <path
          d={d}
          fill="none"
          stroke={fillFor(kind)}
          strokeWidth={strokeWidth}
          strokeOpacity={0.45}
          className="transition-opacity duration-150 opacity-90 hover:opacity-100"
        />
      );
    }

    // Scoped by this instance's id, as the hatch is, so two diagrams on one
    // page cannot pick up each other's gradients.
    const gradId = `${gradPrefix}-${payload.source.id}-${payload.target.id}`.replace(/[^a-zA-Z0-9-_]/g, '_');
    const [from, to] = LINK_GRADIENT[kind];
    return (
      <g>
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
            <stop offset="0%" stopColor={from.color} stopOpacity={from.opacity} />
            <stop offset="100%" stopColor={to.color} stopOpacity={to.opacity} />
          </linearGradient>
        </defs>
        <path
          d={d}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          className="transition-opacity duration-150 opacity-90 hover:opacity-100"
        />
      </g>
    );
  };

  const leftCount = sankey ? sankey.nodes.filter(n => n.kind === 'source' || n.kind === 'drawn').length : 0;
  const rightCount = sankey ? sankey.nodes.filter(n => n.kind === 'category' || n.kind === 'kept').length : 0;
  const height = Math.max(260, Math.max(leftCount, rightCount) * ROW_HEIGHT + 48);

  return (
    <Card className="rounded-lg border border-border/40 bg-card/50 p-5 hover:border-border/80 transition-colors space-y-4 font-mono">
      <div className="min-w-0">
        <h3 className="text-xs uppercase tracking-wider font-semibold text-foreground">Where it went</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Income into spending over the selected period. Money moved between your own accounts is left out.
        </p>
      </div>

      {loading ? (
        <div className="h-60 rounded-lg bg-muted/30 animate-pulse" aria-hidden />
      ) : !sankey ? (
        <p className="text-xs text-muted-foreground">No income or spending recorded in this period.</p>
      ) : (
        <>
          <div className="hidden md:block" role="img" aria-label={`Income of ${formatGBP(sankey.income)} flowing into spending of ${formatGBP(sankey.spend)}. The same figures are in the table below.`}>
            <ResponsiveContainer width="100%" height={height}>
              <Sankey
                data={{ nodes: sankey.nodes.map(n => ({ ...n, name: n.label })), links: sankey.links }}
                nameKey="name"
                sort={false}
                nodeWidth={8}
                nodePadding={28}
                linkCurvature={0.5}
                iterations={0}
                margin={{ top: 40, right: 180, bottom: 16, left: 180 }}
                node={renderNode as never}
                link={renderLink as never}
              >
                <Tooltip
                  cursor={false}
                  content={({ payload }) => {
                    const item = payload?.[0]?.payload?.payload as
                      | (LinkProps['payload'] & Partial<LaidOutNode>)
                      | LaidOutNode
                      | undefined;
                    if (!item) return null;
                    const isLink = 'source' in item && typeof item.source === 'object';
                    const label = isLink
                      ? `${(item as LinkProps['payload']).source.label} → ${(item as LinkProps['payload']).target.label}`
                      : (item as LaidOutNode).label;
                    const value = isLink ? (item as LinkProps['payload']).value : (item as LaidOutNode).amount;
                    return (
                      <div className="rounded-lg border border-border/40 bg-card px-3 py-2 font-mono text-xs shadow-sm">
                        <div className="font-bold tabular-nums text-foreground">{formatGBP(value)}</div>
                        <div className="text-muted-foreground">{label}</div>
                      </div>
                    );
                  }}
                />
              </Sankey>
            </ResponsiveContainer>
          </div>

          <div className="md:hidden">
            <FlowTable graph={sankey} />
          </div>
          <details className="hidden md:block">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Show as a table</summary>
            <div className="pt-3">
              <FlowTable graph={sankey} />
            </div>
          </details>
        </>
      )}
    </Card>
  );
}

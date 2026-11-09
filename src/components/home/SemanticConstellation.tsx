import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Sparkles, Compass, Cpu, BookOpen, Briefcase, ShieldCheck } from 'lucide-react';
import type { WorkspaceInspectorTarget } from '@/contexts/WorkspaceInspectorContext';

export type ClusterColorVar = '--primary' | '--sky' | '--peach' | '--lavender';

export interface SemanticClusterNode {
  id: string;
  code: string;
  label: string;
  shortLabel: string;
  colorVar: ClusterColorVar;
  coords: [number, number, number];
  radius: number;
  inspector: WorkspaceInspectorTarget;
}

export interface SemanticConstellationCounts {
  countriesText: string;
  citiesText: string;
  inventoryText: string;
  collectionsText: string;
  milestonesText: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildSemanticClusters(
  counts: SemanticConstellationCounts,
): SemanticClusterNode[] {
  return [
    {
      id: 'cluster-home',
      code: '01',
      label: 'Home / Identity',
      shortLabel: 'Identity',
      colorVar: '--primary',
      coords: [0, 0.08, 0.12],
      radius: 7.5,
      inspector: {
        id: 'cluster-home',
        eyebrow: 'Cluster 01 · Core Node',
        title: 'Personal Index & Architecture',
        summary:
          'Root node of the personal operating system. Connects spatial logs, hardware inventory, reading archives, career milestones, and the deterministic ledger.',
        rows: [
          { label: 'Node ID', value: '01 · HOME-ROOT', tone: 'accent' },
          { label: 'Location', value: 'London, United Kingdom' },
          { label: 'Collections', value: counts.collectionsText },
          { label: 'Time kind', value: 'Point-in-time + Historical' },
        ],
        backlinks: [
          {
            id: 'bl-home-travel',
            code: 'TRV',
            label: `Global Travel Atlas (${counts.countriesText})`,
            to: '/travel',
            meta: 'Spatial',
          },
          {
            id: 'bl-home-inv',
            code: 'INV',
            label: 'Hardware & Everyday Carry',
            to: '/inventory',
            meta: counts.inventoryText,
          },
          {
            id: 'bl-home-books',
            code: 'BKS',
            label: 'Reading Library & Watchlist',
            to: '/books',
            meta: 'Archive',
          },
        ],
        primaryAction: { label: 'Explore Travel Atlas', to: '/travel' },
        secondaryAction: { label: 'Browse Inventory', to: '/inventory' },
      },
    },
    {
      id: 'cluster-travel',
      code: '02',
      label: `Travel · ${counts.countriesText}`,
      shortLabel: `Travel (${counts.countriesText})`,
      colorVar: '--sky',
      coords: [-0.62, 0.34, 0.38],
      radius: 6.5,
      inspector: {
        id: 'cluster-travel',
        eyebrow: 'Cluster 02 · Spatial Atlas',
        title: `Travel · ${counts.countriesText} & ${counts.citiesText}`,
        summary:
          'Interactive dot-matrix world projection tracking sovereign countries, territories, and city hubs across continents.',
        rows: [
          {
            label: 'Coverage',
            value: `${counts.countriesText} · ${counts.citiesText}`,
            tone: 'sky',
          },
          { label: 'Source', value: 'visited_countries · visited_cities' },
          { label: 'Time kind', value: 'Historical log' },
          { label: 'Projection', value: 'Deterministic dot-matrix' },
        ],
        backlinks: [
          {
            id: 'bl-trv-photos',
            code: 'PHO',
            label: 'Field Photography Archive',
            to: '/photos',
            meta: 'Visual notes',
          },
          {
            id: 'bl-trv-inv',
            code: 'INV',
            label: 'Travel & Camera Carry Rig',
            to: '/inventory',
            meta: counts.inventoryText,
          },
        ],
        primaryAction: { label: 'Open Travel Atlas', to: '/travel' },
        secondaryAction: { label: 'View Field Photos', to: '/photos' },
      },
    },
    {
      id: 'cluster-inventory',
      code: '03',
      label: `Inventory · ${counts.inventoryText}`,
      shortLabel: `Inventory (${counts.inventoryText})`,
      colorVar: '--peach',
      coords: [0.66, 0.28, -0.25],
      radius: 6,
      inspector: {
        id: 'cluster-inventory',
        eyebrow: 'Cluster 03 · Hardware Registry',
        title: 'Everyday Carry & Desk Hardware',
        summary:
          'Catalogued tools, computing hardware, audio gear, and field instruments with specifications and acquisition provenance.',
        rows: [
          { label: 'Active items', value: counts.inventoryText, tone: 'amber' },
          { label: 'Categories', value: 'Computing · Audio · EDC · Optics' },
          { label: 'Time kind', value: 'Point-in-time' },
        ],
        backlinks: [
          {
            id: 'bl-inv-travel',
            code: 'TRV',
            label: `Field Tested Across ${counts.countriesText}`,
            to: '/travel',
            meta: 'Atlas',
          },
          {
            id: 'bl-inv-links',
            code: 'LNK',
            label: 'Saved References & Tooling',
            to: '/links',
            meta: 'Links',
          },
        ],
        primaryAction: { label: 'Open Inventory', to: '/inventory' },
        secondaryAction: { label: 'Saved Links', to: '/links' },
      },
    },
    {
      id: 'cluster-library',
      code: '04',
      label: `Library · ${counts.collectionsText}`,
      shortLabel: 'Library',
      colorVar: '--lavender',
      coords: [-0.48, -0.46, -0.36],
      radius: 6,
      inspector: {
        id: 'cluster-library',
        eyebrow: 'Cluster 04 · Cultural Archive',
        title: 'Books, Articles, Thoughts & Watchlist',
        summary:
          'Long-form reading notes, essays, distilled beliefs, and film/series tracking synchronised with release schedules.',
        rows: [
          { label: 'Collections', value: counts.collectionsText, tone: 'accent' },
          { label: 'Notes stream', value: 'Thoughts · Beliefs · Inspiration' },
          { label: 'Time kind', value: 'Curated archive' },
        ],
        backlinks: [
          {
            id: 'bl-lib-books',
            code: 'BKS',
            label: 'Reading Library & Notes',
            to: '/books',
            meta: 'Books',
          },
          {
            id: 'bl-lib-watchlist',
            code: 'WTC',
            label: 'Watchlist Radar & Library',
            to: '/watchlist',
            meta: 'Film & TV',
          },
          {
            id: 'bl-lib-articles',
            code: 'ART',
            label: 'Long-Form Articles',
            to: '/articles',
            meta: 'Essays',
          },
        ],
        primaryAction: { label: 'Open Books', to: '/books' },
        secondaryAction: { label: 'Open Watchlist', to: '/watchlist' },
      },
    },
    {
      id: 'cluster-experience',
      code: '05',
      label: `Experience · ${counts.milestonesText}`,
      shortLabel: 'Experience',
      colorVar: '--primary',
      coords: [0.46, -0.44, 0.42],
      radius: 6,
      inspector: {
        id: 'cluster-experience',
        eyebrow: 'Cluster 05 · Career Timeline',
        title: 'Engineering Experience & Education',
        summary:
          'Chronological record of software engineering roles, academic degrees, and downloadable curriculum vitae.',
        rows: [
          { label: 'Milestones', value: counts.milestonesText, tone: 'accent' },
          { label: 'Source', value: 'experience · education · cv.pdf' },
          { label: 'Format', value: 'Structured timeline + PDF' },
          { label: 'Time kind', value: 'Chronological' },
        ],
        backlinks: [
          {
            id: 'bl-exp-thoughts',
            code: 'THO',
            label: 'Engineering Notes & Thoughts',
            to: '/thoughts',
            meta: 'Stream',
          },
          {
            id: 'bl-exp-beliefs',
            code: 'BLF',
            label: 'Operating Principles & Beliefs',
            to: '/beliefs',
            meta: 'Principles',
          },
        ],
        primaryAction: { label: 'Read Thoughts', to: '/thoughts' },
        secondaryAction: { label: 'View Beliefs', to: '/beliefs' },
      },
    },
    {
      id: 'cluster-treasury',
      code: '06',
      label: 'Treasury · Pure Ledger',
      shortLabel: 'Treasury',
      colorVar: '--peach',
      coords: [0.06, 0.64, -0.48],
      radius: 5.5,
      inspector: {
        id: 'cluster-treasury',
        eyebrow: 'Cluster 06 · Deterministic Finance',
        title: 'Treasury · Pure Calculation Modules',
        summary:
          'Anchored balances, UK tax bands, cash-flow projections, and merchant normalization computed 100% locally in TypeScript.',
        rows: [
          { label: 'Engine', value: 'src/lib/finance/* (pure functions)', tone: 'amber' },
          { label: 'AI Boundary', value: 'Never computes · Allowlist only', tone: 'accent' },
          { label: 'Access', value: 'Admin RLS gated' },
        ],
        backlinks: [
          {
            id: 'bl-fin-route',
            code: 'FIN',
            label: 'Open Treasury Workspace',
            to: '/finance',
            meta: 'Ledger',
          },
          {
            id: 'bl-fin-inv',
            code: 'INV',
            label: 'Physical Asset Inventory',
            to: '/inventory',
            meta: counts.inventoryText,
          },
        ],
        primaryAction: { label: 'Open Finance', to: '/finance' },
        secondaryAction: { label: 'Browse Inventory', to: '/inventory' },
      },
    },
  ];
}

interface AmbientParticle {
  coords: [number, number, number];
  clusterIndex: number;
  size: number;
  alpha: number;
}

const BASE_COORDS: [number, number, number][] = [
  [0, 0.08, 0.12],
  [-0.62, 0.34, 0.38],
  [0.66, 0.28, -0.25],
  [-0.48, -0.46, -0.36],
  [0.46, -0.44, 0.42],
  [0.06, 0.64, -0.48],
];

const AMBIENT_PARTICLES: AmbientParticle[] = Array.from({ length: 68 }, (_, idx) => {
  const clusterIndex = idx % BASE_COORDS.length;
  const base = BASE_COORDS[clusterIndex];
  const goldenAngle = idx * 2.399963229728653;
  const spread = 0.14 + ((idx * 17) % 19) * 0.011;
  const dx = Math.cos(goldenAngle) * spread;
  const dy = Math.sin(goldenAngle) * spread;
  const dz = (((idx * 31) % 23) / 23 - 0.5) * spread * 1.4;
  return {
    coords: [base[0] + dx, base[1] + dy, base[2] + dz],
    clusterIndex,
    size: idx % 5 === 0 ? 2.1 : 1.35,
    alpha: 0.25 + ((idx * 13) % 10) * 0.04,
  };
});

const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
  [1, 2],
  [1, 3],
  [2, 5],
  [3, 4],
  [4, 5],
];

interface ProjectedCluster {
  cluster: SemanticClusterNode;
  x: number;
  y: number;
  z: number;
  scale: number;
}

interface SemanticConstellationProps {
  clusters: SemanticClusterNode[];
  selectedClusterId: string;
  onSelectCluster: (cluster: SemanticClusterNode) => void;
}

export function SemanticConstellation({
  clusters,
  selectedClusterId,
  onSelectCluster,
}: SemanticConstellationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const projectedNodesRef = useRef<ProjectedCluster[]>([]);
  const rotationRef = useRef({ yaw: 0.42, pitch: -0.22 });
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    startYaw: number;
    startPitch: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    startYaw: 0.42,
    startPitch: -0.22,
  });

  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  const [isPaused, setIsPaused] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const projectPoint = useCallback(
    (
      coords: [number, number, number],
      width: number,
      height: number,
      yaw: number,
      pitch: number,
    ) => {
      const [x0, y0, z0] = coords;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const x1 = x0 * cosY - z0 * sinY;
      const z1 = z0 * cosY + x0 * sinY;

      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const y2 = y0 * cosP - z1 * sinP;
      const z2 = z1 * cosP + y0 * sinP;

      const radius = Math.min(width, height) * 0.42;
      const perspective = 2.6 / (2.6 - z2 * 0.75);
      return {
        x: width * 0.5 + x1 * radius * perspective,
        y: height * 0.5 + y2 * radius * perspective,
        z: z2,
        scale: perspective,
      };
    },
    [],
  );

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const styles = getComputedStyle(document.documentElement);
    const readHsl = (varName: string, alpha?: number) => {
      const raw = styles.getPropertyValue(varName).trim();
      if (!raw) return alpha !== undefined ? `rgba(128, 128, 128, ${alpha})` : 'rgb(128, 128, 128)';
      return alpha !== undefined ? `hsl(${raw} / ${alpha})` : `hsl(${raw})`;
    };

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    // Subtle radial coordinate rings using theme tokens
    const cx = width * 0.5;
    const cy = height * 0.5;
    const baseR = Math.min(width, height) * 0.36;

    ctx.strokeStyle = readHsl('--muted-foreground', 0.14);
    ctx.lineWidth = 1;
    [0.45, 0.78, 1.08].forEach((mult) => {
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * mult, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx - baseR * 1.18, cy);
    ctx.lineTo(cx + baseR * 1.18, cy);
    ctx.moveTo(cx, cy - baseR * 1.18);
    ctx.lineTo(cx, cy + baseR * 1.18);
    ctx.strokeStyle = readHsl('--muted-foreground', 0.08);
    ctx.stroke();

    const { yaw, pitch } = rotationRef.current;

    // Project major clusters
    const projectedClusters: ProjectedCluster[] = clusters.map((cluster) => {
      const p = projectPoint(cluster.coords, width, height, yaw, pitch);
      return {
        cluster,
        x: p.x,
        y: p.y,
        z: p.z,
        scale: p.scale,
      };
    });
    projectedNodesRef.current = projectedClusters;

    // Draw edges between clusters
    EDGES.forEach(([aIdx, bIdx]) => {
      const a = projectedClusters[aIdx];
      const b = projectedClusters[bIdx];
      if (!a || !b) return;
      const isHighlighted =
        a.cluster.id === selectedClusterId ||
        b.cluster.id === selectedClusterId ||
        a.cluster.id === hoveredId ||
        b.cluster.id === hoveredId;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = isHighlighted
        ? readHsl('--primary', 0.45)
        : readHsl('--muted-foreground', 0.18);
      ctx.lineWidth = isHighlighted ? 1.35 : 0.85;
      ctx.stroke();
    });

    // Draw ambient particles
    AMBIENT_PARTICLES.forEach((pt) => {
      const p = projectPoint(pt.coords, width, height, yaw, pitch);
      const cluster = clusters[pt.clusterIndex];
      if (!cluster) return;
      const activeCluster = cluster.id === selectedClusterId;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pt.size * p.scale, 0, Math.PI * 2);
      ctx.fillStyle = readHsl(cluster.colorVar);
      ctx.globalAlpha = activeCluster
        ? Math.min(0.85, pt.alpha * 1.7)
        : pt.alpha * 0.75;
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Sort clusters back-to-front for clean overlap
    const sorted = [...projectedClusters].sort((a, b) => a.z - b.z);

    sorted.forEach(({ cluster, x, y, scale }) => {
      const isSelected = cluster.id === selectedClusterId;
      const isHovered = cluster.id === hoveredId;
      const nodeRadius = cluster.radius * scale * (isSelected ? 1.22 : isHovered ? 1.12 : 1);
      const clusterColor = readHsl(cluster.colorVar);

      // Outer halo for selected / hovered cluster
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, nodeRadius + 7, 0, Math.PI * 2);
        ctx.strokeStyle = clusterColor;
        ctx.globalAlpha = isSelected ? 0.55 : 0.3;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, y, nodeRadius + 13, 0, Math.PI * 2);
        ctx.strokeStyle = clusterColor;
        ctx.globalAlpha = isSelected ? 0.22 : 0.12;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Node core
      ctx.beginPath();
      ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
      ctx.fillStyle = clusterColor;
      ctx.fill();

      // Inner pip for core identity
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.8, nodeRadius * 0.38), 0, Math.PI * 2);
      ctx.fillStyle = readHsl('--card');
      ctx.fill();

      // Callout label (12px minimum per DESIGN_SYSTEM.md)
      ctx.font = `${isSelected ? '600' : '500'} 12px "Space Mono", monospace`;
      const text = `${cluster.code} ${cluster.shortLabel}`;
      const labelX = x + nodeRadius + 7;
      const labelY = y + 4;

      ctx.fillStyle = readHsl('--card', 0.86);
      const metrics = ctx.measureText(text);
      ctx.fillRect(labelX - 4, labelY - 11, metrics.width + 8, 16);

      ctx.fillStyle = isSelected
        ? readHsl('--foreground')
        : isHovered
          ? clusterColor
          : readHsl('--foreground', 0.88);
      ctx.fillText(text, labelX, labelY);
    });

    ctx.restore();
  }, [clusters, hoveredId, projectPoint, selectedClusterId]);

  useEffect(() => {
    let rafId = 0;
    const shouldAnimate = !reducedMotion && !isPaused;

    const tick = () => {
      if (!dragRef.current.active && shouldAnimate) {
        rotationRef.current.yaw += 0.0032;
      }
      renderFrame();
      if (shouldAnimate) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    renderFrame();
    if (shouldAnimate) {
      rafId = window.requestAnimationFrame(tick);
    }

    const handleResize = () => renderFrame();
    window.addEventListener('resize', handleResize);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isPaused, reducedMotion, renderFrame]);

  const findNearestCluster = (clientX: number, clientY: number): SemanticClusterNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    let closest: SemanticClusterNode | null = null;
    let minDist = 28;

    for (const item of projectedNodesRef.current) {
      const dist = Math.hypot(item.x - x, item.y - y);
      if (dist < minDist) {
        minDist = dist;
        closest = item.cluster;
      }
    }
    return closest;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      startYaw: rotationRef.current.yaw,
      startPitch: rotationRef.current.pitch,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current.active) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.hypot(dx, dy) > 4) {
        dragRef.current.moved = true;
      }
      rotationRef.current.yaw = dragRef.current.startYaw + dx * 0.0075;
      rotationRef.current.pitch = Math.max(
        -0.85,
        Math.min(0.85, dragRef.current.startPitch + dy * 0.0075),
      );
      renderFrame();
      return;
    }

    const hit = findNearestCluster(e.clientX, e.clientY);
    setHoveredId(hit ? hit.id : null);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasMoved = dragRef.current.moved;
    dragRef.current.active = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    if (!wasMoved) {
      const hit = findNearestCluster(e.clientX, e.clientY);
      if (hit) {
        onSelectCluster(hit);
      }
    }
  };

  const getClusterIcon = useMemo(
    () => (id: string) => {
      switch (id) {
        case 'cluster-home':
          return Sparkles;
        case 'cluster-travel':
          return Compass;
        case 'cluster-inventory':
          return Cpu;
        case 'cluster-library':
          return BookOpen;
        case 'cluster-experience':
          return Briefcase;
        default:
          return ShieldCheck;
      }
    },
    [],
  );

  return (
    <div className="home-constellation-card hud-corners">
      <div className="home-constellation-hud">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0 bg-primary"
            aria-hidden="true"
          />
          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground truncate">
            SEMANTIC INDEX · {clusters.length} CLUSTERS
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsPaused((prev) => !prev)}
          className="home-constellation-orbit-btn"
          aria-pressed={isPaused || reducedMotion}
          aria-label={isPaused || reducedMotion ? 'Resume constellation orbit' : 'Pause constellation orbit'}
        >
          {isPaused || reducedMotion ? (
            <>
              <Play className="h-3 w-3" />
              <span>Orbit</span>
            </>
          ) : (
            <>
              <Pause className="h-3 w-3" />
              <span>Pause</span>
            </>
          )}
        </button>
      </div>

      <div className="home-constellation-stage">
        <canvas
          ref={canvasRef}
          className="home-constellation-canvas"
          aria-label="Interactive 3D semantic constellation of personal site clusters. Drag to rotate or select a cluster pill below."
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            dragRef.current.active = false;
            setHoveredId(null);
          }}
        />
      </div>

      <div
        className="home-constellation-pills"
        role="group"
        aria-label="Semantic cluster nodes"
      >
        {clusters.map((cluster) => {
          const active = cluster.id === selectedClusterId;
          const Icon = getClusterIcon(cluster.id);
          return (
            <button
              key={cluster.id}
              type="button"
              onClick={() => onSelectCluster(cluster)}
              aria-pressed={active}
              className={`home-cluster-pill ${active ? 'home-cluster-pill--active' : ''}`}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: `hsl(var(${cluster.colorVar}))` }}
                aria-hidden="true"
              />
              <Icon className="h-3 w-3 shrink-0 opacity-75" aria-hidden="true" />
              <span className="truncate">{cluster.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

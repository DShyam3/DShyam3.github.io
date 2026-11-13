import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Sparkles, Compass, Cpu, BookOpen, Briefcase, ShieldCheck } from 'lucide-react';
import type { WorkspaceInspectorTarget } from '@/contexts/WorkspaceInspectorContext';

export type ClusterColorVar = '--primary' | '--sky' | '--peach' | '--lavender';

export interface SemanticClusterNode {
  id: string;
  code: string;
  /**
   * The section's name and nothing else. Its figures live once, on the fact
   * cards below; repeating them here put every count on the page twice.
   */
  label: string;
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

/**
 * The site's sections as constellation nodes. Each inspector row is a count
 * read from data; a section with nothing to count has no rows.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function buildSemanticClusters(
  counts: SemanticConstellationCounts,
): SemanticClusterNode[] {
  return [
    {
      id: 'cluster-home',
      code: '01',
      label: 'Home',
      colorVar: '--primary',
      coords: [0, 0.08, 0.12],
      radius: 7.5,
      inspector: {
        id: 'cluster-home',
        eyebrow: 'Section 01',
        title: 'Home',
        summary: 'Biography, experience, education and the sections of this site.',
        rows: [{ label: 'Collections', value: counts.collectionsText, tone: 'accent' }],
        primaryAction: { label: 'Open Travel', to: '/travel' },
        secondaryAction: { label: 'Open Inventory', to: '/inventory' },
      },
    },
    {
      id: 'cluster-travel',
      code: '02',
      label: 'Travel',
      colorVar: '--sky',
      coords: [-0.62, 0.34, 0.38],
      radius: 6.5,
      inspector: {
        id: 'cluster-travel',
        eyebrow: 'Section 02',
        title: 'Travel',
        summary: 'Countries and cities visited, drawn on a dot-matrix globe.',
        rows: [
          { label: 'Countries', value: counts.countriesText, tone: 'sky' },
          { label: 'Cities', value: counts.citiesText },
        ],
        primaryAction: { label: 'Open Travel', to: '/travel' },
      },
    },
    {
      id: 'cluster-inventory',
      code: '03',
      label: 'Inventory',
      colorVar: '--peach',
      coords: [0.66, 0.28, -0.25],
      radius: 6,
      inspector: {
        id: 'cluster-inventory',
        eyebrow: 'Section 03',
        title: 'Inventory',
        summary: 'Everyday carry, desk and camera gear.',
        rows: [{ label: 'Items', value: counts.inventoryText, tone: 'amber' }],
        primaryAction: { label: 'Open Inventory', to: '/inventory' },
      },
    },
    {
      id: 'cluster-library',
      code: '04',
      label: 'Library',
      colorVar: '--lavender',
      coords: [-0.48, -0.46, -0.36],
      radius: 6,
      inspector: {
        id: 'cluster-library',
        eyebrow: 'Section 04',
        title: 'Library',
        summary: 'Books, articles, thoughts and the film and series watchlist.',
        rows: [{ label: 'Collections', value: counts.collectionsText, tone: 'accent' }],
        primaryAction: { label: 'Open Books', to: '/books' },
        secondaryAction: { label: 'Open Watchlist', to: '/watchlist' },
      },
    },
    {
      id: 'cluster-experience',
      code: '05',
      label: 'Experience',
      colorVar: '--primary',
      coords: [0.46, -0.44, 0.42],
      radius: 6,
      inspector: {
        id: 'cluster-experience',
        eyebrow: 'Section 05',
        title: 'Experience & Education',
        summary: 'Roles and degrees in one timeline, with the CV to download.',
        rows: [{ label: 'Milestones', value: counts.milestonesText, tone: 'accent' }],
      },
    },
    {
      id: 'cluster-treasury',
      code: '06',
      label: 'Finance',
      colorVar: '--peach',
      coords: [0.06, 0.64, -0.48],
      radius: 5.5,
      inspector: {
        id: 'cluster-treasury',
        eyebrow: 'Section 06',
        title: 'Finance',
        summary: 'Balances, budgets and tax figures, computed from recorded rows.',
        rows: [],
        primaryAction: { label: 'Open Finance', to: '/finance' },
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

// Home links to every section. No line joins two sections, because nothing
// stores a relationship between them.
const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 5],
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
      const text = `${cluster.code} ${cluster.label}`;
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
            SITE INDEX · {clusters.length} SECTIONS
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
          aria-label="Interactive 3D map of the site's sections. Drag to rotate, or select a section below."
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
        aria-label="Site sections"
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

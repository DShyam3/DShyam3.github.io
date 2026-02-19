import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Globe, Map as MapIcon } from 'lucide-react';
import './DotMatrixGlobe.css';

export interface CountryRegion {
    code: string;
}

interface DotData {
    cols: number;
    rows: number;
    dots: [number, number, string][]; // [col, row, countryCode]
}

interface DotMatrixGlobeProps {
    visitedCountryCodes: string[];
    size?: number;
    className?: string;
    onCountryHover?: (code: string | null, name: string | null, flagUrl: string | null) => void;
}

// Cache the loaded dot data globally so it's only fetched once
let cachedDotData: DotData | null = null;

// Country name lookup - loaded from REST Countries API
let cachedCountryNames: Record<string, string> = {};

async function loadDotData(): Promise<DotData> {
    if (cachedDotData) return cachedDotData;
    const res = await fetch('/data/dot-world-map.json');
    cachedDotData = await res.json();
    return cachedDotData!;
}

async function loadCountryNames(): Promise<Record<string, string>> {
    if (Object.keys(cachedCountryNames).length > 0) return cachedCountryNames;
    try {
        const res = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2');
        const data = await res.json();
        const names: Record<string, string> = {};
        for (const c of data) {
            names[c.cca2] = c.name.common;
        }
        cachedCountryNames = names;
    } catch {
        // fallback: empty, codes will be shown instead
    }
    return cachedCountryNames;
}

export function DotMatrixGlobe({
    visitedCountryCodes,
    size = 800,
    className = '',
    onCountryHover,
}: DotMatrixGlobeProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dotData, setDotData] = useState<DotData | null>(null);
    const [countryNames, setCountryNames] = useState<Record<string, string>>({});
    const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
    const visitedSet = useMemo(() => new Set(visitedCountryCodes), [visitedCountryCodes]);
    const [mode, setMode] = useState<'2d' | '3d'>('3d');

    // Drag to rotate state
    const dragRef = useRef({
        isDragging: false,
        lastX: 0,
        lastY: 0,
        velocityX: 0,
        offsetLat: 0, // up/down rotation offset for manual drag
        lastInteractionTime: 0,
    });
    const animRef = useRef({
        progress: 0,
        rotation: 0,
        lastTime: performance.now(),
    });
    const requestRef = useRef<number>();

    interface ProjectedDot {
        x: number;
        y: number;
        r: number;
        code: string;
        isBack: boolean;
        opacity: number;
    }
    const projectedDotsRef = useRef<ProjectedDot[]>([]);

    // Load data
    useEffect(() => {
        Promise.all([loadDotData(), loadCountryNames()]).then(([dots, names]) => {
            setDotData(dots);
            setCountryNames(names);
        });
    }, []);

    // Draw the map
    const draw = useCallback((time: number) => {
        const canvas = canvasRef.current;
        if (!canvas || !dotData) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dt = Math.min(time - animRef.current.lastTime, 100);
        animRef.current.lastTime = time;

        const target = mode === '3d' ? 1 : 0;
        const speed = 0.002; // transition speed
        if (animRef.current.progress < target) {
            animRef.current.progress = Math.min(target, animRef.current.progress + dt * speed);
        } else if (animRef.current.progress > target) {
            animRef.current.progress = Math.max(target, animRef.current.progress - dt * speed);
        }

        if (animRef.current.progress > 0) {
            // Apply momentum / velocity if not dragging
            if (!dragRef.current.isDragging) {
                if (Math.abs(dragRef.current.velocityX) > 0.0001) {
                    animRef.current.rotation += dragRef.current.velocityX;
                    dragRef.current.velocityX *= 0.95; // friction
                } else if (time - dragRef.current.lastInteractionTime > 2500) {
                    // Constant slow spin resumes after 2.5s of inactivity
                    animRef.current.rotation += dt * 0.00015 * animRef.current.progress;

                    // Spring back latitude offset towards 0 gently
                    if (Math.abs(dragRef.current.offsetLat) > 0.001) {
                        dragRef.current.offsetLat *= 0.985;
                    } else {
                        dragRef.current.offsetLat = 0;
                    }
                }
            }
        }
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.offsetWidth;
        const H = canvas.offsetHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, W, H);

        const { cols, rows, dots } = dotData;
        const dotSpacingX = W / cols;
        const dotSpacingY = H / rows;
        const baseRadius = Math.min(dotSpacingX, dotSpacingY) * 0.38;

        const isDark = document.documentElement.classList.contains('dark');
        const R = Math.min(W, H) * 0.45;
        const { progress, rotation } = animRef.current;

        const cosRot = Math.cos(rotation);
        const sinRot = Math.sin(rotation);
        const cosLatOffset = Math.cos(dragRef.current.offsetLat);
        const sinLatOffset = Math.sin(dragRef.current.offsetLat);

        const newProjected: ProjectedDot[] = [];
        const backDots: ProjectedDot[] = [];
        const frontDots: ProjectedDot[] = [];

        for (const [col, row, code] of dots) {
            const cx2d = (col + 0.5) * dotSpacingX;
            const cy2d = (row + 0.5) * dotSpacingY;

            let cx = cx2d;
            let cy = cy2d;
            let zNorm = 1;
            let isBack = false;

            if (progress > 0) {
                const lon = (col / cols) * 2 * Math.PI - Math.PI;
                const lat = Math.PI / 2 - (row / rows) * Math.PI;

                const x3d = R * Math.cos(lat) * Math.sin(lon);
                const y3d = -R * Math.sin(lat);
                const z3d = R * Math.cos(lat) * Math.cos(lon);

                // 1. Rotation around Y axis (longitude scroll)
                let x_rot = x3d * cosRot - z3d * sinRot;
                let z_rot = x3d * sinRot + z3d * cosRot;
                let y_rot = y3d;

                // 2. Rotation around X axis (latitude tilt from manual drag)
                // y' = y*cos(theta) - z*sin(theta)
                // z' = y*sin(theta) + z*cos(theta)
                const y_tilt = y_rot * cosLatOffset - z_rot * sinLatOffset;
                const z_tilt = y_rot * sinLatOffset + z_rot * cosLatOffset;
                y_rot = y_tilt;
                z_rot = z_tilt;

                const cx3d = W / 2 + x_rot;
                const cy3d = H / 2 + y_rot;

                cx = cx2d * (1 - progress) + cx3d * progress;
                cy = cy2d * (1 - progress) + cy3d * progress;
                zNorm = z_rot / R;
                isBack = z_rot < 0;
            }

            const activeRadius = baseRadius * (1 * (1 - progress) + Math.max(0.4, 0.6 + 0.4 * zNorm) * progress);
            const activeOpacity = 1 * (1 - progress) + Math.max(0.1, 0.45 + 0.55 * zNorm) * progress;

            const pDot: ProjectedDot = {
                x: cx, y: cy,
                r: activeRadius,
                code,
                isBack,
                opacity: activeOpacity
            };

            newProjected.push(pDot);
            if (isBack && progress > 0.5) {
                backDots.push(pDot);
            } else {
                frontDots.push(pDot);
            }
        }

        projectedDotsRef.current = newProjected;

        const drawDot = (p: ProjectedDot) => {
            const isVisited = visitedSet.has(p.code);
            const isHovered = p.code === hoveredCountry;

            let color: string;
            let r = p.r;

            if (isVisited && isHovered) {
                color = 'rgba(255, 200, 50, 1)';
                r *= 1.4;
            } else if (isVisited) {
                color = 'rgba(218, 165, 32, 0.95)';
                r *= 1.2;
            } else if (isHovered) {
                color = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(60, 80, 140, 0.8)';
                r *= 1.2;
            } else {
                color = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(50, 70, 130, 0.25)';
            }

            ctx.globalAlpha = p.opacity;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        };

        for (const p of backDots) drawDot(p);
        for (const p of frontDots) drawDot(p);

        if (progress > 0 || animRef.current.progress !== target) {
            requestRef.current = requestAnimationFrame((t) => draw(t));
        }

    }, [dotData, visitedSet, hoveredCountry, mode]);

    // Force animation loop restart when dependencies change
    useEffect(() => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        requestRef.current = requestAnimationFrame((t) => {
            animRef.current.lastTime = t;
            draw(t);
        });
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [draw]);

    // Handle resize
    useEffect(() => {
        const observer = new ResizeObserver(() => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            requestRef.current = requestAnimationFrame((t) => draw(t));
        });
        if (canvasRef.current) observer.observe(canvasRef.current);
        return () => observer.disconnect();
    }, [draw]);

    // Mouse events
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (mode !== '3d' || !dotData) return;
        dragRef.current.isDragging = true;
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
        dragRef.current.velocityX = 0;
        dragRef.current.lastInteractionTime = performance.now();
    }, [mode, dotData]);

    const handleMouseUp = useCallback(() => {
        dragRef.current.isDragging = false;
        dragRef.current.lastInteractionTime = performance.now();
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current || !projectedDotsRef.current.length) return;

        // Handle dragging map
        if (dragRef.current.isDragging && mode === '3d') {
            dragRef.current.lastInteractionTime = performance.now();
            const dx = e.clientX - dragRef.current.lastX;
            const dy = e.clientY - dragRef.current.lastY;
            dragRef.current.lastX = e.clientX;
            dragRef.current.lastY = e.clientY;

            // Update rotation instantly (inverted dx)
            const rotDelta = -dx * 0.005;
            animRef.current.rotation += rotDelta;
            dragRef.current.velocityX = rotDelta; // Save for momentum

            // Update latitude tilt (inverted dy), limit range so we don't go upside down
            dragRef.current.offsetLat -= dy * 0.005;
            dragRef.current.offsetLat = Math.max(-1.2, Math.min(1.2, dragRef.current.offsetLat));

            // Re-draw immediately without waiting for hover logic frame
            // but still do hover logic!
        }

        const rect = canvasRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        let bestDist = Infinity;
        let found: string | null = null;
        const { progress } = animRef.current;

        for (const p of projectedDotsRef.current) {
            if (p.isBack && progress > 0.5) continue;

            // Fast boundary check before square distance
            if (Math.abs(mx - p.x) > p.r * 3 || Math.abs(my - p.y) > p.r * 3) continue;

            const dist = Math.sqrt((mx - p.x) ** 2 + (my - p.y) ** 2);
            if (dist < p.r * 2.5 && dist < bestDist) {
                bestDist = dist;
                found = p.code;
            }
        }

        if (found !== hoveredCountry) {
            setHoveredCountry(found);
            const flagUrl = found ? `https://flagcdn.com/w80/${found.toLowerCase()}.png` : null;
            onCountryHover?.(found, found ? (countryNames[found] ?? found) : null, flagUrl);
        }
    }, [hoveredCountry, countryNames, onCountryHover, mode]);

    const handleMouseLeave = useCallback(() => {
        setHoveredCountry(null);
        onCountryHover?.(null, null, null);
        dragRef.current.isDragging = false;
    }, [onCountryHover]);



    return (
        <div
            className={`dot-matrix-map-container ${className}`}
            style={{ width: '100%', aspectRatio: `${dotData?.cols ?? 168} / ${dotData?.rows ?? 84}` }}
        >
            {!dotData && (
                <div className="dot-matrix-loading">
                    <div className="dot-matrix-loading-dots">
                        <span /><span /><span />
                    </div>
                </div>
            )}
            <canvas
                ref={canvasRef}
                className="dot-matrix-map-canvas"
                style={{ width: '100%', height: '100%', cursor: dragRef.current.isDragging ? 'grabbing' : (hoveredCountry ? 'crosshair' : (mode === '3d' ? 'grab' : 'default')) }}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            />
            {dotData && (
                <button
                    onClick={() => setMode(m => m === '2d' ? '3d' : '2d')}
                    className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/50 shadow-sm hover:bg-muted text-xs font-semibold tracking-wider text-muted-foreground transition-all duration-300 pointer-events-auto"
                    aria-label="Toggle 3D View"
                >
                    {mode === '2d' ? <Globe className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                    {mode === '2d' ? '3D Globe' : '2D Map'}
                </button>
            )}
        </div>
    );
}

export type { DotMatrixGlobeProps };


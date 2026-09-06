import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Globe, Map as MapIcon } from 'lucide-react';
import { ASSETS_URL } from '@/lib/constants';
import {
    FLAT_PROJECTIONS,
    FLAT_PROJECTION_ORDER,
    type FlatProjection,
} from '@/lib/mapProjections';

// The flat map morphs between exactly two projections -- the one the UN
// replaced and the one it adopted -- so the toggle has two sides and the
// dots carry a position for each. A third would mean choosing which pair to
// morph between; two does not.
const [PROJECTION_A, PROJECTION_B] = FLAT_PROJECTION_ORDER;
const SPEC_A = FLAT_PROJECTIONS[PROJECTION_A];
const SPEC_B = FLAT_PROJECTIONS[PROJECTION_B];

// Removed d3-geo and topojson
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
    visitedCityDots?: Set<string>;       // set of "col,row" keys for city-level dots
    viewMode?: 'countries' | 'cities';   // which highlighting layer to use
    size?: number;
    className?: string;
    onCountryHover?: (code: string | null, name: string | null, flagUrl: string | null, dotKey?: string | null) => void;
    onCountryClick?: (code: string, name: string) => void;
    focusedCountryCode?: string | null;
    focusTrigger?: number;
}

// Cache the loaded data globally so it's only fetched once
let cachedDotData: DotData | null = null;

// Country name lookup - loaded from REST Countries API
let cachedCountryNames: Record<string, string> = {};

async function loadDotData(): Promise<DotData> {
    if (cachedDotData) return cachedDotData;
    const res = await fetch(`${ASSETS_URL}/dot-world-map.json`);
    cachedDotData = await res.json();
    return cachedDotData!;
}

async function loadCountryNames(): Promise<Record<string, string>> {
    if (Object.keys(cachedCountryNames).length > 0) return cachedCountryNames;
    try {
        const res = await fetch('/countries.json');
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
    visitedCityDots,
    viewMode = 'countries',
    size = 800,
    className = '',
    onCountryHover,
    onCountryClick,
    focusedCountryCode,
    focusTrigger,
}: DotMatrixGlobeProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dotData, setDotData] = useState<DotData | null>(null);
    const [countryNames, setCountryNames] = useState<Record<string, string>>({});
    const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
    const visitedSet = useMemo(() => new Set(visitedCountryCodes), [visitedCountryCodes]);
    const [mode, setMode] = useState<'2d' | '3d'>('3d');
    const [projection, setProjection] = useState<FlatProjection>(PROJECTION_B);

    // Drag to rotate state
    const dragRef = useRef({
        isDragging: false,
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0,
        velocityX: 0,
        offsetLat: 0, // up/down rotation offset for manual drag
        lastInteractionTime: 0,
        panX: 0,
        panY: 0,
        zoom: 1,
        targetZoom: 1,
        pinchDist: 0,
        // Cursor position for cursor-centered zooming (relative to canvas center)
        zoomCursorX: 0,
        zoomCursorY: 0,
        hoveredDotKey: null as string | null,
        targetRotation: null as number | null,
        targetOffsetLat: null as number | null,
        targetPanXNorm: null as number | null,
        targetPanYNorm: null as number | null,
    });
    const animRef = useRef({
        progress: 0,
        rotation: 0,
        // 0 is projection A, 1 is projection B. Eased so the two can be
        // compared by watching the continents move between them.
        flatMix: 1,
        lastTime: performance.now(),
    });
    const requestRef = useRef<number>();

    interface ProjectedDot {
        x: number;
        y: number;
        /** Dots are elliptical on a flat map: see the radii in `draw`. */
        rx: number;
        ry: number;
        code: string;
        dotKey: string;
        isBack: boolean;
        opacity: number;
    }
    const projectedDotsRef = useRef<ProjectedDot[]>([]);

    /** A point on the unit sphere, as `get3D` returns it. */
    interface UnitVector {
        ux: number;
        uy: number;
        uz: number;
    }

    // `draw` is declared further down the component, so it cannot go in the
    // dependency array of the focus effect above it without a TDZ error. This
    // ref hands that effect the current version without re-running it every
    // time draw is rebuilt.
    const drawRef = useRef<(time: number) => void>(() => {});

    const stars = useMemo(() => {
        return Array.from({ length: 400 }).map(() => ({
            x: Math.random(),
            y: Math.random(),
            r: Math.random() * 1.5 + 0.3,
            opacity: Math.random() * 0.8 + 0.2,
        }));
    }, []);

    const shootingStarRef = useRef({ active: false, x: 0, y: 0, length: 0, speed: 0, angle: 0, progress: 0 });

    // Load data
    useEffect(() => {
        Promise.all([loadDotData(), loadCountryNames()]).then(([dots, names]) => {
            setDotData(dots);
            setCountryNames(names);
        });
    }, []);

    const optimizedDots = useMemo(() => {
        if (!dotData) return [];
        const { cols, rows, dots } = dotData;
        return dots.map(([col, row, code]) => {
            const lon = ((col + 0.5) / cols) * 2 * Math.PI - Math.PI;
            const lat = Math.PI / 2 - ((row + 0.5) / rows) * Math.PI;
            // Only the flat positions differ between projections -- the grid is
            // still lon/lat, so the globe below reads the very same dots.
            const flatA = { ...SPEC_A.project(lon, lat), ...SPEC_A.rowScale(lat) };
            const flatB = { ...SPEC_B.project(lon, lat), ...SPEC_B.rowScale(lat) };
            // Longitudes converge at the poles, so an evenly-spaced lat/lon
            // grid piles every column onto nearly the same screen position
            // there -- which is what made Antarctica render as a bright ring
            // with a hot spot at the pole.
            //
            // Only the extreme polar caps need thinning. An earlier version
            // started at roughly 60 degrees and stripped Russia and northern
            // Canada, leaving them visibly grey and streaked. Beyond 78
            // degrees there is almost no populated land, so the correction is
            // invisible except where it is needed.
            const cosLat = Math.cos(lat);
            // Only the last few degrees need dropping outright; everything
            // else is handled by shrinking the dots (see the draw loop).
            const stride = cosLat < 0.12
                ? Math.min(8, Math.max(1, Math.round(1 / Math.max(0.05, cosLat))))
                : 1;

            return {
                code,
                dotKey: `${col},${row}`,  // for city-level dot lookup
                col,
                stride,
                cosLat,
                flatA,
                flatB,
                ux: Math.cos(lat) * Math.sin(lon),
                uy: -Math.sin(lat),
                uz: Math.cos(lat) * Math.cos(lon),
            };
        });
    }, [dotData]);

    // Handle focusing on a specific country
    useEffect(() => {
        if (focusedCountryCode && dotData) {
            const countryDots = dotData.dots.filter(d => d[2] === focusedCountryCode);
            if (countryDots.length > 0) {
                let sumCol = 0;
                let sumRow = 0;
                for (const d of countryDots) {
                    sumCol += d[0];
                    sumRow += d[1];
                }
                const avgCol = (sumCol / countryDots.length) + 0.5;
                const avgRow = (sumRow / countryDots.length) + 0.5;

                const lon = (avgCol / dotData.cols) * 2 * Math.PI - Math.PI;
                const lat = Math.PI / 2 - (avgRow / dotData.rows) * Math.PI;

                dragRef.current.targetRotation = lon;
                dragRef.current.targetOffsetLat = -lat;

                // The flat map is not a straight col/row scale in either
                // projection, so the pan target has to go through the one on
                // show or 2D focus lands beside the country instead of on it.
                const flatCentre = FLAT_PROJECTIONS[projection].project(lon, lat);
                dragRef.current.targetPanXNorm = flatCentre.nx;
                dragRef.current.targetPanYNorm = flatCentre.ny;

                dragRef.current.targetZoom = mode === '3d' ? 2.5 : 4.0;
                dragRef.current.lastInteractionTime = performance.now();
                
                requestRef.current = requestAnimationFrame((t) => {
                    animRef.current.lastTime = t;
                    drawRef.current(t);
                });
            }
        }
    }, [focusedCountryCode, focusTrigger, dotData, mode, projection]);

    const borderSegments = useMemo(() => {
        if (!dotData) return [];
        const { cols, rows, dots } = dotData;
        const grid = new Map();
        for (const [col, row, code] of dots) {
            grid.set(`${col},${row}`, code);
        }

        const segments = [];

        const getLonLat = (x: number, y: number) => {
            const lon = (x / cols) * 2 * Math.PI - Math.PI;
            const lat = Math.PI / 2 - (y / rows) * Math.PI;
            return { lon, lat, a: SPEC_A.project(lon, lat), b: SPEC_B.project(lon, lat) };
        };

        const get3D = (lon: number, lat: number) => {
            return {
                ux: Math.cos(lat) * Math.sin(lon),
                uy: -Math.sin(lat),
                uz: Math.cos(lat) * Math.cos(lon),
            };
        };

        for (const [col, row, code] of dots) {
            // Right edge
            const rightCode = grid.get(`${col + 1},${row}`);
            if (rightCode !== code) {
                const p1 = getLonLat(col + 1, row);
                const p2 = getLonLat(col + 1, row + 1);
                segments.push({
                    p1: get3D(p1.lon, p1.lat),
                    p2: get3D(p2.lon, p2.lat),
                    ax1: p1.a.nx, ay1: p1.a.ny, ax2: p2.a.nx, ay2: p2.a.ny,
                    bx1: p1.b.nx, by1: p1.b.ny, bx2: p2.b.nx, by2: p2.b.ny,
                    // A border that only exists because the projection clamped
                    // it to the edge is a line across the top of the map, not a
                    // coastline. Dropped while that projection is on show.
                    croppedA: p1.a.cropped || p2.a.cropped,
                    croppedB: p1.b.cropped || p2.b.cropped,
                });
            }
            // Bottom edge
            const bottomCode = grid.get(`${col},${row + 1}`);
            if (bottomCode !== code) {
                const p1 = getLonLat(col, row + 1);
                const p2 = getLonLat(col + 1, row + 1);
                segments.push({
                    p1: get3D(p1.lon, p1.lat),
                    p2: get3D(p2.lon, p2.lat),
                    ax1: p1.a.nx, ay1: p1.a.ny, ax2: p2.a.nx, ay2: p2.a.ny,
                    bx1: p1.b.nx, by1: p1.b.ny, bx2: p2.b.nx, by2: p2.b.ny,
                    // A border that only exists because the projection clamped
                    // it to the edge is a line across the top of the map, not a
                    // coastline. Dropped while that projection is on show.
                    croppedA: p1.a.cropped || p2.a.cropped,
                    croppedB: p1.b.cropped || p2.b.cropped,
                });
            }
            // Left edge
            const leftCode = grid.get(`${col - 1},${row}`);
            if (!leftCode) {
                const p1 = getLonLat(col, row);
                const p2 = getLonLat(col, row + 1);
                segments.push({
                    p1: get3D(p1.lon, p1.lat),
                    p2: get3D(p2.lon, p2.lat),
                    ax1: p1.a.nx, ay1: p1.a.ny, ax2: p2.a.nx, ay2: p2.a.ny,
                    bx1: p1.b.nx, by1: p1.b.ny, bx2: p2.b.nx, by2: p2.b.ny,
                    // A border that only exists because the projection clamped
                    // it to the edge is a line across the top of the map, not a
                    // coastline. Dropped while that projection is on show.
                    croppedA: p1.a.cropped || p2.a.cropped,
                    croppedB: p1.b.cropped || p2.b.cropped,
                });
            }
            // Top edge
            const topCode = grid.get(`${col},${row - 1}`);
            if (!topCode) {
                const p1 = getLonLat(col, row);
                const p2 = getLonLat(col + 1, row);
                segments.push({
                    p1: get3D(p1.lon, p1.lat),
                    p2: get3D(p2.lon, p2.lat),
                    ax1: p1.a.nx, ay1: p1.a.ny, ax2: p2.a.nx, ay2: p2.a.ny,
                    bx1: p1.b.nx, by1: p1.b.ny, bx2: p2.b.nx, by2: p2.b.ny,
                    // A border that only exists because the projection clamped
                    // it to the edge is a line across the top of the map, not a
                    // coastline. Dropped while that projection is on show.
                    croppedA: p1.a.cropped || p2.a.cropped,
                    croppedB: p1.b.cropped || p2.b.cropped,
                });
            }
        }
        return segments;
    }, [dotData]);

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

        // Sliding between the two projections rather than cutting is the point
        // of having both: the swelling of Greenland is far easier to read as a
        // movement than as two stills.
        const flatTarget = projection === PROJECTION_B ? 1 : 0;
        if (animRef.current.flatMix < flatTarget) {
            animRef.current.flatMix = Math.min(flatTarget, animRef.current.flatMix + dt * speed);
        } else if (animRef.current.flatMix > flatTarget) {
            animRef.current.flatMix = Math.max(flatTarget, animRef.current.flatMix - dt * speed);
        }
        const flatMix = animRef.current.flatMix;

        if (animRef.current.progress > 0) {
            // Apply momentum / velocity if not dragging
            if (!dragRef.current.isDragging) {
                if (dragRef.current.targetRotation !== null && dragRef.current.targetOffsetLat !== null) {
                    let diff = dragRef.current.targetRotation - animRef.current.rotation;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    
                    animRef.current.rotation += diff * 0.08;
                    dragRef.current.offsetLat += (dragRef.current.targetOffsetLat - dragRef.current.offsetLat) * 0.08;
                    
                    if (Math.abs(diff) < 0.001 && Math.abs(dragRef.current.targetOffsetLat - dragRef.current.offsetLat) < 0.001) {
                        dragRef.current.targetRotation = null;
                        dragRef.current.targetOffsetLat = null;
                    }
                } else if (Math.abs(dragRef.current.velocityX) > 0.0001) {
                    animRef.current.rotation += dragRef.current.velocityX;
                    dragRef.current.velocityX *= 0.95; // friction
                } else if (time - dragRef.current.lastInteractionTime > 12000) {
                    // Constant slow spin resumes after 12.0s of inactivity
                    animRef.current.rotation += dt * 0.00008 * animRef.current.progress;

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

        // The two projections are different shapes -- Mercator is square,
        // Equal Earth is ~2.05:1 -- so the flat map is fitted inside the canvas
        // rather than the canvas being resized to it. A CSS box transition and
        // this morph would ease on separate clocks and pull the continents out
        // of shape between them; one clock cannot.
        const flatAspect = SPEC_A.aspect + (SPEC_B.aspect - SPEC_A.aspect) * flatMix;
        const mapW = Math.min(W, H * flatAspect);
        const mapH = mapW / flatAspect;

        const isDark = document.documentElement.classList.contains('dark');

        // Smooth zoom interpolation with cursor-centered pan correction
        const prevZoom = dragRef.current.zoom;
        dragRef.current.zoom += (dragRef.current.targetZoom - dragRef.current.zoom) * 0.1;
        const curZoom = dragRef.current.zoom;

        // Apply cursor-centered pan correction for this frame's zoom delta (2D only)
        // This keeps the point under the cursor fixed as zoom smoothly changes.
        if (mode === '2d' && Math.abs(curZoom - prevZoom) > 0.0001) {
            const factor = 1 - curZoom / prevZoom;
            dragRef.current.panX += (dragRef.current.zoomCursorX - dragRef.current.panX) * factor;
            dragRef.current.panY += (dragRef.current.zoomCursorY - dragRef.current.panY) * factor;
        }

        // Clamp 2D pan to prevent wandering infinitely offscreen
        if (mode === '2d') {
            if (!dragRef.current.isDragging && dragRef.current.targetPanXNorm !== null && dragRef.current.targetPanYNorm !== null) {
                const targetPanX = mapW * curZoom * (0.5 - dragRef.current.targetPanXNorm);
                const targetPanY = mapH * curZoom * (0.5 - dragRef.current.targetPanYNorm);
                
                dragRef.current.panX += (targetPanX - dragRef.current.panX) * 0.08;
                dragRef.current.panY += (targetPanY - dragRef.current.panY) * 0.08;
                
                if (Math.abs(targetPanX - dragRef.current.panX) < 1 && Math.abs(targetPanY - dragRef.current.panY) < 1) {
                    dragRef.current.targetPanXNorm = null;
                    dragRef.current.targetPanYNorm = null;
                }
            }

            const maxPanX = Math.max(0, (mapW * curZoom - W) / 2) + 100;
            const maxPanY = Math.max(0, (mapH * curZoom - H) / 2) + 100;
            dragRef.current.panX = Math.max(-maxPanX, Math.min(maxPanX, dragRef.current.panX));
            dragRef.current.panY = Math.max(-maxPanY, Math.min(maxPanY, dragRef.current.panY));
        }

        const { panX, panY } = dragRef.current;
        const { progress, rotation } = animRef.current;
        const R = Math.min(W, H) * 0.45 * curZoom;

        // Draw background stars ONLY in 3D mode (scales with progress)
        const starVisibility = progress;

        if (starVisibility > 0) {
            ctx.save();
            // Inverse clip to prevent stars from bleeding through the 3D globe itself
            ctx.beginPath();
            ctx.rect(0, 0, W, H);
            ctx.arc(W / 2, H / 2, Math.max(0, R - 1), 0, Math.PI * 2, true);
            ctx.clip('evenodd');

            // Parallax effect using pan and rotation
            const px = panX * 0.05 + rotation * 50;
            const py = panY * 0.05 - dragRef.current.offsetLat * 50;

            ctx.fillStyle = isDark ? '#ffffff' : '#111827';
            for (const star of stars) {
                const sx = (star.x * W + px) % W;
                const sy = (star.y * H + py) % H;

                const drawX = sx < 0 ? sx + W : sx;
                const drawY = sy < 0 ? sy + H : sy;

                ctx.globalAlpha = star.opacity * starVisibility;
                ctx.beginPath();
                ctx.arc(drawX, drawY, star.r, 0, Math.PI * 2);
                ctx.fill();
            }

            // Handle shooting stars
            const ss = shootingStarRef.current;
            if (!ss.active && Math.random() < 0.005) {
                ss.active = true;
                ss.x = Math.random() * W;
                ss.y = Math.random() * (H / 3);
                ss.angle = Math.PI / 4 + (Math.random() - 0.5) * 0.5;
                ss.length = 80 + Math.random() * 120;
                ss.speed = 15 + Math.random() * 20;
                ss.progress = 0;
            }

            if (ss.active) {
                ss.progress += ss.speed;
                const ex = ss.x - Math.cos(ss.angle) * ss.progress;
                const ey = ss.y + Math.sin(ss.angle) * ss.progress;

                const tailX = ss.x - Math.cos(ss.angle) * Math.max(0, ss.progress - ss.length);
                const tailY = ss.y + Math.sin(ss.angle) * Math.max(0, ss.progress - ss.length);

                ctx.globalAlpha = Math.max(0, 1 - (ss.progress / (W * 1.5))) * starVisibility;
                const grad = ctx.createLinearGradient(ex, ey, tailX, tailY);
                const colorBase = isDark ? '255, 255, 255' : '17, 24, 39';
                grad.addColorStop(0, `rgba(${colorBase}, 1)`);
                grad.addColorStop(1, `rgba(${colorBase}, 0)`);

                ctx.beginPath();
                ctx.moveTo(ex, ey);
                ctx.lineTo(tailX, tailY);
                ctx.strokeStyle = grad;
                ctx.lineWidth = 1.5;
                ctx.stroke();

                if (ss.progress > W * 1.5 || ey > H + 100) {
                    ss.active = false;
                }
            }
            ctx.restore();
            ctx.globalAlpha = 1;
        }

        const { cols, rows } = dotData;
        // Measured against the canvas, not the fitted map, so that the globe's
        // dots are not quietly resized by whichever flat projection happens to
        // be selected behind it. The flat spacings below carry the projection;
        // this only sets the unit they are expressed in, and it cancels out.
        const dotSpacingX = W / cols;
        const dotSpacingY = H / rows;
        const W_half = W / 2;
        const H_half = H / 2;
        const W_zoom = mapW * curZoom;
        const H_zoom = mapH * curZoom;
        const W_offset = W_half - (mapW * curZoom) / 2 + panX;
        const H_offset = H_half - (mapH * curZoom) / 2 + panY;

        // Anti-clutter tuning on Mobile
        const isMobile = W < 600;
        const radiusMultiplier = isMobile ? (progress === 0 ? 0.25 : 0.32) : 0.38;
        const baseRadius = Math.min(dotSpacingX, dotSpacingY) * radiusMultiplier * curZoom;

        // Neither projection leaves the grid even: Equal Earth squeezes it
        // towards the poles, Mercator stretches it. Either way a dot sized for
        // the equator is wrong everywhere else, so these are the equatorial
        // spacings each dot's own spacing is measured against.
        const rowUnit = SPEC_A.rowUnit + (SPEC_B.rowUnit - SPEC_A.rowUnit) * flatMix;
        const flatSpacingX = mapW / cols;
        const flatSpacingY = (mapH * rowUnit) / rows;
        const flatUnit = Math.min(dotSpacingX, dotSpacingY);

        const cosRot = Math.cos(rotation);
        const sinRot = Math.sin(rotation);
        const cosLatOffset = Math.cos(dragRef.current.offsetLat);
        const sinLatOffset = Math.sin(dragRef.current.offsetLat);

        // --- Render Grid-Based Borders ---
        if (borderSegments.length > 0) {
            let borderAlpha = 0.15;
            let drawHemisphere = false;

            if (progress === 1) {
                drawHemisphere = true;
            } else if (progress > 0) {
                const threshold = 0.15;
                if (progress > 1 - threshold) {
                    drawHemisphere = true;
                    borderAlpha = 0.15 * ((progress - (1 - threshold)) / threshold);
                } else if (progress < threshold) {
                    borderAlpha = 0.15 * (1 - (progress / threshold));
                } else {
                    borderAlpha = 0;
                }
            }

            // Dynamically increase alpha when zooming in 2D so borders remain highly visible
            let dynamicAlpha = borderAlpha;
            if (curZoom > 1.0 && progress === 0) {
                dynamicAlpha = Math.min(0.45, borderAlpha + (curZoom - 1.0) * 0.08);
            }

            if (dynamicAlpha > 0.02) {
                ctx.globalAlpha = dynamicAlpha;
                ctx.beginPath();
                for (const seg of borderSegments) {
                    // Skip a border the projection on show only has because it
                    // clamped the pole to the edge.
                    if (progress < 0.5 && (flatMix < 0.5 ? seg.croppedA : seg.croppedB)) continue;

                    let x1 = (seg.ax1 + (seg.bx1 - seg.ax1) * flatMix) * W_zoom + W_offset;
                    let y1 = (seg.ay1 + (seg.by1 - seg.ay1) * flatMix) * H_zoom + H_offset;
                    let x2 = (seg.ax2 + (seg.bx2 - seg.ax2) * flatMix) * W_zoom + W_offset;
                    let y2 = (seg.ay2 + (seg.by2 - seg.ay2) * flatMix) * H_zoom + H_offset;
                    let zNorm1 = 1, zNorm2 = 1;

                    if (progress > 0) {
                        const projectP = (p: UnitVector) => {
                            const x3d = R * p.ux;
                            const y3d = R * p.uy;
                            const z3d = R * p.uz;
                            const x_rot = x3d * cosRot - z3d * sinRot;
                            const z_rot = x3d * sinRot + z3d * cosRot;
                            const y_tilt = y3d * cosLatOffset - z_rot * sinLatOffset;
                            const z_tilt = y3d * sinLatOffset + z_rot * cosLatOffset;
                            return {
                                x: W_half + x_rot,
                                y: H_half + y_tilt,
                                z: z_tilt / R
                            };
                        };
                        const p1Proj = projectP(seg.p1);
                        const p2Proj = projectP(seg.p2);
                        
                        x1 = x1 + (p1Proj.x - x1) * progress;
                        y1 = y1 + (p1Proj.y - y1) * progress;
                        x2 = x2 + (p2Proj.x - x2) * progress;
                        y2 = y2 + (p2Proj.y - y2) * progress;
                        zNorm1 = p1Proj.z;
                        zNorm2 = p2Proj.z;
                    }

                    // 3D back-face culling
                    if (progress > 0.5 && zNorm1 < 0 && zNorm2 < 0) continue;

                    // 2D viewport culling - use generous margins to prevent clipping
                    const margin = 100;
                    if (progress === 0 && 
                       ((x1 < -margin && x2 < -margin) || 
                        (x1 > W + margin && x2 > W + margin) || 
                        (y1 < -margin && y2 < -margin) || 
                        (y1 > H + margin && y2 > H + margin))) {
                        continue;
                    }

                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                }
                
                ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
                // Scale line width up gently with zoom to ensure borders stay thick and prominent
                const baseWidth = isMobile ? 0.4 : 0.9;
                const borderWidth = Math.min(3.0, baseWidth * Math.pow(curZoom, 0.5)) * dpr;
                ctx.lineWidth = borderWidth;
                ctx.stroke();

                // Hemisphere outline (only in 3D)
                if (drawHemisphere) {
                    ctx.globalAlpha = (borderAlpha / 0.15) * 0.05;
                    ctx.beginPath();
                    ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2);
                    ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
                    ctx.lineWidth = 1 * dpr;
                    ctx.stroke();
                }
            }
            ctx.globalAlpha = 1;
        }

        const newProjected: ProjectedDot[] = [];
        const backDots: ProjectedDot[] = [];
        const frontDots: ProjectedDot[] = [];

        for (const dot of optimizedDots) {
            // Drop dots only in the last few degrees, where even shrinking
            // them cannot keep them apart.
            if (progress > 0.5 && dot.stride > 1 && dot.col % dot.stride !== 0) {
                continue;
            }

            const { flatA, flatB } = dot;
            const cx2d = (flatA.nx + (flatB.nx - flatA.nx) * flatMix) * W_zoom + W_offset;
            const cy2d = (flatA.ny + (flatB.ny - flatA.ny) * flatMix) * H_zoom + H_offset;

            // 2D Viewport culling optimization:
            // Use a generous safety margin to prevent dots from popping out at edges
            const safetyMargin = 100;
            if (progress === 0 && (cx2d < -safetyMargin || cx2d > W + safetyMargin || cy2d < -safetyMargin || cy2d > H + safetyMargin)) {
                continue;
            }

            let cx = cx2d;
            let cy = cy2d;
            let zNorm = 1;
            let isBack = false;

            if (progress > 0) {
                const x3d = R * dot.ux;
                const y3d = R * dot.uy;
                const z3d = R * dot.uz;

                // 1. Rotation around Y axis (longitude scroll)
                const x_rot = x3d * cosRot - z3d * sinRot;
                const z_rot = x3d * sinRot + z3d * cosRot;

                // 2. Rotation around X axis (latitude tilt from manual drag)
                const y_tilt = y3d * cosLatOffset - z_rot * sinLatOffset;
                const z_tilt = y3d * sinLatOffset + z_rot * cosLatOffset;

                const cx3d = W_half + x_rot;
                const cy3d = H_half + y_tilt;

                cx = cx2d + (cx3d - cx2d) * progress;
                cy = cy2d + (cy3d - cy2d) * progress;
                zNorm = z_tilt / R;
                isBack = z_tilt < 0;
            }

            // On a sphere, dots in a row sit cos(lat) apart, so towards the
            // poles they overlap and merge into solid arcs -- the banding
            // across the Arctic and Antarctic. Shrinking them by the same
            // factor keeps the gaps open. Doing it by size rather than by
            // removing dots matters: thinning left visible grey holes across
            // Russia and northern Canada, whereas this stays continuous and
            // simply reads as finer detail towards the poles.
            const polarScale = Math.max(0.32, Math.min(1, dot.cosLat / 0.55));
            // Whichever of the two spacings is tighter is the one that decides
            // whether this dot touches its neighbour. The floor keeps the last
            // couple of degrees from fading out entirely -- they overlap a
            // little there, which reads as solid ice rather than as a gap.
            // A flat dot is an ellipse, because no projection stretches a
            // grid cell equally in both directions. Mercator holds the columns
            // still and spreads the rows by sec φ, so a round dot sized to the
            // columns leaves Canada and Russia in horizontal stripes; Equal
            // Earth squeezes the rows harder than the columns, so a round dot
            // sized to the rows leaves gaps the other way. Sizing each axis to
            // its own spacing leaves the same proportional gap in both, which
            // is what reads as an even matrix.
            const hScale = flatA.hScale + (flatB.hScale - flatA.hScale) * flatMix;
            const vScale = flatA.vScale + (flatB.vScale - flatA.vScale) * flatMix;
            const flatScaleX = Math.max(0.25, (hScale * flatSpacingX) / flatUnit);
            const flatScaleY = Math.max(0.25, (vScale * flatSpacingY) / flatUnit);
            // A globe has no such stretch: the dots go back to round.
            const sphereScale = Math.max(0.4, 0.6 + 0.4 * zNorm) * polarScale;
            const activeRadiusX = baseRadius * (flatScaleX * (1 - progress) + sphereScale * progress);
            const activeRadiusY = baseRadius * (flatScaleY * (1 - progress) + sphereScale * progress);
            // A dot the projection cannot place sits clamped to the edge, so
            // it fades out as that projection takes over instead of stacking
            // into a bright bar along the top. The globe crops nothing, so the
            // fade lifts as the map rolls up into it.
            const cropFade =
                (flatA.cropped ? flatMix : 1) * (flatB.cropped ? 1 - flatMix : 1);
            const activeOpacity =
                (1 * (1 - progress) + Math.max(0.1, 0.45 + 0.55 * zNorm) * progress) *
                (1 - (1 - cropFade) * (1 - progress));

            const pDot: ProjectedDot = {
                x: cx, y: cy,
                rx: activeRadiusX,
                ry: activeRadiusY,
                code: dot.code,
                dotKey: dot.dotKey,
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
            const isCountryVisited = visitedSet.has(p.code);
            const isCityDot = visitedCityDots?.has(p.dotKey) ?? false;
            const isHovered = p.code === hoveredCountry;
            const isCityMode = viewMode === 'cities';

            let color: string;
            let emphasis = 1;

            if (isCityMode) {
                // City view mode: highlight only dots with visited cities
                if (isCityDot && isHovered) {
                    color = 'rgba(255, 200, 50, 1)';
                    emphasis = 1.4;
                } else if (isCityDot) {
                    color = 'rgba(218, 165, 32, 0.95)';
                    emphasis = 1.2;
                } else if (isCountryVisited && isHovered) {
                    color = 'rgba(218, 165, 32, 0.45)';
                    emphasis = 1.1;
                } else if (isCountryVisited) {
                    // Dim gold for visited country but no city here
                    color = 'rgba(218, 165, 32, 0.08)';
                } else if (isHovered) {
                    color = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(60, 80, 140, 0.8)';
                    emphasis = 1.2;
                } else {
                    color = isDark ? `rgba(255, 255, 255, ${isMobile ? 0.04 : 0.06})` : `rgba(50, 70, 130, ${isMobile ? 0.05 : 0.07})`;
                }
            } else {
                // Country view mode (existing behavior)
                if (isCountryVisited && isHovered) {
                    color = 'rgba(255, 200, 50, 1)';
                    emphasis = 1.4;
                } else if (isCountryVisited) {
                    color = 'rgba(218, 165, 32, 0.95)';
                    emphasis = 1.2;
                } else if (isHovered) {
                    color = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(60, 80, 140, 0.8)';
                    emphasis = 1.2;
                } else {
                    color = isDark ? `rgba(255, 255, 255, ${isMobile ? 0.12 : 0.22})` : `rgba(50, 70, 130, ${isMobile ? 0.12 : 0.25})`;
                }
            }

            ctx.globalAlpha = p.opacity;
            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.ellipse(p.x, p.y, p.rx * emphasis, p.ry * emphasis, 0, 0, Math.PI * 2);
            ctx.fill();
        };

        for (const p of backDots) drawDot(p);
        for (const p of frontDots) drawDot(p);

        // Add auto-recentering for 2D pan when fully zoomed out
        if (mode === '2d' && curZoom <= 1.01) {
            dragRef.current.panX *= 0.9;
            dragRef.current.panY *= 0.9;
        }

        if (progress > 0 || animRef.current.progress !== target || flatMix !== flatTarget) {
            requestRef.current = requestAnimationFrame((t) => draw(t));
        } else if (mode === '2d' && (Math.abs(dragRef.current.targetZoom - curZoom) > 0.01 || Math.abs(panX) > 1 || Math.abs(panY) > 1)) {
            // keep 2D drawing alive ONLY if it's currently actively zooming/panning
            requestRef.current = requestAnimationFrame((t) => draw(t));
        }

    }, [dotData, optimizedDots, borderSegments, visitedSet, visitedCityDots, viewMode, hoveredCountry, mode, projection, stars]);

    drawRef.current = draw;

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

    /** Which country's dot sits under a viewport point, if any. */
    const countryAtPoint = useCallback((clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return { code: null as string | null, dotKey: null as string | null };

        const rect = canvas.getBoundingClientRect();
        const mx = clientX - rect.left;
        const my = clientY - rect.top;

        let bestDist = Infinity;
        let foundCode: string | null = null;
        let foundDotKey: string | null = null;
        const { progress } = animRef.current;

        for (const p of projectedDotsRef.current) {
            if (p.isBack && progress > 0.5) continue;
            // Cropped off the edge of the projection on show, so not there to hit.
            if (p.opacity < 0.02) continue;

            // Fast boundary check before the elliptical distance
            if (Math.abs(mx - p.x) > p.rx * 3 || Math.abs(my - p.y) > p.ry * 3) continue;

            // Scaled to the dot's own axes, so a stretched dot is grabbable
            // across the whole of the cell it stands for. 1 is its edge.
            const dist = Math.hypot((mx - p.x) / (p.rx * 2.5), (my - p.y) / (p.ry * 2.5));
            if (dist < 1 && dist < bestDist) {
                bestDist = dist;
                foundCode = p.code;
                foundDotKey = p.dotKey;
            }
        }

        return { code: foundCode, dotKey: foundDotKey };
    }, []);

    /** Select whatever is under a point: shared by a mouse click and a tap. */
    const selectAtPoint = useCallback((clientX: number, clientY: number) => {
        const { code, dotKey } = countryAtPoint(clientX, clientY);
        if (!code) return;

        // A tap has no hover pass before it, so light up the country as well as
        // selecting it -- otherwise the map would jump with nothing highlighted.
        setHoveredCountry(code);
        dragRef.current.hoveredDotKey = dotKey;
        const name = countryNames[code] ?? code;
        onCountryHover?.(code, name, `https://flagcdn.com/w80/${code.toLowerCase()}.png`, dotKey);
        onCountryClick?.(code, name);
    }, [countryAtPoint, countryNames, onCountryHover, onCountryClick]);

    // Mouse events
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (!dotData) return;
            e.preventDefault();
            dragRef.current.lastInteractionTime = performance.now();
            // Clear targets on user interaction
            dragRef.current.targetRotation = null;
            dragRef.current.targetOffsetLat = null;
            dragRef.current.targetPanXNorm = null;
            dragRef.current.targetPanYNorm = null;

            const zoomDelta = e.deltaY * -0.001;
            const minZ = mode === '2d' ? 1.0 : 0.98;
            dragRef.current.targetZoom = Math.max(minZ, Math.min(10, dragRef.current.targetZoom + zoomDelta * dragRef.current.targetZoom));

            // Store cursor position for cursor-centered zooming (applied per-frame in draw())
            if (mode === '2d' && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                dragRef.current.zoomCursorX = (e.clientX - rect.left) - rect.width / 2;
                dragRef.current.zoomCursorY = (e.clientY - rect.top) - rect.height / 2;
            }

            // Wake up animation loop if sleeping
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            requestRef.current = requestAnimationFrame((t) => draw(t));
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (!dotData) return;
            e.preventDefault(); // Prevent iOS from hijacking touch
            if (e.touches.length === 1) {
                dragRef.current.isDragging = true;
                dragRef.current.lastX = e.touches[0].clientX;
                dragRef.current.lastY = e.touches[0].clientY;
                dragRef.current.startX = e.touches[0].clientX;
                dragRef.current.startY = e.touches[0].clientY;
                dragRef.current.velocityX = 0;
                dragRef.current.lastInteractionTime = performance.now();
                // Clear targets on user interaction
                dragRef.current.targetRotation = null;
                dragRef.current.targetOffsetLat = null;
                dragRef.current.targetPanXNorm = null;
                dragRef.current.targetPanYNorm = null;
            } else if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                dragRef.current.pinchDist = Math.sqrt(dx * dx + dy * dy);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!dotData) return;
            e.preventDefault(); // Prevent iOS from hijacking touch

            if (e.touches.length === 1 && dragRef.current.isDragging) {
                dragRef.current.lastInteractionTime = performance.now();
                const dx = e.touches[0].clientX - dragRef.current.lastX;
                const dy = e.touches[0].clientY - dragRef.current.lastY;
                dragRef.current.lastX = e.touches[0].clientX;
                dragRef.current.lastY = e.touches[0].clientY;

                if (mode === '3d') {
                    const rotDelta = -dx * 0.005;
                    animRef.current.rotation += rotDelta;
                    dragRef.current.velocityX = rotDelta; // Save for momentum
                    dragRef.current.offsetLat -= dy * 0.005;
                    dragRef.current.offsetLat = Math.max(-1.2, Math.min(1.2, dragRef.current.offsetLat));
                } else if (mode === '2d') {
                    dragRef.current.panX += dx;
                    dragRef.current.panY += dy;
                }
            } else if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const newDist = Math.sqrt(dx * dx + dy * dy);
                if (dragRef.current.pinchDist) {
                    const zoomDelta = (newDist - dragRef.current.pinchDist) * 0.01;
                    const minZ = mode === '2d' ? 1.0 : 0.98;
                    dragRef.current.targetZoom = Math.max(minZ, Math.min(10, dragRef.current.targetZoom + zoomDelta));

                    // Store pinch midpoint for cursor-centered zooming (applied per-frame in draw())
                    if (mode === '2d' && canvasRef.current) {
                        const rect = canvasRef.current.getBoundingClientRect();
                        dragRef.current.zoomCursorX = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) - rect.width / 2;
                        dragRef.current.zoomCursorY = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) - rect.height / 2;
                    }
                }
                dragRef.current.pinchDist = newDist;
            }

            // Immediately wake up animation loop to ensure smooth 60fps follow on finger tracking
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            requestRef.current = requestAnimationFrame((t) => draw(t));
        };

        const handleTouchEnd = (e: TouchEvent) => {
            // No strict preventDefault here to allow tap-to-click events if needed natively
            const wasDragging = dragRef.current.isDragging;
            dragRef.current.isDragging = false;
            dragRef.current.pinchDist = 0;
            dragRef.current.lastInteractionTime = performance.now();

            // touchstart calls preventDefault to stop iOS scrolling the page
            // while you spin the globe, which also cancels the synthetic click
            // a tap would otherwise produce -- so selection has to be done
            // here. A finger that travelled more than 5px was a drag, not a tap.
            const touch = e.changedTouches[0];
            if (!wasDragging || !touch) return;
            const dx = touch.clientX - dragRef.current.startX;
            const dy = touch.clientY - dragRef.current.startY;
            if (Math.sqrt(dx * dx + dy * dy) > 5) return;

            selectAtPoint(touch.clientX, touch.clientY);
        };

        const canvas = canvasRef.current;
        if (canvas) {
            canvas.addEventListener('wheel', handleWheel, { passive: false });
            canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
            canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
            canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
            canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
        }
        return () => {
            if (canvas) {
                canvas.removeEventListener('wheel', handleWheel);
                canvas.removeEventListener('touchstart', handleTouchStart);
                canvas.removeEventListener('touchmove', handleTouchMove);
                canvas.removeEventListener('touchend', handleTouchEnd);
                canvas.removeEventListener('touchcancel', handleTouchEnd);
            }
        };
    }, [dotData, mode, draw, selectAtPoint]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!dotData) return;
        dragRef.current.isDragging = true;
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        dragRef.current.velocityX = 0;
        dragRef.current.lastInteractionTime = performance.now();
        // Clear targets on user interaction
        dragRef.current.targetRotation = null;
        dragRef.current.targetOffsetLat = null;
        dragRef.current.targetPanXNorm = null;
        dragRef.current.targetPanYNorm = null;
    }, [dotData]);

    const handleMouseUp = useCallback(() => {
        dragRef.current.isDragging = false;
        dragRef.current.lastInteractionTime = performance.now();
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current || !projectedDotsRef.current.length) return;

        // Handle dragging map
        if (dragRef.current.isDragging) {
            dragRef.current.lastInteractionTime = performance.now();
            const dx = e.clientX - dragRef.current.lastX;
            const dy = e.clientY - dragRef.current.lastY;
            dragRef.current.lastX = e.clientX;
            dragRef.current.lastY = e.clientY;

            if (mode === '3d') {
                // Update rotation instantly (inverted dx)
                const rotDelta = -dx * 0.005;
                animRef.current.rotation += rotDelta;
                dragRef.current.velocityX = rotDelta; // Save for momentum

                // Update latitude tilt (inverted dy), limit range so we don't go upside down
                dragRef.current.offsetLat -= dy * 0.005;
                dragRef.current.offsetLat = Math.max(-1.2, Math.min(1.2, dragRef.current.offsetLat));
            } else if (mode === '2d') {
                dragRef.current.panX += dx;
                dragRef.current.panY += dy;
            }

            // Re-draw immediately without waiting for hover logic frame
            // but still do hover logic!
        }

        const { code: foundCode, dotKey: foundDotKey } = countryAtPoint(e.clientX, e.clientY);

        if (foundCode !== hoveredCountry || foundDotKey !== dragRef.current.hoveredDotKey) {
            setHoveredCountry(foundCode);
            dragRef.current.hoveredDotKey = foundDotKey;
            const flagUrl = foundCode ? `https://flagcdn.com/w80/${foundCode.toLowerCase()}.png` : null;
            onCountryHover?.(foundCode, foundCode ? (countryNames[foundCode] ?? foundCode) : null, flagUrl, foundDotKey);
        }
    }, [hoveredCountry, countryNames, onCountryHover, mode, countryAtPoint]);

    const handleMouseLeave = useCallback(() => {
        setHoveredCountry(null);
        dragRef.current.hoveredDotKey = null;
        onCountryHover?.(null, null, null, null);
        dragRef.current.isDragging = false;
    }, [onCountryHover]);

    const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        // Calculate the total distance moved between pointer start and release
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If the pointer moved more than 5px, treat it as a drag/scroll, not a click
        if (distance > 5) {
            return;
        }

        selectAtPoint(e.clientX, e.clientY);
    }, [selectAtPoint]);


    return (
        // The box used to be sized to the grid's ratio so the flat map would
        // not stretch. It does not have to be any more: the draw loop fits the
        // projection inside whatever canvas it is given, which is the only way
        // two projections of different shapes can morph without the box and
        // the dots easing on separate clocks. So the canvas simply takes the
        // slot, flat or globe, and never resizes underneath the drawing.
        <div className={`dot-matrix-map-slot ${className}`}>
            <div className="dot-matrix-map-container">
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
                style={{ width: '100%', height: '100%', cursor: dragRef.current.isDragging ? 'grabbing' : (hoveredCountry ? 'crosshair' : 'grab'), touchAction: 'none' }}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
            />
            {/* Projection picker. It stays on the globe rather than vanishing,
                but greyed out: a globe has no projection to pick, and saying so
                in place makes the point better than an empty corner does. It
                still shows which projection the map will unroll back into.
                Fades over the same 500ms the dots take to morph. */}
            {dotData && (
                <div
                    className={`absolute bottom-4 left-4 z-10 flex items-center gap-0.5 p-0.5 rounded-full bg-background/80 backdrop-blur-md border border-border/50 shadow-sm transition-opacity duration-500 ${
                        mode === '3d' ? 'opacity-40 pointer-events-none' : 'pointer-events-auto'
                    }`}
                    role="group"
                    aria-label="Map projection"
                >
                    {FLAT_PROJECTION_ORDER.map((id) => {
                        const spec = FLAT_PROJECTIONS[id];
                        const active = projection === id;
                        return (
                            <button
                                key={id}
                                onClick={() => setProjection(id)}
                                disabled={mode === '3d'}
                                aria-pressed={active}
                                title={
                                    mode === '3d'
                                        ? 'A globe has no projection to pick -- switch to the 2D map.'
                                        : spec.note
                                }
                                className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold tracking-wider whitespace-nowrap transition-[background-color,color] duration-300 disabled:cursor-default ${
                                    active
                                        ? 'bg-muted text-foreground'
                                        : 'text-muted-foreground enabled:hover:text-foreground'
                                }`}
                            >
                                {spec.label}
                            </button>
                        );
                    })}
                </div>
            )}
            {dotData && (
                <button
                    onClick={() => setMode(m => m === '2d' ? '3d' : '2d')}
                    className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/50 shadow-sm hover:bg-muted text-[10px] sm:text-xs font-semibold tracking-wider text-muted-foreground transition-[background-color,color] duration-300 pointer-events-auto"
                    aria-label="Toggle 3D View"
                >
                    {mode === '2d' ? <Globe className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                    {mode === '2d' ? '3D Globe' : '2D Map'}
                </button>
            )}
            </div>
        </div>
    );
}

export type { DotMatrixGlobeProps };


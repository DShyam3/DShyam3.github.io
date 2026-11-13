import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Globe, Map as MapIcon } from 'lucide-react';
import { ASSETS_URL } from '@/lib/constants';
import {
    EQUAL_EARTH_ASPECT,
    EQUAL_EARTH_LABEL,
    EQUAL_EARTH_NOTE,
    EQUAL_EARTH_ROW_UNIT,
    equalEarthRowScale,
    projectEqualEarth,
} from '@/lib/equalEarth';

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
    /** A city to turn to and mark, in degrees. `dotKey` names its dot where the caller knows it. */
    focusedCity?: { lat: number; lon: number; countryCode: string; dotKey?: string } | null;
    /** Where to turn, in degrees, for a selected country too small to have dots of its own. */
    focusedCountryPoint?: { lat: number; lon: number } | null;
}

/**
 * After this long untouched, with nothing selected, the globe turns on its own
 * again -- easing up to speed over the ramp rather than lurching off.
 */
const IDLE_SPIN_DELAY_MS = 12000;
const IDLE_SPIN_RAMP_MS = 4000;

/** How close each kind of selection is brought in. */
const FOCUS_ZOOM = { country: { '3d': 2.5, '2d': 4 }, city: { '3d': 3.5, '2d': 6 } } as const;

/**
 * Dot colours, one set per theme. Visited has to read at a glance against not
 * visited, so the two differ in hue, strength and size, never by alpha alone:
 * a faint gold over a faint grey was indistinguishable in either theme. Light
 * uses a deeper amber, because the dark theme's gold washes out on cream.
 */
const DOT_PALETTE = {
    dark: {
        unvisited: 'rgba(255, 255, 255, 0.2)',
        unvisitedHovered: 'rgba(255, 255, 255, 0.6)',
        visited: 'rgba(255, 186, 38, 1)',
        visitedHovered: 'rgba(255, 222, 120, 1)',
        // Cities view: the country is still marked, so its cities stand out of
        // a tinted patch rather than out of the same grey as everywhere else.
        visitedTint: 'rgba(255, 186, 38, 0.38)',
        city: 'rgba(255, 222, 120, 1)',
        selected: 'rgba(255, 236, 170, 1)',
        ring: 'rgba(255, 210, 90, 0.95)',
    },
    light: {
        unvisited: 'rgba(40, 52, 90, 0.18)',
        unvisitedHovered: 'rgba(40, 60, 130, 0.65)',
        visited: 'rgba(214, 132, 0, 1)',
        visitedHovered: 'rgba(170, 92, 0, 1)',
        visitedTint: 'rgba(214, 132, 0, 0.34)',
        city: 'rgba(196, 84, 0, 1)',
        selected: 'rgba(150, 60, 0, 1)',
        ring: 'rgba(170, 82, 0, 0.95)',
    },
} as const;

// Cache the loaded data globally so it's only fetched once
let cachedDotData: DotData | null = null;

// Country name lookup - loaded from REST Countries API
let cachedCountryNames: Record<string, string> = {};

async function loadDotData(): Promise<DotData> {
    if (cachedDotData) return cachedDotData;
    const res = await fetch(`${ASSETS_URL}/dot-world-map.json`);
    if (!res.ok) throw new Error('Map unavailable');
    const data = await res.json();
    if (!Array.isArray(data.dots) || !Number.isFinite(data.cols) || !Number.isFinite(data.rows) || data.cols <= 0 || data.rows <= 0) throw new Error('Invalid map data');
    cachedDotData = data;
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

/**
 * How far past its own edge the flat map may be pulled, in CSS pixels. The
 * excess is never a resting place: `settlePan` gives it back on release.
 */
const PAN_OVERSCROLL = 90;

/** Past the edge a drag moves a third as far, so the pull reads as elastic. */
function rubberDelta(pan: number, delta: number, limit: number): number {
    const pullingFurtherOut = Math.abs(pan) > limit && Math.sign(pan) === Math.sign(delta);
    return pullingFurtherOut ? delta * 0.35 : delta;
}

interface FocusTargets {
    targetRotation: number | null;
    targetOffsetLat: number | null;
    targetPanXNorm: number | null;
    targetPanYNorm: number | null;
}

/** Let go of a selection's resting place: the user has taken the map. */
function releaseTargets(drag: FocusTargets) {
    drag.targetRotation = null;
    drag.targetOffsetLat = null;
    drag.targetPanXNorm = null;
    drag.targetPanYNorm = null;
}

/**
 * Past this many pixels from where it went down, a press is a drag. Below it,
 * a click or tap leaves the selection where it is (the same threshold the
 * click handler uses to tell the two apart).
 */
const DRAG_THRESHOLD = 5;

function movedPastThreshold(drag: { startX: number; startY: number }, x: number, y: number) {
    return Math.hypot(x - drag.startX, y - drag.startY) > DRAG_THRESHOLD;
}

/** One frame of spring-back towards the allowed range; a no-op inside it. */
function settlePan(pan: number, limit: number): number {
    const inRange = Math.max(-limit, Math.min(limit, pan));
    const excess = pan - inRange;
    return Math.abs(excess) < 0.5 ? inRange : inRange + excess * 0.82;
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
    focusedCity,
    focusedCountryPoint,
}: DotMatrixGlobeProps) {
    const focusLat = focusedCity?.lat;
    const focusLon = focusedCity?.lon;
    const focusCityCountry = focusedCity?.countryCode;
    const focusCityDotKey = focusedCity?.dotKey;
    const countryPointLat = focusedCountryPoint?.lat;
    const countryPointLon = focusedCountryPoint?.lon;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dotData, setDotData] = useState<DotData | null>(null);
    const [mapError, setMapError] = useState(false);
    const [countryNames, setCountryNames] = useState<Record<string, string>>({});
    const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
    const visitedSet = useMemo(() => new Set(visitedCountryCodes), [visitedCountryCodes]);
    const [mode, setMode] = useState<'2d' | '3d'>('3d');
    // Read per frame rather than as state: it changes how far each easing step
    // goes, not what is drawn, so it never needs a render of its own.
    const reducedMotionRef = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = () => { reducedMotionRef.current = query.matches; };
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }, []);

    // Drag to rotate state
    const dragRef = useRef({
        isDragging: false,
        /**
         * What a one-finger touch turned out to be. At rest the canvas lets the
         * page scroll vertically (touch-action: pan-y), so a mostly vertical
         * swipe is the page's and a sideways one is the map's; which, is only
         * known once the finger has moved.
         */
        touchGesture: 'idle' as 'idle' | 'undecided' | 'drag' | 'scroll',
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
        // True while a country or city is selected: the globe stays on it
        // rather than drifting off on the idle spin.
        holding: false,
        // The fitted map width last frame. Pan is held in pixels, so a resize
        // has to scale it or the view slides off what it was showing.
        lastMapW: 0,
        // Pan limits for the current zoom, written each frame by `draw` so the
        // pointer handlers can apply edge resistance without recomputing them.
        boundX: 0,
        boundY: 0,
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
        }).catch(() => setMapError(true));
    }, []);

    const optimizedDots = useMemo(() => {
        if (!dotData) return [];
        const { cols, rows, dots } = dotData;
        return dots.map(([col, row, code]) => {
            const lon = ((col + 0.5) / cols) * 2 * Math.PI - Math.PI;
            const lat = Math.PI / 2 - ((row + 0.5) / rows) * Math.PI;
            // Only the flat position comes from the projection -- the grid is
            // still lon/lat, so the globe below reads the very same dots.
            const flat = projectEqualEarth(lon, lat);
            const { hScale, vScale } = equalEarthRowScale(lat);
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
                fx: flat.nx,
                fy: flat.ny,
                hScale,
                vScale,
                ux: Math.cos(lat) * Math.sin(lon),
                uy: -Math.sin(lat),
                uz: Math.cos(lat) * Math.cos(lon),
            };
        });
    }, [dotData]);

    /** Which country owns each "col,row" cell. */
    const dotCodes = useMemo(() => new Map(dotData?.dots.map(([col, row, code]) => [`${col},${row}`, code])), [dotData]);

    // The selected country's centre, in radians: the mean of its dots or, for a
    // country too small for the grid (Cyprus, Luxembourg), the caller's point.
    const countryFocus = useMemo(() => {
        if (!focusedCountryCode || !dotData) return null;
        let sumCol = 0;
        let sumRow = 0;
        let count = 0;
        for (const [col, row, code] of dotData.dots) {
            if (code !== focusedCountryCode) continue;
            sumCol += col;
            sumRow += row;
            count++;
        }
        if (count > 0) {
            const avgCol = (sumCol / count) + 0.5;
            const avgRow = (sumRow / count) + 0.5;
            return {
                lon: (avgCol / dotData.cols) * 2 * Math.PI - Math.PI,
                lat: Math.PI / 2 - (avgRow / dotData.rows) * Math.PI,
                dotless: false,
            };
        }
        if (countryPointLat === undefined || countryPointLon === undefined) return null;
        return { lon: (countryPointLon * Math.PI) / 180, lat: (countryPointLat * Math.PI) / 180, dotless: true };
    }, [focusedCountryCode, dotData, countryPointLat, countryPointLon]);

    // The chosen city's dot: the caller's when its own country owns it,
    // otherwise that country's dot nearest the city. A stored dot can belong to
    // a neighbour -- a city in a country with no dots was snapped to the
    // nearest dot anywhere, a border city sometimes across the line -- and
    // ringing that would mark the wrong country. Null where the country has no dots.
    const focusedDotKey = useMemo(() => {
        if (focusLat === undefined || focusLon === undefined || !dotData) return null;
        if (focusCityDotKey && dotCodes.get(focusCityDotKey) === focusCityCountry) return focusCityDotKey;
        const col = ((focusLon + 180) / 360) * dotData.cols - 0.5;
        const row = ((90 - focusLat) / 180) * dotData.rows - 0.5;
        let best: string | null = null;
        let bestDistance = Infinity;
        for (const [dotCol, dotRow, code] of dotData.dots) {
            if (code !== focusCityCountry) continue;
            // Columns wrap at the antimeridian (Fiji, Chukotka).
            const colGap = Math.abs(dotCol - col);
            const distance = Math.min(colGap, dotData.cols - colGap) ** 2 + (dotRow - row) ** 2;
            if (distance < bestDistance) {
                bestDistance = distance;
                best = `${dotCol},${dotRow}`;
            }
        }
        return best;
    }, [focusCityDotKey, focusLat, focusLon, focusCityCountry, dotData, dotCodes]);

    // With no dot to ring, the ring goes on the place itself, in radians: a
    // city in a country with no dots, or such a country with no city chosen.
    const markerPoint = useMemo(() => {
        if (focusLat !== undefined && focusLon !== undefined) {
            return focusedDotKey ? null : { lon: (focusLon * Math.PI) / 180, lat: (focusLat * Math.PI) / 180 };
        }
        return countryFocus?.dotless ? { lon: countryFocus.lon, lat: countryFocus.lat } : null;
    }, [focusLat, focusLon, focusedDotKey, countryFocus]);

    // A place with no dot of its own -- Gibraltar, a city in a country too
    // small for the grid -- is ringed on the grid cell it falls in, so the ring
    // always sits round a dot: the cell's own, shown as selected, or one drawn
    // there. Ringed at its true position it fell between dots, round nothing.
    const markerCell = useMemo(() => {
        if (!markerPoint || !dotData) return null;
        const { cols, rows } = dotData;
        const col = Math.min(cols - 1, Math.max(0, Math.floor(((markerPoint.lon + Math.PI) / (2 * Math.PI)) * cols)));
        const row = Math.min(rows - 1, Math.max(0, Math.floor(((Math.PI / 2 - markerPoint.lat) / Math.PI) * rows)));
        const key = `${col},${row}`;
        return dotCodes.has(key)
            ? { key, lon: 0, lat: 0, hasDot: true }
            : { key, lon: ((col + 0.5) / cols) * 2 * Math.PI - Math.PI, lat: Math.PI / 2 - ((row + 0.5) / rows) * Math.PI, hasDot: false };
    }, [markerPoint, dotData, dotCodes]);
    const ringKey = focusedDotKey ?? (markerCell?.hasDot ? markerCell.key : null);

    // Turn to the selected city, or else the selected country, and hold there.
    // Clearing the selection zooms back out; the idle spin then eases in later.
    const countryLon = countryFocus?.lon;
    const countryLat = countryFocus?.lat;
    const wasFocusedRef = useRef(false);
    useEffect(() => {
        if (!dotData) return;
        let lon: number | null = null;
        let lat: number | null = null;
        let zoom = 1;
        if (focusLat !== undefined && focusLon !== undefined) {
            lon = (focusLon * Math.PI) / 180;
            lat = (focusLat * Math.PI) / 180;
            zoom = FOCUS_ZOOM.city[mode];
        } else if (countryLon !== undefined && countryLat !== undefined) {
            lon = countryLon;
            lat = countryLat;
            zoom = FOCUS_ZOOM.country[mode];
        } else if (focusedCountryCode) {
            // Selected, but too small for the grid and its point not in yet
            // (or never coming, for an uninhabited island): stay put and
            // hold, rather than reading it as a deselect and zooming out.
            dragRef.current.holding = true;
            return;
        }

        const drag = dragRef.current;
        const focusing = lon !== null && lat !== null;
        drag.holding = focusing;
        if (!focusing && !wasFocusedRef.current) return;
        wasFocusedRef.current = focusing;

        drag.targetZoom = zoom;
        drag.lastInteractionTime = performance.now();
        // A selection zooms about the middle of the view, so the per-frame
        // zoom correction has to anchor there, not wherever the wheel last was.
        drag.zoomCursorX = 0;
        drag.zoomCursorY = 0;
        if (lon !== null && lat !== null) {
            drag.targetRotation = lon;
            drag.targetOffsetLat = -lat;
            // The flat map is not a straight col/row scale, so the pan
            // target has to go through the projection too or 2D focus
            // lands beside the country instead of on it.
            const flatCentre = projectEqualEarth(lon, lat);
            drag.targetPanXNorm = flatCentre.nx;
            drag.targetPanYNorm = flatCentre.ny;
        } else {
            drag.targetRotation = null;
            drag.targetOffsetLat = null;
            drag.targetPanXNorm = null;
            drag.targetPanYNorm = null;
        }

        // Cancel the pending frame before asking for another: two requests
        // would leave two loops running, and every easing would run twice.
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        requestRef.current = requestAnimationFrame((t) => {
            animRef.current.lastTime = t;
            drawRef.current(t);
        });
    }, [focusTrigger, focusLat, focusLon, countryLon, countryLat, focusedCountryCode, dotData, mode]);

    const borderSegments = useMemo(() => {
        if (!dotData) return [];
        const { cols, rows, dots } = dotData;
        const grid = dotCodes;

        const segments = [];

        const getLonLat = (x: number, y: number) => {
            const lon = (x / cols) * 2 * Math.PI - Math.PI;
            const lat = Math.PI / 2 - (y / rows) * Math.PI;
            const flat = projectEqualEarth(lon, lat);
            return { lon, lat, fx: flat.nx, fy: flat.ny };
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
                    fx1: p1.fx, fy1: p1.fy,
                    fx2: p2.fx, fy2: p2.fy,
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
                    fx1: p1.fx, fy1: p1.fy,
                    fx2: p2.fx, fy2: p2.fy,
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
                    fx1: p1.fx, fy1: p1.fy,
                    fx2: p2.fx, fy2: p2.fy,
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
                    fx1: p1.fx, fy1: p1.fy,
                    fx2: p2.fx, fy2: p2.fy,
                });
            }
        }
        return segments;
    }, [dotData, dotCodes]);

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


        // With reduced motion every easing lands in one step.
        const reduced = reducedMotionRef.current;
        const step = reduced ? 1 : 0.08;

        if (animRef.current.progress > 0) {
            // Apply momentum / velocity if not dragging
            if (!dragRef.current.isDragging) {
                if (dragRef.current.targetRotation !== null && dragRef.current.targetOffsetLat !== null) {
                    let diff = dragRef.current.targetRotation - animRef.current.rotation;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    
                    animRef.current.rotation += diff * step;
                    dragRef.current.offsetLat += (dragRef.current.targetOffsetLat - dragRef.current.offsetLat) * step;
                    
                    if (Math.abs(diff) < 0.001 && Math.abs(dragRef.current.targetOffsetLat - dragRef.current.offsetLat) < 0.001) {
                        dragRef.current.targetRotation = null;
                        dragRef.current.targetOffsetLat = null;
                    }
                } else if (Math.abs(dragRef.current.velocityX) > 0.0001) {
                    animRef.current.rotation += dragRef.current.velocityX;
                    dragRef.current.velocityX *= 0.95; // friction
                } else if (!reduced && !dragRef.current.holding && time - dragRef.current.lastInteractionTime > IDLE_SPIN_DELAY_MS) {
                    // The slow spin comes up to speed over the ramp, so it
                    // drifts off rather than lurching away at full speed.
                    const ramp = Math.min(1, (time - dragRef.current.lastInteractionTime - IDLE_SPIN_DELAY_MS) / IDLE_SPIN_RAMP_MS);
                    const ease = ramp * ramp * (3 - 2 * ramp);
                    animRef.current.rotation += dt * 0.00008 * animRef.current.progress * ease;

                    // Spring back latitude offset towards 0 gently, on the same ramp
                    if (Math.abs(dragRef.current.offsetLat) > 0.001) {
                        dragRef.current.offsetLat -= dragRef.current.offsetLat * 0.015 * ease;
                    } else {
                        dragRef.current.offsetLat = 0;
                    }
                }
            }
        }
        const dpr = window.devicePixelRatio || 1;
        // At rest a vertical swipe over the map scrolls the page, so the map
        // never traps a phone's scroll; zoomed in, every direction pans it.
        const touchAction = dragRef.current.targetZoom > 1.05 ? 'none' : 'pan-y';
        if (canvas.style.touchAction !== touchAction) canvas.style.touchAction = touchAction;
        const W = canvas.offsetWidth;
        const H = canvas.offsetHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);

        // The flat map is fitted inside the canvas rather than the canvas
        // being resized to it, so the box never moves underneath the drawing
        // and the 2D/3D morph has nothing to keep step with.
        // A phone's slot is far taller than the flat map, and fitting the whole
        // width there left a thin strip of sub-pixel dots in an empty box. A
        // narrow slot fits the height instead and pans sideways.
        const fitHeight = W < 600 && H * EQUAL_EARTH_ASPECT > W;
        const mapW = fitHeight ? H * EQUAL_EARTH_ASPECT : Math.min(W, H * EQUAL_EARTH_ASPECT);
        const mapH = mapW / EQUAL_EARTH_ASPECT;

        // Opening the inspector beside the map narrows the canvas. Pan is in
        // pixels, so it scales with the map or the view slides off its place.
        // A frame with no size (a hidden parent, mid-layout) is skipped, or
        // the pan would be multiplied by nothing and never come back.
        const lastMapW = dragRef.current.lastMapW;
        if (mapW > 0) {
            if (lastMapW > 0 && mapW !== lastMapW) {
                dragRef.current.panX *= mapW / lastMapW;
                dragRef.current.panY *= mapW / lastMapW;
            }
            dragRef.current.lastMapW = mapW;
        }

        const isDark = document.documentElement.classList.contains('dark');

        // Smooth zoom interpolation with cursor-centered pan correction
        const prevZoom = dragRef.current.zoom;
        dragRef.current.zoom += (dragRef.current.targetZoom - dragRef.current.zoom) * (reduced ? 1 : 0.1);
        const curZoom = dragRef.current.zoom;

        // Apply cursor-centered pan correction for this frame's zoom delta (2D only)
        // This keeps the point under the cursor fixed as zoom smoothly changes.
        if (mode === '2d' && Math.abs(curZoom - prevZoom) > 0.0001) {
            const factor = 1 - curZoom / prevZoom;
            dragRef.current.panX += (dragRef.current.zoomCursorX - dragRef.current.panX) * factor;
            dragRef.current.panY += (dragRef.current.zoomCursorY - dragRef.current.panY) * factor;
        }

        // Whether the flat map has come to rest, so the loop can stop.
        let panSettled = true;
        // Clamp 2D pan to prevent wandering infinitely offscreen
        if (mode === '2d') {
            if (!dragRef.current.isDragging && dragRef.current.targetPanXNorm !== null && dragRef.current.targetPanYNorm !== null) {
                const targetPanX = mapW * curZoom * (0.5 - dragRef.current.targetPanXNorm);
                const targetPanY = mapH * curZoom * (0.5 - dragRef.current.targetPanYNorm);
                
                dragRef.current.panX += (targetPanX - dragRef.current.panX) * step;
                dragRef.current.panY += (targetPanY - dragRef.current.panY) * step;
                panSettled = Math.abs(targetPanX - dragRef.current.panX) < 0.5 && Math.abs(targetPanY - dragRef.current.panY) < 0.5;
                // The target is kept as the resting place, not dropped on
                // arrival: past the map's edge (France at this zoom is above
                // the limit) the spring-back would otherwise pull the
                // selection off centre. A drag, the wheel or deselecting
                // releases it.
            }

            // Rubber band rather than a hard stop: a drag may pull the map past
            // its edge, and the moment the finger lifts the excess springs
            // back. The one thing that rests past the edge is a held
            // selection, above, so that it can sit in the middle.
            const maxPanX = Math.max(0, (mapW * curZoom - W) / 2);
            const maxPanY = Math.max(0, (mapH * curZoom - H) / 2);
            dragRef.current.boundX = maxPanX;
            dragRef.current.boundY = maxPanY;

            if (dragRef.current.isDragging) {
                const hardX = maxPanX + PAN_OVERSCROLL;
                const hardY = maxPanY + PAN_OVERSCROLL;
                dragRef.current.panX = Math.max(-hardX, Math.min(hardX, dragRef.current.panX));
                dragRef.current.panY = Math.max(-hardY, Math.min(hardY, dragRef.current.panY));
            } else if (dragRef.current.targetPanXNorm === null && dragRef.current.targetPanYNorm === null) {
                dragRef.current.panX = settlePan(dragRef.current.panX, maxPanX);
                dragRef.current.panY = settlePan(dragRef.current.panY, maxPanY);
                panSettled = Math.abs(dragRef.current.panX) <= maxPanX && Math.abs(dragRef.current.panY) <= maxPanY;
            }
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
        const radiusMultiplier = isMobile ? 0.32 : 0.38;
        const baseRadius = Math.min(dotSpacingX, dotSpacingY) * radiusMultiplier * curZoom;
        // On the globe a column is 2piR/cols wide, not W/cols. On a phone the
        // canvas measure gave dots under a pixel across, so the globe washed
        // out to grey; there they are sized to the globe's own spacing.
        const sphereRadius = isMobile ? Math.max(baseRadius, ((2 * Math.PI * R) / cols) * 0.3) : baseRadius;

        // Equal Earth does not leave the grid even -- it squeezes towards the
        // poles -- so a dot sized for the equator is wrong everywhere else.
        // These are the equatorial spacings each dot's own is measured against.
        const flatSpacingX = mapW / cols;
        const flatSpacingY = (mapH * EQUAL_EARTH_ROW_UNIT) / rows;
        const flatUnit = Math.min(dotSpacingX, dotSpacingY);

        const cosRot = Math.cos(rotation);
        const sinRot = Math.sin(rotation);
        const cosLatOffset = Math.cos(dragRef.current.offsetLat);
        const sinLatOffset = Math.sin(dragRef.current.offsetLat);

        /** A point on the unit sphere, turned and tilted onto the globe. `z` is -1 (back) to 1 (front). */
        const toGlobe = (p: UnitVector) => {
            const x3d = R * p.ux;
            const y3d = R * p.uy;
            const z3d = R * p.uz;
            const x_rot = x3d * cosRot - z3d * sinRot;
            const z_rot = x3d * sinRot + z3d * cosRot;
            const y_tilt = y3d * cosLatOffset - z_rot * sinLatOffset;
            const z_tilt = y3d * sinLatOffset + z_rot * cosLatOffset;
            return { x: W_half + x_rot, y: H_half + y_tilt, z: z_tilt / R };
        };

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
                    let x1 = seg.fx1 * W_zoom + W_offset;
                    let y1 = seg.fy1 * H_zoom + H_offset;
                    let x2 = seg.fx2 * W_zoom + W_offset;
                    let y2 = seg.fy2 * H_zoom + H_offset;
                    let zNorm1 = 1, zNorm2 = 1;

                    if (progress > 0) {
                        const p1Proj = toGlobe(seg.p1);
                        const p2Proj = toGlobe(seg.p2);
                        
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
        let focusedProjected: ProjectedDot | null = null;

        for (const dot of optimizedDots) {
            // Drop dots only in the last few degrees, where even shrinking
            // them cannot keep them apart.
            if (progress > 0.5 && dot.stride > 1 && dot.col % dot.stride !== 0) {
                continue;
            }

            const cx2d = dot.fx * W_zoom + W_offset;
            const cy2d = dot.fy * H_zoom + H_offset;

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
            // A flat dot is an ellipse, because the projection does not
            // stretch a grid cell equally in both directions: Equal Earth
            // squeezes the rows harder than the columns, so a round dot sized
            // to the rows leaves horizontal gaps. Sizing each axis to its own
            // spacing leaves the same proportional gap both ways, which is what
            // reads as an even matrix.
            const flatScaleX = Math.max(0.25, (dot.hScale * flatSpacingX) / flatUnit);
            const flatScaleY = Math.max(0.25, (dot.vScale * flatSpacingY) / flatUnit);
            // A globe has no such stretch: the dots go back to round.
            const sphereScale = Math.max(0.4, 0.6 + 0.4 * zNorm) * polarScale;
            const activeRadiusX = baseRadius * flatScaleX * (1 - progress) + sphereRadius * sphereScale * progress;
            const activeRadiusY = baseRadius * flatScaleY * (1 - progress) + sphereRadius * sphereScale * progress;
            const activeOpacity = 1 * (1 - progress) + Math.max(0.1, 0.45 + 0.55 * zNorm) * progress;

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
            if (dot.dotKey === ringKey) focusedProjected = pDot;
            if (isBack && progress > 0.5) {
                backDots.push(pDot);
            } else {
                frontDots.push(pDot);
            }
        }

        projectedDotsRef.current = newProjected;

        const palette = isDark ? DOT_PALETTE.dark : DOT_PALETTE.light;
        const drawDot = (p: ProjectedDot) => {
            const isCountryVisited = visitedSet.has(p.code);
            const isCityDot = visitedCityDots?.has(p.dotKey) ?? false;
            const isHovered = p.code === hoveredCountry;
            const isCityMode = viewMode === 'cities';

            let color: string;
            let emphasis = 1;

            if (p.dotKey === ringKey) {
                // The chosen place: brighter and larger than any visited dot,
                // and ringed once every dot is down.
                color = palette.selected;
                emphasis = 1.7;
            } else if (isCityMode && isCityDot) {
                color = isHovered ? palette.visitedHovered : palette.city;
                emphasis = isHovered ? 1.55 : 1.4;
            } else if (isCountryVisited) {
                color = isCityMode ? (isHovered ? palette.visited : palette.visitedTint) : (isHovered ? palette.visitedHovered : palette.visited);
                emphasis = isHovered ? 1.35 : isCityMode ? 1 : 1.2;
            } else if (isHovered) {
                color = palette.unvisitedHovered;
                emphasis = 1.2;
            } else {
                color = palette.unvisited;
            }

            ctx.globalAlpha = p.opacity;
            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.ellipse(p.x, p.y, p.rx * emphasis, p.ry * emphasis, 0, 0, Math.PI * 2);
            ctx.fill();
        };

        for (const p of backDots) drawDot(p);
        for (const p of frontDots) drawDot(p);

        // Ring the chosen city's dot or, with no dot to ring, the place itself,
        // unless the globe has turned it away.
        let ring: { x: number; y: number; r: number; opacity: number } | null = null;
        const ringed = focusedProjected;
        if (ringed) {
            if (!(ringed.isBack && progress > 0.5)) ring = { x: ringed.x, y: ringed.y, r: Math.max(ringed.rx, ringed.ry) * 3.2, opacity: ringed.opacity };
        } else if (markerCell && !markerCell.hasDot) {
            // The cell has no dot of its own (open sea round a small island),
            // so one is drawn there: the same flat-to-globe morph the dots go
            // through, for one point.
            const flat = projectEqualEarth(markerCell.lon, markerCell.lat);
            let x = flat.nx * W_zoom + W_offset;
            let y = flat.ny * H_zoom + H_offset;
            let zNorm = 1;
            if (progress > 0) {
                const onGlobe = toGlobe({
                    ux: Math.cos(markerCell.lat) * Math.sin(markerCell.lon),
                    uy: -Math.sin(markerCell.lat),
                    uz: Math.cos(markerCell.lat) * Math.cos(markerCell.lon),
                });
                x += (onGlobe.x - x) * progress;
                y += (onGlobe.y - y) * progress;
                zNorm = onGlobe.z;
            }
            // Faded towards the globe's edge exactly as a dot there would be.
            const opacity = (1 - progress) + Math.max(0.1, 0.45 + 0.55 * zNorm) * progress;
            if (!(zNorm < 0 && progress > 0.5)) {
                const r = baseRadius * 1.7;
                ctx.globalAlpha = opacity;
                ctx.beginPath();
                ctx.fillStyle = palette.selected;
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
                ring = { x, y, r: r * 1.9, opacity };
            }
        }
        if (ring) {
            ctx.globalAlpha = ring.opacity;
            ctx.beginPath();
            ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
            ctx.strokeStyle = palette.ring;
            ctx.lineWidth = isMobile ? 1.25 : 1.5;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        if (progress > 0 || animRef.current.progress !== target) {
            requestRef.current = requestAnimationFrame((t) => draw(t));
        } else if (mode === '2d' && (dragRef.current.isDragging || Math.abs(dragRef.current.targetZoom - curZoom) > 0.01 || !panSettled)) {
            // Keep 2D drawing alive only while it is zooming, panning or
            // springing back -- not for a selection that has come to rest.
            requestRef.current = requestAnimationFrame((t) => draw(t));
        }

    }, [dotData, optimizedDots, borderSegments, visitedSet, visitedCityDots, viewMode, hoveredCountry, mode, stars, ringKey, markerCell]);

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
            releaseTargets(dragRef.current);

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
            // Not cancelled for one finger: that would stop the page scrolling
            // when the swipe turns out to be vertical. touch-action keeps the
            // browser from doing anything else with it.
            if (e.touches.length > 1) e.preventDefault();
            if (e.touches.length === 1) {
                dragRef.current.isDragging = true;
                dragRef.current.touchGesture = canvasRef.current?.style.touchAction === 'pan-y' ? 'undecided' : 'drag';
                dragRef.current.lastX = e.touches[0].clientX;
                dragRef.current.lastY = e.touches[0].clientY;
                dragRef.current.startX = e.touches[0].clientX;
                dragRef.current.startY = e.touches[0].clientY;
                dragRef.current.velocityX = 0;
                dragRef.current.lastInteractionTime = performance.now();
                // A selection is let go only once the finger moves: a tap
                // must not drop it (see touchmove).
            } else if (e.touches.length === 2) {
                // Two fingers are a pinch, which a held selection would fight.
                dragRef.current.touchGesture = 'drag';
                releaseTargets(dragRef.current);
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                dragRef.current.pinchDist = Math.sqrt(dx * dx + dy * dy);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!dotData) return;
            const drag = dragRef.current;
            if (e.touches.length === 1 && drag.touchGesture === 'undecided') {
                const dx = e.touches[0].clientX - drag.startX;
                const dy = e.touches[0].clientY - drag.startY;
                if (Math.hypot(dx, dy) < 6) return;
                drag.touchGesture = Math.abs(dy) > Math.abs(dx) ? 'scroll' : 'drag';
                if (drag.touchGesture === 'scroll') drag.isDragging = false;
            }
            // The page is scrolling: leave the globe where it is.
            if (drag.touchGesture === 'scroll' || !e.cancelable) return;
            e.preventDefault();

            if (e.touches.length === 1 && dragRef.current.isDragging) {
                dragRef.current.lastInteractionTime = performance.now();
                if (movedPastThreshold(dragRef.current, e.touches[0].clientX, e.touches[0].clientY)) releaseTargets(dragRef.current);
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
                    dragRef.current.panX += rubberDelta(dragRef.current.panX, dx, dragRef.current.boundX);
                    dragRef.current.panY += rubberDelta(dragRef.current.panY, dy, dragRef.current.boundY);
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

            // Selection is done here rather than by the click a tap produces,
            // which arrives late and after the touch has already been read.
            // A finger that travelled more than 5px was a drag, not a tap.
            const touch = e.changedTouches[0];
            if (e.touches.length === 0) dragRef.current.touchGesture = 'idle';
            if (!wasDragging || !touch) return;
            const dx = touch.clientX - dragRef.current.startX;
            const dy = touch.clientY - dragRef.current.startY;
            if (Math.sqrt(dx * dx + dy * dy) > 5) return;

            // touchstart no longer cancels a one-finger touch, so the browser
            // would follow this tap with a click that selects a second time.
            if (e.cancelable) e.preventDefault();
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
        // A still click leaves a selection held; moving past the threshold
        // lets it go (see handleMouseMove).
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
            if (movedPastThreshold(dragRef.current, e.clientX, e.clientY)) releaseTargets(dragRef.current);
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
                dragRef.current.panX += rubberDelta(dragRef.current.panX, dx, dragRef.current.boundX);
                dragRef.current.panY += rubberDelta(dragRef.current.panY, dy, dragRef.current.boundY);
            }

            // A resting flat map has stopped its loop, so a drag wakes it.
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            requestRef.current = requestAnimationFrame((t) => drawRef.current(t));
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


    if (mapError) return <div role="status" className="flex min-h-64 items-center justify-center rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">The map is unavailable. You can still explore countries and city journals from the list.</div>;

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
                style={{ width: '100%', height: '100%', cursor: dragRef.current.isDragging ? 'grabbing' : (hoveredCountry ? 'crosshair' : 'grab') }}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
            />
            {/* One bar for both, so on a narrow map the toggle wraps onto a
                line of its own instead of sliding over the label. */}
            {dotData && (
                <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4 z-10 flex flex-wrap items-end justify-between gap-2 pointer-events-none">
                    {/* What gold means, so visited and not visited never rest on
                        telling two shades apart unaided. */}
                    <div className="dot-matrix-legend pointer-events-auto">
                        {viewMode === 'cities' ? (
                            <>
                                <span><i aria-hidden="true" className="dot-matrix-legend-swatch dot-matrix-legend-swatch--city" />City</span>
                                <span><i aria-hidden="true" className="dot-matrix-legend-swatch dot-matrix-legend-swatch--tint" />Country</span>
                            </>
                        ) : (
                            <>
                                <span><i aria-hidden="true" className="dot-matrix-legend-swatch dot-matrix-legend-swatch--visited" />Visited</span>
                                <span><i aria-hidden="true" className="dot-matrix-legend-swatch" />Not yet</span>
                            </>
                        )}
                    </div>
                    {/* Says what you are looking at, and nothing more -- there is one
                        projection now. Hidden over the globe, which is in no projection
                        at all, so the label never names something the map is not.
                        Fades over the 500ms the dots take to roll up into the sphere.
                        Left out on a phone, where the map has no room to spare. */}
                    <div
                        className={`hidden sm:block px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/50 shadow-sm text-xs font-semibold tracking-wider text-muted-foreground whitespace-nowrap cursor-default transition-opacity duration-500 ${
                            mode === '3d' ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
                        }`}
                        title={EQUAL_EARTH_NOTE}
                        aria-hidden={mode === '3d'}
                    >
                        {EQUAL_EARTH_LABEL}
                    </div>
                    <button
                        onClick={() => setMode(m => m === '2d' ? '3d' : '2d')}
                        className="ml-auto flex min-h-9 items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/50 shadow-sm hover:bg-muted text-xs font-semibold tracking-wider text-muted-foreground transition-[background-color,color] duration-300 pointer-events-auto"
                        aria-label="Toggle 3D View"
                        aria-pressed={mode === '3d'}
                    >
                        {mode === '2d' ? <Globe className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                        {/* Short on a phone, so the legend and the toggle share a line. */}
                        <span className="sm:hidden">{mode === '2d' ? '3D' : '2D'}</span>
                        <span className="hidden sm:inline">{mode === '2d' ? '3D Globe' : '2D Map'}</span>
                    </button>
                </div>
            )}
            </div>
        </div>
    );
}

export type { DotMatrixGlobeProps };


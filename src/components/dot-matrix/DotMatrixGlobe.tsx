import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Globe, Map as MapIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { latLngToCell } from 'h3-js';
import {
    EQUAL_EARTH_ASPECT,
    EQUAL_EARTH_LABEL,
    EQUAL_EARTH_NOTE,
    projectEqualEarth,
} from '@/lib/equalEarth';
import {
    BUCKET_COLS,
    BUCKET_ROWS,
    buildCityHexSet,
    getRegionHoverLabel,
    loadHexTier,
    resolveCityHex,
    type HexTierData,
} from './hexMapData';

// Removed d3-geo and topojson
import './DotMatrixGlobe.css';

export interface CountryRegion {
    code: string;
}

interface DotMatrixGlobeProps {
    visitedCountryCodes: string[];
    visitedCityDots?: Set<string>;       // legacy set of "col,row" keys
    visitedCities?: { lat: number; lon: number; countryCode: string }[];
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

interface ProjectedDot {
    x: number;
    y: number;
    rx: number;
    ry: number;
    code: string;
    dotKey: string;
    isBack: boolean;
    opacity: number;
}

interface ProjectedHex extends ProjectedDot {
    vertsX: number[];
    vertsY: number[];
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
 * A dot with no country of its own on the grid (open sea round a small
 * island), drawn for a selection there, is the size of a visited dot.
 */
const MARKER_EMPHASIS = 1.2;

/**
 * Border strength at the whole-world view, and the most it reaches zoomed in.
 * At 0.15 the borders all but vanished under the dots until you zoomed in.
 */
const BORDER_ALPHA = 0.3;
const BORDER_ALPHA_ZOOMED = 0.6;

/**
 * Dot colours, one set per theme. Visited has to read at a glance against not
 * visited, so the two differ in hue, strength and size, never by alpha alone:
 * a faint gold over a faint grey was indistinguishable in either theme. Light
 * uses a deeper amber, because the dark theme's gold washes out on cream.
 */
const DOT_PALETTE = {
    dark: {
        unvisited: 'rgba(237, 227, 207, 0.2)',
        unvisitedHovered: 'rgba(237, 227, 207, 0.58)',
        visited: 'rgba(196, 155, 80, 1)',
        visitedHovered: 'rgba(222, 184, 108, 1)',
        // Cities view: the country is still marked, so its cities stand out of
        // a tinted patch rather than out of the same grey as everywhere else.
        visitedTint: 'rgba(196, 155, 80, 0.36)',
        city: 'rgba(216, 134, 48, 1)',
        // The selection is the one dot in a different hue, matte Indicolite,
        // so it never reads as one more antique brass dot.
        selected: 'rgba(46, 166, 178, 1)',
        selectedGlow: 'rgba(46, 166, 178, 0.5)',
    },
    light: {
        unvisited: 'rgba(31, 25, 36, 0.18)',
        unvisitedHovered: 'rgba(31, 25, 36, 0.58)',
        visited: 'rgba(150, 112, 45, 1)',
        visitedHovered: 'rgba(122, 88, 28, 1)',
        visitedTint: 'rgba(150, 112, 45, 0.34)',
        city: 'rgba(179, 98, 18, 1)',
        selected: 'rgba(15, 100, 109, 1)',
        selectedGlow: 'rgba(15, 100, 109, 0.38)',
    },
} as const;

// Country name lookup - loaded from REST Countries API
let cachedCountryNames: Record<string, string> = {};
let countryNamesPromise: Promise<Record<string, string>> | null = null;

async function loadCountryNames(): Promise<Record<string, string>> {
    if (Object.keys(cachedCountryNames).length > 0) return cachedCountryNames;
    if (!countryNamesPromise) {
        countryNamesPromise = (async () => {
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
        })();
    }
    return countryNamesPromise;
}

/** Prefetches base H3 hex map + country names in the background so Travel paints on frame 1. */
export function warmGlobeData(): void {
    void Promise.all([loadHexTier(3), loadCountryNames()]).catch(() => {});
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
    visitedCities,
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
    const countryPointLat = focusedCountryPoint?.lat;
    const countryPointLon = focusedCountryPoint?.lon;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [baseTier, setBaseTier] = useState<HexTierData | null>(null);
    const activeTier = baseTier;
    const { resolvedTheme } = useTheme();
    const [mapError, setMapError] = useState(false);
    const [countryNames, setCountryNames] = useState<Record<string, string>>(() => cachedCountryNames);
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

    const projectedDotsRef = useRef<ProjectedDot[]>([]);

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

    // Load base H3 tier (res 3) + country names (res 4 loads lazily when zooming in)
    useEffect(() => {
        let active = true;
        Promise.all([loadHexTier(3), loadCountryNames()]).then(([tier, names]) => {
            if (!active) return;
            setBaseTier(tier);
            setCountryNames(names);
        }).catch(() => {
            if (active) setMapError(true);
        });
        return () => { active = false; };
    }, []);

    const visitedCityHexes = useMemo(
        () => buildCityHexSet(visitedCities, activeTier),
        [visitedCities, activeTier],
    );

    // The selected country's centre, in radians: the mean of its hexes or, for a
    // country too small for the active tier (e.g. Liechtenstein), the caller's point.
    const countryFocus = useMemo(() => {
        if (!focusedCountryCode || !activeTier) return null;
        const centroid = activeTier.countryCentroids.get(focusedCountryCode);
        if (centroid) return { lon: centroid.lon, lat: centroid.lat, dotless: false };
        if (countryPointLat === undefined || countryPointLon === undefined) return null;
        return { lon: (countryPointLon * Math.PI) / 180, lat: (countryPointLat * Math.PI) / 180, dotless: true };
    }, [focusedCountryCode, activeTier, countryPointLat, countryPointLon]);

    // The chosen city's hex in the active tier.
    const focusedDotKey = useMemo(() => {
        if (focusLat === undefined || focusLon === undefined || !activeTier) return null;
        return resolveCityHex(focusLat, focusLon, activeTier, focusCityCountry);
    }, [focusLat, focusLon, focusCityCountry, activeTier]);

    // With no hex of its own to light, the place itself, in radians.
    const markerPoint = useMemo(() => {
        if (focusLat !== undefined && focusLon !== undefined) {
            return focusedDotKey ? null : { lon: (focusLon * Math.PI) / 180, lat: (focusLat * Math.PI) / 180 };
        }
        return countryFocus?.dotless ? { lon: countryFocus.lon, lat: countryFocus.lat } : null;
    }, [focusLat, focusLon, focusedDotKey, countryFocus]);

    const markerCell = useMemo(() => {
        if (!markerPoint || !activeTier) return null;
        const latDeg = (markerPoint.lat * 180) / Math.PI;
        const lonDeg = (markerPoint.lon * 180) / Math.PI;
        const key = latLngToCell(latDeg, lonDeg, activeTier.res);
        return activeTier.cellCodes.has(key)
            ? { key, lon: 0, lat: 0, hasDot: true }
            : { key, lon: markerPoint.lon, lat: markerPoint.lat, hasDot: false };
    }, [markerPoint, activeTier]);
    const selectedKey = focusedDotKey ?? (markerCell?.hasDot ? markerCell.key : null);

    // Turn to the selected city, or else the selected country, and hold there.
    const countryLon = countryFocus?.lon;
    const countryLat = countryFocus?.lat;
    const wasFocusedRef = useRef(false);
    useEffect(() => {
        if (!activeTier) return;
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
        drag.zoomCursorX = 0;
        drag.zoomCursorY = 0;
        if (lon !== null && lat !== null) {
            drag.targetRotation = lon;
            drag.targetOffsetLat = -lat;
            const flatCentre = projectEqualEarth(lon, lat);
            drag.targetPanXNorm = flatCentre.nx;
            drag.targetPanYNorm = flatCentre.ny;
        } else {
            drag.targetRotation = null;
            drag.targetOffsetLat = null;
            drag.targetPanXNorm = null;
            drag.targetPanYNorm = null;
        }

        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        requestRef.current = requestAnimationFrame((t) => {
            animRef.current.lastTime = t;
            drawRef.current(t);
        });
    }, [focusTrigger, focusLat, focusLon, countryLon, countryLat, focusedCountryCode, activeTier, mode]);

    // Draw the map
    const draw = useCallback((time: number) => {
        const canvas = canvasRef.current;
        if (!canvas || !baseTier) return;

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

        const W_half = W / 2;
        const H_half = H / 2;
        const W_zoom = mapW * curZoom;
        const H_zoom = mapH * curZoom;
        const W_offset = W_half - (mapW * curZoom) / 2 + panX;
        const H_offset = H_half - (mapH * curZoom) / 2 + panY;
        const isMobile = W < 600;

        const cosRot = Math.cos(rotation);
        const sinRot = Math.sin(rotation);
        const cosLatOffset = Math.cos(dragRef.current.offsetLat);
        const sinLatOffset = Math.sin(dragRef.current.offsetLat);

        /** A point on the unit sphere, turned and tilted onto the globe. `z` is -1 (back) to 1 (front). */
        const toGlobe = (p: { ux: number; uy: number; uz: number }) => {
            const x3d = R * p.ux;
            const y3d = R * p.uy;
            const z3d = R * p.uz;
            const x_rot = x3d * cosRot - z3d * sinRot;
            const z_rot = x3d * sinRot + z3d * cosRot;
            const y_tilt = y3d * cosLatOffset - z_rot * sinLatOffset;
            const z_tilt = y3d * sinLatOffset + z_rot * cosLatOffset;
            return { x: W_half + x_rot, y: H_half + y_tilt, z: z_tilt / R };
        };

        const palette = isDark ? DOT_PALETTE.dark : DOT_PALETTE.light;
        const safetyMargin = 80;
        const isInteracting = dragRef.current.isDragging || Math.abs(dragRef.current.targetZoom - curZoom) > 0.04;
        let focusedProjected: ProjectedHex | null = null;
        let hemisphereDrawn = false;

        const traceHexIntoPath = (cx: number, cy: number, vertsX: number[], vertsY: number[], scale: number) => {
            for (let i = 0; i < vertsX.length; i++) {
                const px = cx + (vertsX[i] - cx) * scale;
                const py = cy + (vertsY[i] - cy) * scale;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
        };

        const renderTier = (tier: HexTierData, tierAlpha: number, collectHitMap: boolean) => {
            if (tierAlpha <= 0.01) return;

            const isCityMode = viewMode === 'cities';
            const approxHexRadius = (mapW / (tier.res === 4 ? 340 : 135)) * curZoom;
            const shouldUpdateHitMap = collectHitMap && !isInteracting;

            // --- Fast 2D Path: spatial-bucket viewport culling + color-batched Path2D ---
            if (progress === 0) {
                const nxMin = (-safetyMargin - W_offset) / W_zoom;
                const nxMax = (W + safetyMargin - W_offset) / W_zoom;
                const nyMin = (-safetyMargin - H_offset) / H_zoom;
                const nyMax = (H + safetyMargin - H_offset) / H_zoom;

                const bxMin = Math.max(0, Math.min(BUCKET_COLS - 1, Math.floor(nxMin * BUCKET_COLS) - 1));
                const bxMax = Math.max(0, Math.min(BUCKET_COLS - 1, Math.floor(nxMax * BUCKET_COLS) + 1));
                const byMin = Math.max(0, Math.min(BUCKET_ROWS - 1, Math.floor(nyMin * BUCKET_ROWS) - 1));
                const byMax = Math.max(0, Math.min(BUCKET_ROWS - 1, Math.floor(nyMax * BUCKET_ROWS) + 1));

                // 1. Borders in visible buckets only
                const dynamicAlpha = Math.min(BORDER_ALPHA_ZOOMED, BORDER_ALPHA + Math.max(0, curZoom - 1.0) * 0.1);
                const finalBorderAlpha = dynamicAlpha * tierAlpha;
                if (finalBorderAlpha > 0.015) {
                    ctx.globalAlpha = finalBorderAlpha;
                    ctx.beginPath();
                    for (let by = byMin; by <= byMax; by++) {
                        const rowOffset = by * BUCKET_COLS;
                        for (let bx = bxMin; bx <= bxMax; bx++) {
                            const bucket = tier.borderBuckets[rowOffset + bx];
                            for (let s = 0; s < bucket.length; s++) {
                                const seg = bucket[s];
                                const x1 = seg.fx1 * W_zoom + W_offset;
                                const y1 = seg.fy1 * H_zoom + H_offset;
                                const x2 = seg.fx2 * W_zoom + W_offset;
                                const y2 = seg.fy2 * H_zoom + H_offset;
                                if (
                                    (x1 < -safetyMargin && x2 < -safetyMargin) ||
                                    (x1 > W + safetyMargin && x2 > W + safetyMargin) ||
                                    (y1 < -safetyMargin && y2 < -safetyMargin) ||
                                    (y1 > H + safetyMargin && y2 > H + safetyMargin)
                                ) {
                                    continue;
                                }
                                ctx.moveTo(x1, y1);
                                ctx.lineTo(x2, y2);
                            }
                        }
                    }
                    ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
                    const baseWidth = isMobile ? 0.6 : 0.9;
                    ctx.lineWidth = Math.min(2.6, baseWidth * Math.pow(curZoom, 0.45)) * dpr;
                    ctx.stroke();
                }

                // 2. Hexes in visible buckets only, batched by color (4-5 draw calls total)
                const colorPaths = new Map<string, Path2D>();
                const newProjected: ProjectedDot[] = [];

                for (let by = byMin; by <= byMax; by++) {
                    const rowOffset = by * BUCKET_COLS;
                    for (let bx = bxMin; bx <= bxMax; bx++) {
                        const bucket = tier.cellBuckets[rowOffset + bx];
                        for (let c = 0; c < bucket.length; c++) {
                            const cell = bucket[c];
                            const cx = cell.center2d.nx * W_zoom + W_offset;
                            const cy = cell.center2d.ny * H_zoom + H_offset;
                            if (cx < -safetyMargin || cx > W + safetyMargin || cy < -safetyMargin || cy > H + safetyMargin) {
                                continue;
                            }

                            if (shouldUpdateHitMap) {
                                newProjected.push({
                                    x: cx,
                                    y: cy,
                                    rx: approxHexRadius,
                                    ry: approxHexRadius,
                                    code: cell.code,
                                    dotKey: cell.h3Index,
                                    isBack: false,
                                    opacity: 1,
                                });
                            }

                            const isSelected = cell.h3Index === selectedKey;
                            if (collectHitMap && isSelected) {
                                const vertsX: number[] = [];
                                const vertsY: number[] = [];
                                for (let i = 0; i < cell.verts2d.length; i++) {
                                    vertsX.push(cell.verts2d[i].nx * W_zoom + W_offset);
                                    vertsY.push(cell.verts2d[i].ny * H_zoom + H_offset);
                                }
                                focusedProjected = {
                                    x: cx,
                                    y: cy,
                                    rx: approxHexRadius,
                                    ry: approxHexRadius,
                                    code: cell.code,
                                    dotKey: cell.h3Index,
                                    isBack: false,
                                    opacity: tierAlpha,
                                    vertsX,
                                    vertsY,
                                };
                            }

                            const isCountryVisited = visitedSet.has(cell.code);
                            const isCityDot = visitedCityHexes.has(cell.h3Index) || (visitedCityDots?.has(cell.h3Index) ?? false);
                            const isHovered = cell.code === hoveredCountry;

                            let color: string;
                            let fillScale = 0.84;

                            if (isSelected) {
                                color = palette.selected;
                                fillScale = 0.92;
                            } else if (isCityMode && (isCityDot || cell.h3Index === focusedDotKey)) {
                                color = isHovered ? palette.visitedHovered : palette.city;
                                fillScale = isHovered ? 0.96 : 0.92;
                            } else if (isCountryVisited) {
                                color = isCityMode
                                    ? (isHovered ? palette.visited : palette.visitedTint)
                                    : (isHovered ? palette.visitedHovered : palette.visited);
                                fillScale = isHovered ? 0.94 : isCityMode ? 0.84 : 0.9;
                            } else if (isHovered) {
                                color = palette.unvisitedHovered;
                                fillScale = 0.9;
                            } else {
                                color = palette.unvisited;
                            }

                            let path = colorPaths.get(color);
                            if (!path) {
                                path = new Path2D();
                                colorPaths.set(color, path);
                            }

                            const v2 = cell.verts2d;
                            for (let i = 0; i < v2.length; i++) {
                                const vx = v2[i].nx * W_zoom + W_offset;
                                const vy = v2[i].ny * H_zoom + H_offset;
                                const px = cx + (vx - cx) * fillScale;
                                const py = cy + (vy - cy) * fillScale;
                                if (i === 0) path.moveTo(px, py);
                                else path.lineTo(px, py);
                            }
                            path.closePath();
                        }
                    }
                }

                ctx.globalAlpha = tierAlpha;
                for (const [color, path] of colorPaths) {
                    ctx.fillStyle = color;
                    ctx.fill(path);
                }
                ctx.globalAlpha = 1;
                if (shouldUpdateHitMap) {
                    projectedDotsRef.current = newProjected;
                }
                return;
            }

            // --- 3D / Morph Path (inlined rotation math, zero per-vertex allocations) ---
            const { borderSegments, cells } = tier;
            if (borderSegments.length > 0) {
                let borderAlpha = BORDER_ALPHA;
                let drawHemisphere = false;

                if (progress === 1) {
                    drawHemisphere = true;
                } else if (progress > 0) {
                    const threshold = 0.15;
                    if (progress > 1 - threshold) {
                        drawHemisphere = true;
                        borderAlpha = BORDER_ALPHA * ((progress - (1 - threshold)) / threshold);
                    } else if (progress < threshold) {
                        borderAlpha = BORDER_ALPHA * (1 - (progress / threshold));
                    } else {
                        borderAlpha = 0;
                    }
                }

                const finalBorderAlpha = borderAlpha * tierAlpha;
                if (finalBorderAlpha > 0.015) {
                    ctx.globalAlpha = finalBorderAlpha;
                    ctx.beginPath();
                    for (let s = 0; s < borderSegments.length; s++) {
                        const seg = borderSegments[s];
                        if (progress < 0.5 && seg.crossesAntimeridian) continue;

                        const p1 = seg.p1;
                        const x1_3 = R * p1.ux;
                        const y1_3 = R * p1.uy;
                        const z1_3 = R * p1.uz;
                        const x1_r = x1_3 * cosRot - z1_3 * sinRot;
                        const z1_r = x1_3 * sinRot + z1_3 * cosRot;
                        const y1_t = y1_3 * cosLatOffset - z1_r * sinLatOffset;
                        const z1_t = y1_3 * sinLatOffset + z1_r * cosLatOffset;

                        const p2 = seg.p2;
                        const x2_3 = R * p2.ux;
                        const y2_3 = R * p2.uy;
                        const z2_3 = R * p2.uz;
                        const x2_r = x2_3 * cosRot - z2_3 * sinRot;
                        const z2_r = x2_3 * sinRot + z2_3 * cosRot;
                        const y2_t = y2_3 * cosLatOffset - z2_r * sinLatOffset;
                        const z2_t = y2_3 * sinLatOffset + z2_r * cosLatOffset;

                        if (progress > 0.5 && z1_t < 0 && z2_t < 0) continue;

                        let x1 = W_half + x1_r;
                        let y1 = H_half + y1_t;
                        let x2 = W_half + x2_r;
                        let y2 = H_half + y2_t;

                        if (progress < 1) {
                            const fx1 = seg.fx1 * W_zoom + W_offset;
                            const fy1 = seg.fy1 * H_zoom + H_offset;
                            const fx2 = seg.fx2 * W_zoom + W_offset;
                            const fy2 = seg.fy2 * H_zoom + H_offset;
                            x1 = fx1 + (x1 - fx1) * progress;
                            y1 = fy1 + (y1 - fy1) * progress;
                            x2 = fx2 + (x2 - fx2) * progress;
                            y2 = fy2 + (y2 - fy2) * progress;
                        }

                        if (
                            (x1 < -safetyMargin && x2 < -safetyMargin) ||
                            (x1 > W + safetyMargin && x2 > W + safetyMargin) ||
                            (y1 < -safetyMargin && y2 < -safetyMargin) ||
                            (y1 > H + safetyMargin && y2 > H + safetyMargin)
                        ) {
                            continue;
                        }

                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                    }

                    ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
                    const baseWidth = isMobile ? 0.6 : 0.9;
                    ctx.lineWidth = Math.min(2.6, baseWidth * Math.pow(curZoom, 0.45)) * dpr;
                    ctx.stroke();

                    if (drawHemisphere && !hemisphereDrawn) {
                        hemisphereDrawn = true;
                        ctx.globalAlpha = (borderAlpha / BORDER_ALPHA) * 0.05;
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
            const batches = new Map<string, { color: string; alpha: number; path: Path2D }>();

            for (let c = 0; c < cells.length; c++) {
                const cell = cells[c];
                if (progress < 0.5 && cell.crossesAntimeridian) continue;

                const c3 = cell.center3d;
                const cx3 = R * c3.ux;
                const cy3 = R * c3.uy;
                const cz3 = R * c3.uz;
                const cxr = cx3 * cosRot - cz3 * sinRot;
                const czr = cx3 * sinRot + cz3 * cosRot;
                const cyt = cy3 * cosLatOffset - czr * sinLatOffset;
                const czt = cy3 * sinLatOffset + czr * cosLatOffset;
                const isBack = czt < 0;
                if (isBack && progress > 0.85) continue;

                let cx = W_half + cxr;
                let cy = H_half + cyt;
                if (progress < 1) {
                    const cx2d = cell.center2d.nx * W_zoom + W_offset;
                    const cy2d = cell.center2d.ny * H_zoom + H_offset;
                    cx = cx2d + (cx - cx2d) * progress;
                    cy = cy2d + (cy - cy2d) * progress;
                }

                if (cx < -safetyMargin || cx > W + safetyMargin || cy < -safetyMargin || cy > H + safetyMargin) {
                    continue;
                }

                const zNorm = czt / R;
                const rawOpacity = 1 * (1 - progress) + Math.max(0.1, 0.45 + 0.55 * zNorm) * progress;

                if (shouldUpdateHitMap) {
                    newProjected.push({
                        x: cx,
                        y: cy,
                        rx: approxHexRadius,
                        ry: approxHexRadius,
                        code: cell.code,
                        dotKey: cell.h3Index,
                        isBack,
                        opacity: rawOpacity,
                    });
                }

                const isSelected = cell.h3Index === selectedKey;
                if (collectHitMap && isSelected) {
                    const vertsX: number[] = [];
                    const vertsY: number[] = [];
                    for (let i = 0; i < cell.verts3d.length; i++) {
                        const vp = toGlobe(cell.verts3d[i]);
                        if (progress < 1) {
                            const vx2 = cell.verts2d[i].nx * W_zoom + W_offset;
                            const vy2 = cell.verts2d[i].ny * H_zoom + H_offset;
                            vertsX.push(vx2 + (vp.x - vx2) * progress);
                            vertsY.push(vy2 + (vp.y - vy2) * progress);
                        } else {
                            vertsX.push(vp.x);
                            vertsY.push(vp.y);
                        }
                    }
                    focusedProjected = {
                        x: cx,
                        y: cy,
                        rx: approxHexRadius,
                        ry: approxHexRadius,
                        code: cell.code,
                        dotKey: cell.h3Index,
                        isBack,
                        opacity: rawOpacity * tierAlpha,
                        vertsX,
                        vertsY,
                    };
                }

                const isCountryVisited = visitedSet.has(cell.code);
                const isCityDot = visitedCityHexes.has(cell.h3Index) || (visitedCityDots?.has(cell.h3Index) ?? false);
                const isHovered = cell.code === hoveredCountry;

                let color: string;
                let fillScale = 0.84;

                if (isSelected) {
                    color = palette.selected;
                    fillScale = 0.92;
                } else if (isCityMode && (isCityDot || cell.h3Index === focusedDotKey)) {
                    color = isHovered ? palette.visitedHovered : palette.city;
                    fillScale = isHovered ? 0.96 : 0.92;
                } else if (isCountryVisited) {
                    color = isCityMode
                        ? (isHovered ? palette.visited : palette.visitedTint)
                        : (isHovered ? palette.visitedHovered : palette.visited);
                    fillScale = isHovered ? 0.94 : isCityMode ? 0.84 : 0.9;
                } else if (isHovered) {
                    color = palette.unvisitedHovered;
                    fillScale = 0.9;
                } else {
                    color = palette.unvisited;
                }

                const bucketIdx = Math.max(0, Math.min(6, Math.round(rawOpacity * 6)));
                const bucketAlpha = (bucketIdx / 6) * tierAlpha;
                const batchKey = `${color}|${bucketIdx}`;
                let batch = batches.get(batchKey);
                if (!batch) {
                    batch = { color, alpha: bucketAlpha, path: new Path2D() };
                    batches.set(batchKey, batch);
                }

                const batchPath = batch.path;
                const v3 = cell.verts3d;
                const v2 = cell.verts2d;
                for (let i = 0; i < v3.length; i++) {
                    const u = v3[i];
                    const vx3 = R * u.ux;
                    const vy3 = R * u.uy;
                    const vz3 = R * u.uz;
                    const vxr = vx3 * cosRot - vz3 * sinRot;
                    const vzr = vx3 * sinRot + vz3 * cosRot;
                    const vyt = vy3 * cosLatOffset - vzr * sinLatOffset;
                    let vx = W_half + vxr;
                    let vy = H_half + vyt;
                    if (progress < 1) {
                        const vx2 = v2[i].nx * W_zoom + W_offset;
                        const vy2 = v2[i].ny * H_zoom + H_offset;
                        vx = vx2 + (vx - vx2) * progress;
                        vy = vy2 + (vy - vy2) * progress;
                    }
                    const px = cx + (vx - cx) * fillScale;
                    const py = cy + (vy - cy) * fillScale;
                    if (i === 0) batchPath.moveTo(px, py);
                    else batchPath.lineTo(px, py);
                }
                batchPath.closePath();
            }

            if (shouldUpdateHitMap) {
                projectedDotsRef.current = newProjected;
            }

            for (const batch of batches.values()) {
                if (batch.alpha <= 0.01) continue;
                ctx.globalAlpha = batch.alpha;
                ctx.fillStyle = batch.color;
                ctx.fill(batch.path);
            }
            ctx.globalAlpha = 1;
        };

        if (baseTier) {
            renderTier(baseTier, 1, true);
        }

        const drawSelectedHex = (p: ProjectedHex) => {
            ctx.save();
            ctx.globalAlpha = p.opacity;
            ctx.shadowColor = palette.selectedGlow;
            ctx.shadowBlur = Math.max(4, p.rx * 1.5) * dpr;
            ctx.fillStyle = palette.selected;
            ctx.beginPath();
            traceHexIntoPath(p.x, p.y, p.vertsX, p.vertsY, 0.95);
            ctx.fill();
            ctx.restore();
        };

        if (focusedProjected) {
            if (!(focusedProjected.isBack && progress > 0.5)) {
                drawSelectedHex(focusedProjected);
            }
        } else if (markerCell && !markerCell.hasDot) {
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
            const opacity = (1 - progress) + Math.max(0.1, 0.45 + 0.55 * zNorm) * progress;
            if (!(zNorm < 0 && progress > 0.5)) {
                const r = Math.max(2.5, (mapW / 180) * 0.45 * curZoom) * MARKER_EMPHASIS;
                ctx.save();
                ctx.globalAlpha = opacity;
                ctx.shadowColor = palette.selectedGlow;
                ctx.shadowBlur = Math.max(4, r * 1.5) * dpr;
                ctx.fillStyle = palette.selected;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    const px = x + r * Math.cos(angle);
                    const py = y + r * Math.sin(angle);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        }

        if (progress > 0 || animRef.current.progress !== target) {
            requestRef.current = requestAnimationFrame((t) => draw(t));
        } else if (mode === '2d' && (dragRef.current.isDragging || Math.abs(dragRef.current.targetZoom - curZoom) > 0.01 || !panSettled)) {
            requestRef.current = requestAnimationFrame((t) => draw(t));
        }

    }, [baseTier, visitedSet, visitedCityHexes, visitedCityDots, viewMode, hoveredCountry, mode, stars, focusedDotKey, selectedKey, markerCell]);

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
        const baseName = countryNames[code] ?? code;
        const hoverLabel = getRegionHoverLabel(code, dotKey, baseName);
        onCountryHover?.(code, hoverLabel, `https://flagcdn.com/w80/${code.toLowerCase()}.png`, dotKey);
        onCountryClick?.(code, baseName);
    }, [countryAtPoint, countryNames, onCountryHover, onCountryClick]);

    // Mouse events
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (!activeTier) return;
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
            if (!activeTier) return;
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
            if (!activeTier) return;
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
            const gesture = dragRef.current.touchGesture;
            if (e.touches.length === 0) dragRef.current.touchGesture = 'idle';
            // touchstart no longer cancels a one-finger touch, so the browser
            // follows it with mouse events and a click. After a pan that click
            // would select whatever is under the finger, and after a tap it
            // would select a second time; the touch has been read here already.
            if (gesture !== 'scroll' && e.cancelable) e.preventDefault();
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
    }, [activeTier, mode, draw, selectAtPoint]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!activeTier) return;
        dragRef.current.isDragging = true;
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        dragRef.current.velocityX = 0;
        dragRef.current.lastInteractionTime = performance.now();
        // A still click leaves a selection held; moving past the threshold
        // lets it go (see handleMouseMove).
    }, [activeTier]);

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
            const baseName = foundCode ? (countryNames[foundCode] ?? foundCode) : null;
            const hoverLabel = foundCode && baseName ? getRegionHoverLabel(foundCode, foundDotKey, baseName) : null;
            onCountryHover?.(foundCode, hoverLabel, flagUrl, foundDotKey);
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


    // The legend's swatches are the draw loop's own colours, so the two cannot drift.
    const legendPalette = resolvedTheme === 'dark' ? DOT_PALETTE.dark : DOT_PALETTE.light;

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
            {!activeTier && (
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
            {activeTier && (
                <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4 z-10 flex flex-wrap items-end justify-between gap-2 pointer-events-none">
                    {/* What gold means, so visited and not visited never rest on
                        telling two shades apart unaided. */}
                    <div className="dot-matrix-legend">
                        {viewMode === 'cities' ? (
                            <>
                                <span><i aria-hidden="true" className="dot-matrix-legend-swatch" style={{ background: legendPalette.city, boxShadow: `0 0 0 2px ${legendPalette.visitedTint}` }} />City</span>
                                <span><i aria-hidden="true" className="dot-matrix-legend-swatch" style={{ background: legendPalette.visitedTint }} />Country</span>
                            </>
                        ) : (
                            <>
                                <span><i aria-hidden="true" className="dot-matrix-legend-swatch" style={{ background: legendPalette.visited }} />Visited</span>
                                <span><i aria-hidden="true" className="dot-matrix-legend-swatch" style={{ background: legendPalette.unvisited }} />Not yet</span>
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


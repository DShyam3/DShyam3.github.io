import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronDown, Globe, Lock, LockOpen, Map as MapIcon, Minus, Plus } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cellToLatLng, getResolution, latLngToCell } from 'h3-js';
import {
    MAP_PROJECTIONS,
    getMapProjection,
    isMapProjectionId,
    type MapProjectionId,
} from '@/lib/mapProjections';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    buildCityHexSet,
    degToUnit,
    getRegionHoverLabel,
    hexAtPoint,
    hexSpacingRad,
    loadHexTier,
    projectTier,
    resolveCityHex,
    type HexCell,
    type HexTierData,
} from './hexMapData';
import { mapPointAt, projectToGlobe, type GlobeView } from './globeProjection';
import { createHexGlRenderer, type HexGlRenderer } from './hexGlRenderer';
import {
    cellHideBelow,
    codeOf,
    detailHexAtPoint,
    hexCellOf,
    resolveDetailCityHex,
    type DetailRes,
    type HexDetailLookup,
} from './hexDetail';
import { hexPlaceLabel, loadRegionLevel } from './hexRegions';
import { HEX_KM, HexLevels, LOCKED_LEVEL5_MIN_PX, type HexSizeLock, type ShownRes } from './hexLevels';
import {
    BORDER_ALPHA,
    BORDER_ALPHA_ZOOMED,
    CELL_STYLE,
    CELL_STYLES,
    DOT_PALETTE,
    DRAG_RAD_PER_PX,
    FOCUS_ZOOM,
    HEX_SIZE_CHOICES,
    HEX_SIZE_STORAGE_KEY,
    HIT_SLOP_PX,
    HOVER_OUTLINE_MIN_PX,
    IDLE_SPIN_DELAY_MS,
    IDLE_SPIN_RAMP_MS,
    MARKER_EMPHASIS,
    MAX_ZOOM,
    NO_CELLS,
    NO_HIT,
    PAN_OVERSCROLL,
    PROJECTION_STORAGE_KEY,
    SPIN_LOCK_MS,
    STYLE_CSS,
    STYLE_GL,
    WHEEL_MAX_PX,
    WHEEL_ZOOM_PER_PX,
    ZOOM_BUTTON_STEP,
    cachedCountryNames,
    cellStyle,
    drawCellsCanvas,
    easeOver,
    fillCellStyles,
    fitFlatMap,
    loadCountryNames,
    movedPastThreshold,
    placeSelectedHex,
    projectionOutline,
    readStoredHexSize,
    readStoredProjection,
    releaseTargets,
    rubberDelta,
    settlePan,
    type HexSizeChoice,
    type SelectedHex,
    type StyleInputs,
} from './globeHelpers';

export { warmGlobeData } from './globeHelpers';

import './DotMatrixGlobe.css';

export interface CountryRegion {
    code: string;
}

interface DotMatrixGlobeProps {
    visitedCountryCodes: string[];
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

export function DotMatrixGlobe({
    visitedCountryCodes,
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
    const glCanvasRef = useRef<HTMLCanvasElement>(null);
    // Under the hexes: the sea.
    const oceanCanvasRef = useRef<HTMLCanvasElement>(null);
    const glRef = useRef<HexGlRenderer | null>(null);
    const [loadedTier, setLoadedTier] = useState<HexTierData | null>(null);
    const [projectionId, setProjectionId] = useState<MapProjectionId>(readStoredProjection);
    const projection = getMapProjection(projectionId);
    // The tier with its flat-map side in the chosen projection; the globe side is the same in all of them.
    const baseTier = useMemo(() => (loadedTier ? projectTier(loadedTier, projection) : null), [loadedTier, projection]);
    const activeTier = baseTier;
    const { resolvedTheme } = useTheme();
    const [mapError, setMapError] = useState(false);
    const [countryNames, setCountryNames] = useState<Record<string, string>>(() => cachedCountryNames);
    const visitedSet = useMemo(() => new Set(visitedCountryCodes), [visitedCountryCodes]);
    const [mode, setMode] = useState<'2d' | '3d'>('3d');
    // Read per frame rather than as state: it changes how far each easing step
    // goes, not what is drawn, so it never needs a render of its own.
    const reducedMotionRef = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    // Hover lives in refs, not state. As state it re-rendered this component
    // on every country the pointer crossed, which rebuilt `draw` and with it
    // every listener below; now a hover only rewrites the cell styles.
    const hoveredCountryRef = useRef<string | null>(null);
    const lastHoverRef = useRef('');
    // One byte per cell (see CELL_STYLE), rebuilt only when what it depends on changes.
    const stylesRef = useRef(new Uint8Array(0));
    const stylesDirtyRef = useRef(true);
    // Bumped whenever the style inputs change; each patch restyles itself when it next draws.
    const styleVersionRef = useRef(0);
    // The finer hex levels and their patches (see hexLevels.ts).
    const [levels] = useState(() => new HexLevels());
    const [hexSize, setHexSize] = useState<HexSizeChoice>(readStoredHexSize);
    // The size on screen, for the control's readout; set from the frame when it changes.
    const [shownRes, setShownRes] = useState<ShownRes>(3);
    const shownResRef = useRef<ShownRes>(3);
    // Whether the WebGL renderer is up: the finer sizes, and so the size menu, need it.
    const [glReady, setGlReady] = useState(false);
    // The lock button: until this time (performance.now) the globe does not
    // spin by itself or ease back level; 0 when unlocked.
    const spinLockUntilRef = useRef(0);
    const [spinLocked, setSpinLocked] = useState(false);
    // The hovered cell's outline at a finer level, kept between frames.
    const hoverCellRef = useRef<{ key: string; projection: string; cell: HexCell } | null>(null);
    // The last frame's view, so a pointer can be worked back to a place.
    const viewRef = useRef<GlobeView | null>(null);
    // Off screen, the loop sleeps rather than drawing what nobody can see.
    const visibleRef = useRef(true);
    const spinTimerRef = useRef<number>();

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
        // The last frame's time, or -1 while the loop sleeps: a frame after a
        // nap must not count the nap as one long step.
        lastTime: -1,
    });
    const requestRef = useRef<number>();

    // `draw` is declared further down the component, so it cannot go in the
    // dependency array of the effects above it without a TDZ error. This ref
    // hands them the current version without re-running them every time draw
    // is rebuilt.
    const drawRef = useRef<(time: number) => void>(() => {});

    /**
     * Asks for one frame. The loop runs only while something moves -- a drag,
     * momentum, an ease, the morph, the idle spin -- and each frame asks for
     * the next only if it still is. At rest the globe costs nothing.
     */
    const requestDraw = useCallback(() => {
        if (requestRef.current !== undefined) return;
        requestRef.current = requestAnimationFrame((t) => {
            requestRef.current = undefined;
            drawRef.current(t);
        });
    }, []);

    // Turning reduced motion off has to wake a resting globe, or its idle spin
    // waits for an interaction.
    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = () => {
            reducedMotionRef.current = query.matches;
            requestDraw();
        };
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }, [requestDraw]);

    const stars = useMemo(() => {
        return Array.from({ length: 400 }).map(() => ({
            x: Math.random(),
            y: Math.random(),
            r: Math.random() * 1.5 + 0.3,
            opacity: Math.random() * 0.8 + 0.2,
        }));
    }, []);

    const shootingStarRef = useRef({ active: false, x: 0, y: 0, length: 0, speed: 0, angle: 0, progress: 0 });

    // Load base H3 tier (res 3) + country names
    useEffect(() => {
        let active = true;
        Promise.all([loadHexTier(3), loadCountryNames()]).then(([tier, names]) => {
            if (!active) return;
            setLoadedTier(tier);
            setCountryNames(names);
        }).catch(() => {
            if (active) setMapError(true);
        });
        return () => { active = false; };
    }, []);

    // The WebGL renderer, where the browser has one; otherwise the canvas 2D path draws.
    useEffect(() => {
        const canvas = glCanvasRef.current;
        if (!baseTier || !canvas) return;
        let renderer: HexGlRenderer | null = null;
        try {
            renderer = createHexGlRenderer(canvas, CELL_STYLES.length, () => {
                glRef.current = null;
                setGlReady(false);
                requestDraw();
            });
        } catch {
            // A shader the driver rejects is as good as no WebGL: fall back.
            renderer = null;
        }
        levels.reset(renderer, baseTier, projection);
        glRef.current = renderer;
        setGlReady(renderer !== null);
        stylesDirtyRef.current = true;
        requestDraw();
        return () => {
            glRef.current = null;
            renderer?.dispose();
        };
    }, [baseTier, levels, projection, requestDraw]);

    // A finer level loading, or a patch of one arriving from the worker, needs a frame.
    useEffect(() => {
        levels.setOnChange(requestDraw);
        return () => levels.dispose();
    }, [levels, requestDraw]);

    useEffect(() => {
        levels.setLock(hexSize === 'auto' ? null : (hexSize as HexSizeLock));
        requestDraw();
    }, [levels, hexSize, requestDraw]);

    /**
     * The lock button: stops the globe turning by itself, and easing back
     * level, for two minutes; a second press lets it go sooner.
     */
    const toggleSpinLock = useCallback(() => {
        const locking = spinLockUntilRef.current <= performance.now();
        spinLockUntilRef.current = locking ? performance.now() + SPIN_LOCK_MS : 0;
        setSpinLocked(locking);
        requestDraw();
    }, [requestDraw]);

    // Unlocks the button once its two minutes are up.
    useEffect(() => {
        if (!spinLocked) return;
        const timer = window.setTimeout(() => {
            spinLockUntilRef.current = 0;
            setSpinLocked(false);
            requestDraw();
        }, Math.max(0, spinLockUntilRef.current - performance.now()));
        return () => window.clearTimeout(timer);
    }, [spinLocked, requestDraw]);

    /** Zooms in or out by a step, about the middle of the view. */
    const zoomBy = useCallback((factor: number) => {
        const drag = dragRef.current;
        const minZ = mode === '2d' ? 1.0 : 0.98;
        drag.targetZoom = Math.max(minZ, Math.min(MAX_ZOOM, drag.targetZoom * factor));
        drag.zoomCursorX = 0;
        drag.zoomCursorY = 0;
        drag.lastInteractionTime = performance.now();
        requestDraw();
    }, [mode, requestDraw]);

    /**
     * 17 km hexes only show zoomed in: zooms in to where they do, in the
     * mode showing, whose scale at a given zoom differs (the globe is larger
     * than the flat map at the same zoom).
     */
    const zoomToLevel5 = useCallback(() => {
        const view = viewRef.current;
        if (!view) return;
        const base = mode === '3d' ? Math.min(view.width, view.height) * 0.45 : fitFlatMap(view.width, view.height, projection.aspect).mapW / (2 * Math.PI);
        if (base <= 0) return;
        const drag = dragRef.current;
        const needed = (LOCKED_LEVEL5_MIN_PX * 1.5) / (hexSpacingRad(5) * base);
        if (drag.targetZoom >= needed) return;
        drag.targetZoom = Math.min(MAX_ZOOM, needed);
        drag.zoomCursorX = 0;
        drag.zoomCursorY = 0;
        drag.lastInteractionTime = performance.now();
        requestDraw();
    }, [mode, projection, requestDraw]);

    /** Holds a hex size, or lets the zoom choose again. */
    const chooseHexSize = useCallback((value: string) => {
        const next: HexSizeChoice = value === 'auto' ? 'auto' : (Number(value) as ShownRes);
        setHexSize(next);
        try {
            window.localStorage.setItem(HEX_SIZE_STORAGE_KEY, String(next));
        } catch {
            // Storage refused (a private window): the choice lasts the visit.
        }
        if (next === 5) zoomToLevel5();
        requestDraw();
    }, [requestDraw, zoomToLevel5]);

    // Holding 17 km and switching between globe and flat map: the flat map is
    // smaller at the same zoom, so it zooms in again to keep them showing.
    useEffect(() => {
        if (hexSize === 5) zoomToLevel5();
    }, [hexSize, zoomToLevel5]);

    const visitedCityHexes = useMemo(
        () => buildCityHexSet(visitedCities, activeTier),
        [visitedCities, activeTier],
    );

    const hexSpacing = useMemo(() => (baseTier ? hexSpacingRad(baseTier.res) : 0), [baseTier]);

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

    // The finer levels' visited cities and selection, worked out per level the
    // first time it draws after any of these change.
    const detailInputs = useMemo(
        () => ({ visitedCities, focusLat, focusLon, focusCityCountry, markerPoint }),
        [visitedCities, focusLat, focusLon, focusCityCountry, markerPoint],
    );
    const detailInfoRef = useRef(new Map<DetailRes, {
        level: HexDetailLookup;
        inputs: typeof detailInputs;
        cities: Set<string>;
        selected: string | null;
    }>());
    const detailInfo = useCallback((res: DetailRes) => {
        const level = levels.level(res);
        if (!level) return null;
        const cached = detailInfoRef.current.get(res);
        if (cached && cached.level === level && cached.inputs === detailInputs) return cached;
        const cities = new Set<string>();
        for (const city of detailInputs.visitedCities ?? []) {
            const key = resolveDetailCityHex(city.lat, city.lon, level, city.countryCode);
            if (key) cities.add(key);
        }
        let selected: string | null = null;
        if (detailInputs.focusLat !== undefined && detailInputs.focusLon !== undefined) {
            selected = resolveDetailCityHex(detailInputs.focusLat, detailInputs.focusLon, level, detailInputs.focusCityCountry);
        } else if (detailInputs.markerPoint) {
            const { lat, lon } = detailInputs.markerPoint;
            const key = latLngToCell((lat * 180) / Math.PI, (lon * 180) / Math.PI, res);
            selected = codeOf(level, key) !== undefined ? key : null;
        }
        const info = { level, inputs: detailInputs, cities, selected };
        detailInfoRef.current.set(res, info);
        return info;
    }, [levels, detailInputs]);
    // The selected cell's outline at a finer level, kept between frames.
    const selectedCellRef = useRef<{ key: string; projection: string; cell: HexCell } | null>(null);

    // Turn to the selected city, or else the selected country, and hold there.
    const countryLon = countryFocus?.lon;
    const countryLat = countryFocus?.lat;
    const wasFocusedRef = useRef(false);
    // Read by the focus effect without being one of its triggers: re-running
    // the focus on a switch would reset a zoom the user chose. A switch moves
    // the held pan target itself, in `chooseProjection`.
    const projectionRef = useRef(projection);
    useEffect(() => {
        projectionRef.current = projection;
    }, [projection]);
    useEffect(() => {
        if (!loadedTier) return;
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
            // Selected, but with nowhere to turn to: hold still. The frame
            // lets a running spin see the hold; deselecting, below, wakes it.
            dragRef.current.holding = true;
            requestDraw();
            return;
        }

        const drag = dragRef.current;
        const focusing = lon !== null && lat !== null;
        drag.holding = focusing;
        if (!focusing && !wasFocusedRef.current) {
            // Let go of a hold that never turned the globe: the spin may resume.
            requestDraw();
            return;
        }
        wasFocusedRef.current = focusing;

        drag.targetZoom = zoom;
        drag.lastInteractionTime = performance.now();
        drag.zoomCursorX = 0;
        drag.zoomCursorY = 0;
        if (lon !== null && lat !== null) {
            drag.targetRotation = lon;
            drag.targetOffsetLat = -lat;
            // A place past the projection's cut (Antarctica on Mercator) has
            // nowhere on the flat map to pan to; the zoom alone applies.
            const flat = projectionRef.current;
            const flatCentre = lat >= flat.minLat && lat <= flat.maxLat ? flat.project(lon, lat) : null;
            drag.targetPanXNorm = flatCentre?.nx ?? null;
            drag.targetPanYNorm = flatCentre?.ny ?? null;
        } else {
            drag.targetRotation = null;
            drag.targetOffsetLat = null;
            drag.targetPanXNorm = null;
            drag.targetPanYNorm = null;
        }
        requestDraw();
    }, [focusTrigger, focusLat, focusLon, countryLon, countryLat, focusedCountryCode, loadedTier, mode, requestDraw]);

    // Draw the map
    const draw = useCallback((time: number) => {
        const canvas = canvasRef.current;
        if (!canvas || !baseTier) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const drag = dragRef.current;
        const anim = animRef.current;

        // Waking from sleep, the gap is not a step. A slow frame (the canvas 2D
        // path) still is, capped so a stall cannot jump the morph to its end.
        const dt = anim.lastTime < 0 ? 1000 / 60 : Math.min(Math.max(0, time - anim.lastTime), 100);
        anim.lastTime = time;

        const target = mode === '3d' ? 1 : 0;
        const speed = 0.002; // transition speed
        if (anim.progress < target) {
            anim.progress = Math.min(target, anim.progress + dt * speed);
        } else if (anim.progress > target) {
            anim.progress = Math.max(target, anim.progress - dt * speed);
        }

        // With reduced motion every easing lands in one step.
        const reduced = reducedMotionRef.current;
        const step = reduced ? 1 : easeOver(0.08, dt);
        const gl = glRef.current;
        let spinning = false;

        // Apply momentum / velocity if not dragging
        if (anim.progress > 0 && !drag.isDragging) {
            if (drag.targetRotation !== null && drag.targetOffsetLat !== null) {
                let diff = drag.targetRotation - anim.rotation;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;

                anim.rotation += diff * step;
                drag.offsetLat += (drag.targetOffsetLat - drag.offsetLat) * step;

                if (Math.abs(diff) < 0.001 && Math.abs(drag.targetOffsetLat - drag.offsetLat) < 0.001) {
                    drag.targetRotation = null;
                    drag.targetOffsetLat = null;
                }
            } else if (Math.abs(drag.velocityX) > 0.0001) {
                anim.rotation += drag.velocityX;
                drag.velocityX *= 0.95; // friction
            } else if (gl && !reduced && !drag.holding && performance.now() >= spinLockUntilRef.current && time - drag.lastInteractionTime > IDLE_SPIN_DELAY_MS) {
                // WebGL only: on the canvas 2D path every frame of a spin
                // that never ends is the 40ms path rebuild, for ever.
                spinning = true;
                // The slow spin comes up to speed over the ramp, so it
                // drifts off rather than lurching away at full speed.
                const ramp = Math.min(1, (time - drag.lastInteractionTime - IDLE_SPIN_DELAY_MS) / IDLE_SPIN_RAMP_MS);
                const ease = ramp * ramp * (3 - 2 * ramp);
                // Slower as it zooms in, so the spin crosses the screen at the same pace.
                anim.rotation += (dt * 0.00008 * anim.progress * ease) / drag.zoom;

                // Spring back latitude offset towards 0 gently, on the same ramp
                if (Math.abs(drag.offsetLat) > 0.001) {
                    drag.offsetLat -= drag.offsetLat * easeOver(0.015 * ease, dt);
                } else {
                    drag.offsetLat = 0;
                }
            }
        }
        const dpr = window.devicePixelRatio || 1;
        // At rest a vertical swipe over the map scrolls the page, so the map
        // never traps a phone's scroll; zoomed in, every direction pans it.
        const touchAction = drag.targetZoom > 1.05 ? 'none' : 'pan-y';
        if (canvas.style.touchAction !== touchAction) canvas.style.touchAction = touchAction;
        const W = canvas.offsetWidth;
        const H = canvas.offsetHeight;
        // Setting a canvas's size reallocates it, so only when the box or the
        // screen actually changed -- not every frame, as it used to.
        const pixelW = Math.round(W * dpr);
        const pixelH = Math.round(H * dpr);
        if (canvas.width !== pixelW) canvas.width = pixelW;
        if (canvas.height !== pixelH) canvas.height = pixelH;
        // Cleared in device pixels: at a fractional ratio the rounded backing
        // store is wider than W * dpr, and its last column would keep old paint.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Fitted inside the canvas, so the 2D/3D morph has nothing to keep step with.
        const { mapW, mapH } = fitFlatMap(W, H, projection.aspect);

        // Opening the inspector beside the map narrows the canvas. Pan is in
        // pixels, so it scales with the map or the view slides off its place.
        // A frame with no size (a hidden parent, mid-layout) is skipped, or
        // the pan would be multiplied by nothing and never come back.
        const lastMapW = drag.lastMapW;
        if (mapW > 0) {
            if (lastMapW > 0 && mapW !== lastMapW) {
                drag.panX *= mapW / lastMapW;
                drag.panY *= mapW / lastMapW;
            }
            drag.lastMapW = mapW;
        }

        const isDark = document.documentElement.classList.contains('dark');

        // Smooth zoom interpolation with cursor-centered pan correction
        const prevZoom = drag.zoom;
        drag.zoom += (drag.targetZoom - drag.zoom) * (reduced ? 1 : easeOver(0.1, dt));
        // Land on the target rather than creep at it for ever, which would
        // keep the loop awake.
        if (Math.abs(drag.targetZoom - drag.zoom) < 0.0005) drag.zoom = drag.targetZoom;
        const curZoom = drag.zoom;

        // Apply cursor-centered pan correction for this frame's zoom delta (2D only)
        // This keeps the point under the cursor fixed as zoom smoothly changes.
        if (mode === '2d' && Math.abs(curZoom - prevZoom) > 0.0001) {
            const factor = 1 - curZoom / prevZoom;
            drag.panX += (drag.zoomCursorX - drag.panX) * factor;
            drag.panY += (drag.zoomCursorY - drag.panY) * factor;
        }

        // Whether the flat map has come to rest, so the loop can stop.
        let panSettled = true;
        // Clamp 2D pan to prevent wandering infinitely offscreen
        if (mode === '2d') {
            if (!drag.isDragging && drag.targetPanXNorm !== null && drag.targetPanYNorm !== null) {
                const targetPanX = mapW * curZoom * (0.5 - drag.targetPanXNorm);
                const targetPanY = mapH * curZoom * (0.5 - drag.targetPanYNorm);

                drag.panX += (targetPanX - drag.panX) * step;
                drag.panY += (targetPanY - drag.panY) * step;
                panSettled = Math.abs(targetPanX - drag.panX) < 0.5 && Math.abs(targetPanY - drag.panY) < 0.5;
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
            drag.boundX = maxPanX;
            drag.boundY = maxPanY;

            if (drag.isDragging) {
                const hardX = maxPanX + PAN_OVERSCROLL;
                const hardY = maxPanY + PAN_OVERSCROLL;
                drag.panX = Math.max(-hardX, Math.min(hardX, drag.panX));
                drag.panY = Math.max(-hardY, Math.min(hardY, drag.panY));
            } else if (drag.targetPanXNorm === null && drag.targetPanYNorm === null) {
                drag.panX = settlePan(drag.panX, maxPanX, dt);
                drag.panY = settlePan(drag.panY, maxPanY, dt);
                panSettled = Math.abs(drag.panX) <= maxPanX && Math.abs(drag.panY) <= maxPanY;
            }
        }

        const { panX, panY } = drag;
        const { progress, rotation } = anim;
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
            const py = panY * 0.05 - drag.offsetLat * 50;

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
        } else {
            // No sky on the flat map. A star mid-flight when it flattened
            // would otherwise stay in flight, and keep the loop awake, for ever.
            shootingStarRef.current.active = false;
        }

        const W_zoom = mapW * curZoom;
        const H_zoom = mapH * curZoom;
        const isMobile = W < 600;

        const view: GlobeView = {
            width: W,
            height: H,
            dpr,
            radius: R,
            cosRot: Math.cos(rotation),
            sinRot: Math.sin(rotation),
            cosLat: Math.cos(drag.offsetLat),
            sinLat: Math.sin(drag.offsetLat),
            flatW: W_zoom,
            flatH: H_zoom,
            flatX: W / 2 - W_zoom / 2 + panX,
            flatY: H / 2 - H_zoom / 2 + panY,
            progress,
        };
        viewRef.current = view;

        // The sea, under the hexes: the globe's disc, shaded as a sphere, and
        // the flat map's outline, crossing over as the morph goes.
        const ocean = oceanCanvasRef.current;
        const oceanCtx = ocean?.getContext('2d');
        if (ocean && oceanCtx) {
            if (ocean.width !== pixelW) ocean.width = pixelW;
            if (ocean.height !== pixelH) ocean.height = pixelH;
            oceanCtx.setTransform(1, 0, 0, 1, 0, 0);
            oceanCtx.clearRect(0, 0, ocean.width, ocean.height);
            oceanCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const sea = isDark ? DOT_PALETTE.dark : DOT_PALETTE.light;
            // Only with WebGL, which lays the land under its hexes: canvas 2D
            // does not, and its translucent hexes would take the sea's colour.
            if (gl && progress > 0) {
                const shade = oceanCtx.createRadialGradient(W / 2 - R * 0.25, H / 2 - R * 0.25, R * 0.05, W / 2, H / 2, R);
                shade.addColorStop(0, sea.ocean);
                shade.addColorStop(1, sea.oceanEdge);
                oceanCtx.globalAlpha = progress;
                oceanCtx.fillStyle = shade;
                oceanCtx.beginPath();
                oceanCtx.arc(W / 2, H / 2, R, 0, Math.PI * 2);
                oceanCtx.fill();
            }
            if (gl && progress < 1) {
                const outline = projectionOutline(projection);
                oceanCtx.globalAlpha = 1 - progress;
                oceanCtx.fillStyle = sea.ocean;
                oceanCtx.beginPath();
                for (let i = 0; i < outline.length; i += 2) {
                    const x = view.flatX + outline[i] * view.flatW;
                    const y = view.flatY + outline[i + 1] * view.flatH;
                    if (i === 0) oceanCtx.moveTo(x, y);
                    else oceanCtx.lineTo(x, y);
                }
                oceanCtx.closePath();
                oceanCtx.fill();
            }
            oceanCtx.globalAlpha = 1;
        }

        const palette = isDark ? DOT_PALETTE.dark : DOT_PALETTE.light;

        const cellCount = baseTier.cells.length;
        if (stylesRef.current.length !== cellCount) {
            stylesRef.current = new Uint8Array(cellCount);
            stylesDirtyRef.current = true;
        }
        const styles = stylesRef.current;
        if (stylesDirtyRef.current) {
            fillCellStyles(styles, baseTier, {
                visited: visitedSet,
                cityHexes: visitedCityHexes,
                cities: viewMode === 'cities',
                hovered: hoveredCountryRef.current,
                hoveredKey: drag.hoveredDotKey,
                selected: selectedKey,
                focusedDot: focusedDotKey,
            });
            styleVersionRef.current++;
            stylesDirtyRef.current = false;
        }

        // Border strength. On the flat map it firms up as you zoom in; through
        // the morph it fades out and back, so it never smears across the move.
        let borderAlpha: number;
        let drawHemisphere = false;
        if (progress === 0) {
            borderAlpha = Math.min(BORDER_ALPHA_ZOOMED, BORDER_ALPHA + Math.max(0, curZoom - 1.0) * 0.1);
        } else {
            borderAlpha = BORDER_ALPHA;
            const threshold = 0.15;
            if (progress === 1) {
                drawHemisphere = true;
            } else if (progress > 1 - threshold) {
                drawHemisphere = true;
                borderAlpha = BORDER_ALPHA * ((progress - (1 - threshold)) / threshold);
            } else if (progress < threshold) {
                borderAlpha = BORDER_ALPHA * (1 - (progress / threshold));
            } else {
                borderAlpha = 0;
            }
        }
        const borderWidthCss = Math.min(2.6, (isMobile ? 0.6 : 0.9) * Math.pow(curZoom, 0.45));

        if (drawHemisphere && borderAlpha > 0.015) {
            ctx.globalAlpha = (borderAlpha / BORDER_ALPHA) * 0.05;
            ctx.beginPath();
            ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2);
            ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
            ctx.lineWidth = 1 * dpr;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        let levelsFading = false;
        if (gl) {
            const hovered = hoveredCountryRef.current;
            const hoveredKey = drag.hoveredDotKey;
            const inputsByRes = new Map<DetailRes, StyleInputs>();
            const frame = levels.frame(view, dt, progress >= 0.5 ? R : W_zoom / (2 * Math.PI), {
                version: styleVersionRef.current,
                base: styles,
                detail: (res, key, code) => {
                    let inputs = inputsByRes.get(res);
                    if (!inputs) {
                        const info = detailInfo(res);
                        inputs = {
                            visited: visitedSet,
                            cityHexes: info?.cities ?? NO_CELLS,
                            cities: viewMode === 'cities',
                            hovered,
                            hoveredKey,
                            selected: info?.selected ?? null,
                            focusedDot: null,
                        };
                        inputsByRes.set(res, inputs);
                    }
                    return cellStyle(key, code, inputs);
                },
            }, reduced);
            levelsFading = frame.fading;
            if (levels.shownRes !== shownResRef.current) {
                shownResRef.current = levels.shownRes;
                setShownRes(levels.shownRes);
            }
            gl.render(view, isDark ? STYLE_GL.dark : STYLE_GL.light, {
                shade: isDark ? 1 : 0,
                alpha: borderAlpha,
                halfWidth: borderWidthCss / 2,
            }, frame.draws);
        } else {
            drawCellsCanvas(ctx, baseTier, styles, isDark ? STYLE_CSS.dark : STYLE_CSS.light, view, {
                color: isDark ? '#ffffff' : '#000000',
                alpha: borderAlpha,
                width: borderWidthCss * dpr,
            });
        }

        const traceHexIntoPath = (cx: number, cy: number, vertsX: number[], vertsY: number[], scale: number) => {
            for (let i = 0; i < vertsX.length; i++) {
                const px = cx + (vertsX[i] - cx) * scale;
                const py = cy + (vertsY[i] - cy) * scale;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
        };

        const drawSelectedHex = (p: SelectedHex) => {
            ctx.save();
            ctx.globalAlpha = p.opacity;
            ctx.shadowColor = palette.selectedGlow;
            ctx.shadowBlur = Math.max(4, p.radius * 1.5) * dpr;
            ctx.fillStyle = palette.selected;
            ctx.beginPath();
            traceHexIntoPath(p.x, p.y, p.vertsX, p.vertsY, 0.95);
            ctx.fill();
            ctx.restore();
        };

        const selectedIndex = selectedKey ? baseTier.cellIndexByH3.get(selectedKey) : undefined;
        if (selectedIndex !== undefined) {
            // Outlined at whichever level its part of the map is showing --
            // judged where the finer cell sits, which can be a ring or two
            // from the base cell, over the next patch.
            let cell = baseTier.cells[selectedIndex];
            let res = 3;
            for (const r of gl ? ([5, 4] as DetailRes[]) : []) {
                const key = detailInfo(r)?.selected;
                if (!key) continue;
                const kept = selectedCellRef.current;
                const detailCell = kept && kept.key === key && kept.projection === projection.id ? kept.cell : hexCellOf(key, projection);
                selectedCellRef.current = { key, projection: projection.id, cell: detailCell };
                if (levels.shownAt(detailCell.lat, detailCell.lon) === r) {
                    cell = detailCell;
                    res = r;
                    break;
                }
            }
            const scale = hexSpacingRad(res) / hexSpacingRad(3);
            const hex = placeSelectedHex(cell, view, (mapW / 135) * curZoom * scale);
            if (hex) drawSelectedHex(hex);
        } else if (markerCell && !markerCell.hasDot) {
            const flat = projection.project(markerCell.lon, markerCell.lat);
            let x = flat.nx * W_zoom + view.flatX;
            let y = flat.ny * H_zoom + view.flatY;
            let zNorm = 1;
            if (progress > 0) {
                const onGlobe = projectToGlobe(view, {
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

        // The hex under the pointer, outlined, so a name on hover is plainly
        // this hex's -- once hexes are big enough to point at one by one.
        const hoverKey = drag.hoveredDotKey;
        if (hoverKey && hoverKey !== selectedKey && !drag.isDragging) {
            const res = getResolution(hoverKey);
            const pxPerRad = progress >= 0.5 ? R : W_zoom / (2 * Math.PI);
            if (hexSpacingRad(res) * pxPerRad >= HOVER_OUTLINE_MIN_PX) {
                let cell: HexCell | undefined;
                if (res === 3) {
                    const index = baseTier.cellIndexByH3.get(hoverKey);
                    cell = index === undefined ? undefined : baseTier.cells[index];
                } else {
                    const kept = hoverCellRef.current;
                    cell = kept && kept.key === hoverKey && kept.projection === projection.id ? kept.cell : hexCellOf(hoverKey, projection);
                    hoverCellRef.current = { key: hoverKey, projection: projection.id, cell };
                }
                const hex = cell ? placeSelectedHex(cell, view, 0) : null;
                if (hex) {
                    ctx.save();
                    ctx.globalAlpha = hex.opacity;
                    ctx.strokeStyle = palette.selected;
                    ctx.lineWidth = 1.5;
                    ctx.lineJoin = 'round';
                    ctx.beginPath();
                    traceHexIntoPath(hex.x, hex.y, hex.vertsX, hex.vertsY, 0.92);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }

        // Ask for another frame only while something is still moving.
        const moving =
            levelsFading ||
            anim.progress !== target ||
            (anim.progress > 0 && !drag.isDragging && (drag.targetRotation !== null || Math.abs(drag.velocityX) > 0.0001)) ||
            drag.zoom !== drag.targetZoom ||
            (mode === '2d' && !panSettled) ||
            spinning ||
            shootingStarRef.current.active;

        if (spinTimerRef.current !== undefined) {
            window.clearTimeout(spinTimerRef.current);
            spinTimerRef.current = undefined;
        }
        // Off screen, stop; coming back into view wakes the loop.
        if (!visibleRef.current) {
            anim.lastTime = -1;
            return;
        }
        if (moving) {
            requestDraw();
            return;
        }
        anim.lastTime = -1;
        if (gl && anim.progress > 0 && !reduced && !drag.holding) {
            // At rest on the globe: wake when the idle spin is due to start,
            // or when the lock runs out, whichever is later.
            const wait = Math.max(
                IDLE_SPIN_DELAY_MS - (time - drag.lastInteractionTime),
                spinLockUntilRef.current - performance.now(),
            );
            spinTimerRef.current = window.setTimeout(requestDraw, Math.max(0, wait) + 16);
        }
    }, [baseTier, projection, levels, detailInfo, visitedSet, visitedCityHexes, viewMode, mode, stars, focusedDotKey, selectedKey, markerCell, requestDraw]);

    drawRef.current = draw;

    // Anything `draw` depends on changed what is drawn: restyle and redraw.
    useEffect(() => {
        stylesDirtyRef.current = true;
        requestDraw();
    }, [draw, requestDraw]);

    // The palette is read from the page's theme class each frame, so a sleeping
    // loop has to be woken to repaint in the new one.
    useEffect(() => {
        requestDraw();
    }, [resolvedTheme, requestDraw]);

    // Stop the loop and the idle-spin wake-up with the component.
    useEffect(() => () => {
        if (requestRef.current !== undefined) cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
        if (spinTimerRef.current !== undefined) window.clearTimeout(spinTimerRef.current);
    }, []);

    // Handle resize
    useEffect(() => {
        const observer = new ResizeObserver(() => requestDraw());
        if (canvasRef.current) observer.observe(canvasRef.current);
        return () => observer.disconnect();
    }, [requestDraw]);

    // A move to a screen of another pixel ratio changes no CSS size, so the
    // resize observer misses it; the backing stores would stay at the old one.
    useEffect(() => {
        let query: MediaQueryList | null = null;
        function onChange() {
            requestDraw();
            watch();
        }
        function watch() {
            query?.removeEventListener('change', onChange);
            query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
            query.addEventListener('change', onChange);
        }
        watch();
        return () => query?.removeEventListener('change', onChange);
    }, [requestDraw]);

    // Sleep while scrolled out of view; wake on the way back in.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(([entry]) => {
            const wasVisible = visibleRef.current;
            visibleRef.current = entry.isIntersecting;
            if (!wasVisible && entry.isIntersecting) requestDraw();
        });
        observer.observe(canvas);
        return () => observer.disconnect();
    }, [requestDraw]);

    /**
     * Switches the flat map's projection without moving what you are looking
     * at. Pan is in pixels, and the same pixels are somewhere else in another
     * projection, so a held selection's target is carried across, and
     * otherwise the place in the middle of the view is.
     */
    const chooseProjection = useCallback((value: string) => {
        if (!isMapProjectionId(value) || value === projectionId) return;
        const next = getMapProjection(value);
        const view = viewRef.current;
        const drag = dragRef.current;
        if (drag.targetPanXNorm !== null && drag.targetPanYNorm !== null) {
            const place = projection.unproject(drag.targetPanXNorm, drag.targetPanYNorm);
            const flat = place && place.lat >= next.minLat && place.lat <= next.maxLat
                ? next.project(place.lon, place.lat)
                : null;
            drag.targetPanXNorm = flat?.nx ?? null;
            drag.targetPanYNorm = flat?.ny ?? null;
        } else if (view && view.progress === 0 && drag.zoom > 1.05) {
            // Set outright rather than as a target, which would be held: the
            // spring back inside the map's edge then runs as usual.
            const centre = projection.unproject(
                (view.width / 2 - view.flatX) / view.flatW,
                (view.height / 2 - view.flatY) / view.flatH,
            );
            if (centre) {
                const flat = next.project(centre.lon, centre.lat);
                const { mapW, mapH } = fitFlatMap(view.width, view.height, next.aspect);
                drag.panX = mapW * drag.zoom * (0.5 - flat.nx);
                drag.panY = mapH * drag.zoom * (0.5 - flat.ny);
                // Already in the new map's pixels: the next frame must not rescale it.
                drag.lastMapW = mapW;
            }
        }
        setProjectionId(value);
        try {
            window.localStorage.setItem(PROJECTION_STORAGE_KEY, value);
        } catch {
            // Storage refused (a private window): the choice lasts the visit.
        }
        requestDraw();
    }, [projection, projectionId, requestDraw]);

    /**
     * Which country's cell sits under a viewport point, if any. The pointer is
     * worked back through the projection to a place and H3 names its cell --
     * constant time, where scanning every drawn cell meant rebuilding a list
     * of thousands of them each frame.
     */
    const countryAtPoint = useCallback((clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        const view = viewRef.current;
        const tier = baseTier;
        if (!canvas || !view || !tier) return NO_HIT;

        const rect = canvas.getBoundingClientRect();
        const place = mapPointAt(view, clientX - rect.left, clientY - rect.top, projection);
        if (!place) return NO_HIT;
        const latDeg = (place.lat * 180) / Math.PI;
        const lonDeg = (place.lon * 180) / Math.PI;
        const pxPerRad = view.progress === 1 ? view.radius : view.flatW / (2 * Math.PI);

        // Picked from whichever level this part of the map is showing.
        const res = glRef.current ? levels.shownAt(place.lat, place.lon) : 3;
        const level = res > 3 ? levels.level(res as DetailRes) : undefined;
        if (level) {
            const px = hexSpacingRad(res) * pxPerRad;
            const reach = Math.max(0, Math.min(3, Math.ceil(HIT_SLOP_PX / Math.max(px, 0.1)) - 1));
            const shown = view.progress === 1
                ? (cell: string) => {
                    const [lat, lon] = cellToLatLng(cell);
                    return projectToGlobe(view, degToUnit(lat, lon).unit).z >= 0;
                }
                : (cell: string) => cellHideBelow(projection, cell) === 0;
            const key = detailHexAtPoint(latDeg, lonDeg, level, reach, shown);
            return key ? { code: codeOf(level, key) ?? null, dotKey: key } : NO_HIT;
        }

        const cellPx = hexSpacing * pxPerRad;
        const ring = Math.max(0, Math.min(3, Math.ceil(HIT_SLOP_PX / Math.max(cellPx, 0.1)) - 1));
        // Only a cell that is drawn: the globe hides its back, and the flat map
        // the cells that straddle the antimeridian.
        const drawn = view.progress === 1
            ? (cell: HexCell) => projectToGlobe(view, cell.center3d).z >= 0
            : (cell: HexCell) => cell.hideBelow === 0;
        const dotKey = hexAtPoint(latDeg, lonDeg, tier, ring, drawn);
        if (!dotKey) return NO_HIT;
        return { code: tier.cellCodes.get(dotKey) ?? null, dotKey };
    }, [baseTier, hexSpacing, levels, projection]);

    /**
     * Tells the page about a hover. Each report re-renders the Travel page, so
     * it hears only of changes it shows: the country, the region label and,
     * in the cities view, the hex.
     */
    const emitHover = useCallback((code: string | null, dotKey: string | null) => {
        const name = code ? (countryNames[code] ?? code) : null;
        // The city view names the hex itself: its largest town and its state,
        // once that level's regions have loaded.
        const place = viewMode === 'cities' && code && name && dotKey ? hexPlaceLabel(dotKey, name) : null;
        const label = code && name ? (place ?? getRegionHoverLabel(code, dotKey, name)) : null;
        const key = `${code ?? ''}|${label ?? ''}|${viewMode === 'cities' ? (dotKey ?? '') : ''}`;
        if (key === lastHoverRef.current) return;
        lastHoverRef.current = key;
        onCountryHover?.(code, label, code ? `https://flagcdn.com/w80/${code.toLowerCase()}.png` : null, dotKey);
    }, [countryNames, viewMode, onCountryHover]);

    // The city view's region names for the level on screen, fetched when it is
    // first needed; a hover waiting on them is named again once they land.
    useEffect(() => {
        if (viewMode !== 'cities') return;
        let active = true;
        loadRegionLevel(shownRes)
            .then(() => {
                if (!active) return;
                lastHoverRef.current = '';
                emitHover(hoveredCountryRef.current, dragRef.current.hoveredDotKey);
            })
            .catch(() => {
                // Without them the hover names the country, as it always did.
            });
        return () => {
            active = false;
        };
    }, [viewMode, shownRes, emitHover]);

    const setHover = useCallback((code: string | null, dotKey: string | null) => {
        const drag = dragRef.current;
        if (code !== hoveredCountryRef.current) {
            hoveredCountryRef.current = code;
            stylesDirtyRef.current = true;
            requestDraw();
        } else if (dotKey !== drag.hoveredDotKey) {
            // Same country, another hex: the outline moves with the pointer,
            // and on the city view, where the hex itself lights, so do the styles.
            if (viewMode === 'cities') stylesDirtyRef.current = true;
            requestDraw();
        }
        drag.hoveredDotKey = dotKey;
        const canvas = canvasRef.current;
        if (canvas) canvas.style.cursor = drag.isDragging ? 'grabbing' : (code ? 'crosshair' : 'grab');
        emitHover(code, dotKey);
    }, [emitHover, requestDraw, viewMode]);

    /** Select whatever is under a point: shared by a mouse click and a tap. */
    const selectAtPoint = useCallback((clientX: number, clientY: number) => {
        const { code, dotKey } = countryAtPoint(clientX, clientY);
        if (!code) return;

        // A tap has no hover pass before it, so light up the country as well as
        // selecting it -- otherwise the map would jump with nothing highlighted.
        setHover(code, dotKey);
        onCountryClick?.(code, countryNames[code] ?? code);
    }, [countryAtPoint, countryNames, onCountryClick, setHover]);

    // Mouse events
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (!activeTier) return;
            e.preventDefault();
            dragRef.current.lastInteractionTime = performance.now();
            releaseTargets(dragRef.current);

            // Lines (Firefox) and pages arrive as counts, not pixels.
            const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 800 : 1;
            const px = Math.max(-WHEEL_MAX_PX, Math.min(WHEEL_MAX_PX, e.deltaY * unit));
            const minZ = mode === '2d' ? 1.0 : 0.98;
            dragRef.current.targetZoom = Math.max(minZ, Math.min(MAX_ZOOM, dragRef.current.targetZoom * Math.exp(-px * WHEEL_ZOOM_PER_PX)));

            // Store cursor position for cursor-centered zooming (applied per-frame in draw())
            if (mode === '2d' && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                dragRef.current.zoomCursorX = (e.clientX - rect.left) - rect.width / 2;
                dragRef.current.zoomCursorY = (e.clientY - rect.top) - rect.height / 2;
            }

            requestDraw();
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
                    const rotDelta = -dx * DRAG_RAD_PER_PX / dragRef.current.zoom;
                    animRef.current.rotation += rotDelta;
                    dragRef.current.velocityX = rotDelta; // Save for momentum
                    dragRef.current.offsetLat -= dy * DRAG_RAD_PER_PX / dragRef.current.zoom;
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
                    const minZ = mode === '2d' ? 1.0 : 0.98;
                    // Proportional, as the wheel is: at 20x an additive step would barely move.
                    dragRef.current.targetZoom = Math.max(minZ, Math.min(MAX_ZOOM, dragRef.current.targetZoom * (newDist / dragRef.current.pinchDist)));

                    // Store pinch midpoint for cursor-centered zooming (applied per-frame in draw())
                    if (mode === '2d' && canvasRef.current) {
                        const rect = canvasRef.current.getBoundingClientRect();
                        dragRef.current.zoomCursorX = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) - rect.width / 2;
                        dragRef.current.zoomCursorY = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) - rect.height / 2;
                    }
                }
                dragRef.current.pinchDist = newDist;
            }

            requestDraw();
        };

        const handleTouchEnd = (e: TouchEvent) => {
            // No strict preventDefault here to allow tap-to-click events if needed natively
            const wasDragging = dragRef.current.isDragging;
            dragRef.current.isDragging = false;
            dragRef.current.pinchDist = 0;
            dragRef.current.lastInteractionTime = performance.now();
            // Let go: momentum, or the flat map springing back inside its edge.
            requestDraw();

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
    }, [activeTier, mode, selectAtPoint, requestDraw]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!activeTier) return;
        dragRef.current.isDragging = true;
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        dragRef.current.velocityX = 0;
        dragRef.current.lastInteractionTime = performance.now();
        e.currentTarget.style.cursor = 'grabbing';
        // A still click leaves a selection held; moving past the threshold
        // lets it go (see handleMouseMove).
    }, [activeTier]);

    const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        dragRef.current.isDragging = false;
        dragRef.current.lastInteractionTime = performance.now();
        // Hover waited out the drag; catch it up with what is under the pointer now.
        const { code, dotKey } = countryAtPoint(e.clientX, e.clientY);
        setHover(code, dotKey);
        // Let go: momentum, or the flat map springing back inside its edge.
        requestDraw();
    }, [countryAtPoint, setHover, requestDraw]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current || !activeTier) return;
        const drag = dragRef.current;

        // Handle dragging map
        if (drag.isDragging) {
            drag.lastInteractionTime = performance.now();
            const moved = movedPastThreshold(drag, e.clientX, e.clientY);
            if (moved) releaseTargets(drag);
            const dx = e.clientX - drag.lastX;
            const dy = e.clientY - drag.lastY;
            drag.lastX = e.clientX;
            drag.lastY = e.clientY;

            if (mode === '3d') {
                // Update rotation instantly (inverted dx)
                const rotDelta = -dx * DRAG_RAD_PER_PX / drag.zoom;
                animRef.current.rotation += rotDelta;
                drag.velocityX = rotDelta; // Save for momentum

                // Update latitude tilt (inverted dy), limit range so we don't go upside down
                drag.offsetLat -= dy * DRAG_RAD_PER_PX / drag.zoom;
                drag.offsetLat = Math.max(-1.2, Math.min(1.2, drag.offsetLat));
            } else if (mode === '2d') {
                drag.panX += rubberDelta(drag.panX, dx, drag.boundX);
                drag.panY += rubberDelta(drag.panY, dy, drag.boundY);
            }

            // A resting map has stopped its loop, so a drag wakes it.
            requestDraw();
            // Mid-drag the map is moving under the pointer; hover waits for it to stop.
            if (moved) return;
        }

        const { code, dotKey } = countryAtPoint(e.clientX, e.clientY);
        if (code === hoveredCountryRef.current && dotKey === drag.hoveredDotKey) return;
        setHover(code, dotKey);
    }, [activeTier, mode, countryAtPoint, setHover, requestDraw]);

    const handleMouseLeave = useCallback(() => {
        dragRef.current.isDragging = false;
        setHover(null, null);
        requestDraw();
    }, [setHover, requestDraw]);

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
    // What the size control says: the size showing, and whether it is held.
    // Held at 17 km with 45 km standing in, it says so rather than "45 km held".
    const sizeReadout = hexSize === 'auto'
        ? `${HEX_KM[shownRes]} km`
        : hexSize === 5 && shownRes !== 5
            ? `${HEX_KM[5]} km · zoom in`
            : `${HEX_KM[hexSize]} km · held`;

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
            {/* Cells and borders, drawn by WebGL. The canvas over it carries
                the stars, the selection's glow and every pointer event. */}
            <canvas ref={oceanCanvasRef} className="dot-matrix-map-gl" aria-hidden="true" />
            <canvas ref={glCanvasRef} className="dot-matrix-map-gl" aria-hidden="true" />
            <canvas
                ref={canvasRef}
                className="dot-matrix-map-canvas"
                style={{ width: '100%', height: '100%', cursor: 'grab' }}
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
                                {/* GeoNames' licence (CC BY 4.0) asks for this wherever its town names show. */}
                                <a
                                    href="https://www.geonames.org/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="pointer-events-auto underline-offset-2 hover:underline"
                                >
                                    Places: GeoNames
                                </a>
                            </>
                        ) : (
                            <>
                                <span><i aria-hidden="true" className="dot-matrix-legend-swatch" style={{ background: legendPalette.visited }} />Visited</span>
                                <span><i aria-hidden="true" className="dot-matrix-legend-swatch" style={{ background: legendPalette.unvisited }} />Not yet</span>
                            </>
                        )}
                    </div>
                    {/* Names the projection the flat map is in, and picks another.
                        Hidden over the globe, which is in no projection at all, so
                        the label never names something the map is not. Fades over
                        the 500ms the dots take to roll up into the sphere. Left out
                        on a phone, where the map has no room to spare. */}
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger
                            className={`hidden sm:flex min-h-9 items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/50 shadow-sm hover:bg-muted text-xs font-semibold tracking-wider text-muted-foreground whitespace-nowrap transition-[opacity,background-color] duration-500 ${
                                mode === '3d' ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
                            }`}
                            title={projection.note}
                            aria-label={`Projection: ${projection.label}. Choose another`}
                            aria-hidden={mode === '3d'}
                            tabIndex={mode === '3d' ? -1 : undefined}
                        >
                            {projection.label}
                            <ChevronDown aria-hidden="true" className="w-3.5 h-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="top" className="w-72">
                            <DropdownMenuRadioGroup value={projectionId} onValueChange={chooseProjection}>
                                {MAP_PROJECTIONS.map((option) => (
                                    <DropdownMenuRadioItem key={option.id} value={option.id} className="flex-col items-start gap-0.5">
                                        <span className="font-semibold">{option.label}</span>
                                        <span className="text-xs text-muted-foreground">{option.note}</span>
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {/* The map's own controls, kept together on the right. */}
                    <div className="ml-auto flex items-center gap-2">
                    {/* Holds the globe still for two minutes: no idle spin, no easing
                        back level. Only over the globe, which is all that turns. */}
                    {mode === '3d' && (
                        <button
                            type="button"
                            onClick={toggleSpinLock}
                            className={`flex h-9 w-9 items-center justify-center rounded-full bg-background/80 backdrop-blur-md border border-border/50 shadow-sm hover:bg-muted pointer-events-auto ${
                                spinLocked ? 'text-foreground' : 'text-muted-foreground'
                            }`}
                            aria-label={spinLocked ? 'Globe held still. Let it turn again' : 'Hold the globe still for two minutes'}
                            aria-pressed={spinLocked}
                            title={spinLocked ? 'Held still: turns again after two minutes' : 'Hold still for two minutes'}
                        >
                            {spinLocked ? <Lock aria-hidden="true" className="w-3.5 h-3.5" /> : <LockOpen aria-hidden="true" className="w-3.5 h-3.5" />}
                        </button>
                    )}
                    {/* Zoom, and the hex size: what is showing, and a size to hold.
                        Left out on a phone, where a pinch zooms and the bar has no room. */}
                    <div className="hidden sm:flex min-h-9 items-center rounded-full bg-background/80 backdrop-blur-md border border-border/50 shadow-sm text-xs font-semibold tracking-wider text-muted-foreground pointer-events-auto">
                        <button
                            type="button"
                            onClick={() => zoomBy(1 / ZOOM_BUTTON_STEP)}
                            className="flex h-9 w-9 items-center justify-center rounded-l-full hover:bg-muted"
                            aria-label="Zoom out"
                        >
                            <Minus aria-hidden="true" className="w-3.5 h-3.5" />
                        </button>
                        {glReady && <DropdownMenu modal={false}>
                            <DropdownMenuTrigger
                                className="flex h-9 items-center gap-1 px-2 hover:bg-muted whitespace-nowrap"
                                title={hexSize === 'auto' ? 'Hex size follows the zoom' : 'Hex size held'}
                                aria-label={`${sizeReadout}. Choose a size`}
                            >
                                {sizeReadout}
                                <ChevronDown aria-hidden="true" className="w-3.5 h-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="top" className="w-72">
                                <DropdownMenuRadioGroup value={String(hexSize)} onValueChange={chooseHexSize}>
                                    {HEX_SIZE_CHOICES.map((option) => (
                                        <DropdownMenuRadioItem key={option.value} value={String(option.value)} className="flex-col items-start gap-0.5">
                                            <span className="font-semibold">{option.label}</span>
                                            <span className="text-xs text-muted-foreground">{option.note}</span>
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>}
                        <button
                            type="button"
                            onClick={() => zoomBy(ZOOM_BUTTON_STEP)}
                            className="flex h-9 w-9 items-center justify-center rounded-r-full hover:bg-muted"
                            aria-label="Zoom in"
                        >
                            <Plus aria-hidden="true" className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <button
                        onClick={() => setMode(m => m === '2d' ? '3d' : '2d')}
                        className="flex min-h-9 items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/50 shadow-sm hover:bg-muted text-xs font-semibold tracking-wider text-muted-foreground transition-[background-color,color] duration-300 pointer-events-auto"
                        aria-label="Toggle 3D View"
                        aria-pressed={mode === '3d'}
                    >
                        {mode === '2d' ? <Globe className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                        {/* Short on a phone, so the legend and the toggle share a line. */}
                        <span className="sm:hidden">{mode === '2d' ? '3D' : '2D'}</span>
                        <span className="hidden sm:inline">{mode === '2d' ? '3D Globe' : '2D Map'}</span>
                    </button>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}

export type { DotMatrixGlobeProps };

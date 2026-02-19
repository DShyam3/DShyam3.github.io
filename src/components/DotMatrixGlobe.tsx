import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Globe, Map as MapIcon } from 'lucide-react';
import * as topojson from 'topojson-client';
import { geoOrthographic, geoEquirectangular, geoPath } from 'd3-geo';
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

// Cache the loaded data globally so it's only fetched once
let cachedDotData: DotData | null = null;
let cachedTopoData: any = null;

// Country name lookup - loaded from REST Countries API
let cachedCountryNames: Record<string, string> = {};

async function loadDotData(): Promise<DotData> {
    if (cachedDotData) return cachedDotData;
    const res = await fetch('/data/dot-world-map.json');
    cachedDotData = await res.json();
    return cachedDotData!;
}

async function loadTopoData(): Promise<any> {
    if (cachedTopoData) return cachedTopoData;
    try {
        const res = await fetch('/data/world-topo.json');
        const topo = await res.json();
        // Convert TopoJSON to a single lightweight boundary mesh instead of heavy polygons
        cachedTopoData = topojson.mesh(topo, topo.objects.c);
    } catch {
        // fallback to null if not available
    }
    return cachedTopoData;
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
    const [geoFeatures, setGeoFeatures] = useState<any>(null);
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
        panX: 0,
        panY: 0,
        zoom: 1,
        targetZoom: 1,
        pinchDist: 0,
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
        Promise.all([loadDotData(), loadCountryNames(), loadTopoData()]).then(([dots, names, geo]) => {
            setDotData(dots);
            setCountryNames(names);
            setGeoFeatures(geo);
        });
    }, []);

    const optimizedDots = useMemo(() => {
        if (!dotData) return [];
        const { cols, rows, dots } = dotData;
        return dots.map(([col, row, code]) => {
            const lon = (col / cols) * 2 * Math.PI - Math.PI;
            const lat = Math.PI / 2 - (row / rows) * Math.PI;
            return {
                code,
                cxNorm: (col + 0.5) / cols,
                cyNorm: (row + 0.5) / rows,
                ux: Math.cos(lat) * Math.sin(lon),
                uy: -Math.sin(lat),
                uz: Math.cos(lat) * Math.cos(lon),
            };
        });
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

        const isDark = document.documentElement.classList.contains('dark');

        // Smooth zoom interpolation
        dragRef.current.zoom += (dragRef.current.targetZoom - dragRef.current.zoom) * 0.1;
        const curZoom = dragRef.current.zoom;

        // Clamp 2D pan to prevent wandering infinitely offscreen
        if (mode === '2d') {
            const maxPanX = Math.max(0, (W * curZoom - W) / 2);
            const maxPanY = Math.max(0, (H * curZoom - H) / 2);
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
        const dotSpacingX = W / cols;
        const dotSpacingY = H / rows;
        const W_half = W / 2;
        const H_half = H / 2;
        const W_zoom = W * curZoom;
        const H_zoom = H * curZoom;
        const W_offset = W_half - W_half * curZoom + panX;
        const H_offset = H_half - H_half * curZoom + panY;

        // Anti-clutter tuning on Mobile
        const isMobile = W < 600;
        const radiusMultiplier = isMobile ? (progress === 0 ? 0.25 : 0.32) : 0.38;
        const baseRadius = Math.min(dotSpacingX, dotSpacingY) * radiusMultiplier * curZoom;

        const cosRot = Math.cos(rotation);
        const sinRot = Math.sin(rotation);
        const cosLatOffset = Math.cos(dragRef.current.offsetLat);
        const sinLatOffset = Math.sin(dragRef.current.offsetLat);

        // --- Render GeoJSON Borders (Fading Underneath) ---
        if (geoFeatures) {
            let activeProjection = null;
            let drawHemisphere = false;

            if (progress === 1) {
                // 3D projection only
                activeProjection = geoOrthographic()
                    .scale(R)
                    .translate([W / 2, H / 2])
                    .rotate([-(rotation * 180 / Math.PI), dragRef.current.offsetLat * 180 / Math.PI, 0]);
                drawHemisphere = true;
                ctx.globalAlpha = 0.15;
            } else if (progress === 0) {
                // 2D projection only
                activeProjection = geoEquirectangular()
                    .scale((W / (2 * Math.PI)) * curZoom)
                    .translate([W / 2 + panX, H / 2 + panY]);
                ctx.globalAlpha = 0.15;
            } else {
                // Transition state: To maintain 60FPS and keep the pure "dots forming a globe" 
                // animation from before, we rapidly fade out static borders during the transition.
                const threshold = 0.15;
                if (progress > 1 - threshold) {
                    activeProjection = geoOrthographic()
                        .scale(R)
                        .translate([W / 2, H / 2])
                        .rotate([-(rotation * 180 / Math.PI), dragRef.current.offsetLat * 180 / Math.PI, 0]);
                    drawHemisphere = true;
                    ctx.globalAlpha = 0.15 * ((progress - (1 - threshold)) / threshold);
                } else if (progress < threshold) {
                    activeProjection = geoEquirectangular()
                        .scale((W / (2 * Math.PI)) * curZoom)
                        .translate([W / 2 + panX, H / 2 + panY]);
                    ctx.globalAlpha = 0.15 * (1 - (progress / threshold));
                } else {
                    ctx.globalAlpha = 0;
                }
            }

            if (activeProjection && ctx.globalAlpha > 0) {
                let currentAlpha = ctx.globalAlpha;

                // PERFORMANCE OPTIMIZATION: 
                // The GeoJSON topology path is massive. When heavily zoomed into the 2D map, 
                // continuously transforming and drawing it obliterates frame rates.
                // We smoothly fade it out completely by 2.0x zoom to preserve buttery 60 FPS morphs!
                if (curZoom > 1.0) {
                    currentAlpha *= Math.max(0, 1 - (curZoom - 1.0));
                }

                if (currentAlpha > 0.02) {
                    ctx.globalAlpha = currentAlpha;
                    // Provide a clip extent so d3-geo doesn't parse segments lightyears off-screen
                    if (activeProjection.clipExtent) {
                        activeProjection.clipExtent([[-W, -H], [W * 2, H * 2]]);
                    }
                    ctx.beginPath();
                    geoPath(activeProjection, ctx)(geoFeatures);
                    ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
                    ctx.lineWidth = (isMobile ? 0.35 : 1) * dpr;
                    ctx.stroke();
                }

                // Hemisphere outline (only in 3D)
                if (drawHemisphere) {
                    ctx.globalAlpha = (currentAlpha / 0.15) * 0.05;
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
            const cx2d = dot.cxNorm * W_zoom + W_offset;
            const cy2d = dot.cyNorm * H_zoom + H_offset;

            // 2D Viewport culling optimization:
            if (progress === 0 && (cx2d < -20 || cx2d > W + 20 || cy2d < -20 || cy2d > H + 20)) {
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

            const activeRadius = baseRadius * (1 * (1 - progress) + Math.max(0.4, 0.6 + 0.4 * zNorm) * progress);
            const activeOpacity = 1 * (1 - progress) + Math.max(0.1, 0.45 + 0.55 * zNorm) * progress;

            const pDot: ProjectedDot = {
                x: cx, y: cy,
                r: activeRadius,
                code: dot.code,
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
                color = isDark ? `rgba(255, 255, 255, ${isMobile ? 0.12 : 0.22})` : `rgba(50, 70, 130, ${isMobile ? 0.12 : 0.25})`;
            }

            ctx.globalAlpha = p.opacity;
            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
        };

        for (const p of backDots) drawDot(p);
        for (const p of frontDots) drawDot(p);

        // Add auto-recentering for 2D pan when fully zoomed out
        if (mode === '2d' && curZoom <= 1.01) {
            dragRef.current.panX *= 0.9;
            dragRef.current.panY *= 0.9;
        }

        if (progress > 0 || animRef.current.progress !== target) {
            requestRef.current = requestAnimationFrame((t) => draw(t));
        } else if (mode === '2d' && (Math.abs(dragRef.current.targetZoom - curZoom) > 0.01 || Math.abs(panX) > 1 || Math.abs(panY) > 1)) {
            // keep 2D drawing alive ONLY if it's currently actively zooming/panning
            requestRef.current = requestAnimationFrame((t) => draw(t));
        }

    }, [dotData, optimizedDots, visitedSet, hoveredCountry, mode, geoFeatures, stars]);

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
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (!dotData) return;
            e.preventDefault();
            dragRef.current.lastInteractionTime = performance.now();
            const zoomDelta = e.deltaY * -0.001;
            const minZ = mode === '2d' ? 1.0 : 0.98;
            dragRef.current.targetZoom = Math.max(minZ, Math.min(10, dragRef.current.targetZoom + zoomDelta * dragRef.current.targetZoom));

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
                dragRef.current.velocityX = 0;
                dragRef.current.lastInteractionTime = performance.now();
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
                }
                dragRef.current.pinchDist = newDist;
            }

            // Immediately wake up animation loop to ensure smooth 60fps follow on finger tracking
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            requestRef.current = requestAnimationFrame((t) => draw(t));
        };

        const handleTouchEnd = (e: TouchEvent) => {
            // No strict preventDefault here to allow tap-to-click events if needed natively
            dragRef.current.isDragging = false;
            dragRef.current.pinchDist = 0;
            dragRef.current.lastInteractionTime = performance.now();
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
    }, [dotData, mode, draw]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!dotData) return;
        dragRef.current.isDragging = true;
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
        dragRef.current.velocityX = 0;
        dragRef.current.lastInteractionTime = performance.now();
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
                style={{ width: '100%', height: '100%', cursor: dragRef.current.isDragging ? 'grabbing' : (hoveredCountry ? 'crosshair' : 'grab'), touchAction: 'none' }}
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


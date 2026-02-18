import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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

    // Load data
    useEffect(() => {
        Promise.all([loadDotData(), loadCountryNames()]).then(([dots, names]) => {
            setDotData(dots);
            setCountryNames(names);
        });
    }, []);

    // Build a lookup: (col, row) -> countryCode for hit testing
    const dotLookup = useMemo(() => {
        if (!dotData) return new Map<string, string>();
        const map = new Map<string, string>();
        for (const [col, row, code] of dotData.dots) {
            map.set(`${col},${row}`, code);
        }
        return map;
    }, [dotData]);

    // Draw the map
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !dotData) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

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
        const dotRadius = Math.min(dotSpacingX, dotSpacingY) * 0.38;

        const isDark = document.documentElement.classList.contains('dark');

        for (const [col, row, code] of dots) {
            const cx = (col + 0.5) * dotSpacingX;
            const cy = (row + 0.5) * dotSpacingY;

            const isVisited = visitedSet.has(code);
            const isHovered = code === hoveredCountry;

            let color: string;
            let radius = dotRadius;

            if (isVisited && isHovered) {
                color = 'rgba(255, 200, 50, 1)';
                radius = dotRadius * 1.4;
            } else if (isVisited) {
                color = 'rgba(218, 165, 32, 0.95)';
                radius = dotRadius * 1.2;
            } else if (isHovered) {
                color = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(60, 80, 140, 0.8)';
                radius = dotRadius * 1.2;
            } else {
                color = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(50, 70, 130, 0.25)';
            }

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        }
    }, [dotData, visitedSet, hoveredCountry]);

    // Re-draw whenever data or state changes
    useEffect(() => {
        draw();
    }, [draw]);

    // Handle resize
    useEffect(() => {
        const observer = new ResizeObserver(() => draw());
        if (canvasRef.current) observer.observe(canvasRef.current);
        return () => observer.disconnect();
    }, [draw]);

    // Mouse move → find hovered country
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!dotData || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const { cols, rows } = dotData;
        const dotSpacingX = rect.width / cols;
        const dotSpacingY = rect.height / rows;

        // Find nearest dot within 1.5 dot-spacings
        const col = Math.floor(mx / dotSpacingX);
        const row = Math.floor(my / dotSpacingY);

        // Check a small neighbourhood
        let found: string | null = null;
        const searchRadius = 1;
        let bestDist = Infinity;

        for (let dc = -searchRadius; dc <= searchRadius; dc++) {
            for (let dr = -searchRadius; dr <= searchRadius; dr++) {
                const c = col + dc;
                const r = row + dr;
                const code = dotLookup.get(`${c},${r}`);
                if (code) {
                    const cx = (c + 0.5) * dotSpacingX;
                    const cy = (r + 0.5) * dotSpacingY;
                    const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
                    const dotRadius = Math.min(dotSpacingX, dotSpacingY) * 0.38;
                    if (dist < dotRadius * 2.5 && dist < bestDist) {
                        bestDist = dist;
                        found = code;
                    }
                }
            }
        }

        if (found !== hoveredCountry) {
            setHoveredCountry(found);
            const flagUrl = found ? `https://flagcdn.com/w80/${found.toLowerCase()}.png` : null;
            onCountryHover?.(found, found ? (countryNames[found] ?? found) : null, flagUrl);
        }
    }, [dotData, dotLookup, hoveredCountry, countryNames, onCountryHover]);

    const handleMouseLeave = useCallback(() => {
        setHoveredCountry(null);
        onCountryHover?.(null, null, null);
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
                style={{ width: '100%', height: '100%', cursor: hoveredCountry ? 'crosshair' : 'default' }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            />
        </div>
    );
}

export type { DotMatrixGlobeProps };


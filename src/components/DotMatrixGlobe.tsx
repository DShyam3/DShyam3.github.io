import { useRef, useEffect, useState, useCallback } from 'react';
import './DotMatrixGlobe.css';

// Simplified world landmass data as lat/lng bounding polygons
// Each country has an ISO code and a set of approximate bounding rectangles
// These are simplified representations for dot matrix rendering
interface CountryRegion {
    code: string;
    name: string;
    bounds: Array<{ latMin: number; latMax: number; lngMin: number; lngMax: number }>;
}

const COUNTRIES: CountryRegion[] = [
    // Europe
    { code: 'GB', name: 'United Kingdom', bounds: [{ latMin: 50, latMax: 59, lngMin: -8, lngMax: 2 }] },
    { code: 'IE', name: 'Ireland', bounds: [{ latMin: 51, latMax: 55.5, lngMin: -10.5, lngMax: -6 }] },
    { code: 'FR', name: 'France', bounds: [{ latMin: 42, latMax: 51, lngMin: -5, lngMax: 8 }] },
    { code: 'DE', name: 'Germany', bounds: [{ latMin: 47, latMax: 55, lngMin: 6, lngMax: 15 }] },
    { code: 'ES', name: 'Spain', bounds: [{ latMin: 36, latMax: 44, lngMin: -9, lngMax: 3 }] },
    { code: 'PT', name: 'Portugal', bounds: [{ latMin: 37, latMax: 42, lngMin: -9.5, lngMax: -6 }] },
    { code: 'IT', name: 'Italy', bounds: [{ latMin: 36, latMax: 47, lngMin: 7, lngMax: 18 }] },
    { code: 'NL', name: 'Netherlands', bounds: [{ latMin: 51, latMax: 53.5, lngMin: 3.5, lngMax: 7 }] },
    { code: 'BE', name: 'Belgium', bounds: [{ latMin: 49.5, latMax: 51.5, lngMin: 2.5, lngMax: 6.5 }] },
    { code: 'CH', name: 'Switzerland', bounds: [{ latMin: 45.8, latMax: 47.8, lngMin: 6, lngMax: 10.5 }] },
    { code: 'AT', name: 'Austria', bounds: [{ latMin: 46.3, latMax: 49, lngMin: 9.5, lngMax: 17 }] },
    { code: 'PL', name: 'Poland', bounds: [{ latMin: 49, latMax: 55, lngMin: 14, lngMax: 24 }] },
    { code: 'CZ', name: 'Czech Republic', bounds: [{ latMin: 48.5, latMax: 51.1, lngMin: 12, lngMax: 19 }] },
    { code: 'SK', name: 'Slovakia', bounds: [{ latMin: 47.7, latMax: 49.6, lngMin: 17, lngMax: 22.5 }] },
    { code: 'HU', name: 'Hungary', bounds: [{ latMin: 45.7, latMax: 48.6, lngMin: 16, lngMax: 23 }] },
    { code: 'RO', name: 'Romania', bounds: [{ latMin: 43.6, latMax: 48.3, lngMin: 22, lngMax: 30 }] },
    { code: 'BG', name: 'Bulgaria', bounds: [{ latMin: 41.2, latMax: 44.2, lngMin: 22.3, lngMax: 28.6 }] },
    { code: 'GR', name: 'Greece', bounds: [{ latMin: 34.8, latMax: 41.8, lngMin: 19.3, lngMax: 29.7 }] },
    { code: 'HR', name: 'Croatia', bounds: [{ latMin: 42.4, latMax: 46.6, lngMin: 13.5, lngMax: 19.5 }] },
    { code: 'RS', name: 'Serbia', bounds: [{ latMin: 42, latMax: 46.2, lngMin: 19, lngMax: 23 }] },
    { code: 'SE', name: 'Sweden', bounds: [{ latMin: 55, latMax: 69, lngMin: 11, lngMax: 24 }] },
    { code: 'NO', name: 'Norway', bounds: [{ latMin: 58, latMax: 71, lngMin: 5, lngMax: 31 }] },
    { code: 'FI', name: 'Finland', bounds: [{ latMin: 60, latMax: 70, lngMin: 20, lngMax: 30 }] },
    { code: 'DK', name: 'Denmark', bounds: [{ latMin: 54.5, latMax: 57.8, lngMin: 8, lngMax: 15 }] },
    { code: 'IS', name: 'Iceland', bounds: [{ latMin: 63, latMax: 66.5, lngMin: -24, lngMax: -13 }] },
    // Baltic States
    { code: 'EE', name: 'Estonia', bounds: [{ latMin: 57.5, latMax: 59.7, lngMin: 22, lngMax: 28 }] },
    { code: 'LV', name: 'Latvia', bounds: [{ latMin: 55.7, latMax: 58.1, lngMin: 21, lngMax: 28.2 }] },
    { code: 'LT', name: 'Lithuania', bounds: [{ latMin: 53.9, latMax: 56.5, lngMin: 21, lngMax: 26.8 }] },

    // Asia
    { code: 'RU', name: 'Russia', bounds: [{ latMin: 41, latMax: 82, lngMin: 27, lngMax: 180 }, { latMin: 65, latMax: 75, lngMin: -180, lngMax: -170 }] },
    { code: 'CN', name: 'China', bounds: [{ latMin: 18, latMax: 54, lngMin: 73, lngMax: 135 }] },
    { code: 'JP', name: 'Japan', bounds: [{ latMin: 24, latMax: 46, lngMin: 123, lngMax: 146 }] },
    { code: 'KR', name: 'South Korea', bounds: [{ latMin: 33, latMax: 39, lngMin: 124, lngMax: 130 }] },
    { code: 'IN', name: 'India', bounds: [{ latMin: 6, latMax: 36, lngMin: 68, lngMax: 97 }] },
    { code: 'TH', name: 'Thailand', bounds: [{ latMin: 5.5, latMax: 20.5, lngMin: 97.5, lngMax: 106 }] },
    { code: 'VN', name: 'Vietnam', bounds: [{ latMin: 8, latMax: 23.5, lngMin: 102, lngMax: 110 }] },
    { code: 'MY', name: 'Malaysia', bounds: [{ latMin: 1, latMax: 7.5, lngMin: 100, lngMax: 119 }] },
    { code: 'ID', name: 'Indonesia', bounds: [{ latMin: -11, latMax: 6, lngMin: 95, lngMax: 141 }] },
    { code: 'PH', name: 'Philippines', bounds: [{ latMin: 5, latMax: 20, lngMin: 117, lngMax: 127 }] },
    { code: 'PK', name: 'Pakistan', bounds: [{ latMin: 24, latMax: 37, lngMin: 61, lngMax: 78 }] },
    { code: 'BD', name: 'Bangladesh', bounds: [{ latMin: 20.5, latMax: 26.6, lngMin: 88, lngMax: 92.7 }] },
    { code: 'LK', name: 'Sri Lanka', bounds: [{ latMin: 6, latMax: 10, lngMin: 79.5, lngMax: 82 }] },
    { code: 'NP', name: 'Nepal', bounds: [{ latMin: 26, latMax: 30.5, lngMin: 80, lngMax: 88.2 }] },
    { code: 'MM', name: 'Myanmar', bounds: [{ latMin: 9.8, latMax: 28.5, lngMin: 92, lngMax: 101.2 }] },
    { code: 'KH', name: 'Cambodia', bounds: [{ latMin: 10, latMax: 15, lngMin: 102, lngMax: 108 }] },

    // Middle East
    { code: 'TR', name: 'Turkey', bounds: [{ latMin: 36, latMax: 42, lngMin: 26, lngMax: 45 }] },
    { code: 'SA', name: 'Saudi Arabia', bounds: [{ latMin: 16, latMax: 32, lngMin: 35, lngMax: 56 }] },
    { code: 'AE', name: 'United Arab Emirates', bounds: [{ latMin: 22.5, latMax: 26.1, lngMin: 51, lngMax: 56.4 }] },
    { code: 'IR', name: 'Iran', bounds: [{ latMin: 25, latMax: 40, lngMin: 44, lngMax: 63 }] },
    { code: 'IQ', name: 'Iraq', bounds: [{ latMin: 29, latMax: 37.4, lngMin: 38.8, lngMax: 48.6 }] },
    { code: 'IL', name: 'Israel', bounds: [{ latMin: 29.5, latMax: 33.3, lngMin: 34.3, lngMax: 35.9 }] },
    { code: 'JO', name: 'Jordan', bounds: [{ latMin: 29, latMax: 33.4, lngMin: 34.9, lngMax: 39.3 }] },
    { code: 'SY', name: 'Syria', bounds: [{ latMin: 32.3, latMax: 37.3, lngMin: 35.7, lngMax: 42.4 }] },
    { code: 'QA', name: 'Qatar', bounds: [{ latMin: 24.5, latMax: 26.2, lngMin: 50.7, lngMax: 51.7 }] },
    { code: 'OM', name: 'Oman', bounds: [{ latMin: 16.6, latMax: 26.4, lngMin: 52, lngMax: 60 }] },
    { code: 'YE', name: 'Yemen', bounds: [{ latMin: 12, latMax: 19, lngMin: 42, lngMax: 54.5 }] },
    { code: 'KW', name: 'Kuwait', bounds: [{ latMin: 28.5, latMax: 30.1, lngMin: 46.5, lngMax: 48.5 }] },

    // Central Asia
    { code: 'KZ', name: 'Kazakhstan', bounds: [{ latMin: 40.5, latMax: 55.4, lngMin: 46.5, lngMax: 87.3 }] },
    { code: 'UZ', name: 'Uzbekistan', bounds: [{ latMin: 37.2, latMax: 45.6, lngMin: 56, lngMax: 73.2 }] },
    { code: 'AF', name: 'Afghanistan', bounds: [{ latMin: 29.4, latMax: 38.5, lngMin: 60.5, lngMax: 74.9 }] },
    { code: 'MN', name: 'Mongolia', bounds: [{ latMin: 41.6, latMax: 52.1, lngMin: 87.8, lngMax: 119.9 }] },

    // North America
    { code: 'US', name: 'United States', bounds: [{ latMin: 24, latMax: 50, lngMin: -125, lngMax: -66 }, { latMin: 55, latMax: 72, lngMin: -170, lngMax: -130 }] },
    { code: 'CA', name: 'Canada', bounds: [{ latMin: 42, latMax: 84, lngMin: -141, lngMax: -52 }] },
    { code: 'MX', name: 'Mexico', bounds: [{ latMin: 14, latMax: 33, lngMin: -118, lngMax: -87 }] },

    // Central America & Caribbean
    { code: 'CU', name: 'Cuba', bounds: [{ latMin: 19.8, latMax: 23.3, lngMin: -85, lngMax: -74 }] },
    { code: 'GT', name: 'Guatemala', bounds: [{ latMin: 13.7, latMax: 17.8, lngMin: -92.2, lngMax: -88.2 }] },
    { code: 'HN', name: 'Honduras', bounds: [{ latMin: 12.9, latMax: 16.5, lngMin: -89.4, lngMax: -83.1 }] },
    { code: 'CR', name: 'Costa Rica', bounds: [{ latMin: 8, latMax: 11.2, lngMin: -86, lngMax: -82.5 }] },
    { code: 'PA', name: 'Panama', bounds: [{ latMin: 7.2, latMax: 9.6, lngMin: -83, lngMax: -77.2 }] },
    { code: 'JM', name: 'Jamaica', bounds: [{ latMin: 17.7, latMax: 18.5, lngMin: -78.4, lngMax: -76.2 }] },

    // South America
    { code: 'BR', name: 'Brazil', bounds: [{ latMin: -33, latMax: 5, lngMin: -74, lngMax: -35 }] },
    { code: 'AR', name: 'Argentina', bounds: [{ latMin: -55, latMax: -22, lngMin: -73, lngMax: -54 }] },
    { code: 'CL', name: 'Chile', bounds: [{ latMin: -56, latMax: -17, lngMin: -76, lngMax: -67 }] },
    { code: 'CO', name: 'Colombia', bounds: [{ latMin: -4, latMax: 13, lngMin: -79, lngMax: -67 }] },
    { code: 'PE', name: 'Peru', bounds: [{ latMin: -18, latMax: 0, lngMin: -81, lngMax: -69 }] },
    { code: 'VE', name: 'Venezuela', bounds: [{ latMin: 1, latMax: 12, lngMin: -73, lngMax: -60 }] },
    { code: 'EC', name: 'Ecuador', bounds: [{ latMin: -5, latMax: 2, lngMin: -81, lngMax: -75 }] },
    { code: 'BO', name: 'Bolivia', bounds: [{ latMin: -23, latMax: -9, lngMin: -69.5, lngMax: -57.5 }] },
    { code: 'PY', name: 'Paraguay', bounds: [{ latMin: -27.5, latMax: -19.3, lngMin: -62.7, lngMax: -54.3 }] },
    { code: 'UY', name: 'Uruguay', bounds: [{ latMin: -35, latMax: -30, lngMin: -58.5, lngMax: -53.4 }] },
    { code: 'GY', name: 'Guyana', bounds: [{ latMin: 1.2, latMax: 8.5, lngMin: -61.4, lngMax: -56.5 }] },
    { code: 'SR', name: 'Suriname', bounds: [{ latMin: 1.8, latMax: 6, lngMin: -58.1, lngMax: -54 }] },

    // Africa
    { code: 'EG', name: 'Egypt', bounds: [{ latMin: 22, latMax: 32, lngMin: 25, lngMax: 37 }] },
    { code: 'ZA', name: 'South Africa', bounds: [{ latMin: -35, latMax: -22, lngMin: 16, lngMax: 33 }] },
    { code: 'NG', name: 'Nigeria', bounds: [{ latMin: 4, latMax: 14, lngMin: 3, lngMax: 14.5 }] },
    { code: 'KE', name: 'Kenya', bounds: [{ latMin: -5, latMax: 5, lngMin: 34, lngMax: 42 }] },
    { code: 'ET', name: 'Ethiopia', bounds: [{ latMin: 3.4, latMax: 15, lngMin: 33, lngMax: 48 }] },
    { code: 'TZ', name: 'Tanzania', bounds: [{ latMin: -11.7, latMax: -1, lngMin: 29, lngMax: 40.5 }] },
    { code: 'MA', name: 'Morocco', bounds: [{ latMin: 27.5, latMax: 36, lngMin: -13, lngMax: -1 }] },
    { code: 'DZ', name: 'Algeria', bounds: [{ latMin: 19, latMax: 37, lngMin: -9, lngMax: 12 }] },
    { code: 'LY', name: 'Libya', bounds: [{ latMin: 19.5, latMax: 33.2, lngMin: 9, lngMax: 25 }] },
    { code: 'TN', name: 'Tunisia', bounds: [{ latMin: 30.2, latMax: 37.3, lngMin: 7.5, lngMax: 11.6 }] },
    { code: 'GH', name: 'Ghana', bounds: [{ latMin: 4.7, latMax: 11.2, lngMin: -3.3, lngMax: 1.2 }] },
    { code: 'CI', name: "Ivory Coast", bounds: [{ latMin: 4.4, latMax: 10.7, lngMin: -8.6, lngMax: -2.5 }] },
    { code: 'SN', name: 'Senegal', bounds: [{ latMin: 12.3, latMax: 16.7, lngMin: -17.5, lngMax: -11.4 }] },
    { code: 'CD', name: 'DR Congo', bounds: [{ latMin: -13.5, latMax: 5.4, lngMin: 12.2, lngMax: 31.3 }] },
    { code: 'AO', name: 'Angola', bounds: [{ latMin: -18.1, latMax: -4.4, lngMin: 11.7, lngMax: 24.1 }] },
    { code: 'MZ', name: 'Mozambique', bounds: [{ latMin: -26.9, latMax: -10.5, lngMin: 30.2, lngMax: 40.8 }] },
    { code: 'MG', name: 'Madagascar', bounds: [{ latMin: -25.6, latMax: -12, lngMin: 43.2, lngMax: 50.5 }] },
    { code: 'SD', name: 'Sudan', bounds: [{ latMin: 8.7, latMax: 22, lngMin: 21.8, lngMax: 38.6 }] },
    { code: 'CM', name: 'Cameroon', bounds: [{ latMin: 1.7, latMax: 13.1, lngMin: 8.5, lngMax: 16.2 }] },
    { code: 'NE', name: 'Niger', bounds: [{ latMin: 11.7, latMax: 23.5, lngMin: 0, lngMax: 16 }] },
    { code: 'ML', name: 'Mali', bounds: [{ latMin: 10, latMax: 25, lngMin: -12, lngMax: 4 }] },
    { code: 'TD', name: 'Chad', bounds: [{ latMin: 7.4, latMax: 23.5, lngMin: 13.5, lngMax: 24 }] },
    { code: 'ZM', name: 'Zambia', bounds: [{ latMin: -18, latMax: -8.2, lngMin: 22, lngMax: 33.7 }] },
    { code: 'ZW', name: 'Zimbabwe', bounds: [{ latMin: -22.4, latMax: -15.6, lngMin: 25.2, lngMax: 33 }] },
    { code: 'BW', name: 'Botswana', bounds: [{ latMin: -27, latMax: -18, lngMin: 20, lngMax: 29.4 }] },
    { code: 'NA', name: 'Namibia', bounds: [{ latMin: -29, latMax: -17, lngMin: 11.7, lngMax: 25.3 }] },
    { code: 'UG', name: 'Uganda', bounds: [{ latMin: -1.5, latMax: 4.2, lngMin: 29.6, lngMax: 35 }] },
    { code: 'SO', name: 'Somalia', bounds: [{ latMin: -1.7, latMax: 12, lngMin: 41, lngMax: 51.4 }] },
    { code: 'MR', name: 'Mauritania', bounds: [{ latMin: 14.7, latMax: 27.3, lngMin: -17.1, lngMax: -4.8 }] },
    { code: 'RW', name: 'Rwanda', bounds: [{ latMin: -2.8, latMax: -1.1, lngMin: 28.9, lngMax: 30.9 }] },

    // Oceania
    { code: 'AU', name: 'Australia', bounds: [{ latMin: -44, latMax: -10, lngMin: 113, lngMax: 154 }] },
    { code: 'NZ', name: 'New Zealand', bounds: [{ latMin: -47, latMax: -34, lngMin: 166, lngMax: 179 }] },
    { code: 'PG', name: 'Papua New Guinea', bounds: [{ latMin: -11.7, latMax: -1, lngMin: 141, lngMax: 160 }] },

    // Other notable
    { code: 'TW', name: 'Taiwan', bounds: [{ latMin: 22, latMax: 25.3, lngMin: 120, lngMax: 122 }] },
    { code: 'SG', name: 'Singapore', bounds: [{ latMin: 1.1, latMax: 1.5, lngMin: 103.6, lngMax: 104 }] },
    { code: 'HK', name: 'Hong Kong', bounds: [{ latMin: 22.1, latMax: 22.6, lngMin: 113.8, lngMax: 114.5 }] },
];

// Generate land points for the globe
function generateLandPoints(density: number = 3): Array<{ lat: number; lng: number; countryCodes: string[] }> {
    const points: Array<{ lat: number; lng: number; countryCodes: string[] }> = [];

    for (let lat = -90; lat <= 90; lat += density) {
        for (let lng = -180; lng <= 180; lng += density) {
            const matchingCountries: string[] = [];
            for (const country of COUNTRIES) {
                for (const b of country.bounds) {
                    if (lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax) {
                        matchingCountries.push(country.code);
                        break;
                    }
                }
            }
            if (matchingCountries.length > 0) {
                points.push({ lat, lng, countryCodes: matchingCountries });
            }
        }
    }
    return points;
}

interface DotMatrixGlobeProps {
    visitedCountryCodes: string[];
    size?: number;
    className?: string;
}

export function DotMatrixGlobe({
    visitedCountryCodes,
    size = 400,
    className = ''
}: DotMatrixGlobeProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);
    const rotationRef = useRef({ x: -0.3, y: 0 }); // slight tilt
    const autoRotateSpeedRef = useRef(0.002);
    const isDraggingRef = useRef(false);
    const lastMouseRef = useRef({ x: 0, y: 0 });
    const velocityRef = useRef({ x: 0, y: 0 });
    const visitedSetRef = useRef(new Set<string>());
    const landPointsRef = useRef<ReturnType<typeof generateLandPoints>>([]);
    const [isHovered, setIsHovered] = useState(false);

    // Generate land points once
    useEffect(() => {
        landPointsRef.current = generateLandPoints(3);
    }, []);

    // Update visited set
    useEffect(() => {
        visitedSetRef.current = new Set(visitedCountryCodes);
    }, [visitedCountryCodes]);

    // Project 3D point to 2D
    const project = useCallback((lat: number, lng: number, rotX: number, rotY: number, radius: number) => {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lng + 180) * (Math.PI / 180);

        let x = radius * Math.sin(phi) * Math.cos(theta);
        let y = radius * Math.cos(phi);
        let z = radius * Math.sin(phi) * Math.sin(theta);

        // Rotate around Y axis (horizontal drag)
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        x = x1;
        z = z1;

        // Rotate around X axis (vertical tilt)
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const y1 = y * cosX - z * sinX;
        const z2 = y * sinX + z * cosX;
        y = y1;
        z = z2;

        return { x, y, z };
    }, []);

    // Main render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.scale(dpr, dpr);

        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size * 0.38;
        const dotSpacing = 3;

        const render = () => {
            ctx.clearRect(0, 0, size, size);

            const rotX = rotationRef.current.x;
            const rotY = rotationRef.current.y;

            // Get computed styles for theming
            const computedStyle = getComputedStyle(canvas);
            const isDark = document.documentElement.classList.contains('dark');

            // Globe outline dots  
            const outlineDots: Array<{ x: number; y: number; z: number }> = [];
            for (let angle = 0; angle < 360; angle += 2) {
                const rad = angle * Math.PI / 180;
                outlineDots.push({
                    x: centerX + radius * Math.cos(rad),
                    y: centerY + radius * Math.sin(rad),
                    z: 1
                });
            }

            // Draw grid lines (latitude/longitude)
            const gridColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
            const gridDotSize = 1;

            // Latitude lines
            for (let lat = -60; lat <= 60; lat += 30) {
                for (let lng = -180; lng <= 180; lng += 4) {
                    const p = project(lat, lng, rotX, rotY, radius);
                    if (p.z > 0) {
                        ctx.fillStyle = gridColor;
                        ctx.beginPath();
                        ctx.arc(centerX + p.x, centerY - p.y, gridDotSize, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
            // Longitude lines
            for (let lng = -180; lng <= 180; lng += 30) {
                for (let lat = -90; lat <= 90; lat += 4) {
                    const p = project(lat, lng, rotX, rotY, radius);
                    if (p.z > 0) {
                        ctx.fillStyle = gridColor;
                        ctx.beginPath();
                        ctx.arc(centerX + p.x, centerY - p.y, gridDotSize, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            // Draw land dots
            const landColor = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)';
            const visitedColor = 'rgba(218, 165, 32, 0.9)'; // warm gold  
            const visitedGlow = 'rgba(218, 165, 32, 0.3)';
            const dotSize = 1.5;
            const visitedDotSize = 2;

            for (const point of landPointsRef.current) {
                const p = project(point.lat, point.lng, rotX, rotY, radius);
                if (p.z > 0) {
                    const isVisited = point.countryCodes.some(code => visitedSetRef.current.has(code));
                    const depthFade = 0.4 + 0.6 * (p.z / radius);

                    if (isVisited) {
                        // Visited country - glowing gold dot
                        ctx.fillStyle = visitedGlow;
                        ctx.beginPath();
                        ctx.arc(centerX + p.x, centerY - p.y, visitedDotSize + 1.5, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.globalAlpha = depthFade;
                        ctx.fillStyle = visitedColor;
                        ctx.beginPath();
                        ctx.arc(centerX + p.x, centerY - p.y, visitedDotSize, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.globalAlpha = 1;
                    } else {
                        // Regular land dot
                        ctx.globalAlpha = depthFade;
                        ctx.fillStyle = landColor;
                        ctx.beginPath();
                        ctx.arc(centerX + p.x, centerY - p.y, dotSize, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.globalAlpha = 1;
                    }
                }
            }

            // Ocean dots (sparse dots on ocean for globe texture)
            const oceanColor = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)';
            for (let lat = -80; lat <= 80; lat += 8) {
                for (let lng = -180; lng <= 180; lng += 8) {
                    const p = project(lat, lng, rotX, rotY, radius);
                    if (p.z > 0) {
                        // Check if this point is already land
                        const isLand = landPointsRef.current.some(
                            lp => Math.abs(lp.lat - lat) < 4 && Math.abs(lp.lng - lng) < 4
                        );
                        if (!isLand) {
                            ctx.fillStyle = oceanColor;
                            ctx.beginPath();
                            ctx.arc(centerX + p.x, centerY - p.y, 0.8, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                }
            }

            // Auto-rotate
            if (!isDraggingRef.current) {
                rotationRef.current.y += autoRotateSpeedRef.current;

                // Apply momentum decay
                if (Math.abs(velocityRef.current.x) > 0.0001 || Math.abs(velocityRef.current.y) > 0.0001) {
                    rotationRef.current.y += velocityRef.current.x;
                    rotationRef.current.x += velocityRef.current.y;
                    velocityRef.current.x *= 0.95;
                    velocityRef.current.y *= 0.95;
                }

                // Clamp vertical rotation
                rotationRef.current.x = Math.max(-1.2, Math.min(1.2, rotationRef.current.x));
            }

            animationRef.current = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationRef.current);
        };
    }, [size, project]);

    // Mouse/touch interaction handlers
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleStart = (x: number, y: number) => {
            isDraggingRef.current = true;
            lastMouseRef.current = { x, y };
            velocityRef.current = { x: 0, y: 0 };
        };

        const handleMove = (x: number, y: number) => {
            if (!isDraggingRef.current) return;
            const dx = x - lastMouseRef.current.x;
            const dy = y - lastMouseRef.current.y;
            rotationRef.current.y += dx * 0.005;
            rotationRef.current.x -= dy * 0.005;
            rotationRef.current.x = Math.max(-1.2, Math.min(1.2, rotationRef.current.x));
            velocityRef.current = { x: dx * 0.005, y: -dy * 0.005 };
            lastMouseRef.current = { x, y };
        };

        const handleEnd = () => {
            isDraggingRef.current = false;
        };

        // Mouse events
        const onMouseDown = (e: MouseEvent) => handleStart(e.clientX, e.clientY);
        const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
        const onMouseUp = () => handleEnd();
        const onMouseLeave = () => handleEnd();

        // Touch events
        const onTouchStart = (e: TouchEvent) => {
            e.preventDefault();
            const t = e.touches[0];
            handleStart(t.clientX, t.clientY);
        };
        const onTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            const t = e.touches[0];
            handleMove(t.clientX, t.clientY);
        };
        const onTouchEnd = () => handleEnd();

        canvas.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('mouseleave', onMouseLeave);
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd);

        return () => {
            canvas.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('mouseleave', onMouseLeave);
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
        };
    }, []);

    return (
        <div
            className={`dot-matrix-globe-container ${className}`}
            style={{ width: size, height: size }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <canvas
                ref={canvasRef}
                style={{ width: size, height: size, cursor: isHovered ? 'grab' : 'default' }}
                className="dot-matrix-globe-canvas"
            />
        </div>
    );
}

// Export the countries list for use in the admin panel
export { COUNTRIES };
export type { CountryRegion };

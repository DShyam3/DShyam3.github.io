#!/usr/bin/env node
/**
 * build-city-map.mjs
 * ------------------
 * Reads GeoNames city data + dot-world-map.json and produces
 * public/data/dot-city-map.json — a mapping of country → cities,
 * where each city is assigned to the nearest dot on the dot matrix.
 *
 * TIERED APPROACH to keep file size reasonable:
 *   - For countries well-covered: include cities with pop ≥ 15,000
 *   - For countries with fewer than 3 cities at ≥15k: lower to ≥ 1,000
 *   - For countries with 0 cities at ≥1k: lower to ≥ 0 (include everything)
 *
 * CROSS-COUNTRY SNAPPING:
 *   For countries that have no dot on the map (e.g. Luxembourg, Jamaica),
 *   snap cities to the nearest dot globally, regardless of country code.
 *
 * Usage:
 *   node scripts/build-city-map.mjs
 *
 * Output: public/data/dot-city-map.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ── Configuration ──────────────────────────────────────────────────────
const GEONAMES_PRIMARY = '/tmp/geonames/cities500.txt';
const DOT_MAP_PATH = resolve(PROJECT_ROOT, 'public/data/dot-world-map.json');
const OUTPUT_PATH = resolve(PROJECT_ROOT, 'public/data/dot-city-map.json');

// Max snap distance for countries WITH own dots
const MAX_SNAP_DISTANCE = 3;

// Population tiers: we start strict, then fill gaps
const POP_TIER_PRIMARY = 15000;    // main threshold
const POP_TIER_SECONDARY = 1000;   // for under-covered countries
const POP_TIER_TERTIARY = 0;       // for completely missing countries

// ── Load dot map ───────────────────────────────────────────────────────
console.log('Loading dot-world-map.json...');
const dotMap = JSON.parse(readFileSync(DOT_MAP_PATH, 'utf-8'));
const { cols, rows, dots } = dotMap;

// Build a lookup: "col,row" → countryCode
const dotLookup = new Map();
// country → [col, row][]
const countryDots = new Map();
// All dots in a flat array for global nearest-neighbor search
const allDotPositions = [];

for (const [col, row, code] of dots) {
    const key = `${col},${row}`;
    dotLookup.set(key, code);

    if (!countryDots.has(code)) countryDots.set(code, []);
    countryDots.get(code).push([col, row]);
    allDotPositions.push([col, row, code]);
}

console.log(`  ${dots.length} dots across ${countryDots.size} countries`);

// ── Load GeoNames ──────────────────────────────────────────────────────
console.log(`Loading ${GEONAMES_PRIMARY}...`);
const geoRaw = readFileSync(GEONAMES_PRIMARY, 'utf-8');
const geoLines = geoRaw.split('\n').filter(l => l.trim());
console.log(`  ${geoLines.length} city records`);

// ── Coordinate → grid mapping ──────────────────────────────────────────
function toGrid(lat, lon) {
    let col = Math.round((lon + 180) / 360 * cols);
    let row = Math.round((90 - lat) / 180 * rows);
    col = Math.max(0, Math.min(cols - 1, col));
    row = Math.max(0, Math.min(rows - 1, row));
    return [col, row];
}

// ── Find nearest dot — within own country  ─────────────────────────────
function findNearestDotInCountry(lat, lon, countryCode) {
    const [col, row] = toGrid(lat, lon);
    const key = `${col},${row}`;

    // Exact match
    if (dotLookup.has(key)) {
        return [col, row];
    }

    const cDots = countryDots.get(countryCode);
    if (!cDots || cDots.length === 0) return null;

    let bestDot = null;
    let bestDist = Infinity;

    for (const [dc, dr] of cDots) {
        const dx = dc - col;
        const dy = dr - row;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
            bestDist = dist;
            bestDot = [dc, dr];
        }
    }

    // Small countries: always snap regardless of distance
    if (cDots.length <= 10) {
        return bestDot;
    }

    // Larger countries: cap snap distance
    if (bestDist <= MAX_SNAP_DISTANCE) {
        return bestDot;
    }

    return null;
}

// ── Find nearest dot globally (for countries with no own dots) ─────────
function findNearestDotGlobal(lat, lon) {
    const [col, row] = toGrid(lat, lon);

    let bestDot = null;
    let bestDist = Infinity;

    for (const [dc, dr] of allDotPositions) {
        const dx = dc - col;
        const dy = dr - row;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
            bestDist = dist;
            bestDot = [dc, dr];
        }
    }

    return bestDot; // always returns something
}

// ── Parse all GeoNames entries ─────────────────────────────────────────
console.log('Parsing all cities...');

const allCities = [];

for (const line of geoLines) {
    const fields = line.split('\t');
    if (fields.length < 15) continue;

    const name = fields[1];
    const asciiName = fields[2];
    const lat = parseFloat(fields[4]);
    const lon = parseFloat(fields[5]);
    const countryCode = fields[8];
    const population = parseInt(fields[14], 10) || 0;

    if (!countryCode || countryCode.length !== 2) continue;

    allCities.push({ name, ascii: asciiName, lat, lon, countryCode, pop: population });
}

console.log(`  Parsed ${allCities.length} valid cities`);

// Group by country
const citiesByCC = {};
for (const city of allCities) {
    if (!citiesByCC[city.countryCode]) citiesByCC[city.countryCode] = [];
    citiesByCC[city.countryCode].push(city);
}

// Sort each country's cities by population (desc)
for (const code of Object.keys(citiesByCC)) {
    citiesByCC[code].sort((a, b) => b.pop - a.pop);
}

const allCountryCodes = new Set(Object.keys(citiesByCC));
console.log(`  Cities span ${allCountryCodes.size} country codes`);

// ── Build tiered city map ──────────────────────────────────────────────
console.log('Building tiered city map...');

const cityIndex = {};
let totalMapped = 0;
const stats = {
    tier1Countries: 0,  // used 15k+ threshold (well-covered)
    tier2Countries: 0,  // used 1k+ threshold (gap-fill)
    tier3Countries: 0,  // used 0+ threshold (catch-all)
    globalSnapped: 0,   // countries with no own dots
};

for (const countryCode of [...allCountryCodes].sort()) {
    const countryCities = citiesByCC[countryCode];
    const hasOwnDots = countryDots.has(countryCode);

    // Determine which population tier to use
    let threshold;
    const tier1Cities = countryCities.filter(c => c.pop >= POP_TIER_PRIMARY);

    if (tier1Cities.length >= 3) {
        // Well-covered: use primary threshold
        threshold = POP_TIER_PRIMARY;
        stats.tier1Countries++;
    } else {
        const tier2Cities = countryCities.filter(c => c.pop >= POP_TIER_SECONDARY);
        if (tier2Cities.length >= 1) {
            // Under-covered: lower to secondary
            threshold = POP_TIER_SECONDARY;
            stats.tier2Countries++;
        } else {
            // Nothing at all: include everything
            threshold = POP_TIER_TERTIARY;
            stats.tier3Countries++;
        }
    }

    const selectedCities = countryCities.filter(c => c.pop >= threshold);

    // Map each city to a dot
    const mappedCities = [];
    for (const city of selectedCities) {
        let dot;

        if (hasOwnDots) {
            dot = findNearestDotInCountry(city.lat, city.lon, city.countryCode);
        } else {
            // No dots for this country — snap globally
            dot = findNearestDotGlobal(city.lat, city.lon);
            if (dot) stats.globalSnapped++;
        }

        if (!dot) continue;

        mappedCities.push({
            name: city.name,
            ascii: city.ascii,
            lat: Math.round(city.lat * 100) / 100,
            lon: Math.round(city.lon * 100) / 100,
            pop: city.pop,
            dot,
        });
    }

    if (mappedCities.length > 0) {
        // Sort by population descending
        mappedCities.sort((a, b) => b.pop - a.pop);
        cityIndex[countryCode] = { cities: mappedCities };
        totalMapped += mappedCities.length;
    }
}

// ── Write output ───────────────────────────────────────────────────────
const output = { index: cityIndex };
const json = JSON.stringify(output);
writeFileSync(OUTPUT_PATH, json, 'utf-8');

const sizeKB = Math.round(json.length / 1024);
const sizeMB = (json.length / (1024 * 1024)).toFixed(2);

console.log('\n═══ Results ═══');
console.log(`  Countries with cities:     ${Object.keys(cityIndex).length}`);
console.log(`  Total cities mapped:       ${totalMapped}`);
console.log(`  Output size:               ${sizeKB} KB (${sizeMB} MB)`);
console.log(`  Written to:                ${OUTPUT_PATH}`);

console.log('\n═══ Tier Breakdown ═══');
console.log(`  Tier 1 (pop ≥ 15k):       ${stats.tier1Countries} countries`);
console.log(`  Tier 2 (pop ≥ 1k):        ${stats.tier2Countries} countries`);
console.log(`  Tier 3 (pop ≥ 0):         ${stats.tier3Countries} countries`);
console.log(`  Global-snapped cities:     ${stats.globalSnapped} (from countries with no own dots)`);

// ── Verify coverage against known sovereign states ─────────────────────
console.log('\n═══ Samples ═══');
const checkCodes = ['US', 'GB', 'IN', 'JP', 'AD', 'GD', 'TV', 'NR', 'VA', 'SM',
                     'CY', 'JM', 'LU', 'LI', 'SB', 'PW', 'FM', 'KN'];
for (const code of checkCodes) {
    const c = cityIndex[code];
    if (c) {
        console.log(`  ${code}: ${c.cities.length} cities (top: ${c.cities[0]?.name}, pop ${c.cities[0]?.pop})`);
    } else {
        console.log(`  ${code}: ❌ NO CITIES`);
    }
}

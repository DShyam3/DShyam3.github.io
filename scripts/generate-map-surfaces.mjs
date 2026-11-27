/**
 * Rebuild the Travel globe's local, north-up equirectangular surface rasters.
 * Run with Node and ImageMagick 7 from any directory:
 *   node scripts/generate-map-surfaces.mjs <elevation.tif> <satellite.jpg>
 *
 * Download the two 5400 × 2700 originals from the URLs below. The SHA-256
 * checks pin their orientation, registration and elevation encoding.
 *
 * Elevation: Jesse Allen, NASA Earth Observatory, using the GEBCO_08 Grid
 * (General Bathymetric Chart of the Oceans, British Oceanographic Data Centre).
 * https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/topography-bathymetry-maps/
 * https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/topography/gebco_08_rev_elev_5400x2700.tif
 *
 * Satellite: Reto Stöckli, NASA Earth Observatory. Blue Marble: Next
 * Generation, August 2004, MODIS land-surface composite.
 * https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/
 * https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/august/world.200408.3x5400x2700.jpg
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [elevation, satellite] = process.argv.slice(2);
// Each H3 tier gets colours averaged at its own geographic scale. Pack the
// four maps vertically and repeat coarse columns so all share a longitude axis.
const levels = [
    { res: 3, width: 360 },
    { res: 4, width: 900 },
    { res: 5, width: 1800 },
    { res: 6, width: 5400 },
];
const width = levels.at(-1).width;
const height = levels.reduce((sum, level) => sum + level.width / 2, 0);
const size = `${width}x${height}`;

function verify(path, sha256) {
    if (!path || createHash('sha256').update(readFileSync(path)).digest('hex') !== sha256) {
        throw new Error('Expected the original NASA elevation TIFF and August 2004 Blue Marble JPEG. See script header.');
    }
}
verify(elevation, '1a4d9f6774d80b19eb0c37efd8fb3b9a36a974417c24a52e559c6645accb5965');
verify(satellite, '2048023ccc62250c677c0f4b03d4362f997b130eb0154a6cad00aa1b27c390b9');

function convert(args, input) {
    return execFileSync('magick', args, { input, maxBuffer: 128 * 1024 * 1024 });
}

// A compact overview texture covers the first three tiers. The native-resolution
// tier loads separately, split at Greenwich to fit 4096px WebGL textures.
function writeSurface(look, pixels) {
    const save = (suffix, crop, target) => {
        const file = fileURLToPath(new URL(`../public/data/surface-${look}${suffix}.png`, import.meta.url));
        convert(['-size', size, '-depth', '8', 'rgb:-', '-crop', crop, '+repage',
            '-sample', target, '+dither', '-strip', '-define', 'png:exclude-chunks=all', `PNG8:${file}`], pixels);
    };
    const fine = levels.at(-1).width / 2;
    const overviewRows = height - fine;
    save('', `${width}x${overviewRows}+0+0`, `${levels.at(-2).width}x${overviewRows}!`);
    save('-west', `${fine}x${fine}+0+${overviewRows}`, `${fine}x${fine}!`);
    save('-east', `${fine}x${fine}+${fine}+${overviewRows}`, `${fine}x${fine}!`);
}

const topographic = ['#9eae83', '#b9c694', '#d6d09b', '#e7ca8e', '#d7ad79', '#b58c6a', '#d7cec0', '#f3ede0'];
const thresholds = [100, 250, 500, 1000, 1800, 2800, 4000];
function atlas(source, format) {
    return Buffer.concat(levels.map(level => {
        const rows = level.width / 2;
        return convert([source, '-scale', `${level.width}x${rows}!`, '-sample', `${width}x${rows}!`, '-depth', '8', format]);
    }));
}

const heights = atlas(elevation, 'gray:-');
const elevationColors = topographic.map(color => Number.parseInt(color.slice(1), 16));
const bands = Array.from({ length: 256 }, (_, byte) => {
    const metres = byte * 6400 / 255;
    const band = thresholds.findIndex(upper => metres < upper);
    return elevationColors[band === -1 ? thresholds.length : band];
});
const relief = Buffer.alloc(heights.length * 3);
for (let i = 0; i < heights.length; i++) relief.writeUIntBE(bands[heights[i]], i * 3, 3);
writeSurface('topographic', relief);

// Dithering alternates neighbouring colours on a pixel grid. It aliases when
// the map samples only one location per hex, so quantize with dithering off.
const rgb = convert(['-size', size, '-depth', '8', 'rgb:-', '+dither', '-colors', '96', '-depth', '8', 'rgb:-'], atlas(satellite, 'rgb:-'));
const colors = new Set();
for (let i = 0; i < rgb.length; i += 3) colors.add(rgb.readUIntBE(i, 3));
writeSurface('satellite', rgb);
const satelliteColors = Array.from(colors, color => '#' + color.toString(16).padStart(6, '0'));
let firstRow = 0;
const slices = levels.slice(0, -1).map(level => {
    const rows = level.width / 2;
    const slice = `    ${level.res}: { first: ${firstRow}, rows: ${rows} },`;
    firstRow += rows;
    return slice;
});
const paletteFile = new URL('../src/components/dot-matrix/surfaceColors.ts', import.meta.url);
writeFileSync(paletteFile,
    '// Generated by scripts/generate-map-surfaces.mjs alongside the map surface images.\n' +
    'export const surfaceColors = {\n' +
    `    topographic: ${JSON.stringify(topographic)},\n` +
    `    satellite: ${JSON.stringify(satelliteColors)},\n` +
    '} as const;\n\n' +
    'export const surfaceRows = {\n' + slices.join('\n') + '\n} as const;\n');

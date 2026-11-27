import { gridDisk, latLngToCell } from 'h3-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildHexTier } from './hexMapData';
import { CELL_STYLE, STYLE_CSS, cellStyle, drawCellsCanvas } from './globeHelpers';

beforeEach(() => {
    vi.stubGlobal('Path2D', class {
        segments = 0;
        moveTo() {}
        lineTo() { this.segments++; }
        closePath() {}
    });
});
afterEach(() => vi.unstubAllGlobals());

describe('canvas hex surfaces', () => {
    it.each([0, 1])('samples geographic colour and preserves terrain inside visited outlines, morph %i', async (progress) => {
        const tier = await buildHexTier({ res: 3, cells: [[latLngToCell(12, 10, 3), 'TD']] });
        const fills: string[] = [];
        const strokes: string[] = [];
        const context = {
            fillStyle: '',
            strokeStyle: '',
            fill() { fills.push(this.fillStyle); },
            stroke() { strokes.push(this.strokeStyle); },
        };
        const raster = { width: 2, height: 180, data: new Uint8ClampedArray(2 * 180 * 4) } as ImageData;
        for (let row = 0; row < 90; row++) raster.data[(2 * row + 1) * 4] = 1; // Northeastern quarter.
        const colors = ['#345678', '#56789a'];
        const render = (style: number, zoom: number, radius: number) => {
            fills.length = strokes.length = 0;
            drawCellsCanvas(context as unknown as CanvasRenderingContext2D, tier, Uint8Array.of(style), STYLE_CSS.dark, {
                width: 2500, height: 1500, radius, dpr: 1, progress,
                cosLat: 1, sinLat: 0, cosRot: 1, sinRot: 0,
                flatW: 2 * Math.PI * radius, flatH: 1200, flatX: 1250 - Math.PI * radius, flatY: 0,
            }, { color: 'white', alpha: 0, width: 1, visited: new Set(), accent: 'orange' }, { raster, colors, zoom });
        };
        render(CELL_STYLE.unvisited, 1, 200);
        expect(fills).toEqual([colors[1]]);
        render(CELL_STYLE.city, 1, 200);
        expect(fills).toEqual(['#ff571f']);
        expect(strokes).toEqual([]);
        render(CELL_STYLE.city, 3, 200);
        expect(fills).toEqual(['#ff571f']); // Still too small on screen for a ring.
        render(CELL_STYLE.city, 3, 900);
        expect(fills).toEqual([colors[1]]);
        expect(strokes).toEqual(['#552519', '#ff571f']);
        render(CELL_STYLE.selected, 3, 900);
        expect(fills).toEqual([STYLE_CSS.dark[CELL_STYLE.selected]]);
        expect(strokes).toEqual([]);
    });
});

describe('city markers and visited country borders', () => {
    it('styles only a city, the focused dot or a single hovered cell, with selection taking precedence', () => {
        const inputs = { cityHexes: new Set(['city']), hoveredKey: 'one', selected: null, focusedDot: 'focus' };
        expect(cellStyle('country-interior', inputs)).toBe(CELL_STYLE.unvisited);
        expect(cellStyle('one', inputs)).toBe(CELL_STYLE.unvisitedHovered);
        expect(cellStyle('city', inputs)).toBe(CELL_STYLE.city);
        expect(cellStyle('focus', inputs)).toBe(CELL_STYLE.city);
        expect(cellStyle('city', { ...inputs, hoveredKey: 'city' })).toBe(CELL_STYLE.cityHovered);
        expect(cellStyle('city', { ...inputs, selected: 'city', hoveredKey: 'city' })).toBe(CELL_STYLE.selected);
    });

    it.each([0, 0.5, 1])('traces a two-cell country perimeter once, including the neighbouring country’s side, morph %i', async progress => {
        const center = latLngToCell(6, 1, 3);
        const [neighbour, extension] = gridDisk(center, 1).filter(cell => cell !== center);
        // List the neighbour first so it owns the shared segment from its side.
        const tier = await buildHexTier({ res: 3, cells: [[neighbour, 'TG'], [center, 'GH'], [extension, 'GH']] });
        const strokes: { color: string; segments: number; width: number }[] = [];
        const ctx = {
            strokeStyle: '', lineWidth: 0,
            beginPath() {}, moveTo() {}, lineTo() {}, fill() {},
            stroke(path?: { segments: number }) {
                strokes.push({ color: this.strokeStyle, segments: path?.segments ?? 0, width: this.lineWidth });
            },
        };
        drawCellsCanvas(ctx as unknown as CanvasRenderingContext2D, tier, new Uint8Array(3), STYLE_CSS.light, {
            width: 1000, height: 600, radius: 200, progress, dpr: 1,
            cosLat: 1, sinLat: 0, cosRot: 1, sinRot: 0,
            flatW: 1000, flatH: 600, flatX: 0, flatY: 0,
        }, { color: 'black', alpha: 0.3, width: 1, visited: new Set(['GH']), accent: 'gold' });
        expect(strokes.filter(stroke => stroke.color === 'gold')).toEqual([{ color: 'gold', segments: 10, width: 1.8 }]);
    });
});

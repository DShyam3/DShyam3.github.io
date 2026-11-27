import { surfaceColors, surfaceRows } from './surfaceColors';

export type GeographicLook = keyof typeof surfaceColors;

async function decodeSurfaceImage(look: GeographicLook, suffix = ''): Promise<HTMLImageElement> {
    const image = new Image();
    image.decoding = 'async';
    image.src = `/data/surface-${look}${suffix}.png`;
    await image.decode();
    return image;
}

/** WebGL uploads the decoded image directly. Canvas only needs the 120 km tier. */
export async function loadMapSurface(look: GeographicLook) {
    const image = await decodeSurfaceImage(look);
    const { rows } = surfaceRows[3];
    const canvas = document.createElement('canvas');
    canvas.width = rows * 2;
    canvas.height = rows;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not read map surface');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, image.naturalWidth, rows, 0, 0, canvas.width, rows);
    const raster = ctx.getImageData(0, 0, canvas.width, rows);
    const colors = surfaceColors[look];
    const indices = new Map(colors.map((color, index) => [Number.parseInt(color.slice(1), 16), index] as const));
    for (let i = 0; i < raster.data.length; i += 4) {
        const rgb = (raster.data[i] << 16) | (raster.data[i + 1] << 8) | raster.data[i + 2];
        raster.data[i] = indices.get(rgb) ?? 0;
    }
    return { look, colors, raster, image };
}

export async function loadFineMapSurface(look: GeographicLook) {
    return Promise.all([decodeSurfaceImage(look, '-west'), decodeSurfaceImage(look, '-east')] as const);
}

import type { GlobeView } from './globeProjection';
import type { HexTierData } from './hexMapData';

/**
 * Draws the hex map's cells and borders with WebGL2.
 *
 * The canvas 2D version rebuilt a path of ~45,000 points every frame, one
 * native call per point, and spent ~40ms doing it -- the globe ran at 9-18fps
 * and kept the page busy whenever it was on screen. Here every cell and
 * border is uploaded once, in both projections, and a frame sends only the
 * turn, the zoom and how far the morph has got. The vertex shader places each
 * point on the globe and on the flat map and mixes the two, which is the same
 * arithmetic the 2D path does per point, moved onto the GPU.
 *
 * What a cell looks like (its colour and how far it is inset) is one byte
 * per cell in a small texture, rewritten when the visited set, the hover or
 * the selection changes, rather than per frame.
 */

export interface HexGlPalette {
    /** One RGBA colour per cell style, straight alpha, 0-1. */
    colors: Float32Array;
    /** How far each style's hex is drawn towards its corners, 0-1. */
    scales: Float32Array;
}

export interface HexGlBorders {
    /** 1 for white, 0 for black. */
    shade: number;
    alpha: number;
    /** Half the stroke width asked for, in CSS pixels. */
    halfWidth: number;
}

export interface HexGlRenderer {
    setCellStyles(styles: Uint8Array): void;
    render(view: GlobeView, palette: HexGlPalette, borders: HexGlBorders): void;
    dispose(): void;
}

/** Texels per row of the style texture; a cell's slot is `(index % width, index / width)`. */
const STYLE_TEX_WIDTH = 256;

const SHARED_GLSL = `#version 300 es
precision highp float;
uniform vec2 u_view;
uniform float u_radius;
uniform vec4 u_turn;
uniform vec4 u_flat;
uniform float u_progress;

vec3 globe(vec3 p) {
    vec3 s = p * u_radius;
    float xRot = s.x * u_turn.x - s.z * u_turn.y;
    float zRot = s.x * u_turn.y + s.z * u_turn.x;
    float yTilt = s.y * u_turn.z - zRot * u_turn.w;
    float zTilt = s.y * u_turn.w + zRot * u_turn.z;
    return vec3(u_view * 0.5 + vec2(xRot, yTilt), zTilt / u_radius);
}

vec2 flatMap(vec2 n) {
    return n * u_flat.xy + u_flat.zw;
}

vec4 toClip(vec2 p) {
    vec2 c = p / u_view * 2.0 - 1.0;
    return vec4(c.x, -c.y, 0.0, 1.0);
}

const vec4 CULLED = vec4(2.0, 2.0, 2.0, 1.0);
`;

const hexVertex = (styleCount: number) => `${SHARED_GLSL}
in vec3 a_c3;
in vec2 a_c2;
in vec3 a_v3;
in vec2 a_v2;
in vec3 a_meta;
uniform sampler2D u_style;
uniform vec4 u_colors[${styleCount}];
uniform float u_scales[${styleCount}];
out vec4 v_color;

void main() {
    vec3 centre = globe(a_c3);
    if ((centre.z < 0.0 && u_progress > 0.85) || (a_meta.z > 0.5 && u_progress < 0.5)) {
        gl_Position = CULLED;
        v_color = vec4(0.0);
        return;
    }
    int index = int(a_meta.x + 0.5);
    int style = int(texelFetch(u_style, ivec2(index % ${STYLE_TEX_WIDTH}, index / ${STYLE_TEX_WIDTH}), 0).r * 255.0 + 0.5);
    vec2 c = mix(flatMap(a_c2), centre.xy, u_progress);
    vec2 v = mix(flatMap(a_v2), globe(a_v3).xy, u_progress);
    vec2 p = c + (v - c) * (u_scales[style] * a_meta.y);
    // In sevenths, as the canvas 2D path batches it, so the two shade alike.
    float opacity = round(((1.0 - u_progress) + max(0.1, 0.45 + 0.55 * centre.z) * u_progress) * 6.0) / 6.0;
    vec4 color = u_colors[style];
    float alpha = color.a * opacity;
    v_color = vec4(color.rgb * alpha, alpha);
    gl_Position = toClip(p);
}
`;

const HEX_FRAGMENT = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 o_color;
void main() {
    o_color = v_color;
}
`;

const BORDER_VERTEX = `${SHARED_GLSL}
in vec3 a_p1;
in vec3 a_p2;
in vec2 a_f1;
in vec2 a_f2;
in vec3 a_meta;
uniform float u_halfWidth;

void main() {
    vec3 g1 = globe(a_p1);
    vec3 g2 = globe(a_p2);
    if ((a_meta.z > 0.5 && u_progress < 0.5) || (u_progress > 0.5 && g1.z < 0.0 && g2.z < 0.0)) {
        gl_Position = CULLED;
        return;
    }
    vec2 s1 = mix(flatMap(a_f1), g1.xy, u_progress);
    vec2 s2 = mix(flatMap(a_f2), g2.xy, u_progress);
    vec2 d = s2 - s1;
    float len = length(d);
    vec2 normal = len > 1e-4 ? vec2(-d.y, d.x) / len : vec2(0.0);
    gl_Position = toClip(mix(s1, s2, a_meta.x) + normal * a_meta.y * u_halfWidth);
}
`;

const BORDER_FRAGMENT = `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 o_color;
void main() {
    o_color = u_color;
}
`;

/** Attribute name and float count, in the order they sit in a vertex. */
type Layout = readonly (readonly [string, number])[];

const HEX_LAYOUT: Layout = [['a_c3', 3], ['a_c2', 2], ['a_v3', 3], ['a_v2', 2], ['a_meta', 3]];
const BORDER_LAYOUT: Layout = [['a_p1', 3], ['a_p2', 3], ['a_f1', 2], ['a_f2', 2], ['a_meta', 3]];
const STRIDE = 13;

const SHARED_UNIFORMS = ['u_view', 'u_radius', 'u_turn', 'u_flat', 'u_progress'] as const;

interface Program {
    program: WebGLProgram;
    uniforms: Map<string, WebGLUniformLocation | null>;
}

interface Mesh {
    vao: WebGLVertexArrayObject;
    buffers: WebGLBuffer[];
    count: number;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('createShader failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Shader did not compile: ${log}`);
    }
    return shader;
}

function link(gl: WebGL2RenderingContext, vertex: string, fragment: string, layout: Layout, uniforms: readonly string[]): Program {
    const vs = compile(gl, gl.VERTEX_SHADER, vertex);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram();
    if (!program) throw new Error('createProgram failed');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    layout.forEach(([name], location) => gl.bindAttribLocation(program, location, name));
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`Program did not link: ${log}`);
    }
    const locations = new Map<string, WebGLUniformLocation | null>();
    for (const name of [...SHARED_UNIFORMS, ...uniforms]) locations.set(name, gl.getUniformLocation(program, name));
    return { program, uniforms: locations };
}

function mesh(gl: WebGL2RenderingContext, data: Float32Array, indices: Uint32Array, layout: Layout): Mesh {
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    const ibo = gl.createBuffer();
    if (!vao || !vbo || !ibo) throw new Error('Buffer allocation failed');
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    let offset = 0;
    layout.forEach(([, size], location) => {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, STRIDE * 4, offset);
        offset += size * 4;
    });
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, buffers: [vbo, ibo], count: indices.length };
}

/** Each cell as a fan: its centre, then its corners, both projections per vertex. */
function hexGeometry(tier: HexTierData): { data: Float32Array; indices: Uint32Array } {
    let vertices = 0;
    let triangles = 0;
    for (const cell of tier.cells) {
        vertices += 1 + cell.verts3d.length;
        triangles += cell.verts3d.length;
    }
    const data = new Float32Array(vertices * STRIDE);
    const indices = new Uint32Array(triangles * 3);
    let v = 0;
    let i = 0;
    for (const cell of tier.cells) {
        const base = v;
        const c3 = cell.center3d;
        const c2 = cell.center2d;
        const anti = cell.crossesAntimeridian ? 1 : 0;
        const put = (ux: number, uy: number, uz: number, nx: number, ny: number, rim: number) => {
            const o = v * STRIDE;
            data[o] = c3.ux; data[o + 1] = c3.uy; data[o + 2] = c3.uz;
            data[o + 3] = c2.nx; data[o + 4] = c2.ny;
            data[o + 5] = ux; data[o + 6] = uy; data[o + 7] = uz;
            data[o + 8] = nx; data[o + 9] = ny;
            data[o + 10] = cell.index; data[o + 11] = rim; data[o + 12] = anti;
            v++;
        };
        put(c3.ux, c3.uy, c3.uz, c2.nx, c2.ny, 0);
        const n = cell.verts3d.length;
        for (let k = 0; k < n; k++) {
            const p = cell.verts3d[k];
            const f = cell.verts2d[k];
            put(p.ux, p.uy, p.uz, f.nx, f.ny, 1);
        }
        for (let k = 0; k < n; k++) {
            indices[i++] = base;
            indices[i++] = base + 1 + k;
            indices[i++] = base + 1 + ((k + 1) % n);
        }
    }
    return { data, indices };
}

/**
 * Each border segment as a quad, widened in screen space by the shader so the
 * stroke keeps its pixel width at any zoom (WebGL's own lines are 1px).
 */
function borderGeometry(tier: HexTierData): { data: Float32Array; indices: Uint32Array } {
    const segments = tier.borderSegments;
    const data = new Float32Array(segments.length * 4 * STRIDE);
    const indices = new Uint32Array(segments.length * 6);
    let v = 0;
    let i = 0;
    for (const seg of segments) {
        const base = v;
        const anti = seg.crossesAntimeridian ? 1 : 0;
        for (const end of [0, 1]) {
            for (const side of [-1, 1]) {
                const o = v * STRIDE;
                data[o] = seg.p1.ux; data[o + 1] = seg.p1.uy; data[o + 2] = seg.p1.uz;
                data[o + 3] = seg.p2.ux; data[o + 4] = seg.p2.uy; data[o + 5] = seg.p2.uz;
                data[o + 6] = seg.fx1; data[o + 7] = seg.fy1;
                data[o + 8] = seg.fx2; data[o + 9] = seg.fy2;
                data[o + 10] = end; data[o + 11] = side; data[o + 12] = anti;
                v++;
            }
        }
        indices[i++] = base; indices[i++] = base + 1; indices[i++] = base + 2;
        indices[i++] = base + 1; indices[i++] = base + 3; indices[i++] = base + 2;
    }
    return { data, indices };
}

/**
 * A renderer for `tier` on `canvas`, or null where WebGL2 is not available;
 * the globe then draws with canvas 2D. `onLost` fires if the GPU takes the
 * context away mid-session, which is the globe's cue to fall back the same way.
 */
export function createHexGlRenderer(
    canvas: HTMLCanvasElement,
    tier: HexTierData,
    styleCount: number,
    onLost: () => void,
): HexGlRenderer | null {
    const gl = canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: true,
        depth: false,
        stencil: false,
        powerPreference: 'low-power',
    });
    if (!gl || gl.isContextLost()) return null;

    const hexProgram = link(gl, hexVertex(styleCount), HEX_FRAGMENT, HEX_LAYOUT, ['u_style', 'u_colors', 'u_scales']);
    const borderProgram = link(gl, BORDER_VERTEX, BORDER_FRAGMENT, BORDER_LAYOUT, ['u_halfWidth', 'u_color']);
    const hexGeo = hexGeometry(tier);
    const hexMesh = mesh(gl, hexGeo.data, hexGeo.indices, HEX_LAYOUT);
    const borderGeo = borderGeometry(tier);
    const borderMesh = mesh(gl, borderGeo.data, borderGeo.indices, BORDER_LAYOUT);

    const rows = Math.max(1, Math.ceil(tier.cells.length / STYLE_TEX_WIDTH));
    const stylePixels = new Uint8Array(STYLE_TEX_WIDTH * rows);
    const styleTexture = gl.createTexture();
    if (!styleTexture) throw new Error('createTexture failed');
    gl.bindTexture(gl.TEXTURE_2D, styleTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, STYLE_TEX_WIDTH, rows, 0, gl.RED, gl.UNSIGNED_BYTE, stylePixels);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    let lost = false;
    const handleLost = () => {
        lost = true;
        onLost();
    };
    canvas.addEventListener('webglcontextlost', handleLost);

    const setShared = (program: Program, view: GlobeView) => {
        const u = program.uniforms;
        gl.uniform2f(u.get('u_view') ?? null, view.width, view.height);
        gl.uniform1f(u.get('u_radius') ?? null, view.radius);
        gl.uniform4f(u.get('u_turn') ?? null, view.cosRot, view.sinRot, view.cosLat, view.sinLat);
        gl.uniform4f(u.get('u_flat') ?? null, view.flatW, view.flatH, view.flatX, view.flatY);
        gl.uniform1f(u.get('u_progress') ?? null, view.progress);
    };

    return {
        setCellStyles(styles) {
            if (lost) return;
            stylePixels.set(styles.subarray(0, Math.min(styles.length, stylePixels.length)));
            gl.bindTexture(gl.TEXTURE_2D, styleTexture);
            gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, STYLE_TEX_WIDTH, rows, gl.RED, gl.UNSIGNED_BYTE, stylePixels);
        },

        render(view, palette, borders) {
            if (lost) return;
            // Resizing reallocates the drawing buffer, so only on a change.
            const width = Math.max(1, Math.round(view.width * view.dpr));
            const height = Math.max(1, Math.round(view.height * view.dpr));
            if (canvas.width !== width) canvas.width = width;
            if (canvas.height !== height) canvas.height = height;
            gl.viewport(0, 0, width, height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            if (view.width <= 0 || view.height <= 0) return;
            gl.enable(gl.BLEND);

            if (borders.alpha > 0.015) {
                gl.useProgram(borderProgram.program);
                setShared(borderProgram, view);
                // A quad under a device pixel wide is left to multisampling,
                // which a browser may not give. Draw it a pixel wide instead,
                // and fainter by as much, so it covers what it would have.
                const minHalf = 0.5 / view.dpr;
                const halfWidth = Math.max(borders.halfWidth, minHalf);
                gl.uniform1f(borderProgram.uniforms.get('u_halfWidth') ?? null, halfWidth);
                const a = borders.alpha * (borders.halfWidth / halfWidth);
                const shade = borders.shade * a;
                gl.uniform4f(borderProgram.uniforms.get('u_color') ?? null, shade, shade, shade, a);
                // Segments meet at every hex corner, and their quads overlap
                // there. MAX rather than blending keeps those joints the same
                // strength as the line, as one canvas stroke would be.
                gl.blendEquation(gl.MAX);
                gl.bindVertexArray(borderMesh.vao);
                gl.drawElements(gl.TRIANGLES, borderMesh.count, gl.UNSIGNED_INT, 0);
            }

            gl.useProgram(hexProgram.program);
            setShared(hexProgram, view);
            gl.uniform4fv(hexProgram.uniforms.get('u_colors') ?? null, palette.colors);
            gl.uniform1fv(hexProgram.uniforms.get('u_scales') ?? null, palette.scales);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, styleTexture);
            gl.uniform1i(hexProgram.uniforms.get('u_style') ?? null, 0);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.bindVertexArray(hexMesh.vao);
            gl.drawElements(gl.TRIANGLES, hexMesh.count, gl.UNSIGNED_INT, 0);
            gl.bindVertexArray(null);
        },

        dispose() {
            canvas.removeEventListener('webglcontextlost', handleLost);
            if (!lost) {
                for (const m of [hexMesh, borderMesh]) {
                    gl.deleteVertexArray(m.vao);
                    for (const b of m.buffers) gl.deleteBuffer(b);
                }
                gl.deleteTexture(styleTexture);
                gl.deleteProgram(hexProgram.program);
                gl.deleteProgram(borderProgram.program);
            }
            // Give the context back once the canvas has left the page, rather
            // than waiting on garbage collection: browsers cap live contexts.
            // A canvas still attached is being re-mounted (Fast Refresh, or a
            // new tier), and losing its context would leave the next renderer
            // on it nothing to draw with.
            setTimeout(() => {
                if (!canvas.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext();
            }, 0);
        },
    };
}

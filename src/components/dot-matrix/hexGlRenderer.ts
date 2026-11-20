import type { GlobeView } from './globeProjection';
import type { HexPatchData } from './hexMapData';

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
 *
 * Cells come in patches: the base level is one, and the finer levels are
 * cut into many, each uploaded once when it first comes on screen and kept.
 * A frame draws whichever patches it is given, each at its own opacity, so
 * one level can fade into the next.
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

/** One patch to draw this frame, and how opaque. */
export interface HexGlDraw {
    key: string;
    alpha: number;
}

export interface HexGlRenderer {
    /** Uploads a patch's cells and borders. A key already held is replaced. */
    addPatch(key: string, data: HexPatchData): void;
    hasPatch(key: string): boolean;
    removePatch(key: string): void;
    /** One style byte per cell of the patch, in its cell order. */
    setPatchStyles(key: string, styles: Uint8Array): void;
    render(view: GlobeView, palette: HexGlPalette, borders: HexGlBorders, draws: readonly HexGlDraw[]): void;
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
uniform float u_alpha;

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
    if ((centre.z < 0.0 && u_progress > 0.85) || u_progress < a_meta.z) {
        gl_Position = CULLED;
        v_color = vec4(0.0);
        return;
    }
    int index = int(a_meta.x + 0.5);
    int style = int(texelFetch(u_style, ivec2(index % ${STYLE_TEX_WIDTH}, index / ${STYLE_TEX_WIDTH}), 0).r * 255.0 + 0.5);
    vec2 c = mix(flatMap(a_c2), centre.xy, u_progress);
    vec2 v = mix(flatMap(a_v2), globe(a_v3).xy, u_progress);
    vec2 p = c + (v - c) * (u_scales[style] * a_meta.y);
    float opacity = (1.0 - u_progress) + max(0.1, 0.45 + 0.55 * centre.z) * u_progress;
    vec4 color = u_colors[style];
    float alpha = color.a * opacity * u_alpha;
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
    if (u_progress < a_meta.z || (u_progress > 0.5 && g1.z < 0.0 && g2.z < 0.0)) {
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

const SHARED_UNIFORMS = ['u_view', 'u_radius', 'u_turn', 'u_flat', 'u_progress', 'u_alpha'] as const;

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
function hexGeometry(patch: HexPatchData): { data: Float32Array; indices: Uint32Array } {
    const corners = patch.cornerStart[patch.count];
    const data = new Float32Array((patch.count + corners) * STRIDE);
    const indices = new Uint32Array(corners * 3);
    const { centre3, centre2, corner3, corner2, cornerStart, hide } = patch;
    let v = 0;
    let i = 0;
    for (let cell = 0; cell < patch.count; cell++) {
        const base = v;
        const put = (k3: Float32Array, o3: number, k2: Float32Array, o2: number, rim: number) => {
            const o = v * STRIDE;
            data[o] = centre3[cell * 3]; data[o + 1] = centre3[cell * 3 + 1]; data[o + 2] = centre3[cell * 3 + 2];
            data[o + 3] = centre2[cell * 2]; data[o + 4] = centre2[cell * 2 + 1];
            data[o + 5] = k3[o3]; data[o + 6] = k3[o3 + 1]; data[o + 7] = k3[o3 + 2];
            data[o + 8] = k2[o2]; data[o + 9] = k2[o2 + 1];
            data[o + 10] = cell; data[o + 11] = rim; data[o + 12] = hide[cell];
            v++;
        };
        put(centre3, cell * 3, centre2, cell * 2, 0);
        const first = cornerStart[cell];
        const n = cornerStart[cell + 1] - first;
        for (let k = 0; k < n; k++) put(corner3, (first + k) * 3, corner2, (first + k) * 2, 1);
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
function borderGeometry(patch: HexPatchData): { data: Float32Array; indices: Uint32Array } {
    const n = patch.borderCount;
    const data = new Float32Array(n * 4 * STRIDE);
    const indices = new Uint32Array(n * 6);
    const { border3, border2, borderHide } = patch;
    let v = 0;
    let i = 0;
    for (let seg = 0; seg < n; seg++) {
        const base = v;
        for (const end of [0, 1]) {
            for (const side of [-1, 1]) {
                const o = v * STRIDE;
                for (let j = 0; j < 6; j++) data[o + j] = border3[seg * 6 + j];
                for (let j = 0; j < 4; j++) data[o + 6 + j] = border2[seg * 4 + j];
                data[o + 10] = end; data[o + 11] = side; data[o + 12] = borderHide[seg];
                v++;
            }
        }
        indices[i++] = base; indices[i++] = base + 1; indices[i++] = base + 2;
        indices[i++] = base + 1; indices[i++] = base + 3; indices[i++] = base + 2;
    }
    return { data, indices };
}

/** A patch as the GPU holds it. */
interface GpuPatch {
    hex: Mesh;
    border: Mesh;
    texture: WebGLTexture;
    rows: number;
    pixels: Uint8Array;
}

/**
 * A renderer on `canvas`, or null where WebGL2 is not available; the globe
 * then draws with canvas 2D. `onLost` fires if the GPU takes the context away
 * mid-session, which is the globe's cue to fall back the same way.
 */
export function createHexGlRenderer(
    canvas: HTMLCanvasElement,
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
    const patches = new Map<string, GpuPatch>();

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

    const release = (patch: GpuPatch) => {
        for (const m of [patch.hex, patch.border]) {
            gl.deleteVertexArray(m.vao);
            for (const b of m.buffers) gl.deleteBuffer(b);
        }
        gl.deleteTexture(patch.texture);
    };

    const uploadStyles = (patch: GpuPatch) => {
        gl.bindTexture(gl.TEXTURE_2D, patch.texture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, STYLE_TEX_WIDTH, patch.rows, gl.RED, gl.UNSIGNED_BYTE, patch.pixels);
    };

    return {
        addPatch(key, data) {
            if (lost) return;
            const old = patches.get(key);
            if (old) release(old);
            const hexGeo = hexGeometry(data);
            const borderGeo = borderGeometry(data);
            const rows = Math.max(1, Math.ceil(data.count / STYLE_TEX_WIDTH));
            const pixels = new Uint8Array(STYLE_TEX_WIDTH * rows);
            const texture = gl.createTexture();
            if (!texture) throw new Error('createTexture failed');
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, STYLE_TEX_WIDTH, rows, 0, gl.RED, gl.UNSIGNED_BYTE, pixels);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            patches.set(key, {
                hex: mesh(gl, hexGeo.data, hexGeo.indices, HEX_LAYOUT),
                border: mesh(gl, borderGeo.data, borderGeo.indices, BORDER_LAYOUT),
                texture,
                rows,
                pixels,
            });
        },

        hasPatch(key) {
            return patches.has(key);
        },

        removePatch(key) {
            const patch = patches.get(key);
            if (!patch) return;
            if (!lost) release(patch);
            patches.delete(key);
        },

        setPatchStyles(key, styles) {
            const patch = patches.get(key);
            if (lost || !patch) return;
            patch.pixels.set(styles.subarray(0, Math.min(styles.length, patch.pixels.length)));
            uploadStyles(patch);
        },

        render(view, palette, borders, draws) {
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
            const visible = draws.filter((d) => d.alpha > 0.004 && patches.has(d.key));

            if (borders.alpha > 0.015) {
                gl.useProgram(borderProgram.program);
                setShared(borderProgram, view);
                // A quad under a device pixel wide is left to multisampling,
                // which a browser may not give. Draw it a pixel wide instead,
                // and fainter by as much, so it covers what it would have.
                const minHalf = 0.5 / view.dpr;
                const halfWidth = Math.max(borders.halfWidth, minHalf);
                gl.uniform1f(borderProgram.uniforms.get('u_halfWidth') ?? null, halfWidth);
                // Segments meet at every hex corner, and their quads overlap
                // there; so do the two halves of a border between patches.
                // MAX rather than blending keeps those joints the same
                // strength as the line, as one canvas stroke would be.
                gl.blendEquation(gl.MAX);
                for (const draw of visible) {
                    const a = borders.alpha * (borders.halfWidth / halfWidth) * draw.alpha;
                    const shade = borders.shade * a;
                    gl.uniform4f(borderProgram.uniforms.get('u_color') ?? null, shade, shade, shade, a);
                    const patch = patches.get(draw.key)!;
                    gl.bindVertexArray(patch.border.vao);
                    gl.drawElements(gl.TRIANGLES, patch.border.count, gl.UNSIGNED_INT, 0);
                }
            }

            gl.useProgram(hexProgram.program);
            setShared(hexProgram, view);
            gl.uniform4fv(hexProgram.uniforms.get('u_colors') ?? null, palette.colors);
            gl.uniform1fv(hexProgram.uniforms.get('u_scales') ?? null, palette.scales);
            gl.activeTexture(gl.TEXTURE0);
            gl.uniform1i(hexProgram.uniforms.get('u_style') ?? null, 0);
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            for (const draw of visible) {
                const patch = patches.get(draw.key)!;
                gl.uniform1f(hexProgram.uniforms.get('u_alpha') ?? null, draw.alpha);
                gl.bindTexture(gl.TEXTURE_2D, patch.texture);
                gl.bindVertexArray(patch.hex.vao);
                gl.drawElements(gl.TRIANGLES, patch.hex.count, gl.UNSIGNED_INT, 0);
            }
            gl.bindVertexArray(null);
        },

        dispose() {
            canvas.removeEventListener('webglcontextlost', handleLost);
            if (!lost) {
                for (const patch of patches.values()) release(patch);
                gl.deleteProgram(hexProgram.program);
                gl.deleteProgram(borderProgram.program);
            }
            patches.clear();
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

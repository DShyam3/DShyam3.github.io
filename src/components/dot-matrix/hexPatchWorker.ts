/// <reference lib="webworker" />
/**
 * Builds detail-level patches off the main thread. A level-5 patch takes tens
 * of milliseconds, and a view needs dozens, which on the main thread would
 * stall every frame while the map fills in.
 *
 * The page sends the whole list it wants, nearest first, every time the view
 * moves. The worker builds one patch at a time from the newest list, so
 * patches that scrolled off before their turn are never built.
 */
import { getMapProjection, type MapProjectionId } from '@/lib/mapProjections';
import { buildPatch, loadDetailLevel, type DetailRes } from './hexDetail';

export interface PatchWant {
    type: 'want';
    res: DetailRes;
    projection: MapProjectionId;
    keys: string[];
}

export interface PatchBuilt {
    type: 'built';
    res: DetailRes;
    projection: MapProjectionId;
    key: string;
    h3: string[];
    codes: string[];
    data: import('./hexMapData').HexPatchData;
}

export interface PatchFailed {
    type: 'failed';
    res: DetailRes;
}

/** Asks for a level to be loaded and cut into patches ahead of any `want`. */
export interface LevelPrepare {
    type: 'prepare';
    res: DetailRes;
}

/** Patches the page has dropped, which may be asked for again; or, with no keys, all of them. */
export interface PatchForget {
    type: 'forget';
    res?: DetailRes;
    projection?: MapProjectionId;
    keys?: string[];
}

/** The patches a level has land in, so the page knows what to ask for. */
export interface LevelReady {
    type: 'level';
    res: DetailRes;
    keys: string[];
}

const scope = self as unknown as DedicatedWorkerGlobalScope;
let wanted: PatchWant | null = null;
let running = false;
/**
 * Patches already sent. The page asks again for everything it has not had
 * back, which includes the one being built as the list arrives; without this
 * that one would be built twice.
 */
const built = new Set<string>();
const idOf = (res: DetailRes, projection: string, key: string) => `${res}|${projection}|${key}`;

async function run() {
    if (running) return;
    running = true;
    try {
        while (wanted && wanted.keys.length > 0) {
            const { res, projection } = wanted;
            const key = wanted.keys.shift()!;
            if (built.has(idOf(res, projection, key))) continue;
            let level;
            try {
                level = await loadDetailLevel(res);
            } catch {
                scope.postMessage({ type: 'failed', res } satisfies PatchFailed);
                wanted = null;
                break;
            }
            const patch = buildPatch(level, key, getMapProjection(projection));
            const { data } = patch;
            built.add(idOf(res, projection, key));
            const message: PatchBuilt = { type: 'built', res, projection, key, h3: patch.h3, codes: patch.codes, data };
            scope.postMessage(message, [
                data.centre3.buffer,
                data.centre2.buffer,
                data.cornerStart.buffer,
                data.corner3.buffer,
                data.corner2.buffer,
                data.hide.buffer,
                data.border3.buffer,
                data.border2.buffer,
                data.borderHide.buffer,
            ]);
            // Let a newer list in before the next build.
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    } finally {
        running = false;
    }
}

scope.onmessage = (event: MessageEvent<PatchWant | LevelPrepare | PatchForget>) => {
    const message = event.data;
    if (message?.type === 'forget') {
        if (!message.keys) built.clear();
        else for (const key of message.keys) built.delete(idOf(message.res!, message.projection!, key));
        return;
    }
    if (message?.type === 'prepare') {
        loadDetailLevel(message.res)
            .then((level) => scope.postMessage({ type: 'level', res: message.res, keys: [...level.patches.keys()] } satisfies LevelReady))
            .catch(() => scope.postMessage({ type: 'failed', res: message.res } satisfies PatchFailed));
        return;
    }
    if (message?.type !== 'want') return;
    wanted = { ...message, keys: message.keys.filter((key) => !built.has(idOf(message.res, message.projection, key))) };
    void run();
};

import { EXCERPTS_NAME, emptyExcerpts, normalizeExcerpts, normalizeExcerpt, excerptBytes } from './excerpt-schema.js';
import { uploadJson, readJson, createCoordinateHostPorts } from '../../runtime/coordinate-host-ports.js';

export function createExcerptRepository({ ports = createCoordinateHostPorts() } = {}) {
    let cache = null;
    let readPromise = null;
    let mutation = Promise.resolve();

    const readIndex = async (force = false) => {
        if (cache && !force) return cache;
        if (readPromise && !force) return readPromise;
        readPromise = (async () => {
            const result = await readJson(ports, EXCERPTS_NAME);
            const next = result.missing ? emptyExcerpts() : normalizeExcerpts(result.value);
            if (!next) throw new Error(`invalid excerpt index: ${EXCERPTS_NAME}`);
            cache = next;
            return cache;
        })();
        try { return await readPromise; } finally { readPromise = null; }
    };
    const saveIndex = async () => {
        if (!cache) throw new Error('excerpt index is not loaded');
        await uploadJson(ports, EXCERPTS_NAME, cache);
    };
    const serial = task => {
        const next = mutation.then(task, task);
        mutation = next.catch(() => {});
        return next;
    };
    const newId = () => globalThis.crypto?.randomUUID?.() || `x-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    return {
        ports,
        loadIndex: readIndex,
        invalidate() { cache = null; },
        list: async () => [...(await readIndex()).items],
        count: async () => (await readIndex()).items.length,
        get: async id => (await readIndex()).items.find(item => item.id === String(id)) || null,
        estimateBytes: async () => (await readIndex()).items.reduce((sum, item) => sum + excerptBytes(item), 0),
        add: payload => serial(async () => {
            const idx = await readIndex();
            const item = normalizeExcerpt({ ...payload, id: payload?.id || newId(), ts: payload?.ts || Date.now() });
            if (!item.quote) throw new Error('empty excerpt quote');
            if (!item.id) item.id = newId();
            idx.items = [item, ...idx.items.filter(entry => entry.id !== item.id)];
            await saveIndex();
            return item;
        }),
        update: (id, patch) => serial(async () => {
            const idx = await readIndex();
            const i = idx.items.findIndex(item => item.id === String(id));
            if (i < 0) return null;
            const item = normalizeExcerpt({ ...idx.items[i], ...patch, id: idx.items[i].id });
            if (!item.quote) throw new Error('empty excerpt quote');
            idx.items[i] = item;
            await saveIndex();
            return item;
        }),
        remove: id => serial(async () => {
            const idx = await readIndex();
            const before = idx.items.length;
            const removed = idx.items.find(item => item.id === String(id)) || null;
            idx.items = idx.items.filter(item => item.id !== String(id));
            if (idx.items.length !== before) await saveIndex();
            return removed;
        }),
        clearAll: () => serial(async () => {
            cache = emptyExcerpts();
            await saveIndex();
            return true;
        }),
        stripTag: id => serial(async () => {
            const want = String(id || '');
            if (!want) return 0;
            const idx = await readIndex();
            let n = 0;
            idx.items = idx.items.map(item => {
                if (!item.tags?.includes(want)) return item;
                n++;
                return { ...item, tags: item.tags.filter(tag => tag !== want) };
            });
            if (n) await saveIndex();
            return n;
        }),
    };
}

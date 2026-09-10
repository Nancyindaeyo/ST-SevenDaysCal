import { ACTIVITY_CAP, normalizeActivityEntry } from './schema.js';

const LEGACY_ACTIVITY_PREFIX = 'sp-activity:';

export function parseActivityPayload(raw) {
    if (Array.isArray(raw?.entries)) return raw.entries;
    if (Array.isArray(raw)) return raw;
    return null;
}

export function createActivityChatStorage({ read, write, browserStorage, chatId } = {}) {
    const forgetLegacy = id => {
        if (!id) return;
        try { browserStorage?.removeItem?.(`${LEGACY_ACTIVITY_PREFIX}${id}`); } catch {}
    };
    return {
        getItem() {
            const fromStore = parseActivityPayload(read?.());
            if (fromStore) return JSON.stringify(fromStore);
            const id = chatId?.();
            if (!id) return '[]';
            try {
                const legacy = browserStorage?.getItem?.(`${LEGACY_ACTIVITY_PREFIX}${id}`);
                if (!legacy) return '[]';
                const parsed = JSON.parse(legacy);
                if (!Array.isArray(parsed) || !parsed.length) return '[]';
                write?.({ entries: parsed, ts: Date.now() });
                forgetLegacy(id);
                return JSON.stringify(parsed);
            } catch {
                return '[]';
            }
        },
        setItem(_key, value) {
            let entries = [];
            try { entries = JSON.parse(value); } catch { entries = []; }
            write?.({ entries: Array.isArray(entries) ? entries : [], ts: Date.now() });
            forgetLegacy(chatId?.());
        },
    };
}

export function createActivityStore({ storage, keyForChat, cap = ACTIVITY_CAP } = {}) {
    const memory = new Map();
    const bucket = chatId => String(chatId ?? '');
    const read = chatId => {
        const id = bucket(chatId);
        if (memory.has(id)) return memory.get(id).map(entry => normalizeActivityEntry(entry)).slice(0, cap);
        const key = keyForChat?.(chatId);
        if (!key) return [];
        try {
            const parsed = JSON.parse(storage?.getItem?.(key) || '[]');
            return (Array.isArray(parsed) ? parsed : []).map(entry => normalizeActivityEntry(entry)).slice(0, cap);
        } catch {
            return [];
        }
    };
    const write = (chatId, list) => {
        const id = bucket(chatId);
        const normalized = (Array.isArray(list) ? list : []).map(entry => normalizeActivityEntry(entry)).slice(0, cap);
        memory.set(id, normalized);
        const key = keyForChat?.(chatId);
        if (!key || typeof storage?.setItem !== 'function') return { ok: true, memoryOnly: true };
        try {
            storage.setItem(key, JSON.stringify(normalized));
            return { ok: true };
        } catch {
            try {
                storage.setItem(key, JSON.stringify(normalized.slice(0, 8)));
                return { ok: true, truncated: true };
            } catch {
                return { ok: true, memoryOnly: true };
            }
        }
    };
    return {
        list: chatId => read(chatId),
        prepend(chatId, entry) {
            const next = [normalizeActivityEntry(entry), ...read(chatId).filter(item => item.id !== entry.id)];
            write(chatId, next);
            return next[0];
        },
        update(chatId, id, patch) {
            const list = read(chatId);
            const index = list.findIndex(item => item.id === String(id));
            if (index < 0) return null;
            list[index] = normalizeActivityEntry({ ...list[index], ...patch, id: list[index].id });
            write(chatId, list);
            return list[index];
        },
        clearMemory(chatId) {
            if (chatId == null) memory.clear();
            else memory.delete(bucket(chatId));
        },
    };
}

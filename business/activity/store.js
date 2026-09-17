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
            let legacy;
            try {
                legacy = browserStorage?.getItem?.(`${LEGACY_ACTIVITY_PREFIX}${id}`);
            } catch {
                return '[]';
            }
            if (!legacy) return '[]';
            let parsed;
            try { parsed = JSON.parse(legacy); } catch { return '[]'; }
            if (!Array.isArray(parsed) || !parsed.length) return '[]';
            if (typeof write !== 'function' || write({ entries: parsed, ts: Date.now() }) === false) {
                throw new Error('activity-write-failed');
            }
            forgetLegacy(id);
            return JSON.stringify(parsed);
        },
        setItem(_key, value) {
            let entries = [];
            try { entries = JSON.parse(value); } catch { entries = []; }
            if (typeof write !== 'function' || write({ entries: Array.isArray(entries) ? entries : [], ts: Date.now() }) === false) {
                throw new Error('activity-write-failed');
            }
            forgetLegacy(chatId?.());
        },
    };
}

export function createActivityStore({ storage, keyForChat, cap = ACTIVITY_CAP, onPersistenceError } = {}) {
    const memory = new Map();
    const bucket = chatId => String(chatId ?? '');
    const reportFailure = (reason, error = null, context = {}) => {
        const result = { ok: false, memoryOnly: true, reason, error };
        try { onPersistenceError?.(result, context); } catch {}
        return result;
    };
    const read = chatId => {
        const id = bucket(chatId);
        if (memory.has(id)) return memory.get(id).map(entry => normalizeActivityEntry(entry)).slice(0, cap);
        const key = keyForChat?.(chatId);
        if (!key) return [];
        try {
            const parsed = JSON.parse(storage?.getItem?.(key) || '[]');
            return (Array.isArray(parsed) ? parsed : []).map(entry => normalizeActivityEntry(entry)).slice(0, cap);
        } catch (error) {
            reportFailure('storage-read-failed', error, { chatId });
            return [];
        }
    };
    const write = (chatId, list) => {
        const id = bucket(chatId);
        const normalized = (Array.isArray(list) ? list : []).map(entry => normalizeActivityEntry(entry)).slice(0, cap);
        memory.set(id, normalized);
        const key = keyForChat?.(chatId);
        const failed = (reason, error = null) => reportFailure(reason, error, { chatId, entries: normalized });
        if (!key || typeof storage?.setItem !== 'function') return failed('storage-unavailable');
        try {
            if (storage.setItem(key, JSON.stringify(normalized)) === false) throw new Error('storage-write-returned-false');
            return { ok: true };
        } catch (firstError) {
            try {
                if (storage.setItem(key, JSON.stringify(normalized.slice(0, 8))) === false) throw new Error('storage-write-returned-false');
                return { ok: true, truncated: true };
            } catch (secondError) {
                return failed('storage-write-failed', secondError || firstError);
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

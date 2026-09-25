import { ACTIVITY_CAP, activityPersistMarker, normalizeActivityEntry } from './schema.js';

const LEGACY_ACTIVITY_PREFIX = 'sp-activity:';

export function parseActivityPayload(raw) {
    if (Array.isArray(raw?.entries)) return raw.entries;
    if (Array.isArray(raw)) return raw;
    return null;
}

export function createActivityChatStorage({ read, write, writeConfirmed, browserStorage, chatId } = {}) {
    const forgetLegacy = id => {
        if (!id) return;
        try { browserStorage?.removeItem?.(`${LEGACY_ACTIVITY_PREFIX}${id}`); } catch {}
    };
    const liveChatId = () => String(chatId?.() || '');
    const persistSync = (payload, id) => {
        if (liveChatId() !== String(id || '')) return false;
        return typeof write === 'function' && write(payload) !== false;
    };
    return {
        getItem() {
            const fromStore = parseActivityPayload(read?.());
            if (fromStore) return JSON.stringify(fromStore);
            const id = liveChatId();
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
            if (!persistSync({ entries: parsed, ts: Date.now(), chatId: id }, id)) {
                throw new Error('activity-write-failed');
            }
            forgetLegacy(id);
            return JSON.stringify(parsed);
        },
        setItem(_key, value) {
            let entries = [];
            try { entries = JSON.parse(value); } catch { entries = []; }
            const id = liveChatId();
            const payload = { entries: Array.isArray(entries) ? entries : [], ts: Date.now(), chatId: id };
            if (typeof writeConfirmed === 'function') {
                if (!id) return Promise.resolve({ ok: false, reason: 'missing-chat', commitState: 'not-dispatched' });
                return writeConfirmed(payload, { ownerGuard: () => liveChatId() === id });
            }
            if (!persistSync(payload, id)) throw new Error('activity-write-failed');
            forgetLegacy(id);
        },
    };
}

export function createActivityStore({
    storage,
    keyForChat,
    cap = ACTIVITY_CAP,
    onPersistenceError,
    persistConfirmed,
    captureIdentity,
    readRecovery,
    writeRecovery,
} = {}) {
    const memory = new Map();
    const bucket = chatId => String(chatId ?? '');
    const liveIdentity = () => captureIdentity?.() || {};
    const reportFailure = (reason, error = null, context = {}) => {
        const result = { ok: false, memoryOnly: true, reason, error, persistState: context.persistState || '' };
        try { onPersistenceError?.(result, context); } catch {}
        return result;
    };
    const recover = (chatId, entries, persist = {}) => {
        const marker = activityPersistMarker(chatId, entries, persist);
        const next = (readRecovery?.() || []).filter(item => item?.chatId !== marker.chatId);
        next.push(marker);
        writeRecovery?.(next);
        return marker;
    };
    const forgetRecovery = chatId => {
        writeRecovery?.((readRecovery?.() || []).filter(item => item?.chatId !== bucket(chatId)));
    };
    const sameChat = chatId => {
        const live = String(liveIdentity().chatId || '');
        return !live || live === bucket(chatId);
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
    const markMemory = (chatId, persistState) => {
        const id = bucket(chatId);
        if (!memory.has(id)) return;
        memory.set(id, memory.get(id).map((entry, index) => index === 0 ? normalizeActivityEntry({ ...entry, persistState }) : entry));
    };
    const persist = (chatId, list) => {
        const id = bucket(chatId);
        if (!sameChat(id)) {
            recover(id, list, { commitState: 'stale', reason: 'stale' });
            markMemory(id, 'stale');
            return reportFailure('stale', null, { chatId, persistState: 'stale' });
        }
        if (typeof persistConfirmed === 'function') {
            const failPersist = (persistState, reason, error = null) => {
                recover(id, list, { commitState: persistState, reason });
                markMemory(id, persistState);
                return reportFailure(reason, error, { chatId, persistState, entries: list });
            };
            try {
                return Promise.resolve(persistConfirmed({
                    entries: list,
                    ts: Date.now(),
                    chatId: id,
                }, {
                    ownerGuard: () => String(liveIdentity().chatId || '') === id,
                })).then(saved => {
                    if (!sameChat(id)) return failPersist('stale', 'stale');
                    if (saved?.ok && saved.stale !== true && saved.commitState !== 'unknown') {
                        forgetRecovery(id);
                        markMemory(id, 'confirmed');
                        return { ok: true, commitState: saved.commitState || 'confirmed' };
                    }
                    const persistState = saved?.commitState === 'unknown' ? 'unknown' : saved?.stale ? 'stale' : 'failed';
                    return failPersist(persistState, persistState === 'unknown' ? 'unknown' : saved?.reason || 'storage-write-failed');
                }, error => failPersist('failed', 'storage-write-failed', error));
            } catch (error) {
                return failPersist('failed', 'storage-write-failed', error);
            }
        }
        const key = keyForChat?.(chatId);
        const failed = (reason, error = null) => reportFailure(reason, error, { chatId, entries: list });
        if (!key || typeof storage?.setItem !== 'function') return failed('storage-unavailable');
        try {
            const written = storage.setItem(key, JSON.stringify(list));
            if (written && typeof written.then === 'function') {
                return written.then(saved => {
                    if (saved?.ok === false || saved?.commitState === 'unknown' || saved?.stale === true) {
                        const persistState = saved?.commitState === 'unknown' ? 'unknown' : saved?.stale ? 'stale' : 'failed';
                        recover(id, list, { commitState: persistState, reason: saved?.reason || 'storage-write-failed' });
                        markMemory(id, persistState);
                        return reportFailure(persistState === 'unknown' ? 'unknown' : 'storage-write-failed', null, { chatId, persistState });
                    }
                    forgetRecovery(id);
                    markMemory(id, 'confirmed');
                    return { ok: true };
                });
            }
            if (written === false) throw new Error('storage-write-returned-false');
            forgetRecovery(id);
            markMemory(id, 'confirmed');
            return { ok: true };
        } catch (firstError) {
            try {
                if (storage.setItem(key, JSON.stringify(list.slice(0, 8))) === false) throw new Error('storage-write-returned-false');
                forgetRecovery(id);
                markMemory(id, 'confirmed');
                return { ok: true, truncated: true };
            } catch (secondError) {
                recover(id, list, { commitState: 'failed', reason: 'storage-write-failed' });
                markMemory(id, 'failed');
                return failed('storage-write-failed', secondError || firstError);
            }
        }
    };
    const write = (chatId, list) => {
        const id = bucket(chatId);
        const identity = liveIdentity();
        const normalized = (Array.isArray(list) ? list : []).map(entry => normalizeActivityEntry({
            ...entry,
            chatId: entry.chatId || id,
            chatRevision: entry.chatRevision || identity.chatRevision || 0,
        })).slice(0, cap);
        memory.set(id, normalized);
        return persist(id, normalized);
    };
    return {
        list: chatId => read(chatId),
        prepend(chatId, entry) {
            const id = bucket(chatId);
            const identity = liveIdentity();
            const tagged = normalizeActivityEntry({
                ...entry,
                chatId: id,
                chatRevision: identity.chatRevision || 0,
                persistState: persistConfirmed ? 'pending' : (entry.persistState || ''),
            });
            const next = [tagged, ...read(id).filter(item => item.id !== tagged.id)];
            write(id, next);
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
        persistRecovery: chatId => (readRecovery?.() || []).filter(item => !chatId || item?.chatId === bucket(chatId)),
        clearMemory(chatId) {
            if (chatId == null) memory.clear();
            else memory.delete(bucket(chatId));
        },
    };
}

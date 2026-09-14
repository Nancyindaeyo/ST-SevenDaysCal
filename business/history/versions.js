export const MODULE_HISTORY_LIMIT = 10;

const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

export function normalizeGeneratedAt(value) {
    const timestamp = Number(value);
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

export function payloadsEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

export function normalizeModuleHistory(history, { excludePayload, limit = MODULE_HISTORY_LIMIT } = {}) {
    const recent = [];
    for (const item of Array.isArray(history) ? history : []) {
        if (!item || typeof item !== 'object' || !own(item, 'payload')) continue;
        const payload = clone(item.payload);
        if (excludePayload !== undefined && payloadsEqual(payload, excludePayload)) continue;
        const duplicate = recent.findIndex(entry => payloadsEqual(entry.payload, payload));
        if (duplicate >= 0) recent.splice(duplicate, 1);
        recent.push({ payload, generatedAt: normalizeGeneratedAt(item.generatedAt) });
    }
    return recent.slice(-Math.max(0, Number(limit) || MODULE_HISTORY_LIMIT));
}

function withMetadata(store, getPayload) {
    const next = store && typeof store === 'object' && !Array.isArray(store) ? clone(store) : {};
    next.generatedAt = own(next, 'generatedAt') ? normalizeGeneratedAt(next.generatedAt) : null;
    next.history = normalizeModuleHistory(next.history, { excludePayload: getPayload(next) });
    return next;
}

export function changeModuleStore(store, payload, {
    now = Date.now(),
    generatedAt,
    archiveCurrent = false,
    getPayload,
    applyPayload,
    hasPayload,
} = {}) {
    const current = withMetadata(store, getPayload);
    const currentPayload = getPayload(current);
    const present = typeof hasPayload === 'function' ? hasPayload(store) : currentPayload !== undefined && currentPayload !== null && currentPayload !== '';
    if (present && payloadsEqual(currentPayload, payload)) return { changed: false, value: current };
    let history = normalizeModuleHistory(current.history);
    history = history.filter(item => !payloadsEqual(item.payload, payload));
    if (archiveCurrent && present) {
        history = normalizeModuleHistory([...history, { payload: currentPayload, generatedAt: current.generatedAt }], { excludePayload: payload });
    } else {
        history = normalizeModuleHistory(history, { excludePayload: payload });
    }
    const next = applyPayload({
        ...current,
        ts: Number(now),
        generatedAt: generatedAt === undefined ? current.generatedAt : normalizeGeneratedAt(generatedAt),
        history,
    }, payload);
    return { changed: true, value: next };
}

export const rawAdapter = {
    get: store => own(store, 'raw') ? String(store.raw ?? '') : '',
    has: store => own(store, 'raw'),
    set: (store, payload) => ({ ...store, raw: String(payload ?? '') }),
};

export const itemsAdapter = {
    get: store => Array.isArray(store?.items) ? clone(store.items) : [],
    has: store => own(store, 'items'),
    set: (store, payload) => ({ ...store, items: Array.isArray(payload) ? clone(payload) : [] }),
};

export const axisAdapter = {
    get: store => ({
        items: Array.isArray(store?.items) ? clone(store.items) : [],
        caldesc: store?.caldesc && typeof store.caldesc === 'object' ? clone(store.caldesc) : (store?.caldesc ?? null),
    }),
    has: store => own(store, 'items') || own(store, 'caldesc'),
    set: (store, payload) => ({
        ...store,
        items: Array.isArray(payload?.items) ? clone(payload.items) : [],
        caldesc: payload?.caldesc && typeof payload.caldesc === 'object' ? clone(payload.caldesc) : (payload?.caldesc ?? null),
    }),
};

export const ledgerAdapter = {
    get: store => ({
        entries: Array.isArray(store?.entries) ? clone(store.entries) : [],
        seq: Number(store?.seq) || 0,
    }),
    has: store => Array.isArray(store?.entries) && (store.entries.length > 0 || Number(store?.seq) > 0),
    set: (store, payload) => ({
        ...store,
        entries: Array.isArray(payload?.entries) ? clone(payload.entries) : [],
        seq: Number(payload?.seq) || 0,
    }),
};

export function generatedStore(store, payload, adapter, now = Date.now()) {
    return changeModuleStore(store, payload, {
        now,
        generatedAt: now,
        archiveCurrent: true,
        getPayload: adapter.get,
        applyPayload: adapter.set,
        hasPayload: adapter.has,
    });
}

export function manualStore(store, payload, adapter, now = Date.now()) {
    return changeModuleStore(store, payload, {
        now,
        archiveCurrent: false,
        getPayload: adapter.get,
        applyPayload: adapter.set,
        hasPayload: adapter.has,
    });
}

export function restoreHistoryVersion(store, index, adapter, now = Date.now()) {
    const current = withMetadata(store, adapter.get);
    const history = normalizeModuleHistory(current.history, { excludePayload: adapter.get(current) });
    const selected = history[Number(index)];
    if (!selected) return { ok: false, reason: 'missing-version', value: current };
    const withoutSelected = history.filter((_, itemIndex) => itemIndex !== Number(index));
    const changed = changeModuleStore({ ...current, history: withoutSelected }, selected.payload, {
        now,
        generatedAt: selected.generatedAt,
        archiveCurrent: true,
        getPayload: adapter.get,
        applyPayload: adapter.set,
        hasPayload: adapter.has,
    });
    return { ok: changed.changed, reason: changed.changed ? '' : 'same-current', value: changed.value };
}

export function historyEntries(store, adapter) {
    const current = withMetadata(store, adapter.get);
    const currentPayload = adapter.get(current);
    const history = normalizeModuleHistory(current.history, { excludePayload: currentPayload });
    const entries = [
        { value: 'current', current: true, payload: currentPayload, generatedAt: current.generatedAt, order: 0 },
        ...history.map((version, index) => ({ value: `history:${index}`, current: false, historyIndex: index, ...version, order: index + 1 })),
    ];
    entries.sort((left, right) => {
        const leftKnown = left.generatedAt != null;
        const rightKnown = right.generatedAt != null;
        if (leftKnown !== rightKnown) return leftKnown ? -1 : 1;
        if (leftKnown && left.generatedAt !== right.generatedAt) return right.generatedAt - left.generatedAt;
        return left.order - right.order;
    });
    return entries;
}

export function formatGeneratedAt(value) {
    const timestamp = normalizeGeneratedAt(value);
    if (timestamp == null) return '生成时间未知';
    const date = new Date(timestamp);
    const pad = part => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function historyCount(store, adapter) {
    return normalizeModuleHistory(store?.history, { excludePayload: adapter.get(store || {}) }).length;
}

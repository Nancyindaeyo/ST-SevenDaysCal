export const DEVICE_PREF_KEYS = Object.freeze({
    fabPos: 'sp-fab-pos',
    panelPos: 'sp-pos',
    panelSize: 'sp-size',
    outlineChatH: 'sp-outline-chat-h',
});

// 只承载本机窗口偏好。棱草稿、swipe 缓存、聊天账本和确认写入失败都不进这里。
export const DEVICE_PREF_EXCLUDED = Object.freeze([
    'theater-draft: chat-scoped drafts stay in business/theater/repository.js',
    'swipe-store: chat swipe cache stays in business/lines/swipe-store.js',
    'activity: chat-scoped audit stays in writeStoreConfirmed',
]);

export function finiteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function classifyStorageError(error) {
    const name = String(error?.name || '');
    if (name === 'SecurityError' || name === 'QuotaExceededError') return name;
    const text = String(error?.message || error || '');
    if (/quota/i.test(text)) return 'QuotaExceededError';
    if (/security|access is denied|the operation is insecure|storage is disabled/i.test(text)) return 'SecurityError';
    return 'StorageError';
}

export function parseJsonValue(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(String(raw)); } catch { return null; }
}

export function clampPoint(left, top, { width = 0, height = 0, vw = 0, vh = 0, gutter = 0 } = {}) {
    const w = finiteNumber(width) ?? 0;
    const h = finiteNumber(height) ?? 0;
    const viewW = finiteNumber(vw) ?? 0;
    const viewH = finiteNumber(vh) ?? 0;
    const gap = finiteNumber(gutter) ?? 0;
    return {
        left: Math.max(0, Math.min(left, Math.max(0, viewW - w))),
        top: Math.max(0, Math.min(top, Math.max(0, viewH - h - gap))),
    };
}

export function normalizePoint(raw, viewport = {}, { width = 0, height = 0, gutter = 0 } = {}) {
    const left = finiteNumber(raw?.left);
    const top = finiteNumber(raw?.top);
    if (left == null || top == null) return null;
    const vw = finiteNumber(viewport.vw);
    const vh = finiteNumber(viewport.vh);
    if (vw == null || vh == null || vw <= 0 || vh <= 0) return { left, top };
    return clampPoint(left, top, {
        width: finiteNumber(viewport.width) ?? width,
        height: finiteNumber(viewport.height) ?? height,
        vw,
        vh,
        gutter,
    });
}

export function normalizeSize(raw, viewport = {}, { minWidth = 280, minHeight = 300 } = {}) {
    const width = finiteNumber(raw?.width);
    const height = finiteNumber(raw?.height);
    if (width == null || height == null) return null;
    const vw = finiteNumber(viewport.vw);
    const vh = finiteNumber(viewport.vh);
    if (vw == null || vh == null || vw <= 0 || vh <= 0) return { width, height };
    const mobile = viewport.mobile === true;
    const maxW = mobile ? Math.min(vw - 10, 500) : vw - 10;
    return {
        width: Math.max(minWidth, Math.min(maxW, width)),
        height: Math.max(minHeight, Math.min(vh - 10, height)),
    };
}

export function normalizeHeight(raw, { min = 80, max = 420, fallback = 210 } = {}) {
    const height = finiteNumber(typeof raw === 'object' ? raw?.height : raw);
    if (height == null) return fallback;
    return Math.max(min, Math.min(max, height));
}

function resolveStorage(storage) {
    try {
        const value = typeof storage === 'function' ? storage() : storage;
        return value || null;
    } catch (error) {
        const classified = new Error(classifyStorageError(error));
        classified.name = classifyStorageError(error);
        throw classified;
    }
}

export function createDevicePreferences({ storage = () => globalThis.localStorage, viewport = () => ({}) } = {}) {
    let ephemeral = false;
    let lastError = '';

    const markFailure = error => {
        ephemeral = true;
        lastError = classifyStorageError(error);
        return { ok: false, value: null, ephemeral: true, error: lastError };
    };

    const access = fn => {
        try {
            return { ok: true, value: fn(resolveStorage(storage)), ephemeral, error: lastError };
        } catch (error) {
            return markFailure(error);
        }
    };

    const readJson = (key, normalize) => {
        const got = access(store => store?.getItem?.(key));
        if (!got.ok) return got;
        const parsed = parseJsonValue(got.value);
        return { ok: true, value: parsed == null ? null : normalize(parsed, viewport?.() || {}), ephemeral, error: lastError };
    };

    const writeJson = (key, value) => {
        if (value == null) return { ok: true, value: null, ephemeral, error: lastError };
        return access(store => {
            if (!store?.setItem) {
                const error = new Error('storage is disabled');
                error.name = 'SecurityError';
                throw error;
            }
            store.setItem(key, JSON.stringify(value));
            return value;
        });
    };

    return Object.freeze({
        isEphemeral: () => ephemeral === true,
        lastError: () => lastError,
        readFabPos: (view = {}) => readJson(DEVICE_PREF_KEYS.fabPos, (raw, live) => normalizePoint(raw, { ...live, ...view }, { width: 48, height: 48 })),
        writeFabPos: pos => writeJson(DEVICE_PREF_KEYS.fabPos, normalizePoint(pos) && { left: finiteNumber(pos.left), top: finiteNumber(pos.top) }),
        readPanelPos: (view = {}) => readJson(DEVICE_PREF_KEYS.panelPos, (raw, live) => normalizePoint(raw, { ...live, ...view }, { gutter: 60 })),
        writePanelPos: pos => writeJson(DEVICE_PREF_KEYS.panelPos, normalizePoint(pos) && { left: finiteNumber(pos.left), top: finiteNumber(pos.top) }),
        readPanelSize: (view = {}) => readJson(DEVICE_PREF_KEYS.panelSize, (raw, live) => normalizeSize(raw, { ...live, ...view })),
        writePanelSize: size => writeJson(DEVICE_PREF_KEYS.panelSize, normalizeSize(size) && { width: finiteNumber(size.width), height: finiteNumber(size.height) }),
        readOutlineChatHeight: () => {
            const got = access(store => store?.getItem?.(DEVICE_PREF_KEYS.outlineChatH));
            if (!got.ok) return { ...got, value: 210 };
            return { ok: true, value: normalizeHeight(parseJsonValue(got.value) ?? got.value), ephemeral, error: lastError };
        },
        writeOutlineChatHeight: height => {
            const next = normalizeHeight(height);
            return access(store => {
                if (!store?.setItem) {
                    const error = new Error('storage is disabled');
                    error.name = 'SecurityError';
                    throw error;
                }
                store.setItem(DEVICE_PREF_KEYS.outlineChatH, String(next));
                return next;
            });
        },
    });
}

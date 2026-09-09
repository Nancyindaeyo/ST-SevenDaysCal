function asInt(value, fallback) {
    const n = Number(value);
    return Number.isInteger(n) ? n : fallback;
}

function asCount(value) {
    const n = Math.floor(Number(value) || 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function gate(raw = {}) {
    return {
        lastFloor: asInt(raw?.lastFloor, -1),
        counter: asCount(raw?.counter),
    };
}

export const PACE_GATES = Object.freeze(['align', 'advance', 'outline', 'dashed', 'date', 'ledgerCapture', 'ledgerJudge']);

function mapGates(src, map) {
    return Object.fromEntries(PACE_GATES.map(name => [name, map(src[name] || {})]));
}

export function normalizePaceState(raw = {}) {
    const src = raw && typeof raw === 'object' ? raw : {};
    return {
        ...mapGates(src, gate),
        pendingAdvance: src.pendingAdvance === true,
        pendingDashed: src.pendingDashed === true,
        lastReconcileFloor: asInt(src.lastReconcileFloor, -1),
    };
}

export function clampPaceToLatest(raw = {}, latestFloor = -1) {
    const latest = asInt(latestFloor, -1);
    const saved = normalizePaceState(raw);
    return {
        ...saved,
        ...mapGates(saved, item => ({ ...item, lastFloor: Math.max(item.lastFloor, latest) })),
        lastReconcileFloor: saved.lastReconcileFloor === latest ? latest : -1,
    };
}

export function snapshotPaceState(raw = {}) {
    return { ...normalizePaceState(raw), ts: Number(raw.ts) || Date.now() };
}

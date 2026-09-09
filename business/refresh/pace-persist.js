function asInt(value, fallback) {
    const n = Number(value);
    return Number.isInteger(n) ? n : fallback;
}

function asCount(value) {
    const n = Math.floor(Number(value) || 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function gate(raw = {}, fallbackFloor = -1) {
    return {
        lastFloor: asInt(raw?.lastFloor, fallbackFloor),
        counter: asCount(raw?.counter),
    };
}

export function normalizePaceState(raw = {}) {
    const src = raw && typeof raw === 'object' ? raw : {};
    return {
        align: gate(src.align),
        advance: gate(src.advance),
        outline: gate(src.outline),
        dashed: gate(src.dashed),
        date: gate(src.date),
        ledgerCapture: gate(src.ledgerCapture),
        ledgerJudge: gate(src.ledgerJudge),
        pendingAdvance: src.pendingAdvance === true,
        pendingDashed: src.pendingDashed === true,
        lastReconcileFloor: asInt(src.lastReconcileFloor, -1),
    };
}

export function clampPaceToLatest(raw = {}, latestFloor = -1) {
    const latest = asInt(latestFloor, -1);
    const clamp = item => ({ ...item, lastFloor: Math.max(item.lastFloor, latest) });
    const saved = normalizePaceState(raw);
    return {
        ...saved,
        align: clamp(saved.align),
        advance: clamp(saved.advance),
        outline: clamp(saved.outline),
        dashed: clamp(saved.dashed),
        date: clamp(saved.date),
        ledgerCapture: clamp(saved.ledgerCapture),
        ledgerJudge: clamp(saved.ledgerJudge),
        lastReconcileFloor: saved.lastReconcileFloor === latest ? latest : -1,
    };
}

export function snapshotPaceState({
    align = {},
    advance = {},
    outline = {},
    dashed = {},
    date = {},
    ledgerCapture = {},
    ledgerJudge = {},
    pendingAdvance = false,
    pendingDashed = false,
    lastReconcileFloor = -1,
    ts = Date.now(),
} = {}) {
    return {
        ...normalizePaceState({
            align, advance, outline, dashed, date, ledgerCapture, ledgerJudge,
            pendingAdvance, pendingDashed, lastReconcileFloor,
        }),
        ts: Number(ts) || Date.now(),
    };
}

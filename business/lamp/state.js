export function readLampState(raw = {}) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const dismissed = [...new Set((Array.isArray(src.dismissed) ? src.dismissed : []).map(value => String(value || '').trim()).filter(Boolean))].slice(0, 40);
    const lastAlignFloor = Number.isInteger(Number(src.lastAlignFloor)) ? Number(src.lastAlignFloor) : -1;
    return {
        dismissed,
        lastAlignFloor: lastAlignFloor >= 0 ? lastAlignFloor : -1,
        ts: Number(src.ts) || 0,
    };
}

export function dismissLampPair(state = {}, pairId = '') {
    const id = String(pairId || '').trim();
    const current = readLampState(state);
    if (!id) return current;
    return {
        ...current,
        dismissed: [...new Set([...current.dismissed, id])].slice(0, 40),
        ts: Date.now(),
    };
}

export function markLampAligned(state = {}, floorId = -1) {
    const current = readLampState(state);
    const n = Number(floorId);
    if (!Number.isInteger(n) || n < 0) return current;
    return { ...current, lastAlignFloor: n, ts: Date.now() };
}

export function filterDismissedConflicts(conflicts = [], dismissed = []) {
    const skip = new Set((dismissed || []).map(value => String(value || '')));
    if (!skip.size) return Array.isArray(conflicts) ? conflicts : [];
    return (Array.isArray(conflicts) ? conflicts : []).filter(item => !skip.has(item?.pairId || item?.id));
}

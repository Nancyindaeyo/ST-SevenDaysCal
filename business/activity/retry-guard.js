function fingerprint(value) {
    try { return JSON.stringify(value ?? null); }
    catch { return ''; }
}

export function retryNeedsConfirm(entry = {}, current = {}) {
    const before = entry.after || entry.snapshot || {};
    const reasons = [];
    if (Object.prototype.hasOwnProperty.call(before, 'ledger') && fingerprint(before.ledger) !== fingerprint(current.ledger)) {
        reasons.push('ledger-changed');
    }
    for (const key of ['point', 'lines', 'outline']) {
        if (Object.prototype.hasOwnProperty.call(before, key) && fingerprint(before[key]) !== fingerprint(current[key])) {
            reasons.push(`${key}-changed`);
        }
    }
    return { needed: reasons.length > 0, reasons };
}

export function unprocessedFailures(entries = [], { floorId } = {}) {
    return (Array.isArray(entries) ? entries : []).filter(entry => {
        if (entry?.outcome !== 'failed' || entry?.undone === true) return false;
        if (floorId == null) return true;
        return Number(entry.floorId) === Number(floorId);
    });
}

export function dryRunRouteCard({ route = {}, selected = [], promptChars = 0 } = {}) {
    const chars = Number(promptChars) || 0;
    return {
        api: route.label || route.presetName || route.status || 'follow-main',
        status: route.status || '',
        selected: [...selected],
        tokenTier: chars < 4000 ? 'S' : chars < 12000 ? 'M' : 'L',
        promptChars: chars,
    };
}

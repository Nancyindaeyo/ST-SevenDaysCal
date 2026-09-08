let fallbackSequence = 0;
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

export function theaterId(randomUUID = globalThis.crypto?.randomUUID) {
    if (typeof randomUUID === 'function') {
        try { const id = randomUUID.call(globalThis.crypto); if (id) return String(id); } catch { /* fallback below */ }
    }
    fallbackSequence = (fallbackSequence + 1) % 1_000_000_000;
    return `t-${Date.now()}-${fallbackSequence}`;
}

export function normalizeTheaterPiece(piece) {
    if (!piece || typeof piece !== 'object') return null;
    const copy = clone(piece);
        if (!copy.id) copy.id = theaterId();
        copy.id = String(copy.id);
        copy.liked = copy.liked === true;
        copy.html = '';
        copy.batchId = copy.batchId == null ? '' : String(copy.batchId);
        copy.formName = String(copy.formName || '').trim();
        copy.formSeed = String(copy.formSeed || '').trim();
        copy.themeName = String(copy.themeName || '').trim();
        copy.themeSeed = String(copy.themeSeed || '').trim();
        return copy;
}

export function normalizeTheaterList(value) {
    return Array.isArray(value) ? value.map(normalizeTheaterPiece).filter(Boolean) : [];
}

export function cloneTheaterPiece(piece) { return normalizeTheaterPiece(piece); }
export function cloneTheaterList(value) { return normalizeTheaterList(value); }
export function theaterPieceBaseline(piece) {
    const p = normalizeTheaterPiece(piece);
    return p ? JSON.stringify(p) : null;
}
export function sameTheaterPieceBaseline(piece, baseline) { return theaterPieceBaseline(piece) === baseline; }

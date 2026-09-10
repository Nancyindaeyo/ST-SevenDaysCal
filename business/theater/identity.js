export function resolveTheaterRegen(piece, fallbackInput = '') {
    const input = String(piece?.request || fallbackInput || '').trim();
    return {
        input,
        templateSource: input && piece?.templateSource?.input
            ? { ...piece.templateSource, input: String(piece.templateSource.input).trim() }
            : null,
    };
}

export function resolveTheaterContinueSource(piece, lookup = () => null) {
    if (!piece) return null;
    const chapters = [];
    const seen = new Set();
    let cur = piece;
    while (cur) {
        const id = String(cur.id || '');
        const mark = id || `anon:${chapters.length}:${String(cur.title || '')}`;
        if (seen.has(mark)) break;
        seen.add(mark);
        chapters.unshift({ title: String(cur.title || ''), raw: String(cur.raw || '') });
        const parentId = cur.continuedFrom ? String(cur.continuedFrom) : '';
        if (parentId) {
            const live = lookup(parentId);
            if (live) { cur = live; continue; }
        }
        if (cur.continueSource?.raw) {
            chapters.unshift({ title: String(cur.continueSource.title || ''), raw: String(cur.continueSource.raw || '') });
        }
        break;
    }
    const raw = chapters.map(item => `【${item.title || '未命名'}】\n${String(item.raw || '').trim()}`).filter(item => item.trim()).join('\n\n');
    if (!raw) return null;
    return {
        id: String(piece.id || ''),
        title: String(piece.title || ''),
        raw,
        templateSource: piece.templateSource || piece.continueSource?.templateSource,
    };
}

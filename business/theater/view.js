export function selectTheaterView(drafts, { current = null, batchId = '', solo = false } = {}) {
    const list = Array.isArray(drafts) ? drafts : [];
    const match = current?.id != null ? list.find(piece => String(piece.id) === String(current.id)) : null;
    const piece = match || list[0] || null;
    if (!piece) return { piece: null, batch: [] };
    if (solo) return { piece, batch: [piece] };
    const id = String(batchId || piece.batchId || '');
    const batch = id ? list.filter(item => String(item.batchId) === String(id)) : [piece];
    return { piece, batch: batch.length ? batch : [piece] };
}

export function theaterPieceOpen(item, piece) {
    return String(item?.id) === String(piece?.id);
}

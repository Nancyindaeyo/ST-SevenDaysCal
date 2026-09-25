import { isCompleteOutlineBeat, parseCompleteOutline, serializeOutlineBeats } from './schema.js';

export function replaceOutlineNode(existingRaw, incomingRaw, cursor) {
    const existing = parseCompleteOutline(existingRaw);
    const incoming = parseCompleteOutline(incomingRaw);
    const index = Math.max(0, Math.floor(Number(cursor) || 1) - 1);
    if (!existing.length || !incoming.length || index >= existing.length) return { ok: false, raw: String(existingRaw || '') };
    const next = [...existing];
    next[index] = { ...incoming[0], id: existing[index].id || incoming[0].id, volume: existing[index].volume || incoming[0].volume };
    return { ok: true, raw: serializeOutlineBeats(next, { assignIds: true }), title: incoming[0].title || existing[index].title || '' };
}

export function appendOutlineNodes(existingRaw, incomingRaw) {
    const existing = parseCompleteOutline(existingRaw);
    const incoming = parseCompleteOutline(incomingRaw);
    if (!incoming.length) return { ok: false, raw: String(existingRaw || '') };
    return {
        ok: true,
        raw: serializeOutlineBeats([...existing, ...incoming], { assignIds: true }),
        titles: incoming.map(beat => beat.title).filter(Boolean),
    };
}

export function normalizeOutlineRegenMode(value) {
    return value === 'all' || value === 'continue' ? value : 'current';
}

export function canPartialOutlineRegen(raw, mode) {
    return Boolean(String(raw || '').trim()) && (mode === 'current' || mode === 'continue') && parseCompleteOutline(raw).some(isCompleteOutlineBeat);
}

export const EXCERPTS_NAME = 'sp-anchor-excerpts.json';
export const EXCERPT_SCHEMA_VERSION = 1;
export const QUOTE_MAX = 2000;
export const NOTE_MAX = 4000;

export function emptyExcerpts() {
    return { version: EXCERPT_SCHEMA_VERSION, items: [] };
}

export function clipText(value, max, { keepBreaks = false } = {}) {
    let text = String(value ?? '').replace(/\u00a0/g, ' ');
    text = keepBreaks
        ? text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim()
        : text.replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function normalizeExcerpt(item) {
    const src = item && typeof item === 'object' ? item : {};
    return {
        id: String(src.id || ''),
        snapshotId: src.snapshotId ? String(src.snapshotId) : null,
        chatId: src.chatId ?? null,
        chatName: String(src.chatName || ''),
        charName: String(src.charName || ''),
        floorIndex: Number.isFinite(Number(src.floorIndex)) ? Number(src.floorIndex) : null,
        quote: clipText(src.quote, QUOTE_MAX),
        note: clipText(src.note, NOTE_MAX, { keepBreaks: true }),
        tags: Array.isArray(src.tags) ? [...new Set(src.tags.map(id => String(id)).filter(Boolean))] : [],
        ts: Number(src.ts) || 0,
    };
}

export function normalizeExcerpts(value) {
    if (!value || typeof value !== 'object' || !Array.isArray(value.items)) return null;
    return {
        version: Number(value.version) || EXCERPT_SCHEMA_VERSION,
        items: value.items.filter(item => item && typeof item === 'object' && String(item.quote || '').trim()).map(normalizeExcerpt).filter(item => item.id),
    };
}

export function matchExcerpt(item, query) {
    const hay = [item?.quote, item?.note, item?.charName, item?.chatName, ...(item?.tagNames || [])]
        .map(value => String(value || ''))
        .join('\n');
    const raw = String(query || '').trim().toLowerCase();
    if (!raw) return true;
    return raw.split(/\s+/).filter(Boolean).every(word => hay.toLowerCase().includes(word));
}

export function excerptBytes(item) {
    return JSON.stringify(normalizeExcerpt(item)).length * 2;
}

export function formatExcerptForSpace(item) {
    const quote = String(item?.quote || '').trim();
    const note = String(item?.note || '').trim();
    const who = String(item?.charName || '').trim() || '未名';
    const floor = item?.floorIndex != null ? `第 ${item.floorIndex} 楼` : '未知楼层';
    const lines = [`【摘抄】${who} · ${floor}`, `「${quote}」`];
    if (note) lines.push(`点评：${note}`);
    lines.push('');
    return lines.join('\n');
}

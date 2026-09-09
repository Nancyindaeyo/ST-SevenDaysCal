export const MEMORY_TOKEN_BUDGET = 60000;

export function clampAnimaRecallCount(n) {
    const value = parseInt(n, 10);
    return Number.isFinite(value) ? Math.max(1, Math.min(50, value)) : 20;
}

export function animaTextTokens(text) {
    const source = String(text || '').toLowerCase().replace(/\s+/g, ' ');
    const tokens = new Set();
    for (const run of source.match(/[\u3400-\u9fff]{2,}/g) || []) {
        if (run.length <= 8) tokens.add(run);
        for (let i = 0; i < run.length - 1; i++) tokens.add(run.slice(i, i + 2));
    }
    for (const word of source.match(/[a-z0-9_]{2,}/g) || []) tokens.add(word);
    return tokens;
}

export function selectAnimaSlices(slices, query, limit) {
    const q = animaTextTokens(query);
    return (slices || []).map(item => {
        const hay = animaTextTokens(`${item.tags}\n${item.text}`);
        let score = 0;
        for (const token of q) if (hay.has(token)) score += token.length >= 4 ? 2 : 1;
        return { ...item, score, rankTime: Date.parse(item.time) || 0 };
    }).sort((a, b) => b.score - a.score || b.batch - a.batch || b.slice - a.slice || b.rankTime - a.rankTime)
        .slice(0, limit).sort((a, b) => a.batch - b.batch || a.slice - b.slice || a.rankTime - b.rankTime);
}

export function collectAnimaSlices(entries) {
    const all = [];
    if (!Array.isArray(entries)) return all;
    for (const entry of entries) {
        const ex = entry?.extra;
        if (ex?.createdBy !== 'anima_summary' || !Array.isArray(ex.history)) continue;
        const content = String(entry.content || '');
        for (const h of ex.history) {
            const uid = h.unique_id !== undefined ? h.unique_id : h.index;
            if (uid === undefined || uid === null) continue;
            const sliceTag = String(uid).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const sliceMatch = content.match(new RegExp(`<${sliceTag}>([\\s\\S]*?)<\\/${sliceTag}>`));
            const sliceText = sliceMatch?.[1]?.trim();
            if (!sliceText) continue;
            const batch = Number(h.batch_id !== undefined ? h.batch_id : h.index) || 0;
            const slice = Number(h.slice_id !== undefined ? h.slice_id : 0) || 0;
            all.push({
                unique_id: String(uid),
                text: sliceText,
                tags: Array.isArray(h.tags) ? h.tags.join(' ') : String(h.tags || ''),
                batch_id: batch,
                slice_id: slice,
                narrative_time: h.narrative_time,
                parentContent: content,
                batch,
                slice,
                time: h.narrative_time,
            });
        }
    }
    return all;
}

export function capMemText(text, full, { total, budget = MEMORY_TOKEN_BUDGET } = {}) {
    const t = String(text || '');
    if (!t.trim()) return t;
    const counted = Number(total);
    const tokenTotal = Number.isFinite(counted) ? counted : Math.ceil(t.length / 2);
    if (tokenTotal <= budget) return t;
    const eff = Math.floor(budget * 0.95);
    const ratio = tokenTotal / t.length;
    const blocks = t.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
    if (blocks.length <= 1) {
        const keepChars = Math.max(1, Math.floor(eff / ratio));
        return full ? t.slice(0, keepChars) : t.slice(-keepChars);
    }
    const tok = b => Math.max(1, Math.round(b.length * ratio));
    if (full) {
        const avg = tokenTotal / blocks.length;
        const keep = Math.max(1, Math.floor(eff / Math.max(1, avg)));
        if (keep >= blocks.length) return t;
        const step = blocks.length / keep;
        const idxs = [];
        for (let k = 0; k < keep; k++) {
            const idx = Math.min(blocks.length - 1, Math.round(k * step));
            if (idxs[idxs.length - 1] !== idx) idxs.push(idx);
        }
        if (idxs[idxs.length - 1] !== blocks.length - 1) idxs.push(blocks.length - 1);
        return ['（……为控制长度，以下为全程等距节选，非完整时间线……）', ...idxs.map(i => blocks[i])].join('\n\n');
    }
    const ELIDE = '（……中段记忆已省略以控制长度……）';
    const headBudget = Math.floor(eff * 0.15);
    const head = []; let hUsed = 0, hi = 0;
    while (hi < blocks.length && hUsed + tok(blocks[hi]) <= headBudget) { head.push(blocks[hi]); hUsed += tok(blocks[hi]); hi++; }
    const tailBudget = eff - hUsed - tok(ELIDE);
    const tailRev = []; let tUsed = 0, ti = blocks.length - 1;
    while (ti >= hi && tUsed + tok(blocks[ti]) <= tailBudget) { tailRev.push(blocks[ti]); tUsed += tok(blocks[ti]); ti--; }
    const tail = tailRev.reverse();
    if (head.length + tail.length === 0) {
        const keepChars = Math.max(1, Math.floor(eff / ratio));
        return t.slice(-keepChars);
    }
    const parts = [];
    if (head.length) parts.push(...head);
    if (hi <= ti) parts.push(ELIDE);
    if (tail.length) parts.push(...tail);
    return parts.join('\n\n');
}

export async function capMemTextAsync(text, full, { countTokens, budget = MEMORY_TOKEN_BUDGET } = {}) {
    const t = String(text || '');
    if (!t.trim()) return t;
    let total;
    try { total = await countTokens?.(t); }
    catch { total = Math.ceil(t.length / 2); }
    if (!Number.isFinite(total)) total = Math.ceil(t.length / 2);
    return capMemText(t, full, { total, budget });
}

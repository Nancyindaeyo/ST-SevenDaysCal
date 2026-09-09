export const MEMORY_TOKEN_BUDGET = 60000;

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

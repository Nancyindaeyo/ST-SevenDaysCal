import { bookId } from '../identity.js';

function md(value) {
    const month = Number(value?.month);
    const day = Number(value?.day);
    if (!Number.isInteger(month) || month < 1 || !Number.isInteger(day) || day < 1) return null;
    const year = Number(value?.year);
    return Object.freeze({
        year: Number.isInteger(year) && year >= 1 ? year : null,
        month,
        day,
    });
}

export function normalizeTimeTravelFootprint(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const landingFloor = Number(source.landingFloor);
    return Object.freeze({
        id: String(source.id || '').trim(),
        sourceDate: md(source.sourceDate),
        targetDate: md(source.targetDate),
        landingFloor: Number.isInteger(landingFloor) && landingFloor >= 0 ? landingFloor : null,
        ts: Number(source.ts) || 0,
    });
}

export function appendTimeTravelFootprint(list = [], value = {}, { max = 20 } = {}) {
    const next = normalizeTimeTravelFootprint({ ...value, id: value.id || bookId('TRAVEL') });
    if (!next.sourceDate || !next.targetDate || next.landingFloor == null) {
        return { ok: false, reason: 'incomplete', list: Array.isArray(list) ? list : [] };
    }
    return { ok: true, list: [next, ...(Array.isArray(list) ? list : [])].slice(0, max) };
}

export function planJumpBackAnchor(footprint) {
    const item = normalizeTimeTravelFootprint(footprint);
    if (!item.targetDate) return { ok: false, reason: 'missing-footprint', rewriteStory: false, undoActivity: false };
    return {
        ok: true,
        needsConfirm: true,
        action: 'restore-anchor',
        date: item.targetDate,
        landingFloor: item.landingFloor,
        rewriteStory: false,
        undoActivity: false,
    };
}

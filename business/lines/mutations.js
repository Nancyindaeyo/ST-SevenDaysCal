import { normalizeLine, parseLineRow, parseLines, serializeLines, sameLine } from './schema.js';
import { normalizeEditableText } from '../utils/text-edit.js';

export function editLineDescription(raw, index, value) {
    return editLineFields(raw, index, { desc: value });
}

export function editLineFields(raw, index, values = {}) {
    const source = String(raw || ''); const open = source.search(/<storylines_widget\b[^>]*>/i); if (open < 0) return { ok: false, reason: 'not-found', raw };
    const openEnd = source.indexOf('>', open) + 1; const close = source.search(/<\/storylines_widget\s*>/i); if (close < openEnd) return { ok: false, reason: 'not-found', raw };
    const prefix = source.slice(0, openEnd); const inner = source.slice(openEnd, close); const suffix = source.slice(close); const eol = inner.includes('\r\n') ? '\r\n' : '\n'; const lines = inner.split(/\r?\n/);
    const starts = lines.map((line, lineIndex) => /^\s*Line\s*:/i.test(line) ? lineIndex : -1).filter(lineIndex => lineIndex >= 0); const lineIndex = starts[Number(index)]; if (lineIndex == null) return { ok: false, reason: 'not-found', raw };
    let end = starts[Number(index) + 1] ?? lines.length; const normalized = Object.prototype.hasOwnProperty.call(values, 'desc') ? normalizeEditableText(values.desc) : null; const nextValue = Object.prototype.hasOwnProperty.call(values, 'next') ? normalizeEditableText(values.next) : null; let desc = -1, next = -1;
    for (let i = lineIndex + 1; i < end; i++) { if (/^\s*Desc\s*:/i.test(lines[i])) desc = i; else if (/^\s*Next\s*:/i.test(lines[i])) next = i; }
    const replace = (at, key, value) => { if (value == null) return; if (at >= 0) { if (value) lines[at] = lines[at].replace(new RegExp(`^(\\s*)${key}\\s*:.*`, 'i'), `$1${key}: ${value}`); else lines.splice(at, 1); } else if (value) lines.splice(next >= 0 ? next : end, 0, `${key}: ${value}`); };
    replace(desc, 'Desc', normalized);
    end = lines.findIndex((line, i) => i > lineIndex && /^\s*Line\s*:/i.test(line)); if (end < 0) end = lines.length;
    next = lines.findIndex((line, i) => i > lineIndex && i < end && /^\s*Next\s*:/i.test(line));
    replace(next, 'Next', nextValue);
    const identity = normalizeLine(parseLineRow(lines[lineIndex]));
    lines[lineIndex] = [`Line: ${identity.name}`, identity.stage, identity.when, identity.agency, identity.stall ? 'true' : 'false', identity.pin ? 'true' : 'false'].join('|');
    return { ok: true, raw: prefix + lines.join(eol) + suffix, value: normalized };
}

export function deleteLine(raw, index) {
    const model = parseLines(raw); if (!Number.isInteger(index) || index < 0 || index >= model.length) return { ok: false, reason: 'not-found', raw };
    model.splice(index, 1); return { ok: true, raw: model.length ? serializeLines(model) : '' , model };
}
export function togglePin(raw, index) {
    const model = parseLines(raw); if (!Number.isInteger(index) || index < 0 || index >= model.length) return { ok: false, reason: 'not-found', raw };
    model[index].pin = !model[index].pin; return { ok: true, raw: serializeLines(model), model };
}
export function mergePinned(oldRaw, aiRaw, options = {}) {
    const old = parseLines(oldRaw), fresh = parseLines(aiRaw);
    const used = new Set();
    const take = pinned => {
        const byId = pinned.id ? fresh.findIndex((item, i) => !used.has(i) && String(item.id || '') === String(pinned.id)) : -1;
        if (byId >= 0) return byId;
        // 同名未锁线已经在 bind 里对上了；锁定项不能把第一条同名未锁线抢走，对不上就整条补回。
        return fresh.findIndex((item, i) => !used.has(i) && item.pin === true && sameLine(item, pinned));
    };
    for (const pinned of old.filter(line => line.pin)) {
        const index = take(pinned);
        if (index >= 0) {
            const same = fresh[index];
            used.add(index);
            if (options.preferPinnedSource) Object.assign(same, pinned);
            else { same.pin = true; same.adult = pinned.adult === true || same.adult === true; same.cue = pinned.cue ?? null; if (pinned.id) same.id = pinned.id; }
        } else fresh.push({ ...pinned });
    }
    return { ok: true, raw: serializeLines(fresh), model: fresh };
}

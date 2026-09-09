import { parseCalendar, serializeCalendar } from '../point/parse.js';
import { parseLines, serializeLines, TERMINAL_LINE_STAGES } from '../lines/schema.js';

const PATCH_BLOCK = /<reconcile_patch\b[^>]*>([\s\S]*?)<\/reconcile_patch>/i;

export function parseReconcilePatches(raw) {
    const source = String(raw || '');
    const block = PATCH_BLOCK.exec(source)?.[1] ?? source;
    const note = String((/^\s*note\s*[:：]\s*(.+)$/im.exec(block) || [])[1] || '').trim();
    const patches = [];
    for (const line of block.split('\n')) {
        const text = line.trim();
        if (!text || /^note\s*[:：]/i.test(text) || /^```/.test(text)) continue;
        const point = /^point\s*[:：]\s*(complete|postpone|edit|stall|add)\s*\|(.+)$/i.exec(text);
        if (point) {
            const fields = point[2].split('|').map(part => part.trim());
            patches.push({ target: 'point', op: point[1].toLowerCase(), title: fields[0] || '', fields });
            continue;
        }
        const linePatch = /^line\s*[:：]\s*(complete|stall|edit)\s*\|(.+)$/i.exec(text);
        if (linePatch) {
            const fields = linePatch[2].split('|').map(part => part.trim());
            patches.push({ target: 'line', op: linePatch[1].toLowerCase(), name: fields[0] || '', fields });
        }
    }
    return { note, patches, unchanged: !patches.length };
}

function namedInFeedback(title, feedback) {
    const needle = String(title || '').trim();
    const hay = String(feedback || '');
    return !!(needle && hay && hay.includes(needle));
}

export function uniqueNamedHit(items, want, getName) {
    const needle = String(want || '').trim();
    if (!needle) return -1;
    const named = [];
    for (let i = 0; i < items.length; i++) {
        const text = String(getName(items[i]) || '').trim();
        if (!text) continue;
        named.push({ i, text });
    }
    const exact = named.filter(item => item.text === needle);
    if (exact.length) return exact[0].i;
    const fuzzy = named.filter(item => item.text.includes(needle) || needle.includes(item.text));
    return fuzzy.length === 1 ? fuzzy[0].i : -1;
}

function findPointEvent(parsed, title) {
    const want = String(title || '').trim();
    if (!want) return null;
    const hits = [];
    const days = parsed.allDays || parsed.days || [];
    for (let d = 0; d < days.length; d++) {
        for (let e = 0; e < (days[d].events || []).length; e++) {
            hits.push({ dayIndex: d, eventIndex: e, event: days[d].events[e], future: false });
        }
    }
    const futureEvents = parsed.future?.events || [];
    for (let e = 0; e < futureEvents.length; e++) {
        hits.push({ dayIndex: 'future', eventIndex: e, event: futureEvents[e], future: true });
    }
    const index = uniqueNamedHit(hits, want, hit => hit.event?.title);
    return index >= 0 ? hits[index] : null;
}

export function applyPointPatches(raw, patches, { feedback = '', calendar = null } = {}) {
    if (!String(raw || '').trim() || !patches?.length) return { raw, changed: false, skippedLocks: [], applied: [] };
    const parsed = parseCalendar(raw, calendar);
    const days = parsed.allDays || parsed.days || [];
    const skippedLocks = [];
    const applied = [];
    let changed = false;
    for (const patch of patches.filter(item => item.target === 'point')) {
        if (patch.op === 'add') {
            const title = patch.fields[2] || patch.title;
            if (!title) continue;
            const event = {
                type: patch.fields[1] || 'main',
                title,
                desc: patch.fields[3] || title,
                time: patch.fields[4] || '',
                location: patch.fields[5] || '',
                npcAction: patch.fields[6] || '',
                pin: false,
            };
            const dest = String(patch.fields[0] || 'Day 1');
            if (/future|未来/i.test(dest)) {
                parsed.future ||= { events: [] };
                parsed.future.events.push(event);
            } else {
                const n = Math.max(1, parseInt(dest.replace(/\D/g, ''), 10) || 1);
                if (n > days.length) {
                    parsed.future ||= { events: [] };
                    parsed.future.events.push(event);
                } else {
                    const day = days[n - 1];
                    if (day) day.events.push(event);
                }
            }
            changed = true;
            applied.push({ module: 'point', title, action: 'add' });
            continue;
        }
        const hit = findPointEvent(parsed, patch.title);
        if (!hit) continue;
        if (hit.event.pin && !namedInFeedback(hit.event.title, feedback)) {
            skippedLocks.push(hit.event.title);
            continue;
        }
        const bucket = hit.future ? parsed.future.events : days[hit.dayIndex].events;
        if (patch.op === 'complete') {
            bucket.splice(hit.eventIndex, 1);
            changed = true;
            applied.push({ module: 'point', title: hit.event.title, action: 'complete' });
            continue;
        }
        if (patch.op === 'postpone') {
            const [event] = bucket.splice(hit.eventIndex, 1);
            const dest = patch.fields[1] || '';
            if (/future|未来/i.test(dest) || !dest) {
                parsed.future ||= { events: [] };
                parsed.future.events.push(event);
            } else {
                const n = Math.max(1, parseInt(String(dest).replace(/\D/g, ''), 10) || days.length);
                const day = days[Math.min(days.length, n) - 1] || days[days.length - 1];
                if (day) day.events.push(event);
            }
            if (patch.fields[2]) event.time = patch.fields[2];
            changed = true;
            applied.push({ module: 'point', title: event.title, action: 'postpone' });
            continue;
        }
        if (patch.op === 'edit') {
            if (patch.fields[1]) hit.event.desc = patch.fields[1];
            if (patch.fields[2]) hit.event.time = patch.fields[2];
            changed = true;
            applied.push({ module: 'point', title: hit.event.title, action: 'edit' });
            continue;
        }
        if (patch.op === 'stall') {
            hit.event.desc = hit.event.desc ? `${hit.event.desc}（暂缓）` : '暂缓';
            changed = true;
            applied.push({ module: 'point', title: hit.event.title, action: 'stall' });
        }
    }
    return { raw: serializeCalendar(days, parsed.future, parsed.startDate, calendar, parsed.startDateToken), changed, skippedLocks, applied };
}

export function applyLinePatches(raw, patches, { feedback = '' } = {}) {
    if (!String(raw || '').trim() || !patches?.length) return { raw, changed: false, skippedLocks: [], applied: [] };
    const model = parseLines(raw);
    const skippedLocks = [];
    const applied = [];
    let changed = false;
    for (const patch of patches.filter(item => item.target === 'line')) {
        const want = String(patch.name || '').trim();
        if (!want) continue;
        const index = uniqueNamedHit(model, want, line => line.name);
        if (index < 0) continue;
        const line = model[index];
        if (line.pin && !namedInFeedback(line.name, feedback)) {
            skippedLocks.push(line.name);
            continue;
        }
        if (patch.op === 'complete') {
            line.stage = '收束';
            changed = true;
            applied.push({ module: 'lines', title: line.name, action: 'complete' });
            continue;
        }
        if (patch.op === 'stall') {
            line.stall = true;
            changed = true;
            applied.push({ module: 'lines', title: line.name, action: 'stall' });
            continue;
        }
        if (patch.op === 'edit') {
            if (patch.fields[1]) line.desc = patch.fields[1];
            if (patch.fields[2]) line.next = patch.fields[2];
            changed = true;
            applied.push({ module: 'lines', title: line.name, action: 'edit' });
        }
    }
    return { raw: serializeLines(model), changed, skippedLocks, applied, terminal: model.filter(line => TERMINAL_LINE_STAGES.has(line.stage)).map(line => line.name) };
}

export function summarizeReconcile({ point, lines, note }) {
    const parts = [];
    if (point?.changed) parts.push('点已按正文对齐');
    if (lines?.changed) parts.push('线已按正文对齐');
    const locks = [...(point?.skippedLocks || []), ...(lines?.skippedLocks || [])];
    if (locks.length) parts.push(`锁定未改：${[...new Set(locks)].join('、')}（要改请先解锁，或在反馈里点名）`);
    if (note) parts.push(note);
    if (!parts.length) return '点/线与正文一致';
    return parts.join(' · ');
}

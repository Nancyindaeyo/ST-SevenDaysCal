import { compactText, textsRelated } from './detect.js';

const MODULE_LABEL = Object.freeze({
    point: '点',
    lines: '线',
    outline: '面',
    almanac: '轴',
    dashed: '冷知识',
    ledger: '刻度',
});

function hayOf(values) {
    return compactText(values.filter(Boolean).join(' '));
}

function matchQuery(query, values) {
    const needle = compactText(query);
    if (!needle) return false;
    const hay = hayOf(values);
    if (hay.includes(needle) || needle.includes(hay)) return true;
    return values.some(value => textsRelated(query, value));
}

export function searchLampBooks(query, books = {}) {
    const needle = String(query || '').trim();
    if (!needle) return [];
    const hits = [];
    const push = (module, title, snippet, ref = '') => {
        if (!title) return;
        hits.push(Object.freeze({
            module,
            label: MODULE_LABEL[module] || module,
            title: String(title).trim(),
            snippet: String(snippet || '').trim(),
            ref: String(ref || '').trim(),
        }));
    };

    for (const day of books.days || []) {
        for (const event of day.events || []) {
            const fields = [event.title, event.location, event.desc, event.time, event.npcAction];
            if (!matchQuery(needle, fields)) continue;
            push('point', event.title, [event.time, event.location, event.desc].filter(Boolean).join(' · '));
        }
    }
    for (const line of books.lines || []) {
        const fields = [line.name, line.when, line.desc, line.next, line.stage];
        if (!matchQuery(needle, fields)) continue;
        push('lines', line.name, [line.when, line.stage, line.desc].filter(Boolean).join(' · '));
    }
    for (const beat of books.outline || []) {
        const fields = [beat.title, beat.scene, beat.time];
        if (!matchQuery(needle, fields)) continue;
        push('outline', beat.title, beat.scene || beat.time || '');
    }
    for (const item of books.almanac || []) {
        const fields = [item.name, item.note, item.type, item.displayDate];
        if (!matchQuery(needle, fields)) continue;
        push('almanac', item.name, [item.displayDate || `${item.month}/${item.day}`, item.note].filter(Boolean).join(' · '));
    }
    for (const item of books.dashed || []) {
        const text = String(item.text || item.body || '').trim();
        if (!matchQuery(needle, [text, item.title])) continue;
        push('dashed', item.title || text.slice(0, 24) || '冷知识', text.slice(0, 80), item.id);
    }
    for (const entry of books.ledger || []) {
        const title = entry.事由 || entry.title;
        const fields = [title, entry.现状, ...(entry.标签 || []), ...(entry.牵扯 || [])];
        if (!matchQuery(needle, fields)) continue;
        push('ledger', title, entry.现状 || entry.类型 || '', entry.id);
    }
    return Object.freeze(hits.slice(0, 40));
}

import { parseCalendar } from '../point/parse.js';
import { parseLines } from '../lines/schema.js';
import { parseOutline } from '../outline/schema.js';
import { findBookIndex } from '../identity.js';
import { normalizeActivityItem } from './schema.js';

function pointTitles(raw) {
    const parsed = parseCalendar(String(raw || ''));
    const days = parsed.allDays || parsed.days || [];
    const events = [];
    for (const day of days) for (const event of day.events || []) events.push(event);
    for (const event of parsed.future?.events || []) events.push(event);
    return events;
}

function lineKey(line) {
    return String(line?.name || '').trim();
}

function outlineKey(beat) {
    return String(beat?.title || '').trim();
}

export function itemsFromPatches(pointResult, linesResult) {
    const items = [];
    for (const item of pointResult?.applied || []) items.push(normalizeActivityItem({ module: 'point', title: item.title, action: item.action, ref: item.ref }));
    for (const item of linesResult?.applied || []) items.push(normalizeActivityItem({ module: 'lines', title: item.title, action: item.action, ref: item.ref }));
    return items.filter(item => item.title);
}

function findUnused(items, used, query) {
    const masked = items.map((item, index) => (used.has(index) ? { ...item, id: '', title: '', name: '' } : item));
    return findBookIndex(masked, query);
}

function pointItem(event, action) {
    return normalizeActivityItem({ module: 'point', title: String(event.title || '').trim(), action, ref: event.id });
}

export function diffPointRaw(before, after) {
    const oldEvents = pointTitles(before);
    const newEvents = pointTitles(after);
    const items = [];
    const used = new Set();
    for (const event of oldEvents) {
        const index = findUnused(newEvents, used, { id: event.id, name: event.title, nameOf: 'title' });
        if (index < 0 || used.has(index)) {
            const title = String(event.title || '').trim();
            if (title) items.push(pointItem(event, 'complete'));
            continue;
        }
        used.add(index);
        const match = newEvents[index];
        if (String(event.desc || '') !== String(match.desc || '') || String(event.time || '') !== String(match.time || '')) {
            items.push(pointItem(match.id ? { ...event, id: match.id } : event, 'edit'));
        }
    }
    for (const [index, event] of newEvents.entries()) {
        if (used.has(index)) continue;
        const title = String(event.title || '').trim();
        if (title) items.push(pointItem(event, 'add'));
    }
    return items;
}

export function diffLinesRaw(before, after) {
    const oldLines = parseLines(String(before || ''));
    const newLines = parseLines(String(after || ''));
    const items = [];
    const used = new Set();
    for (const line of oldLines) {
        const index = findUnused(newLines, used, { id: line.id, name: line.name, nameOf: 'name' });
        if (index < 0 || used.has(index)) {
            if (lineKey(line)) items.push(normalizeActivityItem({ module: 'lines', title: lineKey(line), action: 'complete', ref: line.id }));
            continue;
        }
        used.add(index);
        const next = newLines[index];
        const ref = next.id || line.id;
        if (line.stage !== next.stage && /收束|完结|落幕/.test(String(next.stage || ''))) {
            items.push(normalizeActivityItem({ module: 'lines', title: lineKey(next) || lineKey(line), action: 'complete', ref }));
        } else if (!!line.stall !== !!next.stall && next.stall) {
            items.push(normalizeActivityItem({ module: 'lines', title: lineKey(next) || lineKey(line), action: 'stall', ref }));
        } else if (String(line.desc || '') !== String(next.desc || '') || String(line.next || '') !== String(next.next || '') || line.stage !== next.stage) {
            items.push(normalizeActivityItem({ module: 'lines', title: lineKey(next) || lineKey(line), action: line.stage !== next.stage ? 'advance' : 'edit', ref }));
        }
    }
    for (const [index, line] of newLines.entries()) {
        if (used.has(index)) continue;
        const name = lineKey(line);
        if (name) items.push(normalizeActivityItem({ module: 'lines', title: name, action: 'add', ref: line.id }));
    }
    return items;
}

export function diffOutlineRaw(before, after) {
    const oldBeats = parseOutline(before?.raw ?? before ?? '');
    const newBeats = parseOutline(after?.raw ?? after ?? '');
    const oldCursor = Number(before?.cursor);
    const newCursor = Number(after?.cursor);
    const items = [];
    if (Number.isFinite(oldCursor) && Number.isFinite(newCursor) && oldCursor !== newCursor) {
        const beat = newBeats[Math.max(0, newCursor - 1)] || oldBeats[Math.max(0, newCursor - 1)];
        items.push(normalizeActivityItem({ module: 'outline', title: outlineKey(beat) || `节点 ${newCursor}`, action: 'cursor' }));
    }
    const oldTitles = oldBeats.map(outlineKey);
    const newTitles = newBeats.map(outlineKey);
    if (oldBeats.length && newBeats.length === oldBeats.length) {
        for (let i = 0; i < newBeats.length; i++) {
            const beforeBeat = oldBeats[i];
            const afterBeat = newBeats[i];
            if (!beforeBeat || !afterBeat) continue;
            if (JSON.stringify(beforeBeat) !== JSON.stringify(afterBeat)) {
                items.push(normalizeActivityItem({ module: 'outline', title: outlineKey(afterBeat) || outlineKey(beforeBeat), action: 'node' }));
            }
        }
    } else if (oldBeats.length && newBeats.length > oldBeats.length && oldTitles.every((title, i) => title === newTitles[i])) {
        for (const beat of newBeats.slice(oldBeats.length)) {
            items.push(normalizeActivityItem({ module: 'outline', title: outlineKey(beat), action: 'continue' }));
        }
    } else if (oldBeats.length || newBeats.length) {
        const title = outlineKey(newBeats[0]) || outlineKey(oldBeats[0]) || '整份面';
        items.push(normalizeActivityItem({ module: 'outline', title, action: 'replace' }));
    }
    return items;
}

export function diffDashedItems(before, after) {
    const oldItems = Array.isArray(before) ? before : [];
    const newItems = Array.isArray(after) ? after : [];
    const oldIds = new Set(oldItems.map(item => String(item?.id || '')));
    return newItems
        .filter(item => item?.id && !oldIds.has(String(item.id)))
        .map(item => normalizeActivityItem({ module: 'dashed', title: String(item.text || '').slice(0, 40), action: 'add', ref: item.id }));
}

export function diffSnapshots(before = {}, after = {}) {
    const items = [];
    if (before.point != null || after.point != null) items.push(...diffPointRaw(before.point, after.point));
    if (before.lines != null || after.lines != null) items.push(...diffLinesRaw(before.lines, after.lines));
    if (before.outline != null || after.outline != null) items.push(...diffOutlineRaw(before.outline, after.outline));
    if (before.dashed != null || after.dashed != null) items.push(...diffDashedItems(before.dashed, after.dashed));
    return items;
}

export function sameSnapshot(current, expected) {
    if (!expected) return false;
    if (expected.point != null && String(current?.point ?? '') !== String(expected.point)) return false;
    if (expected.lines != null && String(current?.lines ?? '') !== String(expected.lines)) return false;
    if (expected.outline) {
        if (String(current?.outline?.raw ?? '') !== String(expected.outline.raw || '')) return false;
        if (Number(current?.outline?.cursor || 0) !== Number(expected.outline.cursor || 0)) return false;
    }
    if (expected.dashed) {
        const now = JSON.stringify((current?.dashed || []).map(item => [item.id, item.text]));
        const then = JSON.stringify(expected.dashed.map(item => [item.id, item.text]));
        if (now !== then) return false;
    }
    return true;
}

import { parseCalendar, serializeCalendar } from '../point/parse.js';
import { parseLines, serializeLines } from '../lines/schema.js';
import { findBookIndex, fingerprintBookItem } from '../identity.js';
import { undoItemKey } from './schema.js';

const POINT_KEYS = ['type', 'title', 'desc', 'time', 'location', 'npcAction', 'pin'];
const LINE_KEYS = ['name', 'stage', 'when', 'agency', 'stall', 'pin', 'adult', 'desc', 'next'];

export { undoItemKey };

function locatePoints(raw) {
    const parsed = parseCalendar(String(raw || ''));
    const hits = [];
    const days = parsed.allDays || parsed.days || [];
    days.forEach((day, dayIndex) => (day.events || []).forEach((event, eventIndex) => hits.push({ event, dayIndex, eventIndex, future: false })));
    (parsed.future?.events || []).forEach((event, eventIndex) => hits.push({ event, dayIndex: 'future', eventIndex, future: true }));
    return { parsed, hits };
}

function pointIndex(hits, item) {
    return findBookIndex(hits.map(hit => hit.event), { id: item?.ref, name: item?.title, nameOf: 'title' });
}

function insertPoint(parsed, snapshotHit) {
    const clone = { ...snapshotHit.event };
    if (snapshotHit.future) {
        parsed.future ||= { events: [] };
        parsed.future.events.push(clone);
        return;
    }
    const days = parsed.allDays || parsed.days || [];
    const day = days[snapshotHit.dayIndex] || days[days.length - 1];
    if (day) day.events.splice(Math.min(snapshotHit.eventIndex, day.events.length), 0, clone);
}

function removePoint(parsed, hit) {
    const bucket = hit.future ? parsed.future?.events : (parsed.allDays || parsed.days || [])[hit.dayIndex]?.events;
    if (bucket) bucket.splice(hit.eventIndex, 1);
}

export function restorePointItem(currentRaw, snapshotRaw, afterRaw, item) {
    const current = locatePoints(currentRaw);
    const snapshot = locatePoints(snapshotRaw);
    const after = locatePoints(afterRaw);
    const snapIndex = pointIndex(snapshot.hits, item);
    const afterIndex = pointIndex(after.hits, item);
    const currentIndex = pointIndex(current.hits, item);
    if (snapIndex < 0 && afterIndex < 0) return { changed: false, raw: currentRaw };
    if (snapIndex < 0 && afterIndex >= 0) {
        if (currentIndex < 0) return { changed: false, raw: currentRaw };
        if (fingerprintBookItem(current.hits[currentIndex].event, POINT_KEYS) !== fingerprintBookItem(after.hits[afterIndex].event, POINT_KEYS)) {
            return { changed: false, raw: currentRaw };
        }
        removePoint(current.parsed, current.hits[currentIndex]);
        return { changed: true, raw: serializeCalendar(current.parsed.allDays || current.parsed.days, current.parsed.future, current.parsed.startDate, null, current.parsed.startDateToken) };
    }
    if (afterIndex < 0) {
        if (currentIndex >= 0) return { changed: false, raw: currentRaw };
        insertPoint(current.parsed, snapshot.hits[snapIndex]);
        return { changed: true, raw: serializeCalendar(current.parsed.allDays || current.parsed.days, current.parsed.future, current.parsed.startDate, null, current.parsed.startDateToken) };
    }
    if (currentIndex < 0) return { changed: false, raw: currentRaw };
    if (fingerprintBookItem(current.hits[currentIndex].event, POINT_KEYS) !== fingerprintBookItem(after.hits[afterIndex].event, POINT_KEYS)) {
        return { changed: false, raw: currentRaw };
    }
    removePoint(current.parsed, current.hits[currentIndex]);
    insertPoint(current.parsed, snapshot.hits[snapIndex]);
    return { changed: true, raw: serializeCalendar(current.parsed.allDays || current.parsed.days, current.parsed.future, current.parsed.startDate, null, current.parsed.startDateToken) };
}

export function restoreLineItem(currentRaw, snapshotRaw, afterRaw, item) {
    const current = parseLines(String(currentRaw || ''));
    const snapshot = parseLines(String(snapshotRaw || ''));
    const after = parseLines(String(afterRaw || ''));
    const snapIndex = findBookIndex(snapshot, { id: item?.ref, name: item?.title, nameOf: 'name' });
    const afterIndex = findBookIndex(after, { id: item?.ref, name: item?.title, nameOf: 'name' });
    const currentIndex = findBookIndex(current, { id: item?.ref, name: item?.title, nameOf: 'name' });
    if (snapIndex < 0 && afterIndex < 0) return { changed: false, raw: currentRaw };
    if (snapIndex < 0 && afterIndex >= 0) {
        if (currentIndex < 0) return { changed: false, raw: currentRaw };
        if (fingerprintBookItem(current[currentIndex], LINE_KEYS) !== fingerprintBookItem(after[afterIndex], LINE_KEYS)) return { changed: false, raw: currentRaw };
        current.splice(currentIndex, 1);
        return { changed: true, raw: current.length ? serializeLines(current) : '' };
    }
    if (afterIndex < 0) {
        if (currentIndex >= 0) return { changed: false, raw: currentRaw };
        current.splice(Math.min(snapIndex, current.length), 0, { ...snapshot[snapIndex] });
        return { changed: true, raw: serializeLines(current) };
    }
    if (currentIndex < 0) return { changed: false, raw: currentRaw };
    if (fingerprintBookItem(current[currentIndex], LINE_KEYS) !== fingerprintBookItem(after[afterIndex], LINE_KEYS)) return { changed: false, raw: currentRaw };
    current[currentIndex] = { ...snapshot[snapIndex] };
    return { changed: true, raw: serializeLines(current) };
}

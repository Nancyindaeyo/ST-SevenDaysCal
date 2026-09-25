import { applyPointPatches } from '../refresh/patch.js';
import { diffPointRaw } from '../activity/diff.js';
import { dayKeyForMonthDay, splitEventWhen } from './event-when.js';
import { isCompletePointEvent, mergePinnedPoints, parseCalendar, validateGeneratedCalendar } from './parse.js';

const EVENT_FIELDS = Object.freeze(['title', 'desc', 'time', 'location']);

function issue(code, extra = {}) {
    return { code, severity: extra.severity || 'error', ...extra };
}

function walkEvents(parsed, visitor) {
    for (const [index, day] of (parsed.pastDays || []).entries()) {
        for (const [eventIndex, event] of (day.events || []).entries()) {
            visitor(event, { bucket: 'past', dayKey: `past:${index}`, eventIndex });
        }
    }
    for (const [index, day] of (parsed.allDays || []).entries()) {
        for (const [eventIndex, event] of (day.events || []).entries()) {
            visitor(event, { bucket: 'day', dayNumber: day.dayNumber, dayKey: index, eventIndex });
        }
    }
    for (const [eventIndex, event] of (parsed.future?.events || []).entries()) {
        visitor(event, { bucket: 'future', dayKey: 'future', eventIndex });
    }
}

export function diagnosePointWindow(raw, calendar = null) {
    const parsed = parseCalendar(raw, calendar);
    const generated = validateGeneratedCalendar(raw, calendar, { generated: true });
    const issues = [];
    const counts = generated.diagnostics?.dayCounts || {};
    for (const dayNumber of [1, 2, 3]) {
        if (!counts[dayNumber]) issues.push(issue('day-missing', { dayNumber, bucket: 'day', detail: `缺 Day ${dayNumber}` }));
    }
    for (const day of parsed.allDays || []) {
        if (![1, 2, 3].includes(day.dayNumber)) continue;
        if (counts[day.dayNumber] && !(day.events || []).length) {
            issues.push(issue('day-empty', { dayNumber: day.dayNumber, bucket: 'day', detail: `Day ${day.dayNumber} 是空天` }));
        }
    }
    walkEvents(parsed, (event, loc) => {
        if (isCompletePointEvent(event)) return;
        const field = EVENT_FIELDS.find(name => !String(event?.[name] || '').trim()) || 'title';
        issues.push(issue('event-incomplete', {
            ...loc,
            title: String(event?.title || ''),
            field,
            detail: `${event?.title || '未命名'} 缺 ${field}`,
        }));
    });
    for (const [eventIndex, event] of (parsed.future?.events || []).entries()) {
        const stamp = splitEventWhen(event?.time);
        if (!stamp.month || !stamp.day) {
            issues.push(issue('future-missing-date', {
                bucket: 'future',
                dayKey: 'future',
                eventIndex,
                title: String(event?.title || ''),
                detail: `${event?.title || '未命名'} 的 Future 缺月日`,
            }));
        }
    }
    return {
        ok: issues.length === 0,
        issues,
        populatedDays: (parsed.days || []).length,
        generatedCode: generated.code || '',
    };
}

export function planPointPatchDryRun(raw, patches, { feedback = '', calendar = null } = {}) {
    const result = applyPointPatches(raw, patches, { feedback, calendar });
    return {
        changed: !!result.changed,
        raw: result.raw,
        applied: result.applied || [],
        skippedLocks: result.skippedLocks || [],
        items: diffPointRaw(raw, result.raw),
    };
}

export function planPointRegenDryRun(oldRaw, candidateRaw, calendar = null) {
    const merged = mergePinnedPoints(oldRaw, candidateRaw, calendar);
    const items = diffPointRaw(oldRaw, merged);
    const before = parseCalendar(oldRaw, calendar);
    const locked = [];
    walkEvents(before, event => { if (event?.pin && event.title) locked.push(String(event.title)); });
    const skippedLocks = locked.filter(title => !items.some(item => item.title === title && item.action !== 'complete'));
    return { mergedRaw: merged, items, skippedLocks };
}

export function checkEventDateOwnership(parsed, dayKey, eventIndex, calendar = null) {
    const event = dayKey === 'future'
        ? parsed?.future?.events?.[eventIndex]
        : /^past:(\d+)$/.exec(String(dayKey))
            ? parsed?.pastDays?.[Number(RegExp.$1)]?.events?.[eventIndex]
            : parsed?.days?.[Number(dayKey)]?.events?.[eventIndex];
    const stamp = splitEventWhen(event?.time);
    if (!stamp.month || !stamp.day) return { ok: true, dayKey, expected: dayKey, event };
    const expected = dayKeyForMonthDay(parsed, stamp.month, stamp.day, calendar);
    return { ok: String(expected) === String(dayKey), dayKey, expected, event };
}

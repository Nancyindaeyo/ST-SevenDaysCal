import { parseCalendar, serializeCalendar } from './parse.js';
export { editPointDescription, editPointFields } from './edit.js';

function eventsAt(parsed, dayKey) {
    if (dayKey === 'future') return parsed.future?.events || null;
    const past = /^past:(\d+)$/.exec(String(dayKey));
    if (past) return parsed.pastDays?.[Number(past[1])]?.events || null;
    return parsed.days?.[Number(dayKey)]?.events || null;
}

export function togglePointPinRaw(raw, dayKey, eventIndex, calendar = null) {
    const parsed = parseCalendar(raw, calendar); const events = eventsAt(parsed, dayKey); const ev = events?.[eventIndex];
    if (!ev) return { ok: false, reason: 'event-not-found', raw };
    ev.pin = !ev.pin;
    return { ok: true, pinned: ev.pin, raw: serializeCalendar(parsed.allDays || parsed.days, parsed.future, parsed.startDate, calendar, parsed.startDateToken, parsed.pastDays) };
}

export function deletePointEventRaw(raw, dayKey, eventIndex, calendar = null) {
    const parsed = parseCalendar(raw, calendar); const events = eventsAt(parsed, dayKey);
    if (!events?.[eventIndex]) return { ok: false, reason: 'event-not-found', raw };
    const [event] = events.splice(eventIndex, 1);
    return { ok: true, deleted: event, raw: serializeCalendar(parsed.allDays || parsed.days, parsed.future, parsed.startDate, calendar, parsed.startDateToken, parsed.pastDays) };
}

export function movePointEvent(raw, fromKey, eventIndex, toKey, calendar = null) {
    if (String(fromKey) === String(toKey)) return { ok: true, moved: false, raw, dayKey: fromKey };
    const parsed = parseCalendar(raw, calendar);
    const fromEvents = eventsAt(parsed, fromKey);
    if (!fromEvents?.[eventIndex]) return { ok: false, reason: 'event-not-found', raw };
    const past = /^past:(\d+)$/.exec(String(toKey));
    const dest = toKey === 'future'
        ? (parsed.future || (parsed.future = { events: [] }))
        : past
            ? parsed.pastDays?.[Number(past[1])]
            : parsed.days?.[Number(toKey)];
    if (!dest?.events) return { ok: false, reason: 'day-not-found', raw };
    const [event] = fromEvents.splice(eventIndex, 1);
    dest.events.push(event);
    return {
        ok: true,
        moved: true,
        dayKey: toKey,
        raw: serializeCalendar(parsed.allDays || parsed.days, parsed.future, parsed.startDate, calendar, parsed.startDateToken, parsed.pastDays),
    };
}

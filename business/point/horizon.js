import { parseCalendar, serializeCalendar } from './parse.js';

export const POINT_HORIZON_DAYS = 3;
export const POINT_DAY_EVENT_TARGET = 3;

export function pointDayEventGap(raw, dayIndex = 0, calendar = null, target = POINT_DAY_EVENT_TARGET) {
    if (!String(raw || '').trim()) return 0;
    const parsed = parseCalendar(String(raw || ''), calendar);
    const days = parsed.allDays || parsed.days || [];
    const day = days[dayIndex];
    if (!day) return 0;
    return Math.max(0, Number(target) - (day.events || []).length);
}

export function pointDayCount(raw, calendar = null) {
    const parsed = parseCalendar(String(raw || ''), calendar);
    return (parsed.allDays || parsed.days || []).length;
}

export function pointHorizonGap(raw, calendar = null, horizon = POINT_HORIZON_DAYS) {
    if (!String(raw || '').trim()) return 0;
    return Math.max(0, Number(horizon) - pointDayCount(raw, calendar));
}

export function horizonExistingSummary(raw, calendar = null) {
    const parsed = parseCalendar(String(raw || ''), calendar);
    return (parsed.allDays || parsed.days || []).map(day => {
        const titles = (day.events || []).map(event => String(event.title || '').trim()).filter(Boolean).join('、') || '（空）';
        return `Day ${day.dayNumber}：${titles}`;
    }).join('\n');
}

export function appendHorizonDays(existingRaw, fillRaw, calendar = null, horizon = POINT_HORIZON_DAYS) {
    const existing = parseCalendar(String(existingRaw || ''), calendar);
    const kept = [...(existing.allDays || existing.days || [])];
    const before = kept.length;
    if (before >= horizon) return { changed: false, raw: String(existingRaw || ''), added: 0 };
    const fill = parseCalendar(String(fillRaw || ''), calendar);
    let nextNumber = before + 1;
    for (const day of fill.allDays || fill.days || []) {
        if (nextNumber > horizon) break;
        kept.push({
            ...day,
            dayNumber: nextNumber,
            events: (day.events || []).map(event => ({ ...event, pin: false })),
        });
        nextNumber += 1;
    }
    const added = kept.length - before;
    if (!added) return { changed: false, raw: String(existingRaw || ''), added: 0 };
    return {
        changed: true,
        added,
        raw: serializeCalendar(kept, existing.future, existing.startDate, calendar, existing.startDateToken, existing.pastDays),
    };
}

export function planAdvanceSteps({
    hasPoint = false,
    pointRaw = '',
    today = null,
    calendar = null,
    linesOn = true,
} = {}) {
    const steps = [];
    if (hasPoint && pointHorizonGap(pointRaw, calendar) > 0) steps.push('fill');
    if (linesOn) steps.push('lines');
    return steps;
}

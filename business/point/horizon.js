import { parseCalendar, serializeCalendar } from './parse.js';

export const POINT_HORIZON_DAYS = 3;

function pointStartDateBehind(raw, today) {
    if (!String(raw || '').trim()) return false;
    const match = String(raw).match(/StartDate:\s*(?:\d{4}|null)-(\d{1,2})-(\d{1,2})/i);
    const month = Number(today?.month), day = Number(today?.day);
    return !!(match && Number.isInteger(month) && Number.isInteger(day)
        && (Number(match[1]) !== month || Number(match[2]) !== day));
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
        raw: serializeCalendar(kept, existing.future, existing.startDate, calendar, existing.startDateToken),
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
    if (hasPoint && pointStartDateBehind(pointRaw, today)) steps.push('shift');
    if (hasPoint && pointHorizonGap(pointRaw, calendar) > 0) steps.push('fill');
    if (linesOn) steps.push('lines');
    return steps;
}

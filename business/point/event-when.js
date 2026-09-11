import { addCalendarDays, calendarDate, isGregorian } from '../calendar/date.js';
import { normalizeEditableText } from '../utils/text-edit.js';

const CN_DATE = /(?:(\d{4})\s*年)?\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/;
const SLASH_DATE = /(?:(\d{4})[./-])?(\d{1,2})[./-](\d{1,2})(?!\d)/;

function asStart(startDate, calendar = null) {
    if (isGregorian(calendar) && startDate instanceof Date && !Number.isNaN(startDate.getTime())) {
        return calendarDate(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
    }
    if (startDate && Number.isInteger(Number(startDate.month)) && Number.isInteger(Number(startDate.day))) {
        return calendarDate(startDate.year ?? null, Number(startDate.month), Number(startDate.day));
    }
    return null;
}

export function splitEventWhen(time = '') {
    const text = String(time || '').trim();
    const cn = text.match(CN_DATE);
    const slash = cn ? null : text.match(SLASH_DATE);
    const hit = cn || slash;
    if (!hit) return { year: '', month: '', day: '', clock: text };
    return {
        year: hit[1] || '',
        month: String(Number(hit[2])),
        day: String(Number(hit[3])),
        clock: text.replace(hit[0], ' ').replace(/\s+/g, ' ').trim(),
    };
}

export function composeEventWhen({ year, month, day, clock } = {}, { withDate = false } = {}) {
    const time = normalizeEditableText(clock);
    const m = Number(month);
    const d = Number(day);
    if (!withDate || !Number.isInteger(m) || !Number.isInteger(d)) return time;
    const y = Number(year);
    const head = Number.isInteger(y) && y >= 1 ? `${y}年${m}月${d}日` : `${m}月${d}日`;
    return [head, time].filter(Boolean).join(' ');
}

export function eventTabDate(parsed, dayKey, calendar = null) {
    if (dayKey === 'future') return null;
    const past = /^past:(\d+)$/.exec(String(dayKey));
    if (past) return parsed?.pastDays?.[Number(past[1])]?.date || null;
    const start = asStart(parsed?.startDate, calendar);
    const slot = parsed?.days?.[Number(dayKey)];
    if (!start || !slot) return null;
    const offset = Number(slot.dayNumber);
    if (!Number.isInteger(offset) || offset < 1) return addCalendarDays(start, Number(dayKey), calendar);
    return addCalendarDays(start, offset - 1, calendar);
}

export function dayKeyForMonthDay(parsed, month, day, calendar = null) {
    const m = Number(month);
    const d = Number(day);
    if (!Number.isInteger(m) || !Number.isInteger(d)) return null;
    const pastIndex = (parsed?.pastDays || []).findIndex(item => item?.date?.month === m && item?.date?.day === d);
    if (pastIndex >= 0) return `past:${pastIndex}`;
    const start = asStart(parsed?.startDate, calendar);
    if (!start) return 'future';
    const days = parsed?.days || [];
    for (let i = 0; i < days.length; i++) {
        const at = addCalendarDays(start, Number(days[i].dayNumber) - 1, calendar);
        if (at && at.month === m && at.day === d) return i;
    }
    return 'future';
}

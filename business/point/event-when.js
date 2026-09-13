import { addCalendarDays, calendarDate, isGregorian } from '../calendar/date.js';
import { normalizeEditableText } from '../utils/text-edit.js';

const CN_DATE = /(?:(\d{4})\s*年)?\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/;
const ISO_DATE = /(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/;
const SLASH_DATE = /(\d{1,2})[./](\d{1,2})(?!\d)/;

function asStart(startDate, calendar = null) {
    if (isGregorian(calendar) && startDate instanceof Date && !Number.isNaN(startDate.getTime())) {
        return calendarDate(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
    }
    if (startDate && Number.isInteger(Number(startDate.month)) && Number.isInteger(Number(startDate.day))) {
        return calendarDate(startDate.year ?? null, Number(startDate.month), Number(startDate.day));
    }
    return null;
}

function packStamp(year, month, day, text, hit) {
    const m = Number(month);
    const d = Number(day);
    if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(d) || d < 1 || d > 31) {
        return { year: '', month: '', day: '', clock: text };
    }
    return {
        year: year || '',
        month: String(m),
        day: String(d),
        clock: text.replace(hit, ' ').replace(/\s+/g, ' ').trim(),
    };
}

export function splitEventWhen(time = '') {
    const text = String(time || '').trim();
    const cn = text.match(CN_DATE);
    if (cn) return packStamp(cn[1], cn[2], cn[3], text, cn[0]);
    const iso = text.match(ISO_DATE);
    if (iso) return packStamp(iso[1], iso[2], iso[3], text, iso[0]);
    const slash = text.match(SLASH_DATE);
    if (slash) return packStamp('', slash[1], slash[2], text, slash[0]);
    return { year: '', month: '', day: '', clock: text };
}

export function parsePointDayDate(text = '') {
    const stamp = splitEventWhen(text);
    if (!stamp.month || !stamp.day || stamp.clock) return null;
    return { year: stamp.year || '', month: Number(stamp.month), day: Number(stamp.day) };
}

export function formatPointDayDate({ year, month, day } = {}) {
    const m = Number(month);
    const d = Number(day);
    if (!Number.isInteger(m) || m < 1 || !Number.isInteger(d) || d < 1) return '';
    const y = Number(year);
    return Number.isInteger(y) && y >= 1 ? `${y}年${m}月${d}日` : `${m}月${d}日`;
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
    const slot = parsed?.days?.[Number(dayKey)];
    if (slot?.date && Number.isInteger(Number(slot.date.month)) && Number.isInteger(Number(slot.date.day))) {
        return calendarDate(slot.date.year || null, Number(slot.date.month), Number(slot.date.day));
    }
    const start = asStart(parsed?.startDate, calendar);
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
        const header = days[i]?.date;
        if (header && Number(header.month) === m && Number(header.day) === d) return i;
        const at = addCalendarDays(start, Number(days[i].dayNumber) - 1, calendar);
        if (at && at.month === m && at.day === d) return i;
    }
    return 'future';
}

import { calendarDate, isGregorian } from '../calendar/date.js';
import { forceStartDate, parseCalendar } from './parse.js';

function startMonthDay(startDate, calendar = null) {
    if (isGregorian(calendar) && startDate instanceof Date && !Number.isNaN(startDate.getTime())) {
        return calendarDate(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
    }
    if (startDate && Number.isInteger(Number(startDate.month)) && Number.isInteger(Number(startDate.day))) {
        return calendarDate(startDate.year ?? null, Number(startDate.month), Number(startDate.day));
    }
    return null;
}

export function pointStartMonthDay(raw, calendar = null) {
    return startMonthDay(parseCalendar(String(raw || ''), calendar).startDate, calendar);
}

export function pointStartNeedsAlign(raw, today, calendar = null) {
    const start = pointStartMonthDay(raw, calendar);
    const month = Number(today?.month);
    const day = Number(today?.day);
    if (!start || !Number.isInteger(month) || !Number.isInteger(day)) return false;
    return start.month !== month || start.day !== day;
}

export function alignPointStartDate(raw, today, calendar = null) {
    const text = String(raw || '');
    const from = pointStartMonthDay(text, calendar);
    const month = Number(today?.month);
    const day = Number(today?.day);
    if (!from || !Number.isInteger(month) || !Number.isInteger(day)) {
        return { changed: false, raw: text, from, to: null };
    }
    const to = { month, day };
    if (from.month === month && from.day === day) return { changed: false, raw: text, from, to };
    return {
        changed: true,
        raw: forceStartDate(text, month, day, calendar),
        from,
        to,
        fromLabel: `${from.month}/${from.day}`,
        toLabel: `${month}/${day}`,
    };
}

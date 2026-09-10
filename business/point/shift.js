import { addCalendarDays, calendarDate, isGregorian, ordinalOf } from '../calendar/date.js';
import { daysBetweenCalendarDates } from '../axis/full-ordinal.js';
import { POINT_ANCHOR_YEAR, parseCalendar, serializeCalendar } from './parse.js';

function yearLength(calendar, year) {
    if (isGregorian(calendar)) {
        return Number.isInteger(year) && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
    }
    return (calendar?.months || []).reduce((n, month) => n + Number(month.days || 0), 0);
}

export function startDateMonthDay(startDate) {
    if (startDate instanceof Date && !Number.isNaN(startDate.getTime())) {
        return { year: startDate.getFullYear(), month: startDate.getMonth() + 1, day: startDate.getDate() };
    }
    if (startDate && Number.isInteger(Number(startDate.month)) && Number.isInteger(Number(startDate.day))) {
        return {
            year: Number.isInteger(Number(startDate.year)) ? Number(startDate.year) : POINT_ANCHOR_YEAR,
            month: Number(startDate.month),
            day: Number(startDate.day),
        };
    }
    return null;
}

export function daysForwardToToday(fromMd, toMd, calendar = null) {
    if (!fromMd || !toMd) return 0;
    const from = calendarDate(fromMd.year ?? POINT_ANCHOR_YEAR, fromMd.month, fromMd.day);
    const to = calendarDate(toMd.year ?? from.year, toMd.month, toMd.day);
    const gregorian = isGregorian(calendar);
    let delta = gregorian
        ? daysBetweenCalendarDates(from, to, { kind: 'gregorian' })
        : (() => {
            const a = ordinalOf(from, calendar);
            const b = ordinalOf(to, calendar);
            return a == null || b == null ? null : b - a;
        })();
    if (!Number.isInteger(delta) || delta === 0) return 0;
    if (delta > 0) return delta;
    const wrapped = delta + yearLength(calendar, from.year);
    return wrapped > 0 && wrapped <= 60 ? wrapped : 0;
}

function cloneEvent(event) {
    return { ...event };
}

export function shiftPointCalendar(raw, target, calendar = null) {
    const text = String(raw || '');
    if (!text.trim() || !target || !Number.isInteger(Number(target.month)) || !Number.isInteger(Number(target.day))) {
        return { changed: false, raw: text, completed: [], lockedMoved: [], delta: 0 };
    }
    const parsed = parseCalendar(text, calendar);
    const fromMd = startDateMonthDay(parsed.startDate);
    if (!fromMd) return { changed: false, raw: text, completed: [], lockedMoved: [], delta: 0 };
    const delta = daysForwardToToday(fromMd, target, calendar);
    if (delta <= 0) return { changed: false, raw: text, completed: [], lockedMoved: [], delta: 0 };

    const completed = [];
    const lockedMoved = [];
    const kept = [];
    for (const day of parsed.allDays || parsed.days || []) {
        const nextNumber = Number(day.dayNumber) - delta;
        if (nextNumber >= 1) {
            kept.push({
                ...day,
                dayNumber: nextNumber,
                events: (day.events || []).map(cloneEvent),
            });
            continue;
        }
        for (const event of day.events || []) {
            if (event?.pin) lockedMoved.push(cloneEvent(event));
            else if (String(event?.title || '').trim()) completed.push(cloneEvent(event));
        }
    }
    const futureEvents = [
        ...lockedMoved,
        ...((parsed.future?.events || []).map(cloneEvent)),
    ];
    const future = futureEvents.length ? { events: futureEvents } : null;
    const nextStart = addCalendarDays(calendarDate(fromMd.year, fromMd.month, fromMd.day), delta, calendar)
        || calendarDate(target.year ?? fromMd.year, target.month, target.day);
    const startDate = isGregorian(calendar)
        ? new Date(POINT_ANCHOR_YEAR, nextStart.month - 1, nextStart.day)
        : nextStart;
    const nextRaw = serializeCalendar(kept, future, startDate, calendar);
    return { changed: true, raw: nextRaw, completed, lockedMoved, delta };
}

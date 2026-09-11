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
    // 点的公历年份固定为展示用锚年，不能拿剧情真实年份计算跨度。
    const to = calendarDate(from.year, toMd.month, toMd.day);
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

export function pointTodayDayIndex(raw, target, calendar = null) {
    const parsed = parseCalendar(String(raw || ''), calendar);
    const fromMd = startDateMonthDay(parsed.startDate);
    if (!fromMd || !target) return null;
    const delta = daysForwardToToday(fromMd, target, calendar);
    const dayIndex = (parsed.allDays || parsed.days || []).findIndex(day => Number(day.dayNumber) === delta + 1);
    return dayIndex >= 0 ? dayIndex : null;
}

function cloneEvent(event) {
    return { ...event };
}

export function shiftPointCalendar(raw, target, calendar = null) {
    const text = String(raw || '');
    if (!text.trim() || !target || !Number.isInteger(Number(target.month)) || !Number.isInteger(Number(target.day))) {
        return { changed: false, raw: text, archived: [], delta: 0 };
    }
    const parsed = parseCalendar(text, calendar);
    const fromMd = startDateMonthDay(parsed.startDate);
    if (!fromMd) return { changed: false, raw: text, archived: [], delta: 0 };
    const delta = daysForwardToToday(fromMd, target, calendar);
    if (delta <= 0) return { changed: false, raw: text, archived: [], delta: 0 };

    const archived = [];
    const pastDays = (parsed.pastDays || []).map(day => ({ ...day, events: (day.events || []).map(cloneEvent) }));
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
        const originalDate = addCalendarDays(calendarDate(fromMd.year, fromMd.month, fromMd.day), Number(day.dayNumber) - 1, calendar);
        const pastDay = {
            date: originalDate,
            weather: day.weather || '',
            temp: day.temp || '',
            events: (day.events || []).map(cloneEvent),
        };
        if (pastDay.events.length) {
            pastDays.push(pastDay);
            archived.push(...pastDay.events.map(cloneEvent));
        }
    }
    const futureEvents = (parsed.future?.events || []).map(cloneEvent);
    const future = futureEvents.length ? { events: futureEvents } : null;
    const nextStart = addCalendarDays(calendarDate(fromMd.year, fromMd.month, fromMd.day), delta, calendar)
        || calendarDate(target.year ?? fromMd.year, target.month, target.day);
    const startDate = isGregorian(calendar)
        ? new Date(POINT_ANCHOR_YEAR, nextStart.month - 1, nextStart.day)
        : nextStart;
    const nextRaw = serializeCalendar(kept, future, startDate, calendar, null, pastDays);
    return { changed: true, raw: nextRaw, archived, delta };
}

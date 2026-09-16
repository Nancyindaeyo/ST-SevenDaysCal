// 旧聊天补本地 Id:：只改存储文本，不进生成提示词。没有缺 id 时不重写。
import { parseCalendar, serializeCalendar } from './point/parse.js';
import { parseLines, serializeLines } from './lines/schema.js';

function pointEvents(parsed) {
    return [
        ...(parsed?.pastDays || []).flatMap(day => day.events || []),
        ...(parsed?.allDays || parsed?.days || []).flatMap(day => day.events || []),
        ...(parsed?.future?.events || []),
    ];
}

function missingId(item) {
    return !String(item?.id || '').trim();
}

export function migratePointRaw(raw) {
    const source = String(raw || '');
    if (!source.trim()) return { changed: false, raw: source };
    try {
        const parsed = parseCalendar(source);
        const events = pointEvents(parsed);
        if (!events.length || !events.some(missingId)) return { changed: false, raw: source };
        const next = serializeCalendar(parsed.allDays || parsed.days, parsed.future, parsed.startDate, null, parsed.startDateToken, parsed.pastDays);
        return { changed: true, raw: next, previous: source };
    } catch {
        return { changed: false, raw: source };
    }
}

export function migrateLinesRaw(raw) {
    const source = String(raw || '');
    if (!source.trim()) return { changed: false, raw: source };
    try {
        const lines = parseLines(source);
        if (!lines.length || !lines.some(missingId)) return { changed: false, raw: source };
        return { changed: true, raw: serializeLines(lines), previous: source };
    } catch {
        return { changed: false, raw: source };
    }
}

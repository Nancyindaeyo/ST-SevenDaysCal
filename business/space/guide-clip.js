import { parseLines, serializeLines } from '../lines/schema.js';

const CN_DAY = Object.freeze({ 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7 });
const DAY_HEAD = /^(?:Day\s*[:：]?\s*(\d+)|第([一二三四五六七]|\d+)天)/i;
const PAST_HEAD = /^PastDay\s*[:：]/i;
const FUTURE_HEAD = /^(?:Future|未来)\s*[:：]/i;
const ID_LINE = /^Id\s*[:：]/i;

export function guideText(value) {
    return String(value || '').trim();
}

function windowDayNumber(text) {
    const match = DAY_HEAD.exec(String(text || '').trim());
    if (!match) return null;
    const n = Number(match[1] || CN_DAY[match[2]] || match[2]);
    return Number.isInteger(n) && n > 0 ? n : null;
}

// 引导只看点窗口：今天到后两天 + Future。PastDay 和窗口外的天整段拿掉，不按字数切断 Event。
export function clipGuidePointRaw(raw) {
    const source = String(raw || '').trim();
    if (!source) return '';
    const match = /<calendar_widget[^>]*>([\s\S]*?)<\/calendar_widget>/i.exec(source);
    const inner = match ? match[1] : source;
    const kept = [];
    let mode = 'head';
    for (const line of inner.split('\n')) {
        const t = line.trim();
        if (PAST_HEAD.test(t)) { mode = 'drop'; continue; }
        const day = windowDayNumber(t);
        if (day != null) {
            mode = day <= 3 ? 'keep' : 'drop';
            if (mode === 'keep') kept.push(line);
            continue;
        }
        if (FUTURE_HEAD.test(t)) { mode = 'keep'; kept.push(line); continue; }
        if (mode === 'drop' || ID_LINE.test(t)) continue;
        kept.push(line);
    }
    const body = kept.join('\n').trim();
    return body ? `<calendar_widget>\n${body}\n</calendar_widget>` : source;
}

// 线按完整条重序列化；解析失败则原文原样送出，避免半截 Desc。
export function clipGuideLinesRaw(raw) {
    const source = String(raw || '').trim();
    if (!source) return '';
    const parsed = parseLines(source);
    if (!parsed.length) return source;
    return serializeLines(parsed, { includeId: false, assignIds: false });
}

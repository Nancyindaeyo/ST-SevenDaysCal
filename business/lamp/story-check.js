import { compactText, OUT_RX, STAY_RX, textsRelated } from './detect.js';
import { NEAR_WHEN_RX, pickNearLines, pickTodayPoint } from '../stage/snapshot.js';

const DONE_RX = /已经|完了|结束|离开|走了|办完|过去了/;
const NEXT_DAY_RX = /次日|第二天|隔天|翌日/;

function snippetOf(story, needle) {
    const raw = String(story || '');
    const compactNeedle = compactText(needle);
    if (!compactNeedle) return raw.slice(0, 48);
    const compactStory = compactText(raw);
    const at = compactStory.indexOf(compactNeedle);
    if (at < 0) return raw.slice(0, 48);
    return raw.slice(Math.max(0, at - 8), Math.min(raw.length, at + compactNeedle.length + 24)).trim();
}

function stale({ id, title, detail, quote = '', module, ref = '' }) {
    return Object.freeze({
        id,
        title: String(title || '').trim(),
        detail: String(detail || '').trim(),
        quote: String(quote || '').trim(),
        module,
        ref: String(ref || '').trim(),
        source: 'story',
    });
}

export function checkLatestStory({ days = [], lines = [], story = '' } = {}) {
    const text = String(story || '').trim();
    if (!text) return Object.freeze([]);
    const today = pickTodayPoint(days);
    const events = today?.events || [];
    const found = [];

    for (const event of events) {
        const title = String(event.title || '').trim();
        if (!title) continue;
        const blob = [event.title, event.location, event.desc].filter(Boolean).join(' ');
        const mentioned = textsRelated(text, title) || compactText(text).includes(compactText(title));
        if (mentioned && DONE_RX.test(text)) {
            found.push(stale({
                id: `stale-point:${title}`,
                title,
                detail: '正文里这件事已经发生，点还挂在今天',
                quote: snippetOf(text, title),
                module: 'point',
                ref: event.id,
            }));
            continue;
        }
        if (STAY_RX.test(blob) && OUT_RX.test(text)) {
            found.push(stale({
                id: `stale-point:${title}`,
                title,
                detail: '点还在写留在家里，这楼正文已经出门',
                quote: snippetOf(text, event.location || title),
                module: 'point',
                ref: event.id,
            }));
        }
    }

    for (const line of pickNearLines(lines)) {
        const name = String(line.name || '').trim();
        if (!name) continue;
        const mentioned = textsRelated(text, name) || compactText(text).includes(compactText(name));
        if (mentioned && DONE_RX.test(text)) {
            found.push(stale({
                id: `stale-line:${name}`,
                title: name,
                detail: '正文里这条线已经发生，线还写近日',
                quote: snippetOf(text, name),
                module: 'lines',
                ref: line.id,
            }));
            continue;
        }
        if (NEAR_WHEN_RX.test(String(line.when || '')) && NEXT_DAY_RX.test(text)) {
            found.push(stale({
                id: `stale-line:${name}`,
                title: name,
                detail: '线还写近日，正文已经改日',
                quote: snippetOf(text, name) || text.slice(0, 48),
                module: 'lines',
                ref: line.id,
            }));
        }
    }

    const seen = new Set();
    return Object.freeze(found.filter(item => {
        if (!item.title || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    }).slice(0, 12));
}

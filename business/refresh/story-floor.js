import { normalizeTagRules, LITERAL_DOUBLE_BRACKET_RULE } from '../../utils/tag-names.js';
import { extractStoryText } from '../../utils/story-text.js';
import { latestAiFloor } from './controller.js';

export const STORY_FLOOR_MIN_CHARS = 200;

const STRONG_API_ERROR = /too many requests|rate[\s-]*limit|cloudflare|bad gateway|gateway time-?out|error\s*524|http\s*(?:429|502|503|504|520|522|524)|status(?:\s*code)?\s*[:：]?\s*(?:429|502|503|504|520|522|524)|(?:429|502|503|504|520|522|524)\s*(?:too many|rate|timeout|error|bad gateway)|请求过于频繁|网关超时|限流|上游(?:错误|返回)\s*(?:429|502|503|504|524)/i;
const SHORT_STATUS = /^(?:\[|\()?\s*(?:error[:\s]*)?(?:http[:\s]*)?(?:429|502|503|504|520|522|524)\b/i;

const REASON_LABEL = Object.freeze({
    'api-error': '接口错误',
    'unclosed-tag': '正文未闭合',
    'too-short': '正文过短',
});

function escapeTagName(name) {
    return String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function storyFloorNote(floorId) {
    return `#${floorId} 正文缺失，等有正文了自动补跑`;
}

export function looksLikeApiError(raw) {
    const text = String(raw || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return false;
    const head = text.slice(0, 180);
    if (STRONG_API_ERROR.test(head)) return true;
    if (text.length <= 400 && STRONG_API_ERROR.test(text)) return true;
    return text.length <= 80 && SHORT_STATUS.test(text);
}

export function unclosedKeepTag(raw, keepTags = 'content') {
    const names = normalizeTagRules(keepTags || 'content').filter(name => name !== LITERAL_DOUBLE_BRACKET_RULE);
    const source = String(raw || '');
    for (const name of names) {
        const safe = escapeTagName(name);
        const opens = source.match(new RegExp(`<${safe}(?:\\s[^>]*)?>`, 'giu'))?.length || 0;
        const closes = source.match(new RegExp(`</${safe}\\s*>`, 'giu'))?.length || 0;
        if (opens > closes) return name;
    }
    return '';
}

export function inspectStoryFloor(raw, { keepTags = 'content', minChars = STORY_FLOOR_MIN_CHARS } = {}) {
    if (looksLikeApiError(raw)) return { ok: false, reason: 'api-error', label: REASON_LABEL['api-error'] };
    const unclosed = unclosedKeepTag(raw, keepTags);
    if (unclosed) return { ok: false, reason: 'unclosed-tag', label: REASON_LABEL['unclosed-tag'] };
    const story = extractStoryText(raw, { keepTags });
    if ([...story].length <= minChars) return { ok: false, reason: 'too-short', label: REASON_LABEL['too-short'] };
    return { ok: true, reason: '', label: '' };
}

export function createStoryFloorHold() {
    let hold = null;
    return {
        evaluate({ chatId = null, floorId = null, swipeId = 0, raw = '', keepTags = 'content' } = {}) {
            const verdict = inspectStoryFloor(raw, { keepTags });
            const id = Number(floorId);
            if (verdict.ok) {
                const resume = !!hold && hold.chatId === chatId && hold.floorId === id;
                hold = null;
                return { ...verdict, resume, notify: false, floorId: id };
            }
            const key = `${chatId}:${id}:${Number(swipeId) || 0}:${verdict.reason}`;
            const notify = !hold || hold.key !== key;
            hold = {
                chatId,
                floorId: id,
                swipeId: Number(swipeId) || 0,
                reason: verdict.reason,
                label: verdict.label,
                note: storyFloorNote(id),
                key,
            };
            return { ...verdict, resume: false, notify, floorId: id, note: hold.note };
        },
        current() { return hold ? { ...hold } : null; },
        reset() { hold = null; },
    };
}

export function createStoryFloorHost(env = {}) {
    const hold = createStoryFloorHold();
    const chatOf = () => env.chat?.() || [];
    const resolveFloor = messageId => {
        const chat = chatOf();
        const latest = latestAiFloor(chat);
        if (!latest) return null;
        const mid = Number(messageId);
        if (Number.isInteger(mid) && mid >= 0 && mid !== latest.index) return null;
        return { index: latest.index, message: chat[latest.index] };
    };
    const sync = () => { try { env.syncFab?.(); env.paint?.(); } catch {} };
    function decide(messageId, { rearm = false, automations = false } = {}) {
        if (env.enabled?.() === false) return { blocked: false, resume: false, skipped: true };
        const floor = resolveFloor(messageId);
        if (!floor) return { blocked: false, resume: false, skipped: true };
        const message = floor.message;
        const before = hold.current();
        const decision = hold.evaluate({
            chatId: env.chatId?.() ?? null,
            floorId: floor.index,
            swipeId: message?.swipe_id ?? 0,
            raw: message?.mes || '',
            keepTags: env.keepTags?.(),
        });
        if (before?.key !== hold.current()?.key || decision.resume) sync();
        if (!decision.ok) {
            if (decision.notify && env.alreadyNoted?.(floor.index, decision.reason) !== true) {
                env.record?.({
                    source: 'story-gap',
                    outcome: 'skipped',
                    floorId: floor.index,
                    swipeId: Number(message?.swipe_id ?? 0),
                    reasonCode: decision.reason,
                    note: decision.note,
                    items: [{ module: 'lines', title: decision.note }],
                });
                env.toast?.(decision.note);
            }
            try { env.abort?.(); } catch {}
            return { ...decision, blocked: true };
        }
        if (decision.resume && rearm) env.rearm?.(floor.index);
        if (decision.resume && automations) env.resume?.(floor.index);
        return { ...decision, blocked: false };
    }
    return {
        blocked(messageId) { return decide(messageId, { rearm: true, automations: false }).blocked === true; },
        decision: decide,
        reset() { hold.reset(); sync(); },
        scan() { return decide(undefined, { rearm: false, automations: false }); },
        status() {
            const current = hold.current();
            return current ? { floorId: current.floorId, reason: current.reason, note: current.note, label: current.label } : null;
        },
    };
}

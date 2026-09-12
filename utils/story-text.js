// 读 AI 楼正文：可配置包裹标签优先，标签内全文保留；没有包裹则走原 stripTags。
import { LITERAL_DOUBLE_BRACKET_RULE, normalizeTagRules, TAG_NAME_SOURCE } from './tag-names.js';

export function normalizeTagList(csv) {
    return normalizeTagRules(csv);
}

const parseTagList = normalizeTagList;
const escapeTagName = name => String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const replaceLiteralDoubleBracketBlocks = (text, replacement) => String(text).replace(/\[\[([\s\S]*?)\]\]/g, replacement);

// 正文里常见的思维链标签：抽取正文后连同内容删掉，不把思考过程当叙事。
const STORY_INNER_NOISE = ['think', 'thinking', 'thought', 'reasoning', 'reason'];

function resolveKeepTags(opts = {}) {
    const raw = opts.keepTags;
    if (raw == null || String(raw).trim() === '') return 'content';
    return raw;
}

function collectKeepInners(raw, keep) {
    const inners = [];
    const source = String(raw || '');
    for (const name of keep) {
        if (name === LITERAL_DOUBLE_BRACKET_RULE) {
            source.replace(/\[\[([\s\S]*?)\]\]/g, (_m, inner) => {
                if (String(inner).trim()) inners.push(inner);
                return '';
            });
            continue;
        }
        const safeName = escapeTagName(name);
        const rx = new RegExp(`<${safeName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${safeName}\\s*>`, 'giu');
        let match;
        while ((match = rx.exec(source)) !== null) {
            if (String(match[1]).trim()) inners.push(match[1]);
        }
    }
    return inners;
}

function deleteNamedBlocks(text, names) {
    let s = String(text || '');
    for (const name of names) {
        if (name === LITERAL_DOUBLE_BRACKET_RULE) {
            s = replaceLiteralDoubleBracketBlocks(s, '');
            continue;
        }
        const safeName = escapeTagName(name);
        const rx = new RegExp(`<${safeName}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${safeName}\\s*>`, 'giu');
        let prev;
        do {
            prev = s;
            s = s.replace(rx, '');
        } while (s !== prev);
    }
    return s;
}

function unwrapRemainingTags(text) {
    let s = String(text || '');
    let prev;
    do {
        prev = s;
        s = s.replace(new RegExp(`<(${TAG_NAME_SOURCE})(?:\\s[^>]*)?>([\\s\\S]*?)<\\/\\1\\s*>`, 'gu'), '$2');
    } while (s !== prev);
    return s.replace(new RegExp(`<\\/?${TAG_NAME_SOURCE}(?:\\s[^>]*)?\\/?>`, 'gu'), '');
}

function cleanStoryInner(inner, extraTags) {
    let s = String(inner || '').replace(/<!--[\s\S]*?-->/g, '');
    const extra = [...new Set([...parseTagList(extraTags), ...STORY_INNER_NOISE])];
    s = deleteNamedBlocks(s, extra);
    s = unwrapRemainingTags(s);
    return s.replace(/\n{3,}/g, '\n\n').trim();
}

export function stripTags(raw, opts = {}) {
    if (!raw) return '';
    const keep = parseTagList(opts.keepTags ?? 'content');
    const extra = parseTagList(opts.extraTags ?? '');
    let s = String(raw);
    s = s.replace(/<!--[\s\S]*?-->/g, '');
    const keepStash = [];
    for (const name of keep) {
        if (name === LITERAL_DOUBLE_BRACKET_RULE) {
            s = replaceLiteralDoubleBracketBlocks(s, (_m, inner) => inner);
            continue;
        }
        const safeName = escapeTagName(name);
        const rx = new RegExp(`<${safeName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${safeName}\\s*>`, 'giu');
        s = s.replace(rx, (_m, inner) => {
            keepStash.push(inner);
            return ` KEEP${keepStash.length - 1} `;
        });
    }
    for (const name of extra) {
        if (name === LITERAL_DOUBLE_BRACKET_RULE) {
            s = replaceLiteralDoubleBracketBlocks(s, '');
            continue;
        }
        const safeName = escapeTagName(name);
        const rx = new RegExp(`<${safeName}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${safeName}\\s*>`, 'giu');
        let prev;
        do {
            prev = s;
            s = s.replace(rx, '');
        } while (s !== prev);
    }
    let prev;
    do {
        prev = s;
        s = s.replace(new RegExp(`<(${TAG_NAME_SOURCE})(?:\\s[^>]*)?>[\\s\\S]*?<\\/\\1\\s*>`, 'gu'), '');
    } while (s !== prev);
    s = s.replace(new RegExp(`<\\/?${TAG_NAME_SOURCE}(?:\\s[^>]*)?\\/?>`, 'gu'), '');
    s = s.replace(/ KEEP(\d+) /g, (_m, idx) => keepStash[+idx] ?? '');
    if (keep.includes(LITERAL_DOUBLE_BRACKET_RULE)) {
        s = replaceLiteralDoubleBracketBlocks(s, (_m, inner) => inner);
    }
    do {
        prev = s;
        s = s.replace(new RegExp(`<(${TAG_NAME_SOURCE})(?:\\s[^>]*)?>[\\s\\S]*?<\\/\\1\\s*>`, 'gu'), '');
    } while (s !== prev);
    s = s.replace(new RegExp(`<\\/?${TAG_NAME_SOURCE}(?:\\s[^>]*)?\\/?>`, 'gu'), '');
    if (extra.includes(LITERAL_DOUBLE_BRACKET_RULE) && !keep.includes(LITERAL_DOUBLE_BRACKET_RULE)) {
        s = replaceLiteralDoubleBracketBlocks(s, '');
    }
    return s.replace(/\n{3,}/g, '\n\n').trim();
}

// 有正文包裹时：只读标签内全文，外面的状态栏丢掉；段落 HTML 解开而不是整段删掉。
// 没有包裹：退回 stripTags（删掉 widget / 思维链，留下裸叙事）。
export function extractStoryText(raw, opts = {}) {
    if (!raw) return '';
    const keep = parseTagList(resolveKeepTags(opts));
    const inners = collectKeepInners(raw, keep);
    if (inners.length) return cleanStoryInner(inners.join('\n\n'), opts.extraTags);
    return stripTags(raw, { ...opts, keepTags: resolveKeepTags(opts) });
}

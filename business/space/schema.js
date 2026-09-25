import { quotedSpaceMessageForApi } from './quote.js';

export const SPACE_HISTORY_CAP = 20;

export function normalizeSpaceHistory(saved) {
    return Array.isArray(saved) ? saved.filter(item => item?.role && item?.content) : [];
}

export function appendSpaceUser(history, content, cap = SPACE_HISTORY_CAP) {
    const next = [...history, { role: 'user', content }];
    const overflow = Math.max(0, next.length - cap);
    return Object.freeze({ history: overflow ? next.slice(overflow) : next, trimmed: overflow > 0 });
}

export function appendSpaceAssistant(history, content) {
    return [...history, { role: 'assistant', content }];
}

const SPACE_WIDGET_RX = /<(schedule_widget|line_widget|almanac_widget|era_widget)([^>]*)>([\s\S]*?)<\/\1\s*>/gi;

export function extractWidgets(raw) {
    const widgets = [];
    const source = String(raw || '');
    const rx = new RegExp(SPACE_WIDGET_RX.source, SPACE_WIDGET_RX.flags);
    let match;
    while ((match = rx.exec(source)) !== null) {
        const edit = (match[2] || '').match(/\bedit\s*=\s*["']?\s*(\d+)/i);
        widgets.push(Object.freeze({
            kind: match[1].toLowerCase(),
            body: match[3].trim(),
            editIdx: edit ? parseInt(edit[1], 10) : null,
        }));
    }
    return Object.freeze({ text: source.replace(rx, '').trim(), widgets });
}

export function latestSpaceWidget(history) {
    if (!Array.isArray(history)) return null;
    for (let index = history.length - 1; index >= 0; index -= 1) {
        const message = history[index];
        if (message?.role !== 'assistant') continue;
        const widgets = extractWidgets(message.content).widgets.filter(widget => widget.body);
        if (!widgets.length) return null;
        const widget = widgets.at(-1);
        return Object.freeze({
            kind: widget.kind,
            body: widget.body,
            editIdx: widget.editIdx,
            historyIndex: index,
        });
    }
    return null;
}

export function stripWidgetsForApi(history) {
    return history.map(message => {
        if (message.role === 'user') {
            const next = quotedSpaceMessageForApi(message.content);
            return next === message.content ? message : { ...message, content: next };
        }
        if (message.role !== 'assistant') return message;
        const cleaned = String(message.content || '')
            .replace(/<schedule_widget[^>]*>[\s\S]*?<\/schedule_widget\s*>/gi, '【已输出一张点卡片（内容以当前面板为准）】')
            .replace(/<line_widget[^>]*>[\s\S]*?<\/line_widget\s*>/gi, '【已输出一张线卡片（内容以当前面板为准）】')
            .replace(/<almanac_widget[^>]*>[\s\S]*?<\/almanac_widget\s*>/gi, '【已输出一张历卡片（内容以当前面板为准）】')
            .replace(/<era_widget[^>]*>[\s\S]*?<\/era_widget\s*>/gi, '【已输出一张历法卡片（内容以当前面板为准）】');
        return cleaned === message.content ? message : { ...message, content: cleaned };
    });
}

export function spaceMessagePlainText(message) {
    if (!message) return '';
    const raw = String(message.content ?? '');
    if (message.role === 'user') return quotedSpaceMessageForApi(raw);
    return message.role === 'assistant' ? extractWidgets(raw).text : raw;
}

const SPACE_WIDGET_LABELS = Object.freeze({
    schedule_widget: '点卡片',
    line_widget: '线卡片',
    almanac_widget: '历卡片',
    era_widget: '历法卡片',
});

export function spaceWidgetLabel(kind) {
    return SPACE_WIDGET_LABELS[kind] || '结构化卡片';
}

export function spaceWidgetHandoff(widget, expectedKind = null, { parseAlmanac, parseEra } = {}) {
    if (!widget?.kind) {
        return Object.freeze({ ok: false, reason: 'missing', message: '这张建议不能交给灯：没有可用的结构化卡片。' });
    }
    if (expectedKind && widget.kind !== expectedKind) {
        return Object.freeze({
            ok: false,
            reason: 'wrong-kind',
            message: `这张建议不能交给灯：本轮要的是${spaceWidgetLabel(expectedKind)}，AI 给了${spaceWidgetLabel(widget.kind)}。`,
        });
    }
    const body = String(widget.body || '');
    if (widget.kind === 'almanac_widget') {
        let items = [];
        try { items = parseAlmanac?.(body) || []; } catch { items = []; }
        if (!items.length) return Object.freeze({ ok: false, reason: 'invalid', message: '这张建议不能交给灯：历卡片字段不完整或日期无效。' });
    }
    if (widget.kind === 'era_widget') {
        let desc = null;
        try { desc = parseEra?.(body) || null; } catch { desc = null; }
        if (!desc) return Object.freeze({ ok: false, reason: 'invalid', message: '这张建议不能交给灯：历法卡片字段不完整或格式无效。' });
    }
    if (widget.kind === 'schedule_widget' && !/Event\s*[:：]/i.test(body)) {
        return Object.freeze({ ok: false, reason: 'invalid', message: '这张建议不能交给灯：点卡片缺少 Event 字段。' });
    }
    if (widget.kind === 'line_widget' && !/Line\s*[:：]/i.test(body)) {
        return Object.freeze({ ok: false, reason: 'invalid', message: '这张建议不能交给灯：线卡片缺少 Line 字段。' });
    }
    return Object.freeze({ ok: true, reason: '', message: '' });
}

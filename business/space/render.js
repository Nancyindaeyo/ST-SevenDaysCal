import { extractWidgets, spaceWidgetHandoff, spaceWidgetLabel } from './schema.js';
import { parseQuotedSpaceMessage, quoteCardHtml } from './quote.js';
import { normalizeLine, parseLineRow } from '../lines/schema.js';

export function createSpaceRenderer(env = {}) {
    const escape = value => env.escapeHtml?.(String(value ?? '')) ?? String(value ?? '');
    const rows = body => String(body || '').split('\n').map(line => {
        let text = line.trim();
        if (/^[|｜].*[|｜]$/.test(text)) text = text.slice(1, -1).trim();
        return text.replace(/^[>#*\-\s]+/, '').replace(/\*+/g, '').trim();
    }).filter(Boolean);
    const invalidWidgetCard = (kind, body, message = '') => `<div class="sp-space-widget-card sp-space-widget-card-error" data-kind="error">
        <div class="sp-space-widget-head"><span class="sp-space-widget-badge"><i class="fa-solid fa-triangle-exclamation"></i> ${escape(spaceWidgetLabel(kind))}无法交给灯</span></div>
        <div class="sp-space-widget-body">
            <div class="sp-space-widget-desc">${escape(message || '这张建议不能交给灯：卡片字段不完整或格式无效。')}</div>
            ${String(body || '').trim() ? `<div class="sp-raw">${escape(body).replace(/\n/g, '<br>')}</div>` : ''}
        </div>
    </div>`;
    const widgetCard = (kind, body, wid, editIdx = null) => {
        if (kind === 'schedule_widget') {
            const line = rows(body).find(item => /^Event\s*[:：]/i.test(item)) || '';
            const [type, title, desc, time, location, ...dynamicParts] = line.replace(/^Event\s*[:：]\s*/i, '').split(/[|｜]/).map(item => item.trim());
            const dynamic = dynamicParts.join('｜');
            const types = { main: { label: '明线', color: '#d6b85a' }, hidden: { label: '暗线', color: '#a06fd6' }, bond: { label: '红线', color: '#d67f6f' } };
            const meta = types[type] || { label: type || '?', color: '#9aa6b2' };
            return `<div class="sp-space-widget-card" data-wid="${wid}" data-kind="schedule">
            <div class="sp-space-widget-head">
                <span class="sp-space-widget-badge" style="background:${meta.color}22;color:${meta.color};border-color:${meta.color}">
                    <i class="fa-regular fa-calendar"></i> ${editIdx != null ? `建议改点·第 ${editIdx} 条` : '建议加到点'}（${escape(meta.label)}）
                </span>
            </div>
            <div class="sp-space-widget-body">
                <div class="sp-space-widget-title">${escape(title || '(未命名)')}</div>
                ${desc ? `<div class="sp-space-widget-desc">${escape(desc)}</div>` : ''}
                <div class="sp-space-widget-meta">
                    ${time ? `<span><i class="fa-regular fa-clock"></i> ${escape(time)}</span>` : ''}
                    ${location ? `<span><i class="fa-solid fa-location-dot"></i> ${escape(location)}</span>` : ''}
                </div>
                ${dynamic ? `<div class="sp-space-widget-dynamic">🧵 ${escape(dynamic)}</div>` : ''}
            </div>
            <p class="sp-cfg-hint">只展示建议，不直接写账。要落地请交给灯。</p>
        </div>`;
        }
        if (kind === 'line_widget') {
            const bodyRows = rows(body);
            const lineRow = bodyRows.find(item => /^Line\s*[:：]/i.test(item)) || '';
            const descRow = bodyRows.find(item => /^Desc\s*[:：]/i.test(item)) || '';
            const nextRow = bodyRows.find(item => /^Next\s*[:：]/i.test(item)) || '';
            const { name, type: lineType, stage, when, agency, stall } = normalizeLine(parseLineRow(lineRow));
            const desc = descRow.replace(/^Desc\s*[:：]\s*/i, '').trim();
            const next = nextRow.replace(/^Next\s*[:：]\s*/i, '').trim();
            const stalled = stall === true;
            return `<div class="sp-space-widget-card" data-wid="${wid}" data-kind="line">
            <div class="sp-space-widget-head">
                <span class="sp-space-widget-badge sp-space-widget-badge-line">
                    <i class="fa-solid fa-diagram-project"></i> ${editIdx != null ? `建议改线·第 ${editIdx} 条` : '建议加到线'}
                </span>
            </div>
            <div class="sp-space-widget-body">
                <div class="sp-space-widget-title">${escape(name || '(未命名)')}</div>
                <div class="sp-space-widget-meta">
                    ${lineType ? `<span>${escape(lineType)}</span>` : ''}
                    ${stage ? `<span>${escape(stage)}${stalled ? ' · 停滞' : ''}</span>` : ''}
                    ${when ? `<span>${escape(when)}</span>` : ''}
                    ${agency ? `<span>${agency === 'player' ? '需推动' : '自演化'}</span>` : ''}
                </div>
                ${desc ? `<div class="sp-space-widget-desc">${escape(desc)}</div>` : ''}
                ${next ? `<div class="sp-space-widget-next">→ ${escape(next)}</div>` : ''}
            </div>
            <p class="sp-cfg-hint">只展示建议，不直接写账。要落地请交给灯。</p>
        </div>`;
        }
        if (kind === 'almanac_widget') {
            const items = env.parseAlmanac?.(body) || [];
            if (!items.length) return '';
            const calendar = env.loadCalendar?.();
            const labels = { festival: '节日', birthday: '生日', anniversary: '纪念日', custom: '自定义' };
            return items.map((item, index) => {
                const date = item.displayDate || `${env.calendarMonthName?.(calendar, item.month) ?? item.month}${item.day}日`;
                return `<div class="sp-space-widget-card" data-wid="${wid}" data-kind="almanac">
                <div class="sp-space-widget-head">
                    <span class="sp-space-widget-badge sp-space-widget-badge-almanac">
                        <i class="fa-regular fa-calendar-check"></i> 建议加到历
                    </span>
                </div>
                <div class="sp-space-widget-body">
                    <div class="sp-space-widget-almrow">
                        <span class="sp-space-widget-almdate">${escape(date)}</span>
                        <span class="sp-space-widget-almname">${escape(item.name)}</span>
                        <span class="sp-space-widget-almtype">${escape(labels[item.type] || '自定义')}</span>
                    </div>
                </div>
            </div>
            <p class="sp-cfg-hint">只展示建议，不直接写账。要落地请交给灯。</p>
            </div>`;
            }).join('');
        }
        if (kind === 'era_widget') {
            const desc = env.parseEra?.(body);
            if (!desc) return '';
            const months = desc.months.map(month => `<span class="sp-space-widget-eramonth">${escape(month.name)}·${month.days}天</span>`).join('');
            return `<div class="sp-space-widget-card" data-wid="${wid}" data-kind="era">
            <div class="sp-space-widget-head">
                <span class="sp-space-widget-badge sp-space-widget-badge-era">
                    <i class="fa-regular fa-calendar-days"></i> 建议应用历法
                </span>
            </div>
            <div class="sp-space-widget-body">
                <div class="sp-space-widget-title">${escape(desc.era || '自定义历法')}</div>
                <div class="sp-space-widget-desc">一年 ${env.calendarMonthCount?.(desc)} 个月、共 ${env.calendarYearLength?.(desc)} 天</div>
                <div class="sp-space-widget-eramonths">${months}</div>
            </div>
            <p class="sp-cfg-hint">只展示建议，不直接写账。要落地请交给灯。</p>
        </div>`;
        }
        return '';
    };

    const message = (role, content, historyIndex, registerWidget, expectedKind = null) => {
        const cls = role === 'user' ? 'sp-chat-msg-user' : role === 'ai' ? 'sp-chat-msg-ai' : 'sp-chat-msg-system';
        const wrapClass = role === 'user' ? 'sp-chat-msg-wrap-user' : role === 'ai' ? 'sp-chat-msg-wrap-ai' : 'sp-chat-msg-wrap-system';
        const canAct = role !== 'system' && Number.isInteger(historyIndex);
        let contentHtml;
        let widgetCards = '';
        let canHandoff = false;
        if (role === 'ai') {
            const parsed = extractWidgets(content);
            contentHtml = parsed.text ? env.formatAi?.(parsed.text) ?? escape(parsed.text).replace(/\n/g, '<br>') : '';
            widgetCards = parsed.widgets.map(widget => {
                const decision = spaceWidgetHandoff(widget, expectedKind, { parseAlmanac: env.parseAlmanac, parseEra: env.parseEra });
                const wid = registerWidget?.(widget, decision.ok);
                if (decision.ok) {
                    canHandoff = true;
                    return widgetCard(widget.kind, widget.body, wid, widget.editIdx);
                }
                return invalidWidgetCard(widget.kind, widget.body, decision.message);
            }).join('');
        } else {
            const quoted = parseQuotedSpaceMessage(content);
            if (quoted) {
                const typed = quoted.typed ? escape(quoted.typed).replace(/\n/g, '<br>') : '';
                contentHtml = `${quoteCardHtml(quoted, escape)}${typed ? `<div class="sp-space-quote-follow">${typed}</div>` : ''}`;
            } else {
                contentHtml = escape(content).replace(/\n/g, '<br>');
            }
        }
        const edit = role === 'user' ? '<button class="sp-chat-msg-edit" title="编辑"><i class="fa-solid fa-pen"></i></button>' : '';
        const actions = canAct
            ? `<div class="sp-chat-msg-actions">${edit}<button class="sp-chat-msg-copy" title="复制"><i class="fa-solid fa-copy"></i></button><button class="sp-chat-msg-delete" title="删除"><i class="fa-solid fa-trash"></i></button>${canHandoff ? '<button class="sp-space-to-lamp" title="交给灯">交给灯</button>' : ''}${widgetCards ? '<button class="sp-space-clarify" title="回间写清">回间写清</button>' : ''}</div>`
            : '';
        return Object.freeze({ cls, wrapClass, canAct, canHandoff, contentHtml, widgetCards, actions });
    };
    return Object.freeze({ widgetCard, message });
}

import { actionLabel, moduleLabel, sourceLabel } from './schema.js';

function escape(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function timeLabel(ts) {
    const date = new Date(Number(ts) || Date.now());
    const pad = n => String(n).padStart(2, '0');
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function activityOverlayHtml() {
    return `<div id="sp-activity-overlay" class="sp-settings-overlay" style="display:none">
        <div class="sp-settings-header">
            <span class="sp-settings-title"><i class="fa-solid fa-clock-rotate-left"></i> 最近改动</span>
            <button type="button" class="sp-icon-btn sp-activity-close-btn" title="关闭"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="sp-settings-body" id="sp-activity-body"></div>
    </div>`;
}

export function activityButtonHtml() {
    return `<button type="button" class="sp-side-tab sp-activity-btn" aria-label="最近改动">
        <span class="sp-tab-glyph" aria-hidden="true">改</span>
        <span class="sp-activity-badge" hidden></span>
    </button>`;
}

export function renderActivityList(entries = []) {
    if (!entries.length) {
        return `<div class="sp-empty sp-activity-empty"><p>这轮聊天还没有后台改账。</p><p class="sp-cfg-hint">自动对齐、线推进、面判定、间引导和手动刷新成功后会记在这里，方便反悔。</p></div>`;
    }
    return `<ol class="sp-activity-list">${entries.map(entry => {
        const items = (entry.items || []).map(item => {
            const who = [moduleLabel(item.module), item.title].filter(Boolean).join(' · ');
            return `<li><span>${escape(who)}</span><em>${escape(actionLabel(item.action))}</em></li>`;
        }).join('');
        const undo = entry.undone
            ? '<span class="sp-activity-undone">已撤回</span>'
            : entry.snapshot
                ? `<button type="button" class="sp-btn sp-activity-undo" data-id="${escape(entry.id)}">撤回</button>`
                : '';
        return `<li class="sp-activity-card${entry.undone ? ' is-undone' : ''}" data-id="${escape(entry.id)}">
            <div class="sp-activity-card-head">
                <b>${escape(sourceLabel(entry.source))}</b>
                <time>${escape(timeLabel(entry.ts))}</time>
                ${undo}
            </div>
            ${items ? `<ul class="sp-activity-items">${items}</ul>` : '<p class="sp-cfg-hint">没有条目变化</p>'}
        </li>`;
    }).join('')}</ol>`;
}

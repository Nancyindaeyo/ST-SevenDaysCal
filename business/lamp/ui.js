import { escapeHtml } from '../../utils/dom.js';

function emptyRow(text) {
    return `<div class="sp-lamp-empty">${escapeHtml(text)}</div>`;
}

function row(item) {
    const quote = item.quote ? `<span class="sp-lamp-quote">柏宝书：${escapeHtml(item.quote)}</span>` : '';
    return `<button type="button" class="sp-lamp-row" data-jump-mod="${escapeHtml(item.module)}" data-jump-key="${escapeHtml(item.title)}" data-jump-ref="${escapeHtml(item.ref || '')}"><span class="sp-lamp-row-title">${escapeHtml(item.title)}</span><span class="sp-lamp-row-detail">${escapeHtml(item.detail)}</span>${quote}</button>`;
}

export function renderLampHtml({ conflicts = [], hasBaiBai = false } = {}) {
    const hint = hasBaiBai
        ? '<p class="sp-cfg-hint sp-lamp-hint">只提示，不改任何一侧。点构画那一条；柏宝书只给对照原文。</p>'
        : '<p class="sp-cfg-hint sp-lamp-hint">只提示构画自己的点 / 刻度 / 线。装着柏宝书后再加地点、伤情和未核销计划对照。</p>';
    const body = conflicts.length
        ? conflicts.map(row).join('')
        : emptyRow(hasBaiBai ? '没有看出打架的账' : '没有看出打架的账');
    return `<div class="sp-lamp-body">${hint}<section class="sp-lamp-section"><h2 class="sp-lamp-h">对上的账</h2>${body}</section></div>`;
}

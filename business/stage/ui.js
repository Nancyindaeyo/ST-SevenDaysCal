import { escapeHtml } from '../../utils/dom.js';
import { festivalWhenLabel, ledgerWhenLabel } from './snapshot.js';

function emptyRow(text) {
    return `<div class="sp-stage-empty">${escapeHtml(text)}</div>`;
}

function section(title, body) {
    return `<section class="sp-stage-section"><h2 class="sp-stage-h">${escapeHtml(title)}</h2>${body}</section>`;
}

function row({ module, title, meta, ref = '' }) {
    return `<button type="button" class="sp-stage-row" data-jump-mod="${escapeHtml(module)}" data-jump-key="${escapeHtml(title)}" data-jump-ref="${escapeHtml(ref)}"><span class="sp-stage-row-title">${escapeHtml(title)}</span><span class="sp-stage-row-meta">${escapeHtml(meta)}</span></button>`;
}

export function renderStageHtml(snapshot = {}) {
    const today = snapshot.todayLabel ? `<p class="sp-cfg-hint sp-stage-today">故事今天 ${escapeHtml(snapshot.todayLabel)}</p>` : '<p class="sp-cfg-hint sp-stage-today">还没有可靠的今天。时间戳缺了就先不猜。</p>';
    const pointBody = snapshot.point?.events?.length
        ? snapshot.point.events.map(event => row({
            module: 'point',
            title: event.title,
            meta: [event.time, event.location].filter(Boolean).join(' · '),
        })).join('')
        : emptyRow('今天的点还是空的');
    const festivalBody = snapshot.festivals?.length
        ? snapshot.festivals.map(item => row({
            module: 'almanac',
            title: item.name,
            meta: festivalWhenLabel(item.days),
        })).join('')
        : emptyRow('近七天没有节日或纪念日');
    const ledgerBody = snapshot.ledger?.length
        ? snapshot.ledger.map(entry => row({
            module: 'ledger',
            title: entry.title,
            ref: entry.id,
            meta: ledgerWhenLabel(entry),
        })).join('')
        : emptyRow('没有即将到期或还在持续的刻度');
    const lineBody = snapshot.lines?.length
        ? snapshot.lines.map(line => row({
            module: 'lines',
            title: line.name,
            meta: [line.when, line.stage].filter(Boolean).join(' · '),
        })).join('')
        : emptyRow('没有时机写近日的线');
    return `<div class="sp-stage-body">${today}${section('今天的点', pointBody)}${section('将至节日', festivalBody)}${section('到期刻度', ledgerBody)}${section('近日的线', lineBody)}</div>`;
}

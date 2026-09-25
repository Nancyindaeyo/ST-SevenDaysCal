import { escapeHtml } from '../../utils/dom.js';

const MODULE_LABEL = Object.freeze({
    point: '点',
    lines: '线',
    outline: '面',
    almanac: '轴',
    dashed: '冷知识',
    ledger: '刻度',
});

function emptyRow(text) {
    return `<div class="sp-lamp-empty">${escapeHtml(text)}</div>`;
}

function keyOf(item = {}) {
    return `${item.module || ''}|${item.ref || ''}|${item.title || ''}`;
}

function checkedAttr(item, checked) {
    return checked.has(keyOf(item)) ? ' checked' : '';
}

function editFields(item = {}) {
    const fields = item.fields || {};
    if (item.module === 'point') {
        return [
            ['title', '标题', item.title],
            ['time', '时间', fields.time || ''],
            ['location', '地点', fields.location || ''],
            ['desc', '描述', fields.desc || item.snippet || ''],
        ];
    }
    if (item.module === 'lines') {
        return [
            ['title', '名称', item.title],
            ['when', '时机', fields.when || ''],
            ['desc', '描述', fields.desc || item.snippet || ''],
            ['next', '下一步', fields.next || ''],
        ];
    }
    if (item.module === 'ledger') {
        return [
            ['title', '事由', item.title],
            ['现状', '现状', fields.现状 || item.snippet || ''],
        ];
    }
    if (item.module === 'almanac') {
        return [
            ['title', '名称', item.title],
            ['note', '说明', fields.note || item.snippet || ''],
        ];
    }
    if (item.module === 'dashed') {
        return [
            ['title', '标题', item.title],
            ['text', '正文', fields.text || item.snippet || ''],
        ];
    }
    return [
        ['title', '标题', item.title],
        ['scene', '场景', fields.scene || item.snippet || ''],
    ];
}

function editForm(item) {
    const rows = editFields(item).map(([name, label, value]) => (
        `<label class="sp-refresh-field"><span>${escapeHtml(label)}</span><textarea class="sp-input sp-lamp-edit-field" data-field="${escapeHtml(name)}" rows="${name === 'title' || name === 'when' || name === 'time' ? 1 : 2}">${escapeHtml(value)}</textarea></label>`
    )).join('');
    return `<form class="sp-lamp-edit" data-edit-key="${escapeHtml(keyOf(item))}">${rows}<div class="sp-lamp-row-tools"><button type="submit" class="sp-btn sp-btn-primary">保存</button><button type="button" class="sp-btn sp-lamp-edit-cancel">取消</button></div></form>`;
}

function quotePrefixOf(item) {
    if (item.source === 'story') return '正文：';
    if (item.id && String(item.id).startsWith('bbb')) return '柏宝书：';
    if (/柏宝书/.test(item.detail || '')) return '柏宝书：';
    return '';
}

function row(item, { checked, editing, dismissable = false }) {
    const pair = item.againstTitle
        ? `<span class="sp-lamp-pair">${escapeHtml((MODULE_LABEL[item.againstModule] || item.againstModule || '对照') + ' · ' + item.againstTitle)}</span>`
        : '';
    const label = MODULE_LABEL[item.module] || item.module;
    const isEdit = editing && keyOf(editing) === keyOf(item);
    const extraClass = item.source === 'story' ? ' is-stale' : (item.source === 'preview' ? ' is-preview' : '');
    const quoteHtml = item.quote ? `<span class="sp-lamp-quote">${quotePrefixOf(item)}${escapeHtml(item.quote)}</span>` : '';
    return `<div class="sp-lamp-row${extraClass}" data-jump-mod="${escapeHtml(item.module)}" data-jump-key="${escapeHtml(item.title)}" data-jump-ref="${escapeHtml(item.ref || '')}" data-row-key="${escapeHtml(keyOf(item))}" data-pair-id="${escapeHtml(item.pairId || item.id || '')}">
        <label class="sp-mode-opt"><input type="checkbox" class="sp-lamp-check" data-row-key="${escapeHtml(keyOf(item))}"${checkedAttr(item, checked)}><span class="sp-lamp-row-title">${escapeHtml(label)} · ${escapeHtml(item.title)}</span></label>
        <span class="sp-lamp-row-detail">${escapeHtml(item.detail || item.snippet || '')}</span>${pair}${quoteHtml}
        <div class="sp-lamp-row-tools">
            <button type="button" class="sp-mini-btn sp-lamp-jump">去账本</button>
            <button type="button" class="sp-mini-btn sp-lamp-edit-open">改这条</button>
            ${dismissable ? '<button type="button" class="sp-mini-btn sp-lamp-dismiss">我知道</button>' : ''}
        </div>
        ${isEdit ? editForm(item) : ''}
    </div>`;
}

function tabs(page) {
    const tab = (id, label) => {
        const on = page === id;
        return `<button type="button" class="sp-lamp-tab${on ? ' is-on' : ''}" id="sp-lamp-tab-${id}" data-lamp-page="${id}" role="tab" aria-selected="${on ? 'true' : 'false'}" aria-controls="sp-lamp-page-${id}" tabindex="${on ? '0' : '-1'}">${label}</button>`;
    };
    return `<div class="sp-lamp-tabs" role="tablist" aria-label="对账灯子页">
        ${tab('fight', '冲突')}
        ${tab('search', '搜索')}
    </div>`;
}

function basketHtml(items = []) {
    if (!items.length) return emptyRow('待改篮是空的。勾冲突或搜索结果再进来。');
    return `<div class="sp-lamp-basket">${items.map(item => `<span class="sp-pace-chip">${escapeHtml((MODULE_LABEL[item.module] || item.module) + ' · ' + item.title)}</span>`).join('')}</div>`;
}

function kindRow(kind) {
    const on = name => kind === name ? ' checked' : '';
    return `<div class="sp-lamp-kind-row">
        <span class="sp-refresh-bar-label">这次跑法</span>
        <label class="sp-mode-opt"><input type="radio" name="sp-lamp-kind" value="fight"${on('fight')}><span>打架</span></label>
        <label class="sp-mode-opt"><input type="radio" name="sp-lamp-kind" value="align"${on('align')}><span>对齐</span></label>
        <label class="sp-mode-opt"><input type="radio" name="sp-lamp-kind" value="regen"${on('regen')}><span>重做</span></label>
    </div>`;
}

function chaseRow(busy = false) {
    const off = busy ? ' disabled' : '';
    return `<div class="sp-lamp-chase">
        <button type="button" class="sp-btn" id="sp-lamp-check-story"${off}>对照最新楼</button>
        <button type="button" class="sp-btn" id="sp-lamp-preview-align"${off}>先看再写</button>
        <button type="button" class="sp-btn" id="sp-lamp-preview-window"${off}>追从上次对齐到现在</button>
        <button type="button" class="sp-btn" id="sp-lamp-preview-fight"${off}>先看打架</button>
    </div>`;
}

function previewBlock(preview) {
    if (!preview) return '';
    const note = preview.note ? `<p class="sp-cfg-hint sp-lamp-hint">${escapeHtml(preview.note)}</p>` : '';
    const route = preview.route
        ? `<p class="sp-cfg-hint sp-lamp-hint">API ${escapeHtml(preview.route.api)} · ${escapeHtml((preview.route.selected || []).join('/') || 'point/lines')} · token ${escapeHtml(preview.route.tokenTier)}</p>`
        : '';
    const locks = preview.skippedLocks?.length
        ? `<p class="sp-cfg-hint sp-lamp-hint">锁定未改：${escapeHtml(preview.skippedLocks.map(item => item.title || item.name || item).join('、'))}</p>`
        : '';
    const empty = !preview.items?.length
        ? emptyRow('对照过了，点和线都不用改。')
        : preview.items.map(item => `<span class="sp-pace-chip">${escapeHtml((MODULE_LABEL[item.module] || item.module) + ' · ' + item.title + ' · ' + (item.detail || item.action || ''))}</span>`).join('');
    const applyLabel = preview.kind === 'fight' ? '写入这次打架' : '写入这次对齐';
    return `<section class="sp-lamp-section"><h2 class="sp-lamp-h">拟改清单</h2>${note}${route}${locks}<div class="sp-lamp-basket">${empty}</div>
        <div class="sp-lamp-actions">
            <button type="button" class="sp-btn sp-btn-primary" id="sp-lamp-apply-preview"${preview.items?.length ? '' : ' disabled'}>${applyLabel}</button>
            <button type="button" class="sp-btn" id="sp-lamp-drop-preview">丢掉预览</button>
        </div>
    </section>`;
}

export function renderLampHtml({
    page = 'fight',
    conflicts = [],
    hits = [],
    stale = [],
    query = '',
    checked = new Set(),
    basket = [],
    intent = null,
    kind = '',
    editing = null,
    hasBaiBai = false,
    age = null,
    preview = null,
    busy = false,
    storyChecked = false,
} = {}) {
    const ageHtml = page === 'search' || !age?.copy ? '' : `<p class="sp-cfg-hint sp-lamp-age">${escapeHtml(age.copy)}</p>`;
    const hint = page === 'search'
        ? '<p class="sp-cfg-hint sp-lamp-hint">本地查找点 / 线 / 面 / 轴 / 冷知识 / 刻度。相关不等于打架；勾上再进待改篮。</p>'
        : (hasBaiBai
            ? '<p class="sp-cfg-hint sp-lamp-hint">只提示打架，不改柏宝书。一天多个地点不是打架。正文过期请对照最新楼或先看再写。</p>'
            : '<p class="sp-cfg-hint sp-lamp-hint">只提示构画自己的点 / 刻度 / 线。装着柏宝书后再加地点、伤情和未核销计划对照。正文过期请对照最新楼。</p>');
    const list = page === 'search' ? hits : conflicts;
    const body = list.length
        ? list.map(item => row(item, { checked, editing, dismissable: page !== 'search' }))
            .join('')
        : emptyRow(page === 'search' ? (query ? '没有找到' : '输入关键词再找') : '账本之间没检出那几类打架。正文有没有跑偏，用上面的「对照最新楼」。');
    const staleBody = page === 'search'
        ? ''
        : (stale.length
            ? `<section class="sp-lamp-section"><h2 class="sp-lamp-h">对照最新楼</h2>${stale.map(item => row(item, { checked, editing })).join('')}</section>`
            : (storyChecked ? `<section class="sp-lamp-section"><h2 class="sp-lamp-h">对照最新楼</h2>${emptyRow('最新楼没有看出点/线过期。')}</section>` : ''));
    const search = page === 'search'
        ? `<div class="sp-lamp-search-row"><input id="sp-lamp-query" class="sp-input" type="search" placeholder="伤、赴约、地点…" value="${escapeHtml(query)}"><button type="button" class="sp-btn" id="sp-lamp-search">查找</button></div>`
        : '';
    const intentBlock = intent?.text
        ? `<section class="sp-lamp-section"><h2 class="sp-lamp-h">间给灯的意图</h2><pre class="sp-lamp-intent">${escapeHtml(intent.text)}</pre></section>`
        : '';
    const needKind = !kind && basket.length && page !== 'unused';
    const chase = page === 'search' ? '' : chaseRow(busy);
    return `<div class="sp-lamp-body">${tabs(page)}<div class="sp-lamp-page" id="sp-lamp-page-${page}" role="tabpanel" aria-labelledby="sp-lamp-tab-${page}">${ageHtml}${hint}${chase}${search}${intentBlock}${previewBlock(preview)}
        ${staleBody}
        <section class="sp-lamp-section"><h2 class="sp-lamp-h">${page === 'search' ? '查找结果' : '对上的账'}</h2>${body}</section>
        <section class="sp-lamp-section"><h2 class="sp-lamp-h">待改篮</h2>${basketHtml(basket)}${needKind ? kindRow(kind) : (kind ? kindRow(kind) : '')}
            <div class="sp-lamp-actions">
                <button type="button" class="sp-btn" id="sp-lamp-basket-add">勾选进篮</button>
                <button type="button" class="sp-btn" id="sp-lamp-to-space">拿到间</button>
                <button type="button" class="sp-btn" id="sp-lamp-ask-space">直接问</button>
                <button type="button" class="sp-btn" id="sp-lamp-clarify">回间写清</button>
                <button type="button" class="sp-btn sp-btn-primary" id="sp-lamp-fight">按打架一起改</button>
            </div>
        </section>
    </div></div>`;
}

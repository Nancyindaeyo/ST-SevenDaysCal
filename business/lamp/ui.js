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

function row(item, { checked, editing }) {
    const quote = item.quote ? `<span class="sp-lamp-quote">柏宝书：${escapeHtml(item.quote)}</span>` : '';
    const label = MODULE_LABEL[item.module] || item.module;
    const isEdit = editing && keyOf(editing) === keyOf(item);
    return `<div class="sp-lamp-row" data-jump-mod="${escapeHtml(item.module)}" data-jump-key="${escapeHtml(item.title)}" data-jump-ref="${escapeHtml(item.ref || '')}" data-row-key="${escapeHtml(keyOf(item))}">
        <label class="sp-mode-opt"><input type="checkbox" class="sp-lamp-check" data-row-key="${escapeHtml(keyOf(item))}"${checkedAttr(item, checked)}><span class="sp-lamp-row-title">${escapeHtml(label)} · ${escapeHtml(item.title)}</span></label>
        <span class="sp-lamp-row-detail">${escapeHtml(item.detail || item.snippet || '')}</span>${quote}
        <div class="sp-lamp-row-tools">
            <button type="button" class="sp-mini-btn sp-lamp-jump">去账本</button>
            <button type="button" class="sp-mini-btn sp-lamp-edit-open">改这条</button>
        </div>
        ${isEdit ? editForm(item) : ''}
    </div>`;
}

function tabs(page) {
    return `<div class="sp-lamp-tabs" role="tablist" aria-label="对账灯子页">
        <button type="button" class="sp-lamp-tab${page === 'fight' ? ' is-on' : ''}" data-lamp-page="fight">冲突</button>
        <button type="button" class="sp-lamp-tab${page === 'search' ? ' is-on' : ''}" data-lamp-page="search">搜索</button>
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

export function renderLampHtml({
    page = 'fight',
    conflicts = [],
    hits = [],
    query = '',
    checked = new Set(),
    basket = [],
    intent = null,
    kind = '',
    editing = null,
    hasBaiBai = false,
} = {}) {
    const hint = page === 'search'
        ? '<p class="sp-cfg-hint sp-lamp-hint">本地查找点 / 线 / 面 / 轴 / 冷知识 / 刻度。相关不等于打架；勾上再进待改篮。</p>'
        : (hasBaiBai
            ? '<p class="sp-cfg-hint sp-lamp-hint">只提示打架，不改柏宝书。一天多个地点不是打架。勾上进待改篮，交给灯跑。</p>'
            : '<p class="sp-cfg-hint sp-lamp-hint">只提示构画自己的点 / 刻度 / 线。装着柏宝书后再加地点、伤情和未核销计划对照。</p>');
    const list = page === 'search' ? hits : conflicts;
    const body = list.length
        ? list.map(item => row(item, { checked, editing })).join('')
        : emptyRow(page === 'search' ? (query ? '没有找到' : '输入关键词再找') : '没有看出打架的账');
    const search = page === 'search'
        ? `<div class="sp-lamp-search-row"><input id="sp-lamp-query" class="sp-input" type="search" placeholder="伤、赴约、地点…" value="${escapeHtml(query)}"><button type="button" class="sp-btn" id="sp-lamp-search">查找</button></div>`
        : '';
    const intentBlock = intent?.text
        ? `<section class="sp-lamp-section"><h2 class="sp-lamp-h">间给灯的意图</h2><pre class="sp-lamp-intent">${escapeHtml(intent.text)}</pre></section>`
        : '';
    const needKind = !kind && basket.length && page !== 'unused';
    return `<div class="sp-lamp-body">${tabs(page)}${hint}${search}${intentBlock}
        <section class="sp-lamp-section"><h2 class="sp-lamp-h">${page === 'search' ? '查找结果' : '对上的账'}</h2>${body}</section>
        <section class="sp-lamp-section"><h2 class="sp-lamp-h">待改篮</h2>${basketHtml(basket)}${needKind ? kindRow(kind) : (kind ? kindRow(kind) : '')}
            <div class="sp-refresh-bar-actions">
                <button type="button" class="sp-btn" id="sp-lamp-basket-add">勾选进篮</button>
                <button type="button" class="sp-btn" id="sp-lamp-to-space">拿到间</button>
                <button type="button" class="sp-btn" id="sp-lamp-ask-space">直接问</button>
                <button type="button" class="sp-btn" id="sp-lamp-clarify">回间写清</button>
                <button type="button" class="sp-btn sp-btn-primary" id="sp-lamp-fight">按打架一起改</button>
            </div>
        </section>
    </div>`;
}

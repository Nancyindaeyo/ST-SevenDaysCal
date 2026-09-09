import { escapeHtml } from '../utils/dom.js';
import { worldInfoSelectionAllows } from './world-info-selection.js';
import { bookNameExcluded, normalizeWorldNameList } from './world-info-context.js';

export const WI_SCOPE_ORDER = Object.freeze(['char', 'chat', 'persona', 'global']);
export const WI_SCOPE_LABELS = Object.freeze({
    char: '角色卡世界书',
    chat: '当前聊天世界书',
    persona: '用户世界书',
    global: '全局世界书',
});

export function worldInfoPanelIdentity(ctx, characterKey) {
    return JSON.stringify({
        chatId: String(ctx?.chatId ?? ''),
        characterId: String(ctx?.characterId ?? ''),
        characterKey: characterKey ?? null,
    });
}

export function snapshotWiGroupOpenState(groups = []) {
    const prevSources = new Set();
    const openSources = new Set();
    for (const group of groups) {
        const source = String(group?.source || '');
        prevSources.add(source);
        if (group?.open) openSources.add(source);
    }
    return { prevSources, openSources, hadGroups: prevSources.size > 0 };
}

export function groupShouldOpen(source, { hadGroups, openSources, prevSources } = {}) {
    return !hadGroups || openSources?.has(source) || !prevSources?.has(source);
}

export function checkboxTriState(checkedCount, total) {
    return {
        checked: total > 0 && checkedCount === total,
        indeterminate: checkedCount > 0 && checkedCount < total,
    };
}

export function groupWorldInfoEntries(entries = []) {
    const scopes = new Map(WI_SCOPE_ORDER.map(scope => [scope, new Map()]));
    for (const entry of entries) {
        const scopeGroup = scopes.get(entry.scope) || scopes.get('char');
        if (!scopeGroup.has(entry.source)) scopeGroup.set(entry.source, []);
        scopeGroup.get(entry.source).push(entry);
    }
    return scopes;
}

export function excludeCountText(excludedN, totalN) {
    return excludedN > 0 ? `已排除 ${excludedN} / 共 ${totalN}` : `共 ${totalN}`;
}

export function matchesExcludeSearch(name, keyword) {
    const kw = String(keyword || '').trim().toLowerCase();
    if (!kw) return true;
    return String(name || '').toLowerCase().includes(kw);
}

export function nearestScrollParent(el) {
    let p = el && el.parentElement;
    while (p) {
        const oy = getComputedStyle(p).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
        p = p.parentElement;
    }
    return null;
}

// jQuery .data() JSON-coerces "0123" / "true"; world-book names and keys must stay strings.
export function readDatasetValue($node, name) {
    return String($node?.attr?.(`data-${name}`) ?? '');
}

function buildWiListHtml(entries, selection, openState, escapeAttr) {
    const scopes = groupWorldInfoEntries(entries);
    const parts = [];
    if (entries.length) {
        parts.push(`<div class="sp-wi-all-row">
            <label class="sp-wi-toggle-all">
                <input type="checkbox" id="sp-wi-select-all"> 全选 / 全不选
            </label>
            <span class="sp-wi-count">${entries.length} 条</span>
        </div>`);
    } else {
        parts.push('<span class="sp-cfg-hint">当前角色没有关联 / 全局启用的世界书。</span>');
    }
    for (const [scope, groups] of scopes) {
        if (!groups.size) continue;
        const scopeCount = [...groups.values()].reduce((n, g) => n + g.length, 0);
        parts.push(`<div class="sp-wi-scope">
            <div class="sp-wi-scope-label">${escapeHtml(WI_SCOPE_LABELS[scope])} <span class="sp-wi-scope-count">${scopeCount} 条</span></div>`);
        for (const [source, group] of groups) {
            const groupChecked = group.filter(e => worldInfoSelectionAllows(selection, e.key)).length;
            const groupState = checkboxTriState(groupChecked, group.length);
            const escSrc = escapeAttr(source);
            const groupOpen = groupShouldOpen(source, openState);
            parts.push(`<details class="sp-wi-group" data-source="${escSrc}"${groupOpen ? ' open' : ''}>
                <summary class="sp-wi-source-label">
                    <input type="checkbox" class="sp-wi-group-cb" data-source="${escSrc}"${groupState.checked ? ' checked' : ''}${groupState.indeterminate ? ' data-indeterminate="true"' : ''}>
                    <span class="sp-wi-source-name">${escapeHtml(source)}</span>
                    <span class="sp-wi-group-count">${group.length} 条</span>
                </summary>
                <div class="sp-wi-items">`);
            for (const e of group) {
                const checked = worldInfoSelectionAllows(selection, e.key);
                parts.push(`<div class="sp-wi-card${checked ? '' : ' sp-wi-card-off'}" data-key="${escapeAttr(e.key)}" data-source="${escSrc}" role="button" tabindex="0">
                    <div class="sp-wi-card-head">
                        <input type="checkbox" class="sp-wi-cb" data-key="${escapeAttr(e.key)}"${checked ? ' checked' : ''}>
                        <span class="sp-wi-label">${escapeHtml(e.label)}</span>
                    </div>
                    <div class="sp-wi-card-body">
                        <div class="sp-wi-preview">${e.preview ? escapeHtml(e.preview) + '…' : '<span class="sp-wi-empty">（无内容）</span>'}</div>
                        <button class="sp-wi-view-btn" type="button" title="查看全文" data-key="${escapeAttr(e.key)}"><i class="fa-regular fa-eye"></i></button>
                    </div>
                </div>`);
            }
            parts.push(`</div></details>`);
        }
        parts.push(`</div>`);
    }
    return parts.join('');
}

export function syncWiSelectAll(env = {}) {
    const $in = env.$in;
    const $inAll = env.$inAll;
    const $cbs = $inAll('#sp-wi-list .sp-wi-cb');
    if (!$cbs.length) return;
    const total = $cbs.length;
    const checked = $cbs.filter(':checked').length;
    const allState = checkboxTriState(checked, total);
    const $all = $in('#sp-wi-select-all')[0];
    if ($all) {
        $all.checked = allState.checked;
        $all.indeterminate = allState.indeterminate;
    }
    $inAll('#sp-wi-list .sp-wi-group').each(function () {
        const $g = env.$(this);
        const $groupCb = $g.find('.sp-wi-group-cb')[0];
        if (!$groupCb) return;
        const gCbs = $g.find('.sp-wi-cb');
        const groupState = checkboxTriState(gCbs.filter(':checked').length, gCbs.length);
        $groupCb.checked = groupState.checked;
        $groupCb.indeterminate = groupState.indeterminate;
    });
}

export function filterWiExcludeRows(env = {}, keyword) {
    const $rows = env.$inAll('#sp-wi-exclude-list .sp-wi-exclude-row');
    $rows.each(function () {
        this.style.display = matchesExcludeSearch(this.getAttribute('data-name'), keyword) ? '' : 'none';
    });
}

export function paintWiExcludeCount(env = {}, excludedN, totalN) {
    const $c = env.$in('#sp-wi-exclude-count');
    if (!$c.length) return;
    $c.text(excludeCountText(excludedN, totalN)).toggleClass('sp-wi-exclude-count-active', excludedN > 0);
}

export function paintWiEntryFull(env = {}, entry) {
    const $in = env.$in;
    const $ = env.$;
    $in('#sp-wi-fullview').remove();
    const $overlay = $(`<div id="sp-wi-fullview" class="sp-wi-fullview">
        <div class="sp-wi-fullview-sheet">
            <div class="sp-wi-fullview-head">
                <div class="sp-wi-fullview-title">
                    <div class="sp-wi-fullview-source">${escapeHtml(entry.source)}</div>
                    <div class="sp-wi-fullview-label">${escapeHtml(entry.label)}</div>
                </div>
                <button class="sp-icon-btn sp-wi-fullview-close" title="关闭"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="sp-wi-fullview-body">${escapeHtml(entry.content || '').replace(/\n/g, '<br>')}</div>
        </div>
    </div>`);
    $overlay.on('click', function (e) {
        if (e.target === this) $overlay.remove();
    });
    $overlay.find('.sp-wi-fullview-close').on('click', () => $overlay.remove());
    $in('.sp-sheet').append($overlay);
}

function readVisibleWiSelection($list, $) {
    const visible = [];
    $list.find('.sp-wi-cb').each(function () {
        visible.push({ key: readDatasetValue($(this), 'key'), checked: this.checked });
    });
    return visible;
}

export async function paintWiList(env = {}) {
    const $ = env.$;
    const $list = env.$in('#sp-wi-list');
    if (!$list.length) return;
    const state = env.state;
    const revision = ++state.listRevision;
    const identity = env.identity?.();
    const isCurrent = () => revision === state.listRevision && identity === env.identity?.();
    const groups = [];
    $list.find('.sp-wi-group').each(function () {
        groups.push({ source: String(this.getAttribute('data-source') || ''), open: this.open });
    });
    const openState = snapshotWiGroupOpenState(groups);
    const scrollEl = nearestScrollParent($list[0]);
    const savedScroll = scrollEl ? scrollEl.scrollTop : 0;
    $list.html('<span class="sp-cfg-hint">正在加载世界书条目…</span>');
    let entries;
    try {
        entries = await env.loadEntries?.();
    } catch (err) {
        if (!isCurrent()) return;
        $list.html(`<span class="sp-cfg-hint">加载失败：${escapeHtml(env.diagnosticMessage?.(err) || String(err?.message || err || '未知错误'))}</span>`);
        return;
    }
    if (!isCurrent()) return;
    state.cache = new Map((entries || []).map(e => [e.key, e]));
    const ctx = env.getContext?.();
    const selection = env.ensureSelection?.(ctx, entries) || { version: 1, decisions: {} };
    if (!isCurrent()) return;
    $list[0].innerHTML = buildWiListHtml(entries || [], selection, openState, env.escapeAttr);
    $list.off('.wi').on('click.wi', '.sp-wi-view-btn', function (ev) {
        ev.stopPropagation();
        const entry = state.cache.get(readDatasetValue($(this), 'key'));
        if (entry) env.showEntry?.(entry);
    }).on('click.wi', '.sp-wi-card', function (ev) {
        if ($(ev.target).closest('.sp-wi-view-btn').length) return;
        const $card = $(this);
        const $cb = $card.find('.sp-wi-cb');
        if (ev.target !== $cb[0]) $cb.prop('checked', !$cb.prop('checked'));
        $card.toggleClass('sp-wi-card-off', !$cb.prop('checked'));
        syncWiSelectAll(env);
        env.saveVisible?.(readVisibleWiSelection($list, $), [...state.cache.values()]);
    }).on('keydown.wi', '.sp-wi-card', function (ev) {
        if (ev.key !== ' ' && ev.key !== 'Enter') return;
        ev.preventDefault();
        const $card = $(this);
        const $cb = $card.find('.sp-wi-cb');
        $cb.prop('checked', !$cb.prop('checked'));
        $card.toggleClass('sp-wi-card-off', !$cb.prop('checked'));
        syncWiSelectAll(env);
        env.saveVisible?.(readVisibleWiSelection($list, $), [...state.cache.values()]);
    }).on('change.wi', '#sp-wi-select-all', function () {
        const checked = this.checked;
        $list.find('.sp-wi-cb').prop('checked', checked);
        $list.find('.sp-wi-card').toggleClass('sp-wi-card-off', !checked);
        $list.find('.sp-wi-group-cb').prop({ checked, indeterminate: false });
        env.saveVisible?.(readVisibleWiSelection($list, $), [...state.cache.values()]);
    }).on('change.wi', '.sp-wi-group-cb', function (ev) {
        ev.stopPropagation();
        const $group = $(this).closest('.sp-wi-group');
        const checked = this.checked;
        $group.find('.sp-wi-cb').prop('checked', checked);
        $group.find('.sp-wi-card').toggleClass('sp-wi-card-off', !checked);
        this.indeterminate = false;
        syncWiSelectAll(env);
        env.saveVisible?.(readVisibleWiSelection($list, $), [...state.cache.values()]);
    }).on('click.wi', '.sp-wi-group-cb', function (ev) {
        ev.stopPropagation();
    });
    if (scrollEl && openState.hadGroups) scrollEl.scrollTop = savedScroll;
    syncWiSelectAll(env);
}

export async function paintWiExcludeList(env = {}) {
    const $ = env.$;
    const $in = env.$in;
    const $list = $in('#sp-wi-exclude-list');
    if (!$list.length) return;
    const state = env.state;
    const revision = ++state.excludeRevision;
    const identity = env.identity?.();
    const isCurrent = () => revision === state.excludeRevision && identity === env.identity?.();
    let names;
    try {
        names = await env.listNames?.();
    } catch (err) {
        if (!isCurrent()) return;
        $list.html(`<span class="sp-cfg-hint">加载失败：${escapeHtml(env.diagnosticMessage?.(err) || String(err?.message || err || '未知错误'))}</span>`);
        return;
    }
    if (!isCurrent()) return;
    names = normalizeWorldNameList(names);
    const excluded = env.excludeSet?.() || new Set();
    paintWiExcludeCount(env, excluded.size, names.length);
    if (!names.length) {
        $list.html('<span class="sp-cfg-hint">当前没有任何世界书。</span>');
        return;
    }
    $list[0].innerHTML = names.map(name => {
        const on = bookNameExcluded(name, excluded, env.equals);
        return `<label class="sp-wi-exclude-row${on ? ' sp-wi-exclude-on' : ''}" data-name="${env.escapeAttr(name)}">
            <input type="checkbox" class="sp-wi-exclude-cb" data-name="${env.escapeAttr(name)}"${on ? ' checked' : ''}>
            <span class="sp-wi-exclude-name">${escapeHtml(name)}</span>
        </label>`;
    }).join('');
    $list.off('.wix').on('change.wix', '.sp-wi-exclude-cb', function () {
        const name = readDatasetValue($(this), 'name');
        env.setExcluded?.(name, this.checked);
        $(this).closest('.sp-wi-exclude-row').toggleClass('sp-wi-exclude-on', this.checked);
        paintWiExcludeCount(env, env.excludeSet?.().size || 0, names.length);
        env.onExcludeChange?.();
    });
    const $search = $in('#sp-wi-exclude-search');
    $search.off('.wix').on('input.wix', function () {
        filterWiExcludeRows(env, String(this.value || '').trim().toLowerCase());
    });
    if ($search.val()) filterWiExcludeRows(env, String($search.val()).trim().toLowerCase());
}

import { renderLampHtml } from './ui.js';
import { searchLampBooks } from './search.js';
import { defaultKindForHandoff, intentFromBasket } from './intent.js';
import { itemsFromAlignPreview } from './preview.js';

function keyOf(item = {}) {
    return `${item.module || ''}|${item.ref || ''}|${item.title || ''}`;
}

function itemFromEl(el) {
    return {
        module: el.getAttribute('data-jump-mod') || '',
        title: el.getAttribute('data-jump-key') || '',
        ref: el.getAttribute('data-jump-ref') || '',
    };
}

export function enterLampSidebar({ resetModes, show, feature } = {}) {
    resetModes?.();
    show?.();
    feature?.open?.();
}

export function createLampFeature(env = {}) {
    let open = false;
    let page = 'fight';
    let query = '';
    let kind = '';
    let intent = null;
    let editing = null;
    let busy = false;
    let storyChecked = false;
    let stale = [];
    let preview = null;
    const checked = new Set();
    const basketMap = new Map();

    const wrap = () => env.$in?.('#sp-lamp-wrap');
    const main = () => env.$in?.('#sp-lamp-main');

    const snapshot = () => {
        const collected = env.collect?.() || {};
        const conflicts = collected.conflicts || [];
        const hits = page === 'search' ? searchLampBooks(query, collected.books || {}) : [];
        const catalog = [...conflicts, ...hits];
        const basket = [...basketMap.values()];
        return { collected, conflicts, hits, catalog, basket };
    };

    const hostNode = () => {
        const $main = main();
        if ($main?.length) return $main.get?.(0) || $main[0] || null;
        return wrap()?.get?.(0) || wrap()?.[0] || null;
    };

    const paint = ({ keepScroll = true, anchorKey = '' } = {}) => {
        if (!open) return;
        const $main = main();
        const prev = hostNode()?.querySelector?.('.sp-lamp-body');
        const scrollTop = Number(prev?.scrollTop) || 0;
        const { collected, conflicts, hits, basket } = snapshot();
        const html = renderLampHtml({
            page,
            conflicts,
            hits,
            stale,
            query,
            checked,
            basket,
            intent,
            kind,
            editing,
            hasBaiBai: collected.hasBaiBai === true,
            age: collected.age || null,
            preview,
            busy,
            storyChecked,
        });
        if ($main?.length) $main.html(html);
        else wrap()?.html?.(`<div class="sp-lamp-main" id="sp-lamp-main">${html}</div>`);
        const next = hostNode()?.querySelector?.('.sp-lamp-body');
        if (next) next.scrollTop = keepScroll ? scrollTop : 0;
        if (anchorKey && next) {
            const escaped = String(anchorKey).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            next.querySelector(`[data-row-key="${escaped}"]`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        }
    };

    const listedItems = () => {
        const { conflicts, hits } = snapshot();
        return page === 'search' ? hits : [...conflicts, ...stale];
    };

    const addCheckedToBasket = () => {
        for (const item of listedItems()) {
            if (!checked.has(keyOf(item))) continue;
            basketMap.set(keyOf(item), item);
        }
        paint();
    };

    const currentKind = ({ from = page } = {}) => {
        if (kind) return kind;
        const hasConflict = [...basketMap.values()].some(item => item.id && !String(item.id).startsWith('preview:') && item.source !== 'story');
        return defaultKindForHandoff({ from, hasConflict }) || kind;
    };

    const openPage = () => {
        open = true;
        paint({ keepScroll: false });
        env.onOpen?.();
    };

    const setBusy = value => {
        busy = value === true;
        paint();
    };

    async function runPreview({ storyWindow = 'latest' } = {}) {
        if (busy) {
            env.toast?.('正在对齐，请稍后再点', true);
            return;
        }
        setBusy(true);
        try {
            const result = await env.previewAlign?.({
                selected: ['point', 'lines'],
                storyWindow,
                cause: 'manual',
                reason: storyWindow === 'since-align' ? '灯上追从上次对齐到现在' : '灯上先看再写',
            });
            if (result?.status === 'preview') {
                preview = {
                    kind: 'align',
                    note: result.note || result.summary || '',
                    items: itemsFromAlignPreview(result),
                    patches: result.patches || [],
                    selected: result.selected || ['point', 'lines'],
                    storyWindow,
                    reason: storyWindow === 'since-align' ? '灯上追从上次对齐到现在' : '灯上先看再写',
                    window: result.window || null,
                    skippedLocks: result.skippedLocks || [],
                    route: result.route || null,
                };
                kind = 'align';
                for (const item of preview.items) basketMap.set(keyOf(item), item);
                if (result.unchanged || !preview.items.length) {
                    env.toast?.(result.summary || '对照过了，点和线都不用改');
                } else {
                    env.toast?.(result.summary || '拟改已放进待改篮，确认后再写入');
                }
            } else if (result?.status === 'failed') {
                env.toast?.(String(result.errorMessage || result.error?.message || '对齐预览失败'), true);
            } else if (result?.status === 'skipped' && result.reason === 'busy') {
                env.toast?.('正在对齐或刷新，请稍后再点', true);
            } else if (result?.status === 'cancelled') {
                env.toast?.('这次对齐已取消', true);
            }
        } catch (error) {
            env.toast?.(error?.message || '对齐预览失败', true);
        } finally {
            busy = false;
            paint();
        }
    }

    async function runFightPreview() {
        if (busy) {
            env.toast?.('正在对齐，请稍后再点', true);
            return;
        }
        addCheckedToBasket();
        setBusy(true);
        try {
            const nextKind = currentKind({ from: page === 'search' ? 'search' : 'conflict' }) || 'fight';
            const payload = intentFromBasket([...basketMap.values()], {
                kind: nextKind,
                reason: intent?.reason || intent?.text || '',
            });
            const result = await env.previewFight?.({ intent: payload, cause: 'manual' });
            if (result?.status === 'preview') {
                preview = {
                    kind: 'fight',
                    note: result.note || result.summary || '',
                    items: result.items || itemsFromAlignPreview(result),
                    patches: result.patches || [],
                    selected: ['point', 'lines'],
                    reason: payload?.text || payload?.reason || '灯上先看打架',
                    skippedLocks: result.skippedLocks || [],
                    route: result.route || null,
                    intent: payload,
                };
                kind = 'fight';
                for (const item of preview.items) basketMap.set(keyOf(item), item);
                if (result.unchanged || !preview.items.length) {
                    env.toast?.(result.summary || '对照过了，点和线都不用改');
                } else {
                    env.toast?.(result.summary || '拟改已放进待改篮，确认后再写入');
                }
            } else if (result?.status === 'failed') {
                env.toast?.(String(result.errorMessage || result.error?.message || '打架预览失败'), true);
            } else if (result?.status === 'skipped' && result.reason === 'busy') {
                env.toast?.('正在对齐或刷新，请稍后再点', true);
            } else if (result?.status === 'cancelled') {
                env.toast?.('这次打架已取消', true);
            }
        } catch (error) {
            env.toast?.(error?.message || '打架预览失败', true);
        } finally {
            busy = false;
            paint();
        }
    }

    return Object.freeze({
        isOpen: () => open,
        open: openPage,
        close: () => { open = false; },
        refresh: paint,
        onChatChanged: () => {
            open = false;
            checked.clear();
            basketMap.clear();
            intent = null;
            editing = null;
            query = '';
            page = 'fight';
            kind = '';
            busy = false;
            storyChecked = false;
            stale = [];
            preview = null;
        },
        setIntent(next, options = {}) {
            intent = next || null;
            if (next?.kind) kind = next.kind;
            else if (options.kind) kind = options.kind;
            else kind = defaultKindForHandoff(options);
            for (const item of next?.items || []) basketMap.set(keyOf(item), item);
            page = 'fight';
            openPage();
        },
        bindUi() {
            const $root = wrap();
            if (!$root?.length) return;
            $root.off('.spLamp');
            $root.on('click.spLamp', '.sp-lamp-tab', function () {
                page = this.getAttribute('data-lamp-page') === 'search' ? 'search' : 'fight';
                paint({ keepScroll: false });
            });
            $root.on('change.spLamp', '.sp-lamp-check', function () {
                const key = this.getAttribute('data-row-key');
                if (this.checked) checked.add(key);
                else checked.delete(key);
            });
            $root.on('click.spLamp', '.sp-lamp-jump', function (event) {
                event.preventDefault();
                const row = this.closest?.('.sp-lamp-row') || this;
                env.jump?.(itemFromEl(row));
            });
            $root.on('click.spLamp', '.sp-lamp-edit-open', function (event) {
                event.preventDefault();
                const row = this.closest?.('.sp-lamp-row');
                const key = row?.getAttribute?.('data-row-key');
                const found = listedItems().find(item => keyOf(item) === key)
                    || [...basketMap.values()].find(item => keyOf(item) === key);
                editing = found || itemFromEl(row);
                paint({ anchorKey: keyOf(editing) });
            });
            $root.on('click.spLamp', '.sp-lamp-edit-cancel', function (event) {
                event.preventDefault();
                const key = this.closest?.('.sp-lamp-row')?.getAttribute?.('data-row-key') || keyOf(editing);
                editing = null;
                paint({ anchorKey: key });
            });
            $root.on('submit.spLamp', '.sp-lamp-edit', function (event) {
                event.preventDefault();
                const fields = {};
                const nodes = this.querySelectorAll?.('.sp-lamp-edit-field') || [];
                for (const node of nodes) fields[node.getAttribute('data-field')] = String(node.value || '');
                const key = this.getAttribute('data-edit-key');
                const item = listedItems().find(row => keyOf(row) === key)
                    || [...basketMap.values()].find(row => keyOf(row) === key)
                    || editing;
                void env.saveItem?.({ ...item, fields });
                editing = null;
                paint({ anchorKey: key });
            });
            $root.on('click.spLamp', '#sp-lamp-search', () => {
                query = String(env.$in?.('#sp-lamp-query')?.val?.() || '');
                page = 'search';
                paint({ keepScroll: false });
            });
            $root.on('keydown.spLamp', '#sp-lamp-query', event => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                query = String(event.target.value || '');
                page = 'search';
                paint({ keepScroll: false });
            });
            $root.on('change.spLamp', 'input[name="sp-lamp-kind"]', function () {
                kind = this.value;
            });
            $root.on('click.spLamp', '#sp-lamp-basket-add', addCheckedToBasket);
            $root.on('click.spLamp', '#sp-lamp-to-space', () => {
                addCheckedToBasket();
                env.sendToSpace?.({ items: [...basketMap.values()], ask: false });
            });
            $root.on('click.spLamp', '#sp-lamp-ask-space', () => {
                addCheckedToBasket();
                env.sendToSpace?.({ items: [...basketMap.values()], ask: true });
            });
            $root.on('click.spLamp', '#sp-lamp-clarify', () => {
                env.clarifyIntent?.(intent || intentFromBasket([...basketMap.values()], { kind: currentKind() }));
            });
            $root.on('click.spLamp', '.sp-lamp-dismiss', function (event) {
                event.preventDefault();
                event.stopPropagation?.();
                const row = this.closest?.('.sp-lamp-row');
                env.dismiss?.({
                    pairId: row?.getAttribute?.('data-pair-id') || '',
                    ...itemFromEl(row),
                });
            });
            $root.on('click.spLamp', '#sp-lamp-check-story', () => {
                stale = env.checkStory?.() || [];
                storyChecked = true;
                kind = kind || 'align';
                for (const item of stale) {
                    checked.add(keyOf(item));
                    basketMap.set(keyOf(item), item);
                }
                if (!stale.length) env.toast?.('最新楼没有看出点/线过期');
                else env.toast?.(`对照最新楼：${stale.length} 条可能过期，已进待改篮`);
                paint({ keepScroll: false });
            });
            $root.on('click.spLamp', '#sp-lamp-preview-align', () => {
                void runPreview({ storyWindow: 'latest' });
            });
            $root.on('click.spLamp', '#sp-lamp-preview-window', () => {
                void runPreview({ storyWindow: 'since-align' });
            });
            $root.on('click.spLamp', '#sp-lamp-preview-fight', () => {
                void runFightPreview();
            });
            $root.on('click.spLamp', '#sp-lamp-apply-preview', () => {
                if (busy) return;
                if (!preview?.patches?.length) {
                    env.toast?.('没有拟改可写');
                    return;
                }
                const payload = preview;
                void (async () => {
                    setBusy(true);
                    try {
                        const apply = payload.kind === 'fight' ? env.applyFight : env.applyAlign;
                        const result = await apply?.({
                            applyPatches: payload.patches,
                            selected: payload.selected,
                            reason: payload.reason,
                            note: payload.note,
                            intent: payload.intent,
                            cause: 'manual',
                        });
                        if (result?.status === 'updated') {
                            preview = null;
                            if (result.unchanged) env.toast?.('API 跑过了，点和线都不用改');
                            else env.toast?.(result.summary || '已按正文对齐');
                        } else if (result?.status === 'failed') {
                            env.toast?.(String(result.errorMessage || result.error?.message || '写入失败'), true);
                        } else if (result?.status === 'cancelled') {
                            env.toast?.('这次对齐已取消', true);
                        }
                    } catch (error) {
                        env.toast?.(error?.message || '写入失败', true);
                    } finally {
                        busy = false;
                        paint();
                    }
                })();
            });
            $root.on('click.spLamp', '#sp-lamp-drop-preview', () => {
                preview = null;
                paint();
            });
            $root.on('click.spLamp', '#sp-lamp-fight', () => {
                addCheckedToBasket();
                const nextKind = currentKind({ from: page === 'search' ? 'search' : 'conflict' });
                if (!nextKind) {
                    env.toast?.('搜索勾去的还不是打架，先选跑法，或回间再出一版意图', true);
                    paint();
                    return;
                }
                const payload = intentFromBasket([...basketMap.values()], {
                    kind: nextKind,
                    reason: intent?.reason || intent?.text || '',
                });
                void env.runKind?.(nextKind, payload);
            });
        },
    });
}

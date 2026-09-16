import { renderLampHtml } from './ui.js';
import { searchLampBooks } from './search.js';
import { defaultKindForHandoff, intentFromBasket } from './intent.js';

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

    const paint = () => {
        if (!open) return;
        const $main = main();
        const { conflicts, hits, basket } = snapshot();
        const html = renderLampHtml({
            page,
            conflicts,
            hits,
            query,
            checked,
            basket,
            intent,
            kind,
            editing,
            hasBaiBai: env.collect?.()?.hasBaiBai === true,
        });
        if ($main?.length) $main.html(html);
        else wrap()?.html?.(`<div class="sp-lamp-main" id="sp-lamp-main">${html}</div>`);
    };

    const listedItems = () => {
        const { conflicts, hits } = snapshot();
        return page === 'search' ? hits : conflicts;
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
        const hasConflict = [...basketMap.values()].some(item => item.id);
        return defaultKindForHandoff({ from, hasConflict }) || kind;
    };

    const openPage = () => {
        open = true;
        paint();
        env.onOpen?.();
    };

    return Object.freeze({
        isOpen: () => open,
        open: openPage,
        close: () => { open = false; },
        refresh: paint,
        onChatChanged: () => { open = false; checked.clear(); basketMap.clear(); intent = null; editing = null; query = ''; page = 'fight'; kind = ''; },
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
                paint();
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
                paint();
            });
            $root.on('click.spLamp', '.sp-lamp-edit-cancel', function (event) {
                event.preventDefault();
                editing = null;
                paint();
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
                paint();
            });
            $root.on('click.spLamp', '#sp-lamp-search', () => {
                query = String(env.$in?.('#sp-lamp-query')?.val?.() || '');
                page = 'search';
                paint();
            });
            $root.on('keydown.spLamp', '#sp-lamp-query', event => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                query = String(event.target.value || '');
                page = 'search';
                paint();
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

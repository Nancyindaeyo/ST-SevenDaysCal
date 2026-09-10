import test from 'node:test';
import assert from 'node:assert/strict';
import { createPanelHost } from './panel-host.js';

function fakeQuery(state) {
    const api = sel => {
        const self = {
            html(value) {
                if (arguments.length) { state.html[sel] = value; return self; }
                return state.html[sel];
            },
            val(value) {
                if (arguments.length) { state.val[sel] = value; return self; }
                return state.val[sel] ?? '';
            },
            attr(key, value) {
                state.attr[sel] ||= {};
                if (arguments.length > 1) { state.attr[sel][key] = value; return self; }
                return state.attr[sel][key];
            },
            focus() { state.focus = sel; return self; },
            select() { state.select = sel; return self; },
            off() { return self; },
            on(ev, fn) { state.on.push([sel, ev, fn]); return self; },
            removeClass() { return self; },
            addClass() { return self; },
            toggleClass(name, on) { state.toggle.push([sel, name, on]); return self; },
        };
        return self;
    };
    return api;
}

function makeHost(overrides = {}) {
    const calls = [];
    const view = { current: 'user', char: overrides.charViewName ?? null };
    const cache = { html: overrides.cachedHtml ?? null };
    const state = { html: {}, val: {}, attr: {}, on: [], toggle: [], focus: null, select: null };
    const $in = fakeQuery(state);
    const host = createPanelHost({
        outlineMode: () => false,
        rerollOutline: () => calls.push('reroll'),
        syncingPoint: () => false,
        toast: (message, _n, error) => calls.push(['toast', message, !!error]),
        pointGenerating: () => false,
        triggerGenerate: () => calls.push('generate'),
        setCurrentView: next => { view.current = next; calls.push(['view', next]); },
        setCharViewName: name => { view.char = name; },
        getCharViewName: () => view.char,
        markViewButtons: next => calls.push(['mark', next]),
        loadCachedSchedule: () => calls.push('load-cache'),
        hasCachedSchedule: () => !!cache.html,
        cachedScheduleHtml: () => cache.html,
        setBody: html => { calls.push(['body', html]); state.html['#sp-body'] = html; },
        showEmptyGenerate: () => calls.push('empty'),
        updateTaTriggerLabel: () => calls.push('ta-label'),
        closeTaDrawer: () => calls.push('close-drawer'),
        pushRecentCharName: name => calls.push(['recent', name]),
        getContext: () => ({}),
        guessCharName: () => '',
        readRecentCharNames: () => [],
        escapeAttr: s => String(s ?? ''),
        escapeHtml: s => String(s ?? ''),
        isPinnedChar: () => false,
        removePinnedChar: name => calls.push(['unpin', name]),
        addPinnedChar: name => { calls.push(['pin', name]); return 'ok'; },
        pinCap: () => 6,
        reloadPinnedSchedule: () => false,
        taDrawerOpen: () => false,
        openTaDrawer: () => calls.push('open-drawer'),
        $in,
        $inAll: $in,
        $: (el) => ({ attr: key => el?.getAttribute?.(key) }),
        scheduleFocus: fn => fn(),
        clearShadows: () => calls.push('clear'),
        buildMarkup: () => ({ html: '<panel>', cfg: { key: 'k' } }),
        mountHosts: html => { calls.push(['hosts', html]); return { root: 'root', dialogShadow: 'dialog' }; },
        setShadows: mounted => calls.push(['shadows', mounted.root, mounted.dialogShadow]),
        afterMount: cfg => calls.push(['after', cfg?.key]),
        bindShell: () => calls.push('shell'),
        ...overrides,
        $in: overrides.$in || $in,
        $inAll: overrides.$inAll || overrides.$in || $in,
    });
    return { host, calls, view, cache, state, $in };
}

test('setView 记住 char 名，切回 user 不清', () => {
    const { host, view, calls } = makeHost();
    host.setView('char', '爱丽丝');
    assert.equal(view.current, 'char');
    assert.equal(view.char, '爱丽丝');
    host.setView('user');
    assert.equal(view.current, 'user');
    assert.equal(view.char, '爱丽丝');
    assert.ok(calls.includes('load-cache'));
});

test('regen：面模式走 outline；点在同步/生成中要挡；否则 generate', () => {
    const outline = makeHost({ outlineMode: () => true });
    outline.host.onRegenClick();
    assert.deepEqual(outline.calls, ['reroll']);

    const syncing = makeHost({ syncingPoint: () => true });
    syncing.host.onRegenClick();
    assert.deepEqual(syncing.calls, [['toast', '点正在同步到今天，稍候再刷新', true]]);

    const busy = makeHost({ pointGenerating: () => true });
    busy.host.onRegenClick();
    assert.deepEqual(busy.calls, []);

    const ok = makeHost();
    ok.host.onRegenClick();
    assert.deepEqual(ok.calls, ['generate']);
});

test('activate：空名不切；生成中 toast；有缓存画出来，没有走空态', () => {
    const empty = makeHost();
    empty.host.activateCharView('  ');
    assert.deepEqual(empty.calls, []);

    const busy = makeHost({ pointGenerating: () => true });
    busy.host.activateCharView('铃');
    assert.deepEqual(busy.calls[0], ['toast', '点正在生成，稍候再换人', true]);
    assert.equal(busy.view.current, 'user');

    const cached = makeHost({ cachedHtml: '<sched>' });
    cached.host.activateCharView('铃');
    assert.equal(cached.view.char, '铃');
    assert.ok(cached.calls.includes('close-drawer'));
    assert.deepEqual(cached.calls.filter(c => Array.isArray(c) && c[0] === 'body'), [['body', '<sched>']]);

    const miss = makeHost();
    miss.host.activateCharView('铃');
    assert.ok(miss.calls.includes('empty'));
});

test('confirm：空名只聚焦；有名记最近并切 char', () => {
    const { host, state, calls, view, cache } = makeHost();
    host.confirmCharView();
    assert.equal(state.focus, '#sp-char-name-input');
    assert.equal(view.current, 'user');

    cache.html = '<sched>';
    state.val['#sp-char-name-input'] = '  爱丽丝  ';
    host.confirmCharView();
    assert.equal(view.char, '爱丽丝');
    assert.ok(calls.some(c => Array.isArray(c) && c[0] === 'recent' && c[1] === '爱丽丝'));
    assert.ok(calls.some(c => Array.isArray(c) && c[0] === 'body' && c[1] === '<sched>'));
});

test('pin 满槽 toast 且不重渲；取消固定会 reload', () => {
    const full = makeHost({
        addPinnedChar: () => 'full',
        pinCap: () => 3,
        reloadPinnedSchedule: () => { throw new Error('should not reload'); },
    });
    full.host.onCharPinToggle('铃');
    assert.deepEqual(full.calls, [['toast', '固定槽已满（最多 3 个），先在 TA▾ 里移除一个', true]]);

    const pinned = makeHost({
        isPinnedChar: () => true,
        reloadPinnedSchedule: () => { pinned.calls.push('reload'); return true; },
        taDrawerOpen: () => true,
    });
    pinned.host.onCharPinToggle('铃');
    assert.ok(pinned.calls.some(c => Array.isArray(c) && c[0] === 'unpin'));
    assert.ok(pinned.calls.includes('reload'));
    assert.ok(pinned.calls.includes('open-drawer'));
});

test('mount 按序清影子、挂壳、after、chrome', () => {
    const { host, calls } = makeHost();
    host.mount();
    assert.deepEqual(calls, [
        'clear',
        ['hosts', '<panel>'],
        ['shadows', 'root', 'dialog'],
        ['after', 'k'],
        'shell',
    ]);
});

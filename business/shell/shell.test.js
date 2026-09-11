import test from 'node:test';
import assert from 'node:assert/strict';
import { clampFabBox, parseStoredPos } from './fab.js';
import { nextThemeMode, themeToggleIcon, themeToggleTitle, getEffectiveTheme, paintThemeClasses } from './theme.js';
import { handlePanelViewClick, openSideView } from './view-switch.js';
import { clickInsideModuleIntro } from './chrome.js';
import { FAB_ID, MODAL_ID, PEN_ICON_SVG } from './ids.js';
import { modalHostClass, panelShadowHtml, shouldStopShadowKeydown } from './hosts.js';

test('fab position clamps inside the viewport', () => {
    assert.deepEqual(clampFabBox(-10, -4, { width: 48, height: 48, vw: 200, vh: 100 }), { left: 0, top: 0 });
    assert.deepEqual(clampFabBox(400, 90, { width: 48, height: 48, vw: 200, vh: 100 }), { left: 152, top: 52 });
});

test('stored fab pos ignores damaged json', () => {
    assert.equal(parseStoredPos('not-json'), null);
    assert.deepEqual(parseStoredPos('{"left":12,"top":8}'), { left: 12, top: 8 });
});

test('theme mode cycles auto → day → night → auto', () => {
    assert.equal(nextThemeMode('auto'), 'day');
    assert.equal(nextThemeMode('day'), 'night');
    assert.equal(nextThemeMode('night'), 'auto');
    assert.equal(themeToggleIcon('day'), 'fa-sun');
    assert.match(themeToggleTitle('night'), /夜间/);
});

test('effective theme honors forced day/night', () => {
    assert.equal(getEffectiveTheme('day', () => 'night'), 'day');
    assert.equal(getEffectiveTheme('auto', () => 'night'), 'night');
});

test('paintThemeClasses forces night on the wrapper', () => {
    const classes = new Set(['sp-day']);
    const wrapper = {
        classList: {
            remove(...names) { for (const n of names) classes.delete(n); },
            add(name) { classes.add(name); },
        },
    };
    paintThemeClasses({ theme: 'night', forced: true, wrapper });
    assert.ok(classes.has('sp-night'));
    assert.ok(classes.has('sp-forced-night'));
    assert.ok(!classes.has('sp-day'));
});

function fakeDom() {
    const display = {};
    const title = { text: '' };
    const node = sel => ({
        hide() { display[sel] = 'none'; return this; },
        show() { display[sel] = 'show'; return this; },
        css(prop, value) { if (prop === 'display') display[sel] = value; return this; },
        text(value) { title.text = value; return this; },
        addClass() { return this; },
        removeClass() { return this; },
        attr() { return this; },
    });
    return { $in: node, display, title };
}

function btn({ view, side = false, sub = false, ta = false } = {}) {
    return {
        data(key) { return key === 'view' ? view : undefined; },
        hasClass(name) {
            if (name === 'sp-side-tab') return side;
            if (name === 'sp-sub-btn') return sub;
            if (name === 'sp-ta-trigger') return ta;
            return false;
        },
        addClass() { return this; },
    };
}

function switchHost(over = {}) {
    const calls = [];
    const modes = { outline: false, lines: false, space: false, theater: false, almanac: false };
    const dom = fakeDom();
    const h = {
        calls,
        $in: dom.$in,
        hideIntro: () => calls.push('hideIntro'),
        settingsOpen: () => false,
        toggleSettings: () => calls.push('settings'),
        activity: { close: () => calls.push('activity') },
        theaterOn: () => modes.theater,
        theater: { leave: () => calls.push('theater.leave'), open: () => calls.push('theater.open'), busy: false },
        closeTaDrawer: () => calls.push('closeTa'),
        toggleTaDrawer: () => calls.push('toggleTa'),
        pointGenerating: () => false,
        markSideTab: view => calls.push(`tab:${view}`),
        markSubBtn: view => calls.push(`sub:${view}`),
        modes: () => ({ ...modes }),
        setModes(next) { Object.assign(modes, next); calls.push(`modes:${Object.keys(next).filter(k => next[k]).join(',') || 'off'}`); },
        outline: { open: () => calls.push('outline.open') },
        space: { open: () => calls.push('space.open') },
        paintLines: () => calls.push('paintLines'),
        paintTheater: () => calls.push('paintTheater'),
        paintAlmanac: () => calls.push('paintAlmanac'),
        paintSchedule: () => calls.push('paintSchedule'),
        enterAnchor: () => calls.push('enterAnchor'),
        coordinate: { close: () => calls.push('coordinate.close') },
        currentView: () => 'char',
        setView: view => calls.push(`setView:${view}`),
        ...over,
    };
    return { h, modes, calls };
}

test('side tab to outline closes settings and exclusive-modes the rest', () => {
    const { h, modes } = switchHost({ settingsOpen: () => true });
    const result = handlePanelViewClick(h, btn({ view: 'outline', side: true }));
    assert.equal(result.status, 'outline');
    assert.equal(modes.outline, true);
    assert.equal(modes.lines, false);
    assert.ok(h.calls.includes('settings'));
    assert.ok(h.calls.includes('activity'));
    assert.ok(h.calls.includes('closeTa'));
    assert.ok(h.calls.includes('outline.open'));
});

test('the same side tab does not reopen', () => {
    const { h } = switchHost();
    h.setModes({ outline: true, lines: false, space: false, theater: false, almanac: false });
    h.calls.length = 0;
    const result = openSideView(h, 'outline');
    assert.equal(result.status, 'same');
    assert.ok(!h.calls.includes('outline.open'));
});

test('leaving theater calls leave before opening schedule', () => {
    const { h } = switchHost();
    h.setModes({ theater: true, outline: false, lines: false, space: false, almanac: false });
    h.calls.length = 0;
    const result = handlePanelViewClick(h, btn({ view: 'schedule', side: true }));
    assert.equal(result.status, 'schedule');
    assert.ok(h.calls.indexOf('theater.leave') < h.calls.indexOf('paintSchedule'));
    assert.ok(h.calls.includes('coordinate.close'));
});

test('TA trigger does not switch views while point is generating', () => {
    const { h } = switchHost({ pointGenerating: () => true });
    const result = handlePanelViewClick(h, btn({ view: 'char', ta: true }));
    assert.equal(result.status, 'blocked');
    assert.ok(!h.calls.includes('toggleTa'));
});

test('user sub-toggle paints schedule after leaving char', () => {
    const { h } = switchHost();
    const result = handlePanelViewClick(h, btn({ view: 'user', sub: true }));
    assert.equal(result.status, 'user');
    assert.ok(h.calls.includes('setView:user'));
    assert.ok(h.calls.includes('paintSchedule'));
});

test('shell ids stay the host contract ST already uses', () => {
    assert.equal(MODAL_ID, 'sp-modal-root');
    assert.equal(FAB_ID, 'sp-fab');
    assert.match(PEN_ICON_SVG, /sp-pen-icon/);
});

test('module intro stays open when the click is inside the pop or button', () => {
    const pop = { matches: sel => sel.includes('#sp-module-intro-pop') };
    const btn = { matches: sel => sel.includes('.sp-module-intro-btn') };
    const outside = { matches: () => false };
    assert.equal(clickInsideModuleIntro([outside, pop]), true);
    assert.equal(clickInsideModuleIntro([btn]), true);
    assert.equal(clickInsideModuleIntro([outside]), false);
    assert.equal(clickInsideModuleIntro([null, {}]), false);
});

test('shadow keydown stops composed input keys but lets Escape through', () => {
    assert.equal(shouldStopShadowKeydown({ key: 'Escape', target: { tagName: 'INPUT' } }), false);
    assert.equal(shouldStopShadowKeydown({ key: 'ArrowLeft', target: { tagName: 'INPUT' } }), true);
    assert.equal(shouldStopShadowKeydown({ key: 'a', target: { tagName: 'TEXTAREA' } }), true);
    assert.equal(shouldStopShadowKeydown({ key: 'a', target: { tagName: 'DIV', isContentEditable: true } }), true);
    assert.equal(shouldStopShadowKeydown({ key: 'ArrowLeft', target: { tagName: 'BUTTON' } }), false);
    assert.equal(shouldStopShadowKeydown({
        key: 'ArrowLeft',
        target: { tagName: 'DIV' },
        composedPath: () => [{ tagName: 'INPUT' }],
    }), true);
});

test('panel shadow wrapper keeps the theme class ST already paints', () => {
    assert.equal(modalHostClass('night'), 'sp-root sp-night');
    assert.match(panelShadowHtml('day', '<main></main>', '/ext/', '/st/'), /sp-root sp-day/);
    assert.match(panelShadowHtml('day', '<main></main>', '/ext/', '/st/'), /href="\/ext\/style\.css"/);
});

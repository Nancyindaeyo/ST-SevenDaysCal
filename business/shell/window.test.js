import test from 'node:test';
import assert from 'node:assert/strict';
import { clampOutlineChatHeight, clampPanelDrag, clampPanelSize, createPanelWindow, mobileSheetFrame, runOpenSchedule } from './window.js';
import { guessCharName, nextTaToggle, taTriggerLabel, taDrawerHtml } from './ta-drawer.js';

test('panel drag keeps a 60px bottom gutter', () => {
    assert.deepEqual(clampPanelDrag(-8, 900, { width: 40, vw: 200, vh: 100 }), { left: 0, top: 40 });
});

test('panel resize clamps desktop and mobile widths', () => {
    assert.deepEqual(clampPanelSize(100, 100, { vw: 800, vh: 600, mobile: false }), { width: 280, height: 300 });
    assert.equal(clampPanelSize(900, 400, { vw: 400, vh: 600, mobile: true }).width, 390);
});

test('outline chat height stays between 80 and 420', () => {
    assert.equal(clampOutlineChatHeight(40), 80);
    assert.equal(clampOutlineChatHeight(900), 420);
});

test('mobile sheet follows the visual viewport including iOS offsetTop', () => {
    assert.deepEqual(mobileSheetFrame({ vh: 500, offsetTop: 80, safeTop: 10, safeBot: 20 }), { top: 110, height: 430 });
});

test('panel dispose removes window and visual viewport listeners', () => {
    const windowListeners = new Map();
    const viewportListeners = new Map();
    const sheet = { style: {}, offsetWidth: 320, offsetHeight: 500 };
    const root = { style: { display: 'block' } };
    const win = {
        innerHeight: 700,
        innerWidth: 400,
        visualViewport: {
            height: 650,
            offsetTop: 0,
            addEventListener: (name, handler) => viewportListeners.set(name, handler),
            removeEventListener: (name, handler) => { if (viewportListeners.get(name) === handler) viewportListeners.delete(name); },
        },
        addEventListener: (name, handler) => windowListeners.set(name, handler),
        removeEventListener: (name, handler) => { if (windowListeners.get(name) === handler) windowListeners.delete(name); },
        getComputedStyle: () => ({ top: '0', bottom: '0' }),
        localStorage: { getItem: () => null },
    };
    const doc = {
        getElementById: () => root,
        createElement: () => ({ style: {} }),
        body: { appendChild: () => {}, removeChild: () => {}, style: {} },
    };
    const panel = createPanelWindow({
        $: () => ({ off: () => ({ on: () => {} }) }),
        document: doc,
        window: win,
        isMobile: () => true,
        sheet: () => sheet,
    });
    panel.position();
    assert.deepEqual([...windowListeners.keys()].sort(), ['orientationchange', 'resize']);
    assert.deepEqual([...viewportListeners.keys()].sort(), ['resize', 'scroll']);
    panel.dispose();
    assert.equal(windowListeners.size, 0);
    assert.equal(viewportListeners.size, 0);
});

test('opening the panel restores last view before painting home', () => {
    const calls = [];
    const restored = runOpenSchedule({
        show: () => calls.push('show'),
        resetHome: () => calls.push('reset'),
        lastMainView: () => 'lines',
        restoreLastView: () => { calls.push('restore'); return true; },
        paintHome: () => calls.push('home'),
        afterOpen: () => calls.push('notice'),
    });
    assert.equal(restored.status, 'restored');
    assert.deepEqual(calls, ['show', 'reset', 'restore', 'notice']);
    calls.length = 0;
    const home = runOpenSchedule({
        show: () => calls.push('show'),
        resetHome: () => calls.push('reset'),
        lastMainView: () => 'schedule',
        restoreLastView: () => { calls.push('restore'); return true; },
        paintHome: () => calls.push('home'),
        afterOpen: () => calls.push('notice'),
    });
    assert.equal(home.status, 'home');
    assert.deepEqual(calls, ['show', 'reset', 'home', 'notice']);
});

test('guessCharName prefers the card name then the most frequent spoken name', () => {
    assert.equal(guessCharName({ name2: '林深' }), '林深');
    assert.equal(guessCharName({
        chat: [
            { is_user: false, mes: 'Chapter: skip\n阿宁：来了\n阿宁：再来' },
            { is_user: false, mes: '阿宁：第三句\n路人：一声' },
        ],
    }), '阿宁');
    assert.equal(guessCharName({ chat: [{ is_user: false, mes: 'Note: 不是名字' }] }), '');
});

test('TA trigger label and toggle next-step', () => {
    assert.equal(taTriggerLabel('char', '阿宁'), '阿宁');
    assert.equal(taTriggerLabel('user', '阿宁'), 'TA');
    assert.equal(nextTaToggle({ open: true, pinCount: 2 }), 'close');
    assert.equal(nextTaToggle({ open: false, pinCount: 1 }), 'open');
    assert.equal(nextTaToggle({ open: false, pinCount: 0, currentView: 'user', charViewName: '阿宁' }), 'activate');
    assert.equal(nextTaToggle({ open: false, pinCount: 0, currentView: 'char', charViewName: '阿宁' }), 'picker');
});

test('TA drawer html marks the active pin', () => {
    const html = taDrawerHtml(['阿宁', '路人'], {
        currentView: 'char',
        charViewName: '阿宁',
        escapeAttr: v => v,
        escapeHtml: v => v,
    });
    assert.match(html, /sp-ta-slot-active/);
    assert.match(html, /添加 \/ 查看角色/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { backupOverlayProgressCopy, BLOCKING_OVERLAY_STYLE, createOverlayAbortRelay, focusStorageOverlay, MIGRATION_UNKNOWN_ABORT_LABEL, mountStorageLockOverlay, OVERLAY_BLOCK_EVENTS } from './storage-overlay.js';

test('backup overlay progress prefers message then count', () => {
    assert.equal(backupOverlayProgressCopy({ message: '写入中' }), '写入中');
    assert.equal(backupOverlayProgressCopy({ done: 2, total: 5 }), '2 / 5');
    assert.equal(backupOverlayProgressCopy({}), '处理中…');
});

test('storage lock overlay keeps the page-blocking contract', () => {
    assert.ok(OVERLAY_BLOCK_EVENTS.includes('keydown'));
    assert.ok(OVERLAY_BLOCK_EVENTS.includes('click'));
    assert.equal(BLOCKING_OVERLAY_STYLE.zIndex, '2147483647');
    assert.equal(MIGRATION_UNKNOWN_ABORT_LABEL, '关闭（请刷新聊天后核实）');
});

test('migration unknown close replaces abort without a second listener', () => {
    const calls = [];
    const relay = createOverlayAbortRelay(() => calls.push('abort'));
    relay.fire();
    relay.set(() => calls.push('close'));
    relay.fire();
    assert.deepEqual(calls, ['abort', 'close']);
});

test('storage overlay focuses an enabled abort action and falls back to its dialog', () => {
    const calls = [];
    const dialog = { focus: () => calls.push('dialog') };
    const abort = { disabled: false, focus: () => calls.push('abort') };
    assert.equal(focusStorageOverlay(dialog, abort), abort);
    abort.disabled = true;
    assert.equal(focusStorageOverlay(dialog, abort), dialog);
    assert.deepEqual(calls, ['abort', 'dialog']);
});

test('mounted storage overlay traps Tab, cleans capture listeners, and restores focus', () => {
    const calls = [];
    const listeners = new Map();
    const previous = { isConnected: true, focus: () => calls.push('previous') };
    const dialog = { disabled: false, focus: () => calls.push('dialog') };
    const abort = { disabled: false, focus: () => calls.push('abort'), addEventListener: () => {} };
    const status = {};
    const overlayListeners = new Map();
    const overlay = {
        id: '',
        style: {},
        removed: false,
        set innerHTML(value) { this.html = value; },
        querySelector(selector) {
            if (selector === '[role="dialog"]') return dialog;
            if (selector === '[data-sp-overlay-abort]') return abort;
            if (selector === '[data-sp-overlay-status]') return status;
            return null;
        },
        addEventListener: (name, handler) => overlayListeners.set(name, handler),
        contains: target => [overlay, dialog, abort, status].includes(target),
        remove() { this.removed = true; },
    };
    const document = {
        activeElement: previous,
        createElement: () => overlay,
        getElementById: () => null,
        documentElement: { appendChild: () => {} },
        addEventListener(name, handler) { listeners.set(name, handler); },
        removeEventListener(name, handler) { if (listeners.get(name) === handler) listeners.delete(name); },
    };
    const mounted = mountStorageLockOverlay({ document, id: 'lock', title: '迁移', abortLabel: '中断' });
    assert.equal(calls[0], 'abort');
    let prevented = false;
    overlayListeners.get('keydown')({ key: 'Tab', preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(calls.at(-1), 'abort');
    mounted.close();
    assert.equal(overlay.removed, true);
    assert.equal(listeners.size, 0);
    assert.equal(calls.at(-1), 'previous');
});

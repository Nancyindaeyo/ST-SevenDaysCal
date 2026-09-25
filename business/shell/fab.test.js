import test from 'node:test';
import assert from 'node:assert/strict';
import { createFab } from './fab.js';

function fakeButton() {
    const listeners = new Map();
    return {
        listeners,
        addEventListener(type, fn) { listeners.set(type, fn); },
        setPointerCapture() {},
        hasPointerCapture() { return true; },
        releasePointerCapture() {},
        getBoundingClientRect() { return { left: 10, top: 20, width: 40, height: 40 }; },
        querySelector() { return this; },
        classList: { toggle() {}, remove() {}, add() {} },
        style: {},
    };
}

test('lost pointer capture and storage failure still end the gesture', () => {
    const button = fakeButton();
    const store = {
        setItem() { throw new Error('quota'); },
        getItem() { return null; },
    };
    const document = {
        getElementById: id => (id === 'sp-fab' ? { querySelector: () => button, style: {}, getBoundingClientRect: () => button.getBoundingClientRect() } : null),
        querySelectorAll: () => [],
        documentElement: { insertAdjacentHTML() {} },
    };
    createFab({
        $: () => ({ toggleClass() { return this; }, removeClass() { return this; }, addClass() { return this; } }),
        $in: () => ({ toggleClass() { return this; } }),
        document,
        window: {
            localStorage: store,
            innerWidth: 800,
            innerHeight: 600,
            addEventListener() {},
        },
        fabId: 'sp-fab',
        isMobile: () => false,
        fabEnabled: () => true,
        theme: () => 'night',
        markSurface() {},
    }).inject();
    const down = button.listeners.get('pointerdown');
    const move = button.listeners.get('pointermove');
    const lost = button.listeners.get('lostpointercapture');
    assert.equal(typeof lost, 'function');
    down.call(button, { isPrimary: true, button: 0, pointerId: 1, clientX: 10, clientY: 20 });
    move.call(button, { pointerId: 1, clientX: 40, clientY: 50, preventDefault() {} });
    assert.doesNotThrow(() => lost.call(button, { pointerId: 1, currentTarget: button }));
    assert.doesNotThrow(() => lost.call(button, { pointerId: 1, currentTarget: button }));
});

test('dispose releases the waiting wand observer', () => {
    const observers = [];
    const document = {
        getElementById: () => null,
        querySelectorAll: () => [],
        documentElement: { insertAdjacentHTML() {} },
        body: {},
    };
    const original = globalThis.MutationObserver;
    globalThis.MutationObserver = class {
        constructor(fn) { this.fn = fn; observers.push(this); }
        observe() { this.observed = true; }
        disconnect() { this.disconnected = true; }
    };
    try {
        const fab = createFab({
            $: () => ({ toggleClass() { return this; }, removeClass() { return this; }, addClass() { return this; } }),
            $in: () => ({ toggleClass() { return this; } }),
            document,
            window: { localStorage: { getItem: () => null, setItem() {} }, innerWidth: 800, innerHeight: 600, addEventListener() {} },
            fabId: 'sp-fab',
        });
        fab.injectExtButton();
        assert.equal(observers[0].observed, true);
        fab.dispose();
        assert.equal(observers[0].disconnected, true);
    } finally {
        globalThis.MutationObserver = original;
    }
});

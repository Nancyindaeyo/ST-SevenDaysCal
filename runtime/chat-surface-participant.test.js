import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatSurfaceParticipantHooks, ensureInlineRuntimeSource, INLINE_RUNTIME_ATTR } from './chat-surface-participant.js';

function fakeContent() {
    const children = [];
    const content = {
        children,
        ownerDocument: {
            createElement(tag) {
                const node = {
                    tagName: String(tag).toUpperCase(),
                    attrs: {},
                    children: [],
                    setAttribute(name, value) { this.attrs[name] = value; },
                    removeAttribute(name) { delete this.attrs[name]; },
                    getAttribute(name) { return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null; },
                    replaceChildren() { this.children.length = 0; },
                    querySelector() { return null; },
                    appendChild(child) { this.children.push(child); return child; },
                };
                return node;
            },
        },
        querySelector(sel) {
            if (sel === `[${INLINE_RUNTIME_ATTR}]`) return children.find(node => Object.hasOwn(node.attrs, INLINE_RUNTIME_ATTR)) || null;
            return null;
        },
        appendChild(child) { children.push(child); return child; },
    };
    return content;
}

test('prepareContent claims a placeholder and activate returns a disposer', () => {
    const calls = [];
    const hooks = createChatSurfaceParticipantHooks({
        getInlineHost: () => ({
            mountElement: el => calls.push(['mount', el]),
            unmountElement: el => calls.push(['unmount', el]),
        }),
        getCoordinate: () => ({
            mountMessageButton: () => calls.push('coord-mount'),
            unmountMessageButton: () => calls.push('coord-unmount'),
        }),
    });
    const content = fakeContent();
    const claimed = [];
    hooks.prepareContent({ content }, {
        claim(source, activate) { claimed.push({ source, activate }); },
    });
    assert.equal(claimed.length, 1);
    assert.equal(claimed[0].source.attrs[INLINE_RUNTIME_ATTR], '');
    const mes = { id: 'mes-1' };
    const dispose = claimed[0].activate({ element: mes, source: claimed[0].source });
    assert.equal(typeof dispose, 'function');
    assert.deepEqual(calls, [['mount', mes]]);
    dispose();
    assert.deepEqual(calls, [['mount', mes], ['unmount', mes]]);
    assert.equal(claimed[0].source.attrs['data-sp-inline-inert'], '');
});

test('didMount holds the coordinate button for the whole projection', () => {
    const calls = [];
    const hooks = createChatSurfaceParticipantHooks({
        getCoordinate: () => ({
            mountMessageButton: (el, opts) => calls.push(['mount', el, opts]),
            unmountMessageButton: el => calls.push(['unmount', el]),
        }),
    });
    const element = { id: 'mes' };
    const dispose = hooks.didMount({ element, mesid: '4' });
    assert.deepEqual(calls, [['mount', element, { rebindMessageId: 4 }]]);
    dispose();
    assert.deepEqual(calls.at(-1), ['unmount', element]);
});

test('prepareContent only injects the runtime source', () => {
    const hooks = createChatSurfaceParticipantHooks();
    const content = fakeContent();
    hooks.prepareContent({ content }, { claim() {} });
    assert.equal(content.children.length, 1);
    assert.equal(Object.hasOwn(content.children[0].attrs, INLINE_RUNTIME_ATTR), true);
    hooks.prepareContent({ content }, { claim() {} });
    assert.equal(content.children.length, 1);
});

test('didMount does not remount a coordinate button on the same projection', () => {
    const mounts = [];
    const hooks = createChatSurfaceParticipantHooks({
        getCoordinate: () => ({
            mountMessageButton: el => mounts.push(el),
            unmountMessageButton() {},
        }),
        getChatId: () => 'a',
    });
    const element = { id: 'mes' };
    hooks.didMount({ element, mesid: '2' });
    hooks.didMount({ element, mesid: '2' });
    assert.equal(mounts.length, 1);
});

test('old participant activate does not remount after a chat switch', () => {
    const calls = [];
    let chatId = 'a';
    const hooks = createChatSurfaceParticipantHooks({
        getInlineHost: () => ({
            mountElement: el => calls.push(['mount', el]),
            unmountElement: el => calls.push(['unmount', el]),
        }),
        getChatId: () => chatId,
    });
    const content = fakeContent();
    const claimed = [];
    hooks.prepareContent({ content }, {
        claim(source, activate) { claimed.push({ source, activate }); },
    });
    chatId = 'b';
    const dispose = claimed[0].activate({ element: { id: 'old' }, source: claimed[0].source });
    assert.deepEqual(calls, []);
    dispose();
    assert.deepEqual(calls, []);
});

test('didCommitContent skips mount when prepareContent already claimed the source', () => {
    const calls = [];
    const hooks = createChatSurfaceParticipantHooks({
        getInlineHost: () => ({ mountElement: () => calls.push('inline') }),
        getCoordinate: () => ({ mountMessageButton: () => calls.push('coord') }),
    });
    const content = fakeContent();
    ensureInlineRuntimeSource(content);
    const dispose = hooks.didCommitContent({ element: {}, content });
    assert.equal(dispose, undefined);
    assert.deepEqual(calls, []);
});

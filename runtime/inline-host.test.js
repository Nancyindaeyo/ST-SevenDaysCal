import test from 'node:test';
import assert from 'node:assert/strict';
import { createInlineHost } from './inline-host.js';

function makeHost(overrides = {}) {
    const calls = [];
    const feature = overrides.feature ?? {
        refresh: immediate => calls.push(['refresh', immediate]),
        clear: () => calls.push('clear'),
        mountElement: el => calls.push(['mount', el]),
        init: () => calls.push('init'),
        destroy: () => calls.push('destroy'),
    };
    const host = createInlineHost({
        feature,
        getChatId: () => 'c1',
        refreshLinesInjection: () => calls.push('lines-inject'),
        refreshStoryClockInjection: () => calls.push('clock-inject'),
        refreshLedgerInjection: () => calls.push('ledger-inject'),
        onChatDomChanged: () => calls.push('dom-changed'),
        isStreaming: () => false,
        scheduleRetry: (fn, ms) => calls.push(['retry', ms]),
        ...overrides,
        feature: overrides.feature === undefined ? feature : overrides.feature,
    });
    return { host, calls, feature };
}

test('syncLatest 换聊天中途作废，同聊天立即刷窗', () => {
    const { host, calls } = makeHost();
    host.syncLatest('other');
    assert.deepEqual(calls, []);
    host.syncLatest();
    host.syncLatest('c1');
    assert.deepEqual(calls, [['refresh', true], ['refresh', true]]);
});

test('syncLines 先重设线注入再刷窗', () => {
    const { host, calls } = makeHost();
    host.syncLines('c1');
    assert.deepEqual(calls, ['lines-inject', ['refresh', true]]);
    host.syncLines('other');
    assert.deepEqual(calls, ['lines-inject', ['refresh', true]]);
});

test('backfill 重设三路注入再立即挂窗', async () => {
    const { host, calls } = makeHost();
    await host.backfill();
    assert.deepEqual(calls, ['lines-inject', 'clock-inject', 'ledger-inject', ['refresh', true]]);
});

test('有 feature 时观察器只 init feature，没有 #chat 才重试', () => {
    const { host, calls } = makeHost();
    host.initObserver();
    assert.deepEqual(calls, ['init']);

    const retryCalls = [];
    const empty = createInlineHost({
        feature: null,
        documentRef: { querySelector: () => null },
        scheduleRetry: (fn, ms) => retryCalls.push(ms),
    });
    empty.initObserver();
    assert.deepEqual(retryCalls, [600]);
});

test('无 feature 时对 #chat 挂观察器，非流式才刷窗', () => {
    const observed = [];
    const calls = [];
    let trigger;
    class FakeObserver {
        constructor(cb) { trigger = cb; }
        observe(target, options) { observed.push({ target, options }); }
    }
    const chat = { id: 'chat' };
    const host = createInlineHost({
        feature: null,
        documentRef: { querySelector: sel => sel === '#chat' ? chat : null },
        MutationObserver: FakeObserver,
        onChatDomChanged: () => calls.push('dom-changed'),
        isStreaming: () => calls.includes('streaming'),
        scheduleRetry: () => calls.push('retry'),
    });
    host.initObserver();
    assert.equal(observed.length, 1);
    assert.equal(observed[0].target, chat);
    trigger();
    return new Promise(resolve => {
        setTimeout(() => {
            assert.deepEqual(calls, ['dom-changed']);
            resolve();
        }, 450);
    });
});

test('replaceFeature 先销毁旧实例', () => {
    const { host, calls } = makeHost();
    const next = { init: () => calls.push('init-next'), destroy: () => calls.push('destroy-next') };
    host.replaceFeature(next);
    assert.deepEqual(calls, ['destroy']);
    assert.equal(host.feature, next);
    host.init();
    assert.ok(calls.includes('init-next'));
});

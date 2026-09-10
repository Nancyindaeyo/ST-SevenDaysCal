import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimeTravelHost } from './time-travel-host.js';

function makeHost(overrides = {}) {
    let state = overrides.state ?? null;
    const calls = [];
    const host = createTimeTravelHost({
        createController: () => ({
            begin: payload => {
                calls.push(['begin', payload]);
                state = { phase: 'waiting', sessionId: 1, chatId: payload.chatId, sourceDate: payload.sourceDate, selectedTargetDate: payload.selectedTargetDate };
                return true;
            },
            clear: reason => { calls.push(['clear', reason]); state = null; },
            getState: () => state,
            isInitialFloor: () => false,
            handleRendered: async () => false,
        }),
        getChatId: () => 'c1',
        getContext: () => ({ chatId: 'c1', name1: '用户', name2: '角色' }),
        sourceDate: () => ({ month: 1, day: 1 }),
        validMonthDay: value => (value?.month && value?.day ? { month: +value.month, day: +value.day } : null),
        pluginEnabled: () => true,
        toast: msg => calls.push(['toast', msg]),
        confirm: async () => true,
        selectOne: async () => ({ value: 'daily', action: 'direct' }),
        inject: prompt => { calls.push(['inject', prompt]); return true; },
        automationGate: {
            release: token => calls.push(['release', token]),
            clear: () => calls.push(['gate-clear']),
        },
        dateCoordinator: { clear: () => calls.push(['date-clear']) },
        abortRelated: reason => calls.push(['abort', reason]),
        stripWaitingBlock: () => calls.push(['strip']),
        traceAbort: () => calls.push(['trace']),
        ...overrides,
    });
    return { host, calls, setState: next => { state = next; } };
}

test('start refuses the same day and a missing target', async () => {
    const { host, calls } = makeHost();
    assert.equal(await host.start({ month: 1, day: 1 }), false);
    assert.equal(await host.start(null), false);
    assert.equal(calls.some(call => call[0] === 'begin'), false);
});

test('start while syncing toasts and does not replace the session', async () => {
    const { host, calls } = makeHost({
        state: { phase: 'syncing', sessionId: 3, chatId: 'c1' },
    });
    assert.equal(await host.start({ month: 2, day: 2 }), false);
    assert.deepEqual(calls, [['toast', '时光旅行正在同步，完成或中断后才能开始新的时旅']]);
});

test('waiting travel is kept when replace is declined', async () => {
    const existing = { phase: 'waiting', sessionId: 7, chatId: 'c1' };
    const { host, calls } = makeHost({
        state: existing,
        confirm: async () => false,
    });
    assert.equal(await host.start({ month: 2, day: 2 }), false);
    assert.equal(calls.some(call => call[0] === 'clear'), false);
    assert.equal(host.getState()?.sessionId, 7);
});

test('waiting travel is cleared after replace is confirmed', async () => {
    const { host, calls } = makeHost({
        state: { phase: 'waiting', sessionId: 7, chatId: 'c1' },
    });
    assert.equal(await host.start({ month: 2, day: 2 }), true);
    assert.deepEqual(calls.filter(call => call[0] === 'clear'), [['clear', 'replaced']]);
    assert.ok(calls.some(call => call[0] === 'strip'));
    assert.ok(calls.some(call => call[0] === 'begin'));
});

test('replace aborts if the waiting session moved during confirm', async () => {
    const { host, calls, setState } = makeHost({
        state: { phase: 'waiting', sessionId: 7, chatId: 'c1' },
        confirm: async () => {
            setState({ phase: 'waiting', sessionId: 8, chatId: 'c1' });
            return true;
        },
    });
    assert.equal(await host.start({ month: 2, day: 2 }), false);
    assert.equal(calls.at(-1)[1], '时旅状态已经变化，本次没有覆盖当前会话');
    assert.equal(host.getState()?.sessionId, 8);
});

test('cancel declined leaves the waiting session', async () => {
    const { host, calls } = makeHost({
        state: { phase: 'waiting', sessionId: 4, chatId: 'c1' },
        confirm: async () => false,
    });
    assert.equal(await host.cancel(), false);
    assert.equal(calls.some(call => call[0] === 'clear'), false);
    assert.equal(host.getState()?.sessionId, 4);
});

test('cancel confirmed while waiting strips the prompt and toasts', async () => {
    const { host, calls } = makeHost({
        state: { phase: 'waiting', sessionId: 4, chatId: 'c1' },
    });
    assert.equal(await host.cancel(), true);
    assert.deepEqual(calls.filter(call => call[0] === 'clear'), [['clear', 'cancelled']]);
    assert.ok(calls.some(call => call[0] === 'strip'));
    assert.ok(calls.some(call => call[0] === 'toast' && String(call[1]).includes('已取消')));
});

test('message deletion aborts a syncing travel without stripping input', () => {
    const { host, calls } = makeHost({
        state: { phase: 'syncing', sessionId: 4, chatId: 'c1' },
    });
    assert.equal(host.cancelForDeletion(), true);
    assert.deepEqual(calls.filter(call => call[0] === 'clear'), [['clear', 'message-deleted']]);
    assert.equal(calls.some(call => call[0] === 'strip'), false);
    assert.ok(calls.some(call => call[0] === 'toast' && String(call[1]).includes('楼层已删除')));
});

test('resetSelection invalidates an in-flight direction pick', async () => {
    let resolvePick;
    const { host } = makeHost({
        selectOne: () => new Promise(resolve => { resolvePick = resolve; }),
    });
    const pending = host.start({ month: 3, day: 4 });
    host.resetSelection();
    resolvePick({ value: 'daily', action: 'direct' });
    assert.equal(await pending, false);
});

test('abortAll clears a waiting session and lets a new start proceed', async () => {
    const { host, calls } = makeHost({
        state: { phase: 'waiting', sessionId: 9, chatId: 'c1' },
    });
    assert.equal(host.abortAll('plugin-disabled'), true);
    assert.deepEqual(calls.filter(call => call[0] === 'clear'), [['clear', 'plugin-disabled']]);
    assert.ok(calls.some(call => call[0] === 'strip'));
    assert.ok(calls.some(call => call[0] === 'abort' && call[1] === 'plugin-disabled'));
    assert.equal(host.getState(), null);
    assert.equal(await host.start({ month: 4, day: 5 }), true);
});

test('sequence end releases the automation claim token', () => {
    let onSequenceEnd;
    const released = [];
    const host = createTimeTravelHost({
        createController: options => {
            onSequenceEnd = options.onSequenceEnd;
            return {
                begin: () => true,
                clear: () => {},
                getState: () => null,
                isInitialFloor: () => false,
                handleRendered: async () => false,
            };
        },
        automationGate: { release: token => released.push(token), clear() {} },
        getChatId: () => 'c1',
        sourceDate: () => ({ month: 1, day: 1 }),
        validMonthDay: value => value,
    });
    host.claimTokens.set(12, 'tok-12');
    onSequenceEnd({ sessionId: 12 });
    assert.deepEqual(released, ['tok-12']);
    assert.equal(host.claimTokens.size, 0);
});

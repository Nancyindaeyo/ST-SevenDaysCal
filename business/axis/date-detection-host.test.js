import test from 'node:test';
import assert from 'node:assert/strict';
import { createDateDetectionHost } from './date-detection-host.js';

function makeHost(overrides = {}) {
    const calls = [];
    let captured = null;
    const host = createDateDetectionHost({
        createController: options => {
            captured = options;
            return {
                apply: (charKey, md, notify) => {
                    calls.push(['apply', charKey, md, notify]);
                    return { status: 'updated', date: md };
                },
                reland: options => { calls.push(['reland', options]); return { status: 'handled' }; },
                run: options => { calls.push(['run', options]); return Promise.resolve({ status: 'updated' }); },
                abort: reason => calls.push(['abort', reason]),
                reset: reason => calls.push(['reset', reason]),
                get isBusy() { return false; },
                get abortController() { return { abort: reason => calls.push(['ctrl-abort', reason]) }; },
            };
        },
        captureGenerationContext: () => ({ chatId: 'c1', name2: '角色' }),
        charStableKey: ctx => ctx?.avatar || 'card.png',
        getContext: () => ({ avatar: 'card.png' }),
        config: () => ({ url: 'http://x', key: 'k' }),
        storyEnabled: () => true,
        storyDate: () => ({ month: 5, day: 4 }),
        storyClock: () => ({ floor: 2 }),
        completeStoryClock: () => true,
        identity: () => ({ chatId: 'c1', floor: 2, swipe: 0 }),
        getCalibration: key => ({ key, weekday: 1 }),
        calendarInjectText: () => '三月纪，每月三十日',
        callApi: async () => '5月4日',
        parse: raw => raw,
        bridge: () => () => {},
        getAnchor: () => null,
        setAnchor: () => ({ ok: true }),
        setAnchorConfirmed: (...args) => { calls.push(['confirmed', ...args]); return { ok: true }; },
        settings: () => ({ notifyMode: 'off' }),
        loadCalendar: () => ({ months: [{ name: '五月', days: 31 }] }),
        monthName: (cal, month) => `${cal.months[0].name}:${month}`,
        toast: msg => calls.push(['toast', msg]),
        aftermath: (source, info) => calls.push(['aftermath', source, info]),
        captureParticipantIdentity: () => ({ chatId: 'c1' }),
        sameParticipantIdentity: () => true,
        ...overrides,
    });
    return { host, calls, captured };
}

test('host maps calendar prompt, char key, calibration and confirmed write', () => {
    const { captured, calls } = makeHost();
    assert.match(captured.prompt(), /三月纪，每月三十日/);
    assert.equal(captured.charKey({ avatar: '坏狗.png' }), '坏狗.png');
    assert.deepEqual(captured.getCalibration(), { key: 'card.png', weekday: 1 });
    assert.equal(captured.monthName(5), '五月:5');
    captured.setAnchorConfirmed('ignored', 3, 4, 'detected', { year: 2024 }, { ownerGuard: true });
    assert.deepEqual(calls.find(call => call[0] === 'confirmed'), ['confirmed', 3, 4, 'detected', { year: 2024 }, { ownerGuard: true }]);
    captured.aftermath({ dayChanged: true });
    assert.deepEqual(calls.find(call => call[0] === 'aftermath'), ['aftermath', 'story', { dayChanged: true }]);
});

test('applyDetectedDate forwards notify; abort hits the controller getter', () => {
    const { host, calls } = makeHost();
    assert.equal(host.applyDetectedDate('card.png', { month: 5, day: 4 }, { notify: false }).status, 'updated');
    assert.deepEqual(calls[0], ['apply', 'card.png', { month: 5, day: 4 }, false]);
    host.abortController.abort('plugin-off');
    host.reset('chat-boundary');
    assert.deepEqual(calls.filter(call => call[0] === 'ctrl-abort' || call[0] === 'reset'), [
        ['ctrl-abort', 'plugin-off'],
        ['reset', 'chat-boundary'],
    ]);
});

test('aftermath stays on the story source and does not import time-travel', async () => {
    const { captured, calls, host } = makeHost();
    captured.aftermath({ dayChanged: false });
    assert.deepEqual(calls.find(call => call[0] === 'aftermath'), ['aftermath', 'story', { dayChanged: false }]);
    await host.run({ messageId: 2 });
    host.reland({ suppressAftermath: true });
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('./date-detection-host.js', import.meta.url), 'utf8'));
    assert.doesNotMatch(source, /time-travel|aftermath\.js/);
});

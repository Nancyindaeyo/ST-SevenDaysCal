import test from 'node:test';
import assert from 'node:assert/strict';
import { createPointActions } from './actions.js';

function pointActionsHarness(saveResult) {
    const effects = [];
    const saved = { raw: 'old', userName: '用户', ts: 1 };
    const env = {
        inShadow: () => ({ length: 0 }),
        $: value => value,
        getCacheKey: () => 'point-key',
        readStore: () => saved,
        writeStoreConfirmed: async (_key, _value, options) => {
            effects.push('write');
            assert.equal(options.ownerGuard(), true);
            if (saveResult instanceof Error) throw saveResult;
            return saveResult;
        },
        renderSchedule: raw => { effects.push('render'); return raw; },
        loadCalendar: () => null,
        togglePointPinRaw: () => ({ ok: true, raw: 'new', pinned: true }),
        setCached: () => effects.push('cache'),
        setBody: () => effects.push('body'),
        currentView: () => 'user',
        currentChar: () => '',
        syncLatestScheduleBlock: () => effects.push('sync'),
        showToast: (message, _action, error) => effects.push(error ? `error:${message}` : `toast:${message}`),
        chatId: () => 'chat-a',
        captureParticipantIdentity: () => ({ id: 'participant-a' }),
        sameParticipantIdentity: (left, right) => left.id === right.id,
    };
    return { actions: createPointActions(env), effects };
}

test('point pin does not redraw or report success when confirmed storage rejects', async () => {
    const harness = pointActionsHarness({ ok: false, reason: 'external-not-ready' });
    const result = await harness.actions.togglePin(0, 0);
    assert.equal(result, false);
    assert.deepEqual(harness.effects, [
        'write',
        'error:保存失败，数据未修改；请检查存储状态后重试',
    ]);
});

test('point pin redraws only after confirmed storage succeeds', async () => {
    const harness = pointActionsHarness({ ok: true, commitState: 'confirmed' });
    const result = await harness.actions.togglePin(0, 0);
    assert.equal(result, true);
    assert.deepEqual(harness.effects, [
        'write',
        'render',
        'cache',
        'body',
        'sync',
        'toast:已锁定这个点',
    ]);
});

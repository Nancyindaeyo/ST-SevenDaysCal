import test from 'node:test';
import assert from 'node:assert/strict';
import { createPointActions } from './actions.js';
import { parseCalendar } from './parse.js';
import { shiftPointCalendar } from './shift.js';

const raw = `<calendar_widget>
StartDate: 2024-05-01
Day: 1|晴|20℃
Event: main|昨天事项|保持原日期|上午|旧地||false
Day: 2
Event: main|今天事项|继续进行|下午|新地||false
Day: 3
Event: main|明天事项|尚未发生|晚上|远地||false
</calendar_widget>`;

test('滚动至今日保存过去事项，并在落地后补齐窗口', async () => {
    let saved = { raw, userName: '用户', ts: 1 };
    let fillCalled = 0;
    const activities = [];
    const actions = createPointActions({
        getCacheKey: () => 'point',
        readStore: () => saved,
        writeStoreConfirmed: async (_key, value) => { saved = value; return { ok: true, commitState: 'confirmed' }; },
        currentView: () => 'user',
        currentChar: () => '',
        today: () => ({ month: 5, day: 2 }),
        loadCalendar: () => ({ kind: 'gregorian' }),
        rollToToday: shiftPointCalendar,
        renderSchedule: () => '',
        setCached() {},
        setBody() {},
        syncLatestScheduleBlock() {},
        showToast() {},
        fillAfterRoll: async () => { fillCalled++; return { status: 'skipped', reason: 'test' }; },
        onActivity: entry => activities.push(entry),
        chatId: () => 'chat',
    });

    const result = await actions.rollToToday();
    const parsed = parseCalendar(saved.raw);
    assert.equal(result.status, 'updated');
    assert.equal(fillCalled, 1);
    assert.equal(parsed.startDate.getMonth() + 1, 5);
    assert.equal(parsed.startDate.getDate(), 2);
    assert.deepEqual(parsed.pastDays[0].events.map(item => item.title), ['昨天事项']);
    assert.equal(activities[0].items[0].action, 'archive');
});

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

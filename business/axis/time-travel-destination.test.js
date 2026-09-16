import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTimeTravelDestinationResolver } from './time-travel-destination.js';

function makeResolver(overrides = {}) {
    const calls = [];
    let chatId = overrides.chatId ?? 'c1';
    let renderKey = overrides.renderKey ?? { chatId: 'c1', messageId: 3, swipeId: 0, contentSignature: 'sig' };
    const resolver = createTimeTravelDestinationResolver({
        calendar: () => ({ kind: 'gregorian' }),
        validMonthDay: (value, cal) => (value?.month && value?.day ? { month: +value.month, day: +value.day, cal: cal?.kind } : null),
        getChatId: () => chatId,
        getChat: () => overrides.chat ?? [{ mes: '' }, { mes: '' }, { mes: '' }, { mes: overrides.mes || '' }],
        parseClock: mes => overrides.clock || { start: mes, end: mes },
        parseJudgedDate: raw => overrides.clockDate && raw ? overrides.clockDate : null,
        renderKey: () => renderKey,
        charKey: () => 'card.png',
        applyDetectedDate: (key, date, options) => {
            calls.push(['apply', key, date, options]);
            return overrides.applyResult || { status: 'updated' };
        },
        recordResult: (key, result) => calls.push(['record', key, result]),
        autoDetect: () => overrides.autoDetect,
        ensureResolved: async (key, options) => {
            calls.push(['ensure', key, { accept: options.acceptPrevious?.(overrides.previous ?? { status: 'unknown' }) }]);
            return overrides.judgeResult ?? { status: 'updated', date: { month: 8, day: 31 } };
        },
        runJudge: payload => { calls.push(['judge', payload]); return { status: 'updated', date: { month: 8, day: 31 } }; },
        toast: message => calls.push(['toast', message]),
        ...overrides.env,
    });
    return {
        resolver,
        calls,
        setChatId: next => { chatId = next; },
        setRenderKey: next => { renderKey = next; },
    };
}

test('clock stamp wins and is saved without running the date judge', async () => {
    const { resolver, calls } = makeResolver({
        clockDate: { month: 10, day: 4 },
        mes: '有戳',
    });
    assert.deepEqual(await resolver.resolve({
        chatId: 'c1',
        messageId: 3,
        selectedTargetDate: { month: 5, day: 4 },
    }), { month: 10, day: 4 });
    assert.equal(calls.some(call => call[0] === 'ensure'), false);
    assert.deepEqual(calls[0], ['apply', 'card.png', { month: 10, day: 4 }, { notify: false }]);
});

test('auto-detect off uses the selected day; missing selection and stale session fail closed', async () => {
    const off = makeResolver({ autoDetect: false });
    assert.deepEqual(await off.resolver.resolve({
        chatId: 'c1',
        messageId: 3,
        selectedTargetDate: { month: 5, day: 4 },
    }), { month: 5, day: 4, cal: 'gregorian' });
    assert.equal(off.calls.some(call => call[0] === 'ensure'), false);

    await assert.rejects(
        () => makeResolver().resolver.resolve({ chatId: 'c1', messageId: 3, selectedTargetDate: null }),
        { message: '无法读取时光旅行选择的目标日期' },
    );
    await assert.rejects(
        () => makeResolver().resolver.resolve({
            chatId: 'other',
            messageId: 3,
            selectedTargetDate: { month: 5, day: 4 },
        }),
        err => err.name === 'AbortError' && err.message === '时光旅行会话已失效',
    );
});

test('judge reuse accepts any previous object; cancelled and changed body abort', async () => {
    const reused = makeResolver({
        previous: { status: 'failed' },
        judgeResult: { status: 'updated', date: { month: 8, day: 31 } },
    });
    assert.deepEqual(await reused.resolver.resolve({
        chatId: 'c1',
        messageId: 3,
        selectedTargetDate: { month: 5, day: 4 },
    }), { month: 8, day: 31, cal: 'gregorian' });
    assert.equal(reused.calls.find(call => call[0] === 'ensure')[2].accept, true);
    assert.equal(reused.calls.some(call => call[0] === 'toast'), false);

    await assert.rejects(
        () => makeResolver({ judgeResult: { status: 'cancelled' } }).resolver.resolve({
            chatId: 'c1',
            messageId: 3,
            selectedTargetDate: { month: 5, day: 4 },
        }),
        err => err.name === 'AbortError' && err.message === '日期确认已取消',
    );

    const moved = makeResolver({
        judgeResult: { status: 'unknown' },
        env: {
            ensureResolved: async () => {
                moved.setRenderKey({ chatId: 'c1', messageId: 3, swipeId: 1, contentSignature: 'sig' });
                return { status: 'unknown' };
            },
        },
    });
    await assert.rejects(
        () => moved.resolver.resolve({
            chatId: 'c1',
            messageId: 3,
            selectedTargetDate: { month: 5, day: 4 },
        }),
        err => err.name === 'AbortError' && err.message === '正文版本已变化',
    );
});

test('unconfirmed body falls back to the selected day and this file stays out of date-detection', async () => {
    const { resolver, calls } = makeResolver({ judgeResult: { status: 'unknown' } });
    assert.deepEqual(await resolver.resolve({
        chatId: 'c1',
        messageId: 3,
        selectedTargetDate: { month: 5, day: 4 },
    }), { month: 5, day: 4, cal: 'gregorian' });
    assert.deepEqual(calls.at(-1), ['toast', '未能从正文确认日期，已采用你选择的时旅目标日']);

    const failed = makeResolver({
        clockDate: { month: 10, day: 4 },
        mes: '有戳',
        env: { applyDetectedDate: () => ({ status: 'failed' }) },
    });
    await assert.rejects(
        () => failed.resolver.resolve({
            chatId: 'c1',
            messageId: 3,
            selectedTargetDate: { month: 5, day: 4 },
        }),
        { message: '日期锚点保存失败' },
    );

    const source = await readFile(new URL('./time-travel-destination.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /date-detection-host|createDateDetectionHost/);
});

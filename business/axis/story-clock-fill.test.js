import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bindStoryClock } from './story-clock.js';
import { createStoryClockFillHost, draftStoryClockFillFields } from './story-clock-fill.js';

bindStoryClock({
    loadCalendar: () => ({ kind: 'gregorian' }),
    validMonthDay: ({ month, day }) => ({ month, day }),
    defaultCalendar: { kind: 'gregorian' },
});

function formatDate(value) {
    if (!value?.month || !value?.day) return '';
    return value.year ? `${value.year}年${value.month}月${value.day}日` : `${value.month}月${value.day}日`;
}

test('draft prefers this floor end stamp then previous then today', () => {
    assert.deepEqual(draftStoryClockFillFields({
        current: {
            endMeta: { valid: true, date: { month: 10, day: 4 }, weekdayText: '周五', time: '16:00' },
            startMeta: { valid: true, time: '15:30' },
        },
        previous: { endMeta: { time: '12:00' } },
        today: { month: 1, day: 1 },
        formatDate,
        weekdayFor: () => '周一',
    }), { date: '10月4日', weekday: '周五', startTime: '15:30', endTime: '16:00' });

    assert.deepEqual(draftStoryClockFillFields({
        current: {},
        previous: { startMeta: { date: { month: 10, day: 3 }, weekdayText: '周四', time: '20:00' } },
        formatDate,
    }), { date: '10月3日', weekday: '周四', startTime: '12:00', endTime: '12:00' });

    assert.deepEqual(draftStoryClockFillFields({
        current: {},
        previous: { endMeta: { date: { month: 10, day: 3 }, weekdayText: '周四', time: '21:00' } },
        formatDate,
    }), { date: '10月3日', weekday: '周四', startTime: '21:00', endTime: '21:00' });

    assert.deepEqual(draftStoryClockFillFields({
        current: {},
        today: { month: 5, day: 4 },
        formatDate,
        weekdayFor: (m, d) => `${m}-${d}`,
        weekdayRef: () => null,
    }), { date: '5月4日', weekday: '5-4', startTime: '12:00', endTime: '12:00' });
});

function makeHost(overrides = {}) {
    const calls = [];
    const chat = overrides.chat || [{ is_user: false, mes: '晚饭后闲聊。' }];
    let context = { chatId: 'c1', chat };
    const host = createStoryClockFillHost({
        getContext: () => context,
        latestAiFloor: list => (list.length ? { index: list.length - 1, text: list[list.length - 1].mes } : null),
        todayAnchor: () => { if (overrides.todayThrow) throw new Error('anchor'); return { month: 5, day: 4 }; },
        calendar: () => ({}),
        formatDate,
        monthName: (_cal, month) => `${month}月`,
        weekdayFor: () => '周三',
        weekdayRef: () => null,
        promptFields: async options => {
            calls.push(['prompt', options.title, options.fields.map(field => field.value)]);
            if (overrides.cancel) return null;
            return overrides.fields || { date: '10月4日', weekday: '周二', startTime: '15:30', endTime: '16:00' };
        },
        saveChat: () => calls.push('save'),
        emitEdited: messageId => calls.push(['edited', messageId]),
        holdConfirmedFloor: payload => calls.push(['hold', payload]),
        aftermath: source => calls.push(['aftermath', source]),
        toast: (message, _onClick, isError) => calls.push(['toast', message, isError === true]),
        paintActivity: () => calls.push('paint'),
        ...overrides.env,
    });
    return { host, calls, chat, setContext: next => { context = next; } };
}

test('fill writes hidden stamp through saveChat and MESSAGE_EDITED ports', async () => {
    const { host, calls, chat } = makeHost();
    assert.equal((await host.fill()).status, 'updated');
    assert.match(chat[0].mes, /SDC-start[\s\S]*晚饭后闲聊。[\s\S]*SDC-end/);
    assert.deepEqual(calls.filter(call => call === 'save' || call[0] === 'edited' || call[0] === 'hold' || call[0] === 'aftermath' || call === 'paint' || (Array.isArray(call) && call[0] === 'toast' && !call[2])), [
        'save',
        ['edited', 0],
        ['hold', { chatId: 'c1', messageId: 0 }],
        ['aftermath', 'story'],
        ['toast', '已补上这楼时间戳', false],
        'paint',
    ]);
});

test('fill fails closed without a floor, cancel, or a bad stamp', async () => {
    const empty = makeHost({ env: { latestAiFloor: () => null } });
    assert.equal((await empty.host.fill()).status, 'failed');
    assert.deepEqual(empty.calls[0], ['toast', '没有可补的 AI 楼', true]);

    const cancelled = makeHost({ cancel: true });
    assert.equal((await cancelled.host.fill()).status, 'cancelled');
    assert.equal(cancelled.calls.some(call => call === 'save'), false);

    const bad = makeHost({ fields: { date: '10月4日', weekday: '节日', startTime: '15:30', endTime: '16:00' } });
    assert.equal((await bad.host.fill()).status, 'failed');
    assert.equal(bad.calls.some(call => Array.isArray(call) && call[1] === '时间戳写不进去，请检查日期和时刻'), true);
});

test('fill host does not import tavern save or MESSAGE_EDITED internals', async () => {
    const source = await readFile(new URL('./story-clock-fill.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /script\.js|eventSource|event_types|saveChatDebounced/);
});

test('today anchor throw still drafts from the floor stamp', async () => {
    const { host, calls } = makeHost({
        todayThrow: true,
        env: {
            parseClock: () => ({
                startMeta: { valid: true, date: { month: 10, day: 4 }, weekdayText: '周二', time: '15:30' },
                endMeta: { valid: true, date: { month: 10, day: 4 }, weekdayText: '周二', time: '16:00' },
            }),
        },
    });
    await host.fill();
    assert.deepEqual(calls[0][2], ['10月4日', '周二', '15:30', '16:00']);
});

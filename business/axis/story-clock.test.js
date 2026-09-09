import test from 'node:test';
import assert from 'node:assert/strict';
import { _cnToNumber } from '../../utils/cn-date.js';
import { applyStoryClockToMessage, bindStoryClock, completeStoryClock, parseStoryClock, previousCompleteStoryClock, storyClockNarrativeBody } from './story-clock.js';

bindStoryClock({
    loadCalendar: () => ({ kind: 'gregorian' }),
    validMonthDay: ({ month, day }) => ({ month, day }),
    defaultCalendar: { kind: 'gregorian' },
    cnToNumber: _cnToNumber,
});

test('applyStoryClockToMessage wraps body and parses a complete stamp', () => {
    const applied = applyStoryClockToMessage('晚饭后闲聊。', {
        date: '10月4日',
        weekday: '周二',
        startTime: '15:30',
        endTime: '16:00',
    });
    assert.equal(applied.ok, true);
    assert.equal(storyClockNarrativeBody(applied.text), '晚饭后闲聊。');
    assert.equal(completeStoryClock(applied.clock), true);
    assert.equal(applied.clock.endMeta.month, 10);
    assert.equal(applied.clock.endMeta.day, 4);
    assert.equal(applied.clock.startMeta.time, '15:30');
    assert.equal(applied.clock.endMeta.time, '16:00');
});

test('applyStoryClockToMessage rejects incomplete weekday or time', () => {
    const applied = applyStoryClockToMessage('正文', { date: '10月4日', weekday: '节日', startTime: '15:30', endTime: '16:00' });
    assert.equal(applied.ok, false);
});

test('previousCompleteStoryClock walks back past user floors', () => {
    const prev = applyStoryClockToMessage('上楼', { date: '10月3日', weekday: '周一', startTime: '20:00', endTime: '21:00' }).text;
    const clock = previousCompleteStoryClock([
        { is_user: false, mes: prev },
        { is_user: true, mes: '玩家' },
        { is_user: false, mes: '这楼漏戳了' },
    ], 2);
    assert.equal(clock.endMeta.day, 3);
    assert.equal(parseStoryClock('这楼漏戳了').end, null);
});

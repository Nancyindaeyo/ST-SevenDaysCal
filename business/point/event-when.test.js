import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCalendar } from './parse.js';
import { composeEventWhen, dayKeyForMonthDay, splitEventWhen } from './event-when.js';

test('拆开未来事项里的日期和钟点', () => {
    assert.deepEqual(splitEventWhen('5月4日 上午'), { year: '', month: '5', day: '4', clock: '上午' });
    assert.deepEqual(splitEventWhen('2026年5月6日 14:00-15:00'), { year: '2026', month: '5', day: '6', clock: '14:00-15:00' });
    assert.equal(splitEventWhen('未定').clock, '未定');
    assert.equal(composeEventWhen({ month: 5, day: 4, clock: '上午' }, { withDate: true }), '5月4日 上午');
    assert.equal(composeEventWhen({ month: 5, day: 1, clock: '13:00-13:30' }, { withDate: false }), '13:00-13:30');
});

test('月日对得上窗口里的哪一天，对不上就进未来', () => {
    const parsed = parseCalendar(`<calendar_widget>
StartDate: 2024-05-01
Day: 1
Event: main|今天|描述|早|地|动
Day: 2
Event: main|明天|描述|午|地|动
Day: 3
Event: main|后天|描述|晚|地|动
</calendar_widget>`);
    assert.equal(dayKeyForMonthDay(parsed, 5, 1), 0);
    assert.equal(dayKeyForMonthDay(parsed, 5, 2), 1);
    assert.equal(dayKeyForMonthDay(parsed, 5, 4), 'future');
});

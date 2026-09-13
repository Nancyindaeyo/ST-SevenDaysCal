import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCalendar } from './parse.js';
import { composeEventWhen, dayKeyForMonthDay, parsePointDayDate, splitEventWhen } from './event-when.js';

test('拆开未来事项里的日期和钟点', () => {
    assert.deepEqual(splitEventWhen('5月4日 上午'), { year: '', month: '5', day: '4', clock: '上午' });
    assert.deepEqual(splitEventWhen('2026年5月6日 14:00-15:00'), { year: '2026', month: '5', day: '6', clock: '14:00-15:00' });
    assert.deepEqual(splitEventWhen('09:00-11:30'), { year: '', month: '', day: '', clock: '09:00-11:30' });
    assert.deepEqual(splitEventWhen('2027-05-04'), { year: '2027', month: '5', day: '4', clock: '' });
    assert.equal(splitEventWhen('未定').clock, '未定');
    assert.equal(composeEventWhen({ month: 5, day: 4, clock: '上午' }, { withDate: true }), '5月4日 上午');
    assert.equal(composeEventWhen({ month: 5, day: 1, clock: '13:00-13:30' }, { withDate: false }), '13:00-13:30');
    assert.deepEqual(parsePointDayDate('5月4日'), { year: '', month: 5, day: 4 });
    assert.equal(parsePointDayDate('晴'), null);
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

test('日头带日期时仍能对上格子，旧日头不受影响', () => {
    const parsed = parseCalendar(`<calendar_widget>
StartDate: 2024-05-01
Day: 1|5月1日|晴|18℃
Event: main|今天|描述|09:00-11:30|地|动
Day: 2|阴|16℃
Event: main|明天|描述|午|地|动
</calendar_widget>`);
    assert.equal(parsed.days[0].date.month, 5);
    assert.equal(parsed.days[0].date.day, 1);
    assert.equal(parsed.days[0].weather, '晴');
    assert.equal(parsed.days[1].weather, '阴');
    assert.equal(parsed.days[1].date, undefined);
    assert.equal(dayKeyForMonthDay(parsed, 5, 1), 0);
});

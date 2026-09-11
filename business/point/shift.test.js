import test from 'node:test';
import assert from 'node:assert/strict';
import { daysForwardToToday, pointTodayDayIndex, shiftPointCalendar } from './shift.js';
import { parseCalendar } from './parse.js';

const widget = (start, days) => `<calendar_widget>
StartDate: ${start}
${days}
</calendar_widget>`;

test('4.14 过了之后滚到 4.15，并把昨日事项原样归入过去', () => {
    const raw = widget('2024-04-14', `Day: 1|晴|18℃
Event: main|体检|去做体检|上午|医院||false
Event: main|锁着的会|保留锁定|下午|教室||true
Day: 2|阴|16℃
Event: main|合宿报到|去宿舍|上午|基地||false
Day: 3|雨|14℃
Event: main|练习赛|上场|下午|球场||false
Future:
Event: main|暑假旅行|以后再说|未定|海边||false`);
    const result = shiftPointCalendar(raw, { month: 4, day: 15 });
    assert.equal(result.changed, true);
    assert.equal(result.delta, 1);
    assert.deepEqual(result.archived.map(item => item.title), ['体检', '锁着的会']);
    assert.match(result.raw, /StartDate: 2024-04-15/);
    assert.match(result.raw, /Day: 1\|阴\|16℃/);
    assert.match(result.raw, /合宿报到/);
    assert.match(result.raw, /PastDay: 2024-04-14\|晴\|18℃/);
    const parsed = parseCalendar(result.raw);
    assert.deepEqual(parsed.pastDays[0].events.map(item => item.title), ['体检', '锁着的会']);
    assert.deepEqual(parsed.future.events.map(item => item.title), ['暑假旅行']);
});

test('同一天不挪；往回拨日期也不猜格子', () => {
    const raw = widget('2024-04-15', 'Day: 1\nEvent: main|今天|描述|早|地||false\n');
    assert.equal(shiftPointCalendar(raw, { month: 4, day: 15 }).changed, false);
    assert.equal(shiftPointCalendar(raw, { month: 4, day: 14 }).changed, false);
    assert.equal(daysForwardToToday({ year: 2024, month: 12, day: 31 }, { month: 1, day: 1 }), 1);
});

test('今日游标定位窗口里的真实日期，不把 Day 1 永远当今天', () => {
    const raw = widget('2024-05-01', `Day: 1
Event: main|昨天|描述|早|地||false
Day: 2
Event: main|今天|描述|早|地||false`);
    assert.equal(pointTodayDayIndex(raw, { month: 5, day: 2 }), 1);
});

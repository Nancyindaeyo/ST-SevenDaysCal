import test from 'node:test';
import assert from 'node:assert/strict';
import { formatStoryClockHeadParts, formatStoryClockMeta } from './clock-format.js';

const gregorian = { kind: 'gregorian', id: 'default-gregorian' };
const custom = { kind: 'custom', months: [{ name: '霜月', days: 40 }] };

test('custom calendar overflow shows pending date and keeps weekday or time', () => {
    const html = formatStoryClockMeta({ valid: false, raw: '霜月40日', weekdayText: '周二', time: '15:30' }, v => v, custom);
    assert.match(html, /日期待确认/);
    assert.match(html, /周二/);
    assert.match(html, /15:30/);
    assert.doesNotMatch(html, /霜月40日/);
});

test('gregorian overflow still shows the raw stamp', () => {
    assert.equal(formatStoryClockMeta({ valid: false, raw: '13月40日' }, v => v, gregorian), '13月40日');
});

test('custom calendar head parts fall back to the confirmed anchor', () => {
    const parts = formatStoryClockHeadParts({
        anchor: { month: 1, day: 2, time: '09:00' },
        anchorWeekday: '周一',
        rawStamp: '霜月40日',
        stampDate: { month: 10, day: 8, time: '15:10' },
        calendar: custom,
        monthName: () => '霜月',
        escapeHtml: v => v,
    });
    assert.match(parts.todayHtml, /霜月/);
    assert.match(parts.todayHtml, /周一/);
    assert.doesNotMatch(parts.todayHtml, /霜月40日/);
    assert.doesNotMatch(parts.todayHtml, /15:10/);
    assert.match(parts.timeHtml, /09:00/);
});

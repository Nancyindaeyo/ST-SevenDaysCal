import test from 'node:test';
import assert from 'node:assert/strict';
import { createAxisDateActions } from './date-actions.js';
import { addCalendarDays, calendarDate } from '../calendar/date.js';

test('nudgeToday with a year uses real add-day and keeps time', () => {
    const writes = [];
    const actions = createAxisDateActions({
        charKey: () => 'card',
        calendar: () => ({ kind: 'gregorian' }),
        today: () => ({ year: 2024, month: 12, day: 31, time: '15:30' }),
        addCalendarDays,
        monthDayFromDoy: () => { throw new Error('year-ring must not run'); },
        repository: {
            set(month, day, source, options = {}) {
                writes.push({ month, day, source, options });
                return { ok: true };
            },
        },
    });
    const result = actions.nudgeToday(1);
    assert.equal(result.ok, true);
    assert.deepEqual(result.date, { year: 2025, month: 1, day: 1, time: '15:30' });
    assert.equal(writes[0].month, 1);
    assert.equal(writes[0].day, 1);
    assert.equal(writes[0].options.year, 2025);
    assert.equal(writes[0].options.time, '15:30');
});

test('nudgeToday without a year still uses the year ring', () => {
    const actions = createAxisDateActions({
        charKey: () => 'card',
        calendar: () => ({ kind: 'gregorian' }),
        today: () => ({ month: 12, day: 31 }),
        addCalendarDays,
        monthDayFromDoy: () => calendarDate(null, 1, 1),
        dayOfYear: () => 366,
        repository: { set: () => ({ ok: true }) },
    });
    const result = actions.nudgeToday(1);
    assert.equal(result.ok, true);
    assert.equal(result.date.month, 1);
    assert.equal(result.date.day, 1);
    assert.equal(result.date.year == null, true);
});

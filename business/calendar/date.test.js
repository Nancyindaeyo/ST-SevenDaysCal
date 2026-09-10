import test from 'node:test';
import assert from 'node:assert/strict';
import { addCalendarDays, gregorianWeekdayRef, weekdayFor, calendarDate } from './date.js';

test('gregorianWeekdayRef computes 2024-08-31 as Saturday', () => {
    const ref = gregorianWeekdayRef({ year: 2024, month: 8, day: 31 });
    assert.equal(ref.source, 'ymd');
    assert.equal(ref.refWd, 6);
    assert.equal(weekdayFor(calendarDate(2024, 8, 31)), 6);
});

test('gregorianWeekdayRef keeps an adjacent weekday over the real calendar', () => {
    const ref = gregorianWeekdayRef({ year: 2024, month: 8, day: 31 }, { weekday: 0 });
    assert.equal(ref.source, 'explicit');
    assert.equal(ref.refWd, 0);
});

test('gregorianWeekdayRef does not guess custom calendars', () => {
    assert.equal(gregorianWeekdayRef({ year: 2024, month: 8, day: 31 }, { calendar: { kind: 'custom', months: [{ name: '春', days: 30 }] } }), null);
});

test('addCalendarDays crosses the year when the date has a year', () => {
    assert.deepEqual(addCalendarDays(calendarDate(2024, 12, 31), 1, { kind: 'gregorian' }), calendarDate(2025, 1, 1));
    assert.equal(addCalendarDays(calendarDate(null, 12, 31), 1, { kind: 'gregorian' }), null);
});

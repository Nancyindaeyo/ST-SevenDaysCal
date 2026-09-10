import test from 'node:test';
import assert from 'node:assert/strict';
import { bindLedgerDate, ledgerDueInfo } from './date.js';
import { daysBetweenCalendarDates } from '../axis/full-ordinal.js';

bindLedgerDate({
    today: () => ({ year: 2025, month: 1, day: 10 }),
    daysUntil: () => 20,
    daysUntilFull: (from, to) => daysBetweenCalendarDates(from, to, { kind: 'gregorian' }),
});

test('one-shot and cycle due dates stay unknown without a year', () => {
    assert.equal(ledgerDueInfo({ 类型: '约定待办', 到期锚: { 历日期: { month: 1, day: 1 } } }, { month: 1, day: 10 }), null);
    assert.equal(ledgerDueInfo({ 类型: '周期', 周期长度: 28, 到期锚: { 历日期: { month: 1, day: 1 } } }, { month: 1, day: 10 }), null);
});

test('dated cycle uses full ordinal instead of the year ring', () => {
    const due = ledgerDueInfo(
        { 类型: '周期', 周期长度: 28, 到期锚: { 历日期: { year: 2025, month: 1, day: 20 } } },
        { year: 2025, month: 1, day: 10 },
    );
    assert.deepEqual(due, { 天数: 10, 过期: false });
    const overdue = ledgerDueInfo(
        { 类型: '周期', 周期长度: 28, 到期锚: { 历日期: { year: 2024, month: 12, day: 31 } } },
        { year: 2025, month: 1, day: 10 },
    );
    assert.equal(overdue.过期, true);
    assert.equal(overdue.天数, 10);
});

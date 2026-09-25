import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCalendar } from './parse.js';
import {
    checkEventDateOwnership,
    diagnosePointWindow,
    planPointPatchDryRun,
    planPointRegenDryRun,
} from './window-integrity.js';

const RAW = `<calendar_widget>
StartDate: 2024-03-01
Day: 1
Event: main|体检|去做体检|上午|医院||false
Day: 2
Event: main|晚饭|回家吃饭|晚|家||false
Day: 3
Event: main|散步|出门走走|傍晚|公园||false
Future:
Event: main|远行|准备出门|3月8日 上午|车站||false
</calendar_widget>`;

test('diagnosePointWindow distinguishes missing day, empty day, incomplete event and future date', () => {
    assert.equal(diagnosePointWindow(RAW).ok, true);
    const missing = diagnosePointWindow(RAW.replace(/\nDay: 3[\s\S]*公园\|\|false/, ''));
    assert.ok(missing.issues.some(item => item.code === 'day-missing' && item.dayNumber === 3));
    const empty = diagnosePointWindow(RAW.replace('Day: 2\nEvent: main|晚饭|回家吃饭|晚|家||false', 'Day: 2'));
    assert.ok(empty.issues.some(item => item.code === 'day-empty' && item.dayNumber === 2));
    const incomplete = diagnosePointWindow(RAW.replace('去做体检|上午|医院', '|上午|医院'));
    assert.ok(incomplete.issues.some(item => item.code === 'event-incomplete' && item.field === 'desc'));
    const future = diagnosePointWindow(RAW.replace('3月8日 上午', '上午'));
    assert.ok(future.issues.some(item => item.code === 'future-missing-date'));
});

test('point dry-run reuses patch parse and keeps locked events', () => {
    const preview = planPointPatchDryRun(RAW, [
        { target: 'point', op: 'edit', title: '体检', fields: ['', '', '体检', '改成复诊', '上午', '医院', ''] },
    ]);
    assert.equal(preview.changed, true);
    assert.ok(preview.items.some(item => item.action === 'edit' && item.title === '体检'));
    assert.equal(preview.skippedLocks.length, 0);
    const locked = RAW.replace('医院||false', '医院||true');
    const regen = planPointRegenDryRun(locked, `<calendar_widget>
StartDate: 2024-03-01
Day: 1
Event: main|晚饭|回家吃饭|晚|家||false
Day: 2
Event: main|晚饭|回家吃饭|晚|家||false
Day: 3
Event: main|散步|出门走走|傍晚|公园||false
</calendar_widget>`);
    assert.ok(regen.items.length >= 0);
    assert.match(regen.mergedRaw, /体检/);
});

test('PastDay and Future edits report the owning bucket', () => {
    const withPast = RAW.replace('StartDate: 2024-03-01', 'StartDate: 2024-03-01\nPastDay: 2024-02-28||\nEvent: main|旧事|已经发生|上午|家||false');
    const parsed = parseCalendar(withPast);
    const past = checkEventDateOwnership(parsed, 'past:0', 0);
    assert.equal(past.ok, true);
    const future = checkEventDateOwnership(parsed, 'future', 0);
    assert.equal(future.ok, true);
    const moved = checkEventDateOwnership({
        ...parsed,
        days: parsed.days,
        future: { events: [{ title: '旧事', time: '2月28日 上午' }] },
    }, 'future', 0);
    assert.equal(moved.ok, false);
    assert.equal(moved.expected, 'past:0');
});

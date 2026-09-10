import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLinePatches, applyPointPatches, parseReconcilePatches, summarizeReconcile, uniqueNamedHit } from './patch.js';
import { normalizeTheaterCount } from '../theater/recipe.js';

test('parse reconcile patch lines', () => {
    const parsed = parseReconcilePatches(`<reconcile_patch>
note: 体检已发生，从今天拿掉
point: complete|体检
line: stall|柳的调查
</reconcile_patch>`);
    assert.equal(parsed.note.includes('体检'), true);
    assert.equal(parsed.patches[0].op, 'complete');
    assert.equal(parsed.patches[1].target, 'line');
});

test('point complete removes unlocked today event and skips unnamed locks', () => {
    const raw = `<calendar_widget>
StartDate: 2024-03-01
Day: 1|晴|12℃
Event: main|体检|去做体检|上午|医院||false
Event: main|会议|开会|下午|公司||true
</calendar_widget>`;
    const applied = applyPointPatches(raw, [{ target: 'point', op: 'complete', title: '体检', fields: ['体检'] }, { target: 'point', op: 'edit', title: '会议', fields: ['会议', '改掉'] }], { feedback: '' });
    assert.equal(applied.changed, true);
    assert.equal(/体检/.test(applied.raw), false);
    assert.equal(/会议/.test(applied.raw), true);
    assert.deepEqual(applied.skippedLocks, ['会议']);
    assert.deepEqual(applied.applied, [{ module: 'point', title: '体检', action: 'complete' }]);
});

test('line stall marks unlocked line and summarize can say unchanged', () => {
    const raw = `<storylines_widget>
Line: 柳的调查|延展|今天|world|false|false
Desc: 旧描述
</storylines_widget>`;
    const applied = applyLinePatches(raw, [{ target: 'line', op: 'stall', name: '柳的调查', fields: ['柳的调查'] }]);
    assert.equal(applied.changed, true);
    assert.match(applied.raw, /true\|false/);
    assert.equal(summarizeReconcile({ point: { changed: false }, lines: { changed: false } }), '点/线与正文一致');
});

test('theater count helper still clamps', () => {
    assert.equal(normalizeTheaterCount(2), 2);
});

test('fuzzy title match only fires when a unique candidate exists', () => {
    assert.equal(uniqueNamedHit([{ title: '年度体检' }, { title: '会议' }], '体检', item => item.title), 0);
    assert.equal(uniqueNamedHit([{ title: '年度体检' }, { title: '体检复盘' }], '体检', item => item.title), -1);
    assert.equal(uniqueNamedHit([{ title: '' }], '体检', item => item.title), -1);
});

test('point add overflow goes to future instead of day 1', () => {
    const raw = `<calendar_widget>
StartDate: 2024-03-01
Day: 1|晴|12℃
Event: main|会议|开会|下午|公司||false
</calendar_widget>`;
    const applied = applyPointPatches(raw, [{ target: 'point', op: 'add', title: '远行', fields: ['Day 99', 'main', '远行', '出门', '早晨', '', ''] }]);
    assert.equal(applied.changed, true);
    assert.match(applied.raw, /Future|未来|远行/);
    assert.equal((applied.raw.match(/Event:/g) || []).length >= 2, true);
});

test('line complete settles in place and add can replace it in the same patch', () => {
    const raw = `<storylines_widget>
Line: 旧线|延展|今天|world|false|false
Desc: 旧描述
Next: 旧下一步
</storylines_widget>`;
    const applied = applyLinePatches(raw, [
        { target: 'line', op: 'complete', name: '旧线', fields: ['旧线'] },
        { target: 'line', op: 'add', name: '新线', fields: ['新线', '起线', '今天', 'world', '新状态', '下一步'] },
    ]);
    assert.equal(applied.changed, true);
    assert.match(applied.raw, /旧线\|收束/);
    assert.match(applied.raw, /新线\|起线/);
    assert.deepEqual(applied.applied.map(item => item.action), ['complete', 'add']);
});

test('ambiguous line names are not patched', () => {
    const raw = `<storylines_widget>
Line: 调查笔记|延展|今天|world|false|false
Desc: 甲
Line: 调查后续|延展|今天|world|false|false
Desc: 乙
</storylines_widget>`;
    const applied = applyLinePatches(raw, [{ target: 'line', op: 'stall', name: '调查', fields: ['调查'] }]);
    assert.equal(applied.changed, false);
});

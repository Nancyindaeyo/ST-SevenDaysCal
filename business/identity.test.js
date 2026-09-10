import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureBookId, findBookIndex, sameBookItem } from './identity.js';
import { parseCalendar, serializeCalendar, samePoint } from './point/parse.js';
import { parseLines, serializeLines, sameLine } from './lines/schema.js';

test('point Id survives parse/serialize and rename', () => {
    const raw = `<calendar_widget>
StartDate: 2024-03-01
Day: 1
Event: main|体检|去做体检|上午|医院||false
Id: POINT-keep
</calendar_widget>`;
    const parsed = parseCalendar(raw);
    const event = parsed.days[0].events[0];
    assert.equal(event.id, 'POINT-keep');
    event.title = '年度体检';
    const next = parseCalendar(serializeCalendar(parsed.allDays || parsed.days, parsed.future, parsed.startDate));
    assert.equal(next.days[0].events[0].id, 'POINT-keep');
    assert.equal(samePoint(event, next.days[0].events[0]), true);
});

test('line Id survives parse/serialize and rename', () => {
    const raw = `<storylines_widget>
Line: 调查|延展|今天|world|false|false
Desc: 旧
Next: 下一步
Id: LINE-keep
</storylines_widget>`;
    const parsed = parseLines(raw);
    assert.equal(parsed[0].id, 'LINE-keep');
    parsed[0].name = '新调查';
    const next = parseLines(serializeLines(parsed));
    assert.equal(next[0].id, 'LINE-keep');
    assert.equal(sameLine(parsed[0], next[0]), true);
});

test('sameBookItem prefers id over title', () => {
    assert.equal(sameBookItem({ id: 'POINT-a', title: '旧名' }, { id: 'POINT-a', title: '新名' }, 'title'), true);
    assert.equal(sameBookItem({ title: '体检' }, { title: '体检' }, 'title'), true);
    assert.equal(sameBookItem({ id: 'POINT-a', title: '体检' }, { id: 'POINT-b', title: '体检' }, 'title'), false);
});

test('ensureBookId fills blanks and avoids collisions', () => {
    const seen = new Set();
    const a = {};
    const b = { id: 'LINE-keep' };
    const c = { id: 'LINE-keep' };
    assert.match(ensureBookId(a, 'LINE', seen), /^LINE-/);
    assert.equal(ensureBookId(b, 'LINE', seen), 'LINE-keep');
    assert.notEqual(ensureBookId(c, 'LINE', seen), 'LINE-keep');
    assert.equal(seen.size, 3);
});

test('findBookIndex uses id then unique name', () => {
    const items = [{ id: 'POINT-1', title: '年度体检' }, { id: 'POINT-2', title: '会议' }];
    assert.equal(findBookIndex(items, { id: 'POINT-2', nameOf: 'title' }), 1);
    assert.equal(findBookIndex(items, { name: '会议', nameOf: 'title' }), 1);
    assert.equal(findBookIndex(items, { name: '体检', nameOf: 'title' }), 0);
    assert.equal(findBookIndex([{ title: '年度体检' }, { title: '体检复盘' }], { name: '体检', nameOf: 'title' }), -1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLinesRaw, migrateOutlineRaw, migratePointRaw } from './identity-migrate.js';
import { parseOutline } from './outline/schema.js';
import { parseCalendar } from './point/parse.js';
import { parseLines } from './lines/schema.js';

test('point migration assigns missing Id and keeps existing ones', () => {
    const raw = `<calendar_widget>
StartDate: 2024-03-01
Day: 1
Event: main|体检|去做体检|上午|医院||false
Id: POINT-keep
Day: 2
Event: main|晚饭|回家吃饭|晚|家||false
</calendar_widget>`;
    const skipped = migratePointRaw(raw.replace(/\nDay: 2[\s\S]*false/, ''));
    assert.equal(skipped.changed, false);
    const result = migratePointRaw(raw);
    assert.equal(result.changed, true);
    const parsed = parseCalendar(result.raw);
    assert.equal(parsed.days[0].events[0].id, 'POINT-keep');
    assert.match(parsed.days[1].events[0].id, /^POINT-/);
    assert.doesNotMatch(result.raw, /Id: POINT-keep[\s\S]*Id: POINT-keep/);
});

test('line migration is a no-op when every line already has Id', () => {
    const raw = `<storylines_widget>
Line: 调查|延展|今天|world|false|false
Desc: 旧
Next: 下一步
Id: LINE-keep
</storylines_widget>`;
    assert.equal(migrateLinesRaw(raw).changed, false);
    const missing = migrateLinesRaw(raw.replace(/\nId: LINE-keep/, ''));
    assert.equal(missing.changed, true);
    assert.equal(parseLines(missing.raw)[0].id.startsWith('LINE-'), true);
    assert.notEqual(parseLines(missing.raw)[0].id, 'LINE-keep');
});

test('outline migration assigns missing Id and keeps existing ones', () => {
    const raw = `<outline_widget>
Beat: 春|开端|主线|线|转折
Scene: 发生了
Subtext: 题记
Think: 思考
Id: OUTLINE-keep
Beat: 夏|转折|主线|线|转折
Scene: 又发生了
Subtext: 题记
Think: 思考
</outline_widget>`;
    assert.equal(migrateOutlineRaw(raw).changed, true);
    const beats = parseOutline(migrateOutlineRaw(raw).raw);
    assert.equal(beats[0].id, 'OUTLINE-keep');
    assert.match(beats[1].id, /^OUTLINE-/);
});

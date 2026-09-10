import test from 'node:test';
import assert from 'node:assert/strict';
import { alignPointStartDate, pointStartNeedsAlign } from './date-align.js';

const widget = `<calendar_widget>
StartDate: 2024-04-30
Day: 1|晴|18℃
Event: main|复检|去做复检|13:00-13:30|医务室|陪同||false
Day: 2|阴|16℃
Event: main|报到|去宿舍|上午|基地||false
Day: 3|雨|14℃
Event: main|练习赛|上场|下午|球场||false
Future:
Event: main|暑假|以后再说|未定|海边||false
</calendar_widget>`;

test('对齐日期只改 StartDate，事项和未来都还在', () => {
    assert.equal(pointStartNeedsAlign(widget, { month: 5, day: 1 }), true);
    const result = alignPointStartDate(widget, { month: 5, day: 1 });
    assert.equal(result.changed, true);
    assert.match(result.raw, /StartDate: 2024-05-01/);
    assert.match(result.raw, /复检/);
    assert.match(result.raw, /报到/);
    assert.match(result.raw, /练习赛/);
    assert.match(result.raw, /暑假/);
    assert.doesNotMatch(result.raw, /Day: 0/);
    assert.equal(alignPointStartDate(result.raw, { month: 5, day: 1 }).changed, false);
});

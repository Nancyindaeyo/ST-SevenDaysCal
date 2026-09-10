import test from 'node:test';
import assert from 'node:assert/strict';
import { appendHorizonDays, horizonExistingSummary, planAdvanceSteps, pointHorizonGap } from './horizon.js';

const widget = (start, days) => `<calendar_widget>
StartDate: ${start}
${days}
</calendar_widget>`;

const oneDay = widget('2024-04-30', `Day: 1|晴|18℃
Event: main|体检|去做体检|上午|医院||false
Future:
Event: main|暑假|以后再说|未定|海边||false`);

test('窗口不足 3 天才有 gap；空账不当补齐', () => {
    assert.equal(pointHorizonGap(oneDay), 2);
    assert.equal(pointHorizonGap(''), 0);
    assert.match(horizonExistingSummary(oneDay), /Day 1：体检/);
});

test('补齐只追加后面的天，保留已有格子和未来', () => {
    const fill = widget('2024-05-01', `Day: 1|阴|16℃
Event: main|报到|去宿舍|上午|基地||false
Day: 2|雨|14℃
Event: main|练习赛|上场|下午|球场||false`);
    const result = appendHorizonDays(oneDay, fill);
    assert.equal(result.added, 2);
    assert.match(result.raw, /StartDate: 2024-04-30/);
    assert.match(result.raw, /Day: 1\|晴\|18℃/);
    assert.match(result.raw, /Day: 2\|阴\|16℃/);
    assert.match(result.raw, /Day: 3\|雨\|14℃/);
    assert.match(result.raw, /暑假/);
    assert.doesNotMatch(result.raw, /pin\|true/);
});

test('推进排队：窗口不够就补，不再自动滚点', () => {
    assert.deepEqual(planAdvanceSteps({
        hasPoint: true,
        pointRaw: oneDay,
        today: { month: 5, day: 1 },
        linesOn: true,
    }), ['fill', 'lines']);
    assert.deepEqual(planAdvanceSteps({
        hasPoint: true,
        pointRaw: widget('2024-05-01', 'Day: 1\nDay: 2\nDay: 3\n'),
        today: { month: 5, day: 1 },
        linesOn: false,
    }), []);
    assert.deepEqual(planAdvanceSteps({
        hasPoint: true,
        pointRaw: oneDay.replace('2024-04-30', '2024-05-01'),
        today: { month: 5, day: 1 },
        linesOn: true,
    }), ['fill', 'lines']);
});

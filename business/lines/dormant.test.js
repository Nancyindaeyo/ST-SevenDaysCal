import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLines, serializeLines, validateLinesResponse } from './schema.js';
import { activeLines } from './strategy.js';
import { toggleDormant, mergePinned } from './mutations.js';
import { enforceLineCapacity } from './capacity.js';

const live = { name: '活线', stage: '延展', when: '今天', agency: 'world', desc: 'd', next: 'n' };
const sleep = { ...live, name: '休眠线', dormant: true };

test('dormant is local-only and excluded from injection pool', () => {
    const raw = serializeLines([live, sleep]);
    assert.match(raw, /Dormant: true/);
    const parsed = parseLines(raw);
    assert.equal(parsed[1].dormant, true);
    assert.equal(activeLines(raw).length, 1);
    assert.equal(activeLines(raw)[0].name, '活线');
    assert.equal(activeLines(raw, { includeDormant: true }).length, 2);
    const checked = validateLinesResponse(`<storylines_widget>
Line: 新线|起线|今天|world|false|false
Desc: 描述
Next: 下一步
Dormant: true
</storylines_widget>`);
    assert.equal(checked.ok, true);
    assert.equal(checked.model[0].dormant, false);
});

test('toggle dormant and merge keep sleeping lines out of auto capacity', () => {
    const raw = serializeLines([live, sleep]);
    const woke = toggleDormant(raw, 1);
    assert.equal(woke.model[1].dormant, false);
    const merged = mergePinned(raw, serializeLines([{ ...live, name: '新线' }]));
    assert.ok(merged.model.some(line => line.name === '休眠线' && line.dormant));
    const capacity = enforceLineCapacity({
        previousLines: parseLines(raw),
        mergedLines: merged.model,
        max: 8,
    });
    assert.ok(capacity.model.some(line => line.dormant === true));
    assert.equal(capacity.model.filter(line => !line.pin && !line.dormant).length <= 8, true);
});

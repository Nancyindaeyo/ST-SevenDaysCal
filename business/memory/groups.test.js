import test from 'node:test';
import assert from 'node:assert/strict';
import { collectStableGroups, isStrippedEmptyGroup } from './groups.js';

function floors(count, { text = '正文够长', rawLen = 80 } = {}) {
    return Array.from({ length: count }, (_, i) => ({
        mesid: String(i + 1),
        text,
        rawLen,
    }));
}

test('latest complete group stays deferred until one more AI floor exists', () => {
    assert.equal(collectStableGroups(floors(4), 5).length, 0);
    assert.equal(collectStableGroups(floors(5), 5).length, 0);
    const ready = collectStableGroups(floors(6), 5);
    assert.equal(ready.length, 1);
    assert.equal(ready[0].key, '1-5');
    assert.equal(ready[0].floors.at(-1).mesid, '5');
});

test('a remainder after a closed group does not drop the closed group', () => {
    const groups = collectStableGroups(floors(12), 5);
    assert.deepEqual(groups.map(item => item.key), ['1-5', '6-10']);
});

test('two closed groups appear only after the next group has started', () => {
    assert.deepEqual(collectStableGroups(floors(10), 5).map(item => item.key), ['1-5']);
    assert.deepEqual(collectStableGroups(floors(11), 5).map(item => item.key), ['1-5', '6-10']);
});

test('stripped-empty is raw-long but cleaned-empty, not a short chat', () => {
    assert.equal(isStrippedEmptyGroup({
        floors: [
            { text: '', rawLen: 120 },
            { text: '   ', rawLen: 80 },
        ],
    }), true);
    assert.equal(isStrippedEmptyGroup({
        floors: [{ text: '', rawLen: 10 }],
    }), false);
    assert.equal(isStrippedEmptyGroup({
        floors: [{ text: '这里还有足够长的可摘要正文，不会被当成标签致空', rawLen: 80 }],
    }), false);
});

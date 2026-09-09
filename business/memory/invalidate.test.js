import test from 'node:test';
import assert from 'node:assert/strict';
import { chatFingerprints, firstRemovedIndex, pruneMemoryAfterDelete } from './invalidate.js';

test('splice in the middle reports the removed index', () => {
    const before = chatFingerprints([
        { is_user: true, send_date: '1', mes: 'hi' },
        { is_user: false, send_date: '2', mes: 'hello' },
        { is_user: true, send_date: '3', mes: 'later' },
    ]);
    const after = chatFingerprints([
        { is_user: true, send_date: '1', mes: 'hi' },
        { is_user: true, send_date: '3', mes: 'later' },
    ]);
    assert.equal(firstRemovedIndex(before, after), 1);
});

test('memory delete drops summaries that cover or follow the removed floor', () => {
    const memory = {
        L0: {
            a: { range: ['0', '1'] },
            b: { range: ['2', '4'] },
        },
        L1: [
            { range: ['0', '1'] },
            { range: ['2', '5'] },
        ],
    };
    pruneMemoryAfterDelete(memory, 2);
    assert.deepEqual(Object.keys(memory.L0), ['a']);
    assert.equal(memory.L1.length, 1);
    assert.deepEqual(memory.L1[0].range, ['0', '1']);
});

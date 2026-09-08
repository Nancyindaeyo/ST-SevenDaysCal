import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTheaterView, theaterPieceOpen } from './view.js';

const drafts = [
    { id: 'a', batchId: 'batch-1', title: '第一面' },
    { id: 'b', batchId: 'batch-1', title: '第二面' },
    { id: 'c', batchId: 'batch-2', title: '旧草稿' },
];

test('viewing a draft shows only that piece even if last batch is still set', () => {
    const { piece, batch } = selectTheaterView(drafts, { current: { id: 'c' }, batchId: 'batch-1', solo: true });
    assert.equal(piece.id, 'c');
    assert.deepEqual(batch.map(item => item.id), ['c']);
});

test('fresh generation still shows the whole batch', () => {
    const { piece, batch } = selectTheaterView(drafts, { current: { id: 'a' }, batchId: 'batch-1', solo: false });
    assert.equal(piece.id, 'a');
    assert.deepEqual(batch.map(item => item.id), ['a', 'b']);
});

test('only the selected piece starts open', () => {
    assert.equal(theaterPieceOpen({ id: 'b' }, { id: 'b' }), true);
    assert.equal(theaterPieceOpen({ id: 'a' }, { id: 'b' }), false);
});

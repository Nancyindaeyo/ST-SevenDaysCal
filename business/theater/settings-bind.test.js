import test from 'node:test';
import assert from 'node:assert/strict';
import { clampTheaterCount, nextTheaterPoolBooks, theaterPoolRowVisible } from './settings-bind.js';

test('theater count stays between 1 and 3', () => {
    assert.equal(clampTheaterCount(2), 2);
    assert.equal(clampTheaterCount(0), 2);
    assert.equal(clampTheaterCount(9), 3);
    assert.equal(clampTheaterCount('x'), 2);
});

test('theater pool books toggle by name', () => {
    assert.deepEqual(nextTheaterPoolBooks(['A'], 'B', true), ['A', 'B']);
    assert.deepEqual(nextTheaterPoolBooks(['A', 'B'], 'A', false), ['B']);
    assert.deepEqual(nextTheaterPoolBooks(['A'], '', true), ['A']);
});

test('empty pool search shows every row', () => {
    assert.equal(theaterPoolRowVisible('小回', ''), true);
    assert.equal(theaterPoolRowVisible('小回', ' 回 '), true);
    assert.equal(theaterPoolRowVisible('小回', '极光'), false);
});

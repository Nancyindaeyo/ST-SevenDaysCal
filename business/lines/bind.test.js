import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLineIndex, validLinesSheet } from './bind.js';

test('lines sheet only accepts events and dashed', () => {
    assert.equal(validLinesSheet('events'), true);
    assert.equal(validLinesSheet('dashed'), true);
    assert.equal(validLinesSheet('calendar'), false);
});

test('line card index must be an integer', () => {
    assert.equal(parseLineIndex('3'), 3);
    assert.equal(parseLineIndex('1.5'), null);
    assert.equal(parseLineIndex(undefined), null);
});

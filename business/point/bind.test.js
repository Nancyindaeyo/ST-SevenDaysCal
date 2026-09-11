import test from 'node:test';
import assert from 'node:assert/strict';
import {
    chatPointDeleteContext,
    panelPointDeleteContext,
    pointDeleteTarget,
    pointTabIndex,
} from './bind.js';

test('panel point delete keeps char name only in char view', () => {
    assert.deepEqual(panelPointDeleteContext('char', '阿宁'), { view: 'char', charName: '阿宁' });
    assert.deepEqual(panelPointDeleteContext('user', '阿宁'), { view: 'user', charName: '' });
});

test('chat point delete always uses the user view', () => {
    assert.deepEqual(chatPointDeleteContext(), { view: 'user', charName: '' });
});

test('point delete target rejects non-integer events', () => {
    assert.equal(pointDeleteTarget('2', 'x', chatPointDeleteContext()), null);
    assert.deepEqual(pointDeleteTarget('future', '1', { view: 'user', charName: '' }), {
        day: 'future', idx: 1, view: 'user', charName: '',
    });
    assert.deepEqual(pointDeleteTarget('past:0', '1', { view: 'user', charName: '' }), {
        day: 'past:0', idx: 1, view: 'user', charName: '',
    });
});

test('point tabs map future to the last track index', () => {
    assert.equal(pointTabIndex('future', 4), 3);
    assert.equal(pointTabIndex('past', 4), 0);
    assert.equal(pointTabIndex('1', 4), 1);
    assert.equal(pointTabIndex('9', 4), null);
    assert.equal(pointTabIndex('0', 0), null);
});

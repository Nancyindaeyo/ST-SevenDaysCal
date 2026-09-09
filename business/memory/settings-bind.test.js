import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMemorySourceToggle, clampParseInt } from './settings-bind.js';

test('turning on one memory source clears the others', () => {
    const settings = { useQianQianJie: false, useBaiBaiBook: true, useAnima: false, useDatabase: false };
    applyMemorySourceToggle(settings, 'useDatabase', true);
    assert.deepEqual(settings, {
        useQianQianJie: false,
        useBaiBaiBook: false,
        useAnima: false,
        useDatabase: true,
    });
});

test('turning off a memory source leaves the rest alone', () => {
    const settings = { useQianQianJie: true, useBaiBaiBook: false, useAnima: false, useDatabase: false };
    applyMemorySourceToggle(settings, 'useQianQianJie', false);
    assert.equal(settings.useQianQianJie, false);
    assert.equal(settings.useBaiBaiBook, false);
});

test('memory counts still use parseInt fallbacks', () => {
    assert.equal(clampParseInt('20abc', { min: 1, max: 50, fallback: 20 }), 20);
    assert.equal(clampParseInt('', { min: 2, max: 30, fallback: 10 }), 10);
    assert.equal(clampParseInt('99', { min: 1, max: 30, fallback: 5 }), 30);
    assert.equal(clampParseInt(0, { min: 0, max: 500, fallback: 50 }), 50);
});

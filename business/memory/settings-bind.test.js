import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBaiBaiBookToggle, clampParseInt } from './settings-bind.js';

test('turning on 柏宝书 clears retired memory sources', () => {
    const settings = { useQianQianJie: true, useBaiBaiBook: false, useAnima: true, useDatabase: true };
    applyBaiBaiBookToggle(settings, true);
    assert.deepEqual(settings, {
        useQianQianJie: false,
        useBaiBaiBook: true,
        useAnima: false,
        useDatabase: false,
    });
});

test('turning off 柏宝书 leaves internal memory available', () => {
    const settings = { useQianQianJie: false, useBaiBaiBook: true, useAnima: false, useDatabase: false };
    applyBaiBaiBookToggle(settings, false);
    assert.equal(settings.useBaiBaiBook, false);
});

test('memory counts still use parseInt fallbacks', () => {
    assert.equal(clampParseInt('20abc', { min: 1, max: 50, fallback: 20 }), 20);
    assert.equal(clampParseInt('', { min: 2, max: 30, fallback: 10 }), 10);
    assert.equal(clampParseInt('99', { min: 1, max: 30, fallback: 5 }), 30);
    assert.equal(clampParseInt(0, { min: 0, max: 500, fallback: 50 }), 0);
    assert.equal(clampParseInt('', { min: 0, max: 500, fallback: 50 }), 50);
});

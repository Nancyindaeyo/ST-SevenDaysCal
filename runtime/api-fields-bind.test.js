import test from 'node:test';
import assert from 'node:assert/strict';
import { filterModelList, normalizeApiUrlInput, parseApiTimeoutSec } from './api-fields-bind.js';

test('api timeout only persists integers from 5 to 600', () => {
    assert.equal(parseApiTimeoutSec('180'), 180);
    assert.equal(parseApiTimeoutSec('5'), 5);
    assert.equal(parseApiTimeoutSec('600'), 600);
    assert.equal(parseApiTimeoutSec(''), null);
    assert.equal(parseApiTimeoutSec('4'), null);
    assert.equal(parseApiTimeoutSec('601'), null);
    assert.equal(parseApiTimeoutSec('12.5'), null);
});

test('api url input only trims a trailing slash', () => {
    assert.equal(normalizeApiUrlInput(' https://x/v1/ '), 'https://x/v1');
    assert.equal(normalizeApiUrlInput('https://x/v1/chat/completions'), 'https://x/v1/chat/completions');
});

test('model list filter is case-insensitive', () => {
    assert.deepEqual(filterModelList(['GPT-4o', 'claude'], 'gpt'), ['GPT-4o']);
    assert.deepEqual(filterModelList(['a', 'b'], ''), ['a', 'b']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { apiPresetSnapshotKey, apiInputsSaveable, apiInputsDirty, autoPresetName } from './api-presets-ui.js';

const sample = (over = {}) => ({
    url: 'https://api.example.com/v1',
    key: 'sk-1',
    model: 'm',
    excludeParams: ['foo'],
    timeoutSec: 180,
    timeoutValid: true,
    stream: false,
    ...over,
});

test('snapshot key ignores extra fields and normalizes empty arrays', () => {
    assert.equal(
        apiPresetSnapshotKey(sample({ extra: 1 })),
        apiPresetSnapshotKey(sample()),
    );
    assert.equal(
        apiPresetSnapshotKey(sample({ excludeParams: undefined })),
        apiPresetSnapshotKey(sample({ excludeParams: [] })),
    );
});

test('saveable requires an integer timeout in 5–600', () => {
    assert.equal(apiInputsSaveable(sample()), true);
    assert.equal(apiInputsSaveable(sample({ timeoutSec: 4 })), false);
    assert.equal(apiInputsSaveable(sample({ timeoutSec: 601 })), false);
    assert.equal(apiInputsSaveable(sample({ timeoutValid: false, timeoutSec: 180 })), false);
    assert.equal(apiInputsSaveable(sample({ timeoutSec: 5.5 })), false);
});

test('dirty compares current inputs against the active preset', () => {
    const active = sample();
    assert.equal(apiInputsDirty(sample(), active), false);
    assert.equal(apiInputsDirty(sample({ model: 'other' }), active), true);
    assert.equal(apiInputsDirty(sample(), null), false);
});

test('auto preset name uses host and suffixes collisions', () => {
    assert.equal(autoPresetName('https://www.openai.com/v1', []), 'openai.com');
    assert.equal(autoPresetName('https://openai.com/v1', ['openai.com']), 'openai.com-2');
    assert.equal(autoPresetName('https://openai.com/v1', ['openai.com', 'openai.com-2']), 'openai.com-3');
    assert.equal(autoPresetName('', []), '预设');
    assert.equal(autoPresetName('not a url', ['预设']), '预设-2');
});

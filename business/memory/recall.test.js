import test from 'node:test';
import assert from 'node:assert/strict';
import { capMemText } from './recall.js';

test('memory cap keeps full-story samples and near-term head/tail', () => {
    const blocks = Array.from({ length: 12 }, (_, i) => `块${String(i).padStart(2, '0')}`);
    const text = blocks.join('\n\n');
    const full = capMemText(text, true, { total: 200, budget: 80 });
    assert.match(full, /全程等距节选/);
    assert.match(full, /块00/);
    assert.match(full, /块11/);
    const near = capMemText(text, false, { total: 80, budget: 50 });
    assert.match(near, /中段记忆已省略/);
    assert.match(near, /块11/);
    assert.equal(capMemText('短', false, { total: 10, budget: 60 }), '短');
});

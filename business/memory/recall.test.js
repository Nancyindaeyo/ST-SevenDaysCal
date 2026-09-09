import test from 'node:test';
import assert from 'node:assert/strict';
import {
    animaTextTokens,
    capMemText,
    clampAnimaRecallCount,
    collectAnimaSlices,
    selectAnimaSlices,
} from './recall.js';

test('anima recall count clamps to 1–50', () => {
    assert.equal(clampAnimaRecallCount('20abc'), 20);
    assert.equal(clampAnimaRecallCount(''), 20);
    assert.equal(clampAnimaRecallCount(99), 50);
    assert.equal(clampAnimaRecallCount(0), 1);
});

test('anima tokens keep CJK bigrams and latin words', () => {
    const tokens = animaTextTokens('生日 party');
    assert.ok(tokens.has('生日'));
    assert.ok(tokens.has('party'));
});

test('anima slice pick ranks by query then restores chronological order', () => {
    const picked = selectAnimaSlices([
        { text: '无关天气', tags: '', batch: 2, slice: 0, time: '2024-02-01' },
        { text: '生日宴会', tags: '生日', batch: 0, slice: 0, time: '2024-01-01' },
        { text: '后来过生日', tags: '', batch: 1, slice: 0, time: '2024-01-15' },
    ], '生日', 2);
    assert.deepEqual(picked.map(item => item.batch), [0, 1]);
});

test('anima worldbook collector only reads tagged summary slices', () => {
    const slices = collectAnimaSlices([
        { extra: { createdBy: 'other' }, content: '<1>no</1>' },
        {
            extra: { createdBy: 'anima_summary', history: [{ unique_id: 's1', batch_id: 3, slice_id: 1, tags: ['夜'], narrative_time: 't' }] },
            content: 'intro <s1> 夜里下雨 </s1> tail',
        },
        {
            extra: { createdBy: 'anima_summary', history: [{ unique_id: 'missing' }] },
            content: 'no tags here',
        },
    ]);
    assert.equal(slices.length, 1);
    assert.equal(slices[0].text, '夜里下雨');
    assert.equal(slices[0].batch, 3);
    assert.equal(slices[0].tags, '夜');
});

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

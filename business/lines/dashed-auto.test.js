import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashedPrompt, getDashedAutoInterval, resolveDashedTopics } from './dashed.js';

test('auto topics prefer pinned theme or near-text over a random pair', () => {
    assert.deepEqual(resolveDashedTopics({ nearText: true }, { theme: '' }), []);
    assert.deepEqual(resolveDashedTopics({}, { theme: 'places' }), ['places']);
    assert.deepEqual(resolveDashedTopics({ topics: ['rules'] }, { theme: 'places' }), ['rules']);
    assert.equal(getDashedAutoInterval({}), 6);
    assert.equal(getDashedAutoInterval({ dashedAutoInterval: 8 }), 8);
});

test('near-text prompt asks for recent story corners', () => {
    const prompt = buildDashedPrompt('甲', '乙', [], { nearText: true, latestStory: '校门口的铜钟刚敲过' });
    assert.match(prompt, /刚带过/);
    assert.match(prompt, /铜钟/);
    assert.doesNotMatch(prompt, /取材面要开阔/);
});

test('auto floor gate skips seen, blocked, and unfinished intervals', async () => {
    const { createDashedModule } = await import('./dashed.js');
    const dashed = createDashedModule({
        getSettings: () => ({ dashedEnabled: true, dashedAutoInterval: 3 }),
    });
    assert.equal((await dashed.onAiFloor(1)).reason, 'interval');
    assert.equal(dashed.state().counter, 1);
    assert.equal((await dashed.onAiFloor(1)).reason, 'seen');
    assert.equal((await dashed.onAiFloor(2, { blocked: true })).reason, 'stagger');
    assert.equal(dashed.state().lastFloor, 2);
    assert.equal(dashed.state().counter, 1);
});

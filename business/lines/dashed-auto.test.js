import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashedPrompt, dashedTargetCount, getDashedAutoInterval, resolveDashedTopics } from './dashed.js';

test('auto topics prefer pinned theme or near-text over a random pair', () => {
    assert.deepEqual(resolveDashedTopics({ nearText: true }, { theme: '' }), []);
    assert.deepEqual(resolveDashedTopics({}, { theme: 'places' }), ['places']);
    assert.deepEqual(resolveDashedTopics({ topics: ['rules'] }, { theme: 'places' }), ['rules']);
    assert.equal(getDashedAutoInterval({}), 6);
    assert.equal(dashedTargetCount(1, { min: 1 }), 1);
    assert.equal(dashedTargetCount(1), 2);
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

test('same-floor reroll does not consume a dashed interval', async () => {
    let pending = false;
    const { createDashedModule } = await import('./dashed.js');
    const dashed = createDashedModule({
        getSettings: () => ({ dashedEnabled: true, dashedAutoInterval: 3 }),
        sameFloor: () => pending,
    });
    assert.equal((await dashed.onAiFloor(1)).reason, 'interval');
    pending = true;
    assert.equal((await dashed.onAiFloor(3)).reason, 'seen');
    assert.equal(dashed.state().lastFloor, 3);
    assert.equal(dashed.state().counter, 1);
    pending = false;
    assert.equal((await dashed.onAiFloor(4)).reason, 'interval');
    assert.equal(dashed.state().counter, 2);
});

test('blocked due floor defers dashed instead of drawing', async () => {
    const { createDashedModule } = await import('./dashed.js');
    let deferred = false;
    const dashed = createDashedModule({
        getSettings: () => ({ dashedEnabled: true, dashedAutoInterval: 1 }),
        deferDashed: () => { deferred = true; },
    });
    assert.equal((await dashed.onAiFloor(1, { blocked: true })).reason, 'stagger');
    assert.equal(deferred, true);
    assert.equal(dashed.state().counter, 0);
});

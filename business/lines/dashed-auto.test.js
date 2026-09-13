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

test('auto dashed records one floor card and does not also emit onActivity', async () => {
    const activities = [];
    const marks = [];
    let stored = { items: [] };
    const { createDashedModule } = await import('./dashed.js');
    const dashed = createDashedModule({
        getSettings: () => ({ dashedEnabled: true, dashedAutoInterval: 1, notifyMode: 'off' }),
        keyDesc: () => 'dashed',
        readStore: () => stored,
        writeStore: (_key, value) => { stored = value || { items: [] }; return true; },
        writeStoreConfirmed: async (_key, value) => { stored = value || { items: [] }; return { ok: true }; },
        context: () => ({ name1: '春', name2: '柳', chatId: 'c1' }),
        chatId: () => 'c1',
        loadConfig: () => ({ url: 'http://x', key: 'k' }),
        callApi: async () => '基地的辅助体育馆用了防腐铁皮顶，专门对付多变山风。',
        now: () => 1,
        random: () => 0.1,
        uuid: () => 'id1',
        onActivity: entry => activities.push(entry),
        markActivityFloor: (source, floorId, patch) => marks.push({ source, floorId, patch }),
        refreshPanel() {},
        refreshInline() {},
        toast() {},
    });
    const result = await dashed.onAiFloor(3, { latestStory: '体育馆里在下雨' });
    assert.equal(result.status, 'updated');
    assert.equal(activities.length, 0);
    assert.equal(marks.length, 1);
    assert.equal(marks[0].source, 'dashed');
    assert.equal(marks[0].floorId, 3);
    assert.ok(marks[0].patch.snapshot);
    assert.ok(marks[0].patch.after);
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

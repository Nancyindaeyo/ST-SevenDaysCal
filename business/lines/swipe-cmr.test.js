import test from 'node:test';
import assert from 'node:assert/strict';
import { createLinesFeature } from './feature.js';
import { chooseSwipeLayer } from './strategy.js';

function memoryStorage() {
    const values = new Map();
    return {
        get length() { return values.size; },
        key: index => [...values.keys()][index] ?? null,
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); },
        removeItem: key => { values.delete(key); },
    };
}

function swipeHarness({ raw = 'BASE', ts = 1, chatId = 'c1' } = {}) {
    let saved = { raw, ts };
    const writes = [];
    const feature = createLinesFeature({
        storage: memoryStorage(),
        chatId: () => chatId,
        pluginEnabled: () => true,
        getSettings: () => ({ linesEnabled: true }),
        isEditing: () => false,
        readSaved: () => saved,
        readRaw: () => saved.raw,
        floorSignature: () => 'sig',
        chat: () => [{ is_user: true, mes: 'user' }, { is_user: false, mes: 'ai' }],
    });
    const writeStore = (key, value) => {
        writes.push({ key, raw: value.raw });
        saved = { raw: value.raw, ts: Number(value.ts) || Date.now() };
    };
    return {
        feature,
        writes,
        get saved() { return saved; },
        setSaved(next) { saved = { raw: next.raw, ts: Number(next.ts) || 0 }; },
        apply(over = {}) {
            return feature.applyStoredSwipe({
                chatId,
                mesId: 1,
                swipeId: 1,
                key: 'lines',
                writeStore,
                expectedCanonical: { raw: saved.raw, ts: saved.ts },
                ...over,
            });
        },
    };
}

test('chooseSwipeLayer waits, restores a stored swipe, or falls back to baseline', () => {
    assert.deepEqual(chooseSwipeLayer({ pendingGeneration: true, swipeId: 2 }), { action: 'wait', swipeId: 2 });
    assert.deepEqual(chooseSwipeLayer({ swipeId: 1, stored: null, baseline: 'BASE' }), { action: 'baseline', raw: 'BASE' });
    assert.deepEqual(
        chooseSwipeLayer({ swipeId: 1, stored: { swipes: { '1': 'S1' } }, baseline: 'BASE' }),
        { action: 'restore', raw: 'S1' },
    );
    assert.deepEqual(
        chooseSwipeLayer({ swipeId: 2, stored: { swipes: { '1': 'S1' } }, baseline: 'BASE' }),
        { action: 'baseline', raw: 'BASE' },
    );
});

test('applyStoredSwipe restores the selected layer and does not collapse later swipes', () => {
    const harness = swipeHarness();
    harness.feature.writeSwipe('c1', 1, { baseline: 'BASE', swipes: { '0': 'S0', '1': 'S1' } });
    assert.equal(harness.apply({ swipeId: 1 }), true);
    assert.equal(harness.saved.raw, 'S1');
    assert.equal(harness.apply({ swipeId: 0, expectedCanonical: { raw: harness.saved.raw, ts: harness.saved.ts } }), true);
    assert.equal(harness.saved.raw, 'S0');
    assert.deepEqual(harness.feature.readSwipe('c1', 1).swipes, { '0': 'S0', '1': 'S1' });
    assert.equal(harness.writes.length, 2);
});

test('applyStoredSwipe refuses drifted raw, stale canonical, and the wrong chat', () => {
    const harness = swipeHarness();
    harness.feature.writeSwipe('c1', 1, { baseline: 'BASE', swipes: { '1': 'S1' } });
    harness.setSaved({ raw: 'EDITED', ts: 9 });
    assert.equal(harness.apply(), false);
    assert.equal(harness.writes.length, 0);

    harness.setSaved({ raw: 'BASE', ts: 1 });
    assert.equal(harness.apply({ expectedCanonical: { raw: 'OTHER', ts: 1 } }), false);
    assert.equal(harness.apply({ chatId: 'c2' }), false);
    assert.equal(harness.saved.raw, 'BASE');
});

test('pending swipe waits and sending a new user floor clears only that chat floor', async () => {
    const harness = swipeHarness();
    harness.feature.writeSwipe('c1', 1, { baseline: 'BASE', swipes: { '1': 'S1' } });
    harness.feature.writeSwipe('c1', 0, { baseline: 'OLD', swipes: { '0': 'KEEP' } });
    await harness.feature.onSwiped({ mesId: 1, info: { pendingGeneration: true, nextSwipeId: 2 } });
    assert.equal(harness.writes.length, 0);
    assert.deepEqual(harness.feature.readSwipe('c1', 1).swipes, { '1': 'S1' });

    harness.feature.onSent();
    assert.equal(harness.feature.readSwipe('c1', 1), null);
    assert.deepEqual(harness.feature.readSwipe('c1', 0).swipes, { '0': 'KEEP' });
});

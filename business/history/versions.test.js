import test from 'node:test';
import assert from 'node:assert/strict';
import {
    generatedStore, restoreHistoryVersion, historyEntries, historyCount,
    rawAdapter, itemsAdapter, axisAdapter, ledgerAdapter, MODULE_HISTORY_LIMIT,
} from './versions.js';

test('generation archives the previous raw and restore swaps back', () => {
    const first = generatedStore({}, '线A', rawAdapter, 1000);
    assert.equal(first.value.raw, '线A');
    assert.equal(first.value.history.length, 0);
    const second = generatedStore(first.value, '线B', rawAdapter, 2000);
    assert.equal(second.value.raw, '线B');
    assert.equal(second.value.history.length, 1);
    assert.equal(second.value.history[0].payload, '线A');
    const restored = restoreHistoryVersion(second.value, 0, rawAdapter, 3000);
    assert.equal(restored.ok, true);
    assert.equal(restored.value.raw, '线A');
    assert.equal(restored.value.generatedAt, 1000);
    assert.equal(restored.value.history[0].payload, '线B');
});

test('identical payload does not create a history slot', () => {
    const first = generatedStore({}, '同一份', rawAdapter, 1);
    const again = generatedStore(first.value, '同一份', rawAdapter, 2);
    assert.equal(again.changed, false);
    assert.equal(again.value.history.length, 0);
});

test('keeps the newest 10 archived versions', () => {
    let store = {};
    for (let i = 0; i < MODULE_HISTORY_LIMIT + 3; i++) {
        store = generatedStore(store, `v${i}`, rawAdapter, i + 1).value;
    }
    assert.equal(historyCount(store, rawAdapter), MODULE_HISTORY_LIMIT);
    assert.equal(store.history[0].payload, 'v2');
});

test('axis adapter archives festival table and calendar together', () => {
    const first = generatedStore({}, { items: [{ name: '旧节' }], caldesc: { era: '旧历' } }, axisAdapter, 10);
    const next = generatedStore(first.value, { items: [{ name: '新节' }], caldesc: { era: '新历' } }, axisAdapter, 20);
    assert.equal(next.value.items[0].name, '新节');
    assert.equal(next.value.history[0].payload.caldesc.era, '旧历');
});

test('empty ledger does not archive a blank previous version', () => {
    const first = generatedStore({ entries: [], seq: 0 }, { entries: [{ id: 'L1' }], seq: 1 }, ledgerAdapter, 5);
    assert.equal(first.changed, true);
    assert.equal(first.value.history.length, 0);
});

test('items adapter snapshots lists', () => {
    const first = generatedStore({}, [{ text: '旧' }], itemsAdapter, 10);
    const next = generatedStore(first.value, [{ text: '新' }], itemsAdapter, 20);
    assert.equal(next.value.items[0].text, '新');
    assert.equal(next.value.history[0].payload[0].text, '旧');
    const choices = historyEntries(next.value, itemsAdapter);
    assert.equal(choices[0].current, true);
    assert.equal(choices[1].current, false);
});

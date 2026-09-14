import test from 'node:test';
import assert from 'node:assert/strict';
import { ledgerHistoryScopeFromSettings, selectHistoryRecords, ledgerHistoryScopeLabel } from './history-scope.js';

const floors = (ids) => ids.map(floor => ({ floor }));

test('recent keeps the last N records; all keeps everything; custom uses real floor ids', () => {
    const records = floors([2, 5, 9, 12, 18]);
    assert.deepEqual(selectHistoryRecords(records, { mode: 'recent', limit: 2 }).map(x => x.floor), [12, 18]);
    assert.deepEqual(selectHistoryRecords(records, { mode: 'all' }).map(x => x.floor), [2, 5, 9, 12, 18]);
    assert.deepEqual(selectHistoryRecords(records, { mode: 'custom', startFloor: 5, endFloor: 12 }).map(x => x.floor), [5, 9, 12]);
});

test('settings default to recent 50; custom 0 is a real floor, not a missing value', () => {
    const recent = ledgerHistoryScopeFromSettings({});
    assert.equal(recent.mode, 'recent');
    assert.equal(recent.limit, 50);
    const custom = ledgerHistoryScopeFromSettings({ ledgerHistoryScope: 'custom', ledgerHistoryStartFloor: 0, ledgerHistoryEndFloor: 0 });
    assert.equal(custom.mode, 'custom');
    assert.equal(custom.startFloor, 0);
    assert.equal(custom.endFloor, 0);
    assert.equal(ledgerHistoryScopeLabel(custom), '楼号 0–0');
    assert.match(ledgerHistoryScopeLabel(recent), /最近 50/);
});

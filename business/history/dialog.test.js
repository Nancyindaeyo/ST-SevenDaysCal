import test from 'node:test';
import assert from 'node:assert/strict';
import { openModuleHistory } from './dialog.js';
import { generatedStore, rawAdapter } from './versions.js';

test('restore asks for a second confirmation when required', async () => {
    const first = generatedStore({}, '旧版', rawAdapter, 1).value;
    const store = generatedStore(first, '新版', rawAdapter, 2).value;
    let current = store;
    const confirms = [];
    const restored = await openModuleHistory({
        title: '刻度 · 历史版本',
        confirmRestore: true,
        confirmTitle: '确认恢复刻度历史版本',
        confirmBody: '会整表回到这一版',
        adapter: rawAdapter,
        readStore: () => current,
        writeStore: value => { current = value; return { ok: true }; },
        preview: payload => payload,
        dialog: {
            selectOneAsync: async () => 'history:0',
            choose: async () => 'restore',
            confirm: async options => { confirms.push(options); return true; },
        },
        toast: () => {},
    });
    assert.equal(restored, true);
    assert.equal(confirms.length, 1);
    assert.equal(confirms[0].title, '确认恢复刻度历史版本');
    assert.equal(current.raw, '旧版');
});

test('cancelling the second confirmation returns to the list instead of restoring', async () => {
    const first = generatedStore({}, '旧版', rawAdapter, 1).value;
    const store = generatedStore(first, '新版', rawAdapter, 2).value;
    let current = store;
    let round = 0;
    const restored = await openModuleHistory({
        title: '刻度 · 历史版本',
        confirmRestore: true,
        adapter: rawAdapter,
        readStore: () => current,
        writeStore: value => { current = value; return { ok: true }; },
        preview: payload => payload,
        dialog: {
            selectOneAsync: async () => {
                round += 1;
                return round === 1 ? 'history:0' : null;
            },
            choose: async () => 'restore',
            confirm: async () => false,
        },
        toast: () => {},
    });
    assert.equal(restored, false);
    assert.equal(current.raw, '新版');
});

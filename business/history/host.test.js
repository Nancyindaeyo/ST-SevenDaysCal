import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryHost, sameHistorySnapshot } from './host.js';
import { axisAdapter, itemsAdapter, ledgerAdapter, rawAdapter } from './versions.js';

function makeHost(overrides = {}) {
    const calls = [];
    const captured = {};
    const host = createHistoryHost({
        getContext: () => ({ chatId: overrides.chatId === undefined ? 'c1' : overrides.chatId }),
        toast: (message, onClick, isError) => calls.push(['toast', message, onClick, isError === true]),
        dialog: {},
        readStore: key => ({ key, raw: 'now' }),
        writeStoreConfirmed: async (key, value, options) => {
            calls.push(['write', key, value, typeof options?.ownerGuard]);
            return overrides.writeResult === undefined ? { ok: true } : overrides.writeResult;
        },
        pointKey: () => 'point-key',
        linesKey: () => 'lines-key',
        dashedKey: () => 'dashed-key',
        outlineKey: () => 'outline-key',
        almanacKey: () => 'alm-key',
        readAxis: () => ({ items: [{ name: '花朝', month: 3, day: 5 }], caldesc: { era: '夏' } }),
        saveCalDesc: (cal, options) => calls.push(['caldesc', cal, options]),
        snapshotLedger: () => ({ entries: [{ id: 'L1', 事由: '养伤', 状态: '持续' }] }),
        replaceLedger: (value, options) => {
            calls.push(['ledger', value, typeof options?.guard]);
            return { ok: true };
        },
        openHistory: async options => {
            captured.options = options;
            return 'opened';
        },
        afterRestore: {
            point: () => calls.push('restore-point'),
            lines: () => calls.push('restore-lines'),
            dashed: () => calls.push('restore-dashed'),
            outline: () => calls.push('restore-outline'),
            axis: () => calls.push('restore-axis'),
            ledger: () => calls.push('restore-ledger'),
        },
        ...overrides.env,
    });
    return { host, calls, captured };
}

test('sameHistorySnapshot treats null like empty', () => {
    assert.equal(sameHistorySnapshot(null, null), true);
    assert.equal(sameHistorySnapshot({ a: 1 }, { a: 1 }), true);
    assert.equal(sameHistorySnapshot({ a: 1 }, { a: 2 }), false);
});

test('open refuses missing chat and unknown kind', async () => {
    const missing = makeHost({ chatId: null });
    assert.equal(await missing.host.open('point'), false);
    assert.deepEqual(missing.calls[0], ['toast', '请先打开一个聊天', null, true]);

    const unknown = makeHost();
    assert.equal(await unknown.host.open('theater'), false);
    assert.equal(unknown.captured.options, undefined);
});

test('point restore uses raw adapter and afterRestore; missing key toasts', async () => {
    const { host, calls, captured } = makeHost();
    assert.equal(await host.open('point'), 'opened');
    assert.equal(captured.options.title, '点 · 历史版本');
    assert.equal(captured.options.adapter, rawAdapter);
    assert.equal(captured.options.preview('  体检  '), '体检');
    assert.equal(captured.options.summary(''), '空');
    captured.options.afterRestore();
    assert.equal(calls.includes('restore-point'), true);

    const noKey = makeHost({ env: { pointKey: () => null } });
    assert.equal(await noKey.host.open('point'), false);
    assert.equal(noKey.calls[0][1], '当前没有可恢复的点');
});

test('isCurrent dies with the opening chat and snapshot drift', async () => {
    let chatId = 'c1';
    const stored = { raw: 'now' };
    const { captured, host } = makeHost({
        env: {
            getContext: () => ({ chatId }),
            readStore: () => stored,
        },
    });
    await host.open('lines');
    assert.equal(captured.options.adapter, rawAdapter);
    assert.equal(captured.options.isCurrent({ raw: 'now' }), true);
    stored.raw = 'changed';
    assert.equal(captured.options.isCurrent({ raw: 'now' }), false);
    stored.raw = 'now';
    chatId = 'c2';
    assert.equal(captured.options.isCurrent({ raw: 'now' }), false);
});

test('axis write keeps caldesc only after a live save; ledger asks to confirm', async () => {
    const axis = makeHost();
    await axis.host.open('axis');
    assert.equal(axis.captured.options.adapter, axisAdapter);
    assert.match(axis.captured.options.restoreNote, /不会改「今天」的日期锚点/);
    await axis.captured.options.writeStore({ items: [], caldesc: { era: '夏' } });
    assert.deepEqual(axis.calls.find(call => call[0] === 'caldesc'), ['caldesc', { era: '夏' }, { archive: false }]);

    const stale = makeHost({ writeResult: { ok: true, stale: true } });
    await stale.host.open('axis');
    await stale.captured.options.writeStore({ caldesc: { era: '商' } });
    assert.equal(stale.calls.some(call => call[0] === 'caldesc'), false);

    const ledger = makeHost();
    await ledger.host.open('ledger');
    assert.equal(ledger.captured.options.adapter, ledgerAdapter);
    assert.equal(ledger.captured.options.confirmRestore, true);
    assert.equal(ledger.captured.options.confirmTitle, '确认恢复刻度历史版本');
    await ledger.captured.options.writeStore({ entries: [] });
    assert.equal(ledger.calls.find(call => call[0] === 'ledger')[2], 'function');
});

test('dashed preview lists items', async () => {
    const { host, captured } = makeHost();
    await host.open('dashed');
    assert.equal(captured.options.adapter, itemsAdapter);
    assert.equal(captured.options.preview([{ text: '暗道' }]), '1. 暗道');
    assert.equal(captured.options.summary([{ text: 'a' }, { text: 'b' }]), '2 条');
});

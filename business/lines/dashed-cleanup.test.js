import test from 'node:test';
import assert from 'node:assert/strict';
import { createDashedModule, pruneDashedItems } from './dashed.js';

function item(id, text, locked = false) {
    return { id, text, createdAt: 1, locked };
}

function createDashed(options = {}) {
    let stored = { items: options.items || [], theme: '' };
    const toasts = [];
    const writes = [];
    let settings = {
        dashedCleanupEnabled: options.cleanupEnabled !== false,
        dashedKeepCount: options.keepCount ?? 2,
        notifyMode: options.notifyMode || 'lite',
        dashedEnabled: true,
    };
    const dashed = createDashedModule({
        keyDesc: () => 'dashed',
        readStore: () => stored,
        writeStore: (_key, value) => {
            writes.push(value);
            if (options.writeOk === false) return false;
            stored = value || { items: [] };
            return true;
        },
        writeStoreConfirmed: async (_key, value) => {
            writes.push(value);
            if (options.writeOk === false) return { ok: false, reason: 'cas-rejected', commitState: 'not-dispatched' };
            stored = value || { items: [] };
            return { ok: true, commitState: 'confirmed' };
        },
        getSettings: () => settings,
        toast: message => toasts.push(message),
        refreshPanel() {},
        refreshInline() {},
        context: () => ({ name1: '春', name2: '柳', chatId: 'c1' }),
        chatId: () => 'c1',
        loadConfig: () => ({ url: 'http://x', key: 'k' }),
        callApi: options.callApi || (async () => '旧城水道每年春汛前会先清一次闸口淤泥。'),
        now: () => 1,
        random: () => 0.1,
        uuid: () => 'new1',
    });
    return {
        dashed,
        toasts,
        writes,
        settings,
        readItems: () => stored.items || [],
        setSettings: patch => { settings = { ...settings, ...patch }; },
    };
}

test('cleanup previously reported success while rewriting the unpruned list', () => {
    const current = [item('a', '新一条'), item('b', '中间'), item('c', '最旧')];
    const preview = pruneDashedItems(current, 2, true);
    assert.deepEqual(preview.removed.map(row => row.id), ['c']);
    assert.deepEqual(preview.items.map(row => row.id), ['a', 'b']);
});

test('cleanup commits pruned items and verifies the reread count', () => {
    const harness = createDashed({
        items: [item('a', '新一条'), item('b', '中间'), item('c', '最旧')],
        keepCount: 2,
    });
    assert.equal(harness.dashed.cleanup(true), 1);
    assert.deepEqual(harness.readItems().map(row => row.id), ['a', 'b']);
    assert.deepEqual(harness.toasts, ['已清理 1 条较旧冷知识']);
    assert.equal(harness.writes.at(-1).items.length, 2);
});

test('locked items are kept and never count toward the unlocked keep limit', () => {
    const harness = createDashed({
        items: [
            item('new', '新未锁'),
            item('locked-old', '锁定旧条', true),
            item('mid', '中间未锁'),
            item('old', '最旧未锁'),
        ],
        keepCount: 2,
    });
    assert.equal(harness.dashed.cleanup(), 1);
    assert.deepEqual(harness.readItems().map(row => row.id), ['new', 'locked-old', 'mid']);
    assert.equal(harness.readItems().find(row => row.id === 'locked-old').locked, true);
});

test('disabled cleanup keeps every item', () => {
    const harness = createDashed({
        items: [item('a', '一'), item('b', '二'), item('c', '三')],
        keepCount: 1,
        cleanupEnabled: false,
    });
    assert.equal(harness.dashed.cleanup(true), 0);
    assert.equal(harness.readItems().length, 3);
    assert.equal(harness.toasts.length, 0);
    assert.equal(harness.writes.length, 0);
});

test('failed writes do not toast cleanup success or change stored items', () => {
    const harness = createDashed({
        items: [item('a', '新一条'), item('b', '中间'), item('c', '最旧')],
        keepCount: 2,
        writeOk: false,
    });
    assert.equal(harness.dashed.cleanup(true), 0);
    assert.deepEqual(harness.readItems().map(row => row.id), ['a', 'b', 'c']);
    assert.equal(harness.toasts.length, 0);
});

test('changing the keep count then calling cleanup persists the new limit', () => {
    const harness = createDashed({
        items: [item('a', '一'), item('b', '二'), item('c', '三'), item('d', '四')],
        keepCount: 15,
    });
    harness.setSettings({ dashedKeepCount: 2 });
    assert.equal(harness.dashed.cleanup(true), 2);
    assert.deepEqual(harness.readItems().map(row => row.id), ['a', 'b']);
    assert.deepEqual(harness.toasts, ['已清理 2 条较旧冷知识']);
});

test('auto generation then cleanup only keeps the configured unlocked rows', async () => {
    const harness = createDashed({
        items: [item('old1', '旧一'), item('old2', '旧二')],
        keepCount: 15,
        callApi: async () => '新抽出的冷知识讲清了闸口为什么要先清淤。',
    });
    const generated = await harness.dashed.run({ auto: true, nearText: true, latestStory: '闸口在下雨' });
    assert.equal(generated.status, 'updated');
    assert.equal(generated.added, 1);
    assert.equal(harness.readItems().length, 3);
    harness.setSettings({ dashedKeepCount: 2 });
    assert.equal(harness.dashed.cleanup(true), 1);
    assert.equal(harness.readItems().length, 2);
    assert.equal(harness.readItems()[0].text.includes('闸口'), true);
});

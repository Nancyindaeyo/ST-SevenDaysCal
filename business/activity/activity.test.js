import test from 'node:test';
import assert from 'node:assert/strict';
import { entryTouchesLines, normalizeActivityEntry, sourceLabel } from './schema.js';
import { createActivityStore } from './store.js';
import { createActivityFeature } from './feature.js';
import { diffPointRaw, diffSnapshots, itemsFromPatches, sameSnapshot } from './diff.js';
import { activityOverlayHtml, renderActivityList } from './ui.js';

test('normalize activity entry keeps undo snapshot', () => {
    const entry = normalizeActivityEntry({
        source: 'guide',
        items: [{ module: 'point', title: '体检', action: 'complete' }],
        snapshot: { point: 'before' },
        after: { point: 'after' },
    });
    assert.equal(entry.source, 'guide');
    assert.equal(entry.items[0].title, '体检');
    assert.equal(entry.snapshot.point, 'before');
    assert.equal(sourceLabel('align-auto'), '自动对齐');
    assert.equal(entryTouchesLines(entry), false);
    assert.equal(entryTouchesLines({ source: 'advance', items: [] }), true);
});

test('store prepends per chat and caps', () => {
    const memory = new Map();
    const store = createActivityStore({
        cap: 2,
        keyForChat: id => `k:${id}`,
        storage: {
            getItem: key => memory.get(key) || null,
            setItem: (key, value) => memory.set(key, value),
        },
    });
    store.prepend('a', { id: '1', source: 'align', items: [{ module: 'point', title: 'A', action: 'edit' }] });
    store.prepend('a', { id: '2', source: 'guide', items: [{ module: 'lines', title: 'B', action: 'stall' }] });
    store.prepend('a', { id: '3', source: 'refresh', items: [{ module: 'outline', title: 'C', action: 'node' }] });
    assert.deepEqual(store.list('a').map(item => item.id), ['3', '2']);
    assert.equal(store.list('b').length, 0);
});

test('point complete appears in patch items and diffs', () => {
    const items = itemsFromPatches({ applied: [{ module: 'point', title: '体检', action: 'complete' }] }, { applied: [] });
    assert.deepEqual(items[0], { module: 'point', title: '体检', action: 'complete' });
    const before = `<calendar_widget>
StartDate: 2024-03-01
Day: 1|晴|12℃
Event: main|体检|去做体检|上午|医院||false
</calendar_widget>`;
    const after = `<calendar_widget>
StartDate: 2024-03-01
Day: 1|晴|12℃
</calendar_widget>`;
    assert.equal(diffPointRaw(before, after)[0].action, 'complete');
});

test('feature records and refuses undo after later edits', async () => {
    let point = 'after';
    const feature = createActivityFeature({
        chatId: () => 'c1',
        storage: { getItem: () => '[]', setItem() {} },
        keyForChat: () => 'k',
        readPoint: () => point,
        writePoint: async raw => { point = raw; },
        toast() {},
    });
    const entry = feature.record({
        source: 'guide',
        items: [{ module: 'point', title: '体检', action: 'complete' }],
        snapshot: { point: 'before' },
        after: { point: 'after' },
    });
    point = 'edited-later';
    const refused = await feature.undo(entry.id);
    assert.equal(refused.reason, 'diverged');
    assert.equal(point, 'edited-later');
    point = 'after';
    const ok = await feature.undo(entry.id);
    assert.equal(ok.status, 'updated');
    assert.equal(point, 'before');
    assert.equal(feature.list()[0].undone, true);
});

test('same snapshot helper and list html include undo', () => {
    assert.equal(sameSnapshot({ point: 'a' }, { point: 'a' }), true);
    assert.equal(sameSnapshot({ point: 'a' }, { point: 'b' }), false);
    const html = renderActivityList([{
        id: '1', ts: Date.now(), source: 'guide', undone: false,
        items: [{ module: 'point', title: '体检', action: 'complete' }],
        snapshot: { point: 'x' },
    }]);
    assert.match(html, /间引导/);
    assert.match(html, /撤回/);
    assert.match(html, /体检/);
});

test('activity cards keep align notes and mark a restyled floor', () => {
    const html = renderActivityList([{
        id: '1', ts: Date.now(), source: 'align-auto', undone: false, stale: true,
        note: '体检已发生，从今天拿掉',
        items: [{ module: 'point', title: '体检', action: 'complete' }],
        snapshot: { point: 'x' },
    }]);
    assert.match(html, /体检已发生/);
    assert.match(html, /这楼重 roll 了/);
    assert.match(activityOverlayHtml(), /手动补时间戳/);
    assert.match(html, /拿到间里聊/);
});

test('advance cards jump to lines and do not auto-write diary notes', () => {
    const html = renderActivityList([{
        id: '2', ts: Date.now(), source: 'advance', undone: false,
        items: [{ module: 'lines', title: '调查', action: 'advance' }],
        snapshot: { lines: 'x' },
    }]);
    assert.match(html, /去线里看/);
    assert.doesNotMatch(html, /往前走了一拍/);
    const feature = createActivityFeature({
        chatId: () => 'c1',
        storage: { getItem: () => '[]', setItem() {} },
        keyForChat: () => 'k',
        query: () => ({ length: 0 }),
    });
    const entry = feature.record({
        source: 'advance',
        items: [{ module: 'lines', title: '调查', action: 'advance' }],
        snapshot: { lines: 'before' },
        after: { lines: 'after' },
    });
    assert.equal(entry.note, '');
});

test('restyle of the same floor flags that floor\'s align card', () => {
    const memory = new Map();
    const feature = createActivityFeature({
        chatId: () => 'c1',
        storage: {
            getItem: key => memory.get(key) || '[]',
            setItem: (key, value) => memory.set(key, value),
        },
        keyForChat: () => 'k',
        query: () => ({ length: 0 }),
    });
    feature.record({
        source: 'align-auto',
        floorId: 4,
        signature: 'old',
        items: [{ module: 'point', title: '体检', action: 'complete' }],
        snapshot: { point: 'before' },
        after: { point: 'after' },
        note: '体检已发生',
    });
    assert.equal(feature.markFloorRestyle({ floorId: 4, signature: 'old' }).status, 'ok');
    assert.equal(feature.restyled, false);
    assert.equal(feature.markFloorRestyle({ floorId: 4, signature: 'new' }).status, 'stale');
    assert.equal(feature.restyled, true);
    assert.equal(feature.list()[0].stale, true);
    assert.equal(feature.list()[0].note, '体检已发生');
});

test('replayFloorAdvance restores the latest undone advance for a floor', async () => {
    let lines = 'after-1';
    const feature = createActivityFeature({
        chatId: () => 'c1',
        storage: { getItem: () => '[]', setItem() {} },
        keyForChat: () => 'k',
        readLines: () => lines,
        writeLines: async raw => { lines = raw; },
        query: () => ({ length: 0 }),
    });
    const first = feature.record({
        source: 'advance',
        floorId: 3,
        snapshot: { lines: 'before' },
        after: { lines: 'after-1' },
        items: [{ module: 'lines', title: '线', action: 'advance' }],
    });
    assert.equal(first.note, '');
    assert.equal((await feature.replayFloorAdvance(3)).status, 'updated');
    assert.equal(lines, 'before');
    assert.equal(feature.list()[0].undone, true);
    lines = 'after-1';
    feature.record({
        source: 'advance',
        floorId: 3,
        snapshot: { lines: 'before' },
        after: { lines: 'after-1' },
        items: [{ module: 'lines', title: '线', action: 'advance' }],
    });
    lines = 'edited';
    assert.equal((await feature.replayFloorAdvance(3)).status, 'diverged');
    assert.equal(lines, 'edited');
});

test('diffSnapshots ignores untouched modules', () => {
    const items = diffSnapshots({ point: 'same', lines: 'old' }, { point: 'same', lines: 'old' });
    assert.equal(items.length, 0);
});

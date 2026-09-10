import test from 'node:test';
import assert from 'node:assert/strict';
import { entryTouchesLines, entryTouchesPoint, floorUnchangedNote, isAlignEntry, normalizeActivityEntry, sourceLabel, canUndoActivity } from './schema.js';
import { createActivityStore, createActivityChatStorage } from './store.js';
import { createActivityFeature } from './feature.js';
import { diffPointRaw, diffSnapshots, itemsFromPatches, sameSnapshot } from './diff.js';
import { activityOverlayHtml, renderActivityList, renderPaceDetail } from './ui.js';

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

test('undo restores untouched items after a later hand edit', async () => {
    const widget = (aDesc, bDesc) => `<calendar_widget>
StartDate: 2024-03-01
Day: 1|晴|12℃
Event: main|体检|${aDesc}|上午|医院||false
Id: POINT-a
Event: main|会议|${bDesc}|下午|公司||false
Id: POINT-b
</calendar_widget>`;
    let point = widget('对齐后体检', '对齐后会议');
    const feature = createActivityFeature({
        chatId: () => 'c1',
        storage: { getItem: () => '[]', setItem() {} },
        keyForChat: () => 'k',
        readPoint: () => point,
        writePoint: async raw => { point = raw; },
        toast() {},
    });
    const entry = feature.record({
        source: 'align',
        items: [
            { module: 'point', title: '体检', action: 'edit', ref: 'POINT-a' },
            { module: 'point', title: '会议', action: 'edit', ref: 'POINT-b' },
        ],
        snapshot: { point: widget('原体检', '原会议') },
        after: { point: widget('对齐后体检', '对齐后会议') },
    });
    point = widget('对齐后体检', '后来手改会议');
    const ok = await feature.undo(entry.id);
    assert.equal(ok.status, 'updated');
    assert.equal(ok.mode, 'partial');
    assert.match(point, /原体检/);
    assert.match(point, /后来手改会议/);
    assert.doesNotMatch(point, /对齐后体检/);
    assert.equal(feature.list()[0].undone, false);
    assert.deepEqual(feature.list()[0].undoneRefs, ['POINT-a']);
});

test('activity cards expose per-item undo', () => {
    const html = renderActivityList([{
        id: '1', ts: Date.now(), source: 'align', undone: false,
        items: [{ module: 'point', title: '体检', action: 'complete', ref: 'POINT-a' }],
        snapshot: { point: 'x' },
        after: { point: 'y' },
    }]);
    assert.match(html, /sp-activity-undo-item/);
    assert.match(html, /data-ref="POINT-a"/);
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

test('advance cards jump to the line item and do not auto-write diary notes', () => {
    const html = renderActivityList([{
        id: '2', ts: Date.now(), source: 'advance', undone: false,
        items: [{ module: 'lines', title: '调查', action: 'advance' }],
        snapshot: { lines: 'x' },
    }]);
    assert.match(html, /sp-activity-jump/);
    assert.match(html, /data-module="lines"/);
    assert.doesNotMatch(html, /去线里看|去点里看/);
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

test('chat storage migrates legacy localStorage once then reads chat entries', () => {
    const chat = new Map();
    const browser = new Map();
    const storage = createActivityChatStorage({
        read: () => chat.get('saved') || null,
        write: value => chat.set('saved', value),
        browserStorage: {
            getItem: key => browser.get(key) || null,
            removeItem: key => browser.delete(key),
        },
        chatId: () => 'c1',
    });
    browser.set('sp-activity:c1', JSON.stringify([{ id: '1', source: 'advance', items: [] }]));
    const migrated = JSON.parse(storage.getItem());
    assert.equal(migrated[0].id, '1');
    assert.deepEqual(chat.get('saved').entries[0].id, '1');
    assert.equal(browser.has('sp-activity:c1'), false);
    storage.setItem('k', JSON.stringify([{ id: '2', source: 'align', items: [] }]));
    assert.equal(JSON.parse(storage.getItem())[0].id, '2');
});

test('unchanged and failed aligns are recorded without undo snapshots', () => {
    assert.equal(floorUnchangedNote(56), '56楼没有变化');
    const unchanged = normalizeActivityEntry({
        source: 'align-auto',
        cause: 'auto',
        outcome: 'unchanged',
        floorId: 56,
        note: '56楼没有变化',
        snapshot: { point: 'should-drop' },
    });
    assert.equal(unchanged.snapshot, null);
    assert.equal(isAlignEntry(unchanged), true);
    const failed = normalizeActivityEntry({
        source: 'align-auto',
        cause: 'reroll',
        outcome: 'failed',
        error: '请先配置 API',
        note: '请先配置 API',
        floorId: 56,
    });
    assert.equal(failed.cause, 'reroll');
    const html = renderActivityList([failed, unchanged]);
    assert.match(html, /重试/);
    assert.match(html, /56楼没有变化/);
    assert.match(html, /重 roll 后按新正文补/);
    assert.doesNotMatch(html, />撤回</);
    assert.match(renderPaceDetail('align', [failed, unchanged]), /失败/);
    assert.doesNotMatch(renderPaceDetail('align', [failed, unchanged]), /完成并删除|去点里看/);
    assert.equal(entryTouchesPoint(failed), true);
});

test('only the latest align attempt can be undone', () => {
    const older = normalizeActivityEntry({
        id: 'old', source: 'align-auto', outcome: 'patched',
        snapshot: { point: 'a' }, after: { point: 'b' },
        items: [{ module: 'point', title: '体检', action: 'complete' }],
    });
    const latest = normalizeActivityEntry({
        id: 'new', source: 'align-auto', outcome: 'patched',
        snapshot: { point: 'b' }, after: { point: 'c' },
        items: [{ module: 'point', title: '抽查', action: 'edit' }],
    });
    assert.equal(canUndoActivity(latest, [latest, older]), true);
    assert.equal(canUndoActivity(older, [latest, older]), false);
    assert.match(renderActivityList([latest, older]), /data-id="new"[^>]*>撤回/);
    assert.doesNotMatch(renderActivityList([latest, older]), /data-id="old"[^>]*>撤回/);
});

test('realign restores the last align then calls align', async () => {
    let point = 'after';
    const calls = [];
    const feature = createActivityFeature({
        chatId: () => 'c1',
        storage: { getItem: () => '[]', setItem() {} },
        keyForChat: () => 'k',
        readPoint: () => point,
        writePoint: async raw => { point = raw; },
        query: () => ({ length: 0 }),
        realign: async opts => { calls.push(opts.cause); return { status: 'updated' }; },
    });
    feature.record({
        source: 'align-auto',
        outcome: 'patched',
        items: [{ module: 'point', title: '体检', action: 'complete' }],
        snapshot: { point: 'before' },
        after: { point: 'after' },
    });
    const reroll = await feature.realign({ cause: 'reroll' });
    assert.equal(reroll.status, 'updated');
    assert.equal(point, 'before');
    assert.deepEqual(calls, ['reroll']);
    assert.equal(feature.list()[0].undone, true);
});

test('auto reroll refuses to overwrite later point edits', async () => {
    let point = 'edited';
    const feature = createActivityFeature({
        chatId: () => 'c1',
        storage: { getItem: () => '[]', setItem() {} },
        keyForChat: () => 'k',
        readPoint: () => point,
        writePoint: async raw => { point = raw; },
        query: () => ({ length: 0 }),
        toast() {},
        realign: async () => ({ status: 'updated' }),
    });
    feature.record({
        source: 'align-auto',
        outcome: 'patched',
        items: [{ module: 'point', title: '体检', action: 'complete' }],
        snapshot: { point: 'before' },
        after: { point: 'after' },
    });
    const refused = await feature.realign({ cause: 'reroll' });
    assert.equal(refused.status, 'diverged');
    assert.equal(point, 'edited');
});

test('pace detail shows the latest matching round items with jumps, not card actions', () => {
    const older = normalizeActivityEntry({
        id: 'old', source: 'align-auto', outcome: 'patched',
        items: [{ module: 'point', title: '旧点', action: 'edit' }],
    });
    const latest = normalizeActivityEntry({
        id: 'new', source: 'align-auto', outcome: 'patched',
        items: [
            { module: 'point', title: '体检', action: 'complete' },
            { module: 'lines', title: '调查', action: 'advance' },
        ],
    });
    const html = renderPaceDetail('align', [latest, older]);
    assert.match(html, /体检/);
    assert.match(html, /调查/);
    assert.doesNotMatch(html, /旧点/);
    assert.match(html, /sp-activity-jump/);
    assert.doesNotMatch(html, /去点里看|去线里看|>撤回<|>重试</);
});

test('jumpToItem closes the overlay and reports missing targets', async () => {
    const calls = [];
    const overlay = {
        length: 1,
        stop() { return overlay; },
        css(style) { calls.push(['css', style]); return overlay; },
        attr() { return overlay; },
        animate() { return overlay; },
        prop() { return overlay; },
        html() { return overlay; },
        toggleClass() { return overlay; },
        text() { return overlay; },
    };
    const feature = createActivityFeature({
        chatId: () => 'c1',
        storage: { getItem: () => '[]', setItem() {} },
        keyForChat: () => 'k',
        query: () => overlay,
        $: () => overlay,
        toast: message => calls.push(['toast', message]),
        openItem: async item => {
            calls.push(['open', item.module, item.title]);
            return { status: 'missing' };
        },
    });
    const result = await feature.jumpToItem({ module: 'point', title: '体检' });
    assert.equal(result.status, 'missing');
    assert.deepEqual(calls.filter(item => item[0] !== 'css').slice(0, 2), [
        ['open', 'point', '体检'],
        ['toast', '这条已经不在了'],
    ]);
});

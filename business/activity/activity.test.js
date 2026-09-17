import test from 'node:test';
import assert from 'node:assert/strict';
import { actionLabel, ACTIVITY_CAP, entryTouchesLines, entryTouchesPoint, floorUnchangedNote, isAdvanceEntry, isAlignEntry, isRetryableEntry, normalizeActivityEntry, sourceLabel, canUndoActivity } from './schema.js';
import { createActivityStore, createActivityChatStorage } from './store.js';
import { createActivityFeature } from './feature.js';
import { diffPointRaw, diffSnapshots, itemsFromPatches, sameSnapshot } from './diff.js';
import { activityOverlayHtml, activityClockLabel, authorChangeSummary, renderActivityList, renderPaceDetail, renderQueueStatus } from './ui.js';

test('normalize activity entry keeps undo snapshot', () => {
    const entry = normalizeActivityEntry({
        source: 'guide',
        items: [{ module: 'point', title: '体检', action: 'complete' }],
        snapshot: { point: 'before' },
        after: { point: 'after' },
    });
    assert.equal(entry.source, 'guide');
    assert.equal(entry.floorId, null);
    assert.equal(normalizeActivityEntry({ source: 'dashed', floorId: 0 }).floorId, 0);
    assert.equal(entry.items[0].title, '体检');
    assert.equal(entry.snapshot.point, 'before');
    assert.equal(sourceLabel('align-auto'), '自动对齐');
    assert.equal(entryTouchesLines(entry), false);
    assert.equal(entryTouchesLines({ source: 'advance', items: [] }), true);
});

test('activity normalization preserves a bounded retry payload', () => {
    const regen = normalizeActivityEntry({
        source: 'refresh',
        outcome: 'failed',
        retry: {
            kind: 'regen',
            selected: ['outline', 'unknown'],
            reason: '按原要求重做',
            feedback: '不要改锁定项',
            outlineMode: 'continue',
        },
    });
    assert.deepEqual(regen.retry, {
        kind: 'regen',
        selected: ['outline'],
        reason: '按原要求重做',
        feedback: '不要改锁定项',
        outlineMode: 'continue',
    });
    const fight = normalizeActivityEntry({
        source: 'fight',
        outcome: 'failed',
        retry: {
            kind: 'fight',
            intent: {
                kind: 'fight',
                modules: ['point'],
                items: [{ module: 'point', title: '赴约', change: '改到晚上', ref: 'POINT-1' }],
                avoid: '不要动线',
                reason: '时间冲突',
                text: '修正赴约',
            },
        },
    });
    assert.equal(fight.retry.intent.items[0].change, '改到晚上');
    assert.equal(fight.retry.intent.reason, '时间冲突');
    assert.deepEqual(normalizeActivityEntry(fight).retry, fight.retry);
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

test('activity log retains enough replay records but renders three recent cards', () => {
    assert.equal(ACTIVITY_CAP, 24);
    assert.equal(actionLabel('complete', 'point'), '完成并删除');
    assert.equal(actionLabel('complete', 'lines'), '收束');
    const memory = new Map();
    const store = createActivityStore({
        keyForChat: id => `k:${id}`,
        storage: {
            getItem: key => memory.get(key) || null,
            setItem: (key, value) => memory.set(key, value),
        },
    });
    for (let i = 1; i <= 5; i++) store.prepend('a', { id: String(i), source: 'align', items: [{ module: 'lines', title: `线${i}`, action: 'complete' }] });
    assert.deepEqual(store.list('a').map(item => item.id), ['5', '4', '3', '2', '1']);
    memory.set('k:old', JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ id: `old${i}`, source: 'align' }))));
    store.clearMemory('old');
    assert.equal(store.list('old').length, 24);
    const html = renderActivityList([{
        id: 'x', source: 'align', items: [{ module: 'lines', title: '旧线', action: 'complete' }],
    }]);
    assert.match(html, /收束/);
    assert.doesNotMatch(html, /完成并删除/);
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
    assert.equal(sameSnapshot({ ledger: { entries: [{ id: 'L1' }], seq: 1 } }, { ledger: { entries: [{ id: 'L1' }], seq: 1 } }), true);
    assert.equal(sameSnapshot({ ledger: { entries: [], seq: 1 } }, { ledger: { entries: [{ id: 'L1' }], seq: 1 } }), false);
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
    assert.match(activityOverlayHtml(), /sp-activity-clock/);
    assert.match(activityOverlayHtml(), /后台与改动/);
    assert.match(activityOverlayHtml(), /本楼/);
    assert.match(activityOverlayHtml(), /最近/);
    assert.match(html, /拿到间里聊/);
});

test('queue status shows idle, running, wait and retryable failures', () => {
    assert.match(renderQueueStatus(null), /这楼后台空闲/);
    assert.match(renderQueueStatus({ running: { id: 'align', label: '对齐' }, queued: [{ id: 'advance', label: '推进' }] }), /正在对齐/);
    assert.match(renderQueueStatus({ running: { id: 'align', label: '对齐' }, queued: [{ id: 'advance', label: '推进' }] }), /等待 推进/);
    const failed = renderQueueStatus({ failed: [{ id: 'dashed', label: '冷知识' }] });
    assert.match(failed, /data-queue-retry="dashed"/);
    assert.match(failed, /冷知识失败/);
    const observable = renderQueueStatus({
        queued: [{ id: 'advance', label: '推进', enqueuedAt: Date.now() }],
        rejected: [{ id: 'align', label: '对齐', reason: 'duplicate' }],
    });
    assert.match(observable, /data-queue-cancel="advance"/);
    assert.match(observable, /重复任务已合并/);
    assert.match(renderQueueStatus({
        rejected: [{ id: 'outline', label: '面判定', reason: 'automation-disabled' }],
    }), /自动化开关或账本条件未满足/);
});

test('author change summary keeps completed changes and omits failed attempts', () => {
    const text = authorChangeSummary([
        normalizeActivityEntry({
            source: 'advance',
            outcome: 'patched',
            note: '调查往前走了一拍',
            items: [{ module: 'lines', title: '调查', action: 'advance' }],
            floorId: 8,
            ts: 1,
        }),
        normalizeActivityEntry({
            source: 'advance',
            outcome: 'patched',
            note: '上一楼的变更',
            items: [{ module: 'point', title: '旧安排', action: 'add' }],
            floorId: 7,
            ts: 0,
        }),
        normalizeActivityEntry({
            source: 'outline',
            outcome: 'failed',
            error: '格式错误',
            ts: 2,
        }),
    ], { clockLabel: '当前时间戳 5月1日', floorId: 8 });
    assert.match(text, /本轮变更摘要/);
    assert.match(text, /当前时间戳 5月1日/);
    assert.match(text, /调查往前走了一拍/);
    assert.doesNotMatch(text, /格式错误/);
    assert.doesNotMatch(text, /上一楼的变更/);
});

test('activity feature copies the author change summary', async () => {
    const copied = [];
    const toasts = [];
    const feature = createActivityFeature({
        chatId: () => 'c1',
        storage: { getItem: () => '[]', setItem() {} },
        keyForChat: () => 'k',
        clockLabel: () => '当前时间戳 5月1日',
        copyText: async text => { copied.push(text); return true; },
        toast: message => toasts.push(message),
    });
    feature.record({
        source: 'advance',
        outcome: 'patched',
        items: [{ module: 'lines', title: '调查', action: 'advance' }],
    });
    assert.equal((await feature.copySummary()).status, 'copied');
    assert.match(copied[0], /调查/);
    assert.deepEqual(toasts, ['本轮变更摘要已复制']);
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

test('activity persistence failures are reported and legacy data is retained', () => {
    const failures = [];
    const store = createActivityStore({
        keyForChat: id => `k:${id}`,
        storage: { setItem() { throw new Error('quota'); } },
        onPersistenceError: failure => failures.push(failure),
    });
    store.prepend('c1', { id: 'volatile', source: 'advance', items: [] });
    assert.equal(failures.length, 1);
    assert.equal(failures[0].ok, false);
    assert.equal(failures[0].memoryOnly, true);
    assert.equal(failures[0].reason, 'storage-write-failed');

    const falseWrites = [];
    createActivityStore({
        keyForChat: id => `k:${id}`,
        storage: { setItem: () => false },
        onPersistenceError: failure => falseWrites.push(failure.reason),
    }).prepend('c1', { id: 'false-write', source: 'advance', items: [] });
    assert.deepEqual(falseWrites, ['storage-write-failed']);
    const unavailable = [];
    createActivityStore({
        keyForChat: id => `k:${id}`,
        onPersistenceError: failure => unavailable.push(failure.reason),
    }).prepend('c1', { id: 'missing-storage', source: 'advance', items: [] });
    assert.deepEqual(unavailable, ['storage-unavailable']);

    const browser = new Map([['sp-activity:c1', JSON.stringify([{ id: 'legacy', source: 'advance' }])]]);
    const storage = createActivityChatStorage({
        read: () => null,
        write: () => false,
        browserStorage: {
            getItem: key => browser.get(key) || null,
            removeItem: key => browser.delete(key),
        },
        chatId: () => 'c1',
    });
    assert.throws(() => storage.getItem(), /activity-write-failed/);
    assert.equal(browser.has('sp-activity:c1'), true);
    const migrationFailures = [];
    const migratedStore = createActivityStore({
        keyForChat: () => 'activity-user',
        storage,
        onPersistenceError: failure => migrationFailures.push(failure.reason),
    });
    assert.deepEqual(migratedStore.list('c1'), []);
    assert.deepEqual(migrationFailures, ['storage-read-failed']);
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

test('failed advance cards can be retried and the overlay has catch-up actions', () => {
    const failed = normalizeActivityEntry({
        source: 'advance',
        cause: 'auto',
        outcome: 'failed',
        error: '请先配置 API',
        note: '请先配置 API',
        floorId: 12,
    });
    assert.equal(isAdvanceEntry(failed), true);
    const html = renderActivityList([failed]);
    assert.match(html, /重试/);
    assert.match(html, /请先配置 API/);
    assert.doesNotMatch(html, />撤回</);
    const overlay = activityOverlayHtml();
    assert.match(overlay, /sp-activity-readvance/);
    assert.match(overlay, /sp-activity-catchup/);
    assert.match(overlay, /手动推进到今天/);
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

test('readvance restores the last advance then calls force advance', async () => {
    let lines = 'after';
    const calls = [];
    const feature = createActivityFeature({
        chatId: () => 'c1',
        storage: { getItem: () => '[]', setItem() {} },
        keyForChat: () => 'k',
        readLines: () => lines,
        writeLines: async raw => { lines = raw; },
        query: () => ({ length: 0 }),
        readvance: async opts => { calls.push(opts.cause); return { status: 'updated' }; },
    });
    feature.record({
        source: 'advance',
        outcome: 'patched',
        items: [{ module: 'lines', title: '调查', action: 'advance' }],
        snapshot: { lines: 'before' },
        after: { lines: 'after' },
    });
    const retry = await feature.readvance({ cause: 'retry' });
    assert.equal(retry.status, 'updated');
    assert.equal(lines, 'before');
    assert.deepEqual(calls, ['retry']);
    assert.equal(feature.list()[0].undone, true);
});

test('markLatestSourceFloor upgrades one dashed card instead of cloning it', () => {
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
    const first = feature.record({
        source: 'dashed',
        items: [{ module: 'dashed', title: '基地体育馆', action: 'add', ref: 'd1' }],
    });
    feature.markLatestSourceFloor('dashed', 12, {
        snapshot: { dashed: [] },
        after: { dashed: [{ id: 'd1', text: '基地体育馆用了防腐铁皮顶。' }] },
        since: first.ts,
    });
    assert.equal(feature.list().length, 1);
    assert.equal(feature.list()[0].id, first.id);
    assert.equal(feature.list()[0].floorId, 12);
    assert.ok(feature.list()[0].snapshot);
    assert.equal(canUndoActivity(feature.list()[0], feature.list()), true);
});

test('catch-up advance does not restore a previous snapshot', async () => {
    let lines = 'current';
    const feature = createActivityFeature({
        chatId: () => 'c1',
        storage: { getItem: () => '[]', setItem() {} },
        keyForChat: () => 'k',
        readLines: () => lines,
        writeLines: async raw => { lines = raw; },
        query: () => ({ length: 0 }),
        toast() {},
        catchUpAdvance: async () => ({ status: 'updated' }),
    });
    feature.record({
        source: 'advance',
        outcome: 'patched',
        items: [{ module: 'lines', title: '调查', action: 'advance' }],
        snapshot: { lines: 'before' },
        after: { lines: 'after' },
    });
    const result = await feature.catchUpAdvance();
    assert.equal(result.status, 'updated');
    assert.equal(lines, 'current');
});

test('pace detail shows the latest matching round items with jumps and card actions', () => {
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
    assert.match(html, />重试</);
    assert.doesNotMatch(html, /去点里看|去线里看/);
});

test('activity list can expand past three cards and failed cards show reasonCode', () => {
    const entries = [0, 1, 2, 3].map(i => normalizeActivityEntry({
        id: `e${i}`,
        source: i === 0 ? 'outline' : 'align',
        outcome: i === 0 ? 'failed' : 'unchanged',
        error: i === 0 ? '面判定失败' : '',
        reasonCode: i === 0 ? 'outline-judge-format' : '',
        note: `n${i}`,
    }));
    const preview = renderActivityList(entries);
    assert.match(preview, /查看更早（1）/);
    assert.doesNotMatch(preview, /n3/);
    assert.match(preview, /outline-judge-format/);
    assert.match(renderActivityList(entries, { expanded: true }), /n3/);
    assert.match(activityOverlayHtml(), /sp-activity-blocked/);
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

test('activity clock label prefers the latest stamp, else axis today', () => {
    assert.equal(activityClockLabel({
        clock: { endMeta: { month: 5, day: 1, weekdayText: '周四', time: '午时' } },
        today: { month: 4, day: 30 },
    }), '当前时间戳 5月1日 周四 午时');
    assert.match(activityClockLabel({
        clock: null,
        today: { month: 5, day: 1 },
        weekdayFor: () => '周四',
    }), /这楼还没有时间戳，轴上今天是 5月1日 周四/);
    assert.equal(activityClockLabel({}), '还没有故事日期');
});

test('failed bootstrap fill and refresh cards can be retried from 【改】', () => {
    for (const source of ['bootstrap', 'fill', 'refresh']) {
        const entry = normalizeActivityEntry({ source, outcome: 'failed', error: '挂了', reasonCode: `${source}-failed` });
        assert.equal(isRetryableEntry(entry), true);
        assert.match(renderActivityList([entry]), /重试/);
        assert.match(renderActivityList([entry]), /挂了/);
    }
});

test('manual outline cursor can be undone only while the snapshot still matches', async () => {
    const raw = 'Beat: 当下|起|铺垫|线A|待演\nScene: 一\nSubtext: 潜\nThink: 想\nBeat: 其后|承|推进|线A|待演\nScene: 二\nSubtext: 潜\nThink: 想';
    let outline = { raw, cursor: 2 };
    const feature = createActivityFeature({
        chatId: () => 'c1',
        storage: { getItem: () => '[]', setItem() {} },
        keyForChat: () => 'k',
        readOutline: () => outline,
        writeOutline: async next => { outline = next; },
        query: () => ({ length: 0 }),
        toast() {},
    });
    const entry = feature.record({
        source: 'outline',
        cause: 'manual',
        items: [{ module: 'outline', title: '其后', action: 'cursor' }],
        snapshot: { outline: { raw, cursor: 1 } },
        after: { outline: { raw, cursor: 2 } },
        note: '手改面游标到「其后」',
    });
    const html = renderActivityList([entry]);
    assert.match(html, /手改/);
    assert.match(html, /撤回/);
    const ok = await feature.undo(entry.id);
    assert.equal(ok.status, 'updated');
    assert.equal(outline.cursor, 1);
    outline = { raw, cursor: 2 };
    feature.record({
        source: 'outline',
        cause: 'manual',
        items: [{ module: 'outline', title: '其后', action: 'cursor' }],
        snapshot: { outline: { raw, cursor: 1 } },
        after: { outline: { raw, cursor: 2 } },
    });
    outline = { raw, cursor: 0 };
    const refused = await feature.undo(feature.list()[0].id);
    assert.equal(refused.reason, 'diverged');
    assert.equal(outline.cursor, 0);
});

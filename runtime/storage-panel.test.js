import test from 'node:test';
import assert from 'node:assert/strict';
import {
    kindClearDetail,
    ownKeyClearBranch,
    ownKeyClearDetail,
    readStorageChatIdentity,
    sameStorageChat,
    shouldIgnoreKindClear,
    storageRetryFeedback,
    storageRow,
    STORAGE_CLEAR_TARGETS,
} from './storage-panel.js';

test('storage identity needs a chat id and compares metadata by reference', () => {
    assert.equal(readStorageChatIdentity({}), null);
    const metadata = {};
    const id = readStorageChatIdentity({ chatId: 'a', chatMetadata: metadata });
    assert.deepEqual(id, { chatId: 'a', metadata });
    assert.equal(sameStorageChat(id, { chatId: 'a', metadata }), true);
    assert.equal(sameStorageChat(id, { chatId: 'a', metadata: {} }), false);
    assert.equal(sameStorageChat(id, { chatId: 'b', metadata }), false);
});

test('almanac kind clear is blocked so calendar uses the exact dataKey path', () => {
    assert.equal(shouldIgnoreKindClear(STORAGE_CLEAR_TARGETS.almanac.kind), true);
    assert.equal(shouldIgnoreKindClear('schedule'), false);
    assert.match(kindClearDetail('almanac', '轴'), /节日、生日、纪念日/);
    assert.match(kindClearDetail('lines', '线（伏笔）'), /我方 \/ TA 方视角都会一并清掉/);
});

test('own-key clear routes ledger and theater away from generic wipe', () => {
    assert.equal(ownKeyClearBranch('sp-ledger'), 'ledger');
    assert.equal(ownKeyClearBranch('sp-theater'), 'theater');
    assert.equal(ownKeyClearBranch('sp-memory'), 'generic');
    assert.match(ownKeyClearDetail('sp-ledger', '轴·刻度'), /活跃\/已了结刻度/);
    assert.match(ownKeyClearDetail('sp-memory', '记忆'), /全部数据/);
});

test('retry toast distinguishes ready from backend failure', () => {
    assert.deepEqual(storageRetryFeedback({ status: 'ready' }), { message: '外置构画数据已重新加载', error: false });
    assert.deepEqual(storageRetryFeedback({ status: 'error', error: 'timeout' }), { message: '重试失败：timeout', error: true });
});

test('storage row escapes labels but keeps action html', () => {
    const html = storageRow('<x>', '12 B', '<button>清</button>');
    assert.match(html, /&lt;x&gt;/);
    assert.match(html, /<button>清<\/button>/);
});

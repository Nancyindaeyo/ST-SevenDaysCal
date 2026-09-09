import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ALMANAC_CLEAR_DATA_KEY,
    ANCHOR_STORAGE_EMPTY_HTML,
    ANCHOR_STORAGE_FAILED_HTML,
    anchorStorageHtml,
    chatStorageSection,
    kindClearButton,
    kindClearDetail,
    localCacheClearButton,
    migrationProgressCopy,
    ownKeyClearBranch,
    ownKeyClearDetail,
    paintStorageMode,
    paintStorageUsage,
    readStorageChatIdentity,
    sameStorageChat,
    shouldIgnoreKindClear,
    storageModeCopy,
    storageRetryFeedback,
    storageRow,
    STORAGE_CLEAR_TARGETS,
    STORAGE_EMPTY_CHAT_HTML,
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

test('storage mode copy covers empty chat, external, and probe states', () => {
    assert.equal(storageModeCopy({}).text, '当前没有打开聊天。');
    assert.match(storageModeCopy({ chatId: 'a', mode: 'external', status: 'ready' }).text, /白鳥数据后端/);
    assert.match(storageModeCopy({ chatId: 'a', mode: 'external', status: 'ready', error: 'timeout' }).text, /timeout/);
    const unavailable = storageModeCopy({ chatId: 'a', mode: 'external', status: 'error', error: 'down' });
    assert.equal(unavailable.hideRetry, false);
    assert.equal(storageModeCopy({ chatId: 'a', mode: 'external', status: 'invalid' }).hideRetry, true);
    assert.equal(storageModeCopy({ chatId: 'a', mode: 'chat' }).probe, true);
    assert.equal(storageModeCopy({ chatId: 'a', mode: 'chat' }, { ok: true }).hideMigrate, false);
    assert.match(storageModeCopy({ chatId: 'a', mode: 'chat' }, { ok: false }).text, /未检测到兼容/);
});

test('paintStorageMode aborts after probe if chat left chat-mode', async () => {
    const texts = [];
    let hiddenMigrate = true;
    const states = [
        { chatId: 'a', mode: 'chat' },
        { chatId: 'a', mode: 'external' },
    ];
    await paintStorageMode({
        $status: { length: 1, text: value => texts.push(value) },
        $migrate: { prop(name, value) { if (name === 'hidden') hiddenMigrate = value; } },
        $retry: { prop() {} },
        storageStatus: () => states.shift() || { chatId: 'a', mode: 'external' },
        probe: async () => ({ ok: true }),
    });
    assert.deepEqual(texts, ['正在检测白鳥数据后端…']);
    assert.equal(hiddenMigrate, true);
});

test('chat storage html skips empty kinds and uses datakey for almanac', () => {
    assert.equal(chatStorageSection({ hasStore: false, ownKeyBytes: {} }), STORAGE_EMPTY_CHAT_HTML);
    const html = chatStorageSection({
        hasStore: true,
        usage: { schedule: 12, almanac: 8, lines: 0 },
        ownKeyBytes: { 'sp-memory': 4, 'sp-theater': 0, 'sp-ledger': 0 },
        formatBytes: b => `${b}B`,
        userClearKinds: ['schedule', 'almanac', 'lines'],
    });
    assert.match(html, /点（待办）/);
    assert.match(html, /data-scope="kind" data-kind="schedule"/);
    assert.match(html, new RegExp(`data-scope="datakey" data-key="${ALMANAC_CLEAR_DATA_KEY}"`));
    assert.doesNotMatch(html, /data-kind="almanac"/);
    assert.doesNotMatch(html, /线（伏笔）/);
    assert.match(html, /记忆/);
    assert.match(html, /data-scope="ownkey" data-key="sp-memory"/);
    assert.equal(kindClearButton('almanac').includes('datakey'), true);
    assert.equal(localCacheClearButton(0), '');
    assert.match(localCacheClearButton(9), /data-scope="local"/);
    assert.equal(anchorStorageHtml({ count: 0 }), ANCHOR_STORAGE_EMPTY_HTML);
    assert.match(anchorStorageHtml({ count: 2, bytes: 10, formatBytes: b => `${b}B` }), /共 2 条收藏/);
});

test('paintStorageUsage fills layout then async anchors', async () => {
    let body = '';
    let anchor = '';
    await paintStorageUsage({
        $body: { length: 1, html: value => { body = value; } },
        $in: sel => sel === '#sp-storage-anchor-rows' ? { html: value => { anchor = value; } } : null,
        formatBytes: b => `${b}B`,
        hasStore: () => true,
        ownKeyBytes: () => 0,
        usageByKind: () => ({ schedule: 3 }),
        userClearKinds: ['schedule'],
        localBytes: () => 0,
        anchorUsage: async () => { throw new Error('down'); },
    });
    assert.match(body, /本聊天（随聊天文件存服务端）/);
    assert.match(body, /点（待办）/);
    assert.match(body, /统计中/);
    assert.equal(anchor, ANCHOR_STORAGE_FAILED_HTML);
});

test('migration progress copy locks abort only while committing', () => {
    const copying = migrationProgressCopy({ done: 2, total: 5 });
    assert.match(copying.status, /2 \/ 5/);
    assert.equal(copying.abortDisabled, false);
    const committing = migrationProgressCopy({ phase: 'committing' });
    assert.match(committing.status, /不能撤销/);
    assert.equal(committing.abortDisabled, true);
});

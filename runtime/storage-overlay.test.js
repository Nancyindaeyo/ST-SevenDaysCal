import test from 'node:test';
import assert from 'node:assert/strict';
import { backupOverlayProgressCopy, BLOCKING_OVERLAY_STYLE, MIGRATION_UNKNOWN_ABORT_LABEL, OVERLAY_BLOCK_EVENTS } from './storage-overlay.js';

test('backup overlay progress prefers message then count', () => {
    assert.equal(backupOverlayProgressCopy({ message: '写入中' }), '写入中');
    assert.equal(backupOverlayProgressCopy({ done: 2, total: 5 }), '2 / 5');
    assert.equal(backupOverlayProgressCopy({}), '处理中…');
});

test('storage lock overlay keeps the page-blocking contract', () => {
    assert.ok(OVERLAY_BLOCK_EVENTS.includes('keydown'));
    assert.ok(OVERLAY_BLOCK_EVENTS.includes('click'));
    assert.equal(BLOCKING_OVERLAY_STYLE.zIndex, '2147483647');
    assert.equal(MIGRATION_UNKNOWN_ABORT_LABEL, '关闭（请刷新聊天后核实）');
});

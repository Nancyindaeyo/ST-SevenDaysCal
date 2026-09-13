import test from 'node:test';
import assert from 'node:assert/strict';
import {
    alignableRefreshSelection,
    normalizeOutlineRegenMode,
    refreshAlignToast,
    refreshRegenGate,
    refreshRegenToast,
} from './bind.js';

test('align only keeps point and lines', () => {
    assert.deepEqual(alignableRefreshSelection(['point', 'lines', 'dashed', 'outline']), ['point', 'lines']);
    assert.deepEqual(alignableRefreshSelection(['dashed', 'outline']), []);
});

test('outline regen mode falls back to current', () => {
    assert.equal(normalizeOutlineRegenMode('all'), 'all');
    assert.equal(normalizeOutlineRegenMode('continue'), 'continue');
    assert.equal(normalizeOutlineRegenMode('weird'), 'current');
});

test('align toast covers empty and failed', () => {
    assert.deepEqual(refreshAlignToast({ status: 'invalid' }), { message: '请先勾选要动的模块', error: true });
    assert.deepEqual(refreshAlignToast({ status: 'skipped', reason: 'empty' }), { message: '还没有点或线可以对齐', error: true });
    assert.deepEqual(refreshAlignToast({ status: 'skipped', reason: 'busy' }), { message: '正在对齐或刷新，请稍后再点', error: true });
    assert.deepEqual(refreshAlignToast({ status: 'cancelled' }), { message: '这次对齐已取消', error: true });
    assert.deepEqual(refreshAlignToast({ status: 'failed', errorMessage: '超时' }), { message: '对齐失败：超时', error: true });
    assert.deepEqual(refreshAlignToast({ status: 'updated', unchanged: true }), { message: 'API 跑过了，点和线都不用改' });
    assert.deepEqual(refreshAlignToast({ status: 'updated', summary: '点已按正文对齐' }), { message: '点已按正文对齐' });
    assert.equal(refreshAlignToast({ status: 'ok' }), null);
});

test('regen asks for modules then a reason', () => {
    assert.deepEqual(refreshRegenGate({ selected: [], reason: '改' }), { message: '请先勾选要重新生成的模块', error: true, focus: false });
    assert.deepEqual(refreshRegenGate({ selected: ['point'], reason: '' }), { message: '重新生成请先写「为什么刷新」', error: true, focus: true });
    assert.equal(refreshRegenGate({ selected: ['point'], reason: '改' }), null);
    assert.deepEqual(refreshRegenToast({ status: 'invalid' }), { message: '重新生成请先写「为什么刷新」', error: true, focus: true });
    assert.deepEqual(refreshRegenToast({ status: 'skipped' }), { message: '请先勾选要重新生成的模块', error: true });
});

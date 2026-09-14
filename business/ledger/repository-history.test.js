import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCapturePlanAtomic, captureStateFromRoot } from './repository.js';

test('empty explicit capture still marks initialized without adding entries', async () => {
    const state = { entries: [], seq: 0, version: 1 };
    const result = await applyCapturePlanAtomic(
        { additions: [], patches: [], metaPatch: { initialized: true } },
        { chatId: 'c1', guard: () => true },
        { state, context: { chatId: 'c1' }, contextReader: () => ({ chatId: 'c1' }), save: async () => ({ ok: true, commitState: 'confirmed' }) },
    );
    assert.deepEqual(result.added, []);
    assert.equal(state.initialized, true);
    assert.equal(state.entries.length, 0);
    assert.equal(captureStateFromRoot(state).initialized, true);
});

test('first real capture archives nothing then a later capture archives the previous table', async () => {
    const state = { entries: [], seq: 0, version: 1 };
    const runtime = {
        state,
        context: { chatId: 'c1' },
        contextReader: () => ({ chatId: 'c1' }),
        save: async () => ({ ok: true, commitState: 'confirmed' }),
    };
    const first = await applyCapturePlanAtomic(
        { additions: [{ 事由: '旧伤', 类型: '持续状态', 现状: '还在流血。' }], patches: [], metaPatch: { initialized: true } },
        { chatId: 'c1', guard: () => true },
        runtime,
    );
    assert.equal(first.added.length, 1);
    assert.equal(Array.isArray(state.history) ? state.history.length : 0, 0);
    const second = await applyCapturePlanAtomic(
        { additions: [{ 事由: '新约定', 类型: '约定待办', 现状: '还没去。' }], patches: [], metaPatch: { initialized: true } },
        { chatId: 'c1', guard: () => true },
        runtime,
    );
    assert.equal(second.added.length, 1);
    assert.equal(state.history.length, 1);
    assert.equal(state.history[0].payload.entries[0].事由, '旧伤');
});

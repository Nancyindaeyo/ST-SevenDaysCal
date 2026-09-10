import test from 'node:test';
import assert from 'node:assert/strict';
import { createTheaterController } from './controller.js';

function owners() {
    const owner = { controller: new AbortController(), cancelReason: '' };
    return {
        owner,
        create() { return owner; },
        isValid() { return true; },
        finish() {},
        invalidate() {},
    };
}

test('draft save failure is not treated as success', async () => {
    const controller = createTheaterController({
        owners: owners(),
        repository: { pushDrafts: async () => ({ ok: false }) },
        generate: async () => ({ pieces: [{ id: '1', title: '番外', raw: '正文' }] }),
        chatId: () => 'c',
        chatRevision: () => 1,
        names: () => ({ userName: '甲', charName: '乙' }),
        settings: () => ({ theaterCount: 1 }),
        storyContext: async () => '',
    });
    const result = await controller.run('写一篇');
    assert.equal(result.status, 'failed');
    assert.equal(result.reason, 'draft-save');
});

test('continue skips lottery and does not treat direction as a boxed recipe', async () => {
    let drawn = 0;
    let seen = null;
    const controller = createTheaterController({
        owners: owners(),
        repository: { pushDrafts: async () => ({ ok: true }) },
        generate: async (input, options) => {
            seen = { input, boxed: options.boxed, count: options.count, continueFrom: options.continueFrom, recipes: options.recipes };
            return { pieces: [{ id: 'p2', title: '续', raw: '下一段' }] };
        },
        drawPool: async () => { drawn += 1; return { recipes: [{ title: '不该抽' }], headers: [] }; },
        chatId: () => 'c',
        chatRevision: () => 1,
        names: () => ({ userName: '甲', charName: '乙' }),
        settings: () => ({ theaterCount: 2 }),
        storyContext: async () => '',
    });
    const result = await controller.run('他们出门', { continueFrom: { id: 'p1', title: '原', raw: '前文' } });
    assert.equal(result.status, 'updated');
    assert.equal(drawn, 0);
    assert.equal(seen.input, '他们出门');
    assert.equal(seen.boxed, false);
    assert.equal(seen.count, 1);
    assert.equal(seen.continueFrom.id, 'p1');
    assert.deepEqual(seen.recipes, []);
});

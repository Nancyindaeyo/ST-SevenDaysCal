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

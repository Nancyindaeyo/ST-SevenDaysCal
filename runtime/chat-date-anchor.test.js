import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatAnchorRepository } from './chat-date-anchor.js';

test('confirmed anchor clear writes a tombstone through the confirmed writer', async () => {
    const writes = [];
    const repository = createChatAnchorRepository({
        chatId: () => 'chat-a',
        read: () => null,
        write: () => true,
        writeConfirmed: async (record, options) => {
            writes.push({ record, options });
            return { ok: true, commitState: 'confirmed' };
        },
    });
    const ownerGuard = () => true;
    const result = await repository.clearConfirmed({ ownerGuard });
    assert.equal(result.ok, true);
    assert.equal(result.tombstone, true);
    assert.deepEqual(writes[0].record, {
        schemaVersion: 1,
        state: 'auto',
        chatId: 'chat-a',
        anchor: null,
    });
    assert.equal(writes[0].options.ownerGuard, ownerGuard);
});

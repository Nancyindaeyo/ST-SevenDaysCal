import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createChatScopedIdentity,
    sameChatScopedIdentity,
} from './chat-scoped-identity.js';
import { createLawIdentity } from './law/identity.js';
import { createOutlineIdentity } from './outline/identity.js';
import { createSlipIdentity } from './slip/identity.js';
import { createSpaceIdentity } from './space/identity.js';

test('createChatScopedIdentity freezes chat id, revision and named keys', () => {
    const identity = createChatScopedIdentity({
        chatId: () => '  room-1  ',
        chatRevision: '4',
        keys: {
            storeKey: { value: { extra: 1 }, kind: 'slip', extras: { view: 'user', charName: '' } },
        },
    });
    assert.equal(identity.chatId, 'room-1');
    assert.equal(identity.chatRevision, 4);
    assert.deepEqual(identity.storeKey, { extra: 1, view: 'user', charName: '', kind: 'slip', chatId: 'room-1' });
    assert.ok(Object.isFrozen(identity));
    assert.ok(Object.isFrozen(identity.storeKey));
    assert.equal(createChatScopedIdentity({ chatId: '' }).storeKey, undefined);
    assert.equal(createChatScopedIdentity({
        chatId: '',
        keys: { storeKey: { value: {}, kind: 'slip' } },
    }).storeKey, null);
});

test('sameChatScopedIdentity ignores domain keys and rejects revision drift', () => {
    const left = createChatScopedIdentity({ chatId: 'a', chatRevision: 1, keys: { storeKey: { kind: 'slip' } } });
    const right = createChatScopedIdentity({ chatId: 'a', chatRevision: 1, keys: { historyKey: { kind: 'space-chat' } } });
    assert.equal(sameChatScopedIdentity(left, right), true);
    assert.equal(sameChatScopedIdentity(left, createChatScopedIdentity({ chatId: 'a', chatRevision: 2 })), false);
    assert.equal(sameChatScopedIdentity(left, createChatScopedIdentity({ chatId: 'b', chatRevision: 1 })), false);
    assert.equal(sameChatScopedIdentity(left, null), false);
});

test('domain wrappers keep independent keys and do not share store shapes', () => {
    const slip = createSlipIdentity({ chatId: 'c1', chatRevision: 2 });
    const law = createLawIdentity({ chatId: 'c1', chatRevision: 2 });
    const space = createSpaceIdentity({ chatId: 'c1', chatRevision: 2 });
    const outline = createOutlineIdentity({ chatId: 'c1', chatRevision: 2 });
    assert.equal(slip.storeKey.kind, 'slip');
    assert.equal(law.storeKey.kind, 'law');
    assert.equal(space.historyKey.kind, 'space-chat');
    assert.equal(outline.outlineKey.kind, 'outline');
    assert.equal(outline.creativeChatKey.kind, 'creative-chat');
    assert.equal(Object.hasOwn(slip, 'historyKey'), false);
    assert.equal(Object.hasOwn(space, 'storeKey'), false);
    assert.equal(Object.hasOwn(outline, 'storeKey'), false);
    assert.equal(createOutlineIdentity({ chatId: () => 'c1' }).chatId, 'c1');
});

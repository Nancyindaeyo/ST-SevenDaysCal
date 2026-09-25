import test from 'node:test';
import assert from 'node:assert/strict';
import {
    authorDraftsSnapshot,
    authorDraftUnchanged,
    canWriteDraftToCurrent,
    freezeAuthorDraft,
    parkAuthorDraft,
    removeAuthorDraft,
    sanitizeDraftEvent,
    upsertAuthorDraft,
} from './author-draft.js';

const identity = {
    chatId: 'chat-a',
    chatRevision: 2,
    storeKey: { kind: 'slip', view: 'user', charName: '', chatId: 'chat-a' },
};

test('frozen draft keeps identity and drops later mutation of the source key', () => {
    const key = { ...identity.storeKey };
    const draft = freezeAuthorDraft({ kind: 'slip', text: '还没存的甲', identity: { ...identity, storeKey: key } });
    key.chatId = 'chat-b';
    assert.equal(draft.chatId, 'chat-a');
    assert.equal(draft.storeKey.chatId, 'chat-a');
    assert.equal(draft.inject, false);
});

test('park replaces the same kind+chat draft and never puts body into events', () => {
    const events = [];
    const bag = { items: [] };
    const draft = freezeAuthorDraft({ kind: 'slip', text: '秘密', identity });
    const first = parkAuthorDraft(draft, 'stale', {
        readRecovery: () => bag.items,
        writeRecovery: items => { bag.items = items; },
        onDraftEvent: event => events.push(event),
    });
    parkAuthorDraft(freezeAuthorDraft({ kind: 'slip', text: '第二版', identity }), 'unknown', {
        readRecovery: () => bag.items,
        writeRecovery: items => { bag.items = items; },
        onDraftEvent: event => events.push(event),
    });
    assert.equal(first.parked, true);
    assert.equal(first.commitState, 'not-dispatched');
    assert.equal(bag.items.length, 1);
    assert.equal(bag.items[0].text, '第二版');
    assert.equal(bag.items[0].reason, 'unknown');
    assert.deepEqual(events[0], { kind: 'slip', chatId: 'chat-a', reason: 'stale', parked: true });
    assert.equal(JSON.stringify(events).includes('秘密'), false);
    assert.equal(JSON.stringify(authorDraftsSnapshot(bag.items)).includes('第二版'), false);
});

test('restore guards and snapshot stay chat-scoped', () => {
    const draft = freezeAuthorDraft({ kind: 'law', text: '不要写怀孕', inject: true, identity });
    assert.equal(canWriteDraftToCurrent(draft, 'chat-a'), true);
    assert.equal(canWriteDraftToCurrent(draft, 'chat-b'), false);
    assert.equal(authorDraftUnchanged(draft, { text: '不要写怀孕', inject: true }), true);
    assert.equal(authorDraftUnchanged(draft, { text: '不要写怀孕', inject: false }), false);
    const parked = upsertAuthorDraft([], draft, 'stale');
    assert.equal(removeAuthorDraft(parked, 'law', 'chat-a').length, 0);
    assert.equal(sanitizeDraftEvent({ kind: 'law', chatId: 'chat-a', reason: 'stale', parked: true, text: '漏' }).text, undefined);
});

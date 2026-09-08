import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTheaterSnapshot } from './snapshot.js';
import { normalizeMeta } from '../coordinate/schema.js';

test('theater snapshot keeps piece id and marks kind theater', () => {
    const item = buildTheaterSnapshot(
        { id: 'piece-1', title: '回望', raw: '窗边还有月光', formName: '日记' },
        { chatId: 'chat-a', chatName: '今晚', charName: '春', title: '回望' },
    );
    assert.equal(item.id, 'piece-1');
    assert.equal(item.kind, 'theater');
    assert.equal(item.note, '回望');
    assert.equal(item.floorIndex, null);
    assert.equal(item.messageId, null);
    assert.match(item.html, /窗边还有月光/);
    assert.match(item.textPreview, /窗边还有月光/);
    assert.equal(normalizeMeta(item).kind, 'theater');
});

test('theater snapshot falls back to form name when title is empty', () => {
    const item = buildTheaterSnapshot({ id: 'piece-2', raw: '第二面', formName: '问卷' }, { charName: '夏' });
    assert.equal(item.note, '问卷');
    assert.equal(item.charName, '夏');
});

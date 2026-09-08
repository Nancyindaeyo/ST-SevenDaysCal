import test from 'node:test';
import assert from 'node:assert/strict';
import { createTheaterRepository } from './repository.js';

test('drafts stay visible when localStorage write throws', () => {
    const storage = {
        getItem() { return '[]'; },
        setItem() { throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); },
    };
    const repository = createTheaterRepository({
        storage,
        keyForChat: chatId => `sp-cache-${chatId}-theater-draft-user`,
        cap: 12,
    });
    const pieces = [
        { id: 'a', title: '回望', raw: '第一面正文', request: 'x'.repeat(8000), templateSource: { input: 'y'.repeat(8000) } },
        { id: 'b', title: '问卷', raw: '第二面正文' },
    ];
    const saved = repository.pushDrafts('chat-1', pieces);
    assert.equal(saved.ok, true);
    const drafts = repository.loadDrafts('chat-1');
    assert.equal(drafts.length, 2);
    assert.equal(drafts[0].raw, '第一面正文');
    assert.equal(drafts[1].title, '问卷');
});

test('missing storage key still keeps generated drafts in memory', () => {
    const repository = createTheaterRepository({
        storage: { getItem() { return '[]'; }, setItem() {} },
        keyForChat: () => '',
        cap: 12,
    });
    const saved = repository.pushDrafts('chat-2', [{ id: 'c', title: '日记', raw: '能看见' }]);
    assert.equal(saved.ok, true);
    assert.equal(repository.loadDrafts('chat-2')[0].raw, '能看见');
});

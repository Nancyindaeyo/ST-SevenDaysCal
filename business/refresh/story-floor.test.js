import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoryFloorHost, inspectStoryFloor, storyFloorNote } from './story-floor.js';

const longStory = `<content>${'夜色里他们把没说完的话一寸寸补上。'.repeat(20)}</content>`;

test('story floor accepts a closed long reply and rejects errors, open tags, and short text', () => {
    assert.equal(inspectStoryFloor(longStory).ok, true);
    assert.equal(inspectStoryFloor(`${longStory}\n房间号碰巧是 429。`).ok, true);
    assert.equal(inspectStoryFloor('Error: 429 Too Many Requests').reason, 'api-error');
    assert.equal(inspectStoryFloor('<html>cloudflare 524: A timeout occurred</html>').reason, 'api-error');
    assert.equal(inspectStoryFloor(`<content>${'已经写了很长一段，可是标签没有闭上。'.repeat(12)}`).reason, 'unclosed-tag');
    assert.equal(inspectStoryFloor('<content>只有一两句。</content>').reason, 'too-short');
    assert.equal(inspectStoryFloor('没有包裹，但是这句话本身就超过了两百个字。'.repeat(12)).ok, true);
});

test('story floor hold pauses once, stays quiet, then rearms the same floor', () => {
    const chat = [{ mes: 'Error 524 gateway timeout', is_user: false }];
    const noted = [];
    const rearms = [];
    const resumes = [];
    const host = createStoryFloorHost({
        chat: () => chat,
        chatId: () => 'c1',
        keepTags: () => 'content',
        alreadyNoted: () => noted.length > 0,
        record: entry => noted.push(entry),
        toast: () => {},
        abort: () => {},
        rearm: mid => rearms.push(mid),
        resume: mid => resumes.push(mid),
    });
    assert.equal(host.blocked(0), true);
    assert.equal(noted[0].note, storyFloorNote(0));
    assert.equal(host.status().reason, 'api-error');
    assert.equal(host.blocked(0), true);
    assert.equal(noted.length, 1);
    chat[0] = { mes: longStory, is_user: false, swipe_id: 1 };
    const decision = host.decision(0, { rearm: true, automations: true });
    assert.equal(decision.blocked, false);
    assert.equal(decision.resume, true);
    assert.deepEqual(rearms, [0]);
    assert.deepEqual(resumes, [0]);
    assert.equal(host.status(), null);
});

test('opening another chat does not keep the previous floor hold', () => {
    let chatId = 'a';
    const chats = {
        a: [{ mes: '<content>太短</content>', is_user: false }],
        b: [{ mes: longStory, is_user: false }],
    };
    const host = createStoryFloorHost({
        chat: () => chats[chatId],
        chatId: () => chatId,
        keepTags: () => 'content',
        record: () => {},
        toast: () => {},
        abort: () => {},
    });
    assert.equal(host.scan().blocked, true);
    host.reset();
    chatId = 'b';
    assert.equal(host.scan().blocked, false);
    assert.equal(host.status(), null);
});

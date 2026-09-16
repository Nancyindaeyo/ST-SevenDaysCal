import test from 'node:test';
import assert from 'node:assert/strict';
import {
    captureGenerationContext,
    captureParticipantIdentity,
    createChatBoundaryGate,
    runtimeIdentityHash,
    sameParticipantIdentity,
    sanitizeGenerationContextText,
    stripRerollModuleArtifacts,
} from './generation-context.js';

test('reroll isolation strips widgets before keepTags can leak body text', () => {
    const raw = '前文<almanac_widget>旧历正文</almanac_widget>后文';
    assert.equal(stripRerollModuleArtifacts(raw), '前文后文');
    assert.equal(sanitizeGenerationContextText(raw, {
        reroll: true,
        stripTags: value => String(value).replace(/<[^>]+>/g, ''),
    }), '前文后文');
    assert.equal(sanitizeGenerationContextText(raw, {
        reroll: false,
        stripTags: value => String(value).replace(/<[^>]+>/g, ''),
    }), '前文旧历正文后文');
});

test('participant identity prefers avatar and hashes persona descriptor', () => {
    const ctx = {
        chatId: 'c1',
        characterId: 2,
        characters: { 2: { avatar: '坏狗.png' } },
        name1: '我',
        name2: '她',
        powerUserSettings: { persona_name: '旅人' },
    };
    const identity = captureParticipantIdentity(ctx, { epoch: 4, charStableKey: () => 'fallback.png' });
    assert.equal(identity.boundaryEpoch, 4);
    assert.equal(identity.characterKey, '坏狗.png');
    assert.equal(identity.personaKey, runtimeIdentityHash('旅人'));
    assert.equal(identity.userName, '我');
    assert.equal(Object.isFrozen(identity), true);
    assert.equal(sameParticipantIdentity(identity, captureParticipantIdentity(ctx, { epoch: 4 })), true);
    assert.equal(sameParticipantIdentity(identity, captureParticipantIdentity(ctx, { epoch: 5 })), false);
    assert.equal(sameParticipantIdentity(identity, null), false);
});

test('generation context clones chat extras one level', () => {
    const extra = { note: 'a' };
    const ctx = { chat: [{ mes: 'hi', extra }], name1: '我' };
    const snap = captureGenerationContext(ctx);
    ctx.chat[0].extra.note = 'b';
    ctx.chat.push({ mes: 'later' });
    assert.equal(snap.chat[0].extra.note, 'a');
    assert.equal(snap.chat.length, 1);
    assert.equal(snap.name2, '角色');
});

function makeGate(overrides = {}) {
    let ctx = {
        chatId: 'c1',
        characterId: 0,
        characters: { 0: { avatar: 'card.png' } },
        name1: '用户',
        name2: '角色',
        chat: [{ mes: 'hi', swipe_id: 3 }],
        ...overrides.ctx,
    };
    const queued = [];
    const gate = createChatBoundaryGate({
        getContext: () => ctx,
        charStableKey: () => 'fallback.png',
        floorSignature: mid => `sig-${mid}-${ctx.chat?.[mid]?.mes || ''}`,
        floorKey: mid => ({
            messageId: Number(mid),
            swipeId: Number(ctx.chat?.[mid]?.swipe_id ?? 0),
            contentSignature: `sig-${mid}-${ctx.chat?.[mid]?.mes || ''}`,
        }),
        setTimeout: fn => { queued.push(fn); return queued.length; },
        ...overrides,
    });
    return {
        gate,
        queued,
        setChat(next) { ctx = { ...ctx, ...next }; },
        ctx: () => ctx,
    };
}

test('scheduleForChatBoundary drops callbacks after epoch or chatId change', () => {
    const { gate, queued, setChat } = makeGate();
    const ran = [];
    gate.scheduleForChatBoundary(() => ran.push('ok'), 10);
    queued[0]();
    assert.deepEqual(ran, ['ok']);

    gate.scheduleForChatBoundary(() => ran.push('stale-epoch'), 10);
    gate.beginBoundary();
    queued[1]();
    assert.deepEqual(ran, ['ok']);

    gate.scheduleForChatBoundary(() => ran.push('stale-chat'), 10);
    setChat({ chatId: 'c2' });
    queued[2]();
    assert.deepEqual(ran, ['ok']);
});

test('beginBoundary bumps epoch, recaptures identity, and arms date bootstrap once', () => {
    const { gate } = makeGate();
    assert.equal(gate.epoch(), 0);
    assert.equal(gate.consumeDateBootstrap(0), false);
    gate.markReady();
    assert.equal(gate.activeIdentity()?.chatId, 'c1');
    assert.equal(gate.consumeDateBootstrap(0), false);

    const first = gate.captureParticipantIdentity();
    const boundary = gate.beginBoundary();
    assert.equal(boundary.previousEpoch, 0);
    assert.equal(boundary.epoch, 1);
    assert.equal(gate.epoch(), 1);
    assert.equal(gate.activeIdentity()?.chatId, 'c1');
    assert.equal(sameParticipantIdentity(first, gate.captureParticipantIdentity()), false);
    assert.equal(gate.consumeDateBootstrap(0), true);
    assert.equal(gate.consumeDateBootstrap(0), false);
});

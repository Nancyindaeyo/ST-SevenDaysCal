import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSlipFeature } from './feature.js';
import { createSlipIdentity, sameSlipIdentity } from './identity.js';
import { createSlipRepository } from './repository.js';
import { enterSlipSidebar } from './ui.js';
import { normalizeSlip, SLIP_KIND, slipRecord } from './schema.js';

test('slip schema keeps raw text and drops unknown fields', () => {
    assert.deepEqual(normalizeSlip(null), { text: '', ts: 0 });
    assert.deepEqual(normalizeSlip('私设'), { text: '私设', ts: 0 });
    assert.equal(normalizeSlip({ text: '坑', ts: 9, extra: 1 }).extra, undefined);
    assert.equal(slipRecord('a', 3).text, 'a');
    assert.equal(SLIP_KIND, 'slip');
});

test('repository refuses writes after the chat identity moves', () => {
    const bag = { 'chat-a': { text: '旧', ts: 1 } };
    let revision = 1;
    const repo = createSlipRepository({
        captureIdentity: () => createSlipIdentity({
            chatId: 'chat-a',
            chatRevision: revision,
            storeKey: { kind: SLIP_KIND, view: 'user', charName: '', chatId: 'chat-a' },
        }),
        isCurrent: target => sameSlipIdentity(target, createSlipIdentity({
            chatId: 'chat-a',
            chatRevision: revision,
            storeKey: { kind: SLIP_KIND, view: 'user', charName: '', chatId: 'chat-a' },
        })),
        readStore: key => bag[key.chatId],
        writeStore: (key, value) => { bag[key.chatId] = value; return true; },
    });
    const old = repo.capture();
    repo.load(old);
    revision += 1;
    assert.equal(repo.saveText('新笺', old), false);
    assert.equal(bag['chat-a'].text, '旧');
    assert.equal(repo.text(), '旧');
});

test('chat change cancels a pending save so it cannot land on the next chat', async () => {
    const writes = [];
    let chatId = 'a';
    const liveInput = { onInput: null };
    let painted = '';
    const live = createSlipFeature({
        context: () => ({ chatId }),
        keyDesc: () => ({ kind: SLIP_KIND, view: 'user', charName: '', chatId }),
        readStore: () => ({ text: chatId === 'a' ? '甲' : '乙', ts: 1 }),
        writeStore: (key, value) => { writes.push({ chatId: key.chatId, text: value.text }); return true; },
        $in: sel => sel === '#sp-slip-input' ? {
            length: 1,
            0: {},
            val(value) { if (value !== undefined) painted = value; return painted; },
            on(ev, handler) {
                if (String(ev).startsWith('input')) liveInput.onInput = handler;
                return this;
            },
        } : { length: 0 },
    });
    live.bindUi();
    live.open();
    assert.equal(painted, '甲');
    liveInput.onInput.call({ value: '还没存的甲' });
    chatId = 'b';
    live.onChatChanged();
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.deepEqual(writes, []);
    live.open();
    assert.equal(painted, '乙');
});

test('flush after blur writes the current chat only', () => {
    const writes = [];
    const feature = createSlipFeature({
        context: () => ({ chatId: 'now' }),
        keyDesc: () => ({ kind: SLIP_KIND, view: 'user', charName: '', chatId: 'now' }),
        readStore: () => ({ text: '', ts: 0 }),
        writeStore: (key, value) => { writes.push({ chatId: key.chatId, text: value.text }); return true; },
        $in: sel => sel === '#sp-slip-input' ? {
            length: 1,
            0: {},
            _value: '',
            val(value) { if (value !== undefined) this._value = value; return this._value; },
            on() { return this; },
        } : { length: 0 },
    });
    feature.bindUi();
    feature.open();
    feature.flush('不要写怀孕');
    assert.deepEqual(writes, [{ chatId: 'now', text: '不要写怀孕' }]);
});

test('enter slip resets other modes then opens', () => {
    const calls = [];
    enterSlipSidebar({
        resetModes: () => calls.push('reset'),
        show: () => calls.push('show'),
        feature: { open: () => calls.push('open') },
    });
    assert.deepEqual(calls, ['reset', 'show', 'open']);
});

test('prompt and generation hosts never import slip', async () => {
    const files = [
        new URL('../../runtime/generation-messages.js', import.meta.url),
        new URL('../space/guide-prompt.js', import.meta.url),
        new URL('../space/context.js', import.meta.url),
        new URL('../beat/prompt.js', import.meta.url),
        new URL('../lines/prompt.js', import.meta.url),
        new URL('../lines/injection.js', import.meta.url),
        new URL('../outline/injection.js', import.meta.url),
        new URL('../ledger/inject.js', import.meta.url),
        new URL('../axis/story-clock.js', import.meta.url),
    ];
    for (const file of files) {
        const source = await readFile(file, 'utf8');
        assert.doesNotMatch(source, /\bslip\b|SLIP_KIND|\/slip['"]/, `${file.pathname} must not mention slip`);
    }
});

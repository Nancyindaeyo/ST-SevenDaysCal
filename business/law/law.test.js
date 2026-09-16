import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLawFeature } from './feature.js';
import { createLawIdentity, sameLawIdentity } from './identity.js';
import { createLawInjection } from './injection.js';
import { createLawRepository } from './repository.js';
import { enterLawSidebar } from './ui.js';
import { buildLawInjectionText, LAW_INJECT_DEPTH, LAW_INJECT_KEY, LAW_KIND, normalizeLaw } from './schema.js';

function fieldUi() {
    let text = '';
    let inject = false;
    let onInput = null;
    let onInject = null;
    return {
        text: () => text,
        inject: () => inject,
        onInput: () => onInput,
        $in(sel) {
            if (sel === '#sp-law-input') {
                return {
                    length: 1,
                    0: {},
                    val(value) { if (value !== undefined) text = value; return text; },
                    on(ev, handler) { if (String(ev).startsWith('input')) onInput = handler; return this; },
                };
            }
            if (sel === '#sp-law-inject') {
                return {
                    length: 1,
                    prop(name, value) {
                        if (name === 'checked') {
                            if (value !== undefined) inject = value === true;
                            return inject;
                        }
                        return this;
                    },
                    on(ev, handler) { if (String(ev).startsWith('change')) onInject = handler; return this; },
                };
            }
            return { length: 0 };
        },
        fireInject(value) { onInject?.(value); },
    };
}

test('law schema defaults inject off and builds a contract without ids', () => {
    assert.deepEqual(normalizeLaw(null), { text: '', inject: false, ts: 0 });
    assert.equal(normalizeLaw({ text: '不要写怀孕', inject: 'yes' }).inject, false);
    assert.equal(normalizeLaw({ text: '称呼保持您', inject: true }).inject, true);
    const prompt = buildLawInjectionText('不要写怀孕\n称呼保持您');
    assert.match(prompt, /作者合同/);
    assert.match(prompt, /不要写怀孕/);
    assert.doesNotMatch(prompt, /\bId:/);
    assert.equal(LAW_INJECT_DEPTH, 0);
    assert.equal(LAW_INJECT_KEY, 'sp_law_contract');
    assert.equal(LAW_KIND, 'law');
});

test('injection stays empty until the chat checkbox and the global gate are both on', () => {
    const calls = [];
    const record = { text: '不要写怀孕', inject: true };
    const injection = createLawInjection({
        context: () => ({
            constants: { promptTypes: { IN_CHAT: 1 }, promptRoles: { SYSTEM: 0 } },
            setExtensionPrompt: (...args) => calls.push(args),
        }),
        injectEnabled: () => false,
        readRecord: () => record,
    });
    injection.refresh();
    assert.deepEqual(calls, [[LAW_INJECT_KEY, '']]);
    calls.length = 0;
    const on = createLawInjection({
        context: () => ({
            constants: { promptTypes: { IN_CHAT: 1 }, promptRoles: { SYSTEM: 0 } },
            setExtensionPrompt: (...args) => calls.push(args),
        }),
        injectEnabled: () => true,
        readRecord: () => record,
    });
    on.refresh();
    assert.equal(calls[0][0], LAW_INJECT_KEY);
    assert.match(calls[0][1], /不要写怀孕/);
    assert.equal(calls[0][3], 0);
});

test('repository refuses writes after the chat identity moves', () => {
    const bag = { 'chat-a': { text: '旧', inject: true, ts: 1 } };
    let revision = 1;
    const repo = createLawRepository({
        captureIdentity: () => createLawIdentity({
            chatId: 'chat-a',
            chatRevision: revision,
            storeKey: { kind: LAW_KIND, view: 'user', charName: '', chatId: 'chat-a' },
        }),
        isCurrent: target => sameLawIdentity(target, createLawIdentity({
            chatId: 'chat-a',
            chatRevision: revision,
            storeKey: { kind: LAW_KIND, view: 'user', charName: '', chatId: 'chat-a' },
        })),
        readStore: key => bag[key.chatId],
        writeStore: (key, value) => { bag[key.chatId] = value; return true; },
    });
    const old = repo.capture();
    repo.load(old);
    revision += 1;
    assert.equal(repo.save('新律', false, old), false);
    assert.equal(bag['chat-a'].text, '旧');
    assert.equal(bag['chat-a'].inject, true);
});

test('chat change clears a pending inject so the next chat does not inherit it', async () => {
    const writes = [];
    const prompts = [];
    let chatId = 'a';
    const ui = fieldUi();
    const feature = createLawFeature({
        context: () => ({
            chatId,
            constants: { promptTypes: { IN_CHAT: 1 }, promptRoles: { SYSTEM: 0 } },
            setExtensionPrompt: (...args) => prompts.push(args.slice(0, 2)),
        }),
        keyDesc: () => ({ kind: LAW_KIND, view: 'user', charName: '', chatId }),
        readStore: () => chatId === 'a' ? { text: '旧律', inject: true, ts: 1 } : { text: '', inject: false, ts: 0 },
        writeStore: (key, value) => { writes.push({ chatId: key.chatId, text: value.text, inject: value.inject }); return true; },
        injectEnabled: () => true,
        $in: sel => ui.$in(sel),
    });
    feature.bindUi();
    feature.open();
    assert.match(prompts.at(-1)[1], /旧律/);
    ui.onInput().call({ value: '还没存的律' });
    chatId = 'b';
    feature.onChatChanged();
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.deepEqual(writes, []);
    assert.deepEqual(prompts.at(-1), [LAW_INJECT_KEY, '']);
    feature.open();
    assert.equal(ui.text(), '');
    assert.equal(ui.inject(), false);
});

test('enter law resets other modes then opens', () => {
    const calls = [];
    enterLawSidebar({
        resetModes: () => calls.push('reset'),
        show: () => calls.push('show'),
        feature: { open: () => calls.push('open') },
    });
    assert.deepEqual(calls, ['reset', 'show', 'open']);
});

test('prompt hosts never import law', async () => {
    const files = [
        new URL('../../runtime/generation-messages.js', import.meta.url),
        new URL('../space/guide-prompt.js', import.meta.url),
        new URL('../space/context.js', import.meta.url),
        new URL('../beat/prompt.js', import.meta.url),
        new URL('../lines/prompt.js', import.meta.url),
    ];
    for (const file of files) {
        const source = await readFile(file, 'utf8');
        assert.doesNotMatch(source, /\bLAW_KIND\b|\/law['"]/, `${file.pathname} must not import law`);
    }
});

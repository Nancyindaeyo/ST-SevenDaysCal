import test from 'node:test';
import assert from 'node:assert/strict';
import { createDebugPayload, payloadToJson } from './debug-payload.js';

test('payloadToJson pretty-prints objects and swallows cycles', () => {
    assert.equal(payloadToJson(null), null);
    assert.equal(payloadToJson(undefined), null);
    assert.match(payloadToJson({ model: 'x', messages: [1] }), /"model": "x"/);
    const cyclic = {};
    cyclic.self = cyclic;
    assert.equal(payloadToJson(cyclic), null);
});

function makeHost(overrides = {}) {
    const preview = { textContent: '' };
    const flags = { empty: null, hidden: null, disabled: null };
    const $in = sel => ({
        toggleClass(name, on) { if (sel === '#sp-diagnostics-ai-input-preview') flags.empty = [name, on]; return this; },
        prop(name, value) {
            if (sel === '#sp-diagnostics-ai-input-actions' && name === 'hidden') flags.hidden = value;
            if (sel === '#sp-diagnostics-ai-input-copy' && name === 'disabled') flags.disabled = value;
            return this;
        },
    });
    const notes = [];
    const host = createDebugPayload({
        inEl: sel => sel === '#sp-diagnostics-ai-input-pre' ? preview : null,
        $in,
        copyText: async () => false,
        promptTextarea: async () => {},
        notify: (message, isError) => notes.push([message, !!isError]),
        ...overrides,
    });
    return { host, preview, flags, notes };
}

test('preview shows empty copy until a request is stored', () => {
    const { host, preview, flags } = makeHost();
    assert.equal(host.refreshPreview(), null);
    assert.equal(preview.textContent, '（尚未发送请求）');
    assert.deepEqual(flags, { empty: ['sp-diagnostics-preview-empty', true], hidden: true, disabled: true });
    host.set({ model: 'gpt', messages: [{ role: 'user', content: 'hi' }] });
    assert.match(host.refreshPreview(), /"gpt"/);
    assert.match(preview.textContent, /"hi"/);
    assert.deepEqual(flags, { empty: ['sp-diagnostics-preview-empty', false], hidden: false, disabled: false });
});

test('copy reports empty, clipboard success, fallback dialog, then failure', async () => {
    const { host, notes } = makeHost();
    assert.deepEqual(await host.copy(), { status: 'empty' });
    assert.deepEqual(notes.at(-1), ['尚未发送请求', false]);

    host.set({ model: 'gpt' });
    const copied = makeHost({ copyText: async () => true });
    copied.host.set({ model: 'gpt' });
    assert.deepEqual(await copied.host.copy(), { status: 'copied' });
    assert.deepEqual(copied.notes.at(-1), ['AI 输入已复制', false]);

    const prompts = [];
    const manual = makeHost({
        copyText: async () => false,
        promptTextarea: async opts => { prompts.push(opts.title); },
    });
    manual.host.set({ model: 'gpt' });
    assert.deepEqual(await manual.host.copy(), { status: 'manual-copy' });
    assert.deepEqual(prompts, ['复制 AI 输入']);

    const failed = makeHost({
        copyText: async () => false,
        promptTextarea: null,
    });
    failed.host.set({ model: 'gpt' });
    assert.deepEqual(await failed.host.copy(), { status: 'failed' });
    assert.deepEqual(failed.notes.at(-1), ['自动复制失败，请在预览区手动选择内容', true]);
});

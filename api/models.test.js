import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { diagnosticMessage } from './diagnostics.js';
import {
    MODEL_STATUS_ENDPOINT,
    fetchChatCompletionModels,
    modelStatusRequestBody,
    parseChatCompletionModels,
} from './models.js';

test('parseChatCompletionModels reads data then models, sorts, and drops empty ids', () => {
    assert.deepEqual(parseChatCompletionModels({
        data: [{ id: 'b' }, 'a', { id: '' }],
    }), ['a', 'b']);
    assert.deepEqual(parseChatCompletionModels({ models: ['zeta', 'alpha'] }), ['alpha', 'zeta']);
    assert.deepEqual(parseChatCompletionModels({ data: [], models: ['kept'] }), []);
    assert.deepEqual(parseChatCompletionModels({}), []);
});

test('fetchChatCompletionModels posts the ST openai proxy body and rejects empty or error packs', async () => {
    assert.deepEqual(modelStatusRequestBody({ url: 'https://x/v1', key: 'k' }), {
        chat_completion_source: 'openai',
        reverse_proxy         : 'https://x/v1',
        proxy_password        : 'k',
    });

    const calls = [];
    const models = await fetchChatCompletionModels({
        url: 'https://x/v1',
        key: 'secret',
        headers: { 'Content-Type': 'application/json' },
        fetch: async (url, options) => {
            calls.push([url, options]);
            return {
                ok: true,
                json: async () => ({ data: [{ id: 'gpt-4' }, 'gpt-3.5'] }),
            };
        },
    });
    assert.deepEqual(models, ['gpt-3.5', 'gpt-4']);
    assert.equal(calls[0][0], MODEL_STATUS_ENDPOINT);
    assert.equal(calls[0][1].method, 'POST');
    assert.deepEqual(JSON.parse(calls[0][1].body), {
        chat_completion_source: 'openai',
        reverse_proxy         : 'https://x/v1',
        proxy_password        : 'secret',
    });

    await assert.rejects(
        () => fetchChatCompletionModels({
            fetch: async () => ({ ok: false, status: 502, text: async () => 'upstream boom'.repeat(20) }),
        }),
        /HTTP 502: .{1,120}$/,
    );
    await assert.rejects(
        () => fetchChatCompletionModels({
            fetch: async () => ({ ok: true, json: async () => ({ error: { message: 'nope' } }) }),
        }),
        err => err.diagnosticCode === 'unknown' && err.phase === 'request',
    );
    await assert.rejects(
        () => fetchChatCompletionModels({
            fetch: async () => ({ ok: true, json: async () => ({ data: [] }) }),
        }),
        /接口未返回任何模型/,
    );
    assert.equal(diagnosticMessage({ diagnosticCode: 'unknown' }), 'AI 生成失败，请稍后重试。');

    const source = await readFile(new URL('./models.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /script\.js|extensions\.js/);
});

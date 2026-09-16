import { makeDiagnosticError } from './diagnostics.js';

export const MODEL_STATUS_ENDPOINT = '/api/backends/chat-completions/status';

export function parseChatCompletionModels(data) {
    return (data?.data || data?.models || [])
        .map(m => (typeof m === 'string' ? m : m.id))
        .filter(Boolean)
        .sort();
}

export function modelStatusRequestBody({ url, key } = {}) {
    return {
        chat_completion_source: 'openai',
        reverse_proxy         : url,
        proxy_password        : key,
    };
}

// 走酒馆 /status 代理列 OpenAI 兼容模型，body 必须保持 openai + reverse_proxy + proxy_password。
export async function fetchChatCompletionModels({
    url,
    key,
    headers,
    fetch: fetchImpl = globalThis.fetch,
} = {}) {
    const res = await fetchImpl(MODEL_STATUS_ENDPOINT, {
        method : 'POST',
        headers,
        body   : JSON.stringify(modelStatusRequestBody({ url, key })),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 120)}`);
    const data = await res.json();
    if (data?.error) throw makeDiagnosticError('unknown', { phase: 'request' });
    const models = parseChatCompletionModels(data);
    if (!models.length) throw new Error('接口未返回任何模型');
    return models;
}

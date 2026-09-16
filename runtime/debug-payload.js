// 最近一次发给模型的请求：调试面板预览 / 复制。不进诊断包。
export function payloadToJson(payload) {
    if (payload === null || payload === undefined) return null;
    try {
        const json = JSON.stringify(payload, null, 2);
        return typeof json === 'string' ? json : null;
    } catch { return null; }
}

export function createDebugPayload(env = {}) {
    let last = null;

    function json() {
        return payloadToJson(last);
    }

    function set(value) {
        last = value;
        return last;
    }

    function refreshPreview() {
        const text = json();
        const hasPayload = Boolean(text);
        const preview = env.inEl?.('#sp-diagnostics-ai-input-pre');
        if (preview) preview.textContent = text || '（尚未发送请求）';
        env.$in?.('#sp-diagnostics-ai-input-preview').toggleClass('sp-diagnostics-preview-empty', !hasPayload);
        env.$in?.('#sp-diagnostics-ai-input-actions').prop('hidden', !hasPayload);
        env.$in?.('#sp-diagnostics-ai-input-copy').prop('disabled', !hasPayload);
        return text;
    }

    async function copy({
        copyText = env.copyText,
        promptTextarea = env.promptTextarea,
        notify = env.notify,
    } = {}) {
        const text = json();
        if (!text) {
            refreshPreview();
            try { notify?.('尚未发送请求', false); } catch {}
            return Object.freeze({ status: 'empty' });
        }
        let copied = false;
        try { copied = await copyText?.(text) === true; } catch {}
        if (copied) {
            try { notify?.('AI 输入已复制', false); } catch {}
            return Object.freeze({ status: 'copied' });
        }
        if (typeof promptTextarea !== 'function') {
            try { notify?.('自动复制失败，请在预览区手动选择内容', true); } catch {}
            return Object.freeze({ status: 'failed' });
        }
        try {
            await promptTextarea({
                title: '复制 AI 输入',
                body: '自动复制失败，请长按文本复制。这里可能包含最近聊天、上下文、世界书和提示词等敏感内容，请勿公开分享。',
                initialValue: text,
                maxLength: Math.max(1, text.length),
                rows: 12,
                confirmText: '关闭',
                cancelText: '取消',
            });
            return Object.freeze({ status: 'manual-copy' });
        } catch {
            try { notify?.('自动复制失败，请在预览区手动选择内容', true); } catch {}
            return Object.freeze({ status: 'failed' });
        }
    }

    return { set, json, refreshPreview, copy };
}

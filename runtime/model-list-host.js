import { fetchChatCompletionModels } from '../api/models.js';
import { filterModelList } from './api-fields-bind.js';

// 设置页模型列表：拉列表和渲染进 <details>，点击绑定仍由 bindApiFields 接线。
export function createModelListHost(env = {}) {
    let cached = [];
    const $in = (...args) => env.$in?.(...args);
    const filterList = env.filterList || filterModelList;
    const fetchModels = env.fetchModels || fetchChatCompletionModels;

    function render(models, filter = '') {
        cached = Array.isArray(models) ? models : [];
        $in('#sp-model-list-count').text(`已加载 ${cached.length} 个模型`);
        const shown = filterList(cached, filter);
        const current = ($in('#sp-cfg-model').val() || '').trim();
        if (!shown.length) {
            $in('#sp-model-list-items').html(`<div class="sp-model-list-empty">${String(filter ?? '').trim() ? '无匹配项' : '暂无模型'}</div>`);
            return;
        }
        // Cap the initial render at 200 items with a "show more" tail for MASSIVE lists;
        // in practice most APIs return <200 so this is defensive.
        const html = shown.map(m =>
            `<button type="button" class="sp-model-list-item${m === current ? ' sp-model-list-item-active' : ''}" data-model="${env.escapeAttr?.(m)}">${env.escapeHtml?.(m)}</button>`
        ).join('');
        $in('#sp-model-list-items').html(html);
    }

    async function fetch() {
        const rawUrl = $in('#sp-cfg-url').val().trim();
        const key = ($in('#sp-cfg-key').data('real') || $in('#sp-cfg-key').val()).trim();
        if (!rawUrl || !key) { env.toast?.('请先填写 URL 和 Key', null, true); return; }
        const url = env.normalizeUrl?.(rawUrl) ?? rawUrl;
        const ctx = env.getContext?.();

        const $btn = $in('#sp-fetch-models');
        $btn.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i>');
        try {
            const models = await fetchModels({
                url,
                key,
                headers: ctx?.getRequestHeaders?.(),
                fetch: env.fetch,
            });
            render(models);
            $in('#sp-model-list-section').attr('open', 'open').show();
            env.toast?.(`已加载 ${models.length} 个模型`);
            return models;
        } catch (err) {
            env.toast?.(`获取模型失败：${env.diagnosticMessage?.(err) ?? err?.message}`, null, true);
        } finally {
            $btn.prop('disabled', false).html('<i class="fa-solid fa-list"></i>');
        }
    }

    return {
        cached: () => cached,
        render,
        fetch,
    };
}

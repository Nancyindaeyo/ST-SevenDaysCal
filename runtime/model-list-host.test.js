import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createModelListHost } from './model-list-host.js';

function jq(state) {
    const api = {
        val() { return state.value ?? ''; },
        data(key) { return state.data?.[key]; },
        text(value) { state.text = value; return api; },
        html(value) { state.html = value; return api; },
        prop(key, value) { state[key] = value; return api; },
        attr(key, value) { state.attrs = { ...(state.attrs || {}), [key]: value }; return api; },
        show() { state.visible = true; return api; },
    };
    return api;
}

function makeHost(overrides = {}) {
    const nodes = {
        '#sp-cfg-url': { value: overrides.url ?? ' https://x/v1 ' },
        '#sp-cfg-key': { value: 'masked', data: { real: overrides.key ?? 'secret' } },
        '#sp-cfg-model': { value: overrides.current ?? 'gpt-4' },
        '#sp-fetch-models': {},
        '#sp-model-list-count': {},
        '#sp-model-list-items': {},
        '#sp-model-list-section': {},
    };
    const toasts = [];
    const fetchCalls = [];
    const host = createModelListHost({
        $in: sel => jq(nodes[sel] || (nodes[sel] = {})),
        escapeHtml: value => `H(${value})`,
        escapeAttr: value => `A(${value})`,
        filterList: (models, filter) => {
            const q = String(filter ?? '').trim();
            return q ? models.filter(m => m.includes(q)) : models;
        },
        normalizeUrl: value => String(value).trim().replace(/\/+$/, ''),
        getContext: () => ({ getRequestHeaders: () => ({ Authorization: 'yes' }) }),
        toast: (...args) => toasts.push(args),
        diagnosticMessage: err => `D:${err.message}`,
        fetchModels: async payload => {
            fetchCalls.push(payload);
            if (overrides.fetchError) throw overrides.fetchError;
            return overrides.models || ['gpt-3.5', 'gpt-4'];
        },
        ...overrides.env,
    });
    return { host, nodes, toasts, fetchCalls };
}

test('render caches models and marks the current selection', () => {
    const { host, nodes } = makeHost();
    host.render(['gpt-4', 'claude']);
    assert.deepEqual(host.cached(), ['gpt-4', 'claude']);
    assert.equal(nodes['#sp-model-list-count'].text, '已加载 2 个模型');
    assert.match(nodes['#sp-model-list-items'].html, /sp-model-list-item-active/);
    assert.match(nodes['#sp-model-list-items'].html, /data-model="A\(gpt-4\)"/);
    assert.match(nodes['#sp-model-list-items'].html, />H\(claude\)</);

    host.render([], 'zzz');
    assert.equal(nodes['#sp-model-list-items'].html, '<div class="sp-model-list-empty">无匹配项</div>');
    host.render([]);
    assert.equal(nodes['#sp-model-list-items'].html, '<div class="sp-model-list-empty">暂无模型</div>');
});

test('fetch requires url+key, posts via injected fetch, and restores the button', async () => {
    const missing = makeHost({ url: '', key: '' });
    assert.equal(await missing.host.fetch(), undefined);
    assert.deepEqual(missing.toasts, [['请先填写 URL 和 Key', null, true]]);
    assert.equal(missing.fetchCalls.length, 0);

    const ok = makeHost();
    const models = await ok.host.fetch();
    assert.deepEqual(models, ['gpt-3.5', 'gpt-4']);
    assert.equal(ok.fetchCalls[0].url, 'https://x/v1');
    assert.equal(ok.fetchCalls[0].key, 'secret');
    assert.deepEqual(ok.fetchCalls[0].headers, { Authorization: 'yes' });
    assert.equal(ok.nodes['#sp-model-list-section'].attrs.open, 'open');
    assert.equal(ok.nodes['#sp-model-list-section'].visible, true);
    assert.deepEqual(ok.toasts, [['已加载 2 个模型']]);
    assert.equal(ok.nodes['#sp-fetch-models'].disabled, false);
    assert.equal(ok.nodes['#sp-fetch-models'].html, '<i class="fa-solid fa-list"></i>');

    const failed = makeHost({ fetchError: new Error('boom') });
    await failed.host.fetch();
    assert.deepEqual(failed.toasts, [['获取模型失败：D:boom', null, true]]);
    assert.equal(failed.nodes['#sp-fetch-models'].disabled, false);
});

test('model list host does not import SillyTavern internals', async () => {
    const source = await readFile(new URL('./model-list-host.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /script\.js|extensions\.js/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { builtinMemoryHasPending, createMemoryInjectHost, formatBuiltinMemoryHealthLines } from './inject-host.js';

function makeHost(overrides = {}) {
    const calls = [];
    const host = createMemoryInjectHost({
        settings: () => overrides.settings || {},
        getApi: () => overrides.api,
        confirm: options => { calls.push(['confirm', options]); return overrides.confirmResult ?? false; },
        healthReport: () => overrides.report || {},
        builtinContext: () => overrides.builtin ?? '内置记忆',
        warnMissingApi: () => calls.push('warn-api'),
        warnReadError: err => calls.push(['warn-read', err.message]),
        ...overrides.env,
    });
    return { host, calls };
}

test('busy-only builtin memory does not block; paused and pending still confirm', async () => {
    assert.equal(builtinMemoryHasPending({ busy: true }), false);
    assert.equal(builtinMemoryHasPending({ paused: true }), true);
    const idle = makeHost({ report: { busy: true, pending: 0 } });
    assert.equal(await idle.host.precheck(), true);
    assert.equal(idle.calls.length, 0);

    const blocked = makeHost({
        report: { paused: true, pending: 2, permaFailed: 1, strippedEmpty: 3, busy: true },
    });
    assert.equal(await blocked.host.precheck(), false);
    assert.deepEqual(blocked.calls[0][1], {
        title: '记忆库不完整',
        body: formatBuiltinMemoryHealthLines({ paused: true, pending: 2, permaFailed: 1, strippedEmpty: 3, busy: true }).join('\n'),
        note: '继续生成会使用当前记忆库（可能不完整）。你也可以先去修复。',
        confirmText: '继续生成',
        cancelText: '取消',
    });
    assert.match(blocked.calls[0][1].body, /记忆系统已暂停/);
    assert.match(blocked.calls[0][1].body, /有 2 楼待摘要/);
});

test('baibaoshu precheck uses coverage and does not duplicate it', async () => {
    const missing = makeHost({ settings: { useBaiBaiBook: true }, api: null });
    await missing.host.precheck();
    assert.equal(missing.calls[0][1].title, '柏宝书未就绪');
    assert.equal(missing.calls[0][1].confirmText, '仍然继续');

    const incomplete = makeHost({
        settings: { useBaiBaiBook: true },
        api: { getInjectedHistory: () => ({ coverage: { complete: false, missingAiFloors: [4, 5, 6] } }) },
    });
    await incomplete.host.precheck();
    assert.equal(incomplete.calls[0][1].title, '柏宝书记忆未覆盖完整');
    assert.equal(incomplete.calls[0][1].body, '柏宝书报告缺 3 楼摘要（missingAiFloors）。');

    const ready = makeHost({
        settings: { useBaiBaiBook: true },
        api: { getInjectedHistory: () => ({ coverage: { complete: true } }) },
    });
    assert.equal(await ready.host.precheck(), true);
    assert.equal(ready.calls.length, 0);

    const source = await readFile(new URL('./inject-host.js', import.meta.url), 'utf8');
    assert.match(source, /from '\.\/baibaoshu\.js'/);
    assert.doesNotMatch(source, /from ['"]\.\.\/\.\.\/memory\.js['"]|getHealthReport/);
});

test('memory text prefers 柏宝书 history; full analysis uses getHistory', async () => {
    const builtin = makeHost();
    assert.equal(await builtin.host.getTextRaw(), '内置记忆');

    const missing = makeHost({ settings: { useBaiBaiBook: true }, api: {} });
    assert.equal(await missing.host.getTextRaw(), '');
    assert.equal(await missing.host.getTextRaw(), '');
    assert.equal(missing.calls.filter(call => call === 'warn-api').length, 2);

    const api = {
        getInjectedHistory: () => ({ relativeText: '近景' }),
        getHistory: () => ({ relativeText: '全年' }),
    };
    const book = makeHost({ settings: { useBaiBaiBook: true }, api });
    assert.equal(await book.host.getTextRaw(), '近景');
    assert.equal(await book.host.getTextRaw({ full: true }), '全年');

    const exploding = makeHost({
        settings: { useBaiBaiBook: true },
        env: { getApi: () => ({ getInjectedHistory: () => { throw new Error('boom'); } }) },
    });
    assert.equal(await exploding.host.getTextRaw(), '');
    assert.deepEqual(exploding.calls[0], ['warn-read', 'boom']);
});

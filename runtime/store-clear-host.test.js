import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStoreClearHost } from './store-clear-host.js';
import { dispatchStoreClearInvalidate, dispatchStoreClearRefreshAfter, dispatchStoreClearRefreshFromStore } from './storage-clear.js';

function makeHost(overrides = {}) {
    const calls = [];
    let linesMode = overrides.linesMode === true;
    let generating = true;
    const host = createStoreClearHost({
        traceAbort: payload => calls.push(['trace', payload]),
        chatId: () => 'c1',
        chatRevision: () => 7,
        boundaryEpoch: () => 3,
        abortPointSchedule: reason => calls.push(['abort-point', reason]),
        abortAutoRegen: reason => calls.push(['abort-auto', reason]),
        setPointGenerating: value => { generating = value; calls.push(['generating', value]); },
        outline: {
            invalidateStoreKind: kind => calls.push(['outline-invalidate', kind]),
            refreshAfterStoreClear: kind => calls.push(['outline-empty', kind]),
            refreshFromStore: kind => calls.push(['outline-from', kind]),
        },
        lines: {
            abortGeneration: options => calls.push(['abort-lines', options]),
            renderBody: html => calls.push(['lines-body', html]),
            refreshPanel: () => calls.push('lines-refresh'),
            dashed: {
                abort: reason => calls.push(['abort-dashed', reason]),
                resetError: () => calls.push('dashed-reset'),
            },
        },
        space: {
            invalidateStoreKind: kind => calls.push(['space-invalidate', kind]),
            refreshAfterStoreClear: kind => calls.push(['space-empty', kind]),
            refreshFromStore: kind => calls.push(['space-from', kind]),
        },
        slip: {
            invalidateStoreKind: kind => calls.push(['slip-invalidate', kind]),
            refreshAfterStoreClear: kind => calls.push(['slip-empty', kind]),
            refreshFromStore: kind => calls.push(['slip-from', kind]),
        },
        law: {
            invalidateStoreKind: kind => calls.push(['law-invalidate', kind]),
            refreshAfterStoreClear: kind => calls.push(['law-empty', kind]),
            refreshFromStore: kind => calls.push(['law-from', kind]),
        },
        setPointCache: html => calls.push(['point-cache', html]),
        setBody: html => calls.push(['body', html]),
        emptyPointHtml: () => 'EMPTY-POINT',
        emptyLinesHtml: () => 'EMPTY-LINES',
        syncScheduleBlock: () => calls.push('sync-schedule'),
        syncInlineBlock: () => calls.push('sync-inline'),
        resetLinesRuntime: () => calls.push('reset-lines'),
        refreshLinesInjection: () => calls.push('inject-lines'),
        linesMode: () => linesMode,
        readPoint: () => overrides.saved,
        getContext: () => ({ name1: '用户', name2: '角色' }),
        currentView: () => overrides.view || 'user',
        charViewName: () => overrides.charName || '',
        renderSchedule: (raw, userName) => `HTML:${userName}:${raw}`,
        scheduleVisible: () => overrides.visible !== false,
        ...overrides.env,
    });
    return { host, calls, get generating() { return generating; }, setLinesMode: value => { linesMode = value; } };
}

test('trace and abortSchedule clear both point pipelines', () => {
    const env = makeHost();
    env.host.trace('schedule');
    env.host.abortSchedule();
    assert.deepEqual(env.calls[0][1], {
        module: 'schedule',
        chatId: 'c1',
        chatRevision: 7,
        boundaryEpoch: 3,
        abortReason: 'store-clear',
        status: 'dispatch',
    });
    assert.deepEqual(env.calls.slice(1), [
        ['abort-point', 'store-clear'],
        ['abort-auto', 'store-clear'],
        ['generating', false],
    ]);
    assert.equal(env.generating, false);
});

test('empty schedule paints empty html; lines body only when the sheet is open', () => {
    const closed = makeHost();
    closed.host.refreshScheduleEmpty();
    closed.host.refreshLinesEmpty();
    assert.deepEqual(closed.calls, [
        ['point-cache', null],
        ['body', 'EMPTY-POINT'],
        'sync-schedule',
        'reset-lines',
        'inject-lines',
        'sync-inline',
    ]);

    const open = makeHost({ linesMode: true });
    open.host.refreshLinesEmpty();
    assert.equal(open.calls.includes('reset-lines'), true);
    assert.deepEqual(open.calls.find(call => Array.isArray(call) && call[0] === 'lines-body'), ['lines-body', 'EMPTY-LINES']);
});

test('schedule reread uses the view subject and skips body when hidden', () => {
    const visible = makeHost({ saved: { raw: '<cal/>', userName: '甲' } });
    visible.host.refreshScheduleFromStore();
    assert.equal(visible.calls[0][1], 'HTML:甲:<cal/>');
    assert.equal(visible.calls.some(call => Array.isArray(call) && call[0] === 'body'), true);

    const hidden = makeHost({ saved: { raw: '<cal/>' }, visible: false, view: 'char', charName: '乙' });
    hidden.host.refreshScheduleFromStore();
    assert.equal(hidden.calls[0][1], 'HTML:乙:<cal/>');
    assert.equal(hidden.calls.some(call => Array.isArray(call) && call[0] === 'body'), false);
});

test('dispatch still routes through the host ports and this file does not wrap it', async () => {
    const { host, calls } = makeHost({ linesMode: true });
    dispatchStoreClearInvalidate('dashed', host);
    dispatchStoreClearRefreshAfter('creative-chat', host);
    dispatchStoreClearRefreshFromStore('law', host);
    assert.deepEqual(calls.map(call => Array.isArray(call) ? call[0] : call), [
        'trace',
        'abort-dashed',
        'outline-empty',
        'law-from',
    ]);
    const source = await readFile(new URL('./store-clear-host.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /import[\s\S]*dispatchStoreClear|function dispatchStoreClear|export function dispatchStoreClear/);
});

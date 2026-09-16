import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BACKGROUND_ABORT_PORTS,
    PLUGIN_DISABLE_REASON,
    abortAllBackground,
    applyPluginEnabled,
    createPluginLifecycle,
} from './plugin-lifecycle.js';

function track(calls, name) {
    return new Proxy({}, {
        get(_, prop) {
            if (prop === 'then') return undefined;
            return (...args) => {
                calls.push(`${name}.${String(prop)}`);
                return args;
            };
        },
    });
}

function host(overrides = {}) {
    const calls = [];
    const h = {
        calls,
        context: () => ({ chatId: 'c1' }),
        chatRevision: () => 3,
        boundaryEpoch: () => 9,
        traceAbort: payload => calls.push(['traceAbort', payload]),
        memory: track(calls, 'memory'),
        timeTravel: track(calls, 'timeTravel'),
        customDialog: track(calls, 'customDialog'),
        lines: track(calls, 'lines'),
        linesRuntime: track(calls, 'linesRuntime'),
        abortPointSchedule: reason => calls.push(['abortPointSchedule', reason]),
        abortDateDetection: reason => calls.push(['abortDateDetection', reason]),
        abortAutoRegen: reason => calls.push(['abortAutoRegen', reason]),
        abortLedgerCapture: reason => calls.push(['abortLedgerCapture', reason]),
        abortLedgerJudge: reason => calls.push(['abortLedgerJudge', reason]),
        outline: track(calls, 'outline'),
        space: track(calls, 'space'),
        dashed: track(calls, 'dashed'),
        refresh: track(calls, 'refresh'),
        floorQueue: track(calls, 'floorQueue'),
        syncFabFailed: () => calls.push('syncFabFailed'),
        theater: {
            ...track(calls, 'theater'),
            onPluginDisabled: () => calls.push('theater.onPluginDisabled'),
            openIfActive: () => calls.push('theater.openIfActive'),
        },
        axisGeneration: track(calls, 'axisGeneration'),
        ledgerJudge: track(calls, 'ledgerJudge'),
        ledgerCapture: track(calls, 'ledgerCapture'),
        reloadOutlineChatIfOpen: () => calls.push('reloadOutlineChatIfOpen'),
        coordinate: track(calls, 'coordinate'),
        slip: track(calls, 'slip'),
        showFab: () => calls.push('showFab'),
        hideFab: () => calls.push('hideFab'),
        backfillInline: () => calls.push('backfillInline'),
        refreshOutlineInjection: () => calls.push('refreshOutlineInjection'),
        refreshCoordinateButtons: () => calls.push('refreshCoordinateButtons'),
        refreshInline: () => calls.push('refreshInline'),
        applyBoundCalendar: () => calls.push('applyBoundCalendar'),
        clearInline: () => calls.push('clearInline'),
        clearLinesInjection: () => calls.push('clearLinesInjection'),
        clearOutlineInjection: () => calls.push('clearOutlineInjection'),
        clearLedgerInjection: () => calls.push('clearLedgerInjection'),
        refreshStoryClock: opts => calls.push(['refreshStoryClock', opts]),
        paintPaceSoon: () => calls.push('paintPaceSoon'),
        ...overrides,
    };
    return h;
}

test('abortAllBackground calls every injected port and fails if one is missing', () => {
    const h = host();
    abortAllBackground(h);
    const names = h.calls.map(item => Array.isArray(item) ? item[0] : item);
    assert.equal(h.calls[0][0], 'traceAbort');
    assert.equal(h.calls[0][1].abortReason, PLUGIN_DISABLE_REASON);
    assert.equal(h.calls[0][1].chatId, 'c1');
    for (const spec of BACKGROUND_ABORT_PORTS) {
        assert.ok(names.includes(spec.port), `missing ${spec.port}`);
    }
    assert.equal(BACKGROUND_ABORT_PORTS.length, 22);
    const incomplete = host({ space: {} });
    assert.throws(() => abortAllBackground(incomplete), /missing abort port: space.abortAll/);
});

test('disabling the plugin aborts first, then clears chat injections', () => {
    const h = host();
    applyPluginEnabled(h, false);
    const names = h.calls.map(item => Array.isArray(item) ? item[0] : item);
    assert.ok(names.indexOf('slip.flush') < names.indexOf('coordinate.close'));
    assert.ok(names.indexOf('coordinate.close') < names.indexOf('traceAbort'));
    assert.ok(names.indexOf('clearInline') < names.indexOf('traceAbort'));
    assert.ok(names.indexOf('memory.abortAll') < names.indexOf('clearLinesInjection'));
    assert.ok(names.indexOf('clearLinesInjection') < names.indexOf('refreshStoryClock'));
    assert.ok(names.includes('clearOutlineInjection'));
    assert.ok(names.includes('clearLedgerInjection'));
    assert.deepEqual(h.calls.at(-2), ['refreshStoryClock', { announce: true }]);
    assert.equal(h.calls.at(-1), 'paintPaceSoon');
});

test('enabling the plugin restores surfaces without aborting in-flight work', () => {
    const h = host();
    applyPluginEnabled(h, true);
    const names = h.calls.map(item => Array.isArray(item) ? item[0] : item);
    assert.ok(!names.includes('traceAbort'));
    assert.ok(!names.includes('memory.abortAll'));
    assert.ok(names.includes('theater.openIfActive'));
    assert.ok(names.includes('showFab'));
    assert.ok(names.includes('backfillInline'));
    assert.ok(names.includes('refreshOutlineInjection'));
    assert.ok(names.includes('refreshCoordinateButtons'));
    assert.ok(names.includes('applyBoundCalendar'));
});

test('createPluginLifecycle binds abort and enable onto one host', () => {
    const h = host();
    const life = createPluginLifecycle(h);
    life.abortAllBackground('hot-reload');
    assert.equal(h.calls[0][1].abortReason, 'hot-reload');
    life.applyPluginEnabled(true);
    assert.ok(h.calls.some(item => item === 'showFab'));
});
